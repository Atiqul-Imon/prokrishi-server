import mongoose, { Schema, Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import { IUser, IAddress } from '../types/index.js';

const addressSchema = new Schema<IAddress>({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  division: { type: String, required: false },
  district: { type: String, required: false },
  upazila: { type: String, required: false },
  postalCode: { type: String, required: false },
  address: { type: String, required: true },
});

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
      lowercase: true,
    },
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    role: {
      type: String,
      enum: ['user', 'admin', 'super_admin'],
      default: 'user',
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    addresses: [addressSchema],
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    phoneOtp: String,
    phoneOtpExpires: Date,
  },
  {
    timestamps: true,
  }
);

// Password hashing middleware
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Password compare method
userSchema.methods.matchPassword = async function (enteredPassword: string): Promise<boolean> {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User: Model<IUser> = mongoose.model<IUser>('User', userSchema);
export default User;

