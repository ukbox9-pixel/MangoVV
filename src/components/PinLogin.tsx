import React, { useState, useEffect } from 'react';
import { Delete, Lock, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';
import { findUserByPin, getUsers } from '../services/db';
import { saveSessionUser } from '../services/auth';
import { User } from '../types';

interface PinLoginProps {
  onLoginSuccess: (user: User) => void;
  showToast: (type: 'success' | 'error', message: string) => void;
}

export const PinLogin: React.FC<PinLoginProps> = ({ onLoginSuccess, showToast }) => {
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  // Auto verify when 4 digits are entered
  useEffect(() => {
    if (pin.length === 4) {
      handleVerify(pin);
    } else {
      setErrorMsg('');
    }
  }, [pin]);

  const handleKeypadPress = (val: string) => {
    if (pin.length < 4) {
      setPin((prev) => prev + val);
    }
  };

  const handleDelete = () => {
    setPin((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setPin('');
    setErrorMsg('');
  };

  const handleVerify = (pinToTest: string) => {
    setIsVerifying(true);
    // Instant lookup (กดแล้วต้องไป - no artificial delay)
    const user = findUserByPin(pinToTest);

    if (user) {
      saveSessionUser(user);
      showToast('success', `ยินดีต้อนรับ ${user.name}`);
      onLoginSuccess(user);
    } else {
      setErrorMsg('รหัส PIN ไม่ถูกต้อง หรือบัญชีถูกระงับการใช้งาน');
      setPin('');
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 text-white">
      <div className="w-full max-w-sm flex flex-col items-center">
        {/* Brand Logo / Header */}
        <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mb-4 shadow-lg shadow-amber-950 text-3xl">
          🥭
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-white mb-1 flex items-center gap-2">
          <span>Mango</span>
          <span>🥭</span>
        </h1>
        <p className="text-sm text-slate-300 text-center mb-6">
          กรอกรหัส PIN 4 หลักเพื่อเข้าสู่ระบบ
        </p>

        {/* PIN Dots Indicator */}
        <div className="flex items-center justify-center gap-4 mb-6">
          {[0, 1, 2, 3].map((index) => {
            const isFilled = pin.length > index;
            return (
              <div
                key={index}
                className={`w-5 h-5 rounded-full transition-all duration-200 border-2 ${
                  isFilled
                    ? 'bg-amber-400 border-amber-300 scale-110 shadow-md shadow-amber-500/50'
                    : 'bg-slate-800/80 border-slate-600'
                }`}
              />
            );
          })}
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="mb-4 text-xs font-medium text-rose-300 bg-rose-950/60 border border-rose-800 px-3 py-1.5 rounded-lg text-center animate-shake">
            {errorMsg}
          </div>
        )}

        {/* Numeric Keypad for Mobile and Touch */}
        <div className="w-full max-w-[280px] grid grid-cols-3 gap-3 mb-6">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => handleKeypadPress(String(num))}
              className="h-16 rounded-2xl bg-slate-800/90 hover:bg-slate-700 active:bg-amber-600 border border-slate-700 text-2xl font-semibold text-white shadow-md transition-all active:scale-95 flex items-center justify-center"
            >
              {num}
            </button>
          ))}

          <button
            type="button"
            onClick={handleClear}
            className="h-16 rounded-2xl bg-slate-800/50 hover:bg-slate-700/60 active:bg-slate-700 border border-slate-800 text-sm font-medium text-slate-400 transition-all flex items-center justify-center"
          >
            ล้าง
          </button>

          <button
            type="button"
            onClick={() => handleKeypadPress('0')}
            className="h-16 rounded-2xl bg-slate-800/90 hover:bg-slate-700 active:bg-amber-600 border border-slate-700 text-2xl font-semibold text-white shadow-md transition-all active:scale-95 flex items-center justify-center"
          >
            0
          </button>

          <button
            type="button"
            onClick={handleDelete}
            className="h-16 rounded-2xl bg-slate-800/50 hover:bg-slate-700/60 active:bg-slate-700 border border-slate-800 text-slate-300 transition-all flex items-center justify-center"
            aria-label="Delete digit"
          >
            <Delete className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
};
