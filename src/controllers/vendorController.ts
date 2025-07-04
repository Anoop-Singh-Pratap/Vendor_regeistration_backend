import { Request, Response } from 'express';
import { validationResult, body } from 'express-validator';
import { VendorFormData } from '../types/vendor';
import { sendVendorRegistrationEmail } from '../services/emailService';

// Enhanced in-memory store with comprehensive tracking
interface StoredSubmission {
  data: VendorFormData;
  files?: Array<{filename: string, size: number}> | null;
  timestamp: number;
  ip: string;
  id: string;
  userAgent?: string;
  fingerprint: string;
}

const vendorSubmissionsStore: StoredSubmission[] = [];

// Enhanced validation rules for vendor data
export const vendorValidationRules = [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be between 2-100 characters'),
  body('designation').trim().isLength({ min: 2, max: 100 }).withMessage('Designation must be between 2-100 characters'),
  body('companyName').trim().isLength({ min: 2, max: 200 }).withMessage('Company name must be between 2-200 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Invalid email format'),
  body('contactNo').trim().isLength({ min: 8, max: 20 }).withMessage('Contact number must be between 8-20 characters'),
  body('turnover').isFloat({ min: 0.1 }).withMessage('Turnover must be at least 0.1'),
  body('productDescription').trim().isLength({ min: 10, max: 1000 }).withMessage('Product description must be between 10-1000 characters'),
  body('country').trim().isLength({ min: 2, max: 10 }).withMessage('Country must be specified'),
  // Custom validation for "others" country selection
  body('customCountry').custom((value, { req }) => {
    if (req.body.country === 'others') {
      if (!value || value.trim().length < 2 || value.trim().length > 100) {
        throw new Error('Custom country name is required and must be between 2-100 characters when "Others" is selected');
      }
    }
    return true;
  }),
  body('customCountryCode').custom((value, { req }) => {
    if (req.body.country === 'others') {
      if (!value || value.trim().length < 2 || value.trim().length > 5) {
        throw new Error('Custom country code is required and must be between 2-5 characters when "Others" is selected');
      }
      // Validate country code format (alphabetic characters only)
      if (!/^[A-Za-z]{2,5}$/.test(value.trim())) {
        throw new Error('Custom country code must contain only alphabetic characters');
      }
    }
    return true;
  }),
];

// Helper function to generate submission fingerprint
const generateFingerprint = (vendorData: VendorFormData, ip: string, userAgent?: string): string => {
  const fingerprintData = `${vendorData.email.toLowerCase()}-${vendorData.companyName.toLowerCase()}-${vendorData.contactNo}-${ip}`;
  return Buffer.from(fingerprintData).toString('base64');
};

// Helper function to check for duplicate submissions with multiple criteria
const isDuplicateSubmission = (vendorData: VendorFormData, ip: string, userAgent?: string): {isDuplicate: boolean, reason?: string, existingSubmission?: StoredSubmission} => {
  const now = Date.now();
  const duplicateWindow = 24 * 60 * 60 * 1000; // 24 hours
  const fingerprint = generateFingerprint(vendorData, ip, userAgent);

  for (const submission of vendorSubmissionsStore) {
    const timeDiff = now - submission.timestamp;
    if (timeDiff > duplicateWindow) continue;

    // Check exact email match
    if (submission.data.email.toLowerCase() === vendorData.email.toLowerCase()) {
      return { 
        isDuplicate: true, 
        reason: 'DUPLICATE_EMAIL',
        existingSubmission: submission
      };
    }

    // Check phone + company combination
    if (submission.data.contactNo === vendorData.contactNo && 
        submission.data.companyName.toLowerCase() === vendorData.companyName.toLowerCase()) {
      return { 
        isDuplicate: true, 
        reason: 'DUPLICATE_PHONE_COMPANY',
        existingSubmission: submission
      };
    }

    // Check IP + company combination (same company from same location)
    if (submission.ip === ip && 
        submission.data.companyName.toLowerCase() === vendorData.companyName.toLowerCase()) {
      return { 
        isDuplicate: true, 
        reason: 'DUPLICATE_IP_COMPANY',
        existingSubmission: submission
      };
    }

    // Check fingerprint match
    if (submission.fingerprint === fingerprint) {
      return { 
        isDuplicate: true, 
        reason: 'DUPLICATE_FINGERPRINT',
        existingSubmission: submission
      };
    }
  }

  return { isDuplicate: false };
};

// Enhanced helper function to sanitize and validate data
const sanitizeVendorData = (data: any): VendorFormData => {
  const sanitized: VendorFormData = {
    name: data.name?.trim() || '',
    designation: data.designation?.trim() || '',
    companyName: data.companyName?.trim() || '',
    firmType: data.firmType?.trim() || '',
    vendorType: data.vendorType?.trim() || '',
    country: data.country?.trim() || '',
    customCountry: data.customCountry?.trim(),
    customCountryCode: data.customCountryCode?.trim()?.toUpperCase(), // Normalize to uppercase
    website: data.website?.trim(),
    contactNo: data.contactNo?.trim() || '',
    email: data.email?.toLowerCase().trim() || '',
    category: data.category?.trim() || '',
    productDescription: data.productDescription?.trim() || '',
    majorClients: data.majorClients?.trim(),
    turnover: data.turnover?.toString().trim() || '',
    turnoverCurrency: data.turnoverCurrency?.trim() || '',
    gstNumber: data.gstNumber?.trim(),
    terms: Boolean(data.terms),
    referenceId: data.referenceId?.trim()
  };

  // Clear custom fields if not using "others" country
  if (sanitized.country !== 'others') {
    sanitized.customCountry = undefined;
    sanitized.customCountryCode = undefined;
  }

  return sanitized;
};

// Enhanced country validation function
const validateCountryData = (vendorData: VendorFormData): { isValid: boolean; error?: string } => {
  // Define valid country codes
  const validCountryCodes = [
    'in', 'ae', 'au', 'bd', 'bt', 'br', 'ca', 'cn', 'co', 'cz', 'de', 'dk', 'eg', 'es', 
    'fi', 'fr', 'gb', 'gr', 'hu', 'id', 'ie', 'il', 'it', 'jp', 'kr', 'lk', 'mx', 'my', 
    'ng', 'nl', 'no', 'np', 'nz', 'ph', 'pl', 'pt', 'qa', 'ro', 'ru', 'sa', 'se', 'sg', 
    'th', 'tr', 'us', 've', 'vn', 'za', 'ch', 'be', 'ar', 'cl', 'pk', 'ua', 'at', 'pe', 
    'sk', 'si', 'hr', 'bg', 'ee', 'lt', 'lv', 'rs', 'by', 'ge', 'is', 'lu', 'mt', 'cy', 
    'md', 'al', 'mk', 'me', 'ba', 'li', 'sm', 'mc', 'va', 'others'
  ];

  // Check if country code is valid
  if (!validCountryCodes.includes(vendorData.country)) {
    return { isValid: false, error: 'Invalid country code selected' };
  }

  // Special validation for "others" country
  if (vendorData.country === 'others') {
    if (!vendorData.customCountry || vendorData.customCountry.trim().length < 2) {
      return { isValid: false, error: 'Custom country name is required when "Others" is selected' };
    }

    if (!vendorData.customCountryCode || vendorData.customCountryCode.trim().length < 2) {
      return { isValid: false, error: 'Custom country code is required when "Others" is selected' };
    }

    // Validate custom country code format
    if (!/^[A-Za-z]{2,5}$/.test(vendorData.customCountryCode)) {
      return { isValid: false, error: 'Custom country code must contain only alphabetic characters (2-5 characters)' };
    }

    // Check if custom country code conflicts with existing ones
    if (validCountryCodes.includes(vendorData.customCountryCode.toLowerCase())) {
      return { isValid: false, error: 'Custom country code conflicts with existing country codes. Please use a different code.' };
    }
  }

  return { isValid: true };
};

export const submitVendorRegistration = async (req: Request, res: Response) => {
  try {
    // Check validation results
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
        error: 'VALIDATION_ERROR'
      });
    }

    const rawData = req.body;
    const files = req.files as Express.Multer.File[] | undefined;
    const ip = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] as string || 'unknown';
    const userAgent = req.headers['user-agent'];

    // Sanitize vendor data
    const vendorData = sanitizeVendorData(rawData);

    console.log(`Processing vendor registration for ${vendorData.email} from IP: ${ip}`);

    // Basic validation for required fields
    const requiredFields = ['name', 'designation', 'companyName', 'firmType', 'vendorType', 'country', 'contactNo', 'email', 'category', 'productDescription', 'turnover', 'turnoverCurrency'];
    const missingFields = requiredFields.filter(field => !vendorData[field as keyof VendorFormData]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`,
        error: 'MISSING_FIELDS',
        missingFields
      });
    }

    // Enhanced country validation
    const countryValidation = validateCountryData(vendorData);
    if (!countryValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: countryValidation.error,
        error: 'INVALID_COUNTRY_DATA'
      });
    }

    // Enhanced email validation
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    if (!emailRegex.test(vendorData.email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format',
        error: 'INVALID_EMAIL'
      });
    }

    // Turnover validation
    const turnoverValue = parseFloat(vendorData.turnover);
    if (isNaN(turnoverValue) || turnoverValue < 0.1) {
      return res.status(400).json({
        success: false,
        message: 'Turnover must be at least 0.1',
        error: 'INVALID_TURNOVER'
      });
    }

    // Check for duplicate submissions with detailed logging
    const duplicateCheck = isDuplicateSubmission(vendorData, ip, userAgent);
    if (duplicateCheck.isDuplicate) {
      const existingSubmission = duplicateCheck.existingSubmission!;
      const hoursAgo = Math.floor((Date.now() - existingSubmission.timestamp) / (1000 * 60 * 60));
      
      console.log(`Duplicate submission detected: ${duplicateCheck.reason} for ${vendorData.email}`);
      
      let message = 'A similar submission already exists.';
      switch (duplicateCheck.reason) {
        case 'DUPLICATE_EMAIL':
          message = `A submission with this email address was already submitted ${hoursAgo} hours ago.`;
          break;
        case 'DUPLICATE_PHONE_COMPANY':
          message = `A submission with this phone number and company combination already exists.`;
          break;
        case 'DUPLICATE_IP_COMPANY':
          message = `A submission for this company from your location was already submitted.`;
          break;
        case 'DUPLICATE_FINGERPRINT':
          message = `This exact submission was already processed.`;
          break;
      }

      return res.status(409).json({
        success: false,
        message: message + ' Please contact us directly if you need to update your information.',
        error: duplicateCheck.reason,
        existingSubmissionId: existingSubmission.id,
        hoursAgo
      });
    }

    // Generate reference ID if not provided
    if (!vendorData.referenceId) {
      vendorData.referenceId = `TOKEN-${Date.now().toString().slice(-6)}`;
    }

    // Generate submission ID and fingerprint
    const submissionId = `SUB-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const fingerprint = generateFingerprint(vendorData, ip, userAgent);

    // Store submission with comprehensive metadata
    const submission: StoredSubmission = {
      data: vendorData,
      files: files?.length ? files.map(file => ({
        filename: file.originalname,
        size: file.size
      })) : null,
      timestamp: Date.now(),
      ip: ip,
      id: submissionId,
      userAgent: userAgent,
      fingerprint: fingerprint
    };

    vendorSubmissionsStore.push(submission);

    console.log(`Vendor registration stored: ${submissionId}`, {
      referenceId: vendorData.referenceId,
      ip,
      email: vendorData.email,
      company: vendorData.companyName,
      country: vendorData.country,
      customCountry: vendorData.customCountry,
      filesCount: files?.length || 0
    });

    // Attempt to send email notification
    let emailSent = false;
    try {
      emailSent = await sendVendorRegistrationEmail(vendorData, files);
      if (emailSent) {
        console.log(`Email notifications sent successfully for ${submissionId}`);
      }
    } catch (error) {
      console.error(`Error sending email for ${submissionId}:`, error);
      // Don't fail the submission if email fails
    }

    // Return success response
    return res.status(200).json({
      success: true,
      message: 'Vendor registration submitted successfully',
      referenceId: vendorData.referenceId,
      submissionId: submissionId,
      emailSent: emailSent,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error processing vendor registration:', error);
    
    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('File too large')) {
        return res.status(413).json({
          success: false,
          message: 'One or more files are too large. Maximum size is 10MB per file.',
          error: 'FILE_SIZE_ERROR'
        });
      }
    }
    
    return res.status(500).json({
      success: false,
      message: 'An unexpected error occurred while processing your submission',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
};

// Function to get submission statistics (for admin use)
export const getSubmissionStats = (req: Request, res: Response) => {
  const now = Date.now();
  const last24Hours = vendorSubmissionsStore.filter(s => now - s.timestamp < 24 * 60 * 60 * 1000);
  const last7Days = vendorSubmissionsStore.filter(s => now - s.timestamp < 7 * 24 * 60 * 60 * 1000);

  return res.json({
    total: vendorSubmissionsStore.length,
    last24Hours: last24Hours.length,
    last7Days: last7Days.length,
    oldestSubmission: vendorSubmissionsStore.length > 0 ? 
      new Date(Math.min(...vendorSubmissionsStore.map(s => s.timestamp))).toISOString() : null,
    newestSubmission: vendorSubmissionsStore.length > 0 ?
      new Date(Math.max(...vendorSubmissionsStore.map(s => s.timestamp))).toISOString() : null
  });
};

// Cleanup old submissions periodically (keep for 30 days)
const cleanupOldSubmissions = () => {
  const now = Date.now();
  const retentionPeriod = 30 * 24 * 60 * 60 * 1000; // 30 days
  
  const initialLength = vendorSubmissionsStore.length;
  for (let i = vendorSubmissionsStore.length - 1; i >= 0; i--) {
    if (now - vendorSubmissionsStore[i].timestamp > retentionPeriod) {
      vendorSubmissionsStore.splice(i, 1);
    }
  }
  
  if (vendorSubmissionsStore.length !== initialLength) {
    console.log(`Cleaned up ${initialLength - vendorSubmissionsStore.length} old submissions`);
  }
};

// Run cleanup every 6 hours
setInterval(cleanupOldSubmissions, 6 * 60 * 60 * 1000);

// Export store for testing purposes
export { vendorSubmissionsStore }; 