import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import multer from "multer";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
let pdfParse: any;
try {
  // Try to load as a function first (standard CommonJS behavior)
  const mod = require('pdf-parse');
  if (typeof mod === 'function') {
    pdfParse = mod;
  } else if (mod && typeof mod.default === 'function') {
    pdfParse = mod.default;
  } else if (mod && typeof mod.pdfParse === 'function') {
    pdfParse = mod.pdfParse;
  } else {
    // If it's an object (maybe it's the module itself or pdfjs)
    pdfParse = mod;
  }
} catch (e) {
  console.error("pdf-parse requirement failed:", e);
}
import { GoogleGenAI } from "@google/genai";

// Configure multer for PDF uploads
const pdfStorage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    const publicDir = path.join(process.cwd(), 'public');
    console.log("MULTER: Target directory for PDF:", publicDir);
    try {
      if (!fs.existsSync(publicDir)) {
        console.log("MULTER: Creating directory:", publicDir);
        fs.mkdirSync(publicDir, { recursive: true });
      }
      cb(null, publicDir);
    } catch (err) {
      console.error("MULTER DEST ERROR:", err);
      cb(err as Error, publicDir);
    }
  },
  filename: function (_req, _file, cb) {
    console.log("MULTER: Saving file as regulation.pdf");
    cb(null, 'regulation.pdf'); // Fixed name for easy linking
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

  // Health check for debugging
  app.get("/api/health", (req, res) => {
    const publicDir = path.join(process.cwd(), 'public');
    const pdfPath = path.join(publicDir, 'regulation.pdf');
    res.json({
      status: "ok",
      cwd: process.cwd(),
      node_env: process.env.NODE_ENV,
      publicDir,
      pdfExists: fs.existsSync(pdfPath),
      publicContents: fs.existsSync(publicDir) ? fs.readdirSync(publicDir) : 'not found'
    });
  });

  // Weather Proxy API
  app.get("/api/weather", async (req, res) => {
    const { latitude, longitude } = req.query;
    
    if (!latitude || !longitude) {
      return res.status(400).json({ error: "Latitude and longitude are required" });
    }

    try {
      const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=temperature_2m,precipitation_probability,precipitation,wind_speed_10m,wind_direction_10m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max,wind_direction_10m_dominant,precipitation_probability_max,precipitation_sum&timezone=auto`;
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`Weather API responded with status ${response.status}`);
      }
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Proxy Weather Error:", error);
      res.status(500).json({ error: "Failed to fetch weather data from provider" });
    }
  });

  // AI Proxy API
  app.use(express.json());

  app.post("/api/ai/hunt-prediction", async (req, res) => {
    const { weatherSummary } = req.body;
    
    const client = getAiClient();
    if (!client) {
      console.error("Gemini API key is missing");
      return res.status(500).json({ error: "AI capability not configured (missing API key)" });
    }

    const cacheKey = `hunt_${JSON.stringify(weatherSummary)}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    try {
      const response = await client.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analizza rigorosamente i dati meteo per prevedere la probabilità di successo della caccia alle anatre in Italia.
        
        Dati meteo per i primi 3 giorni disponibili: ${JSON.stringify(weatherSummary)}
        
        La risposta DEVE contenere solo il JSON:
        {
          "prediction": "Sintesi tecnica profonda su meteo e flussi migratori (max 20 parole)",
          "days": [
            {
              "date": "YYYY-MM-DD",
              "probability": 0-100,
              "label": "Ottima / Buona / Discreta / Scarsa / Nulla",
              "reason": "Dettaglio tecnico (es. Picco migratorio + Vento 20km/h NE + Pioggia)",
              "icon": "Lucide icon (Sun, CloudRain, Wind, Cloud)"
            }
          ]
        }`,
        config: {
          systemInstruction: `Analizza rigorosamente i dati meteo e i fattori migratori per la caccia in Italia.
          
          CONTEXTO MIGRATORIO (ISPRA):
          - Agosto/Settembre: Inizio (Marzaiola, Alzavola).
          - Ottobre (PICCO): Massimo flusso (Alzavola, Codone, Mestolone, Fischione).
          - Novembre-Febbraio: Svernamento e ripasso.
          
          CRITERI RIGIDI:
          1. Vento: Nord/Est > 15km/h = BONUS. Vento assente = PENALITÀ.
          2. Stagione: Ottobre ha probabilità base più alta.
          3. Coerenza: Stessi dati = stessa probabilità.
          4. Severità: Non essere generoso.`,
          temperature: 0.1,
          topP: 0.95,
          topK: 40,
          responseMimeType: "application/json",
        }
      });

      const text = response.text;
      if (!text) throw new Error("Empty response from AI");
      const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
      const result = JSON.parse(cleaned);
      setCached(cacheKey, result);
      res.json(result);
    } catch (error: any) {
      console.error("AI Prediction Error:", error);
      let message = "Failed to generate prediction";
      if (error.message?.includes("RESOURCE_EXHAUSTED") || error.status === "RESOURCE_EXHAUSTED" || error.code === 429) {
        message = "Quota AI superata per oggi. Riprova tra un po'.";
      } else if (error.message) {
        message = error.message;
      }
      res.status(500).json({ error: message });
    }
  });

  app.post("/api/ai/recipe-generate", async (req, res) => {
    const { prompt } = req.body;
    
    const client = getAiClient();
    if (!client) {
      console.error("Gemini API key is missing");
      return res.status(500).json({ error: "AI capability not configured (missing API key)" });
    }

    const cacheKey = `recipe_gen_${prompt}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    try {
      const response = await client.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Genera una ricetta completa e professionale in lingua italiana per: "${prompt}".`,
        config: {
          systemInstruction: `Sei uno chef stellato specializzato in selvaggina (cinghiale, anatra, lepre, ecc.).
          Genera una ricetta completa e professionale in lingua italiana.
          
          Le categorie ammesse sono: "Cinghiale", "Anatra", "Beccaccia", "Fagiano", "Lepre", "Altro".
          I tipi di portata ammessi sono: "Antipasto", "Primo", "Secondo", "Altro".
          
          Restituisci un oggetto JSON con questi campi:
          {
            "title": "Titolo della ricetta",
            "description": "Una breve descrizione accattivante",
            "category": "Una delle categorie sopra",
            "courseType": "Uno dei tipi di portata sopra",
            "ingredients": ["ingrediente 1", "ingrediente 2", ...],
            "instructions": "Istruzioni dettagliate passo dopo passo",
            "imageUrl": ""
          }
          REGOLE: Restituisci SOLO il JSON valido.`,
          temperature: 0.7,
          responseMimeType: "application/json",
        }
      });

      const text = response.text;
      if (!text) throw new Error("Empty response from AI");
      const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
      const result = JSON.parse(cleaned);
      setCached(cacheKey, result);
      res.json(result);
    } catch (error: any) {
      console.error("AI Recipe Error:", error);
      let message = "Failed to generate recipe";
      if (error.message?.includes("RESOURCE_EXHAUSTED") || error.status === "RESOURCE_EXHAUSTED" || error.code === 429) {
        message = "Quota AI superata per oggi. Riprova più tardi.";
      } else if (error.message) {
        message = error.message;
      }
      res.status(500).json({ error: message });
    }
  });

  app.post("/api/ai/recipe-search", async (req, res) => {
    const { query, recipes } = req.body;
    
    const client = getAiClient();
    if (!client) {
      console.error("Gemini API key is missing");
      return res.status(500).json({ error: "AI capability not configured (missing API key)" });
    }

    const cacheKey = `recipe_search_${query}_${JSON.stringify(recipes.map((r: any) => r.id))}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    try {
      const response = await client.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Ricerca ricette per la query: "${query}". Ricette disponibili: ${JSON.stringify(recipes)}`,
        config: {
          systemInstruction: `Sei un esperto di cucina di selvaggina. Analizza la query dell'utente e l'elenco di ricette.
          Restituisci ESCLUSIVAMENTE un array JSON di stringhe contenente gli ID delle ricette che meglio corrispondono alla ricerca, ordinati per rilevanza.
          Esempio: ["id1", "id2", ...]
          Se nessuna ricetta è pertinente, restituisci [].`,
          temperature: 0.1,
          responseMimeType: "application/json",
        }
      });

      const text = response.text;
      if (!text) throw new Error("Empty response from AI");
      const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
      const result = JSON.parse(cleaned);
      setCached(cacheKey, result);
      res.json(result);
    } catch (error: any) {
      console.error("AI Search Error:", error);
      let message = "Failed to search recipes";
      if (error.message?.includes("RESOURCE_EXHAUSTED") || error.status === "RESOURCE_EXHAUSTED" || error.code === 429) {
        message = "Quota AI superata per oggi. Riprova tra un po'.";
      } else if (error.message) {
        message = error.message;
      }
      res.status(500).json({ error: message });
    }
  });

  app.get("/api/admin/check-regulation", (req, res) => {
    const pdfPath = path.join(process.cwd(), 'public', 'regulation.pdf');
    if (fs.existsSync(pdfPath)) {
      const stats = fs.statSync(pdfPath);
      res.json({ 
        exists: true, 
        name: 'regulation.pdf', 
        size: stats.size,
        updatedAt: stats.mtime
      });
    } else {
      res.json({ exists: false });
    }
  });

  app.delete("/api/admin/delete-regulation", (req, res) => {
    const pdfPath = path.join(process.cwd(), 'public', 'regulation.pdf');
    if (fs.existsSync(pdfPath)) {
      fs.unlinkSync(pdfPath);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "File not found" });
    }
  });

  app.post("/api/admin/upload-regulation", uploadPdf.single('pdf'), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    console.log("Regulation PDF uploaded successfully");
    res.json({ success: true, path: '/regulation.pdf' });
  });

  app.post("/api/admin/extract-limits", async (req, res) => {
    const publicDir = path.join(process.cwd(), 'public');
    const pdfPath = path.join(publicDir, 'regulation.pdf');
    
    console.log("EXTRACTION: Current Working Directory:", process.cwd());
    console.log("EXTRACTION: Looking for regulation.pdf at:", pdfPath);
    
    if (!fs.existsSync(pdfPath)) {
      console.error("EXTRACTION ERROR: File not found at", pdfPath);
      // List directory contents for debugging
      const files = fs.existsSync(publicDir) ? fs.readdirSync(publicDir) : "Dir not found";
      return res.status(404).json({ 
        error: "Regulation PDF non trovato sul server.",
        details: `Cercato in: ${pdfPath}. Contenuto cartella: ${JSON.stringify(files)}`
      });
    }

    const client = getAiClient();
    if (!client) {
      return res.status(500).json({ error: "AI capability not configured" });
    }

    try {
      const dataBuffer = fs.readFileSync(pdfPath);
      console.log("PDF extraction starting, dataBuffer length:", dataBuffer.length);
      
      let fullText = "";
      let extractionSource = "none";

      // Attempt Local Extraction first (if modulo is available and functional)
      if (typeof pdfParse === 'function') {
        try {
          const data = await pdfParse(dataBuffer);
          fullText = data.text;
          extractionSource = "local";
          console.log("PDF extraction successful via local pdf-parse, text length:", fullText.length);
        } catch (parseError: any) {
          console.warn("Local pdf-parse function call failed:", parseError?.message || parseError);
        }
      }

      // If local failed or wasn't available, jump to Gemini Direct PDF Analysis
      if (!fullText) {
        console.log("Attempting direct Gemini PDF analysis (no local text extracted)");
        try {
          const geminiResponse = await client.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: {
              parts: [
                {
                  inlineData: {
                    data: dataBuffer.toString("base64"),
                    mimeType: "application/pdf"
                  }
                },
                {
                  text: "Estrai integralmente i limiti di carniere (quantità massima prelevabile) e il periodo di caccia per ogni specie dal Calendario Venatorio fornito. Restituisci i dati ESCLUSIVAMENTE in formato JSON come un array di oggetti con i campi: species, dailyLimit (numero), seasonalLimit (numero), huntingPeriod (stringa), notes (stringa)."
                }
              ]
            },
            config: {
              systemInstruction: "Sei un assistente esperto in normativa venatoria italiana. Estrai i limiti di carniere e i periodi di caccia dal PDF. Rispondi SOLO con l'array JSON.",
              responseMimeType: "application/json",
              temperature: 0.1,
            }
          });
          
          const geminiText = geminiResponse.text;
          if (geminiText) {
            const cleaned = geminiText.replace(/```json/g, "").replace(/```/g, "").trim();
            const result = JSON.parse(cleaned);
            console.log("Direct Gemini PDF analysis successful.");
            return res.json(result);
          } else {
            throw new Error("Gemini ha restituito un testo vuoto per l'analisi PDF.");
          }
        } catch (geminiError: any) {
          console.error("Gemini Direct PDF error:", geminiError);
          // If we reach here, we've failed both local and direct Gemini PDF
          throw new Error(`Impossibile estrarre i dati dal PDF: ${geminiError?.message || "Errore AI"}`);
        }
      }

      // If we got here, we have fullText from local extraction, but we still need to structure it with Gemini
      console.log(`Structuring local text (${fullText.length} chars) with Gemini...`);
      const article4Index = fullText.toLowerCase().indexOf("articolo 4");
      const relevantText = article4Index !== -1 ? fullText.substring(article4Index, article4Index + 12000) : fullText.substring(0, 15000);

      const response = await client.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            {
              text: `Analizza il seguente testo del Calendario Venatorio ed estrai i limiti di carniere (quantità massima prelevabile) e il periodo di caccia per specie.
              Focus: "Articolo 4 (Carniere)" e "Articolo 7 (Periodi di caccia)".
              
              Testo: ${relevantText}
              
              Restituisci un array JSON di oggetti con questi campi:
              {
                "species": "Nome della specie",
                "dailyLimit": numero (0 se illimitato),
                "seasonalLimit": numero (0 se nessun limite),
                "huntingPeriod": "Periodo (es. 01/09 - 31/01)",
                "notes": "Note eventuali"
              }`
            }
          ]
        },
        config: {
          systemInstruction: "Sei un assistente legale esperto in normativa venatoria italiana. Estrai dati precisi dal testo fornito. Rispondi SOLO in JSON.",
          responseMimeType: "application/json",
          temperature: 0.1,
        }
      });

      const text = response.text;
      if (!text) throw new Error("Empty response from AI structuring");
      const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
      const result = JSON.parse(cleaned);
      res.json(result);
    } catch (error: any) {
      console.error("PDF Extraction/AI Error:", error);
      if (error.status === "RESOURCE_EXHAUSTED" || error.code === 429) {
        res.status(429).json({ error: "Limite giornaliero API Gemini raggiunto. Riprova domani." });
      } else {
        res.status(500).json({ error: error.message || "Failed to extract limits" });
      }
    }
  });
  
  // Serve static files from public directory (for uploaded PDFs etc)
  const publicDir = path.join(process.cwd(), 'public');
  app.use(express.static(publicDir));

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), "dist");
    
    app.use(express.static(distPath));
    
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
