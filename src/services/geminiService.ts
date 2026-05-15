import { Recipe } from "../types";

export async function aiSearchRecipes(query: string, recipes: Recipe[]): Promise<string[]> {
  if (!query || recipes.length === 0) return recipes.map(r => r.id);

  try {
    const response = await fetch("/api/ai/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, recipes })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to search recipes with AI");
    }

    return await response.json();
  } catch (error) {
    console.error("AI Search Error:", error);
    return recipes.map(r => r.id);
  }
}

export async function generateRecipeWithAI(prompt: string): Promise<Partial<Recipe>> {
  try {
    const response = await fetch("/api/ai/generate-recipe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt })
    });

    if (!response.ok) {
      const errorData = await response.json();
      if (errorData.error?.includes("GEMINI_API_KEY")) {
        throw new Error("API_KEY_MISSING");
      }
      throw new Error(errorData.error || "Failed to generate recipe with AI");
    }

    return await response.json();
  } catch (error) {
    console.error("AI Generation Error:", error);
    throw error;
  }
}
