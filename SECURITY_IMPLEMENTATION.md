# Vendor Registration Security Implementation

## Overview
This document outlines the comprehensive security measures implemented to prevent duplicate submissions and enhance overall security of the vendor registration system.

## Backend Security Features

### 1. Rate Limiting Middleware (`src/middleware/rateLimiter.ts`)

#### Global Rate Limiting
- **Limit**: 100 requests per 15 minutes per IP
- **Purpose**: Prevent API abuse and DDoS attacks
- **Response**: 429 status with rate limit exceeded message

#### Vendor-Specific Rate Limiting
- **IP-based**: 3 submissions per hour per IP address
- **Email-based**: 1 submission per day per email address
- **Block Duration**: 1 hour for IP violations
- **Window Reset**: Automatic cleanup after window expires

#### Tracking Features
- In-memory submission tracking by IP and email
- Automatic cleanup of expired entries every 10 minutes
- Debug endpoint for monitoring tracker status (development only)

### 2. Enhanced Controller (`src/controllers/vendorController.ts`)

#### Duplicate Prevention
- **Email uniqueness**: No duplicate emails within 24 hours
- **Phone + Company combo**: Prevents same phone/company combinations
- **IP + Company combo**: Prevents same company from same location
- **Digital fingerprinting**: Creates unique fingerprints for exact duplicates

#### Data Validation
- **Server-side validation**: Using express-validator
- **Turnover validation**: Minimum value of 0.1 enforced
- **Email format validation**: RFC-compliant email validation
- **Field sanitization**: Trim and normalize all input data

#### Security Logging
- Comprehensive logging of all submissions with metadata
- IP address tracking and user agent logging
- Submission timestamps and unique IDs
- Detailed duplicate detection logging

### 3. Enhanced Routes (`src/routes/vendorRoutes.ts`)

#### File Upload Security
- **File type validation**: Only PDF, Word, Excel, text, and image files
- **Size limits**: 10MB per file, maximum 3 files
- **Dangerous extension filtering**: Blocks executable files (.exe, .bat, etc.)
- **File name validation**: Maximum 255 characters
- **MIME type verification**: Server-side file type checking

#### Route Protection
- Rate limiting applied before file processing
- Validation rules applied in middleware chain
- Comprehensive error handling for all upload scenarios
- Admin endpoints with API key protection (production)

### 4. Main Server Security (`src/index.ts`)

#### Security Headers
- **Helmet.js**: Comprehensive security headers
- **CSP**: Content Security Policy configuration
- **CORS**: Origin-based access control
- **Trust Proxy**: Accurate IP address detection

#### Error Handling
- Comprehensive error handling middleware
- Specific handling for file upload errors
- Security-aware error messages
- Development vs production error details

## Frontend Security Features

### 1. Submission Control (`src/pages/VendorRegistration.tsx`)

#### Local Storage Tracking
- Tracks last submission timestamp
- Stores last submission email and company
- 24-hour submission window enforcement
- Automatic cleanup of expired data

#### Cooldown Management
- 5-minute cooldown between submission attempts
- Visual feedback for cooldown status
- Real-time countdown display
- Button state management

#### Security Warning System
- Displays security warnings for blocked submissions
- Clear messaging for different security violations
- User-friendly dismissal options
- Visual indicators for security states

### 2. Enhanced Error Handling

#### Backend Error Integration
- Specific handling for all backend security errors
- User-friendly error message display
- Different UI states for different error types
- Network error detection and handling

#### Form Validation
- Client-side validation before submission
- Real-time validation feedback
- Comprehensive field validation
- File validation with security checks

### 3. UI Security Indicators

#### Submit Button States
- **Normal**: Green gradient submit button
- **Blocked**: Gray disabled button with warning
- **Cooldown**: Shows remaining cooldown time
- **Processing**: Loading state with progress

#### Security Warnings
- Prominent amber warning boxes
- Clear security violation messages
- Dismissal options with data cleanup
- Visual hierarchy for importance

## Security Configuration

### Environment Variables
```env
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,https://vendor-registration.vercel.app
ADMIN_API_KEY=your_secure_admin_key_here
SKIP_EMAILS=false
```

### Rate Limiting Configuration
- **IP Window**: 1 hour (configurable)
- **IP Max Attempts**: 3 (configurable)
- **Email Window**: 24 hours (configurable)
- **Email Max Attempts**: 1 (configurable)
- **Block Duration**: 1 hour (configurable)

### File Upload Limits
- **Max File Size**: 10MB per file
- **Max Files**: 3 files per submission
- **Allowed Types**: PDF, DOC, DOCX, XLS, XLSX, TXT, JPG, PNG
- **File Name Length**: Maximum 255 characters

## API Endpoints

### Security Endpoints
- `GET /api/health` - General health check
- `GET /api/vendors/health` - Vendor service health
- `GET /api/debug/rate-limiter` - Rate limiter status (dev only)
- `GET /api/vendors/stats` - Submission statistics (admin only)

### Main Endpoints
- `POST /api/vendors` - Submit vendor registration (rate limited)

## Security Response Codes

### Rate Limiting
- `429` - Too many requests (IP or email rate limit)
- `409` - Duplicate submission detected

### Validation Errors
- `400` - Missing required fields or validation errors
- `413` - File size too large
- `415` - Invalid file type

### Security Violations
- `403` - Access denied (admin endpoints)
- `401` - Unauthorized access

## Monitoring and Logging

### Server Logs
- All requests logged with IP addresses
- Submission attempts with metadata
- Rate limit violations
- Duplicate detection events
- File upload attempts and results

### Debug Information
- Real-time tracker status
- Memory usage monitoring
- Cleanup operation logs
- Error tracking and reporting

## Data Retention

### Submission Data
- **Retention Period**: 30 days
- **Cleanup Schedule**: Every 6 hours
- **Stored Information**: Complete submission with metadata

### Rate Limiting Data
- **IP Tracking**: 1 hour window
- **Email Tracking**: 24 hour window
- **Cleanup Schedule**: Every 10 minutes

## Security Best Practices Implemented

1. **Defense in Depth**: Multiple layers of security validation
2. **Fail Secure**: Secure defaults with explicit allowlists
3. **Input Validation**: Both client and server-side validation
4. **Rate Limiting**: Multiple rate limiting strategies
5. **Error Handling**: Security-aware error messages
6. **Logging**: Comprehensive security event logging
7. **Data Minimization**: Automatic cleanup of old data
8. **User Feedback**: Clear security status communication

## Future Enhancements

1. **Database Integration**: Move from in-memory to persistent storage
2. **Advanced Fingerprinting**: More sophisticated duplicate detection
3. **IP Geolocation**: Location-based security rules
4. **Machine Learning**: Anomaly detection for submissions
5. **Two-Factor Authentication**: Enhanced user verification
6. **CAPTCHA Integration**: Bot prevention
7. **Audit Trails**: Detailed security audit logging
8. **Real-time Monitoring**: Security dashboard and alerts 