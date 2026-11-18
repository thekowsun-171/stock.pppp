import React, { useState } from 'react';
import { Lock, LogIn } from 'lucide-react';

interface LoginViewProps {
  onSuccess: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onSuccess }) => {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcode.trim() === '2026') {
      setError(null);
      onSuccess();
    } else {
      setError('รหัสผ่านไม่ถูกต้อง กรุณากรอกรหัสผ่านอีกครั้ง');
    }
  };

  return (
    <div className="flex min-h-screen flex-col justify-center bg-slate-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-md">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-2xl border border-slate-100 bg-white p-2">
              <img
                src="/assets/aistudio/_________________________1__f33f9ccd.jpg"
                alt="โลโก้ บจก.พิพุทพูนผล"
                referrerPolicy="no-referrer"
                className="h-full w-full object-contain"
              />
            </div>

            <h1 className="mt-5 font-display text-2xl font-bold text-slate-900">
              สต็อตผลไม้ บจก.พิพุทพูนผล
            </h1>
            <p className="mt-2 font-display text-xl font-semibold text-brand-800">
              ตั้งสติก่อนสตาร์ท
            </p>
            <p className="mt-2 text-base text-slate-600">
              ระบบจัดการสต็อคสินค้า บาร์โค้ด 1D และบันทึกบัญชี
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label
                htmlFor="app-passcode"
                className="block text-base font-medium text-slate-700"
              >
                รหัสผ่านเข้าใช้งานระบบ
              </label>
              <div className="relative mt-2">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  id="app-passcode"
                  type="password"
                  inputMode="numeric"
                  autoFocus
                  value={passcode}
                  onChange={(e) => {
                    setPasscode(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="กรอกรหัสผ่าน"
                  className="w-full rounded-xl border border-slate-300 py-3 pl-11 pr-4 text-lg font-medium tracking-widest text-slate-900 focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-base text-red-800">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-brand-800 px-6 py-3 text-lg font-semibold text-white transition-colors hover:bg-brand-900"
            >
              <LogIn className="h-5 w-5" />
              <span>เข้าสู่ระบบ</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
