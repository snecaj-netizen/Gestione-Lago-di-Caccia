import express from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import { GoogleGenAI } from "@google/genai";

console.log("SERVER_STARTING: Initializing...");

// Configure multer for PDF uploads
const pdfStorage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    const publicDir = path.join(process.cwd(), 'public');
    try {
      if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
      }
      cb(null, publicDir);
    } catch (err) {
      cb(err as Error, publicDir);
    }
  },
  filename: function (_req, _file, cb) {
    cb(null, 'regulation.pdf');
  }
});

const uploadPdf = multer({ 
  storage: pdfStorage,
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

// Initialize Gemini client lazily to avoid crashing if key is missing at startup
let aiClientInstance: GoogleGenAI | null = null;

function getAiClient() {
  if (!aiClientInstance) {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      console.warn("GEMINI_API_KEY is not defined in environment variables (or is empty).");
      return null;
    }
    
    // Debug log to help user verify the key (only shows first/last 4 chars)
    const maskedKey = apiKey.length > 8 
      ? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`
      : "****";
    console.log(`Initializing Gemini client with API Key: ${maskedKey} (Length: ${apiKey.length})`);

    aiClientInstance = new GoogleGenAI({ 
      apiKey,
      httpOptions: { headers: { "User-Agent": "aistudio-build" } }
    });
  }
  return aiClientInstance;
}

// Simple in-memory cache
const cache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours for daily predictions

function getCached(key: string) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return null;
}

function setCached(key: string, data: any) {
  cache.set(key, { data, timestamp: Date.now() });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", env: process.env.NODE_ENV });
  });

  app.get("/api/weather", async (req, res) => {
    const { latitude, longitude } = req.query;
    if (latitude === undefined || longitude === undefined) return res.status(400).json({ error: "Missing coords" });

    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=temperature_2m,precipitation_probability,precipitation,wind_speed_10m,wind_direction_10m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max,wind_direction_10m_dominant,precipitation_probability_max,precipitation_sum&timezone=auto`;
      const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!response.ok) throw new Error(`Status ${response.status}`);
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Weather API error:", error);
      res.status(500).json({ error: "Weather API failed" });
    }
  });

  app.post("/api/ai/hunt-prediction", async (req, res) => {
    const { weatherSummary } = req.body;
    const client = getAiClient();
    if (!client) return res.status(500).json({ error: "AI not configured" });

    const cacheKey = `hunt_${JSON.stringify(weatherSummary)}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    try {
      const response = await client.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analizza dati meteo per caccia anatre in Italia: ${JSON.stringify(weatherSummary)}`,
        config: {
          systemInstruction: `Analizza meteo e fattori migratori per la caccia in Italia. Restituisci SOLO JSON.`,
          responseMimeType: "application/json",
        }
      });
      const result = JSON.parse(response.text!.replace(/```json/g, "").replace(/```/g, "").trim());
      setCached(cacheKey, result);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "AI failed" });
    }
  });

  // Admin / Regulation API
  app.get("/api/admin/check-regulation", (req, res) => {
    const pdfPath = path.join(process.cwd(), 'public', 'regulation.pdf');
    res.json({ exists: fs.existsSync(pdfPath) });
  });
  
  app.delete("/api/admin/delete-regulation", (req, res) => {
    const pdfPath = path.join(process.cwd(), 'public', 'regulation.pdf');
    if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
    res.json({ success: true });
  });
  
  app.post("/api/admin/upload-regulation", uploadPdf.single('pdf'), (req, res) => {
    res.json({ success: true });
  });

  app.post("/api/admin/extract-limits", async (req, res) => {
    const pdfPath = path.join(process.cwd(), 'public', 'regulation.pdf');
    if (!fs.existsSync(pdfPath)) return res.status(404).json({ error: "PDF not found" });
    
    const client = getAiClient();
    if (!client) return res.status(500).json({ error: "AI not configured" });

    try {
      const dataBuffer = fs.readFileSync(pdfPath);
      const geminiResponse = await client.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            { inlineData: { data: dataBuffer.toString("base64"), mimeType: "application/pdf" } },
            { text: "Estrai limiti di carniere e periodo di caccia in JSON." }
          ]
        },
        config: {
          systemInstruction: "Sei un esperto di normativa venatoria. Restituisci SOLO JSON.",
          responseMimeType: "application/json",
        }
      });
      res.json(JSON.parse(geminiResponse.text!.replace(/```json/g, "").replace(/```/g, "").trim()));
    } catch (error) {
      res.status(500).json({ error: "PDF Analysis failed" });
    }
  });

  // Serve static files and handle SPA fallback
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    console.log("PRODUCTION: Serving static files from:", distPath);
    console.log("PRODUCTION: Dist exists:", fs.existsSync(distPath));
    console.log("PRODUCTION: Dist contents:", fs.existsSync(distPath) ? fs.readdirSync(distPath) : "n/a");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on port ${PORT}`);
  });
}


startServer().catch((err) => {
  console.error("Critical error starting server:", err);
  process.exit(1);
});
