import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

  app.post("/api/ai/generate-recipe", async (req, res) => {
    const { prompt } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server" });
    }

    try {
      const { GoogleGenAI } = await import("@google/genai");
      const client = new GoogleGenAI({ apiKey });
      const systemPrompt = `Sei uno chef stellato specializzato in selvaggina (cinghiale, anatra, lepre, ecc.).
      L'utente ti chiede una ricetta o un'idea: "${prompt}".
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
      
      IMPORTANTE: Restituisci SOLO il JSON valido.`;

      const result = await client.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [{ role: 'user', parts: [{ text: systemPrompt }] }]
      });

      const text = result.text.trim();
      const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
      res.json(JSON.parse(cleaned || '{}'));
    } catch (error) {
      console.error("AI Generation Proxy Error:", error);
      res.status(500).json({ error: "Failed to generate recipe with AI" });
    }
  });

  app.post("/api/ai/search", async (req, res) => {
    const { query, recipes } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server" });
    }

    try {
      const { GoogleGenAI } = await import("@google/genai");
      const client = new GoogleGenAI({ apiKey });
      
      const recipesSummary = recipes.map((r: any) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        category: r.category,
        courseType: r.courseType,
        ingredients: r.ingredients
      }));

      const prompt = `Sei un esperto di cucina di selvaggina. Un utente sta cercando una ricetta con questa query: "${query}".
      Di seguito hai un elenco di ricette disponibili in formato JSON. 
      Il tuo compito è analizzare la query e restituire un elenco degli ID delle ricette che meglio corrispondono alla ricerca, ordinati per rilevanza.
      
      Ricette:
      ${JSON.stringify(recipesSummary)}
      
      Rispondi ESCLUSIVAMENTE con un array JSON di stringhe contenente gli ID delle ricette, in questo formato: ["id1", "id2", ...]
      Se nessuna ricetta è pertinente, restituisci un array vuoto [].`;

      const result = await client.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      });

      const text = result.text.trim();
      const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
      res.json(JSON.parse(cleaned || '[]'));
    } catch (error) {
      console.error("AI Search Proxy Error:", error);
      res.status(500).json({ error: "Failed to perform AI search" });
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
    const distPath = path.resolve(__dirname, "dist");
    
    // Explicitly serve manifest and sw with correct headers
    app.get("/manifest.json", (req, res) => {
      res.setHeader("Content-Type", "application/manifest+json");
      res.sendFile(path.join(distPath, "manifest.json"));
    });

    app.get("/sw.js", (req, res) => {
      res.setHeader("Service-Worker-Allowed", "/");
      res.setHeader("Content-Type", "application/javascript");
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(path.join(distPath, "sw.js"));
    });

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
