import React, { useState, useEffect } from 'react';
import { User, AppData, WorkoutLog, Routine } from './types';
import { LogbookView } from './views/Logbook';
import { TrainingCenterView } from './views/TrainingCenter';
import { ActiveWorkoutView } from './views/ActiveWorkout';
import { SettingsView } from './views/Settings';
import { Book, Dumbbell, PlayCircle, Settings } from 'lucide-react';
import { db } from './utils/db';

const INITIAL_DATA: AppData = {
  equipment: [],
  exercises: [],
  routines: [],
  logs: []
};

type ViewState = 'logbook' | 'center' | 'active' | 'settings';

function App() {
  const [user, setUser] = useState<User>({ email: 'Yerel Hesap', isLoggedIn: true });
  const [data, setData] = useState<AppData>(INITIAL_DATA);
  const [currentView, setCurrentView] = useState<ViewState>('logbook');
  const [isLoaded, setIsLoaded] = useState(false);

  // Load data from IndexedDB on mount (with migration fallback)
  useEffect(() => {
    const initData = async () => {
      setIsLoaded(false);
      try {
        const dbKey = user.email === 'Yerel Hesap' ? 'root_data' : user.email;
        // 1. Try to load from IndexedDB (High Capacity)
        const dbData = await db.load(dbKey);
        
        if (dbData) {
          // MIGRATION CHECK: Ensure routines follow new structure
          const migratedRoutines = dbData.routines.map((r: any) => {
            if (r.exerciseIds && Array.isArray(r.exerciseIds)) {
              // Convert old string[] to RoutineExercise[]
              return {
                ...r,
                exercises: r.exerciseIds.map((id: string) => ({ 
                  exerciseId: id, 
                  targetSets: 3, 
                  targetReps: 10 
                })),
                exerciseIds: undefined // cleanup
              };
            }
            return r;
          });
          
          setData({ ...dbData, routines: migratedRoutines });
        } else {
          // If loading root_data (guest) and it's empty, check legacy localStorage
          if (dbKey === 'root_data') {
            const legacyData = localStorage.getItem('fitlog_data');
            if (legacyData) {
              try {
                const parsed = JSON.parse(legacyData);
                
                // Legacy migration for routines
                if (parsed.routines) {
                  parsed.routines = parsed.routines.map((r: any) => {
                      if (r.exerciseIds) {
                        r.exercises = r.exerciseIds.map((id: string) => ({ exerciseId: id, targetSets: 3, targetReps: 10 }));
                        delete r.exerciseIds;
                      }
                      return r;
                  });
                }

                setData(parsed);
                // Save to IDB immediately to complete migration
                await db.save(parsed, 'root_data');
                console.log("Migrated data from LocalStorage to IndexedDB");
              } catch (e) {
                console.error("Legacy migration failed", e);
                setData(INITIAL_DATA);
              }
            } else {
               setData(INITIAL_DATA);
            }
          } else {
            // New user, fresh data
            setData(INITIAL_DATA);
          }
        }
      } catch (err) {
        console.error("Database initialization failed", err);
      } finally {
        setIsLoaded(true);
      }
    };

    initData();
  }, [user.email]);

  // Save data to IndexedDB on change
  useEffect(() => {
    if (!isLoaded) return; // Don't save empty state while loading

    const saveData = async () => {
      try {
        const dbKey = user.email === 'Yerel Hesap' ? 'root_data' : user.email;
        await db.save(data, dbKey);
      } catch (e) {
        console.error("Storage save failed", e);
        if (e instanceof DOMException && (e.name === 'QuotaExceededError')) {
           alert("Cihaz hafızası doldu! Veriler kaydedilemiyor.");
        }
      }
    };
    
    // Debounce save slightly to prevent hammering IDB on every keystroke
    const timeoutId = setTimeout(saveData, 500);
    return () => clearTimeout(timeoutId);
  }, [data, isLoaded, user.email]);

  const updateData = (newData: Partial<AppData>) => {
    setData(prev => ({ ...prev, ...newData }));
  };

  const saveWorkoutLog = (log: WorkoutLog) => {
    setData(prev => ({
      ...prev,
      logs: [log, ...prev.logs]
    }));
    setCurrentView('logbook');
  };

  const handleLogin = async (email: string) => {
    setIsLoaded(false); // Show loading state
    const existingData = await db.load(email);
    if (existingData) {
      setUser({ email, isLoggedIn: true });
      setCurrentView('logbook');
      alert(`Hoşgeldin, ${email}!`);
    } else {
      setIsLoaded(true); // Reset loading state so UI shows up again
      alert('Bu e-posta adresi ile kayıtlı bir hesap bulunamadı. Lütfen "Kayıt Ol" sekmesini kullanın.');
    }
  };

  const handleRegister = async (email: string) => {
    setIsLoaded(false);
    const existingData = await db.load(email);
    if (existingData) {
      setIsLoaded(true);
      alert('Bu e-posta adresi zaten kullanımda. Lütfen "Giriş Yap" sekmesini kullanın.');
    } else {
      setUser({ email, isLoggedIn: true });
      setData(INITIAL_DATA); // Ensure fresh start for new user
      setCurrentView('logbook');
      alert(`Hesap oluşturuldu: ${email}`);
    }
  };

  const handleLogout = () => {
    if (confirm("Çıkış yapmak istediğinize emin misiniz?")) {
      setUser({ email: 'Yerel Hesap', isLoggedIn: true });
    }
  };

  const renderView = () => {
    if (!isLoaded) {
      return (
        <div className="flex h-screen items-center justify-center bg-white text-brand-600 flex-col gap-4">
          <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
          <p className="text-sm font-medium text-slate-500">Veritabanı Yükleniyor...</p>
        </div>
      );
    }

    switch (currentView) {
      case 'logbook':
        return <LogbookView data={data} />;
      case 'center':
        return <TrainingCenterView data={data} onUpdateData={updateData} />;
      case 'active':
        return <ActiveWorkoutView data={data} onSaveLog={saveWorkoutLog} />;
      case 'settings':
        return <SettingsView 
          user={user} 
          data={data} 
          onImport={setData} 
          onLogin={handleLogin} 
          onRegister={handleRegister} 
          onLogout={handleLogout} 
        />;
      default:
        return <LogbookView data={data} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <main className="max-w-md mx-auto min-h-screen bg-white shadow-2xl overflow-hidden relative">
        <div className="h-full overflow-y-auto no-scrollbar p-4 md:p-6">
          {renderView()}
        </div>

        <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-slate-200 px-6 py-3 flex justify-between items-center z-40 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <NavButton 
            active={currentView === 'logbook'} 
            onClick={() => setCurrentView('logbook')} 
            icon={<Book size={24} />} 
            label="Kayıtlar" 
          />
          <NavButton 
            active={currentView === 'center'} 
            onClick={() => setCurrentView('center')} 
            icon={<Dumbbell size={24} />} 
            label="Merkez" 
          />
          <div className="-mt-8">
            <button 
              onClick={() => setCurrentView('active')}
              className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105 ${
                currentView === 'active' ? 'bg-brand-700 ring-4 ring-brand-100' : 'bg-brand-600'
              }`}
            >
              <PlayCircle size={32} className="text-white ml-1" />
            </button>
          </div>
          <NavButton 
            active={currentView === 'settings'} 
            onClick={() => setCurrentView('settings')} 
            icon={<Settings size={24} />} 
            label="Ayarlar" 
          />
        </nav>
      </main>
    </div>
  );
}

const NavButton = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) => (
  <button 
    onClick={onClick} 
    className={`flex flex-col items-center gap-1 transition-colors ${active ? 'text-brand-600' : 'text-slate-400 hover:text-slate-600'}`}
  >
    {icon}
    <span className="text-[10px] font-medium">{label}</span>
  </button>
);

export default App;