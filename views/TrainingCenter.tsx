import React, { useState, useRef } from 'react';
import { AppData, Equipment, Exercise, Routine, RoutineCategory, TrackingType, RoutineExercise } from '../types';
import { Button } from '../components/Button';
import { Plus, Trash2, Image as ImageIcon, Video, X, Camera, Clock, CheckSquare, Dumbbell, ChevronDown, ChevronUp, Target, Pencil } from 'lucide-react';
import { MediaButtons } from './ActiveWorkout';

interface TrainingCenterProps {
  data: AppData;
  onUpdateData: (newData: Partial<AppData>) => void;
}

type TabType = 'equipment' | 'exercises' | 'routines';

export const TrainingCenterView: React.FC<TrainingCenterProps> = ({ data, onUpdateData }) => {
  const [activeTab, setActiveTab] = useState<TabType>('equipment');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
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

  const addExerciseToRoutine = () => {
    if (!tempExerciseId) return;
    
    // Check if exists
    if (selectedRoutineExercises.find(re => re.exerciseId === tempExerciseId)) {
      alert("Bu egzersiz zaten listede.");
      return;
    }

    const exDef = data.exercises.find(e => e.id === tempExerciseId);
    
    const newRoutineExercise: RoutineExercise = {
      exerciseId: tempExerciseId,
      targetSets: tempTargetSets,
      targetReps: exDef?.trackingType === 'weight_reps' ? tempTargetReps : undefined,
      targetTimeSeconds: exDef?.trackingType === 'time' ? tempTargetTime : undefined,
      targetWeight: tempTargetWeight
    };

    setSelectedRoutineExercises([...selectedRoutineExercises, newRoutineExercise]);
    setTempExerciseId('');
    // Reset defaults
    setTempTargetSets(3);
    setTempTargetReps(10);
    setTempTargetTime(60);
    setTempTargetWeight(undefined);
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

  // Helper to render current adding exercise input
  const renderExerciseInputs = () => {
    if (!tempExerciseId) return null;
    const exDef = data.exercises.find(e => e.id === tempExerciseId);
    if (!exDef) return null;

    return (
      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 mt-2 space-y-2 animate-in fade-in slide-in-from-top-1">
        <div className="flex gap-2 items-center text-sm font-bold text-slate-700 pb-1 border-b border-slate-200">
           {getTrackingIcon(exDef.trackingType)}
           <span>Hedefler</span>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
           <div>
             <label className="text-xs text-slate-500 block mb-1">Set Sayısı</label>
             <input type="number" min="1" value={tempTargetSets} onChange={e => setTempTargetSets(parseInt(e.target.value) || 1)} className="w-full p-2 border border-slate-200 rounded bg-white text-sm" />
           </div>

           {exDef.trackingType === 'weight_reps' && (
             <>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Hedef Tekrar</label>
                  <input type="number" value={tempTargetReps} onChange={e => setTempTargetReps(parseInt(e.target.value) || 0)} className="w-full p-2 border border-slate-200 rounded bg-white text-sm" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-slate-500 block mb-1">Hedef Ağırlık (Opsiyonel)</label>
                  <div className="flex items-center">
                    <input type="number" value={tempTargetWeight || ''} onChange={e => setTempTargetWeight(e.target.value ? parseFloat(e.target.value) : undefined)} className="w-full p-2 border border-slate-200 rounded-l bg-white text-sm" placeholder="Boş bırakılabilir" />
                    <span className="bg-slate-100 border border-l-0 border-slate-200 p-2 text-sm text-slate-500 rounded-r">kg</span>
                  </div>
                </div>
             </>
           )}

           {exDef.trackingType === 'time' && (
             <div>
               <label className="text-xs text-slate-500 block mb-1">Süre (Saniye)</label>
               <input type="number" value={tempTargetTime} onChange={e => setTempTargetTime(parseInt(e.target.value) || 0)} className="w-full p-2 border border-slate-200 rounded bg-white text-sm" />
             </div>
           )}
        </div>
        
        <Button onClick={addExerciseToRoutine} size="sm" fullWidth className="mt-2">Listeye Ekle</Button>
      </div>
    );
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
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                activeTab === tab ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
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

        {activeTab === 'exercises' && data.exercises.map(item => (
          <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col relative">
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900">{item.name}</h3>
                {item.media && <MediaButtons media={[item.media]} />}
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => handleEditItem(item)} className="text-slate-300 hover:text-brand-600" title="Düzenle">
                  <Pencil size={16} />
                </button>
                <button onClick={() => deleteItem(item.id, 'exercises')} className="text-slate-300 hover:text-red-500" title="Sil">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
               <span className="flex items-center gap-1">{getTrackingIcon(item.trackingType || 'weight_reps')} {getTrackingLabel(item.trackingType || 'weight_reps')}</span>
               {item.defaultSets && (
                 <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 border border-slate-200">
                   {item.defaultSets} set
                 </span>
               )}
            </div>
            <p className="text-sm text-slate-500 mb-2">{item.description}</p>
            <div className="flex flex-wrap gap-2">
              {item.equipmentIds.map(eqId => {
                const eq = data.equipment.find(e => e.id === eqId);
                if (!eq) return null;
                return (
                  <span key={eqId} className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs text-slate-700 font-medium">
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
        ))}

        {activeTab === 'routines' && data.routines.map(item => (
          <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 relative">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="font-bold text-slate-900">{item.name}</h3>
                <span className="text-xs font-semibold text-brand-600 bg-brand-50 px-2 py-0.5 rounded mt-1 inline-block">{item.category}</span>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => handleEditItem(item)} className="text-slate-300 hover:text-brand-600" title="Düzenle">
                  <Pencil size={16} />
                </button>
                <button onClick={() => deleteItem(item.id, 'routines')} className="text-slate-300 hover:text-red-500" title="Sil">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            {/* Expanded routine details */}
            <div className="mt-2 space-y-1">
              {item.exercises.slice(0, 3).map((ex, i) => {
                 const def = data.exercises.find(e => e.id === ex.exerciseId);
                 return (
                   <div key={i} className="text-xs text-slate-600 flex justify-between">
                      <span>• {def?.name || 'Silinmiş Egzersiz'}</span>
                      <span className="text-slate-400">
                        {ex.targetSets} set
                        {def?.trackingType === 'time' ? ` / ${ex.targetTimeSeconds}sn` : ` x ${ex.targetReps}`}
                      </span>
                   </div>
                 )
              })}
              {item.exercises.length > 3 && <div className="text-xs text-slate-400 italic">...ve {item.exercises.length - 3} daha</div>}
            </div>
          </div>
        ))}
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
                           <input type="number" min="1" value={newItemDefaultSets} onChange={e => setNewItemDefaultSets(parseInt(e.target.value)||1)} className="w-full p-2 border border-slate-300 rounded bg-white text-sm" />
                        </div>
                        {selectedTrackingType === 'weight_reps' && (
                          <>
                             <div>
                               <label className="text-xs text-slate-500 block mb-1">Varsayılan Tekrar</label>
                               <input type="number" value={newItemDefaultReps} onChange={e => setNewItemDefaultReps(parseInt(e.target.value)||0)} className="w-full p-2 border border-slate-300 rounded bg-white text-sm" />
                             </div>
                             <div className="col-span-2">
                               <label className="text-xs text-slate-500 block mb-1">Varsayılan Ağırlık (kg)</label>
                               <input type="number" value={newItemDefaultWeight || ''} onChange={e => setNewItemDefaultWeight(e.target.value ? parseFloat(e.target.value) : undefined)} className="w-full p-2 border border-slate-300 rounded bg-white text-sm" placeholder="Opsiyonel" />
                             </div>
                          </>
                        )}
                        {selectedTrackingType === 'time' && (
                          <div>
                             <label className="text-xs text-slate-500 block mb-1">Varsayılan Süre (sn)</label>
                             <input type="number" value={newItemDefaultTime} onChange={e => setNewItemDefaultTime(parseInt(e.target.value)||0)} className="w-full p-2 border border-slate-300 rounded bg-white text-sm" />
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
                       <div onClick={() => fileInputRef.current?.click()} className="h-24 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-all text-center px-1"><ImageIcon className="w-6 h-6 text-slate-400 mb-1"/><span className="text-[10px] font-medium text-slate-500">Galeri</span></div>
                       <div onClick={() => cameraInputRef.current?.click()} className="h-24 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-all text-center px-1"><Camera className="w-6 h-6 text-slate-400 mb-1" /><span className="text-[10px] font-medium text-slate-500">Fotoğraf</span></div>
                       <div onClick={() => videoInputRef.current?.click()} className="h-24 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-all text-center px-1"><Video className="w-6 h-6 text-slate-400 mb-1" /><span className="text-[10px] font-medium text-slate-500">Video</span></div>
                     </div>
                   )}
                </div>
              )}

              {activeTab !== 'routines' && (
                 <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Açıklama / Notlar</label>
                  <textarea value={newItemDesc} onChange={(e) => setNewItemDesc(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2" rows={3}/>
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
                         return (
                           <div key={idx} className="flex justify-between items-center bg-brand-50 p-2 rounded-lg border border-brand-100">
                             <div className="text-sm">
                               <div className="font-bold text-brand-800">{def?.name}</div>
                               <div className="text-xs text-brand-600">
                                  {re.targetSets} set x {def?.trackingType === 'time' ? `${re.targetTimeSeconds}sn` : `${re.targetReps} tekrar`}
                                  {re.targetWeight ? ` @ ${re.targetWeight}kg` : ''}
                               </div>
                             </div>
                             <button onClick={() => removeExerciseFromRoutine(re.exerciseId)} className="text-red-400 p-1 hover:text-red-600"><X size={14}/></button>
                           </div>
                         )
                      })}
                    </div>
                    
                    {/* Add Exercise Selector */}
                    <div className="border border-slate-200 rounded-lg p-2 bg-slate-50">
                      <select value={tempExerciseId} onChange={(e) => setTempExerciseId(e.target.value)} className="w-full p-2 text-sm border-slate-300 rounded mb-1">
                        <option value="">+ Egzersiz Ekle</option>
                        {data.exercises.filter(e => !selectedRoutineExercises.find(re => re.exerciseId === e.id)).map(e => (
                           <option key={e.id} value={e.id}>{e.name}</option>
                        ))}
                      </select>
                      
                      {/* Detailed Inputs for Selected Exercise */}
                      {renderExerciseInputs()}
                    </div>
                  </div>
                </>
              )}
              <Button onClick={handleSaveItem} fullWidth className="mt-4">{editingId ? 'Güncelle' : 'Kaydet'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};