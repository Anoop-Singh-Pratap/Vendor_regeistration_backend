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

// CORS configuration - More permissive for debugging
app.use(cors({
  origin: '*',  // Allow all origins temporarily
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Add CORS headers to every response
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight OPTIONS requests
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  
  next();
});

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