// Zentraler Service fuer Rundenwerte-Dialog (Einnahmen/Ausgaben/Betrag).
(function registerRundeDetailsService() {
  function setDraftFromCurrentRound(app) {
    if (!app.aktuelleRunde) {
      app.rundeDraftEinnahmen = "";
      app.rundeDraftAusgaben = "";
      app.rundeDraftPriceAmount = "";
      app.rundeDraftAdditionalTitleText = "";
      app.rundeDraftKategorien = [];
      return;
    }

    app.rundeDraftEinnahmen = app.aktuelleRunde.einnahmen ?? 0;
    app.rundeDraftAusgaben = app.aktuelleRunde.ausgaben ?? 0;
    app.rundeDraftPriceAmount = app.aktuelleRunde.price_amount ?? 0;
    app.rundeDraftAdditionalTitleText = app.aktuelleRunde.additional_title_text ?? "";
    app.rundeDraftKategorien = (app.aktuelleRunde.kategorien || []).map((kat) => {
      const fallback = Math.max(0, parseInt(kat.anzahl) || 0);
      const min = Math.max(0, parseInt(kat.anzahl_min) || fallback);
      const max = Math.max(min, parseInt(kat.anzahl_max) || min);
      return {
        kategorieId: kat.kategorie_id,
        kategorieName: kat.kategorie_name || "Kategorie",
        anzahlMin: min,
        anzahlMax: max,
      };
    });
  }

  function syncDraftInputs() {}

  function initDraft(app) {
    setDraftFromCurrentRound(app);
  }

  function pullDraftFromInputs() {}

  async function saveFromDraft(app) {
    if (!app.aktuelleRunde) return;
    try {
      const draftKategorienSnapshot = (app.rundeDraftKategorien || []).map((kat) => ({
        kategorieId: kat.kategorieId,
        anzahlMin: kat.anzahlMin,
        anzahlMax: kat.anzahlMax,
      }));
      app.aktuelleRunde.einnahmen = app.rundeDraftEinnahmen;
      app.aktuelleRunde.ausgaben = app.rundeDraftAusgaben;
      app.aktuelleRunde.price_amount = app.rundeDraftPriceAmount;
      app.aktuelleRunde.additional_title_text = app.rundeDraftAdditionalTitleText;
      await app.saveRundeDetails();

      for (const kat of draftKategorienSnapshot) {
        const min = Math.max(0, parseInt(kat.anzahlMin) || 0);
        const max = Math.max(min, parseInt(kat.anzahlMax) || min);

        if (typeof window.electronAPI.updateRundenKategorieRange === "function") {
          await window.electronAPI.updateRundenKategorieRange(
            app.aktuelleRunde.id,
            kat.kategorieId,
            min,
            max
          );
        } else {
          // Fallback fuer alte Main/Preload-Versionen: zumindest Mindestanzahl setzen.
          await window.electronAPI.updateRundenKategorie(
            app.aktuelleRunde.id,
            kat.kategorieId,
            min
          );
        }
      }

      // Harte Synchronisierung aus der DB, damit der Editor sofort den echten Stand zeigt.
      await app.loadRundeEditorData();
      app.showRundeDetailsModal = false;
    } catch (error) {
      console.error("Fehler beim Speichern der Rundenwerte/Ranges:", error);
      const msg = "Speichern fehlgeschlagen: " + (error && error.message ? error.message : String(error));
      if (typeof app.showStatusMessage === "function") {
        app.showStatusMessage(msg, "error", 5200);
      } else {
        alert(msg);
      }
    }
  }

  function openModal(app) {
    app.showRundeDetailsModal = true;
    initDraft(app);
  }

  function closeModal(app) {
    app.showRundeDetailsModal = false;
  }

  function getEinnahmenDisplay(app) {
    if (!app.aktuelleRunde) return 0;
    return app.parseOptionalNumber(app.aktuelleRunde.einnahmen);
  }

  window.pmRundeDetailsService = {
    initDraft,
    syncDraftInputs,
    pullDraftFromInputs,
    saveFromDraft,
    openModal,
    closeModal,
    getEinnahmenDisplay,
  };
})();
