import express from 'express';
import multer from 'multer';
import { submitVendorRegistration, vendorValidationRules, getSubmissionStats } from '../controllers/vendorController';
import { vendorSubmissionRateLimiter } from '../middleware/rateLimiter';

const router = express.Router();

// Enhanced multer configuration with better security
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 3, // Maximum 3 files
    fieldSize: 1024 * 1024, // 1MB per field
    fieldNameSize: 100, // 100 bytes per field name
    headerPairs: 2000 // Maximum number of header pairs
  },
  fileFilter: (req, file, cb) => {
    console.log(`File upload attempt: ${file.originalname}, type: ${file.mimetype}, size: ${file.size}`);
    
    // Allowed MIME types for documents
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'image/jpeg',
      'image/png'
    ];
    
    // Check file type
    if (!allowedTypes.includes(file.mimetype)) {
      console.log(`Rejected file: ${file.originalname} - Invalid type: ${file.mimetype}`);
      return cb(new Error(`Invalid file type: ${file.mimetype}. Only PDF, Word, Excel, text, and image files are allowed.`));
    }
    
    // Check file name for security (no executable extensions)
    const dangerousExtensions = ['.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js', '.jar', '.sh'];
    const fileName = file.originalname.toLowerCase();
    const hasDangerousExtension = dangerousExtensions.some(ext => fileName.endsWith(ext));
    
    if (hasDangerousExtension) {
      console.log(`Rejected file: ${file.originalname} - Dangerous extension detected`);
      return cb(new Error('File type not allowed for security reasons.'));
    }
    
    // File name length check
    if (file.originalname.length > 255) {
      return cb(new Error('File name is too long. Maximum 255 characters allowed.'));
    }
    
    console.log(`Accepted file: ${file.originalname}`);
    cb(null, true);
  }
});

// Error handling middleware for multer
const handleMulterError = (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof multer.MulterError) {
    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(413).json({
          success: false,
          message: 'File size too large. Maximum size is 10MB per file.',
          error: 'FILE_SIZE_LIMIT'
        });
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({
          success: false,
          message: 'Too many files. Maximum 3 files allowed.',
          error: 'FILE_COUNT_LIMIT'
        });
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({
          success: false,
          message: 'Unexpected file field.',
          error: 'UNEXPECTED_FILE'
        });
      case 'LIMIT_FIELD_KEY':
        return res.status(400).json({
          success: false,
          message: 'Field name too long.',
          error: 'FIELD_NAME_TOO_LONG'
        });
      case 'LIMIT_FIELD_VALUE':
        return res.status(400).json({
          success: false,
          message: 'Field value too long.',
          error: 'FIELD_VALUE_TOO_LONG'
        });
      case 'LIMIT_FIELD_COUNT':
        return res.status(400).json({
          success: false,
          message: 'Too many fields.',
          error: 'TOO_MANY_FIELDS'
        });
      default:
        return res.status(400).json({
          success: false,
          message: 'File upload error: ' + err.message,
          error: 'UPLOAD_ERROR'
        });
    }
  } else if (err) {
    return res.status(400).json({
      success: false,
      message: err.message || 'File upload error',
      error: 'UPLOAD_ERROR'
    });
  }
  next();
};

// POST /api/vendors - Submit vendor registration with comprehensive security
router.post('/',
  // Apply vendor-specific rate limiting
  vendorSubmissionRateLimiter,
  
  // Handle file uploads with error handling
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    upload.array('supportingDocuments', 3)(req, res, (err) => {
      handleMulterError(err, req, res, next);
    });
  },
  
  // Apply validation rules
  vendorValidationRules,
  
  // Main controller
  submitVendorRegistration
);

// GET /api/vendors/stats - Get submission statistics (admin only - in production, add authentication)
router.get('/stats', (req, res, next) => {
  // In production, add authentication check here
  if (process.env.NODE_ENV === 'production') {
    const adminKey = req.headers['x-admin-key'];
    if (!adminKey || adminKey !== process.env.ADMIN_API_KEY) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
        error: 'UNAUTHORIZED'
      });
    }
  }
  next();
}, getSubmissionStats);

// GET /api/vendors/health - Health check specific to vendor service
router.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'vendor-registration',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

export { router as vendorRoutes }; 