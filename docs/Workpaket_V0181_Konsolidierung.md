# VermögensNavigator – Workpaket V0.18.1 Konsolidierung

## Status

Verbindliches Umsetzungsdokument für den Nachtrag nach V0.18.0 Multi Depot.

Dieses Workpaket bündelt drei bereits fachlich entschiedene Themen:

1. **Multi-Depot-Hardening** auf Basis des unabhängigen Reviews von V0.18.0
2. **Korrektur der Modellportfolio-Semantik** für Ergänzen, Ersetzen und neue Variante
3. **Erweiterung Zins & Laufzeiten** um Ø modellierte YTM und Ø laufende Verzinsung inklusive Coverage

Keine darüber hinausgehenden Roadmap-Funktionen in dieses Paket hineinziehen.

---

# 1. Ausgangsbasis

Repository:

`LeonMoebius-code/vermoegensnavigator`

Ausgangsversion:

`V0.18.0`

Persistenzschema:

`10`

V0.18.0 wurde mit Multi Depot vollständig umgesetzt, getestet, integriert und veröffentlicht.

Relevante Referenzen:

- V0.18.0 Ausgangs-main vor Umsetzung: `7855a97908805cb0835378738571b2d9aa62caf4`
- V0.18.0 Merge-SHA: `4ad6ad937fb25c1699b18df003fabf602acae20a`
- V0.18.0 Pages-Build-Commit: `78c6def436eb2cc4c59fadaaf6910e3b6e2e297d`

Zielversion dieses Pakets:

`V0.18.1`

Zielschema:

`10`

Ein Schema-Bump ist für dieses Paket nicht vorgesehen. Falls die Umsetzung entgegen der Erwartung eine neue persistierte Struktur zwingend benötigen sollte, ist nicht eigenständig eine Migration einzuführen. Stattdessen stabilen Stand sichern und konkrete Rückfrage stellen.

---

# 2. Verbindliche Arbeitsgrundlage

Zu Beginn einmal gezielt lesen:

- `docs/VermoegensNavigator_Master-Spezifikation.md`
- `docs/Workpaket_Multi_Depot_V018.md`
- `docs/Roadmap_Nachtrag_2026-09-15.md`
  - für dieses Paket insbesondere Abschnitt 2: Bestandsdepot als Standard in der Gesamtplanung
  - Abschnitt 4: Modellportfolio anwenden – Semantik der drei Aktionen
  - Abschnitt 5: Depotcheck – durchschnittliche Rendite im Bereich Zins & Laufzeiten
- `docs/Workpaket_3B_Technisches_Preflight.md`
- `docs/Workpaket_4A1_Technisches_Preflight.md`
  - nur soweit Kapitaltöpfe, Allokationen, Depotmodi und Reconciliation betroffen sind
- die tatsächlich betroffenen aktuellen Codebereiche

Keine Webrecherche, sofern keine konkrete technische Blockade besteht.

Keine neuen Fachentscheidungen erfinden.

---

# 3. Branch-, Checkpoint- und Merge-Strategie

## Branch

Arbeitsbranch:

`work/v0181-konsolidierung`

## Start

1. Working Tree muss sauber sein.
2. `git fetch origin main`
3. lokalen `main` ausschließlich per Fast-Forward auf `origin/main` aktualisieren
4. Ausgangs-SHA dokumentieren
5. Arbeitsbranch erstellen

## Checkpoints

Dieses Paket wird in drei fachlich getrennten Checkpoints umgesetzt.

### Checkpoint 1

Multi-Depot-Hardening und verschärfte Multi-Depot-Regressionen.

### Checkpoint 2

Modellportfolio-Semantik und zugehörige Regressionen.

### Checkpoint 3

Ø modellierte YTM, Ø laufende Verzinsung, Coverage, UI-/Exportergänzung und 3B-Regression.

Nach jedem Checkpoint einen nachvollziehbaren Commit erstellen und die vorgesehenen Tests ausführen, bevor weitergearbeitet wird.

## Merge

Merge nach `main` ausschließlich, wenn:

- alle lokalen Regressionen grün sind
- Feature CI vollständig grün ist
- `git diff --check origin/main...HEAD` grün ist
- keine bekannten Scope-Widersprüche offen sind

Danach Pages einmal nach bestehender Repository-Strategie aktualisieren.

---

# 4. BLOCK 1 – Multi-Depot-Hardening

Ein unabhängiger Review von V0.18.0 hat sechs belastbare Findings ergeben. Diese sechs Punkte sind vollständig zu beheben.

## 4.1 Replacement-Matching global eindeutig 1:1

### Problem

Das aktuelle Replacement-Matching kann zulassen, dass mehrere alte Holdings dieselbe neue Holding beanspruchen, wenn unterschiedliche Matching-Stufen greifen.

Beispiel:

- alte Position A ohne WKN, Name X
- alte Position B mit WKN Y
- neue Position besitzt Name X und WKN Y

Wenn A über Namensfallback und B über WKN dieselbe neue Holding beanspruchen können, ist die Zuordnung nicht eindeutig.

### Verbindliche Matching-Priorität

Innerhalb des konkret zu ersetzenden Depots:

1. identische Holding-ID
2. eindeutige WKN
3. eindeutige `productId`
4. ausschließlich konservativer eindeutiger Fallback

### Verbindliche Regeln

- Matching vollständig depotbegrenzt
- jede alte Holding höchstens einmal
- jede neue Holding höchstens einmal
- höher priorisierte Identitäten dürfen nicht durch niedrigere Fallbacks verdrängt werden
- bereits erfolgreich zugeordnete alte und neue Holdings stehen späteren Matching-Stufen nicht erneut zur Verfügung
- bei Mehrdeutigkeit kein heuristisches Match
- Planned Sales und Plan-Holding-Referenzen müssen aus derselben finalen eindeutigen Mapping-Tabelle übernommen bzw. remapped werden
- keine separate, abweichende Matching-Logik für Planned Sales und Planreferenzen

Planned Sale bleibt:

`min(alter Planned Sale, neuer Marktwert)`

### Verbindlicher Regressionstest

Mindestens:

- alte Position A ohne WKN, Name X, Planned Sale A
- alte Position B mit WKN Y, Planned Sale B
- neue Position mit Name X und WKN Y
- WKN-Zuordnung zu B gewinnt
- A darf die neue Holding nicht zusätzlich über Namensfallback beanspruchen
- Planned Sale stammt nur aus B
- keine doppelte oder falsche Planreferenz

---

## 4.2 Depotbezogenes „CSV ersetzen“ muss das geklickte Depot vorauswählen

### Problem

Beim Klick auf „CSV ersetzen“ innerhalb eines konkreten DepotAccounts darf nicht pauschal das erste Depot als Replacement-Ziel vorausgewählt werden.

### Verbindlich

- der depotbezogene Button übergibt die konkrete `depotId`
- exakt dieses Depot wird initial als Replacement-Ziel vorbelegt
- der Benutzer darf das Ziel in der Vorschau weiterhin bewusst ändern, sofern das bestehende UI dies vorsieht
- keine implizite Auswahl von `depotAccounts[0]`, wenn ein konkreter Depotbezug vorhanden ist

### Test

Mindestens zwei Depots anlegen.

Beim Klick auf „CSV ersetzen“ des zweiten Depots muss das zweite Depot vorausgewählt sein.

Replacement darf ohne manuelle Dropdown-Korrektur nicht das erste Depot ersetzen.

---

## 4.3 Import-/Replacement-Aktionen müssen in allen Depotcheck-Tabs funktionieren

### Problem

Die Depotverwaltung ist oberhalb der Depotcheck-Untertabs sichtbar. File-Input und Importvorschau dürfen daher nicht nur dann funktionsfähig sein, wenn `Bestand & Transaktionen` aktiv ist.

### Zielbild

- „Weiteres Depot hinzufügen“ funktioniert aus jedem Depotcheck-Untertab
- „CSV ersetzen“ funktioniert aus jedem Depotcheck-Untertab
- File-Input ist unabhängig vom aktiven Analyse-Tab verfügbar
- Vorschau erscheint zuverlässig
- keine sichtbaren Buttons ohne Funktion

Bevorzugte technische Lösung:

Import-State, versteckter File-Input und Vorschau nicht ausschließlich innerhalb des `positions`-Renderzweigs mounten.

Keine unnötige Neugestaltung der Depotcheck-Navigation.

---

## 4.4 `advisory.depotValue` – nur eine Wahrheit

### Fachliche Regel

Sobald konkrete physische Holdings vorhanden sind, gilt verbindlich:

`advisory.depotValue = Summe der Marktwerte aller physischen Holdings über alle DepotAccounts`

Es darf dann keine zweite manuell editierbare Wahrheit geben.

### Verbindlich

- bei vorhandenen Holdings das Feld „Wertpapierdepot“ in der Ausgangslage als berechneten Wert darstellen bzw. nicht frei editierbar machen
- Import aktualisiert den Gesamtwert
- Replacement aktualisiert den Gesamtwert
- Delete aktualisiert den Gesamtwert
- `normalizeImportedCase(...)` normalisiert bei konkreten Holdings auf deren Summe
- Ergebnis- und Exportansichten verwenden dieselbe Depotwert-Wahrheit
- ohne konkrete Holdings bleibt die bestehende Möglichkeit erhalten, einen Depotgesamtwert manuell zu erfassen
- `hasDepot` semantisch nicht verschlechtern

### Migration / Normalisierung

Ein gespeicherter Fall mit:

- konkreten Holdings von 100.000 €
- `advisory.depotValue = 1 €`

muss nach `normalizeImportedCase(...)` einen Depotwert von 100.000 € verwenden.

Keine zusätzliche Schema-Migration nötig.

---

## 4.5 Erster konkreter Import per Replacement muss `afterSales` setzen

### Fachliche Regel

Die bereits beschlossene Erstimportregel gilt unabhängig vom technischen Importweg.

Wenn vor der Operation noch kein konkreter physischer Holdingbestand vorhanden war und nach Replacement erstmals konkrete Holdings vorhanden sind:

- unangetasteter/default Plan → `depotMode = "afterSales"`
- bewusst gewählter Depotmodus → niemals überschreiben

### Nicht auslösen bei

- leerem DepotAccount ohne Holdings
- CSV ohne konkrete Holdings
- bereits vorhandenem konkreten Holdingbestand

### Test

Leeren DepotAccount erzeugen, danach erstmals konkrete Holdings per Replacement einspielen.

Ein unangetasteter Plan muss auf `afterSales` wechseln.

Ein zuvor bewusst gesetzter Depotmodus muss unverändert bleiben.

---

## 4.6 Multi-Depot-Regressionssuite A–V fachlich stärken

Die Testbezeichnungen A–V dürfen nicht nur nominell behaupten, Anforderungen abzudecken.

Mindestens folgende bestehende Prüfungen fachlich verstärken:

### L – tote Referenz

Eine tatsächlich vorher ausgewählte Holding muss beim Replacement verschwinden.

Die reale tote Planreferenz muss anschließend entfernt sein.

Nicht nur auf eine ID prüfen, die zuvor gar nicht ausgewählt war.

### Q – wirtschaftliche Konzentration im PLAN

Gleiches wirtschaftliches Wertpapier über mehrere Depots verwenden.

Dann PLAN-Veränderung durchführen und anschließend prüfen, dass die wirtschaftliche Konzentrationsaggregation korrekt bleibt.

### T – gemischte Bewertungsstichtage

Mindestens zwei geeignete Bondpositionen mit unterschiedlichen Bewertungsstichtagen verwenden.

Der Test muss scheitern, wenn versehentlich ein gemeinsamer/globaler Bond-Stichtag verwendet würde.

### U – Einstand & Ergebnis

Mindestens zwei physisch getrennte Positionen mit unterschiedlichen Einstands-/Ergebnisdaten verwenden.

Prüfen, dass die Rohzeilen getrennt bleiben und nicht wirtschaftlich zusammengezogen werden.

### V – Export

Den tatsächlichen Multi-Depot-Exportpfad bzw. dessen erzeugte Exportdaten ausführen und fachlich prüfen.

Nicht lediglich Depotnamen oder Hilfsfunktionen prüfen.

### Zusätzlich

Explizite Regressionstests für Findings 1 bis 5 ergänzen.

Keine schwere neue Browser-E2E-Infrastruktur nur für dieses Paket einführen.

Testbare Logik bei Bedarf sauber in pure Helper auslagern.

---

# 5. BLOCK 2 – Modellportfolio-Semantik korrigieren

Verbindliche Grundlage ist Abschnitt 4 des Roadmap-Nachtrags.

Es gibt drei fachlich unterschiedliche Aktionen.

---

## 5.1 Aktuellen Plan ergänzen

### Fachliche Bedeutung

Vorhandene Planung bleibt bestehen.

Nur noch nicht verplantes strategisches Kapital wird standardmäßig mit dem Modellportfolio ergänzt.

### Standardbetrag

`max(0, strategischer Kapitaltopf - bereits gültig strategisch allokiertes Kapital)`

Beispiel:

- strategischer Topf 360.000 €
- bereits strategisch allokiert 210.000 €
- Standardbetrag Modellportfolio = 150.000 €

Nicht nochmals 360.000 € zusätzlich anlegen.

### Verbindlich

- bestehende Allokationen bleiben vollständig erhalten
- Modellallokationen werden nur für den tatsächlich gewählten Betrag ergänzt
- Standardbetrag = strategischer Restbetrag
- Mindestwert 0
- keine negativen Allokationen
- keine sinnlosen Null-Allokationen erzeugen
- Betrag bleibt sichtbar/editierbar
- bewusste Überplanung darf nicht still korrigiert oder versteckt werden
- bestehende Überdeckungs-/Plausibilitätslogik soll bewusste Überplanung transparent machen

---

## 5.2 Aktuellen Plan ersetzen

### Fachliche Bedeutung

„Ersetzen“ bezieht sich ausschließlich auf den strategischen Kapitaltopf.

### Entfernen

- strategische Allokationen
- Referenzen auf tatsächlich entfernte strategische Allokationen, soweit sie dadurch ungültig werden

### Erhalten

- Reserve-Allokationen
- Jahres-/Bedarfstopf-Allokationen
- deren gültige Umsetzungsbezüge
- sonstige nicht-strategische Planung

### Verbindlich

- Modellportfolio wird auf den vorgesehenen strategischen Betrag angewendet
- nicht-strategische Allokationen bleiben unverändert
- gültige nicht-strategische InvestmentPlan-Referenzen bleiben erhalten
- keine toten `allocationId`-Referenzen
- keine heuristische Zuordnung alter strategischer Umsetzungspläne zu neuen Modellportfolio-Allokationen

---

## 5.3 Als neue Variante

### Fachliche Bedeutung

Eine neue Planvariante wird aus dem aktuellen Plan erzeugt.

Der Ursprungsplan bleibt unverändert.

### Verbindlich

- nicht-strategische Allokationen aus dem Ursprungsplan übernehmen
- strategischen Teil in der neuen Variante mit dem Modellportfolio gestalten
- nicht-strategische gültige Umsetzungsbezüge erhalten
- Referenzen auf ersetzte strategische Allokationen sauber reconciliieren
- dort neue IDs erzeugen bzw. remappen, wo die bestehende Plan-Duplikationslogik dies verlangt
- keine unbeabsichtigte gemeinsame mutable Identität zwischen Varianten
- Ursprungsplan darf durch spätere Bearbeitung der neuen Variante nicht verändert werden

---

## 5.4 Modellportfolio-Regressionssuite

Eine dedizierte automatisierte Regression ergänzen.

Wenn sinnvoll:

`npm run test:modelportfolio`

Mindestens prüfen:

1. strategischer Topf 360.000 €, 210.000 € bereits strategisch verplant → Ergänzen default 150.000 €
2. Ergänzen erhält alle bestehenden Allokationen
3. Ergänzen erzeugt keine negativen Restbeträge
4. bewusste Überplanung wird nicht still umgerechnet
5. Ersetzen entfernt ausschließlich strategische Allokationen
6. Reserve bleibt erhalten
7. Jahres-/Bedarfstopf bleibt erhalten
8. gültige nicht-strategische InvestmentPlan-Referenzen bleiben erhalten
9. tote strategische Referenzen verschwinden
10. neue Variante verändert Ursprungsplan nicht
11. neue Variante übernimmt nicht-strategische Planung korrekt
12. ID-/Referenzbeziehungen zwischen Ursprungsplan und Variante bleiben sauber

Falls ein neues npm-Testscript entsteht, in Feature CI aufnehmen.

---

# 6. BLOCK 3 – Ø modellierte YTM und Ø laufende Verzinsung

Verbindliche Grundlage ist Abschnitt 5 des Roadmap-Nachtrags sowie die bestehende 3B-Bondanalyse.

Die vorhandene positionsbezogene Engine bleibt die Grundlage.

Keine neue vollständige Cashflow-IRR-Engine bauen.

---

## 6.1 Ø modellierte YTM

Für alle direkten Festzinsanleihen, für die die bestehende Engine eine belastbare modellierte YTM berechnet:

`Ø YTM = Summe(Marktwert_i × YTM_i) / Summe(Marktwert_i des YTM-berechenbaren Teilbestands)`

### Verbindlich

- marktwertgewichtet
- ausschließlich berechenbarer Teilbestand
- Coverage sichtbar ausweisen
- Coverage bezieht sich auf den marktwertbezogenen Anteil des direkten Anleihebestands, für den YTM berechenbar ist
- keine Rentenfonds künstlich einbeziehen
- keine Floater ohne belastbaren zukünftigen Cashflowpfad künstlich einbeziehen
- keine Stufenzinsanleihen ohne vollständigen Couponpfad künstlich einbeziehen
- keine Position einbeziehen, für die die bestehende Engine keine YTM liefert

### Bezeichnung

Geeignet:

**Ø modellierte YTM**

mit Zusatz:

`marktwertgewichtet · x % Abdeckung des direkten Anleihebestands`

Nicht verwenden:

- „Rendite des gesamten Rentendepots“
- „Depotrendite“
- sonstige Aussagen, die Vollabdeckung suggerieren

---

## 6.2 Ø laufende Verzinsung

Marktwertgewichteter Durchschnitt für direkte Anleihepositionen, für die die bestehende `currentYield`-Logik einen belastbaren Wert liefert.

Sinngemäß:

`Ø laufende Verzinsung = Summe(Marktwert_i × CurrentYield_i) / Summe(Marktwert_i des berechenbaren Teilbestands)`

### Verbindlich

- eigene Coverage berechnen
- eigene Coverage sichtbar ausweisen
- Current-Yield-Subset kann vom YTM-Subset abweichen
- nicht als Gesamtrendite bezeichnen

---

## 6.3 Bestehende Kennzahlen unverändert erhalten

- Restlaufzeit
- laufende Verzinsung je Position
- modellierte YTM je Position
- Macaulay Duration
- Modified Duration
- DV01
- Laufzeitenleiter
- Zinsszenarien
- bestehende Ausschlussgründe

Keine Berechnungen für nicht belastbare Instrumente erfinden.

---

## 6.4 Darstellung

Die beiden neuen Kennzahlen kompakt in die bestehende Portfoliozusammenfassung von `Zins & Laufzeiten` integrieren.

Keine Neugestaltung des gesamten Depotchecks.

Wenn der bestehende Export die Bondanalyse zusammenfasst, dort die beiden Kennzahlen inklusive Coverage ebenfalls ergänzen.

Kein allgemeines Export-Redesign.

---

## 6.5 3B-Regressionssuite erweitern

Mindestens:

- zwei berechenbare Festzinsanleihen mit unterschiedlichen Marktwerten und unterschiedlichen YTMs
- marktwertgewichteten YTM-Durchschnitt gegen unabhängig erwarteten Wert prüfen
- YTM-Coverage korrekt prüfen
- eine nicht YTM-berechenbare Rentenposition verändert den YTM-Zähler nicht
- laufende Verzinsung separat marktwertgewichtet prüfen
- Current-Yield-Coverage separat prüfen
- unterschiedliche Berechenbarkeit von Current Yield und YTM darf zu unterschiedlicher Coverage führen
- bestehende Referenzwerte für Modified Duration und DV01 dürfen nicht regressieren
- bestehende Produktarten-/Bond-Regressionen bleiben grün

Erwartungswerte nicht tautologisch mit derselben Produktionsfunktion erzeugen.

---

# 7. Checkpoint-Gates

## Checkpoint 1 – Multi Depot

Mindestens:

- `npm run test:multi-depot`
- `npm run test:3b`
- `npm run test:4b`
- `npm run test:risk-v2`
- `npm run typecheck`

Erst bei grün weiter.

---

## Checkpoint 2 – Modellportfolio

Checkpoint-1-Tests erneut plus, sofern angelegt:

- `npm run test:modelportfolio`

Erst bei grün weiter.

---

## Checkpoint 3 – Bond-Kennzahlen

Komplette Regression:

- `npm run test:multi-depot`
- `npm run test:modelportfolio` sofern vorhanden
- `npm run test:3b`
- `npm run test:4b`
- `npm run test:risk-v2`
- `npm run typecheck`
- `npm run build`

Danach:

`git diff --check origin/main...HEAD`

`git status`

---

# 8. Feature CI

Bestehende Feature CI weiterverwenden.

Falls `test:modelportfolio` neu angelegt wird, muss die Feature CI dieses Script verbindlich ausführen.

Feature CI darf keine Commits oder Deployments erzeugen.

Merge nach `main` ausschließlich bei vollständig grüner Feature CI.

---

# 9. Version und Dokumentation

## Version

`0.18.1`

## Schema

`10`

Keine unnötige Migration.

## Dokumentation

- Master-Spezifikation nur dort aktualisieren, wo die jetzt tatsächlich implementierte Fachlogik andernfalls widersprüchlich oder veraltet wäre
- `Roadmap_Nachtrag_2026-09-15.md` als historische Entscheidungsgrundlage erhalten
- dieses Workpaket als Implementierungsnachweis im Repository belassen
- keine neue Fachlogik allein durch Dokumentation erfinden

---

# 10. Scope-Ausschluss

Nicht Teil von V0.18.1:

- V0.19 freier Planvergleich
- V0.20 Auszahlplan
- Ruhestandsplanung
- Inflation & Kaufkraft
- sonstige Vertiefungen
- neue Risikologik
- neue Kapitaltopfarten
- Live-Marktdaten
- APIs
- Backend
- Benutzerverwaltung
- Zieldepot-/Orderrouting
- Branding-/Logo-Nachträge
- allgemeines Export-Redesign
- sonstige spätere Roadmap-Themen

Keine unbeabsichtigten fachlichen Nebenänderungen außerhalb der drei definierten Blöcke.

---

# 11. Datenschutz / Testdaten

Keine realen Kunden- oder Bankdaten verwenden.

Für automatisierte Tests ausschließlich synthetische Daten.

---

# 12. Finaler Qualitätsgate

Vor Integration müssen mindestens vollständig grün sein:

- `npm run test:multi-depot`
- `npm run test:modelportfolio` sofern neu angelegt
- `npm run test:3b`
- `npm run test:4b`
- `npm run test:risk-v2`
- `npm run typecheck`
- `npm run build`
- `git diff --check origin/main...HEAD`

Zusätzlich:

- `git status` sauber
- keine toten Referenzen aus den beschriebenen Lifecycle-Fällen
- keine Scope-Erweiterung
- Version 0.18.1
- Schema 10

Danach:

1. Arbeitsbranch pushen
2. Feature CI ausführen
3. Feature CI vollständig grün abwarten
4. nach `main` mergen
5. Pages einmal nach bestehender Repository-Strategie aktualisieren
6. prüfen, dass die veröffentlichte Anwendung `Prototyp V0.18.1` zeigt

Wenn ein echter fachlicher Widerspruch zwischen diesem Workpaket, aktuellem Code und Master-Spezifikation entsteht, stabilen Branch sichern und konkrete Rückfrage stellen.

Nicht selbst neu konzipieren.

---

# 13. Abschlussbericht

Am Ende kompakt dokumentieren:

- Ausgangs-main-SHA
- verwendeter Branch
- Checkpoint-SHAs
- Version / Schema
- Lösung der sechs Multi-Depot-Findings
- Modellportfolio-Korrekturen
- neue Ø-YTM-/Current-Yield-Kennzahlen
- neue bzw. verschärfte Tests
- alle lokalen Testergebnisse
- Feature-CI-Run
- finaler Merge-SHA
- Pages-Build-/Deployment-Status
- verbleibende bekannte Einschränkungen, falls vorhanden
