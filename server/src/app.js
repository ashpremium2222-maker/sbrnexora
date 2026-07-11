import "dotenv/config";
import fs from "node:fs";
import cors from "cors";
import express from "express";
import mongoose from "mongoose";
import authRoutes from "./routes/auth.js";
import resourceRoutes from "./routes/resources.js";
import workflowRoutes from "./routes/workflows.js";
import { authenticate } from "./middleware/auth.js";
import { errorHandler, notFound } from "./middleware/errors.js";

const app = express();
const port = process.env.PORT || 4000;
const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/truck_business";

fs.mkdirSync("server/uploads", { recursive: true });

const allowedOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Origin not allowed by CORS"));
  },
}));
app.use(express.json({ limit: "1mb" }));
app.use("/uploads", express.static("server/uploads"));

app.get("/api/health", (req, res) => res.json({ ok: true, service: "truck-business-api" }));
app.use("/api/auth", authRoutes);
app.use("/api", authenticate, workflowRoutes);
app.use("/api", authenticate, resourceRoutes);
app.use(notFound);
app.use(errorHandler);

export async function start() {
  await mongoose.connect(mongoUri);
  console.log("MongoDB connected");
  app.listen(port, () => console.log(`API listening on http://localhost:${port}`));
}

if (process.argv[1]?.endsWith("app.js")) {
  start().catch((err) => {
    console.error("API failed to start", err.message);
    process.exit(1);
  });
}

export default app;
