const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const line = require('@line/bot-sdk');
const dotenv = require('dotenv');
const { callNextWaitingUser, handleCancelAndRequeue } = require('../queueHelper');

dotenv.config();

const router = express.Router();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
  channelSecret: process.env.LINE_CHANNEL_SECRET || '',
};

let lineClient = null;
if (lineConfig.channelAccessToken && lineConfig.channelSecret && lineConfig.channelAccessToken !== "YOUR_CHANNEL_ACCESS_TOKEN") {
  try {
    lineClient = new line.messagingApi.MessagingApiClient({
      channelAccessToken: lineConfig.channelAccessToken
    });
  } catch (err) {
    console.error("LINE Client initialization failed:", err);
  }
}

// Webhook endpoint for LINE (Used for verification and receiving events)
router.post('/webhook', (req, res) => {
  // Return 200 OK to pass the LINE Developers verification.
  res.status(200).send('OK');
});

// User: Register for queue
router.post('/queue', async (req, res) => {
  try {
    const { lineUserId, displayName, targetDate } = req.body;
    if (!lineUserId) return res.status(400).json({ error: 'lineUserId is required' });

    // Use provided date or today (JST approximation by client, or fallback)
    const dateStr = targetDate || new Date().toISOString().split('T')[0];

    // Upsert User
    await prisma.user.upsert({
      where: { lineUid: lineUserId },
      update: { displayName },
      create: { lineUid: lineUserId, displayName, visitCount: 0 }
    });

    // Check if user is already waiting today
    const existing = await prisma.queue.findFirst({
      where: {
        lineUserId,
        targetDate: dateStr,
        status: { in: ['WAITING', 'CALLED', 'IN_STORE', 'ASSESSING'] }
      }
    });
    if (existing) {
      return res.json(existing);
    }

    // Get max dailyNumber for today
    const maxQueue = await prisma.queue.findFirst({
      where: { targetDate: dateStr },
      orderBy: { dailyNumber: 'desc' }
    });
    const nextDailyNumber = maxQueue ? maxQueue.dailyNumber + 1 : 1;

    const queueItem = await prisma.queue.create({
      data: { lineUserId, displayName, targetDate: dateStr, status: 'WAITING', dailyNumber: nextDailyNumber }
    });
    res.json(queueItem);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// User: Get queue status
router.get('/queue/status/:lineUserId', async (req, res) => {
  try {
    const { lineUserId } = req.params;
    const queueItem = await prisma.queue.findFirst({
      where: {
        lineUserId,
        status: { in: ['WAITING', 'CALLED', 'IN_STORE', 'ASSESSING'] }
      }
    });

    if (!queueItem) {
      return res.json({ queueItem: null, waitCount: 0 });
    }

    // Calculate how many people are ahead
    const waitCount = await prisma.queue.count({
      where: {
        status: 'WAITING',
        createdAt: { lt: queueItem.createdAt }
      }
    });

    res.json({ queueItem, waitCount });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: Get all queues
router.get('/admin/queue', async (req, res) => {
  try {
    const dateStr = req.query.date || new Date().toISOString().split('T')[0];
    const queues = await prisma.queue.findMany({
      where: {
        targetDate: dateStr
      },
      include: { user: true },
      orderBy: { createdAt: 'asc' }
    });
    res.json(queues);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: Call a user
router.post('/admin/queue/:id/call', async (req, res) => {
  try {
    const { id } = req.params;
    const queueItem = await prisma.queue.update({
      where: { id: parseInt(id) },
      data: { status: 'CALLED', calledAt: new Date() }
    });

    // Send LINE message
    if (lineClient && queueItem.lineUserId) {
      try {
        await lineClient.pushMessage({
          to: queueItem.lineUserId,
          messages: [{
            type: 'text',
            text: `順番が近づきました。ご来店をお願いいたします。\n（受付番号: ${queueItem.id}）`
          }]
        });
      } catch (err) {
        console.error("Failed to send LINE message:", err);
      }
    }

    res.json(queueItem);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: Mark as IN_STORE
router.post('/admin/queue/:id/instore', async (req, res) => {
  try {
    const { id } = req.params;
    const queueItem = await prisma.queue.update({
      where: { id: parseInt(id) },
      data: { status: 'IN_STORE' }
    });
    res.json(queueItem);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: Mark as ASSESSING
router.post('/admin/queue/:id/assess', async (req, res) => {
  try {
    const { id } = req.params;
    const queueItem = await prisma.queue.update({
      where: { id: parseInt(id) },
      data: { status: 'ASSESSING' }
    });
    res.json(queueItem);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: Mark as COMPLETED (査定完了)
router.post('/admin/queue/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    
    // First find the queue to get the user
    const queue = await prisma.queue.findUnique({ where: { id: parseInt(id) } });
    if (!queue) return res.status(404).json({ error: 'Not found' });

    const queueItem = await prisma.queue.update({
      where: { id: parseInt(id) },
      data: { status: 'COMPLETED' }
    });

    // Increment user visit count
    await prisma.user.update({
      where: { lineUid: queue.lineUserId },
      data: { visitCount: { increment: 1 } }
    });

    // Send LINE message for completion
    if (lineClient && queue.lineUserId) {
      try {
        await lineClient.pushMessage({
          to: queue.lineUserId,
          messages: [{
            type: 'text',
            text: `査定が完了いたしました。お手数ですが、レジカウンターまでお越しください。`
          }]
        });
      } catch (err) {
        console.error("Failed to send LINE message for completion:", err);
      }
    }

    // Auto-call next waiting user
    await callNextWaitingUser(prisma, lineClient, queue.targetDate);

    res.json(queueItem);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: Cancel
router.post('/admin/queue/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;
    const newQueue = await handleCancelAndRequeue(prisma, lineClient, id);
    if (!newQueue) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.json(newQueue);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
