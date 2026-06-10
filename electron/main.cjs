// electron/main.js
// Unity Book Studio — Electron main process

const { app, BrowserWindow, dialog, shell } = require('electron');
const path = require('path');
const http = require('http');

const isDev = !app.isPackaged;
const DEV_SERVER_URL = 'http://localhost:5180';

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Unity Book Studio',
    titleBarStyle: 'hiddenInset', // macOS native traffic lights
    trafficLightPosition: { x: 15, y: 15 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false, // Allow local API calls to Ollama/ComfyUI
    },
    backgroundColor: '#1a1a2e',
    show: false,
  });

  // Show when ready to prevent flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Load the app
  if (isDev) {
    mainWindow.loadURL(DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ── Health Checks ──

function checkService(url, name) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: 3000 }, (res) => {
      resolve({ name, healthy: res.statusCode === 200 });
    });
    req.on('error', () => resolve({ name, healthy: false }));
    req.on('timeout', () => { req.destroy(); resolve({ name, healthy: false }); });
  });
}

async function checkDependencies() {
  const ollama = await checkService('http://127.0.0.1:11434/api/tags', 'Ollama');
  const comfyui = await checkService('http://127.0.0.1:8000/system_stats', 'ComfyUI');

  const messages = [];
  if (!ollama.healthy) {
    messages.push('Ollama is not running. AI features (drafting, polish, critique) will not work.\n\nStart Ollama with: ollama serve');
  }
  if (!comfyui.healthy) {
    messages.push('ComfyUI is not running. Cover art generation will not work.\n\nThis is optional — the rest of the app works without it.');
  }

  if (messages.length > 0) {
    dialog.showMessageBoxSync({
      type: 'warning',
      title: 'Unity Book Studio — Service Check',
      message: 'Some local services are not running:',
      detail: messages.join('\n\n'),
      buttons: ['Continue Anyway'],
    });
  }

  console.log(`[ELECTRON] Ollama: ${ollama.healthy ? 'OK' : 'NOT RUNNING'}`);
  console.log(`[ELECTRON] ComfyUI: ${comfyui.healthy ? 'OK' : 'NOT RUNNING'}`);
}

// ── App Lifecycle ──

app.whenReady().then(async () => {
  await checkDependencies();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
