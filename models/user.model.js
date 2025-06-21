import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const addressSchema = new mongoose.Schema({
  name: { type: String, required: true },         // Label like Home, Office
  phone: { type: String, required: true },
  division: { type: String, required: true },
  district: { type: String, required: true },
  upazila: { type: String, required: true },
  address: { type: String, required: true },      // Street address etc.
});

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    phone: { type: String }, // Optional user phone
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
  role: {
  type: String,
  enum: ["user", "admin", "super_admin"],
  default: "user",
},
    isVerified: {
      type: Boolean,
      default: false,
    },
    addresses: [addressSchema],  // <-- Array of addresses
  },
  {
    timestamps: true,
  }
);

// Password hashing middleware
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Password compare method
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model("User", userSchema);
export default User;
