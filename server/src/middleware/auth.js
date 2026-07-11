import jwt from "jsonwebtoken";

const secret = process.env.JWT_SECRET;

if (!secret && process.env.NODE_ENV === "production") {
  throw new Error("JWT_SECRET must be configured in production");
}

export function signToken(user) {
  return jwt.sign({ sub: user._id, role: user.role, name: user.name }, secret || "development-only-secret", { expiresIn: "8h" });
}

export function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Authentication required" });
  try {
    req.user = jwt.verify(token, secret || "development-only-secret");
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) return res.status(403).json({ error: "Insufficient permissions" });
    next();
  };
}
