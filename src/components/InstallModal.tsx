import React from 'react';
import { Download, X, Smartphone, CheckCircle2, ArrowRight } from 'lucide-react';

interface InstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  deferredPrompt: any;
  onNativeInstall?: () => void;
}

export function InstallModal({ isOpen, onClose, deferredPrompt, onNativeInstall }: InstallModalProps) {
  if (!isOpen) return null;

  const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = typeof navigator !== 'undefined' && /Android/.test(navigator.userAgent);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-lake-green/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl border-t-8 border-accent-gold text-slate-800 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition-colors"
        >
          <X size={20} />
        </button>

        <div className="w-16 h-16 bg-accent-gold/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-accent-gold/40">
          <Download className="text-lake-green" size={32} />
        </div>

        <h3 className="text-xl font-bold text-slate-900 text-center mb-1 font-serif">
          Installa App "Gestione Lago"
        </h3>
        <p className="text-slate-500 text-xs text-center mb-6 font-medium">
          Accesso rapido a schermo intero senza barra del browser
        </p>

        {deferredPrompt ? (
          <div className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-emerald-900 text-xs flex items-start gap-3">
              <CheckCircle2 size={20} className="text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block text-sm mb-0.5">Dispositivo pronto</span>
                Tocca il pulsante qui sotto per avviare l'installazione nativa dell'app sul tuo telefono.
              </div>
            </div>
            <button
              onClick={() => {
                if (onNativeInstall) onNativeInstall();
              }}
              className="w-full bg-lake-green hover:bg-lake-green/90 text-white font-bold py-4 px-6 rounded-xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 uppercase text-xs tracking-widest cursor-pointer"
            >
              <Download size={18} />
              Installa Ora
            </button>
          </div>
        ) : (
          <div className="space-y-4 text-left">
            {isIOS ? (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                  <Smartphone size={18} className="text-lake-green" />
                  Istruzioni per iPhone / iPad:
                </div>
                <ol className="text-xs text-slate-600 space-y-2 list-decimal list-inside font-medium leading-relaxed">
                  <li>
                    Tocca il pulsante <strong>Condividi</strong> in basso su Safari (<span className="text-blue-600 font-bold">⎋</span>).
                  </li>
                  <li>
                    Scorri e seleziona <strong>"Aggiungi alla schermata Home"</strong> (<span className="font-bold">+</span>).
                  </li>
                  <li>
                    Conferma toccando <strong>"Aggiungi"</strong> in alto a destra.
                  </li>
                </ol>
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                  <Smartphone size={18} className="text-lake-green" />
                  Istruzioni per Android (Chrome):
                </div>
                <ol className="text-xs text-slate-600 space-y-2 list-decimal list-inside font-medium leading-relaxed">
                  <li>
                    Tocca i <strong>tre puntini (⋮)</strong> in alto a destra nel browser Chrome.
                  </li>
                  <li>
                    Seleziona <strong>"Installa app"</strong> (o "Aggiungi a schermata Home").
                  </li>
                  <li>
                    Premi <strong>"Installa"</strong> per salvare l'icona sul tuo telefono.
                  </li>
                </ol>
              </div>
            )}

            <button
              onClick={onClose}
              className="w-full bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-3 px-6 rounded-xl transition-all text-xs uppercase tracking-widest cursor-pointer mt-2"
            >
              Ho Capito
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
