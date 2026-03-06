# Preis-Management (Electron Desktop-App)

Diese Anwendung ist eine lokale Desktop-Software zur Verwaltung von Preisen, Kategorien, Lotto-Tagen, Gängen (ehemals Spielrunden), Konfigurationen und PDF-Auswertungen.

Die App ist für den praktischen Einsatz an Events ausgelegt: Preise können importiert, manuell zugeordnet, automatisch verteilt, nachverfolgt und als PDF exportiert werden.

---

## Inhalt

- [Überblick](#überblick)
- [Hauptfunktionen](#hauptfunktionen)
- [Technischer Aufbau](#technischer-aufbau)
- [Voraussetzungen](#voraussetzungen)
- [Installation für Entwicklung](#installation-für-entwicklung)
- [App lokal starten](#app-lokal-starten)
- [Windows Build und Installer](#windows-build-und-installer)
- [Datenhaltung](#datenhaltung)
- [Bedienung im Detail](#bedienung-im-detail)
- [PDF-Export](#pdf-export)
- [JSON Export / Import](#json-export--import)
- [Fehlerbehebung (Troubleshooting)](#fehlerbehebung-troubleshooting)
- [Wichtige Hinweise](#wichtige-hinweise)

---

## Überblick

Mit der App können Sie:

- Preise anlegen, bearbeiten, löschen (inkl. Spenden-Flag)
- Kategorien mit Preisbereichen und Mengenlogik verwalten
- Lottos mit Tagen und Gängen organisieren
- Konfigurationen mit mehreren Konfig-Runden definieren
- Preise pro Gang per Drag-and-Drop oder Klick manuell zuweisen
- Preise automatisiert generieren lassen (zielwert-/budgetorientiert)
- Ausgaben in einem Gang automatisch aus der Summe der zugewiesenen Preise ableiten
- Historien und Auswertungen einsehen
- Mehrere PDF-Varianten exportieren
- Daten als JSON sichern und wieder einspielen

---

## Hauptfunktionen

### 1) Preisverwaltung

- Preisname, Herkunft, Anzahl, Preis
- Kennzeichnung `Spende` (Ja/Nein)
- Einzelbearbeitung und Löschung

### 2) Kategorien

- Kategorien mit Preisbereich von/bis
- Mengen-Vorgaben für Zuweisung in Konfigurationen und Gängen

### 3) Lotto / Tage / Gänge

- Ein Lotto enthält mehrere Tage
- Ein Tag enthält mehrere Gänge
- Je Gang werden Einnahmen, Ausgaben, eingesetzter Betrag und Zusatztext gepflegt

### 4) Konfigurationen

- Eine Konfiguration enthält mehrere Konfig-Runden
- Jede Konfig-Runde enthält Kategorien inkl. Min/Max-Menge
- Reihenfolge der Konfig-Runden ist sortierbar

### 5) Gang-Editor (Vollbild)

- Linke Seite: zugewiesene Preise im Gang (nach Rundentitel gruppiert)
- Rechte Seite: verfügbare Preise inkl. Suche/Filter
- Manuelles Hinzufügen:
  - Klick auf Preis
  - Drag-and-Drop
  - Zielrundentitel auswählbar
- Gleicher Preis wird innerhalb desselben Rundentitels zusammengeführt (Anzahl erhöht statt Doppelzeile)
- Menge ist auf verfügbare Gesamtanzahl begrenzt
- Ausgaben werden als Summe aller Preise im Gang synchronisiert

### 6) Nicht-blockierende Hinweise

- Meldungen werden als Einblendung angezeigt (statt blockierender Browser-Alerts)
- UI bleibt dadurch auch bei Fehlermeldungen bedienbar

---

## Technischer Aufbau

- **Runtime/UI:** Electron + Alpine.js
- **Backend lokal:** SQLite (`sqlite3`, `sqlite`)
- **Excel:** `xlsx`
- **PDF-Rendering:** Puppeteer
- **Build:** electron-builder (Windows: NSIS + Portable)

Projektstruktur (wichtigste Ordner):

- `src/main` – Electron Main Process, IPC, DB, Services
- `src/renderer` – UI, Alpine-App, Dialoge, Editor
- `build` – Build-Ressourcen (u. a. `icon.ico`)
- `dist` – erzeugte Build-Artefakte
- `data` – lokale Daten/DB-Ressourcen

---

## Voraussetzungen

- Windows 10/11
- Node.js (empfohlen aktuelle LTS)
- npm

---

## Installation für Entwicklung

```bash
npm install
```

---

## App lokal starten

```bash
npm start
```

---

## Windows Build und Installer

### Unpacked Build

```bash
npm run build:dir
```

### Installer/Portable Build

```bash
npm run build
```

### Wichtig: App-Icon für installierte Version

Damit EXE/Installer/Taskleiste das richtige Icon nutzen:

- Datei muss vorhanden sein: `build/icon.ico`
- In der Build-Konfiguration ist das Icon bereits korrekt verdrahtet

Wenn nach Installation noch ein altes Taskleisten-Icon angezeigt wird:

1. App entheften und neu anheften
2. optional Icon-Cache von Windows löschen (Explorer-Reset)

---

## Datenhaltung

Die Daten werden lokal in SQLite gespeichert. Es gibt Tabellen für:

- Preise
- Kategorien
- Lottos und Lotto-Tage
- Gänge (`runden`)
- Gang-Kategorien und Gang-Preise
- Konfigurationen inkl. Konfig-Runden und deren Kategorien/Preise

Migrationen werden beim Start ausgeführt (z. B. neue Spalten wie `price_amount`, `titel`, `additional_title_text`).

---

## Bedienung im Detail

### 1) Preise hinzufügen

- Entweder manuell im Preis-Dialog
- Oder per Excel-Import mit Spaltenmapping

### 2) Konfiguration erstellen

- Konfiguration anlegen
- Konfig-Runden hinzufügen (Titel, Reihenfolge)
- Kategorien pro Konfig-Runde zuweisen (Min/Max)

### 3) Neuen Gang erstellen

- Im Tag auf „Neue Runde erstellen“
- Optional: Konfiguration auswählen
- Werte setzen:
  - Einnahmen
  - Ausgaben
  - Eingesetzter Betrag
- Bei Konfiguration werden Rundentitel/Kategorien aus der Konfig übernommen

### 4) Gang im Editor bearbeiten

- Preise per Klick oder Drag-and-Drop hinzufügen
- Ziel-Rundentitel wählbar (`Manuell hinzufügen zu`)
- Anzahl direkt im Eintrag bearbeitbar
- Entfernen per `x` oder Drag zurück
- „Werte bearbeiten“ öffnet Modal mit:
  - Einnahmen
  - Ausgaben
  - Eingesetzter Betrag
  - Zusätzlicher Titeltext (`additionalTitleText`)

---

## PDF-Export

Es gibt mehrere PDF-Arten:

### 1) Preisblatt

- Kopf mit Konfigurationsname
- Anzeige pro Rundentitel mit den zugeordneten Preisen
- Preisnamen enthalten die Menge (`x n`)
- zusätzlicher Titeltext wird rechts in der blauen Kopfzeile angezeigt

### 2) Übersicht

- Preisliste mit Wert in CHF
- zusätzliche Spalte `Spende`:
  - `Ja`, wenn Preis als Spende markiert ist
  - sonst leer

### 3) Lotto-Übersicht

- Tages- und Gesamtübersichten über Einnahmen/Ausgaben/Geldeinsatz usw.

---

## JSON Export / Import

### Export

- Exportiert alle relevanten Daten als JSON-Datei

### Import

- Import überschreibt vorhandene Daten vollständig
- Vorher unbedingt Backup machen

---

## Fehlerbehebung (Troubleshooting)

### Build meldet Icon-Fehler (`unknown format`)

- Ursache: beschädigte oder ungültige `.ico`-Datei
- Lösung: `build/icon.ico` neu als korrektes ICO erzeugen

### Nach Installation falsches Taskleisten-Icon

- Neue Version installieren
- Taskleisten-Verknüpfung neu anheften
- ggf. Windows Icon-Cache resetten

### Eingaben wirken „gesperrt“

- Neuere Versionen nutzen nicht-blockierende Hinweise statt modaler Alerts
- Falls trotzdem ein Overlay hängen bleibt: App neu starten

---

## Wichtige Hinweise

- Diese App ist primär für lokale Nutzung vorgesehen
- Daten liegen lokal auf dem Rechner (keine Cloud-Anbindung)
- Für produktive Einsätze regelmäßig JSON-Backups erstellen

