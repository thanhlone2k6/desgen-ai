// Type definitions for Electron API exposed via preload script

export interface ElectronAPI {
  update: {
    check: () => Promise<{ success: boolean; error?: string }>;
    download: () => Promise<{ success: boolean; error?: string }>;
    install: () => Promise<{ success: boolean; error?: string }>;
    getVersion: () => Promise<string>;
    
    // Event listeners
    onChecking: (callback: () => void) => void;
    onAvailable: (callback: (info: { version: string; releaseDate: string; releaseNotes: string }) => void) => void;
    onNotAvailable: (callback: () => void) => void;
    onError: (callback: (error: string) => void) => void;
    onDownloadProgress: (callback: (progress: { percent: number; transferred: number; total: number }) => void) => void;
    onDownloaded: (callback: (info: { version: string }) => void) => void;
    
    // Remove listeners
    removeAllListeners: (channel: string) => void;
  };
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

