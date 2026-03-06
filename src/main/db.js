import sqlite3 from "sqlite3";
import { open } from "sqlite";
import path from "path";
import { app } from "electron";

// SQLite-Datenbankverbindung
let db = null;

export async function initDatabase() {
  try {
    const dbPath = path.join(app.getPath("userData"), "preis-runden.db");

    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    
    // Foreign Keys zunächst AUS lassen für Migrationen/Reparaturen
    await db.exec("PRAGMA foreign_keys = OFF");

    // Tabellen erstellen
    // Prüfe ob Tabelle bereits existiert
    const tableExists = await db.get(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='preise'"
    );

    if (!tableExists) {
      // Neue Tabelle erstellen mit optionaler Herkunft
      await db.exec(`
        CREATE TABLE preise (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          herkunft TEXT,
          anzahl INTEGER NOT NULL DEFAULT 1,
          preis REAL NOT NULL,
          gesamtpreis REAL NOT NULL,
          is_a_spende INTEGER NOT NULL DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
    } else {
      // Migration für bestehende Tabellen: Tabelle neu erstellen
      try {
        const preiseColumns = await db.all("PRAGMA table_info(preise)");
        const hasIsASpende = preiseColumns.some((col) => col.name === "is_a_spende");

        await db.exec(`
          CREATE TABLE preise_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            herkunft TEXT,
            anzahl INTEGER NOT NULL DEFAULT 1,
            preis REAL NOT NULL,
            gesamtpreis REAL NOT NULL,
            is_a_spende INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        if (hasIsASpende) {
          await db.exec(`
            INSERT INTO preise_new (id, name, herkunft, anzahl, preis, gesamtpreis, is_a_spende, created_at)
            SELECT id, name, herkunft, anzahl, preis, gesamtpreis, COALESCE(is_a_spende, 0), created_at FROM preise
          `);
        } else {
          await db.exec(`
            INSERT INTO preise_new (id, name, herkunft, anzahl, preis, gesamtpreis, is_a_spende, created_at)
            SELECT id, name, herkunft, anzahl, preis, gesamtpreis, 0, created_at FROM preise
          `);
        }
        
        await db.exec(`DROP TABLE preise`);
        await db.exec(`ALTER TABLE preise_new RENAME TO preise`);
        
        console.log("Migration: Herkunft-Spalte ist jetzt optional");
      } catch (error) {
        console.log("Migration übersprungen oder fehlgeschlagen:", error.message);
        // Tabelle existiert bereits in der neuen Form oder Migration nicht nötig
      }
    }

    // Sicherstellen, dass die Spalte für Spenden existiert
    {
      const preiseCols = await db.all("PRAGMA table_info(preise)");
      const hasIsASpende = preiseCols.some((col) => col.name === "is_a_spende");
      if (!hasIsASpende) {
        await db.exec("ALTER TABLE preise ADD COLUMN is_a_spende INTEGER NOT NULL DEFAULT 0");
      }
    }

    await db.exec(`
      CREATE TABLE IF NOT EXISTS kategorien (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        typ TEXT NOT NULL CHECK(typ IN ('groesser', 'von_bis')),
        wert1 REAL,
        wert2 REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Lottos-Tabelle (ein Lotto besteht aus mehreren Runden)
    const lottosExists = await db.get(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='lottos'"
    );
    
    if (lottosExists) {
      // Prüfe ob neue Spalten existieren
      const columns = await db.all("PRAGMA table_info(lottos)");
      const hasDateFrom = columns.some(col => col.name === 'date_from');
      const hasDateTo = columns.some(col => col.name === 'date_to');
      const hasGastroRevenue = columns.some(col => col.name === 'gastro_revenue');
      const hasDonations = columns.some(col => col.name === 'donations');
      const hasNumDays = columns.some(col => col.name === 'num_days');
      
      if (!hasDateFrom || !hasDateTo || !hasGastroRevenue || !hasDonations || !hasNumDays) {
        // Migration: Neue Spalten hinzufügen
        try {
          if (!hasDateFrom) {
            await db.exec(`ALTER TABLE lottos ADD COLUMN date_from TEXT`);
          }
          if (!hasDateTo) {
            await db.exec(`ALTER TABLE lottos ADD COLUMN date_to TEXT`);
          }
          if (!hasGastroRevenue) {
            await db.exec(`ALTER TABLE lottos ADD COLUMN gastro_revenue REAL DEFAULT 0`);
          }
          if (!hasDonations) {
            await db.exec(`ALTER TABLE lottos ADD COLUMN donations REAL DEFAULT 0`);
          }
          if (!hasNumDays) {
            await db.exec(`ALTER TABLE lottos ADD COLUMN num_days INTEGER DEFAULT 1`);
          }
          console.log("Migration: Lottos-Tabelle aktualisiert");
        } catch (error) {
          console.log("Migration übersprungen:", error.message);
        }
      }
    } else {
      // Neue Tabelle erstellen
      await db.exec(`
        CREATE TABLE lottos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          date_from TEXT NOT NULL,
          date_to TEXT NOT NULL,
          num_days INTEGER DEFAULT 1,
          gastro_revenue REAL DEFAULT 0,
          donations REAL DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
    }

    // Lotto-Tage Tabelle
    await db.exec(`
      CREATE TABLE IF NOT EXISTS lotto_days (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lotto_id INTEGER NOT NULL,
        day_number INTEGER NOT NULL,
        date TEXT NOT NULL,
        gastro_revenue REAL NOT NULL DEFAULT 0,
        donations REAL NOT NULL DEFAULT 0,
        FOREIGN KEY (lotto_id) REFERENCES lottos (id),
        UNIQUE(lotto_id, day_number)
      )
    `);

    // Migration: gastro_revenue und donations zu lotto_days hinzufügen
    {
      const daysCols = await db.all("PRAGMA table_info(lotto_days)");
      const hasGastro = daysCols.some(c => c.name === 'gastro_revenue');
      const hasDonations = daysCols.some(c => c.name === 'donations');
      if (!hasGastro) {
        await db.exec("ALTER TABLE lotto_days ADD COLUMN gastro_revenue REAL NOT NULL DEFAULT 0");
        console.log("Migration: gastro_revenue zu lotto_days hinzugefügt");
      }
      if (!hasDonations) {
        await db.exec("ALTER TABLE lotto_days ADD COLUMN donations REAL NOT NULL DEFAULT 0");
        console.log("Migration: donations zu lotto_days hinzugefügt");
      }
    }

    // Runden-Tabelle Migration
    const rundenExists = await db.get(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='runden'"
    );
    
    // Aufräumen: Entferne Altlasten von fehlgeschlagenen Migrationen
    await db.exec("DROP TABLE IF EXISTS runden_new");
    await db.exec("DROP TABLE IF EXISTS runden_backup");

    if (rundenExists) {
      const columns = await db.all("PRAGMA table_info(runden)");
      const hasLottoDayId = columns.some(col => col.name === 'lotto_day_id');
      const hasPriceAmount = columns.some(col => col.name === 'price_amount');
      const hasTitel = columns.some(col => col.name === 'titel');
      const hasAdditionalTitleText = columns.some(col => col.name === 'additional_title_text');
      const idColumn = columns.find(col => col.name === 'id');
      const idIsPrimaryKey = idColumn && idColumn.pk > 0;
      
      const nullIdRunden = await db.get("SELECT COUNT(*) as cnt FROM runden WHERE id IS NULL");
      const hasNullIds = nullIdRunden && nullIdRunden.cnt > 0;
      
      if (!hasLottoDayId || !idIsPrimaryKey || hasNullIds) {
        console.log("Runden-Tabelle hat fehlerhafte Struktur, erstelle komplett neu...");
        
        const oldRunden = await db.all("SELECT * FROM runden WHERE id IS NOT NULL");
        
        await db.exec("DROP TABLE IF EXISTS runden_kategorien");
        await db.exec("DROP TABLE IF EXISTS runden_preise");
        await db.exec("DROP TABLE runden");
        
        await db.exec(`
          CREATE TABLE runden (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lotto_day_id INTEGER NOT NULL,
            rundennummer INTEGER NOT NULL,
            titel TEXT,
            additional_title_text TEXT,
            datum TEXT NOT NULL,
            einnahmen REAL NOT NULL DEFAULT 0,
            ausgaben REAL NOT NULL DEFAULT 0,
            price_amount REAL NOT NULL DEFAULT 0,
            status TEXT DEFAULT 'aktiv' CHECK(status IN ('aktiv', 'abgeschlossen')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
        
        for (const row of oldRunden) {
          let lottoDayId = row.lotto_day_id;
          if (!lottoDayId && row.lotto_id && row.day_number) {
            const day = await db.get(
              "SELECT id FROM lotto_days WHERE lotto_id = ? AND day_number = ?",
              [row.lotto_id, row.day_number]
            );
            if (day) lottoDayId = day.id;
          }
          if (lottoDayId) {
            await db.run(
              `INSERT INTO runden (lotto_day_id, rundennummer, titel, additional_title_text, datum, einnahmen, ausgaben, price_amount, status, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [lottoDayId, row.rundennummer, row.titel || null, row.additional_title_text || null, row.datum,
               row.einnahmen || 0,
               row.ausgaben || 0,
               row.price_amount || row.ausgaben || 0,
               row.status || 'aktiv',
               row.created_at || new Date().toISOString()]
            );
          }
        }
        console.log("Runden-Tabelle erfolgreich neu erstellt");
      } else {
        // Migration: price_amount Spalte hinzufügen falls fehlend
        if (!hasPriceAmount) {
          try {
            await db.exec("ALTER TABLE runden ADD COLUMN price_amount REAL NOT NULL DEFAULT 0");
            // Setze price_amount auf ausgaben als Initialwert
            await db.exec("UPDATE runden SET price_amount = ausgaben WHERE price_amount = 0 AND ausgaben > 0");
            console.log("Migration: price_amount Spalte hinzugefügt");
          } catch (error) {
            console.log("Migration price_amount übersprungen:", error.message);
          }
        }
        if (!hasTitel) {
          try {
            await db.exec("ALTER TABLE runden ADD COLUMN titel TEXT");
            console.log("Migration: titel Spalte hinzugefügt");
          } catch (error) {
            console.log("Migration titel übersprungen:", error.message);
          }
        }
        if (!hasAdditionalTitleText) {
          try {
            await db.exec("ALTER TABLE runden ADD COLUMN additional_title_text TEXT");
            console.log("Migration: additional_title_text Spalte hinzugefügt");
          } catch (error) {
            console.log("Migration additional_title_text übersprungen:", error.message);
          }
        }
        console.log("Runden-Tabelle hat korrekte Struktur");
      }
    } else {
      await db.exec(`
        CREATE TABLE runden (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          lotto_day_id INTEGER NOT NULL,
          rundennummer INTEGER NOT NULL,
          titel TEXT,
          additional_title_text TEXT,
          datum TEXT NOT NULL,
          einnahmen REAL NOT NULL DEFAULT 0,
          ausgaben REAL NOT NULL DEFAULT 0,
          price_amount REAL NOT NULL DEFAULT 0,
          status TEXT DEFAULT 'aktiv' CHECK(status IN ('aktiv', 'abgeschlossen')),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log("Runden-Tabelle neu erstellt");
    }

    // Konfigurationen-Tabelle
    await db.exec(`
      CREATE TABLE IF NOT EXISTS konfigurationen (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Konfigurationen-Kategorien (welche Kategorien mit welcher Anzahl)
    await db.exec(`
      CREATE TABLE IF NOT EXISTS konfigurationen_kategorien (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        konfiguration_id INTEGER NOT NULL,
        kategorie_id INTEGER NOT NULL,
        anzahl_min INTEGER NOT NULL DEFAULT 1,
        anzahl_max INTEGER NOT NULL DEFAULT 1,
        FOREIGN KEY (konfiguration_id) REFERENCES konfigurationen (id),
        FOREIGN KEY (kategorie_id) REFERENCES kategorien (id)
      )
    `);

    await db.exec(`
      CREATE TABLE IF NOT EXISTS konfigurationen_runden (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        konfiguration_id INTEGER NOT NULL,
        titel TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (konfiguration_id) REFERENCES konfigurationen (id) ON DELETE CASCADE
      )
    `);

    await db.exec(`
      CREATE TABLE IF NOT EXISTS konfigurationen_runden_preise (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        konfiguration_runde_id INTEGER NOT NULL,
        preis_id INTEGER NOT NULL,
        anzahl INTEGER NOT NULL DEFAULT 1,
        FOREIGN KEY (konfiguration_runde_id) REFERENCES konfigurationen_runden (id) ON DELETE CASCADE,
        FOREIGN KEY (preis_id) REFERENCES preise (id)
      )
    `);

    await db.exec(`
      CREATE TABLE IF NOT EXISTS konfigurationen_runden_kategorien (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        konfiguration_runde_id INTEGER NOT NULL,
        kategorie_id INTEGER NOT NULL,
        anzahl_min INTEGER NOT NULL DEFAULT 0,
        anzahl_max INTEGER NOT NULL DEFAULT 999,
        FOREIGN KEY (konfiguration_runde_id) REFERENCES konfigurationen_runden (id) ON DELETE CASCADE,
        FOREIGN KEY (kategorie_id) REFERENCES kategorien (id)
      )
    `);

    // Runden-Kategorien und Runden-Preise:
    // FKs sind bereits OFF (seit Beginn der initDatabase), daher können wir sicher reparieren

    // Runden-Kategorien: Drop und Neuerstellen falls FK kaputt
    const rundenKatExists = await db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='runden_kategorien'");
    if (rundenKatExists) {
      const katSQL = await db.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='runden_kategorien'");
      const needsRecreate = !katSQL || !katSQL.sql || !katSQL.sql.includes('ON DELETE CASCADE');
      if (needsRecreate) {
        console.log("runden_kategorien: FK veraltet, erstelle neu...");
        const oldKatData = await db.all("SELECT * FROM runden_kategorien");
        await db.exec("DROP TABLE runden_kategorien");
        await db.exec(`
          CREATE TABLE runden_kategorien (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            runde_id INTEGER NOT NULL,
            kategorie_id INTEGER NOT NULL,
            anzahl INTEGER NOT NULL DEFAULT 1,
            anzahl_min INTEGER NOT NULL DEFAULT 0,
            anzahl_max INTEGER NOT NULL DEFAULT 999,
            runden_titel TEXT,
            runden_sort_order INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY (runde_id) REFERENCES runden (id) ON DELETE CASCADE,
            FOREIGN KEY (kategorie_id) REFERENCES kategorien (id)
          )
        `);
        for (const row of oldKatData) {
          const valid = await db.get("SELECT id FROM runden WHERE id = ?", [row.runde_id]);
          if (valid) {
            const anzahl = Math.max(0, parseInt(row.anzahl) || 0);
            const anzahlMin = Math.max(0, parseInt(row.anzahl_min) || anzahl);
            const anzahlMax = Math.max(anzahlMin, parseInt(row.anzahl_max) || anzahlMin);
            await db.run(
              "INSERT INTO runden_kategorien (runde_id, kategorie_id, anzahl, anzahl_min, anzahl_max, runden_titel, runden_sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
              [row.runde_id, row.kategorie_id, anzahl, anzahlMin, anzahlMax, row.runden_titel || null, row.runden_sort_order || 0]
            );
          }
        }
        console.log("runden_kategorien neu erstellt");
      }
    } else {
      await db.exec(`
        CREATE TABLE runden_kategorien (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          runde_id INTEGER NOT NULL,
          kategorie_id INTEGER NOT NULL,
          anzahl INTEGER NOT NULL DEFAULT 1,
          anzahl_min INTEGER NOT NULL DEFAULT 0,
          anzahl_max INTEGER NOT NULL DEFAULT 999,
          runden_titel TEXT,
          runden_sort_order INTEGER NOT NULL DEFAULT 0,
          FOREIGN KEY (runde_id) REFERENCES runden (id) ON DELETE CASCADE,
          FOREIGN KEY (kategorie_id) REFERENCES kategorien (id)
        )
      `);
    }

    // Migration: Von/Bis-Spalten fuer Runden-Kategorien ergaenzen (falls alte DB).
    const rkColumns = await db.all("PRAGMA table_info(runden_kategorien)");
    const hasAnzahlMin = rkColumns.some((c) => c.name === "anzahl_min");
    const hasAnzahlMax = rkColumns.some((c) => c.name === "anzahl_max");
    const hasRundenTitel = rkColumns.some((c) => c.name === "runden_titel");
    const hasRundenSortOrder = rkColumns.some((c) => c.name === "runden_sort_order");
    if (!hasAnzahlMin) {
      await db.exec("ALTER TABLE runden_kategorien ADD COLUMN anzahl_min INTEGER NOT NULL DEFAULT 0");
      await db.exec("UPDATE runden_kategorien SET anzahl_min = CASE WHEN anzahl < 0 THEN 0 ELSE anzahl END");
    }
    if (!hasAnzahlMax) {
      await db.exec("ALTER TABLE runden_kategorien ADD COLUMN anzahl_max INTEGER NOT NULL DEFAULT 999");
      await db.exec(
        "UPDATE runden_kategorien SET anzahl_max = CASE WHEN anzahl_min > anzahl THEN anzahl_min ELSE anzahl END"
      );
    }
    if (!hasRundenTitel) {
      await db.exec("ALTER TABLE runden_kategorien ADD COLUMN runden_titel TEXT");
    }
    if (!hasRundenSortOrder) {
      await db.exec("ALTER TABLE runden_kategorien ADD COLUMN runden_sort_order INTEGER NOT NULL DEFAULT 0");
    }

    // Runden-Preise: Drop und Neuerstellen falls Struktur veraltet
    const rundenPreiseExists = await db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='runden_preise'");
    if (rundenPreiseExists) {
      const preiseSQL = await db.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='runden_preise'");
      const hasAnzahl = preiseSQL && preiseSQL.sql && preiseSQL.sql.includes('anzahl');
      const hasCascade = preiseSQL && preiseSQL.sql && preiseSQL.sql.includes('ON DELETE CASCADE');
      if (!hasCascade || !hasAnzahl) {
        console.log("runden_preise: Struktur veraltet, erstelle neu...");
        const oldPreiseData = await db.all("SELECT * FROM runden_preise");
        await db.exec("DROP TABLE runden_preise");
        await db.exec(`
          CREATE TABLE runden_preise (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            runde_id INTEGER NOT NULL,
            preis_id INTEGER NOT NULL,
            kategorie_id INTEGER NOT NULL,
            anzahl INTEGER NOT NULL DEFAULT 1,
            runden_titel TEXT,
            runden_sort_order INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY (runde_id) REFERENCES runden (id) ON DELETE CASCADE,
            FOREIGN KEY (preis_id) REFERENCES preise (id),
            FOREIGN KEY (kategorie_id) REFERENCES kategorien (id)
          )
        `);
        for (const row of oldPreiseData) {
          const valid = await db.get("SELECT id FROM runden WHERE id = ?", [row.runde_id]);
          if (valid) {
            await db.run(
              "INSERT INTO runden_preise (runde_id, preis_id, kategorie_id, anzahl, runden_titel, runden_sort_order) VALUES (?, ?, ?, ?, ?, ?)",
              [row.runde_id, row.preis_id, row.kategorie_id, row.anzahl || 1, row.runden_titel || null, row.runden_sort_order || 0]
            );
          }
        }
        console.log("runden_preise neu erstellt mit anzahl-Spalte");
      }
    } else {
      await db.exec(`
        CREATE TABLE runden_preise (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          runde_id INTEGER NOT NULL,
          preis_id INTEGER NOT NULL,
          kategorie_id INTEGER NOT NULL,
          anzahl INTEGER NOT NULL DEFAULT 1,
          runden_titel TEXT,
          runden_sort_order INTEGER NOT NULL DEFAULT 0,
          FOREIGN KEY (runde_id) REFERENCES runden (id) ON DELETE CASCADE,
          FOREIGN KEY (preis_id) REFERENCES preise (id),
          FOREIGN KEY (kategorie_id) REFERENCES kategorien (id)
        )
      `);
    }

    const rpColumns = await db.all("PRAGMA table_info(runden_preise)");
    const hasRundenTitelRP = rpColumns.some((c) => c.name === "runden_titel");
    const hasRundenSortOrderRP = rpColumns.some((c) => c.name === "runden_sort_order");
    if (!hasRundenTitelRP) {
      await db.exec("ALTER TABLE runden_preise ADD COLUMN runden_titel TEXT");
    }
    if (!hasRundenSortOrderRP) {
      await db.exec("ALTER TABLE runden_preise ADD COLUMN runden_sort_order INTEGER NOT NULL DEFAULT 0");
    }

    // FK wieder aktivieren
    await db.exec("PRAGMA foreign_keys = ON");

    console.log("Datenbank erfolgreich initialisiert");
    return db;
  } catch (error) {
    console.error("Fehler beim Initialisieren der Datenbank:", error);
    throw error;
  }
}

export async function getDatabase() {
  if (!db) {
    await initDatabase();
  }
  return db;
}

export async function closeDatabase() {
  if (db) {
    await db.close();
    db = null;
  }
}

// Preis-Funktionen
export async function addPreis(name, herkunft, anzahl, preis, isASpend = false) {
  try {
    console.log("DB: Füge Preis hinzu:", { name, herkunft, anzahl, preis, isASpend });
    const database = await getDatabase();
    const gesamtpreis = anzahl * preis;

    const result = await database.run(
      "INSERT INTO preise (name, herkunft, anzahl, preis, gesamtpreis, is_a_spende) VALUES (?, ?, ?, ?, ?, ?)",
      [name, herkunft, anzahl, preis, gesamtpreis, isASpend ? 1 : 0]
    );

    console.log("DB: Preis hinzugefügt mit ID:", result.lastID);
    return result.lastID;
  } catch (error) {
    console.error("DB: Fehler beim Hinzufügen des Preises:", error);
    throw error;
  }
}

export async function getAllPreise() {
  const database = await getDatabase();
  return await database.all("SELECT * FROM preise ORDER BY name");
}

export async function updatePreis(id, name, herkunft, anzahl, preis, isASpend = false) {
  const database = await getDatabase();
  const gesamtpreis = anzahl * preis;

  await database.run(
    "UPDATE preise SET name = ?, herkunft = ?, anzahl = ?, preis = ?, gesamtpreis = ?, is_a_spende = ? WHERE id = ?",
    [name, herkunft, anzahl, preis, gesamtpreis, isASpend ? 1 : 0, id]
  );
}

export async function deletePreis(id) {
  const database = await getDatabase();
  await database.run("DELETE FROM preise WHERE id = ?", [id]);
}

// Kategorie-Funktionen
export async function addKategorie(name, typ, wert1, wert2 = null) {
  const database = await getDatabase();

  const result = await database.run(
    "INSERT INTO kategorien (name, typ, wert1, wert2) VALUES (?, ?, ?, ?)",
    [name, typ, wert1, wert2]
  );

  return result.lastID;
}

export async function getAllKategorien() {
  const database = await getDatabase();
  return await database.all("SELECT * FROM kategorien ORDER BY name");
}

export async function updateKategorie(id, name, typ, wert1, wert2 = null) {
  const database = await getDatabase();

  await database.run(
    "UPDATE kategorien SET name = ?, typ = ?, wert1 = ?, wert2 = ? WHERE id = ?",
    [name, typ, wert1, wert2, id]
  );
}

export async function deleteKategorie(id) {
  const database = await getDatabase();
  await database.run("DELETE FROM kategorien WHERE id = ?", [id]);
}

// Lotto-Funktionen
export async function createLotto(name, dateFrom, dateTo, gastroRevenue = 0, donations = 0) {
  const database = await getDatabase();
  const result = await database.run(
    "INSERT INTO lottos (name, date_from, date_to, num_days, gastro_revenue, donations) VALUES (?, ?, ?, 0, ?, ?)",
    [name, dateFrom, dateTo, gastroRevenue, donations]
  );
  
  return result.lastID;
}

export async function addLottoDay(lottoId, date) {
  const database = await getDatabase();
  
  // Finde die nächste day_number
  const maxDay = await database.get(
    "SELECT MAX(day_number) as max_day FROM lotto_days WHERE lotto_id = ?",
    [lottoId]
  );
  const nextDayNumber = (maxDay?.max_day || 0) + 1;
  
  const result = await database.run(
    "INSERT INTO lotto_days (lotto_id, day_number, date) VALUES (?, ?, ?)",
    [lottoId, nextDayNumber, date]
  );
  
  // Aktualisiere num_days
  await database.run(
    "UPDATE lottos SET num_days = (SELECT COUNT(*) FROM lotto_days WHERE lotto_id = ?) WHERE id = ?",
    [lottoId, lottoId]
  );
  
  return result.lastID;
}

export async function updateLottoDay(dayId, gastroRevenue, donations) {
  const database = await getDatabase();
  await database.run(
    "UPDATE lotto_days SET gastro_revenue = ?, donations = ? WHERE id = ?",
    [gastroRevenue, donations, dayId]
  );
}

export async function deleteLottoDay(lottoId, dayNumber) {
  const database = await getDatabase();
  
  // Finde die lotto_day_id
  const day = await database.get(
    "SELECT id FROM lotto_days WHERE lotto_id = ? AND day_number = ?",
    [lottoId, dayNumber]
  );
  
  if (!day) return;
  
  // Lösche zuerst alle Runden dieses Tages
  await database.run(
    "DELETE FROM runden WHERE lotto_day_id = ?",
    [day.id]
  );
  
  // Lösche dann den Tag
  await database.run(
    "DELETE FROM lotto_days WHERE id = ?",
    [day.id]
  );
  
  // Aktualisiere num_days
  await database.run(
    "UPDATE lottos SET num_days = (SELECT COUNT(*) FROM lotto_days WHERE lotto_id = ?) WHERE id = ?",
    [lottoId, lottoId]
  );
}

export async function updateLotto(id, name, dateFrom, dateTo, gastroRevenue, donations) {
  const database = await getDatabase();
  
  await database.run(
    "UPDATE lottos SET name = ?, date_from = ?, date_to = ?, gastro_revenue = ?, donations = ? WHERE id = ?",
    [name, dateFrom, dateTo, gastroRevenue, donations, id]
  );
}

export async function getLottoDays(lottoId) {
  const database = await getDatabase();
  return await database.all(
    "SELECT * FROM lotto_days WHERE lotto_id = ? ORDER BY day_number ASC",
    [lottoId]
  );
}

export async function getRundenByLottoDay(lottoDayId) {
  const database = await getDatabase();
  return await database.all(
    `SELECT r.*, ld.date as day_date, ld.day_number, ld.lotto_id
     FROM runden r
     JOIN lotto_days ld ON r.lotto_day_id = ld.id
     WHERE r.lotto_day_id = ?
     ORDER BY r.rundennummer ASC`,
    [lottoDayId]
  );
}

export async function getRundenByLottoDayNumber(lottoId, dayNumber) {
  const database = await getDatabase();
  // Finde zuerst die lotto_day_id
  const day = await database.get(
    "SELECT id FROM lotto_days WHERE lotto_id = ? AND day_number = ?",
    [lottoId, dayNumber]
  );
  if (!day) return [];
  
  return await getRundenByLottoDay(day.id);
}

export async function getAllLottos() {
  const database = await getDatabase();
  return await database.all("SELECT * FROM lottos ORDER BY created_at DESC");
}

export async function getLottoById(id) {
  const database = await getDatabase();
  return await database.get("SELECT * FROM lottos WHERE id = ?", [id]);
}

export async function getRundenByLotto(lottoId) {
  const database = await getDatabase();
  return await database.all(
    `SELECT r.*, ld.day_number, ld.date as day_date
     FROM runden r
     JOIN lotto_days ld ON r.lotto_day_id = ld.id
     WHERE ld.lotto_id = ?
     ORDER BY ld.day_number ASC, r.rundennummer ASC`,
    [lottoId]
  );
}

// Konfigurationen-Funktionen
export async function createKonfiguration(name) {
  const database = await getDatabase();
  const result = await database.run(
    "INSERT INTO konfigurationen (name) VALUES (?)",
    [name]
  );
  return result.lastID;
}

export async function getAllKonfigurationen() {
  const database = await getDatabase();
  return await database.all("SELECT * FROM konfigurationen ORDER BY name");
}

export async function getKonfigurationById(id) {
  const database = await getDatabase();
  return await database.get("SELECT * FROM konfigurationen WHERE id = ?", [id]);
}

export async function addKategorieZuKonfiguration(konfigurationId, kategorieId, anzahlMin, anzahlMax) {
  const database = await getDatabase();
  const result = await database.run(
    "INSERT INTO konfigurationen_kategorien (konfiguration_id, kategorie_id, anzahl_min, anzahl_max) VALUES (?, ?, ?, ?)",
    [konfigurationId, kategorieId, anzahlMin, anzahlMax]
  );
  return result.lastID;
}

export async function getKonfigurationKategorien(konfigurationId) {
  const database = await getDatabase();
  return await database.all(
    `SELECT kk.*, k.name as kategorie_name, k.wert1, k.wert2
     FROM konfigurationen_kategorien kk
     JOIN kategorien k ON kk.kategorie_id = k.id
     WHERE kk.konfiguration_id = ?`,
    [konfigurationId]
  );
}

export async function updateKonfiguration(id, name) {
  const database = await getDatabase();
  await database.run("UPDATE konfigurationen SET name = ? WHERE id = ?", [name, id]);
}

export async function removeKategorieVonKonfiguration(konfigurationId, kategorieId) {
  const database = await getDatabase();
  await database.run(
    "DELETE FROM konfigurationen_kategorien WHERE konfiguration_id = ? AND kategorie_id = ?",
    [konfigurationId, kategorieId]
  );
}

export async function updateKonfigurationKategorie(konfigurationId, kategorieId, anzahlMin, anzahlMax) {
  const database = await getDatabase();
  const min = Math.max(0, parseInt(anzahlMin) || 0);
  const max = Math.max(min, parseInt(anzahlMax) || min);
  await database.run(
    "UPDATE konfigurationen_kategorien SET anzahl_min = ?, anzahl_max = ? WHERE konfiguration_id = ? AND kategorie_id = ?",
    [min, max, konfigurationId, kategorieId]
  );
}

export async function getKonfigurationRunden(konfigurationId) {
  const database = await getDatabase();
  return await database.all(
    `SELECT *
     FROM konfigurationen_runden
     WHERE konfiguration_id = ?
     ORDER BY sort_order ASC, id ASC`,
    [konfigurationId]
  );
}

export async function addKonfigurationRunde(konfigurationId, titel, sortOrder = 0) {
  const database = await getDatabase();
  const result = await database.run(
    "INSERT INTO konfigurationen_runden (konfiguration_id, titel, sort_order) VALUES (?, ?, ?)",
    [konfigurationId, titel, sortOrder]
  );
  return result.lastID;
}

export async function updateKonfigurationRunde(rundeId, titel, sortOrder = 0) {
  const database = await getDatabase();
  await database.run(
    "UPDATE konfigurationen_runden SET titel = ?, sort_order = ? WHERE id = ?",
    [titel, sortOrder, rundeId]
  );
}

export async function deleteKonfigurationRunde(rundeId) {
  const database = await getDatabase();
  await database.run(
    "DELETE FROM konfigurationen_runden_kategorien WHERE konfiguration_runde_id = ?",
    [rundeId]
  );
  await database.run("DELETE FROM konfigurationen_runden WHERE id = ?", [rundeId]);
}

export async function getKonfigurationRundenPreise(konfigurationRundeId) {
  const database = await getDatabase();
  return await database.all(
    `SELECT krp.*, p.name as preis_name, p.herkunft, p.preis
     FROM konfigurationen_runden_preise krp
     JOIN preise p ON krp.preis_id = p.id
     WHERE krp.konfiguration_runde_id = ?
     ORDER BY p.name ASC`,
    [konfigurationRundeId]
  );
}

export async function addPreisZuKonfigurationRunde(konfigurationRundeId, preisId, anzahl = 1) {
  const database = await getDatabase();
  const normalizedAnzahl = Math.max(1, parseInt(anzahl) || 1);
  const result = await database.run(
    "INSERT INTO konfigurationen_runden_preise (konfiguration_runde_id, preis_id, anzahl) VALUES (?, ?, ?)",
    [konfigurationRundeId, preisId, normalizedAnzahl]
  );
  return result.lastID;
}

export async function updateKonfigurationRundePreis(rundenPreisId, anzahl = 1) {
  const database = await getDatabase();
  const normalizedAnzahl = Math.max(1, parseInt(anzahl) || 1);
  await database.run(
    "UPDATE konfigurationen_runden_preise SET anzahl = ? WHERE id = ?",
    [normalizedAnzahl, rundenPreisId]
  );
}

export async function removePreisVonKonfigurationRunde(rundenPreisId) {
  const database = await getDatabase();
  await database.run(
    "DELETE FROM konfigurationen_runden_preise WHERE id = ?",
    [rundenPreisId]
  );
}

export async function getKonfigurationRundenKategorien(konfigurationRundeId) {
  const database = await getDatabase();
  return await database.all(
    `SELECT krk.*, k.name as kategorie_name, k.wert1, k.wert2
     FROM konfigurationen_runden_kategorien krk
     JOIN kategorien k ON krk.kategorie_id = k.id
     WHERE krk.konfiguration_runde_id = ?
     ORDER BY k.name ASC`,
    [konfigurationRundeId]
  );
}

export async function addKategorieZuKonfigurationRunde(
  konfigurationRundeId,
  kategorieId,
  anzahlMin,
  anzahlMax
) {
  const database = await getDatabase();
  const min = Math.max(0, parseInt(anzahlMin) || 0);
  const max = Math.max(min, parseInt(anzahlMax) || min);
  const result = await database.run(
    "INSERT INTO konfigurationen_runden_kategorien (konfiguration_runde_id, kategorie_id, anzahl_min, anzahl_max) VALUES (?, ?, ?, ?)",
    [konfigurationRundeId, kategorieId, min, max]
  );
  return result.lastID;
}

export async function updateKonfigurationRundeKategorie(
  konfigurationRundeKategorieId,
  anzahlMin,
  anzahlMax
) {
  const database = await getDatabase();
  const min = Math.max(0, parseInt(anzahlMin) || 0);
  const max = Math.max(min, parseInt(anzahlMax) || min);
  await database.run(
    "UPDATE konfigurationen_runden_kategorien SET anzahl_min = ?, anzahl_max = ? WHERE id = ?",
    [min, max, konfigurationRundeKategorieId]
  );
}

export async function removeKategorieVonKonfigurationRunde(
  konfigurationRundeKategorieId
) {
  const database = await getDatabase();
  await database.run(
    "DELETE FROM konfigurationen_runden_kategorien WHERE id = ?",
    [konfigurationRundeKategorieId]
  );
}

export async function deleteKonfiguration(id) {
  const database = await getDatabase();
  await database.run(
    "DELETE FROM konfigurationen_runden_kategorien WHERE konfiguration_runde_id IN (SELECT id FROM konfigurationen_runden WHERE konfiguration_id = ?)",
    [id]
  );
  await database.run(
    "DELETE FROM konfigurationen_runden_preise WHERE konfiguration_runde_id IN (SELECT id FROM konfigurationen_runden WHERE konfiguration_id = ?)",
    [id]
  );
  await database.run("DELETE FROM konfigurationen_runden WHERE konfiguration_id = ?", [id]);
  await database.run("DELETE FROM konfigurationen_kategorien WHERE konfiguration_id = ?", [id]);
  await database.run("DELETE FROM konfigurationen WHERE id = ?", [id]);
}

// Runden-Funktionen
export async function createRunde(lottoDayId, rundennummer, datum, einnahmen, ausgaben, kategorien, priceAmount = 0, titel = null) {
  const database = await getDatabase();

  const result = await database.run(
    "INSERT INTO runden (lotto_day_id, rundennummer, titel, additional_title_text, datum, einnahmen, ausgaben, price_amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [lottoDayId, rundennummer, titel, null, datum, einnahmen, ausgaben, priceAmount ?? ausgaben]
  );

  const rundeId = result.lastID;
  console.log(`Runde erstellt: ID=${rundeId}, lottoDayId=${lottoDayId}, Rundennummer=${rundennummer}`);

  // Kategorien zur Runde hinzufügen
  for (const kat of kategorien) {
    const anzahlMin = Math.max(0, parseInt(kat.anzahlMin) || 0);
    const anzahlMax = Math.max(anzahlMin, parseInt(kat.anzahlMax) || anzahlMin);
    const anzahl = Math.max(anzahlMin, Math.min(anzahlMax, parseInt(kat.anzahl) || anzahlMin));
    const rundenTitel = kat.rundenTitel || null;
    const rundenSortOrder = parseInt(kat.rundenSortOrder) || 0;
    await database.run(
      "INSERT INTO runden_kategorien (runde_id, kategorie_id, anzahl, anzahl_min, anzahl_max, runden_titel, runden_sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [rundeId, kat.kategorieId, anzahl, anzahlMin, anzahlMax, rundenTitel, rundenSortOrder]
    );
  }

  return rundeId;
}

export async function getAllRunden() {
  const database = await getDatabase();
  return await database.all(`
    SELECT r.*, ld.day_number, ld.date as day_date, l.name as lotto_name
    FROM runden r
    LEFT JOIN lotto_days ld ON r.lotto_day_id = ld.id
    LEFT JOIN lottos l ON ld.lotto_id = l.id
    ORDER BY r.id DESC
  `);
}

export async function getRundeById(id) {
  const database = await getDatabase();
  console.log("getRundeById aufgerufen mit:", id);
  const runde = await database.get("SELECT * FROM runden WHERE id = ?", [id]);
  if (!runde) {
    // Debug: Alle Runden-IDs auflisten
    const alleRunden = await database.all("SELECT id, rundennummer, lotto_day_id FROM runden");
    console.log("Alle Runden in DB:", alleRunden);
    console.log("Gesuchte ID:", id, "Typ:", typeof id);
  }
  return runde;
}

export async function deleteRunde(rundeId) {
  const database = await getDatabase();
  await database.run("DELETE FROM runden WHERE id = ?", [rundeId]);
}

export async function getRundenKategorien(rundeId) {
  const database = await getDatabase();
  return await database.all(
    `SELECT rk.*, k.name as kategorie_name, k.wert1, k.wert2
     FROM runden_kategorien rk
     JOIN kategorien k ON rk.kategorie_id = k.id
     WHERE rk.runde_id = ?
     ORDER BY rk.runden_sort_order ASC, rk.id ASC`,
    [rundeId]
  );
}

export async function updateRundenKategorie(rundeId, kategorieId, anzahl) {
  const database = await getDatabase();
  await database.run(
    "UPDATE runden_kategorien SET anzahl = ? WHERE runde_id = ? AND kategorie_id = ?",
    [anzahl, rundeId, kategorieId]
  );
}

export async function updateRundenKategorieRange(
  rundeId,
  kategorieId,
  anzahlMin,
  anzahlMax
) {
  const database = await getDatabase();
  const min = Math.max(0, parseInt(anzahlMin) || 0);
  const max = Math.max(min, parseInt(anzahlMax) || min);
  await database.run(
    `UPDATE runden_kategorien
     SET anzahl_min = ?,
         anzahl_max = ?,
         anzahl = CASE
           WHEN anzahl < ? THEN ?
           WHEN anzahl > ? THEN ?
           ELSE anzahl
         END
     WHERE runde_id = ? AND kategorie_id = ?`,
    [min, max, min, min, max, max, rundeId, kategorieId]
  );
}

async function getMaxVerfuegbareAnzahlFuerPreisInRunde(
  rundeId,
  preisId,
  excludeRundenPreisId = null
) {
  const database = await getDatabase();
  const basis = await database.get(
    `
      SELECT p.anzahl AS gesamt_verfuegbar, ld.lotto_id
      FROM runden r
      JOIN lotto_days ld ON r.lotto_day_id = ld.id
      JOIN preise p ON p.id = ?
      WHERE r.id = ?
    `,
    [preisId, rundeId]
  );

  if (!basis) return 0;

  const params = [basis.lotto_id, preisId];
  let excludeSql = "";
  if (excludeRundenPreisId !== null && excludeRundenPreisId !== undefined) {
    excludeSql = "AND rp.id <> ?";
    params.push(excludeRundenPreisId);
  }

  const usage = await database.get(
    `
      SELECT COALESCE(SUM(rp.anzahl), 0) AS verbraucht
      FROM runden_preise rp
      JOIN runden r ON rp.runde_id = r.id
      JOIN lotto_days ld ON r.lotto_day_id = ld.id
      WHERE ld.lotto_id = ?
        AND rp.preis_id = ?
        ${excludeSql}
    `,
    params
  );

  const gesamt = Math.max(0, parseInt(basis.gesamt_verfuegbar) || 0);
  const verbraucht = Math.max(0, parseInt(usage?.verbraucht) || 0);
  return Math.max(0, gesamt - verbraucht);
}

export async function addPreisZuRunde(rundeId, preisId, kategorieId, rundenTitel = null, rundenSortOrder = 0) {
  const database = await getDatabase();
  const normalizedTitel = rundenTitel || null;
  const normalizedSortOrder = parseInt(rundenSortOrder) || 0;
  const existing = await database.get(
    `
      SELECT id, anzahl
      FROM runden_preise
      WHERE runde_id = ?
        AND preis_id = ?
        AND COALESCE(runden_titel, '') = COALESCE(?, '')
      ORDER BY id ASC
      LIMIT 1
    `,
    [rundeId, preisId, normalizedTitel]
  );

  if (existing) {
    const maxMoeglich = await getMaxVerfuegbareAnzahlFuerPreisInRunde(
      rundeId,
      preisId,
      existing.id
    );
    const current = Math.max(0, parseInt(existing.anzahl) || 0);
    const next = Math.min(maxMoeglich, current + 1);
    if (next <= current) {
      return existing.id;
    }
    await database.run("UPDATE runden_preise SET anzahl = ? WHERE id = ?", [next, existing.id]);
    return existing.id;
  }

  const maxMoeglich = await getMaxVerfuegbareAnzahlFuerPreisInRunde(rundeId, preisId, null);
  if (maxMoeglich < 1) {
    return null;
  }

  const result = await database.run(
    "INSERT INTO runden_preise (runde_id, preis_id, kategorie_id, anzahl, runden_titel, runden_sort_order) VALUES (?, ?, ?, ?, ?, ?)",
    [rundeId, preisId, kategorieId, 1, normalizedTitel, normalizedSortOrder]
  );
  return result.lastID;
}

export async function removePreisVonRunde(rundeId, preisId) {
  const database = await getDatabase();
  await database.run(
    "DELETE FROM runden_preise WHERE runde_id = ? AND preis_id = ?",
    [rundeId, preisId]
  );
}

export async function removePreisVonRundeById(rundenPreisId) {
  const database = await getDatabase();
  await database.run("DELETE FROM runden_preise WHERE id = ?", [rundenPreisId]);
}

export async function updateRunde(id, einnahmen, ausgaben, priceAmount, additionalTitleText = undefined) {
  const database = await getDatabase();
  if (additionalTitleText === undefined) {
    await database.run(
      "UPDATE runden SET einnahmen = ?, ausgaben = ?, price_amount = ? WHERE id = ?",
      [einnahmen, ausgaben, priceAmount, id]
    );
    return;
  }

  const normalizedAdditionalTitleText = String(additionalTitleText || "").trim();
  await database.run(
    "UPDATE runden SET einnahmen = ?, ausgaben = ?, price_amount = ?, additional_title_text = ? WHERE id = ?",
    [einnahmen, ausgaben, priceAmount, normalizedAdditionalTitleText || null, id]
  );
}

export async function clearRundenPreise(rundeId) {
  const database = await getDatabase();
  await database.run("DELETE FROM runden_preise WHERE runde_id = ?", [rundeId]);
}

export async function getRundenPreise(rundeId) {
  const database = await getDatabase();
  return await database.all(
    `
    SELECT rp.*, rp.anzahl as rp_anzahl, p.name, p.herkunft, p.preis, p.gesamtpreis, p.id as preis_id, p.is_a_spende, k.name as kategorie_name
    FROM runden_preise rp
    JOIN preise p ON rp.preis_id = p.id
    JOIN kategorien k ON rp.kategorie_id = k.id
    WHERE rp.runde_id = ?
    ORDER BY rp.runden_sort_order ASC, rp.runden_titel ASC, k.name ASC, p.preis ASC
  `,
    [rundeId]
  );
}

export async function updateRundenPreisAnzahl(rundenPreisId, anzahl) {
  const database = await getDatabase();
  const target = await database.get(
    "SELECT id, runde_id, preis_id FROM runden_preise WHERE id = ?",
    [rundenPreisId]
  );
  if (!target) return 0;

  const requested = Math.max(0, parseInt(anzahl) || 0);
  const maxMoeglich = await getMaxVerfuegbareAnzahlFuerPreisInRunde(
    target.runde_id,
    target.preis_id,
    target.id
  );
  const normalized = Math.min(requested, maxMoeglich);

  if (normalized <= 0) {
    await database.run("DELETE FROM runden_preise WHERE id = ?", [rundenPreisId]);
    return 0;
  }

  await database.run("UPDATE runden_preise SET anzahl = ? WHERE id = ?", [normalized, rundenPreisId]);
  return normalized;
}

// Preishistorie: Welcher Preis wurde wann verteilt
export async function getPreisHistorie(lottoId) {
  const database = await getDatabase();
  return await database.all(`
    SELECT 
      p.id as preis_id, p.name, p.herkunft, p.preis, p.anzahl as verfuegbar,
      r.rundennummer, r.datum, r.id as runde_id,
      ld.day_number, ld.date as day_date,
      rp.anzahl as eingesetzt
    FROM runden_preise rp
    JOIN preise p ON rp.preis_id = p.id
    JOIN runden r ON rp.runde_id = r.id
    JOIN lotto_days ld ON r.lotto_day_id = ld.id
    WHERE ld.lotto_id = ?
    ORDER BY p.name ASC, ld.day_number ASC, r.rundennummer ASC
  `, [lottoId]);
}

// Verbrauchte Preise pro Lotto (Summe der eingesetzten Anzahl)
export async function getVerbrauchtePreise(lottoId) {
  const database = await getDatabase();
  return await database.all(`
    SELECT 
      p.id as preis_id, 
      p.name, 
      p.anzahl as verfuegbar,
      COALESCE(SUM(rp.anzahl), 0) as verbraucht
    FROM preise p
    LEFT JOIN runden_preise rp ON rp.preis_id = p.id
    LEFT JOIN runden r ON rp.runde_id = r.id
    LEFT JOIN lotto_days ld ON r.lotto_day_id = ld.id AND ld.lotto_id = ?
    GROUP BY p.id
    HAVING verbraucht > 0
    ORDER BY p.name ASC
  `, [lottoId]);
}

export async function getNextRundennummer(lottoDayId) {
  const database = await getDatabase();
  const result = await database.get(
    "SELECT MAX(rundennummer) as max_num FROM runden WHERE lotto_day_id = ?",
    [lottoDayId]
  );
  return (result?.max_num || 0) + 1;
}

// Preise nach Kategorie filtern
export async function getPreiseByKategorie(kategorieId) {
  const database = await getDatabase();
  const kategorie = await database.get(
    "SELECT * FROM kategorien WHERE id = ?",
    [kategorieId]
  );

  if (!kategorie) return [];

  let query;
  let params;

  if (kategorie.typ === "groesser") {
    query = "SELECT * FROM preise WHERE anzahl > 0 AND preis > ? ORDER BY preis ASC";
    params = [kategorie.wert1];
  } else if (kategorie.typ === "von_bis") {
    query =
      "SELECT * FROM preise WHERE anzahl > 0 AND preis >= ? AND preis <= ? ORDER BY preis ASC";
    params = [kategorie.wert1, kategorie.wert2];
  }

  return await database.all(query, params);
}

// Automatische Preis-Zusammenstellung für eine Runde
export async function generateRundenPreise(rundeId, zielsumme) {
  const database = await getDatabase();
  const sanitizedZielsumme = Math.max(0, Number(zielsumme) || 0);
  
  // Hole alle Kategorien der Runde mit ihren Anzahlen
  const rundenKategorien = await getRundenKategorien(rundeId);
  
  if (rundenKategorien.length === 0) {
    return { success: false, error: "Keine Kategorien in der Runde" };
  }

  // Hole die Runde um den Tag zu kennen (für Duplikat-Vermeidung)
  const runde = await getRundeById(rundeId);
  
  // Hole bereits verwendete Preis-IDs in allen Runden desselben Tages
  let usedPreisIds = [];
  if (runde && runde.lotto_day_id) {
    const usedRows = await database.all(
      `SELECT DISTINCT rp.preis_id FROM runden_preise rp 
       JOIN runden r ON rp.runde_id = r.id 
       WHERE r.lotto_day_id = ? AND r.id != ?`,
      [runde.lotto_day_id, rundeId]
    );
    usedPreisIds = usedRows.map(r => r.preis_id);
  }

  // Bereits in dieser Runde vorhandene Preise
  const eigenRows = await database.all(
    "SELECT preis_id FROM runden_preise WHERE runde_id = ?", [rundeId]
  );
  const eigenPreisIds = eigenRows.map(r => r.preis_id);

  // Hole verfügbare Preise für jede Kategorie
  const kategoriePreise = {};
  for (const rk of rundenKategorien) {
    let preise = await getPreiseByKategorie(rk.kategorie_id);
    // Keine die bereits in dieser Runde sind
    preise = preise.filter(p => !eigenPreisIds.includes(p.id));
    
    // Bevorzuge Preise die noch nicht am selben Tag verwendet werden
    const preiseOhneDoppelte = preise.filter(p => !usedPreisIds.includes(p.id));
    kategoriePreise[rk.kategorie_id] = {
      preferred: preiseOhneDoppelte,
      all: preise
    };
  }

  // Berechne Plan-Anzahl für Budgetverteilung (Mittelwert aus Von/Bis je Kategorie).
  const gesamtAnzahl = rundenKategorien.reduce((sum, rk) => {
    const { min, max } = normalizeKategorieRange(rk);
    return sum + (min + max) / 2;
  }, 0);
  
  const ausgewaehltePreise = [];
  const bereitsGewaehlt = new Set();
  let verbleibendesBudget = sanitizedZielsumme;
  const gesamtMinBudget = berechneGesamtMinBudget(rundenKategorien, kategoriePreise);
  const minPriorisiertMoeglich = gesamtMinBudget <= sanitizedZielsumme;
  
  // Für jede Kategorie Preise auswählen
  for (let idx = 0; idx < rundenKategorien.length; idx += 1) {
    const rk = rundenKategorien[idx];
    const { preferred, all } = kategoriePreise[rk.kategorie_id];
    const { min: kategorieMin, max: kategorieMax } = normalizeKategorieRange(rk);

    if (kategorieMax === 0) {
      await updateRundenKategorie(rundeId, rk.kategorie_id, 0);
      continue;
    }

    if (verbleibendesBudget <= 0) {
      await updateRundenKategorie(rundeId, rk.kategorie_id, 0);
      continue;
    }

    // Anteilige Zielsumme basierend auf Anzahl
    const planAnzahl = (kategorieMin + kategorieMax) / 2;
    const zielSummeKat = Math.min(
      verbleibendesBudget,
      gesamtAnzahl > 0 ? (sanitizedZielsumme / gesamtAnzahl) * planAnzahl : 0
    );
    
    // Bevorzuge einzigartige Preise, erlaube aber Duplikate als Fallback
    const uniquePreferred = preferred.filter(p => !bereitsGewaehlt.has(p.id));
    const uniqueAll = all.filter(p => !bereitsGewaehlt.has(p.id));
    
    let pool;
    if (uniquePreferred.length >= kategorieMax) {
      // Genug einzigartige, nicht am selben Tag verwendete Preise
      pool = uniquePreferred;
    } else if (uniqueAll.length >= kategorieMax) {
      // Genug einzigartige Preise (evtl. am selben Tag schon verwendet)
      pool = uniqueAll;
    } else {
      // Nicht genug einzigartige – erlaube Duplikate aus dem gesamten Pool
      pool = all;
    }

    if (pool.length === 0) {
      await updateRundenKategorie(rundeId, rk.kategorie_id, 0);
      continue;
    }

    const minPreis = Math.min(...pool.map((p) => p.preis));
    const reserveRest = minPriorisiertMoeglich
      ? berechneRestMinBudget(rundenKategorien, kategoriePreise, idx + 1)
      : 0;
    const budgetFuerKategorie = Math.max(0, verbleibendesBudget - reserveRest);
    const maxBezahlbareAnzahl =
      minPreis > 0 ? Math.floor(budgetFuerKategorie / minPreis) : kategorieMax;
    const minSoll = Math.max(0, Math.min(kategorieMin, maxBezahlbareAnzahl));
    const dynamischeAnzahl = chooseDynamicKategorieAnzahl({
      min: kategorieMin,
      max: kategorieMax,
      maxBezahlbar: maxBezahlbareAnzahl,
      zielSummeKat,
      preisePool: pool,
    });
    const effektiveAnzahl = Math.max(minSoll, dynamischeAnzahl);

    if (effektiveAnzahl === 0) {
      await updateRundenKategorie(rundeId, rk.kategorie_id, 0);
      continue;
    }
    
    let selected = selectPreiseGleichverteilt(pool, effektiveAnzahl, zielSummeKat, true);
    selected = selected.slice(0, effektiveAnzahl);

    // Mindestmenge bevorzugen; danach strikt im Budget bleiben.
    const minSollBudget = minPriorisiertMoeglich ? Math.min(minSoll, selected.length) : 0;
    while (
      selected.length > minSollBudget &&
      selected.reduce((sum, p) => sum + p.preis, 0) > budgetFuerKategorie
    ) {
      selected.sort((a, b) => b.preis - a.preis);
      selected.shift();
    }

    // Falls die Auswahl mit Mindestmenge noch zu teuer ist: billigste Variante versuchen.
    while (
      selected.length > minSollBudget &&
      selected.reduce((sum, p) => sum + p.preis, 0) > budgetFuerKategorie
    ) {
      selected = [...pool]
        .sort((a, b) => a.preis - b.preis)
        .slice(0, selected.length);
      selected = selected.slice(0, selected.length - 1);
    }

    // Letzte Sicherheitsstufe: Budget niemals überschreiten.
    while (
      selected.length > minSollBudget &&
      selected.reduce((sum, p) => sum + p.preis, 0) > budgetFuerKategorie
    ) {
      selected.sort((a, b) => b.preis - a.preis);
      selected.shift();
    }

    await updateRundenKategorie(rundeId, rk.kategorie_id, selected.length);
    if (selected.length === 0) {
      continue;
    }

    verbleibendesBudget -= selected.reduce((sum, p) => sum + p.preis, 0);
    
    for (const preis of selected) {
      ausgewaehltePreise.push({
        preisId: preis.id,
        kategorieId: rk.kategorie_id,
        rundenTitel: rk.runden_titel || null,
        rundenSortOrder: parseInt(rk.runden_sort_order) || 0,
      });
      bereitsGewaehlt.add(preis.id);
    }
  }

  // Gleiche Preise je Kategorie und internem Runden-Titel zusammenfassen.
  const groupedPreise = new Map();
  for (const p of ausgewaehltePreise) {
    const key = `${p.preisId}:${p.kategorieId}:${p.rundenTitel || ""}:${p.rundenSortOrder || 0}`;
    groupedPreise.set(
      key,
      (groupedPreise.get(key) || 0) + 1
    );
  }

  // Preise zur Runde hinzufügen (mit variierbarer Anzahl)
  for (const [key, count] of groupedPreise.entries()) {
    const parts = key.split(":");
    const preisIdRaw = parts.shift();
    const kategorieIdRaw = parts.shift();
    const sortOrderRaw = parts.pop();
    const titelParts = parts;
    const preisId = parseInt(preisIdRaw);
    const kategorieId = parseInt(kategorieIdRaw);
    const rundenTitel = (titelParts || []).join(":") || null;
    const rundenSortOrder = parseInt(sortOrderRaw) || 0;
    const rundenPreisId = await addPreisZuRunde(rundeId, preisId, kategorieId, rundenTitel, rundenSortOrder);
    if (count > 1) {
      await updateRundenPreisAnzahl(rundenPreisId, count);
    }
  }

  // Berechne tatsächliche Summe (Einzelpreis * Anzahl)
  const rundenPreise = await getRundenPreise(rundeId);
  const tatsaechlicheSumme = rundenPreise.reduce((sum, p) => sum + (p.preis * (p.rp_anzahl || 1)), 0);
  await database.run(
    "UPDATE runden SET ausgaben = ? WHERE id = ?",
    [tatsaechlicheSumme, rundeId]
  );

  return {
    success: true,
    anzahl: ausgewaehltePreise.length,
    zielsumme: sanitizedZielsumme,
    tatsaechlicheSumme: tatsaechlicheSumme
  };
}

function normalizeKategorieRange(rk) {
  const fallback = Math.max(0, parseInt(rk.anzahl) || 0);
  const min = Math.max(0, parseInt(rk.anzahl_min) || fallback);
  const maxRaw = parseInt(rk.anzahl_max);
  const max = Number.isFinite(maxRaw) ? Math.max(min, maxRaw) : Math.max(min, fallback);
  return { min, max };
}

function berechneGesamtMinBudget(rundenKategorien, kategoriePreise) {
  return rundenKategorien.reduce((sum, rk) => {
    const { min } = normalizeKategorieRange(rk);
    if (min === 0) return sum;
    const all = (kategoriePreise[rk.kategorie_id] || {}).all || [];
    if (all.length === 0) return sum;
    const billigster = Math.min(...all.map((p) => p.preis));
    return sum + Math.max(0, billigster) * min;
  }, 0);
}

function berechneRestMinBudget(rundenKategorien, kategoriePreise, startIndex) {
  let rest = 0;
  for (let i = startIndex; i < rundenKategorien.length; i += 1) {
    const rk = rundenKategorien[i];
    const { min } = normalizeKategorieRange(rk);
    if (min === 0) continue;
    const all = (kategoriePreise[rk.kategorie_id] || {}).all || [];
    if (all.length === 0) continue;
    const billigster = Math.min(...all.map((p) => p.preis));
    rest += Math.max(0, billigster) * min;
  }
  return rest;
}

function chooseDynamicKategorieAnzahl({ min, max, maxBezahlbar, zielSummeKat, preisePool }) {
  const obereGrenze = Math.max(0, Math.min(max, maxBezahlbar));
  if (obereGrenze === 0) return 0;

  // Budget hat Prioritaet: wenn das Minimum nicht finanzierbar ist, so viel wie moeglich nehmen.
  if (obereGrenze < min) return obereGrenze;

  const preisSumme = preisePool.reduce((sum, p) => sum + (Number(p.preis) || 0), 0);
  const durchschnitt = preisSumme > 0 ? preisSumme / preisePool.length : 0;
  const zielAnzahl = durchschnitt > 0
    ? Math.max(min, Math.min(obereGrenze, Math.round(zielSummeKat / durchschnitt)))
    : min;

  // Dynamik: leichte Zufallskomponente innerhalb der Range, aber nahe am Ziel.
  const randomAnzahl = min + Math.floor(Math.random() * (obereGrenze - min + 1));
  return Math.max(min, Math.min(obereGrenze, Math.round((zielAnzahl + randomAnzahl) / 2)));
}

// Hilfsfunktion: Preise gleichverteilt auswählen (basierend auf Einzelpreis)
function selectPreiseGleichverteilt(preise, anzahl, zielsumme, preferUnique = true) {
  if (preise.length === 0 || anzahl === 0) return [];
  const uniqueCount = new Set(preise.map((p) => p.id)).size;
  
  // 1) zuerst ohne Duplikate versuchen
  const withoutDuplicates = findBestCombination(preise, anzahl, zielsumme, false);
  if (preferUnique && uniqueCount >= anzahl && withoutDuplicates.length >= anzahl) {
    return withoutDuplicates;
  }
  const withoutDupSum = withoutDuplicates.reduce((sum, p) => sum + p.preis, 0);
  const withoutDupDiff = getBudgetScore(withoutDupSum, zielsumme);

  // 2) dann mit Duplikaten, um Zielsumme besser treffen zu können
  const withDuplicates = findBestCombination(preise, anzahl, zielsumme, true);
  const withDupSum = withDuplicates.reduce((sum, p) => sum + p.preis, 0);
  const withDupDiff = getBudgetScore(withDupSum, zielsumme);

  return withDupDiff < withoutDupDiff ? withDuplicates : withoutDuplicates;
}

// ==========================================
// EXPORT / IMPORT - Alle Daten als JSON
// ==========================================

export async function exportAllData() {
  const database = await getDatabase();
  
  const preise = await database.all("SELECT * FROM preise ORDER BY id");
  const kategorien = await database.all("SELECT * FROM kategorien ORDER BY id");
  const lottos = await database.all("SELECT * FROM lottos ORDER BY id");
  const lottoDays = await database.all("SELECT * FROM lotto_days ORDER BY id");
  const runden = await database.all("SELECT * FROM runden ORDER BY id");
  const rundenKategorien = await database.all("SELECT * FROM runden_kategorien ORDER BY id");
  const rundenPreise = await database.all("SELECT * FROM runden_preise ORDER BY id");
  const konfigurationen = await database.all("SELECT * FROM konfigurationen ORDER BY id");
  const konfigurationenKategorien = await database.all("SELECT * FROM konfigurationen_kategorien ORDER BY id");
  const konfigurationenRunden = await database.all("SELECT * FROM konfigurationen_runden ORDER BY id");
  const konfigurationenRundenKategorien = await database.all("SELECT * FROM konfigurationen_runden_kategorien ORDER BY id");
  const konfigurationenRundenPreise = await database.all("SELECT * FROM konfigurationen_runden_preise ORDER BY id");

  return {
    version: 1,
    exportDate: new Date().toISOString(),
    data: {
      preise,
      kategorien,
      lottos,
      lotto_days: lottoDays,
      runden,
      runden_kategorien: rundenKategorien,
      runden_preise: rundenPreise,
      konfigurationen,
      konfigurationen_kategorien: konfigurationenKategorien,
      konfigurationen_runden: konfigurationenRunden,
      konfigurationen_runden_kategorien: konfigurationenRundenKategorien,
      konfigurationen_runden_preise: konfigurationenRundenPreise,
    }
  };
}

export async function importAllData(jsonData) {
  const database = await getDatabase();
  
  if (!jsonData || !jsonData.data) {
    throw new Error("Ungültiges JSON-Format: 'data' Objekt fehlt");
  }

  const d = jsonData.data;

  // Reihenfolge ist wichtig wegen Foreign Keys
  await database.exec("PRAGMA foreign_keys = OFF");

  try {
    await database.exec("BEGIN TRANSACTION");

    // Alle Tabellen leeren (in umgekehrter Abhängigkeitsreihenfolge)
    await database.exec("DELETE FROM runden_preise");
    await database.exec("DELETE FROM runden_kategorien");
    await database.exec("DELETE FROM runden");
    await database.exec("DELETE FROM lotto_days");
    await database.exec("DELETE FROM lottos");
    await database.exec("DELETE FROM konfigurationen_runden_preise");
    await database.exec("DELETE FROM konfigurationen_runden_kategorien");
    await database.exec("DELETE FROM konfigurationen_runden");
    await database.exec("DELETE FROM konfigurationen_kategorien");
    await database.exec("DELETE FROM konfigurationen");
    await database.exec("DELETE FROM kategorien");
    await database.exec("DELETE FROM preise");

    // Preise importieren
    if (d.preise) {
      for (const row of d.preise) {
        await database.run(
          "INSERT INTO preise (id, name, herkunft, anzahl, preis, gesamtpreis, is_a_spende, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [row.id, row.name, row.herkunft, row.anzahl, row.preis, row.gesamtpreis, row.is_a_spende || 0, row.created_at]
        );
      }
    }

    // Kategorien importieren
    if (d.kategorien) {
      for (const row of d.kategorien) {
        await database.run(
          "INSERT INTO kategorien (id, name, typ, wert1, wert2, created_at) VALUES (?, ?, ?, ?, ?, ?)",
          [row.id, row.name, row.typ, row.wert1, row.wert2, row.created_at]
        );
      }
    }

    // Lottos importieren
    if (d.lottos) {
      for (const row of d.lottos) {
        await database.run(
          "INSERT INTO lottos (id, name, date_from, date_to, num_days, gastro_revenue, donations, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [row.id, row.name, row.date_from, row.date_to, row.num_days, row.gastro_revenue, row.donations, row.created_at]
        );
      }
    }

    // Lotto-Tage importieren
    if (d.lotto_days) {
      for (const row of d.lotto_days) {
        await database.run(
          "INSERT INTO lotto_days (id, lotto_id, day_number, date, gastro_revenue, donations) VALUES (?, ?, ?, ?, ?, ?)",
          [row.id, row.lotto_id, row.day_number, row.date, row.gastro_revenue, row.donations]
        );
      }
    }

    // Runden importieren
    if (d.runden) {
      for (const row of d.runden) {
        await database.run(
          "INSERT INTO runden (id, lotto_day_id, rundennummer, titel, additional_title_text, datum, einnahmen, ausgaben, price_amount, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [row.id, row.lotto_day_id, row.rundennummer, row.titel || null, row.additional_title_text || null, row.datum, row.einnahmen, row.ausgaben, row.price_amount, row.status, row.created_at]
        );
      }
    }

    // Runden-Kategorien importieren
    if (d.runden_kategorien) {
      for (const row of d.runden_kategorien) {
        const anzahl = Math.max(0, parseInt(row.anzahl) || 0);
        const anzahlMin = Math.max(0, parseInt(row.anzahl_min) || anzahl);
        const anzahlMax = Math.max(anzahlMin, parseInt(row.anzahl_max) || anzahlMin);
        await database.run(
          "INSERT INTO runden_kategorien (id, runde_id, kategorie_id, anzahl, anzahl_min, anzahl_max, runden_titel, runden_sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [row.id, row.runde_id, row.kategorie_id, anzahl, anzahlMin, anzahlMax, row.runden_titel || null, row.runden_sort_order || 0]
        );
      }
    }

    // Runden-Preise importieren
    if (d.runden_preise) {
      for (const row of d.runden_preise) {
        await database.run(
          "INSERT INTO runden_preise (id, runde_id, preis_id, kategorie_id, anzahl, runden_titel, runden_sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [row.id, row.runde_id, row.preis_id, row.kategorie_id, row.anzahl, row.runden_titel || null, row.runden_sort_order || 0]
        );
      }
    }

    // Konfigurationen importieren
    if (d.konfigurationen) {
      for (const row of d.konfigurationen) {
        await database.run(
          "INSERT INTO konfigurationen (id, name, created_at) VALUES (?, ?, ?)",
          [row.id, row.name, row.created_at]
        );
      }
    }

    // Konfigurationen-Kategorien importieren
    if (d.konfigurationen_kategorien) {
      for (const row of d.konfigurationen_kategorien) {
        await database.run(
          "INSERT INTO konfigurationen_kategorien (id, konfiguration_id, kategorie_id, anzahl_min, anzahl_max) VALUES (?, ?, ?, ?, ?)",
          [row.id, row.konfiguration_id, row.kategorie_id, row.anzahl_min, row.anzahl_max]
        );
      }
    }

    if (d.konfigurationen_runden) {
      for (const row of d.konfigurationen_runden) {
        await database.run(
          "INSERT INTO konfigurationen_runden (id, konfiguration_id, titel, sort_order, created_at) VALUES (?, ?, ?, ?, ?)",
          [row.id, row.konfiguration_id, row.titel, row.sort_order || 0, row.created_at]
        );
      }
    }

    if (d.konfigurationen_runden_kategorien) {
      for (const row of d.konfigurationen_runden_kategorien) {
        await database.run(
          "INSERT INTO konfigurationen_runden_kategorien (id, konfiguration_runde_id, kategorie_id, anzahl_min, anzahl_max) VALUES (?, ?, ?, ?, ?)",
          [row.id, row.konfiguration_runde_id, row.kategorie_id, row.anzahl_min, row.anzahl_max]
        );
      }
    }

    if (d.konfigurationen_runden_preise) {
      for (const row of d.konfigurationen_runden_preise) {
        await database.run(
          "INSERT INTO konfigurationen_runden_preise (id, konfiguration_runde_id, preis_id, anzahl) VALUES (?, ?, ?, ?)",
          [row.id, row.konfiguration_runde_id, row.preis_id, row.anzahl || 1]
        );
      }
    }

    await database.exec("COMMIT");
    
    const counts = {
      preise: d.preise?.length || 0,
      kategorien: d.kategorien?.length || 0,
      lottos: d.lottos?.length || 0,
      lotto_days: d.lotto_days?.length || 0,
      runden: d.runden?.length || 0,
      runden_kategorien: d.runden_kategorien?.length || 0,
      runden_preise: d.runden_preise?.length || 0,
      konfigurationen: d.konfigurationen?.length || 0,
      konfigurationen_kategorien: d.konfigurationen_kategorien?.length || 0,
      konfigurationen_runden: d.konfigurationen_runden?.length || 0,
      konfigurationen_runden_kategorien: d.konfigurationen_runden_kategorien?.length || 0,
      konfigurationen_runden_preise: d.konfigurationen_runden_preise?.length || 0,
    };

    return { success: true, counts };
  } catch (error) {
    await database.exec("ROLLBACK");
    throw error;
  } finally {
    await database.exec("PRAGMA foreign_keys = ON");
  }
}

// Finde beste Kombination (smart greedy mit Randomisierung)
// Verwendet preis (Einzelpreis) statt gesamtpreis für die Summenberechnung
// allowDuplicates: wenn true, darf der gleiche Preis mehrfach gewählt werden
function findBestCombination(preise, anzahl, zielsumme, allowDuplicates = false) {
  if (preise.length === 0) return [];
  
  if (anzahl === 1) {
    // Budget hat Priorität: bevorzugt <= Zielsumme, sonst kleinste Überschreitung.
    return [
      preise.reduce((best, p) => {
        const scoreBest = getBudgetScore(best.preis, zielsumme);
        const scoreP = getBudgetScore(p.preis, zielsumme);
        if (scoreP < scoreBest) return p;
        if (scoreP === scoreBest && p.preis > best.preis) return p;
        return best;
      })
    ];
  }

  let bestCombo = null;
  let bestScore = Infinity;
  let bestSum = -Infinity;
  
  for (let attempt = 0; attempt < 250; attempt++) {
    const selected = [];
    let currentSum = 0;
    const remaining = [...preise].sort(() => Math.random() - 0.5);
    const used = new Set();
    
    for (let i = 0; i < anzahl; i++) {
      const budgetLeft = Math.max(0, zielsumme - currentSum);
      const slotsLeft = anzahl - i;
      const idealPrice = budgetLeft / slotsLeft;
      
      // Finde den Preis der am nächsten am idealen Preis liegt
      let bestIdx = -1;
      let bestPriceDiff = Infinity;
      
      for (let j = 0; j < remaining.length; j++) {
        if (!allowDuplicates && used.has(j)) continue;
        const diff = Math.abs(remaining[j].preis - idealPrice);
        if (diff < bestPriceDiff) {
          bestPriceDiff = diff;
          bestIdx = j;
        }
      }
      
      if (bestIdx === -1) break;
      
      // Mit 45% Wahrscheinlichkeit einen zufälligen aus den Top-7 nehmen (mehr Variation)
      if (Math.random() < 0.45 && remaining.length > 3) {
        const candidates = [];
        for (let j = 0; j < remaining.length; j++) {
          if (!allowDuplicates && used.has(j)) continue;
          candidates.push({ idx: j, diff: Math.abs(remaining[j].preis - idealPrice) });
        }
        candidates.sort((a, b) => a.diff - b.diff);
        const topN = candidates.slice(0, Math.min(7, candidates.length));
        const pick = topN[Math.floor(Math.random() * topN.length)];
        bestIdx = pick.idx;
      }
      
      selected.push(remaining[bestIdx]);
      currentSum += remaining[bestIdx].preis;
      used.add(bestIdx);
    }
    
    const score = getBudgetScore(currentSum, zielsumme);
    if (score < bestScore || (score === bestScore && currentSum > bestSum)) {
      bestScore = score;
      bestSum = currentSum;
      bestCombo = [...selected];
    }
    
    // Wenn innerhalb 2%, akzeptiere
    if (zielsumme > 0 && currentSum <= zielsumme && (zielsumme - currentSum) < zielsumme * 0.02) break;
  }
  
  return bestCombo || preise.slice(0, Math.min(anzahl, preise.length));
}

function getBudgetScore(summe, zielsumme) {
  if (summe <= zielsumme) {
    return zielsumme - summe;
  }
  // Deutlich höhere Strafe für Überschreiten des Budgets.
  return 1000000 + (summe - zielsumme);
}
