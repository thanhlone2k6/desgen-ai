import React, { useState, useEffect } from 'react';
import { setToken, setUser, getOrCreateDeviceId, saveCredentials, getSavedCredentials, clearSavedCredentials } from '../services/storageService';

const WORKER_URL = "https://desgen-ai-worker.thanhnguyenphotowork.workers.dev";

interface AuthScreenProps {
  onAuthed: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthed }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [name, setName] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [registerEmail, setRegisterEmail] = useState('');

  // Load saved credentials on mount (only for login screen)
  useEffect(() => {
    if (isLogin) {
      const saved = getSavedCredentials();
      if (saved) {
        setEmail(saved.email);
        setPassword(saved.password);
      }
    }
  }, [isLogin]);

  const handleRegisterRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!name.trim() || name.trim().length < 2) {
      setError('Tên phải có ít nhất 2 ký tự');
      return;
    }

    if (password !== passwordConfirm) {
      setError('Mật khẩu xác nhận không khớp');
      return;
    }

    if (password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự');
      return;
    }

    setLoading(true);

    try {
      const device_id = getOrCreateDeviceId();
      const res = await fetch(`${WORKER_URL}/auth/register-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          name: name.trim(), 
          email, 
          password,
          device_id 
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setEmailSent(true);
        setRegisterEmail(email);
        setError('');
      } else {
        setError(data.error || 'Đăng ký thất bại');
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi kết nối. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteRegister = async () => {
    setError('');
    setLoading(true);

    try {
      const device_id = getOrCreateDeviceId();
      const res = await fetch(`${WORKER_URL}/auth/complete-register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          email: registerEmail, 
          password,
          device_id 
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setToken(data.token);
        setUser(data.user);
        // Lưu credentials để auto-fill lần sau
        saveCredentials(registerEmail, password);
        // Show success message briefly
        alert('Tạo tài khoản thành công!');
        onAuthed();
      } else {
        setError(data.error || 'Hoàn tất đăng ký thất bại');
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi kết nối. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${WORKER_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (res.ok) {
        setToken(data.token);
        setUser(data.user);
        // Lưu credentials để auto-fill lần sau
        saveCredentials(email, password);
        onAuthed();
      } else {
        setError(data.error || 'Đăng nhập thất bại');
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi kết nối. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    if (isLogin) {
      handleLogin(e);
    } else {
      handleRegisterRequest(e);
    }
  };

  // Show email sent confirmation screen
  if (emailSent) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="w-full max-w-md px-6">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-8 shadow-2xl backdrop-blur-xl">
            <div className="mb-8 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20">
                <svg className="h-8 w-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h1 className="mb-2 text-3xl font-bold text-white">Đã gửi email xác nhận</h1>
              <p className="text-slate-400">
                Chúng tôi đã gửi email xác nhận đến <span className="font-semibold text-white">{registerEmail}</span>
              </p>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl bg-blue-500/20 border border-blue-500/50 p-4 text-sm text-blue-300">
                <p className="mb-2">Vui lòng kiểm tra hộp thư và bấm vào link xác nhận trong email.</p>
                <p>Sau khi xác nhận email, quay lại app và bấm nút bên dưới để hoàn tất đăng ký.</p>
              </div>

              {error && (
                <div className="rounded-xl bg-red-500/20 border border-red-500/50 p-3 text-sm text-red-300">
                  {error}
                </div>
              )}

              <button
                onClick={handleCompleteRegister}
                disabled={loading}
                className="w-full rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 py-4 font-bold text-white shadow-lg transition hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {loading ? 'Đang xử lý...' : 'Tôi đã xác nhận email'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setEmailSent(false);
                  setError('');
                  setPassword('');
                  setPasswordConfirm('');
                }}
                className="w-full rounded-xl bg-slate-700 py-3 font-medium text-slate-300 transition hover:bg-slate-600"
                disabled={loading}
              >
                Gửi lại email xác nhận
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="w-full max-w-md px-6">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-8 shadow-2xl backdrop-blur-xl">
          <div className="mb-8 text-center">
            <h1 className="mb-2 text-3xl font-bold text-white">DesignGen Pro</h1>
            <p className="text-slate-400">
              {isLogin ? 'Đăng nhập để tiếp tục' : 'Tạo tài khoản mới'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Tên
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  minLength={2}
                  className="w-full rounded-xl border border-white/20 bg-black/20 p-4 text-white placeholder-white/40 shadow-inner backdrop-blur-sm focus:border-brand-500 focus:bg-black/30 outline-none transition"
                  placeholder="Tên của bạn"
                  disabled={loading}
                />
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-xl border border-white/20 bg-black/20 p-4 text-white placeholder-white/40 shadow-inner backdrop-blur-sm focus:border-brand-500 focus:bg-black/30 outline-none transition"
                placeholder="your@email.com"
                disabled={loading}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Mật khẩu
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full rounded-xl border border-white/20 bg-black/20 p-4 pr-12 text-white placeholder-white/40 shadow-inner backdrop-blur-sm focus:border-brand-500 focus:bg-black/30 outline-none transition"
                  placeholder="••••••••"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition"
                  disabled={loading}
                >
                  {showPassword ? (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {!isLogin && (
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Xác nhận mật khẩu
                </label>
                <div className="relative">
                  <input
                    type={showPasswordConfirm ? "text" : "password"}
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    required
                    minLength={6}
                    className="w-full rounded-xl border border-white/20 bg-black/20 p-4 pr-12 text-white placeholder-white/40 shadow-inner backdrop-blur-sm focus:border-brand-500 focus:bg-black/30 outline-none transition"
                    placeholder="••••••••"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition"
                    disabled={loading}
                  >
                    {showPasswordConfirm ? (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-xl bg-red-500/20 border border-red-500/50 p-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 py-4 font-bold text-white shadow-lg transition hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {loading ? 'Đang xử lý...' : isLogin ? 'Đăng nhập' : 'Đăng ký'}
            </button>
          </form>

          <div className="mt-6 space-y-3">
            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError('');
                  setName('');
                  setPassword('');
                  setPasswordConfirm('');
                  setEmailSent(false);
                  // Load saved credentials when switching to login
                  if (!isLogin) {
                    const saved = getSavedCredentials();
                    if (saved) {
                      setEmail(saved.email);
                      setPassword(saved.password);
                    }
                  }
                }}
                className="text-sm text-slate-400 hover:text-brand-400 transition"
                disabled={loading}
              >
                {isLogin ? 'Chưa có tài khoản? Đăng ký' : 'Đã có tài khoản? Đăng nhập'}
              </button>
            </div>
            
            {/* Option to clear saved credentials */}
            {isLogin && getSavedCredentials() && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    clearSavedCredentials();
                    setEmail('');
                    setPassword('');
                  }}
                  className="text-xs text-slate-500 hover:text-slate-400 transition"
                  disabled={loading}
                >
                  Xóa thông tin đã lưu
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
