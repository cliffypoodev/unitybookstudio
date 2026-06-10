// electron/preload.js
// Minimal preload — exposes nothing to renderer.
// The app uses fetch() for all API calls (Ollama, ComfyUI).
// No Node.js APIs needed in the renderer process.

const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
});
