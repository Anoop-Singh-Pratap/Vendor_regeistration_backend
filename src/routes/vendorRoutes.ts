import express from 'express';
import multer from 'multer';
import { submitVendorRegistration, vendorValidationRules, getSubmissionStats } from '../controllers/vendorController';
import { vendorSubmissionRateLimiter } from '../middleware/rateLimiter';

const router = express.Router();

// File type validation with magic number checking
const validateFileContent = (buffer: Buffer, mimetype: string, filename: string): boolean => {
  const magicNumbers: Record<string, number[][]> = {
    'application/pdf': [[0x25, 0x50, 0x44, 0x46]], // %PDF
    'image/jpeg': [[0xFF, 0xD8, 0xFF]], // JPEG
    'image/png': [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]], // PNG
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [[0x50, 0x4B, 0x03, 0x04]], // DOCX (ZIP)
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [[0x50, 0x4B, 0x03, 0x04]], // XLSX (ZIP)
    'application/vnd.ms-excel': [[0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]], // XLS
    'application/msword': [[0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]], // DOC
    'text/plain': [] // Text files don't have specific magic numbers
  };

  // Skip magic number check for text files
  if (mimetype === 'text/plain') {
    // For text files, check for suspicious patterns
    const content = buffer.toString('utf8', 0, Math.min(buffer.length, 1024));
    const suspiciousPatterns = [
      /<script/i,
      /javascript:/i,
      /vbscript:/i,
      /on\w+\s*=/i,
      /eval\s*\(/i,
      /document\./i,
      /window\./i,
      /ActiveX/i,
      /Shell\./i,
      /WScript\./i
    ];
    
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(content)) {
        console.log(`Suspicious pattern found in text file: ${filename}`);
        return false;
      }
    }
    return true;
  }

  const expectedMagicNumbers = magicNumbers[mimetype];
  if (!expectedMagicNumbers || expectedMagicNumbers.length === 0) {
    return false;
  }

  // Check if any of the expected magic numbers match
  for (const magicNumber of expectedMagicNumbers) {
    if (buffer.length >= magicNumber.length) {
      let matches = true;
      for (let i = 0; i < magicNumber.length; i++) {
        if (buffer[i] !== magicNumber[i]) {
          matches = false;
          break;
        }
      }
      if (matches) {
        return true;
      }
    }
  }

  console.log(`File header validation failed for ${filename}: expected ${expectedMagicNumbers}, got ${Array.from(buffer.slice(0, 8))}`);
  return false;
};

// Additional security checks for uploaded files
const performSecurityChecks = (file: Express.Multer.File): { isValid: boolean; error?: string } => {
  try {
    // Check for null bytes (potential directory traversal)
    if (file.originalname.includes('\0')) {
      return { isValid: false, error: 'Filename contains null bytes' };
    }

    // Check for path traversal attempts
    const pathTraversalPatterns = [
      /\.\./,
      /\.\\/,
      /\.\//, 
      /\/\.\./,
      /\\\.\./
    ];

    for (const pattern of pathTraversalPatterns) {
      if (pattern.test(file.originalname)) {
        return { isValid: false, error: 'Path traversal attempt detected' };
      }
    }

    // Check for embedded executables in non-executable files
    const executableSignatures = [
      [0x4D, 0x5A], // MZ header (PE executables)
      [0x7F, 0x45, 0x4C, 0x46], // ELF header
      [0xCF, 0xFA, 0xED, 0xFE], // Mach-O
      [0xFE, 0xED, 0xFA, 0xCF], // Mach-O
      [0x21, 0x3C, 0x61, 0x72, 0x63, 0x68, 0x3E] // !<arch> (AR archive)
    ];

    for (const signature of executableSignatures) {
      if (file.buffer.length >= signature.length) {
        let matches = true;
        for (let i = 0; i < signature.length; i++) {
          if (file.buffer[i] !== signature[i]) {
            matches = false;
            break;
          }
        }
        if (matches) {
          return { isValid: false, error: 'Executable content detected' };
        }
      }
    }

    // Validate file content matches declared MIME type
    if (!validateFileContent(file.buffer, file.mimetype, file.originalname)) {
      return { isValid: false, error: 'File content does not match declared type' };
    }

    // Check for ZIP bombs (applicable to DOCX/XLSX which are ZIP files)
    if (file.mimetype.includes('openxmlformats') && file.buffer.length > 0) {
      const compressionRatio = file.size / file.buffer.length;
      if (compressionRatio > 100) { // Suspiciously high compression ratio
        return { isValid: false, error: 'Suspicious compression ratio detected' };
      }
    }

    return { isValid: true };
  } catch (error) {
    console.error('Error during security checks:', error);
    return { isValid: false, error: 'Security validation failed' };
  }
};

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
    const dangerousExtensions = ['.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js', '.jar', '.sh', '.ps1', '.msi', '.deb', '.rpm'];
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

    // Check for control characters in filename
    const controlCharPattern = /[\x00-\x1f\x7f-\x9f]/;
    if (controlCharPattern.test(file.originalname)) {
      return cb(new Error('Invalid characters in filename.'));
    }
    
    console.log(`Accepted file: ${file.originalname}`);
    cb(null, true);
  }
});

// Enhanced file validation middleware
const validateUploadedFiles = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const files = req.files as Express.Multer.File[];
  
  if (files && files.length > 0) {
    for (const file of files) {
      const securityCheck = performSecurityChecks(file);
      if (!securityCheck.isValid) {
        console.log(`Security check failed for ${file.originalname}: ${securityCheck.error}`);
        return res.status(400).json({
          success: false,
          message: `Security validation failed for file "${file.originalname}": ${securityCheck.error}`,
          error: 'SECURITY_VALIDATION_FAILED'
        });
      }
    }
  }
  
  next();
};

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
  
  // Validate uploaded files with security checks
  validateUploadedFiles,
  
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