import React, { useState, useEffect, useRef } from 'react';
import { User, AppData, WorkoutLog } from './types';
import { LogbookView } from './views/Logbook';
import { TrainingCenterView } from './views/TrainingCenter';
import { ActiveWorkoutView } from './views/ActiveWorkout';
import { SettingsView } from './views/Settings';
import { Book, Dumbbell, PlayCircle, Settings } from 'lucide-react';
import { db } from './utils/db';
import { cloudSync } from './utils/cloudSync';
import {
  auth,
  googleProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  firebaseSignOut
} from './firebase';
import { signInWithPopup, onAuthStateChanged } from 'firebase/auth';

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
  // Ref to track last saved data to prevent duplicate saves
  const lastSavedData = useRef<string>('');

  // Firebase Auth State Listener - Persists login across refreshes
  useEffect(() => {
    let unsubscribeFromData: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('Auth state changed:', firebaseUser?.email || 'No user');

      // Clean up previous data subscription
      if (unsubscribeFromData) {
        unsubscribeFromData();
        unsubscribeFromData = null;
      }

      if (firebaseUser && firebaseUser.email) {
        // User is signed in with Firebase (Google or Email/Password)
        setUser({ email: firebaseUser.email, isLoggedIn: true });
        setIsCloudUser(true);

        // Load initial data from Firestore
        try {
          console.log('Loading data from Firestore for user:', firebaseUser.uid);
          const cloudData = await cloudSync.load(firebaseUser.uid);

          if (cloudData) {
            console.log('Cloud data loaded successfully:', {
              equipment: cloudData.equipment?.length || 0,
              exercises: cloudData.exercises?.length || 0,
              routines: cloudData.routines?.length || 0,
              logs: cloudData.logs?.length || 0
            });
            isCloudUpdate.current = true;
            setData(cloudData);
          } else {
            console.log('No cloud data found, starting fresh');
            setData(INITIAL_DATA);
            // Save initial data to cloud
            await cloudSync.save(INITIAL_DATA, firebaseUser.uid);
          }

          // Subscribe to real-time updates for this user
          unsubscribeFromData = cloudSync.subscribe(firebaseUser.uid, (newData) => {
            console.log('Real-time update received from cloud');
            isCloudUpdate.current = true;
            setData(newData);
          });

        } catch (error) {
          console.error('Error loading cloud data:', error);
          setData(INITIAL_DATA);
        }
      } else {
        // User is signed out - use local account
        setUser({ email: 'Yerel Hesap', isLoggedIn: true });
        setIsCloudUser(false);

        // Load local data
        try {
          const localData = await db.load('root_data');
          if (localData) {
            setData(localData);
          } else {
            setData(INITIAL_DATA);
          }
        } catch (error) {
          console.error('Error loading local data:', error);
          setData(INITIAL_DATA);
        }
      }

      setIsAuthChecked(true);
      setIsLoaded(true);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeFromData) {
        unsubscribeFromData();
      }
    };
  }, []);

  // Save data - to IndexedDB (local) or Firestore (cloud)
  useEffect(() => {
    if (!isLoaded || !isAuthChecked) return;

    // Skip if this update came from cloud sync
    if (isCloudUpdate.current) {
      isCloudUpdate.current = false;
      return;
    }

    // Prevent duplicate saves
    const dataString = JSON.stringify(data);
    if (dataString === lastSavedData.current) {
      return;
    }

    const saveData = async () => {
      try {
        lastSavedData.current = dataString;

        if (isCloudUser && auth.currentUser) {
          // Save to Firestore for cloud users
          console.log('Saving data to Firestore...');
          await cloudSync.save(data, auth.currentUser.uid);
          console.log('Data saved to cloud successfully');
        } else {
          // Save to IndexedDB for local users
          await db.save(data, 'root_data');
        }
      } catch (e: any) {
        console.error("Storage save failed:", e);
        if (e instanceof DOMException && (e.name === 'QuotaExceededError')) {
          alert("Cihaz hafızası doldu! Veriler kaydedilemiyor.");
        } else if (e.code === 'permission-denied') {
          alert("Firestore yazma izni reddedildi. Firebase Console'dan kuralları kontrol edin.");
        }
      }
    };

    // Debounce save
    const timeoutId = setTimeout(saveData, 1000);
    return () => clearTimeout(timeoutId);
  }, [data, isLoaded, isAuthChecked, isCloudUser]);

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

  // Email/Password Login - Using Firebase Auth
  const handleLogin = async (email: string, password: string) => {
    try {
      setIsLoaded(false);
      console.log('Attempting email login for:', email);

      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log('Login successful:', userCredential.user.email);

      // The onAuthStateChanged will handle the rest
      setCurrentView('logbook');
      alert(`Hoşgeldin, ${email}!`);
    } catch (error: any) {
      console.error('Login error:', error);
      setIsLoaded(true);

      if (error.code === 'auth/user-not-found') {
        alert('Bu e-posta adresi ile kayıtlı bir hesap bulunamadı. Lütfen "Kayıt Ol" sekmesini kullanın.');
      } else if (error.code === 'auth/wrong-password') {
        alert('Şifre hatalı. Lütfen tekrar deneyin.');
      } else if (error.code === 'auth/invalid-email') {
        alert('Geçersiz e-posta adresi.');
      } else if (error.code === 'auth/invalid-credential') {
        alert('E-posta veya şifre hatalı. Lütfen bilgilerinizi kontrol edin.');
      } else {
        alert('Giriş yapılırken bir hata oluştu: ' + error.message);
      }
    }
  };

  // Email/Password Register - Using Firebase Auth
  const handleRegister = async (email: string, password: string) => {
    try {
      setIsLoaded(false);
      console.log('Attempting email registration for:', email);

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      console.log('Registration successful:', userCredential.user.email);

      // Save initial data to Firestore for new user
      await cloudSync.save(INITIAL_DATA, userCredential.user.uid);

      // The onAuthStateChanged will handle the rest
      setCurrentView('logbook');
      alert(`Hesap oluşturuldu: ${email}`);
    } catch (error: any) {
      console.error('Registration error:', error);
      setIsLoaded(true);

      if (error.code === 'auth/email-already-in-use') {
        alert('Bu e-posta adresi zaten kullanımda. Lütfen "Giriş Yap" sekmesini kullanın.');
      } else if (error.code === 'auth/weak-password') {
        alert('Şifre çok zayıf. Lütfen en az 6 karakterlik bir şifre kullanın.');
      } else if (error.code === 'auth/invalid-email') {
        alert('Geçersiz e-posta adresi.');
      } else {
        alert('Kayıt olurken bir hata oluştu: ' + error.message);
      }
    }
  };

  const handleLogout = async () => {
    if (confirm("Çıkış yapmak istediğinize emin misiniz?")) {
      try {
        await firebaseSignOut(auth);
        // The onAuthStateChanged will handle the rest
      } catch (error) {
        console.error('Logout error:', error);
      }
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setIsLoaded(false);
      console.log('Attempting Google login...');

      const result = await signInWithPopup(auth, googleProvider);
      console.log('Google login successful:', result.user.email);

      // The onAuthStateChanged will handle the rest
      setCurrentView('logbook');
      alert(`Google ile giriş yapıldı: ${result.user.email}`);
    } catch (error: any) {
      console.error('Google login error:', error);
      setIsLoaded(true);

      if (error.code === 'auth/popup-closed-by-user') {
        alert('Giriş işlemi iptal edildi.');
      } else if (error.code === 'auth/unauthorized-domain') {
        alert('Bu domain Firebase Console\'da yetkilendirilmemiş. Lütfen Firebase Console > Authentication > Settings > Authorized domains bölümünden domaini ekleyin.');
      } else {
        alert('Google ile giriş yapılırken bir hata oluştu: ' + error.message);
      }
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