import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import {
  getProducts,
  createProduct,
  getProductById,
  updateProduct,
  deleteProduct,
} from "../controllers/product.controller.js";

const router = express.Router();

const uploadDir = "uploads";
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, unique + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

router.get("/", getProducts);
router.get("/:id", getProductById);
router.post("/", upload.single("imagen"), createProduct);
router.put("/:id", upload.single("imagen"), updateProduct);
router.delete("/:id", deleteProduct);

export default router;
