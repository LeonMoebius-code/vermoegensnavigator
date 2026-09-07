# Work-Paket 4B – Abgleich mit V0.14.1

> Ergänzung zum bestehenden `Workpaket_4B_Technisches_Preflight.md` nach erfolgreicher Umsetzung von 4A.1.
>
> Stand: 07.09.2026  
> Tatsächliche Ausgangsbasis: veröffentlichte V0.14.1 auf GitHub `main`  
> Zielversion 4B: V0.15.0  
> Empfohlener Arbeitsbranch: `work/4b-einstieg-sparplaene`

---

## 1. Zweck

Das ursprüngliche 4B-Preflight wurde vor Abschluss von 4A.1 erstellt. Dieses Dokument hält ausschließlich die nach 4A.1 tatsächlich vorliegende technische Ausgangslage und die daraus folgenden Präzisierungen für 4B fest.

Bei 4B gilt künftig:

1. fachliches Soll aus der Master-Spezifikation
2. technisches Grundkonzept aus `Workpaket_4B_Technisches_Preflight.md`
3. tatsächliche V0.14.1-Baseline und Präzisierungen aus diesem Dokument

Keine neue Fachkonzeption ist für 4B erforderlich.

---

# 2. Tatsächlicher V0.14.1-Stand nach 4A.1

## 2.1 Schema

`AdvisoryCase.schemaVersion` ist jetzt verbindlich **7**.

4A.1 hat die Schema-6-Migration bereits produktiv eingeführt. 4B darf diese bestehende Migration nicht ersetzen oder duplizieren.

Aufgrund der neuen diskriminierten InvestmentPlan-Struktur und der neuen fallweiten `SavingsGoal[]` ist für 4B nun der klare Zielschritt:

> **Schema 7 → Schema 8**

Der bestehende Normalizer muss Schema 6 weiterhin korrekt über die vorhandene 4A.1-Logik verarbeiten und anschließend auf Schema 8 normalisieren können.

## 2.2 Kapitaltopf-Reconciliation ist vorhanden

4A.1 hat die zentralen Helper tatsächlich eingeführt:

- `reconcilePlanCapitalPots(...)`
- `reconcileCasePlans(...)`
- `capitalPotRemovalImpact(...)`

Diese Logik ist in 4B wiederzuverwenden und gezielt zu erweitern. Keine zweite parallele Topf-/Lifecycle-Engine bauen.

Aktuell bereinigt `reconcilePlanCapitalPots(...)`:

- ungültige `capitalPotId`
- ungültige `capitalPotAmounts`
- Mehrtopf-Allokationen anteilig
- `allocation.amount` konsistent unter Erhalt echten unzugeordneten Overflows
- Legacy-`bucketAmounts`
- alte InvestmentPlans, sofern deren `capitalPotId` nicht mehr existiert

Für 4B ist diese InvestmentPlan-Bereinigung auf die neue Semantik zu erweitern.

## 2.3 Depotlogik aus 4A.1 nicht erneut anfassen

V0.14.1 enthält bereits:

- `depotSelectionInitialized`
- klare Semantik der vier Depotmodi
- CSV-WKN-Reconciliation
- unabhängige Depotcheck-PLAN-Logik

4B darf diese Logik nicht refactoren, außer ein unmittelbar durch 4B verursachter Typ-/Compile-Anpassungspunkt macht eine minimale Änderung notwendig.

## 2.4 Branding bewusst außerhalb 4B

Nach V0.14.1 besteht noch ein späterer Branding-/Export-Feinschliff:

- Exportbranding kann weiterhin sichtbar abgeschnitten wirken
- Private-Banking-Wortmarke ist im Fachmodul und nach Nutzerfeedback auch im Hauptheader eher zu klein
- finale Größenrelation soll später kontextbezogen für Hauptheader, Fachmodul und Export abgestimmt werden

**Nicht in 4B lösen.** 4B darf das Branding nicht erneut verändern.

---

# 3. Datenmodell 4B – jetzt verbindlich auf Schema 8

## 3.1 InvestmentPlan als diskriminierte Union

Das bisherige gemeinsame V0.14.1-Modell bleibt technisch unverändert generisch und ist weiterhin die Hauptursache der fachlichen Probleme.

Ziel in Schema 8:

```ts
type InvestmentPlan = PhasedEntryPlan | SavingsPlan;

type PhasedEntryPlan = {
  id: string;
  type: "phased";
  allocationId: string;
  capitalPotId: CapitalPotId;
  stagedMode: "percent" | "amount";
  stagedValue: number;
  installments: number;
  frequency: InvestmentFrequency;
  startDate: string;
  note: string;
};

type SavingsPlan = {
  id: string;
  type: "savings";
  name?: string;
  productId: string;
  productName: string;
  contributionAmount: number;
  frequency: InvestmentFrequency;
  startDate: string;
  targetRef?: SavingsTargetRef;
  note: string;
};
```

Exakte TypeScript-Namen dürfen bei gleicher Semantik abweichen.

### Nicht redundant im PhasedEntryPlan speichern

Nicht speichern, wenn sauber ableitbar:

- Produktname
- Produkt-ID
- Zielbetrag
- Sofortbetrag
- Ratenbetrag
- Gesamtbetrag

Diese Werte werden live über `allocationId + capitalPotId` aus der Strukturplanung abgeleitet.

## 3.2 SavingsGoal fallweit

In `AdvisoryCase` ergänzen:

```ts
savingsGoals: SavingsGoal[];
```

`createCase(...)` initialisiert `[]`.

`normalizeImportedCase(...)` initialisiert bei alten Fällen `[]`.

Ein SavingsGoal ist ein Kundenziel und keine Eigenschaft einer einzelnen Planvariante.

Es darf niemals einfließen in:

- `capitalPots(...)`
- `planningShortfall(...)`
- strategischen Restbetrag
- Topfabdeckung
- heutiges Planungsvolumen

---

# 4. Migration Schema 7 → 8

Die Migration muss bewusst konservativ sein. Keine falschen Beziehungen erfinden.

## 4.1 Alte Sparpläne

Ein altes `type: "savings"` kann eindeutig migriert werden:

- `id` beibehalten
- `name` beibehalten
- `productId` beibehalten
- `productName` beibehalten
- `installmentAmount` → `contributionAmount`
- `frequency` beibehalten
- `startDate` beibehalten
- `note` beibehalten
- `installments` entfernen
- `bucketId` entfernen
- `capitalPotId` entfernen
- `targetRef` zunächst leer

Ein alter Sparplan darf nach Migration keine fiktive Gesamtsumme mehr besitzen.

## 4.2 Alte gestaffelte Anlagen

Alte `type: "phased"` besitzen noch keine `allocationId`.

Migration nur bei eindeutig ableitbarer Relation:

1. gültige `capitalPotId` des alten Eintrags bestimmen
2. Kandidaten in `plan.allocations` mit gleichem `productId` suchen
3. Kandidat muss im betreffenden Kapitaltopf einen positiven Betrag haben
4. genau **ein** gültiger Kandidat → Migration zulässig
5. mehrere oder kein Kandidat → alten Phased-Eintrag nicht auf eine erfundene Allocation hängen

Bei eindeutiger Migration:

- `allocationId` = eindeutige Allocation
- `capitalPotId` = bestehender gültiger Topf
- `stagedMode` = `amount`
- `stagedValue` = alter `installmentAmount × installments`
- `installments` beibehalten, mindestens 1
- `frequency`, `startDate`, `note` beibehalten

Wenn der alte Staffelbetrag über dem aktuellen Zielbetrag liegt:

- Wert nicht still kappen
- neue bestehende Inkonsistenzwarnung des EUR-Modus verwenden

Wenn alter Gesamtbetrag 0 oder fachlich leer ist, keinen sinnlosen PhasedEntryPlan erzeugen. Dann gilt der implizite Standard `Komplett sofort`.

## 4.3 Schema-6-Fälle

Ein direkt importierter alter Schema-6-Fall muss weiterhin zuerst durch die bereits produktive 4A.1-Normalisierung für Topf- und Depotsemantik laufen. Danach erfolgt die neue 4B-Normalisierung auf Schema 8.

Keine Regression der Schema-6-Testfälle zulassen.

---

# 5. Lifecycle-Erweiterung auf dem vorhandenen 4A.1-Reconcile

## 5.1 PhasedEntryPlan

Nach jeder relevanten Planänderung darf ein PhasedEntryPlan nur bestehen, wenn:

- `allocationId` in derselben Planvariante existiert
- `capitalPotId` aktuell existiert
- `allocationAmountInCapitalPot(allocation, capitalPotId) > 0`

Ist eine dieser Bedingungen falsch:

> PhasedEntryPlan entfernen.

Das gehört in bzw. unmittelbar an die bestehende zentrale Reconcile-Route, nicht nur in einzelne UI-Handler.

## 5.2 SavingsPlan

SavingsPlans sind unabhängig von Kapitaltöpfen.

Daher:

- Bedarf löschen → Sparplan bleibt
- Produktallokation löschen → Sparplan bleibt
- Modellportfolio ersetzen → Sparplan bleibt
- Depotmodus ändern → Sparplan bleibt

Nur `targetRef` wird bei Bedarf bereinigt.

## 5.3 TargetRef-Lifecycle

Für

```ts
{ kind: "need"; id: ... }
```

gilt:

- echter Kapitalbedarf gelöscht → nur `targetRef` entfernen
- Sparplan selbst bleibt bestehen

Für

```ts
{ kind: "savingsGoal"; id: ... }
```

gilt:

- Sparziel gelöscht → nur `targetRef` entfernen
- Sparplan selbst bleibt bestehen

Ein Zielbezug ist rein informativ und deckt keinen Kapitaltopf.

---

# 6. Produktallokation × Kapitaltopf bleibt die zentrale Relation

V0.14.1 bestätigt, dass `PlannerAllocation.id` stabil genug ist und dass `allocationAmountInCapitalPot(...)` bereits produktiv vorhanden ist.

Der eindeutige Einstiegsbezug lautet weiterhin:

> **`allocationId + capitalPotId`**

Beispiel:

ZinsFix Index, eine Allocation:

- 50.000 € in 2034
- 100.000 € strategisch

Dann existieren zwei voneinander unabhängige Einstiegsentscheidungen:

- ZinsFix Index × 2034 → 50.000 €
- ZinsFix Index × strategisch → 100.000 €

Niemals einfach `allocation.amount = 150.000 €` als Zielbetrag der einzelnen Umsetzung verwenden.

Unzugeordneter Overflow besitzt keinen gültigen Topfbezug und bekommt keinen Einstiegsplan.

---

# 7. Plan duplizieren – nach 4A.1 unverändert wichtig

Der aktuelle V0.14.1-Code regeneriert beim Duplizieren weiterhin die IDs der PlannerAllocations.

4B muss deshalb beim Duplizieren eine Map aufbauen:

> alte Allocation-ID → neue Allocation-ID

Danach:

### PhasedEntryPlans

- eigene neue Plan-ID erzeugen
- `allocationId` über die Map auf die duplizierte Allocation umhängen
- `capitalPotId` beibehalten, sofern weiterhin gültig

### SavingsPlans

- eigene neue Plan-ID erzeugen
- Produkt und operative Werte kopieren
- `targetRef` beibehalten

### SavingsGoals

Nicht duplizieren.

Sie liegen fallweit und bleiben dieselben Zielobjekte.

---

# 8. Modellportfolio / Allokations-Lifecycle

Wenn eine Aktion die bestehenden Allokationen vollständig ersetzt:

- PhasedEntryPlans der entfernten Allokationen entfernen
- SavingsPlans erhalten

Wenn nur einzelne Allokationen entfernt werden:

- nur zugehörige PhasedEntryPlans entfernen
- SavingsPlans erhalten

Wenn Betrag oder Topfanteil einer Allocation geändert wird:

- PhasedEntryPlan bleibt bei weiterhin positiver Pair-Relation bestehen
- Prozentmodus skaliert automatisch
- EUR-Modus bleibt nominell fix und zeigt ggf. Inkonsistenz

---

# 9. UI-Anbindung im tatsächlichen V0.14.1-Planer

## 9.1 Einstiegsstatus direkt an Produktposition

Die Produktpositionen innerhalb der Kapitaltöpfe sind weiterhin der richtige primäre Ort.

Jede konkrete sichtbare `Allocation × Pot`-Position erhält standardmäßig:

> **Umsetzung: Komplett sofort · Ändern**

Kein zusätzlicher Datensatz und kein Pflichtklick.

Nach Klick auf `Ändern` inline oder unmittelbar kontextnah öffnen:

- Komplett sofort
- Teilweise gestaffelt
- Komplett gestaffelt

Bei Staffelung:

- Zielbetrag read-only aus Allocation × Pot
- Staffelmodus `%` / `€`
- Staffelwert
- daraus Sofortbetrag
- Anzahl Raten
- daraus Ratenbetrag
- Rhythmus
- erste Rate
- Hinweis

Rückkehr zu `Komplett sofort` löscht den PhasedEntryPlan dieser Pair-Relation.

## 9.2 Alter globaler Button

Den bisherigen globalen Button `+ Gestaffelte Anlage` entfernen.

Gestaffelte Einstiege werden nicht mehr über einen zweiten freien Produkt-/Topf-Picker angelegt.

## 9.3 Umsetzungsübersicht

Der bestehende Bereich `Spar- und Investitionspläne` bleibt, wird aber zur Zusammenfassung.

### Einstiege

Alle konkreten Allocation×Pot-Positionen übersichtlich anzeigen, z. B.:

- UniMarktführer · Strategisch · 150.000 € → Komplett sofort
- ZinsFix Index · Strategisch · 100.000 € → 40.000 € sofort + 6 × 10.000 €
- ZinsFix Index · 2034 · 50.000 € → Komplett sofort

### Sparpläne

Separat darunter laufende Sparpläne anzeigen.

Der Button `+ Sparplan` bleibt hier als primärer Erfassungsweg.

---

# 10. Sparplan-UX

## 10.1 Produktpicker

Der aktuelle Planer besitzt bereits einen internen `catalogItems`-Katalog. Diesen wiederverwenden.

Picker-Reihenfolge:

1. **Im aktuellen Plan**
2. **Weitere Lösungsbausteine** aus dem vollständigen internen Produktkatalog

Aktuelle Planprodukte deduplizieren und nicht im zweiten Block erneut anzeigen.

Keine freie externe WKN / Freitextposition in 4B.

## 10.2 Operative Felder

Speichern:

- Produkt
- Sparrate
- Rhythmus
- Startdatum
- optional Bezeichnung
- optional Zielbezug
- optional Hinweis

Nicht speichern / nicht verlangen:

- Kapitaltopf
- Anzahl Raten
- Enddatum
- Renditeannahme
- Inflation
- verbindlichen Gesamtbetrag

Sparplan bleibt fortlaufend.

## 10.3 Zielbezug

Auswahl:

- Kein Zielbezug
- bestehendes Sparziel
- neues Sparziel anlegen
- optional bestehenden echten Kapitalbedarf informativ referenzieren

Neues Sparziel erzeugt ausdrücklich **keinen Kapitalbedarf** und **keinen Kapitaltopf**.

---

# 11. Startdatum und Ratenberechnung

Gemeinsamer Helper für neue Pläne:

- aktueller Kalendertag 1–14 → nächster 15.
- aktueller Kalendertag ab 15 → 1. des Folgemonats

Lokales Datum als `YYYY-MM-DD` erzeugen. Keine UTC-Verschiebung über unkritisches `toISOString()` riskieren.

Beim PhasedEntryPlan ist dies das Datum der **ersten gestaffelten Rate**. Der Sofortanteil ist davon getrennt.

Frequenzen:

- monatlich
- vierteljährlich
- halbjährlich
- jährlich

Raten in Cent berechnen. Letzte Rate absorbiert Rundungsrest.

---

# 12. Exporte – nur notwendige 4B-Kompatibilität

Der aktuelle V0.14.1-Export verwendet noch `investmentPlanTotal(...)` und alte gemeinsame Felder.

4B muss diese Stellen typgerecht auf das neue Modell umstellen.

### Phased Entry exportieren

Mindestens:

- Plan
- Produkt
- Kapitaltopf
- Zielbetrag
- Sofortbetrag
- Staffelbetrag
- Anzahl Raten
- Rhythmus
- erste Rate / Startdatum
- Hinweis

### SavingsPlan exportieren

Mindestens:

- Plan
- Produkt
- Sparrate
- Rhythmus
- Startdatum
- optional Zielbezug
- Hinweis

Kein fiktiver `Gesamtbetrag` eines fortlaufenden Sparplans.

Keine vollständige Export-Neugestaltung in 4B.

Branding im Export ausdrücklich nicht erneut anfassen.

---

# 13. Fokussierte Regressionstests für den tatsächlichen V0.14.1-Unterbau

Zusätzlich zur bereits bestehenden 4B-Testmatrix insbesondere prüfen:

1. **Schema 7 → 8** mit altem Sparplan
   - Sparrate bleibt erhalten
   - `installments` verschwindet
   - kein Gesamtbetrag

2. **Schema 7 → 8** mit eindeutigem alten Phased-Eintrag
   - korrekte Allocation×Pot-Relation
   - alter Gesamtstaffelbetrag als EUR-Modus erhalten

3. **Schema 7 → 8** mit mehrdeutigem alten Phased-Eintrag
   - keine erfundene Allocation-Verknüpfung

4. **Schema 6 direkt importieren**
   - bestehende 4A.1-Topfmigration weiter grün
   - anschließend neue 4B-Struktur korrekt

5. **Topf verschwindet nach 4B**
   - vorhandener 4A.1-Reconcile entfernt Allocation-Anteil
   - zugehöriger PhasedEntryPlan wird ebenfalls entfernt
   - SavingsPlan bleibt

6. **Allocation gelöscht**
   - PhasedEntryPlan weg
   - SavingsPlan bleibt

7. **Allocationbetrag geändert, Prozentmodus**
   - Staffelbetrag skaliert

8. **Allocationbetrag geändert, EUR-Modus**
   - Staffelbetrag bleibt fix
   - bei Überschreitung Warnung

9. **Multi-Topf-ZinsFix**
   - 50.000 € 2034 und 100.000 € strategisch separat steuerbar

10. **Komplett sofort**
    - kein InvestmentPlan-Datensatz nötig
    - Status trotzdem sichtbar

11. **Plan duplizieren**
    - neue Allocation-IDs
    - PhasedEntryPlans korrekt umgehängt
    - SavingsPlans kopiert
    - SavingsGoals nicht dupliziert

12. **Modellportfolio ersetzt Allokationen**
    - alte PhasedEntryPlans entfernt
    - SavingsPlans bleiben

13. **Sparplan auf Produkt außerhalb des Plans**
    - vollständiger interner Katalog verfügbar
    - einmaliges Planungsvolumen unverändert

14. **Sparziel anlegen**
    - in `savingsGoals`
    - kein neuer Kapitaltopf
    - strategisches Kapital unverändert
    - Topfabdeckung unverändert

15. **Sparplan referenziert echten Need**
    - rein informativ
    - Löschen des Need entfernt Referenz, nicht Sparplan

16. **Export**
    - kein fiktiver Sparplan-Gesamtbetrag
    - PhasedEntry-Beträge konsistent

17. **4A.1-Regression**
    - Depotmodi
    - Geistertopf
    - Multi-Topf-Bereinigung
    - Depotcheck-Unabhängigkeit
    bleiben grün

18. **Branding-Regression**
    - durch 4B keine neuen Änderungen an Header/Fachmodul/Print-CSS

---

# 14. Empfohlene Work-Reihenfolge nach dem Abgleich

## Checkpoint 1 – Schema 8, Migration und Berechnungsengine

Zuerst:

- neue discriminated Types
- `SavingsGoal[]`
- Schema-8-Normalisierung
- Schema-7- und Schema-6-Kompatibilität
- PhasedEntry-Berechnungshelper
- Reconcile-Erweiterung
- Duplicate-Plan-ID-Mapping
- fokussierte Model-/Lifecycle-Tests

Dann Commit + Push.

## Checkpoint 2 – Planner UX

Danach:

- `Komplett sofort · Ändern` je Allocation×Pot
- Inline-Staffelung
- globalen `+ Gestaffelte Anlage` entfernen
- Sparplan-Picker über vollen internen Katalog
- Zielbezug / Sparziel
- Umsetzungsübersicht

Dann fokussierter UI-Smoke.

## Finaler Block – Exportkompatibilität und Regression

- bestehende Exportstellen typgerecht anpassen
- keine Export-Neugestaltung
- TypeScript
- Produktionsbuild
- `git diff --check`
- fokussierte 4B-Tests
- kurzer 4A.1-Regressionssmoke

Bei komplett grünem Stand nach `main` übernehmen und Pages einmal aktualisieren.

---

# 15. Ressourcengrenze

4B ist ein kohärentes größeres Paket und soll nicht künstlich in viele Work-Runs zerlegt werden.

Empfehlung:

- GPT-5.6 Sol
- Reasoning Mittel
- Start nur mit frischem 5h-Kontingent

Die Repository-Dokumente zu Beginn einmal gezielt lesen und danach als Arbeitsgrundlage verwenden. Nicht wiederholt vollständig neu einlesen, sofern keine konkrete Unklarheit besteht.

Keine umfassende zusätzliche Online-E2E-Runde nach grünem finalem Build und erfolgreichem Pages-Deployment. Nur die unmittelbar geänderten Kernpunkte kurz verifizieren.

Bei knappem Limit:

- stabilen Branch committen/pushen
- keine neuen Aufgaben beginnen
- nicht unvollständig nach `main` mergen
