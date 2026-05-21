import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  subscribeToRecipes, 
  addRecipe, 
  updateRecipe, 
  deleteRecipe 
} from '../services';
import { Recipe } from '../types';
import { 
  Search, 
  Plus, 
  ChefHat, 
  Clock, 
  Users, 
  Utensils, 
  X, 
  Save, 
  Trash2, 
  Edit3, 
  ChevronRight,
  Image as ImageIcon,
  BookOpen,
  Filter,
  CheckCircle2,
  Sparkles,
  Loader2,
  Camera,
  ImagePlus
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { aiSearchRecipes, generateRecipeWithAI } from '../services/geminiService';

const MAX_IMAGE_SIZE = 800; // max width/height in px
const CATEGORIES = ['Tutti', 'Cinghiale', 'Anatra', 'Beccaccia', 'Fagiano', 'Lepre', 'Altro'];
const COURSE_TYPES = ['Tutti', 'Antipasto', 'Primo', 'Secondo', 'Altro'];

export function Recipes() {
  const { profile } = useAuth();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [search, setSearch] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showAiPromptModal, setShowAiPromptModal] = useState(false);
  const [aiPromptValue, setAiPromptValue] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Tutti');
  const [selectedCourse, setSelectedCourse] = useState('Tutti');
  const [isAdding, setIsAdding] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [showSavedToast, setShowSavedToast] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const galleryInputRef = React.useRef<HTMLInputElement>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'Cinghiale',
    courseType: 'Secondo' as const,
    ingredients: [''],
    instructions: '',
    imageUrl: ''
  });

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessingImage(true);
    const file = files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_IMAGE_SIZE) {
            height *= MAX_IMAGE_SIZE / width;
            width = MAX_IMAGE_SIZE;
          }
        } else {
          if (height > MAX_IMAGE_SIZE) {
            width *= MAX_IMAGE_SIZE / height;
            height = MAX_IMAGE_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setFormData(prev => ({ ...prev, imageUrl: dataUrl }));
        setIsProcessingImage(false);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    const unsub = subscribeToRecipes(setRecipes);
    return () => unsub();
  }, []);

  const filteredRecipes = useMemo(() => {
    return recipes.filter(r => {
      const searchLower = search.toLowerCase();
      const matchesSearch = 
        r.title.toLowerCase().includes(searchLower) || 
        r.description.toLowerCase().includes(searchLower) ||
        r.instructions.toLowerCase().includes(searchLower) ||
        r.ingredients.some(i => i.toLowerCase().includes(searchLower));

      const matchesCategory = selectedCategory === 'Tutti' || r.category === selectedCategory;
      const matchesCourse = selectedCourse === 'Tutti' || r.courseType === selectedCourse;
      return matchesSearch && matchesCategory && matchesCourse;
    });
  }, [recipes, search, selectedCategory, selectedCourse]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  };

  const handleAiGenerate = async () => {
    if (!aiPromptValue.trim() || isGenerating) return;

    setIsGenerating(true);
    setShowAiPromptModal(false);
    try {
      const aiRecipe = await generateRecipeWithAI(aiPromptValue);
      setFormData({
        title: aiRecipe.title || '',
        description: aiRecipe.description || '',
        category: aiRecipe.category || 'Altro',
        courseType: (aiRecipe.courseType as any) || 'Secondo',
        ingredients: aiRecipe.ingredients || [''],
        instructions: aiRecipe.instructions || '',
        imageUrl: ''
      });
      setIsAdding(true);
      setAiPromptValue('');
    } catch (error: any) {
      console.error("AI Generation Error:", error);
      if (error.message === "API_KEY_MISSING") {
        alert("Configurazione AI mancante: Inserisci la chiave GEMINI_API_KEY nei 'Settings > Secrets' per generare ricette.");
      } else {
        alert(`Errore nella generazione: ${error.message || "Errore sconosciuto"}`);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    const newRecipe: Omit<Recipe, 'id'> = {
      ...formData,
      ingredients: formData.ingredients.filter(i => i.trim() !== ''),
      authorUid: profile.uid,
      authorName: profile.displayName,
      createdAt: new Date().toISOString()
    };

    if (editingRecipe) {
      await updateRecipe(editingRecipe.id, newRecipe);
    } else {
      await addRecipe(newRecipe);
    }

    setIsAdding(false);
    setEditingRecipe(null);
    setFormData({
      title: '',
      description: '',
      category: 'Cinghiale',
      courseType: 'Secondo',
      ingredients: [''],
      instructions: '',
      imageUrl: ''
    });
    setShowSavedToast(true);
    setTimeout(() => setShowSavedToast(false), 3000);
  };

  const handleAddIngredient = () => {
    setFormData({ ...formData, ingredients: [...formData.ingredients, ''] });
  };

  const handleIngredientChange = (index: number, value: string) => {
    const newIngredients = [...formData.ingredients];
    newIngredients[index] = value;
    setFormData({ ...formData, ingredients: newIngredients });
  };

  const handleRemoveIngredient = (index: number) => {
    setFormData({
      ...formData,
      ingredients: formData.ingredients.filter((_, i) => i !== index)
    });
  };

  return (
    <div className="min-h-screen bg-bg-body relative overflow-hidden">
      {/* Decorative Elements */}
      <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-lake-green/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-1/3 h-1/3 bg-accent-gold/5 blur-[100px] rounded-full translate-y-1/4 -translate-x-1/4 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 py-12 relative">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
        <div className="space-y-1">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-lake-green/5 text-lake-green text-[10px] font-black uppercase tracking-[0.2em]"
          >
            <Sparkles size={12} />
            Esperienza Gourmet
          </motion.div>
          <h1 className="text-4xl md:text-5xl font-serif font-black text-slate-gray leading-tight">
            Antica Dispensa <br /> <span className="text-lake-green italic text-3xl md:text-4xl font-medium">del Lago</span>
          </h1>
          <p className="text-slate-500 font-sans font-medium text-lg max-w-2xl">
            L'arte della selvaggina: ricette tramandate, segreti della valle e ispirazione stellata.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto items-stretch sm:items-center">
          <button
            onClick={() => setIsAdding(true)}
            className="flex-1 sm:flex-none sm:w-56 h-16 bg-lake-green text-white px-8 rounded-2xl font-black text-xs uppercase tracking-[0.15em] flex items-center justify-center gap-3 hover:bg-lake-green/90 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-lake-green/20 group"
          >
            <Plus size={20} className="group-hover:rotate-90 transition-transform duration-300" /> 
            Nuova Ricetta
          </button>
          <button
            onClick={() => setShowAiPromptModal(true)}
            disabled={isGenerating}
            className="flex-1 sm:flex-none sm:w-56 h-16 bg-accent-gold text-white px-8 rounded-2xl font-black text-xs uppercase tracking-[0.15em] flex items-center justify-center gap-3 hover:bg-accent-gold/90 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-accent-gold/20 disabled:opacity-50"
          >
            {isGenerating ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
            Chef AI
          </button>
        </div>
      </div>

      {/* Discovery Section */}
      <div className="relative mb-16">
        <div className="absolute inset-0 bg-lake-green/[0.02] rounded-[2.5rem] -m-4 md:-m-8 pointer-events-none" />
        
        <div className="relative space-y-8">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-grow relative group">
              <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                <Search className="text-slate-300 group-focus-within:text-lake-green transition-colors" size={20} />
              </div>
              <input
                type="text"
                placeholder="Cerca tra le tue ricette..."
                value={search}
                onChange={handleSearch}
                className="w-full bg-white border-2 border-slate-100 rounded-2xl pl-16 pr-8 py-6 text-slate-800 font-sans font-bold placeholder:text-slate-300 outline-none focus:border-lake-green/30 focus:ring-4 focus:ring-lake-green/5 transition-all shadow-sm"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 mr-2">
              <Filter size={16} className="text-slate-400" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Filtra per:</span>
            </div>
            {CATEGORIES.map(category => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={cn(
                  "px-4 py-2.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all",
                  selectedCategory === category
                    ? "bg-lake-green text-white border-lake-green shadow-lg shadow-lake-green/20"
                    : "bg-white text-slate-400 border-slate-100 hover:border-slate-200 hover:text-slate-600"
                )}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* AI Prompt Modal */}
      <AnimatePresence>
        {showAiPromptModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="w-16 h-16 bg-accent-gold/10 rounded-2xl flex items-center justify-center mb-6 text-accent-gold">
                  <Sparkles size={32} />
                </div>
                <h3 className="text-2xl font-serif font-black text-slate-gray mb-2">Ispirazione dallo Chef AI</h3>
                <p className="text-slate-500 font-medium text-sm mb-6 leading-relaxed">
                  Cosa vorresti cucinare oggi? Chiedi una ricetta specifica o lascia che l'AI ti suggerisca qualcosa con gli ingredienti che hai.
                </p>
                <div className="space-y-6">
                  <textarea
                    autoFocus
                    value={aiPromptValue}
                    onChange={(e) => setAiPromptValue(e.target.value)}
                    placeholder="Es. Vorrei un modo sfizioso per fare lo spezzatino di cinghiale con olive e bacche di ginepro..."
                    className="w-full h-32 bg-off-white border border-slate-100 rounded-2xl p-4 text-sm font-bold outline-none focus:border-accent-gold focus:ring-4 focus:ring-accent-gold/5 transition-all resize-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleAiGenerate();
                      }
                    }}
                  />

                  <div className="space-y-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Suggerimenti dello Chef:</p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        "Tagliatelle al ragù di cinghiale e cacao",
                        "Anatra all'arancia con riduzione di balsamico",
                        "Pappardelle alla lepre in salmì",
                        "Fagiano alla cacciatora con porcini",
                        "Beccaccia al forno con crostoni"
                      ].map((suggestion, i) => (
                        <button
                          key={i}
                          onClick={() => setAiPromptValue(suggestion)}
                          className="px-3 py-2 rounded-full border border-slate-100 bg-slate-50 text-[10px] font-bold text-slate-500 hover:border-accent-gold hover:text-accent-gold hover:bg-accent-gold/5 transition-all"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setShowAiPromptModal(false)}
                      className="flex-1 py-4 px-6 rounded-xl bg-slate-100 text-slate-500 font-bold text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
                    >
                      Annulla
                    </button>
                    <button
                      onClick={handleAiGenerate}
                      disabled={!aiPromptValue.trim() || isGenerating}
                      className="flex-1 py-4 px-6 rounded-xl bg-accent-gold text-white font-black text-xs uppercase tracking-widest hover:bg-amber-600 transition-all shadow-lg shadow-accent-gold/20 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          Generazione in corso...
                        </>
                      ) : (
                        "Genera Ricetta"
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Grid Header */}
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-xl font-serif font-black text-slate-gray">
          Le Ricette di Oggi <span className="text-lake-green text-sm ml-2">({filteredRecipes.length})</span>
        </h2>
      </div>

      {/* Gallery */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
        <AnimatePresence mode="popLayout">
          {filteredRecipes.map((recipe, index) => (
            <motion.div
              layout
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: index * 0.05 }}
              key={recipe.id}
              onClick={() => setSelectedRecipe(recipe)}
              className="group bg-white rounded-[2.5rem] overflow-hidden border border-slate-100/50 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 cursor-pointer flex flex-col h-full relative"
            >
              {recipe.imageUrl ? (
                <div className="aspect-[4/3] relative overflow-hidden bg-slate-100 flex-shrink-0">
                  <img 
                    src={recipe.imageUrl} 
                    alt={recipe.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                  />
                  
                  {/* Overlay Tags */}
                  <div className="absolute top-6 left-6 flex flex-col gap-2 z-10">
                    <span className="bg-white/90 backdrop-blur-md text-lake-green text-[9px] font-black px-4 py-2 rounded-full uppercase tracking-widest shadow-xl self-start border border-lake-green/10">
                      {recipe.category}
                    </span>
                    <span className="bg-accent-gold text-white text-[8px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest shadow-xl self-start">
                      {recipe.courseType}
                    </span>
                  </div>

                  {/* Quick Actions - Floating */}
                  {(profile?.uid === recipe.authorUid || profile?.role === 'admin' || profile?.role === 'socio') && (
                    <div className="absolute top-6 right-6 flex flex-col gap-2 opacity-0 group-hover:opacity-100 translate-x-4 group-hover:translate-x-0 transition-all duration-300 z-20">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingRecipe(recipe);
                          setFormData({
                            title: recipe.title,
                            description: recipe.description,
                            category: recipe.category,
                            courseType: recipe.courseType as any,
                            ingredients: recipe.ingredients,
                            instructions: recipe.instructions,
                            imageUrl: recipe.imageUrl || ''
                          });
                          setIsAdding(true);
                        }}
                        className="w-10 h-10 rounded-full bg-white text-slate-600 shadow-xl flex items-center justify-center hover:bg-lake-green hover:text-white transition-all transform hover:rotate-12"
                      >
                        <Edit3 size={16} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm('Sei sicuro di voler eliminare questa preziosa ricetta?')) {
                            deleteRecipe(recipe.id);
                          }
                        }}
                        className="w-10 h-10 rounded-full bg-white text-rose-500 shadow-xl flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all transform hover:-rotate-12"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
              ) : null}

              <div className="p-8 flex flex-col flex-grow">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-full bg-lake-green/5 border border-lake-green/10 flex items-center justify-center overflow-hidden">
                    <ChefHat size={18} className="text-lake-green" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black text-slate-300 uppercase tracking-[0.1em]">Caricata da</span>
                    <span className="text-[11px] font-bold text-slate-500">{recipe.authorName}</span>
                  </div>
                </div>

                <h3 className="text-2xl font-serif font-black text-slate-gray leading-tight mb-4 group-hover:text-lake-green transition-colors line-clamp-2">
                  {recipe.title}
                </h3>
                
                <p className="text-slate-400 text-sm line-clamp-3 italic mb-8 leading-relaxed flex-grow">
                  "{recipe.description}"
                </p>

                <div className="pt-6 border-t border-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col">
                      <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest leading-none mb-1">Qualità</span>
                      <div className="flex gap-0.5">
                        {[1, 2, 3].map(s => (
                          <div key={s} className="w-1 h-1 rounded-full bg-accent-gold/40" />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="px-5 py-2.5 rounded-full bg-slate-50 group-hover:bg-lake-green text-slate-400 group-hover:text-white transition-all duration-300 flex items-center gap-2 group-hover:shadow-lg group-hover:shadow-lake-green/20">
                    <span className="text-[9px] font-black uppercase tracking-widest">Dettagli</span>
                    <ChevronRight size={14} />
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Recipe Modal */}
      <AnimatePresence>
        {selectedRecipe && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 40 }}
              className="bg-white rounded-[3rem] w-full max-w-5xl shadow-2xl relative overflow-hidden"
            >
              {/* Close Button UI */}
              <div className="absolute top-6 right-6 z-[110] flex gap-3">
                 {(profile?.uid === selectedRecipe.authorUid || profile?.role === 'admin' || profile?.role === 'socio') && (
                    <div className="flex gap-2 mr-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const recipeToEdit = selectedRecipe;
                          setSelectedRecipe(null);
                          setEditingRecipe(recipeToEdit);
                          setFormData({
                            title: recipeToEdit.title,
                            description: recipeToEdit.description,
                            category: recipeToEdit.category,
                            courseType: recipeToEdit.courseType as any,
                            ingredients: recipeToEdit.ingredients,
                            instructions: recipeToEdit.instructions,
                            imageUrl: recipeToEdit.imageUrl || ''
                          });
                          setIsAdding(true);
                        }}
                        className="w-12 h-12 rounded-full bg-white text-lake-green shadow-xl flex items-center justify-center hover:bg-lake-green hover:text-white transition-all transform active:scale-90"
                      >
                        <Edit3 size={18} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm('Vuoi eliminare questa ricetta?')) {
                            const id = selectedRecipe.id;
                            setSelectedRecipe(null);
                            deleteRecipe(id);
                          }
                        }}
                        className="w-12 h-12 rounded-full bg-white text-rose-500 shadow-xl flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all transform active:scale-90"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  )}
                <button 
                  onClick={() => setSelectedRecipe(null)}
                  className="w-12 h-12 rounded-full bg-slate-100 text-slate-800 flex items-center justify-center hover:bg-slate-200 transition-all active:scale-90"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex flex-col lg:flex-row h-full max-h-[92vh] overflow-hidden">
                {/* Image Section */}
                <div className="w-full lg:w-2/5 aspect-video lg:aspect-auto relative bg-slate-50 flex-shrink-0">
                  {selectedRecipe.imageUrl ? (
                    <img 
                      src={selectedRecipe.imageUrl} 
                      alt={selectedRecipe.title}
                      className="w-full h-full object-cover shadow-inner"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-200 gap-6 bg-slate-50">
                      <div className="w-24 h-24 rounded-full bg-white flex items-center justify-center shadow-inner">
                        <BookOpen size={40} strokeWidth={1} />
                      </div>
                      <span className="text-[10px] uppercase font-black tracking-[0.3em] opacity-40">Antica Dispensa</span>
                    </div>
                  )}
                  
                  {/* Category Pill Over Image */}
                  <div className="absolute bottom-10 left-10 flex flex-col gap-3">
                    <span className="bg-lake-green text-white text-[10px] font-black px-6 py-3 rounded-full uppercase tracking-widest shadow-2xl inline-block">
                      {selectedRecipe.category}
                    </span>
                    <span className="bg-accent-gold text-white text-[9px] font-black px-4 py-2 rounded-full uppercase tracking-widest shadow-2xl inline-block self-start">
                      {selectedRecipe.courseType}
                    </span>
                  </div>
                </div>

                {/* Content Section */}
                <div className="flex-grow p-10 lg:p-14 overflow-y-auto bg-white custom-scrollbar">
                  <header className="mb-12">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden">
                        <ChefHat size={20} className="text-lake-green" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest leading-none mb-1">Dalla cucina di</p>
                        <p className="text-sm font-bold text-slate-700">{selectedRecipe.authorName}</p>
                      </div>
                    </div>
                    <h2 className="text-4xl lg:text-5xl font-serif font-black text-slate-gray leading-tight mb-6">
                      {selectedRecipe.title}
                    </h2>
                    <div className="relative">
                      <div className="absolute -left-6 top-0 bottom-0 w-1 bg-accent-gold/40 rounded-full" />
                      <p className="text-slate-500 italic text-lg lg:text-xl font-medium leading-relaxed">
                        "{selectedRecipe.description}"
                      </p>
                    </div>
                  </header>

                  <div className="space-y-16">
                    {/* Ingredients */}
                    <div className="relative">
                      <div className="flex items-center gap-3 mb-8">
                        <div className="p-3 rounded-2xl bg-lake-green/5 text-lake-green">
                          <Utensils size={24} />
                        </div>
                        <h4 className="text-xl font-black text-slate-gray uppercase tracking-tighter">Ingredienti Necessari</h4>
                        <div className="flex-grow h-px bg-slate-50 ml-4" />
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
                        {selectedRecipe.ingredients.map((ing, i) => (
                          <div key={i} className="flex items-center gap-4 py-3 border-b border-slate-100 group">
                            <div className="w-2 h-2 rounded-full bg-accent-gold transition-transform group-hover:scale-150" />
                            <span className="text-slate-600 font-bold">{ing}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Procedure */}
                    <div className="relative">
                      <div className="flex items-center gap-3 mb-8">
                        <div className="p-3 rounded-2xl bg-lake-green/5 text-lake-green">
                          <BookOpen size={24} />
                        </div>
                        <h4 className="text-xl font-black text-slate-gray uppercase tracking-tighter">Il Procedimento</h4>
                        <div className="flex-grow h-px bg-slate-50 ml-4" />
                      </div>
                      
                      <div className="bg-slate-50/50 p-8 lg:p-10 rounded-[2.5rem] border border-slate-100/50">
                        <div className="prose prose-lg max-w-none text-slate-600 font-medium leading-relaxed whitespace-pre-wrap select-text">
                          {selectedRecipe.instructions}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-20 pt-10 border-t border-slate-100 flex justify-center">
                    <div className="inline-flex items-center gap-1.5 px-6 py-2 rounded-full bg-slate-50 text-[10px] font-black text-slate-300 uppercase tracking-widest border border-slate-100">
                      Buon Appetito dall'Antica Dispensa
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Form Modal */}
      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl relative"
            >
              <div className="p-8">
                <header className="flex justify-between items-start mb-8">
                  <div>
                    <h2 className="text-2xl font-black text-slate-gray uppercase tracking-tighter">
                      {editingRecipe ? 'Modifica Ricetta' : 'Nuova Ricetta'}
                    </h2>
                    <p className="text-slate-400 font-medium italic text-sm">Inserisci tutti i dettagli per condividere la tua creazione.</p>
                  </div>
                  <button 
                    onClick={() => {
                      setIsAdding(false);
                      setEditingRecipe(null);
                    }}
                    className="text-slate-300 hover:text-lake-green transition-colors"
                  >
                    <X size={24} />
                  </button>
                </header>

                <form onSubmit={handleCreate} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Titolo</label>
                      <input
                        required
                        type="text"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="w-full bg-off-white border border-slate-100 rounded-lg px-4 py-3 text-sm font-bold outline-none focus:border-lake-green"
                        placeholder="Es. Spezzatino di Cinghiale..."
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Foto della Ricetta</label>
                      <div className="flex gap-2">
                        {formData.imageUrl ? (
                          <div className="relative w-full h-[46px] rounded-lg overflow-hidden border border-slate-100 bg-off-white flex items-center px-4">
                            <span className="text-[10px] font-bold text-lake-green truncate max-w-[150px]">Foto acquisita</span>
                            <button 
                              type="button"
                              onClick={() => setFormData({ ...formData, imageUrl: '' })}
                              className="ml-auto text-rose-500 hover:text-rose-700"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-2 w-full">
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              disabled={isProcessingImage}
                              className="flex items-center justify-center gap-2 bg-off-white border border-slate-100 rounded-lg py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-lake-green hover:border-lake-green transition-all"
                            >
                              {isProcessingImage ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                              Camera
                            </button>
                            <button
                              type="button"
                              onClick={() => galleryInputRef.current?.click()}
                              disabled={isProcessingImage}
                              className="flex items-center justify-center gap-2 bg-off-white border border-slate-100 rounded-lg py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-lake-green hover:border-lake-green transition-all"
                            >
                              {isProcessingImage ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
                              Upload
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Categoria Animale</label>
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="w-full bg-off-white border border-slate-100 rounded-lg px-4 py-3 text-sm font-bold outline-none focus:border-lake-green"
                      >
                        {CATEGORIES.filter(c => c !== 'Tutti').map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipo Portata</label>
                      <select
                        value={formData.courseType}
                        onChange={(e) => setFormData({ ...formData, courseType: e.target.value as any })}
                        className="w-full bg-off-white border border-slate-100 rounded-lg px-4 py-3 text-sm font-bold outline-none focus:border-lake-green"
                      >
                        {COURSE_TYPES.filter(c => c !== 'Tutti').map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Descrizione Breve</label>
                    <input
                      required
                      type="text"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full bg-off-white border border-slate-100 rounded-lg px-4 py-3 text-sm font-bold outline-none focus:border-lake-green"
                      placeholder="Un classico della tradizione toscana..."
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ingredienti</label>
                      <button
                        type="button"
                        onClick={handleAddIngredient}
                        className="text-[10px] font-black text-lake-green uppercase tracking-widest flex items-center gap-1 hover:underline"
                      >
                        <Plus size={12} /> Aggiungi
                      </button>
                    </div>
                    <div className="space-y-2">
                      {formData.ingredients.map((ing, idx) => (
                        <div key={idx} className="flex gap-2">
                          <input
                            required
                            type="text"
                            value={ing}
                            onChange={(e) => handleIngredientChange(idx, e.target.value)}
                            className="flex-grow bg-off-white border border-slate-100 rounded-lg px-4 py-2 text-sm font-bold outline-none focus:border-lake-green"
                            placeholder="Es. 500g di polpa di cinghiale"
                          />
                          {formData.ingredients.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveIngredient(idx)}
                              className="text-slate-300 hover:text-rose-600 transition-colors"
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Procedimento</label>
                    <textarea
                      required
                      value={formData.instructions}
                      onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                      className="w-full bg-off-white border border-slate-100 rounded-lg px-4 py-3 text-sm font-bold outline-none focus:border-lake-green min-h-[200px]"
                      placeholder="Descrivi i passaggi dettagliati..."
                    />
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAdding(false);
                        setEditingRecipe(null);
                      }}
                      className="flex-1 py-4 px-6 rounded-xl bg-slate-100 text-slate-500 font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all font-bold"
                    >
                      Annulla
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-4 px-6 rounded-xl bg-lake-green text-white font-black text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg flex items-center justify-center gap-2"
                    >
                      <Save size={18} /> {editingRecipe ? 'Salva Modifiche' : 'Condividi Ricetta'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden file inputs */}
      <input 
        type="file"
        accept="image/*"
        capture="environment"
        ref={fileInputRef}
        onChange={handleImageUpload}
        className="hidden"
      />
      <input 
        type="file"
        accept="image/*"
        ref={galleryInputRef}
        onChange={handleImageUpload}
        className="hidden"
      />

      {/* Success Toast */}
      <AnimatePresence>
        {showSavedToast && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100]"
          >
            <div className="bg-lake-green text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 border-2 border-white/20">
              <CheckCircle2 size={20} />
              <span className="text-xs font-black uppercase tracking-widest">Ricetta Salvata con Successo</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </div>
  );
}
