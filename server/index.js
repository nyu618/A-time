const express = require('express');
const path = require('path');
const cors = require('cors');
const dotenv = require('dotenv');
const basicAuth = require('express-basic-auth');
const apiRoutes = require('./routes/api');
const { startCron } = require('./cron');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

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

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
