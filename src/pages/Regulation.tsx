import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { subscribeToRegulationSummary, saveRegulationSummary, clearRegulationSummary } from '../services';
import { RegulationSummary } from '../types';
import { FileText, BookOpen, Search, Send, Sparkles, Clock, Calendar, CheckCircle, AlertTriangle, AlertCircle, Trash2, RefreshCw } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export function Regulation() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  // Firestore retrieved summary
  const [summary, setSummary] = useState<RegulationSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);

  // QA state
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [qaError, setQaError] = useState<string | null>(null);

  // Admin action state
  const [extracting, setExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [showConfirmReset, setShowConfirmReset] = useState(false);

  // Ref to scroll to answer
  const answerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Subscribe to Firestore summary
    const unsubscribe = subscribeToRegulationSummary((data) => {
      setSummary(data);
      setLoadingSummary(false);
    });
    return () => unsubscribe();
  }, []);

  const handleAskQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || asking) return;

    setAsking(true);
    setQaError(null);
    setAnswer(null);

    try {
      const response = await fetch('/api/regulation/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question.trim() })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Errore nella risposta del server.');
      }

      setAnswer(data.answer);
      setTimeout(() => {
        answerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    } catch (err: any) {
      console.error(err);
      setQaError(err.message || 'Errore sconosciuto.');
    } finally {
      setAsking(false);
    }
  };

  const handleResetAndExtract = async () => {
    setExtracting(true);
    setExtractionError(null);
    setShowConfirmReset(false);

    try {
      // 1. Clear previous Firestore doc if any
      await clearRegulationSummary();

      // 2. Fetch new extraction from backend
      const response = await fetch('/api/admin/extract-regulation-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Estrazione fallita.');
      }

      // 3. Save extracted summary to Firestore
      const newSummary: RegulationSummary = {
        rules: data.rules || [],
        datesAndPeriods: data.datesAndPeriods || [],
        allowedSpecies: data.allowedSpecies || [],
        generalInfo: data.generalInfo || [],
        updatedAt: new Date().toISOString()
      };

      await saveRegulationSummary(newSummary);
      alert('Sintesi del regolamento generata e salvata con successo!');
    } catch (err: any) {
      console.error(err);
      setExtractionError(err.message || 'Errore sconosciuto.');
      alert('Errore durante la rigenerazione.');
    } finally {
      setExtracting(false);
    }
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Top Header Panel */}
      <div className="bg-gradient-to-br from-lake-green to-slate-900 text-white rounded-2xl p-6 md:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 bottom-0 translate-x-12 translate-y-12 opacity-5 pointer-events-none">
          <BookOpen size={280} />
        </div>
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-accent-gold p-2 rounded-lg shadow-lg">
            <BookOpen size={24} className="text-slate-900" />
          </div>
          <span className="text-xs font-black uppercase tracking-[0.2em] text-accent-gold">Sintesi & Ricerca</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-black font-sans leading-tight text-white mb-2 uppercase tracking-wide">
          Regolamento & Calendario Venatorio
        </h1>
        <p className="text-slate-200 text-xs md:text-sm max-w-2xl font-light leading-relaxed">
          Evita letture interminabili. Consulta i punti focali estratti tramite AI dal calendario venatorio o effettua una domanda specifica per ottenere risposte precise in tempo reale.
        </p>
      </div>

      {loadingSummary ? (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-slate-300 border-t-accent-gold rounded-full animate-spin mb-4" />
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Caricamento sintesi in corso...</p>
        </div>
      ) : (
        <>
          {/* Main Grid: Summary Columns & QA box */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left/Middle Content: Extracted Items (takes 2 cols on modern desktop) */}
            <div className="lg:col-span-2 space-y-8">
              {!summary ? (
                <div className="card-polish p-8 text-center flex flex-col items-center justify-center border-dashed">
                  <AlertCircle size={36} className="text-slate-300 mb-3 animate-pulse" />
                  <h3 className="text-sm font-black uppercase text-slate-600 mb-1">Nessuna sintesi disponibile</h3>
                  <p className="text-xs text-slate-400 max-w-md mb-4 leading-normal">
                    L'amministratore non ha ancora generato la sintesi strutturata per questo regolamento o la base dati è vuota.
                  </p>
                  {isAdmin && (
                    <button
                      onClick={() => setShowConfirmReset(true)}
                      className="px-4 py-2 bg-accent-gold hover:bg-accent-gold/90 text-slate-900 font-black text-xs uppercase tracking-widest rounded-lg transition-all"
                    >
                      Genera Sintesi Ora
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Summary Update Metadata Alert */}
                  <div className="flex items-center justify-between text-[10px] text-slate-400 bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                    <span className="font-bold uppercase">Sintesi compilata dall'AI</span>
                    <span className="font-mono">Aggiornato: {new Date(summary.updatedAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>

                  {/* Section 1: Regole Comportamentali */}
                  {summary.rules && summary.rules.length > 0 && (
                    <section className="card-polish !border-t-lake-green shadow-md">
                      <div className="flex items-center gap-2 mb-4">
                        <CheckCircle size={18} className="text-lake-green" />
                        <h2 className="text-sm font-black text-slate-700 uppercase tracking-wider">Norme & Comportamenti del Lago</h2>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {summary.rules.map((rule, idx) => (
                          <div key={idx} className="py-3 flex gap-3 text-xs text-slate-600 leading-relaxed items-start">
                            <span className="flex-shrink-0 w-5 h-5 bg-lake-green/10 text-lake-green font-bold text-[10px] rounded-full flex items-center justify-center mt-0.5">
                              {idx + 1}
                            </span>
                            <span>{rule}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Section 2: Date e Periodi */}
                  {summary.datesAndPeriods && summary.datesAndPeriods.length > 0 && (
                    <section className="card-polish !border-t-accent-gold shadow-md">
                      <div className="flex items-center gap-2 mb-4">
                        <Calendar size={18} className="text-accent-gold" />
                        <h2 className="text-sm font-black text-slate-700 uppercase tracking-wider">Periodi & Date Critiche</h2>
                      </div>
                      <ul className="space-y-3">
                        {summary.datesAndPeriods.map((period, idx) => (
                          <li key={idx} className="p-3 bg-slate-50/50 rounded-lg border border-slate-100 flex gap-3 text-xs text-slate-600 items-start leading-relaxed">
                            <span className="text-accent-gold mt-0.5">•</span>
                            <span>{period}</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {/* Section 3: Specie & Carniari */}
                  {summary.allowedSpecies && summary.allowedSpecies.length > 0 && (
                    <section className="card-polish !border-t-sky-500 shadow-md">
                      <div className="flex items-center gap-2 mb-4">
                        <Sparkles size={18} className="text-sky-500" />
                        <h2 className="text-sm font-black text-slate-700 uppercase tracking-wider">Note su Specie & Limiti</h2>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {summary.allowedSpecies.map((specie, idx) => (
                          <div key={idx} className="p-3 bg-sky-50/20 border border-sky-100 rounded-lg text-xs text-slate-600 leading-relaxed">
                            {specie}
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Section 4: Informazioni generali & Sicurezza */}
                  {summary.generalInfo && summary.generalInfo.length > 0 && (
                    <section className="card-polish !border-t-amber-500 shadow-md">
                      <div className="flex items-center gap-2 mb-4">
                        <AlertTriangle size={18} className="text-amber-500" />
                        <h2 className="text-sm font-black text-slate-700 uppercase tracking-wider">Sicurezza, Sanzioni & Avvisi</h2>
                      </div>
                      <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 space-y-2">
                        {summary.generalInfo.map((info, idx) => (
                          <p key={idx} className="text-xs text-amber-900 leading-relaxed font-medium flex gap-2 items-start">
                            <span className="flex-shrink-0 text-amber-500 font-bold">•</span>
                            <span>{info}</span>
                          </p>
                        ))}
                      </div>
                    </section>
                  )}
                </div>
              )}
            </div>

            {/* Right Content Column: AI QA Assistant panel (takes 1 col) */}
            <div className="space-y-6">
              <div className="bg-[#f2f6f3] text-slate-900 rounded-2xl p-5 border border-lake-green/20 shadow-lg flex flex-col relative overflow-hidden">
                
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-lake-green/10 flex items-center justify-center">
                    <Sparkles size={16} className="text-lake-green" />
                  </div>
                  <div>
                    <h2 className="text-xs font-black uppercase tracking-wider text-lake-green">Chiedi all'Assistente AI</h2>
                    <p className="text-[10px] text-slate-500 font-medium">Interroga il PDF del calendario</p>
                  </div>
                </div>

                <p className="text-slate-700 text-[11.5px] mb-4 leading-relaxed">
                  Hai dubbi su orari particolari della giornata venatoria, specie cacciabili o sanzioni? Scrivi la tua domanda qui sotto. L'AI cercherà la risposta all'interno del file ufficiale del regolamento.
                </p>

                <form onSubmit={handleAskQuestion} className="space-y-3">
                  <div className="relative">
                    <textarea
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      placeholder="Esempio: Qual è il numero massimo giornaliero di alzavole che posso abbattere?"
                      className="w-full h-24 bg-white border border-slate-300 focus:border-lake-green focus:ring-1 focus:ring-lake-green rounded-xl p-3 text-xs text-slate-900 placeholder-slate-400 outline-none resize-none transition-all leading-normal"
                      disabled={asking}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={asking || !question.trim()}
                    className={cn(
                      "w-full py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md",
                      asking || !question.trim()
                        ? "bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300"
                        : "bg-lake-green text-white hover:bg-lake-green/90"
                    )}
                  >
                    {asking ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Analisi PDF...
                      </>
                    ) : (
                      <>
                        <Send size={12} />
                        Invia Domanda
                      </>
                    )}
                  </button>
                </form>

                {/* Question & Answer Responses Section */}
                <AnimatePresence>
                  {(answer || qaError) && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="mt-6 space-y-4 pt-5 border-t border-slate-200"
                      ref={answerRef}
                    >
                      {qaError && (
                        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl flex gap-2 items-start text-xs">
                          <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                          <span>{qaError}</span>
                        </div>
                      )}

                      {answer && (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1 text-[9px] font-black uppercase text-slate-500 tracking-wider">
                            <Sparkles size={10} className="text-accent-gold" />
                            <span>Risposta Trovata</span>
                          </div>
                          <div className="p-3.5 bg-white border border-slate-200 rounded-xl text-xs leading-relaxed text-slate-800 font-normal">
                            {answer}
                          </div>
                          <p className="text-[9px] text-slate-400 italic text-right mt-1">
                            *Le risposte sono fornite da Gemini basandosi sul PDF caricato sul server.
                          </p>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Admin Tools Footer Section */}
          {isAdmin && (
            <div className="bg-rose-50 border border-rose-100 rounded-2xl p-5 md:p-6 shadow-sm overflow-hidden relative">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-rose-700">
                    <Trash2 size={16} />
                    <h3 className="font-black uppercase text-xs tracking-wider">Amministrazione: Pannello Aggiornamento PDF</h3>
                  </div>
                  <p className="text-slate-500 text-[11px] leading-normal font-light max-w-xl">
                    Se hai caricato un nuovo file del calendario venatorio per la stagione o modificato le disposizioni, clicca qui per svuotare i vecchi dati sintetizzati e ordinare all'AI di rileggere il PDF per generare e catalogare la nuova sintesi.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {extracting ? (
                    <div className="flex items-center gap-2 px-4 py-2 border border-rose-200 bg-rose-100 text-rose-800 text-xs font-bold rounded-lg animate-pulse">
                      <RefreshCw size={14} className="animate-spin" />
                      Analisi & Sostituzione in corso...
                    </div>
                  ) : showConfirmReset ? (
                    <div className="flex items-center gap-2 bg-white border border-rose-200 p-1.5 rounded-lg shadow-sm">
                      <span className="text-[10px] font-bold text-rose-700 uppercase px-2">Vuoi davvero procedere?</span>
                      <button
                        onClick={handleResetAndExtract}
                        className="bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-black uppercase py-1.5 px-3 rounded cursor-pointer transition-all"
                      >
                        Sì, cancella e rigenera
                      </button>
                      <button
                        onClick={() => setShowConfirmReset(false)}
                        className="text-slate-400 hover:text-slate-600 text-[10px] font-bold uppercase py-1.5 px-2 cursor-pointer transition-all"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowConfirmReset(true)}
                      className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-sm cursor-pointer flex items-center gap-2"
                    >
                      <RefreshCw size={14} />
                      Svuota Tutto ed Estrapola Dati
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
