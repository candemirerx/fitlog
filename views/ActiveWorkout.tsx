import React, { useState, useEffect, useRef } from 'react';
import { AppData, WorkoutLog, WorkoutExerciseLog, WorkoutSet, Routine, TrackingType } from '../types';
import { Button } from '../components/Button';
import { Check, Plus, Minus, Play, Save, Clock, AlertCircle, Camera, Video, Image as ImageIcon, X, Trash2, ChevronDown, Filter } from 'lucide-react';

export const MediaButtons: React.FC<{ media?: string[], compact?: boolean }> = ({ media, compact = false }) => {
  const [selectedMedia, setSelectedMedia] = useState<string | null>(null);

  if (!media || media.length === 0 || media.every(m => !m)) return null;

  const validMedia = media.filter((m): m is string => !!m);

  if (validMedia.length === 0) return null;

  const isVideo = (src: string) => src.startsWith('data:video') || src.endsWith('.mp4') || src.endsWith('.mov');

  const buttonSizeClass = compact 
    ? "w-5 h-5 rounded-md" 
    : "w-6 h-6 rounded";

  const iconSize = compact ? 10 : 12;

  return (
    <>
      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
        {validMedia.map((m, idx) => (
          <button 
            key={idx} 
            onClick={(e) => { e.stopPropagation(); setSelectedMedia(m); }}
            className={`${buttonSizeClass} bg-brand-100 text-brand-600 flex items-center justify-center hover:bg-brand-200 transition-colors shadow-sm border border-brand-200/50`}
            type="button"
            title="Medyayı Görüntüle"
          >
            {isVideo(m) ? <Video size={iconSize} /> : <ImageIcon size={iconSize} />}
          </button>
        ))}
      </div>

      {selectedMedia && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 animate-in fade-in duration-200" 
          onClick={(e) => { e.stopPropagation(); setSelectedMedia(null); }}
        >
          <div className="relative max-w-full max-h-full" onClick={(e) => e.stopPropagation()}>
            <button 
              onClick={() => setSelectedMedia(null)} 
              className="absolute -top-12 right-0 text-white p-2 hover:bg-white/10 rounded-full"
              type="button"
            >
              <X size={24} />
            </button>
            {isVideo(selectedMedia) ? (
               <video src={selectedMedia} controls autoPlay className="max-w-full max-h-[80vh] rounded-lg" />
            ) : (
               <img src={selectedMedia} alt="Media" className="max-w-full max-h-[80vh] rounded-lg object-contain" />
            )}
          </div>
        </div>
      )}
    </>
  );
};

interface ActiveWorkoutProps {
  data: AppData;
  onSaveLog: (log: WorkoutLog) => void;
}

export const ActiveWorkoutView: React.FC<ActiveWorkoutProps> = ({ data, onSaveLog }) => {
  const [step, setStep] = useState<'select' | 'active'>('select');
  const [selectedRoutine, setSelectedRoutine] = useState<Routine | null>(null);
  
  // Selection Filter State
  const [filterCategory, setFilterCategory] = useState<string>('Tümü');
  
  // Active Session State
  const [sessionExercises, setSessionExercises] = useState<WorkoutExerciseLog[]>([]);
  const [sessionNote, setSessionNote] = useState('');
  const [sessionMedia, setSessionMedia] = useState<string[]>([]);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [elapsed, setElapsed] = useState(0);

  // File Inputs
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Restore session on mount
  useEffect(() => {
    const savedSession = localStorage.getItem('fitlog_active_session');
    if (savedSession && step === 'select') {
      try {
        const parsed = JSON.parse(savedSession);
        if (parsed.sessionExercises) {
          if (window.confirm('Yarım kalmış bir antrenmanınız bulundu. Kaldığınız yerden devam etmek ister misiniz?')) {
            setSessionExercises(parsed.sessionExercises);
            setSessionNote(parsed.sessionNote || '');
            setSessionMedia(parsed.sessionMedia || []);
            setStartTime(parsed.startTime ? new Date(parsed.startTime) : new Date());
            setSelectedRoutine(parsed.selectedRoutine);
            setStep('active');
          } else {
            localStorage.removeItem('fitlog_active_session');
          }
        }
      } catch (e) {
        console.error("Failed to parse saved session", e);
        localStorage.removeItem('fitlog_active_session');
      }
    }
  }, []);

  // Auto-save session state
  useEffect(() => {
    if (step === 'active' && startTime) {
      const sessionData = {
        sessionExercises,
        sessionNote,
        sessionMedia,
        startTime: startTime.toISOString(),
        selectedRoutine
      };
      localStorage.setItem('fitlog_active_session', JSON.stringify(sessionData));
    }
  }, [step, sessionExercises, sessionNote, sessionMedia, startTime, selectedRoutine]);

  useEffect(() => {
    let interval: any;
    if (step === 'active' && startTime) {
      interval = setInterval(() => {
        const now = new Date().getTime();
        const start = startTime.getTime();
        if (!isNaN(start)) {
           setElapsed(Math.floor((now - start) / 1000));
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [step, startTime]);

  // Image Processing Logic
  const resizeImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const MAX_WIDTH = 1024;
          const MAX_HEIGHT = 1024;
          if (width > height) {
            if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
          } else {
            if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
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
          setSessionMedia(prev => [...prev, compressedImage]);
        } else if (file.type.startsWith('video/')) {
          if (file.size > 15 * 1024 * 1024) { 
            alert("Video boyutu çok yüksek. Lütfen daha kısa bir video çekin.");
            return;
          }
          const reader = new FileReader();
          reader.onloadend = () => {
             setSessionMedia(prev => [...prev, reader.result as string]);
          };
          reader.readAsDataURL(file);
        }
      } catch (error) {
        alert("Medya işlenirken hata oluştu.");
      }
    }
  };

  const removeMedia = (index: number) => {
    if(confirm('Bu medyayı silmek istediğinize emin misiniz?')) {
      setSessionMedia(prev => prev.filter((_, i) => i !== index));
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startWorkout = (routine?: Routine) => {
    let exercises: WorkoutExerciseLog[] = [];

    if (routine && routine.exercises) {
      // Create session based on Routine Targets
      exercises = routine.exercises.map(targetEx => {
        const initialSets: WorkoutSet[] = [];
        const numSets = targetEx.targetSets || 3;
        
        for (let i = 0; i < numSets; i++) {
           initialSets.push({
             weight: targetEx.targetWeight || 0,
             reps: targetEx.targetReps || 0,
             timeSeconds: targetEx.targetTimeSeconds || 0,
             completed: false
           });
        }
        return { exerciseId: targetEx.exerciseId, sets: initialSets };
      });
    } else {
      // Fallback or empty routine
       exercises = [];
    }
    
    setSessionExercises(exercises);
    setSelectedRoutine(routine || { id: 'custom', name: 'Serbest Antrenman', category: 'Diğer', exercises: [] });
    setSessionMedia([]);
    setStartTime(new Date());
    setStep('active');
  };

  // State Helpers
  const updateSessionExercises = (updater: (exs: WorkoutExerciseLog[]) => WorkoutExerciseLog[]) => {
    setSessionExercises(prev => updater([...prev]));
  };

  const toggleSetComplete = (exIdx: number, setIdx: number) => {
    updateSessionExercises(prev => {
      const newExs = [...prev];
      const newSets = [...newExs[exIdx].sets];
      newSets[setIdx] = { ...newSets[setIdx], completed: !newSets[setIdx].completed };
      newExs[exIdx] = { ...newExs[exIdx], sets: newSets };
      return newExs;
    });
  };

  const updateSet = (exIdx: number, setIdx: number, field: keyof WorkoutSet, value: number) => {
    updateSessionExercises(prev => {
      const newExs = [...prev];
      const newSets = [...newExs[exIdx].sets];
      newSets[setIdx] = { ...newSets[setIdx], [field]: value };
      newExs[exIdx] = { ...newExs[exIdx], sets: newSets };
      return newExs;
    });
  };

  const addSet = (exIdx: number) => {
    updateSessionExercises(prev => {
      const newExs = [...prev];
      const previousSet = newExs[exIdx].sets[newExs[exIdx].sets.length - 1];
      const newSet: WorkoutSet = { 
        weight: previousSet?.weight || 0, 
        reps: previousSet?.reps || 0, 
        timeSeconds: previousSet?.timeSeconds || 0,
        completed: false 
      };
      newExs[exIdx] = { ...newExs[exIdx], sets: [...newExs[exIdx].sets, newSet] };
      return newExs;
    });
  };
  
  const removeSet = (exIdx: number, setIdx: number) => {
    updateSessionExercises(prev => {
      const newExs = [...prev];
      if (newExs[exIdx].sets.length > 1) {
        const newSets = [...newExs[exIdx].sets];
        newSets.splice(setIdx, 1);
        newExs[exIdx] = { ...newExs[exIdx], sets: newSets };
      }
      return newExs;
    });
  };

  const addExerciseToSession = (exerciseId: string) => {
    const exerciseDef = data.exercises.find(e => e.id === exerciseId);
    
    // Determine initial sets based on defaults or fallback to 1
    const setQuantity = exerciseDef?.defaultSets || 1;
    
    // Create configured sets based on defaults
    const newSets: WorkoutSet[] = Array.from({ length: setQuantity }).map(() => ({
      weight: exerciseDef?.defaultWeight || 0,
      reps: exerciseDef?.defaultReps || 0,
      timeSeconds: exerciseDef?.defaultTimeSeconds || 0,
      completed: false
    }));

    updateSessionExercises(prev => [
      ...prev, 
      { exerciseId, sets: newSets }
    ]);
  };

  const finishWorkout = () => {
    try {
      const safeStartTime = startTime || new Date();
      const endTime = new Date();
      let durationSeconds = 0;
      if (safeStartTime && !isNaN(safeStartTime.getTime())) {
        durationSeconds = Math.floor((endTime.getTime() - safeStartTime.getTime()) / 1000);
      }
      if (durationSeconds < 0 || isNaN(durationSeconds)) durationSeconds = 0;

      const newLog: WorkoutLog = {
        id: Date.now().toString(),
        date: safeStartTime.toISOString(),
        startTime: safeStartTime.toISOString(),
        endTime: endTime.toISOString(),
        durationSeconds: durationSeconds,
        routineName: selectedRoutine?.name || 'Serbest Antrenman',
        category: selectedRoutine?.category || 'Diğer',
        exercises: JSON.parse(JSON.stringify(sessionExercises)),
        notes: sessionNote,
        media: sessionMedia
      };

      onSaveLog(newLog);
      
      localStorage.removeItem('fitlog_active_session');
      setStep('select');
      setElapsed(0);
      setSessionExercises([]);
      setSessionMedia([]);
      setSessionNote('');
      setStartTime(null);
    } catch (err) {
      alert("Kayıt sırasında bir hata oluştu: " + err);
      console.error(err);
    }
  };

  if (step === 'select') {
    const categories = ['Tümü', ...Array.from(new Set(data.routines.map(r => r.category)))];
    const filteredRoutines = filterCategory === 'Tümü' 
      ? data.routines 
      : data.routines.filter(r => r.category === filterCategory);

    return (
      <div className="space-y-6 pb-20">
        <h2 className="text-xl font-bold text-slate-900">Antrenman Başlat</h2>
        <div className="grid grid-cols-1 gap-4">
          <button onClick={() => startWorkout()} className="flex items-center justify-between p-5 bg-gradient-to-r from-brand-500 to-brand-600 text-white rounded-xl shadow-lg hover:shadow-xl transition-all">
            <div><span className="block font-bold text-lg">Serbest Antrenman</span><span className="text-brand-100 text-sm">Hemen başla</span></div>
            <Play fill="currentColor" />
          </button>
          
          <div className="flex items-center justify-between mt-6 mb-2">
             <div className="flex items-center gap-2 text-sm font-semibold text-slate-500 uppercase tracking-wider">
               <Filter size={14} />
               <span>Antrenmanlarım</span>
             </div>
             
             <div className="relative">
               <select 
                 value={filterCategory} 
                 onChange={(e) => setFilterCategory(e.target.value)}
                 className="appearance-none bg-white border border-slate-300 text-slate-700 text-xs font-medium rounded-full py-1.5 pl-3 pr-8 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer"
               >
                 {categories.map(cat => (
                   <option key={cat} value={cat}>{cat}</option>
                 ))}
               </select>
               <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
             </div>
          </div>
          
          <div className="space-y-3">
            {filteredRoutines.length > 0 ? (
              filteredRoutines.map(routine => (
                <button key={routine.id} onClick={() => startWorkout(routine)} className="w-full bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between hover:border-brand-300 transition-colors text-left group">
                  <div>
                    <span className="block font-bold text-slate-900 group-hover:text-brand-700 transition-colors">{routine.name}</span>
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">{routine.category}</span>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center text-brand-600 group-hover:bg-brand-500 group-hover:text-white transition-all"><Play size={16} fill="currentColor" /></div>
                </button>
              ))
            ) : (
              <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                <p className="text-sm text-slate-400">Bu kategoride antrenman programı bulunamadı.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const isVideo = (src: string) => src.startsWith('data:video') || src.endsWith('.mp4');

  return (
    <div className="pb-24">
      <div className="sticky top-0 bg-slate-50/95 backdrop-blur z-10 py-2 border-b border-slate-200 mb-4 flex justify-between items-center shadow-sm -mx-4 px-4 md:mx-0 md:px-0">
        <div>
          <h2 className="font-bold text-slate-900">{selectedRoutine?.name}</h2>
          <div className="flex items-center gap-1 text-brand-600 font-mono text-sm"><Clock size={14} />{formatTime(elapsed)}</div>
        </div>
        <Button onClick={finishWorkout} size="sm" className="flex items-center gap-2"><Save size={16} /> Kaydet</Button>
      </div>

      <div className="space-y-6">
        {sessionExercises.length === 0 && (
          <div className="p-4 bg-yellow-50 text-yellow-700 rounded-lg text-sm flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <p>Egzersiz seçerek başlayın.</p>
          </div>
        )}
        
        {sessionExercises.map((exLog, exIdx) => {
          const exerciseDef = data.exercises.find(e => e.id === exLog.exerciseId);
          const trackingType = exerciseDef?.trackingType || 'weight_reps';

          return (
            <div key={exIdx} className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="bg-slate-50 px-4 py-2 border-b border-slate-100 flex justify-between items-center">
                <h3 className="font-bold text-slate-800">{exerciseDef?.name || 'Bilinmeyen'}</h3>
                {exerciseDef?.media && <MediaButtons media={[exerciseDef.media]} />}
              </div>
              <div className="p-4 space-y-3">
                <div className={`grid gap-2 text-xs text-slate-400 font-medium text-center uppercase mb-1 ${trackingType === 'weight_reps' ? 'grid-cols-10' : trackingType === 'time' ? 'grid-cols-8' : 'grid-cols-6'}`}>
                  <div className="col-span-1">Set</div>
                  {trackingType === 'weight_reps' && <><div className="col-span-3">kg</div><div className="col-span-3">Tekrar</div><div className="col-span-3">Durum</div></>}
                  {trackingType === 'time' && <><div className="col-span-5">Süre</div><div className="col-span-2">Durum</div></>}
                  {trackingType === 'completion' && <div className="col-span-5 text-right pr-4">Tamamlandı?</div>}
                </div>

                {exLog.sets.map((set, setIdx) => (
                  <div key={setIdx} className={`grid gap-2 items-center ${set.completed ? 'opacity-50' : ''} ${trackingType === 'weight_reps' ? 'grid-cols-10' : trackingType === 'time' ? 'grid-cols-8' : 'grid-cols-6'}`}>
                    <div className="col-span-1 text-center font-bold text-slate-500">{setIdx + 1}</div>
                    {trackingType === 'weight_reps' && (
                      <>
                        <div className="col-span-3"><input type="number" value={set.weight || ''} onChange={(e) => updateSet(exIdx, setIdx, 'weight', parseFloat(e.target.value))} className="w-full text-center bg-slate-50 border border-slate-200 rounded p-1" placeholder="0"/></div>
                        <div className="col-span-3"><input type="number" value={set.reps || ''} onChange={(e) => updateSet(exIdx, setIdx, 'reps', parseFloat(e.target.value))} className="w-full text-center bg-slate-50 border border-slate-200 rounded p-1" placeholder="0"/></div>
                      </>
                    )}
                    {trackingType === 'time' && (
                      <div className="col-span-5 flex gap-1">
                          <input type="number" value={Math.floor((set.timeSeconds || 0) / 60) || ''} onChange={(e) => {const mins = parseInt(e.target.value)||0; const secs = (set.timeSeconds||0)%60; updateSet(exIdx, setIdx, 'timeSeconds', (mins*60)+secs)}} className="w-full text-center bg-slate-50 border border-slate-200 rounded p-1" placeholder="Dk"/>
                          <span className="text-slate-400 py-1">:</span>
                          <input type="number" max={59} value={((set.timeSeconds || 0) % 60) || ''} onChange={(e) => {const secs = parseInt(e.target.value)||0; const mins = Math.floor((set.timeSeconds||0)/60); updateSet(exIdx, setIdx, 'timeSeconds', (mins*60)+secs)}} className="w-full text-center bg-slate-50 border border-slate-200 rounded p-1" placeholder="Sn"/>
                      </div>
                    )}
                    <div className={`${trackingType === 'completion' ? 'col-span-5 flex justify-end gap-2' : trackingType === 'time' ? 'col-span-2 flex justify-center gap-1' : 'col-span-3 flex justify-center gap-1'}`}>
                      <button onClick={() => toggleSetComplete(exIdx, setIdx)} className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${set.completed ? 'bg-brand-500 text-white' : 'bg-slate-200 text-slate-400'}`}><Check size={16} /></button>
                      <button onClick={() => removeSet(exIdx, setIdx)} className="w-8 h-8 rounded bg-red-50 text-red-400 flex items-center justify-center hover:bg-red-100"><Minus size={14} /></button>
                    </div>
                  </div>
                ))}
                <button onClick={() => addSet(exIdx)} className="w-full py-2 mt-2 flex items-center justify-center gap-2 text-sm text-brand-600 font-medium bg-brand-50 rounded-lg hover:bg-brand-100 transition-colors"><Plus size={16} /> Set Ekle</button>
              </div>
            </div>
          );
        })}

        <div className="mt-4">
           <select className="w-full p-3 bg-white border border-slate-300 rounded-xl shadow-sm text-slate-600 outline-none" onChange={(e) => { if(e.target.value) { addExerciseToSession(e.target.value); e.target.value = ''; }}} defaultValue="">
             <option value="" disabled>+ Egzersiz Ekle</option>
             {data.exercises.filter(e => !sessionExercises.find(se => se.exerciseId === e.id)).map(e => (<option key={e.id} value={e.id}>{e.name}</option>))}
           </select>
        </div>

        {/* MEDIA SECTION */}
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <label className="block text-sm font-medium text-slate-700 mb-2">Medya Ekle (Fotoğraf / Video)</label>
          <div className="grid grid-cols-4 gap-2 mb-2">
            {sessionMedia.map((media, idx) => (
              <div key={idx} className="relative aspect-square bg-slate-100 rounded-lg overflow-hidden border border-slate-200">
                {isVideo(media) ? (
                  <video src={media} className="w-full h-full object-cover" />
                ) : (
                  <img src={media} className="w-full h-full object-cover" />
                )}
                <button onClick={() => removeMedia(idx)} className="absolute top-1 right-1 bg-red-500/80 text-white p-1 rounded-full"><Trash2 size={12} /></button>
              </div>
            ))}
          </div>
          
          <div className="flex gap-2">
            <input type="file" ref={cameraInputRef} onChange={handleMediaUpload} accept="image/*" capture="environment" className="hidden" />
            <input type="file" ref={videoInputRef} onChange={handleMediaUpload} accept="video/*" capture="environment" className="hidden" />
            <input type="file" ref={galleryInputRef} onChange={handleMediaUpload} accept="image/*,video/*" className="hidden" />

            <Button onClick={() => cameraInputRef.current?.click()} variant="secondary" size="sm" className="flex-1"><Camera size={16} className="mr-1"/> Fotoğraf</Button>
            <Button onClick={() => videoInputRef.current?.click()} variant="secondary" size="sm" className="flex-1"><Video size={16} className="mr-1"/> Video</Button>
            <Button onClick={() => galleryInputRef.current?.click()} variant="secondary" size="sm" className="flex-1"><ImageIcon size={16} className="mr-1"/> Galeri</Button>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <label className="block text-sm font-medium text-slate-700 mb-2">Antrenman Notları</label>
          <textarea value={sessionNote} onChange={(e) => setSessionNote(e.target.value)} className="w-full border border-slate-200 rounded-lg p-2 text-sm outline-none" rows={2} placeholder="Bugün nasıl hissettin?"></textarea>
        </div>
      </div>
    </div>
  );
};