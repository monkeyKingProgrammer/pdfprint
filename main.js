import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let mainWindow;

function commandLinePdf() {
  const argument = process.argv.find((value) => value.toLowerCase().endsWith('.pdf'));
  return argument ? path.resolve(argument) : null;
}

async function readPdf(filePath) {
  if (!filePath || path.extname(filePath).toLowerCase() !== '.pdf') return null;
  const data = await fs.readFile(filePath);
  return { name: path.basename(filePath), path: filePath, data };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1040,
    minHeight: 700,
    backgroundColor: '#edf0f4',
    title: 'PrintCraft PDF',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('pdf:open', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose a PDF to print',
    filters: [{ name: 'PDF documents', extensions: ['pdf'] }],
    properties: ['openFile']
  });
  if (result.canceled || !result.filePaths[0]) return null;
  return readPdf(result.filePaths[0]);
});

ipcMain.handle('pdf:launch', async () => {
  const filePath = commandLinePdf();
  if (!filePath) return null;
  try {
    return await readPdf(filePath);
  } catch {
    return null;
  }
});

ipcMain.handle('printers:list', async () => {
  if (!mainWindow) return [];
  return mainWindow.webContents.getPrintersAsync();
});

ipcMain.handle('document:print', async (_event, options) => {
  if (!mainWindow) return { success: false, reason: 'Window is not available.' };

  const printOptions = {
    silent: Boolean(options.silent),
    printBackground: true,
    color: options.color !== false,
    copies: Math.max(1, Number(options.copies) || 1),
    landscape: options.orientation === 'landscape',
    duplexMode: options.duplex || 'simplex',
    collate: options.collate !== false,
    margins: { marginType: 'none' }
  };

  if (options.silent && options.deviceName) printOptions.deviceName = options.deviceName;

  return new Promise((resolve) => {
    mainWindow.webContents.print(printOptions, (success, failureReason) => {
      resolve({ success, reason: failureReason || '' });
    });
  });
});
