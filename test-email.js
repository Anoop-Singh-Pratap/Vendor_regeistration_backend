const nodemailer = require('nodemailer');
require('dotenv').config();

// Create test transporter (no timeout options)
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.office365.com',
  port: Number(process.env.EMAIL_PORT || 587),
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER || 'procurement@rashmigroup.com',
    pass: process.env.EMAIL_PASS
  },
  requireTLS: true,
  logger: true,
  debug: true
});

async function testEmail() {
  try {
    console.log('Testing email configuration...');
    console.log('Email Host:', process.env.EMAIL_HOST);
    console.log('Email User:', process.env.EMAIL_USER);
    console.log('Email Port:', process.env.EMAIL_PORT);
    
    // Verify transporter configuration
    console.log('Verifying transporter...');
    await transporter.verify();
    console.log('✅ Transporter verified successfully!');
    
    // Send test email
    console.log('Sending test email...');
    const info = await transporter.sendMail({
      from: `"Rashmi Metaliks Test" <${process.env.EMAIL_USER}>`,
      to: process.env.ADMIN_EMAIL || 'procurement@rashmigroup.com',
      subject: 'Email Configuration Test - ' + new Date().toLocaleString(),
      html: `
        <h2>Email Configuration Test</h2>
        <p>This is a test email to verify the email configuration is working properly.</p>
        <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
        <p><strong>Server:</strong> ${process.env.EMAIL_HOST}</p>
        <p><strong>Port:</strong> ${process.env.EMAIL_PORT}</p>
        <p><strong>From:</strong> ${process.env.EMAIL_USER}</p>
        <p>If you receive this email, the configuration is working correctly!</p>
      `
    });
    
    console.log('✅ Test email sent successfully!');
    console.log('Message ID:', info.messageId);
    
  } catch (error) {
    console.error('❌ Email test failed:', error);
    if (error.code === 'EAUTH') {
      console.error('Authentication failed. Please check your email credentials.');
    } else if (error.code === 'ETIMEDOUT') {
      console.error('Connection timeout. Please check network connectivity.');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('Connection refused. Please check SMTP server settings.');
    }
  } finally {
    // Close transporter
    transporter.close();
  }
}

// Run the test
testEmail();
 