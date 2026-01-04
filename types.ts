
export interface User {
  email: string;
  isLoggedIn: boolean;
}

export interface Equipment {
  id: string;
  name: string;
  image?: string; // Base64 or URL
  notes?: string;
}

export type TrackingType = 'weight_reps' | 'time' | 'completion';

// Hareket etki alanları
export type MovementEffectArea = 'stretching' | 'balance' | 'breathing' | 'strength' | 'cardio' | 'flexibility';

// Hareket - Varsayılan hedefleri ve medya bilgilerini içerir
export interface Movement {
  id: string;
  name: string;
  description?: string;
  media?: string; // Base64 image/video 
  equipmentIds: string[];
  effectAreas: MovementEffectArea[]; // Etki alanları - en az biri zorunlu

  // Varsayılan hedefler
  defaultSets?: number;
  defaultReps?: number;
  defaultWeight?: number;
  defaultTimeSeconds?: number;
}

export interface Exercise {
  id: string;
  name: string;
  description?: string;
  equipmentIds: string[];
  videoUrl?: string; // Could be a link or local reference
  media?: string; // Base64 image/video thumbnail
  trackingType?: TrackingType; // Optional - artık kullanılmıyor, geriye dönük uyumluluk için

  // Hareket referansı - yeni sistem
  movementId?: string; // geriye dönük uyumluluk için
  movementIds?: string[]; // Birden fazla hareket desteği

  // Her hareket için özelleştirilmiş hedefler
  movementOverrides?: Record<string, {
    description?: string;
    sets?: number | null; // null = silindi (varsayılan kullanılmayacak)
    reps?: number | null;
    time?: number | null;
    weight?: number | null;
  }>;

  // Default targets for Free Workout auto-population (eski sistem - geriye dönük uyumluluk)
  defaultSets?: number;
  defaultReps?: number;
  defaultWeight?: number;
  defaultTimeSeconds?: number;
}

export type RoutineCategory = 'Full Body' | 'Bacak' | 'Kol' | 'Göğüs' | 'Sırt' | 'Omuz' | 'Kardiyo' | 'Esneklik' | 'Diğer';

export interface RoutineExercise {
  exerciseId: string;
  movementId?: string; // Doğrudan hareket seçildiğinde kullanılır
  targetSets?: number;
  targetReps?: number;
  targetWeight?: number; // Optional target weight
  targetTimeSeconds?: number;
  restSeconds?: number;
}

export interface Routine {
  id: string;
  name: string;
  category: RoutineCategory;
  exercises: RoutineExercise[]; // Changed from string[] to detailed object
}

export interface WorkoutSet {
  weight?: number;
  reps?: number;
  timeSeconds?: number;
  completed: boolean;
}

export interface WorkoutExerciseLog {
  exerciseId: string;
  sets: WorkoutSet[];
  actualDurationSeconds?: number; // Süresli egzersizlerin gerçek tamamlanma süresi
}

export interface WorkoutLog {
  id: string;
  date: string; // ISO String (Start time usually)
  startTime?: string; // ISO String
  endTime?: string; // ISO String
  durationSeconds?: number;
  routineName: string;
  category?: RoutineCategory;
  exercises: WorkoutExerciseLog[];
  notes?: string;
  media?: string[]; // Array of Base64 strings (Photos or Videos)
}

export interface AppData {
  equipment: Equipment[];
  movements: Movement[];
  exercises: Exercise[];
  routines: Routine[];
  logs: WorkoutLog[];
}