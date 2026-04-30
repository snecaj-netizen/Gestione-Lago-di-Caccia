import React, { useState, useEffect } from 'react';
import { subscribeToPhotos, addPhoto, updatePhoto, deletePhoto } from '../services';
import { HuntingPhoto } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { 
  Camera, 
  Plus, 
  X, 
  Trash2, 
  Edit2, 
  Calendar as CalendarIcon, 
  User as UserIcon,
  Filter,
  Image as ImageIcon,
  Upload,
  ImagePlus
} from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { useSearchParams } from 'react-router-dom';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

const MAX_IMAGE_SIZE = 800; // max width/height in px

export function Gallery() {
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const galleryInputRef = React.useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<HuntingPhoto[]>([]);
  
  const showAddModal = searchParams.get('modal') === 'add';
  const showEditModal = searchParams.get('modal') === 'edit';
  const selectedPhotoId = searchParams.get('view');
  const selectedPhoto = photos.find(p => p.id === selectedPhotoId) || null;

  const setShowAddModal = (val: boolean) => {
    if (val) {
      setSearchParams({ modal: 'add' });
    } else {
      setSearchParams({});
    }
  };

  const setShowEditModal = (val: boolean) => {
    if (val) {
      setSearchParams({ modal: 'edit' });
    } else {
      setSearchParams({});
    }
  };

  const setSelectedPhoto = (photo: HuntingPhoto | null) => {
    if (photo) {
      setSearchParams({ view: photo.id });
    } else {
      setSearchParams({});
    }
  };

  const [editingPhoto, setEditingPhoto] = useState<HuntingPhoto | null>(null);
  const [photoToDelete, setPhotoToDelete] = useState<HuntingPhoto | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [batchPhotos, setBatchPhotos] = useState<{url: string, caption: string, date: string}[]>([]);
  const [isPublishing, setIsPublishing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'mine'>('all');

  useEffect(() => {
    const unsub = subscribeToPhotos((data) => {
      setPhotos(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handlePublishBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || batchPhotos.length === 0) return;
    
    setIsPublishing(true);
    try {
      for (const photo of batchPhotos) {
        await addPhoto({
          url: photo.url,
          caption: photo.caption,
          date: photo.date
        }, profile);
      }
      setShowAddModal(false);
      setBatchPhotos([]);
    } catch (err) {
      console.error("Error publishing photos:", err);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const defaultDate = format(new Date(), 'yyyy-MM-dd');

    Array.from(files as FileList).forEach((file: File) => {
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
          setBatchPhotos(prev => [...prev, { url: dataUrl, caption: '', date: defaultDate }]);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const updateBatchItem = (index: number, updates: any) => {
    setBatchPhotos(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...updates };
      return copy;
    });
  };

  const removeBatchItem = (index: number) => {
    setBatchPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleEditPhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPhoto) return;
    
    await updatePhoto(editingPhoto.id, {
      caption: editingPhoto.caption,
      date: editingPhoto.date
    });
    
    setShowEditModal(false);
    setEditingPhoto(null);
  };

  const handleDeletePhoto = async () => {
    if (!photoToDelete) return;
    try {
      const idToDelete = photoToDelete.id;
      await deletePhoto(idToDelete);
      if (selectedPhotoId === idToDelete) {
        setSelectedPhoto(null);
      }
      setPhotoToDelete(null);
    } catch (err) {
      console.error("Delete error:", err);
      alert("Errore durante l'eliminazione della foto.");
    }
  };

  const canManage = (photo: HuntingPhoto) => {
    return profile?.role === 'admin' || photo.userUid === profile?.uid;
  };

  const filteredPhotos = filter === 'mine' 
    ? photos.filter(p => p.userUid === profile?.uid) 
    : photos;

  return (
    <div className="space-y-8">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif text-lake-green">Galleria Fotografica</h1>
          <p className="text-slate-gray font-medium">Condividi i momenti della tua giornata al lago</p>
        </div>
        <div className="flex gap-2">
          <div className="flex bg-white rounded-lg border border-slate-200 p-1 shadow-sm">
            <button 
              onClick={() => setFilter('all')}
              className={cn(
                "px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded transition-all",
                filter === 'all' ? "bg-lake-green text-white shadow-md" : "text-slate-400 hover:text-lake-green"
              )}
            >
              Tutte
            </button>
            <button 
              onClick={() => setFilter('mine')}
              className={cn(
                "px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded transition-all",
                filter === 'mine' ? "bg-lake-green text-white shadow-md" : "text-slate-400 hover:text-lake-green"
              )}
            >
              Le Mie
            </button>
          </div>
          <button 
            onClick={() => setShowAddModal(true)}
            className="bg-lake-green text-accent-gold font-black text-[0.7rem] uppercase tracking-widest px-6 py-3 rounded shadow-lg hover:bg-opacity-90 flex items-center gap-2 transition-all active:scale-95"
          >
            <Camera size={16} /> Aggiungi Foto
          </button>
        </div>
      </header>

      {loading ? (
        <div className="flex justify-center p-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-lake-green"></div>
        </div>
      ) : filteredPhotos.length === 0 ? (
        <div className="card-polish flex flex-col items-center justify-center p-20 text-center opacity-60">
          <ImageIcon size={64} className="text-slate-300 mb-4" />
          <p className="text-slate-500 font-medium">Nessuna foto presente nella galleria.</p>
          <p className="text-xs text-slate-400 uppercase tracking-widest mt-1">Carica il tuo primo scatto!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredPhotos.map((photo) => (
            <div key={photo.id} className="card-polish !p-0 overflow-hidden flex flex-col group hover:shadow-xl transition-all duration-300">
              <div 
                onClick={() => setSelectedPhoto(photo)}
                className="aspect-square bg-slate-100 relative overflow-hidden cursor-pointer"
              >
                <img 
                  src={photo.url} 
                  alt={photo.caption || 'Foto di caccia'} 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  referrerPolicy="no-referrer"
                />

                {/* Plus Overlay for viewing */}
                <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="bg-white/20 backdrop-blur-sm p-3 rounded-full border border-white/30 transform scale-75 group-hover:scale-100 transition-all">
                    <Plus className="text-white" size={24} />
                  </div>
                </div>
              </div>
              <div className="p-4 bg-white flex-1 flex flex-col">
                <div className="mb-2">
                  <div className="flex items-center justify-between gap-1.5 text-[9px] font-black uppercase text-slate-400 tracking-widest mb-2">
                    <div className="flex items-center gap-1.5">
                      <UserIcon size={10} className="text-lake-green" />
                      {photo.userName}
                    </div>
                    
                    {/* Management Buttons - BACK WHERE THEY WERE */}
                    {canManage(photo) && (
                      <div className="flex gap-1">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingPhoto(photo);
                            setShowEditModal(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-lake-green transition-colors"
                          title="Modifica"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setPhotoToDelete(photo);
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors"
                          title="Elimina"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="text-xs font-bold text-slate-700 leading-snug line-clamp-2 mb-3">
                    {photo.caption || <em className="text-slate-300 font-normal">Senza descrizione</em>}
                  </p>
                  <div className="flex items-center justify-between text-[10px] font-medium text-slate-400 border-t border-slate-50 pt-3">
                    <div className="flex items-center gap-1.5">
                      <CalendarIcon size={12} />
                      {photo.date ? format(new Date(photo.date), 'dd MMM yyyy', { locale: it }) : 'N/D'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Photo Detail Modal */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-sm p-4">
          <button 
            onClick={() => setSelectedPhoto(null)}
            className="absolute top-6 right-6 text-white p-2 bg-white/10 rounded-full hover:bg-white/20 transition-all z-[210]"
          >
            <X size={32} />
          </button>
          
          <div className="max-w-5xl w-full h-full flex flex-col items-center justify-center">
            <div className="relative w-full h-[70vh] flex items-center justify-center mb-6">
              <img 
                src={selectedPhoto.url} 
                alt={selectedPhoto.caption || 'Dettaglio foto'} 
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                referrerPolicy="no-referrer"
              />
            </div>
            
            <div className="text-center space-y-4 max-w-2xl">
              <p className="text-white text-lg font-serif italic">
                {selectedPhoto.caption || 'Nessuna descrizione'}
              </p>
              <div className="flex items-center justify-center gap-6">
                <div className="flex items-center gap-2 text-white/60 text-xs font-black uppercase tracking-widest">
                  <UserIcon size={14} className="text-accent-gold" />
                  {selectedPhoto.userName}
                </div>
                <div className="flex items-center gap-2 text-white/60 text-xs font-medium">
                  <CalendarIcon size={14} className="text-accent-gold" />
                  {selectedPhoto.date ? format(new Date(selectedPhoto.date), 'dd MMMM yyyy', { locale: it }) : 'N/D'}
                </div>
              </div>
              
              {canManage(selectedPhoto) && (
                <div className="pt-8 flex justify-center gap-6">
                  <button 
                    onClick={() => {
                      setEditingPhoto(selectedPhoto);
                      setShowEditModal(true);
                      setSelectedPhoto(null);
                    }}
                    className="flex items-center justify-center p-4 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all border border-white/20 shadow-2xl backdrop-blur-md hover:scale-110"
                    title="Modifica Foto"
                  >
                    <Edit2 size={24} />
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setPhotoToDelete(selectedPhoto);
                    }}
                    className="flex items-center justify-center p-4 bg-rose-500/30 hover:bg-rose-500/50 text-rose-100 rounded-full transition-all border border-rose-500/40 shadow-2xl backdrop-blur-md hover:scale-110"
                    title="Elimina Foto"
                  >
                    <Trash2 size={24} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Photo Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-lake-green/80 backdrop-blur-md">
          <div className="bg-white rounded-lg p-6 sm:p-10 max-w-md w-full shadow-2xl border-t-8 border-accent-gold relative max-h-[90vh] overflow-y-auto">
            <button 
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-900 transition-colors"
            >
              <X size={24} />
            </button>
            
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="bg-off-white p-3 rounded border border-slate-100 text-lake-green">
                  <Camera size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-serif text-lake-green leading-none mb-1">Carica Foto</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Condividi un momento speciale</p>
                </div>
              </div>
              {batchPhotos.length > 0 && (
                <span className="bg-lake-green text-white text-[10px] font-black px-2 py-1 rounded-full">{batchPhotos.length} foto selezionate</span>
              )}
            </div>

            <form onSubmit={handlePublishBatch} className="space-y-6">
              <div className="space-y-4">
                <input 
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                />
                
                <input 
                  type="file"
                  accept="image/*"
                  multiple
                  ref={galleryInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                />
                
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="py-4 border-2 border-dashed border-slate-200 rounded-xl hover:border-lake-green hover:bg-slate-50 transition-all flex flex-col items-center justify-center gap-2 group"
                  >
                    <div className="p-2 bg-slate-100 rounded-full group-hover:bg-lake-green group-hover:text-white transition-colors">
                      <Camera size={20} />
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Scatta Foto</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    className="py-4 border-2 border-dashed border-slate-200 rounded-xl hover:border-lake-green hover:bg-slate-50 transition-all flex flex-col items-center justify-center gap-2 group"
                  >
                    <div className="p-2 bg-slate-100 rounded-full group-hover:bg-lake-green group-hover:text-white transition-colors">
                      <ImagePlus size={20} />
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Scegli Libreria</p>
                    </div>
                  </button>
                </div>
              </div>

              {batchPhotos.length > 0 && (
                <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                  {batchPhotos.map((item, index) => (
                    <div key={index} className="bg-off-white p-4 rounded-lg border border-slate-100 space-y-3 relative group">
                      <button 
                        type="button"
                        onClick={() => removeBatchItem(index)}
                        className="absolute top-2 right-2 p-1 bg-rose-50 text-rose-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={12} />
                      </button>
                      <div className="flex gap-4">
                        <div className="w-20 h-20 bg-white rounded border border-slate-200 overflow-hidden flex-shrink-0">
                          <img src={item.url} alt="preview" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 space-y-3">
                          <div className="space-y-1">
                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Descrizione</label>
                            <input 
                              type="text"
                              value={item.caption}
                              onChange={(e) => updateBatchItem(index, { caption: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:border-lake-green"
                              placeholder="Cosa vedi in questa foto?"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Data</label>
                            <input 
                              type="date"
                              value={item.date}
                              onChange={(e) => updateBatchItem(index, { date: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:border-lake-green"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => { setShowAddModal(false); setBatchPhotos([]); }}
                  className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-[0.6rem] uppercase tracking-widest rounded transition-all"
                >
                  Annulla
                </button>
                <button 
                  type="submit"
                  disabled={batchPhotos.length === 0 || isPublishing}
                  className="flex-1 py-4 bg-lake-green text-accent-gold font-black text-[0.6rem] uppercase tracking-widest rounded shadow-lg hover:bg-opacity-90 active:scale-95 transition-all disabled:opacity-50"
                >
                  {isPublishing ? 'Pubblicazione...' : `Pubblica ${batchPhotos.length} ${batchPhotos.length === 1 ? 'Foto' : 'Foto'}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Photo Modal */}
      {showEditModal && editingPhoto && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-lake-green/80 backdrop-blur-md">
          <div className="bg-white rounded-lg p-6 sm:p-10 max-w-md w-full shadow-2xl border-t-8 border-lake-green relative max-h-[90vh] overflow-y-auto">
            <button 
              onClick={() => { setShowEditModal(false); setEditingPhoto(null); }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-900 transition-colors"
            >
              <X size={24} />
            </button>
            
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-off-white p-3 rounded border border-slate-100 text-lake-green">
                <Edit2 size={24} />
              </div>
              <div>
                <h3 className="text-xl font-serif text-lake-green leading-none mb-1">Modifica Foto</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Aggiorna descrizione o data</p>
              </div>
            </div>

            <form onSubmit={handleEditPhoto} className="space-y-6">
              <div className="aspect-video bg-off-white rounded border border-slate-100 overflow-hidden">
                <img 
                  src={editingPhoto.url} 
                  alt="Current" 
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[0.65rem] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                  <ImageIcon size={10} /> Descrizione
                </label>
                <textarea 
                  value={editingPhoto.caption}
                  onChange={(e) => setEditingPhoto({...editingPhoto, caption: e.target.value})}
                  className="w-full bg-off-white border border-slate-200 rounded px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-lake-green h-24 resize-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[0.65rem] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                  <CalendarIcon size={10} /> Data dello Scatto
                </label>
                <input 
                  type="date"
                  value={editingPhoto.date}
                  onChange={(e) => setEditingPhoto({...editingPhoto, date: e.target.value})}
                  className="w-full bg-off-white border border-slate-200 rounded px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-lake-green"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => { setShowEditModal(false); setEditingPhoto(null); }}
                  className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-[0.6rem] uppercase tracking-widest rounded transition-all"
                >
                  Annulla
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-4 bg-lake-green text-accent-gold font-black text-[0.6rem] uppercase tracking-widest rounded shadow-lg hover:bg-opacity-90 active:scale-95 transition-all"
                >
                  Salva Modifiche
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {photoToDelete && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-rose-950/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-lg p-6 sm:p-8 max-w-sm w-full shadow-2xl border-t-8 border-rose-600 relative"
            >
              <h3 className="text-xl font-serif text-slate-900 mb-2">Conferma Eliminazione</h3>
              <p className="text-sm text-slate-500 mb-6">
                Sei sicuro di voler eliminare questa foto? L'azione non può essere annullata.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setPhotoToDelete(null)}
                  className="flex-1 py-3 px-6 rounded bg-slate-100 text-slate-500 font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Annulla
                </button>
                <button
                  onClick={handleDeletePhoto}
                  className="flex-1 py-3 px-6 rounded bg-rose-600 text-white font-black text-xs uppercase tracking-widest hover:bg-rose-700 transition-all shadow-lg active:scale-95"
                >
                  Elimina
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
