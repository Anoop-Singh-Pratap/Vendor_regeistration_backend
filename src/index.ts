import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { vendorRoutes } from './routes/vendorRoutes';

// Load environment variables
dotenv.config();

// Create Express server
const app = express();
const PORT = process.env.PORT || 5000;

// Simplest, most direct CORS handling for ALL requests
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*'); // Allow all origins
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // If it's an OPTIONS preflight request, send 204 No Content and end.
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  next(); // Continue to other middlewares/routes for non-OPTIONS requests
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api/vendors', vendorRoutes);

// Fallback for unhandled routes (optional, but good for debugging)
app.use((req, res) => {
  console.log(`404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).send('Route not found');
});

// Serve static files from the frontend build directory in production
// This part is likely NOT what Vercel uses when deployed as a serverless function for /api routes
// but doesn't hurt to keep for other potential uses or local dev.
if (process.env.NODE_ENV === 'production') {
  const staticPath = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(staticPath));
  app.get('*', (req, res) => {
    // Ensure API routes don't get overwritten by this catch-all
    if (!req.originalUrl.startsWith('/api')) {
      res.sendFile(path.resolve(staticPath, 'index.html'));
    } else {
      // If it was an API route that wasn't handled, it should have been caught by the 404 fallback above
      res.status(404).send('API Route not found');
    }
  });
}

// Start server (for local development)
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Server running locally on port ${PORT}`);
    });
}

// Export the app for Vercel
export default app; 