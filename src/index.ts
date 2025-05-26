import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { vendorRoutes } from './routes/vendorRoutes';

// Load environment variables
dotenv.config();

// Create Express server
const app = express();
const PORT = process.env.PORT || 5000;

// CORS configuration
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api/vendors', vendorRoutes);

// Serve static files from the frontend build directory in production
if (process.env.NODE_ENV === 'production') {
  // Set static folder
  const staticPath = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(staticPath));

  // Any route that is not an API route will be handled by the frontend
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(staticPath, 'index.html'));
  });
}

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 