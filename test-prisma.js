const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasourceUrl: "file:./dev.db"
});
prisma.queue.findMany().then(console.log).catch(console.error);
