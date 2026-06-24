import express from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
dotenv.config();

// Start of Firebase Server Initialization via REST API
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY;
const FIREBASE_DATABASE_ID = process.env.FIREBASE_FIRESTORE_DATABASE_ID || process.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || '(default)';
const isFirebaseConfigured = !!FIREBASE_PROJECT_ID && !!FIREBASE_API_KEY;

if (isFirebaseConfigured) {
  console.log("[Firebase Server REST] Configurato con successo con Project ID:", FIREBASE_PROJECT_ID, "e Database ID:", FIREBASE_DATABASE_ID);
} else {
  console.warn("[Firebase Server REST] Credenziali mancanti in env. Il PDF non sarà salvato su Firestore.");
}

async function restGetDoc(collection: string, docId: string) {
  if (!isFirebaseConfigured) return null;
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/${FIREBASE_DATABASE_ID}/documents/${collection}/${docId}?key=${FIREBASE_API_KEY}`;
  const res = await fetch(url);
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firestore REST GET error: ${res.status} - ${text}`);
  }
  
  const responseJson = await res.json();
  const result: Record<string, any> = {};
  if (responseJson.fields) {
    for (const [key, valObj] of Object.entries(responseJson.fields) as any) {
      if (valObj.stringValue !== undefined) {
        result[key] = valObj.stringValue;
      } else if (valObj.doubleValue !== undefined) {
        result[key] = Number(valObj.doubleValue);
      } else if (valObj.integerValue !== undefined) {
        result[key] = parseInt(valObj.integerValue, 10);
      } else if (valObj.booleanValue !== undefined) {
        result[key] = valObj.booleanValue;
      } else if (valObj.nullValue !== undefined) {
        result[key] = null;
      }
    }
  }
  return result;
}

async function restSetDoc(collection: string, docId: string, fields: Record<string, any>) {
  if (!isFirebaseConfigured) return null;
  
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/${FIREBASE_DATABASE_ID}/documents/${collection}/${docId}?key=${FIREBASE_API_KEY}`;
  
  const firestoreFields: Record<string, any> = {};
  for (const [key, val] of Object.entries(fields)) {
    if (typeof val === 'number') {
      firestoreFields[key] = { doubleValue: val };
    } else if (typeof val === 'boolean') {
      firestoreFields[key] = { booleanValue: val };
    } else if (val === null || val === undefined) {
      firestoreFields[key] = { nullValue: null };
    } else {
      firestoreFields[key] = { stringValue: String(val) };
    }
  }

  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: firestoreFields })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firestore REST PATCH error: ${res.status} - ${text}`);
  }
  return await res.json();
}

async function restDeleteDoc(collection: string, docId: string) {
  if (!isFirebaseConfigured) return;
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/${FIREBASE_DATABASE_ID}/documents/${collection}/${docId}?key=${FIREBASE_API_KEY}`;
  const res = await fetch(url, {
    method: 'DELETE'
  });
  if (res.status === 404) return;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firestore REST DELETE error: ${res.status} - ${text}`);
  }
}

async function savePdfToFirestore(pdfPath: string) {
  if (!isFirebaseConfigured) {
    console.warn("[Firebase Server REST] Impossibile salvare su Firestore: credenziali non configurate.");
    return;
  }
  try {
    const dataBuffer = fs.readFileSync(pdfPath);
    const base64Str = dataBuffer.toString("base64");
    
    // Chunk size: 800 KB (819200 characters) - safest limit under 1MB
    const chunkSize = 800 * 1024;
    const chunks: string[] = [];
    for (let i = 0; i < base64Str.length; i += chunkSize) {
      chunks.push(base64Str.substring(i, i + chunkSize));
    }

    console.log(`[Firebase Server REST] Salvo PDF in ${chunks.length} frammenti su Firestore...`);

    // Write chunk documents under the permitted 'settings' collection
    for (let i = 0; i < chunks.length; i++) {
      await restSetDoc('settings', `regulation_pdf_chunk_${i}`, {
        index: i,
        data: chunks[i]
      });
    }

    // Write metadata under the permitted 'settings' collection
    await restSetDoc('settings', 'regulation_pdf_metadata', {
      totalChunks: chunks.length,
      size: dataBuffer.length,
      filename: 'regulation.pdf',
      updatedAt: new Date().toISOString()
    });

    // Clean up any old leftover chunks if the new PDF is smaller than the previous one
    for (let i = chunks.length; i < 100; i++) {
      try {
        await restDeleteDoc('settings', `regulation_pdf_chunk_${i}`);
      } catch (e) {
        break;
      }
    }
    console.log("[Firebase Server REST] PDF salvato correttamente su Firestore.");
  } catch (error) {
    console.error("[Firebase Server REST] Errore salvataggio PDF su Firestore:", error);
    throw error;
  }
}

async function restorePdfFromFirestore(pdfPath: string): Promise<boolean> {
  if (!isFirebaseConfigured) {
    console.warn("[Firebase Server REST] Impossibile ripristinare: credenziali non configurate.");
    return false;
  }
  try {
    const meta = await restGetDoc('settings', 'regulation_pdf_metadata');
    if (!meta) {
      console.log("[Firebase Server REST] Nessun PDF di regolamento trovato su Firestore.");
      return false;
    }
    const totalChunks = meta.totalChunks || 0;
    if (totalChunks === 0) return false;

    console.log(`[Firebase Server REST] Ripristino PDF da Firestore (${totalChunks} frammenti)...`);
    
    let base64Full = "";
    for (let i = 0; i < totalChunks; i++) {
      const chunkDoc = await restGetDoc('settings', `regulation_pdf_chunk_${i}`);
      if (!chunkDoc) {
        throw new Error(`Frammento regulation_pdf_chunk_${i} mancante su Firestore!`);
      }
      base64Full += chunkDoc.data || "";
    }

    const pdfBuffer = Buffer.from(base64Full, 'base64');
    
    // Ensure parent directory exists
    const dir = path.dirname(pdfPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(pdfPath, pdfBuffer);
    console.log(`[Firebase Server REST] PDF di regolamento ripristinato in: ${pdfPath}`);
    return true;
  } catch (error) {
    console.error("[Firebase Server REST] Errore durante il ripristino del PDF:", error);
    return false;
  }
}

async function deletePdfFromFirestore() {
  if (!isFirebaseConfigured) return;
  try {
    for (let i = 0; i < 100; i++) {
      try {
        await restDeleteDoc('settings', `regulation_pdf_chunk_${i}`);
      } catch (e) {
        break;
      }
    }
    await restDeleteDoc('settings', 'regulation_pdf_metadata');
    console.log("[Firebase Server REST] PDF e metadati rimossi da Firestore.");
  } catch (err) {
    console.error("[Firebase Server REST] Errore rimozione PDF da Firestore:", err);
  }
}

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

// Persistent filesystem cache for hunting predictions
const CACHE_FILE = path.join(process.cwd(), 'predictions_cache.json');
let cache = new Map<string, { data: any, timestamp: number }>();

try {
  if (fs.existsSync(CACHE_FILE)) {
    const raw = fs.readFileSync(CACHE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    cache = new Map(Object.entries(parsed));
    console.log(`[Cache System] Cache di previsione caricato con successo da disco: ${cache.size} elementi.`);
  }
} catch (err) {
  console.error("[Cache System] Errore nel caricamento del file di cache delle previsioni:", err);
}

function saveCacheToDisk() {
  try {
    const obj = Object.fromEntries(cache.entries());
    fs.writeFileSync(CACHE_FILE, JSON.stringify(obj, null, 2), 'utf8');
  } catch (err) {
    console.error("[Cache System] Errore nel salvataggio della cache delle previsioni su disco:", err);
  }
}

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
  saveCacheToDisk();
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // Auto-restore PDF from Firestore if it is missing on disk
  const bootPdfPath = path.join(process.cwd(), 'public', 'regulation.pdf');
  if (!fs.existsSync(bootPdfPath)) {
    console.log("[Boot] PDF di regolamento non trovato su disco. Verifico ripristino da Firestore...");
    restorePdfFromFirestore(bootPdfPath).then((restored) => {
      if (restored) {
        console.log("[Boot] PDF ripristinato con successo da Firestore.");
      } else {
        console.log("[Boot] Nessun PDF di regolamento è presente su Firestore.");
      }
    }).catch(err => {
      console.error("[Boot] Errore durante il tentativo di ripristino del PDF:", err);
    });
  } else {
    console.log("[Boot] PDF di regolamento già presente su disco.");
  }

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
  app.get("/api/regulation/download", async (req, res) => {
    const pdfPath = path.join(process.cwd(), 'public', 'regulation.pdf');
    let exists = fs.existsSync(pdfPath);
    if (!exists) {
      exists = await restorePdfFromFirestore(pdfPath);
    }
    if (!exists) {
      return res.status(404).send("File non trovato. Carica prima il calendario venatorio.");
    }
    res.download(pdfPath, "regulation.pdf");
  });

  app.get("/api/admin/check-regulation", async (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    const pdfPath = path.join(process.cwd(), 'public', 'regulation.pdf');
    let exists = fs.existsSync(pdfPath);
    if (!exists) {
      exists = await restorePdfFromFirestore(pdfPath);
    }
    const size = exists ? fs.statSync(pdfPath).size : 0;
    res.json({ exists, name: 'regulation.pdf', size });
  });
  
  app.delete("/api/admin/delete-regulation", async (req, res) => {
    const pdfPath = path.join(process.cwd(), 'public', 'regulation.pdf');
    if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
    await deletePdfFromFirestore();
    res.json({ success: true });
  });
  
  app.post("/api/admin/upload-regulation", uploadPdf.single('pdf'), async (req, res) => {
    try {
      const pdfPath = path.join(process.cwd(), 'public', 'regulation.pdf');
      if (fs.existsSync(pdfPath)) {
        await savePdfToFirestore(pdfPath);
      }
      res.json({ success: true });
    } catch (err: any) {
      console.error("Errore salvataggio PDF su Firestore:", err);
      res.status(500).json({ error: `Caricamento fallito nel backup cloud: ${err.message}` });
    }
  });

  app.post("/api/admin/extract-limits", async (req, res) => {
    const pdfPath = path.join(process.cwd(), 'public', 'regulation.pdf');
    if (!fs.existsSync(pdfPath)) {
      await restorePdfFromFirestore(pdfPath);
    }
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
    if (!fs.existsSync(pdfPath)) {
      await restorePdfFromFirestore(pdfPath);
    }
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

  app.post("/api/admin/extract-regulation-summary", async (req, res) => {
    const pdfPath = path.join(process.cwd(), 'public', 'regulation.pdf');
    if (!fs.existsSync(pdfPath)) {
      await restorePdfFromFirestore(pdfPath);
    }
    if (!fs.existsSync(pdfPath)) return res.status(404).json({ error: "PDF non trovato. Carica prima il calendario venatorio." });
    
    const client = getAiClient();
    if (!client) return res.status(500).json({ error: "AI not configured" });

    try {
      const dataBuffer = fs.readFileSync(pdfPath);
      const geminiResponse = await client.models.generateContent({
        model: "gemini-3.5-flash",
        contents: {
          parts: [
            { inlineData: { data: dataBuffer.toString("base64"), mimeType: "application/pdf" } },
            { text: "Analizza il calendario venatorio allegato ed estrai i punti salienti per un riassunto esaustivo ma compatto. Fornisci un set di regole di comportamento, date e periodi importanti, limiti carniere o specie, e informazioni generali." }
          ]
        },
        config: {
          systemInstruction: "Sei un assistente esperto in normativa venatoria italiana. Estrai le informazioni in modo schematico, chiaro e sintetico per facilitarne la consultazione rapidissima su mobile da parte dei cacciatori.",
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              rules: {
                type: "ARRAY",
                items: { type: "STRING" },
                description: "Brevi frasi contenenti regole di comportamento principali, divieti fondamentali (es. distanze, armi, tesserino)."
              },
              datesAndPeriods: {
                type: "ARRAY",
                items: { type: "STRING" },
                description: "Sintesi dei principali periodi di apertura/chiusura e date importanti estratti dal calendario venatorio."
              },
              allowedSpecies: {
                type: "ARRAY",
                items: { type: "STRING" },
                description: "Sintesi dei limiti di specie o carnieri significativi menzionati."
              },
              generalInfo: {
                type: "ARRAY",
                items: { type: "STRING" },
                description: "Note aggiuntive, sanzioni, raccomandazioni per la sicurezza e consigli utili."
              }
            },
            required: ["rules", "datesAndPeriods", "allowedSpecies", "generalInfo"]
          }
        }
      });
      
      const text = geminiResponse.text;
      if (!text) throw new Error("Empty response from AI");
      
      res.json(JSON.parse(text));
    } catch (error: any) {
      console.error("PDF Regulation summary extraction failed:", error);
      res.status(500).json({ error: `Estrazione riassunto regolamento fallita: ${error.message}` });
    }
  });

  app.post("/api/regulation/ask", async (req, res) => {
    const { question } = req.body;
    if (!question) return res.status(400).json({ error: "Missing question" });

    const pdfPath = path.join(process.cwd(), 'public', 'regulation.pdf');
    if (!fs.existsSync(pdfPath)) {
      await restorePdfFromFirestore(pdfPath);
    }
    if (!fs.existsSync(pdfPath)) return res.status(404).json({ error: "Regolamento PDF non disponibile sul server." });
    
    const client = getAiClient();
    if (!client) return res.status(500).json({ error: "AI non configurata." });

    try {
      const dataBuffer = fs.readFileSync(pdfPath);
      const geminiResponse = await client.models.generateContent({
        model: "gemini-3.5-flash",
        contents: {
          parts: [
            { inlineData: { data: dataBuffer.toString("base64"), mimeType: "application/pdf" } },
            { text: `Rispondi brevemente a questa domanda basandoti sull'allegato: ${question}` }
          ]
        },
        config: {
          systemInstruction: "Sei l'assistente ufficiale del lago di caccia. Rispondi in modo cordiale, chiaro e conciso in lingua italiana basandoti esclusivamente sul regolamento PDF allegato. Se non trovi l'informazione nel PDF, dillo gentilmente spiegando che non è specificata nel regolamento corrente."
        }
      });
      
      const text = geminiResponse.text;
      res.json({ answer: text || "Non è stato possibile elaborare una risposta." });
    } catch (error: any) {
      console.error("PDF Query failed:", error);
      res.status(500).json({ error: `Impossibile analizzare la domanda: ${error.message}` });
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
