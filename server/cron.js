const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const line = require('@line/bot-sdk');
const dotenv = require('dotenv');

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
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
      
      const expiredQueues = await prisma.queue.findMany({
        where: {
          status: 'CALLED',
          calledAt: { lte: fifteenMinutesAgo }
        }
      });

      for (const q of expiredQueues) {
        await prisma.queue.update({
          where: { id: q.id },
          data: { status: 'CANCELED' }
        });
        console.log(`Auto-cancelled queue ${q.id} due to timeout.`);

        if (lineClient && q.lineUserId) {
          try {
            await lineClient.pushMessage({
              to: q.lineUserId,
              messages: [{
                type: 'text',
                text: `お呼び出しから一定時間（15分）が経過したため、自動的にキャンセルとさせていただきました。\n再度ご希望の場合は、改めて受付をお願いいたします。`
              }]
            });
          } catch (err) {
            console.error("Failed to send LINE message for auto-cancel:", err);
          }
        }
      }
    } catch (error) {
      console.error('Error in cron job:', error);
    }
  });
}

module.exports = { startCron };
