import User from "../models/user.model.js";
import generateAccessToken from "../utils/generateAccessToken.js";
import generateRefreshToken from "../utils/generateRefreshToken.js";
import crypto from 'crypto';
import sendEmail from '../utils/sendEmail.js';
import Product from "../models/product.model.js";
import Order from "../models/order.model.js";
import asyncHandler from 'express-async-handler';

export const registerUser = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    // Validate required fields
    if (!phone || !name || !password) {
      return res.status(400).json({
        message: "Name, phone number, and password are required",
        error: true,
        success: false,
      });
    }

    // Check if phone already exists (phone is now the primary unique identifier)
    const existingPhone = await User.findOne({ phone });
    if (existingPhone) {
      return res.status(400).json({
        message: "User already exists with this phone number",
        error: true,
        success: false,
      });
    }

    // Check if email already exists (if email is provided)
    if (email) {
      const existingEmail = await User.findOne({ email });
      if (existingEmail) {
        return res.status(400).json({
          message: "User already exists with this email",
          error: true,
          success: false,
        });
      }
    }

    // Create new user (email can be undefined/null if not provided)
    const newUser = await User.create({ 
      name, 
      email: email || undefined, // Set to undefined if empty
      phone, 
      password 
    });

    // Generate tokens
    const accessToken = await generateAccessToken(newUser._id);
    const refreshToken = await generateRefreshToken(newUser._id);

    // Respond with user info (excluding password)
    const { password: _, ...userData } = newUser._doc;

    res.status(201).json({
      message: "User registered successfully",
      user: userData,
      accessToken,
      refreshToken,
      success: true,
    });
  } catch (error) {
    console.error("Register error:", error.message);
    res.status(500).json({
      message: error.message || "Server error while registering user",
      error: true,
      success: false,
    });
  }
};

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email/Phone and password are required",
        error: true,
        success: false,
      });
    }

    // Find user by email OR phone (support both login methods)
    const user = await User.findOne({
      $or: [
        { email: email },
        { phone: email } // Allow login with phone in email field
      ]
    });

    if (!user) {
      return res.status(401).json({
        message: "Invalid credentials",
        error: true,
        success: false,
      });
    }

    // Check password match
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid credentials",
        error: true,
        success: false,
      });
    }

    // Generate tokens
    const accessToken = await generateAccessToken(user._id);
    const refreshToken = await generateRefreshToken(user._id);

    // Send response (omit password)
    const { password: _, ...userData } = user._doc;

    res.status(200).json({
      message: "Login successful",
      user: userData,
      accessToken,
      refreshToken,
      success: true,
    });
  } catch (error) {
    console.error("Login error:", error.message);
    res.status(500).json({
      message: "Server error during login",
      error: true,
      success: false,
    });
  }
};

export const getUserProfile = async (req, res) => {
  try {
    // The user object is attached by the 'authenticate' middleware.
    // We just need to send it back.
    const user = req.user;

    if (!user) {
      // This case should ideally be caught by the middleware, but as a safeguard:
      return res.status(401).json({
        message: "Unauthorized: No user found",
        success: false,
        error: true,
      });
    }

    res.status(200).json({
      message: "User profile fetched successfully",
      user,
      success: true,
    });
  } catch (error) {
    console.error("Get Profile Error:", error.message);
    res.status(500).json({
      message: "Server error while fetching user profile",
      error: true,
      success: false,
    });
  }
};

// @desc    Get all users
// @route   GET /api/user
// @access  Private/Admin
export const getAllUsers = async (req, res) => {
  try {
    const { search, page = 1, limit = 10 } = req.query;

    // Build the query
    const query = {};
    if (search) {
      query.name = { $regex: search, $options: "i" }; // Case-insensitive search
    }

    // Get total number of users for pagination
    const totalUsers = await User.countDocuments(query);

    const users = await User.find(query)
      .select("-password")
      .sort({ createdAt: -1 }) // Sort by latest
      .limit(parseInt(limit))
      .skip((page - 1) * parseInt(limit))
      .lean();

    res.status(200).json({
      message: "All users fetched successfully",
      data: users,
      pagination: {
        total: totalUsers,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalUsers / limit),
      },
      success: true,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error while fetching all users",
      error: true,
      success: false,
    });
  }
};

// @desc    Get user by ID
// @route   GET /api/user/:id
// @access  Private/Admin
export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (user) {
      res.status(200).json({
        message: "User fetched successfully",
        user,
        success: true,
      });
    } else {
      res.status(404).json({ message: "User not found", success: false, error: true });
    }
  } catch (error) {
    res.status(500).json({
      message: "Server error while fetching user",
      error: true,
      success: false,
    });
  }
};

// @desc    Update user role
// @route   PATCH /api/user/:id/role
// @access  Private/Admin
export const updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    
    // Validate role
    const validRoles = ["user", "admin", "super_admin"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        message: "Invalid role. Must be one of: user, admin, super_admin",
        success: false,
        error: true,
      });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true, runValidators: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({
        message: "User not found",
        success: false,
        error: true,
      });
    }

    res.status(200).json({
      message: "User role updated successfully",
      user,
      success: true,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error while updating user role",
      error: true,
      success: false,
    });
  }
};

// @desc    Add a new address to user profile
// @route   POST /api/user/profile/addresses
// @access  Private
export const addAddress = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $push: { addresses: req.body } },
      { new: true, runValidators: true }
    ).lean();

    if (updatedUser) {
        const newAddress = updatedUser.addresses[updatedUser.addresses.length - 1];
        res.status(201).json(newAddress);
    } else {
        res.status(404).json({ message: "User not found" });
    }
  } catch (error) {
    console.warn("Add Address Error:", error);
    res.status(400).json({ message: error.message || "Error adding address" });
  }
};

// @desc    Update a specific address
// @route   PUT /api/user/profile/addresses/:addressId
// @access  Private
export const updateAddress = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { addressId } = req.params;
    const newAddressData = req.body;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const addressIndex = user.addresses.findIndex(addr => addr._id.toString() === addressId);

    if (addressIndex === -1) {
      return res.status(404).json({ message: "Address not found" });
    }
    
    // Create the update object for MongoDB
    const update = {};
    for (const key in newAddressData) {
        update[`addresses.${addressIndex}.${key}`] = newAddressData[key];
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: update },
      { new: true, runValidators: true }
    );
    
    res.status(200).json(updatedUser.addresses);

  } catch (error) {
    res.status(400).json({ message: error.message || "Error updating address" });
  }
};

// @desc    Delete a specific address
// @route   DELETE /api/user/profile/addresses/:addressId
// @access  Private
export const deleteAddress = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { addressId } = req.params;

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
  } catch (error) {
      res.status(500).json({ message: 'Error deleting address' });
  }
};

// @desc    Update user profile (name, email)
// @route   PUT /api/user/profile
// @access  Private
export const updateUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (user) {
      user.name = req.body.name || user.name;
      user.email = req.body.email || user.email;

      // Note: This does not update the password. A separate route is recommended for that.

      const updatedUser = await user.save();

      // Respond with the updated user data, excluding the password
      const { password, ...userData } = updatedUser._doc;

      res.status(200).json({
        message: "Profile updated successfully",
        user: userData,
        success: true,
      });
    } else {
      res.status(404).json({ message: "User not found", success: false, error: true });
    }
  } catch (error) {
    res.status(500).json({
      message: "Server error while updating profile",
      error: true,
      success: false,
    });
  }
};

// @desc    Request password reset (via email or phone)
// @route   POST /api/user/forgot-password
// @access  Public
export const forgotPassword = async (req, res) => {
  const { identifier } = req.body; // Can be email or phone

  if (!identifier) {
    return res.status(400).json({ message: 'Email or phone number is required' });
  }

  const isEmail = identifier.includes('@');
  const user = await User.findOne(isEmail ? { email: identifier } : { phone: identifier });

  if (!user) {
    // We don't want to reveal if a user exists or not for security reasons
    return res.status(200).json({ message: 'If an account with that identifier exists, a reset link or OTP has been sent.' });
  }

  try {
    if (isEmail) {
      // Email-based reset
      const resetToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

      user.resetPasswordToken = hashedToken;
      user.resetPasswordExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

      const resetUrl = `${process.env.FRONTEND_URL}/reset-password/email/${resetToken}`;
      const message = `You are receiving this email because you (or someone else) has requested the reset of a password. Please make a PUT request to: \n\n ${resetUrl}`;

      await sendEmail({
        email: user.email,
        subject: 'Password Reset Token',
        message,
        // You can create a nice HTML template for this email later
      });
    } else {
      // Phone-based reset
      const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
      user.phoneOtp = otp;
      user.phoneOtpExpires = Date.now() + 5 * 60 * 1000; // 5 minutes

      // --- SMS Sending Placeholder ---
      // In production, you would use a service like Twilio or a local Bangladeshi provider.
      console.log(`*************************************************`);
      console.log(`* SMS Gateway Mock                            *`);
      console.log(`* To: ${user.phone}`);
      console.log(`* OTP: ${otp}`);
      console.log(`* This OTP is valid for 5 minutes.`);
      console.log(`*************************************************`);
      // --- End of SMS Sending Placeholder ---
    }
    
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      success: true,
      message: `If an account with that ${isEmail ? 'email' : 'phone'} exists, instructions to reset your password have been sent.`,
    });
  } catch (err) {
    console.error(err);
    // Clear the tokens if saving fails to allow the user to try again
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.phoneOtp = undefined;
    user.phoneOtpExpires = undefined;
    await user.save({ validateBeforeSave: false });

    res.status(500).json({ message: 'There was an error processing your request.' });
  }
};

// @desc    Reset password with email token
// @route   POST /api/user/reset-password-email/:token
// @access  Public
export const resetPasswordWithToken = async (req, res) => {
  // Get hashed token
  const resetPasswordToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  const user = await User.findOne({
    resetPasswordToken,
    resetPasswordExpires: { $gt: Date.now() },
  });

  if (!user) {
    return res.status(400).json({ success: false, message: 'Invalid or expired token' });
  }

  // Set new password
  user.password = req.body.password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  
  await user.save();

  res.status(200).json({
    success: true,
    message: 'Password has been reset successfully.',
  });
};

// @desc    Reset password with phone OTP
// @route   POST /api/user/reset-password-phone
// @access  Public
export const resetPasswordWithOTP = async (req, res) => {
    const { phone, otp, password } = req.body;

    if (!phone || !otp || !password) {
        return res.status(400).json({ success: false, message: 'Phone, OTP, and new password are required.' });
    }

    const user = await User.findOne({
        phone: phone,
        phoneOtp: otp,
        phoneOtpExpires: { $gt: Date.now() },
    });

    if (!user) {
        return res.status(400).json({ success: false, message: 'Invalid or expired OTP.' });
    }

    // Set new password and clear OTP fields
    user.password = password;
    user.phoneOtp = undefined;
    user.phoneOtpExpires = undefined;

    await user.save();

    res.status(200).json({
        success: true,
        message: 'Password has been reset successfully.',
    });
};