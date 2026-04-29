import React, { useState, useEffect } from 'react';
import { 
  addHarvest, 
  updateHarvest,
  deleteHarvest,
  subscribeToHarvests,
  subscribeToUsers
} from '../services';
import { Harvest, UserProfile } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Target, Trash2, Search, Filter, X, Edit2, User } from 'lucide-react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';

export function Harvests() {
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<Harvest[]>([]);
  const [loading, setLoading] = useState(true);
  
  const showModal = searchParams.get('modal') === 'record';
  const showDeleteConfirm = searchParams.get('modal') === 'delete';

  const setShowModal = (val: boolean) => {
    if (val) {
      setSearchParams({ modal: 'record' });
    } else {
      setSearchParams({});
    }
  };

  const setShowDeleteConfirm = (val: boolean) => {
    if (val) {
      setSearchParams({ modal: 'delete' });
    } else {
      setSearchParams({});
    }
  };

  const [editingItem, setEditingItem] = useState<Harvest | null>(null);
  const [itemToDelete, setItemToDelete] = useState<Harvest | null>(null);
  const [speciesSuggestions, setSpeciesSuggestions] = useState<string[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);

  const [formData, setFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    species: '',
    count: 1,
    hunterUid: '',
    hunterName: ''
  });

  useEffect(() => {
    const unsubHarvests = subscribeToHarvests((data) => {
      setItems(data);
      const uniqueSpecies = Array.from(new Set(data.map(i => i.species))).sort();
      setSpeciesSuggestions(uniqueSpecies);
      setLoading(false);
    });

    const unsubUsers = subscribeToUsers((data) => {
      const activeHunters = data.filter(u => u.isActive && (u.role === 'admin' || u.role === 'socio' || u.role === 'quotista'));
      setUsers(activeHunters);
    });

    return () => {
      unsubHarvests();
      unsubUsers();
    };
  }, []);

  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormData({
      date: format(new Date(), 'yyyy-MM-dd'),
      species: '',
      count: 1,
      hunterUid: profile?.uid || '',
      hunterName: profile?.displayName || ''
    });
    setShowModal(true);
  };

  const handleOpenEdit = (item: Harvest) => {
    setEditingItem(item);
    setFormData({
      date: item.date,
      species: item.species,
      count: item.count,
      hunterUid: item.hunterUid,
      hunterName: item.hunterName
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    
    // Ensure hunter information is set
    // For admins, it might have been selected. For others, it's pre-filled or automatic.
    const submissionData = {
      ...formData,
      // Safety: always ensure name matches UID if it's the current user, 
      // or if admin selected a different user, keep those.
      // But if we're not admin, force current user.
      hunterUid: profile.role === 'admin' ? formData.hunterUid : profile.uid,
      hunterName: profile.role === 'admin' ? formData.hunterName : profile.displayName
    };

    if (editingItem) {
      await updateHarvest(editingItem.id, submissionData);
    } else {
      await addHarvest(submissionData);
    }
    setShowModal(false);
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    await deleteHarvest(itemToDelete.id);
    setShowDeleteConfirm(false);
    setItemToDelete(null);
  };

  const filteredItems = items.filter(item => {
    if (!profile) return false;
    if (profile.role === 'admin' || profile.role === 'socio') return true;
    return item.hunterUid === profile.uid;
  });

  const totalBirds = filteredItems.reduce((acc, h) => acc + h.count, 0);

  const canManage = (item: Harvest) => {
    if (!profile) return false;
    return profile.role === 'admin' || item.hunterUid === profile.uid;
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif text-lake-green">Catture & Abbattimenti</h1>
          <p className="text-slate-gray font-medium">Registro dettagliato del prelievo venatorio</p>
        </div>
      </header>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card-polish">
          <span className="text-[0.65rem] font-bold text-slate-gray uppercase tracking-[0.2em] mb-4 block">Prelievo Totale</span>
          <div className="flex items-end gap-2">
            <p className="text-4xl font-black text-slate-900 tracking-tighter">{totalBirds}</p>
            <span className="text-xs font-bold text-slate-400 uppercase pb-1.5">Esemplari</span>
          </div>
        </div>
        <div className="card-polish">
          <span className="text-[0.65rem] font-bold text-lake-green uppercase tracking-[0.2em] mb-4 block">Specie Prevalente</span>
          <p className="text-lg font-bold text-lake-green">
            {filteredItems.length > 0 
              ? Array.from(filteredItems.reduce((acc, item) => {
                  acc.set(item.species, (acc.get(item.species) || 0) + item.count);
                  return acc;
                }, new Map<string, number>()).entries())
                .sort((a, b) => b[1] - a[1])[0][0]
              : 'Nessuna'}
          </p>
        </div>
        <div className="card-polish">
          <span className="text-[0.65rem] font-bold text-accent-gold uppercase tracking-[0.2em] mb-4 block">Media/Giornata</span>
          <p className="text-2xl font-black text-slate-900">
            {filteredItems.length > 0 ? (totalBirds / filteredItems.length).toFixed(1) : '0.0'}
          </p>
        </div>
      </div>

      {/* Floating Action Button */}
      <button
        onClick={handleOpenAdd}
        className="fixed bottom-6 right-6 w-14 h-14 bg-accent-gold text-lake-green rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-40 border-4 border-white"
      >
        <Plus size={32} />
      </button>

      {/* Modal Tool (Add/Edit) */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-lake-green/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-lg p-6 sm:p-8 max-w-xl w-full shadow-2xl border-t-8 border-accent-gold relative max-h-[90vh] overflow-y-auto"
            >
              <button 
                onClick={() => setShowModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-lake-green transition-colors"
              >
                <X size={24} />
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className="bg-off-white p-3 rounded border border-slate-100 text-lake-green">
                  <Target size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-serif text-lake-green leading-none mb-1">
                    {editingItem ? 'Modifica Registrazione' : 'Registra Cattura'}
                  </h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                    {editingItem ? 'Modifica i dati dell\'abbattimento' : 'Inserisci i dati dell\'abbattimento odierno'}
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[0.65rem] font-black text-slate-400 uppercase tracking-widest">Data</label>
                    <input 
                      type="date"
                      required
                      value={formData.date}
                      onChange={e => setFormData({ ...formData, date: e.target.value })}
                      className="w-full bg-off-white border border-slate-200 rounded px-4 py-2.5 text-sm font-bold text-slate-gray outline-none focus:border-lake-green"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[0.65rem] font-black text-slate-400 uppercase tracking-widest">Numero Capi</label>
                    <input 
                      type="number"
                      min="1"
                      required
                      value={formData.count}
                      onChange={e => setFormData({ ...formData, count: parseInt(e.target.value) })}
                      className="w-full bg-off-white border border-slate-200 rounded px-4 py-2.5 text-sm font-bold text-slate-gray outline-none focus:border-lake-green"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-[0.65rem] font-black text-slate-400 uppercase tracking-widest">Specie</label>
                  <input 
                    list="species"
                    required
                    placeholder="Es. Germano, Alzavola..."
                    value={formData.species}
                    onChange={e => setFormData({ ...formData, species: e.target.value })}
                    className="w-full bg-off-white border border-slate-200 rounded px-4 py-2.5 text-sm font-bold text-slate-gray outline-none focus:border-lake-green"
                  />
                  <datalist id="species">
                    {speciesSuggestions.map(s => <option key={s} value={s} />)}
                  </datalist>
                </div>

                {profile?.role === 'admin' && (
                  <div className="space-y-2">
                    <label className="text-[0.65rem] font-black text-slate-400 uppercase tracking-widest">Assegna a Cacciatore</label>
                    <div className="relative">
                      <select 
                        required
                        value={formData.hunterUid}
                        onChange={e => {
                          const user = users.find(u => u.uid === e.target.value);
                          if (user) {
                            setFormData({ 
                              ...formData, 
                              hunterUid: user.uid, 
                              hunterName: user.displayName 
                            });
                          }
                        }}
                        className="w-full bg-off-white border border-slate-200 rounded px-10 py-2.5 text-sm font-bold text-slate-gray outline-none focus:border-lake-green appearance-none"
                      >
                        <option value="" disabled>Seleziona Cacciatore</option>
                        {users.map(u => (
                          <option key={u.uid} value={u.uid}>{u.displayName}</option>
                        ))}
                      </select>
                      <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    </div>
                  </div>
                )}

                <div className="flex gap-4 pt-2">
                  <button 
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 py-3 px-6 rounded bg-slate-100 text-slate-500 font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
                  >
                    Annulla
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-3 px-6 rounded bg-accent-gold text-lake-green font-black text-xs uppercase tracking-widest hover:bg-opacity-90 transition-all shadow-lg active:scale-95"
                  >
                    {editingItem ? 'Salva Modifiche' : 'Registra Abbattimento'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && itemToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-rose-950/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-lg p-6 sm:p-8 max-w-sm w-full shadow-2xl border-t-8 border-rose-600 relative"
            >
              <h3 className="text-xl font-serif text-slate-900 mb-2">Conferma Eliminazione</h3>
              <p className="text-sm text-slate-500 mb-6">
                Sei sicuro di voler eliminare questa registrazione? L'azione non può essere annullata.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-3 px-6 rounded bg-slate-100 text-slate-500 font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Annulla
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 py-3 px-6 rounded bg-rose-600 text-white font-black text-xs uppercase tracking-widest hover:bg-rose-700 transition-all shadow-lg active:scale-95"
                >
                  Elimina
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Harvest Table */}
      <section className="card-polish !p-0 overflow-hidden shadow-sm">
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full text-left min-w-[320px]">
            <thead className="bg-off-white border-b border-slate-100 uppercase tracking-widest text-[0.6rem] sm:text-[0.65rem] font-black text-slate-400">
              <tr>
                <th className="px-3 sm:px-6 py-3 font-bold">Data</th>
                <th className="px-3 sm:px-6 py-3 font-bold">Specie</th>
                <th className="px-3 sm:px-6 py-3 font-bold hidden md:table-cell">Cacciatore</th>
                <th className="px-3 sm:px-6 py-3 font-bold text-right">Q.tà</th>
                <th className="px-3 sm:px-6 py-3 font-bold text-right">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-3 sm:px-6 py-10 text-center text-slate-300 italic font-medium">Caricamento registro...</td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 sm:px-6 py-10 text-center text-slate-300 italic font-medium">Nessun record trovato</td>
                </tr>
              ) : filteredItems.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-3 sm:px-6 py-3 text-xs sm:text-sm font-medium text-slate-600 whitespace-nowrap">
                    {format(new Date(item.date), 'dd MMM', { locale: it })}
                  </td>
                  <td className="px-3 sm:px-6 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Target size={12} className="text-lake-green opacity-40 shrink-0 hidden sm:block" />
                      <span className="text-xs sm:text-sm font-semibold text-lake-green">
                        {item.species}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 sm:px-6 py-3 text-[10px] sm:text-xs text-slate-400 font-medium italic whitespace-nowrap hidden md:table-cell">
                    {item.hunterName}
                  </td>
                  <td className="px-3 sm:px-6 py-3 text-right font-black text-sm sm:text-lg text-slate-900 tracking-tighter">
                    {item.count}
                  </td>
                  <td className="px-3 sm:px-6 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      {canManage(item) && (
                        <>
                          <button 
                            onClick={() => handleOpenEdit(item)}
                            className="p-1 text-slate-400 hover:text-lake-green transition-colors"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button 
                            onClick={() => {
                              setItemToDelete(item);
                              setShowDeleteConfirm(true);
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
