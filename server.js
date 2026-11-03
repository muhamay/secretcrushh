import "dotenv/config";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { GoogleGenAI } from "@google/genai";

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const API_KEY = process.env.GEMINI_API_KEY;

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"]
    }
  }
}));
app.use(express.json({ limit: "40kb" }));
app.use(express.static("public"));

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Terlalu banyak permintaan. Coba lagi sebentar." }
});

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    app: "XATANIEL AI",
    configured: Boolean(API_KEY)
  });
});

app.post("/api/chat", chatLimiter, async (req, res) => {
  try {
    if (!API_KEY) {
      return res.status(503).json({
        error: "API Gemini belum dikonfigurasi. Tambahkan GEMINI_API_KEY pada environment."
      });
    }

    const message = typeof req.body?.message === "string"
      ? req.body.message.trim()
      : "";

    if (!message || message.length > 4000) {
      return res.status(400).json({
        error: "Pesan wajib diisi dan maksimal 4.000 karakter."
      });
    }

    const incomingHistory = Array.isArray(req.body?.history)
      ? req.body.history.slice(-10)
      : [];

    const contents = [];
    for (const item of incomingHistory) {
      if (!item || !["user", "model"].includes(item.role)) continue;
      if (typeof item.text !== "string") continue;
      const text = item.text.trim().slice(0, 4000);
      if (text) contents.push({ role: item.role, parts: [{ text }] });
    }
    contents.push({ role: "user", parts: [{ text: message }] });

    const ai = new GoogleGenAI({ apiKey: API_KEY });
    const result = await ai.models.generateContent({
      model: MODEL,
      contents,
      config: {
        systemInstruction:
          "Nama kamu adalah XATANIEL AI, asisten AI yang ramah, cerdas, jujur, dan membantu. Jawab dalam bahasa yang digunakan pengguna. Berikan jawaban jelas dan terstruktur. Jika tidak mengetahui sesuatu, katakan dengan jujur. Jangan mengaku memiliki kemampuan atau akses yang sebenarnya tidak dimiliki."
      }
    });

    const answer = (result.text || "").trim();
    if (!answer) {
      return res.status(502).json({ error: "AI belum memberikan jawaban. Silakan coba lagi." });
    }

    res.json({ answer, model: MODEL });
  } catch (error) {
    console.error("Gemini request failed:", error?.message || error);
    res.status(500).json({
      error: "Terjadi gangguan saat menghubungi AI. Periksa konfigurasi API lalu coba lagi."
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`XATANIEL AI berjalan di http://localhost:${PORT}`);
});
