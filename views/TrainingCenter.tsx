import React, { useState, useRef } from 'react';
import { AppData, Equipment, Exercise, Routine, RoutineCategory, TrackingType, RoutineExercise } from '../types';
import { Button } from '../components/Button';
import { Plus, Trash2, Image as ImageIcon, Video, X, Camera, Clock, CheckSquare, Dumbbell, ChevronDown, ChevronUp, Target, Pencil, Package, Search, Check } from 'lucide-react';
import { MediaButtons } from './ActiveWorkout';

interface TrainingCenterProps {
  data: AppData;
  onUpdateData: (newData: Partial<AppData>) => void;
}

type TabType = 'equipment' | 'exercises' | 'routines';

export const TrainingCenterView: React.FC<TrainingCenterProps> = ({ data, onUpdateData }) => {
  const [activeTab, setActiveTab] = useState<TabType>('equipment');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null);
  const [expandedRoutineId, setExpandedRoutineId] = useState<string | null>(null);

  // Editing State
  const [editingId, setEditingId] = useState<string | null>(null);

  // Refs for file inputs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Form States
  const [newItemName, setNewItemName] = useState('');
  const [newItemDesc, setNewItemDesc] = useState('');
  const [newItemMedia, setNewItemMedia] = useState<string>('');
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<RoutineCategory>('Full Body');

  // Routine specific
  const [selectedRoutineExercises, setSelectedRoutineExercises] = useState<RoutineExercise[]>([]);

  // Exercise specific
  const [selectedTrackingType, setSelectedTrackingType] = useState<TrackingType>('weight_reps');
  const [newItemDefaultSets, setNewItemDefaultSets] = useState<number>(3);
  const [newItemDefaultReps, setNewItemDefaultReps] = useState<number>(10);
  const [newItemDefaultTime, setNewItemDefaultTime] = useState<number>(60);
  const [newItemDefaultWeight, setNewItemDefaultWeight] = useState<number | undefined>(undefined);

  // Exercise Selector State (For adding detailed exercises to routine)
  const [tempExerciseId, setTempExerciseId] = useState<string>('');
  const [tempTargetSets, setTempTargetSets] = useState<number>(3);
  const [tempTargetReps, setTempTargetReps] = useState<number>(10);
  const [tempTargetTime, setTempTargetTime] = useState<number>(60);
  const [tempTargetWeight, setTempTargetWeight] = useState<number | undefined>(undefined);

  // Full-screen exercise picker state
  const [isExercisePickerOpen, setIsExercisePickerOpen] = useState(false);
  const [pickerSelectedIds, setPickerSelectedIds] = useState<string[]>([]);
  const [exerciseSearchQuery, setExerciseSearchQuery] = useState('');

  const resizeImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          if (width > height) {
            if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
          } else {
            if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.src = event.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        if (file.type.startsWith('image/')) {
          const compressedImage = await resizeImage(file);
          setNewItemMedia(compressedImage);
        } else if (file.type.startsWith('video/')) {
          if (file.size > 15 * 1024 * 1024) {
            alert("Video çok büyük.");
            return;
          }
          const reader = new FileReader();
          reader.onloadend = () => {
            setNewItemMedia(reader.result as string);
          };
          reader.readAsDataURL(file);
        }
      } catch (error) {
        console.error("Media processing failed", error);
        alert("Dosya işlenirken bir hata oluştu.");
      }
    }
  };

  const handleSaveItem = () => {
    if (!newItemName.trim()) {
      alert("Lütfen bir isim giriniz.");
      return;
    }
    const id = editingId || Date.now().toString();

    if (activeTab === 'equipment') {
      const newEquipment: Equipment = {
        id,
        name: newItemName,
        notes: newItemDesc,
        image: newItemMedia
      };

      if (editingId) {
        onUpdateData({ equipment: data.equipment.map(i => i.id === id ? newEquipment : i) });
      } else {
        onUpdateData({ equipment: [...data.equipment, newEquipment] });
      }

    } else if (activeTab === 'exercises') {
      const newExercise: Exercise = {
        id,
        name: newItemName,
        description: newItemDesc,
        equipmentIds: selectedEquipmentIds,
        media: newItemMedia,
        trackingType: selectedTrackingType,
        defaultSets: newItemDefaultSets,
        defaultReps: selectedTrackingType === 'weight_reps' ? newItemDefaultReps : undefined,
        defaultTimeSeconds: selectedTrackingType === 'time' ? newItemDefaultTime : undefined,
        defaultWeight: newItemDefaultWeight
      };

      if (editingId) {
        onUpdateData({ exercises: data.exercises.map(i => i.id === id ? newExercise : i) });
      } else {
        onUpdateData({ exercises: [...data.exercises, newExercise] });
      }

    } else {
      const newRoutine: Routine = {
        id,
        name: newItemName,
        category: selectedCategory,
        exercises: selectedRoutineExercises
      };

      if (editingId) {
        onUpdateData({ routines: data.routines.map(i => i.id === id ? newRoutine : i) });
      } else {
        onUpdateData({ routines: [...data.routines, newRoutine] });
      }
    }
    resetForm();
  };

  const handleEditItem = (item: any) => {
    setEditingId(item.id);
    setNewItemName(item.name);

    if (activeTab === 'equipment') {
      setNewItemDesc(item.notes || '');
      setNewItemMedia(item.image || '');
    }
    else if (activeTab === 'exercises') {
      const ex = item as Exercise;
      setNewItemDesc(ex.description || '');
      setNewItemMedia(ex.media || '');
      setSelectedEquipmentIds(ex.equipmentIds || []);
      setSelectedTrackingType(ex.trackingType || 'weight_reps');
      setNewItemDefaultSets(ex.defaultSets || 3);
      setNewItemDefaultReps(ex.defaultReps || 10);
      setNewItemDefaultTime(ex.defaultTimeSeconds || 60);
      setNewItemDefaultWeight(ex.defaultWeight);
    }
    else if (activeTab === 'routines') {
      const rt = item as Routine;
      setSelectedCategory(rt.category);
      setSelectedRoutineExercises(rt.exercises || []);
    }

    setIsModalOpen(true);
  };

  const deleteItem = (id: string, type: TabType) => {
    if (!confirm('Bu öğeyi silmek istediğinize emin misiniz?')) return;
    if (type === 'equipment') onUpdateData({ equipment: data.equipment.filter(i => i.id !== id) });
    if (type === 'exercises') onUpdateData({ exercises: data.exercises.filter(i => i.id !== id) });
    if (type === 'routines') onUpdateData({ routines: data.routines.filter(i => i.id !== id) });
  };

  const resetForm = () => {
    setEditingId(null);
    setNewItemName('');
    setNewItemDesc('');
    setNewItemMedia('');
    setSelectedEquipmentIds([]);
    setSelectedRoutineExercises([]);
    setTempExerciseId('');
    setSelectedTrackingType('weight_reps');

    // Reset defaults
    setNewItemDefaultSets(3);
    setNewItemDefaultReps(10);
    setNewItemDefaultTime(60);
    setNewItemDefaultWeight(undefined);

    setIsModalOpen(false);
  };

  const removeExerciseFromRoutine = (exId: string) => {
    setSelectedRoutineExercises(prev => prev.filter(e => e.exerciseId !== exId));
  };

  const isVideo = (source: string) => source.startsWith('data:video') || source.endsWith('.mp4') || source.endsWith('.mov');

  const getTrackingIcon = (type: TrackingType) => {
    switch (type) {
      case 'time': return <Clock size={14} />;
      case 'completion': return <CheckSquare size={14} />;
      default: return <Dumbbell size={14} />;
    }
  };

  const getTrackingLabel = (type: TrackingType) => {
    switch (type) {
      case 'time': return 'Süre';
      case 'completion': return 'Tamamlama';
      default: return 'Ağırlık & Tekrar';
    }
  };

  return (
    <div className="pb-24">
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 mb-6">
        <h2 className="text-xl font-bold text-slate-900 mb-4">Antrenman Merkezi</h2>
        <div className="flex p-1 bg-slate-100 rounded-lg">
          {(['equipment', 'exercises', 'routines'] as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${activeTab === tab ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
            >
              {tab === 'equipment' && 'Ürünlerim'}
              {tab === 'exercises' && 'Egzersizler'}
              {tab === 'routines' && 'Antrenmanlar'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button onClick={() => { resetForm(); setIsModalOpen(true); }} className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-300 rounded-xl hover:border-brand-500 hover:bg-brand-50 transition-colors group h-full min-h-[100px]">
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-2 group-hover:bg-brand-100 transition-colors">
            <Plus className="w-5 h-5 text-slate-400 group-hover:text-brand-600" />
          </div>
          <span className="font-medium text-slate-500 group-hover:text-brand-700">Yeni Ekle</span>
        </button>

        {activeTab === 'equipment' && data.equipment.map(item => (
          <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4 relative">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-bold text-slate-900">{item.name}</h3>
                {item.image && <MediaButtons media={[item.image]} />}
              </div>
              <p className="text-sm text-slate-500">{item.notes || 'Açıklama yok'}</p>
            </div>
            <div className="flex flex-col gap-2">
              <button onClick={() => handleEditItem(item)} className="text-slate-300 hover:text-brand-600" title="Düzenle">
                <Pencil size={16} />
              </button>
              <button onClick={() => deleteItem(item.id, 'equipment')} className="text-slate-300 hover:text-red-500" title="Sil">
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}

        {activeTab === 'exercises' && data.exercises.map(item => {
          const isExpanded = expandedExerciseId === item.id;
          return (
            <div key={item.id} className={`bg-white rounded-xl shadow-sm border overflow-hidden transition-all ${isExpanded ? 'border-brand-200 ring-1 ring-brand-100' : 'border-slate-100'}`}>
              {/* Sade Header - Toggle */}
              <div
                onClick={() => setExpandedExerciseId(isExpanded ? null : item.id)}
                className="p-4 cursor-pointer flex items-center justify-between hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-1.5 rounded-lg transition-transform duration-200 ${isExpanded ? 'rotate-90 bg-brand-100' : 'bg-slate-100'}`}>
                    <ChevronDown size={16} className={`text-slate-500 transition-transform ${isExpanded ? 'rotate-[-90deg]' : ''}`} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 flex items-center gap-2">
                      {item.name}
                      {item.media && <MediaButtons media={[item.media]} compact />}
                    </h3>
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      {getTrackingIcon(item.trackingType || 'weight_reps')} {getTrackingLabel(item.trackingType || 'weight_reps')}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => handleEditItem(item)} className="p-1.5 text-slate-300 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors" title="Düzenle">
                    <Pencil size={16} />
                  </button>
                  <button onClick={() => deleteItem(item.id, 'exercises')} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Sil">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Genişletilmiş Detaylar */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-slate-100 bg-slate-50/50 animate-in slide-in-from-top-1 duration-150">
                  {/* Hedefler */}
                  <div className="flex flex-wrap gap-2 mt-3 mb-3">
                    {item.defaultSets && (
                      <span className="bg-brand-50 px-2.5 py-1 rounded-full text-brand-700 border border-brand-100 font-medium text-xs">
                        {item.defaultSets} set
                      </span>
                    )}
                    {item.trackingType === 'weight_reps' && item.defaultReps && (
                      <span className="bg-blue-50 px-2.5 py-1 rounded-full text-blue-700 border border-blue-100 font-medium text-xs">
                        {item.defaultReps} tekrar
                      </span>
                    )}
                    {item.defaultWeight && (
                      <span className="bg-purple-50 px-2.5 py-1 rounded-full text-purple-700 border border-purple-100 font-medium text-xs">
                        {item.defaultWeight} kg
                      </span>
                    )}
                    {item.trackingType === 'time' && item.defaultTimeSeconds && (
                      <span className="bg-amber-50 px-2.5 py-1 rounded-full text-amber-700 border border-amber-100 font-medium text-xs">
                        {Math.floor(item.defaultTimeSeconds / 60) > 0 ? `${Math.floor(item.defaultTimeSeconds / 60)} dk ` : ''}{item.defaultTimeSeconds % 60 > 0 ? `${item.defaultTimeSeconds % 60} sn` : ''}
                      </span>
                    )}
                  </div>

                  {/* Açıklama */}
                  {item.description && (
                    <p className="text-sm text-slate-600 mb-3 italic">{item.description}</p>
                  )}

                  {/* Ekipmanlar */}
                  {item.equipmentIds.length > 0 && (
                    <div className="pt-2 border-t border-slate-200">
                      <p className="text-xs font-medium text-slate-500 mb-2">Ekipmanlar:</p>
                      <div className="flex flex-wrap gap-2">
                        {item.equipmentIds.map(eqId => {
                          const eq = data.equipment.find(e => e.id === eqId);
                          if (!eq) return null;
                          return (
                            <span key={eqId} className="inline-flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700 font-medium shadow-sm">
                              <span>{eq.name}</span>
                              {eq.image && (
                                <div className="shrink-0 border-l border-slate-200 pl-1.5">
                                  <MediaButtons media={[eq.image]} compact={true} />
                                </div>
                              )}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {activeTab === 'routines' && data.routines.map(item => {
          const isExpanded = expandedRoutineId === item.id;
          return (
            <div key={item.id} className={`bg-white rounded-xl shadow-sm border overflow-hidden transition-all ${isExpanded ? 'border-brand-200 ring-1 ring-brand-100' : 'border-slate-100'}`}>
              {/* Sade Header - Toggle */}
              <div
                onClick={() => setExpandedRoutineId(isExpanded ? null : item.id)}
                className="p-4 cursor-pointer flex items-center justify-between hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-1.5 rounded-lg transition-transform duration-200 ${isExpanded ? 'rotate-90 bg-brand-100' : 'bg-slate-100'}`}>
                    <ChevronDown size={16} className={`text-slate-500 transition-transform ${isExpanded ? 'rotate-[-90deg]' : ''}`} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 flex items-center gap-2">
                      {item.name}
                      <span className="text-xs font-medium bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full">{item.category}</span>
                    </h3>
                    <span className="text-xs text-slate-500">{item.exercises.length} egzersiz</span>
                  </div>
                </div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => handleEditItem(item)} className="p-1.5 text-slate-300 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors" title="Düzenle">
                    <Pencil size={16} />
                  </button>
                  <button onClick={() => deleteItem(item.id, 'routines')} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Sil">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Genişletilmiş Detaylar */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-slate-100 bg-slate-50/50 animate-in slide-in-from-top-1 duration-150">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-3 mb-2">Egzersiz Listesi</p>
                  <div className="space-y-2">
                    {item.exercises.map((ex, i) => {
                      const def = data.exercises.find(e => e.id === ex.exerciseId);
                      const formatTime = (seconds?: number) => {
                        if (!seconds) return '';
                        const mins = Math.floor(seconds / 60);
                        const secs = seconds % 60;
                        if (mins === 0) return `${secs} sn`;
                        if (secs === 0) return `${mins} dk`;
                        return `${mins} dk ${secs} sn`;
                      };
                      const equipments = def?.equipmentIds
                        ?.map(eqId => data.equipment.find(eq => eq.id === eqId))
                        .filter(Boolean) || [];
                      return (
                        <div key={i} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {def?.media && <MediaButtons media={[def.media]} compact />}
                              <span className="font-medium text-slate-800">{def?.name || 'Silinmiş Egzersiz'}</span>
                            </div>
                            <span className="text-xs text-slate-400 flex items-center gap-1">
                              {getTrackingIcon(def?.trackingType || 'weight_reps')}
                            </span>
                          </div>
                          {/* Detaylı Hedefler */}
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {ex.targetSets && (
                              <span className="text-[10px] px-2 py-0.5 bg-brand-50 text-brand-700 rounded-full font-medium">
                                {ex.targetSets} set
                              </span>
                            )}
                            {def?.trackingType === 'weight_reps' && ex.targetReps && (
                              <span className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full font-medium">
                                {ex.targetReps} tekrar
                              </span>
                            )}
                            {ex.targetWeight && (
                              <span className="text-[10px] px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full font-medium">
                                {ex.targetWeight} kg
                              </span>
                            )}
                            {def?.trackingType === 'time' && ex.targetTimeSeconds && (
                              <span className="text-[10px] px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full font-medium">
                                {formatTime(ex.targetTimeSeconds)}
                              </span>
                            )}
                          </div>
                          {/* Ekipmanlar */}
                          {equipments.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-slate-100">
                              <div className="flex items-center gap-1 text-[10px] text-slate-500 mb-1">
                                <Package size={10} />
                                <span className="font-medium">Ekipmanlar:</span>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {equipments.map((eq: any) => (
                                  <span key={eq.id} className="inline-flex items-center gap-1 text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                                    {eq.name}
                                    {eq.image && <MediaButtons media={[eq.image]} compact />}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar animate-in slide-in-from-bottom-10 fade-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">
                {editingId ? 'Düzenle' : (
                  activeTab === 'equipment' ? 'Yeni Ürün Ekle' : activeTab === 'exercises' ? 'Yeni Egzersiz Ekle' : 'Yeni Antrenman Programı Ekle'
                )}
              </h3>
              <button onClick={resetForm}><X className="text-slate-400 hover:text-slate-600" /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">İsim</label>
                <input value={newItemName} onChange={(e) => setNewItemName(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2" placeholder={activeTab === 'equipment' ? "Örn: 10kg Dambıl" : "Örn: Şınav"} />
              </div>

              {activeTab === 'exercises' && (
                <div className="space-y-3 border-t border-b border-slate-100 py-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Takip Tipi</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button onClick={() => setSelectedTrackingType('weight_reps')} className={`p-2 rounded-lg border text-sm flex flex-col items-center gap-1 ${selectedTrackingType === 'weight_reps' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600'}`}><Dumbbell size={18} /><span>Ağırlık & Tekrar</span></button>
                      <button onClick={() => setSelectedTrackingType('time')} className={`p-2 rounded-lg border text-sm flex flex-col items-center gap-1 ${selectedTrackingType === 'time' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600'}`}><Clock size={18} /><span>Süre</span></button>
                      <button onClick={() => setSelectedTrackingType('completion')} className={`p-2 rounded-lg border text-sm flex flex-col items-center gap-1 ${selectedTrackingType === 'completion' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600'}`}><CheckSquare size={18} /><span>Yapıldı</span></button>
                    </div>
                  </div>

                  {/* Default Values for Exercises */}
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <div className="flex items-center gap-2 mb-2 text-slate-700 font-medium text-sm">
                      <Target size={16} />
                      <span>Varsayılan Hedefler (Opsiyonel)</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-slate-500 block mb-1">Varsayılan Set</label>
                        <input type="number" min="1" value={newItemDefaultSets} onChange={e => setNewItemDefaultSets(parseInt(e.target.value) || 1)} className="w-full p-2 border border-slate-300 rounded bg-white text-sm" />
                      </div>
                      {selectedTrackingType === 'weight_reps' && (
                        <>
                          <div>
                            <label className="text-xs text-slate-500 block mb-1">Varsayılan Tekrar</label>
                            <input type="number" value={newItemDefaultReps} onChange={e => setNewItemDefaultReps(parseInt(e.target.value) || 0)} className="w-full p-2 border border-slate-300 rounded bg-white text-sm" />
                          </div>
                          <div className="col-span-2">
                            <label className="text-xs text-slate-500 block mb-1">Varsayılan Ağırlık (kg)</label>
                            <input type="number" value={newItemDefaultWeight || ''} onChange={e => setNewItemDefaultWeight(e.target.value ? parseFloat(e.target.value) : undefined)} className="w-full p-2 border border-slate-300 rounded bg-white text-sm" placeholder="Opsiyonel" />
                          </div>
                        </>
                      )}
                      {selectedTrackingType === 'time' && (
                        <div className="col-span-2">
                          <label className="text-xs text-slate-500 block mb-1">Varsayılan Süre</label>
                          <div className="flex gap-2">
                            <div className="flex-1">
                              <input
                                type="number"
                                min="0"
                                value={Math.floor(newItemDefaultTime / 60)}
                                onChange={e => {
                                  const mins = parseInt(e.target.value) || 0;
                                  const currentSecs = newItemDefaultTime % 60;
                                  setNewItemDefaultTime(mins * 60 + currentSecs);
                                }}
                                className="w-full p-2 border border-slate-300 rounded bg-white text-sm"
                              />
                              <span className="text-xs text-slate-400 mt-0.5 block">dakika</span>
                            </div>
                            <div className="flex-1">
                              <input
                                type="number"
                                min="0"
                                max="59"
                                value={newItemDefaultTime % 60}
                                onChange={e => {
                                  const secs = Math.min(59, Math.max(0, parseInt(e.target.value) || 0));
                                  const currentMins = Math.floor(newItemDefaultTime / 60);
                                  setNewItemDefaultTime(currentMins * 60 + secs);
                                }}
                                className="w-full p-2 border border-slate-300 rounded bg-white text-sm"
                              />
                              <span className="text-xs text-slate-400 mt-0.5 block">saniye</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2 leading-tight">
                      * Bu değerler serbest antrenman sırasında egzersizi eklediğinizde otomatik olarak setleri doldurur.
                    </p>
                  </div>
                </div>
              )}

              {activeTab !== 'routines' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{activeTab === 'equipment' ? 'Fotoğraf / Video' : 'Görsel / Video'}</label>
                  {newItemMedia ? (
                    <div className="relative h-48 bg-black/5 rounded-lg overflow-hidden border border-slate-200 group flex items-center justify-center">
                      {isVideo(newItemMedia) ? <video src={newItemMedia} controls className="w-full h-full object-contain" /> : <img src={newItemMedia} className="w-full h-full object-contain" />}
                      <button onClick={() => setNewItemMedia('')} className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full shadow-sm hover:bg-red-600 transition-colors z-10"><X size={16} /></button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      <input type="file" ref={fileInputRef} onChange={handleMediaUpload} accept="image/*,video/*" className="hidden" />
                      <input type="file" ref={cameraInputRef} onChange={handleMediaUpload} accept="image/*" capture="environment" className="hidden" />
                      <input type="file" ref={videoInputRef} onChange={handleMediaUpload} accept="video/*" capture="environment" className="hidden" />
                      <div onClick={() => fileInputRef.current?.click()} className="h-24 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-all text-center px-1"><ImageIcon className="w-6 h-6 text-slate-400 mb-1" /><span className="text-[10px] font-medium text-slate-500">Galeri</span></div>
                      <div onClick={() => cameraInputRef.current?.click()} className="h-24 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-all text-center px-1"><Camera className="w-6 h-6 text-slate-400 mb-1" /><span className="text-[10px] font-medium text-slate-500">Fotoğraf</span></div>
                      <div onClick={() => videoInputRef.current?.click()} className="h-24 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-all text-center px-1"><Video className="w-6 h-6 text-slate-400 mb-1" /><span className="text-[10px] font-medium text-slate-500">Video</span></div>
                    </div>
                  )}
                </div>
              )}

              {activeTab !== 'routines' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Açıklama / Notlar</label>
                  <textarea value={newItemDesc} onChange={(e) => setNewItemDesc(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2" rows={3} />
                </div>
              )}

              {activeTab === 'exercises' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Gerekli Ekipmanlar</label>
                  <div className="flex flex-wrap gap-2">
                    {data.equipment.map(eq => (
                      <button key={eq.id} onClick={() => { setSelectedEquipmentIds(prev => prev.includes(eq.id) ? prev.filter(id => id !== eq.id) : [...prev, eq.id]); }} className={`px-3 py-1 rounded-full text-xs font-medium border ${selectedEquipmentIds.includes(eq.id) ? 'bg-brand-100 border-brand-200 text-brand-700' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>{eq.name}</button>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'routines' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Kategori</label>
                    <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value as RoutineCategory)} className="w-full border border-slate-300 rounded-lg px-3 py-2">
                      {['Full Body', 'Bacak', 'Kol', 'Göğüs', 'Sırt', 'Omuz', 'Kardiyo', 'Esneklik', 'Diğer'].map(c => (<option key={c} value={c}>{c}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Program İçeriği</label>

                    {/* Selected Exercises List */}
                    <div className="space-y-2 mb-3">
                      {selectedRoutineExercises.map((re, idx) => {
                        const def = data.exercises.find(e => e.id === re.exerciseId);
                        const isEditingThisExercise = tempExerciseId === re.exerciseId;

                        if (isEditingThisExercise) {
                          // Düzenleme modu
                          return (
                            <div key={idx} className="bg-slate-100 p-3 rounded-lg border border-slate-300 space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="font-bold text-slate-800 text-sm">{def?.name}</span>
                                <button
                                  onClick={() => setTempExerciseId('')}
                                  className="text-slate-400 hover:text-slate-600 p-1"
                                >
                                  <X size={14} />
                                </button>
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="text-xs text-slate-500 block mb-1">Set</label>
                                  <input
                                    type="number"
                                    min="1"
                                    value={tempTargetSets}
                                    onChange={e => setTempTargetSets(parseInt(e.target.value) || 1)}
                                    className="w-full p-2 border border-slate-200 rounded bg-white text-sm"
                                  />
                                </div>

                                {def?.trackingType === 'weight_reps' && (
                                  <>
                                    <div>
                                      <label className="text-xs text-slate-500 block mb-1">Tekrar</label>
                                      <input
                                        type="number"
                                        value={tempTargetReps}
                                        onChange={e => setTempTargetReps(parseInt(e.target.value) || 0)}
                                        className="w-full p-2 border border-slate-200 rounded bg-white text-sm"
                                      />
                                    </div>
                                    <div className="col-span-2">
                                      <label className="text-xs text-slate-500 block mb-1">Ağırlık (kg)</label>
                                      <input
                                        type="number"
                                        value={tempTargetWeight || ''}
                                        onChange={e => setTempTargetWeight(e.target.value ? parseFloat(e.target.value) : undefined)}
                                        className="w-full p-2 border border-slate-200 rounded bg-white text-sm"
                                        placeholder="Opsiyonel"
                                      />
                                    </div>
                                  </>
                                )}

                                {def?.trackingType === 'time' && (
                                  <div className="col-span-2">
                                    <label className="text-xs text-slate-500 block mb-1">Süre (saniye)</label>
                                    <input
                                      type="number"
                                      value={tempTargetTime}
                                      onChange={e => setTempTargetTime(parseInt(e.target.value) || 0)}
                                      className="w-full p-2 border border-slate-200 rounded bg-white text-sm"
                                    />
                                  </div>
                                )}
                              </div>

                              <Button
                                size="sm"
                                fullWidth
                                onClick={() => {
                                  // Güncelle
                                  setSelectedRoutineExercises(prev => prev.map(item =>
                                    item.exerciseId === re.exerciseId
                                      ? {
                                        ...item,
                                        targetSets: tempTargetSets,
                                        targetReps: def?.trackingType === 'weight_reps' ? tempTargetReps : undefined,
                                        targetTimeSeconds: def?.trackingType === 'time' ? tempTargetTime : undefined,
                                        targetWeight: tempTargetWeight
                                      }
                                      : item
                                  ));
                                  setTempExerciseId('');
                                }}
                              >
                                Kaydet
                              </Button>
                            </div>
                          );
                        }

                        return (
                          <div key={idx} className="flex justify-between items-center bg-brand-50 p-2 rounded-lg border border-brand-100">
                            <div className="text-sm">
                              <div className="font-bold text-brand-800">{def?.name}</div>
                              <div className="text-xs text-brand-600">
                                {re.targetSets} set x {def?.trackingType === 'time' ? `${re.targetTimeSeconds}sn` : `${re.targetReps} tekrar`}
                                {re.targetWeight ? ` @ ${re.targetWeight}kg` : ''}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => {
                                  // Düzenleme moduna geç, mevcut değerleri yükle
                                  setTempExerciseId(re.exerciseId);
                                  setTempTargetSets(re.targetSets);
                                  setTempTargetReps(re.targetReps || 10);
                                  setTempTargetTime(re.targetTimeSeconds || 60);
                                  setTempTargetWeight(re.targetWeight);
                                }}
                                className="text-brand-400 p-1 hover:text-brand-600"
                                title="Düzenle"
                              >
                                <Pencil size={14} />
                              </button>
                              <button onClick={() => removeExerciseFromRoutine(re.exerciseId)} className="text-red-400 p-1 hover:text-red-600" title="Sil">
                                <X size={14} />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Add Exercise Button */}
                    <button
                      onClick={() => {
                        setPickerSelectedIds([]);
                        setExerciseSearchQuery('');
                        setIsExercisePickerOpen(true);
                      }}
                      className="w-full p-3 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 hover:border-brand-400 hover:text-brand-600 hover:bg-brand-50 transition-all flex items-center justify-center gap-2 font-medium"
                    >
                      <Plus size={18} />
                      <span>Egzersiz Ekle</span>
                    </button>
                  </div>
                </>
              )}
              <Button onClick={handleSaveItem} fullWidth className="mt-4">{editingId ? 'Güncelle' : 'Kaydet'}</Button>
            </div>
          </div>
        </div>
      )}

      {/* Full-screen Exercise Picker Modal */}
      {isExercisePickerOpen && (
        <div className="fixed inset-0 bg-white z-[60] flex flex-col animate-in slide-in-from-bottom duration-200">
          {/* Header */}
          <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
            <button
              onClick={() => setIsExercisePickerOpen(false)}
              className="p-2 -ml-2 text-slate-500 hover:text-slate-700"
            >
              <X size={24} />
            </button>
            <h2 className="text-lg font-bold text-slate-900">Egzersiz Seç</h2>
            <div className="w-10" /> {/* Spacer for centering */}
          </div>

          {/* Search */}
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={exerciseSearchQuery}
                onChange={(e) => setExerciseSearchQuery(e.target.value)}
                placeholder="Egzersiz ara..."
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Exercise Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {data.exercises.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <Dumbbell size={48} className="mx-auto mb-3 text-slate-300" />
                <p className="font-medium">Henüz egzersiz eklenmemiş</p>
                <p className="text-sm mt-1">Önce "Egzersizler" sekmesinden egzersiz ekleyin.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {data.exercises
                  .filter(ex => !selectedRoutineExercises.find(re => re.exerciseId === ex.id))
                  .filter(ex => exerciseSearchQuery === '' || ex.name.toLowerCase().includes(exerciseSearchQuery.toLowerCase()))
                  .map(exercise => {
                    const isSelected = pickerSelectedIds.includes(exercise.id);
                    return (
                      <button
                        key={exercise.id}
                        onClick={() => {
                          if (isSelected) {
                            setPickerSelectedIds(prev => prev.filter(id => id !== exercise.id));
                          } else {
                            setPickerSelectedIds(prev => [...prev, exercise.id]);
                          }
                        }}
                        className={`relative p-3 rounded-xl border-2 text-left transition-all ${isSelected
                          ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-200'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                          }`}
                      >
                        {/* Selection indicator */}
                        {isSelected && (
                          <div className="absolute top-2 right-2 w-5 h-5 bg-brand-500 rounded-full flex items-center justify-center">
                            <Check size={12} className="text-white" />
                          </div>
                        )}

                        {/* Exercise info */}
                        <div className="flex items-center gap-1.5 mb-1">
                          <h3 className={`font-bold text-sm ${isSelected ? 'text-brand-800' : 'text-slate-800'}`}>
                            {exercise.name}
                          </h3>
                          {exercise.media && (
                            <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                              <MediaButtons media={[exercise.media]} compact />
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1 text-xs text-slate-500">
                          {getTrackingIcon(exercise.trackingType || 'weight_reps')}
                          <span>{getTrackingLabel(exercise.trackingType || 'weight_reps')}</span>
                        </div>

                        {/* Default targets preview */}
                        <div className="flex flex-wrap gap-1 mt-2">
                          {exercise.defaultSets && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                              {exercise.defaultSets} set
                            </span>
                          )}
                          {exercise.trackingType === 'weight_reps' && exercise.defaultReps && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                              {exercise.defaultReps} tekrar
                            </span>
                          )}
                          {exercise.trackingType === 'time' && exercise.defaultTimeSeconds && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                              {Math.floor(exercise.defaultTimeSeconds / 60) > 0 ? `${Math.floor(exercise.defaultTimeSeconds / 60)}dk ` : ''}{exercise.defaultTimeSeconds % 60 > 0 ? `${exercise.defaultTimeSeconds % 60}sn` : ''}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
              </div>
            )}

            {/* No results */}
            {data.exercises.length > 0 &&
              data.exercises
                .filter(ex => !selectedRoutineExercises.find(re => re.exerciseId === ex.id))
                .filter(ex => exerciseSearchQuery === '' || ex.name.toLowerCase().includes(exerciseSearchQuery.toLowerCase()))
                .length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  <Search size={48} className="mx-auto mb-3 text-slate-300" />
                  <p className="font-medium">Sonuç bulunamadı</p>
                  <p className="text-sm mt-1">Farklı bir arama terimi deneyin.</p>
                </div>
              )}
          </div>

          {/* Bottom action bar */}
          <div className="border-t border-slate-200 bg-white px-4 py-3 safe-area-inset-bottom">
            <div className="flex items-center gap-3">
              <div className="flex-1 text-sm text-slate-600">
                {pickerSelectedIds.length > 0 ? (
                  <span className="font-medium text-brand-600">{pickerSelectedIds.length} egzersiz seçildi</span>
                ) : (
                  <span>Egzersiz seçin</span>
                )}
              </div>
              <Button
                onClick={() => {
                  // Add all selected exercises with their default values
                  const newExercises: RoutineExercise[] = pickerSelectedIds.map(id => {
                    const exDef = data.exercises.find(e => e.id === id);
                    return {
                      exerciseId: id,
                      targetSets: exDef?.defaultSets || 3,
                      targetReps: exDef?.trackingType === 'weight_reps' ? (exDef?.defaultReps || 10) : undefined,
                      targetTimeSeconds: exDef?.trackingType === 'time' ? (exDef?.defaultTimeSeconds || 60) : undefined,
                      targetWeight: exDef?.defaultWeight
                    };
                  });
                  setSelectedRoutineExercises(prev => [...prev, ...newExercises]);
                  setIsExercisePickerOpen(false);
                  setPickerSelectedIds([]);
                }}
                disabled={pickerSelectedIds.length === 0}
                className="px-6"
              >
                Onayla ({pickerSelectedIds.length})
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};