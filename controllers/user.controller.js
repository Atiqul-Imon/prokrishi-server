import User from "../models/user.model.js";
import generateAccessToken from "../utils/generateAccessToken.js";
import generateRefreshToken from "../utils/generateRefreshToken.js";

export const registerUser = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        message: "User already exists with this email",
        error: true,
        success: false,
      });
    }

    // Create new user
    const newUser = await User.create({ name, email, phone, password });

    // Generate tokens
    const accessToken = await generateAccessToken(newUser._id);
    const refreshToken = await generateRefreshToken(newUser._id);

    // Respond with user info (excluding password)
    const { password: _, ...userData } = newUser._doc;

    res.status(201).json({
      message: "User registered successfully",
      user: userData, // includes .role
      accessToken,
      refreshToken,
      success: true,
    });
  } catch (error) {
    console.error("Register error:", error.message);
    res.status(500).json({
      message: "Server error while registering user",
      error: true,
      success: false,
    });
  }
};

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password",
        error: true,
        success: false,
      });
    }

    // Check password match
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid email or password",
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
      user: userData, // includes .role
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
    // The authenticate middleware sets req.user.id or req.user._id
    const userId = req.user?.id || req.user?._id;

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized: User ID missing",
        success: false,
        error: true,
      });
    }

    const user = await User.findById(userId).select("-password");

    if (!user) {
      return res.status(404).json({
        message: "User not found",
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


export const updateUserProfileAddresses = async (req, res) => {
  try {
    // The authenticate middleware sets req.user.id or req.user._id
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized: User ID missing",
        success: false,
        error: true,
      });
    }

    const { addresses } = req.body;
    if (!Array.isArray(addresses)) {
      return res.status(400).json({
        message: "Addresses should be an array",
        success: false,
        error: true,
      });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { addresses },
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
      message: "Addresses updated successfully",
      user,
      success: true,
    });
  } catch (error) {
    console.error("Update Profile Addresses Error:", error.message);
    res.status(500).json({
      message: "Server error while updating addresses",
      error: true,
      success: false,
    });
  }
};