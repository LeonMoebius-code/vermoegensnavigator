# V0.18.2 CP1 – unabhängiger technischer Review

Review am 17.09.2026. Repository `LeonMoebius-code/vermoegensnavigator`, Branch `work/v0182-bond-hardening`.

## Grundlage und Umfang

Nach sauberem `git status` wurde `git fetch origin` ausgeführt. Tatsächlicher Remote-Feature-Commit: `97704a09ff6c6c5b0dbc82818104a4e366a3075b`; Remote-main und gemeinsamer Vorfahr: `3c5fd20bb13698db4436c0ba6be3e767d340d6d7`. Der lokale main war älter; geprüft wurde ausdrücklich der neu abgerufene Feature-Branch. Keine lokalen Änderungen überschrieben, kein Reset oder Force-Push. CP1 war nicht in main integriert.

Geprüft wurden der vollständige CP1-Diff (12 Dateien), betroffene Aufrufer in `page.tsx`, Normalisierung, Depot-Lifecycle, Speicher-/Löschwege, JSON, Snapshot/Restore, Modellaktionen, CSV, Klassifikation, Excel-/Druckpfad, Tests und beide Workflows. Maßstab: Zero-Touch-Nachtrag, CP1/Gates im Workpaket sowie relevante Preflight-Abschnitte. Der bisherige Implementierungsnachweis wurde als zu überprüfende Behauptung behandelt.

Die ursprüngliche CP1-Suite bestand. Anschließend scheiterten **alle acht zuerst ergänzten unabhängigen Gegenbeispiele gegen den unveränderten Produktionsstand**. Erst danach wurden die Korrekturen vorgenommen. Alle Fixtures sind synthetisch.

## Bestätigte Findings und Korrekturen

| ID / Priorität | Datei und Funktion | Ursache und reproduzierbares Gegenbeispiel | Auswirkung und Korrektur |
| --- | --- | --- | --- |
| F1 / P1 | `app/case-model.ts`: `importedHoldings`, `replacementHoldingIdMap`, `replaceDepotAccount` | Alt: ID `a`, WKN `AAAAAA`, sowie ID `b`, Name „Zweiter Titel“, ohne WKN. Neu: ID `a`, WKN `BBBBBB`, Name „Zweiter Titel“. Die ID-Reparatur entfernt den Konflikt aus der Matching-Evidenz; danach übernimmt der Namensfallback Referenz und Verkauf von `b`. Auch der reine Mapper lässt nach gescheiterter ID-Stufe schwächere Matches zu. | Verkaufsabsichten/Planreferenzen werden einem nicht sicher identifizierten Titel zugewiesen. Matching verwendet jetzt ursprüngliche IDs; explizite Konflikte werden für weitere Stufen gesperrt. Erst die geprüfte Tabelle wird auf endgültige Speicher-IDs übersetzt. Ausgeschlossene doppelte IDs zählen weiterhin bei der WKN-/Fallback-Mehrdeutigkeit mit. Test prüft die Tabelle, endgültigen Plan und Verkauf. |
| F2 / P1 | `app/case-model.ts`: `normalizeImportedCase`; `app/case-storage.ts`: Lade-/Schreibpfad | Ein vorhandenes `depot: { lost: "synthetic-original" }` wird zu `[]`, als gesunder Fall geladen und beim Speichern ohne Originalsicherung überschrieben. Dasselbe Muster betrifft falsche Container für DepotAccounts, Versionen und Sparziele. | Recoverable Originaldaten gehen verloren. Vorhandene falsch typisierte Container werden jetzt fallweise abgelehnt und unverändert geschützt. Fehlende Legacy-Collections bleiben migrierbar. Tests speichern und löschen gesunde Nachbarfälle und prüfen Originaleintrag sowie bytegenaue Sicherung. |
| F3 / P1 | `app/case-model.ts`: `normalizeImportedCase` | Zwei DepotAccounts mit derselben ID werden akzeptiert. Replacement/Delete grenzen über genau diese ID ab und können die beiden Accounts nicht mehr auseinanderhalten. | Depotidentität und Schutz fremder Depots sind nicht gewährleistet. Fehlende/ungültige bzw. doppelte Account-IDs werden vor Normalisierung abgelehnt; der lokale Originalfall bleibt geschützt. |
| F4 / P1 | `app/depot-csv.ts`: `parseCsv` | Pflichtmarktwert `1"2"3` wird vor der strikten Zahlenprüfung zu `123`; `"100"0` zu `1000`. Der Quote-Toggle entfernt unerlaubte Zeichen und macht ungültige Zahlen gültig. | Ein fehlerhafter Pflichtwert kann das Depot ersetzen. Quotes dürfen jetzt nur ganze Felder umschließen; Zeichen nach dem schließenden Quote werden abgewiesen. Zweizeilige Tests belegen atomaren Abbruch, korrekt maskierte Quotes/Semikola bleiben unterstützt. |
| F5 / P2 | `app/depot-csv.ts`: `parseDepotCsv` | Strukturzeile mit leerer Bezeichnung, Marktwert `0`, WKN `SYN001`, Nominal `1000` wird durch `row.name || row.value > 0` entfernt. | Physischer Bestand verschwindet beim Replacement. Jede validierte Datenzeile bleibt jetzt erhalten; Test umfasst Parser, Replacement, Depotwert und JSON-Normalisierung. Dies ändert keine Bondleiter/-mathematik aus CP2/CP3. |
| F6 / P2 | `app/case-storage.ts`: `writeCaseStore` | Ein unverändert defekter Nachbarfall erzeugt bei jedem gesunden Speichern und Löschen eine weitere Vollsicherung; acht Speicherungen plus Löschung ergeben neun Sicherungen. | LocalStorage füllt sich vermeidbar, weitere Speicherungen können scheitern. Vorhandene Originalsicherungen werden anhand sämtlicher zu schützender Originaleinträge einschließlich Duplikatanzahl verifiziert und wiederverwendet. Neue/geänderte beschädigte Daten erzeugen weiterhin eine neue bytegenaue Originalsicherung. |
| F7 / P2 | `app/case-storage.ts`: `writeCaseStore` | Direkter Aufruf mit zwei Fällen gleicher ID schreibt erfolgreich; beim Reload schützt `readCaseStore` beide als beschädigt, beide verschwinden aus der normalen Fallliste. | Der Schreibpfad erzeugt selbst einen unladbaren Bestand. Fehlende/doppelte Fall-IDs sowie strukturell ungültige Schreibkandidaten werden jetzt vor jeder Speicherung abgelehnt. Bestehende doppelte Original-IDs bleiben vollständig recoverable. |
| F8 / P2 | `app/depot-analysis.ts`: `classifyDepotProduct` | `securityType=Festverzinsliche` plus Name „Synthetisches Zertifikat“ oder „Synthetic Stripped Bond“ ergibt `bondKind=fixed`; das neue Namensveto enthält diese bereits anderweitig erkannten Sonderformen nicht. | Erkannte Sonderformen gelangen in das Standardbondmodell. Veto um Zertifikate/Stripped und einschlägige deutsche Wortformen ergänzt; Zertifikate bleiben strukturierte Produkte. Keine Vertragsdaten werden aus Namen erfunden. |

Alle acht Findings sind behoben. Der zusätzliche Duplikat-/WKN-Test sichert ausdrücklich sowohl den direkt aufgerufenen Mapper als auch den gesamten Replacement-Pfad; er verhinderte auch eine Regression während der Korrektur von F1.

## Kritische Pfade ohne weiteren bestätigten CP1-Defekt

- **Depotwert:** Zwei Holdings 40.000 + 60.000 bei veraltetem Gesamtwert 1; direkte Mutation 0/1 und `hasDepot=false`, Einzeländerung, letztes Holding löschen, leere Accounts, manuelle Erfassung ohne Holdings, Snapshot/Restore ohne Originalmutation, Fallkopie, Speicherung/Laden, JSON und Multi-Depot-Export geprüft. Das echte gerenderte Eingabefeld ist readonly; die konkrete Depotkennzahl im Druck-HTML und die durch den echten Excel-Button erzeugte Workbook-Zelle enthalten 100.000. Root-State-Guard und tatsächliche Aufrufer wurden kontrolliert.
- **Replacement:** Starke WKN-/productId-Konflikte, sichere IDs, WKN-Mehrdeutigkeit, Reorder, fehlende/doppelte IDs, schwacher Namensfallback ohne widersprechende Identität, Sale-Clamp, endgültige Selektionen, Löschen und unveränderte fremde Holdings. Es gibt weiterhin eine gemeinsame Mappingtabelle für Sale und Planreferenzen.
- **CSV:** Navigator und Strukturübersicht; fehlende/negative/ungültige Pflichtwerte, gültige erste Zeile vor defekter zweiter Zeile, Überlauf, `n/a`, `5abc`, `1e3`, NaN/Infinity, ungültige Kalenderdaten, echte Null und optionale Fehler mit feldbezogenen Gründen. `1.234` bleibt absichtlich mehrdeutig: Ohne festgelegte Locale ist sowohl 1234 als auch 1,234 denkbar. `1234`, `1.234,56`, `1234.56` und gruppierte Leerzeichen werden korrekt unterschieden. Keine spekulative Locale-Umstellung. Das bestehende Geldmarkt-Enum wurde zusätzlich durch den echten CSV-Pfad geprüft und funktioniert.
- **Modellportfolio:** Alle drei direkten Produktionsfunktionen blockieren fehlende, doppelte, negative, nichtendliche oder artfalsche strategische Töpfe sowie fehlende/falsche/gemischte Kapitalreferenzen und negative/nichtendliche Beträge. Vorhandene gültige Fälle einschließlich bewusster Überplanung bleiben durch die bestehende Suite abgesichert. Kein weiterer Defekt nachgewiesen.
- **Ladeschutz:** Gesunder und defekter Nachbarfall, optionale Holdingkorruption, Normalisierungs-Exception, insgesamt kaputtes JSON, doppelte Fall-IDs, zukünftiges Schema, Sicherungs-Exception, still fehlgeschlagene Sicherung mit Verifikation, erfolgreicher Backup plus fehlgeschlagener Hauptschreibvorgang, Folgespeicherung bei begrenztem Platz, neue beschädigte Originaldaten und Löschung gesunder Fälle geprüft. Originale bleiben erhalten; aktive Daten werden erst nach erfolgreichem Schreiben als gespeichert übernommen.

## Geänderte Dateien und Verifikation

Reviewkorrekturen in `app/case-model.ts`, `app/case-storage.ts`, `app/depot-csv.ts`, `app/depot-analysis.ts`; erweitert `scripts/verify-cp1.tsx`, neue `scripts/verify-cp1-review.ts` und dieser Bericht. Die neue Datei wird von der obligatorischen CP1-Suite importiert und dadurch auch vom Typecheck erfasst. Kein zusätzliches optionales CI-Gate.

Lokal bestanden:

- `npm run test:cp1`: bestehende A–E-Prüfungen plus 13 zusätzliche benannte Review-Tests, konkrete Druck-Depotkennzahl und echter Excel-Export.
- `npm run test:multi-depot`: 58 Assertions.
- `npm run test:modelportfolio`: 16 bestehende Assertions, zusätzlich erweiterte direkte Negativfälle in CP1.
- `npm run test:3b`, `npm run test:4b`, `npm run test:risk-v2`.
- `npm run typecheck`, `npm run build` (ausschließlich lokaler Build).
- `git diff --check` sowie Prüfung des gesamten Branch-Diffs gegen `origin/main`.

Git Bash benötigte auf Windows Ausführung außerhalb der Sandbox, weil deren Signal-Pipe-Erzeugung dort verweigert wurde; derselbe konfigurierte npm-Testbefehl wurde anschließend erfolgreich ausgeführt. Keine Abhängigkeiten neu installiert und keine Gate-Skripte umgangen.

**Nicht ausgeführt:** interaktiver Browser-E2E-Test und tatsächlicher Druckdialog/PDF-Layouttest. Die Prüfungen von UI und Druck erfolgen per React-Rendering; Excel wird tatsächlich erzeugt und eingelesen. Die vollständige CP4-Sichtabnahme wird damit nicht behauptet.

## Integrationsbewertung

Keine offenen nachgewiesenen CP1-Blocker nach diesen Korrekturen. CP1 ist nach erfolgreicher Feature-CI auf dem final gepushten Commit technisch zur Integration bereit. Finaler Commit, Push-Nachweis, PR-Link und CI-Run werden im Abschlussbericht ausgewiesen. Freigabe bezieht sich ausschließlich auf CP1; V1-Bondmathematik ist keine V2-Freigabe. Schema bleibt 10 und Anwendungsversion 0.18.1. Keine CP2-Umsetzung, kein Merge und kein Deployment im Rahmen dieses Auftrags.
