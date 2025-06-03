import express from 'express';
import multer from 'multer';
import { submitVendorRegistration } from '../controllers/vendorController';

const router = express.Router();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// POST /api/vendors - Submit vendor registration with document upload
router.post('/', upload.array('supportingDocuments', 3), submitVendorRegistration);

export { router as vendorRoutes }; 