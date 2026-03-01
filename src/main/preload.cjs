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

  // Lotto-Funktionen
  createLotto: (name, dateFrom, dateTo, gastroRevenue, donations) =>
    ipcRenderer.invoke(
      "create-lotto",
      name,
      dateFrom,
      dateTo,
      gastroRevenue,
      donations
    ),
  updateLotto: (id, name, dateFrom, dateTo, gastroRevenue, donations) =>
    ipcRenderer.invoke(
      "update-lotto",
      id,
      name,
      dateFrom,
      dateTo,
      gastroRevenue,
      donations
    ),
  addLottoDay: (lottoId, date) =>
    ipcRenderer.invoke("add-lotto-day", lottoId, date),
  updateLottoDay: (dayId, gastroRevenue, donations) =>
    ipcRenderer.invoke("update-lotto-day", dayId, gastroRevenue, donations),
  deleteLottoDay: (lottoId, dayNumber) =>
    ipcRenderer.invoke("delete-lotto-day", lottoId, dayNumber),
  getAllLottos: () => ipcRenderer.invoke("get-all-lottos"),
  getLottoById: (id) => ipcRenderer.invoke("get-lotto-by-id", id),
  getLottoDays: (lottoId) => ipcRenderer.invoke("get-lotto-days", lottoId),
  getRundenByLotto: (lottoId) =>
    ipcRenderer.invoke("get-runden-by-lotto", lottoId),
  getRundenByLottoDay: (lottoDayId) =>
    ipcRenderer.invoke("get-runden-by-lotto-day", lottoDayId),
  getRundenByLottoDayNumber: (lottoId, dayNumber) =>
    ipcRenderer.invoke("get-runden-by-lotto-day-number", lottoId, dayNumber),

  // Konfigurationen-Funktionen
  createKonfiguration: (name) =>
    ipcRenderer.invoke("create-konfiguration", name),
  getAllKonfigurationen: () => ipcRenderer.invoke("get-all-konfigurationen"),
  getKonfigurationById: (id) =>
    ipcRenderer.invoke("get-konfiguration-by-id", id),
  getKonfigurationKategorien: (konfigurationId) =>
    ipcRenderer.invoke("get-konfiguration-kategorien", konfigurationId),
  addKategorieZuKonfiguration: (
    konfigurationId,
    kategorieId,
    anzahlMin,
    anzahlMax
  ) =>
    ipcRenderer.invoke(
      "add-kategorie-zu-konfiguration",
      konfigurationId,
      kategorieId,
      anzahlMin,
      anzahlMax
    ),
  updateKonfiguration: (id, name) =>
    ipcRenderer.invoke("update-konfiguration", id, name),
  removeKategorieVonKonfiguration: (konfigurationId, kategorieId) =>
    ipcRenderer.invoke("remove-kategorie-von-konfiguration", konfigurationId, kategorieId),
  updateKonfigurationKategorie: (konfigurationId, kategorieId, anzahlMin, anzahlMax) =>
    ipcRenderer.invoke("update-konfiguration-kategorie", konfigurationId, kategorieId, anzahlMin, anzahlMax),
  deleteKonfiguration: (id) => ipcRenderer.invoke("delete-konfiguration", id),

  // Runden-Funktionen
  createRunde: (
    lottoDayId,
    rundennummer,
    datum,
    einnahmen,
    ausgaben,
    kategorien,
    priceAmount
  ) =>
    ipcRenderer.invoke(
      "create-runde",
      lottoDayId,
      rundennummer,
      datum,
      einnahmen,
      ausgaben,
      kategorien,
      priceAmount
    ),

  getAllRunden: () => ipcRenderer.invoke("get-all-runden"),

  getRundeById: (id) => ipcRenderer.invoke("get-runde-by-id", id),

  getRundenKategorien: (rundeId) =>
    ipcRenderer.invoke("get-runden-kategorien", rundeId),

  addPreisZuRunde: (rundeId, preisId, kategorieId) =>
    ipcRenderer.invoke("add-preis-zu-runde", rundeId, preisId, kategorieId),

  removePreisVonRunde: (rundeId, preisId) =>
    ipcRenderer.invoke("remove-preis-von-runde", rundeId, preisId),

  removePreisVonRundeById: (rundenPreisId) =>
    ipcRenderer.invoke("remove-preis-von-runde-by-id", rundenPreisId),
  updateRundenPreisAnzahl: (rundenPreisId, anzahl) =>
    ipcRenderer.invoke("update-runden-preis-anzahl", rundenPreisId, anzahl),

  updateRunde: (id, einnahmen, ausgaben, priceAmount) =>
    ipcRenderer.invoke("update-runde", id, einnahmen, ausgaben, priceAmount),
  updateRundenKategorie: (rundeId, kategorieId, anzahl) =>
    ipcRenderer.invoke("update-runden-kategorie", rundeId, kategorieId, anzahl),

  clearRundenPreise: (rundeId) =>
    ipcRenderer.invoke("clear-runden-preise", rundeId),

  getRundenPreise: (rundeId) =>
    ipcRenderer.invoke("get-runden-preise", rundeId),

  getNextRundennummer: (lottoDayId) =>
    ipcRenderer.invoke("get-next-rundennummer", lottoDayId),

  getPreiseByKategorie: (kategorieId) =>
    ipcRenderer.invoke("get-preise-by-kategorie", kategorieId),

  generateRundenPreise: (rundeId, zielsumme) =>
    ipcRenderer.invoke("generate-runden-preise", rundeId, zielsumme),

  // Excel-Upload
  readExcelColumns: (fileData) =>
    ipcRenderer.invoke("read-excel-columns", fileData),
  uploadExcel: (fileData, columnMapping) =>
    ipcRenderer.invoke("upload-excel", fileData, columnMapping),
  saveTempFile: (fileData, fileName) =>
    ipcRenderer.invoke("save-temp-file", fileData, fileName),

  // PDF-Export
  exportRundeToPDF: (rundeId) =>
    ipcRenderer.invoke("export-runde-to-pdf", rundeId),
  exportPreisblattPDF: (rundeId) =>
    ipcRenderer.invoke("export-preisblatt-pdf", rundeId),
  exportUebersichtPDF: (rundeId) =>
    ipcRenderer.invoke("export-uebersicht-pdf", rundeId),
  exportLottoPDF: (lottoId) =>
    ipcRenderer.invoke("export-lotto-pdf", lottoId),
  getPreisHistorie: (lottoId) =>
    ipcRenderer.invoke("get-preis-historie", lottoId),
  getVerbrauchtePreise: (lottoId) =>
    ipcRenderer.invoke("get-verbrauchte-preise", lottoId),
  openPdf: (pdfPath) =>
    ipcRenderer.invoke("open-pdf", pdfPath),
  openPdfFolder: () =>
    ipcRenderer.invoke("open-pdf-folder"),

  // JSON Export / Import
  exportAllData: () =>
    ipcRenderer.invoke("export-all-data"),
  importAllData: () =>
    ipcRenderer.invoke("import-all-data"),
});
