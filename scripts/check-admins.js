import mongoose from "mongoose";
import dotenv from "dotenv";

import User from "../models/user.model.js";

const REQUIRED_ROLES = ["admin", "super_admin"];

async function main() {
  try {
    dotenv.config({ path: process.env.ENV_FILE || ".env" });

    const uri = process.env.MONGODB_URI;

    if (!uri) {
      console.error("❌ MONGODB_URI is not set. Please provide it via environment variable.");
      process.exit(1);
    }

    const dbName = process.env.MONGODB_DB;

    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(uri, dbName ? { dbName } : undefined);

    console.log("✅ Connected. Searching for admin users...\n");

    const admins = await User.find({ role: { $in: REQUIRED_ROLES } })
      .select("name email phone role createdAt")
      .sort({ createdAt: -1 })
      .lean();

    if (!admins.length) {
      console.log("⚠️ No admin users found in the database.");
    } else {
      console.log(`🎯 Found ${admins.length} admin user(s):\n`);
      admins.forEach((admin, index) => {
        console.log(`#${index + 1}`);
        console.log(`  Name : ${admin.name || "N/A"}`);
        console.log(`  Email: ${admin.email || "N/A"}`);
        console.log(`  Phone: ${admin.phone || "N/A"}`);
        console.log(`  Role : ${admin.role}`);
        console.log(`  Joined: ${admin.createdAt ? admin.createdAt.toISOString() : "N/A"}`);
        console.log("-------------------------------------------");
      });
    }
  } catch (error) {
    console.error("❌ Failed to check admin users:", error.message);
  } finally {
    await mongoose.connection.close().catch(() => {});
    process.exit(0);
  }
}

main();
