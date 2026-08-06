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

import { seedBookingHistoryFromTrips } from "./models/index.js";

// Keep Atlas free-tier cluster alive by pinging every 4 minutes.
// Atlas M0 auto-pauses after ~60 minutes of no traffic; this prevents that.
function startKeepAlivePing() {
  setInterval(async () => {
    try {
      await mongoose.connection.db.command({ ping: 1 });
    } catch {
      // Silently ignore — server will reconnect on next real request
    }
  }, 4 * 60 * 1000); // every 4 minutes
}

export async function start() {
  await mongoose.connect(mongoUri);
  console.log("MongoDB connected");

  // Start listening immediately — don't wait for seed to finish
  app.listen(port, () => console.log(`API listening on http://localhost:${port}`));

  // Run seed in background so it never delays startup or login
  seedBookingHistoryFromTrips().catch(console.error);

  // Keep Atlas connection warm to avoid cold-start delays on login
  startKeepAlivePing();
}

if (process.argv[1]?.endsWith("app.js")) {
  start().catch((err) => {
    console.error("API failed to start", err.message);
    process.exit(1);
  });
}

export default app;
