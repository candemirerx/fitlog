import React, { useState, useEffect, useRef } from 'react';
import { User, AppData, WorkoutLog } from './types';
import { LogbookView } from './views/Logbook';
import { TrainingCenterView } from './views/TrainingCenter';
import { ActiveWorkoutView } from './views/ActiveWorkout';
import { SettingsView } from './views/Settings';
import { Book, Dumbbell, PlayCircle, Settings } from 'lucide-react';
import { db } from './utils/db';
import { cloudSync } from './utils/cloudSync';
import { auth, googleProvider } from './firebase';
import { signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';

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
  const [isAuthChecked, setIsAuthChecked] = useState(false);
  const [isCloudUser, setIsCloudUser] = useState(false);

  // Ref to track if data change is from cloud sync (to prevent infinite loops)
  const isCloudUpdate = useRef(false);

  // Firebase Auth State Listener - Persists login across refreshes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser && firebaseUser.email) {
        // User is signed in with Firebase (Google)
        setUser({ email: firebaseUser.email, isLoggedIn: true });
        setIsCloudUser(true);

        // Load data from Firestore
        try {
          const cloudData = await cloudSync.load(firebaseUser.uid);
          if (cloudData) {
            isCloudUpdate.current = true;
            setData(cloudData);
          } else {
            // First time cloud user - check if they have local data to migrate
            const localData = await db.load(firebaseUser.email);
            if (localData) {
              setData(localData);
              // Save to cloud
              await cloudSync.save(localData, firebaseUser.uid);
            } else {
              setData(INITIAL_DATA);
            }
          }
        } catch (error) {
          console.error('Error loading cloud data:', error);
          setData(INITIAL_DATA);
        }
      } else {
        // User is signed out - use local account
        setUser({ email: 'Yerel Hesap', isLoggedIn: true });
        setIsCloudUser(false);
      }
      setIsAuthChecked(true);
      setIsLoaded(true);
    });

    return () => unsubscribe();
  }, []);

  // Load local data for non-cloud users
  useEffect(() => {
    if (!isAuthChecked || isCloudUser) return;

    const initLocalData = async () => {
      setIsLoaded(false);
      try {
        const dbKey = user.email === 'Yerel Hesap' ? 'root_data' : user.email;
        const dbData = await db.load(dbKey);

        if (dbData) {
          // MIGRATION CHECK: Ensure routines follow new structure
          const migratedRoutines = dbData.routines.map((r: any) => {
            if (r.exerciseIds && Array.isArray(r.exerciseIds)) {
              return {
                ...r,
                exercises: r.exerciseIds.map((id: string) => ({
                  exerciseId: id,
                  targetSets: 3,
                  targetReps: 10
                })),
                exerciseIds: undefined
              };
            }
            return r;
          });

          setData({ ...dbData, routines: migratedRoutines });
        } else {
          // Check legacy localStorage
          if (dbKey === 'root_data') {
            const legacyData = localStorage.getItem('fitlog_data');
            if (legacyData) {
              try {
                const parsed = JSON.parse(legacyData);
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
            setData(INITIAL_DATA);
          }
        }
      } catch (err) {
        console.error("Database initialization failed", err);
      } finally {
        setIsLoaded(true);
      }
    };

    initLocalData();
  }, [user.email, isAuthChecked, isCloudUser]);

  // Save data - to IndexedDB (local) or Firestore (cloud)
  useEffect(() => {
    if (!isLoaded || !isAuthChecked) return;

    // Skip if this update came from cloud sync
    if (isCloudUpdate.current) {
      isCloudUpdate.current = false;
      return;
    }

    const saveData = async () => {
      try {
        if (isCloudUser && auth.currentUser) {
          // Save to Firestore for cloud users
          await cloudSync.save(data, auth.currentUser.uid);
          console.log('Data saved to cloud');
        } else {
          // Save to IndexedDB for local users
          const dbKey = user.email === 'Yerel Hesap' ? 'root_data' : user.email;
          await db.save(data, dbKey);
        }
      } catch (e) {
        console.error("Storage save failed", e);
        if (e instanceof DOMException && (e.name === 'QuotaExceededError')) {
          alert("Cihaz hafızası doldu! Veriler kaydedilemiyor.");
        }
      }
    };

    // Debounce save
    const timeoutId = setTimeout(saveData, 500);
    return () => clearTimeout(timeoutId);
  }, [data, isLoaded, isAuthChecked, isCloudUser, user.email]);

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
    setIsLoaded(false);
    const existingData = await db.load(email);
    if (existingData) {
      setUser({ email, isLoggedIn: true });
      setIsCloudUser(false);
      setCurrentView('logbook');
      alert(`Hoşgeldin, ${email}!`);
    } else {
      setIsLoaded(true);
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
      setIsCloudUser(false);
      setData(INITIAL_DATA);
      setCurrentView('logbook');
      alert(`Hesap oluşturuldu: ${email}`);
    }
  };

  const handleLogout = async () => {
    if (confirm("Çıkış yapmak istediğinize emin misiniz?")) {
      try {
        if (isCloudUser) {
          await signOut(auth);
        }
        setUser({ email: 'Yerel Hesap', isLoggedIn: true });
        setIsCloudUser(false);
        setData(INITIAL_DATA);
      } catch (error) {
        console.error('Logout error:', error);
      }
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setIsLoaded(false);
      const result = await signInWithPopup(auth, googleProvider);
      const googleEmail = result.user.email;

      if (googleEmail) {
        setIsCloudUser(true);

        // Load data from Firestore
        const cloudData = await cloudSync.load(result.user.uid);
        if (cloudData) {
          setData(cloudData);
        } else {
          // New Google user - start fresh or migrate local data
          const localData = await db.load(googleEmail);
          if (localData) {
            setData(localData);
            await cloudSync.save(localData, result.user.uid);
          } else {
            setData(INITIAL_DATA);
          }
        }

        setUser({ email: googleEmail, isLoggedIn: true });
        setCurrentView('logbook');
        alert(`Google ile giriş yapıldı: ${googleEmail}`);
      }
    } catch (error: any) {
      console.error('Google login error:', error);
      if (error.code === 'auth/popup-closed-by-user') {
        alert('Giriş işlemi iptal edildi.');
      } else if (error.code === 'auth/unauthorized-domain') {
        alert('Bu domain Firebase Console\'da yetkilendirilmemiş. Lütfen Firebase Console > Authentication > Settings > Authorized domains bölümünden domaini ekleyin.');
      } else {
        alert('Google ile giriş yapılırken bir hata oluştu: ' + error.message);
      }
    } finally {
      setIsLoaded(true);
    }
  };

  const renderView = () => {
    if (!isAuthChecked || !isLoaded) {
      return (
        <div className="flex h-screen items-center justify-center bg-white text-brand-600 flex-col gap-4">
          <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
          <p className="text-sm font-medium text-slate-500">
            {!isAuthChecked ? 'Oturum kontrol ediliyor...' : 'Veritabanı Yükleniyor...'}
          </p>
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
          onGoogleLogin={handleGoogleLogin}
          isCloudUser={isCloudUser}
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
              className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105 ${currentView === 'active' ? 'bg-brand-700 ring-4 ring-brand-100' : 'bg-brand-600'
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