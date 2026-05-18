import { Recipe } from "../types";

export async function aiSearchRecipes(query: string, recipes: Recipe[]): Promise<string[]> {
  if (!query || recipes.length === 0) return recipes.map(r => r.id);

  try {
    const recipesSummary = recipes.map((r: any) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      category: r.category,
      courseType: r.courseType,
      ingredients: r.ingredients
    }));

    const response = await fetch("/api/ai/recipe-search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, recipes: recipesSummary }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      if (errorData.error === "AI capability not configured") {
        throw new Error("API_KEY_MISSING");
      }
      throw new Error(errorData.error || "Failed to search recipes");
    }

    return await response.json();
  } catch (error: any) {
    console.error("AI Search Error:", error);
    if (error.message === "API_KEY_MISSING") throw error;
    return recipes.map(r => r.id);
  }
}

export async function generateRecipeWithAI(prompt: string): Promise<Partial<Recipe>> {
  try {
    const response = await fetch("/api/ai/recipe-generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      if (errorData.error === "AI capability not configured") {
        throw new Error("API_KEY_MISSING");
      }
      throw new Error(errorData.error || "Failed to generate recipe");
    }

    return await response.json();
  } catch (error: any) {
    console.error("AI Generation Error:", error);
    throw error;
  }
}
