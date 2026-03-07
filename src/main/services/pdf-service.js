import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import {
  getRundeById,
  getRundenPreise,
  getRundenByLottoDay,
  getLottoById,
  getLottoDays,
  getAllKonfigurationen,
  getKonfigurationRunden,
} from "../db.js";

function getChromePathCandidates() {
  const localAppData = process.env.LOCALAPPDATA || "";
  const programFiles = process.env.ProgramFiles || "C:\\Program Files";
  const programFilesX86 =
    process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";

  return [
    path.join(localAppData, "Google", "Chrome", "Application", "chrome.exe"),
    path.join(programFiles, "Google", "Chrome", "Application", "chrome.exe"),
    path.join(programFilesX86, "Google", "Chrome", "Application", "chrome.exe"),
    path.join(programFiles, "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(
      programFilesX86,
      "Microsoft",
      "Edge",
      "Application",
      "msedge.exe",
    ),
  ];
}

async function launchBrowserWithFallback() {
  const launchErrors = [];

  try {
    return await puppeteer.launch();
  } catch (error) {
    launchErrors.push(error);
  }

  try {
    return await puppeteer.launch({ channel: "chrome" });
  } catch (error) {
    launchErrors.push(error);
  }

  for (const executablePath of getChromePathCandidates()) {
    try {
      if (!executablePath || !fs.existsSync(executablePath)) continue;
      return await puppeteer.launch({ executablePath });
    } catch (error) {
      launchErrors.push(error);
    }
  }

  const lastError = launchErrors[launchErrors.length - 1];
  throw new Error(
    `Kein Chromium/Chrome gefunden. Letzter Fehler: ${
      lastError?.message || "Unbekannter Fehler"
    }`,
  );
}

export function createPdfService({ app, dialog, shell, getMainWindow }) {
  let lastPdfExportFolder = null;

  async function resolveKonfigNameForPreisblatt(runde, rundenMitPreisen) {
    const konfigurationen = await getAllKonfigurationen();
    if (!konfigurationen || konfigurationen.length === 0) {
      return runde?.titel || "Configurationstitel";
    }

    const byName = new Map(
      konfigurationen.map((cfg) => [
        String(cfg.name || "")
          .trim()
          .toLowerCase(),
        cfg.name,
      ]),
    );
    const rundenTitel = String(runde?.titel || "").trim();
    if (rundenTitel && byName.has(rundenTitel.toLowerCase())) {
      return byName.get(rundenTitel.toLowerCase());
    }

    const usedRoundTitles = new Set();
    for (const r of rundenMitPreisen || []) {
      for (const p of r.preise || []) {
        const title = String(p.runden_titel || "").trim();
        if (title) usedRoundTitles.add(title);
      }
    }
    if (usedRoundTitles.size === 0) {
      return rundenTitel || "Configurationstitel";
    }

    const usedTitles = Array.from(usedRoundTitles);
    let bestMatch = null;
    let bestScore = -1;
    let bestIsComplete = false;

    for (const cfg of konfigurationen) {
      const cfgRunden = await getKonfigurationRunden(cfg.id);
      const cfgTitles = new Set(
        (cfgRunden || [])
          .map((row) => String(row.titel || "").trim())
          .filter(Boolean),
      );
      if (cfgTitles.size === 0) continue;

      let score = 0;
      for (const t of usedTitles) {
        if (cfgTitles.has(t)) score += 1;
      }
      const isComplete = score === usedTitles.length;

      if (
        (isComplete && !bestIsComplete) ||
        (isComplete === bestIsComplete && score > bestScore)
      ) {
        bestMatch = cfg.name;
        bestScore = score;
        bestIsComplete = isComplete;
      }
    }

    return bestMatch || rundenTitel || "Configurationstitel";
  }

  function getPdfFolder() {
    const pdfDir = path.join(app.getPath("userData"), "pdfs");
    if (!fs.existsSync(pdfDir)) {
      fs.mkdirSync(pdfDir, { recursive: true });
    }
    return pdfDir;
  }

  async function selectPdfExportFolder(title) {
    const defaultPath = lastPdfExportFolder || app.getPath("documents");
    const { filePaths, canceled } = await dialog.showOpenDialog(
      getMainWindow(),
      {
        title,
        defaultPath,
        properties: ["openDirectory", "createDirectory"],
      },
    );

    if (canceled || !filePaths || filePaths.length === 0) {
      return null;
    }

    lastPdfExportFolder = filePaths[0];
    return filePaths[0];
  }

  async function renderPdf({ html, pdfPath }) {
    const browser = await launchBrowserWithFallback();
    try {
      const page = await browser.newPage();
      await page.setContent(html);
      await page.pdf({ path: pdfPath, format: "A4", printBackground: true });
    } finally {
      await browser.close();
    }
  }

  async function exportRundeToPDF(rundeId) {
    const runde = await getRundeById(rundeId);
    const rundenPreise = await getRundenPreise(rundeId);

    if (!runde) {
      return { success: false, message: "Runde nicht gefunden" };
    }

    const html = generateRundeHTML(runde, rundenPreise);
    const pdfDir = getPdfFolder();
    const pdfPath = path.join(pdfDir, `runde_${runde.rundennummer}.pdf`);
    await renderPdf({ html, pdfPath });
    return { success: true, path: pdfPath };
  }

  async function exportPreisblattPDF(rundeId) {
    const runde = await getRundeById(rundeId);

    if (!runde) {
      return { success: false, message: "Runde nicht gefunden" };
    }

    const pdfDir = await selectPdfExportFolder(
      "Zielordner für Preisblatt wählen",
    );
    if (!pdfDir) {
      return { success: false, message: "Export abgebrochen" };
    }

    const preise = await getRundenPreise(runde.id);
    const sortedPreise = [...preise].sort((a, b) => {
      const roundSortDiff =
        (parseInt(a.runden_sort_order) || 0) -
        (parseInt(b.runden_sort_order) || 0);
      if (roundSortDiff !== 0) return roundSortDiff;
      const roundTitleDiff = String(a.runden_titel || "").localeCompare(
        String(b.runden_titel || ""),
        "de",
      );
      if (roundTitleDiff !== 0) return roundTitleDiff;
      const catDiff = String(a.kategorie_name || "").localeCompare(
        String(b.kategorie_name || ""),
        "de",
      );
      if (catDiff !== 0) return catDiff;
      const preisDiff = (a.preis || 0) - (b.preis || 0);
      if (preisDiff !== 0) return preisDiff;
      return String(a.name || "").localeCompare(String(b.name || ""), "de");
    });
    const rundenMitPreisen = [{ ...runde, preise: sortedPreise }];

    const konfigName = await resolveKonfigNameForPreisblatt(
      runde,
      rundenMitPreisen,
    );
    const html = generatePreisblattHTML(runde, rundenMitPreisen, konfigName);
    const datumFormatted = formatDateDDMMYYYY(runde.datum);
    const pdfPath = path.join(
      pdfDir,
      `${datumFormatted}-Gang-${runde.rundennummer}-Preisblatt.pdf`,
    );
    await renderPdf({ html, pdfPath });
    return { success: true, path: pdfPath };
  }

  async function exportUebersichtPDF(rundeId) {
    const runde = await getRundeById(rundeId);
    const rundenPreise = await getRundenPreise(rundeId);

    if (!runde) {
      return { success: false, message: "Runde nicht gefunden" };
    }

    const pdfDir = await selectPdfExportFolder(
      "Zielordner für Übersicht wählen",
    );
    if (!pdfDir) {
      return { success: false, message: "Export abgebrochen" };
    }

    const sorted = [...rundenPreise].sort((a, b) => a.preis - b.preis);
    const html = generateUebersichtHTML(runde, sorted);
    const pdfPath = path.join(
      pdfDir,
      `uebersicht_runde_${runde.rundennummer}.pdf`,
    );
    await renderPdf({ html, pdfPath });
    return { success: true, path: pdfPath };
  }

  async function exportLottoPDF(lottoId) {
    const lotto = await getLottoById(lottoId);
    if (!lotto) return { success: false, message: "Lotto nicht gefunden" };

    const days = await getLottoDays(lottoId);
    const allRunden = [];
    for (const day of days) {
      const runden = await getRundenByLottoDay(day.id);
      for (const r of runden) {
        const preise = await getRundenPreise(r.id);
        const preissumme = preise.reduce(
          (sum, p) => sum + p.preis * (p.rp_anzahl || 1),
          0,
        );
        allRunden.push({
          ...r,
          day_date: day.date,
          day_number: day.day_number,
          preissumme,
          preisCount: preise.length,
        });
      }
    }

    const html = generateLottoHTML(lotto, days, allRunden);
    const pdfDir = getPdfFolder();
    const pdfPath = path.join(
      pdfDir,
      `lotto_${lotto.name.replace(/[^a-zA-Z0-9äöüÄÖÜ]/g, "_")}.pdf`,
    );
    await renderPdf({ html, pdfPath });
    return { success: true, path: pdfPath };
  }

  async function openPdf(pdfPath) {
    await shell.openPath(pdfPath);
    return { success: true };
  }

  async function openPdfFolder() {
    const pdfDir = lastPdfExportFolder || getPdfFolder();
    await shell.openPath(pdfDir);
    return { success: true };
  }

  return {
    exportRundeToPDF,
    exportPreisblattPDF,
    exportUebersichtPDF,
    exportLottoPDF,
    openPdf,
    openPdfFolder,
  };
}

function generateRundeHTML(runde, rundenPreise) {
  const preissumme = rundenPreise.reduce(
    (sum, item) => sum + item.preis * (item.rp_anzahl || 1),
    0,
  );

  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Runde ${runde.rundennummer}</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .header h1 { color: #2563eb; margin-bottom: 10px; }
            .info { margin-bottom: 20px; }
            .info p { margin: 5px 0; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f3f4f6; }
            .total { font-weight: bold; font-size: 18px; text-align: right; margin-top: 20px; }
            .category { background-color: #f9fafb; font-weight: bold; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>Preis-Runde ${runde.rundennummer}</h1>
            <p>Datum: ${runde.datum}</p>
            <p>Eingesetzter Betrag: ${formatCurrency(runde.price_amount || runde.ausgaben || 0)}</p>
        </div>
        
        <table>
            <thead>
                <tr>
                    <th>Kategorie</th>
                    <th>Name</th>
                    <th>Herkunft</th>
                    <th>Preis (CHF)</th>
                </tr>
            </thead>
            <tbody>
                ${rundenPreise
                  .map(
                    (item) => `
                    <tr>
                        <td class="category">${item.kategorie_name}</td>
                        <td>${item.name}${(item.rp_anzahl || 1) > 1 ? ' <span style="color:#6b7280">(×' + item.rp_anzahl + ")</span>" : ""}</td>
                        <td>${item.herkunft || "—"}</td>
                        <td>${formatCurrency(item.preis * (item.rp_anzahl || 1))}</td>
                    </tr>
                `,
                  )
                  .join("")}
            </tbody>
        </table>
        
        <div class="total">
            Summe: ${formatCurrency(preissumme)}
        </div>
    </body>
    </html>
  `;
}

function generatePreisblattHTML(runde, rundenMitPreisen, konfigName = null) {
  const configTitel =
    (konfigName && String(konfigName).trim()) ||
    (rundenMitPreisen || [])
      .map((item) => (item?.titel ? String(item.titel).trim() : ""))
      .find(Boolean) ||
    "Configurationstitel";

  const roundGroups = new Map();
  for (const r of rundenMitPreisen) {
    for (const p of r.preise) {
      const roundTitle = p.runden_titel || "Ohne Rundentitel";
      if (!roundGroups.has(roundTitle)) {
        roundGroups.set(roundTitle, {
          sortOrder: Number.isFinite(parseInt(p.runden_sort_order))
            ? parseInt(p.runden_sort_order)
            : Number.MAX_SAFE_INTEGER,
          items: [],
        });
      }
      const group = roundGroups.get(roundTitle);
      if (Number.isFinite(parseInt(p.runden_sort_order))) {
        group.sortOrder = Math.min(
          group.sortOrder,
          parseInt(p.runden_sort_order),
        );
      }
      group.items.push(p);
    }
  }

  const sortedRoundEntries = Array.from(roundGroups.entries()).sort((a, b) => {
    const bySort = (a[1].sortOrder || 0) - (b[1].sortOrder || 0);
    if (bySort !== 0) return bySort;
    return String(a[0]).localeCompare(String(b[0]), "de");
  });

  let tableRows = "";
  for (const [roundTitle, group] of sortedRoundEntries) {
    const sortedItems = [...group.items].sort((a, b) => {
      const preisDiff = (a.preis || 0) - (b.preis || 0);
      if (preisDiff !== 0) return preisDiff;
      return String(a.name || "").localeCompare(String(b.name || ""), "de");
    });

    tableRows += `<tr class="round-title-row"><td>${roundTitle}</td></tr>`;
    for (const item of sortedItems) {
      const preisName = `${item.rp_anzahl || 1} x ${item.name}`;
      tableRows += `<tr><td>${preisName}</td></tr>`;
    }
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${formatDateDDMMYYYY(runde.datum)}-Gang-${runde.rundennummer}-Preisblatt</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 30px; color: #333; }
        h1 { color: #2563eb; text-align: center; margin-bottom: 5px; font-size: 22px; }
        .subtitle { text-align: center; color: #666; margin-bottom: 25px; font-size: 14px; }
        .gang-label { font-size: 14px; font-weight: 600; color: #1f2937; margin-bottom: 8px; }
        table { width: 100%; border-collapse: collapse; }
        th { background-color: #2563eb; color: white; padding: 10px 12px; text-align: left; font-size: 13px; }
        .header-cell { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
        .header-right { text-align: right; opacity: 0.95; font-weight: 600; }
        td { padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px; }
        tr:nth-child(even) { background-color: #f9fafb; }
        .round-title-row td { background-color: #eff6ff; font-weight: bold; color: #1e40af; padding: 9px 12px; font-size: 13px; border-top: 2px solid #bfdbfe; }
        th:last-child, td:last-child { width: 150px; text-align: left; }
      </style>
    </head>
    <body>
      <div class="gang-label">Gang ${runde.rundennummer} — ${formatDateDDMMYYYY(runde.datum)}</div>
      <table>
        <thead>
          <tr>
            <th>
              <div class="header-cell">
                <span>${configTitel} - Preise</span>
                <span class="header-right">${String(runde.additional_title_text || "").trim() || ""}</span>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    </body>
    </html>
  `;
}

function generateUebersichtHTML(runde, preise) {
  const preissumme = preise.reduce(
    (sum, p) => sum + p.preis * (p.rp_anzahl || 1),
    0,
  );
  const geldeinsatz = runde.price_amount || runde.ausgaben || 0;

  let rows = "";
  let nr = 1;
  for (const p of preise) {
    rows += `
      <tr>
        <td class="nr">${nr++}</td>
        <td>${p.name}${(p.rp_anzahl || 1) > 1 ? ' <span style="color:#6b7280">(×' + p.rp_anzahl + ")</span>" : ""}</td>
        <td style="text-align: center">${p.is_a_spende ? "Ja" : ""}</td>
        <td class="price">${formatCurrency(p.preis * (p.rp_anzahl || 1))}</td>
      </tr>`;
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Übersicht Runde ${runde.rundennummer}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 30px; color: #333; }
        h1 { color: #2563eb; text-align: center; margin-bottom: 5px; font-size: 22px; }
        .subtitle { text-align: center; color: #666; margin-bottom: 25px; font-size: 14px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
        th { background-color: #2563eb; color: white; padding: 10px 12px; text-align: left; font-size: 13px; }
        td { padding: 7px 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px; }
        tr:nth-child(even) { background-color: #f9fafb; }
        .nr { width: 40px; color: #9ca3af; text-align: center; }
        .price { text-align: right; font-weight: 600; }
        th:last-child { text-align: right; }
        th:first-child { text-align: center; width: 40px; }
        .summary { margin-top: 10px; border-top: 3px solid #2563eb; padding-top: 15px; }
        .summary-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 16px; }
        .summary-row.total { font-weight: bold; font-size: 20px; color: #059669; border-top: 1px solid #e5e7eb; padding-top: 12px; margin-top: 5px; }
        .summary-row.einsatz { color: #2563eb; font-weight: 600; }
        .summary-row .label { color: #6b7280; }
        .summary-row.einsatz .label { color: #2563eb; }
        .summary-row.total .label { color: #059669; }
      </style>
    </head>
    <body>
      <h1>Übersicht — Runde ${runde.rundennummer}</h1>
      <div class="subtitle">Datum: ${runde.datum} | ${preise.length} Preise</div>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Preis</th>
            <th style="text-align: center">Spende</th>
            <th style="text-align: right">Wert (CHF)</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>

      <div class="summary">
        <div class="summary-row total">
          <span class="label">Gesamtpreis</span>
          <span>${formatCurrency(preissumme)}</span>
        </div>
        <div class="summary-row einsatz">
          <span class="label">Einnahmen</span>
          <span>${formatCurrency(runde.einnahmen || 0)}</span>
        </div>
        <div class="summary-row einsatz" style="color:#059669">
          <span class="label" style="color:#059669">Geldeinsatz</span>
          <span>${formatCurrency(geldeinsatz)}</span>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateLottoHTML(lotto, days, allRunden) {
  const totalEinnahmen = allRunden.reduce((s, r) => s + (r.einnahmen || 0), 0);
  const totalAusgaben = allRunden.reduce((s, r) => s + (r.ausgaben || 0), 0);
  const totalPreissumme = allRunden.reduce(
    (s, r) => s + (r.preissumme || 0),
    0,
  );
  const totalPriceAmount = allRunden.reduce(
    (s, r) => s + (r.price_amount || 0),
    0,
  );
  const totalGastro = days.reduce((s, d) => s + (d.gastro_revenue || 0), 0);
  const totalSpenden = days.reduce((s, d) => s + (d.donations || 0), 0);

  const rundenByDay = {};
  for (const r of allRunden) {
    const key = r.day_number;
    if (!rundenByDay[key]) rundenByDay[key] = [];
    rundenByDay[key].push(r);
  }

  let bodyContent = "";
  for (const day of days) {
    const dayRunden = rundenByDay[day.day_number] || [];
    const dayEinnahmen = dayRunden.reduce((s, r) => s + (r.einnahmen || 0), 0);
    const dayAusgaben = dayRunden.reduce((s, r) => s + (r.ausgaben || 0), 0);
    const dayPreissumme = dayRunden.reduce(
      (s, r) => s + (r.preissumme || 0),
      0,
    );
    const dayGastro = day.gastro_revenue || 0;
    const daySpenden = day.donations || 0;

    bodyContent += `
      <div class="day-section">
        <div class="day-header">Tag ${day.day_number} — ${day.date}${dayGastro || daySpenden ? ` <span style="font-weight:normal; font-size:12px; opacity:0.85">(Gastro: ${formatCurrency(dayGastro)} | Spenden: ${formatCurrency(daySpenden)})</span>` : ""}</div>
        <table>
          <thead>
            <tr>
              <th>Runde</th>
              <th style="text-align:right">Einnahmen</th>
              <th style="text-align:right">Ausgaben</th>
              <th style="text-align:right">Geldeinsatz</th>
              <th style="text-align:right">Preissumme</th>
              <th style="text-align:center">Preise</th>
            </tr>
          </thead>
          <tbody>
            ${dayRunden
              .map(
                (r) => `
              <tr>
                <td>Runde ${r.rundennummer}</td>
                <td style="text-align:right">${formatCurrency(r.einnahmen || 0)}</td>
                <td style="text-align:right">${formatCurrency(r.ausgaben || 0)}</td>
                <td style="text-align:right">${formatCurrency(r.price_amount || 0)}</td>
                <td style="text-align:right;font-weight:600">${formatCurrency(r.preissumme || 0)}</td>
                <td style="text-align:center">${r.preisCount}</td>
              </tr>
            `,
              )
              .join("")}
          </tbody>
          <tfoot>
            <tr class="day-total">
              <td><strong>Tag-Total</strong></td>
              <td style="text-align:right"><strong>${formatCurrency(dayEinnahmen + dayGastro + daySpenden)}</strong></td>
              <td style="text-align:right"><strong>${formatCurrency(dayAusgaben)}</strong></td>
              <td style="text-align:right"><strong></strong></td>
              <td style="text-align:right"><strong>${formatCurrency(dayPreissumme)}</strong></td>
              <td style="text-align:center"><strong>${dayRunden.length}</strong></td>
            </tr>
          </tfoot>
        </table>
      </div>`;
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Lotto Übersicht — ${lotto.name}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 30px; color: #333; }
        h1 { color: #2563eb; text-align: center; margin-bottom: 5px; font-size: 24px; }
        .subtitle { text-align: center; color: #666; margin-bottom: 10px; font-size: 14px; }
        .meta { display: flex; justify-content: center; gap: 30px; margin-bottom: 25px; font-size: 13px; color: #555; }
        .meta span { background: #f3f4f6; padding: 4px 12px; border-radius: 6px; }
        .day-section { margin-bottom: 25px; }
        .day-header { background: #2563eb; color: white; padding: 8px 14px; border-radius: 6px 6px 0 0; font-weight: bold; font-size: 14px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 0; }
        th { background-color: #eff6ff; color: #1e40af; padding: 8px 12px; text-align: left; font-size: 12px; border-bottom: 2px solid #bfdbfe; }
        td { padding: 7px 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px; }
        tr:nth-child(even) { background-color: #f9fafb; }
        .day-total td { background-color: #eff6ff; border-top: 2px solid #bfdbfe; }
        .grand-total { margin-top: 20px; border-top: 3px solid #2563eb; padding-top: 15px; }
        .total-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 16px; }
        .total-row.main { font-weight: bold; font-size: 20px; color: #2563eb; border-top: 1px solid #e5e7eb; padding-top: 12px; margin-top: 5px; }
        .total-row .label { color: #6b7280; }
        .total-row.main .label { color: #2563eb; }
        .profit { color: #059669; }
        .loss { color: #dc2626; }
      </style>
    </head>
    <body>
      <h1>${lotto.name}</h1>
      <div class="subtitle">${lotto.date_from} — ${lotto.date_to}</div>
      <div class="meta">
        <span>Tage: ${days.length}</span>
        <span>Runden: ${allRunden.length}</span>
        <span>Gastro: ${formatCurrency(totalGastro)}</span>
        <span>Spenden: ${formatCurrency(totalSpenden)}</span>
      </div>

      ${bodyContent}

      <div class="grand-total">
        <div class="total-row">
          <span class="label">Runden-Einnahmen</span>
          <span>${formatCurrency(totalEinnahmen)}</span>
        </div>
        <div class="total-row">
          <span class="label">Gastro Einnahmen</span>
          <span>${formatCurrency(totalGastro)}</span>
        </div>
        <div class="total-row">
          <span class="label">Spenden</span>
          <span>${formatCurrency(totalSpenden)}</span>
        </div>
        <div class="total-row" style="font-weight:bold; border-top:1px solid #e5e7eb; padding-top:8px;">
          <span class="label" style="font-weight:bold">Einnahmen Gesamt</span>
          <span>${formatCurrency(totalEinnahmen + totalGastro + totalSpenden)}</span>
        </div>
        <div class="total-row">
          <span class="label">Ausgaben Total</span>
          <span>${formatCurrency(totalAusgaben)}</span>
        </div>
        <div class="total-row">
          <span class="label">Geldeinsatz Total</span>
          <span>${formatCurrency(totalPriceAmount)}</span>
        </div>
        <div class="total-row">
          <span class="label">Preissumme Total</span>
          <span>${formatCurrency(totalPreissumme)}</span>
        </div>
        <div class="total-row main">
          <span class="label">Gewinn / Verlust</span>
          <span class="${totalEinnahmen + totalGastro + totalSpenden - totalAusgaben >= 0 ? "profit" : "loss"}">${formatCurrency(totalEinnahmen + totalGastro + totalSpenden - totalAusgaben)}</span>
        </div>
      </div>
    </body>
    </html>
  `;
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("de-CH", {
    style: "currency",
    currency: "CHF",
  }).format(amount);
}

function formatDateDDMMYYYY(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr || "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${d.getFullYear()}`;
}
