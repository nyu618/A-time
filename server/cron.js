const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const line = require('@line/bot-sdk');
const dotenv = require('dotenv');
const { handleCancelAndRequeue } = require('./queueHelper');

dotenv.config();

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

function startCron() {
  // Run every minute
  cron.schedule('* * * * *', async () => {
    try {
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
      
      const expiredQueues = await prisma.queue.findMany({
        where: {
          status: 'CALLED',
          calledAt: { lte: thirtyMinutesAgo }
        }
      });

      for (const q of expiredQueues) {
        const newQueue = await handleCancelAndRequeue(prisma, lineClient, q.id);
        if (newQueue) {
          console.log(`Auto-cancelled and requeued queue ${q.id} to ${newQueue.id} due to timeout.`);
        }
      }
    } catch (error) {
      console.error('Error in cron job:', error);
    }
  });
}

module.exports = { startCron };
