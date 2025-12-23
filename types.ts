
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

export interface Exercise {
  id: string;
  name: string;
  description?: string;
  equipmentIds: string[];
  videoUrl?: string; // Could be a link or local reference
  media?: string; // Base64 image/video thumbnail
  trackingType?: TrackingType; // Optional - artık kullanılmıyor, geriye dönük uyumluluk için

  // Default targets for Free Workout auto-population
  defaultSets?: number;
  defaultReps?: number;
  defaultWeight?: number;
  defaultTimeSeconds?: number;
}

export type RoutineCategory = 'Full Body' | 'Bacak' | 'Kol' | 'Göğüs' | 'Sırt' | 'Omuz' | 'Kardiyo' | 'Esneklik' | 'Diğer';

export interface RoutineExercise {
  exerciseId: string;
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
  exercises: Exercise[];
  routines: Routine[];
  logs: WorkoutLog[];
}