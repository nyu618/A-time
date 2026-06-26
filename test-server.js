const express = require('express');
const app = express();
app.use(express.json());
const apiRoutes = require('./server/routes/api.js');
app.use('/api', apiRoutes);
console.log("App initialized successfully!");
