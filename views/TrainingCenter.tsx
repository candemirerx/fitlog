import React, { useState, useRef } from 'react';
import { AppData, Equipment, Exercise, Movement, MovementEffectArea, Routine, RoutineCategory, RoutineExercise } from '../types';
import { Button } from '../components/Button';
import { Plus, Trash2, Image as ImageIcon, Video, X, Camera, Clock, CheckSquare, Dumbbell, ChevronDown, ChevronUp, Target, Pencil, Package, Search, Check, Loader2, Move } from 'lucide-react';
import { MediaButtons } from './ActiveWorkout';
import { auth } from '../firebase';
import { processAndUploadVideo, isVideoSource } from '../utils/videoUtils';

interface TrainingCenterProps {
  data: AppData;
  onUpdateData: (newData: Partial<AppData>) => void;
}

type TabType = 'equipment' | 'movements' | 'exercises' | 'routines';

// Etki Alanları tanımları
const EFFECT_AREAS: { key: MovementEffectArea; label: string; emoji: string }[] = [
  { key: 'stretching', label: 'Açma', emoji: '🔓' },
  { key: 'balance', label: 'Denge', emoji: '⚖️' },
  { key: 'breathing', label: 'Nefes', emoji: '🌬️' },
  { key: 'strength', label: 'Kas Kuvvet', emoji: '💪' },
  { key: 'cardio', label: 'Kardiyo', emoji: '❤️' },
  { key: 'flexibility', label: 'Germe', emoji: '🧘' },
];

export const TrainingCenterView: React.FC<TrainingCenterProps> = ({ data, onUpdateData }) => {
  const [activeTab, setActiveTab] = useState<TabType>('equipment');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null);
  const [expandedRoutineId, setExpandedRoutineId] = useState<string | null>(null);
  const [expandedMovementId, setExpandedMovementId] = useState<string | null>(null);

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

  // Movement specific (varsayılan hedefler için)
  const [newItemDefaultSets, setNewItemDefaultSets] = useState<number>(3);
  const [newItemDefaultReps, setNewItemDefaultReps] = useState<number>(10);
  const [newItemDefaultTime, setNewItemDefaultTime] = useState<number>(60);
  const [newItemDefaultWeight, setNewItemDefaultWeight] = useState<number | undefined>(undefined);
  const [selectedEffectAreas, setSelectedEffectAreas] = useState<MovementEffectArea[]>([]);

  // Exercise specific - hareket seçimi (çoklu seçim desteği)
  const [selectedMovementIds, setSelectedMovementIds] = useState<string[]>([]);
  const [isMovementPickerOpen, setIsMovementPickerOpen] = useState(false);
  const [movementSearchQuery, setMovementSearchQuery] = useState('');

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
  const [pickerTab, setPickerTab] = useState<'exercises' | 'movements'>('exercises');

  // Form error message
  const [formError, setFormError] = useState<string | null>(null);

  // Video Upload Progress
  const [videoUploadProgress, setVideoUploadProgress] = useState<number | null>(null);

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
          // Check file size limit (100MB max before compression)
          if (file.size > 100 * 1024 * 1024) {
            alert("Video 100MB'dan küçük olmalı.");
            return;
          }

          // Use Firebase Storage for videos
          const userId = auth.currentUser?.uid || 'anonymous';
          setVideoUploadProgress(0);

          try {
            const videoUrl = await processAndUploadVideo(file, userId, (progress) => {
              setVideoUploadProgress(progress);
            });
            setNewItemMedia(videoUrl);
          } finally {
            setVideoUploadProgress(null);
          }
        }
      } catch (error: any) {
        console.error("Media processing failed", error);
        alert("Dosya işlenirken bir hata oluştu: " + (error.message || 'Bilinmeyen hata'));
        setVideoUploadProgress(null);
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

    } else if (activeTab === 'movements') {
      // En az bir etki alanı seçilmeli
      if (selectedEffectAreas.length === 0) {
        setFormError("Lütfen en az bir etki alanı seçiniz.");
        return;
      }

      const newMovement: Movement = {
        id,
        name: newItemName,
        description: newItemDesc,
        media: newItemMedia,
        equipmentIds: selectedEquipmentIds,
        effectAreas: selectedEffectAreas,
        defaultSets: newItemDefaultSets || undefined,
        defaultReps: newItemDefaultReps || undefined,
        defaultTimeSeconds: newItemDefaultTime || undefined,
        defaultWeight: newItemDefaultWeight
      };

      if (editingId) {
        onUpdateData({ movements: (data.movements || []).map(i => i.id === id ? newMovement : i) });
      } else {
        onUpdateData({ movements: [...(data.movements || []), newMovement] });
      }

    } else if (activeTab === 'exercises') {
      // En az bir hareket seçilmeli
      if (selectedMovementIds.length === 0) {
        setFormError("Lütfen en az bir hareket seçiniz.");
        return;
      }

      // Seçilen hareketleri al
      const selectedMovements = selectedMovementIds
        .map(id => (data.movements || []).find(m => m.id === id))
        .filter(Boolean) as Movement[];

      // İlk hareketten varsayılan değerler al
      const firstMovement = selectedMovements[0];

      // Tüm hareketlerin ekipmanlarını birleştir
      const allEquipmentIds = [...new Set(selectedMovements.flatMap(m => m.equipmentIds || []))];

      const newExercise: Exercise = {
        id,
        name: newItemName || selectedMovements.map(m => m.name).join(' + ') || 'Egzersiz',
        description: newItemDesc,
        equipmentIds: allEquipmentIds,
        media: firstMovement?.media,
        movementId: firstMovement?.id, // geriye dönük uyumluluk
        movementIds: selectedMovementIds,
        // İlk hareketten gelen varsayılan değerler
        defaultSets: firstMovement?.defaultSets,
        defaultReps: firstMovement?.defaultReps,
        defaultTimeSeconds: firstMovement?.defaultTimeSeconds,
        defaultWeight: firstMovement?.defaultWeight
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
    else if (activeTab === 'movements') {
      const mov = item as Movement;
      setNewItemDesc(mov.description || '');
      setNewItemMedia(mov.media || '');
      setSelectedEquipmentIds(mov.equipmentIds || []);
      setSelectedEffectAreas(mov.effectAreas || []);
      setNewItemDefaultSets(mov.defaultSets || 0);
      setNewItemDefaultReps(mov.defaultReps || 0);
      setNewItemDefaultTime(mov.defaultTimeSeconds || 0);
      setNewItemDefaultWeight(mov.defaultWeight);
    }
    else if (activeTab === 'exercises') {
      const ex = item as Exercise;
      setNewItemDesc(ex.description || '');
      // Çoklu hareket desteği - önce movementIds'e bak, yoksa movementId kullan
      const ids = ex.movementIds || (ex.movementId ? [ex.movementId] : []);
      setSelectedMovementIds(ids);
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
    if (type === 'movements') onUpdateData({ movements: (data.movements || []).filter(i => i.id !== id) });
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
    setSelectedMovementIds([]);
    setMovementSearchQuery('');
    setSelectedEffectAreas([]);
    setFormError(null);

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

  const isVideo = (source: string) => isVideoSource(source);

  return (
    <div className="pb-24">
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 mb-6">
        <h2 className="text-xl font-bold text-slate-900 mb-4">Antrenman Merkezi</h2>
        <div className="flex p-1 bg-slate-100 rounded-lg">
          {(['equipment', 'movements', 'exercises', 'routines'] as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 text-xs font-medium rounded-md transition-all ${activeTab === tab ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
            >
              {tab === 'equipment' && 'Ürünlerim'}
              {tab === 'movements' && 'Hareketlerim'}
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

        {activeTab === 'movements' && (data.movements || []).map(item => {
          const isExpanded = expandedMovementId === item.id;
          return (
            <div key={item.id} className={`bg-white rounded-xl shadow-sm border overflow-hidden transition-all ${isExpanded ? 'border-emerald-200 ring-1 ring-emerald-100' : 'border-slate-100'}`}>
              {/* Header - Toggle */}
              <div
                onClick={() => setExpandedMovementId(isExpanded ? null : item.id)}
                className="p-4 cursor-pointer flex items-center justify-between hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-1.5 rounded-lg transition-transform duration-200 ${isExpanded ? 'rotate-90 bg-emerald-100' : 'bg-slate-100'}`}>
                    <ChevronDown size={16} className={`text-slate-500 transition-transform ${isExpanded ? 'rotate-[-90deg]' : ''}`} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 flex items-center gap-2">
                      {item.name}
                      {item.media && <MediaButtons media={[item.media]} compact />}
                    </h3>
                    {/* Etki Alanları */}
                    {(item.effectAreas || []).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(item.effectAreas || []).map(areaKey => {
                          const area = EFFECT_AREAS.find(a => a.key === areaKey);
                          if (!area) return null;
                          return (
                            <span key={areaKey} className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded border border-amber-200">
                              {area.emoji} {area.label}
                            </span>
                          );
                        })}
                      </div>
                    )}
                    <span className="text-xs text-slate-500">
                      {[item.defaultSets && `${item.defaultSets} set`, item.defaultReps && `${item.defaultReps} tekrar`, item.defaultWeight && `${item.defaultWeight}kg`, item.defaultTimeSeconds && `${Math.floor(item.defaultTimeSeconds / 60) > 0 ? `${Math.floor(item.defaultTimeSeconds / 60)}dk ` : ''}${item.defaultTimeSeconds % 60 > 0 ? `${item.defaultTimeSeconds % 60}sn` : ''}`].filter(Boolean).join(' • ') || 'Hedef belirlenmemiş'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => handleEditItem(item)} className="p-1.5 text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Düzenle">
                    <Pencil size={16} />
                  </button>
                  <button onClick={() => deleteItem(item.id, 'movements')} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Sil">
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
                      <span className="bg-emerald-50 px-2.5 py-1 rounded-full text-emerald-700 border border-emerald-100 font-medium text-xs">
                        {item.defaultSets} set
                      </span>
                    )}
                    {item.defaultReps && (
                      <span className="bg-blue-50 px-2.5 py-1 rounded-full text-blue-700 border border-blue-100 font-medium text-xs">
                        {item.defaultReps} tekrar
                      </span>
                    )}
                    {item.defaultWeight && (
                      <span className="bg-purple-50 px-2.5 py-1 rounded-full text-purple-700 border border-purple-100 font-medium text-xs">
                        {item.defaultWeight} kg
                      </span>
                    )}
                    {item.defaultTimeSeconds && (
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
                    {/* Kısa özet: hangi değerler varsa göster */}
                    <span className="text-xs text-slate-500">
                      {[item.defaultSets && `${item.defaultSets} set`, item.defaultReps && `${item.defaultReps} tekrar`, item.defaultWeight && `${item.defaultWeight}kg`, item.defaultTimeSeconds && `${Math.floor(item.defaultTimeSeconds / 60) > 0 ? `${Math.floor(item.defaultTimeSeconds / 60)}dk ` : ''}${item.defaultTimeSeconds % 60 > 0 ? `${item.defaultTimeSeconds % 60}sn` : ''}`].filter(Boolean).join(' • ') || 'Hedef belirlenmemiş'}
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
                    {item.defaultReps && (
                      <span className="bg-blue-50 px-2.5 py-1 rounded-full text-blue-700 border border-blue-100 font-medium text-xs">
                        {item.defaultReps} tekrar
                      </span>
                    )}
                    {item.defaultWeight && (
                      <span className="bg-purple-50 px-2.5 py-1 rounded-full text-purple-700 border border-purple-100 font-medium text-xs">
                        {item.defaultWeight} kg
                      </span>
                    )}
                    {item.defaultTimeSeconds && (
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
                          </div>
                          {/* Detaylı Hedefler */}
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {ex.targetSets && (
                              <span className="text-[10px] px-2 py-0.5 bg-brand-50 text-brand-700 rounded-full font-medium">
                                {ex.targetSets} set
                              </span>
                            )}
                            {ex.targetReps && (
                              <span className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full font-medium">
                                {ex.targetReps} tekrar
                              </span>
                            )}
                            {ex.targetWeight && (
                              <span className="text-[10px] px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full font-medium">
                                {ex.targetWeight} kg
                              </span>
                            )}
                            {ex.targetTimeSeconds && (
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
                  activeTab === 'equipment' ? 'Yeni Ürün Ekle' :
                    activeTab === 'movements' ? 'Yeni Hareket Ekle' :
                      activeTab === 'exercises' ? 'Yeni Egzersiz Ekle' :
                        'Yeni Antrenman Programı Ekle'
                )}
              </h3>
              <button onClick={resetForm}><X className="text-slate-400 hover:text-slate-600" /></button>
            </div>

            <div className="space-y-4">
              {/* İsim ve Görsel - movements için özel tasarım */}
              {activeTab === 'movements' ? (
                <div className="bg-gradient-to-br from-slate-50 to-emerald-50/30 rounded-xl border border-slate-200 p-4 space-y-3">
                  {/* İsim */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Hareket Adı</label>
                    <input
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-base font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                      placeholder="Örn: Şınav, Plank, Squat..."
                    />
                  </div>

                  {/* Görsel */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Görsel / Video</label>
                    <input type="file" ref={fileInputRef} onChange={handleMediaUpload} accept="image/*,video/*" className="hidden" />
                    <input type="file" ref={cameraInputRef} onChange={handleMediaUpload} accept="image/*" capture="environment" className="hidden" />
                    <input type="file" ref={videoInputRef} onChange={handleMediaUpload} accept="video/*" capture="environment" className="hidden" />

                    {newItemMedia ? (
                      // Seçilen medya önizlemesi
                      <div className="flex items-center gap-3 bg-white rounded-lg border border-emerald-200 p-2">
                        <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200 shrink-0">
                          {isVideo(newItemMedia) ? (
                            <video src={newItemMedia} className="w-full h-full object-cover" />
                          ) : (
                            <img src={newItemMedia} className="w-full h-full object-cover" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-emerald-700 font-medium truncate">
                            {isVideo(newItemMedia) ? '🎬 Video eklendi' : '🖼️ Görsel eklendi'}
                          </p>
                          <p className="text-xs text-slate-500">Değiştirmek için sağdaki butona tıklayın</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setNewItemMedia('')}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Görseli kaldır"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    ) : videoUploadProgress !== null ? (
                      // Yükleme durumu
                      <div className="bg-white rounded-lg border border-brand-200 p-3 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
                          <Loader2 size={20} className="animate-spin text-brand-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-brand-700">
                            {videoUploadProgress < 50 ? 'Sıkıştırılıyor...' : 'Yükleniyor...'}
                          </p>
                          <div className="w-full h-1.5 bg-brand-100 rounded-full mt-1 overflow-hidden">
                            <div className="h-full bg-brand-500 transition-all duration-300" style={{ width: `${videoUploadProgress}%` }} />
                          </div>
                        </div>
                        <span className="text-xs font-medium text-brand-600">{Math.round(videoUploadProgress)}%</span>
                      </div>
                    ) : (
                      // Medya seçim butonları
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="flex-1 py-2.5 px-3 bg-white border border-slate-200 rounded-lg flex items-center justify-center gap-2 hover:bg-emerald-50 hover:border-emerald-300 transition-all group"
                        >
                          <ImageIcon size={16} className="text-slate-400 group-hover:text-emerald-600" />
                          <span className="text-sm text-slate-600 group-hover:text-emerald-700">Galeri</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => cameraInputRef.current?.click()}
                          className="flex-1 py-2.5 px-3 bg-white border border-slate-200 rounded-lg flex items-center justify-center gap-2 hover:bg-emerald-50 hover:border-emerald-300 transition-all group"
                        >
                          <Camera size={16} className="text-slate-400 group-hover:text-emerald-600" />
                          <span className="text-sm text-slate-600 group-hover:text-emerald-700">Fotoğraf</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => videoInputRef.current?.click()}
                          className="flex-1 py-2.5 px-3 bg-white border border-slate-200 rounded-lg flex items-center justify-center gap-2 hover:bg-emerald-50 hover:border-emerald-300 transition-all group"
                        >
                          <Video size={16} className="text-slate-400 group-hover:text-emerald-600" />
                          <span className="text-sm text-slate-600 group-hover:text-emerald-700">Video</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">İsim</label>
                  <input value={newItemName} onChange={(e) => setNewItemName(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2" placeholder={activeTab === 'equipment' ? "Örn: 10kg Dambıl" : "Örn: Şınav"} />
                </div>
              )}

              {activeTab === 'movements' && (
                <div className="space-y-3 border-t border-b border-slate-100 py-3">
                  {/* Etki Alanları - 6 toggle buton */}
                  <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                    <div className="flex items-center gap-2 mb-3 text-amber-700 font-medium text-sm">
                      <span>⚡</span>
                      <span>Etki Alanları</span>
                      <span className="text-[10px] font-normal text-amber-600">(en az 1 seçin)</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {EFFECT_AREAS.map(area => {
                        const isSelected = selectedEffectAreas.includes(area.key);
                        return (
                          <button
                            key={area.key}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                setSelectedEffectAreas(prev => prev.filter(a => a !== area.key));
                              } else {
                                setSelectedEffectAreas(prev => [...prev, area.key]);
                              }
                            }}
                            className={`px-2 py-2 rounded-lg text-xs font-medium border transition-all flex items-center justify-center gap-1 ${isSelected
                              ? 'bg-amber-100 border-amber-300 text-amber-800 ring-1 ring-amber-300'
                              : 'bg-white border-slate-200 text-slate-600 hover:border-amber-300 hover:bg-amber-50'
                              }`}
                          >
                            <span>{area.emoji}</span>
                            <span>{area.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Default Values for Movements - 4 Opsiyonel Kutu */}
                  <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-200">
                    <div className="flex items-center gap-2 mb-2 text-emerald-700 font-medium text-sm">
                      <Target size={16} />
                      <span>Varsayılan Hedefler (Opsiyonel)</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {/* Set */}
                      <div>
                        <label className="text-xs text-slate-500 block mb-1">Set</label>
                        <input
                          type="number"
                          min="1"
                          value={newItemDefaultSets || ''}
                          onChange={e => setNewItemDefaultSets(parseInt(e.target.value) || 0)}
                          className="w-full p-2 border border-slate-300 rounded bg-white text-sm"
                          placeholder="Örn: 3"
                        />
                      </div>

                      {/* Tekrar */}
                      <div>
                        <label className="text-xs text-slate-500 block mb-1">Tekrar</label>
                        <input
                          type="number"
                          min="0"
                          value={newItemDefaultReps || ''}
                          onChange={e => setNewItemDefaultReps(parseInt(e.target.value) || 0)}
                          className="w-full p-2 border border-slate-300 rounded bg-white text-sm"
                          placeholder="Örn: 10"
                        />
                      </div>

                      {/* Ağırlık */}
                      <div>
                        <label className="text-xs text-slate-500 block mb-1">Ağırlık (kg)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={newItemDefaultWeight || ''}
                          onChange={e => setNewItemDefaultWeight(e.target.value ? parseFloat(e.target.value) : undefined)}
                          className="w-full p-2 border border-slate-300 rounded bg-white text-sm"
                          placeholder="Örn: 20"
                        />
                      </div>

                      {/* Süre - Kompakt */}
                      <div>
                        <label className="text-xs text-slate-500 block mb-1">Süre</label>
                        <div className="flex gap-1">
                          <input
                            type="number"
                            min="0"
                            value={Math.floor((newItemDefaultTime || 0) / 60) || ''}
                            onChange={e => {
                              const mins = parseInt(e.target.value) || 0;
                              const currentSecs = (newItemDefaultTime || 0) % 60;
                              setNewItemDefaultTime(mins * 60 + currentSecs);
                            }}
                            className="w-full p-2 border border-slate-300 rounded bg-white text-sm"
                            placeholder="dk"
                          />
                          <input
                            type="number"
                            min="0"
                            max="59"
                            value={(newItemDefaultTime || 0) % 60 || ''}
                            onChange={e => {
                              const secs = Math.min(59, Math.max(0, parseInt(e.target.value) || 0));
                              const currentMins = Math.floor((newItemDefaultTime || 0) / 60);
                              setNewItemDefaultTime(currentMins * 60 + secs);
                            }}
                            className="w-full p-2 border border-slate-300 rounded bg-white text-sm"
                            placeholder="sn"
                          />
                        </div>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2 leading-tight">
                      * Sadece ihtiyacınız olan alanları doldurun. Bu değerler egzersiz oluştururken otomatik olarak kullanılır.
                    </p>
                  </div>
                </div>
              )}

              {activeTab === 'exercises' && (
                <div className="space-y-3 border-t border-b border-slate-100 py-3">
                  {/* Hareket Seçici */}
                  <div className="bg-brand-50 p-3 rounded-lg border border-brand-200">
                    <div className="flex items-center gap-2 mb-2 text-brand-700 font-medium text-sm">
                      <Move size={16} />
                      <span>Hareket Seç</span>
                    </div>

                    {/* Seçilen Hareketler Listesi */}
                    {selectedMovementIds.length > 0 && (
                      <div className="space-y-2 mb-3">
                        {selectedMovementIds.map((movId, idx) => {
                          const mov = (data.movements || []).find(m => m.id === movId);
                          if (!mov) return null;
                          return (
                            <div key={movId} className="bg-white p-2.5 rounded-lg border border-brand-200 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-brand-600 bg-brand-100 rounded-full w-5 h-5 flex items-center justify-center">{idx + 1}</span>
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-medium text-slate-800 text-sm">{mov.name}</span>
                                    {mov.media && <MediaButtons media={[mov.media]} compact />}
                                  </div>
                                  <span className="text-[10px] text-slate-500">
                                    {[mov.defaultSets && `${mov.defaultSets} set`, mov.defaultReps && `${mov.defaultReps} tekrar`, mov.defaultWeight && `${mov.defaultWeight}kg`].filter(Boolean).join(' • ') || 'Hedef yok'}
                                  </span>
                                </div>
                              </div>
                              <button
                                onClick={() => setSelectedMovementIds(prev => prev.filter(id => id !== movId))}
                                className="text-slate-400 hover:text-red-500 p-1"
                                title="Kaldır"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          );
                        })}
                        <p className="text-xs text-brand-600 font-medium">{selectedMovementIds.length} hareket seçildi</p>
                      </div>
                    )}

                    {/* Hareket Ekleme Butonu */}
                    <button
                      onClick={() => setIsMovementPickerOpen(true)}
                      className="w-full p-3 border-2 border-dashed border-brand-300 rounded-lg text-brand-600 hover:border-brand-400 hover:bg-brand-100 transition-all flex items-center justify-center gap-2 font-medium"
                    >
                      <Plus size={18} />
                      <span>{selectedMovementIds.length > 0 ? 'Daha Fazla Hareket Ekle' : 'Hareketlerimden Seç'}</span>
                    </button>

                    {(data.movements || []).length === 0 && (
                      <p className="text-[10px] text-amber-600 mt-2 leading-tight">
                        ⚠️ Henüz hareket eklenmemiş. Önce "Hareketlerim" sekmesinden hareket ekleyin.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'equipment' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{activeTab === 'equipment' ? 'Fotoğraf / Video' : 'Görsel / Video'}</label>
                  {newItemMedia ? (
                    <div className="relative h-48 bg-black/5 rounded-lg overflow-hidden border border-slate-200 group flex items-center justify-center">
                      {isVideo(newItemMedia) ? <video src={newItemMedia} controls className="w-full h-full object-contain" /> : <img src={newItemMedia} className="w-full h-full object-contain" />}
                      <button onClick={() => setNewItemMedia('')} className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full shadow-sm hover:bg-red-600 transition-colors z-10"><X size={16} /></button>
                    </div>
                  ) : videoUploadProgress !== null ? (
                    <div className="h-48 bg-brand-50 rounded-lg border border-brand-200 flex flex-col items-center justify-center">
                      <div className="flex items-center gap-2 text-brand-600 mb-3">
                        <Loader2 size={24} className="animate-spin" />
                        <span className="text-sm font-medium">
                          {videoUploadProgress < 50 ? 'Video sıkıştırılıyor...' : 'Yükleniyor...'}
                        </span>
                      </div>
                      <div className="w-48 h-2 bg-brand-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-brand-500 transition-all duration-300"
                          style={{ width: `${videoUploadProgress}%` }}
                        />
                      </div>
                      <span className="text-xs text-brand-500 mt-2">{Math.round(videoUploadProgress)}%</span>
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

              {(activeTab === 'equipment' || activeTab === 'movements') && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Açıklama / Notlar</label>
                  <textarea value={newItemDesc} onChange={(e) => setNewItemDesc(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2" rows={3} />
                </div>
              )}

              {activeTab === 'movements' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Gerekli Ekipmanlar</label>
                  <div className="flex flex-wrap gap-2">
                    {data.equipment.map(eq => (
                      <button key={eq.id} onClick={() => { setSelectedEquipmentIds(prev => prev.includes(eq.id) ? prev.filter(id => id !== eq.id) : [...prev, eq.id]); }} className={`px-3 py-1 rounded-full text-xs font-medium border ${selectedEquipmentIds.includes(eq.id) ? 'bg-emerald-100 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>{eq.name}</button>
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
                        // Hareket mi egzersiz mi kontrol et
                        const isMovement = re.exerciseId.startsWith('mov_') || !!re.movementId;
                        const movId = re.movementId || re.exerciseId.replace('mov_', '');
                        const def = isMovement
                          ? (data.movements || []).find(m => m.id === movId)
                          : data.exercises.find(e => e.id === re.exerciseId);
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

                                <div>
                                  <label className="text-xs text-slate-500 block mb-1">Tekrar</label>
                                  <input
                                    type="number"
                                    value={tempTargetReps || ''}
                                    onChange={e => setTempTargetReps(parseInt(e.target.value) || 0)}
                                    className="w-full p-2 border border-slate-200 rounded bg-white text-sm"
                                    placeholder="Opsiyonel"
                                  />
                                </div>

                                <div>
                                  <label className="text-xs text-slate-500 block mb-1">Ağırlık (kg)</label>
                                  <input
                                    type="number"
                                    value={tempTargetWeight || ''}
                                    onChange={e => setTempTargetWeight(e.target.value ? parseFloat(e.target.value) : undefined)}
                                    className="w-full p-2 border border-slate-200 rounded bg-white text-sm"
                                    placeholder="Opsiyonel"
                                  />
                                </div>

                                <div>
                                  <label className="text-xs text-slate-500 block mb-1">Süre</label>
                                  <div className="flex gap-1">
                                    <input
                                      type="number"
                                      min="0"
                                      value={Math.floor((tempTargetTime || 0) / 60) || ''}
                                      onChange={e => {
                                        const mins = parseInt(e.target.value) || 0;
                                        const currentSecs = (tempTargetTime || 0) % 60;
                                        setTempTargetTime(mins * 60 + currentSecs);
                                      }}
                                      className="w-full p-2 border border-slate-200 rounded bg-white text-sm"
                                      placeholder="dk"
                                    />
                                    <input
                                      type="number"
                                      min="0"
                                      max="59"
                                      value={(tempTargetTime || 0) % 60 || ''}
                                      onChange={e => {
                                        const secs = Math.min(59, Math.max(0, parseInt(e.target.value) || 0));
                                        const currentMins = Math.floor((tempTargetTime || 0) / 60);
                                        setTempTargetTime(currentMins * 60 + secs);
                                      }}
                                      className="w-full p-2 border border-slate-200 rounded bg-white text-sm"
                                      placeholder="sn"
                                    />
                                  </div>
                                </div>
                              </div>

                              <Button
                                size="sm"
                                fullWidth
                                onClick={() => {
                                  // Güncelle - tüm değerler opsiyonel olarak kaydedilir
                                  setSelectedRoutineExercises(prev => prev.map(item =>
                                    item.exerciseId === re.exerciseId
                                      ? {
                                        ...item,
                                        targetSets: tempTargetSets,
                                        targetReps: tempTargetReps || undefined,
                                        targetTimeSeconds: tempTargetTime || undefined,
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
                          <div key={idx} className={`flex justify-between items-center p-2 rounded-lg border ${isMovement ? 'bg-emerald-50 border-emerald-100' : 'bg-brand-50 border-brand-100'}`}>
                            <div className="text-sm">
                              <div className={`font-bold flex items-center gap-1.5 ${isMovement ? 'text-emerald-800' : 'text-brand-800'}`}>
                                {isMovement && <Move size={12} className="text-emerald-600" />}
                                {def?.name}
                              </div>
                              <div className={`text-xs ${isMovement ? 'text-emerald-600' : 'text-brand-600'}`}>
                                {[re.targetSets && `${re.targetSets} set`, re.targetReps && `${re.targetReps} tekrar`, re.targetWeight && `${re.targetWeight}kg`, re.targetTimeSeconds && `${re.targetTimeSeconds}sn`].filter(Boolean).join(' • ') || 'Hedef yok'}
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

                    {/* Add Exercise/Movement Button */}
                    <button
                      onClick={() => {
                        setPickerSelectedIds([]);
                        setExerciseSearchQuery('');
                        setPickerTab('exercises');
                        setIsExercisePickerOpen(true);
                      }}
                      className="w-full py-2 border-2 border-dashed border-slate-300 rounded-lg text-slate-400 hover:border-brand-400 hover:text-brand-600 hover:bg-brand-50 transition-all flex items-center justify-center"
                      title="Egzersiz veya hareket ekle"
                    >
                      <Plus size={24} />
                    </button>
                  </div>
                </>
              )}

              {/* Hata Mesajı */}
              {formError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                    <X size={14} className="text-red-600" />
                  </div>
                  <p className="text-sm text-red-700 font-medium">{formError}</p>
                  <button
                    onClick={() => setFormError(null)}
                    className="ml-auto p-1 text-red-400 hover:text-red-600 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              <Button onClick={() => { setFormError(null); handleSaveItem(); }} fullWidth className="mt-4">{editingId ? 'Güncelle' : 'Kaydet'}</Button>
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
              onClick={() => { setIsExercisePickerOpen(false); setPickerTab('exercises'); }}
              className="p-2 -ml-2 text-slate-500 hover:text-slate-700"
            >
              <X size={24} />
            </button>
            <h2 className="text-lg font-bold text-slate-900">Antrenman İçeriği Ekle</h2>
            <div className="w-10" /> {/* Spacer for centering */}
          </div>

          {/* Tab Buttons */}
          <div className="px-4 py-2 bg-slate-100 border-b border-slate-200">
            <div className="flex gap-2">
              <button
                onClick={() => { setPickerTab('exercises'); setExerciseSearchQuery(''); setPickerSelectedIds([]); }}
                className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2 ${pickerTab === 'exercises'
                  ? 'bg-white text-brand-700 shadow-sm border border-brand-200'
                  : 'text-slate-600 hover:bg-white/50'
                  }`}
              >
                <Dumbbell size={16} />
                <span>Egzersizlerim</span>
              </button>
              <button
                onClick={() => { setPickerTab('movements'); setExerciseSearchQuery(''); setPickerSelectedIds([]); }}
                className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2 ${pickerTab === 'movements'
                  ? 'bg-white text-emerald-700 shadow-sm border border-emerald-200'
                  : 'text-slate-600 hover:bg-white/50'
                  }`}
              >
                <Move size={16} />
                <span>Hareketlerim</span>
              </button>
            </div>
          </div>

          {/* Search */}
          <div className={`px-4 py-3 border-b ${pickerTab === 'exercises' ? 'bg-brand-50 border-brand-200' : 'bg-emerald-50 border-emerald-200'}`}>
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={exerciseSearchQuery}
                onChange={(e) => setExerciseSearchQuery(e.target.value)}
                placeholder={pickerTab === 'exercises' ? "Egzersiz ara..." : "Hareket ara..."}
                className={`w-full pl-10 pr-4 py-2.5 border rounded-xl bg-white text-sm focus:outline-none focus:ring-2 ${pickerTab === 'exercises'
                  ? 'border-brand-200 focus:ring-brand-500'
                  : 'border-emerald-200 focus:ring-emerald-500'
                  } focus:border-transparent`}
              />
            </div>
          </div>

          {/* Content Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {/* Exercises Tab */}
            {pickerTab === 'exercises' && (
              <>
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
                            {isSelected && (
                              <div className="absolute top-2 right-2 w-5 h-5 bg-brand-500 rounded-full flex items-center justify-center">
                                <Check size={12} className="text-white" />
                              </div>
                            )}
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
                            <div className="flex flex-wrap gap-1 mt-2">
                              {exercise.defaultSets && <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">{exercise.defaultSets} set</span>}
                              {exercise.defaultReps && <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">{exercise.defaultReps} tekrar</span>}
                              {exercise.defaultWeight && <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">{exercise.defaultWeight}kg</span>}
                              {exercise.defaultTimeSeconds && <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">{Math.floor(exercise.defaultTimeSeconds / 60) > 0 ? `${Math.floor(exercise.defaultTimeSeconds / 60)}dk ` : ''}{exercise.defaultTimeSeconds % 60 > 0 ? `${exercise.defaultTimeSeconds % 60}sn` : ''}</span>}
                            </div>
                          </button>
                        );
                      })}
                  </div>
                )}
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
              </>
            )}

            {/* Movements Tab */}
            {pickerTab === 'movements' && (
              <>
                {(data.movements || []).length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <Move size={48} className="mx-auto mb-3 text-slate-300" />
                    <p className="font-medium">Henüz hareket eklenmemiş</p>
                    <p className="text-sm mt-1">Önce "Hareketlerim" sekmesinden hareket ekleyin.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {(data.movements || [])
                      .filter(mov => exerciseSearchQuery === '' || mov.name.toLowerCase().includes(exerciseSearchQuery.toLowerCase()))
                      .map(movement => {
                        const isSelected = pickerSelectedIds.includes(`mov_${movement.id}`);
                        return (
                          <button
                            key={movement.id}
                            onClick={() => {
                              const movId = `mov_${movement.id}`;
                              if (isSelected) {
                                setPickerSelectedIds(prev => prev.filter(id => id !== movId));
                              } else {
                                setPickerSelectedIds(prev => [...prev, movId]);
                              }
                            }}
                            className={`relative p-3 rounded-xl border-2 text-left transition-all ${isSelected
                              ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200'
                              : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                              }`}
                          >
                            {isSelected && (
                              <div className="absolute top-2 right-2 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                                <Check size={12} className="text-white" />
                              </div>
                            )}
                            <div className="flex items-center gap-1.5 mb-1">
                              <h3 className={`font-bold text-sm ${isSelected ? 'text-emerald-800' : 'text-slate-800'}`}>
                                {movement.name}
                              </h3>
                              {movement.media && (
                                <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                                  <MediaButtons media={[movement.media]} compact />
                                </div>
                              )}
                            </div>
                            {/* Effect areas */}
                            {(movement.effectAreas || []).length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1 mb-2">
                                {(movement.effectAreas || []).slice(0, 3).map(areaKey => {
                                  const area = EFFECT_AREAS.find(a => a.key === areaKey);
                                  if (!area) return null;
                                  return (
                                    <span key={areaKey} className="text-[9px] px-1 py-0.5 bg-amber-50 text-amber-700 rounded">
                                      {area.emoji}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                            <div className="flex flex-wrap gap-1">
                              {movement.defaultSets && <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded">{movement.defaultSets} set</span>}
                              {movement.defaultReps && <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded">{movement.defaultReps} tekrar</span>}
                              {movement.defaultWeight && <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded">{movement.defaultWeight}kg</span>}
                              {movement.defaultTimeSeconds && <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded">{Math.floor(movement.defaultTimeSeconds / 60) > 0 ? `${Math.floor(movement.defaultTimeSeconds / 60)}dk ` : ''}{movement.defaultTimeSeconds % 60 > 0 ? `${movement.defaultTimeSeconds % 60}sn` : ''}</span>}
                            </div>
                          </button>
                        );
                      })}
                  </div>
                )}
                {(data.movements || []).length > 0 &&
                  (data.movements || [])
                    .filter(mov => exerciseSearchQuery === '' || mov.name.toLowerCase().includes(exerciseSearchQuery.toLowerCase()))
                    .length === 0 && (
                    <div className="text-center py-12 text-slate-500">
                      <Search size={48} className="mx-auto mb-3 text-slate-300" />
                      <p className="font-medium">Sonuç bulunamadı</p>
                      <p className="text-sm mt-1">Farklı bir arama terimi deneyin.</p>
                    </div>
                  )}
              </>
            )}
          </div>

          {/* Bottom action bar */}
          <div className={`border-t bg-white px-4 py-3 safe-area-inset-bottom ${pickerTab === 'exercises' ? 'border-brand-200' : 'border-emerald-200'}`}>
            <div className="flex items-center gap-3">
              <div className="flex-1 text-sm text-slate-600">
                {pickerSelectedIds.length > 0 ? (
                  <span className={`font-medium ${pickerTab === 'exercises' ? 'text-brand-600' : 'text-emerald-600'}`}>
                    {pickerSelectedIds.length} {pickerTab === 'exercises' ? 'egzersiz' : 'hareket'} seçildi
                  </span>
                ) : (
                  <span>{pickerTab === 'exercises' ? 'Egzersiz seçin' : 'Hareket seçin'}</span>
                )}
              </div>
              <Button
                onClick={() => {
                  if (pickerTab === 'exercises') {
                    // Egzersizleri varsayılan değerleriyle ekle
                    const newExercises: RoutineExercise[] = pickerSelectedIds.map(id => {
                      const exDef = data.exercises.find(e => e.id === id);
                      return {
                        exerciseId: id,
                        targetSets: exDef?.defaultSets || 3,
                        targetReps: exDef?.defaultReps || undefined,
                        targetTimeSeconds: exDef?.defaultTimeSeconds || undefined,
                        targetWeight: exDef?.defaultWeight
                      };
                    });
                    setSelectedRoutineExercises(prev => [...prev, ...newExercises]);
                  } else {
                    // Hareketleri egzersiz olarak ekle (mov_ prefix'ini kaldır)
                    const newExercises: RoutineExercise[] = pickerSelectedIds.map(prefixedId => {
                      const movId = prefixedId.replace('mov_', '');
                      const movDef = (data.movements || []).find(m => m.id === movId);
                      return {
                        exerciseId: prefixedId, // mov_ prefix ile sakla, böylece hareket olduğu anlaşılır
                        movementId: movId, // Orijinal hareket ID'si
                        targetSets: movDef?.defaultSets || 3,
                        targetReps: movDef?.defaultReps || undefined,
                        targetTimeSeconds: movDef?.defaultTimeSeconds || undefined,
                        targetWeight: movDef?.defaultWeight
                      };
                    });
                    setSelectedRoutineExercises(prev => [...prev, ...newExercises]);
                  }
                  setIsExercisePickerOpen(false);
                  setPickerSelectedIds([]);
                  setPickerTab('exercises');
                }}
                disabled={pickerSelectedIds.length === 0}
                className={`px-6 ${pickerTab === 'movements' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
              >
                Onayla ({pickerSelectedIds.length})
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Full-screen Movement Picker Modal (Çoklu Seçim) */}
      {isMovementPickerOpen && (
        <div className="fixed inset-0 bg-white z-[60] flex flex-col animate-in slide-in-from-bottom duration-200">
          {/* Header */}
          <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
            <button
              onClick={() => { setIsMovementPickerOpen(false); setMovementSearchQuery(''); }}
              className="p-2 -ml-2 text-slate-500 hover:text-slate-700"
            >
              <X size={24} />
            </button>
            <h2 className="text-lg font-bold text-slate-900">Hareket Seç</h2>
            <div className="w-10" /> {/* Spacer for centering */}
          </div>

          {/* Search */}
          <div className="px-4 py-3 bg-emerald-50 border-b border-emerald-200">
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={movementSearchQuery}
                onChange={(e) => setMovementSearchQuery(e.target.value)}
                placeholder="Hareket ara..."
                className="w-full pl-10 pr-4 py-2.5 border border-emerald-200 rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Movement Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {(data.movements || []).length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <Move size={48} className="mx-auto mb-3 text-slate-300" />
                <p className="font-medium">Henüz hareket eklenmemiş</p>
                <p className="text-sm mt-1">Önce "Hareketlerim" sekmesinden hareket ekleyin.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {(data.movements || [])
                  .filter(mov => movementSearchQuery === '' || mov.name.toLowerCase().includes(movementSearchQuery.toLowerCase()))
                  .map(movement => {
                    const isSelected = selectedMovementIds.includes(movement.id);
                    return (
                      <button
                        key={movement.id}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedMovementIds(prev => prev.filter(id => id !== movement.id));
                          } else {
                            setSelectedMovementIds(prev => [...prev, movement.id]);
                          }
                        }}
                        className={`relative p-3 rounded-xl border-2 text-left transition-all ${isSelected
                          ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200'
                          : 'border-slate-200 bg-white hover:border-emerald-300 hover:shadow-sm'
                          }`}
                      >
                        {/* Selection indicator */}
                        {isSelected && (
                          <div className="absolute top-2 right-2 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                            <Check size={12} className="text-white" />
                          </div>
                        )}
                        {/* Movement info */}
                        <div className="flex items-center gap-1.5 mb-1">
                          <h3 className={`font-bold text-sm ${isSelected ? 'text-emerald-800' : 'text-slate-800'}`}>
                            {movement.name}
                          </h3>
                          {movement.media && (
                            <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                              <MediaButtons media={[movement.media]} compact />
                            </div>
                          )}
                        </div>

                        {/* Default targets preview */}
                        <div className="flex flex-wrap gap-1 mt-2">
                          {movement.defaultSets && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${isSelected ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-50 text-emerald-600'}`}>
                              {movement.defaultSets} set
                            </span>
                          )}
                          {movement.defaultReps && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${isSelected ? 'bg-blue-100 text-blue-700' : 'bg-blue-50 text-blue-600'}`}>
                              {movement.defaultReps} tekrar
                            </span>
                          )}
                          {movement.defaultWeight && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${isSelected ? 'bg-purple-100 text-purple-700' : 'bg-purple-50 text-purple-600'}`}>
                              {movement.defaultWeight}kg
                            </span>
                          )}
                          {movement.defaultTimeSeconds && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${isSelected ? 'bg-amber-100 text-amber-700' : 'bg-amber-50 text-amber-600'}`}>
                              {Math.floor(movement.defaultTimeSeconds / 60) > 0 ? `${Math.floor(movement.defaultTimeSeconds / 60)}dk ` : ''}{movement.defaultTimeSeconds % 60 > 0 ? `${movement.defaultTimeSeconds % 60}sn` : ''}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
              </div>
            )}

            {/* No results */}
            {(data.movements || []).length > 0 &&
              (data.movements || [])
                .filter(mov => movementSearchQuery === '' || mov.name.toLowerCase().includes(movementSearchQuery.toLowerCase()))
                .length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  <Search size={48} className="mx-auto mb-3 text-slate-300" />
                  <p className="font-medium">Sonuç bulunamadı</p>
                  <p className="text-sm mt-1">Farklı bir arama terimi deneyin.</p>
                </div>
              )}
          </div>

          {/* Bottom action bar */}
          <div className="border-t border-emerald-200 bg-white px-4 py-3 safe-area-inset-bottom">
            <div className="flex items-center gap-3">
              <div className="flex-1 text-sm text-slate-600">
                {selectedMovementIds.length > 0 ? (
                  <span className="font-medium text-emerald-600">
                    {selectedMovementIds.length} hareket seçildi
                  </span>
                ) : (
                  <span>Hareket seçin</span>
                )}
              </div>
              <Button
                onClick={() => {
                  setIsMovementPickerOpen(false);
                  setMovementSearchQuery('');
                }}
                className="px-6 bg-emerald-600 hover:bg-emerald-700"
              >
                Tamam ({selectedMovementIds.length})
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};