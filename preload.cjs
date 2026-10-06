const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('printCraft', {
  openPdf: () => ipcRenderer.invoke('pdf:open'),
  getLaunchPdf: () => ipcRenderer.invoke('pdf:launch'),
  listPrinters: () => ipcRenderer.invoke('printers:list'),
  print: (options) => ipcRenderer.invoke('document:print', options)
});
