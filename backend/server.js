import express from 'express';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3000;
// Connect to MongoDB

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend static assets from /static
app.use('/static', express.static(path.join(__dirname, '..', 'frontend', 'static')));


// index route send index.html



app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend', 'index.html'));
});

//run
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});