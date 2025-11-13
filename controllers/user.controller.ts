import { Response } from 'express';
import crypto from 'crypto';
import User from '../models/user.model.js';
import generateAccessToken from '../utils/generateAccessToken.js';
import generateRefreshToken from '../utils/generateRefreshToken.js';
import sendEmail from '../utils/sendEmail.js';
import { AuthRequest } from '../types/index.js';

export const registerUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, email, phone, password } = req.body;

    if (!phone || !name || !password) {
      res.status(400).json({
        message: 'Name, phone number, and password are required',
        error: true,
        success: false,
      });
      return;
    }

    const existingPhone = await User.findOne({ phone });
    if (existingPhone) {
      res.status(400).json({
        message: 'User already exists with this phone number',
        error: true,
        success: false,
      });
      return;
    }

    if (email) {
      const existingEmail = await User.findOne({ email });
      if (existingEmail) {
        res.status(400).json({
          message: 'User already exists with this email',
          error: true,
          success: false,
        });
        return;
      }
    }

    const newUser = await User.create({
      name,
      email: email || undefined,
      phone,
      password,
    });

    const accessToken = await generateAccessToken(newUser._id.toString());
    const refreshToken = await generateRefreshToken(newUser._id.toString());

    const { password: _, ...userData } = (newUser as any)._doc;

    res.status(201).json({
      message: 'User registered successfully',
      user: userData,
      accessToken,
      refreshToken,
      success: true,
    });
  } catch (error: any) {
    console.error('Register error:', error.message);
    res.status(500).json({
      message: error.message || 'Server error while registering user',
      error: true,
      success: false,
    });
  }
};

export const loginUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        message: 'Email/Phone and password are required',
        error: true,
        success: false,
      });
      return;
    }

    const user = await User.findOne({
      $or: [{ email: email }, { phone: email }],
    });

    if (!user) {
      res.status(401).json({
        message: 'Invalid credentials',
        error: true,
        success: false,
      });
      return;
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      res.status(401).json({
        message: 'Invalid credentials',
        error: true,
        success: false,
      });
      return;
    }

    const accessToken = await generateAccessToken(user._id.toString());
    const refreshToken = await generateRefreshToken(user._id.toString());

    const { password: _, ...userData } = (user as any)._doc;

    res.status(200).json({
      message: 'Login successful',
      user: userData,
      accessToken,
      refreshToken,
      success: true,
    });
  } catch (error: any) {
    console.error('Login error:', error.message);
    res.status(500).json({
      message: 'Server error during login',
      error: true,
      success: false,
    });
  }
};

export const getUserProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;

    if (!user) {
      res.status(401).json({
        message: 'Unauthorized: No user found',
        success: false,
        error: true,
      });
      return;
    }

    res.status(200).json({
      message: 'User profile fetched successfully',
      user,
      success: true,
    });
  } catch (error: any) {
    console.error('Get Profile Error:', error.message);
    res.status(500).json({
      message: 'Server error while fetching user profile',
      error: true,
      success: false,
    });
  }
};

export const getAllUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { search, page = 1, limit = 10 } = req.query;

    const query: any = {};
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    const totalUsers = await User.countDocuments(query);

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit as string))
      .skip((parseInt(page as string) - 1) * parseInt(limit as string))
      .lean();

    res.status(200).json({
      message: 'All users fetched successfully',
      data: users,
      pagination: {
        total: totalUsers,
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        totalPages: Math.ceil(totalUsers / parseInt(limit as string)),
      },
      success: true,
    });
  } catch (error: any) {
    res.status(500).json({
      message: 'Server error while fetching all users',
      error: true,
      success: false,
    });
  }
};

export const getUserById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (user) {
      res.status(200).json({
        message: 'User fetched successfully',
        user,
        success: true,
      });
    } else {
      res.status(404).json({ message: 'User not found', success: false, error: true });
    }
  } catch (error: any) {
    res.status(500).json({
      message: 'Server error while fetching user',
      error: true,
      success: false,
    });
  }
};

export const updateUserRole = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role } = req.body;

    const validRoles = ['user', 'admin', 'super_admin'];
    if (!validRoles.includes(role)) {
      res.status(400).json({
        message: 'Invalid role. Must be one of: user, admin, super_admin',
        success: false,
        error: true,
      });
      return;
    }

    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true, runValidators: true }).select(
      '-password'
    );

    if (!user) {
      res.status(404).json({
        message: 'User not found',
        success: false,
        error: true,
      });
      return;
    }

    res.status(200).json({
      message: 'User role updated successfully',
      user,
      success: true,
    });
  } catch (error: any) {
    res.status(500).json({
      message: 'Server error while updating user role',
      error: true,
      success: false,
    });
  }
};

export const addAddress = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $push: { addresses: req.body } },
      { new: true, runValidators: true }
    ).lean();

    if (updatedUser) {
      const newAddress = updatedUser.addresses[updatedUser.addresses.length - 1];
      res.status(201).json(newAddress);
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error: any) {
    console.warn('Add Address Error:', error);
    res.status(400).json({ message: error.message || 'Error adding address' });
  }
};

export const updateAddress = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    const { addressId } = req.params;
    const newAddressData = req.body;

    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const user = await User.findById(userId);

    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    const addressIndex = user.addresses.findIndex((addr) => addr._id?.toString() === addressId);

    if (addressIndex === -1) {
      res.status(404).json({ message: 'Address not found' });
      return;
    }

    const update: Record<string, any> = {};
    for (const key in newAddressData) {
      update[`addresses.${addressIndex}.${key}`] = newAddressData[key];
    }

    const updatedUser = await User.findByIdAndUpdate(userId, { $set: update }, { new: true, runValidators: true });

    if (updatedUser) {
      res.status(200).json(updatedUser.addresses);
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error: any) {
    res.status(400).json({ message: error.message || 'Error updating address' });
  }
};

export const deleteAddress = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    const { addressId } = req.params;

    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $pull: { addresses: { _id: addressId } } },
      { new: true }
    );

    if (updatedUser) {
      res.status(200).json(updatedUser.addresses);
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error: any) {
    res.status(500).json({ message: 'Error deleting address' });
  }
};

export const updateUserProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?._id) {
      res.status(401).json({ message: 'Unauthorized', success: false, error: true });
      return;
    }

    const user = await User.findById(req.user._id);

    if (user) {
      user.name = req.body.name || user.name;
      user.email = req.body.email || user.email;

      const updatedUser = await user.save();

      const { password, ...userData } = (updatedUser as any)._doc;

      res.status(200).json({
        message: 'Profile updated successfully',
        user: userData,
        success: true,
      });
    } else {
      res.status(404).json({ message: 'User not found', success: false, error: true });
    }
  } catch (error: any) {
    res.status(500).json({
      message: 'Server error while updating profile',
      error: true,
      success: false,
    });
  }
};

export const forgotPassword = async (req: AuthRequest, res: Response): Promise<void> => {
  const { identifier } = req.body;

  if (!identifier) {
    res.status(400).json({ message: 'Email or phone number is required' });
    return;
  }

  const isEmail = identifier.includes('@');
  const user = await User.findOne(isEmail ? { email: identifier } : { phone: identifier });

  if (!user) {
    res.status(200).json({
      message: 'If an account with that identifier exists, a reset link or OTP has been sent.',
    });
    return;
  }

  try {
    if (isEmail) {
      const resetToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

      user.resetPasswordToken = hashedToken;
      user.resetPasswordExpires = new Date(Date.now() + 10 * 60 * 1000);

      const resetUrl = `${process.env.FRONTEND_URL}/reset-password/email/${resetToken}`;
      const message = `You are receiving this email because you (or someone else) has requested the reset of a password. Please make a PUT request to: \n\n ${resetUrl}`;

      await sendEmail({
        email: user.email!,
        subject: 'Password Reset Token',
        message,
      });
    } else {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      user.phoneOtp = otp;
      user.phoneOtpExpires = new Date(Date.now() + 5 * 60 * 1000);

      console.log(`*************************************************`);
      console.log(`* SMS Gateway Mock                            *`);
      console.log(`* To: ${user.phone}`);
      console.log(`* OTP: ${otp}`);
      console.log(`* This OTP is valid for 5 minutes.`);
      console.log(`*************************************************`);
    }

    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      success: true,
      message: `If an account with that ${isEmail ? 'email' : 'phone'} exists, instructions to reset your password have been sent.`,
    });
  } catch (err: any) {
    console.error(err);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.phoneOtp = undefined;
    user.phoneOtpExpires = undefined;
    await user.save({ validateBeforeSave: false });

    res.status(500).json({ message: 'There was an error processing your request.' });
  }
};

export const resetPasswordWithToken = async (req: AuthRequest, res: Response): Promise<void> => {
  const resetPasswordToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

  const user = await User.findOne({
    resetPasswordToken,
    resetPasswordExpires: { $gt: new Date() },
  });

  if (!user) {
    res.status(400).json({ success: false, message: 'Invalid or expired token' });
    return;
  }

  user.password = req.body.password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;

  await user.save();

  res.status(200).json({
    success: true,
    message: 'Password has been reset successfully.',
  });
};

export const resetPasswordWithOTP = async (req: AuthRequest, res: Response): Promise<void> => {
  const { phone, otp, password } = req.body;

  if (!phone || !otp || !password) {
    res.status(400).json({ success: false, message: 'Phone, OTP, and new password are required.' });
    return;
  }

  const user = await User.findOne({
    phone: phone,
    phoneOtp: otp,
    phoneOtpExpires: { $gt: new Date() },
  });

  if (!user) {
    res.status(400).json({ success: false, message: 'Invalid or expired OTP.' });
    return;
  }

  user.password = password;
  user.phoneOtp = undefined;
  user.phoneOtpExpires = undefined;

  await user.save();

  res.status(200).json({
    success: true,
    message: 'Password has been reset successfully.',
  });
};

