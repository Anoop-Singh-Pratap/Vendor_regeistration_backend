import { Request, Response } from 'express';
import { VendorFormData } from '../types/vendor';
import { sendVendorRegistrationEmail } from '../services/emailService';

// In-memory store for submissions when email sending fails
const vendorSubmissionsStore: Array<{
  data: VendorFormData,
  files?: Array<{filename: string, size: number}> | null
}> = [];

export const submitVendorRegistration = async (req: Request, res: Response) => {
  try {
    const vendorData: VendorFormData = req.body;
    // Handle multiple files (array) instead of a single file
    const files = req.files as Express.Multer.File[] | undefined;

    // Basic validation
    if (!vendorData.name || !vendorData.designation || !vendorData.companyName ||
        !vendorData.firmType || !vendorData.vendorType || !vendorData.country || !vendorData.contactNo ||
        !vendorData.email || !vendorData.category || !vendorData.productDescription ||
        !vendorData.turnover || !vendorData.turnoverCurrency) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Generate a reference ID if not already provided
    if (!vendorData.referenceId) {
      vendorData.referenceId = `TOKEN-${Date.now().toString().slice(-6)}`;
    }

    // Store submission in memory regardless of email success
    vendorSubmissionsStore.push({
      data: vendorData,
      files: files?.length ? files.map(file => ({
        filename: file.originalname,
        size: file.size
      })) : null
    });

    console.log('New vendor registration stored:', vendorData);
    console.log(`Files received: ${files?.length || 0}`);
    console.log(`Total stored vendor submissions: ${vendorSubmissionsStore.length}`);

    try {
      // Attempt to send email, but don't make success dependent on it
      const emailSent = await sendVendorRegistrationEmail(vendorData, files);
      if (emailSent) {
        console.log('Vendor registration email sent successfully');
      }
    } catch (error) {
      // Log email error but don't fail the submission
      console.error('Error sending vendor registration email:', error);
    }

    // Always return success to the frontend
    return res.status(200).json({
      success: true,
      message: 'Vendor registration submitted successfully',
      referenceId: vendorData.referenceId
    });

  } catch (error) {
    console.error('Error processing vendor registration:', error);
    res.status(500).json({
      success: false,
      message: 'An unexpected error occurred'
    });
  }
}; 