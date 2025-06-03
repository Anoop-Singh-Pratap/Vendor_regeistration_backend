"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.vendorRoutes = void 0;
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const vendorController_1 = require("../controllers/vendorController");
const router = express_1.default.Router();
exports.vendorRoutes = router;
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error('Only PDF and Word documents (DOC/DOCX) are allowed.'));
        }
    }
});
// POST /api/vendors - Submit vendor registration with document upload
router.post('/', (req, res, next) => {
    upload.array('supportingDocuments', 3)(req, res, function (err) {
        if (err instanceof multer_1.default.MulterError) {
            // Multer-specific errors
            return res.status(400).json({ success: false, message: err.message });
        }
        else if (err) {
            // File type or other errors
            return res.status(400).json({ success: false, message: err.message });
        }
        next();
    });
}, vendorController_1.submitVendorRegistration);
