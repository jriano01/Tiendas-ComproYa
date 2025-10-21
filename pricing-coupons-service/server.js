// .env raíz
import path from "path"; import { fileURLToPath } from "url"; import dotenv from "dotenv";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

import express from "express"; import cors from "cors"; import morgan from "morgan";
const app = express(); app.use(cors()); app.use(express.json()); app.use(morgan("dev"));

const PRICES = new Map([["SKU-001", 100], ["SKU-002", 50]]);
const COUPONS = { SAVE10: { type: "percent", value: 10, active: true } };

app.get("/api/pricing/price", (req, res) => {
  const p = PRICES.get(req.query.sku);
  if (!p) return res.status(404).json({ ok:false, reason:"no_price" });
  res.json({ ok:true, sku: req.query.sku, price: p });
});

app.post("/api/pricing/coupons/validate", (req, res) => {
  const { code, itemsTotal } = req.body;
  const c = COUPONS[code];
  if (!c || !c.active) return res.json({ valid:false, reason:"invalid" });
  const discount = (itemsTotal * c.value) / 100;
  res.json({ valid:true, discount, final: Math.max(0, itemsTotal - discount) });
});

const PORT = Number(process.env.PRICING_PORT || 4003);
app.listen(PORT, () => console.log(`💰 pricing-coupons-service en :${PORT}`));
