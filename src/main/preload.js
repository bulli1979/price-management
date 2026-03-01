const { contextBridge, ipcRenderer } = require("electron");

// Sichere API für den Renderer-Prozess
contextBridge.exposeInMainWorld("electronAPI", {
  // Preis-Funktionen
  addPreis: (name, herkunft, anzahl, preis, isASpend = false) =>
    ipcRenderer.invoke("add-preis", name, herkunft, anzahl, preis, isASpend),

  getAllPreise: () => ipcRenderer.invoke("get-all-preise"),

  updatePreis: (id, name, herkunft, anzahl, preis, isASpend = false) =>
    ipcRenderer.invoke("update-preis", id, name, herkunft, anzahl, preis, isASpend),

  deletePreis: (id) => ipcRenderer.invoke("delete-preis", id),

  // Kategorie-Funktionen
  addKategorie: (name, typ, wert1, wert2) =>
    ipcRenderer.invoke("add-kategorie", name, typ, wert1, wert2),

  getAllKategorien: () => ipcRenderer.invoke("get-all-kategorien"),

  updateKategorie: (id, name, typ, wert1, wert2) =>
    ipcRenderer.invoke("update-kategorie", id, name, typ, wert1, wert2),

  deleteKategorie: (id) => ipcRenderer.invoke("delete-kategorie", id),

  // Runden-Funktionen
  createRunde: (rundennummer, datum, gesamtpreis) =>
    ipcRenderer.invoke("create-runde", rundennummer, datum, gesamtpreis),

  getAllRunden: () => ipcRenderer.invoke("get-all-runden"),

  getRundeById: (id) => ipcRenderer.invoke("get-runde-by-id", id),

  addPreisZuRunde: (rundeId, preisId, kategorieId) =>
    ipcRenderer.invoke("add-preis-zu-runde", rundeId, preisId, kategorieId),

  getRundenPreise: (rundeId) =>
    ipcRenderer.invoke("get-runden-preise", rundeId),

  getNextRundennummer: () => ipcRenderer.invoke("get-next-rundennummer"),

  getPreiseByKategorie: (kategorieId) =>
    ipcRenderer.invoke("get-preise-by-kategorie", kategorieId),

  // Excel-Upload
  uploadExcel: (filePath) => ipcRenderer.invoke("upload-excel", filePath),

  // PDF-Export
  exportRundeToPDF: (rundeId) =>
    ipcRenderer.invoke("export-runde-to-pdf", rundeId),
});
