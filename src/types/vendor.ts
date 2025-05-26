export interface VendorFormData {
  name: string;
  designation: string;
  companyName: string;
  firmType: string;
  vendorType: string;
  country: string;
  customCountry?: string;
  customCountryCode?: string;
  website?: string;
  contactNo: string;
  email: string;
  category: string;
  productDescription: string;
  majorClients?: string;
  turnover: string;
  turnoverCurrency: string; // 'INR' or 'USD'
  gstNumber?: string; // GST Registration Number (optional)
  terms: boolean;
  referenceId?: string; // Added for tracking
} 