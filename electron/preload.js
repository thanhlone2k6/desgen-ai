// Preload script - runs in renderer process before page loads
const { contextBridge, ipcRenderer } = require('electron');

// Use contextBridge to safely expose APIs to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Update API
  update: {
    check: () => ipcRenderer.invoke('update-check'),
    download: () => ipcRenderer.invoke('update-download'),
    install: () => ipcRenderer.invoke('update-install'),
    getVersion: () => ipcRenderer.invoke('get-app-version'),
    
    // Listeners
    onChecking: (callback) => ipcRenderer.on('update-checking', callback),
    onAvailable: (callback) => ipcRenderer.on('update-available', (_, data) => callback(data)),
    onNotAvailable: (callback) => ipcRenderer.on('update-not-available', callback),
    onError: (callback) => ipcRenderer.on('update-error', (_, error) => callback(error)),
    onDownloadProgress: (callback) => ipcRenderer.on('update-download-progress', (_, progress) => callback(progress)),
    onDownloaded: (callback) => ipcRenderer.on('update-downloaded', (_, info) => callback(info)),
    
    // Remove listeners
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
  },
  
  // Shell API - Open external URLs in default browser
  shell: {
    openExternal: (url) => ipcRenderer.invoke('shell-open-external', url),
  }
});
