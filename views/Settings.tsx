import React, { useRef, useState } from 'react';
import { AppData, User } from '../types';
import { Button } from '../components/Button';
import { Download, Upload, Database, LogOut, User as UserIcon, Lock, Mail, UserPlus, LogIn, Cloud, Smartphone } from 'lucide-react';

interface SettingsProps {
  user: User;
  data: AppData;
  onImport: (data: AppData) => void;
  onLogin: (email: string, password: string) => void;
  onRegister: (email: string, password: string) => void;
  onLogout: () => void;
  onGoogleLogin: () => void;
  isCloudUser?: boolean;
}

export const SettingsView: React.FC<SettingsProps> = ({ user, data, onImport, onLogin, onRegister, onLogout, onGoogleLogin, isCloudUser = false }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auth Form State
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim() || !password.trim()) {
      alert("Lütfen tüm alanları doldurunuz.");
      return;
    }

    if (password.length < 6) {
      alert("Şifre en az 6 karakter olmalıdır.");
      return;
    }

    if (authMode === 'register') {
      if (password !== confirmPassword) {
        alert("Şifreler eşleşmiyor.");
        return;
      }
      onRegister(email.trim(), password);
    } else {
      onLogin(email.trim(), password);
    }

    // Reset form on success (handled by parent logic usually, but clearing here for UX)
    setEmail('');
    setPassword('');
    setConfirmPassword('');
  };

  const handleExportJson = () => {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fitlog_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const importedData = JSON.parse(event.target?.result as string);
          if (importedData.logs && importedData.exercises) {
            if (confirm('DİKKAT: Bu işlem mevcut tüm verilerinizi silip yedekten geri yükleyecektir. Onaylıyor musunuz?')) {
              onImport(importedData);
              alert('Yedek başarıyla geri yüklendi.');
            }
          } else {
            alert('Geçersiz dosya formatı.');
          }
        } catch (error) {
          alert('Dosya okunurken hata oluştu.');
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <h2 className="text-xl font-bold text-slate-900">Ayarlar</h2>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="flex items-center gap-2 p-6 pb-4 text-slate-900 font-bold border-b border-slate-100">
          <UserIcon size={20} className="text-brand-600" />
          <h3>Hesap Yönetimi</h3>
        </div>

        <div className="p-6 pt-4">
          {user.email !== 'Yerel Hesap' ? (
            <div className="space-y-4">
              <div className="bg-brand-50 p-4 rounded-lg flex items-center gap-3 border border-brand-100">
                <div className="w-10 h-10 bg-brand-200 rounded-full flex items-center justify-center text-brand-700 font-bold text-lg">
                  {user.email.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="text-xs text-brand-600 font-semibold uppercase">Aktif Hesap</p>
                  <p className="font-medium text-slate-900">{user.email}</p>
                </div>
              </div>

              {/* Sync Status Indicator */}
              <div className={`flex items-center gap-2 p-3 rounded-lg border ${isCloudUser
                ? 'bg-green-50 border-green-200 text-green-700'
                : 'bg-amber-50 border-amber-200 text-amber-700'
                }`}>
                {isCloudUser ? (
                  <>
                    <Cloud size={18} />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Bulut Senkronizasyonu Aktif</p>
                      <p className="text-xs opacity-80">Verileriniz tüm cihazlarınızda senkronize edilir.</p>
                    </div>
                  </>
                ) : (
                  <>
                    <Smartphone size={18} />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Yalnızca Bu Cihaz</p>
                      <p className="text-xs opacity-80">Verileriniz sadece bu cihazda saklanır.</p>
                    </div>
                  </>
                )}
              </div>

              <Button onClick={onLogout} variant="secondary" fullWidth className="text-red-600 border-red-100 hover:bg-red-50 hover:border-red-200">
                <LogOut size={16} className="mr-2" /> Çıkış Yap
              </Button>
            </div>
          ) : (
            <div>
              {/* Tabs */}
              <div className="flex bg-slate-100 p-1 rounded-lg mb-6">
                <button
                  onClick={() => setAuthMode('login')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${authMode === 'login' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                  <LogIn size={16} /> Giriş Yap
                </button>
                <button
                  onClick={() => setAuthMode('register')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${authMode === 'register' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                  <UserPlus size={16} /> Kayıt Ol
                </button>
              </div>

              <form onSubmit={handleAuthSubmit} className="space-y-4">
                <p className="text-sm text-slate-500 mb-2">
                  {authMode === 'login'
                    ? 'Mevcut verilerinize erişmek için giriş yapın.'
                    : 'Kendi hesabınızı oluşturarak verilerinizi kişiselleştirin.'}
                </p>

                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 text-slate-400" size={18} />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="E-posta Adresi"
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm"
                  />
                </div>

                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 text-slate-400" size={18} />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Şifre"
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm"
                  />
                </div>

                {authMode === 'register' && (
                  <div className="relative animate-in fade-in slide-in-from-top-2">
                    <Lock className="absolute left-3 top-2.5 text-slate-400" size={18} />
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Şifre (Tekrar)"
                      className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm"
                    />
                  </div>
                )}

                <Button type="submit" fullWidth>
                  {authMode === 'login' ? 'Giriş Yap' : 'Hesap Oluştur'}
                </Button>

                <p className="text-[10px] text-center text-slate-400">
                  Cihaz üzerinde yerel hesap oluşturulur.
                </p>
              </form>

              {/* Google Sign-In Divider & Button */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-3 text-slate-400">veya</span>
                </div>
              </div>

              <button
                onClick={onGoogleLogin}
                type="button"
                className="w-full flex items-center justify-center gap-3 py-2.5 px-4 border border-slate-300 rounded-lg hover:bg-slate-50 hover:border-slate-400 transition-all duration-200 group"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">
                  Google ile Giriş Yap
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
        <div className="flex items-center gap-2 mb-4 text-slate-900 font-bold">
          <Database size={20} className="text-brand-600" />
          <h3>Veri Yönetimi</h3>
        </div>
        <p className="text-sm text-slate-500 mb-6">
          Verilerinizi güvenle yedekleyin veya başka bir cihaza taşımak için dışa aktarın.
        </p>

        <div className="flex flex-col gap-3">
          <Button onClick={handleExportJson} variant="secondary" fullWidth className="justify-start">
            <Download size={18} className="mr-2" /> JSON Olarak Dışa Aktar (Yedekle)
          </Button>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportJson}
            accept=".json"
            className="hidden"
          />
          <Button onClick={() => fileInputRef.current?.click()} variant="secondary" fullWidth className="justify-start">
            <Upload size={18} className="mr-2" /> JSON İçe Aktar (Geri Yükle)
          </Button>
        </div>
      </div>

      <div className="text-center text-xs text-slate-300 pt-8">
        FitLog Pro v2.2
      </div>
    </div>
  );
};