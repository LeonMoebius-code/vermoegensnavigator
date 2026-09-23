# CP0A2 – deterministische Referenzen und Gleichwertigkeitsvertrag

## Zweck und Ausgangspunkt

Die kleine synthetische Referenzbasis macht ausgewählte Veränderungen vor späteren
Refactorings sichtbar. Sie ersetzt weder die bisherigen Fachtests noch eine fachliche
Entscheidung. Keine Produktionsfachlogik, Migration, Schemaänderung oder Fehlerkorrektur.

Vor Beginn am 23.09.2026 geprüft: sauberer Arbeitsbaum auf
`work/architecture-cp0a1-test-gate`, HEAD
`f3c4d82be44c988477c75b9c28f4d7763ab79b08`. Der lokale Remote-Tracking-Stand
war veraltet (`6ec5ced21704e0474dc91cc27fc5c80d7ad73792`). Nach `git fetch origin main`
entsprach der tatsächliche Remote-main dem Auftrag:
`0210f44349379db6c6f49c1bcfcc62308de95f3b` (PR #9).
Davon wurde `work/architecture-cp0a2-reference-baseline` erstellt. Keine lokalen
Änderungen verworfen. `package.json` Version 0.18.2, zehn direkte Fachtest-Einstiege,
zwei indirekte Suite-Importe, sequenzielles `verify`, `test` delegiert an `verify`.
Vorhandene Fixtures: `cp4-fixtures.ts`, `bond-final-fixtures.ts`; Technologie Node/assert,
esbuild, React-Serverrendering und SheetJS. Keine neue Abhängigkeit.

## Kategorien und Reaktion auf Abweichungen

Jede Referenz trägt maschinenlesbar `id`, `category`, `invariant`, `evidence` und
`relevance`. Die Expected Values stehen explizit neben den kleinen Ergebnisprojektionen
in `scripts/verify-cp0a2.tsx`. `scripts/cp0a2-contract.ts` definiert Kategorien,
Vergleichsregeln und Identitätskanonisierung; `scripts/cp0a2-fixtures.ts` enthält
ausschließlich erfundene Eingaben und nutzt den bestehenden synthetischen
29-Spalten-Bondgenerator. Keine realen oder aus realen Beständen anonymisierten Fixtures.

| Kategorie | Bedeutung | Behandlung einer Änderung |
| --- | --- | --- |
| A | Fachlich bestätigt durch bestehende Tests/Fachentscheidungen | Verbindlicher Gleichwertigkeitsvertrag im beschriebenen Umfang |
| B | Technisch beobachtet | Untersuchen; keine automatische Rückkehr zum Altverhalten |
| C | Bekannter Fehler/Integritätsbefund | Reproduktion, ausdrücklich kein fachlich korrekter Golden State; eigenes Bugfix-Paket |
| D | Offene fachliche Semantik | Entscheidung erforderlich; Referenz nimmt sie nicht vorweg |

Alle Kategorien stoppen bei Abweichungen das Gate und erscheinen mit ihrer Bedeutung
im Testoutput. Ein grüner C-Test bedeutet **Fehler reproduziert**, nicht Fehler behoben.
Ein späterer autorisierter Fix soll die C-Referenz bewusst ablösen. B/D dürfen nicht
allein aufgrund eines roten Tests als verbindliches Altverhalten wiederhergestellt werden.

## Referenzfallmatrix (23 Referenzen)

| ID | Kategorie | Geschützter bzw. beobachteter Sachverhalt / fachliche Quelle |
| --- | --- | --- |
| `multi-depot` | A | Zwei Depots, gleiche synthetische WKN, drei physische Holdings, zwei wirtschaftliche Positionen; Depotwert 20.000 = Holdingsumme. `verify-multi-depot.ts` |
| `ist-plan` | A | IST 20.000 unverändert; Teilverkauf 2.500, Vollverkauf 6.000, Kauf 3.000, PLAN 14.500. Aktiver und bevorzugter Plan getrennt; bevorzugte Analyse 11.500 ohne Kauf. `verify-multi-depot.ts`, `verify-asset-classification.tsx` |
| `unknown-lookthrough` | A | Unresolved-Fonds 4.000 bleibt unbekannt; unbekannter Kauf erhöht PLAN-unresolved auf 7.000, bekannte Restwerte bleiben 7.500. Keine Normalisierung auf bekannte Klassen. `verify-asset-classification.tsx` |
| `replacement-unique` | A | Eindeutige WKN übernimmt Verkauf und Holdingreferenz im betroffenen Depot. `verify-multi-depot.ts` |
| `replacement-conflicting` | A | Gleiche Holding-ID mit widersprüchlicher WKN übernimmt weder Verkauf noch Auswahl. `verify-cp4.tsx`, `verify-multi-depot.ts` |
| `replacement-ambiguous` | A | Zwei neue Holdings gleicher WKN liefern kein belastbares 1:1-Matching; anderes Depot bleibt erhalten. Gleiche Quellen |
| `generated-plan-allocation` | A | Duplikation erzeugt neue Plan-/Allokations-/Investment-ID; Kauf und gestaffelter Einstieg referenzieren die neue Allokation, Startdatum bleibt; Kopie nicht bevorzugt. `verify-modelportfolio.ts` |
| `bond-annual` | A | Rechnerisch identifiziertes Jahresmodell, YTM 5 %, Modified 0,01304631441617743, DV01 0,013819852588150074 EUR, Coverage 1 |
| `bond-ambiguous-annual` | A | Mehrdeutige Frequenz mit zulässiger Jahresannahme, YTM 6 %, Modified/DV01 0,9433962264150944, Coverage 1 |
| `bond-short-first` | A | Verkürzte erste Jahresperiode ab 27.05.2026, YTM 0,04497385868331072, Modified 4,641896780274053, DV01 0,9240948853266179 EUR |
| `bond-blocked` | A | Doppelwährungsstruktur: kein Modell, null-Kennzahlen, exakte Status-/Reason-Codes, Coverage 0, `notCalculable` |
| `bond-excluded` | A | Berechenbare Position manuell ausgeschlossen: volle Wertbasis 10.000, einbezogene Aggregatbasis 0, Coverage 0, `manuallyExcluded`, aggregierte DV01 null |
| `schema-11` | A | Aktuelles Schema, Fall-/Depot-/Holding-/Planreferenzen, Stichtage, Depotwert, kein Recovery |
| `schema-9` | A | Unterstützte historische Depotmigration zu einem Depot; Holding-/Fallidentitäten erhalten. `verify-multi-depot.ts` |
| `schema-6` | A | Historische retain-Auswahl und Depotmigration zu Schema 11. `verify-4b.ts` |
| `future-schema-recovery` | A | Schema 12 nicht importierbar, geschützt, Original unverändert erhalten und bytegenaues Recoverybackup. `verify-cp1-review.ts`, `verify-cp3.tsx` |
| `import-copy` | B | Neue Fall-ID, unveränderte innere IDs beim JSON-Kopierimport; beobachtete Semantik von `normalizeImportedCase` |
| `invalid-depot-fallback` | C | Ungültige Depot-ID wird zum ersten Depot umgebogen |
| `weak-plan-integrity` | C | Doppelte Plan-ID, fehlende aktive Referenz und zwei bevorzugte Pläne werden akzeptiert |
| `stale-local-list` | C | Speichern veralteter Liste verdrängt einen inzwischen gespeicherten gesunden Fall |
| `restore-id` | C | JSON-Kopie → tatsächlicher Restore-Handler von `ExportCenter` → `writeCaseStore`: gespeicherte ID entspricht wieder Original-ID |
| `bond-ist-xlsx-print` | A | Trotz geplantem Vollverkauf bleibt Export IST: Reihenfolge der Bond-Sheets, Zellwerte, String-/Zahltypen, keine Formeln, ausgewählte bestätigte Druckwerte |
| `general-export-scope` | D | Heute 0 Neuanlagen in bevorzugter Variante vs. 11.500 vollständiger PLAN. Ob allgemeine Struktur künftig Neuanlagen oder vollständigen ZIELPLAN abbilden soll, bleibt offen |

Quellen der Bondreferenzen: `verify-bond-final.tsx` (bestehende unabhängige
Decimal70-Kurzläuferwerte, Jahresbasismodell, verkürzte Periode und gesperrte Struktur),
`verify-cp3.tsx` (Coverage/Ausschluss und IST-Export). Kategorie A bestätigt hier die
**bestehende indikative Modellsemantik**, keine tatsächlichen Vertragscashflows.
Die vier C-Befunde sind im CP0A1-Abschnitt des README bereits dokumentiert.

## Determinismus und Identitätsintegrität

- `Date.now()`/`Math.random()` erzeugen IDs in `case-model.ts` und `depot-csv.ts`
  sowie Recovery-Schlüssel in `case-storage.ts`. `new Date()` erzeugt Metadaten,
  Planungsreferenzdaten, Bond-Fallbackdaten und den Drucktag in `page.tsx`.
- Feste fachliche Eingaben: Fall-/Plan-Erstellungsdatum `2026-01-01T12:00:00.000Z`,
  explizite Holding-Bewertungstage und Bondfälligkeiten. Bondanalysen erhalten einen
  festen Fallbacktag. Das auch fachlich genutzte Fall-Erstellungsdatum bleibt geprüft.
- Generierte IDs bleiben aktiv. Pro Szenario werden zuerst die Entities in
  Eingabereihenfolge registriert; danach ihre Referenzen aufgelöst. Ein Register bleibt
  über Original, Ersatz, Import und Kopie erhalten. Gleiche Roh-ID erhält im jeweiligen
  Namensraum stets denselben Token (`CASE_1`, `DEPOT_1`, `HOLDING_1`, `PLAN_1`,
  `ALLOCATION_1`, `INVESTMENT_1`). Neue IDs erzeugen neue Tokens. Doppelte IDs bleiben als Doppelung
  sichtbar. Unbekannte Referenzen werden getrennte `DANGLING_*`-Tokens, nie still Entities.
- Käufe bleiben ausdrücklich `purchase-ALLOCATION_n`. WKNs, Produkt-IDs, Status,
  Währungen und fachliche Daten werden nicht umbenannt. Arrays werden nicht sortiert.
  Keine pauschale Stringersetzung und kein Löschen von Identitätsfeldern.
- Die kleinen Ergebnisprojektionen lassen nur nichtfachliche Änderungszeitstempel,
  zufällige Recovery-Dateischlüssel, temporäre Pfade und den aktuellen Drucktag weg.
  Backup-Anzahl und Originalinhalt bleiben geprüft; das Original wird exakt verglichen.
  Kein Vollzustand-Snapshot. Die lokale Unverändertheitsassertion für IST vergleicht
  zusätzlich den kompletten Fall vor/nach Analyse, ohne ihn zu versionieren.
- Die ganze Suite erzeugt ihre Fälle zweimal unabhängig und vergleicht die kanonischen
  Ergebnisse exakt. Selbstprüfungen stellen sicher, dass umgebogene Referenzen,
  unterschiedliche unbekannte IDs, subcentgenaue Abweichungen und null/NaN auffallen.
- Ein minimaler Node-Adapter bestätigt den tatsächlichen Restore-Handler über ein
  temporäres `window.confirm`; `window` wird im `finally` wiederhergestellt. Das ist
  keine Browserautomation. XLSX-Dateien entstehen nur in einem isolierten temporären
  Verzeichnis und werden im `finally` entfernt.

## Vergleichsvertrag und Zahlen

Standard ist `exact` (strukturierter strikter Vergleich). Identitäten, Referenzen,
Kategorien, Status, Reason-Codes, Auswahlzustände, Counts, Modellstatus/-qualität,
Währungen, fachliche Daten und relevante Reihenfolgen werden exakt verglichen.
`null` bedeutet nicht 0; NaN ist kein zulässiger Kennzahlenwert.

`cent` validiert zunächst, dass beide Zahlen bereits auf einem sicheren Cent-Raster
liegen, und vergleicht anschließend exakt. Es findet **keine Rundung des Testresultats**
statt. Die gewählten Depot-/Planbeträge sind glatte synthetische Euro-/Centwerte.
Andere Geldwerte werden nicht pauschal auf Cent reduziert: Der synthetische Bondwert
`10592.917767817604` bleibt beispielsweise als numerischer XLSX-Rohwert exakt erhalten,
während seine bestätigte Darstellung `10.592,92 EUR` separat geprüft wird.

Für jeden der drei modellierbaren Bondfälle sind YTM, Modified Duration und DV01 mit
einer **je Feld und Fall expliziten absoluten Toleranz 1e-8** versehen. Diese stammt aus
den passenden Assertions in `verify-bond-final.tsx`; sie ist kein allgemeines Epsilon.
Die erwartete Jahresmodell-DV01 folgt dem vorhandenen Decimal70-Preis mal Modified
Duration mal 0,0001; beim Einjahresfall beträgt Modified Duration 1/1,06.
Coverage 0/1, Ausschlussgruppen und Modellstatus werden in diesen Fällen exakt geprüft.
Keine Übertragung der Toleranzen auf andere Referenzfälle oder Geldbeträge.

XLSX wird nach echtem Export wieder eingelesen: Blattname/-reihenfolge, fachliche
Zellwerte, `t` (String/Zahl) und `f` (Formelstatus). Kein ZIP-Binärvergleich.
Formelartiger synthetischer Text `=1+1` muss String ohne Formel bleiben.
Druckprüfung vergleicht ausgewählte bestätigte Markupwerte und Abschnittsreihenfolge,
keinen vollständigen HTML-Snapshot, keine CSS-Darstellung oder PDF-Paginierung.

## Gate und Grenzen

`npm run test:cp0a2` startet `scripts/verify-cp0a2.tsx` mit vorhandener esbuild-Technik.
Die neue Suite importiert **keine** bestehende Verify-Suite. Alle zehn bisherigen
direkten Fachtests bleiben unverändert; die zwei indirekten Tests bleiben genau einmal
über CP1 bzw. CP4 eingebunden. CP0A2 läuft genau einmal an Position 11,
zwischen `test:bond-final` und `typecheck`; `build` bleibt letzter Schritt.
`npm test` delegiert weiterhin vollständig an `verify`. Die CI ruft weiterhin nur
`npm run verify` plus den bestehenden Whitespace-Check auf; keine Workflowänderung.
Der Typecheck umfasst zusätzlich CP0A2 und dessen importierte Helfer/Fixtures.

Lokale Abnahme: `npm run test:cp0a2`, `npm run verify`, `npm test`,
`git diff --check` sowie manuelle Diff- und Gate-Importprüfung. Unter Windows war für
Git Bash zusätzlicher Prozesszugriff nötig (Signal-Pipe-Sperre der Sandbox); die
Skripte selbst wurden deshalb nicht geändert. Ergebnisse und tatsächlicher CI-Lauf
stehen im zugehörigen PR und Abschlussbericht.

CP0A2 schützt nur diese Projektionen. Kein vollständiger Zustandsvertrag, keine reale
Depotvalidierung, kein Architekturrefactoring, keine Produktänderung und keine neue
Exportentscheidung. Restore-ID bleibt ein priorisiertes separates Bugfix-Paket;
auch lokale Listenkonflikte, Depotnormalisierung und Planintegrität bleiben unverändert.
CP0B übernimmt später vollständige Browserabläufe; Browser-E2E, visuelle Regression,
native Excel-Abnahme und native Druck-/PDF-Paginierung sind hier nicht enthalten.
Merge, Auto-Merge und Deployment gehören nicht zur CP0A2-Abnahme.
