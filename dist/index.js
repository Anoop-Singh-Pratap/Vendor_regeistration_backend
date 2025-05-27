"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const vendorRoutes_1 = require("./routes/vendorRoutes");
// Load environment variables
dotenv_1.default.config();
// Create Express server
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
// CORS handling - specifically allow the frontend domain
app.use((req, res, next) => {
    const allowedOrigin = process.env.CORS_ORIGIN || 'https://vendor-registration-one.vercel.app';
    // Set the specific origin or allow the requesting origin if it matches our frontend
    const requestOrigin = req.headers.origin;
    if (requestOrigin === 'https://vendor-registration-one.vercel.app') {
        res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    }
    else {
        res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    // If it's an OPTIONS preflight request, send 200 OK and end.
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    next(); // Continue to other middlewares/routes for non-OPTIONS requests
});
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// API Routes
app.use('/api/vendors', vendorRoutes_1.vendorRoutes);
// Simple health check route
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok', message: 'API is running' });
});
// Start server (for local development only)
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Server running locally on port ${PORT}`);
    });
}
// Export the app for Vercel serverless deployment
exports.default = app;
