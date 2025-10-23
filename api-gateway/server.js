// api-gateway/server.js
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import fetch from "node-fetch";
import bcrypt from "bcryptjs";
import { createProxyMiddleware } from "http-proxy-middleware";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Cargar .env (en Retail/.env)
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

const app = express();
app.use(cookieParser());
app.use(express.json());
app.use(cors({ origin: true, credentials: true }));
app.use(morgan("dev"));
app.use(express.static(path.join(__dirname, "public")));

// ===== ENV / Targets =====
const {
  // Auth/seguridad
  JWT_SECRET = "change-me",
  ADMIN_EMAILS = "",

  // Local auth
  LOCAL_AUTH_ENABLED = "false",
  LOCAL_ADMIN_EMAIL,
  LOCAL_ADMIN_PASSWORD_HASH,
  LOCAL_PASSWORD_PLAIN,

  // Google OAuth
  OAUTH_GOOGLE_CLIENT_ID,
  OAUTH_GOOGLE_CLIENT_SECRET,
  OAUTH_GOOGLE_CALLBACK,

  // URLs/puertos microservicios
  CATALOG_URL, INVENTORY_URL, PRICING_URL, CART_URL, PAYMENTS_URL, WALLET_URL,
  CATALOG_PORT, INVENTORY_PORT, PRICING_PORT, CART_PORT, PAYMENTS_PORT, WALLET_PORT,

  // Paths (por si tu catálogo no usa /api/catalog)
  CATALOG_BASE_PATH,               // opcional; si no lo pones se probarán rutas candidatas
  CATALOG_UPLOADS_PATH = "/uploads",

  // Puerto gateway
  PORT, GATEWAY_PORT
} = process.env;

const localUrl = (p, def) => `http://localhost:${Number(p || def)}`;
const S = {
  catalog:  CATALOG_URL   || localUrl(CATALOG_PORT,   4000),
  inventory:INVENTORY_URL || localUrl(INVENTORY_PORT, 4002),
  pricing:  PRICING_URL   || localUrl(PRICING_PORT,   4003),
  cart:     CART_URL      || localUrl(CART_PORT,      4004),
  payments: PAYMENTS_URL  || localUrl(PAYMENTS_PORT,  4005),
  wallet:   WALLET_URL    || localUrl(WALLET_PORT,    4006),
};
console.log("Gateway targets:", S);
console.log("Catalog base paths:", { CATALOG_BASE_PATH, CATALOG_UPLOADS_PATH });

const ADMIN_SET = new Set(ADMIN_EMAILS.split(",").map(s => s.trim().toLowerCase()).filter(Boolean));
const signSession = (payload) => jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });

function readSession(req, _res, next) {
  const token = req.cookies?.session;
  if (!token) return next();
  try { req.user = jwt.verify(token, JWT_SECRET); } catch {}
  next();
}
app.use(readSession);

// ===== Debug / Health =====
app.get("/__ping", (_req, res) => res.json({ ok: true, when: new Date().toISOString() }));
app.get("/__targets", (_req, res) => res.json({ ...S, CATALOG_BASE_PATH: CATALOG_BASE_PATH || "(auto)", CATALOG_UPLOADS_PATH }));

app.get("/auth/debug", (_req, res) => res.json({
  OAUTH_GOOGLE_CLIENT_ID: !!OAUTH_GOOGLE_CLIENT_ID,
  OAUTH_GOOGLE_CALLBACK,
  LOCAL_AUTH_ENABLED,
  LOCAL_ADMIN_EMAIL,
  LOCAL_PASSWORD_PLAIN: !!LOCAL_PASSWORD_PLAIN,
  ADMIN_EMAILS
}));

// ===================== AUTH LOCAL =====================
app.post("/auth/local/login", async (req, res) => {
  try {
    if (String(LOCAL_AUTH_ENABLED).toLowerCase() !== "true")
      return res.status(403).json({ message: "Local auth deshabilitado" });

    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ message: "Faltan credenciales" });
    if (!LOCAL_ADMIN_EMAIL) return res.status(500).json({ message: "LOCAL_ADMIN_EMAIL no configurado" });

    const e = String(email).trim().toLowerCase();
    const expected = LOCAL_ADMIN_EMAIL.trim().toLowerCase();
    if (e !== expected) return res.status(401).json({ message: "Credenciales inválidas (email)" });

    if (LOCAL_PASSWORD_PLAIN) {
      if (password !== LOCAL_PASSWORD_PLAIN)
        return res.status(401).json({ message: "Credenciales inválidas (password)" });
    } else {
      if (!LOCAL_ADMIN_PASSWORD_HASH)
        return res.status(500).json({ message: "LOCAL_ADMIN_PASSWORD_HASH no configurado" });
      const ok = await bcrypt.compare(password, LOCAL_ADMIN_PASSWORD_HASH);
      if (!ok) return res.status(401).json({ message: "Credenciales inválidas (password)" });
    }

    const role = ADMIN_SET.has(e) ? "admin" : "user";
    const sessionJWT = signSession({ sub: `local:${e}`, email: e, name: e, role });
    res.cookie("session", sessionJWT, { httpOnly: true, sameSite: "lax", secure: false, maxAge: 7*24*60*60*1000 });
    res.json({ ok: true, role });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Error en login local" });
  }
});

// ===================== AUTH GOOGLE =====================
app.get("/auth/google", (req, res) => {
  const state = Math.random().toString(36).slice(2);
  res.cookie("oauth_state", state, { httpOnly: true, sameSite: "lax", secure: false, maxAge: 5*60*1000 });

  const params = new URLSearchParams({
    client_id: OAUTH_GOOGLE_CLIENT_ID,
    redirect_uri: OAUTH_GOOGLE_CALLBACK,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "consent",
    state
  });
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  console.log("Google AUTH URL =>", authUrl);
  res.redirect(authUrl);
});

app.get("/auth/google/callback", async (req, res) => {
  try {
    const { code, state } = req.query;
    const savedState = req.cookies?.oauth_state;
    if (!code || !state || !savedState || state !== savedState)
      return res.status(400).send("Estado inválido");
    res.clearCookie("oauth_state");

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: OAUTH_GOOGLE_CLIENT_ID,
        client_secret: OAUTH_GOOGLE_CLIENT_SECRET,
        grant_type: "authorization_code",
        redirect_uri: OAUTH_GOOGLE_CALLBACK,
        code
      })
    });
    if (!tokenRes.ok) {
      const t = await tokenRes.text();
      console.error("Token error:", t);
      return res.status(400).send("No se pudo obtener token (revisa CLIENT_ID/SECRET/redirect)");
    }
    const tokens = await tokenRes.json();
    const uRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });
    if (!uRes.ok) {
      const t = await uRes.text();
      console.error("UserInfo error:", t);
      return res.status(400).send("No se pudo obtener perfil");
    }
    const profile = await uRes.json();
    const email = String(profile.email || "").toLowerCase();
    const role = ADMIN_SET.has(email) ? "admin" : "user";
    const sessionJWT = signSession({ sub: profile.sub, email, name: profile.name, picture: profile.picture, role });
    res.cookie("session", sessionJWT, { httpOnly: true, sameSite: "lax", secure: false, maxAge: 7*24*60*60*1000 });
    res.redirect("/");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error en callback de OAuth");
  }
});

// ===== Sesión / Logout
app.get("/auth/me", (req, res) => {
  if (!req.user) return res.json({ authenticated: false });
  const { email, name, picture, role } = req.user;
  res.json({ authenticated: true, email, name, picture, role });
});
app.post("/auth/logout", (req, res) => {
  res.clearCookie("session");
  res.json({ ok: true });
});

// ===== Frontend estático
const staticDir = path.resolve(__dirname, "../Fronted");
app.use(express.static(staticDir, { fallthrough: true }));
app.get("/", (_req, res) => res.sendFile(path.join(staticDir, "home.html")));

// ===== Protección de escritura en catálogo (solo admin)
function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ message: "No autenticado" });
  if (req.user.role !== "admin") return res.status(403).json({ message: "No autorizado" });
  next();
}
app.use("/api/catalog", (req, res, next) => {
  if (req.method === "GET") return next();
  return requireAdmin(req, res, next);
});

// ============ Catálogo con fallback de rutas (GET) ============
const CATALOG_CANDIDATES = [
  CATALOG_BASE_PATH || "/api/catalog",
  "/catalog",
  "/productos",
  "/api/productos",
  "/items",
  "/api/items",
  "/"
].filter((v, i, a) => v && a.indexOf(v) === i);

async function fetchFirstOk(base, candidates) {
  for (const p of candidates) {
    const url = new URL(p, base).toString();
    try {
      const r = await fetch(url, { timeout: 10000 });
      if (r.ok) {
        const data = await r.json().catch(() => null);
        if (data != null) return { ok: true, path: p, data };
      }
    } catch (_) { /* intenta el siguiente */ }
  }
  return { ok: false };
}

// GET /api/catalog -> intenta varias rutas internas y retorna la primera válida
app.get("/api/catalog", async (_req, res) => {
  try {
    const base = S.catalog.endsWith("/") ? S.catalog : S.catalog + "/";
    const out = await fetchFirstOk(base, CATALOG_CANDIDATES);
    if (!out.ok) return res.status(502).json({ message: "Catálogo no disponible (fallback agotado)" });
    console.log("[catalog-fallback] usando:", out.path);
    res.json(out.data);
  } catch (e) {
    console.error("[catalog-fallback] error:", e?.message);
    res.status(502).json({ message: "Error al obtener catálogo" });
  }
});

// Diagnóstico: ver qué candidatas responden
app.get("/__probe/catalog", async (_req, res) => {
  const base = S.catalog.endsWith("/") ? S.catalog : S.catalog + "/";
  const results = [];
  for (const p of CATALOG_CANDIDATES) {
    const url = new URL(p, base).toString();
    let status = null;
    try {
      const r = await fetch(url, { timeout: 8000 });
      status = r.status;
    } catch {
      status = "ERR";
    }
    results.push({ candidate: p, url, status });
  }
  res.json({ base: S.catalog, candidates: results });
});

// ===== Proxy de imágenes del catálogo (/uploads -> servicio catálogo)
const proxyCommon = {
  changeOrigin: true,
  timeout: 10000,
  proxyTimeout: 10000,
  onError: (err, req, res) => {
    console.error("[proxy error]", req.method, req.url, err?.code || err?.message);
    if (!res.headersSent) res.status(502).json({ message: "Gateway error" });
  },
  onProxyReq: (proxyReq, req) => console.log("[→]", req.method, req.url),
  onProxyRes: (proxyRes, req) => console.log("[←]", proxyRes.statusCode, req.method, req.url),
};

app.use("/uploads",
  createProxyMiddleware({
    target: S.catalog,
    ...proxyCommon,
    pathRewrite: (path) => path.replace(/^\/uploads/, CATALOG_UPLOADS_PATH),
  })
);

// ===== Proxies restantes
app.use("/api/inventory", createProxyMiddleware({ target: S.inventory, ...proxyCommon }));
app.use("/api/pricing",   createProxyMiddleware({ target: S.pricing,   ...proxyCommon }));
app.use("/api/cart",      createProxyMiddleware({ target: S.cart,      ...proxyCommon }));
app.use("/api/payments",  createProxyMiddleware({ target: S.payments,  ...proxyCommon }));
app.use("/api/wallet",    createProxyMiddleware({ target: S.wallet,    ...proxyCommon }));
// ...
app.use("/api/auth",     createProxyMiddleware({ target: `http://localhost:${process.env.AUTH_PORT||4010}`, changeOrigin: true }));
// ...

// ===== Start
const listenPort = Number(PORT || GATEWAY_PORT || 3000);
app.listen(listenPort, () => console.log(`🚪 API Gateway en http://localhost:${listenPort}`));
