import React, { useState } from 'react';
import { Button } from '../components/Button';
import { Dumbbell } from 'lucide-react';

interface AuthProps {
  onLogin: (email: string) => void;
  onGoogleLogin: () => void;
}

export const AuthView: React.FC<AuthProps> = ({ onLogin, onGoogleLogin }) => {
  const [email, setEmail] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      onLogin(email);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-50">
      <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-xl">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-brand-100 p-3 rounded-full mb-4">
            <Dumbbell className="w-8 h-8 text-brand-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">FitLog Pro'ya Hoşgeldin</h1>
          <p className="text-slate-500 text-center mt-2">Antrenmanlarını profesyonelce takip et, gelişimini kaydet.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">E-posta Adresi</label>
            <input
              type="email"
              id="email"
              required
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
              placeholder="ornek@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <Button type="submit" fullWidth size="lg">
            Giriş Yap
          </Button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-300" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-white px-2 text-slate-500">veya</span>
          </div>
        </div>

        <div>
          <Button onClick={onGoogleLogin} fullWidth size="lg" variant="outline">
            Google ile Giriş Yap
          </Button>
        </div>

        <p className="mt-6 text-xs text-center text-slate-400">
          Giriş yaparak verilerinizin cihazınızda veya bulutta saklanmasını kabul etmiş olursunuz.
        </p>
      </div>
    </div>
  );
};
