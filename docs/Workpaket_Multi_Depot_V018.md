# Workpaket V0.18.0 – Multi Depot

Repository: `LeonMoebius-code/vermoegensnavigator`

Arbeite auf dem bei Start dieses Auftrags aktuellen `main`.

Dieses Paket setzt Multi Depot vollständig um. Keine angrenzenden Roadmap-Themen implementieren.

## 0. Verbindliche Arbeitsgrundlage

Lies zu Beginn gezielt einmal:

1. `docs/VermoegensNavigator_Master-Spezifikation.md`
2. `docs/Workpaket_4A1_Technisches_Preflight.md`
3. `docs/Workpaket_3B_Technisches_Preflight.md`
4. `docs/Workpaket_4B_Technisches_Preflight.md`

Prüfe danach nur die tatsächlich betroffenen aktuellen Codebereiche:

- `app/case-model.ts`
- `app/depot-csv.ts`
- `app/depot-analysis.ts`
- `app/page.tsx`
- bestehende Exportlogik
- bestehende Regressionstests

Die Dokumente nicht wiederholt vollständig neu einlesen.

Aktueller erwarteter Ausgangsstand:

- Version V0.17.0
- Persistenzschema 9
- Risiko V2 umgesetzt
- 4A.1 umgesetzt
- 4B umgesetzt
- Depotcheck 3B umgesetzt
- V0.16.1 Sichtprüfungsnachtrag umgesetzt

## 1. Auftrag

Setze vollständig um:

**V0.18.0 Multi Depot**

Arbeitsbranch:

`work/multi-depot-v018`

Zielversion:

**0.18.0**

Ziel-Persistenzschema:

**10**

Ziel:

Ein Beratungsfall kann künftig mehrere eigenständige Wertpapierdepots enthalten.

Jedes Depot besitzt:

- stabile technische ID
- frei editierbaren Namen
- eigene physische Positionen
- eigenen CSV Snapshot

Die wirtschaftlichen Analysen des VermögensNavigator arbeiten grundsätzlich mit dem aggregierten Gesamtdepot.

Bestands- und Transaktionsdarstellungen bleiben dagegen depotbezogen getrennt.

## 2. Fachliche Grundregeln

Multi Depot bedeutet ausdrücklich NICHT:

- getrennte Beratungsfälle
- getrennte Vermögenshäuser
- getrennte Risikoprofile
- getrennte Strukturpläne
- getrennte Kapitaltöpfe

Ein Beratungsfall besitzt weiterhin genau eine gemeinsame Vermögensplanung.

Mehrere Depots sind lediglich verschiedene Verwahrstellen bzw. physische Bestandsgruppen innerhalb dieses Falls.

Deshalb gilt:

**Physische Positionsebene**
→ depotbezogen getrennt

**Wirtschaftliche Gesamtanalyse**
→ über alle Depots aggregiert

## 3. Kein „Depot ergänzen“

Der bisherige CSV Modus `append` bzw. fachlich „Depot ergänzen“ wird für Multi Depot NICHT weiterverwendet.

Es gibt künftig genau zwei fachliche CSV Aktionen:

1. **Als neues Depot hinzufügen**
2. **Bestehendes Depot ersetzen**

Keine dritte Aktion „Depot ergänzen“.

Eine hochgeladene CSV wird immer als vollständiger aktueller Snapshot eines Depots verstanden.

Wenn sich ein bestehendes Depot verändert hat, wird für genau dieses Depot eine neue vollständige CSV hochgeladen und das Depot ersetzt.

## 4. Mehrere identische Wertpapiere sind normal

Es ist ausdrücklich zulässig und erwartet, dass verschiedene Depots dieselben Wertpapiere enthalten.

Beispiel:

Depot 1:
- Allianz
- BASF
- Siemens
- SAP
- usw.

Depot 2:
- dieselben Wertpapiere
- andere Stückzahlen
- andere Einstandswerte
- andere Kaufhistorie

Es gibt deshalb KEINE Warnung wegen gleicher WKN zwischen verschiedenen Depots.

Es gibt auch keine Dublettenlogik, die solche Positionen beim Import verhindern soll.

## 5. Ziel-Datenmodell

Die heute vorhandene flache Holdingliste soll bevorzugt erhalten bleiben.

Kein unnötig tief verschachteltes Modell bauen.

Sinngemäß:

```ts
export type DepotAccount = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type DepotHolding = {
  // bestehende Felder
  depotId: string;
};
```

`AdvisoryCase` erhält:

```ts
depotAccounts: DepotAccount[];
depot: DepotHolding[];
```

Die bestehenden Holdings bleiben damit weiterhin in `item.depot` als flache Gesamtliste vorhanden.

Jede persistierte Holding muss nach Normalisierung genau einem gültigen DepotAccount zugeordnet sein.

## 6. Parser und persistierte Holdings trennen

Der CSV Parser kennt beim Parsen noch nicht das spätere Zieldepot.

Deshalb nicht einfach `depotId` überall optional machen, wenn dadurch die persistierte Invariante verwässert wird.

Bevorzugt einen separaten Parsed/Input Typ verwenden.

Sinngemäß:

```ts
type ParsedDepotHolding = Omit<DepotHolding, "depotId">;
```

oder eine technisch gleichwertige Lösung.

`parseDepotCsv(...)` liefert zunächst nicht zugeordnete Importpositionen.

Erst bei:

- neues Depot hinzufügen
- bestehendes Depot ersetzen

wird die konkrete `depotId` gesetzt.

Persistierte AdvisoryCase Holdings müssen danach immer eine gültige `depotId` besitzen.

## 7. Schema 9 → 10 Migration

`normalizeImportedCase(...)` bleibt der zentrale Migrationsweg.

Keine zweite Migrationspipeline bauen.

Für alte Schema 9 und ältere Fälle gilt:

### Fall A
Es existieren konkrete DepotHoldings.

Dann:

- genau einen DepotAccount erzeugen
- Name: `Depot 1`
- bestehende Holding IDs unverändert lassen
- alle bisherigen Holdings diesem Depot zuordnen
- bestehende geplante Verkäufe unverändert erhalten
- bestehende `depotHoldingIds` in Planvarianten unverändert erhalten

### Fall B
Es existieren keine konkreten Holdings.

Dann:

- kein künstliches leeres Depot erzeugen
- `depotAccounts = []`

Keine historischen Versionssnapshots rückwirkend verändern.

Bei Wiederherstellung eines Snapshots die aktive Arbeitskopie wie bisher normalisieren.

## 8. Neue Fälle

Neue Fälle starten mit:

```ts
depotAccounts: []
depot: []
```

Kein leeres `Depot 1`, solange noch kein konkretes Depot importiert wurde.

## 9. Depotnamen

Beim Hinzufügen eines neuen Depots wird ein sinnvoller Standardname vorgeschlagen:

- Depot 1
- Depot 2
- Depot 3
- usw.

Der Name kann vor dem Import oder danach frei geändert werden.

Beispiele:

- Volksbank pur
- Altbestand
- Fremdbank
- Depot Ehefrau
- Firmenvermögen

Die technische Zuordnung darf niemals vom sichtbaren Namen abhängen.

Verwende ausschließlich die stabile `depotId`.

Umbenennen verändert keine Holding- oder Planreferenzen.

## 10. Keine Depotnummer / kein Depotinhaber aus CSV übernehmen

Die bestehende Datenschutzlogik bleibt bestehen.

Falls eine Strukturübersicht Spalten wie:

- Depot-Nr.
- Depotinhaber

enthält, werden diese weiterhin NICHT als notwendige Stammdaten in den Fall übernommen.

Der sichtbare Depotname wird im Navigator manuell vergeben.

Keine echten Depotnummern zur technischen Identifikation benutzen.

## 11. CSV Import als neues Depot

Nach der bestehenden Importvorschau muss eine Aktion verfügbar sein:

**Als neues Depot hinzufügen**

Ablauf:

1. CSV parsen
2. Importvorschau zeigen
3. Depotname mit nächstem Standardnamen vorbelegen
4. Nutzer kann Namen ändern
5. DepotAccount erzeugen
6. allen importierten Holdings dessen `depotId` zuweisen
7. Holdings zusätzlich in die bestehende flache Gesamtdepotliste übernehmen
8. `advisory.depotValue` auf Summe aller konkreten Holdings aktualisieren
9. `hasDepot` entsprechend bestehender Logik mindestens auf true setzen

Keine Dublettenprüfung gegen andere Depots.

## 12. Bestehendes Depot ersetzen

Zweite Aktion:

**Bestehendes Depot ersetzen**

Falls mehrere Depots existieren:

Zieldepot über Dropdown auswählen.

Beispiel:

- Volksbank pur
- Altbestand
- Fremdbank

Beim Ersetzen:

- DepotAccount bleibt bestehen
- `depotId` bleibt bestehen
- Depotname bleibt bestehen
- nur die Holdings dieses einen Depots werden ausgetauscht
- Holdings aller anderen Depots bleiben unverändert
- neue CSV Positionen erhalten die bestehende `depotId`

Kein globales `replace` mehr, das alle Depots gleichzeitig löscht.

## 13. Kein append mehr

Der heutige technische Importmodus:

```ts
"replace" | "append"
```

muss fachlich auf Multi Depot angepasst werden.

Der alte append Pfad darf nicht als versteckte dritte Importvariante bestehen bleiben, sofern er nur den alten Ein-Depot-Workflow abbildet.

Bevorzugte neue Semantik:

- `newDepot`
- `replaceDepot`

oder technisch gleichwertig.

Keine Positionen einfach an ein bestehendes Depot anhängen.

## 14. Depot Replacement Reconciliation

Beim Ersetzen eines konkreten Depots müssen bestehende bewusste Planbezüge soweit sicher möglich erhalten bleiben.

Heute existiert bereits:

`reconcileDepotHoldingSelections(...)`

Diese Logik soll Multi Depot fähig erweitert werden.

WICHTIG:

Matching darf beim Replacement ausschließlich innerhalb desselben DepotAccounts stattfinden.

Beispiel:

Depot 1 alt:
- Allianz WKN 840400 Holding A

Depot 2:
- Allianz WKN 840400 Holding B

Depot 1 neu:
- Allianz WKN 840400 Holding C

Dann:

A → C

Niemals:

A → B

nur weil Depot 2 dieselbe WKN besitzt.

## 15. Replacement Matching

Bevorzugte Reihenfolge:

1. bestehende identische Holding ID, falls technisch vorhanden
2. innerhalb desselben Depots eindeutige WKN
3. innerhalb desselben Depots eindeutige productId
4. bestehende konservative Fallbacks nur wenn eindeutig

Keine depotübergreifende Zuordnung.

Keine unsichere Namensheuristik einführen.

Wenn ein Match innerhalb desselben Depots mehrdeutig ist:

- nicht raten
- Referenz nicht automatisch auf eine beliebige Position verschieben

## 16. Geplante Verkäufe beim CSV Replacement

Bestehende simulierte Verkäufe sollen bei eindeutig wiedererkannter Position erhalten bleiben.

Beispiel:

Alt:

Allianz
Marktwert 50.000 €
geplanter Verkauf 20.000 €

Neu:

Allianz
Marktwert 52.000 €

Ergebnis:

geplanter Verkauf weiterhin 20.000 €.

Wenn neuer Marktwert kleiner ist:

Alt:
20.000 € geplanter Verkauf

Neu:
15.000 € Marktwert

Dann:

geplanter Verkauf maximal 15.000 €.

Also:

```ts
plannedSale = Math.min(oldPlannedSale, newHolding.value)
```

Bei verschwundener Position:

- Holding entfällt
- geplanter Verkauf entfällt
- tote Planreferenzen entfernen

Nur bei eindeutigem Replacement Match übertragen.

## 17. Depot löschen

Jedes Depot kann gelöscht werden.

Vor Bestätigung sichtbar machen:

- Depotname
- Anzahl Positionen
- Marktwert

Sinngemäße Warnung:

„Dieses Depot und seine Positionen werden aus dem Fall entfernt. Bestehende Berücksichtigungen dieser Positionen in Planvarianten werden bereinigt.“

Nach Bestätigung:

- DepotAccount entfernen
- alle Holdings mit dieser depotId entfernen
- tote `depotHoldingIds` aus allen Planvarianten entfernen
- sonstige tote Holdingreferenzen bereinigen
- Depotwerte neu berechnen

Keine automatische Verschiebung in ein anderes Depot.

`hasDepot` weiterhin entsprechend bestehender Semantik behandeln.

Nicht zwangsläufig auf false setzen, wenn der Nutzer grundsätzlich weiterhin „Depot vorhanden“ hinterlegt hat.

## 18. Depot umbenennen

Depotname direkt editierbar.

Änderung betrifft ausschließlich:

`DepotAccount.name`

Keine Änderung an:

- `depotId`
- Holding IDs
- Planreferenzen
- simulierten Verkäufen
- Analysen

## 19. Ausgangslage

Die Ausgangslage zeigt weiterhin einen gesamten Wert:

**Wertpapiervermögen**

Wenn konkrete Depotpositionen vorhanden sind:

`depotValue = Summe aller importierten Holdings`

Zusätzlich kompakt:

z. B.

`700.000 € · 2 Depots`

Optional aufklappbar bzw. kompakt darunter:

- Altbestand 430.000 €
- Volksbank pur 270.000 €

Kein zweites Vermögenshaus je Depot.

## 20. Bestand & Transaktionen

Hier gilt ausdrücklich:

**NICHT wirtschaftlich aggregieren.**

Die Positionen werden nach Depot gruppiert dargestellt.

Beispiel:

### Depot 1 · Altbestand
430.000 € · 50 Positionen

[Positionstabelle]

### Depot 2 · Volksbank pur
270.000 € · 47 Positionen

[Positionstabelle]

Wenn Allianz in beiden Depots liegt:

- Allianz erscheint in Depot 1
- Allianz erscheint in Depot 2

Die Positionen bleiben separat.

Das ist notwendig wegen möglicherweise unterschiedlicher:

- Stückzahlen
- Einstandskurse
- Einstandszeitpunkte
- Kaufkosten
- Kursgewinne
- geplanten Verkäufe
- Notizen

## 21. Transaktionen bleiben holdingbezogen

Ein simulierter Verkauf bezieht sich weiterhin auf genau eine physische Holding.

Beispiel:

Depot 1 Allianz:
- 50.000 €
- Verkauf 20.000 €

Depot 2 Allianz:
- 30.000 €
- Verkauf 0 €

PLAN Restbestand wirtschaftlich:

Allianz 60.000 €

Operativ bleiben die zwei Holdings getrennt.

## 22. Vermögenshaus

Das Vermögenshaus arbeitet vollständig aggregiert über alle Depots.

Beispiel:

Depot 1:
- Aktien 200.000 €
- Renten 230.000 €

Depot 2:
- Aktien 100.000 €
- Renten 170.000 €

Vermögenshaus IST:

- Aktien 300.000 €
- Renten 400.000 €

Die bestehende fünf Säulen Logik bleibt erhalten.

Kein Vermögenshaus je Depot.

## 23. Strukturplanung

Die bestehenden Depotmodi bleiben planweit unverändert:

- Nicht berücksichtigen
- Nur im IST berücksichtigen
- Ausgewählte Positionen beibehalten
- Nach simulierten Verkäufen

Keine Depotmodi pro Depot einführen.

Bei:

`Ausgewählte Positionen beibehalten`

die Holdings künftig optisch nach Depot gruppieren.

Beispiel:

### Altbestand
☑ Allianz
☑ Siemens
☐ BASF

### Volksbank pur
☐ Allianz
☑ SAP

Die technische Auswahl bleibt weiterhin holdingbezogen über `depotHoldingIds`.

Dadurch kann dieselbe WKN in Depot 1 berücksichtigt und in Depot 2 nicht berücksichtigt werden.

## 24. IST Logik

IST bedeutet weiterhin:

**vollständiger physischer Bestand**

bei Multi Depot:

**vollständiger physischer Bestand aller Depots**

Die Depotzuordnung ändert nicht die wirtschaftliche IST Summe.

## 25. PLAN Logik

PLAN bleibt fachlich:

**physischer Restbestand nach simulierten Verkäufen + geplante Käufe aus StructurePlan.allocations**

Keine Änderung an der in 3B festgelegten PLAN Definition.

Weiterhin NICHT als Kaufvolumen zählen:

- PhasedEntryPlan
- SavingsPlan
- SavingsGoal
- spätere Auszahlpläne

Multi Depot darf keinen zweiten PLAN Motor erzeugen.

## 26. Geplante Neukäufe bleiben depotunabhängig

PlannerAllocation bzw. geplante Neukäufe erhalten in V0.18.0 KEINE Zieldepotzuordnung.

Beispiel:

100.000 € Fondsneuanlage

wird fachlich dem Strukturplan zugerechnet, nicht:

- Depot 1
- Depot 2
- Fremdbank

Keine Depot Routing oder Orderlogik implementieren.

PLAN auf Gesamtvermögensebene enthält:

- Restbestand aller Depots
- geplante Neukäufe

## 27. Diversifikation

Diversifikation arbeitet standardmäßig vollständig über das aggregierte Gesamtdepot.

Keine separate Depotanalyse notwendig.

Die vorhandenen Bereiche bleiben:

- Produktarten
- Branchen
- Produkt-/Emittentenland
- Produktwährungen

Positionen aus verschiedenen Depots werden wirtschaftlich gemeinsam ausgewertet.

Beispiel:

Allianz Depot 1 50.000 €
Allianz Depot 2 30.000 €

Land Deutschland:

+80.000 €

Eine explizite vorherige Holdingzusammenführung ist für diese Summen nicht erforderlich.

Die bestehenden 3B Coverage Regeln bleiben unverändert.

## 28. Konzentrationsanalyse

Die Konzentrationsanalyse ist die wichtige Ausnahme.

Hier müssen identische wirtschaftliche Wertpapiere depotübergreifend zusammengefasst werden.

Beispiel:

Depot 1:
Allianz 50.000 €

Depot 2:
Allianz 30.000 €

Gesamtdepot:
800.000 €

Richtig:

Allianz wirtschaftlich = 80.000 €
Anteil = 10,0 %

Nicht:

zwei getrennte 6,25 % und 3,75 % Positionen.

## 29. Wirtschaftliche Security Identity

Für die Konzentrationsaggregation gilt konservativ:

1. WKN, wenn vorhanden
2. andernfalls productId, wenn vorhanden
3. andernfalls NICHT automatisch zusammenführen

Keine unsichere Aggregation nur anhand ähnlicher Produktnamen.

Helper bevorzugt zentral und rein halten.

Sinngemäß:

`economicSecurityKey(position)`

oder technisch gleichwertig.

## 30. Konzentration IST und PLAN

Die wirtschaftliche Aggregation gilt sowohl für IST als auch PLAN.

Wenn im PLAN:

- Bestand Allianz 80.000 €
- neuer geplanter Kauf Allianz 20.000 €

und beide sicher dieselbe WKN bzw. productId besitzen:

wirtschaftliche Konzentration:

Allianz 100.000 €

Damit werden:

- größte Position
- Top 3
- Top 5

fachlich korrekt berechnet.

Die zugrunde liegenden physischen Holdings bleiben trotzdem getrennt.

## 31. Zins & Laufzeiten

Zins & Laufzeiten wird über alle Depots aggregiert.

Gesamtkennzahlen:

- direkte Rentenwerte
- Fälligkeitsleiter
- YTM Coverage
- Duration Coverage
- Modified Duration
- DV01
- Zinsszenarien

berücksichtigen alle relevanten Positionen aller Depots.

Wenn dieselbe Anleihe in mehreren Depots liegt, dürfen die Einzelpositionen in einer Tabelle separat erscheinen.

Depotname als zusätzliche Spalte bzw. Zusatzinformation ergänzen, wo sinnvoll.

Keine künstliche Verschmelzung der Einstandsdaten.

## 32. Unterschiedliche Bewertungsstichtage

Bei Multi Depot können verschiedene CSV Snapshots unterschiedliche Bewertungsstichtage besitzen.

Beispiel:

Altbestand:
01.09.2026

Volksbank pur:
12.09.2026

Die Anwendung darf dann nicht so wirken, als stammten alle Werte exakt vom selben Stichtag.

Pro Depot nach Möglichkeit den vorhandenen Datenstand anzeigen.

Beispiel:

`Altbestand · Stand 01.09.2026`

`Volksbank pur · Stand 12.09.2026`

Wenn mehrere unterschiedliche gültige Bewertungsstichtage im Gesamtdepot vorhanden sind:

sichtbarer neutraler Hinweis:

„Die zusammengefasste Analyse enthält Positionen mit unterschiedlichen Bewertungsstichtagen.“

## 33. Bond Berechnung bei gemischten Stichtagen

Die bestehende 3B Finanzmathematik nicht neu konzipieren.

Für einzelne direkte Festzinsanleihen soll bei vorhandenem gültigem `valuationEnd` bevorzugt der jeweilige positionsbezogene Bewertungsstichtag für Restlaufzeit und modellierte Kennzahlen verwendet werden.

Nur wenn eine Position keinen gültigen eigenen Bewertungsstichtag besitzt, einen sinnvollen bestehenden Fallback verwenden.

Keine pauschale Überschreibung aller Anleihen mit dem Stichtag eines anderen Depots.

Die bestehende fachliche Methodik für:

- YTM
- Macaulay Duration
- Modified Duration
- DV01
- Szenarien

ansonsten unverändert lassen.

## 34. Einstand & Ergebnis

Oben weiterhin aggregierte Gesamtwerte:

- Gesamtmarktwert mit Ergebnisdaten
- Datenabdeckung
- Summe importierter unrealisierter Kursgewinne/-verluste
- Anzahl Plus / Minus

Die einzelnen Positionen bleiben jedoch depotbezogen getrennt.

Wenn dieselbe Aktie in zwei Depots verschiedene Einstandskurse besitzt, diese NICHT zu einem künstlichen Einstand zusammenrechnen.

Best/Worst Positionen weiterhin auf der konkreten importierten Position basieren, sofern bestehende Logik so arbeitet.

Depotname in der Positionsdarstellung ergänzen, wo sinnvoll.

## 35. Source Depot Share

Das bestehende CSV Feld bzw. Holdingfeld:

`sourceDepotShare`

bleibt reine Quellinformation aus dem jeweiligen einzelnen CSV Depot.

Nicht als Anteil am Gesamtdepot interpretieren.

Nicht zur Aggregation über mehrere Depots verwenden.

Die Gesamtanteile werden immer aus den tatsächlichen Marktwerten neu berechnet.

## 36. Depotverwaltung in der UI

In Ausgangslage bzw. passender Bestandsverwaltung muss für jedes Depot kompakt sichtbar sein:

- Depotname
- Marktwert
- Anzahl Positionen
- optional Datenstand

Aktionen:

- Umbenennen
- CSV ersetzen
- Depot löschen

Zusätzlich:

**Weiteres Depot hinzufügen**

Keine unnötige separate Depotverwaltungsseite bauen, wenn die vorhandene Ausgangslage sauber erweitert werden kann.

## 37. Kein Depotfilter für V0.18 erforderlich

Für V0.18.0 keine zusätzliche komplexe Umschaltung aller Analysen zwischen:

- Gesamtdepot
- Depot 1
- Depot 2

bauen.

Die fachliche Vorgabe ist:

- Bestand & Transaktionen nach Depot getrennt anzeigen
- wirtschaftliche Analysen aggregieren

Damit bleibt die Oberfläche übersichtlich.

Ein späterer Einzeldepotfilter kann bei Bedarf ergänzt werden, gehört aber nicht in dieses Paket.

## 38. Export

Keine komplette Export-Neugestaltung.

Multi Depot jedoch sauber kompatibel machen.

Mindestens:

### Depotübersicht

- Depotname
- Marktwert
- Anzahl Positionen
- gegebenenfalls Datenstand

### Positionslisten

Wo Bestandspositionen exportiert werden, Depotname ergänzen.

### Gesamtanalyse

Vermögenshaus, Diversifikation und Gesamtkennzahlen bleiben aggregiert.

Excel Export entsprechend ergänzen.

Keine Branding Änderungen.

## 39. Depot Lifecycle Helper

Bevorzugt zentrale reine Helper für:

- Depotnamen erzeugen
- Holdings eines Depots bestimmen
- Depotmarktwert berechnen
- neues Depot hinzufügen
- Depot ersetzen
- Depot löschen
- Replacement Matching
- wirtschaftlichen Security Key
- Konzentrationsaggregation
- gemischte Bewertungsstichtage

Keine Multi Depot Logik ausschließlich in großen React Callbacks verteilen.

## 40. Bestehende 4A.1 Reconciliation erhalten

Die bereits stabilisierte 4A.1 Logik darf nicht regressieren.

Insbesondere:

- retain Modus
- afterSales
- bewusste Holdingauswahl
- Planselektion
- Geistertopf Fix
- CapitalPot Reconciliation

Multi Depot erweitert nur die Depotidentität.

Kein neuer paralleler Reconciliation Mechanismus, wenn bestehende Helper sinnvoll erweitert werden können.

## 41. Keine Änderung an Risiko V2

Risiko V2 aus V0.17.0 bleibt vollständig unverändert.

Schema Migration 9 → 10 darf:

- risk
- riskSelectionSource
- riskAssessmentV2

nicht fachlich verändern.

Risk V2 Tests weiterhin grün.

## 42. Keine Änderung an 4B

Nicht in dieses Paket ziehen:

- Auszahlplan
- Dynamik
- Sparplanumbau
- Sparzielrechner
- neue PhasedEntry Logik

4B bleibt unverändert.

## 43. Zukünftige Dynamik nur dokumentieren

Als Roadmap Notiz in der Master-Spezifikation festhalten, aber NICHT implementieren:

Für Sparplan und zukünftigen Auszahlplan soll später optional eine Dynamik möglich sein.

Verbindliche spätere Vorgabe:

- standardmäßig AUS
- nur prozentual
- nur jährlich
- erste Erhöhung nach zwölf Monaten
- danach jährlich
- keine Euro Dynamik
- kein auswählbarer Dynamikrhythmus

Diese Funktion gehört NICHT zu V0.18.0.

## 44. Zukünftiger Auszahlplan nur dokumentieren

Ebenfalls nur Roadmap Notiz.

Später vorgesehen:

- Auszahlplan ergänzend zum Sparplan
- Quelle kann bestehender oder neu geplanter Bestand sein
- regelmäßige Auszahlung
- optional jährliche prozentuale Dynamik
- verändert nicht sofort das heutige PLAN Volumen

NICHT in V0.18 implementieren.

## 45. Zukünftiger freier Planvergleich nur dokumentieren

Ebenfalls nur Roadmap Notiz.

Später vorgesehen:

Standard:

IST ↔ aktiver Plan

Nutzer soll alternativ frei auswählen können:

- IST
- Plan A
- Plan B
- Plan C
- usw.

Beispielsweise:

Plan A ↔ Plan C

Kein Wechsel des aktiven Plans notwendig.

NICHT in V0.18 implementieren.

## 46. Zukünftige Vertiefungen nur dokumentieren

Roadmap Notiz festhalten.

Die nächsten fachlichen Vertiefungen sollen insbesondere umfassen:

- aktuelle Marktsituation
- Inflation & Kaufkraft
- aktuelles Zins- und Anleihenumfeld
- Zinsstrukturkurve
- heutiges Renditeniveau und Bindungsdauer
- historische Zinsniveaus
- Credit Spreads
- Planbarkeit von Cashflows
- Vermögensstruktur
- Vermögenshaus je Risikoorientierung
- Diversifikation / Korrelationen

NICHT in V0.18 implementieren.

## 47. Testscript

Neues fokussiertes Testscript bevorzugt:

`scripts/verify-multi-depot.ts`

npm Script:

`test:multi-depot`

Das Testscript soll reale Fachregressionen abdecken.

Keine echten Kunden CSV Dateien committen.

Nur synthetische Testdaten.

## 48. Test A: Schema Migration

Schema 9 Fall mit drei Holdings und bestehenden IDs.

Nach Normalisierung:

- Schema 10
- ein DepotAccount `Depot 1`
- alle drei Holdings besitzen dieselbe gültige depotId
- ursprüngliche Holding IDs unverändert
- geplante Verkäufe unverändert
- bestehende depotHoldingIds unverändert

## 49. Test B: Leerer Alt-Fall

Schema 9 Fall ohne Holdings.

Nach Migration:

- Schema 10
- `depotAccounts = []`
- kein künstliches Depot 1

## 50. Test C: Zweites Depot

Depot 1:

Allianz WKN 840400
50.000 €

Depot 2:

Allianz WKN 840400
30.000 €

Erwartung:

- zwei DepotAccounts
- zwei getrennte Holdings
- Gesamtdepot 80.000 €
- keine Dublettenwarnung
- keine automatische Verschmelzung der Holdings

## 51. Test D: Konzentration

Gesamtdepot:

Allianz Depot 1 = 50.000 €
Allianz Depot 2 = 30.000 €
andere Positionen = 720.000 €

Gesamt = 800.000 €

Erwartung Konzentration:

Allianz = 80.000 €
Anteil = 10,0 %

Top 3 / Top 5 müssen den aggregierten Allianz Wert verwenden.

## 52. Test E: Gleiche productId ohne WKN

Zwei Positionen ohne WKN aber mit derselben belastbaren productId.

Erwartung:

für Konzentration wirtschaftlich zusammenführen.

## 53. Test F: Keine Identität

Zwei Positionen:

- keine WKN
- keine productId
- ähnlicher oder identischer Name

Erwartung:

NICHT automatisch zusammenführen.

Keine Namensheuristik.

## 54. Test G: Depot Replacement

Ausgang:

Depot 1:
- Allianz 50.000 €
- BASF 20.000 €

Depot 2:
- Allianz 30.000 €
- SAP 40.000 €

Depot 1 wird ersetzt durch:

- Allianz 52.000 €
- Siemens 25.000 €

Erwartung:

Depot 2 unverändert.

Depot 1 danach nur:

- Allianz 52.000 €
- Siemens 25.000 €

BASF verschwunden.

## 55. Test H: Depotgrenzen beim Matching

Depot 1 alt Allianz Holding A
Depot 2 Allianz Holding B
Depot 1 neu Allianz Holding C

Erwartung:

A darf nur C zugeordnet werden.

Niemals B.

## 56. Test I: Retain Auswahl beim Replacement

Plan enthält bewusst Allianz Holding A aus Depot 1.

Depot 1 wird ersetzt.

Allianz wird eindeutig als Holding C wiedererkannt.

Erwartung:

`depotHoldingIds` enthält danach C.

Nicht A.

Nicht Allianz Holding B aus Depot 2.

## 57. Test J: Planned Sale beim Replacement

Alt:

Allianz 50.000 €
plannedSale = 20.000 €

Neu:

Allianz 52.000 €

Erwartung:

plannedSale = 20.000 €

## 58. Test K: Planned Sale Clamp

Alt:

plannedSale = 20.000 €

Neu:

Marktwert 15.000 €

Erwartung:

plannedSale = 15.000 €

## 59. Test L: Verschwundene Position

Position existiert nach Replacement nicht mehr.

Erwartung:

- kein Holding Rest
- keine tote Planreferenz
- kein geplanter Verkauf

## 60. Test M: Depot löschen

Zwei Depots.

Depot 1 löschen.

Erwartung:

- DepotAccount 1 weg
- dessen Holdings weg
- Depot 2 vollständig erhalten
- tote Planreferenzen entfernt
- Gesamtdepotwert korrekt neu berechnet

## 61. Test N: Depot umbenennen

Depot 2:

`Depot 2`

umbenennen auf:

`Fremdbank`

Erwartung:

- depotId unverändert
- Holding IDs unverändert
- Planreferenzen unverändert

## 62. Test O: Diversifikation

Positionen aus zwei Depots.

Erwartung:

- Produktarten summieren beide
- Länder summieren beide
- Branchen summieren beide
- Währungen summieren beide
- Coverage basiert auf gesamtem relevanten Marktwert

Keine Position darf allein wegen Multi Depot doppelt oder gar nicht gezählt werden.

## 63. Test P: Vermögenshaus

Depot 1 und Depot 2 besitzen unterschiedliche Assetklassen.

Erwartung:

`depotAssetAmounts(...)`

aggregiert korrekt über alle Holdings.

Bestehende IST / PLAN Logik bleibt rechnerisch konsistent.

## 64. Test Q: Plan mit Verkäufen

Zwei Depots mit gleicher WKN.

Nur Depot 1 besitzt einen geplanten Verkauf.

Erwartung PLAN:

- Verkauf nur von Depot 1 abziehen
- Depot 2 unverändert
- wirtschaftliche PLAN Konzentration anschließend aggregieren

## 65. Test R: Plan mit Neukauf

Bestehender Bestand Allianz:

80.000 € über zwei Depots.

PlannerAllocation derselben WKN:

20.000 €.

Erwartung PLAN Konzentration:

100.000 €.

Geplanter Kauf erhält keine depotId.

## 66. Test S: Gemischte Bewertungsstichtage

Depot 1:
valuationEnd 01.09.2026

Depot 2:
valuationEnd 12.09.2026

Erwartung:

- gemischter Datenstand wird erkannt
- Gesamtanalyse bleibt möglich
- Hinweis kann erzeugt werden
- kein falscher Eindruck eines einheitlichen Stichtags

## 67. Test T: Bond Berechnung

Zwei Festzinsanleihen aus unterschiedlichen Depots mit unterschiedlichen gültigen valuationEnd Werten.

Erwartung:

- jede Position verwendet ihren eigenen gültigen Stichtag für Restlaufzeit
- YTM/Duration bleiben numerisch plausibel
- Portfolioaggregation funktioniert
- bestehende 3B Grundmethodik unverändert

## 68. Test U: Bestand bleibt getrennt

Dieselbe WKN in zwei Depots mit unterschiedlichen:

- Marktwerten
- Einstandskursen
- gainLossPercent

Erwartung:

Bestand & Transaktionen sowie Einstand & Ergebnis behalten zwei physische Positionen.

Keine künstliche Einstandsaggregation.

## 69. Test V: Export

Fall mit zwei Depots.

Erwartung mindestens:

- beide Depotnamen vorhanden
- korrekte Depotmarktwerte
- korrekte Gesamtdepot Summe
- Holdings besitzen im Export nachvollziehbare Depotzuordnung

## 70. Bestehende Tests

Nach Multi Depot müssen weiterhin grün sein:

- `npm run test:3b`
- `npm run test:4b`
- `npm run test:risk-v2`
- `npm run typecheck`
- `npm run build`
- `git diff --check`

Zusätzlich:

- `npm run test:multi-depot`

## 71. Checkpoint 1

Zuerst den fachlichen Kern umsetzen:

- Schema 10
- DepotAccount
- depotId
- Parser Input Typ
- Migration
- neues Depot
- Depot Replacement
- Replacement Reconciliation
- plannedSale Erhalt / Clamp
- Depot löschen
- wirtschaftliche Security Identity
- Konzentrationsaggregation
- gemischte Bewertungsstichtage
- Kernregressionen

Dann:

- `npm run test:multi-depot`
- `npm run test:3b`
- Typecheck
- `git diff --check`

Commit und Branch pushen.

## 72. Checkpoint 2

Danach UI und Integration:

- Depotübersicht
- neues Depot hinzufügen
- bestehendes Depot ersetzen
- umbenennen
- löschen
- Bestand & Transaktionen gruppiert
- Strukturplanung Holdings gruppiert
- Vermögenshaus aggregiert
- Diversifikation aggregiert
- Konzentration wirtschaftlich aggregiert
- Zins & Laufzeiten Multi Depot kompatibel
- Einstand & Ergebnis depotbezogen
- unterschiedliche Datenstände sichtbar
- Export

Dann erneut fokussiert testen.

Commit und Branch pushen.

## 73. Finaler Block

Danach:

- komplette Multi Depot Regression
- 3B Regression
- 4B Regression
- Risiko V2 Regression
- Typecheck
- Produktionsbuild
- git diff --check
- Version
- Master-Spezifikation
- finaler Commit
- Push
- nur bei vollständig grünem Stand nach main mergen
- Pages einmal aktualisieren

Keine mehrfachen Pages Deployments.

## 74. Version und Dokumentation

Wenn vollständig grün:

Version:

**0.18.0**

Schema:

**10**

Aktualisieren:

- package.json
- package-lock.json
- sichtbare Prototyp-Versionsanzeige
- `docs/VermoegensNavigator_Master-Spezifikation.md`

Master-Spezifikation ergänzen:

- Multi Depot ✅ umgesetzt
- mehrere eigenständige DepotAccounts
- CSV nur neues Depot oder bestehendes Depot ersetzen
- wirtschaftliche Aggregation über Gesamtdepot
- Bestand & Transaktionen depotbezogen
- Konzentration aggregiert identische WKN/productId
- gemischte Bewertungsstände transparent
- Schema 10
- Version V0.18.0

Roadmap zusätzlich dokumentieren, aber NICHT implementieren:

1. frei wählbarer Planvergleich
2. Auszahlplan
3. jährliche prozentuale Dynamik für Sparplan und Auszahlplan
4. fachliche Vertiefungen:
   - aktuelle Marktsituation
   - Inflation & Kaufkraft
   - aktuelles Zins-/Anleihenumfeld
   - Zinsstrukturkurve
   - Zinsniveau und Bindungsdauer
   - historische Zinsentwicklung
   - Spreads
   - Planbarkeit
   - Vermögensstruktur
   - Diversifikation / Korrelation

## 75. Scope Grenze

NICHT umsetzen:

- Auszahlplan
- Sparplan Dynamik
- Planvergleich
- neue Vertiefungen
- aktuelle Marktdaten
- Inflationsrechner
- Zinsstrukturkurven
- Steuerlogik
- neue Produktdaten
- Risiko V2 Änderungen
- neue Kapitaltopflogik
- Zieldepot für Neukäufe
- Orderrouting
- externe APIs
- Supabase
- Backend
- Benutzerrechte
- Branding Fixes
- Export Endkonsolidierung
- Mobile Optimierung

## 76. Ressourcenregel

Dieses Paket ist strukturell relevant, aber fachlich klar spezifiziert.

Deshalb:

- kein Repository Reaudit
- Dokumente einmal gezielt lesen
- nur betroffene Codebereiche untersuchen
- vorhandene Helper erweitern
- flache Holdingstruktur beibehalten
- keine unnötige Architektur neu erfinden
- keine neue Datenbank
- keine neuen Abhängigkeiten
- keine Chartbibliothek
- keine wiederholten Pages Runden
- keine kosmetischen Nebenrefactors
- keine Webrecherche durchführen
- fachliche und technische Grundlage liegt vollständig im Repository und in diesem Auftrag
- externe Websuche nur, wenn eine konkrete technische Blockade anders nicht lösbar ist

Wenn das Nutzungslimit knapp wird:

- keine neue Teilaufgabe beginnen
- stabilen Branch Stand committen und pushen
- genau dokumentieren, was fehlt
- NICHT unvollständig nach main mergen

## 77. Abschlussbericht

Wenn vollständig abgeschlossen, berichte kompakt:

- Ausgangs-main-SHA
- Branch
- Version vorher / nachher
- Schema vorher / nachher
- neues DepotAccount Modell
- Migration
- CSV Importlogik
- Replacement Logik
- Replacement Reconciliation
- plannedSale Verhalten
- Depot löschen / umbenennen
- Bestandsdarstellung
- Vermögenshaus Aggregation
- Diversifikation
- Konzentrationsaggregation
- Zins & Laufzeiten
- Umgang mit unterschiedlichen Bewertungsstichtagen
- Einstand & Ergebnis
- Strukturplanung
- Export
- Anzahl / Ergebnis Multi Depot Regressionstests
- `test:multi-depot`
- `test:3b`
- `test:4b`
- `test:risk-v2`
- Typecheck
- Build
- git diff --check
- Checkpoint 1 Commit
- Checkpoint 2 Commit
- finaler Feature Commit
- Merge / main Commit
- Pages Build Commit
- Pages Deployment Status
- verbleibende Punkte, falls vorhanden

Wenn etwas nicht vollständig fertig wird:

- stabilen Branch sichern
- nicht nach main mergen
- verbleibende Punkte exakt nennen

Führe V0.18.0 Multi Depot jetzt vollständig aus.
