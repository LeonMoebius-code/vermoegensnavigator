# V0.18.2 – CP4: technische Gesamtabnahme

Stand: 18.09.2026. Branch `work/v0182-bond-hardening`.
Technischer Feature-Abschluss; **keine fachliche Releasefreigabe, kein Merge,
kein Deployment**. Ausschließlich synthetische Daten. CP0–CP3 wurden nicht erneut
allgemein reviewed; ihre ausführbaren Regressionen gehören zum CP4-Gate.

## 1. Ausgangsstand, Umfang und Versionsnachweis

Fetch und Fast-forward-Prüfung ergaben identische lokale/Remote-Stände auf
`123230c10560795530d34e71a1f1776a20224788` (CP3), anfänglich sauberer Arbeitsbaum.
Ausgangs-main: `3c5fd20bb13698db4436c0ba6be3e767d340d6d7`.
Bei Fortsetzung blieben alle vorhandenen CP4-Änderungen erhalten.

| Checkpoint | Commit |
| --- | --- |
| CP0 Dokumentharmonisierung | `03a408a8c86d4894148a557edd072e9776b85dec`, in main via `3c5fd20bb13698db4436c0ba6be3e767d340d6d7` |
| CP1 Implementierung | `97704a09ff6c6c5b0dbc82818104a4e366a3075b` |
| CP1 Reviewkorrekturen | `642eb1af991e5c7e45d3a63b341fe9fdf95dc117` |
| CP2 | `404661dee218081025fa7279f0cc56021e198ea1` |
| CP3 | `123230c10560795530d34e71a1f1776a20224788` |
| CP4 | Eigener Commit, der dieses Dokument einführt; finale SHA und zugehöriger CI-Run werden nach Push in PR #7 dokumentiert. Keine vorweggenommene Remote-CI-Zusage. |

Anwendung **0.18.1 → 0.18.2** in `package.json`, beiden Paketversionsangaben des
Lockfiles und sichtbarer Sidebar. V0.18.2 wurde lokal im Browser angezeigt.
Persistenzschema **11**, bereits in CP2 eingeführt; kein erneuter Schema-Bump.
Die veröffentlichte V0.18.1 und die generierten Root-Pages-Dateien bleiben
unverändert. Der Produktionsbuild erzeugt nur die ignorierte `.pages-dist`.

CP4 ergänzt `scripts/cp4-fixtures.ts`, `scripts/verify-cp4.tsx` und den
obligatorischen CI-Schritt `test:cp4`. Master und Folgepaketnotizen werden
aktualisiert. Eng begrenzte Klassifikationskorrekturen siehe §6.
`outputs/` mit lokalem Testserver, Testdateien und Downloadkopien ist ignoriert
und kein Commitbestandteil; ebenso keine Dateien aus Downloads.

## 2. Zehn ursprüngliche Defekte

„Geschlossen“ bedeutet hier: Softwareverhalten innerhalb des dokumentierten
V2-Vertrags nachgewiesen. Es bestätigt keine unbekannten Konventionen einer
realen Quelle. Die ursprünglichen Fixes aus CP1–CP3 wurden nicht neu erfunden.

| Nr. | Ursprünglicher Defekt | Technischer Status / Nachweis |
| --- | --- | --- |
| 1 | Depotgesamtwert trotz Holdings editierbar/inkonsistent speicherbar | Geschlossen. Gerenderte readonly-Eingabe, zentral abgeleiteter Wert, CP1-Speicher-/Exporttests; Browser 1.790.000, JSON und XLSX identisch; CP4 korrigiert absichtlich gespeisten Altwert 1 beim Speichern. Ohne Holdings manuelle Erfassung erhalten. |
| 2 | Replacement-Namensfallback überträgt Sale/Refs trotz anderer WKN | Geschlossen. Ein depotbegrenztes geprüftes Mapping einschließlich ID-Konflikt/Referenz-Bypass; CP1/CP3 und CP4 endgültige Planreferenzen beider Varianten. Browser: gleicher Name, WKN T00000→OTHER0 in Depot 2 übernimmt weder 5.000 Verkauf noch AUS; Depot 1 behält 2.500 Verkauf und AUS. |
| 3 | Bondpreis, Kupontiming und Couponanzahl falsch | V2-Rechenfehler geschlossen; reale Quelle offen. Dirty-PV, datierter Jahresanker, EOM, Stichtagsausschluss und unabhängige Referenzen. Uneindeutige Preiswege gesperrt. Keine Rückkehr zur Clean-/ceil-V1-Rechnung. |
| 4 | PLAN-Nominal bei Verkauf nicht reduziert | Geschlossen. CP3 25/50/100-%-Verkäufe und AI/DV01-Skalierung; Browser 10.000→7.500 Nominal, YTM5 % unverändert, lokale DV01 0,95→0,71. Vollverkauf entfernt nur PLAN. |
| 5 | Unterschiedliche Nominalwährungen addiert | Geschlossen. Währungsgetrennte Leiter; CP4 1.000.000 EUR (2027), 7.000 EUR überfällig (2025), 10.000 USD (2027). Kein gemischtes Nominaltotal, keine unbelegte EUR-Coverage. |
| 6 | Nicht berechenbare Sensitivität als 0-Effekt | Geschlossen. Leere/ungültige Teilmengen null, „nicht berechenbar“ in Browser, Workbook und Druck-HTML. Echte Null separat getestet. |
| 7 | Ungültiger Coupontext wird 0 | Geschlossen. Strikter Parser; 10 absichtlich ungültige Coupons im 178er-Upload sichtbar, keine künstlichen Nullkupons. Explizite gültige 0, positive/Null-Legacy-Korruption separat getestet. |
| 8 | Modellportfolio ohne strategischen Topf nutzt Reserve/Bedarf | Geschlossen. CP1/Modellportfolio-Suite für drei Aktionen; Browser ohne strategischen Topf auch nach Eingabe 10.000 gesperrt und ohne Mutation. |
| 9 | Datum-Coverage und Nominalleiter-Coverage vermischt | Geschlossen. Separate Voraussetzungen/Quoten, bekannte synthetische Sollwerte; fehlendes Nominal/Währung verhindert nominalfähige Coverage. Produktions-EUR-Nenner unbekannt ⇒ beide EUR-Quoten nicht ermittelbar. |
| 10 | UI-/Export-/Testlücken | CP4-Pflichtpfade technisch geschlossen: interaktive Browserpfade, echte XLSX-/JSON-Downloads, tatsächliches Druck-HTML und Print-Handler. Native Druckseiten/PDF-Paginierung nicht verifiziert; genaue Methodengrenzen in §4. Komfortarbeiten getrennt in §7. |

## 3. Tests und unabhängige Sollwerte

Neue CP4-Suite: vier benannte Gruppen mit konkreten Assertions:

1. Explizite Aktienanleihe-Signale in Typ, Medium oder Name ergeben keine
   Standardbondrechnung; explizite Mischfonds-/Multi-Asset-Signale haben Vorrang.
   Reale CSV-Parserstrecke, unveränderter physischer Marktwert, keine fiktive
   Tilgung oder YTM. Keine Anlageempfehlung aus Namensheuristik.
2. Zwei Depots mit 180 Holdings: CSV, WKN-Dopplung, depotbezogener Ausschluss,
   Teilverkauf, Plan-Kopie/Referenzen, tatsächlicher Case-Store, JSON-Kopie,
   atomarer Pflichtfeldfehler, konfliktfreies und konfliktbehaftetes Replacement,
   Löschen. Depotwert 1.790.000, nach Löschen von Depot B 1.780.000.
3. Unterstützte alte Schema-Einstiegspunkte (fehlend/0–10), Schema11-Erhalt und
   Ablehnung Schema12; unbekanntes optionales Altfeld bleibt erhalten, belegte
   Nachbarposition bleibt berechenbar. Historische Snapshots im serialisierten
   Inhalt unverändert; echter `Wiederherstellen`-Handler normiert nur die
   Arbeitskopie, neuer Snapshot11. Kein Verlust durch Zukunftsschema.
4. Tatsächlich geschriebenes und wieder eingelesenes XLSX mit 180 Holdings und
   102 Bondzeilen, tatsächliches React-Druck-HTML, Kunden-/Intern-Print-Handler.
   IST trotz PLAN-Vollverkäufen; Nullwert, Währungen, AUS, Fehlgründe. Namen und
   Notizen mit `=`, `+`, `-`, `@` bleiben Excel-Stringzellen ohne Formel; HTML
   escaped einen synthetischen `<img ...>`-Text. Es wird keine CSV-Exportfunktion
   neu eingeführt. Der anfängliche Snapshot-Testvergleich wurde auf die
   persistierbare JSON-Darstellung korrigiert (undefined ist kein JSON-Feld).

Alle bestehenden Suites bleiben erhalten: Bond-V2 (22 Gruppen), CP3 (9 Gruppen),
CP1 (A–E plus 13 Reviewtests), Multi-Depot (58 Assertions), Modellportfolio (16),
3B, 4B und Risk-V2. Dazu Typecheck, Produktionsbuild und Diff-Checks.
CI führt alle genannten Tests nicht optional aus; Pages-Workflow unverändert.

| Unabhängige Referenz | Soll / Resultat |
| --- | --- |
| 178 Positionen, synthetisch dokumentierter Generatorvertrag | 80 Standardbonds, 10 Floater, 10 ungültige Coupons, 78 Aktien; 1.780.000 Gesamtwert, 1.000.000 direkte Bonds |
| Voller synthetisch belegter EUR-Vertrag | Ø YTM 5 %, Coverage80 %; laufende Verzinsung4,888888889 %, Coverage90 %; Modified0,952380952; DV01 76,190476190 EUR |
| Fünf Standardbonds AUS | Coverage75 %/85 %, DV01 71,428571429 EUR; Ø YTM5 %, Leiter und Depotwert unverändert |
| Dieselbe Matrix im Produktionsprofil | 80 lokale YTMs, 90 laufende Verzinsungen; EUR-Aggregate und EUR-Coverages null, kein Freischalten per Zahlenpassung |
| Reiner Solver 105 nach365/366 Tagen bei Dirty100 | 5 % / 4,98600375467035 % |
| Jahresanker 01.01.2026→02.01.2027 | Zwei hypothetische Zahlungen (5 nach1 Tag, 105 nach366 Tagen), YTM10,4945108004005 % |
| 2,25-%-Kurzläufer, Dirty aus99,885 + 2,25×336/365 | YTM3,68762327862036 %, Modified0,0766263631880383 |
| Fünf Tage, Nullkupon Dirty100,10 | −7,03652615288334 %, Warnung zur Rundung |
| Halbjahresreferenz103 vs falsches Jahresmodell106 bei Dirty102,93118208 /5 Tage | ca.5 % vs753,886330153482 %; eindeutig quantisierte AI kann das Jahresmodell widersprechen |
| Unabhängige DV01 | CP3 symmetrisches Repricing der Einjahreszahlung840.000 bei4,99/5,01 %; Toleranz0,00001 EUR |
| Metamorphie | Positionsteilung erhält Kennzahlen; zusätzlicher unberechenbarer Titel senkt Coverage ohne Zähleränderung |

`scripts/bond-v2-reference.py` wurde separat mit Python Decimal-Präzision70
ausgeführt; keine App-Imports. Die TypeScript-Referenzen sind feste Sollwerte
und unabhängige Finite-Differenzen, kein Produktionshelper gegen sich selbst.
Weitere Pflichtfälle 1–25 werden gemeinsam von Bond-V2, CP1, CP3 und CP4
abgedeckt: FX/AI-Richtungen, Nominal100/FX1-Mehrdeutigkeit, fehlende Felder,
jährlicher AI-Widerspruch, Sonderformen, Legacy, negative/extreme Yields,
Residual, Duration/DV01, AUS/PLAN/Währungen/Nullwerte und echte Exporte.

Alte V1-Sollwerte wurden bereits in CP2/CP3 fachlich ersetzt und dort begründet;
CP4 entfernt keine bestehenden Assertions. 3B-Gesamtwert423.952,54 und
Produktartenabdeckung100 % bleiben geprüft. Die historische Legacy-Fixture
belegt weder EUR-Berichtswährung noch alle Couponursprünge: null ist dort die
korrekte V2-Erwartung, keine Testabschwächung zugunsten alter Renditezahlen.

## 4. Browser- und Exportnachweise / Methodengrenzen

Lokaler Produktionsbuild, Codex In-app Chromium, Desktopansicht etwa1265×712.
Keine echten Kunden-/Bankdaten, keine Originaldatei und keine externe Quelle.
Die bereits abgeschlossenen Bedienprüfungen wurden bei Fortsetzung nicht
wiederholt; ihre Parser-/Speicher-/Exportpfade blieben unverändert.

| Oberfläche / Pfad | Beobachtetes Ergebnis |
| --- | --- |
| CSV-Dateiauswahl und Vorschau | 178 Positionen/1.780.000, zehn ungültige optionale Coupons sichtbar; Bestätigung erzeugt Depot1 |
| Lange Bestandstabelle | Erste und letzte Position erreichbar, Details der178. Position geöffnet, horizontales Scrollen vorhanden; keine abgeschnittenen Daten außerhalb eines erreichbaren Scrollbereichs |
| Bondansicht | Überblick vor Szenarien/Leiter/Positionen/Annahmen; Checkbox und Details funktionieren; lokale YTM5 %, Modified0,95, DV01-Währung benannt; EUR-Sperren sichtbar |
| AUS, Speichern, Reload und Fall öffnen | AUS bleibt positionsbezogen erhalten, Einzelwerte und vollständige Leiter bleiben sichtbar |
| Verkauf und PLAN | 2.500 Verkauf aus10.000 ⇒7.500 Nominal, lokale DV010,71; IST10.000/0,95 und unveränderte YTM5 % |
| Zweites Depot | Gleiche WKN in USD unabhängig, EUR/USD-Leiter getrennt; überfällige Position mit Wert0/Nominal7.000 bleibt sichtbar |
| Vermögenshaus / Diversifikation | Weiterhin1.790.000 Gesamtwert,1.010.000 Geldwerte/780.000 Substanzwerte, Produktabdeckung100 %; Quellenblocker löschen keine Marktwerte |
| Einstand & Ergebnis | Fehlende Einstandsdaten ausdrücklich als nicht ausreichend gemeldet; positive Einstandsfälle zusätzlich bestehende3B-Regressionen |
| Versionsrestore / Depotlöschen | Löschen Depot2 ⇒178 Positionen; gespeicherte Version stellt180/1.790.000 mit AUS und Verkauf wieder her |
| Planvarianten / Modellportfolio | Kopie als zweite Variante sichtbar; fehlender strategischer Topf bleibt auch bei manueller Betragseingabe10.000 gesperrt |
| Ausgangslage | Depotgesamtwert1.790.000 readonly; Holdings-Schalter deaktiviert, kein versehentliches hasDepot=false |
| JSON echter Download + Rückimport | Lokal geprüfte Datei:180 Holdings, Schema11, Snapshot11, AUS=true und plannedSale2500. Rückimport erzeugt eigenständigen Fall, beide Depots und getrennte Einbeziehung im Browser bestätigt |
| Replacement aus Bond-Untertab | Ungültiger Pflichtmarktwert bricht sichtbar ohne Änderung ab; danach gleicher Name/andere WKN in Depot2: kein übernommener Verkauf/AUS, Depot1 unverändert |
| Excel echter Browserdownload | Lokale Datei wieder eingelesen:13 Blätter,102 physische Bondzeilen, IST-Titel, Nullwertposition, Depotwert1.790.000, Portfolio-DV01 „nicht berechenbar“ |
| Druck | Tatsächliches gerendertes Druck-HTML mit allen102 Bondpositionen und denselben IST-Statusdaten geprüft; beide Print-Handler automatisiert, Kunden-Druckbutton im Browser ausgelöst |

Die Browser-Download-Ereignisabfrage lief in einen Timeout, die Dateien lagen
jedoch tatsächlich im lokalen Downloadordner und wurden inhaltlich geprüft.
Dateiauswahl war zeitweise sehr langsam. Das sind Werkzeuggrenzen, kein
nachgewiesener App-Datenverlust. Browserkonsole ohne beobachtete Warnung/Fehler.

**Nicht verifiziert:** native Druckdialog-/PDF-Dateiausgabe, Seitenumbrüche eines
tatsächlich gedruckten mehrseitigen102-Bond-Dokuments, physischer Drucker,
Öffnen in einer installierten Excel-Desktopanwendung sowie weitere
Browser-/Mobilgrößen. Die In-app-API unterstützt keinen HTML-Dateiexport
(`tab_content_export`); das tatsächliche Druck-HTML wurde stattdessen aus dem
realen React-Export gerendert/geprüft. Workbookzellen wurden mit XLSX gelesen.
Eine native Druckseitenabnahme wird deshalb ausdrücklich nicht behauptet.

## 5. Schema, Berechnung und offene Quellvoraussetzungen

Schema10→11: `bondSource` (ProfilID/Version, Parser2, interpretierte Einheiten,
Feldwerte/valid-missing-invalid, `profile-assumption`, `report-date`, offene
Quantisierung) und `excludeFromBondAggregates`. Fehlendes Flag=false;
positionsbezogen unbelegter Altcoupon (0 oder positiv) ⇒`legacy-unverified`.
Save/Load/JSON/Restore normieren zentral, neue Snapshots11, historische bis
Restore unverändert, Schema>11 abgelehnt. Keine persistierte zweite Wahrheit
für YTM, Duration oder DV01; keine Vertragsbestätigung oder Overrides.

Modell: eindeutige Dirty-Basis, hypothetischer jährlicher Fälligkeitsanker,
Tilgung100, ACT/365F, robuste PV-Lösung mit y>−1, Macaulay/Modified und benannte
lokale DV01. Keine erwartete/ausfallbereinigte Rendite. Tatsächliche Frequenz,
Termine, Settlement, Sonderrechte, Ausfall, Credit/FX und Konvexität fehlen.
Die jährliche AI-Modellprüfung ist ohne belegte Quantisierung nicht prüfbar.

**Fundamentale offene Voraussetzungen des realen CSV-Vertrags:**
Berichtswährung/Dirty-Gesamtwertwährung, FX-Zähler und -Nenner,
Stückzinswährung/-einheit, Genauigkeit/Quantisierung, belastbarer Stichtagsbezug.
Die extern gemeldete neue Analyse von Original-CSV/agree21 ist in CP4 weder
inhaltlich überprüft noch als Vertragsänderung freigegeben. Zahlenpassung,
FX1, Nominal100, AI0 und hohe Coverage beweisen keine Konvention.
Erforderlich ist eine dokumentierte formatspezifische Festlegung mit
reproduzierbaren synthetischen Gegenproben und anschließender fachlicher
Freigabe. Keine Performance-CSV, manuelle Bestätigung oder zweite Datenquelle
als Umgehung. Das Produktionsprofil bleibt unverändert konservativ.

## 6. Neue Klassifikationshinweise: Nachweis versus offener Verdacht

Der Nutzer meldete mögliche Aktienanleihe-/Mischfonds-Fehlklassifikationen aus
einer separaten Quellenanalyse. Ohne deren Daten wurde ausschließlich der
bestehende Code mit künstlichen eindeutigen Labels geprüft.

**Nachgewiesen und eng begrenzt korrigiert:** `securityType=Aktienanleihe` fiel
vorher in die allgemeine `anleihe`-Regel für Standard-Festzins. Die neue
CP4-Assertion schlug vor dem Fix mit `Renten` statt `Strukturierte Produkte`
fehl. Explizite Mischfonds-/Multi-Asset-Labels wurden von früheren breiten
Renten-/Aktien-Fondsregeln überstimmt. Nun haben sie Vorrang. Aktienanleihe in
Typ/Medium sowie als Veto im Namen einer vermeintlichen Standardanleihe
schließt die Standardbondanalyse aus. Marktwerte/Originaldaten bleiben erhalten.
Beide Korrekturen sind gemeinsame Klassifikation für IST/PLAN/Export, keine
Änderung der Preis- oder Währungskonventionen und keine neue Produktmodellierung.

Der Aktienanleihe-Fehler war **potenziell releaseblockierend**, weil er für
eine erkennbare Sonderstruktur eine normale Tilgung100/YTM zulassen konnte.
Für die reproduzierten eindeutigen Labels ist die Lücke geschlossen. Eine
Mischfonds-Fehlzuordnung verfälscht die Produktartenanalyse und kann bei
materiellem Umfang ebenfalls releaseblockierend sein.

**Weiter fachlich zu prüfen, nicht als bewiesener Fehler der Originaldatei
ausgegeben:** konkrete Quellcodes, widersprüchliche Feldkombinationen,
bankseitige Produktzuordnung, nicht explizit benannte Sonderstrukturen und
wirtschaftliche Mischfonds-Durchschau. CP4 belegt nicht, dass sämtliche realen
betroffenen Instrumente erkannt sind; es erfindet keine Quoten oder
Vertragsmerkmale. Bestätigte materielle Fehlklassifikationen außerhalb der
getesteten Labels sind vor Veröffentlichung als möglicher Release-Blocker zu
behandeln. Diese fachliche Quellenabnahme bleibt ausdrücklich offen.

## 7. Komfort, Gate und Freigabegrenze

Nicht fundamentales Finetuning: Paginierung/Virtualisierung langer Tabellen,
fixierte Orientierungszeilen, grafische Währungsleiter, bequemere horizontale
Navigation und zusätzliche Drucknavigation. Die Daten sind bereits vollständig
erreichbar. Solche Verbesserungen ersetzen keine Klärung der Quellkonventionen.

Finales lokales Gate bestanden: alle neun Testscripts
(`test:3b`, `test:4b`, `test:risk-v2`, `test:multi-depot`, `test:modelportfolio`,
`test:cp1`, `test:bond-v2`, `test:cp3`, `test:cp4`), Typecheck, Produktionsbuild,
`git diff --check` und `git diff --check origin/main...HEAD`; zusätzlich der
gesamte noch uncommittete Diff gegen `origin/main`. Windows-Git-Bash
benötigte wegen Sandbox-Signalpipe/Spawn-Sperren Ausführung außerhalb dieser
Beschränkung; keine Neuinstallation/Abhängigkeitsänderung. Finale Resultate
und exakte Remote-Feature-SHA/CI werden nach Ausführung in PR #7 festgehalten.

Master kennzeichnet V1 ausdrücklich historisch; V0.19-Schema10-Annahme und
V0.20-Schema11-Kollision sind nur als Hinweise korrigiert. Keine Folgepakete
implementiert. **Merge-SHA: keiner. Pages-Run/Deployment für CP4: keiner.**
Lokale V0.18.2-Sichtbarkeit bedeutet keine veröffentlichte Version.
Technisches CP4-Gate und nachfolgende fachliche Abnahme bleiben getrennt.
