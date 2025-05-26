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
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});
// POST /api/vendors - Submit vendor registration with document upload
router.post('/', upload.array('supportingDocuments', 3), vendorController_1.submitVendorRegistration);
