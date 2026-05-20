import express from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import { GoogleGenAI } from "@google/genai";

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
  const PORT = Number(process.env.PORT) || 3000;

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
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
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
    if (!fs.existsSync(pdfPath)) return res.status(404).json({ error: "PDF non trovato. Carica prima il calendario venatorio." });
    
    const client = getAiClient();
    if (!client) return res.status(500).json({ error: "AI not configured" });

    try {
      const dataBuffer = fs.readFileSync(pdfPath);
      const geminiResponse = await client.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            { inlineData: { data: dataBuffer.toString("base64"), mimeType: "application/pdf" } },
            { text: "Analizza il calendario venatorio allegato ed estrai i limiti di carniere (giornaliero e stagionale) per ogni specie cacciabile, il periodo di caccia e eventuali note. Restituisci una lista di oggetti JSON." }
          ]
        },
        config: {
          systemInstruction: "Sei un assistente esperto in normativa venatoria italiana. Estrai i dati con precisione. Se un limite non è specificato, usa 0. Il campo 'species' deve essere il nome comune dell'animale (es. 'Allodola', non 'Allodola (Alauda arvensis)'). Non duplicare le specie nel report finale. Il campo 'huntingPeriod' deve indicare l'intervallo di date includendo l'anno se presente nel testo (es. '01/09/2024 - 31/01/2025').",
          responseMimeType: "application/json",
          responseSchema: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                species: { type: "STRING" },
                dailyLimit: { type: "NUMBER" },
                seasonalLimit: { type: "NUMBER" },
                huntingPeriod: { type: "STRING" },
                notes: { type: "STRING" }
              },
              required: ["species", "dailyLimit", "seasonalLimit"]
            }
          }
        }
      });
      
      const text = geminiResponse.text;
      if (!text) throw new Error("Empty response from AI");
      
      res.json(JSON.parse(text));
    } catch (error: any) {
      console.error("PDF Analysis failed:", error);
      res.status(500).json({ error: `Analisi PDF fallita: ${error.message}` });
    }
  });

  app.post("/api/admin/extract-hunting-times", async (req, res) => {
    const pdfPath = path.join(process.cwd(), 'public', 'regulation.pdf');
    if (!fs.existsSync(pdfPath)) return res.status(404).json({ error: "PDF non trovato. Carica prima il calendario venatorio." });
    
    const client = getAiClient();
    if (!client) return res.status(500).json({ error: "AI not configured" });

    const { seasonStart, seasonEnd } = req.body;

    try {
      const dataBuffer = fs.readFileSync(pdfPath);
      const geminiResponse = await client.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            { inlineData: { data: dataBuffer.toString("base64"), mimeType: "application/pdf" } },
            { text: `Analizza l'allegato ed estrai gli orari della giornata venatoria (periodi di date e orario di inizio / fine caccia).
Gli orari cambiano tipicamente di quindicina in quindicina o mese per mese (es. dal 1 settembre al 15 settembre dalle 05:45 alle 19:15, ecc.).
La stagione corrente inizia il ${seasonStart || '2024-09-01'} e termina il ${seasonEnd || '2025-01-31'}. Usa questi anni come riferimento per determinare correttamente le date d'inizio (startDate) e fine (endDate) di ciascun periodo. Ad esempio, se un periodo va dal 1 Gennaio al 15 Gennaio, l'anno sarà quello di fine stagione (es. 2025).` }
          ]
        },
        config: {
          systemInstruction: "Sei un assistente esperto in normativa venatoria italiana. Estrai tutte le fasce orarie e i periodi definiti per la caccia nel laghetto o calendario venatorio con la massima precisione. Assicurati che startDate e endDate siano esclusivamente in formato YYYY-MM-DD. Assicurati che startTime e endTime siano in formato HH:MM.",
          responseMimeType: "application/json",
          responseSchema: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                startDate: { type: "STRING" },
                endDate: { type: "STRING" },
                startTime: { type: "STRING" },
                endTime: { type: "STRING" }
              },
              required: ["startDate", "endDate", "startTime", "endTime"]
            }
          }
        }
      });
      
      const text = geminiResponse.text;
      if (!text) throw new Error("Empty response from AI");
      
      res.json(JSON.parse(text));
    } catch (error: any) {
      console.error("PDF Hunting Times Analysis failed:", error);
      res.status(500).json({ error: `Analisi orari da PDF fallita: ${error.message}` });
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
    const publicPath = path.resolve(process.cwd(), 'public');
    
    // Order matters: public (dynamic uploads) takes precedence, then dist (hashed assets)
    app.use(express.static(publicPath));
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
