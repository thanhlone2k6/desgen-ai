
import React, { useEffect, useState } from 'react';

interface ApiKeyCheckerProps {
  onReady: () => void;
}

export const ApiKeyChecker: React.FC<ApiKeyCheckerProps> = ({ onReady }) => {
  const [hasKey, setHasKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [manualKey, setManualKey] = useState('');
  const [showPassword, setShowPassword] = useState(true);

  const checkKey = async () => {
    try {
      // Check sessionStorage (temporary, cleared on app close)
      const stored = sessionStorage.getItem('gemini_api_key');
      if (stored && stored.trim().length > 0) {
        setHasKey(true);
        onReady();
        return;
      }
      
      // REMOVED: Auto-set default API key - User must enter manually
      // No automatic connection - user must input API key
      setHasKey(false);
    } catch (e) {
      console.error("Error checking API key", e);
      setHasKey(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkKey();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const inputKey = manualKey.trim();
    
    // REMOVED: Secret passcode - User must enter API key manually
    
    if (inputKey.length > 10) {
      sessionStorage.setItem('gemini_api_key', inputKey);
      setHasKey(true);
      onReady();
    } else {
      alert("API Key không hợp lệ (quá ngắn).");
    }
  };

  // Show loading state when loading OR when hasKey is true (transitioning to main app)
  // This prevents white screen flash during state transition
  if (loading || hasKey) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-900">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand-500 border-t-transparent"></div>
          <div className="text-slate-400">{hasKey ? 'Đang khởi động...' : 'Đang kiểm tra cấu hình...'}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-slate-900 p-4 font-sans">
      <div className="w-full max-w-md rounded-2xl bg-slate-800 p-8 shadow-2xl border border-slate-700">
        {/* Logo */}
        <div className="mb-6 flex justify-center">
          <div className="rounded-full bg-brand-500/20 p-4 border border-brand-500/30">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-white text-center mb-2">
          DesGen AI <span className="text-brand-400">Pro</span>
        </h1>
        <p className="text-center text-slate-400 text-sm mb-8">
          Nhập API Key để bắt đầu sử dụng
        </p>

        {/* Form */}
        <form onSubmit={handleManualSubmit} className="flex flex-col gap-4">
          <div className="relative">
            <input 
              type={showPassword ? "text" : "password"}
              placeholder="Nhập API Key của bạn..." 
              value={manualKey}
              onChange={(e) => setManualKey(e.target.value.replace(/[^\x00-\x7F]/g, ""))}
              className="w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-3.5 pr-12 text-sm text-white placeholder-slate-500 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition"
              title={showPassword ? "Ẩn" : "Hiện"}
            >
              {showPassword ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                  <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                  <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          </div>
          
          <button 
            type="submit"
            disabled={!manualKey}
            className="w-full rounded-xl bg-brand-600 px-4 py-3.5 font-bold text-white transition hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-brand-600/20 active:scale-[0.98]"
          >
            Xác nhận & Vào App
          </button>
        </form>

        {/* Help link */}
        <p className="mt-6 text-center text-xs text-slate-500">
          Chưa có key?{' '}
          <a 
            href="https://aistudio.google.com/app/apikey" 
            target="_blank" 
            rel="noreferrer" 
            className="text-brand-400 hover:text-brand-300 underline"
          >
            Lấy key miễn phí tại đây
          </a>
        </p>
      </div>

      {/* Footer */}
      <p className="mt-6 text-xs text-slate-600">
        By ThanhNg • v8.1.0
      </p>
    </div>
  );
};
