const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const line = require('@line/bot-sdk');
const dotenv = require('dotenv');

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

// User: Register for queue
router.post('/queue', async (req, res) => {
  try {
    const { lineUserId, displayName } = req.body;
    if (!lineUserId) return res.status(400).json({ error: 'lineUserId is required' });

    // Check if user is already waiting
    const existing = await prisma.queue.findFirst({
      where: {
        lineUserId,
        status: { in: ['WAITING', 'CALLED'] }
      }
    });
    if (existing) {
      return res.json(existing);
    }

    const queueItem = await prisma.queue.create({
      data: { lineUserId, displayName, status: 'WAITING' }
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
        status: { in: ['WAITING', 'CALLED'] }
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
    const queues = await prisma.queue.findMany({
      where: {
        status: { in: ['WAITING', 'CALLED'] }
      },
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

// Admin: Mark as arrived
router.post('/admin/queue/:id/arrive', async (req, res) => {
  try {
    const { id } = req.params;
    const queueItem = await prisma.queue.update({
      where: { id: parseInt(id) },
      data: { status: 'ARRIVED' }
    });
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
    const queueItem = await prisma.queue.update({
      where: { id: parseInt(id) },
      data: { status: 'CANCELLED' }
    });
    res.json(queueItem);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
