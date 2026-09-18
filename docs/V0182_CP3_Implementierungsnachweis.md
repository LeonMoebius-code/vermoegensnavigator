# V0.18.2 – CP3: Aggregate, PLAN, Bestand und gemeinsame Ausgabe

Stand: 18.09.2026. Ausschließlich CP3 auf `work/v0182-bond-hardening`.
Nach erfolgreichem Fetch waren lokaler Branch und Remote identisch bei
`404661dee218081025fa7279f0cc56021e198ea1` (CP2); kein Pull/Merge erforderlich.
Ausgangs-main weiterhin `3c5fd20bb13698db4436c0ba6be3e767d340d6d7`.
CP1 und CP2 wurden nicht erneut allgemein reviewed. Ihre Regressionen bleiben
Bestandteil des Gates. Anwendungsversion 0.18.1 und Schema 11 unverändert.

Verbindliche Grundlage: Arbeitspaket §4, Zero-Touch-Nachtrag insbesondere §§1,
4–5, 7–10, Fachkonzept §§6–11, kompatible Preflight-Präzisierungen §§5–8 und
CP2-Implementierungsnachweis. Kein Merge, Deployment, Releaseabschluss oder CP4.

## 1. Vollständig implementierte CP3-Funktionen

| Anforderung | Umsetzung / Nachweis |
| --- | --- |
| Getrennte Kennzahl-Coverages | Eigene Teilmengen für YTM, laufende Verzinsung, Modified und DV01; Datum- und Nominalleiter-Coverage separat. Nur Coverage benutzt den vollständigen direkten Bondnenner einschließlich Ausschlüssen. |
| Disjunkte Einbeziehung | `includedAndCalculable`, `manuallyExcluded`, `notCalculable` mit Anzahl und belegbarem EUR-Wert je Kennzahl. Manuell ausgeschlossene unvollständige Positionen zählen nur einmal; technische V2-Status bleiben separat unverändert. |
| Portfolioaggregate | Marktwertdurchschnitte ausschließlich gültiger, positiv bewerteter, gewählter und EUR-vergleichbarer Teilmengen. Kein Depot-Cashflow-IRR. Bekannter EUR-Teilbestand bleibt bei unbekanntem Rest berechenbar; volle EUR-Coverage dann null. |
| Null / nicht berechenbar | Leerer Bestand und reiner Nullwertbestand: Coverage nicht anwendbar bei bekannter Wertbasis; unbekannte Wertbasis nicht ermittelbar. Positiver belegter Bestand ohne gültige Kennzahl: 0 % Coverage, Kennzahl null. Echte laufende Verzinsung 0 bleibt 0. Summen-/Aggregatüberlauf wird nicht als NaN/Infinity angezeigt. |
| Checkbox | Genau eine freiwillige Einbeziehungscheckbox je physischer Holding; keine Begründung, Bestätigung, Stammdatenmaske oder zusätzliche Auditliste. Einzelkennzahlen bleiben sichtbar. |
| Lifecycle | Vorhandenes Schema-11-Flag bleibt in Save/Load, Fallkopie, JSON und Snapshot/Restore. Replacement übernimmt es ausschließlich über die vorhandene endgültige konfliktfreie depotbegrenzte 1:1-Zuordnung. Neue Quelle bleibt Quelle; keine alte Profilübernahme. Mehrdeutigkeit/WKN-Konflikt: Flag false, Sale/Referenzen nicht übernommen. |
| PLAN | Reine Ableitung aus IST; positive Ausgangsbewertung: Restwert und skalierbare Nominal-/absolute AI-Beträge proportional. Bereits gültige IST-per100-Kennzahlen werden weiterverwendet, absolute DV01 skaliert. Kein erneutes Pricing mit altem AI und neuem Nominal. Nicht proportionale/unklare Mengenbasis bekommt kein erfundenes Restnominal/DV01. |
| Vollverkauf und Nullmarktwert | Vollverkauf einer vorher positiv bewerteten Holding entfernt sie aus PLAN und dessen Nenner/Leiter; IST bleibt erhalten. Ausgangswert 0 wird niemals als Vollverkauf aus `plannedSale=0` interpretiert. Keine 0/0-Mengenquote. |
| Physische Leiter | Direkte Holdings unabhängig von YTM und Checkbox. Jahr, Nominalwährung und Überfälligkeitsstatus getrennt; kein EUR+USD-Nominaltotal. Ausschlussanzahl/-nominal/-marktwert sowie Nullwertanzahl/-nominal je Gruppe. Datum ohne Nominal/Währung zählt nicht als nominalfähige Leiter. Keine Rückzahlungsgarantie. |
| Sonstige Depotanalyse | Allgemeine Positions-/Verteilungsansichten behalten ihren bisherigen Nullwertfilter. Der gemeinsame Bondbuilder fordert ausdrücklich die physische Bondansicht an. Marktwerte, Vermögenshaus, Produktverteilung und Einstand werden durch Checkbox/Quellenblocker nicht reduziert. |
| Szenarien | Lineare Verschiebung der modellierten Bondrenditen um −100/−50/+50/+100 bp über die gültige gewählte DV01-Teilmenge. Leere Teilmenge null. Kein Credit-/FX-/Kurvenmodell. |
| Verständliche Anzeige | Überblick mit vier Kennzahlen und individuellen Coverages; Modified im Überblick einmal. Danach Szenarien, Währungsleiter, depotbezogene Einzelpositionen, Modellannahmen. Aufklappbare Coverage-/Datenstatusdetails, deutsche Fehlgründe, Stichtage/mixed dates, Heute-Fallback, lokale DV01-Währung und Kurzläuferhinweise. |
| Gemeinsamer IST-Exportbuilder | `buildBondAnalysisData` verbindet allein den vorhandenen Bond-V2-Rechenweg mit Darstellungsdaten. `buildBondIstExportData` fixiert IST unabhängig vom Plan. Excel und Druck übernehmen dieselben Zahlen, Coverage, Szenarien, Leiter, Einzelwerte, Einbeziehung, Fehlgründe, Quellen- und Kalenderkonvention. Nullwertbestand wird anhand Positionsanzahl exportiert. |

Rechenarchitektur: `analyzeBondV2` bleibt der einzige Einzelrechenweg. CP3 ergänzt
Aggregation und proportionale Bestandsableitung in `depot-analysis.ts`.
`bond-analysis-data.ts`, React und Export implementieren keine YTM-/Duration-
oder Dirty-Preisrechnung. Transiente `bondBase`/`quantityScale` werden nicht im
Fall gespeichert; keine zweite persistente Kennzahlenwahrheit.

## 2. Produktionsprofil bleibt unbelegt – synthetischer Vertrag strikt getrennt

Das Produktionsprofil `structure-overview/v1` wurde **nicht** auf EUR umgestellt.
Es gibt weiterhin keinen unabhängig belegten Exportvertrag der realen
Strukturübersicht. FX=1, passende Zahlen, viele Zeilen oder AI=0 liefern keinen
Einheitenbeweis. Es wurden ausschließlich künstliche Daten verwendet.

Der codegebundene Parameter `BondSourceConvention` erlaubt die Prüfung desselben
V2-Pfads mit einer ausdrücklich dokumentierten Konvention. Nur die CP3-Tests
übergeben den in `scripts/verify-cp3.tsx` definierten synthetischen Vertrag:
Prozent-Clean, Face Value in Bondwährung, absolute AI in Bondwährung,
Dirty-Gesamtwert in EUR, FX EUR je Bondwährung und AI-Quantisierung 0,0001 pro100.
Die Konvention beschreibt **den synthetischen Generator**, nicht die Bankquelle.
Sie ist kein Fallfeld, keine Importoption, kein Editor und kein Nutzer-Override.
Produktions-UI und IST-Export übergeben sie nicht. Die aktuelle feldweise
Importherkunft wird auch mit einer Konvention erneut validiert.

| Im Produktionsprofil | Ergebnis |
| --- | --- |
| Lokale YTM und Macaulay/Modified | Weiter möglich bei den CP2-Voraussetzungen, insbesondere eindeutigem Dirty pro100. |
| Lokale DV01 | Weiter möglich bei konsistenter Menge und benannter Bondwährung; USD wird als USD angezeigt. |
| Laufende Verzinsung / Restlaufzeit | Unabhängig nutzbar bei ausreichenden eigenen Eingangsfeldern. Floater-/Stufenzinscoupon nur Momentaufnahme. |
| Nominalleiter | Nach bekannter Nominalwährung und Datum, inklusive Ausschlüssen und Nullwerten; Profilannahme zur Nominalsemantik bleibt offen ausgewiesen. |
| EUR-Ø-YTM, EUR-Ø-Current-Yield, Portfolio-Modified, EUR-DV01/-Szenarien | Ohne belegbaren EUR-Teilbestand null / nicht berechenbar. |
| EUR-Coverages einschließlich Datum/Leiter | Ohne vollständigen belegbaren EUR-Nenner null / nicht ermittelbar. Stückzahlen und währungsgetrennte Nominale bleiben sichtbar. |
| Mehrdeutige Einzelpreiswege | Die bereits in CP2 beschriebenen FX-/AI-/Dirty-Blocker bleiben wirksam. AI-Jahresmodelltest ohne belegte Quantisierung weiterhin nicht prüfbar. |

Zur Auflösung bleibt ein dokumentierter formatspezifischer Exportvertrag bzw.
gleichwertiger Hersteller-/Banknachweis erforderlich: Berichtswährung,
FX-Zähler/-Nenner, AI-Währung/-Einheit, Dirty-Währung, Stichtagsbezug und
Quantisierung. Kein erfundener EUR-Nachweis, keine manuelle Nachpflegepflicht.

## 3. Unabhängige Regressionen

Neues obligatorisches `npm run test:cp3`, neun benannte Testgruppen, auch in CI
und Typecheck aufgenommen. Erwartungswerte sind feste fachliche Referenzen,
einfache separat ausgerechnete Quoten oder unabhängige Einzahlungs-PV-Differenzen;
kein Vergleich eines Produktionshelpers mit sich selbst als numerische Referenz.

| Fall | Geprüfter Sollwert / Zustand |
| --- | --- |
| 178 importierte Positionen | 80 Standardbonds, 10 Floater, 10 ungültige Couponwerte, 78 Aktien; ohne Nutzer-Nachbearbeitung 1.780.000 Gesamtwert, 1.000.000 direkte Bonds. |
| Synthetisch belegter EUR-Vertrag | Ø YTM 5 %, Coverage 80 %; laufende Verzinsung 4,888888889 %, Coverage 90 %; Modified 0,952380952; DV01 76,190476190 EUR. |
| Fünf Standardbonds AUS | YTM-Coverage 75 %, laufende Verzinsung-Coverage 85 %, DV01 71,428571429 EUR; Ø YTM 5 %, Depotwert und Leiternominal unverändert. |
| Unabhängiges Repricing | Eine Zahlung von 840.000 nach einem Jahr; symmetrisches Repricing bei 4,99/5,01 % bestätigt DV01 mit absoluter Toleranz 0,00001 EUR. ±100-bp-Linearwerte ±7.619,047619 EUR. |
| Dieselben 178 Zeilen im Produktionsprofil | 80 lokale YTMs und 90 lokale laufende Verzinsungen, aber keine EUR-Aggregate und keine erfundene EUR-Coverage. |
| Disjunkte Status | 70.000 gültig, 20.000 manuell AUS mit zugleich fehlendem Coupon, 10.000 sonst unberechenbar: 70 %; kein Herausrechnen der AUS-Position aus dem Nenner, keine Doppeltzählung. |
| Unabhängige Voraussetzungen | Fehlende Fälligkeit, Nominal und Währung sowie Floater ergeben unterschiedliche Rendite-, Datum- und Leiter-Coverages. Gültiger Nullcoupon bleibt echte 0. Leere/ungültige/komplett ausgeschlossene Teilbestände ergeben null statt Nullsensitivität. |
| PLAN | 20.000 Nominal, 400 AI, Clean98/Dirty100: 25 % Verkauf →15.000 Nominal/300 AI; 50 % →10.000/200. Gleicher Dirty/YTM/Modified, DV01 proportional. Voll-/Überverkauf entfernt PLAN; alle Strukturplan-Depotmodi verhalten sich gleich. Sonderstruktur ohne proportionale Mengenbasis bleibt ohne erfundenes Nominal. |
| Nullmarktwert / Währungen | 50.000 EUR-Nominal und 50.000 USD-Nominal getrennt; zusätzliche 7.000 überfällige EUR-Nominale bei Wert0 bleiben IST/PLAN. Lokale USD-DV01 und dokumentierte EUR-DV01 werden unabhängig geprüft. |
| Teiluniversen / Integrität | Bekanntes EUR-Subset plus unbekannter Rest: Subsetkennzahlen möglich, volle Coverage null. Dokumentierter USD-Berichtswert wird separat benannt und nicht in EUR summiert. Numerisch überlaufende Summen werden gesperrt. |
| Metamorphie / Datenstand | Positionsteilung erhält Durchschnitte/DV01; zusätzlicher unberechenbarer Titel erhält Zähler, senkt Coverage. Gemischte Stichtage und Heute-Fallback sichtbar; veränderte Werte waschen alte Herkunft nicht rein. Stammdatenlose Neukäufe erzeugen keine Fälligkeit. |
| Lifecycle | Zwei Depots gleiche WKN, nur eines AUS; echtes Speichern/Laden, JSON-Fallkopie, Snapshot/Restore, Rename, korrektes Replacement mit neuer Quelle, WKN-Konflikt bei gleicher ID samt finalen Referenzen, Mehrdeutigkeit und Delete. Keine persistierten Ableitungen. |
| React-/Exportprüfung | Tatsächlich gerendertes JSX, Checkbox-Handler, Reihenfolge, einmalige Überblicks-Modified und Fehlgründe. Tatsächlicher Excel-Button schreibt Workbook; Zellen und Druck-HTML werden geprüft, darunter reiner Nullwertbestand und IST trotz PLAN-Vollverkauf. Importname `=1+1` bleibt String, keine Excel-Formel. |

Fachlich notwendige Änderung in `verify-3b.ts`: Die alte historische Fixture
hat weder belegte Berichtswährung noch Nominalwährung. Ihre alte Datum-EUR-Quote
und unbeschriftete Leiter wären falsch. Jetzt wird EUR-Coverage null und die
Leiter ohne Währung leer erwartet; die unveränderte Datumsbasis 224.085,01 und
alle ursprünglichen Jahr-/Nominalwerte in einer explizit währungsbeschrifteten
synthetischen Variante bleiben geprüft. Gesamtwert 423.952,54, direkte Bonds
291.692,54 sowie Produkt-/Länder-/Einstandsregressionen bleiben unverändert.

## 4. Gate und Abgrenzung

Lokales CP3-Gate: `test:cp3` (9 Gruppen), `test:bond-v2` (22 Gruppen), `test:cp1`
(A–E plus 13 bestehende Review-Regressionen), `test:3b`, `test:multi-depot`
(58 Assertions), `test:modelportfolio` (16 Assertions), `test:4b`, `test:risk-v2`,
Typecheck, Produktionsbuild und Diff-Check. Der CI-Schritt `test:cp3` ist
obligatorisch; alle bisherigen Gates bleiben erhalten. Endgültige CP3-SHA und
Remote-CI-Run werden nach Commit/Push in PR #7 dokumentiert, ohne Selbstreferenz
im Commit und ohne einen noch nicht gelaufenen Run als Erfolg auszugeben.

Nicht behauptet: interaktive vollständige Browser-/Druckseitenabnahme oder
CP4-Gesamtfreigabe. CP3 prüft bereits die notwendigen realen Workbookdaten,
gerenderten React-/Druckinhalte und Save-/Load-Pfade. CP4 mit umfassender
interaktiver Gesamtprüfung, Master-/Release-Dokumentation und Versionsanhebung
bleibt unangetastet. Kein Merge und kein Pages-Deployment.

**Späteres Komfort-Finetuning:** virtuelle/paginierte sehr lange Positionstabellen,
grafische Währungsleitern statt der expliziten Währungstabellen sowie zusätzliche
Druckseitenumbrüche/Inhaltsnavigation. Diese würden zusätzliche Layout-/Browser-
und Interaktionsprüfungen benötigen; die vollständigen Daten stehen schon heute
in scrollbaren Tabellen, aufklappbaren Statusdetails und einem schmalen
zweispaltigen Druckformat bereit. Keine notwendige Rechnung, Integritätsregel
oder CP3-Regression wurde dafür vertagt. Die Quellenblocker sind fundamentale
Datenvoraussetzungen und ausdrücklich **keine** Komfortarbeiten.
