import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";

// For ES modules, __dirname is not available — this recreates it:
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(process.cwd, "../public/uploads/images"));
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});

export default storage;
