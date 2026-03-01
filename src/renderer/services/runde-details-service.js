// Zentraler Service fuer Rundenwerte-Dialog (Einnahmen/Ausgaben/Betrag).
(function registerRundeDetailsService() {
  function setDraftFromCurrentRound(app) {
    if (!app.aktuelleRunde) {
      app.rundeDraftEinnahmen = "";
      app.rundeDraftAusgaben = "";
      app.rundeDraftPriceAmount = "";
      return;
    }

    app.rundeDraftEinnahmen = app.aktuelleRunde.einnahmen ?? 0;
    app.rundeDraftAusgaben = app.aktuelleRunde.ausgaben ?? 0;
    app.rundeDraftPriceAmount = app.aktuelleRunde.price_amount ?? 0;
  }

  function syncDraftInputs(app) {
    if (app.$refs && app.$refs.rundeDraftEinnahmenInput) {
      app.$refs.rundeDraftEinnahmenInput.value = app.rundeDraftEinnahmen ?? "";
    }
    if (app.$refs && app.$refs.rundeDraftAusgabenInput) {
      app.$refs.rundeDraftAusgabenInput.value = app.rundeDraftAusgaben ?? "";
    }
    if (app.$refs && app.$refs.rundeDraftPriceAmountInput) {
      app.$refs.rundeDraftPriceAmountInput.value = app.rundeDraftPriceAmount ?? "";
    }
  }

  function initDraft(app) {
    setDraftFromCurrentRound(app);
    app.$nextTick(() => syncDraftInputs(app));
  }

  function pullDraftFromInputs(app) {
    if (app.$refs && app.$refs.rundeDraftEinnahmenInput) {
      app.rundeDraftEinnahmen = app.$refs.rundeDraftEinnahmenInput.value;
    }
    if (app.$refs && app.$refs.rundeDraftAusgabenInput) {
      app.rundeDraftAusgaben = app.$refs.rundeDraftAusgabenInput.value;
    }
    if (app.$refs && app.$refs.rundeDraftPriceAmountInput) {
      app.rundeDraftPriceAmount = app.$refs.rundeDraftPriceAmountInput.value;
    }
  }

  async function saveFromDraft(app) {
    if (!app.aktuelleRunde) return;
    pullDraftFromInputs(app);
    app.aktuelleRunde.einnahmen = app.rundeDraftEinnahmen;
    app.aktuelleRunde.ausgaben = app.rundeDraftAusgaben;
    app.aktuelleRunde.price_amount = app.rundeDraftPriceAmount;
    await app.saveRundeDetails();
    app.showRundeDetailsModal = false;
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
