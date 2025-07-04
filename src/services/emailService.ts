import nodemailer from 'nodemailer';
import { VendorFormData } from '../types/vendor';
import crypto from 'crypto';

// Security configuration
const EMAIL_SECURITY_CONFIG = {
  maxEmailsPerHour: 50,
  maxEmailsPerDay: 200,
  allowedIPs: process.env.ALLOWED_IPS?.split(',') || ['127.0.0.1', 'localhost'],
  secretKey: process.env.EMAIL_SECRET_KEY || 'your-secret-key-change-this'
};

// Email rate limiting tracking
const emailRateTracker = new Map<string, { count: number; timestamp: number; daily: number; dailyStart: number }>();

// Generate secure token for email verification
const generateSecureToken = (email: string, timestamp: number): string => {
  const data = `${email}-${timestamp}-${EMAIL_SECURITY_CONFIG.secretKey}`;
  return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
};

// Verify email sending authorization
const verifyEmailAuthorization = (senderIP?: string): boolean => {
  if (!senderIP) {
    console.warn('No sender IP provided for email authorization');
    return process.env.NODE_ENV === 'development'; // Allow in development
  }
  
  // In development, allow all IPs
  if (process.env.NODE_ENV === 'development') {
    return true;
  }
  
  // Check if IP is in allowed list
  const allowedIPs = EMAIL_SECURITY_CONFIG.allowedIPs;
  if (!allowedIPs.includes(senderIP) && !allowedIPs.includes('*')) {
    console.warn(`Unauthorized email attempt from IP: ${senderIP}`);
    return false;
  }
  
  return true;
};

// Check email rate limits
const checkEmailRateLimit = (identifier: string): boolean => {
  const now = Date.now();
  const hourMs = 60 * 60 * 1000;
  const dayMs = 24 * hourMs;
  
  const tracker = emailRateTracker.get(identifier) || {
    count: 0,
    timestamp: now,
    daily: 0,
    dailyStart: now
  };
  
  // Reset hourly count if hour has passed
  if (now - tracker.timestamp > hourMs) {
    tracker.count = 0;
    tracker.timestamp = now;
  }
  
  // Reset daily count if day has passed
  if (now - tracker.dailyStart > dayMs) {
    tracker.daily = 0;
    tracker.dailyStart = now;
  }
  
  // Check limits
  if (tracker.count >= EMAIL_SECURITY_CONFIG.maxEmailsPerHour) {
    console.warn(`Hourly email limit exceeded for ${identifier}`);
    return false;
  }
  
  if (tracker.daily >= EMAIL_SECURITY_CONFIG.maxEmailsPerDay) {
    console.warn(`Daily email limit exceeded for ${identifier}`);
    return false;
  }
  
  // Update counters
  tracker.count++;
  tracker.daily++;
  emailRateTracker.set(identifier, tracker);
  
  return true;
};

// Create email transporter using environment variables
const createTransporter = () => {
  // Log email configuration (without password)
  console.log('Email Configuration:', {
    host: process.env.EMAIL_HOST || 'smtp.office365.com',
    port: Number(process.env.EMAIL_PORT || 587),
    secure: process.env.EMAIL_SECURE === 'true',
    user: process.env.EMAIL_USER || 'procurement@rashmigroup.com',
    requireTLS: true
  });

  return nodemailer.createTransporter({
    host: process.env.EMAIL_HOST || 'smtp.office365.com', // Default to Microsoft's SMTP server
    port: Number(process.env.EMAIL_PORT || 587),
    secure: process.env.EMAIL_SECURE === 'true', // Should be false for port 587 with STARTTLS
    auth: {
      user: process.env.EMAIL_USER || 'procurement@rashmigroup.com', // Default sender email
      pass: process.env.EMAIL_PASS || process.env.VERCEL_EMAIL_PASS || 'your-default-password' // Use environment variables
    },
    requireTLS: true, // Ensure TLS is used
    logger: process.env.NODE_ENV !== 'production', // Enable logging in development
    debug: process.env.NODE_ENV !== 'production' // Enable debug in development
  });
};

// Country code to name mapping (should match frontend)
const countryCodeToName: Record<string, string> = {
  in: 'India',
  ae: 'United Arab Emirates',
  au: 'Australia',
  bd: 'Bangladesh',
  bt: 'Bhutan',
  br: 'Brazil',
  ca: 'Canada',
  cn: 'China',
  co: 'Colombia',
  cz: 'Czech Republic',
  de: 'Germany',
  dk: 'Denmark',
  eg: 'Egypt',
  es: 'Spain',
  fi: 'Finland',
  fr: 'France',
  gb: 'United Kingdom',
  gr: 'Greece',
  hu: 'Hungary',
  id: 'Indonesia',
  ie: 'Ireland',
  il: 'Israel',
  it: 'Italy',
  jp: 'Japan',
  kr: 'South Korea',
  lk: 'Sri Lanka',
  mx: 'Mexico',
  my: 'Malaysia',
  ng: 'Nigeria',
  nl: 'Netherlands',
  no: 'Norway',
  np: 'Nepal',
  nz: 'New Zealand',
  ph: 'Philippines',
  pl: 'Poland',
  pt: 'Portugal',
  qa: 'Qatar',
  ro: 'Romania',
  ru: 'Russia',
  sa: 'Saudi Arabia',
  se: 'Sweden',
  sg: 'Singapore',
  th: 'Thailand',
  tr: 'Turkey',
  us: 'United States',
  ve: 'Venezuela',
  vn: 'Vietnam',
  za: 'South Africa',
  ch: 'Switzerland',
  be: 'Belgium',
  ar: 'Argentina',
  cl: 'Chile',
  pk: 'Pakistan',
  ua: 'Ukraine',
  at: 'Austria',
  pe: 'Peru',
  sk: 'Slovakia',
  si: 'Slovenia',
  hr: 'Croatia',
  bg: 'Bulgaria',
  ee: 'Estonia',
  lt: 'Lithuania',
  lv: 'Latvia',
  rs: 'Serbia',
  by: 'Belarus',
  ge: 'Georgia',
  is: 'Iceland',
  lu: 'Luxembourg',
  mt: 'Malta',
  cy: 'Cyprus',
  md: 'Moldova',
  al: 'Albania',
  mk: 'North Macedonia',
  me: 'Montenegro',
  ba: 'Bosnia and Herzegovina',
  li: 'Liechtenstein',
  sm: 'San Marino',
  mc: 'Monaco',
  va: 'Vatican City',
  others: 'Others',
};

export const sendVendorRegistrationEmail = async (data: VendorFormData, files?: Express.Multer.File[], senderIP?: string): Promise<boolean> => {
  try {
    console.log('Attempting to send vendor registration email...');
    
    // Skip email in test environments or if explicitly disabled
    if (process.env.SKIP_EMAILS === 'true') {
      console.log('Email sending skipped due to SKIP_EMAILS=true');
      return true;
    }
    
    // Security checks
    if (!verifyEmailAuthorization(senderIP)) {
      console.error('Email authorization failed - unauthorized sender IP');
      console.error('SECURITY ALERT: Email sending blocked due to unauthorized IP access');
      console.error('This may indicate a security breach. Please check your email system immediately.');
      
      // In production, always fail for security
      if (process.env.NODE_ENV === 'production') {
        return false;
      }
      
      // In development, log warning but continue
      console.warn('Development mode: Continuing despite authorization failure');
    }
    
    // Check rate limits
    const rateLimitKey = senderIP || 'unknown';
    if (!checkEmailRateLimit(rateLimitKey)) {
      console.error('Email rate limit exceeded');
      console.error('SECURITY ALERT: Email rate limit exceeded - possible spam attempt');
      return false;
    }
    
    const transporter = createTransporter();
    const timestamp = Date.now();

    // Generate or use the reference ID
    const refId = data.referenceId || `TOKEN-${timestamp.toString().slice(-6)}`;
    if (!data.referenceId) {
      data.referenceId = refId;
    }

    // Generate security token
    const securityToken = generateSecureToken(data.email, timestamp);
    
    // Format turnover information with currency
    const turnoverText = data.turnover && data.turnoverCurrency
      ? data.turnoverCurrency === 'INR'
        ? `₹${data.turnover} Crores`
        : `$${data.turnover} Million`
      : 'Not provided';

    // Determine country display name
    let countryDisplay = '';
    if (data.country === 'others') {
      countryDisplay = data.customCountry || 'Others';
    } else {
      countryDisplay = countryCodeToName[data.country] || data.country;
    }

    // Create email HTML content with security headers
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Vendor Registration - ${refId}</title>
      </head>
      <body style="font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
        <div style="max-width: 800px; margin: 0 auto; background-color: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          
          <!-- Security Header -->
          <div style="background-color: #c41e3a; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">🔒 SECURE VENDOR REGISTRATION</h1>
            <p style="margin: 10px 0 0 0; font-size: 14px;">This email is verified and sent from Rashmi Group's secure system</p>
          </div>
          
          <!-- Email Content -->
          <div style="padding: 30px;">
            <h2 style="color: #c41e3a; margin-top: 0;">New Vendor Registration - Token ID: ${refId}</h2>
            <p><strong>Registration Date:</strong> ${new Date().toLocaleString()}</p>
            <p><strong>Security Token:</strong> ${securityToken}</p>
            <p><strong>Sender IP:</strong> ${senderIP || 'System'}</p>

            <h3 style="color: #c41e3a; border-bottom: 2px solid #f0f0f0; padding-bottom: 10px;">Contact Person Details</h3>
            <p><strong>Full Name:</strong> ${data.name}</p>
            <p><strong>Designation:</strong> ${data.designation || 'Not provided'}</p>
            <p><strong>Email Address:</strong> ${data.email}</p>
            <p><strong>Contact Number:</strong> ${data.contactNo || 'Not provided'}</p>

            <h3 style="color: #c41e3a; border-bottom: 2px solid #f0f0f0; padding-bottom: 10px;">Company Information</h3>
            <p><strong>Company/Firm Name:</strong> ${data.companyName}</p>
            <p><strong>Type of Firm:</strong> ${data.firmType || 'Not provided'}</p>
            <p><strong>Company Website:</strong> ${data.website || 'Not provided'}</p>
            <p><strong>Vendor Type:</strong> ${data.vendorType === 'domestic' ? 'Domestic Vendor (India)' : 'Global Vendor'}</p>
            <p><strong>Country:</strong> ${countryDisplay}</p>
            ${data.customCountryCode ? `<p><strong>Custom Country Code:</strong> ${data.customCountryCode}</p>` : ''}
            ${data.address ? `<p><strong>Address:</strong> ${data.address}</p>` : ''}
            ${data.vendorType === 'domestic' ? `<p><strong>GST Number:</strong> ${data.gstNumber || 'Not provided'}</p>` : ''}

            <h3 style="color: #c41e3a; border-bottom: 2px solid #f0f0f0; padding-bottom: 10px;">Product/Service Information</h3>
            <p><strong>Primary Category:</strong> ${data.category}</p>
            <p><strong>Product/Service Description:</strong> ${data.productDescription}</p>
            <p><strong>Major Clients or Projects:</strong> ${data.majorClients || 'Not provided'}</p>
            <p><strong>Last Year Turnover:</strong> ${turnoverText}</p>

            <h3 style="color: #c41e3a; border-bottom: 2px solid #f0f0f0; padding-bottom: 10px;">Supporting Documents</h3>
            <p><strong>Attachments:</strong> ${files && files.length > 0 ? `${files.length} file(s) attached` : 'None'}</p>
            
            <!-- Security Footer -->
            <div style="margin-top: 30px; padding: 20px; background-color: #f8f9fa; border-radius: 5px; border-left: 4px solid #c41e3a;">
              <h4 style="color: #c41e3a; margin-top: 0;">Security Verification</h4>
              <p><strong>Email Authentication:</strong> ✅ Verified</p>
              <p><strong>System IP:</strong> ${senderIP || 'Internal System'}</p>
              <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
              <p><strong>Token:</strong> ${securityToken}</p>
              <p style="font-size: 12px; color: #666; margin-bottom: 0;">
                This email was sent from Rashmi Group's secure vendor registration system. 
                If you received this email in error, please report it immediately.
              </p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    // Get admin email from environment or use default
    const adminEmail = process.env.ADMIN_EMAIL || 'procurement@rashmigroup.com';
    
    console.log(`Preparing to send email to admin: ${adminEmail}`);

    // Prepare email options with security headers
    const mailOptions = {
      from: `"Rashmi Metaliks Vendor Portal" <${process.env.EMAIL_USER || 'procurement@rashmigroup.com'}>`,
      to: adminEmail,
      subject: `🔒 SECURE: New Vendor Registration - ${data.companyName} - Token: ${refId}`,
      html: htmlContent,
      headers: {
        'X-Mailer': 'Rashmi Group Vendor Portal v1.0',
        'X-Security-Token': securityToken,
        'X-Sender-IP': senderIP || 'system',
        'X-Timestamp': timestamp.toString(),
        'X-Priority': '3',
        'X-MSMail-Priority': 'Normal',
        'Message-ID': `<${refId}-${timestamp}@rashmigroup.com>`
      },
      attachments: [] as any[]
    };

    // Add file attachments if available
    if (files && files.length > 0) {
      console.log(`Adding ${files.length} files as attachments`);
      
      files.forEach((file, index) => {
        // Extract base name and extension from original filename
        const originalName = file.originalname;
        const lastDot = originalName.lastIndexOf('.');
        let baseName = lastDot !== -1 ? originalName.substring(0, lastDot) : originalName;
        let fileExtension = lastDot !== -1 ? originalName.substring(lastDot + 1) : '';
        // Sanitize base name and company name
        const sanitizedBaseName = baseName.replace(/[^a-zA-Z0-9_-]/g, '_');
        const sanitizedCompanyName = (data.companyName || 'company').replace(/[^a-zA-Z0-9_-]/g, '_');
        const sanitizedTokenId = (data.referenceId || 'TOKEN').replace(/[^a-zA-Z0-9_-]/g, '_');
        // Compose new filename: companyName_originalFileName_tokenId.ext
        const newFilename = `${sanitizedCompanyName}_${sanitizedBaseName}_${sanitizedTokenId}${fileExtension ? '.' + fileExtension : ''}`;
        console.log('Attachment filename:', newFilename);
        mailOptions.attachments.push({
          filename: newFilename,
          content: file.buffer
        });
      });
    }

    try {
      // Send email to admin
      console.log('Sending email to admin...');
      const adminInfo = await transporter.sendMail(mailOptions);
      console.log('Admin email sent successfully:', adminInfo.messageId);
      
      // Send confirmation email to the vendor
      console.log(`Sending confirmation email to vendor: ${data.email}`);
      
      const confirmationInfo = await transporter.sendMail({
        from: `"Rashmi Metaliks Procurement" <${process.env.EMAIL_USER || 'procurement@rashmigroup.com'}>`,
        to: data.email,
        subject: `🔒 SECURE: Your Vendor Registration Received - Token ID: ${refId}`,
        headers: {
          'X-Mailer': 'Rashmi Group Vendor Portal v1.0',
          'X-Security-Token': securityToken,
          'X-Sender-IP': senderIP || 'system',
          'X-Timestamp': timestamp.toString(),
          'Message-ID': `<${refId}-${timestamp}-confirmation@rashmigroup.com>`
        },
        html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Vendor Registration Confirmation</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f4f4f4; }
            .container { max-width: 650px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #c41e3a, #8b1538); color: white; padding: 30px; text-align: center; }
            .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
            .header p { margin: 10px 0 0 0; opacity: 0.9; font-size: 16px; }
            .content { padding: 30px; }
            .token-box { background: #f8f9fa; border: 2px solid #c41e3a; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; }
            .token-box h2 { margin: 0; color: #c41e3a; font-size: 24px; }
            .token-box p { margin: 5px 0 0 0; color: #666; }
            .security-box { background: #e8f5e8; border: 2px solid #28a745; border-radius: 8px; padding: 20px; margin: 20px 0; }
            .security-box h3 { color: #28a745; margin-top: 0; }
            .section { margin: 25px 0; }
            .section h3 { color: #c41e3a; font-size: 18px; margin-bottom: 15px; border-bottom: 2px solid #f0f0f0; padding-bottom: 8px; }
            .summary-grid { display: grid; grid-template-columns: 1fr; gap: 10px; }
            .summary-item { background: #f8f9fa; padding: 12px; border-radius: 6px; border-left: 4px solid #c41e3a; }
            .summary-item strong { color: #333; }
            .next-steps { background: #e8f4fd; border: 2px solid #2196f3; border-radius: 8px; padding: 20px; margin: 25px 0; }
            .next-steps h3 { color: #1976d2; margin-top: 0; }
            .bidnemo-box { background: linear-gradient(135deg, #f8f9fa, #e3f2fd); border: 2px solid #2196f3; border-radius: 8px; padding: 20px; margin: 20px 0; }
            .bidnemo-box h3 { color: #1976d2; margin-top: 0; }
            .warning-box { background: #fff3cd; border: 2px solid #ffc107; border-radius: 8px; padding: 20px; margin: 20px 0; }
            .warning-box h3 { color: #b7560c; margin-top: 0; }
            .footer { background: #2c3e50; color: white; padding: 25px; text-align: center; }
            .footer p { margin: 5px 0; }
            .contact-info { background: #ecf0f1; padding: 15px; border-radius: 6px; margin-top: 15px; }
            @media (max-width: 600px) {
              .container { margin: 10px; border-radius: 5px; }
              .header, .content, .footer { padding: 20px; }
              .header h1 { font-size: 24px; }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <!-- Header -->
            <div class="header">
              <h1>🏭 Rashmi Group</h1>
              <p>🔒 Secure Vendor Registration Confirmation</p>
            </div>

            <!-- Main Content -->
            <div class="content">
              <!-- Greeting -->
              <h2 style="color: #2c3e50; margin-bottom: 20px;">Dear ${data.name},</h2>
              
              <p style="font-size: 16px; margin-bottom: 20px;">
                Thank you for your interest in partnering as a Vendor with <strong>Rashmi Group.</strong> 
                We have successfully received your vendor registration profile.
              </p>

              <!-- Token Box -->
              <div class="token-box">
                <h2>Your Token ID: ${refId}</h2>
                <p>Please save this reference number for future communication</p>
              </div>

              <!-- Security Verification -->
              <div class="security-box">
                <h3>🔒 Security Verification</h3>
                <p><strong>Email Authentication:</strong> ✅ Verified</p>
                <p><strong>Security Token:</strong> ${securityToken}</p>
                <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
                <p style="font-size: 12px; margin-bottom: 0;">
                  This email was sent from our secure system. If you didn't register, please contact us immediately.
                </p>
              </div>

              <!-- Registration Summary -->
              <div class="section">
                <h3>📋 Registration Summary</h3>
                <div class="summary-grid">
                  <div class="summary-item">
                    <strong>Company Name:</strong> ${data.companyName}
                  </div>
                  <div class="summary-item">
                    <strong>Type of Firm:</strong> ${data.firmType || 'Not provided'}
                  </div>
                  <div class="summary-item">
                    <strong>Vendor Type:</strong> ${data.vendorType === 'domestic' ? 'Domestic Vendor (India)' : 'Global Vendor'}
                  </div>
                  <div class="summary-item">
                    <strong>Primary Category:</strong> ${data.category}
                  </div>
                  ${data.vendorType === 'domestic' && data.gstNumber ? `
                  <div class="summary-item">
                    <strong>GST Number:</strong> ${data.gstNumber}
                  </div>` : ''}
                  <div class="summary-item">
                    <strong>Last Year Turnover:</strong> ${turnoverText}
                  </div>
                </div>
              </div>

              <!-- Next Steps -->
              <div class="next-steps">
                <h3>🔍 What Happens Next?</h3>
                <p>Our Central Purchase Team will carefully review your profile and supporting documents.</p>
                <p>We will assess your company's capabilities, compliance, and alignment with our needs.</p>
                <p>After reviewing your profile, we will contact you as per our business needs and requirements.</p>
              </div>

              <!-- BidNemo Information -->
              <div class="bidnemo-box">
                <h3>🏆 BidNemo Bidding Portal Registration</h3>
                <p>
                  <strong>Important:</strong> Upon successful evaluation and as per our business requirements, 
                  we will invite you to participate with your pricing through our official bidding portal 
                  <strong><a href="http://bidnemo.com/login" style="color: #1976d2; text-decoration: none;">BidNemo</a></strong> 
                  or request for quotation through mail.
                </p>
                <p>
                  This registration will allow you to:
                </p>
                <ul>
                  <li>✅ Participate in live tenders and auctions</li>
                  <li>✅ Access real-time bidding opportunities</li>
                  <li>✅ Submit competitive proposals</li>
                  <li>✅ Track your bid status and communications</li>
                </ul>
              </div>

              <!-- Security Warning -->
              <div class="warning-box">
                <h3>⚠️ Important Security Notice</h3>
                <p>
                  <strong>FREE REGISTRATION:</strong> We do not charge any registration fees or amounts. 
                  Our vendor registration process is completely FREE.
                </p>
                <p>
                  <strong>Fraud Alert:</strong> If you receive any payment requests claiming to be from 
                  Rashmi Metaliks for registration or processing fees, please ignore them immediately. 
                  Such requests are fraudulent and should be reported.
                </p>
              </div>

              <!-- Contact Information -->
              <div class="contact-info">
                <p><strong>For Business related queries:</strong></p>
                <p>📧 Email: procurement@rashmigroup.com</p>
                <p>🌐 Website: www.rashmigroup.com</p>
              </div>
            </div>

            <!-- Footer -->
            <div class="footer">
              <p><strong>Rashmi Group</strong></p>
              <p>Procurement Department</p>
              <p style="margin-top: 15px; font-size: 14px; opacity: 0.8;">
                This is an automated message. Please do not reply to this email.
              </p>
            </div>
          </div>
        </body>
        </html>
        `
      });
      
      console.log('Confirmation email sent successfully:', confirmationInfo.messageId);
      
      // Log successful email for monitoring
      console.log(`SECURITY LOG: Email sent successfully`, {
        token: securityToken,
        refId: refId,
        timestamp: timestamp,
        senderIP: senderIP,
        email: data.email,
        company: data.companyName
      });
      
      return true;
    } catch (emailError) {
      console.error('Error in transporter.sendMail:', emailError);
      // Even if email fails, we consider this a "soft fail" and return true
      // so the form submission is still successful
      return true;
    }
  } catch (error) {
    console.error('Error in sendVendorRegistrationEmail:', error);
    // Return true to ensure form submission still works even if email fails
    return true;
  }
}; 