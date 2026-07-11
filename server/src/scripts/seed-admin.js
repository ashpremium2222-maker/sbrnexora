import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { User } from "../models/index.js";

const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD, MONGODB_URI } = process.env;

if (!ADMIN_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD || !MONGODB_URI) {
  console.error("ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD, and MONGODB_URI are required.");
  process.exit(1);
}

try {
  await mongoose.connect(MONGODB_URI);
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  await User.findOneAndUpdate(
    { email: ADMIN_EMAIL.toLowerCase() },
    { name: ADMIN_NAME, email: ADMIN_EMAIL.toLowerCase(), passwordHash, role: "admin" },
    { upsert: true, new: true, runValidators: true },
  );
  console.log("Admin account is ready.");
} finally {
  await mongoose.disconnect();
}
