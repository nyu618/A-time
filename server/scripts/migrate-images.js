const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const cloudinary = require('cloudinary').v2;
const dotenv = require('dotenv');
const path = require('path');

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

const uploadToCloudinary = async (base64String, folderName) => {
  if (!base64String || !base64String.startsWith('data:image')) {
    return base64String;
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

async function migrateAgreements() {
  console.log("--- Starting Agreement Migration ---");
  const batchSize = 100;
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
        if (agreement.idCardImageFront && agreement.idCardImageFront.startsWith('data:image')) {
          console.log(`Migrating Agreement ID ${agreement.id}: idCardImageFront`);
          updateData.idCardImageFront = await uploadToCloudinary(agreement.idCardImageFront, 'id_cards');
          updated = true;
        }

        // 2. idCardImageBack
        if (agreement.idCardImageBack && agreement.idCardImageBack.startsWith('data:image')) {
          console.log(`Migrating Agreement ID ${agreement.id}: idCardImageBack`);
          updateData.idCardImageBack = await uploadToCloudinary(agreement.idCardImageBack, 'id_cards');
          updated = true;
        }

        // 3. signatureData
        if (agreement.signatureData && agreement.signatureData.startsWith('data:image')) {
          console.log(`Migrating Agreement ID ${agreement.id}: signatureData`);
          updateData.signatureData = await uploadToCloudinary(agreement.signatureData, 'signatures');
          updated = true;
        }

        if (updated) {
          await prisma.agreement.update({
            where: { id: agreement.id },
            data: updateData
          });
          console.log(`Successfully updated Agreement ID ${agreement.id}`);
        }
      } catch (err) {
        console.error(`Error processing Agreement ID ${agreement.id}:`, err);
        // Continue to next record even if this one fails
      }
    }

    skip += batchSize;
    console.log(`Processed ${skip} Agreement records...`);
  }
  console.log("--- Finished Agreement Migration ---");
}

async function migrateQueues() {
  console.log("--- Starting Queue Migration ---");
  const batchSize = 100;
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
          images = JSON.parse(queue.paperSignatureImage);
          if (!Array.isArray(images)) images = [queue.paperSignatureImage];
        } catch {
          images = [queue.paperSignatureImage];
        }

        let updated = false;
        const newImages = [];

        for (const img of images) {
          if (img && img.startsWith('data:image')) {
            console.log(`Migrating Queue ID ${queue.id}: paperSignatureImage`);
            const url = await uploadToCloudinary(img, 'paper_signatures');
            newImages.push(url);
            updated = true;
          } else {
            newImages.push(img); // Already a URL or empty
          }
        }

        if (updated) {
          await prisma.queue.update({
            where: { id: queue.id },
            data: { paperSignatureImage: JSON.stringify(newImages) }
          });
          console.log(`Successfully updated Queue ID ${queue.id}`);
        }

      } catch (err) {
        console.error(`Error processing Queue ID ${queue.id}:`, err);
        // Continue
      }
    }

    skip += batchSize;
    console.log(`Processed ${skip} Queue records...`);
  }
  console.log("--- Finished Queue Migration ---");
}

async function main() {
  try {
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
