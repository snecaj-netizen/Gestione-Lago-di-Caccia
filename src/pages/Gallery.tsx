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
  ImagePlus,
  ChevronLeft,
  ChevronRight
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
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (val) {
        next.set('modal', 'add');
        next.delete('view');
      } else {
        next.delete('modal');
      }
      return next;
    });
  };

  const setShowEditModal = (val: boolean) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (val) {
        next.set('modal', 'edit');
        next.delete('view');
      } else {
        next.delete('modal');
      }
      return next;
    });
  };

  const setSelectedPhoto = (photo: HuntingPhoto | null) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (photo) {
        next.set('view', photo.id);
        next.delete('modal');
      } else {
        next.delete('view');
      }
      return next;
    });
  };

  const [editingPhoto, setEditingPhoto] = useState<HuntingPhoto | null>(null);
  const [photoToDelete, setPhotoToDelete] = useState<HuntingPhoto | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [batchPhotos, setBatchPhotos] = useState<{url: string, caption: string, date: string}[]>([]);
  const [albumCaption, setAlbumCaption] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'mine'>('all');
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    const unsub = subscribeToPhotos((data) => {
      // Normalize data for backward compatibility
      const normalizedData = data.map(photo => {
        if (!photo.images || !Array.isArray(photo.images)) {
          return {
            ...photo,
            images: [{ 
              url: photo.url || '', 
              caption: photo.caption || '' 
            }],
            albumCaption: photo.caption || ''
          };
        }
        return photo;
      });
      setPhotos(normalizedData);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handlePublishBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || batchPhotos.length === 0) return;
    
    setIsPublishing(true);
    try {
      await addPhoto({
        images: batchPhotos.map(p => ({ url: p.url, caption: p.caption })),
        date: batchPhotos[0].date,
        albumCaption: albumCaption
      }, profile);

      setShowAddModal(false);
      setBatchPhotos([]);
      setAlbumCaption('');
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

  const handleAddPhotosToAlbum = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editingPhoto) return;
    const files = e.target.files;
    if (!files || files.length === 0) return;

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
          setEditingPhoto(prev => {
            if (!prev) return null;
            return {
              ...prev,
              images: [...prev.images, { url: dataUrl, caption: '' }]
            };
          });
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhotoFromAlbum = (index: number) => {
    if (!editingPhoto) return;
    setEditingPhoto(prev => {
      if (!prev) return null;
      return {
        ...prev,
        images: prev.images.filter((_, i) => i !== index)
      };
    });
  };

  const handleEditPhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPhoto) return;
    
    await updatePhoto(editingPhoto.id, {
      images: editingPhoto.images,
      albumCaption: editingPhoto.albumCaption,
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

  // Prevent background scroll when modals are open
  useEffect(() => {
    if (selectedPhoto || showAddModal || showEditModal || photoToDelete) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [selectedPhoto, showAddModal, showEditModal, photoToDelete]);

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
                onClick={() => {
                  setSelectedPhoto(photo);
                  setCurrentImageIndex(0);
                }}
                className="aspect-square bg-slate-100 relative overflow-hidden cursor-pointer"
              >
                <img 
                  src={photo.images[0]?.url} 
                  alt={photo.albumCaption || photo.images[0]?.caption || 'Album di caccia'} 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  referrerPolicy="no-referrer"
                />

                {photo.images.length > 1 && (
                  <div className="absolute top-2 right-2 bg-lake-green/80 backdrop-blur-sm text-white text-[10px] font-black px-2 py-1 rounded-full flex items-center gap-1 shadow-lg border border-white/20">
                    <ImageIcon size={10} /> {photo.images.length} FOTO
                  </div>
                )}

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
                    {photo.albumCaption || photo.images[0]?.caption || <em className="text-slate-300 font-normal">Senza descrizione</em>}
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

      {/* Photo Detail Modal (Slideshow) */}
      <AnimatePresence>
        {selectedPhoto && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[999] flex items-center justify-center bg-black overflow-hidden"
            onClick={() => setSelectedPhoto(null)}
          >
            {/* Hidden button for accessibility but also to ensure click-catch */}
            <div className="sr-only">Modal Dettaglio Foto</div>

            <button 
              onClick={() => setSelectedPhoto(null)}
              className="absolute top-6 right-6 text-white p-3 bg-white/10 rounded-full hover:bg-white/20 transition-all z-[1001] active:scale-95 border border-white/10 shadow-2xl"
            >
              <X size={32} />
            </button>
            
            <div 
              className="w-full h-full flex flex-col relative"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Main Image 영역 - Occupies most of the screen */}
              <div className="relative flex-1 flex items-center justify-center overflow-hidden p-2 sm:p-4">
                <AnimatePresence mode="wait">
                  <motion.img 
                    key={currentImageIndex}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.02 }}
                    transition={{ duration: 0.3 }}
                    src={selectedPhoto.images[currentImageIndex]?.url} 
                    alt={selectedPhoto.images[currentImageIndex]?.caption || 'Dettaglio foto'} 
                    className="max-w-full max-h-full object-contain"
                    referrerPolicy="no-referrer"
                  />
                </AnimatePresence>

                {/* Minimal Navigation Arrows */}
                {selectedPhoto.images.length > 1 && (
                  <>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentImageIndex(prev => prev === 0 ? selectedPhoto.images.length - 1 : prev - 1);
                      }}
                      className="absolute left-4 top-1/2 -translate-y-1/2 p-3 text-white/40 hover:text-white hover:bg-white/10 rounded-full transition-all"
                    >
                      <ChevronLeft size={64} strokeWidth={1} />
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentImageIndex(prev => (prev + 1) % selectedPhoto.images.length);
                      }}
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-3 text-white/40 hover:text-white hover:bg-white/10 rounded-full transition-all"
                    >
                      <ChevronRight size={64} strokeWidth={1} />
                    </button>
                  </>
                )}
              </div>
              
              {/* Elegant Bottom Info Overay */}
              <div className="w-full bg-gradient-to-t from-black/90 via-black/50 to-transparent pt-20 pb-10 px-6">
                <div className="max-w-3xl mx-auto text-center space-y-4">
                  {selectedPhoto.images.length > 1 && (
                    <div className="flex justify-center gap-1.5 mb-6">
                      {selectedPhoto.images.map((_, idx) => (
                        <button
                          key={idx}
                          onClick={() => setCurrentImageIndex(idx)}
                          className={cn(
                            "h-0.5 rounded-full transition-all",
                            idx === currentImageIndex ? "bg-accent-gold w-10" : "bg-white/20 w-4 hover:bg-white/40"
                          )}
                        />
                      ))}
                    </div>
                  )}

                  <h3 className="text-white text-xl sm:text-2xl font-serif italic leading-snug">
                    {selectedPhoto.images[currentImageIndex]?.caption || selectedPhoto.albumCaption || 'Galleria di Caccia'}
                  </h3>
                  
                  <div className="flex items-center justify-center gap-8 pt-2">
                    <div className="flex items-center gap-2.5 text-white/40 text-[10px] font-black uppercase tracking-[0.25em]">
                      <UserIcon size={12} className="text-accent-gold/60" />
                      {selectedPhoto.userName}
                    </div>
                    <div className="flex items-center gap-2.5 text-white/40 text-[10px] font-black uppercase tracking-[0.25em]">
                      <CalendarIcon size={12} className="text-accent-gold/60" />
                      {selectedPhoto.date ? format(new Date(selectedPhoto.date), 'dd MMMM yyyy', { locale: it }) : 'N/D'}
                    </div>
                    {selectedPhoto.images.length > 1 && (
                      <div className="text-accent-gold/60 text-[10px] font-black tracking-widest border border-accent-gold/20 px-2 py-0.5 rounded">
                        {currentImageIndex + 1} / {selectedPhoto.images.length}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
        </motion.div>
        )}
      </AnimatePresence>

      {/* Add Photo Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
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
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Descrizione dell'Album</label>
                  <textarea 
                    value={albumCaption}
                    onChange={(e) => setAlbumCaption(e.target.value)}
                    className="w-full bg-off-white border border-slate-200 rounded px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-lake-green h-20 resize-none"
                    placeholder="Descrivi questo set di foto..."
                  />
                </div>

                {/* Inputs removed from here and moved to bottom */}
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
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
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
              <div className="space-y-2">
                <label className="text-[0.65rem] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                  <ImageIcon size={10} /> Titolo Album / Descrizione
                </label>
                <textarea 
                  value={editingPhoto.albumCaption}
                  onChange={(e) => setEditingPhoto({...editingPhoto, albumCaption: e.target.value})}
                  className="w-full bg-off-white border border-slate-200 rounded px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-lake-green h-20 resize-none"
                />
              </div>

              <div className="space-y-4 max-h-[30vh] overflow-y-auto pr-2 custom-scrollbar">
                {editingPhoto.images.map((img, idx) => (
                  <div key={idx} className="flex gap-4 p-3 bg-off-white rounded-lg border border-slate-100 relative group">
                    <button 
                      type="button"
                      onClick={() => removePhotoFromAlbum(idx)}
                      className="absolute -top-2 -right-2 p-1.5 bg-rose-500 text-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10"
                      title="Rimuovi Foto"
                    >
                      <X size={12} />
                    </button>
                    <div className="w-16 h-16 rounded overflow-hidden flex-shrink-0">
                      <img src={img.url} alt={`img-${idx}`} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Dascrizione Foto {idx + 1}</label>
                      <input 
                        type="text"
                        value={img.caption || ''}
                        onChange={(e) => {
                          const newImages = [...editingPhoto.images];
                          newImages[idx] = { ...newImages[idx], caption: e.target.value };
                          setEditingPhoto({ ...editingPhoto, images: newImages });
                        }}
                        className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs font-bold"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <label className="text-[0.65rem] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                  <Plus size={10} /> Aggiungi nuove foto all'album
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="py-3 border-2 border-dashed border-slate-200 rounded-lg hover:border-lake-green hover:bg-slate-50 transition-all flex items-center justify-center gap-2 group"
                  >
                    <div className="p-1.5 bg-slate-100 rounded-full group-hover:bg-lake-green group-hover:text-white transition-colors">
                      <Camera size={14} />
                    </div>
                    <p className="text-[8px] font-black text-slate-700 uppercase tracking-widest">Camera</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    className="py-3 border-2 border-dashed border-slate-200 rounded-lg hover:border-lake-green hover:bg-slate-50 transition-all flex items-center justify-center gap-2 group"
                  >
                    <div className="p-1.5 bg-slate-100 rounded-full group-hover:bg-lake-green group-hover:text-white transition-colors">
                      <ImagePlus size={14} />
                    </div>
                    <p className="text-[8px] font-black text-slate-700 uppercase tracking-widest">Galleria</p>
                  </button>
                </div>
                {/* Inputs removed from here and moved to bottom */}
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
          <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
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

      {/* Shared Hidden Inputs for both Add and Edit modals */}
      <input 
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        ref={fileInputRef}
        onChange={showEditModal ? handleAddPhotosToAlbum : handleFileChange}
        className="hidden"
      />
      <input 
        type="file"
        accept="image/*"
        multiple
        ref={galleryInputRef}
        onChange={showEditModal ? handleAddPhotosToAlbum : handleFileChange}
        className="hidden"
      />
    </div>
  );
}
