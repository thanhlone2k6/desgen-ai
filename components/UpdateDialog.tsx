import React, { useState, useEffect } from 'react';

interface UpdateDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface UpdateInfo {
  version: string;
  releaseDate: string;
  releaseNotes: string;
}

interface DownloadProgress {
  percent: number;
  transferred: number;
  total: number;
}

export const UpdateDialog: React.FC<UpdateDialogProps> = ({ isOpen, onClose }) => {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentVersion, setCurrentVersion] = useState<string>('');
  const [isChecking, setIsChecking] = useState(false);
  const [isUpToDate, setIsUpToDate] = useState(false);
  const [checkTimeout, setCheckTimeout] = useState<NodeJS.Timeout | null>(null);
  const [isCancelled, setIsCancelled] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      // Reset state when dialog closes
      setIsCancelled(false);
      setIsChecking(false);
      setUpdateInfo(null);
      setError(null);
      setIsUpToDate(false);
      if (checkTimeout) {
        clearTimeout(checkTimeout);
        setCheckTimeout(null);
      }
      return;
    }

    // Get current version
    if (window.electronAPI?.update?.getVersion) {
      window.electronAPI.update.getVersion().then((version: string) => {
        setCurrentVersion(version);
      });
    }

    // Setup listeners
    const setupListeners = () => {
      if (!window.electronAPI?.update) return;

      const onAvailable = (info: UpdateInfo) => {
        if (isCancelled) return; // Ignore if cancelled
        if (checkTimeout) {
          clearTimeout(checkTimeout);
          setCheckTimeout(null);
        }
        setUpdateInfo(info);
        setError(null);
        setIsChecking(false);
        setIsUpToDate(false);
        // Auto-download immediately - mandatory update
        setTimeout(() => {
          if (window.electronAPI?.update?.download) {
            handleDownload();
          }
        }, 500);
      };

      const onNotAvailable = () => {
        if (isCancelled) return; // Ignore if cancelled
        if (checkTimeout) {
          clearTimeout(checkTimeout);
          setCheckTimeout(null);
        }
        setError(null);
        setIsChecking(false);
        setIsUpToDate(true);
      };

      const onError = (err: string) => {
        if (isCancelled) return; // Ignore if cancelled
        if (checkTimeout) {
          clearTimeout(checkTimeout);
          setCheckTimeout(null);
        }
        setError(err);
        setIsDownloading(false);
        setIsChecking(false);
      };

      const onProgress = (progress: DownloadProgress) => {
        setDownloadProgress(progress);
      };

      const onDownloaded = (info: { version: string }) => {
        setIsDownloaded(true);
        setIsDownloading(false);
        setDownloadProgress(null);
        // Auto-install immediately - mandatory update
        setTimeout(() => {
          handleInstall();
        }, 1000);
      };

      window.electronAPI.update.onAvailable(onAvailable);
      window.electronAPI.update.onNotAvailable(onNotAvailable);
      window.electronAPI.update.onError(onError);
      window.electronAPI.update.onDownloadProgress(onProgress);
      window.electronAPI.update.onDownloaded(onDownloaded);

      return () => {
        window.electronAPI.update.removeAllListeners('update-available');
        window.electronAPI.update.removeAllListeners('update-not-available');
        window.electronAPI.update.removeAllListeners('update-error');
        window.electronAPI.update.removeAllListeners('update-download-progress');
        window.electronAPI.update.removeAllListeners('update-downloaded');
      };
    };

    const cleanup = setupListeners();

    // Auto-check when dialog opens
    if (window.electronAPI?.update?.check && !isCancelled) {
      setIsChecking(true);
      setIsCancelled(false);
      
      // Set timeout for check (15 seconds)
      const timeout = setTimeout(() => {
        setIsChecking((prev) => {
          if (prev) {
            setError('Kiểm tra cập nhật quá lâu. Có thể do mạng chậm hoặc server không phản hồi. Vui lòng thử lại sau.');
            return false;
          }
          return prev;
        });
      }, 15000);
      setCheckTimeout(timeout);
      
      window.electronAPI.update.check();
    }

    return () => {
      cleanup();
      if (checkTimeout) {
        clearTimeout(checkTimeout);
        setCheckTimeout(null);
      }
    };
  }, [isOpen]);

  const handleDownload = async () => {
    if (!window.electronAPI?.update?.download) {
      setError('Update API không khả dụng');
      return;
    }

    setIsDownloading(true);
    setError(null);
    
    try {
      const result = await window.electronAPI.update.download();
      if (!result.success) {
        setError(result.error || 'Lỗi khi tải xuống bản cập nhật');
        setIsDownloading(false);
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi khi tải xuống bản cập nhật');
      setIsDownloading(false);
    }
  };

  const handleInstall = async () => {
    if (!window.electronAPI?.update?.install) {
      setError('Update API không khả dụng');
      return;
    }

    try {
      await window.electronAPI.update.install();
      // App will restart automatically
    } catch (err: any) {
      setError(err.message || 'Lỗi khi cài đặt bản cập nhật');
    }
  };

  const handleCheckUpdate = async () => {
    if (!window.electronAPI?.update?.check) {
      setError('Update API không khả dụng');
      return;
    }

    setError(null);
    setUpdateInfo(null);
    setIsDownloaded(false);
    setIsDownloading(false);
    setDownloadProgress(null);
    setIsChecking(true);
    setIsUpToDate(false);
    setIsCancelled(false);

    // Clear existing timeout
    if (checkTimeout) {
      clearTimeout(checkTimeout);
    }

    // Set timeout for check (15 seconds)
    const timeout = setTimeout(() => {
      setIsChecking((prev) => {
        if (prev) {
          setError('Kiểm tra cập nhật quá lâu. Có thể do mạng chậm hoặc server không phản hồi. Vui lòng thử lại sau.');
          return false;
        }
        return prev;
      });
    }, 15000);
    setCheckTimeout(timeout);

    try {
      await window.electronAPI.update.check();
    } catch (err: any) {
      if (checkTimeout) {
        clearTimeout(checkTimeout);
        setCheckTimeout(null);
      }
      setError(err.message || 'Lỗi khi kiểm tra bản cập nhật');
      setIsChecking(false);
    }
  };

  const handleCancel = () => {
    setIsCancelled(true);
    setIsChecking(false);
    if (checkTimeout) {
      clearTimeout(checkTimeout);
      setCheckTimeout(null);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="glass-panel relative w-full max-w-md rounded-3xl border border-white/20 p-6 shadow-2xl">
        {/* Close Button - Always show, but disabled when downloading/installing */}
        {!isDownloading && !isDownloaded && (
          <button
            onClick={handleCancel}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
            title={isChecking ? "Hủy kiểm tra" : "Đóng"}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        )}

        {/* Header */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-tr from-brand-400 to-brand-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white">Cập Nhật Ứng Dụng</h2>
          {currentVersion && (
            <p className="mt-2 text-sm text-slate-400">Phiên bản hiện tại: v{currentVersion}</p>
          )}
        </div>

        {/* Content */}
        <div className="space-y-4">
          {error && (
            <div className="rounded-xl bg-red-500/20 border border-red-500/50 p-4 text-sm text-red-300">
              <div className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span>{error}</span>
              </div>
            </div>
          )}

          {updateInfo && !isDownloaded && (
            <div className="space-y-4">
              <div className="rounded-xl bg-emerald-500/20 border border-emerald-500/50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="font-bold text-emerald-300">Có phiên bản mới!</span>
                </div>
                <p className="text-sm text-slate-300">
                  <span className="font-semibold">Phiên bản mới:</span> v{updateInfo.version}
                </p>
                <p className="mt-2 text-xs text-yellow-300">⚠️ Bản cập nhật bắt buộc - Đang tự động tải xuống...</p>
                {updateInfo.releaseNotes && (
                  <div className="mt-3 text-xs text-slate-400">
                    <p className="font-semibold mb-1">Thay đổi:</p>
                    <div className="changelog-scrollbar whitespace-pre-wrap max-h-64 overflow-y-auto overflow-x-hidden pr-2">
                      {updateInfo.releaseNotes}
                    </div>
                  </div>
                )}
              </div>

              {isDownloading && downloadProgress && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Đang tải xuống tự động...</span>
                    <span>{downloadProgress.percent.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-brand-500 to-brand-400 transition-all duration-300"
                      style={{ width: `${downloadProgress.percent}%` }}
                    />
                  </div>
                  <div className="text-xs text-slate-500 text-center">
                    {(downloadProgress.transferred / 1024 / 1024).toFixed(2)} MB / {(downloadProgress.total / 1024 / 1024).toFixed(2)} MB
                  </div>
                </div>
              )}

              {!isDownloading && !isDownloaded && (
                <div className="rounded-xl bg-yellow-500/20 border border-yellow-500/50 p-3 text-center">
                  <p className="text-sm text-yellow-300">Đang chuẩn bị tải xuống...</p>
                </div>
              )}
            </div>
          )}

          {isDownloaded && (
            <div className="space-y-4">
              <div className="rounded-xl bg-emerald-500/20 border border-emerald-500/50 p-4 text-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-emerald-400 mb-2 animate-pulse" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <p className="font-bold text-emerald-300">Đã tải xuống thành công!</p>
                <p className="mt-2 text-sm text-slate-300">Đang tự động cài đặt phiên bản mới...</p>
                <p className="mt-1 text-xs text-yellow-300">Ứng dụng sẽ tự động khởi động lại sau khi cài đặt.</p>
              </div>
            </div>
          )}

          {/* Up to date message */}
          {isUpToDate && !updateInfo && (
            <div className="space-y-4">
              <div className="rounded-xl bg-emerald-500/20 border border-emerald-500/50 p-4 text-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-emerald-400 mb-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <p className="font-bold text-emerald-300">Bạn đang sử dụng phiên bản mới nhất!</p>
                <p className="mt-2 text-sm text-slate-400">Không có bản cập nhật nào.</p>
              </div>
              <button
                onClick={handleCheckUpdate}
                className="w-full rounded-xl bg-slate-700 py-3 font-bold text-slate-300 transition hover:bg-slate-600"
              >
                Kiểm Tra Lại
              </button>
            </div>
          )}

          {/* Checking state */}
          {isChecking && !updateInfo && !isUpToDate && (
            <div className="space-y-4">
              <div className="rounded-xl bg-slate-800/50 border border-slate-700 p-4 text-center">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent mb-3"></div>
                <p className="text-slate-400">Đang kiểm tra bản cập nhật...</p>
                <p className="mt-2 text-xs text-slate-500">Có thể mất vài giây. Bạn có thể bấm X để hủy.</p>
              </div>
            </div>
          )}

          {/* Initial state - not checking yet */}
          {!updateInfo && !isDownloading && !isDownloaded && !isChecking && !isUpToDate && (
            <div className="space-y-4">
              <div className="rounded-xl bg-slate-800/50 border border-slate-700 p-4 text-center">
                <p className="text-slate-400">Bấm nút bên dưới để kiểm tra bản cập nhật mới.</p>
              </div>
              <button
                onClick={handleCheckUpdate}
                className="w-full rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 py-3 font-bold text-white shadow-lg transition hover:scale-105 active:scale-95"
              >
                Kiểm Tra Cập Nhật
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

