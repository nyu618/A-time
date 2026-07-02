const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const line = require('@line/bot-sdk');
const dotenv = require('dotenv');
const { handleCancelAndRequeue } = require('./queueHelper');

dotenv.config();

const connectionString = process.env.DATABASE_URL || "postgresql://dummy:dummy@localhost:5432/dummy";
const pool = new Pool({ connectionString });
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
  // 時間による自動キャンセル機能は廃止されました
}

module.exports = { startCron };
