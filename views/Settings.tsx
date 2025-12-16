import React, { useRef, useState } from 'react';
import { AppData, User } from '../types';
import { Button } from '../components/Button';
import { Download, Upload, Database, LogOut, User as UserIcon, Lock, Mail, UserPlus, LogIn } from 'lucide-react';

interface SettingsProps {
  user: User;
  data: AppData;
  onImport: (data: AppData) => void;
  onLogin: (email: string) => void;
  onRegister: (email: string) => void;
  onLogout: () => void;
}

export const SettingsView: React.FC<SettingsProps> = ({ user, data, onImport, onLogin, onRegister, onLogout }) => {
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

    if (authMode === 'register') {
      if (password !== confirmPassword) {
        alert("Şifreler eşleşmiyor.");
        return;
      }
      onRegister(email.trim());
    } else {
      onLogin(email.trim());
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
            if(confirm('DİKKAT: Bu işlem mevcut tüm verilerinizi silip yedekten geri yükleyecektir. Onaylıyor musunuz?')) {
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
                <div>
                  <p className="text-xs text-brand-600 font-semibold uppercase">Aktif Hesap</p>
                  <p className="font-medium text-slate-900">{user.email}</p>
                </div>
              </div>
              <p className="text-sm text-slate-500">
                Bu hesaba ait veriler cihazınızda güvenle saklanmaktadır.
              </p>
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
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${
                    authMode === 'login' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <LogIn size={16} /> Giriş Yap
                </button>
                <button
                  onClick={() => setAuthMode('register')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${
                    authMode === 'register' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
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