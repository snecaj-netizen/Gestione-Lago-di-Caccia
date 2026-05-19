import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { FileText, Download, ExternalLink, ShieldCheck, Eye, Info, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';

export function Regulation() {
  const pdfUrl = "/regulation.pdf"; // Generic path handled by the server
  const [pdfExists, setPdfExists] = useState<boolean | null>(null);

  useEffect(() => {
    fetch('/api/admin/check-regulation')
      .then(res => res.json())
      .then(data => setPdfExists(data.exists))
      .catch(() => setPdfExists(false));
  }, []);

  if (pdfExists === false) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-center space-y-4">
        <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center text-amber-500">
          <AlertCircle size={32} />
        </div>
        <h1 className="text-2xl font-serif text-slate-800">Documento non disponibile</h1>
        <p className="text-slate-500 max-w-sm">
          Il Calendario Venatorio non è stato correttamente caricato. 
          Contatta l'amministratore (Stefano) per caricare il PDF aggiornato.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif text-lake-green">Regolamento PDF</h1>
          <p className="text-slate-gray font-medium">Calendario Venatorio Regionale 2026/27</p>
        </div>
        {pdfExists && (
          <a 
            href={pdfUrl}
            download
            className="flex items-center gap-2 bg-lake-green text-white px-6 py-3 rounded-xl font-bold hover:bg-lake-green/90 active:scale-95 transition-all shadow-lg"
          >
            <Download size={20} />
            Scarica PDF
          </a>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Info Column */}
        <div className="lg:col-span-1 space-y-4">
          <div className="card-polish bg-white p-6 border-l-4 border-accent-gold">
            <div className="flex items-center gap-2 text-accent-gold mb-3">
              <ShieldCheck size={20} />
              <h3 className="font-black text-[10px] uppercase tracking-widest">Validità</h3>
            </div>
            <p className="text-sm font-bold text-slate-800">Stagione 2026/2027</p>
            <p className="text-xs text-slate-500 mt-1">Approvato dalla Giunta Regionale.</p>
          </div>

          <div className="card-polish bg-white p-6 border-l-4 border-lake-green">
            <div className="flex items-center gap-2 text-lake-green mb-3">
              <Info size={20} />
              <h3 className="font-black text-[10px] uppercase tracking-widest">Promemoria</h3>
            </div>
            <ul className="space-y-3">
              <li className="flex gap-2 items-start text-xs text-slate-600">
                <div className="w-1 h-1 rounded-full bg-lake-green mt-1.5 shrink-0" />
                Porta sempre con te il tesserino venatorio originale.
              </li>
              <li className="flex gap-2 items-start text-xs text-slate-600">
                <div className="w-1 h-1 rounded-full bg-lake-green mt-1.5 shrink-0" />
                Segna i capi abbattuti subito dopo il recupero.
              </li>
              <li className="flex gap-2 items-start text-xs text-slate-600">
                <div className="w-1 h-1 rounded-full bg-lake-green mt-1.5 shrink-0" />
                Rispetta rigorosamente gli orari di caccia.
              </li>
            </ul>
          </div>
        </div>

        {/* PDF Viewer Column */}
        <div className="lg:col-span-3 space-y-4">
          <div className="card-polish bg-slate-100 !p-0 overflow-hidden shadow-inner h-[70vh] sm:h-[80vh] relative group border-2 border-slate-200">
            {/* Fallback / Background Message */}
            <div className="absolute inset-0 z-0 flex flex-col items-center justify-center p-6 text-center bg-slate-50">
               <Eye size={48} className="mb-4 text-slate-300" />
               <h3 className="text-sm font-bold text-slate-600 uppercase tracking-widest mb-2">Visualizzazione Documento</h3>
               <p className="text-xs text-slate-500 max-w-[280px]">
                 Se il tuo browser blocca l'anteprima, clicca sul pulsante qui sotto per aprirlo in una nuova scheda o scaricarlo.
               </p>
               <a 
                href={pdfUrl} 
                target="_blank" 
                rel="noreferrer"
                className="mt-6 flex items-center gap-2 bg-lake-green text-white px-6 py-3 rounded-xl font-bold hover:bg-lake-green/90 transition-all shadow-md"
              >
                <ExternalLink size={20} />
                Apri Regolamento
              </a>
            </div>

            {/* The PDF Viewer (Native Browser Plugin) */}
            <object
              data={pdfUrl}
              type="application/pdf"
              className="w-full h-full relative z-10 block"
            >
              {/* This content only shows if <object> is not supported */}
              <div className="w-full h-full flex flex-col items-center justify-center p-10 bg-slate-50 relative z-20">
                <FileText size={64} className="text-slate-300 mb-4" />
                <p className="text-slate-600 font-bold mb-4">L'anteprima non è supportata dal tuo browser.</p>
                <a 
                  href={pdfUrl} 
                  target="_blank" 
                  rel="noreferrer"
                  className="bg-lake-green text-white px-6 py-3 rounded-xl font-bold shadow-lg"
                >
                  Scarica o Visualizza PDF
                </a>
              </div>
            </object>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-off-white/50 rounded-xl border border-dashed border-slate-200">
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-tighter">Powered by Native PDF Engine • Navigazione ottimizzata per Desktop e PWA</p>
            <div className="flex gap-2">
              <a href={pdfUrl} target="_blank" rel="noreferrer" className="text-[10px] font-black text-blue-500 uppercase tracking-widest hover:underline">Nuova Finestra</a>
              <span className="text-slate-300">|</span>
              <a href={pdfUrl} download className="text-[10px] font-black text-emerald-600 uppercase tracking-widest hover:underline">Download Diretto</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
