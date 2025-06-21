// middlewares/auth.js
import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

// Authentication middleware
export const authenticate = async (req, res, next) => {
  try {
    // Get token from cookie or Authorization header (Bearer)
    const token =
      req.cookies?.accessToken ||
      (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")
        ? req.headers.authorization.split(" ")[1]
        : null);

    if (!token) {
      return res.status(401).json({
        message: "Authentication required",
        error: true,
        success: false,
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.SECRET_KEY_ACCESS_TOKEN);

    // Find user by ID, exclude sensitive fields
    const user = await User.findById(decoded.id)
      .select("-password -addresses")
      .lean();

    if (!user) {
      return res.status(401).json({
        message: "User account not found",
        error: true,
        success: false,
      });
    }

    // Attach user object to request
    req.user = user;
    next();
  } catch (error) {
    console.error("Auth Error:", error.message);
    return res.status(401).json({
      message: "Invalid or expired token",
      error: true,
      success: false,
    });
  }
};

// Authorization middleware for admin roles
export const authorizeAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      message: "Authentication required",
      error: true,
      success: false,
    });
  }

  const allowedRoles = ["admin", "super_admin"];

  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({
      message: "Admin privileges required",
      error: true,
      success: false,
    });
  }

  next();
};
