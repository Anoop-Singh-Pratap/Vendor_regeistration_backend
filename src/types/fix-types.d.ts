// Fix for TypeScript errors in Vercel deployment

// Add declarations for modules without type definitions
declare module 'nodemailer';

// Extend Express namespace
declare namespace Express {
  export interface Request {
    // Add any custom properties here
    file?: any;
    files?: any;
  }
}

// Add process declarations for environments where they might be missing
declare var process: {
  env: {
    [key: string]: string | undefined;
    NODE_ENV: 'development' | 'production' | 'test';
    EMAIL_HOST: string;
    EMAIL_PORT: string;
    EMAIL_USER: string;
    EMAIL_PASS: string;
    EMAIL_SECURE: string;
    ADMIN_EMAIL: string;
  }
}; 