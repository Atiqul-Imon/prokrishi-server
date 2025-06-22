import express from "express";
const router = express.Router();
import {
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
  addAddress,
  updateAddress,
  deleteAddress,
  getAllUsers,
  getUserById,
  updateUserRole,
  forgotPassword,
  resetPasswordWithToken,
  resetPasswordWithOTP,
} from "../controllers/user.controller.js";
import { authenticate, authorizeAdmin } from "../middlewares/auth.js";

// Public routes
router.post("/register", registerUser);
router.post("/login", loginUser);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password-email/:token', resetPasswordWithToken);
router.post('/reset-password-phone', resetPasswordWithOTP);

// Private routes (require authentication)
router.route("/profile").get(authenticate, getUserProfile).put(authenticate, updateUserProfile);

router.route("/profile/addresses")
    .post(authenticate, addAddress);

router.route("/profile/addresses/:addressId")
    .put(authenticate, updateAddress)
    .delete(authenticate, deleteAddress);

// Admin routes
router.route("/")
    .get(authenticate, authorizeAdmin, getAllUsers);

router.route("/:id")
    .get(authenticate, authorizeAdmin, getUserById);

router.route("/:id/role")
    .patch(authenticate, authorizeAdmin, updateUserRole);

export default router;