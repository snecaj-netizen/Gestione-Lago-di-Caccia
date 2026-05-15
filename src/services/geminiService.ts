import { GoogleGenAI } from "@google/genai";
import { Recipe } from "../types";

// Lazy initialization of GoogleGenAI
let ai: any = null;

function getAI() {
  if (!ai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("API_KEY_MISSING");
    }
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
}

export async function aiSearchRecipes(query: string, recipes: Recipe[]): Promise<string[]> {
  if (!query || recipes.length === 0) return recipes.map(r => r.id);

  try {
    const aiInstance = getAI();
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
    Se una ricetta è parzialmente rilevante o suggerita in base agli ingredienti, includila.
    
    Ricette:
    ${JSON.stringify(recipesSummary)}
    
    Rispondi ESCLUSIVAMENTE con un array JSON di stringhe contenente gli ID delle ricette, in questo formato: ["id1", "id2", ...]
    Se nessuna ricetta è minimamente pertinente, restituisci un array vuoto []. Se ci sono ricette molto pertinenti, mettile all'inizio.`;

    const result = await aiInstance.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });

    const text = result.text.trim();
    const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleaned || '[]');
  } catch (error: any) {
    console.error("AI Search Error:", error);
    if (error.message === "API_KEY_MISSING") throw error;
    return recipes.map(r => r.id);
  }
}

export async function generateRecipeWithAI(prompt: string): Promise<Partial<Recipe>> {
  try {
    const aiInstance = getAI();
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

    const result = await aiInstance.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: 'user', parts: [{ text: systemPrompt }] }]
    });

    const text = result.text.trim();
    const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleaned || '{}');
  } catch (error: any) {
    console.error("AI Generation Error:", error);
    throw error;
  }
}
