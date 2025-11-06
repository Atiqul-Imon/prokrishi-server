import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/user.model.js";
import connectDB from "../config/connectDB.js";

dotenv.config();

async function createAdmin() {
  try {
    // Connect to database
    await connectDB();

    // Check for existing admins
    const existingAdmins = await User.find({ 
      role: { $in: ["admin", "super_admin"] } 
    }).select("name email phone role");

    console.log("\n📊 Existing Admin Accounts:");
    if (existingAdmins.length === 0) {
      console.log("   No admin accounts found.");
    } else {
      existingAdmins.forEach((admin, index) => {
        console.log(`   ${index + 1}. ${admin.name} (${admin.email || admin.phone}) - Role: ${admin.role}`);
      });
    }

    // Get admin details from environment or use defaults
    const adminName = process.env.ADMIN_NAME || "Admin User";
    const adminEmail = process.env.ADMIN_EMAIL || "admin@prokrishi.com";
    const adminPhone = process.env.ADMIN_PHONE || "01700000000";
    const adminPassword = process.env.ADMIN_PASSWORD || "Admin@123";
    const adminRole = process.env.ADMIN_ROLE || "super_admin";

    // Check if admin with this email or phone already exists
    const existingUser = await User.findOne({
      $or: [
        { email: adminEmail },
        { phone: adminPhone }
      ]
    });

    if (existingUser) {
      if (existingUser.role === "admin" || existingUser.role === "super_admin") {
        console.log(`\n✅ Admin account already exists: ${existingUser.name} (${existingUser.email || existingUser.phone})`);
        console.log(`   Role: ${existingUser.role}`);
        console.log(`\n📝 To update this user to admin, you can manually update the role in MongoDB.`);
      } else {
        // Update existing user to admin
        existingUser.role = adminRole;
        existingUser.isVerified = true;
        if (existingUser.password !== adminPassword) {
          // Hash new password
          const bcrypt = await import("bcryptjs");
          const salt = await bcrypt.default.genSalt(10);
          existingUser.password = await bcrypt.default.hash(adminPassword, salt);
        }
        await existingUser.save();
        console.log(`\n✅ Updated existing user to ${adminRole}:`);
        console.log(`   Name: ${existingUser.name}`);
        console.log(`   Email: ${existingUser.email || "N/A"}`);
        console.log(`   Phone: ${existingUser.phone}`);
        console.log(`   Role: ${existingUser.role}`);
      }
    } else {
      // Create new admin user
      const newAdmin = await User.create({
        name: adminName,
        email: adminEmail,
        phone: adminPhone,
        password: adminPassword,
        role: adminRole,
        isVerified: true,
      });

      console.log(`\n✅ Admin account created successfully!`);
      console.log(`   Name: ${newAdmin.name}`);
      console.log(`   Email: ${newAdmin.email}`);
      console.log(`   Phone: ${newAdmin.phone}`);
      console.log(`   Role: ${newAdmin.role}`);
      console.log(`   Password: ${adminPassword}`);
    }

    console.log(`\n🔐 Login Credentials:`);
    console.log(`   Email/Phone: ${adminEmail} or ${adminPhone}`);
    console.log(`   Password: ${adminPassword}`);
    console.log(`\n🌐 Admin Panel URL: http://localhost:3000/dashboard`);
    console.log(`\n⚠️  Remember to change the default password after first login!`);

    // Close connection
    await mongoose.connection.close();
    console.log("\n✅ Database connection closed.");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error creating admin account:", error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Run the script
createAdmin();

