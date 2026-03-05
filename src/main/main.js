import { app, BrowserWindow, ipcMain, dialog, shell } from "electron";
import fs from "fs";
import path from "path";
import os from "os";
import {
  initDatabase,
  closeDatabase,
  addPreis,
  getAllPreise,
  updatePreis,
  deletePreis,
  addKategorie,
  getAllKategorien,
  updateKategorie,
  deleteKategorie,
  createLotto,
  updateLotto,
  addLottoDay,
  updateLottoDay,
  deleteLottoDay,
  getAllLottos,
  getLottoById,
  getLottoDays,
  getRundenByLotto,
  getRundenByLottoDay,
  getRundenByLottoDayNumber,
  createKonfiguration,
  getAllKonfigurationen,
  getKonfigurationById,
  getKonfigurationKategorien,
  addKategorieZuKonfiguration,
  updateKonfiguration,
  removeKategorieVonKonfiguration,
  updateKonfigurationKategorie,
  getKonfigurationRunden,
  addKonfigurationRunde,
  updateKonfigurationRunde,
  deleteKonfigurationRunde,
  getKonfigurationRundenPreise,
  getKonfigurationRundenKategorien,
  addKategorieZuKonfigurationRunde,
  updateKonfigurationRundeKategorie,
  removeKategorieVonKonfigurationRunde,
  addPreisZuKonfigurationRunde,
  updateKonfigurationRundePreis,
  removePreisVonKonfigurationRunde,
  deleteKonfiguration,
  createRunde,
  getAllRunden,
  getRundeById,
  deleteRunde,
  getRundenKategorien,
  addPreisZuRunde,
  removePreisVonRunde,
  removePreisVonRundeById,
  updateRundenKategorie,
  updateRundenKategorieRange,
  updateRundenPreisAnzahl,
  updateRunde,
  clearRundenPreise,
  getRundenPreise,
  getNextRundennummer,
  getPreiseByKategorie,
  generateRundenPreise,
  getPreisHistorie,
  getVerbrauchtePreise,
  exportAllData,
  importAllData,
} from "./db.js";
import { fileURLToPath } from "url";
import XLSX from "xlsx";
import { createPdfService } from "./services/pdf-service.js";

// ES-Module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appIconPath = path.join(__dirname, "..", "renderer", "assets", "comic-pokal-app.png");

let mainWindow;
const pdfService = createPdfService({
  app,
  dialog,
  shell,
  getMainWindow: () => mainWindow,
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: appIconPath,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  mainWindow.loadFile("src/renderer/index.html");
  mainWindow.maximize();

  // Entwicklertools nur im Dev-Modus öffnen
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(async () => {
  try {
    if (process.platform === "win32") {
      app.setAppUserModelId("com.preis-runden.app");
    }
    console.log("App wird gestartet...");
    
    // Datenbank initialisieren
    console.log("Initialisiere Datenbank...");
    await initDatabase();
    console.log("Datenbank erfolgreich initialisiert");

    console.log("Erstelle Fenster...");
    createWindow();
    console.log("Fenster erfolgreich erstellt");

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  } catch (error) {
    console.error("KRITISCHER FEHLER beim Starten der Anwendung:", error);
    console.error("Stack Trace:", error.stack);
    
    // Fehlerdialog anzeigen
    dialog.showErrorBox("Kritischer Fehler", 
      `Fehler beim Starten der Anwendung:\n\n${error.message}\n\nStack Trace:\n${error.stack}`);
  }
});

app.on("window-all-closed", async () => {
  if (process.platform !== "darwin") {
    await closeDatabase();
    app.quit();
  }
});

app.on("before-quit", async () => {
  await closeDatabase();
});

// IPC-Handler für Datenbankoperationen
ipcMain.handle("add-preis", async (event, name, herkunft, anzahl, preis, isASpend = false) => {
  try {
    console.log("IPC: Empfange add-preis:", { name, herkunft, anzahl, preis, isASpend });
    const result = await addPreis(name, herkunft, anzahl, preis, isASpend);
    console.log("IPC: Preis erfolgreich hinzugefügt:", result);
    return result;
  } catch (error) {
    console.error("IPC: Fehler beim Hinzufügen des Preises:", error);
    throw error;
  }
});

ipcMain.handle("get-all-preise", async () => {
  return await getAllPreise();
});

ipcMain.handle(
  "update-preis",
  async (event, id, name, herkunft, anzahl, preis, isASpend = false) => {
    return await updatePreis(id, name, herkunft, anzahl, preis, isASpend);
  }
);

ipcMain.handle("delete-preis", async (event, id) => {
  return await deletePreis(id);
});

ipcMain.handle("add-kategorie", async (event, name, typ, wert1, wert2) => {
  return await addKategorie(name, typ, wert1, wert2);
});

ipcMain.handle("get-all-kategorien", async () => {
  return await getAllKategorien();
});

ipcMain.handle(
  "update-kategorie",
  async (event, id, name, typ, wert1, wert2) => {
    return await updateKategorie(id, name, typ, wert1, wert2);
  }
);

ipcMain.handle("delete-kategorie", async (event, id) => {
  return await deleteKategorie(id);
});

// Lotto-Handler
ipcMain.handle("create-lotto", async (event, name, dateFrom, dateTo, gastroRevenue, donations) => {
  return await createLotto(name, dateFrom, dateTo, gastroRevenue, donations);
});

ipcMain.handle("update-lotto", async (event, id, name, dateFrom, dateTo, gastroRevenue, donations) => {
  return await updateLotto(id, name, dateFrom, dateTo, gastroRevenue, donations);
});

ipcMain.handle("add-lotto-day", async (event, lottoId, date) => {
  return await addLottoDay(lottoId, date);
});

ipcMain.handle("update-lotto-day", async (event, dayId, gastroRevenue, donations) => {
  return await updateLottoDay(dayId, gastroRevenue, donations);
});

ipcMain.handle("delete-lotto-day", async (event, lottoId, dayNumber) => {
  return await deleteLottoDay(lottoId, dayNumber);
});

ipcMain.handle("get-lotto-days", async (event, lottoId) => {
  return await getLottoDays(lottoId);
});

ipcMain.handle("get-runden-by-lotto-day", async (event, lottoDayId) => {
  return await getRundenByLottoDay(lottoDayId);
});

ipcMain.handle("get-runden-by-lotto-day-number", async (event, lottoId, dayNumber) => {
  return await getRundenByLottoDayNumber(lottoId, dayNumber);
});

ipcMain.handle("get-all-lottos", async () => {
  return await getAllLottos();
});

ipcMain.handle("get-lotto-by-id", async (event, id) => {
  return await getLottoById(id);
});

ipcMain.handle("get-runden-by-lotto", async (event, lottoId) => {
  return await getRundenByLotto(lottoId);
});

// Konfigurationen-Handler
ipcMain.handle("create-konfiguration", async (event, name) => {
  return await createKonfiguration(name);
});

ipcMain.handle("get-all-konfigurationen", async () => {
  return await getAllKonfigurationen();
});

ipcMain.handle("get-konfiguration-by-id", async (event, id) => {
  return await getKonfigurationById(id);
});

ipcMain.handle("get-konfiguration-kategorien", async (event, konfigurationId) => {
  return await getKonfigurationKategorien(konfigurationId);
});

ipcMain.handle("add-kategorie-zu-konfiguration", async (event, konfigurationId, kategorieId, anzahlMin, anzahlMax) => {
  return await addKategorieZuKonfiguration(konfigurationId, kategorieId, anzahlMin, anzahlMax);
});

ipcMain.handle("update-konfiguration", async (event, id, name) => {
  return await updateKonfiguration(id, name);
});

ipcMain.handle("remove-kategorie-von-konfiguration", async (event, konfigurationId, kategorieId) => {
  return await removeKategorieVonKonfiguration(konfigurationId, kategorieId);
});

ipcMain.handle("update-konfiguration-kategorie", async (event, konfigurationId, kategorieId, anzahlMin, anzahlMax) => {
  return await updateKonfigurationKategorie(konfigurationId, kategorieId, anzahlMin, anzahlMax);
});

ipcMain.handle("delete-konfiguration", async (event, id) => {
  return await deleteKonfiguration(id);
});

ipcMain.handle("get-konfiguration-runden", async (event, konfigurationId) => {
  return await getKonfigurationRunden(konfigurationId);
});

ipcMain.handle("add-konfiguration-runde", async (event, konfigurationId, titel, sortOrder) => {
  return await addKonfigurationRunde(konfigurationId, titel, sortOrder);
});

ipcMain.handle("update-konfiguration-runde", async (event, rundeId, titel, sortOrder) => {
  return await updateKonfigurationRunde(rundeId, titel, sortOrder);
});

ipcMain.handle("delete-konfiguration-runde", async (event, rundeId) => {
  return await deleteKonfigurationRunde(rundeId);
});

ipcMain.handle("get-konfiguration-runden-preise", async (event, konfigurationRundeId) => {
  return await getKonfigurationRundenPreise(konfigurationRundeId);
});

ipcMain.handle("get-konfiguration-runden-kategorien", async (event, konfigurationRundeId) => {
  return await getKonfigurationRundenKategorien(konfigurationRundeId);
});

ipcMain.handle("add-kategorie-zu-konfiguration-runde", async (event, konfigurationRundeId, kategorieId, anzahlMin, anzahlMax) => {
  return await addKategorieZuKonfigurationRunde(konfigurationRundeId, kategorieId, anzahlMin, anzahlMax);
});

ipcMain.handle("update-konfiguration-runde-kategorie", async (event, konfigurationRundeKategorieId, anzahlMin, anzahlMax) => {
  return await updateKonfigurationRundeKategorie(konfigurationRundeKategorieId, anzahlMin, anzahlMax);
});

ipcMain.handle("remove-kategorie-von-konfiguration-runde", async (event, konfigurationRundeKategorieId) => {
  return await removeKategorieVonKonfigurationRunde(konfigurationRundeKategorieId);
});

ipcMain.handle("add-preis-zu-konfiguration-runde", async (event, konfigurationRundeId, preisId, anzahl) => {
  return await addPreisZuKonfigurationRunde(konfigurationRundeId, preisId, anzahl);
});

ipcMain.handle("update-konfiguration-runde-preis", async (event, rundenPreisId, anzahl) => {
  return await updateKonfigurationRundePreis(rundenPreisId, anzahl);
});

ipcMain.handle("remove-preis-von-konfiguration-runde", async (event, rundenPreisId) => {
  return await removePreisVonKonfigurationRunde(rundenPreisId);
});

// Runden-Handler
ipcMain.handle(
  "create-runde",
  async (event, lottoDayId, rundennummer, datum, einnahmen, ausgaben, kategorien, priceAmount, titel = null) => {
    return await createRunde(lottoDayId, rundennummer, datum, einnahmen, ausgaben, kategorien, priceAmount, titel);
  }
);

ipcMain.handle("get-all-runden", async () => {
  return await getAllRunden();
});

ipcMain.handle("get-runde-by-id", async (event, id) => {
  return await getRundeById(id);
});

ipcMain.handle("delete-runde", async (event, rundeId) => {
  return await deleteRunde(rundeId);
});

ipcMain.handle("get-runden-kategorien", async (event, rundeId) => {
  return await getRundenKategorien(rundeId);
});

ipcMain.handle(
  "add-preis-zu-runde",
  async (event, rundeId, preisId, kategorieId, rundenTitel = null, rundenSortOrder = 0) => {
    return await addPreisZuRunde(rundeId, preisId, kategorieId, rundenTitel, rundenSortOrder);
  }
);

ipcMain.handle("remove-preis-von-runde", async (event, rundeId, preisId) => {
  return await removePreisVonRunde(rundeId, preisId);
});

ipcMain.handle("remove-preis-von-runde-by-id", async (event, rundenPreisId) => {
  return await removePreisVonRundeById(rundenPreisId);
});

ipcMain.handle("update-runden-preis-anzahl", async (event, rundenPreisId, anzahl) => {
  return await updateRundenPreisAnzahl(rundenPreisId, anzahl);
});

ipcMain.handle("update-runde", async (event, id, einnahmen, ausgaben, priceAmount, additionalTitleText = undefined) => {
  return await updateRunde(id, einnahmen, ausgaben, priceAmount, additionalTitleText);
});

ipcMain.handle("update-runden-kategorie", async (event, rundeId, kategorieId, anzahl) => {
  return await updateRundenKategorie(rundeId, kategorieId, anzahl);
});

ipcMain.handle(
  "update-runden-kategorie-range",
  async (event, rundeId, kategorieId, anzahlMin, anzahlMax) => {
    return await updateRundenKategorieRange(
      rundeId,
      kategorieId,
      anzahlMin,
      anzahlMax
    );
  }
);

ipcMain.handle("clear-runden-preise", async (event, rundeId) => {
  return await clearRundenPreise(rundeId);
});

ipcMain.handle("get-runden-preise", async (event, rundeId) => {
  return await getRundenPreise(rundeId);
});

ipcMain.handle("get-next-rundennummer", async (event, lottoDayId) => {
  return await getNextRundennummer(lottoDayId);
});

ipcMain.handle("get-preise-by-kategorie", async (event, kategorieId) => {
  return await getPreiseByKategorie(kategorieId);
});

ipcMain.handle("generate-runden-preise", async (event, rundeId, zielsumme) => {
  return await generateRundenPreise(rundeId, zielsumme);
});

ipcMain.handle("get-preis-historie", async (event, lottoId) => {
  return await getPreisHistorie(lottoId);
});

ipcMain.handle("get-verbrauchte-preise", async (event, lottoId) => {
  return await getVerbrauchtePreise(lottoId);
});

// ==========================================
// JSON Export / Import
// ==========================================

ipcMain.handle("export-all-data", async () => {
  try {
    const data = await exportAllData();
    const jsonString = JSON.stringify(data, null, 2);

    const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
      title: "Daten exportieren",
      defaultPath: `preis-runden-backup_${new Date().toISOString().slice(0, 10)}.json`,
      filters: [
        { name: "JSON Dateien", extensions: ["json"] },
        { name: "Alle Dateien", extensions: ["*"] },
      ],
    });

    if (canceled || !filePath) {
      return { success: false, message: "Export abgebrochen" };
    }

    fs.writeFileSync(filePath, jsonString, "utf-8");
    return { success: true, path: filePath };
  } catch (error) {
    console.error("Export Fehler:", error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle("import-all-data", async () => {
  try {
    const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
      title: "Daten importieren",
      filters: [
        { name: "JSON Dateien", extensions: ["json"] },
        { name: "Alle Dateien", extensions: ["*"] },
      ],
      properties: ["openFile"],
    });

    if (canceled || filePaths.length === 0) {
      return { success: false, message: "Import abgebrochen" };
    }

    const jsonString = fs.readFileSync(filePaths[0], "utf-8");
    const jsonData = JSON.parse(jsonString);

    const result = await importAllData(jsonData);
    return result;
  } catch (error) {
    console.error("Import Fehler:", error);
    return { success: false, message: error.message };
  }
});

// Temporäre Datei speichern (für große Excel-Dateien)
ipcMain.handle("save-temp-file", async (event, fileData, fileName) => {
  try {
    const tempDir = os.tmpdir();
    const tempPath = path.join(tempDir, `excel_${Date.now()}_${fileName}`);
    
    // fileData ist ein Array von Zahlen aus dem Renderer
    const buffer = Buffer.from(fileData);
    fs.writeFileSync(tempPath, buffer);
    
    return tempPath;
  } catch (error) {
    console.error("Fehler beim Speichern der temporären Datei:", error);
    throw error;
  }
});

// Excel-Spalten erkennen (aus Base64 oder Dateipfad)
ipcMain.handle("read-excel-columns", async (event, fileDataOrPath) => {
  try {
    let buffer;
    
    // Prüfe ob es ein Dateipfad oder Base64-String ist
    if (typeof fileDataOrPath === 'string' && fileDataOrPath.length < 260 && !fileDataOrPath.includes(',')) {
      // Wahrscheinlich ein Dateipfad
      if (fs.existsSync(fileDataOrPath)) {
        buffer = fs.readFileSync(fileDataOrPath);
      } else {
        // Fallback: Base64
        buffer = Buffer.from(fileDataOrPath, "base64");
      }
    } else {
      // Base64 String
      buffer = Buffer.from(fileDataOrPath, "base64");
    }
    
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    // Erste Zeile als Spaltenüberschriften verwenden
    const columns = data.length > 0 ? data[0] : [];
    
    // Beispiel-Daten (erste 3 Zeilen) für Vorschau
    const preview = data.slice(1, 4).map(row => {
      const obj = {};
      columns.forEach((col, index) => {
        obj[col] = row[index] || "";
      });
      return obj;
    });

    return { 
      success: true, 
      columns: columns.filter(col => col), // Leere Spalten entfernen
      preview: preview 
    };
  } catch (error) {
    console.error("Excel-Spalten-Erkennung Fehler:", error);
    return { success: false, error: error.message };
  }
});

// Excel-Upload Handler mit Mapping (aus Base64 oder Dateipfad)
ipcMain.handle("upload-excel", async (event, fileDataOrPath, columnMapping) => {
  let tempFilePath = null;
  try {
    let buffer;
    
    // Prüfe ob es ein Dateipfad oder Base64-String ist
    if (typeof fileDataOrPath === 'string' && fileDataOrPath.length < 260 && !fileDataOrPath.includes(',')) {
      // Wahrscheinlich ein Dateipfad
      if (fs.existsSync(fileDataOrPath)) {
        buffer = fs.readFileSync(fileDataOrPath);
        tempFilePath = fileDataOrPath; // Merken für späteres Löschen
      } else {
        // Fallback: Base64
        buffer = Buffer.from(fileDataOrPath, "base64");
      }
    } else {
      // Base64 String
      buffer = Buffer.from(fileDataOrPath, "base64");
    }
    
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    const results = [];

    for (const row of data) {
      // Verwende das Mapping, um die richtigen Spalten zu finden
      const name = row[columnMapping.name] || "";
      const herkunft = row[columnMapping.herkunft] || "";
      const anzahl = parseInt(row[columnMapping.anzahl] || 1);
      const preis = parseFloat(row[columnMapping.preis] || 0);

      if (name && preis > 0) {
        const id = await addPreis(name, herkunft, anzahl, preis);
        results.push({ id, name, herkunft, anzahl, preis });
      }
    }

    // Temporäre Datei löschen falls vorhanden
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (e) {
        console.warn("Konnte temporäre Datei nicht löschen:", e);
      }
    }

    return { success: true, count: results.length, data: results };
  } catch (error) {
    // Temporäre Datei auch bei Fehler löschen
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (e) {
        console.warn("Konnte temporäre Datei nicht löschen:", e);
      }
    }
    console.error("Excel-Upload Fehler:", error);
    return { success: false, error: error.message };
  }
});

// PDF-Export Handler
ipcMain.handle("export-runde-to-pdf", async (event, rundeId) => {
  try {
    return await pdfService.exportRundeToPDF(rundeId);
  } catch (error) {
    console.error("PDF-Export Fehler:", error);
    return { success: false, message: error.message };
  }
});

// PDF direkt öffnen
ipcMain.handle("open-pdf", async (event, pdfPath) => {
  try {
    return await pdfService.openPdf(pdfPath);
  } catch (error) {
    console.error("Fehler beim Öffnen der PDF:", error);
    return { success: false, message: error.message };
  }
});

// PDF-Ordner öffnen
ipcMain.handle("open-pdf-folder", async () => {
  try {
    return await pdfService.openPdfFolder();
  } catch (error) {
    console.error("Fehler beim Öffnen des Ordners:", error);
    return { success: false, message: error.message };
  }
});

// Preisblatt-PDF: Preise mit Kategorie, sortiert billig → teuer
ipcMain.handle("export-preisblatt-pdf", async (event, rundeId) => {
  try {
    return await pdfService.exportPreisblattPDF(rundeId);
  } catch (error) {
    console.error("Preisblatt-PDF Fehler:", error);
    return { success: false, message: error.message };
  }
});

// Lotto-Übersicht-PDF: Alle Runden mit Einnahmen/Ausgaben
ipcMain.handle("export-lotto-pdf", async (event, lottoId) => {
  try {
    return await pdfService.exportLottoPDF(lottoId);
  } catch (error) {
    console.error("Lotto-PDF Fehler:", error);
    return { success: false, message: error.message };
  }
});

// Übersicht-PDF: Preise ohne Kategorie + Gesamtpreis + Geldeinsatz
ipcMain.handle("export-uebersicht-pdf", async (event, rundeId) => {
  try {
    return await pdfService.exportUebersichtPDF(rundeId);
  } catch (error) {
    console.error("Übersicht-PDF Fehler:", error);
    return { success: false, message: error.message };
  }
});
