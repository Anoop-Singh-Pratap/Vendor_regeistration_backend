"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const dotenv_1 = __importDefault(require("dotenv"));
const vendorRoutes_1 = require("./routes/vendorRoutes");
const rateLimiter_1 = require("./middleware/rateLimiter");
// Load environment variables
dotenv_1.default.config();
// Create Express server
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
// Security middleware - Helmet for various security headers
app.use((0, helmet_1.default)({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
        },
    },
    crossOriginEmbedderPolicy: false, // Disable for better compatibility
}));
// Trust proxy for accurate IP addresses (important for rate limiting)
app.set('trust proxy', 1);
// Global rate limiting
app.use('/api/', rateLimiter_1.globalRateLimiter);
// Enhanced CORS handling with security considerations
app.use((req, res, next) => {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
        'http://localhost:3000',
        'http://localhost:5173',
        'https://vendor-registration.vercel.app'
    ];
    const origin = req.headers.origin;
    if (process.env.NODE_ENV === 'development' || (origin && allowedOrigins.includes(origin))) {
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Real-IP, X-Forwarded-For');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
    // If it's an OPTIONS preflight request, send 200 OK and end.
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    next();
});
// Body parsing middleware with size limits
app.use(express_1.default.json({ limit: '10MB' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10MB' }));
// Request logging middleware
app.use((req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - IP: ${ip}`);
    next();
});
// API Routes
app.use('/api/vendors', vendorRoutes_1.vendorRoutes);
// Simple health check route
app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        message: 'API is running',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});
// Debug endpoint for rate limiter status (only in development)
if (process.env.NODE_ENV === 'development') {
    app.get('/api/debug/rate-limiter', (req, res) => {
        res.json((0, rateLimiter_1.getTrackerStatus)());
    });
}
// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    // Handle specific error types
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
            success: false,
            message: 'File size too large. Maximum size is 10MB per file.',
            error: 'FILE_SIZE_LIMIT'
        });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({
            success: false,
            message: 'Unexpected file field or too many files.',
            error: 'UNEXPECTED_FILE'
        });
    }
    res.status(500).json({
        success: false,
        message: 'An unexpected error occurred',
        error: process.env.NODE_ENV === 'development' ? err.message : 'INTERNAL_SERVER_ERROR'
    });
});
// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found',
        error: 'NOT_FOUND'
    });
});
// Start server (for local development only)
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Server running locally on port ${PORT}`);
        console.log(`Health check: http://localhost:${PORT}/api/health`);
        console.log(`Rate limiter debug: http://localhost:${PORT}/api/debug/rate-limiter`);
    });
}
// Export the app for Vercel serverless deployment
exports.default = app;
