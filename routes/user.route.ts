import express, { Router } from 'express';
const router: Router = express.Router();
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
} from '../controllers/user.controller.js';
import { authenticate, authorizeAdmin } from '../middlewares/auth.js';

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password-email/:token', resetPasswordWithToken);
router.post('/reset-password-phone', resetPasswordWithOTP);

router.route('/profile').get(authenticate, getUserProfile).put(authenticate, updateUserProfile);

router.route('/profile/addresses').post(authenticate, addAddress);

router.route('/profile/addresses/:addressId').put(authenticate, updateAddress).delete(authenticate, deleteAddress);

router.route('/').get(authenticate, authorizeAdmin, getAllUsers);

router.route('/:id').get(authenticate, authorizeAdmin, getUserById);

router.route('/:id/role').patch(authenticate, authorizeAdmin, updateUserRole);

export default router;

