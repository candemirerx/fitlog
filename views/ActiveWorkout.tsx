import React, { useState, useEffect, useRef } from 'react';
import { AppData, WorkoutLog, WorkoutExerciseLog, WorkoutSet, Routine, Movement, MovementEffectArea } from '../types';
import { Button } from '../components/Button';
import {
  Check, Play, Save, Clock, AlertCircle, Camera, Video,
  Image as ImageIcon, X, Trash2, ChevronDown, Filter,
  MessageSquare, Timer, Dumbbell, RotateCcw, ChevronRight, Pencil, Loader2, Pause,
  Plus, Search, Move, Package
} from 'lucide-react';
import { auth } from '../firebase';
import { processAndUploadVideo, isVideoSource, isStorageUrl } from '../utils/videoUtils';

// Etki Alanları tanımları
const EFFECT_AREAS: { key: MovementEffectArea; label: string; emoji: string }[] = [
  { key: 'stretching', label: 'Açma', emoji: '🔓' },
  { key: 'balance', label: 'Denge', emoji: '⚖️' },
  { key: 'breathing', label: 'Nefes', emoji: '🌬️' },
  { key: 'strength', label: 'Kas Kuvvet', emoji: '💪' },
  { key: 'cardio', label: 'Kardiyo', emoji: '❤️' },
  { key: 'flexibility', label: 'Germe', emoji: '🧘' },
];

// Media Viewer Component
export const MediaButtons: React.FC<{ media?: string[], compact?: boolean }> = ({ media, compact = false }) => {
  const [selectedMedia, setSelectedMedia] = useState<string | null>(null);

  if (!media || media.length === 0 || media.every(m => !m)) return null;
  const validMedia = media.filter((m): m is string => !!m);
  if (validMedia.length === 0) return null;

  const isVideo = (src: string) => isVideoSource(src);
  const buttonSizeClass = compact ? "w-5 h-5 rounded-md" : "w-6 h-6 rounded";
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
            <button onClick={() => setSelectedMedia(null)} className="absolute -top-12 right-0 text-white p-2 hover:bg-white/10 rounded-full" type="button">
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

// Simplified Exercise Session Data with override values for inline editing
interface ExerciseSession {
  exerciseId: string;
  completed: boolean;
  note: string;
  actualDurationSeconds?: number;
  // Override values for inline editing (only used in free workout)
  overrideSets?: number;
  overrideReps?: number;
  overrideWeight?: number;
  overrideTimeSeconds?: number;
  // Exercise Timer (for timed exercises) - legacy single timer
  timerRemaining?: number; // Kalan süre (saniye)
  timerRunning?: boolean;  // Timer çalışıyor mu
  // Movement-based timers (for exercises with multiple timed movements)
  movementTimers?: {
    [movementId: string]: {
      remaining: number;
      targetTime: number;
      running: boolean;
      completed: boolean;
    }
  };
  // Karma antrenman için: kullanıcı manuel başlatacak
  timerPendingStart?: boolean;
}

export const ActiveWorkoutView: React.FC<ActiveWorkoutProps> = ({ data, onSaveLog }) => {
  const [step, setStep] = useState<'select' | 'active'>('select');
  const [selectedRoutine, setSelectedRoutine] = useState<Routine | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('Tümü');

  // Simplified Session State
  const [sessionExercises, setSessionExercises] = useState<ExerciseSession[]>([]);
  const [sessionNote, setSessionNote] = useState('');
  const [sessionMedia, setSessionMedia] = useState<string[]>([]);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [elapsed, setElapsed] = useState(0);

  // Rest Timer
  const [restTimer, setRestTimer] = useState(0);
  const [isResting, setIsResting] = useState(false);
  const [restDuration, setRestDuration] = useState(60); // Default 60 seconds

  // Expanded Note Index
  const [expandedNoteIdx, setExpandedNoteIdx] = useState<number | null>(null);

  // Expanded Edit Index (for inline editing)
  const [expandedEditIdx, setExpandedEditIdx] = useState<number | null>(null);

  // Active Exercise Timer Index
  const [activeTimerIdx, setActiveTimerIdx] = useState<number | null>(null);

  // Expanded Exercise Details (for showing movements)
  const [expandedExerciseIdx, setExpandedExerciseIdx] = useState<number | null>(null);
  const [expandedMovements, setExpandedMovements] = useState<Set<string>>(new Set());

  // Quick Save Modal State
  const [quickSaveModalOpen, setQuickSaveModalOpen] = useState(false);
  const [quickSaveRoutine, setQuickSaveRoutine] = useState<Routine | null>(null);
  const [quickSaveSelectedExercises, setQuickSaveSelectedExercises] = useState<string[]>([]);

  // Exercise/Movement Picker for Free Workout
  const [isExercisePickerOpen, setIsExercisePickerOpen] = useState(false);
  const [pickerSelectedIds, setPickerSelectedIds] = useState<string[]>([]);
  const [exerciseSearchQuery, setExerciseSearchQuery] = useState('');
  const [pickerTab, setPickerTab] = useState<'exercises' | 'movements'>('exercises');

  // Video Upload Progress
  const [videoUploadProgress, setVideoUploadProgress] = useState<number | null>(null);

  // File Inputs
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Ses uyarısı fonksiyonu
  const lastSpokenTimeRef = useRef(0);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const speakAlert = (message: string) => {
    if (!('speechSynthesis' in window)) return;

    // Aynı mesajı çok sık tekrar etme (1 saniye içinde)
    const now = Date.now();
    if (now - lastSpokenTimeRef.current < 1000) return;
    lastSpokenTimeRef.current = now;

    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = 'tr-TR';
    utterance.rate = 1.1;

    // Garbage collection fix: referansı tut
    utteranceRef.current = utterance;
    utterance.onend = () => { utteranceRef.current = null; };

    speechSynthesis.speak(utterance);
  };

  // Session Timer
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

  // Rest Timer
  useEffect(() => {
    let interval: any;
    if (isResting && restTimer > 0) {
      interval = setInterval(() => {
        setRestTimer(prev => {
          // Son 10 saniye uyarısı - sıradaki egzersizin ismini söyle
          if (prev === 11) {
            const nextExercise = sessionExercises.find(ex => !ex.completed);
            if (nextExercise) {
              const nextExDef = data.exercises.find(e => e.id === nextExercise.exerciseId);
              speakAlert(`Son 10 saniye! Sıradaki: ${nextExDef?.name || 'Egzersiz'}`);
            } else {
              speakAlert('Dinlenme süresi bitiyor, son 10 saniye!');
            }
          }
          if (prev <= 1) {
            setIsResting(false);

            // Sıradaki tamamlanmamış egzersizi bul
            const nextExercise = sessionExercises.find(ex => !ex.completed);
            if (nextExercise) {
              const nextExDef = data.exercises.find(e => e.id === nextExercise.exerciseId);
              speakAlert(`Başla! ${nextExDef?.name || 'Egzersiz'}`);
            } else {
              speakAlert('Dinlenme bitti!');
            }

            // Vibrate if available
            if (navigator.vibrate) navigator.vibrate([200, 100, 200]);

            // Sıradaki tamamlanmamış süresli egzersizi bul ve başlat
            const nextTimedIdx = sessionExercises.findIndex(
              ex => ex.timerRemaining !== undefined && ex.timerRemaining > 0 && !ex.completed
            );
            if (nextTimedIdx !== -1) {
              setSessionExercises(prev => prev.map((ex, i) =>
                i === nextTimedIdx ? { ...ex, timerRunning: true } : { ...ex, timerRunning: false }
              ));
              setActiveTimerIdx(nextTimedIdx);
            }

            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isResting, restTimer, sessionExercises, data.exercises]);

  // Exercise Timer - Egzersiz geri sayımı
  useEffect(() => {
    let interval: any;
    if (activeTimerIdx !== null) {
      const exSession = sessionExercises[activeTimerIdx];
      if (exSession?.timerRunning && exSession.timerRemaining && exSession.timerRemaining > 0) {
        interval = setInterval(() => {
          setSessionExercises(prev => {
            const updated = [...prev];
            const current = updated[activeTimerIdx];
            if (current && current.timerRemaining && current.timerRemaining > 0) {
              const newRemaining = current.timerRemaining - 1;

              // Son 10 saniye uyarısı - Egzersiz için
              if (newRemaining === 10) {
                // Sırada başka egzersiz var mı kontrol et
                const nextIdx = activeTimerIdx + 1;
                const nextExercise = nextIdx < prev.length ? prev[nextIdx] : null;

                if (nextExercise && !nextExercise.completed) {
                  const nextExDef = data.exercises.find(e => e.id === nextExercise.exerciseId);
                  speakAlert(`Son 10 saniye! Sıradaki: ${nextExDef?.name || 'Egzersiz'}`);
                } else {
                  speakAlert('Son 10 saniye!');
                }
              }

              if (newRemaining <= 0) {
                // Süre bitti - tamamlandı yap
                updated[activeTimerIdx] = {
                  ...current,
                  timerRemaining: 0,
                  timerRunning: false,
                  completed: true,
                  actualDurationSeconds: (current.overrideTimeSeconds ||
                    data.exercises.find(e => e.id === current.exerciseId)?.defaultTimeSeconds || 0)
                };
                setActiveTimerIdx(null);

                // Vibrate
                if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200]);

                // Sıradaki egzersiz varsa dinlenme başlat (süreli olsun olmasın)
                const nextIdx = activeTimerIdx + 1;
                if (nextIdx < prev.length && !prev[nextIdx].completed) {
                  // Sırada egzersiz var - "Egzersiz tamamlandı" demeye gerek yok, direkt dinlenme uyarısı gelecek
                  setTimeout(() => {
                    setRestTimer(restDuration);
                    setIsResting(true);
                    speakAlert('Dinlenme süresi başladı');
                  }, 500);
                } else {
                  // Son egzersiz
                  speakAlert('Egzersiz tamamlandı!');
                }
              } else {
                updated[activeTimerIdx] = {
                  ...current,
                  timerRemaining: newRemaining
                };
              }
            }
            return updated;
          });
        }, 1000);
      }
    }
    return () => clearInterval(interval);
  }, [activeTimerIdx, sessionExercises, data.exercises, restDuration]);

  // Movement Timer - Hareket bazlı geri sayım
  useEffect(() => {
    let interval: any;

    // Aktif hareket timer'ı bul
    const exWithRunningMovement = sessionExercises.findIndex(ex =>
      ex.movementTimers && Object.values(ex.movementTimers).some((mt: any) => mt.running)
    );

    if (exWithRunningMovement !== -1) {
      const exSession = sessionExercises[exWithRunningMovement];
      if (exSession?.movementTimers) {
        const runningMovId = Object.keys(exSession.movementTimers).find(
          mId => exSession.movementTimers![mId].running
        );

        if (runningMovId) {
          interval = setInterval(() => {
            setSessionExercises(prev => {
              const updated = [...prev];
              const currentEx = { ...updated[exWithRunningMovement] };
              if (!currentEx.movementTimers) return prev;

              const movTimer = currentEx.movementTimers[runningMovId];
              if (!movTimer || !movTimer.running) return prev;

              const newRemaining = movTimer.remaining - 1;

              // Son 10 saniye uyarısı
              if (newRemaining === 10) {
                const mov = (data.movements || []).find(m => m.id === runningMovId);
                speakAlert(`Son 10 saniye! ${mov?.name || ''}`);
              }

              if (newRemaining <= 0) {
                // Hareket tamamlandı
                currentEx.movementTimers = {
                  ...currentEx.movementTimers,
                  [runningMovId]: {
                    ...movTimer,
                    remaining: 0,
                    running: false,
                    completed: true
                  }
                };

                // Sıradaki hareketi bul
                const movementIds = Object.keys(currentEx.movementTimers);
                const currentIdx = movementIds.indexOf(runningMovId);
                const nextMovId = movementIds[currentIdx + 1];

                if (nextMovId && !currentEx.movementTimers[nextMovId].completed) {
                  // Sonraki hareketi başlat
                  currentEx.movementTimers = {
                    ...currentEx.movementTimers,
                    [nextMovId]: {
                      ...currentEx.movementTimers[nextMovId],
                      running: true
                    }
                  };
                  const nextMov = (data.movements || []).find(m => m.id === nextMovId);
                  const nextDuration = currentEx.movementTimers[nextMovId].targetTime;
                  const durationText = nextDuration >= 60
                    ? `${Math.floor(nextDuration / 60)} dakika${nextDuration % 60 > 0 ? ` ${nextDuration % 60} saniye` : ''}`
                    : `${nextDuration} saniye`;
                  speakAlert(`${nextMov?.name || 'Hareket'} başlıyor. ${durationText}`);
                } else {
                  // Tüm hareketler tamamlandı - egzersizi tamamla
                  const allCompleted = Object.values(currentEx.movementTimers).every((mt: any) => mt.completed);
                  if (allCompleted) {
                    currentEx.completed = true;
                    if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200]);

                    // Sıradaki egzersiz varsa dinlenme başlat
                    const nextExIdx = exWithRunningMovement + 1;
                    if (nextExIdx < prev.length && !prev[nextExIdx].completed) {
                      setTimeout(() => {
                        setRestTimer(restDuration);
                        setIsResting(true);
                        speakAlert('Dinlenme süresi başladı');
                      }, 500);
                    } else {
                      speakAlert('Egzersiz tamamlandı!');
                    }
                  }
                }
              } else {
                currentEx.movementTimers = {
                  ...currentEx.movementTimers,
                  [runningMovId]: {
                    ...movTimer,
                    remaining: newRemaining
                  }
                };
              }

              updated[exWithRunningMovement] = currentEx;
              return updated;
            });
          }, 1000);
        }
      }
    }

    return () => clearInterval(interval);
  }, [sessionExercises, data.movements, restDuration]);

  // Auto-save session
  useEffect(() => {
    if (step === 'active' && startTime) {
      const sessionData = { sessionExercises, sessionNote, sessionMedia, startTime: startTime.toISOString(), selectedRoutine };
      localStorage.setItem('fitlog_active_session', JSON.stringify(sessionData));
    }
  }, [step, sessionExercises, sessionNote, sessionMedia, startTime, selectedRoutine]);

  // Restore session on mount
  useEffect(() => {
    const savedSession = localStorage.getItem('fitlog_active_session');
    if (savedSession && step === 'select') {
      try {
        const parsed = JSON.parse(savedSession);
        if (parsed.sessionExercises && window.confirm('Yarım kalmış bir antrenmanınız bulundu. Devam etmek ister misiniz?')) {
          setSessionExercises(parsed.sessionExercises);
          setSessionNote(parsed.sessionNote || '');
          setSessionMedia(parsed.sessionMedia || []);
          setStartTime(parsed.startTime ? new Date(parsed.startTime) : new Date());
          setSelectedRoutine(parsed.selectedRoutine);
          setStep('active');
        } else if (parsed.sessionExercises) {
          localStorage.removeItem('fitlog_active_session');
        }
      } catch (e) {
        localStorage.removeItem('fitlog_active_session');
      }
    }
  }, []);

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTimeDetailed = (seconds: number) => {
    if (!seconds) return null;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs} sn`;
    if (secs === 0) return `${mins} dk`;
    return `${mins} dk ${secs} sn`;
  };

  // Image Processing
  const resizeImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const MAX = 1024;
          if (width > height) {
            if (width > MAX) { height *= MAX / width; width = MAX; }
          } else {
            if (height > MAX) { width *= MAX / height; height = MAX; }
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
          const compressed = await resizeImage(file);
          setSessionMedia(prev => [...prev, compressed]);
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
            setSessionMedia(prev => [...prev, videoUrl]);
          } finally {
            setVideoUploadProgress(null);
          }
        }
      } catch (error: any) {
        console.error('Media upload error:', error);
        alert("Medya işlenirken hata oluştu: " + (error.message || 'Bilinmeyen hata'));
        setVideoUploadProgress(null);
      }
    }
    e.target.value = '';
  };

  const removeMedia = (index: number) => {
    if (confirm('Bu medyayı silmek istediğinize emin misiniz?')) {
      setSessionMedia(prev => prev.filter((_, i) => i !== index));
    }
  };

  const startWorkout = (routine?: Routine) => {
    let exercises: ExerciseSession[] = [];
    let hasTimedExercises = false;
    let hasNonTimedExercises = false;

    if (routine && routine.exercises) {
      // Önce karma antrenman olup olmadığını kontrol et
      routine.exercises.forEach(ex => {
        const exerciseDef = data.exercises.find(e => e.id === ex.exerciseId);
        const targetTime = ex.targetTimeSeconds || exerciseDef?.defaultTimeSeconds;

        // Egzersiz içindeki hareketlerin sürelerini kontrol et
        const movementIds = exerciseDef?.movementIds || (exerciseDef?.movementId ? [exerciseDef.movementId] : []);
        let hasTimedMovements = false;

        movementIds.forEach(mId => {
          const mov = (data.movements || []).find(m => m.id === mId);
          const movOverride = exerciseDef?.movementOverrides?.[mId];
          const movTime = movOverride?.time === null ? undefined : (movOverride?.time ?? mov?.defaultTimeSeconds);
          if (movTime && movTime > 0) hasTimedMovements = true;
        });

        if ((targetTime && targetTime > 0) || hasTimedMovements) {
          hasTimedExercises = true;
        } else {
          hasNonTimedExercises = true;
        }
      });

      const isMixedWorkout = hasTimedExercises && hasNonTimedExercises;

      exercises = routine.exercises.map((ex, idx) => {
        const exerciseDef = data.exercises.find(e => e.id === ex.exerciseId);

        // Egzersizin hareketlerini al
        const movementIds = exerciseDef?.movementIds || (exerciseDef?.movementId ? [exerciseDef.movementId] : []);

        // Her hareket için timer oluştur
        const movementTimers: ExerciseSession['movementTimers'] = {};
        let hasAnyTimedMovement = false;

        movementIds.forEach(mId => {
          const mov = (data.movements || []).find(m => m.id === mId);
          const movOverride = exerciseDef?.movementOverrides?.[mId];
          const movTime = movOverride?.time === null ? undefined : (movOverride?.time ?? mov?.defaultTimeSeconds);

          if (movTime && movTime > 0) {
            hasAnyTimedMovement = true;
            movementTimers[mId] = {
              remaining: movTime,
              targetTime: movTime,
              running: false,
              completed: false
            };
          }
        });

        // Egzersiz bazlı süre (geriye dönük uyumluluk)
        const exerciseTargetTime = ex.targetTimeSeconds || exerciseDef?.defaultTimeSeconds;

        if (hasAnyTimedMovement || (exerciseTargetTime && exerciseTargetTime > 0)) {
          // Süreli egzersiz
          return {
            exerciseId: ex.exerciseId,
            completed: false,
            note: '',
            timerRemaining: Object.keys(movementTimers).length === 0 ? exerciseTargetTime : undefined,
            timerRunning: false,
            movementTimers: Object.keys(movementTimers).length > 0 ? movementTimers : undefined,
            timerPendingStart: isMixedWorkout // Karma antrenman ise kullanıcı tetikleyecek
          };
        }

        // Süresiz egzersizler varsayılan olarak tamamlandı
        return {
          exerciseId: ex.exerciseId,
          completed: true,
          note: ''
        };
      });

      // Karma değilse ve süreli egzersiz varsa ilk süreli egzersizi başlat
      if (!isMixedWorkout && hasTimedExercises) {
        const firstTimedIdx = exercises.findIndex(ex =>
          ex.timerRemaining !== undefined || ex.movementTimers
        );
        if (firstTimedIdx !== -1) {
          const ex = exercises[firstTimedIdx];
          if (ex.movementTimers) {
            // İlk hareketin timer'ını başlat
            const firstMovId = Object.keys(ex.movementTimers)[0];
            if (firstMovId) {
              ex.movementTimers[firstMovId].running = true;
            }
          } else if (ex.timerRemaining) {
            ex.timerRunning = true;
          }
          ex.timerPendingStart = false;
        }
      }
    }

    setSessionExercises(exercises);
    setSelectedRoutine(routine || { id: 'custom', name: 'Serbest Antrenman', category: 'Diğer', exercises: [] });
    setSessionMedia([]);
    setSessionNote('');
    setStartTime(new Date());

    // Aktif timer indexini bul (karma olmayan ve süreli egzersiz varsa)
    const firstActiveIdx = exercises.findIndex(ex =>
      ex.timerRunning || (ex.movementTimers && Object.values(ex.movementTimers).some(mt => mt.running))
    );
    setActiveTimerIdx(firstActiveIdx !== -1 ? firstActiveIdx : null);
    setStep('active');
  };

  // Karma antrenman: Egzersizin hareket timer'larını başlat
  const startExerciseMovementTimers = (idx: number) => {
    const exSession = sessionExercises[idx];
    const exerciseDef = data.exercises.find(e => e.id === exSession.exerciseId);

    // Sesli duyuru yap
    if (exSession.movementTimers) {
      const firstMovId = Object.keys(exSession.movementTimers)[0];
      if (firstMovId) {
        const mov = (data.movements || []).find(m => m.id === firstMovId);
        const duration = exSession.movementTimers[firstMovId].targetTime;
        const durationText = duration >= 60
          ? `${Math.floor(duration / 60)} dakika${duration % 60 > 0 ? ` ${duration % 60} saniye` : ''}`
          : `${duration} saniye`;
        speakAlert(`${mov?.name || 'Hareket'} başlıyor. ${durationText}`);
      }
    } else if (exSession.timerRemaining) {
      const duration = exSession.timerRemaining;
      const durationText = duration >= 60
        ? `${Math.floor(duration / 60)} dakika${duration % 60 > 0 ? ` ${duration % 60} saniye` : ''}`
        : `${duration} saniye`;
      speakAlert(`${exerciseDef?.name || 'Egzersiz'} başlıyor. ${durationText}`);
    }

    setSessionExercises(prev => {
      const updated = [...prev];
      const ex = { ...updated[idx] };

      if (ex.movementTimers) {
        // İlk hareketi başlat
        const firstMovId = Object.keys(ex.movementTimers)[0];
        if (firstMovId) {
          ex.movementTimers = {
            ...ex.movementTimers,
            [firstMovId]: {
              ...ex.movementTimers[firstMovId],
              running: true
            }
          };
        }
        ex.timerPendingStart = false;
      } else if (ex.timerRemaining) {
        // Eski stil tek timer
        ex.timerRunning = true;
        ex.timerPendingStart = false;
        setActiveTimerIdx(idx);
      }

      updated[idx] = ex;
      return updated;
    });
  };

  // Hareket timer'ını başlat/durdur
  const toggleMovementTimer = (exIdx: number, movId: string) => {
    const exSession = sessionExercises[exIdx];
    const isCurrentlyRunning = exSession.movementTimers?.[movId]?.running;

    // Eğer başlatılıyorsa (şu an çalışmıyorsa) sesli duyuru yap
    if (!isCurrentlyRunning && exSession.movementTimers?.[movId]) {
      const mov = (data.movements || []).find(m => m.id === movId);
      const duration = exSession.movementTimers[movId].remaining;
      const durationText = duration >= 60
        ? `${Math.floor(duration / 60)} dakika${duration % 60 > 0 ? ` ${duration % 60} saniye` : ''}`
        : `${duration} saniye`;
      speakAlert(`${mov?.name || 'Hareket'} başlıyor. ${durationText}`);
    }

    setSessionExercises(prev => {
      const updated = [...prev];
      const ex = { ...updated[exIdx] };

      if (ex.movementTimers && ex.movementTimers[movId]) {
        const isRunning = ex.movementTimers[movId].running;

        // Önce tüm hareket timer'larını durdur
        const newTimers: typeof ex.movementTimers = {};
        Object.keys(ex.movementTimers).forEach(mId => {
          newTimers[mId] = {
            ...ex.movementTimers![mId],
            running: mId === movId ? !isRunning : false
          };
        });

        ex.movementTimers = newTimers;
        ex.timerPendingStart = false;
      }

      updated[exIdx] = ex;
      return updated;
    });
  };

  // Hareket timer'ını sıfırla
  const resetMovementTimer = (exIdx: number, movId: string) => {
    const exSession = sessionExercises[exIdx];

    // Sesli duyuru yap
    if (exSession.movementTimers?.[movId]) {
      const mov = (data.movements || []).find(m => m.id === movId);
      const duration = exSession.movementTimers[movId].targetTime;
      const durationText = duration >= 60
        ? `${Math.floor(duration / 60)} dakika${duration % 60 > 0 ? ` ${duration % 60} saniye` : ''}`
        : `${duration} saniye`;
      speakAlert(`${mov?.name || 'Hareket'} yeniden başlıyor. ${durationText}`);
    }

    setSessionExercises(prev => {
      const updated = [...prev];
      const ex = { ...updated[exIdx] };

      if (ex.movementTimers && ex.movementTimers[movId]) {
        ex.movementTimers = {
          ...ex.movementTimers,
          [movId]: {
            ...ex.movementTimers[movId],
            remaining: ex.movementTimers[movId].targetTime,
            running: true,
            completed: false
          }
        };
        ex.completed = false;
        ex.timerPendingStart = false;
      }

      updated[exIdx] = ex;
      return updated;
    });
  };

  // Hareketi manuel tamamla
  const completeMovement = (exIdx: number, movId: string) => {
    setSessionExercises(prev => {
      const updated = [...prev];
      const ex = { ...updated[exIdx] };

      if (ex.movementTimers && ex.movementTimers[movId]) {
        ex.movementTimers = {
          ...ex.movementTimers,
          [movId]: {
            ...ex.movementTimers[movId],
            remaining: 0,
            running: false,
            completed: true
          }
        };

        // Tüm hareketler tamamlandı mı kontrol et
        const allCompleted = Object.values(ex.movementTimers).every((mt: any) => mt.completed);
        if (allCompleted) {
          ex.completed = true;
        }
      }

      updated[exIdx] = ex;
      return updated;
    });
  };

  const toggleExerciseComplete = (idx: number) => {
    setSessionExercises(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], completed: !updated[idx].completed };
      return updated;
    });
  };

  const updateExerciseNote = (idx: number, note: string) => {
    setSessionExercises(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], note };
      return updated;
    });
  };

  const updateExerciseOverride = (idx: number, overrides: Partial<Pick<ExerciseSession, 'overrideSets' | 'overrideReps' | 'overrideWeight' | 'overrideTimeSeconds'>>) => {
    setSessionExercises(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], ...overrides };
      return updated;
    });
  };

  const addExerciseToSession = (exerciseId: string) => {
    const exerciseDef = data.exercises.find(e => e.id === exerciseId);
    const targetTime = exerciseDef?.defaultTimeSeconds;

    // Süresli egzersizler için timer ayarla - mevcut timer'ı durdurmadan sıraya ekle
    if (targetTime && targetTime > 0) {
      setSessionExercises(prev => [...prev, {
        exerciseId,
        completed: false,
        note: '',
        timerRemaining: targetTime,
        timerRunning: false // Sıraya ekle, mevcut timer devam etsin
      }]);
      // Eğer aktif timer yoksa bu egzersizi başlat
      if (activeTimerIdx === null) {
        const newIdx = sessionExercises.length;
        setTimeout(() => {
          setSessionExercises(prev => prev.map((ex, i) =>
            i === newIdx ? { ...ex, timerRunning: true } : ex
          ));
          setActiveTimerIdx(newIdx);
        }, 100);
      }
    } else {
      // Süresiz egzersizler varsayılan olarak tamamlandı
      setSessionExercises(prev => [...prev, { exerciseId, completed: true, note: '' }]);
    }
  };

  // Egzersiz Timer Başlat/Durdur
  const toggleExerciseTimer = (idx: number) => {
    const exSession = sessionExercises[idx];

    if (exSession.timerRunning) {
      // Timer'ı durdur
      setSessionExercises(prev => {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], timerRunning: false };
        return updated;
      });
      setActiveTimerIdx(null);
    } else {
      // Önce diğer timer'ları durdur
      setSessionExercises(prev => prev.map((ex, i) => ({
        ...ex,
        timerRunning: i === idx ? true : false
      })));
      setActiveTimerIdx(idx);
    }
  };

  // Egzersiz Timer'ını sıfırla
  const resetExerciseTimer = (idx: number) => {
    const exSession = sessionExercises[idx];
    const exerciseDef = data.exercises.find(e => e.id === exSession.exerciseId);
    const targetTime = exSession.overrideTimeSeconds || exerciseDef?.defaultTimeSeconds || 60;

    setSessionExercises(prev => {
      const updated = [...prev];
      updated[idx] = {
        ...updated[idx],
        timerRemaining: targetTime,
        timerRunning: true, // Yeniden başlat ve direkt çalıştır
        completed: false
      };
      return updated;
    });
    setActiveTimerIdx(idx);
  };

  // Manuel olarak egzersizi tamamla (geçen süreyi kaydet)
  const manualCompleteExercise = (idx: number) => {
    const exSession = sessionExercises[idx];
    const exerciseDef = data.exercises.find(e => e.id === exSession.exerciseId);
    const targetTime = exSession.overrideTimeSeconds || exerciseDef?.defaultTimeSeconds || 0;
    const remaining = exSession.timerRemaining || 0;
    const actualDuration = targetTime - remaining; // Geçen süre

    setSessionExercises(prev => {
      const updated = [...prev];
      updated[idx] = {
        ...updated[idx],
        timerRemaining: 0,
        timerRunning: false,
        completed: true,
        actualDurationSeconds: actualDuration > 0 ? actualDuration : undefined
      };
      return updated;
    });

    if (activeTimerIdx === idx) {
      setActiveTimerIdx(null);
    }

    // Sıradaki egzersiz varsa dinlenme başlat (süreli olsun olmasın)
    const nextIdx = idx + 1;
    if (nextIdx < sessionExercises.length && !sessionExercises[nextIdx].completed) {
      // Sıradaki egzersiz var - dinlenme başlat
      setTimeout(() => {
        setRestTimer(restDuration);
        setIsResting(true);
        speakAlert('Dinlenme süresi başladı');
      }, 300);
    }
  };

  const removeExerciseFromSession = (idx: number) => {
    if (confirm('Bu egzersizi çıkarmak istediğinize emin misiniz?')) {
      setSessionExercises(prev => prev.filter((_, i) => i !== idx));
      if (activeTimerIdx === idx) {
        setActiveTimerIdx(null);
      }
    }
  };

  const startRestTimer = () => {
    setRestTimer(restDuration);
    setIsResting(true);
  };

  const stopRestTimer = () => {
    setIsResting(false);
    setRestTimer(0);
  };

  const finishWorkout = () => {

    const safeStartTime = startTime || new Date();
    const endTime = new Date();
    const durationSeconds = Math.max(0, Math.floor((endTime.getTime() - safeStartTime.getTime()) / 1000));

    // Convert simplified session to WorkoutLog format
    const exerciseLogs: WorkoutExerciseLog[] = sessionExercises.map(ex => {
      const exerciseDef = data.exercises.find(e => e.id === ex.exerciseId);
      // Use override values if present, otherwise fall back to exercise defaults
      const sets: WorkoutSet[] = [{
        weight: ex.overrideWeight ?? exerciseDef?.defaultWeight ?? 0,
        reps: ex.overrideReps ?? exerciseDef?.defaultReps ?? 0,
        timeSeconds: ex.overrideTimeSeconds ?? exerciseDef?.defaultTimeSeconds ?? 0,
        completed: ex.completed
      }];
      return {
        exerciseId: ex.exerciseId,
        sets,
        actualDurationSeconds: ex.actualDurationSeconds // Gerçek tamamlanma süresi
      };
    });

    const newLog: WorkoutLog = {
      id: Date.now().toString(),
      date: safeStartTime.toISOString(),
      startTime: safeStartTime.toISOString(),
      endTime: endTime.toISOString(),
      durationSeconds,
      routineName: selectedRoutine?.name || 'Serbest Antrenman',
      category: selectedRoutine?.category || 'Diğer',
      exercises: exerciseLogs,
      notes: [sessionNote, ...sessionExercises.filter(e => e.note).map(e => {
        const exDef = data.exercises.find(ex => ex.id === e.exerciseId);
        return `${exDef?.name || 'Egzersiz'}: ${e.note}`;
      })].filter(Boolean).join('\n'),
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
  };

  // Open Quick Save Modal for Free Workout (egzersiz seçimi için)
  const openFreeWorkoutModal = () => {
    setQuickSaveRoutine(null);
    setQuickSaveSelectedExercises([]);
    setQuickSaveModalOpen(true);
  };

  // Toggle exercise selection in quick save modal
  const toggleQuickSaveExercise = (exerciseId: string) => {
    setQuickSaveSelectedExercises(prev =>
      prev.includes(exerciseId)
        ? prev.filter(id => id !== exerciseId)
        : [...prev, exerciseId]
    );
  };

  // Quick Save for Routines - Directly save without modal
  const quickSaveRoutineDirectly = (routine: Routine) => {
    if (!routine.exercises || routine.exercises.length === 0) {
      alert('Bu antrenman programında egzersiz bulunmuyor.');
      return;
    }

    const now = new Date();

    const exerciseLogs: WorkoutExerciseLog[] = routine.exercises.map(ex => {
      const exerciseDef = data.exercises.find(e => e.id === ex.exerciseId);
      const routineEx = routine.exercises?.find(re => re.exerciseId === ex.exerciseId);
      const sets: WorkoutSet[] = [{
        weight: routineEx?.targetWeight || exerciseDef?.defaultWeight || 0,
        reps: routineEx?.targetReps || exerciseDef?.defaultReps || 0,
        timeSeconds: routineEx?.targetTimeSeconds || exerciseDef?.defaultTimeSeconds || 0,
        completed: true
      }];
      return { exerciseId: ex.exerciseId, sets };
    });

    const newLog: WorkoutLog = {
      id: Date.now().toString(),
      date: now.toISOString(),
      startTime: now.toISOString(),
      endTime: now.toISOString(),
      durationSeconds: 0,
      routineName: routine.name,
      category: routine.category,
      exercises: exerciseLogs,
      notes: '',
      media: []
    };

    onSaveLog(newLog);
  };

  // Quick Save for Routines with selected exercises
  const confirmQuickSave = () => {
    if (quickSaveSelectedExercises.length === 0) {
      alert('Lütfen en az bir egzersiz seçin.');
      return;
    }

    const now = new Date();

    const exerciseLogs: WorkoutExerciseLog[] = quickSaveSelectedExercises.map(exId => {
      const exerciseDef = data.exercises.find(e => e.id === exId);
      const sets: WorkoutSet[] = [{
        weight: exerciseDef?.defaultWeight || 0,
        reps: exerciseDef?.defaultReps || 0,
        timeSeconds: exerciseDef?.defaultTimeSeconds || 0,
        completed: true
      }];
      return { exerciseId: exId, sets };
    });

    const newLog: WorkoutLog = {
      id: Date.now().toString(),
      date: now.toISOString(),
      startTime: now.toISOString(),
      endTime: now.toISOString(),
      durationSeconds: 0,
      routineName: quickSaveRoutine?.name || 'Serbest Antrenman',
      category: quickSaveRoutine?.category || 'Diğer',
      exercises: exerciseLogs,
      notes: '',
      media: []
    };

    onSaveLog(newLog);
    setQuickSaveModalOpen(false);
    setQuickSaveRoutine(null);
    setQuickSaveSelectedExercises([]);
  };

  // SELECTION SCREEN
  if (step === 'select') {
    const categories = ['Tümü', ...Array.from(new Set(data.routines.map(r => r.category)))];
    const filteredRoutines = filterCategory === 'Tümü'
      ? data.routines
      : data.routines.filter(r => r.category === filterCategory);

    return (
      <div className="space-y-6 pb-20">
        <h2 className="text-xl font-bold text-slate-900">Antrenman Başlat</h2>

        {/* Free Workout Card */}
        <div className="w-full flex items-center justify-between p-5 bg-gradient-to-r from-brand-500 to-brand-600 text-white rounded-xl shadow-lg">
          <div>
            <span className="block font-bold text-lg">Serbest Antrenman</span>
            <span className="text-brand-100 text-sm">Egzersiz seçerek başla</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Quick Save Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                openFreeWorkoutModal();
              }}
              className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
              title="Egzersiz Seç ve Kaydet"
            >
              <Save size={20} />
            </button>
            {/* Start Button */}
            <button
              onClick={() => startWorkout()}
              className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
              title="Antrenmanı Başlat"
            >
              <Play fill="currentColor" size={24} />
            </button>
          </div>
        </div>

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
              {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        <div className="space-y-3">
          {filteredRoutines.length > 0 ? (
            filteredRoutines.map(routine => (
              <div
                key={routine.id}
                className="w-full bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between hover:border-brand-300 transition-colors text-left group"
              >
                <div className="flex-1" onClick={() => startWorkout(routine)} style={{ cursor: 'pointer' }}>
                  <span className="block font-bold text-slate-900 group-hover:text-brand-700 transition-colors">{routine.name}</span>
                  <span className="text-xs text-slate-500">{routine.exercises?.length || 0} egzersiz • {routine.category}</span>
                </div>
                <div className="flex items-center gap-2">
                  {/* Quick Save Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      quickSaveRoutineDirectly(routine);
                    }}
                    className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-green-600 hover:bg-green-500 hover:text-white transition-all"
                    title="Direkt Kaydet"
                  >
                    <Save size={18} />
                  </button>
                  {/* Start Button */}
                  <button
                    onClick={() => startWorkout(routine)}
                    className="w-10 h-10 rounded-full bg-brand-50 flex items-center justify-center text-brand-600 hover:bg-brand-500 hover:text-white transition-all"
                    title="Antrenmanı Başlat"
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
              <p className="text-sm text-slate-400">Bu kategoride antrenman programı bulunamadı.</p>
            </div>
          )}
        </div>

        {/* Quick Save Modal - Serbest Antrenman için */}
        {quickSaveModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col">
              {/* Modal Header */}
              <div className="p-5 border-b border-slate-200 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-lg text-slate-900">Serbest Antrenman Kaydet</h3>
                  <p className="text-sm text-slate-500">Egzersiz seçerek kaydet</p>
                </div>
                <button
                  onClick={() => {
                    setQuickSaveModalOpen(false);
                    setQuickSaveRoutine(null);
                    setQuickSaveSelectedExercises([]);
                  }}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X size={20} className="text-slate-500" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-5">
                <p className="text-sm text-slate-600 mb-4">Kaydetmek istediğiniz egzersizleri seçin:</p>
                <div className="space-y-2">
                  {data.exercises.map((exerciseDef, idx) => {
                    const isSelected = quickSaveSelectedExercises.includes(exerciseDef.id);

                    return (
                      <button
                        key={idx}
                        onClick={() => toggleQuickSaveExercise(exerciseDef.id)}
                        className={`w-full p-3 rounded-xl flex items-center gap-3 transition-all text-left ${isSelected
                          ? 'bg-brand-50 border-2 border-brand-500'
                          : 'bg-slate-50 border-2 border-transparent hover:border-slate-300'
                          }`}
                      >
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all ${isSelected
                          ? 'bg-brand-500 text-white'
                          : 'bg-slate-200 text-slate-400'
                          }`}>
                          <Check size={16} strokeWidth={3} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className={`block font-medium ${isSelected ? 'text-brand-700' : 'text-slate-700'}`}>
                            {exerciseDef.name}
                          </span>
                          <span className="text-xs text-slate-500">
                            {exerciseDef.defaultSets && `${exerciseDef.defaultSets} set`}
                            {exerciseDef.defaultReps && ` • ${exerciseDef.defaultReps} tekrar`}
                            {exerciseDef.defaultWeight && ` • ${exerciseDef.defaultWeight}kg`}
                            {exerciseDef.defaultTimeSeconds && ` • ${Math.floor(exerciseDef.defaultTimeSeconds / 60)}dk`}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {data.exercises.length === 0 && (
                  <div className="text-center py-8 text-slate-400">
                    <p>Henüz egzersiz tanımlı değil.</p>
                    <p className="text-sm">Antrenman Merkezi'nden egzersiz ekleyin.</p>
                  </div>
                )}

                {/* Select All / Deselect All */}
                {data.exercises.length > 0 && (
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => setQuickSaveSelectedExercises(data.exercises.map(ex => ex.id))}
                      className="flex-1 py-2 px-3 text-sm text-brand-600 bg-brand-50 rounded-lg hover:bg-brand-100 transition-colors"
                    >
                      Tümünü Seç
                    </button>
                    <button
                      onClick={() => setQuickSaveSelectedExercises([])}
                      className="flex-1 py-2 px-3 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                    >
                      Seçimi Temizle
                    </button>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-5 border-t border-slate-200 bg-slate-50">
                <Button
                  onClick={confirmQuickSave}
                  fullWidth
                  size="lg"
                  disabled={quickSaveSelectedExercises.length === 0}
                  className="flex items-center justify-center gap-2"
                >
                  <Save size={18} />
                  Kaydet ({quickSaveSelectedExercises.length} egzersiz)
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ACTIVE WORKOUT SCREEN
  const isVideo = (src: string) => isVideoSource(src);
  const completedCount = sessionExercises.filter(e => e.completed).length;
  const totalCount = sessionExercises.length;

  return (
    <div className="pb-24">
      {/* Sticky Header */}
      <div className="sticky top-0 bg-white/95 backdrop-blur z-10 py-3 border-b border-slate-200 mb-4 -mx-4 px-4 md:-mx-6 md:px-6 shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="font-bold text-slate-900">{selectedRoutine?.name}</h2>
            <div className="flex items-center gap-3 text-sm">
              <span className="flex items-center gap-1 text-brand-600 font-mono">
                <Clock size={14} /> {formatTime(elapsed)}
              </span>
              {totalCount > 0 && (
                <span className="text-slate-500">
                  {completedCount}/{totalCount} tamamlandı
                </span>
              )}
            </div>
          </div>
          <Button onClick={finishWorkout} size="sm" className="flex items-center gap-2">
            <Save size={16} /> Kaydet
          </Button>
        </div>

        {/* Progress Bar */}
        {totalCount > 0 && (
          <div className="mt-2 h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-brand-500 to-brand-600 transition-all duration-300"
              style={{ width: `${(completedCount / totalCount) * 100}%` }}
            />
          </div>
        )}
      </div>

      {/* Rest Timer */}
      {isResting && (
        <div className="mb-4 p-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Timer size={24} className="animate-pulse" />
              <div>
                <p className="text-sm opacity-90">Dinlenme Süresi</p>
                <p className="text-3xl font-bold font-mono">{formatTime(restTimer)}</p>
              </div>
            </div>
            <button onClick={stopRestTimer} className="p-2 bg-white/20 rounded-full hover:bg-white/30">
              <X size={20} />
            </button>
          </div>
        </div>
      )}

      {/* Quick Rest Timer Button */}
      {!isResting && sessionExercises.length > 0 && (
        <div className="mb-4 flex items-center gap-2">
          <button
            onClick={startRestTimer}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-amber-50 text-amber-700 rounded-xl border border-amber-200 hover:bg-amber-100 transition-colors"
          >
            <Timer size={18} />
            <span className="font-medium">Dinlenme Başlat</span>
            <span className="text-sm opacity-70">({restDuration}sn)</span>
          </button>
          <select
            value={restDuration}
            onChange={(e) => setRestDuration(Number(e.target.value))}
            className="py-3 px-3 bg-white border border-slate-200 rounded-xl text-sm"
          >
            <option value={30}>30s</option>
            <option value={45}>45s</option>
            <option value={60}>1dk</option>
            <option value={90}>1.5dk</option>
            <option value={120}>2dk</option>
            <option value={180}>3dk</option>
          </select>
        </div>
      )}

      {/* Empty State */}
      {sessionExercises.length === 0 && (
        <div className="p-6 bg-slate-50 text-slate-500 rounded-xl text-center border-2 border-dashed border-slate-200">
          <Dumbbell size={32} className="mx-auto mb-2 opacity-50" />
          <p>Aşağıdan egzersiz seçerek başlayın.</p>
        </div>
      )}

      {/* Exercise Cards */}
      <div className="space-y-3">
        {sessionExercises.map((exSession, idx) => {
          // Hareket mi egzersiz mi kontrol et
          const isMovement = exSession.exerciseId.startsWith('mov_');
          const movId = exSession.exerciseId.replace('mov_', '');

          const exerciseDef = isMovement
            ? (data.movements || []).find(m => m.id === movId)
            : data.exercises.find(e => e.id === exSession.exerciseId);

          if (!exerciseDef) return null;

          const equipmentNames = !isMovement && 'equipmentIds' in exerciseDef
            ? exerciseDef.equipmentIds
              ?.map(id => data.equipment.find(eq => eq.id === id)?.name)
              .filter(Boolean)
              .join(', ')
            : '';

          // Egzersizin içindeki hareketler (sadece egzersizler için, hareketler için değil)
          const exerciseMovements = !isMovement && 'movementIds' in exerciseDef
            ? (exerciseDef.movementIds || []).map(mId => (data.movements || []).find(m => m.id === mId)).filter(Boolean)
            : !isMovement && 'movementId' in exerciseDef && exerciseDef.movementId
              ? [(data.movements || []).find(m => m.id === exerciseDef.movementId)].filter(Boolean)
              : [];

          const hasMovements = exerciseMovements.length > 0;
          const isExerciseDetailsExpanded = expandedExerciseIdx === idx;

          return (
            <div
              key={idx}
              className={`bg-white rounded-xl shadow-sm border overflow-hidden transition-all ${exSession.completed
                ? 'border-green-300 bg-green-50/30'
                : 'border-slate-100'
                }`}
            >
              {/* Exercise Header */}
              <div className="p-4 flex items-start gap-3">
                {/* Completion Toggle veya Timer */}
                {exSession.movementTimers ? (
                  // Hareket bazlı timer'lı egzersiz
                  (() => {
                    const movTimers = exSession.movementTimers!;
                    const movIds = Object.keys(movTimers);
                    const completedCount = movIds.filter(mId => movTimers[mId].completed).length;
                    const totalCount = movIds.length;
                    const isAnyRunning = movIds.some(mId => movTimers[mId].running);
                    const currentRunningId = movIds.find(mId => movTimers[mId].running);
                    const currentRunningTimer = currentRunningId ? movTimers[currentRunningId] : null;
                    const allCompleted = completedCount === totalCount;

                    return (
                      <div className="flex flex-col items-center gap-1">
                        {exSession.timerPendingStart ? (
                          // Karma antrenman - Başlat butonu
                          <button
                            onClick={() => startExerciseMovementTimers(idx)}
                            className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all"
                            title="Egzersizi Başlat"
                          >
                            <Play size={20} fill="currentColor" />
                          </button>
                        ) : allCompleted ? (
                          // Tamamlandı
                          <button
                            onClick={() => {
                              // Tüm hareket timer'larını sıfırla
                              movIds.forEach(mId => resetMovementTimer(idx, mId));
                            }}
                            className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 bg-green-500 text-white shadow-md hover:bg-green-600 transition-all"
                            title="Yeniden Başlat"
                          >
                            <Check size={20} strokeWidth={3} />
                          </button>
                        ) : (
                          // Timer devam ediyor
                          <div
                            className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 font-mono text-xs font-bold transition-all ${isAnyRunning
                              ? 'bg-amber-500 text-white shadow-md animate-pulse'
                              : 'bg-amber-100 text-amber-700'
                              }`}
                          >
                            {currentRunningTimer ? (
                              <span className="text-[10px] leading-tight text-center">
                                {Math.floor(currentRunningTimer.remaining / 60)}:{(currentRunningTimer.remaining % 60).toString().padStart(2, '0')}
                              </span>
                            ) : (
                              <span className="text-[10px]">{completedCount}/{totalCount}</span>
                            )}
                          </div>
                        )}
                        <span className="text-[9px] text-slate-500">{completedCount}/{totalCount} hareket</span>
                      </div>
                    );
                  })()
                ) : exSession.timerRemaining !== undefined ? (
                  // Süresli egzersiz (eski stil) - Timer göster
                  <div className="flex flex-col items-center gap-1">
                    {exSession.timerPendingStart ? (
                      // Karma antrenman - Başlat butonu
                      <button
                        onClick={() => startExerciseMovementTimers(idx)}
                        className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all"
                        title="Egzersizi Başlat"
                      >
                        <Play size={20} fill="currentColor" />
                      </button>
                    ) : (
                      <button
                        onClick={() => exSession.completed ? resetExerciseTimer(idx) : manualCompleteExercise(idx)}
                        className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 transition-all font-mono text-xs font-bold cursor-pointer ${exSession.completed
                          ? 'bg-green-500 text-white shadow-md hover:bg-green-600'
                          : exSession.timerRunning
                            ? 'bg-amber-500 text-white shadow-md animate-pulse hover:bg-amber-600'
                            : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                          }`}
                        title={exSession.completed ? 'Yeniden Başlat' : 'Tamamla'}
                      >
                        {exSession.completed || exSession.timerRemaining <= 0 ? (
                          <Check size={20} strokeWidth={3} />
                        ) : (
                          <span className="text-[10px] leading-tight text-center">
                            {Math.floor(exSession.timerRemaining / 60)}:{(exSession.timerRemaining % 60).toString().padStart(2, '0')}
                          </span>
                        )}
                      </button>
                    )}
                    {!exSession.timerPendingStart && (
                      <div className="flex items-center gap-2">
                        {/* Duraklat/Devam - sadece timer aktifken */}
                        {exSession.timerRemaining > 0 && (
                          <button
                            onClick={() => toggleExerciseTimer(idx)}
                            className={`p-1 rounded transition-colors ${exSession.timerRunning
                              ? 'text-amber-600 bg-amber-50 hover:bg-amber-100'
                              : 'text-green-600 bg-green-50 hover:bg-green-100'}`}
                            title={exSession.timerRunning ? 'Duraklat' : 'Devam Et'}
                          >
                            {exSession.timerRunning ? <Pause size={14} /> : <Play size={14} />}
                          </button>
                        )}
                        {/* Yeniden Başlat - her zaman görünür */}
                        <button
                          onClick={() => resetExerciseTimer(idx)}
                          className="p-1 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                          title="Yeniden Başlat"
                        >
                          <RotateCcw size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  // Normal egzersiz - Tik göster
                  <button
                    onClick={() => toggleExerciseComplete(idx)}
                    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all ${exSession.completed
                      ? 'bg-green-500 text-white shadow-md'
                      : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                      }`}
                  >
                    <Check size={20} strokeWidth={3} />
                  </button>
                )}

                {/* Exercise Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className={`font-bold flex items-center gap-1.5 ${exSession.completed ? 'text-green-700' : isMovement ? 'text-emerald-800' : 'text-slate-900'}`}>
                      {isMovement && <Move size={14} className="text-emerald-600 shrink-0" />}
                      {exerciseDef.name}
                    </h3>
                    {hasMovements && (
                      <button
                        onClick={() => setExpandedExerciseIdx(isExerciseDetailsExpanded ? null : idx)}
                        className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-0.5 transition-colors ${isExerciseDetailsExpanded
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                          }`}
                      >
                        <Move size={10} />
                        {exerciseMovements.length}
                        <ChevronDown size={10} className={`transition-transform ${isExerciseDetailsExpanded ? 'rotate-180' : ''}`} />
                      </button>
                    )}
                  </div>

                  {/* Exercise Details - Show values dynamically */}
                  <div className="mt-1 flex flex-wrap gap-2 text-xs">
                    {(exSession.overrideSets !== undefined || exerciseDef.defaultSets) && (
                      <span className={`px-2 py-0.5 rounded-full ${exSession.overrideSets !== undefined ? 'bg-brand-100 text-brand-800 font-semibold' : 'bg-brand-50 text-brand-700'}`}>
                        {exSession.overrideSets ?? exerciseDef.defaultSets ?? 3} set
                      </span>
                    )}
                    {(exSession.overrideReps !== undefined || exerciseDef.defaultReps) && (
                      <span className={`px-2 py-0.5 rounded-full ${exSession.overrideReps !== undefined ? 'bg-blue-100 text-blue-800 font-semibold' : 'bg-blue-50 text-blue-700'}`}>
                        {exSession.overrideReps ?? exerciseDef.defaultReps} tekrar
                      </span>
                    )}
                    {(exSession.overrideWeight !== undefined || exerciseDef.defaultWeight) && (
                      <span className={`px-2 py-0.5 rounded-full ${exSession.overrideWeight !== undefined ? 'bg-purple-100 text-purple-800 font-semibold' : 'bg-purple-50 text-purple-700'}`}>
                        {exSession.overrideWeight ?? exerciseDef.defaultWeight} kg
                      </span>
                    )}
                    {(exSession.overrideTimeSeconds !== undefined || exerciseDef.defaultTimeSeconds) && (
                      <span className={`px-2 py-0.5 rounded-full ${exSession.overrideTimeSeconds !== undefined ? 'bg-amber-100 text-amber-800 font-semibold' : 'bg-amber-50 text-amber-700'}`}>
                        {formatTimeDetailed(exSession.overrideTimeSeconds ?? exerciseDef.defaultTimeSeconds)}
                      </span>
                    )}
                    {equipmentNames && (
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                        {equipmentNames}
                      </span>
                    )}
                  </div>

                  {/* Exercise Description */}
                  {exerciseDef.description && (
                    <p className="mt-2 text-xs text-slate-500 line-clamp-2">
                      {exerciseDef.description}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  {exerciseDef.media && <MediaButtons media={[exerciseDef.media]} compact />}
                  {/* Edit Button - Only for free workout */}
                  {selectedRoutine?.id === 'custom' && (
                    <button
                      onClick={() => setExpandedEditIdx(expandedEditIdx === idx ? null : idx)}
                      className={`p-2 rounded-lg transition-colors ${expandedEditIdx === idx
                        ? 'bg-purple-100 text-purple-600'
                        : 'text-slate-400 hover:bg-slate-100'
                        }`}
                      title="Değerleri Düzenle"
                    >
                      <Pencil size={16} />
                    </button>
                  )}
                  <button
                    onClick={() => setExpandedNoteIdx(expandedNoteIdx === idx ? null : idx)}
                    className={`p-2 rounded-lg transition-colors ${exSession.note
                      ? 'bg-brand-100 text-brand-600'
                      : 'text-slate-400 hover:bg-slate-100'
                      }`}
                  >
                    <MessageSquare size={16} />
                  </button>
                  <button
                    onClick={() => removeExerciseFromSession(idx)}
                    className="p-2 text-slate-400 hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Expanded Movements Section */}
              {isExerciseDetailsExpanded && hasMovements && (
                <div className="px-4 pb-3 border-t border-emerald-100 bg-emerald-50/30 animate-in slide-in-from-top-1 duration-150">
                  <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide flex items-center gap-1 mt-2 mb-2">
                    <Move size={10} /> Hareketler ({exerciseMovements.length})
                  </p>
                  <div className="space-y-1.5">
                    {exerciseMovements.map((mov: any, mIdx) => {
                      const movKey = `${idx}_mov_${mIdx}`;
                      const isMovExpanded = expandedMovements.has(movKey);

                      // Movement timer kontrolü
                      const movTimer = exSession.movementTimers?.[mov.id];
                      const hasTimer = !!movTimer;

                      // Hareket hedef özeti
                      const movTargetSummary = [
                        mov.defaultSets && `${mov.defaultSets} set`,
                        mov.defaultReps && `${mov.defaultReps} tekrar`,
                        mov.defaultWeight && `${mov.defaultWeight}kg`,
                        mov.defaultTimeSeconds && formatTimeDetailed(mov.defaultTimeSeconds)
                      ].filter(Boolean).join(' • ');

                      return (
                        <div key={mIdx} className={`bg-white rounded-lg border overflow-hidden transition-all ${movTimer?.completed
                          ? 'border-green-300 bg-green-50'
                          : movTimer?.running
                            ? 'border-amber-300 ring-2 ring-amber-100'
                            : isMovExpanded
                              ? 'border-emerald-300 ring-1 ring-emerald-100'
                              : 'border-emerald-100'
                          }`}>
                          {/* Hareket Header */}
                          <div className="p-2.5 flex items-center justify-between">
                            {/* Sol taraf - Tıklanabilir alan */}
                            <div
                              onClick={() => {
                                setExpandedMovements(prev => {
                                  const next = new Set(prev);
                                  if (next.has(movKey)) next.delete(movKey);
                                  else next.add(movKey);
                                  return next;
                                });
                              }}
                              className="flex items-center gap-1.5 flex-1 min-w-0 cursor-pointer hover:bg-emerald-50/50 transition-colors rounded p-1 -m-1"
                            >
                              <div className={`p-0.5 rounded transition-transform duration-200 shrink-0 ${isMovExpanded ? 'rotate-90 bg-emerald-200' : 'bg-emerald-100'}`}>
                                <ChevronRight size={12} className="text-emerald-600" />
                              </div>
                              {mov.media && <MediaButtons media={[mov.media]} compact />}
                              <div className="min-w-0">
                                <span className={`text-sm font-medium ${movTimer?.completed ? 'text-green-700' : 'text-emerald-800'}`}>
                                  {mov.name}
                                </span>
                                {!hasTimer && movTargetSummary && (
                                  <span className="text-[9px] text-emerald-600 ml-1.5">• {movTargetSummary}</span>
                                )}
                              </div>
                            </div>

                            {/* Sağ taraf - Timer kontrolü veya etki alanları */}
                            {hasTimer ? (
                              <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                                {/* Timer Gösterge */}
                                <div className={`px-2 py-1 rounded-lg font-mono text-xs font-bold ${movTimer.completed
                                  ? 'bg-green-500 text-white'
                                  : movTimer.running
                                    ? 'bg-amber-500 text-white animate-pulse'
                                    : 'bg-amber-100 text-amber-700'
                                  }`}>
                                  {movTimer.completed ? (
                                    <Check size={14} />
                                  ) : (
                                    `${Math.floor(movTimer.remaining / 60)}:${(movTimer.remaining % 60).toString().padStart(2, '0')}`
                                  )}
                                </div>

                                {/* Kontrol Butonları */}
                                {!movTimer.completed && (
                                  <button
                                    onClick={() => toggleMovementTimer(idx, mov.id)}
                                    className={`p-1.5 rounded-lg transition-colors ${movTimer.running
                                      ? 'text-amber-600 bg-amber-50 hover:bg-amber-100'
                                      : 'text-green-600 bg-green-50 hover:bg-green-100'
                                      }`}
                                    title={movTimer.running ? 'Duraklat' : 'Başlat'}
                                  >
                                    {movTimer.running ? <Pause size={14} /> : <Play size={14} />}
                                  </button>
                                )}

                                {/* Tamamla/Sıfırla */}
                                <button
                                  onClick={() => movTimer.completed ? resetMovementTimer(idx, mov.id) : completeMovement(idx, mov.id)}
                                  className={`p-1.5 rounded-lg transition-colors ${movTimer.completed
                                    ? 'text-slate-500 hover:text-amber-600 hover:bg-amber-50'
                                    : 'text-green-600 hover:bg-green-50'
                                    }`}
                                  title={movTimer.completed ? 'Yeniden Başlat' : 'Tamamla'}
                                >
                                  {movTimer.completed ? <RotateCcw size={14} /> : <Check size={14} />}
                                </button>
                              </div>
                            ) : (
                              <div className="flex gap-0.5 shrink-0">
                                {(mov.effectAreas || []).slice(0, 2).map((areaKey: string) => {
                                  const area = EFFECT_AREAS.find(a => a.key === areaKey);
                                  return area ? <span key={areaKey} className="text-[10px]">{area.emoji}</span> : null;
                                })}
                              </div>
                            )}
                          </div>

                          {/* Hareket Detayları */}
                          {isMovExpanded && (
                            <div className="px-3 pb-3 border-t border-emerald-100 bg-emerald-50/30 animate-in slide-in-from-top-1 duration-150">
                              {/* Etki Alanları */}
                              {(mov.effectAreas || []).length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {(mov.effectAreas || []).map((areaKey: string) => {
                                    const area = EFFECT_AREAS.find(a => a.key === areaKey);
                                    if (!area) return null;
                                    return (
                                      <span key={areaKey} className="text-[9px] px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded border border-amber-200">
                                        {area.emoji} {area.label}
                                      </span>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Açıklama */}
                              {mov.description && (
                                <p className="text-[10px] text-slate-600 mt-2 italic leading-relaxed">{mov.description}</p>
                              )}

                              {/* Ekipmanlar */}
                              {(mov.equipmentIds || []).length > 0 && (
                                <div className="mt-2 pt-2 border-t border-emerald-100">
                                  <div className="flex items-center gap-1 text-[9px] text-slate-500 mb-1">
                                    <Package size={9} />
                                    <span className="font-medium">Ekipmanlar:</span>
                                  </div>
                                  <div className="flex flex-wrap gap-1">
                                    {(mov.equipmentIds || []).map((eqId: string) => {
                                      const eq = data.equipment.find(e => e.id === eqId);
                                      if (!eq) return null;
                                      return (
                                        <span key={eqId} className="inline-flex items-center gap-1 text-[9px] bg-white text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                                          {eq.name}
                                          {eq.image && <MediaButtons media={[eq.image]} compact />}
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
                  </div>
                </div>
              )}

              {/* Expandable Edit Section - For inline value editing */}
              {
                expandedEditIdx === idx && selectedRoutine?.id === 'custom' && (
                  <div className="px-4 pb-4 border-t border-slate-100 bg-purple-50/50">
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      {/* Set */}
                      <div>
                        <label className="text-xs text-slate-500 block mb-1">Set Sayısı</label>
                        <input
                          type="number"
                          min="1"
                          value={exSession.overrideSets ?? exerciseDef.defaultSets ?? ''}
                          onChange={(e) => updateExerciseOverride(idx, { overrideSets: parseInt(e.target.value) || undefined })}
                          className="w-full p-2 border border-slate-200 rounded-lg bg-white text-sm outline-none focus:ring-2 focus:ring-purple-500"
                          placeholder="Örn: 3"
                        />
                      </div>

                      {/* Tekrar */}
                      <div>
                        <label className="text-xs text-slate-500 block mb-1">Tekrar</label>
                        <input
                          type="number"
                          min="1"
                          value={exSession.overrideReps ?? exerciseDef.defaultReps ?? ''}
                          onChange={(e) => updateExerciseOverride(idx, { overrideReps: parseInt(e.target.value) || undefined })}
                          className="w-full p-2 border border-slate-200 rounded-lg bg-white text-sm outline-none focus:ring-2 focus:ring-purple-500"
                          placeholder="Örn: 10"
                        />
                      </div>

                      {/* Ağırlık */}
                      <div>
                        <label className="text-xs text-slate-500 block mb-1">Ağırlık (kg)</label>
                        <input
                          type="number"
                          step="0.5"
                          value={exSession.overrideWeight ?? exerciseDef.defaultWeight ?? ''}
                          onChange={(e) => updateExerciseOverride(idx, { overrideWeight: e.target.value ? parseFloat(e.target.value) : undefined })}
                          placeholder="Örn: 20"
                          className="w-full p-2 border border-slate-200 rounded-lg bg-white text-sm outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>

                      {/* Süre - Kompakt */}
                      <div>
                        <label className="text-xs text-slate-500 block mb-1">Süre</label>
                        <div className="flex gap-1">
                          <input
                            type="number"
                            min="0"
                            value={Math.floor((exSession.overrideTimeSeconds ?? exerciseDef.defaultTimeSeconds ?? 0) / 60) || ''}
                            onChange={(e) => {
                              const mins = parseInt(e.target.value) || 0;
                              const currentSecs = (exSession.overrideTimeSeconds ?? exerciseDef.defaultTimeSeconds ?? 0) % 60;
                              updateExerciseOverride(idx, { overrideTimeSeconds: mins * 60 + currentSecs || undefined });
                            }}
                            className="w-full p-2 border border-slate-200 rounded-lg bg-white text-sm outline-none focus:ring-2 focus:ring-purple-500"
                            placeholder="dk"
                          />
                          <input
                            type="number"
                            min="0"
                            max="59"
                            value={(exSession.overrideTimeSeconds ?? exerciseDef.defaultTimeSeconds ?? 0) % 60 || ''}
                            onChange={(e) => {
                              const secs = Math.min(59, Math.max(0, parseInt(e.target.value) || 0));
                              const currentMins = Math.floor((exSession.overrideTimeSeconds ?? exerciseDef.defaultTimeSeconds ?? 0) / 60);
                              updateExerciseOverride(idx, { overrideTimeSeconds: currentMins * 60 + secs || undefined });
                            }}
                            className="w-full p-2 border border-slate-200 rounded-lg bg-white text-sm outline-none focus:ring-2 focus:ring-purple-500"
                            placeholder="sn"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )
              }

              {/* Expandable Note Section */}
              {
                expandedNoteIdx === idx && (
                  <div className="px-4 pb-4 border-t border-slate-100 bg-slate-50/50">
                    <textarea
                      value={exSession.note}
                      onChange={(e) => updateExerciseNote(idx, e.target.value)}
                      placeholder="Bu egzersiz hakkında not ekle..."
                      className="w-full mt-3 p-3 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                      rows={2}
                    />
                  </div>
                )
              }
            </div>
          );
        })}
      </div>

      {/* Add Exercise/Movement Button */}
      <div className="mt-4">
        <button
          onClick={() => {
            setPickerSelectedIds([]);
            setExerciseSearchQuery('');
            setPickerTab('exercises');
            setIsExercisePickerOpen(true);
          }}
          className="w-full py-3 border-2 border-dashed border-slate-300 rounded-xl text-slate-400 hover:border-brand-400 hover:text-brand-600 hover:bg-brand-50 transition-all flex items-center justify-center"
          title="Egzersiz veya hareket ekle"
        >
          <Plus size={28} />
        </button>
      </div>

      {/* Media Section */}
      <div className="mt-6 bg-white p-4 rounded-xl border border-slate-200">
        <label className="block text-sm font-medium text-slate-700 mb-3">
          Fotoğraf / Video Ekle
        </label>

        {sessionMedia.length > 0 && (
          <div className="grid grid-cols-4 gap-2 mb-3">
            {sessionMedia.map((media, idx) => (
              <div key={idx} className="relative aspect-square bg-slate-100 rounded-lg overflow-hidden border border-slate-200">
                {isVideo(media) ? (
                  <video src={media} className="w-full h-full object-cover" />
                ) : (
                  <img src={media} className="w-full h-full object-cover" />
                )}
                <button
                  onClick={() => removeMedia(idx)}
                  className="absolute top-1 right-1 bg-red-500/90 text-white p-1 rounded-full hover:bg-red-600"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <input type="file" ref={cameraInputRef} onChange={handleMediaUpload} accept="image/*" capture="environment" className="hidden" />
          <input type="file" ref={videoInputRef} onChange={handleMediaUpload} accept="video/*" capture="environment" className="hidden" />
          <input type="file" ref={galleryInputRef} onChange={handleMediaUpload} accept="image/*,video/*" className="hidden" />

          {videoUploadProgress !== null ? (
            <div className="flex-1 flex flex-col items-center justify-center py-2 bg-brand-50 rounded-xl border border-brand-200">
              <div className="flex items-center gap-2 text-brand-600 mb-2">
                <Loader2 size={16} className="animate-spin" />
                <span className="text-sm font-medium">
                  {videoUploadProgress < 50 ? 'Video sıkıştırılıyor...' : 'Yükleniyor...'}
                </span>
              </div>
              <div className="w-full max-w-[200px] h-2 bg-brand-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-500 transition-all duration-300"
                  style={{ width: `${videoUploadProgress}%` }}
                />
              </div>
              <span className="text-xs text-brand-500 mt-1">{Math.round(videoUploadProgress)}%</span>
            </div>
          ) : (
            <>
              <Button onClick={() => cameraInputRef.current?.click()} variant="secondary" size="sm" className="flex-1">
                <Camera size={16} className="mr-1" /> Fotoğraf
              </Button>
              <Button onClick={() => videoInputRef.current?.click()} variant="secondary" size="sm" className="flex-1">
                <Video size={16} className="mr-1" /> Video
              </Button>
              <Button onClick={() => galleryInputRef.current?.click()} variant="secondary" size="sm" className="flex-1">
                <ImageIcon size={16} className="mr-1" /> Galeri
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Session Notes */}
      <div className="mt-4 bg-white p-4 rounded-xl border border-slate-200">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Antrenman Notları
        </label>
        <textarea
          value={sessionNote}
          onChange={(e) => setSessionNote(e.target.value)}
          className="w-full border border-slate-200 rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-brand-500 resize-none"
          rows={3}
          placeholder="Bugün nasıl hissettin? Antrenman hakkında notlar..."
        />
      </div>

      {/* Full-screen Exercise/Movement Picker Modal */}
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
            <h2 className="text-lg font-bold text-slate-900">İçerik Ekle</h2>
            <div className="w-10" />
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
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {data.exercises
                      .filter(ex => !sessionExercises.find(se => se.exerciseId === ex.id))
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
                            <h3 className={`font-bold text-sm ${isSelected ? 'text-brand-800' : 'text-slate-800'}`}>
                              {exercise.name}
                            </h3>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {exercise.defaultSets && <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">{exercise.defaultSets} set</span>}
                              {exercise.defaultReps && <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">{exercise.defaultReps} tekrar</span>}
                            </div>
                          </button>
                        );
                      })}
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
                            <h3 className={`font-bold text-sm ${isSelected ? 'text-emerald-800' : 'text-slate-800'}`}>
                              {movement.name}
                            </h3>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {movement.defaultSets && <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded">{movement.defaultSets} set</span>}
                              {movement.defaultReps && <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded">{movement.defaultReps} tekrar</span>}
                            </div>
                          </button>
                        );
                      })}
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
                    {pickerSelectedIds.length} seçildi
                  </span>
                ) : (
                  <span>Seçim yapın</span>
                )}
              </div>
              <Button
                onClick={() => {
                  // Seçilen egzersiz ve hareketleri ekle
                  pickerSelectedIds.forEach(id => {
                    if (id.startsWith('mov_')) {
                      // Hareket ekleme - şimdilik basit tutuyoruz
                      const movId = id.replace('mov_', '');
                      const mov = (data.movements || []).find(m => m.id === movId);
                      if (mov) {
                        // Hareket için geçici egzersiz olarak ekle
                        const targetTime = mov.defaultTimeSeconds;
                        if (targetTime && targetTime > 0) {
                          setSessionExercises(prev => [...prev, {
                            exerciseId: id,
                            completed: false,
                            note: '',
                            timerRemaining: targetTime,
                            timerRunning: false
                          }]);
                        } else {
                          setSessionExercises(prev => [...prev, { exerciseId: id, completed: true, note: '' }]);
                        }
                      }
                    } else {
                      // Normal egzersiz ekleme
                      addExerciseToSession(id);
                    }
                  });
                  setIsExercisePickerOpen(false);
                  setPickerSelectedIds([]);
                  setPickerTab('exercises');
                }}
                disabled={pickerSelectedIds.length === 0}
                className={`px-6 ${pickerTab === 'movements' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
              >
                Ekle ({pickerSelectedIds.length})
              </Button>
            </div>
          </div>
        </div>
      )}
    </div >
  );
};