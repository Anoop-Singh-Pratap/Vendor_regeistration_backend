"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const vendorRoutes_1 = require("./routes/vendorRoutes");
// Load environment variables
dotenv_1.default.config();
// Create Express server
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// API Routes
app.use('/api/vendors', vendorRoutes_1.vendorRoutes);
// Serve static files from the frontend build directory in production
if (process.env.NODE_ENV === 'production') {
    // Set static folder
    const staticPath = path_1.default.join(__dirname, '../../frontend/dist');
    app.use(express_1.default.static(staticPath));
    // Any route that is not an API route will be handled by the frontend
    app.get('*', (req, res) => {
        res.sendFile(path_1.default.resolve(staticPath, 'index.html'));
    });
}
// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
