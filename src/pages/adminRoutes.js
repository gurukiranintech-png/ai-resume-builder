const express = require("express");

const router = express.Router();

const protect = require("../middleware/authMiddleware");
const adminOnly = require("../middleware/adminMiddleware");

const {
    getAllUsers,
    getAllResumes,
    getResumeById,
    deleteResume
} = require("../controllers/adminController");

// ==========================================
// GET ALL USERS
// ==========================================

router.get(
"/users",
    protect,
    adminOnly,
    getAllUsers
);

// ==========================================
// GET ALL RESUMES
// ==========================================

router.get(
"/resumes",
    protect,
    adminOnly,
    getAllResumes
);

// ==========================================
// GET SINGLE RESUME
// ==========================================

router.get(
"/resumes/:id",
    protect,
    adminOnly,
    getResumeById
);

// ==========================================
// DELETE RESUME
// ==========================================

router.delete(
"/resumes/:id",
    protect,
    adminOnly,
    deleteResume
);

module.exports = router;
