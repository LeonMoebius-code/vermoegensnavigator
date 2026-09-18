# V0.18.2 – CP2: Rechenkern, Quellvertrag und Nachweis

Stand: 18.09.2026. Branch `work/v0182-bond-hardening`, Ausgangscommit
`642eb1af991e5c7e45d3a63b341fe9fdf95dc117`, unveränderter Ausgangs-main
`3c5fd20bb13698db4436c0ba6be3e767d340d6d7`. CP1 wurde nicht erneut reviewed.
Die bestehenden CP1-Regressionen sind Bestandteil des CP2-Gates.

## 1. Umfang und Sicherung

Fortsetzung der unterbrochenen Implementierung, kein Neustart. Beim Wiederaufnehmen
lagen tatsächlich 13 geänderte und fünf unversionierte Dateien vor. Alle 18 wurden
vor weiteren Änderungen außerhalb des Repositorys bytegenau kopiert und mit
SHA-256 verglichen; Manifest, Binärdiff, Status und Ausgangs-SHA sind dort gesichert.
Keine lokale Änderung wurde zurückgesetzt. Der Remote-Branch war beim Fetch identisch.

CP2 enthält Quellprofil, positionsbezogene Herkunft, Preis-/Währungsprüfung,
Jahreskalender, Solver, Einzelrendite/Duration/DV01, unabhängige Referenzen und
Schema 11. Die vorhandene Analyse nutzt ausschließlich den V2-Rechenkern; die
alte `ceil`-/Clean-YTM ist entfernt. Minimale Anzeige-/Exportkorrekturen verhindern
erfundene EUR-Aggregate, Null-DV01 und falsche V1-Modelltexte. Kein Merge, Deployment,
CP3- oder CP4-Ausbau. Anwendungsversion bleibt bis zur Release-Fertigstellung
0.18.1; das persistente Schema ist bereits 11.

## 2. Tatsächlich verfügbare Quellen und Grenzen des Nachweises

Gelesen wurden der vollständige Zero-Touch-Nachtrag, das Bond-V2-Fachkonzept,
die Preflight-Präzisierungen und das V0.18.2-Arbeitspaket einschließlich Abschnitt 3.
Zusätzlich wurden Parser, vorhandene Felddefinitionen, Master-Spezifikation
Abschnitt „Depotdatenmodell / CSV“ und die historische 3B-Feldbeschreibung geprüft.
Diese beschreiben Spalten und Produktanforderungen, keinen unabhängig belegten
Exportvertrag des Quellsystems. Die vorhandenen Zahlenfixtures sind kein Nachweis
für Einheiten oder Währungsrichtung.

Im Repository/Workspace lag keine originale Strukturübersicht-CSV vor. Es wurde
keine Originaldatei außerhalb des Workspace gesucht oder aus einem externen Dienst
abgerufen. Daher wurde **keine Plausibilisierung an echten Positionen behauptet**.
Keine Kunden-/Positionsrohdaten wurden in Repository, Testausgaben oder CI übernommen.
Alle neuen Fixtures sind synthetisch.

### Produktionsprofil `structure-overview`, Version 1, Parser-Version 2

| Merkmal | Verwendete Bedeutung | Nachweisstatus |
| --- | --- | --- |
| Zahlen und Daten | Streng geprüfte aktuelle CSV-Felder; explizite Null unterscheidbar von leer/ungültig | Parsernachweis, keine Verifikation der wirtschaftlichen Quelldaten |
| `Kurs` | Clean-Preis je 100 Nominal | `profile-assumption` gemäß offen gelegtem Formatmodell |
| `Stück/Nominal` | Face Value in Bondwährung für geeignete direkte Bonds | `profile-assumption` |
| `Währung` | Nominal-/Kupon-/Rückzahlungswährung und kohärente Prozentnotierung | `profile-assumption`, keine Aussage über Berichtswährung |
| `Stückzinsen` | Absoluter Positionsbetrag | `profile-assumption`; Währung `unknown` |
| `Kurswert incl. Stückzinsen` | Absoluter Dirty-Gesamtwert | Interpretation des Spaltennamens im Profil; Berichtswährung `unknown` |
| `Devisenkurs` | Beide Richtungen werden berücksichtigt; bei unbekannter Berichtswährung zusätzlich lokale Bewertung möglich | Richtung `unknown`; kein Wechsel nach bester Preispassung |
| `Bewertungsende` | Positionsbezogener Berichtsstichtag | Keine Behauptung eines Settlement-/Kursfeststellungsdatums |
| AI-/Nominal-Quantisierung | Nicht aus angezeigten Nachkommastellen ableitbar | `unknown` / `null` |

Profil-ID, Version, Einheiten und feldweise valid/missing/invalid-Herkunft werden
mit den zugelassenen bereits geparsten Feldern gespeichert. Es gibt keine Übernahme
zusätzlicher personenbezogener Spalten, keine Originalzellen mit ungültigem Inhalt
und keine persistent berechnete YTM/Duration/DV01. Beim Wiederladen und jeder Analyse
werden Herkunft und aktuelle Werte erneut verglichen. Änderungen dürfen gespeicherte
Herkunft nicht nachträglich bestätigen.

### Was nach regulärem Import automatisch berechenbar ist

| Kennzahl | Aktuell mögliche automatische Berechnung |
| --- | --- |
| Restlaufzeit | Gültige Fälligkeit und Positionsstichtag; fehlt dieser, sichtbarer Heute-Fallback ausschließlich hierfür |
| Laufende Verzinsung | Streng gültiger aktueller Kupon und positiver Prozent-Clean-Kurs; auch Floater/Step-up als Momentaufnahme, unabhängig von Fälligkeit/FX/AI |
| Indikative Einzel-YTM | Geeigneter Festzins-/expliziter Nullkuponbond, aktuelle Herkunft, künftige Fälligkeit, Berichtsstichtag und eindeutiger positiver Dirty je 100 |
| Macaulay/Modified | Derselbe gültige datierte Plan und gelöste YTM; keine EUR-Gesamtbasis nötig |
| Einzel-DV01 | Zusätzlich konsistente Positionsmenge/Dirty-Bewertung und benannte lokale Bondwährung; z. B. USD bleibt USD |
| EUR-Portfoliodurchschnitte, EUR-DV01/Szenarien und vollständige EUR-Kennzahlcoverage | Im derzeitigen Produktionsprofil gesperrt: gemeinsame Berichtswährung nicht belegt; `null` statt 0 oder scheinbarer Vollabdeckung |

Beispielsweise ist bei FX **genau 1** der lokale per-100-Preis unter den beibehaltenen
FX-/Währungsinterpretationen invariant. Das erlaubt lokale Modellzahlen, beweist aber
keine EUR-Berichtswährung. Auch explizit AI=0 ist unter Währungsumrechnung invariant:
Clean+AI kann bei vorhandenem Nominal als lokale Ersatzbasis dienen, wenn die
Dirty-Gesamtwertableitung mangels FX nicht möglich ist. Fehlende AI ist niemals AI=0.
Ein positiver eindeutiger Dirty-Gesamtwert kann dagegen ohne AI genügen.

Bei fehlendem Nominal gibt es im regulären CSV-Profil keine erzwungene absolute
per-100-Ableitung. Die reine Preiseinheitenfunktion unterstützt unabhängig gesicherten
Clean+AI-pro100 auch ohne Nominal; die tatsächliche CSV wird nicht auf diese Einheit
umgedeutet. Bei FX ungleich 1 und unbekannter Richtung/Währung bleiben betroffene
Einzelrenditen gesperrt. Sonstige Depotmarktwerte werden dadurch nicht gelöscht.

### Reproduzierbare Quellenblocker – keine manuelle Nachpflege als Ersatz

1. **FX-Richtung und Berichtswährung:** synthetisch N=10.000 USD, C=98, AI=200,
   M=9.000, Quell-FX=0,9. Aus M/N entstehen je nach Semantik 100 (f=0,9),
   81 (f=1/0,9) oder 90 (lokaler M). Der Adapter wählt nicht den zur anderen
   Preisgleichung am besten passenden Kandidaten. Ergebnis: mehrdeutiger Preis.
2. **AI-Währung:** bei belegtem f=0,9 bedeutet AI=200 entweder 2,0 Bond-Preispunkte
   oder 2,222222… bei Reporting-AI. Kein willkürliches Umschalten je Position.
3. **Nicht diskriminierende Daten:** N=100, FX=1 oder AI=0 können mehrere Regeln
   zahlenmäßig gleich erscheinen lassen. Auch viele proportionale Zeilen beweisen
   das Profil nicht. Invarianzprüfung verwendet nur Gleitkomma-Rauschtoleranz
   (64 × machine epsilon), niemals die wesentlich gröbere Quellrundungstoleranz.
4. **AI-Genauigkeit:** ohne belegte Rundung/Quantisierung ist der Jahresmodelltest
   im Produktionsprofil `not-testable`, sichtbar „Kuponmodell nicht prüfbar“.
   Die reine Funktion ist für gesicherte Einheiten/Quantisierung implementiert und
   unabhängig getestet. Negative AI und erkannte Cum-/Ex-Signale werden gesperrt.

Zur Auflösung wird **ein formatspezifischer Exportvertrag/Datendictionary des
Quellsystems oder eine gleichwertige dokumentierte Hersteller-/Bankauskunft** benötigt:
Prozentnotierung und Face Value, absolute/pro100-AI, AI-Währung, Dirty-Währung,
gemeinsame Berichtswährung, FX-Zähler/Nenner und Stichtagsbezug sowie Rundungsregeln.
Ein lokal vertraulich geprüftes diskriminierendes Muster (N≠100, AI≠0, FX deutlich
ungleich 1, nicht nur proportional wiederholte Positionen) kann diese Regeln prüfen,
ersetzt jedoch keinen Einheitenbeleg. Danach ist ein explizites neues Profil mit
synthetischen Vertragstests möglich. Keine Pflichtbestätigung und keine händische
Ergänzung je Holding; keine neue reguläre Wertpapierdatenquelle.

## 3. Mathematik, Schutzregeln und numerische Referenzen

Ein Jahresmodell: Rückzahlung 100, jährlicher Quellkupon, Kalenderanker ursprüngliche
Fälligkeit, echte Monatsenden, niemals rückwärts vom bereits gekürzten Datum iterieren.
Ein gültiger 29.02. ist immer Monatsende. Nur zukünftige Termine, finale Zahlung
Coupon+100 einmal, kein t=0-Coupon. ACT/365F in sämtlichen PV-Exponenten.
Es werden keine tatsächliche Kuponfrequenz, Kreditqualität oder Vertragszahlungen
aus Namen/WKN erfunden.

Dirty-Gesamtwert ist bei eindeutigem Vertrag primär; Clean+AI ist Kontrolle bzw.
eindeutige Ersatzbasis. Alle vergleichbaren Preis-/Marktwertkontrollen müssen die
vorgeschriebenen Toleranzen erfüllen. Absoluter AI wird vor Verwendung pro100
umgerechnet. Explizit abweichende Bewertungs-/Preis-/AI-/FX-Tage verhindern die
gemeinsame Rechnung in der Einheitenfunktion.

Der Solver bisektiert log(1+y), bracketiert mit endlicher Ausweitung und benutzt
maximal 200 Bisektionsschritte. Nur endliches y>-1, verengtes Intervall und
PV-Residual ≤ max(1e-8, 1e-10×Dirty) sind erfolgreich. Technisch nicht darstellbare
Lösungen sind `no-stable-solution`, kein wirtschaftlicher Hochrenditefilter.
Macaulay=ΣtPV/P, Modified=Macaulay/(1+y), lokale DV01=Dirty-Positionswert×Modified×0,0001.

Die unabhängige Referenz `scripts/bond-v2-reference.py` verwendet Decimal mit 70
Stellen und Newton in y, ohne Produktionsimporte. Tests verwenden feste Ergebnisse,
eigene Potenz-PV sowie finite Differenzen mit tatsächlicher, nahe −1 reduzierter
Schrittweite. Quellrundungsgrenzen werden nicht als Solverfehlerbudget verwendet.

| Synthetischer Referenzfall | Unabhängiger Sollwert |
| --- | --- |
| Dirty100 → 105 nach365 Tagen | YTM 5,000000000 % |
| Dirty100 → 105 nach366 Tagen (reiner Solver) | YTM 4,986003755 % |
| Jahresanker 01.01.2026 → 02.01.2027, CF5 nach1 Tag +105 nach366 Tagen | YTM 10,494510800 % |
| Halbjahresplan CF2,5 nach181 Tagen +102,5 nach365 Tagen | YTM 5,063026596 %, Macaulay 0,987702179, Modified 0,940104441 |
| Derselbe Halbjahresplan, Dirty-Positionswert100.000 | DV01 9,401044412 in Positionswährung |
| Nullkupon90 →100 nach730 Tagen | YTM 5,409255339 % |
| Dirty105 →100 nach365 Tagen | YTM −4,761904762 % |
| 5-Tage-Nullkupon, Dirty100,10 | YTM −7,036526153 % (Dirty100: 0 %) |
| 5 Tage, Dirty102,93118208, CF103 / CF106 | 5,000000261 % / 753,886330153 % |
| 2,25-%-Kurzläufer, 29 Tage, Clean99,885 + AI2,25×336/365 | YTM 3,687623279 % |

Die geringe Abweichung der Fünf-Tage-Zahl vom gerundeten Vorgabewert entsteht aus
der ausdrücklich auf acht Dezimalen vorgegebenen Dirty-Zahl. AI2,9185 beim 6-%-
Kurzläufer widerspricht bei belegter Einheit/Quantisierung allen drei Jahresvarianten
(ACT/ACT-Periode, ACT/365F, reguläres 30E/360); YTM, Duration und DV01 werden dann null.
Ohne prüfbare AI bleibt das Modell ausdrücklich unbestätigt. Kurzläufer bis31 Tage
zeigen einen konservativen Modell-/Rundungshinweis, ohne Renditeschwellenfilter.

Beim Fortsetzungsreview zusätzlich nachgewiesen und korrigiert: Ein halbierter
Positionswert konnte mit unverändertem Quellnominal noch die ursprüngliche absolute
DV01 liefern. Die absolute Kennzahl wird jetzt bei geänderter, nicht konsistenter
Mengenbasis gesperrt (`position-amount-changed`). Unabhängig gültige per100-YTM und
Duration bleiben möglich. Eine vollständige proportionale PLAN-Mengenlogik ist CP3.

## 4. Schema 11 und erhaltene Regressionen

- Unterstützte Altfälle einschließlich10 →11: Rohzahlen bleiben erhalten;
  ohne aktuelle Parserherkunft keine nachträgliche Kuponverifikation, auch nicht
  bei positiven alten Zahlen. Betroffene Kennzahlen `legacy-unverified`;
  Laufzeit und sonstige unabhängige Daten bleiben verwendbar.
- Profilherkunft und Checkbox werden bei11 →11, JSON, Fallladen, tatsächlichem
  Speichern und Snapshot-Restore erhalten. Fehlender Ausschluss entspricht false.
- Historische Snapshots werden beim Laden des Elternfalls nicht migriert;
  Normalisierung erst beim Restore. Neue Snapshots tragen Schema11.
- Zukunftsschema >11 wird geschützt abgelehnt. Ein beschädigtes optionales Profil
  macht nicht den gesamten Fall unbrauchbar; vor späterer Überschreibung bleibt
  das Original im bestehenden Recovery-Verfahren bytegenau gesichert.
- Keine Bestätigungsflags, Editoren, Dirty-Overrides oder zweite persistente
  Rechenwahrheit. Replacement übernimmt die neue Quelle, keine alte Profilbestätigung.

Fachlich notwendige historische Erwartungsänderungen:

| Test | Änderung und Grund |
| --- | --- |
| `verify-3b` reine Preisfälle | Explizite Solver-Cashflows statt entferntem `ceil`-Produktionskalender; ursprüngliche mathematische Richtungsaussagen erhalten |
| `verify-3b` historische Holdings | Keine strenge CSV-Herkunft/Dirty-/Währungsbasis: alte YTM-/Duration-/DV01-Sollwerte (6,872959;151,612276) wären falsch verifiziert. Jetzt explizite Legacy-/null-Prüfung; neue numerische V2-Prüfungen separat |
| `verify-multi-depot` T | Alte handgebaute 5-%-YTM ohne Quellnachweis wird `legacy-unverified`; positionsbezogene Stichtagstests unverändert |
| `verify-multi-depot`, `verify-4b`, `verify-risk-v2` | Nur aktuelles Zielschema10 →11, alte Eingabeschemata/Snapshots erhalten |
| `verify-cp1` | Zukunftsschema-Test11 →12, da11 nun unterstützt |

Insbesondere 423.952,54 Gesamtwert, 100 % Produktartenabdeckung, Produktsummen,
Bestands-/Länder-/Verkaufs-/Einstands- und historische Leiterassertions bleiben
erhalten. Keine Regression wurde gelöscht, um Grün zu erzeugen.

Der synthetische178-Zeilen-Import ergibt ohne Nachbearbeitung1.780.000 Gesamtwert,
1.000.000 direkte Bonds,80 Einzel-YTMs zu5 %,90 gültige laufende Verzinsungen und
Modified0,952380952 für die80 Standardbonds. Wegen der **absichtlich nicht erfundenen
gemeinsamen EUR-Quelle** behauptet dieser Test keine80-%-EUR-Coverage oder76,190476-EUR-
Portfolio-DV01. Diese vollständige Portfolioabnahme benötigt einen belegten Vertrag
und die ausdrücklich getrennte CP3-Aggregation.

## 5. Gate, offene Voraussetzungen und spätere Arbeiten

Obligatorischer CI-Schritt `npm run test:bond-v2` ab CP2, einschließlich negativer
Preis-/FX-/Herkunfts-/Datumsfälle, Kalender, Residual, unabhängiger Duration/DV01,
Migration und tatsächlichem Speicher-Roundtrip. `test:multi-depot` und
`test:modelportfolio` bleiben nicht-optionale CI-Schritte.

Finales lokales Gate am18.09.2026: `test:bond-v2` (22 benannte Testgruppen),
`test:cp1` (A–E plus13 Review-Regressionen), `test:3b`, `test:multi-depot`
(58 Assertions), `test:modelportfolio` (16 Assertions), `test:4b`, `test:risk-v2`,
Typecheck und Produktionsbuild erfolgreich. Arbeitsdiff und Branch-Diff gegen
`origin/main` ohne Whitespace-Fehler. Feature-CI auf dem danach erzeugten CP2-Commit
wird vor Abschluss remote geprüft; Commit-SHA und CI-Link stehen im PR und im
Abschlussbericht, ohne eine Selbstreferenz im Commit vorzutäuschen.

**Echte Quellenblocker:** Berichtswährung, FX-Richtung, AI-Währung und AI-Quantisierung
wie in Abschnitt2. Kein Warten auf manuelle Kundendatenpflege. Keine behauptete
fachliche Gesamtfreigabe für die nicht beweisbare EUR-Basis.

**Absichtlich außerhalb CP2:** CP3-Aggregate/Teiluniversen und disjunkte Coverages,
Ausschlusscheckbox samt Lifecycle-Ausbau, proportionale PLAN-Mengen, nach Währung
getrennte vollständige Leiter/Nullmarktwertdarstellung und gemeinsamer neuer
Exportdatenbuilder. Die bestehende Leiter ist damit noch nicht als V2-Gesamtabnahme
freigegeben. CP4: interaktive Gesamtprüfung, vollständige tatsächliche Bond-Excel-/
Druckabnahme, Master-/Release-Dokumentation und Versionsanhebung. Nicht umgesetzt.

**Nicht fundamentaler späterer Feinschliff:** differenzierter Sensitivitätswarntext
statt konservativem31-Tage-Hinweis; sprachliche Erweiterung der erkennbaren
Sonderstrukturbegriffe (weiterhin nur Ausschluss, keine Vertragsableitung);
komfortablere aufklappbare Statusdetails. Keine dieser Arbeiten darf unbekannte
Einheiten, fehlende Cashflows oder eine inkonsistente Mengenbasis freigeben.

Interaktiver Browser-E2E wurde in CP2 nicht behauptet. Die bestehende CP1-Suite
prüft React-Darstellung und tatsächlich erzeugte Excel-/Druck-Depotwerte; das
ersetzt keine spätere vollständige Bond-Oberflächenabnahme.
