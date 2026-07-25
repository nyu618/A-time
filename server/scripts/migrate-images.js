const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const cloudinary = require('cloudinary').v2;
const dotenv = require('dotenv');
const path = require('path');

// Helper to pause execution
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Load environment variables from server/.env
dotenv.config({ path: path.join(__dirname, '../.env') });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// "http"から始まらず、かつ文字数が1000文字以上ならBase64などの画像データと判定する
const isBase64Data = (str) => {
  if (!str) return false;
  if (typeof str !== 'string') return false;
  return !str.startsWith('http') && str.length > 1000;
};

const uploadToCloudinary = async (base64String, folderName) => {
  if (!isBase64Data(base64String)) {
    return base64String; // すでにURLならそのまま返す
  }
  try {
    const result = await cloudinary.uploader.upload(base64String, {
      folder: folderName
    });
    return result.secure_url;
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    throw error;
  }
};

async function checkAndLogCounts() {
  console.log("=== 実行前: 対象レコードの集計 ===");

  // Agreement
  const totalAgreements = await prisma.agreement.count();
  const targetAgreements = await prisma.agreement.count({
    where: {
      OR: [
        { idCardImageFront: { not: { startsWith: 'http' }, not: null } },
        { idCardImageBack: { not: { startsWith: 'http' }, not: null } },
        { signatureData: { not: { startsWith: 'http' }, not: null } }
      ]
    }
  });

  // Queue
  const totalQueues = await prisma.queue.count();
  const targetQueues = await prisma.queue.count({
    where: {
      paperSignatureImage: { not: { startsWith: 'http' }, not: { startsWith: '["http' }, not: null }
    }
  });

  console.log(`[Agreementモデル] 全レコード数: ${totalAgreements}件 / うち未移行（対象）: ${targetAgreements}件`);
  console.log(`[Queueモデル] 全レコード数: ${totalQueues}件 / うち未移行（対象）: ${targetQueues}件`);
  console.log("===================================\n");
  
  if (targetAgreements === 0 && targetQueues === 0) {
    console.log("※すべてのデータがすでにCloudinaryへ移行済み（または対象外）のため、処理を終了します。");
    process.exit(0);
  }
}

async function migrateAgreements() {
  console.log("--- Starting Agreement Migration ---");
  const batchSize = 5; // OOM対策: 5件ずつ取得
  let skip = 0;
  let hasMore = true;

  while (hasMore) {
    const agreements = await prisma.agreement.findMany({
      skip,
      take: batchSize,
      orderBy: { id: 'asc' }
    });

    if (agreements.length === 0) {
      hasMore = false;
      break;
    }

    for (const agreement of agreements) {
      try {
        let updated = false;
        const updateData = {};

        // 1. idCardImageFront
        if (isBase64Data(agreement.idCardImageFront)) {
          console.log(`Migrating Agreement ID ${agreement.id}: idCardImageFront`);
          updateData.idCardImageFront = await uploadToCloudinary(agreement.idCardImageFront, 'a-time-archive/id_cards');
          updated = true;
        }

        // 2. idCardImageBack
        if (isBase64Data(agreement.idCardImageBack)) {
          console.log(`Migrating Agreement ID ${agreement.id}: idCardImageBack`);
          updateData.idCardImageBack = await uploadToCloudinary(agreement.idCardImageBack, 'a-time-archive/id_cards');
          updated = true;
        }

        // 3. signatureData
        if (isBase64Data(agreement.signatureData)) {
          console.log(`Migrating Agreement ID ${agreement.id}: signatureData`);
          updateData.signatureData = await uploadToCloudinary(agreement.signatureData, 'a-time-archive/signatures');
          updated = true;
        }

        if (updated) {
          await prisma.agreement.update({
            where: { id: agreement.id },
            data: updateData
          });
          console.log(`Successfully updated Agreement ID ${agreement.id}`);
        }

        // GC Hints
        agreement.idCardImageFront = null;
        agreement.idCardImageBack = null;
        agreement.signatureData = null;
      } catch (err) {
        console.error(`Error processing Agreement ID ${agreement.id}:`, err);
      }
    }

    agreements.length = 0; // Clear array explicitly
    skip += batchSize;
    console.log(`Processed up to ${skip} Agreement records... waiting 3 seconds to free memory...`);
    await sleep(3000); // OOM対策: インターバル
  }
  console.log("--- Finished Agreement Migration ---\n");
}

async function migrateQueues() {
  console.log("--- Starting Queue Migration ---");
  const batchSize = 5; // OOM対策: 5件ずつ取得
  let skip = 0;
  let hasMore = true;

  while (hasMore) {
    const queues = await prisma.queue.findMany({
      skip,
      take: batchSize,
      orderBy: { id: 'asc' }
    });

    if (queues.length === 0) {
      hasMore = false;
      break;
    }

    for (const queue of queues) {
      try {
        if (!queue.paperSignatureImage) continue;

        let images = [];
        try {
          // JSON配列として保存されている場合を考慮
          images = JSON.parse(queue.paperSignatureImage);
          if (!Array.isArray(images)) images = [queue.paperSignatureImage];
        } catch {
          // パースできない場合は単一の文字列として扱う
          images = [queue.paperSignatureImage];
        }

        let updated = false;
        const newImages = [];

        for (const img of images) {
          if (isBase64Data(img)) {
            console.log(`Migrating Queue ID ${queue.id}: paperSignatureImage`);
            const url = await uploadToCloudinary(img, 'a-time-archive/paper_signatures');
            newImages.push(url);
            updated = true;
          } else {
            newImages.push(img); // すでにURLの場合はそのまま保持
          }
        }

        if (updated) {
          await prisma.queue.update({
            where: { id: queue.id },
            data: { paperSignatureImage: JSON.stringify(newImages) }
          });
          console.log(`Successfully updated Queue ID ${queue.id}`);
        }

        queue.paperSignatureImage = null; // GC Hint
      } catch (err) {
        console.error(`Error processing Queue ID ${queue.id}:`, err);
      }
    }

    queues.length = 0; // Clear array explicitly
    skip += batchSize;
    console.log(`Processed up to ${skip} Queue records... waiting 3 seconds to free memory...`);
    await sleep(3000);
  }
  console.log("--- Finished Queue Migration ---");
}

async function main() {
  try {
    await checkAndLogCounts(); // 実行前の件数確認
    await migrateAgreements();
    await migrateQueues();
    console.log("All migrations completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await prisma.$disconnect();
    pool.end();
  }
}

main();
