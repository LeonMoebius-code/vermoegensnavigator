# P2: Depotreferenzintegrität

Ausgangs-main: `4ad0f4131d4d106cd721418d124dc2aa113f1998` (P1, PR #16),
am 30.09.2026 durch Remote-Fetch bestätigt. Sauberer Arbeitsbaum, keine offenen
PRs. Branch: `work/architecture-p2-depot-integrity`.

## Problem und verbindliche Invariante

`invalid-depot-fallback` wies bisher fehlende oder ungültige `DepotHolding.depotId`
still dem ersten Depot zu. Das kann eine physische Position der falschen
Verwahrstelle zuordnen. Jede persistierte Holding eines Multi-Depot-Falls muss
eine nichtleere String-ID besitzen, die exakt einem vorhandenen, eindeutig
identifizierten `DepotAccount.id` entspricht. Depotnamen sind keine Identität.

## Normalisierung und historische Migration

`normalizeImportedCase` bleibt der einzige gemeinsame Normalisierungsweg.
DepotAccount- und Holding-Strukturprüfung bleiben erhalten. Nach dem Klonen
wird ausschließlich im echten Legacypfad ein Migrationsziel erzeugt:

| Quellstruktur | Ergebnis |
| --- | --- |
| Schema < 10, konkrete Holdings, keine DepotAccounts | Genau ein neues `Depot 1`; alle historischen Holdings diesem Depot zuordnen. Holding-IDs, Verkäufe und gültige `depotHoldingIds` erhalten; Depotwert aus Holdings ableiten; Ergebnis Schema 11. |
| Schema < 10 mit vorhandenen DepotAccounts | Gültige Zuordnungen erhalten. Fehlende, leere oder ungültige Zuordnung ablehnen: Es wurde kein eindeutiges Migrationsdepot erzeugt. |
| Schema >= 10 (unterstützt: 10/11), konkrete Holdings | Jede Zuordnung muss gültig sein; fehlende, leere, nicht-stringförmige oder dangling `depotId` führt für den gesamten Fall zu `null`. |
| Schema >= 10, Holdings ohne DepotAccounts | `null`, kein künstliches Depot. |
| Leere Holdings und leere DepotAccounts, auch Schema 9 | Gültig; kein künstliches leeres Depot. |

Es gibt keinen allgemeinen Fallback auf das erste Depot, keine Namensheuristik,
keine Löschung fehlerhafter Holdings und keinen normalen Zustand „Ohne Depotzuordnung“.
Gültige Depot-/Holding-IDs, Inhalte, Zuordnungen und Plan-Holding-Bezüge bleiben
erhalten. Erfolgreiche Migration und Ablehnung verändern das Quellobjekt nicht.
Bestehende optionale Feldnormalisierung und Zeitstempelsemantik bleiben bestehen.

## Persistenz, Recovery, Import und Restore

`readCaseStore` behandelt einen aktuellen Fall mit ungültiger Depotzuordnung als
Protected Entry: nicht in `cases`, Original in `protectedEntries` und
`recoveryEntries`, `recoveryNeeded=true`. Gesunde Nachbarn bleiben nutzbar;
gültiges Store-JSON bleibt `malformed=false`.

Der gemeinsame [P1-Schreibpfad](P1_Sichere_Fallpersistenz.md) nutzt dieselbe
Normalisierung zur Kandidatenprüfung. `saveCaseToStore`, `insertCaseIntoStore`
und `writeCaseStore` lehnen neue ungültige Fälle vor einem Schreibvorgang ab.
Beim Speichern gesunder Nachbarn bleiben geschützte Originalblöcke strukturell
unverändert; das erforderliche Backup enthält den bytegenauen ursprünglichen
Store. Ein verifiziertes Backup wird wiederverwendet, ohne Backup-Spam.
Recoverable bedeutet Erhalt des Originals und Nutzbarkeit gesunder Nachbarn;
die Anwendung kann daraus keine richtige Depotzuordnung automatisch ermitteln.

Der [P4-Importvertrag](P4_Copy_Import_Vertrag.md) bleibt für gültige Fälle erhalten:
neue äußere Fall-ID, gültige innere IDs und historische Snapshots erhalten,
Einfügen über `insertCaseIntoStore`. Ein ungültiger aktueller JSON-Import wird
über die bestehende Fehlerbehandlung abgewiesen; Store, aktiver Fall und Ansicht
bleiben erhalten. Keine neue Reparatur-UI.

Versions-Restore normalisiert die Arbeitskopie mit
`normalizeImportedCase(version.snapshot, false)`. Bei `null` erzeugt der bestehende
Handler keinen neuen Arbeitsstand. Gültiger Restore erhält weiterhin aktuelle
Fall-ID und gesamte Historie. Historische Snapshots werden nicht rückwirkend geändert.

`addDepotAccount`/`replaceDepotAccount` setzen das konkrete Importziel;
`deleteDepotAccount` entfernt dessen Holdings; normale `setCaseDepot`-Aufrufe
bearbeiten vorhandene Holdings oder entfernen sie. Diese produktiven Aufrufe
halten die Invariante bereits ein; kein Lifecycle-/CSV-Produktdiff erforderlich.

## Ausführbare Absicherung und Grenzen

`npm run test:p2-depot-integrity` führt
[`scripts/verify-p2-depot-integrity.ts`](../scripts/verify-p2-depot-integrity.ts)
aus. Acht synthetische Testgruppen prüfen gültige Schema-10/11-Fälle mit zwei
Depots und drei Holdings, ungültige Referenzvarianten, echte Schema-9-Migration,
Legacy mit vorhandenen Accounts, leere Fälle, Input-Unveränderlichkeit, Protected
Entries/gesunde Nachbarn, bytegenaue Backup-Wiederverwendung, Save-/Insert-/Write-
Ablehnung und normale Depot-Lifecycle-Aufrufe. Keine Produktionsnormalisierung
wird im Test nachgebaut.

CP0A2 prüft zusätzlich den tatsächlichen Restore-Handler mit einem ungültigen
Schema-11-Snapshot: keine Stateänderung, Live-Fall/Historie unverändert. Die
bestehenden gültigen Restore-ID-Assertions bleiben aktiv.
Die CP4-Altschema-Fixture entfernte bisher auch für Schema 10 alle DepotAccounts.
Das ist synthetische Korruption, kein dokumentierter historischer Vertrag: Die
Multi-Depot-Spezifikation verlangt seit Schema 10 persistierte gültige Zuordnungen.
Die Fixture entfernt Accounts jetzt nur vor Schema 10; ihre Bondprovenienz-,
Snapshot- und Restoreprüfungen bleiben unverändert erhalten.
CP0B ergänzt einen benannten P2-Schritt im vorhandenen Planungs-/Fallidentitäts-
Lebenszyklus: echter Sicherungsdownload, ausschließlich `depotId` einer Holding
beschädigen, echter JSON-Dateiimport, sichtbare Ablehnung, Storebytes und aktiven
Fall einschließlich Depotzuordnung vergleichen. Danach läuft der Lifecycle weiter;
es bleiben genau drei Browserfälle.

Das sequenzielle Fail-Fast-Gate führt CP0A2 → P4 → P1 → P2 → P3 → Typecheck → genau
einen Produktionsbuild → CP0B aus. `npm test` delegiert an `verify`; P2 ist im
bestehenden Typecheck enthalten. Keine neue Dependency oder Workflowänderung.

CP0A2: **20 A / 0 B / 2 C / 1 D → 21 A / 0 B / 1 C / 1 D**.
Ausschließlich `invalid-depot-fallback` wechselte in P2 C → A.
Aktuell nach [D1](D1_Ergebnis_Export_Sichtenvertrag.md): **23 A / 0 B / 0 C / 0 D**.
`weak-plan-integrity` ist zusätzlich A; aktuelle Plangraphen werden vor
destruktiver Normalisierung geprüft. P2-Depotreferenzen, P1-Recovery und
historische Migrationen bleiben erhalten. `general-export-scope` ist durch D1 A.

Schema **11**, Speicherfelder und ID-Semantik bleiben unverändert. P2 umfasst
keine vollständige Planintegrität (P3), keine neue Planreferenzprüfung, keine
automatische Recovery-Zuordnung, keine Reportingentscheidung, keine allgemeine
Architekturmodernisierung, keinen Release, Rollback oder Deployment. Historische
R1-Evidenz und GitHub-Einstellungen bleiben unverändert.
