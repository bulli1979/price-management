function preisRundenApp() {
  const loadingService = window.pmLoadingService;
  const rundeDetailsService = window.pmRundeDetailsService;

  return {
    // State
    activeTab: "preise",
    preise: [],
    kategorien: [],
    lottos: [],
    runden: [],
    konfigurationen: [],
    aktuellesLotto: null,
    aktuelleRunde: null,

    // Modals
    showAddPreisModal: false,
    showAddKategorieModal: false,
    showNeuesLottoModal: false,
    showNeueRundeModal: false,
    showKonfigurationModal: false,
    showNewKonfigModal: false,
    showEditKonfigModal: false,
    showRundeDetailsModal: false,
    showRegenerateConfirmModal: false,
    editingKonfig: { id: null, name: '' },
    editingKonfigKategorien: [],
    editingKonfigRunden: [],
    newKonfigRundeTitel: "",
    newKonfig: { name: '' },
    newKonfigKategorie: { kategorieId: null, anzahlMin: 1, anzahlMax: 10 },

    // Runde Editor
    rundeEditorMode: false,
    rundePreise: [],
    verfuegbarePreise: [],
    rundeDraftEinnahmen: "",
    rundeDraftAusgaben: "",
    rundeDraftPriceAmount: "",
    rundeDraftAdditionalTitleText: "",
    rundeDraftKategorien: [],
    newRundeConfigRundenPreview: [],
    newRundePriceAmountManuallyEdited: false,
    verbrauchtePreise: {},
    preisHistorie: [],
    preisFilter: "",
    kategorieFilter: "",
    selectedRundenTitelForManualAdd: "__AUTO__",
    draggedPreis: null,
    dragOverLeft: false,
    dragOverRundenTitel: null,
    isLoading: false,
    loadingCount: 0,
    loadingStartedAt: 0,

    // Form data
    newPreis: {
      name: "",
      herkunft: "",
      anzahl: 1,
      preis: 0,
      isASpend: false,
    },

    newKategorie: {
      name: "",
      typ: "von_bis",
      wert1: 0,
      wert2: 0,
    },

    // File upload
    selectedFile: null,
    uploadMessage: "",
    uploadSuccess: false,
    excelColumns: [],
    excelPreview: [],
    columnMapping: {
      name: "",
      herkunft: "",
      anzahl: "",
      preis: "",
    },
    showMappingModal: false,
    tempFilePath: null,

    // Initialize
    async init() {
      try {
        console.log("App initialisiert");
        console.log("ElectronAPI verfügbar:", !!window.electronAPI);

        if (!window.electronAPI) {
          console.error("KRITISCHER FEHLER: ElectronAPI ist nicht verfügbar!");
          return;
        }

        this.wrapElectronAPIWithLoader();

        await this.loadData();
        console.log("App erfolgreich initialisiert");
      } catch (error) {
        console.error("Fehler beim Initialisieren der App:", error);
      }
    },

    wrapElectronAPIWithLoader() {
      if (!loadingService) {
        console.warn("Loading-Service nicht verfügbar, verwende Fallback ohne Wrapper.");
        return;
      }
      loadingService.wrapElectronAPIWithLoader(this);
    },

    beginLoading() {
      if (!loadingService) return Date.now();
      return loadingService.beginLoading(this);
    },

    async endLoading(startedAt = null) {
      if (!loadingService) {
        this.isLoading = false;
        return;
      }
      await loadingService.endLoading(this, startedAt);
    },

    // Data loading
    async loadData() {
      try {
        console.log("Lade Daten...");
        this.preise = await window.electronAPI.getAllPreise();
        console.log("Preise geladen:", this.preise.length);
        this.kategorien = await window.electronAPI.getAllKategorien();
        console.log("Kategorien geladen:", this.kategorien.length);
        this.lottos = await window.electronAPI.getAllLottos();
        console.log("Lottos geladen:", this.lottos.length);
        await this.loadKonfigurationenMitKategorien();
        console.log("Konfigurationen geladen:", this.konfigurationen.length);
        this.runden = await window.electronAPI.getAllRunden();
        console.log("Runden geladen:", this.runden.length);
      } catch (error) {
        console.error("Fehler beim Laden der Daten:", error);
      }
    },

    // Preis functions
    async savePreis() {
      try {
        console.log("Speichere Preis:", this.newPreis);

        if (this.newPreis.id) {
          await window.electronAPI.updatePreis(
            this.newPreis.id,
            this.newPreis.name,
            this.newPreis.herkunft,
            this.newPreis.anzahl,
            this.newPreis.preis,
            !!this.newPreis.isASpend
          );
        } else {
          const result = await window.electronAPI.addPreis(
            this.newPreis.name,
            this.newPreis.herkunft,
            this.newPreis.anzahl,
            this.newPreis.preis,
            !!this.newPreis.isASpend
          );
          console.log("Preis erstellt mit ID:", result);
        }

        this.showAddPreisModal = false;
        this.resetPreisForm();
        await this.loadData();
      } catch (error) {
        console.error("Fehler beim Speichern des Preises:", error);
      }
    },

    editPreis(preis) {
      this.newPreis = {
        ...preis,
        isASpend: !!preis.is_a_spende,
      };
      this.showAddPreisModal = true;
    },

    async deletePreis(id) {
      if (confirm("Möchten Sie diesen Preis wirklich löschen?")) {
        try {
          await window.electronAPI.deletePreis(id);
          await this.loadData();
        } catch (error) {
          console.error("Fehler beim Löschen des Preises:", error);
        }
      }
    },

    resetPreisForm() {
      this.newPreis = {
        name: "",
        herkunft: "",
        anzahl: 1,
        preis: 0,
        isASpend: false,
      };
    },

    // Kategorie functions
    async saveKategorie() {
      try {
        if (parseFloat(this.newKategorie.wert2) <= parseFloat(this.newKategorie.wert1)) {
          alert("Der 'bis'-Wert muss größer als der 'von'-Wert sein!");
          return;
        }

        const typ = "von_bis";
        
        if (this.newKategorie.id) {
          await window.electronAPI.updateKategorie(
            this.newKategorie.id,
            this.newKategorie.name,
            typ,
            parseFloat(this.newKategorie.wert1),
            parseFloat(this.newKategorie.wert2)
          );
        } else {
          await window.electronAPI.addKategorie(
            this.newKategorie.name,
            typ,
            parseFloat(this.newKategorie.wert1),
            parseFloat(this.newKategorie.wert2)
          );
        }

        this.showAddKategorieModal = false;
        this.resetKategorieForm();
        await this.loadData();
      } catch (error) {
        console.error("Fehler beim Speichern der Kategorie:", error);
        alert("Fehler beim Speichern der Kategorie: " + error.message);
      }
    },

    editKategorie(kategorie) {
      this.newKategorie = { ...kategorie };
      this.showAddKategorieModal = true;
    },

    async deleteKategorie(id) {
      if (confirm("Möchten Sie diese Kategorie wirklich löschen?")) {
        try {
          await window.electronAPI.deleteKategorie(id);
          await this.loadData();
        } catch (error) {
          console.error("Fehler beim Löschen der Kategorie:", error);
        }
      }
    },

    resetKategorieForm() {
      this.newKategorie = {
        name: "",
        typ: "von_bis",
        wert1: 0,
        wert2: 0,
      };
    },

    cancelKategorieModal() {
      this.showAddKategorieModal = false;
      this.resetKategorieForm();
    },

    // File upload functions
    async handleFileUpload(event) {
      const file = event.target.files[0];
      if (!file) return;

      this.selectedFile = file;
      this.uploadMessage = "";
      this.uploadSuccess = false;

      try {
        const maxBase64Size = 5 * 1024 * 1024;
        let fileData;

        if (file.size < maxBase64Size) {
          fileData = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const dataUrl = reader.result;
              const base64String = dataUrl.split(',')[1];
              resolve(base64String);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
          this.tempFilePath = null;
        } else {
          const arrayBuffer = await file.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          this.tempFilePath = await window.electronAPI.saveTempFile(Array.from(uint8Array), file.name);
          fileData = this.tempFilePath;
        }

        const result = await window.electronAPI.readExcelColumns(fileData);
        
        if (result.success) {
          this.excelColumns = result.columns;
          this.excelPreview = result.preview;
          this.autoMapColumns();
          this.showMappingModal = true;
        } else {
          this.uploadMessage = "Fehler beim Lesen der Excel-Datei: " + result.error;
          this.uploadSuccess = false;
        }
      } catch (error) {
        console.error("Fehler beim Verarbeiten der Datei:", error);
        this.uploadMessage = "Fehler: " + error.message;
        this.uploadSuccess = false;
      }
    },

    autoMapColumns() {
      const lowerColumns = this.excelColumns.map(col => col.toLowerCase());
      
      this.columnMapping.name = this.excelColumns.find((col, idx) => 
        lowerColumns[idx].includes("name") || lowerColumns[idx].includes("bezeichnung")
      ) || "";
      
      this.columnMapping.herkunft = this.excelColumns.find((col, idx) => 
        lowerColumns[idx].includes("herkunft") || lowerColumns[idx].includes("quelle") || lowerColumns[idx].includes("lieferant")
      ) || "";
      
      this.columnMapping.anzahl = this.excelColumns.find((col, idx) => 
        lowerColumns[idx].includes("anzahl") || lowerColumns[idx].includes("menge") || lowerColumns[idx].includes("stück")
      ) || "";
      
      this.columnMapping.preis = this.excelColumns.find((col, idx) => 
        lowerColumns[idx].includes("preis") || lowerColumns[idx].includes("betrag") || lowerColumns[idx].includes("kosten")
      ) || "";
    },

    async uploadExcel() {
      if (!this.selectedFile) return;

      if (!this.columnMapping.name || !this.columnMapping.preis) {
        this.uploadMessage = "Bitte mappen Sie mindestens 'Name' und 'Preis'";
        this.uploadSuccess = false;
        return;
      }

      try {
        let fileData;
        
        if (this.tempFilePath) {
          fileData = this.tempFilePath;
        } else {
          const maxBase64Size = 5 * 1024 * 1024;
          if (this.selectedFile.size < maxBase64Size) {
            fileData = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => {
                const dataUrl = reader.result;
                const base64String = dataUrl.split(',')[1];
                resolve(base64String);
              };
              reader.onerror = reject;
              reader.readAsDataURL(this.selectedFile);
            });
          } else {
            const arrayBuffer = await this.selectedFile.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            this.tempFilePath = await window.electronAPI.saveTempFile(Array.from(uint8Array), this.selectedFile.name);
            fileData = this.tempFilePath;
          }
        }

        const mapping = {
          name: String(this.columnMapping.name || ""),
          herkunft: String(this.columnMapping.herkunft || ""),
          anzahl: String(this.columnMapping.anzahl || ""),
          preis: String(this.columnMapping.preis || "")
        };

        const result = await window.electronAPI.uploadExcel(fileData, mapping);

        if (result.success) {
          this.uploadMessage = `Erfolgreich ${result.count} Preise importiert!`;
          this.uploadSuccess = true;
          this.showMappingModal = false;
          this.resetUploadForm();
          await this.loadData();
        } else {
          this.uploadMessage = "Fehler beim Import: " + result.error;
          this.uploadSuccess = false;
        }
      } catch (error) {
        console.error("Fehler beim Upload:", error);
        this.uploadMessage = "Fehler: " + error.message;
        this.uploadSuccess = false;
      }
    },

    resetUploadForm() {
      this.selectedFile = null;
      this.excelColumns = [];
      this.excelPreview = [];
      this.columnMapping = { name: "", herkunft: "", anzahl: "", preis: "" };
      this.tempFilePath = null;
      const fileInput = document.querySelector('input[type="file"]');
      if (fileInput) fileInput.value = "";
    },

    cancelMappingModal() {
      this.showMappingModal = false;
      this.resetUploadForm();
    },

    // Utility functions
    formatCurrency(amount) {
      return new Intl.NumberFormat("de-CH", {
        style: "currency",
        currency: "CHF",
      }).format(amount);
    },

    getGesamtsumme() {
      return this.preise.reduce((sum, preis) => sum + preis.gesamtpreis, 0);
    },

    // Lotto functions
    newLotto: {
      name: "",
      dateFrom: "",
      dateTo: "",
      gastroRevenue: 0,
      donations: 0,
    },
    newLottoDay: { date: "" },
    lottoViewMode: false,
    lottoEditMode: false,
    aktuellerLottoTag: null,
    lottoDays: [],
    rundenProTag: {},
    showAddDayModal: false,

    async saveLotto() {
      try {
        if (this.aktuellesLotto?.id) {
          await window.electronAPI.updateLotto(
            this.aktuellesLotto.id,
            this.newLotto.name,
            this.newLotto.dateFrom,
            this.newLotto.dateTo,
            parseFloat(this.newLotto.gastroRevenue) || 0,
            parseFloat(this.newLotto.donations) || 0
          );
          this.showNeuesLottoModal = false;
          this.resetLottoForm();
          await this.loadData();
        } else {
          const lottoId = await window.electronAPI.createLotto(
            this.newLotto.name,
            this.newLotto.dateFrom,
            this.newLotto.dateTo,
            parseFloat(this.newLotto.gastroRevenue) || 0,
            parseFloat(this.newLotto.donations) || 0
          );
          this.showNeuesLottoModal = false;
          this.resetLottoForm();
          await this.loadData();
          await this.viewLotto(lottoId);
        }
      } catch (error) {
        console.error("Fehler beim Speichern des Lottos:", error);
        alert("Fehler: " + error.message);
      }
    },

    async viewLotto(lottoId) {
      try {
        this.aktuellesLotto = await window.electronAPI.getLottoById(lottoId);
        await this.loadLottoDays(lottoId);
        this.lottoViewMode = true;
        this.lottoEditMode = false;
        this.rundeEditorMode = false;
        
        if (this.lottoDays.length > 0) {
          this.aktuellerLottoTag = this.lottoDays[0].day_number;
        } else {
          this.aktuellerLottoTag = null;
        }
        
        // Preishistorie laden
        await this.loadPreisHistorie();

        // Chart rendern (entprellt und robust)
        this.scheduleLottoChartRender(100);
      } catch (error) {
        console.error("Fehler beim Laden des Lottos:", error);
        alert("Fehler: " + error.message);
      }
    },

    async loadLottoDays(lottoId) {
      this.lottoDays = await window.electronAPI.getLottoDays(lottoId);
      this.rundenProTag = {};
      for (const day of this.lottoDays) {
        this.rundenProTag[day.day_number] = await window.electronAPI.getRundenByLottoDay(day.id);
      }
      // Chart aktualisieren
      this.scheduleLottoChartRender(100);
    },

    async addLottoDay() {
      if (!this.newLottoDay.date || !this.aktuellesLotto?.id) return;
      try {
        await window.electronAPI.addLottoDay(this.aktuellesLotto.id, this.newLottoDay.date);
        await this.loadLottoDays(this.aktuellesLotto.id);
        const newDay = this.lottoDays.find(d => d.date === this.newLottoDay.date);
        if (newDay) this.aktuellerLottoTag = newDay.day_number;
        this.showAddDayModal = false;
        this.newLottoDay = { date: "" };
        await this.loadData();
      } catch (error) {
        console.error("Fehler beim Hinzufügen des Tages:", error);
        alert("Fehler: " + error.message);
      }
    },

    async deleteLottoDay(dayNumber) {
      if (!confirm("Möchten Sie diesen Tag wirklich löschen? Alle Runden dieses Tages werden ebenfalls gelöscht.")) return;
      if (!this.aktuellesLotto?.id) return;
      try {
        await window.electronAPI.deleteLottoDay(this.aktuellesLotto.id, dayNumber);
        await this.loadLottoDays(this.aktuellesLotto.id);
        if (this.lottoDays.length > 0) {
          this.aktuellerLottoTag = this.lottoDays[0].day_number;
        } else {
          this.aktuellerLottoTag = null;
        }
        await this.loadData();
      } catch (error) {
        console.error("Fehler beim Löschen des Tages:", error);
        alert("Fehler: " + error.message);
      }
    },

    async deleteRundeFromLottoDay(rundeId) {
      if (!confirm("Möchten Sie diese Runde wirklich löschen?")) return;
      if (!this.aktuellesLotto?.id) return;
      try {
        await window.electronAPI.deleteRunde(rundeId);
        await this.loadLottoDays(this.aktuellesLotto.id);
        await this.loadPreisHistorie();
      } catch (error) {
        console.error("Fehler beim Löschen der Runde:", error);
        alert("Fehler: " + error.message);
      }
    },

    async switchLottoDay(dayNumber) {
      this.aktuellerLottoTag = dayNumber;
      if (!this.rundenProTag[dayNumber]) {
        const day = this.lottoDays.find(d => d.day_number === dayNumber);
        if (day) {
          this.rundenProTag[dayNumber] = await window.electronAPI.getRundenByLottoDay(day.id);
        }
      }
    },

    // Lotto Totals
    getLottoTotalEinnahmen() {
      let total = 0;
      for (const dayNum of Object.keys(this.rundenProTag)) {
        for (const r of this.rundenProTag[dayNum]) {
          total += (r.einnahmen || 0);
        }
      }
      return total;
    },

    getLottoTotalAusgaben() {
      let total = 0;
      for (const dayNum of Object.keys(this.rundenProTag)) {
        for (const r of this.rundenProTag[dayNum]) {
          total += (r.ausgaben || 0);
        }
      }
      return total;
    },

    getAktuellerTag() {
      return this.lottoDays.find(d => d.day_number === this.aktuellerLottoTag) || null;
    },

    getAktuellerTagRunden() {
      if (!this.aktuellerLottoTag) return [];
      return this.rundenProTag[this.aktuellerLottoTag] || [];
    },

    getAktuellerTagEinnahmen() {
      return this.getAktuellerTagRunden().reduce(
        (sum, r) => sum + (parseFloat(r.einnahmen) || 0),
        0
      );
    },

    getAktuellerTagAusgaben() {
      return this.getAktuellerTagRunden().reduce(
        (sum, r) => sum + (parseFloat(r.ausgaben) || 0),
        0
      );
    },

    // Vergleich 2:1 nur fuer die Balken-Skala:
    // Ausgaben-Balken hat die doppelte optische Gewichtung, Zahlen bleiben unveraendert.
    getAktuellerTagVergleich() {
      const einnahmen = this.getAktuellerTagEinnahmen();
      const ausgaben = this.getAktuellerTagAusgaben();
      const einnahmenBarWert = einnahmen;
      const ausgabenBarWert = ausgaben * 2;
      const maxBarWert = Math.max(einnahmenBarWert, ausgabenBarWert, 1);

      return {
        einnahmen,
        ausgaben,
        einnahmenPercent: (einnahmenBarWert / maxBarWert) * 100,
        ausgabenPercent: (ausgabenBarWert / maxBarWert) * 100,
        differenz: einnahmen - ausgaben,
      };
    },

    getAktuelleRundeDatumLabel() {
      if (this.aktuelleRunde && this.aktuelleRunde.datum) return this.aktuelleRunde.datum;
      return this.aktuellerLottoTag ?? "";
    },

    getAktuelleRundeTitelLabel() {
      if (!this.aktuelleRunde || !this.aktuelleRunde.titel) return "";
      return `- ${this.aktuelleRunde.titel}`;
    },

    getAktuelleRundeKategorienList() {
      if (!this.aktuelleRunde || !Array.isArray(this.aktuelleRunde.kategorien)) return [];
      return this.aktuelleRunde.kategorien;
    },

    getAktuelleRundeKategorienByTitelEntries() {
      const groups = {};
      for (const kat of this.getAktuelleRundeKategorienList()) {
        const titel = kat.runden_titel || "Ohne Rundentitel";
        if (!groups[titel]) groups[titel] = { sortOrder: Number.MAX_SAFE_INTEGER, items: [] };
        const katSortOrder = parseInt(kat.runden_sort_order);
        if (Number.isFinite(katSortOrder)) {
          groups[titel].sortOrder = Math.min(groups[titel].sortOrder, katSortOrder);
        }
        groups[titel].items.push(kat);
      }
      return Object.entries(groups)
        .sort((a, b) => {
          const bySortOrder = (a[1].sortOrder || 0) - (b[1].sortOrder || 0);
          if (bySortOrder !== 0) return bySortOrder;
          return String(a[0]).localeCompare(String(b[0]), "de");
        })
        .map(([titel, group]) => {
          const sortedItems = Array.from(group.items).sort((a, b) => {
            const bySort = (parseInt(a.runden_sort_order) || 0) - (parseInt(b.runden_sort_order) || 0);
            if (bySort !== 0) return bySort;
            return String(a.kategorie_name || "").localeCompare(String(b.kategorie_name || ""), "de");
          });
          return [titel, sortedItems];
        });
    },

    getAktuelleRundenTitelOptionen() {
      return this.getAktuelleRundeKategorienByTitelEntries().map(([titel]) => titel);
    },

    getRundeTitelSortOrderMap() {
      const map = new Map();
      for (const kat of this.getAktuelleRundeKategorienList()) {
        const titel = kat.runden_titel || "Ohne Rundentitel";
        const sortOrder = parseInt(kat.runden_sort_order);
        if (!Number.isFinite(sortOrder)) continue;
        if (!map.has(titel)) {
          map.set(titel, sortOrder);
          continue;
        }
        map.set(titel, Math.min(map.get(titel), sortOrder));
      }
      return map;
    },

    getAktuelleTagRundenTitelList() {
      return this.getAktuellerTagRundenList().map((r) => ({
        id: r.id,
        label: `Spielrunde ${r.rundennummer}${r.titel ? `: ${r.titel}` : ""}`,
      }));
    },

    hasAktuelleRundeKategorien() {
      return this.getAktuelleRundeKategorienList().length > 0;
    },

    getAktuelleRundeEinnahmenDisplay() {
      if (!rundeDetailsService) {
        if (!this.aktuelleRunde) return 0;
        return this.parseOptionalNumber(this.aktuelleRunde.einnahmen);
      }
      return rundeDetailsService.getEinnahmenDisplay(this);
    },

    initRundeDetailsDraft() {
      if (!rundeDetailsService) return;
      rundeDetailsService.initDraft(this);
    },

    syncRundeDraftInputs() {
      if (!rundeDetailsService) return;
      rundeDetailsService.syncDraftInputs(this);
    },

    onAktuelleRundeFieldInput(field, eventOrValue) {
      const value =
        eventOrValue && eventOrValue.target ? eventOrValue.target.value : eventOrValue;
      if (field === "einnahmen") this.rundeDraftEinnahmen = value;
      if (field === "ausgaben") this.rundeDraftAusgaben = value;
      if (field === "price_amount") this.rundeDraftPriceAmount = value;
    },

    pullRundeDraftFromInputs() {
      if (!rundeDetailsService) return;
      rundeDetailsService.pullDraftFromInputs(this);
    },

    async saveRundeDetailsFromDraft() {
      if (!rundeDetailsService) return;
      await rundeDetailsService.saveFromDraft(this);
    },

    openRundeDetailsModal() {
      if (!rundeDetailsService) return;
      rundeDetailsService.openModal(this);
    },

    closeRundeDetailsModal() {
      if (!rundeDetailsService) return;
      rundeDetailsService.closeModal(this);
    },

    getRundePreiseGroupedEntries() {
      return Object.entries(this.getRundePreiseGrouped());
    },

    getRundePreiseByKonfigRundeEntries() {
      const groups = {};
      const titleSortMap = this.getRundeTitelSortOrderMap();
      for (const rp of this.rundePreise) {
        const section = rp.runden_titel || "Ohne Rundentitel";
        if (!groups[section]) groups[section] = { sortOrder: Number.MAX_SAFE_INTEGER, items: [] };
        const rpSort = parseInt(rp.runden_sort_order);
        if (Number.isFinite(rpSort)) {
          groups[section].sortOrder = Math.min(groups[section].sortOrder, rpSort);
        } else if (titleSortMap.has(section)) {
          groups[section].sortOrder = Math.min(groups[section].sortOrder, titleSortMap.get(section));
        }
        groups[section].items.push(rp);
      }
      return Object.entries(groups)
        .sort((a, b) => {
          const bySortOrder = (a[1].sortOrder || 0) - (b[1].sortOrder || 0);
          if (bySortOrder !== 0) return bySortOrder;
          return String(a[0]).localeCompare(String(b[0]), "de");
        })
        .map(([section, group]) => [section, group.items]);
    },

    getRundeDiffClass() {
      const ziel = this.getRundeZielsumme();
      const diff = Math.abs(this.getRundeGesamtsumme() - ziel);
      return diff < ziel * 0.1 ? "text-green-600" : "text-orange-600";
    },

    getRundeProgressWidthStyle() {
      const ziel = this.getRundeZielsumme();
      const width = Math.min(100, (this.getRundeGesamtsumme() / Math.max(1, ziel)) * 100);
      return `width: ${width}%`;
    },

    getKonfigKategorien(config) {
      if (!config || !Array.isArray(config._kategorien)) return [];
      return config._kategorien;
    },

    hasKonfigKategorien(config) {
      return this.getKonfigKategorien(config).length > 0;
    },

    getAktuellerTagGastroValue() {
      const tag = this.getAktuellerTag();
      return tag ? (tag.gastro_revenue || 0) : 0;
    },

    getAktuellerTagSpendenValue() {
      const tag = this.getAktuellerTag();
      return tag ? (tag.donations || 0) : 0;
    },

    getAktuellerTagRundenList() {
      if (this.aktuellerLottoTag === null || this.aktuellerLottoTag === undefined) return [];
      return this.rundenProTag[this.aktuellerLottoTag] || [];
    },

    hasAktuellerTagRunden() {
      return this.getAktuellerTagRundenList().length > 0;
    },

    getTagVergleichClass() {
      const diff = this.getAktuellerTagVergleich().differenz;
      if (Math.abs(diff) < 0.01) return "text-gray-600";
      return diff > 0 ? "text-green-700" : "text-red-700";
    },

    isTagVergleichGleichstand() {
      return Math.abs(this.getAktuellerTagVergleich().differenz) < 0.01;
    },

    getTagVergleichDifferenzAbs() {
      return Math.abs(this.getAktuellerTagVergleich().differenz);
    },

    async saveDayField(field, value) {
      const day = this.getAktuellerTag();
      if (!day) return;
      const rawValue = value && value.target ? value.target.value : value;
      day[field] = parseFloat(rawValue) || 0;
      try {
        await window.electronAPI.updateLottoDay(
          day.id,
          parseFloat(day.gastro_revenue) || 0,
          parseFloat(day.donations) || 0
        );
        this.scheduleLottoChartRender(50);
      } catch (error) {
        console.error("Fehler beim Speichern des Tages:", error);
      }
    },

    getLottoTotalGastro() {
      let total = 0;
      for (const day of this.lottoDays) {
        total += parseFloat(day.gastro_revenue) || 0;
      }
      return total;
    },

    getLottoTotalSpenden() {
      let total = 0;
      for (const day of this.lottoDays) {
        total += parseFloat(day.donations) || 0;
      }
      return total;
    },

    getLottoGewinn() {
      const einnahmen = this.getLottoTotalEinnahmen() 
        + this.getLottoTotalGastro()
        + this.getLottoTotalSpenden();
      const ausgaben = this.getLottoTotalAusgaben();
      return einnahmen - ausgaben;
    },

    getLottoTotalPriceAmount() {
      let total = 0;
      for (const dayNum of Object.keys(this.rundenProTag)) {
        for (const r of this.rundenProTag[dayNum]) {
          total += (r.price_amount || 0);
        }
      }
      return total;
    },

    lottoChart: null,
    lottoChartRenderTimer: null,

    scheduleLottoChartRender(delayMs = 0) {
      if (this.lottoChartRenderTimer) {
        clearTimeout(this.lottoChartRenderTimer);
        this.lottoChartRenderTimer = null;
      }
      this.lottoChartRenderTimer = setTimeout(() => {
        this.lottoChartRenderTimer = null;
        this.renderLottoChart();
      }, delayMs);
    },

    renderLottoChart() {
      // Nur in der Lotto-Ansicht rendern
      if (this.activeTab !== "lottos" || !this.lottoViewMode) {
        if (this.lottoChart) {
          this.lottoChart.destroy();
          this.lottoChart = null;
        }
        return;
      }

      const canvas = document.getElementById('lottoChart');
      if (!canvas) return;
      if (!canvas.isConnected) return;

      // Destroy existing chart
      if (this.lottoChart) {
        this.lottoChart.destroy();
        this.lottoChart = null;
      }

      const labels = [];
      const einnahmenData = [];
      const gastroData = [];
      const spendenData = [];
      const ausgabenData = [];

      for (const day of this.lottoDays) {
        const runden = this.rundenProTag[day.day_number] || [];
        const dayEinnahmen = runden.reduce((s, r) => s + (r.einnahmen || 0), 0);
        const dayAusgaben = runden.reduce((s, r) => s + (r.ausgaben || 0), 0);
        labels.push(`Tag ${day.day_number} (${day.date})`);
        einnahmenData.push(dayEinnahmen);
        gastroData.push(parseFloat(day.gastro_revenue) || 0);
        spendenData.push(parseFloat(day.donations) || 0);
        ausgabenData.push(dayAusgaben);
      }

      if (labels.length === 0) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      try {
        this.lottoChart = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: labels,
            datasets: [
              {
                label: 'Runden-Einnahmen',
                data: einnahmenData,
                backgroundColor: 'rgba(34, 197, 94, 0.7)',
                borderColor: 'rgb(34, 197, 94)',
                borderWidth: 1,
              },
              {
                label: 'Gastro Einnahmen',
                data: gastroData,
                backgroundColor: 'rgba(16, 185, 129, 0.7)',
                borderColor: 'rgb(16, 185, 129)',
                borderWidth: 1,
              },
              {
                label: 'Spenden',
                data: spendenData,
                backgroundColor: 'rgba(20, 184, 166, 0.7)',
                borderColor: 'rgb(20, 184, 166)',
                borderWidth: 1,
              },
              {
                label: 'Ausgaben',
                data: ausgabenData,
                backgroundColor: 'rgba(239, 68, 68, 0.7)',
                borderColor: 'rgb(239, 68, 68)',
                borderWidth: 1,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { position: 'top' },
              tooltip: {
                callbacks: {
                  label: function(context) {
                    return context.dataset.label + ': CHF ' + context.parsed.y.toFixed(2);
                  }
                }
              },
            },
            scales: {
              y: {
                beginAtZero: true,
                ticks: {
                  callback: function(value) {
                    return 'CHF ' + value;
                  }
                }
              },
            },
          },
        });
      } catch (error) {
        console.error("Chart konnte nicht gerendert werden:", error);
      }
    },

    async loadPreisHistorie() {
      if (!this.aktuellesLotto?.id) return;
      try {
        this.preisHistorie = await window.electronAPI.getPreisHistorie(this.aktuellesLotto.id);
      } catch (e) {
        console.warn("Preishistorie konnte nicht geladen werden:", e);
        this.preisHistorie = [];
      }
    },

    getPreisHistorieGrouped() {
      const groups = {};
      for (const h of this.preisHistorie) {
        if (!groups[h.preis_id]) {
          groups[h.preis_id] = {
            name: h.name,
            herkunft: h.herkunft,
            preis: h.preis,
            verfuegbar: h.verfuegbar,
            einsaetze: [],
            total: 0,
          };
        }
        groups[h.preis_id].einsaetze.push({
          tag: h.day_number,
          datum: h.day_date,
          runde: h.rundennummer,
          anzahl: h.eingesetzt,
        });
        groups[h.preis_id].total += (h.eingesetzt || 1);
      }
      return Object.values(groups).sort((a, b) => a.name.localeCompare(b.name));
    },

    backToLottoList() {
      if (this.lottoChartRenderTimer) {
        clearTimeout(this.lottoChartRenderTimer);
        this.lottoChartRenderTimer = null;
      }
      if (this.lottoChart) {
        this.lottoChart.destroy();
        this.lottoChart = null;
      }
      this.lottoViewMode = false;
      this.lottoEditMode = false;
      this.rundeEditorMode = false;
      this.aktuellesLotto = null;
      this.lottoDays = [];
      this.rundenProTag = {};
      this.preisHistorie = [];
      this.resetLottoForm();
    },

    startEditLotto() {
      if (!this.aktuellesLotto) return;
      this.lottoEditMode = true;
      this.newLotto = {
        name: this.aktuellesLotto.name || "",
        dateFrom: this.aktuellesLotto.date_from || "",
        dateTo: this.aktuellesLotto.date_to || "",
        gastroRevenue: this.aktuellesLotto.gastro_revenue || 0,
        donations: this.aktuellesLotto.donations || 0,
      };
    },

    cancelEditLotto() {
      this.lottoEditMode = false;
      this.resetLottoForm();
    },

    async saveLottoFromView() {
      if (!this.aktuellesLotto?.id) return;
      try {
        await window.electronAPI.updateLotto(
          this.aktuellesLotto.id,
          this.newLotto.name,
          this.newLotto.dateFrom,
          this.newLotto.dateTo,
          parseFloat(this.newLotto.gastroRevenue) || 0,
          parseFloat(this.newLotto.donations) || 0
        );
        this.lottoEditMode = false;
        await this.viewLotto(this.aktuellesLotto.id);
        await this.loadData();
      } catch (error) {
        console.error("Fehler beim Speichern des Lottos:", error);
        alert("Fehler: " + error.message);
      }
    },

    resetLottoForm() {
      this.newLotto = {
        name: "",
        dateFrom: "",
        dateTo: "",
        gastroRevenue: 0,
        donations: 0,
      };
      if (!this.lottoViewMode) {
        this.aktuellesLotto = null;
      }
    },

    cancelNeuesLottoModal() {
      this.showNeuesLottoModal = false;
      this.resetLottoForm();
    },

    cancelAddDayModal() {
      this.showAddDayModal = false;
      this.newLottoDay = { date: "" };
    },

    // Konfigurationen functions
    async loadKonfigurationenMitKategorien() {
      try {
        this.konfigurationen = await window.electronAPI.getAllKonfigurationen();
        for (const config of this.konfigurationen) {
          config._kategorien = await window.electronAPI.getKonfigurationKategorien(config.id);
          config._runden = await window.electronAPI.getKonfigurationRunden(config.id);
        }
      } catch (error) {
        console.error("Fehler beim Laden der Konfigurationen:", error);
      }
    },

    get availableKategorienForKonfig() {
      const zugewieseneIds = this.editingKonfigKategorien.map(kk => kk.kategorie_id);
      return this.kategorien.filter(k => !zugewieseneIds.includes(k.id));
    },

    openNewKonfigModal() {
      this.newKonfig = { name: "" };
      this.showNewKonfigModal = true;
    },

    async saveNewKonfiguration() {
      if (!this.newKonfig.name) return;
      try {
        const id = await window.electronAPI.createKonfiguration(this.newKonfig.name);
        this.showNewKonfigModal = false;
        await this.loadKonfigurationenMitKategorien();
        const config = this.konfigurationen.find(c => c.id === id);
        if (config) await this.editKonfiguration(config);
      } catch (error) {
        console.error("Fehler beim Erstellen der Konfiguration:", error);
        alert("Fehler: " + error.message);
      }
    },

    async editKonfiguration(config) {
      this.editingKonfig = { id: config.id, name: config.name };
      this.editingKonfigKategorien = await window.electronAPI.getKonfigurationKategorien(config.id);
      await this.reloadEditingKonfigRunden();
      this.newKonfigKategorie = { kategorieId: null, anzahlMin: 1, anzahlMax: 10 };
      this.newKonfigRundeTitel = "";
      this.showEditKonfigModal = true;
    },

    async saveKonfigName() {
      if (!this.editingKonfig.name) return;
      try {
        await window.electronAPI.updateKonfiguration(this.editingKonfig.id, this.editingKonfig.name);
        await this.loadKonfigurationenMitKategorien();
      } catch (error) {
        console.error("Fehler beim Speichern des Namens:", error);
        alert("Fehler: " + error.message);
      }
    },

    async addKategorieToKonfig() {
      if (!this.newKonfigKategorie.kategorieId) return;
      try {
        await window.electronAPI.addKategorieZuKonfiguration(
          this.editingKonfig.id,
          parseInt(this.newKonfigKategorie.kategorieId),
          this.newKonfigKategorie.anzahlMin,
          this.newKonfigKategorie.anzahlMax
        );
        this.editingKonfigKategorien = await window.electronAPI.getKonfigurationKategorien(this.editingKonfig.id);
        this.newKonfigKategorie = { kategorieId: null, anzahlMin: 1, anzahlMax: 10 };
      } catch (error) {
        console.error("Fehler beim Hinzufügen der Kategorie:", error);
        alert("Fehler: " + error.message);
      }
    },

    async removeKategorieVonKonfig(kategorieId) {
      if (!confirm("Kategorie wirklich entfernen?")) return;
      try {
        await window.electronAPI.removeKategorieVonKonfiguration(this.editingKonfig.id, kategorieId);
        this.editingKonfigKategorien = await window.electronAPI.getKonfigurationKategorien(this.editingKonfig.id);
      } catch (error) {
        console.error("Fehler beim Entfernen der Kategorie:", error);
        alert("Fehler: " + error.message);
      }
    },

    async updateKonfigKategorie(kk) {
      try {
        const min = Math.max(0, parseInt(kk.anzahl_min) || 0);
        const max = Math.max(min, parseInt(kk.anzahl_max) || min);
        kk.anzahl_min = min;
        kk.anzahl_max = max;
        await window.electronAPI.updateKonfigurationKategorie(
          this.editingKonfig.id, kk.kategorie_id, min, max
        );
      } catch (error) {
        console.error("Fehler beim Aktualisieren der Kategorie:", error);
        alert("Fehler: " + error.message);
      }
    },

    getKonfigRunden(config) {
      if (!config || !Array.isArray(config._runden)) return [];
      return config._runden;
    },

    async reloadEditingKonfigRunden() {
      if (!this.editingKonfig?.id) {
        this.editingKonfigRunden = [];
        return;
      }
      const runden = await window.electronAPI.getKonfigurationRunden(this.editingKonfig.id);
      const enriched = [];
      for (const r of runden) {
        const kategorien = await window.electronAPI.getKonfigurationRundenKategorien(r.id);
        enriched.push({
          ...r,
          _kategorien: kategorien,
          _newKategorieId: "",
          _newAnzahlMin: 1,
          _newAnzahlMax: 1,
        });
      }
      this.editingKonfigRunden = enriched;
    },

    getAvailableKategorienForKonfigRunde(runde) {
      const selected = new Set((runde?._kategorien || []).map((k) => k.kategorie_id));
      return this.kategorien.filter((k) => !selected.has(k.id));
    },

    async addKonfigRunde() {
      if (!this.editingKonfig?.id) return;
      try {
        const titel = (this.newKonfigRundeTitel || "").trim() || `Runde ${this.editingKonfigRunden.length + 1}`;
        await window.electronAPI.addKonfigurationRunde(
          this.editingKonfig.id,
          titel,
          this.editingKonfigRunden.length
        );
        this.newKonfigRundeTitel = "";
        await this.reloadEditingKonfigRunden();
      } catch (error) {
        console.error("Fehler beim Hinzufügen der Konfig-Runde:", error);
        alert("Fehler: " + error.message);
      }
    },

    async saveKonfigRunde(runde) {
      try {
        const titel = (runde.titel || "").trim();
        if (!titel) {
          alert("Bitte einen Rundentitel eingeben.");
          return;
        }
        await window.electronAPI.updateKonfigurationRunde(runde.id, titel, runde.sort_order || 0);
      } catch (error) {
        console.error("Fehler beim Speichern der Konfig-Runde:", error);
        alert("Fehler: " + error.message);
      }
    },

    async moveKonfigRunde(rundeId, direction) {
      const index = this.editingKonfigRunden.findIndex((r) => r.id === rundeId);
      if (index < 0) return;
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= this.editingKonfigRunden.length) return;

      const swapped = [...this.editingKonfigRunden];
      const temp = swapped[index];
      swapped[index] = swapped[targetIndex];
      swapped[targetIndex] = temp;

      try {
        for (let i = 0; i < swapped.length; i += 1) {
          const r = swapped[i];
          await window.electronAPI.updateKonfigurationRunde(
            r.id,
            (r.titel || "").trim() || `Runde ${i + 1}`,
            i
          );
        }
        await this.reloadEditingKonfigRunden();
      } catch (error) {
        console.error("Fehler beim Sortieren der Konfig-Runden:", error);
        alert("Fehler: " + error.message);
      }
    },

    async deleteKonfigRunde(rundeId) {
      if (!confirm("Runde wirklich löschen?")) return;
      try {
        await window.electronAPI.deleteKonfigurationRunde(rundeId);
        await this.reloadEditingKonfigRunden();
      } catch (error) {
        console.error("Fehler beim Löschen der Konfig-Runde:", error);
        alert("Fehler: " + error.message);
      }
    },

    async addKategorieToKonfigRunde(runde) {
      if (!runde || !runde._newKategorieId) return;
      try {
        await window.electronAPI.addKategorieZuKonfigurationRunde(
          runde.id,
          parseInt(runde._newKategorieId),
          Math.max(0, parseInt(runde._newAnzahlMin) || 0),
          Math.max(
            Math.max(0, parseInt(runde._newAnzahlMin) || 0),
            parseInt(runde._newAnzahlMax) || 0
          )
        );
        runde._newKategorieId = "";
        runde._newAnzahlMin = 1;
        runde._newAnzahlMax = 1;
        await this.reloadEditingKonfigRunden();
      } catch (error) {
        console.error("Fehler beim Hinzufügen einer Kategorie zur Konfig-Runde:", error);
        alert("Fehler: " + error.message);
      }
    },

    async updateKonfigRundeKategorie(kk) {
      try {
        const min = Math.max(0, parseInt(kk.anzahl_min) || 0);
        const max = Math.max(min, parseInt(kk.anzahl_max) || min);
        kk.anzahl_min = min;
        kk.anzahl_max = max;
        await window.electronAPI.updateKonfigurationRundeKategorie(kk.id, min, max);
      } catch (error) {
        console.error("Fehler beim Aktualisieren der Konfig-Runden-Kategorie:", error);
        alert("Fehler: " + error.message);
      }
    },

    async removeKategorieFromKonfigRunde(kkId) {
      try {
        await window.electronAPI.removeKategorieVonKonfigurationRunde(kkId);
        await this.reloadEditingKonfigRunden();
      } catch (error) {
        console.error("Fehler beim Entfernen der Konfig-Runden-Kategorie:", error);
        alert("Fehler: " + error.message);
      }
    },

    async deleteKonfigurationConfirm(id) {
      if (!confirm("Konfiguration wirklich löschen?")) return;
      try {
        await window.electronAPI.deleteKonfiguration(id);
        await this.loadKonfigurationenMitKategorien();
      } catch (error) {
        console.error("Fehler beim Löschen der Konfiguration:", error);
        alert("Fehler: " + error.message);
      }
    },

    async closeEditKonfigModal() {
      this.showEditKonfigModal = false;
      await this.loadKonfigurationenMitKategorien();
    },

    // Runde functions
    newRunde: {
      useConfig: false,
      configId: null,
      gewinnrunden: 1,
      gesamtpreis: 0,
      einnahmen: 0,
      ausgaben: 0,
      priceAmount: 0,
      kategorien: [],
    },
    newRundeErrors: {
      einnahmen: "",
      ausgaben: "",
      priceAmount: "",
      form: "",
    },
    rundeKategorieRowSeq: 0,

    createRundeKategorieRow(kategorieId, anzahlMin = 0, anzahlMax = 999, anzahl = null) {
      this.rundeKategorieRowSeq += 1;
      const min = Math.max(0, parseInt(anzahlMin) || 0);
      const max = Math.max(min, parseInt(anzahlMax) || min);
      const zielAnzahlRaw = anzahl === null || anzahl === undefined ? min : parseInt(anzahl);
      const zielAnzahl = Number.isFinite(zielAnzahlRaw)
        ? Math.min(max, Math.max(min, zielAnzahlRaw))
        : min;
      return {
        rowKey: `rk-${this.rundeKategorieRowSeq}`,
        kategorieId: kategorieId === null || kategorieId === undefined ? "" : String(kategorieId),
        // anzahl bleibt als Zielwert fuer bestehende Flows erhalten.
        anzahl: zielAnzahl,
        anzahlMin: min,
        anzahlMax: max,
      };
    },

    async loadKonfigurationKategorien(konfigurationId) {
      if (!konfigurationId) return [];
      try {
        return await window.electronAPI.getKonfigurationKategorien(konfigurationId);
      } catch (error) {
        console.error("Fehler beim Laden der Konfiguration:", error);
        return [];
      }
    },

    async loadKonfigurationRundenMitKategorien(konfigurationId) {
      if (!konfigurationId) return [];
      try {
        const runden = await window.electronAPI.getKonfigurationRunden(konfigurationId);
        const enriched = [];
        for (const r of runden) {
          const kategorien = await window.electronAPI.getKonfigurationRundenKategorien(r.id);
          enriched.push({ ...r, kategorien });
        }
        return enriched;
      } catch (error) {
        console.error("Fehler beim Laden der Konfig-Runden:", error);
        return [];
      }
    },

    async applySelectedKonfigurationToRunde() {
      if (!this.newRunde.useConfig) {
        this.newRunde.kategorien = [];
        this.newRundeConfigRundenPreview = [];
        return;
      }

      const configId = parseInt(this.newRunde.configId);
      if (!configId) {
        this.newRunde.kategorien = [];
        this.newRundeConfigRundenPreview = [];
        return;
      }
      const configRunden = await this.loadKonfigurationRundenMitKategorien(configId);
      this.newRunde.kategorien = [];
      this.newRunde.gewinnrunden = Math.max(1, configRunden.length || 1);
      this.newRundeConfigRundenPreview = configRunden.map((r, idx) =>
        `Runde ${idx + 1}: ${r.titel || "Ohne Titel"}`
      );
    },

    async onKonfigurationChange(selectedConfigIdOrEvent = null) {
      const selectedConfigId =
        selectedConfigIdOrEvent && selectedConfigIdOrEvent.target
          ? selectedConfigIdOrEvent.target.value
          : selectedConfigIdOrEvent;
      if (selectedConfigId !== null && selectedConfigId !== undefined) {
        this.newRunde.configId =
          selectedConfigId === "" ? "" : parseInt(selectedConfigId);
      }
      await this.applySelectedKonfigurationToRunde();
    },

    addKategorieToRunde() {
      this.newRunde.kategorien.push(this.createRundeKategorieRow(null, 0, 999));
    },

    async onKategorieChanged(index, valueOrEvent) {
      const value =
        valueOrEvent && valueOrEvent.target ? valueOrEvent.target.value : valueOrEvent;
      this.newRunde.kategorien[index].kategorieId = value;
      await this.onKategorieSelected(index);
    },

    async onKategorieSelected(index) {
      if (this.newRunde.useConfig && this.newRunde.configId) {
        const configKategorien = await this.loadKonfigurationKategorien(this.newRunde.configId);
        const kat = this.newRunde.kategorien[index];
        const configKat = configKategorien.find((ck) => parseInt(ck.kategorie_id) === parseInt(kat.kategorieId));
        if (configKat) {
          kat.anzahlMin = configKat.anzahl_min ?? 0;
          kat.anzahlMax = configKat.anzahl_max ?? 999;
          if (kat.anzahl < kat.anzahlMin) kat.anzahl = kat.anzahlMin;
          if (kat.anzahl > kat.anzahlMax) kat.anzahl = kat.anzahlMax;
        } else {
          kat.anzahlMin = 0;
          kat.anzahlMax = 999;
          kat.anzahl = Math.max(0, parseInt(kat.anzahl) || 0);
        }
      } else {
        const kat = this.newRunde.kategorien[index];
        kat.anzahlMin = 0;
        kat.anzahlMax = 999;
        kat.anzahl = Math.max(0, parseInt(kat.anzahl) || 0);
      }
    },

    removeKategorieFromRunde(index) {
      this.newRunde.kategorien.splice(index, 1);
    },

    calculateAusgaben() {
      if (this.newRunde.einnahmen > 0) {
        this.newRunde.ausgaben = Math.round(this.newRunde.einnahmen / 2 * 100) / 100;
        const hasCustomValue =
          this.newRundePriceAmountManuallyEdited &&
          this.newRunde.priceAmount !== "" &&
          this.newRunde.priceAmount !== null &&
          this.newRunde.priceAmount !== undefined;
        if (!hasCustomValue) {
          this.newRunde.priceAmount = this.newRunde.ausgaben;
        }
      }
    },

    onNewRundePriceAmountInput() {
      this.newRundePriceAmountManuallyEdited = true;
    },

    clearNeueRundeErrors() {
      this.newRundeErrors = {
        einnahmen: "",
        ausgaben: "",
        priceAmount: "",
        form: "",
      };
    },

    parseOptionalNumber(value) {
      if (value === null || value === undefined || value === "") return 0;
      const parsed = parseFloat(value);
      return Number.isFinite(parsed) ? parsed : 0;
    },

    async createRunde() {
      this.clearNeueRundeErrors();

      if (!this.aktuellesLotto || !this.aktuellerLottoTag) {
        this.newRundeErrors.form = "Bitte wählen Sie zuerst ein Lotto und einen Tag aus.";
        return;
      }

      // Wenn Konfiguration aktiv: Kategorien immer aus der gewählten Config übernehmen
      await this.applySelectedKonfigurationToRunde();

      if (this.newRunde.useConfig && !parseInt(this.newRunde.configId)) {
        this.newRundeErrors.form = "Bitte wählen Sie eine Konfiguration aus.";
        return;
      }

      const einnahmen = this.parseOptionalNumber(this.newRunde.einnahmen);
      const ausgaben = this.parseOptionalNumber(this.newRunde.ausgaben);
      const priceAmount = this.parseOptionalNumber(this.newRunde.priceAmount);

      if (this.newRunde.priceAmount === "" || this.newRunde.priceAmount === null || this.newRunde.priceAmount === undefined) {
        this.newRundeErrors.priceAmount = "Bitte geben Sie den eingesetzten Betrag ein.";
      } else if (priceAmount < 0) {
        this.newRundeErrors.priceAmount = "Der eingesetzte Betrag darf nicht negativ sein.";
      }

      if (this.newRundeErrors.priceAmount) {
        return;
      }

      if (!this.newRunde.useConfig) {
        if (this.newRunde.kategorien.length === 0) {
          this.newRundeErrors.form = "Bitte wählen Sie mindestens eine Kategorie aus.";
          return;
        }

        for (const kat of this.newRunde.kategorien) {
          const anzahlMin = parseInt(kat.anzahlMin);
          const anzahlMax = parseInt(kat.anzahlMax);
          if (
            !kat.kategorieId ||
            !Number.isFinite(anzahlMin) ||
            !Number.isFinite(anzahlMax) ||
            anzahlMin < 0 ||
            anzahlMax < 0 ||
            anzahlMax < anzahlMin
          ) {
            this.newRundeErrors.form = "Bitte füllen Sie alle Kategorien vollständig aus.";
            return;
          }
        }
      }

      try {
        const day = this.lottoDays.find(d => d.day_number === this.aktuellerLottoTag);
        if (!day) {
          this.newRundeErrors.form = "Tag nicht gefunden.";
          return;
        }

        const hasExplicitPriceAmount =
          this.newRunde.priceAmount !== "" &&
          this.newRunde.priceAmount !== null &&
          this.newRunde.priceAmount !== undefined;
        const basisPreisAmount = hasExplicitPriceAmount ? priceAmount : ausgaben;
        let startRundennummer = await window.electronAPI.getNextRundennummer(day.id);
        const erstellteRunden = [];
        let rundenDefinitionen = [];

        if (this.newRunde.useConfig) {
          const configRunden = await this.loadKonfigurationRundenMitKategorien(this.newRunde.configId);
          const selectedConfig = this.konfigurationen.find(
            (cfg) => parseInt(cfg.id) === parseInt(this.newRunde.configId)
          );
          const configTitel = selectedConfig?.name ? String(selectedConfig.name).trim() : null;
          if (configRunden.length === 0) {
            this.newRundeErrors.form = "Die gewählte Konfiguration enthält keine Runden.";
            return;
          }
          for (const cfgR of configRunden) {
            if (!cfgR.kategorien || cfgR.kategorien.length === 0) {
              this.newRundeErrors.form = `Konfig-Runde "${cfgR.titel}" hat keine Kategorien.`;
              return;
            }
          }
          const mergedKategorien = [];
          for (const cfgR of configRunden) {
            for (const kat of cfgR.kategorien) {
              mergedKategorien.push({
                kategorieId: parseInt(kat.kategorie_id),
                anzahlMin: Math.max(0, parseInt(kat.anzahl_min) || 0),
                anzahlMax: Math.max(
                  Math.max(0, parseInt(kat.anzahl_min) || 0),
                  parseInt(kat.anzahl_max) || 0
                ),
                anzahl: Math.max(0, parseInt(kat.anzahl_min) || 0),
                rundenTitel: cfgR.titel || null,
                rundenSortOrder: parseInt(cfgR.sort_order) || 0,
              });
            }
          }
          rundenDefinitionen = [
            {
              titel: configTitel || configRunden.map((r) => r.titel).filter(Boolean).join(" / ") || null,
              kategorien: mergedKategorien,
            },
          ];
        } else {
          const gewinnrundenCount = Math.max(1, parseInt(this.newRunde.gewinnrunden) || 1);
          rundenDefinitionen = Array.from({ length: gewinnrundenCount }).map(() => ({
            titel: null,
            kategorien: this.newRunde.kategorien.map((kat) => ({
              kategorieId: parseInt(kat.kategorieId),
              anzahlMin: Math.max(0, parseInt(kat.anzahlMin) || 0),
              anzahlMax: Math.max(
                Math.max(0, parseInt(kat.anzahlMin) || 0),
                parseInt(kat.anzahlMax) || 0
              ),
              anzahl: Math.max(0, parseInt(kat.anzahlMin) || 0),
            })),
          }));
        }

        const priceAmountProRunde = basisPreisAmount / Math.max(1, rundenDefinitionen.length);

        for (let i = 0; i < rundenDefinitionen.length; i++) {
          const rundennummer = startRundennummer + i;
          const datum = day.date;
          const definition = rundenDefinitionen[i];

          const rundeId = await window.electronAPI.createRunde(
            day.id,
            rundennummer,
            datum,
            einnahmen,
            ausgaben,
            definition.kategorien,
            priceAmountProRunde,
            definition.titel
          );

          erstellteRunden.push(rundeId);

          const result = await window.electronAPI.generateRundenPreise(
            rundeId,
            Math.max(0, priceAmountProRunde)
          );
          if (!result.success) {
            console.warn(`Preis-Generierung für Runde ${rundennummer}:`, result.error);
          }
        }

        this.showNeueRundeModal = false;
        this.resetRundeForm();
        await this.loadLottoDays(this.aktuellesLotto.id);
        
        // Öffne den Editor für die erste erstellte Runde
        if (erstellteRunden.length > 0 && erstellteRunden[0]) {
          await this.openRundeEditor(erstellteRunden[0]);
        }
      } catch (error) {
        console.error("Fehler beim Erstellen der Runde:", error);
        this.newRundeErrors.form = "Fehler: " + error.message;
      }
    },

    async openNeueRundeModal() {
      this.resetRundeForm();
      if (!this.kategorien || this.kategorien.length === 0) {
        this.kategorien = await window.electronAPI.getAllKategorien();
      }
      if (this.konfigurationen.length > 0) {
        this.newRunde.useConfig = true;
        this.newRunde.configId = "";
        this.newRunde.kategorien = [];
      }
      this.showNeueRundeModal = true;
    },

    cancelNeueRundeModal() {
      this.showNeueRundeModal = false;
      this.resetRundeForm();
    },

    resetRundeForm() {
      this.newRunde = {
        useConfig: false,
        configId: null,
        gewinnrunden: 1,
        gesamtpreis: 0,
        einnahmen: 0,
        ausgaben: 0,
        priceAmount: 0,
        kategorien: [],
      };
      this.newRundePriceAmountManuallyEdited = false;
      this.newRundeConfigRundenPreview = [];
      this.rundeKategorieRowSeq = 0;
      this.clearNeueRundeErrors();
    },

    // ==========================================
    // RUNDE EDITOR - Vollbild Preis-Bearbeitung
    // ==========================================

    async openRundeEditor(rundeId) {
      try {
        console.log("openRundeEditor:", rundeId);
        const runde = await window.electronAPI.getRundeById(rundeId);
        if (!runde) {
          alert("Runde nicht gefunden!");
          return;
        }
        
        this.aktuelleRunde = runde;
        this.aktuelleRunde.kategorien = await window.electronAPI.getRundenKategorien(rundeId);
        this.initRundeDetailsDraft();
        this.rundeEditorMode = true;
        this.preisFilter = "";
        this.kategorieFilter = "";
        
        await this.loadRundeEditorData();
      } catch (error) {
        console.error("Fehler beim Öffnen des Editors:", error);
        alert("Fehler: " + error.message);
      }
    },

    async loadRundeEditorData() {
      if (!this.aktuelleRunde) return;
      
      // Lade Kategorien der Runde (mit Anzahl)
      this.aktuelleRunde.kategorien = await window.electronAPI.getRundenKategorien(this.aktuelleRunde.id);
      if (!this.showRundeDetailsModal) {
        this.initRundeDetailsDraft();
      }
      
      // Lade gewählte Preise der Runde
      this.rundePreise = await window.electronAPI.getRundenPreise(this.aktuelleRunde.id);
      
      // Lade alle verfügbaren Preise
      this.verfuegbarePreise = await window.electronAPI.getAllPreise();

      // Lade verbrauchte Preise für das aktuelle Lotto
      if (this.aktuellesLotto?.id) {
        try {
          const vp = await window.electronAPI.getVerbrauchtePreise(this.aktuellesLotto.id);
          this.verbrauchtePreise = {};
          for (const item of vp) {
            this.verbrauchtePreise[item.preis_id] = item.verbraucht;
          }
        } catch (e) {
          console.warn("Verbrauchte Preise konnten nicht geladen werden:", e);
        }
      }
    },

    async updateRundeKategorieAnzahl(kat) {
      if (!this.aktuelleRunde) return;
      try {
        const anzahl = parseInt(kat.anzahl);
        const validAnzahl = Number.isFinite(anzahl) && anzahl >= 0 ? anzahl : 0;
        kat.anzahl = validAnzahl;
        await window.electronAPI.updateRundenKategorie(
          this.aktuelleRunde.id,
          kat.kategorie_id,
          validAnzahl
        );
      } catch (error) {
        console.error("Fehler beim Aktualisieren der Kategorie:", error);
      }
    },

    closeRundeEditor() {
      this.rundeEditorMode = false;
      this.showRundeDetailsModal = false;
      this.aktuelleRunde = null;
      this.initRundeDetailsDraft();
      this.rundePreise = [];
      this.verfuegbarePreise = [];
      this.preisFilter = "";
      this.kategorieFilter = "";
    },

    async backFromRundeEditor() {
      this.closeRundeEditor();
      // Lade Runden-Daten neu
      if (this.aktuellesLotto?.id) {
        await this.loadLottoDays(this.aktuellesLotto.id);
        await this.loadPreisHistorie();
      }
    },

    // Gefilterte verfügbare Preise (computed-like)
    getFilteredVerfuegbarePreise() {
      let filtered = this.verfuegbarePreise.filter((p) => {
        const gesamt = parseInt(p.anzahl) || 0;
        const verfuegbar = gesamt - this.getPreisVerbraucht(p.id);
        return verfuegbar > 0;
      });
      
      // Text-Filter
      if (this.preisFilter) {
        const lower = this.preisFilter.toLowerCase();
        filtered = filtered.filter(p => 
          (p.name && p.name.toLowerCase().includes(lower)) ||
          (p.herkunft && p.herkunft.toLowerCase().includes(lower))
        );
      }
      
      // Kategorie-Filter
      if (this.kategorieFilter) {
        const kat = this.kategorien.find(k => k.id === parseInt(this.kategorieFilter));
        if (kat) {
          filtered = filtered.filter(p => 
            p.preis >= kat.wert1 && p.preis <= kat.wert2
          );
        }
      }
      
      return filtered;
    },

    // Prüfe ob ein Preis bereits in der Runde ist
    isPreisInRunde(preisId) {
      return this.rundePreise.some(rp => rp.preis_id === preisId);
    },

    // Wie oft ein Preis im aktuellen Lotto insgesamt eingesetzt wurde
    getPreisVerbraucht(preisId) {
      return this.verbrauchtePreise[preisId] || 0;
    },

    // Gesamtsumme der gewählten Preise (Einzelpreis × Anzahl)
    getRundeGesamtsumme() {
      return this.rundePreise.reduce((sum, rp) => sum + (rp.preis || 0) * (rp.rp_anzahl || 1), 0);
    },

    // Zielsumme basiert auf dem eingesetzten Betrag (price_amount)
    getRundeZielsumme() {
      if (!this.aktuelleRunde) return 0;
      const priceAmount = this.parseOptionalNumber(this.aktuelleRunde.price_amount);
      const ausgaben = this.parseOptionalNumber(this.aktuelleRunde.ausgaben);
      const einnahmen = this.parseOptionalNumber(this.aktuelleRunde.einnahmen);
      return this.aktuelleRunde.price_amount !== null && this.aktuelleRunde.price_amount !== undefined
        ? priceAmount
        : (ausgaben || einnahmen / 2 || 0);
    },

    // Preis zur Runde hinzufügen
    resolveRundenKontextForPreis(preis, preferredRundenTitel = null) {
      let kategorieId = null;
      let rundenTitel = null;
      let rundenSortOrder = 0;

      const kategorien = this.aktuelleRunde?.kategorien || [];
      const hatPreferredTitel =
        preferredRundenTitel &&
        preferredRundenTitel !== "__AUTO__" &&
        preferredRundenTitel !== "__DEFAULT__";

      if (hatPreferredTitel) {
        const kategorienInTitel = kategorien.filter(
          (kat) => (kat.runden_titel || "Ohne Rundentitel") === preferredRundenTitel
        );
        for (const kat of kategorienInTitel) {
          if (preis.preis >= kat.wert1 && preis.preis <= kat.wert2) {
            kategorieId = kat.kategorie_id;
            rundenTitel = kat.runden_titel || null;
            rundenSortOrder = parseInt(kat.runden_sort_order) || 0;
            break;
          }
        }
        if (!kategorieId && kategorienInTitel.length > 0) {
          const fallbackKat = kategorienInTitel[0];
          kategorieId = fallbackKat.kategorie_id;
          rundenTitel = fallbackKat.runden_titel || null;
          rundenSortOrder = parseInt(fallbackKat.runden_sort_order) || 0;
        }
      }

      if (!kategorieId) {
        for (const kat of kategorien) {
          if (preis.preis >= kat.wert1 && preis.preis <= kat.wert2) {
            kategorieId = kat.kategorie_id;
            rundenTitel = kat.runden_titel || null;
            rundenSortOrder = parseInt(kat.runden_sort_order) || 0;
            break;
          }
        }
      }

      if (!kategorieId && kategorien.length > 0) {
        kategorieId = kategorien[0].kategorie_id;
        rundenTitel = kategorien[0].runden_titel || null;
        rundenSortOrder = parseInt(kategorien[0].runden_sort_order) || 0;
      }

      if (!kategorieId && this.kategorien.length > 0) {
        kategorieId = this.kategorien[0].id;
      }

      return { kategorieId, rundenTitel, rundenSortOrder };
    },

    // Preis zur Runde hinzufügen
    async addPreisToRundeEditor(preis, options = {}) {
      if (!this.aktuelleRunde) return;

      const preferredRundenTitel =
        options.preferredRundenTitel ?? this.selectedRundenTitelForManualAdd;
      const { kategorieId, rundenTitel, rundenSortOrder } = this.resolveRundenKontextForPreis(
        preis,
        preferredRundenTitel
      );

      if (!kategorieId) {
        alert("Keine Kategorie vorhanden!");
        return;
      }
      
      try {
        await window.electronAPI.addPreisZuRunde(
          this.aktuelleRunde.id,
          preis.id,
          kategorieId,
          rundenTitel,
          rundenSortOrder
        );
        await this.loadRundeEditorData();
      } catch (error) {
        console.error("Fehler beim Hinzufügen:", error);
        alert("Fehler: " + error.message);
      }
    },

    // Anzahl eines Preises in der Runde aktualisieren
    async updatePreisAnzahl(rp) {
      try {
        const anzahl = parseInt(rp.rp_anzahl);
        if (!Number.isFinite(anzahl) || anzahl < 0) {
          rp.rp_anzahl = 1;
          return;
        }
        if (anzahl === 0) {
          await this.removePreisFromRundeEditor(rp.id);
          return;
        }
        const gespeicherteAnzahl = await window.electronAPI.updateRundenPreisAnzahl(rp.id, anzahl);
        if (Number.isFinite(gespeicherteAnzahl) && gespeicherteAnzahl < anzahl) {
          alert(`Maximale Verfügbarkeit erreicht. Es wurden ${gespeicherteAnzahl} gespeichert.`);
        }
        await this.loadRundeEditorData();
      } catch (error) {
        console.error("Fehler beim Aktualisieren der Anzahl:", error);
      }
    },

    async syncAusgabenFromRundePreise() {
      if (!this.aktuelleRunde) return;
      const neueAusgaben = Math.round(this.getRundeGesamtsumme() * 100) / 100;
      const aktuelleAusgaben = Math.round(this.parseOptionalNumber(this.aktuelleRunde.ausgaben) * 100) / 100;
      if (neueAusgaben === aktuelleAusgaben) return;

      this.aktuelleRunde.ausgaben = neueAusgaben;
      try {
        const einnahmen = Math.max(0, this.parseOptionalNumber(this.aktuelleRunde.einnahmen));
        const priceAmount = Math.max(0, this.parseOptionalNumber(this.aktuelleRunde.price_amount));
        await window.electronAPI.updateRunde(
          this.aktuelleRunde.id,
          einnahmen,
          neueAusgaben,
          priceAmount,
          this.aktuelleRunde.additional_title_text ?? ""
        );

        if (this.aktuellerLottoTag && this.rundenProTag[this.aktuellerLottoTag]) {
          const idx = this.rundenProTag[this.aktuellerLottoTag].findIndex(
            (r) => r.id === this.aktuelleRunde.id
          );
          if (idx >= 0) {
            this.rundenProTag[this.aktuellerLottoTag][idx].ausgaben = neueAusgaben;
          }
        }
      } catch (error) {
        console.error("Fehler beim automatischen Ausgaben-Update:", error);
      }
    },

    // Preis aus Runde entfernen (per runden_preise.id)
    async removePreisFromRundeEditor(rundenPreisId) {
      try {
        await window.electronAPI.removePreisVonRundeById(rundenPreisId);
        await this.loadRundeEditorData();
      } catch (error) {
        console.error("Fehler beim Entfernen:", error);
        alert("Fehler: " + error.message);
      }
    },

    openRegenerateConfirmModal() {
      this.showRegenerateConfirmModal = true;
    },

    closeRegenerateConfirmModal() {
      this.showRegenerateConfirmModal = false;
    },

    async confirmRegeneratePreise() {
      this.showRegenerateConfirmModal = false;
      await this.regeneratePreise();
    },

    // Alle Preise neu generieren
    async regeneratePreise() {
      if (!this.aktuelleRunde) return;
      const loadingStartedAt = this.beginLoading();
      
      try {
        // Lösche alle bestehenden Preise
        await window.electronAPI.clearRundenPreise(this.aktuelleRunde.id);
        
        // Generiere neu
        const zielsumme = this.getRundeZielsumme();
        const result = await window.electronAPI.generateRundenPreise(this.aktuelleRunde.id, zielsumme);
        
        if (result.success) {
          await this.loadRundeEditorData();
        } else {
          alert("Fehler bei der Generierung: " + result.error);
        }
      } catch (error) {
        console.error("Fehler beim Regenerieren:", error);
        alert("Fehler: " + error.message);
      } finally {
        await this.endLoading(loadingStartedAt);
      }
    },

    // Drag & Drop Handler
    handleDragStart(event, preis, source) {
      this.draggedPreis = { preis, source };
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', JSON.stringify({ id: preis.id, source }));
    },

    handleDragOver(event) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
    },

    handleDragEnterLeft(event) {
      event.preventDefault();
      this.dragOverLeft = true;
    },

    handleDragLeaveLeft(event) {
      // Nur wenn wir das Drop-Zone-Element verlassen
      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX;
      const y = event.clientY;
      if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
        this.dragOverLeft = false;
      }
    },

    async handleDropToRunde(event, preferredRundenTitel = null) {
      event.preventDefault();
      this.dragOverLeft = false;
      this.dragOverRundenTitel = null;
      
      if (!this.draggedPreis) return;
      
      if (this.draggedPreis.source === 'available') {
        // Von verfügbar → Runde hinzufügen
        await this.addPreisToRundeEditor(this.draggedPreis.preis, {
          preferredRundenTitel,
        });
      }
      
      this.draggedPreis = null;
    },

    async handleDropToAvailable(event) {
      event.preventDefault();
      
      if (!this.draggedPreis) return;
      
      if (this.draggedPreis.source === 'runde') {
        // Von Runde → entfernen
        await this.removePreisFromRundeEditor(this.draggedPreis.preis.id);
      }
      
      this.draggedPreis = null;
    },

    handleDragEnd() {
      this.draggedPreis = null;
      this.dragOverLeft = false;
      this.dragOverRundenTitel = null;
    },

    // Runde Einnahmen/Ausgaben/PriceAmount aktualisieren
    async saveRundeDetails() {
      if (!this.aktuelleRunde) return;
      const loadingStartedAt = this.beginLoading();
      try {
        const einnahmen = Math.max(0, this.parseOptionalNumber(this.aktuelleRunde.einnahmen));
        const ausgaben = Math.max(0, this.parseOptionalNumber(this.aktuelleRunde.ausgaben));
        const priceAmount = Math.max(0, this.parseOptionalNumber(this.aktuelleRunde.price_amount));
        const additionalTitleText = String(this.aktuelleRunde.additional_title_text || "").trim();

        // UI auf normalisierte Werte zurücksetzen, damit die Eingabe stabil bleibt.
        this.aktuelleRunde.einnahmen = einnahmen;
        this.aktuelleRunde.ausgaben = ausgaben;
        this.aktuelleRunde.price_amount = priceAmount;
        this.aktuelleRunde.additional_title_text = additionalTitleText;

        await window.electronAPI.updateRunde(
          this.aktuelleRunde.id,
          einnahmen,
          ausgaben,
          priceAmount,
          additionalTitleText
        );

        // Synchronisiere dieselbe Runde in der Tagesübersicht sofort.
        if (this.aktuellerLottoTag && this.rundenProTag[this.aktuellerLottoTag]) {
          const idx = this.rundenProTag[this.aktuellerLottoTag].findIndex(
            (r) => r.id === this.aktuelleRunde.id
          );
          if (idx >= 0) {
            this.rundenProTag[this.aktuellerLottoTag][idx].einnahmen = einnahmen;
            this.rundenProTag[this.aktuellerLottoTag][idx].ausgaben = ausgaben;
            this.rundenProTag[this.aktuellerLottoTag][idx].price_amount = priceAmount;
            this.rundenProTag[this.aktuellerLottoTag][idx].additional_title_text = additionalTitleText;
          }
        }
        this.initRundeDetailsDraft();
      } catch (error) {
        console.error("Fehler beim Speichern:", error);
      } finally {
        await this.endLoading(loadingStartedAt);
      }
    },

    // Gruppierte Runden-Preise nach Kategorie
    getRundePreiseGrouped() {
      const groups = {};
      for (const rp of this.rundePreise) {
        const katName = rp.kategorie_name || 'Ohne Kategorie';
        if (!groups[katName]) groups[katName] = [];
        groups[katName].push(rp);
      }
      return groups;
    },

    async exportRundePDF(rundeId) {
      try {
        const result = await window.electronAPI.exportRundeToPDF(rundeId);
        if (result.success) {
          await window.electronAPI.openPdf(result.path);
        } else {
          alert("PDF Export Fehler: " + result.message);
        }
      } catch (error) {
        console.error("Fehler beim PDF-Export:", error);
      }
    },

    async exportPreisblatt(rundeId) {
      try {
        const result = await window.electronAPI.exportPreisblattPDF(rundeId);
        if (result.success) {
          await window.electronAPI.openPdf(result.path);
        } else if (result.message !== "Export abgebrochen") {
          alert("Preisblatt-PDF Fehler: " + result.message);
        }
      } catch (error) {
        console.error("Fehler beim Preisblatt-Export:", error);
      }
    },

    async exportUebersicht(rundeId) {
      try {
        const result = await window.electronAPI.exportUebersichtPDF(rundeId);
        if (result.success) {
          await window.electronAPI.openPdf(result.path);
        } else if (result.message !== "Export abgebrochen") {
          alert("Übersicht-PDF Fehler: " + result.message);
        }
      } catch (error) {
        console.error("Fehler beim Übersicht-Export:", error);
      }
    },

    async exportLottoPDF() {
      if (!this.aktuellesLotto?.id) return;
      try {
        const result = await window.electronAPI.exportLottoPDF(this.aktuellesLotto.id);
        if (result.success) {
          await window.electronAPI.openPdf(result.path);
        } else {
          alert("Lotto-PDF Fehler: " + result.message);
        }
      } catch (error) {
        console.error("Fehler beim Lotto-PDF-Export:", error);
        alert("Fehler: " + error.message);
      }
    },

    async openPdfFolder() {
      try {
        await window.electronAPI.openPdfFolder();
      } catch (error) {
        console.error("Fehler beim Öffnen des PDF-Ordners:", error);
      }
    },

    // JSON Export / Import
    async exportAllDataJSON() {
      try {
        const result = await window.electronAPI.exportAllData();
        if (result.success) {
          alert("✅ Daten erfolgreich exportiert nach:\n" + result.path);
        } else if (result.message !== "Export abgebrochen") {
          alert("❌ Export Fehler: " + result.message);
        }
      } catch (error) {
        console.error("Export Fehler:", error);
        alert("Fehler beim Exportieren: " + error.message);
      }
    },

    async importAllDataJSON() {
      if (!confirm("⚠️ ACHTUNG: Beim Import werden ALLE vorhandenen Daten überschrieben!\n\nMöchten Sie fortfahren?")) {
        return;
      }
      try {
        const result = await window.electronAPI.importAllData();
        if (result.success) {
          const c = result.counts;
          const details = [
            `Preise: ${c.preise}`,
            `Kategorien: ${c.kategorien}`,
            `Lottos: ${c.lottos}`,
            `Lotto-Tage: ${c.lotto_days}`,
            `Runden: ${c.runden}`,
            `Konfigurationen: ${c.konfigurationen}`,
          ].join("\n");
          alert("✅ Daten erfolgreich importiert!\n\n" + details);
          await this.loadData();
          // Lotto-View zurücksetzen
          this.lottoViewMode = false;
          this.rundeEditorMode = false;
          this.aktuellesLotto = null;
        } else if (result.message !== "Import abgebrochen") {
          alert("❌ Import Fehler: " + result.message);
        }
      } catch (error) {
        console.error("Import Fehler:", error);
        alert("Fehler beim Importieren: " + error.message);
      }
    },

    // Test function
    async testConnection() {
      try {
        const preise = await window.electronAPI.getAllPreise();
        alert("Verbindung funktioniert! Preise geladen: " + preise.length);
      } catch (error) {
        console.error("Test fehlgeschlagen:", error);
        alert("Test fehlgeschlagen: " + error.message);
      }
    },
  };
}

document.addEventListener("alpine:init", () => {
  Alpine.data("preisRundenApp", preisRundenApp);
});
