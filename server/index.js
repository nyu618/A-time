const express = require('express');
const path = require('path');
const cors = require('cors');
const dotenv = require('dotenv');
const basicAuth = require('express-basic-auth');
const apiRoutes = require('./routes/api');
const { startCron } = require('./cron');

dotenv.config();

// 必須環境変数のチェック (Renderデプロイ時のSQLiteフォールバックを防止)
if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL) {
  console.warn("WARNING: DATABASE_URL is not set. The application requires a PostgreSQL connection string to start properly in production.");
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
// Basic Auth Middleware for Admin Routes
const adminAuth = basicAuth({
  users: { [process.env.ADMIN_USER || 'admin']: process.env.ADMIN_PASSWORD || 'password' },
  challenge: true,
  realm: 'Admin Area'
});

// Protect API admin routes
app.use('/api/admin', adminAuth);

// Protect frontend admin route
app.use('/admin', adminAuth);

// API Routes
app.use('/api', apiRoutes);

// Serve Static Files in Production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));

  // Fallback for SPA routing (bypasses path-to-regexp errors in Express 5)
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      res.sendFile(path.join(__dirname, '../client/dist/index.html'));
    } else {
      next();
    }
  });
}

// Start Cron job
startCron();

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || "postgresql://dummy:dummy@localhost:5432/dummy";
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);
  try {
    const queueCount = await prisma.queue.count();
    console.log(`[DEBUG] Total queues in database on startup: ${queueCount}`);
    const todayStr = new Date().toISOString().split('T')[0];
    const todayCount = await prisma.queue.count({ where: { targetDate: todayStr } });
    console.log(`[DEBUG] Queues for today (${todayStr}): ${todayCount}`);
  } catch (error) {
    console.error("[DEBUG] Failed to count queues:", error);
  }
});
