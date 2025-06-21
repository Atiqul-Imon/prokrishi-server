import Product from "../models/product.model.js";
import Category from "../models/category.model.js";
import { v2 as cloudinary } from "cloudinary";

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// Helper: Upload to Cloudinary from buffer
const uploadToCloudinary = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "prokrishi_products" },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    stream.end(fileBuffer);
  });
};

// ✅ CREATE PRODUCT
export const createProduct = async (req, res) => {
  try {
    const { name, category, price, stock, status, description } = req.body;
    let imageUrl = "";

    // Validate category
    const existingCategory = await Category.findById(category);
    if (!existingCategory) {
      return res.status(400).json({ message: "Invalid category ID", success: false });
    }

    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file.buffer);
      imageUrl = uploadResult.secure_url;
    } else if (req.body.image) {
      imageUrl = req.body.image;
    }

    const newProduct = await Product.create({
      name,
      category,
      price,
      stock,
      status,
      description,
      image: imageUrl,
    });

    res.status(201).json({
      message: "Product created successfully",
      product: newProduct,
      success: true,
    });
  } catch (error) {
    console.error("Create Product Error:", error.message);
    res.status(500).json({
      message: "Server error while creating product",
      error: true,
      success: false,
    });
  }
};

// ✅ GET ALL PRODUCTS
export const getAllProducts = async (req, res) => {
  try {
    const products = await Product.find()
      .populate("category", "name slug")
      .sort({ createdAt: -1 });

    res.status(200).json({ products, success: true });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching products",
      error: true,
      success: false,
    });
  }
};

// ✅ GET SINGLE PRODUCT BY ID
export const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate("category", "name slug");

    if (!product)
      return res.status(404).json({ message: "Product not found", success: false });

    res.status(200).json({ product, success: true });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching product",
      error: true,
      success: false,
    });
  }
};

// ✅ UPDATE PRODUCT
export const updateProduct = async (req, res) => {
  try {
    const { name, category, price, stock, status, description } = req.body;
    let imageUrl = req.body.image;

    // Validate new category if changed
    if (category) {
      const categoryExists = await Category.findById(category);
      if (!categoryExists) {
        return res.status(400).json({ message: "Invalid category ID", success: false });
      }
    }

    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file.buffer);
      imageUrl = uploadResult.secure_url;
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      {
        name,
        category,
        price,
        stock,
        status,
        description,
        image: imageUrl,
      },
      { new: true, runValidators: true }
    ).populate("category", "name slug");

    if (!updatedProduct)
      return res.status(404).json({ message: "Product not found", success: false });

    res.status(200).json({
      message: "Product updated successfully",
      product: updatedProduct,
      success: true,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error updating product",
      error: true,
      success: false,
    });
  }
};

// ✅ DELETE PRODUCT
export const deleteProduct = async (req, res) => {
  try {
    const deleted = await Product.findByIdAndDelete(req.params.id);
    if (!deleted)
      return res.status(404).json({ message: "Product not found", success: false });

    res.status(200).json({
      message: "Product deleted successfully",
      success: true,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error deleting product",
      error: true,
      success: false,
    });
  }
};
