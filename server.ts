import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

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
    
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "AI capability not configured" });
    }

    try {
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ 
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });
      
      const response = await ai.models.generateContent({
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

      const text = response.text || "{}";
      const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
      res.json(JSON.parse(cleaned));
    } catch (error) {
      console.error("AI Prediction Error:", error);
      res.status(500).json({ error: "Failed to generate prediction" });
    }
  });

  app.post("/api/ai/recipe-generate", async (req, res) => {
    const { prompt } = req.body;
    
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "AI capability not configured" });
    }

    try {
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ 
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });
      
      const response = await ai.models.generateContent({
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

      const text = response.text || "{}";
      const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
      res.json(JSON.parse(cleaned));
    } catch (error) {
      console.error("AI Recipe Error:", error);
      res.status(500).json({ error: "Failed to generate recipe" });
    }
  });

  app.post("/api/ai/recipe-search", async (req, res) => {
    const { query, recipes } = req.body;
    
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "AI capability not configured" });
    }

    try {
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ 
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });
      
      const response = await ai.models.generateContent({
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

      const text = response.text || "[]";
      const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
      res.json(JSON.parse(cleaned));
    } catch (error) {
      console.error("AI Search Error:", error);
      res.status(500).json({ error: "Failed to search recipes" });
    }
  });
  
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
