const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const line = require('@line/bot-sdk');
const dotenv = require('dotenv');
const { callNextWaitingUser, handleCancelAndRequeue, formatDateJp } = require('../queueHelper');

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
        status: { in: ['PENDING', 'WAITING', 'CALLED', 'IN_STORE', 'ASSESSING', 'ASSESSMENT_DONE'] }
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
      data: { lineUserId, displayName, targetDate: dateStr, status: 'PENDING', dailyNumber: nextDailyNumber }
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
        status: { in: ['PENDING', 'WAITING', 'CALLED', 'IN_STORE', 'ASSESSING', 'ASSESSMENT_DONE'] }
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

// Admin: Approve a pending queue
router.post('/admin/queue/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    
    const queue = await prisma.queue.findUnique({ where: { id: parseInt(id) } });
    if (!queue) return res.status(404).json({ error: 'Not found' });

    const queueItem = await prisma.queue.update({
      where: { id: parseInt(id) },
      data: { status: 'WAITING' }
    });

    if (lineClient && queue.lineUserId) {
      try {
        await lineClient.pushMessage({
          to: queue.lineUserId,
          messages: [{
            type: 'text',
            text: `受付が承認されました。受付番号は『${queue.dailyNumber}番（${formatDateJp(queue.targetDate)}）』です。順番が近づくまでもうしばらくお待ちください。`
          }]
        });
      } catch (err) {
        console.error("Failed to send LINE message for approve:", err);
      }
    }

    res.json(queueItem);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: Reject a pending queue
router.post('/admin/queue/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const queue = await prisma.queue.findUnique({ where: { id: parseInt(id) } });
    if (!queue) return res.status(404).json({ error: 'Not found' });

    const queueItem = await prisma.queue.update({
      where: { id: parseInt(id) },
      data: { status: 'CANCELED' }
    });

    res.json(queueItem);
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
        const now = new Date();
        const deadline = new Date(now.getTime() + 15 * 60000);
        const deadlineStr = new Intl.DateTimeFormat('ja-JP', { 
          timeZone: 'Asia/Tokyo', 
          hour: '2-digit', 
          minute: '2-digit' 
        }).format(deadline);

        await lineClient.pushMessage({
          to: queueItem.lineUserId,
          messages: [{
            type: 'text',
            text: `順番が近づきました。ご来店をお願いいたします。\n${deadlineStr} までに店にお戻りいただき、スタッフへ「受付番号」と「お名前」をお伝えください。\n（受付番号: ${queueItem.dailyNumber}番（${formatDateJp(queueItem.targetDate)}））`
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
    
    const queue = await prisma.queue.findUnique({ where: { id: parseInt(id) } });
    if (!queue) return res.status(404).json({ error: 'Not found' });

    const queueItem = await prisma.queue.update({
      where: { id: parseInt(id) },
      data: { status: 'IN_STORE' }
    });

    if (lineClient && queue.lineUserId) {
      try {
        await lineClient.pushMessage({
          to: queue.lineUserId,
          messages: [{
            type: 'text',
            text: `受付番号『${queue.dailyNumber}番（${formatDateJp(queue.targetDate)}）』のお客様、ご来店ありがとうございます。お呼び出し通知があるまで、もうしばらく店内で待機をお願いいたします。`
          }]
        });
      } catch (err) {
        console.error("Failed to send LINE message for instore:", err);
      }
    }

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
    
    const queue = await prisma.queue.findUnique({ where: { id: parseInt(id) } });
    if (!queue) return res.status(404).json({ error: 'Not found' });

    const queueItem = await prisma.queue.update({
      where: { id: parseInt(id) },
      data: { status: 'ASSESSING' }
    });

    if (lineClient && queue.lineUserId) {
      try {
        await lineClient.pushMessage({
          to: queue.lineUserId,
          messages: [{
            type: 'text',
            text: `受付番号『${queue.dailyNumber}番（${formatDateJp(queue.targetDate)}）』のお客様、ただいまより査定を開始いたします。完了次第お知らせいたします。`
          }]
        });
      } catch (err) {
        console.error("Failed to send LINE message for assess:", err);
      }
    }

    res.json(queueItem);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: Mark as ASSESSMENT_DONE (査定完了)
router.post('/admin/queue/:id/assess-done', async (req, res) => {
  try {
    const { id } = req.params;
    
    const queue = await prisma.queue.findUnique({ where: { id: parseInt(id) } });
    if (!queue) return res.status(404).json({ error: 'Not found' });

    const queueItem = await prisma.queue.update({
      where: { id: parseInt(id) },
      data: { status: 'ASSESSMENT_DONE' }
    });

    if (lineClient && queue.lineUserId) {
      try {
        await lineClient.pushMessage({
          to: queue.lineUserId,
          messages: [{
            type: 'text',
            text: `受付番号『${queue.dailyNumber}番（${formatDateJp(queue.targetDate)}）』のお客様、お待たせいたしました。査定が完了いたしましたので、スタッフのいるカウンターまでお越しください。`
          }]
        });
      } catch (err) {
        console.error("Failed to send LINE message for assess-done:", err);
      }
    }

    res.json(queueItem);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: Mark as COMPLETED (対応完了)
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

    // Auto-call next waiting user
    await callNextWaitingUser(prisma, lineClient, queue.targetDate);

    res.json(queueItem);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: Cancel (手動キャンセル: 完全キャンセル)
router.post('/admin/queue/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;
    const queue = await prisma.queue.findUnique({ where: { id: parseInt(id) } });
    if (!queue) return res.status(404).json({ error: 'Not found' });

    const queueItem = await prisma.queue.update({
      where: { id: parseInt(id) },
      data: { status: 'CANCELED' }
    });

    // Auto-call next waiting user since slot freed up
    await callNextWaitingUser(prisma, lineClient, queue.targetDate);

    res.json(queueItem);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: Rollback (切り戻し)
router.post('/admin/queue/:id/rollback', async (req, res) => {
  try {
    const { id } = req.params;
    const queue = await prisma.queue.findUnique({ where: { id: parseInt(id) } });
    if (!queue) return res.status(404).json({ error: 'Not found' });

    let newStatus = queue.status;
    let dataUpdate = {};

    switch (queue.status) {
      case 'WAITING':
        newStatus = 'PENDING';
        break;
      case 'CALLED':
        newStatus = 'WAITING';
        dataUpdate = { calledAt: null }; // clear timer
        break;
      case 'IN_STORE':
        newStatus = 'CALLED';
        dataUpdate = { calledAt: new Date() }; // restart 15min timer
        break;
      case 'ASSESSING':
        newStatus = 'IN_STORE';
        break;
      case 'ASSESSMENT_DONE':
        newStatus = 'ASSESSING';
        break;
      case 'COMPLETED':
        newStatus = 'ASSESSMENT_DONE';
        break;
      case 'CANCELED':
        newStatus = 'CALLED';
        dataUpdate = { calledAt: new Date() }; // restart 15min timer
        
        // Delete auto-generated follow-up queue if exists (from cron)
        await prisma.queue.deleteMany({
          where: {
            lineUserId: queue.lineUserId,
            targetDate: queue.targetDate,
            cancelCount: queue.cancelCount + 1,
            status: { in: ['PENDING', 'WAITING', 'CALLED'] }
          }
        });
        break;
    }

    if (newStatus !== queue.status) {
      dataUpdate.status = newStatus;
      const updatedItem = await prisma.queue.update({
        where: { id: parseInt(id) },
        data: dataUpdate
      });
      return res.json(updatedItem);
    }
    
    res.json(queue);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
