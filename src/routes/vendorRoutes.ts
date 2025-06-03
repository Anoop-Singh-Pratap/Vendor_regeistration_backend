import express from 'express';
import multer from 'multer';
import { submitVendorRegistration } from '../controllers/vendorController';

const router = express.Router();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and Word documents (DOC/DOCX) are allowed.'));
    }
  }
});

// POST /api/vendors - Submit vendor registration with document upload
router.post('/', (req, res, next) => {
  upload.array('supportingDocuments', 3)(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      // Multer-specific errors
      return res.status(400).json({ success: false, message: err.message });
    } else if (err) {
      // File type or other errors
      return res.status(400).json({ success: false, message: err.message });
    }
    next();
  });
}, submitVendorRegistration);

export { router as vendorRoutes }; 