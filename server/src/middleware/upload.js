import path from "node:path";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL || "", process.env.SUPABASE_SERVICE_ROLE_KEY || "");
const bucket = process.env.SUPABASE_BUCKET || "vehicle-documents";

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [".pdf", ".jpg", ".jpeg", ".png"];
    cb(null, allowed.includes(path.extname(file.originalname).toLowerCase()));
  },
});

export async function uploadToStorage(file) {
  const filePath = `truck-business/${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname).toLowerCase()}`;
  const { error } = await supabase.storage.from(bucket).upload(filePath, file.buffer, { contentType: file.mimetype, upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
  return { fileName: file.originalname, url: data.publicUrl };
}
