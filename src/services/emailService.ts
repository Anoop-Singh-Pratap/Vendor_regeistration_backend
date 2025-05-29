import nodemailer from 'nodemailer';
import { VendorFormData } from '../types/vendor';

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

  return nodemailer.createTransport({
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

export const sendVendorRegistrationEmail = async (data: VendorFormData, files?: Express.Multer.File[]): Promise<boolean> => {
  try {
    console.log('Attempting to send vendor registration email...');
    
    // Skip email in test environments or if explicitly disabled
    if (process.env.SKIP_EMAILS === 'true') {
      console.log('Email sending skipped due to SKIP_EMAILS=true');
      return true;
    }
    
    const transporter = createTransporter();

    // Generate or use the reference ID
    const refId = data.referenceId || `TOKEN-${Date.now().toString().slice(-6)}`;
    if (!data.referenceId) {
      data.referenceId = refId;
    }

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

    // Create email HTML content
    const htmlContent = `
      <h2>New Vendor Registration - Token ID: ${refId}</h2>
      <p><strong>Registration Date:</strong> ${new Date().toLocaleString()}</p>

      <h3>Contact Person Details</h3>
      <p><strong>Name:</strong> ${data.name}</p>
      <p><strong>Designation:</strong> ${data.designation}</p>
      <p><strong>Email:</strong> ${data.email}</p>
      <p><strong>Contact Number:</strong> ${data.contactNo}</p>

      <h3>Company Information</h3>
      <p><strong>Company Name:</strong> ${data.companyName}</p>
      <p><strong>Firm Type:</strong> ${data.firmType}</p>
      <p><strong>Vendor Type:</strong> ${data.vendorType}</p>
      <p><strong>Country:</strong> ${countryDisplay}</p>
      ${data.customCountry && data.country === 'others' ? `<p><strong>Custom Country:</strong> ${data.customCountry}</p>` : ''}
      ${data.customCountryCode ? `<p><strong>Custom Country Code:</strong> ${data.customCountryCode}</p>` : ''}
      <p><strong>Website:</strong> ${data.website || 'Not provided'}</p>
      ${data.vendorType === 'domestic' ? `<p><strong>GST Number:</strong> ${data.gstNumber || 'Not provided'}</p>` : ''}
      <p><strong>Last Year Turnover:</strong> ${turnoverText}</p>

      <h3>Product/Service Information</h3>
      <p><strong>Category:</strong> ${data.category}</p>
      <p><strong>Product Description:</strong> ${data.productDescription}</p>
      <p><strong>Major Clients:</strong> ${data.majorClients || 'Not provided'}</p>
      <p><strong>Attachments:</strong> ${files && files.length > 0 ? `${files.length} file(s) attached` : 'None'}</p>
    `;

    // Get admin email from environment or use default
    const adminEmail = process.env.ADMIN_EMAIL || 'procurement@rashmigroup.com';
    
    console.log(`Preparing to send email to admin: ${adminEmail}`);

    // Prepare email options
    const mailOptions = {
      from: `"Rashmi Metaliks Vendor Portal" <${process.env.EMAIL_USER || 'procurement@rashmigroup.com'}>`,
      to: adminEmail,
      subject: `New Vendor Registration: ${data.companyName} - Token ID: ${refId}`,
      html: htmlContent,
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
        subject: `Your Vendor Registration - Token ID: ${refId}`,
        html: `
          <h2>Thank you for your registration with Rashmi Metaliks</h2>
          <p>Dear ${data.name},</p>
          <p>We have received your vendor registration application. Your Token ID is: <strong>${refId}</strong></p>
          <p>Our procurement team will review your details and contact you shortly.</p>
          <p><strong>Registration Summary:</strong></p>
          <ul>
            <li><strong>Company Name:</strong> ${data.companyName}</li>
            <li><strong>Firm Type:</strong> ${data.firmType}</li>
            ${data.vendorType === 'domestic' && data.gstNumber ? `<li><strong>GST Number:</strong> ${data.gstNumber}</li>` : ''}
            <li><strong>Last Year Turnover:</strong> ${turnoverText}</li>
          </ul>
          <p>Please note that we do not charge any registration amount. If you receive any payment requests, then that is a fraud and should be ignored.</p>
          <p>Regards,<br>Procurement Team<br>Rashmi Metaliks Ltd.</p>
        `
      });
      
      console.log('Confirmation email sent successfully:', confirmationInfo.messageId);
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