// Resets (or creates) a user's password directly in the database.
// Use this when you're locked out of every login.
//
// Usage (from the project root):
//   npm run reset-password -- admin@fleetos.in newPassword123
//   npm run reset-password -- +919876543210 newPassword123 admin
//
// Args: <email-or-phone> <newPassword> [role]
//   role is only used if the user doesn't exist yet and needs to be created
//   (defaults to "admin"). If the user already exists, their role is left untouched.

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { User } from "../models/index.js";

const args = process.argv.slice(2).filter((a) => !a.startsWith("dotenv_config_path"));
const [identifier, newPassword, role = "admin"] = args;

if (!identifier || !newPassword) {
  console.error("Usage: npm run reset-password -- <email-or-phone> <newPassword> [role]");
  process.exit(1);
}

const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/truck_business";
const isEmail = identifier.includes("@");

async function main() {
  await mongoose.connect(mongoUri);
  console.log(`Connected to ${mongoUri}`);

  const query = isEmail ? { email: identifier.toLowerCase() } : { phone: identifier };
  const passwordHash = await bcrypt.hash(newPassword, 10);
  let user = await User.findOne(query);

  if (user) {
    user.passwordHash = passwordHash;
    await user.save();
    console.log(`Password reset for existing user: ${user.name} (${user.email || user.phone}), role=${user.role}`);
  } else {
    user = await User.create({
      name: "Admin",
      email: isEmail ? identifier.toLowerCase() : undefined,
      phone: isEmail ? undefined : identifier,
      passwordHash,
      role,
    });
    console.log(`Created new user: ${user.name} (${user.email || user.phone}), role=${user.role}`);
  }

  await mongoose.disconnect();
  console.log("Done. You can log in now with the new password.");
}

main().catch((err) => {
  console.error("Failed to reset password:", err.message);
  process.exit(1);
});
