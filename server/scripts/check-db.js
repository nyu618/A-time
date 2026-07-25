const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function checkData() {
  console.log("=== Checking Agreement Data ===");
  const agreements = await prisma.agreement.findMany({
    take: 10,
    orderBy: { id: 'desc' }, // Check the most recent ones
    where: {
      OR: [
        { idCardImageFront: { not: null } },
        { idCardImageBack: { not: null } },
        { signatureData: { not: null } }
      ]
    }
  });

  if (agreements.length === 0) {
    console.log("No Agreement records with image data found.");
  } else {
    agreements.forEach(a => {
      console.log(`Agreement ID: ${a.id}`);
      if (a.idCardImageFront) console.log(` - Front (first 50 chars): ${a.idCardImageFront.substring(0, 50)}`);
      if (a.idCardImageBack) console.log(` - Back  (first 50 chars): ${a.idCardImageBack.substring(0, 50)}`);
      if (a.signatureData) console.log(` - Sig   (first 50 chars): ${a.signatureData.substring(0, 50)}`);
    });
  }

  console.log("\n=== Checking Queue Data ===");
  const queues = await prisma.queue.findMany({
    take: 10,
    orderBy: { id: 'desc' },
    where: { paperSignatureImage: { not: null } }
  });

  if (queues.length === 0) {
    console.log("No Queue records with paperSignatureImage found.");
  } else {
    queues.forEach(q => {
      console.log(`Queue ID: ${q.id}`);
      console.log(` - Image (first 50 chars): ${q.paperSignatureImage.substring(0, 50)}`);
    });
  }
}

async function main() {
  try {
    await checkData();
  } catch (error) {
    console.error("Check failed:", error);
  } finally {
    await prisma.$disconnect();
    pool.end();
  }
}

main();
