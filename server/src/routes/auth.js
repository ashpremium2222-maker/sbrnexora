import express from "express";
import bcrypt from "bcryptjs";
import { User } from "../models/index.js";
import { signToken } from "../middleware/auth.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

router.post("/login", async (req, res) => {
  const { email, phone, password } = req.body;
  const user = await User.findOne(email ? { email: email.toLowerCase() } : { phone });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  res.json({ token: signToken(user), user: { id: user._id, name: user.name, role: user.role, email: user.email, phone: user.phone } });
});

router.post("/register", authenticate, authorize("admin"), async (req, res) => {
  const { name, email, phone, password, role } = req.body;
  if (!name || !password || (!email && !phone)) {
    return res.status(400).json({ error: "name, password, and email or phone are required" });
  }
  const existing = await User.findOne(email ? { email: email.toLowerCase() } : { phone });
  if (existing) return res.status(409).json({ error: "A user with this email/phone already exists" });
  const user = await User.create({
    name,
    email,
    phone,
    passwordHash: await bcrypt.hash(password, 10),
    role: role || "driver",
  });
  res.status(201).json({ id: user._id, name: user.name, email: user.email, role: user.role });
});

router.get("/users", authenticate, authorize("admin"), async (req, res) => {
  const users = await User.find().select("-passwordHash");
  res.json(users);
});

export default router;
