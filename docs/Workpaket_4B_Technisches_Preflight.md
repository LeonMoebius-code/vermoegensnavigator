# Work-Paket 4B – Technisches Preflight

> Technische Umsetzungskarte zum fachlich freigegebenen Abschnitt 4B der `VermoegensNavigator_Master-Spezifikation.md`.
>
> Stand: 07.09.2026  
> Ausgangsbasis der Analyse: `main` auf V0.14 plus Dokumentations-Preflights  
> Abhängigkeit: 4B **erst nach erfolgreichem Merge von 4A.1** implementieren  
> Zielversion bei erfolgreicher Umsetzung: V0.15.0  
> Empfohlener Arbeitsbranch: `work/4b-einstieg-sparplaene`

---

# 1. Zweck und Abgrenzung

Dieses Dokument ergänzt die fachliche Master-Spezifikation um eine technische Umsetzungskarte. Es beschreibt:

- den aktuellen technischen Ist-Zustand
- die vorhandenen Datenstrukturen
- die stabilen technischen Bezugspunkte
- notwendige Schema-/Migrationsänderungen
- Lifecycle-Regeln für Produktallokationen, Einstiegspläne, Sparpläne und Sparziele
- fokussierte Regressionstests
- eine ressourcenschonende Work-Reihenfolge

Es ersetzt weder die Master-Spezifikation noch den finalen Work-Prompt.

4B bleibt bewusst abgegrenzt. Nicht hineinziehen:

- Zinseszinsrechner
- Sparzielrechner
- Cost-Average-Szenariorechner
- Depotcheck 3B
- Risiko V2
- neue Steuerlogik
- externe freie WKN / Freitextprodukte
- vollständige Ergebnis-/PDF-Endkonsolidierung
- Mobile-Optimierung

4B schafft die fachlich saubere Daten- und UX-Basis für diese späteren Vertiefungen.

---

# 2. Abhängigkeit von 4A.1

4B darf nicht auf dem heute noch fehlerhaften Kapitaltopf-Lifecycle aufbauen.

Nach 4A.1 sollen insbesondere bereits vorhanden sein:

- zentrale Bereinigung ungültiger Kapitaltopf-Referenzen
- robuste Normalisierung alter Fälle
- verwaiste Topfanteile werden nicht automatisch nach strategisch verschoben
- eine belastbare Lifecycle-/Reconcile-Logik für Planvarianten

4B soll diese Logik **erweitern und wiederverwenden**, nicht daneben eine zweite unabhängige Integritätslogik bauen.

Wenn 4A.1 einen neuen Helper wie sinngemäß `reconcilePlanCapitalPots(...)` oder `reconcileCasePlans(...)` einführt, ist dieser in 4B als Grundlage zu nutzen und um Umsetzungsbezüge zu erweitern.

---

# 3. Betroffene Codebereiche

## `app/case-model.ts`

Aktuell relevant:

- `PlannerAllocation`
- `StructurePlan`
- `InvestmentPlan`
- `AdvisoryCase`
- `allocationCapitalPotAmounts(...)`
- `allocationAmountInCapitalPot(...)`
- `allocationCapitalCoverageTotal(...)`
- `capitalPots(...)`
- `normalizeImportedCase(...)`
- Plan-/Case-Erzeugung

4B benötigt dort voraussichtlich:

- diskriminierte InvestmentPlan-Typen statt eines einzigen universellen Shapes
- stabile Relation eines Einstiegsplans zu `allocationId + capitalPotId`
- neuen Fallzustand `SavingsGoal[]`
- zentrale Berechnungshelper für Einstiegsbeträge / Raten
- zentrale Reconcile-/Migrationslogik

## `app/page.tsx`

Relevant sind insbesondere:

- `PlannerView`
- Rendering der Produktpositionen je Kapitaltopf
- `addInvestmentPlan(...)`
- `updateInvestmentPlan(...)`
- `removeInvestmentPlan(...)`
- heutiger Bereich `Spar- und Investitionspläne`
- Produktkatalog / `catalogItems`
- Plan duplizieren
- neue Planvariante
- Modellportfolio anwenden / ersetzen
- VV-Übernahme und Aktualisierung
- Produktallokation ändern / löschen
- ExportCenter, weil der aktuelle Export direkt auf den alten InvestmentPlan-Feldern basiert

## `app/investment-data.ts`

Der vorhandene interne Produktkatalog ist bereits ausreichend, um Sparpläne auf Produkte außerhalb der Einmalplanung zu ermöglichen.

Nicht einen zweiten parallelen Produktkatalog erfinden.

## `app/globals.css`

Der vorhandene InvestmentPlan-Bereich hat alte V0.10-CSS-Strukturen. Diese dürfen gezielt ersetzt / bereinigt werden, ohne den übrigen Planner zu redesignen.

---

# 4. Technisch bestätigter Ist-Zustand

## 4.1 Aktuelles `InvestmentPlan`-Modell ist zu generisch

Aktuell gibt es einen gemeinsamen Typ für `savings` und `phased` mit denselben Feldern:

- `productId`
- `productName`
- `bucketId`
- `capitalPotId`
- `installmentAmount`
- `installments`
- `frequency`
- `startDate`
- `note`

Dadurch werden zwei fachlich unterschiedliche Sachverhalte künstlich in dieselbe Struktur gepresst.

Folgen:

- Sparpläne besitzen heute eine Anzahl Raten, obwohl sie fortlaufend sein sollen
- gestaffelte Einstiege kennen keinen festen Bezug zur konkreten Produktallokation
- Zielbetrag der Staffelung ist unabhängig vom tatsächlichen Produktbetrag editierbar
- `Rate × Anzahl` kann beliebig vom Planbetrag abweichen
- ein Sparplan kann durch `installments` zu einer künstlichen Gesamtsumme hochgerechnet werden

## 4.2 `investmentPlanTotal(...)` ist für Sparpläne fachlich ungeeignet

Aktuell wird zentral berechnet:

`installmentAmount × installments`

Dies erklärt die heute mögliche absurde Hochrechnung eines Sparplans in Milliardenbeträge.

Nach 4B darf ein fortlaufender Sparplan **keine fiktive verbindliche Gesamtsumme** mehr besitzen.

## 4.3 Globale Erfassung statt konkreter Produktallokation

`addInvestmentPlan("phased")` nimmt derzeit zunächst `plan.allocations[0]` als Ausgangspunkt und lässt anschließend Produkt und Kapitaltopf separat auswählen.

Das ist genau die falsche Richtung für das neue Fachmodell.

Künftig kommt der Einstieg aus der bereits vorhandenen Produktposition.

## 4.4 Produktpicker des heutigen InvestmentPlan-Bereichs

Der aktuelle Picker wird aus den Produkten der `plan.allocations` aufgebaut und dedupliziert über `productId`.

Damit sind Sparpläne heute auf bereits im Plan vorhandene Produkte beschränkt.

4B erweitert ausschließlich den Sparplan-Picker auf den vollständigen vorhandenen internen Katalog.

## 4.5 `PlannerAllocation.id` ist innerhalb einer Planvariante ausreichend stabil

Bei Anlage einer Produktallokation wird eine eigene `allocation.id` vergeben.

Bei normalen Änderungen wie:

- Betrag ändern
- Zuordnungsmodus ändern
- Kapitaltopfanteile verändern

bleibt diese ID grundsätzlich erhalten.

Damit ist **keine neue Suballocation-ID zwingend erforderlich**.

Wichtig ist aber:

> Ein Einstiegsplan darf nicht nur `allocationId` speichern, weil eine einzelne PlannerAllocation mehrere Kapitaltöpfe über `capitalPotAmounts` abdecken kann.

Der korrekte technische Bezug lautet:

> `allocationId + capitalPotId`

Diese Kombination identifiziert den konkreten geplanten Produktanteil eines Kapitaltopfs.

## 4.6 Eine PlannerAllocation kann mehrere Kapitaltöpfe enthalten

Beispiel:

- dieselbe Allocation
- Produkt ZinsFix Index
- 50.000 € in `year-2034`
- 100.000 € in `strategic`
- Gesamtbetrag der Allocation: 150.000 €

Der Einstiegs-Zielbetrag darf an der konkreten Position **nicht `allocation.amount` = 150.000 €** verwenden.

Er muss verwenden:

`allocationAmountInCapitalPot(allocation, capitalPotId)`

Also:

- Einstieg 2034 = 50.000 €
- Einstieg strategisch = 100.000 €

Das ist eine zentrale 4B-Invariante.

## 4.7 Unzugeordnete Produktanteile

Bei Overflow / Überplanung kann `allocation.amount` größer sein als die Summe gültiger `capitalPotAmounts`.

Ein solcher nicht zugeordneter Rest besitzt keinen gültigen `Produktallokation × Kapitaltopf`-Bezug.

Dafür **keinen Einstiegsplan zulassen oder erfinden**.

Die vorhandene Warnung zur fehlenden Topfzuordnung bleibt führend. Umsetzung dieses Restbetrags erst nach fachlicher Topfzuordnung.

---

# 5. Empfohlenes Ziel-Datenmodell

Die exakten TypeScript-Namen dürfen Work sinnvoll wählen. Fachlich-technisch soll jedoch eine diskriminierte Union entstehen.

## 5.1 Einstiegsplan / Phased Entry

Sinngemäße Struktur:

```ts
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
```

Nicht redundant speichern, wenn sauber ableitbar:

- Produktname
- Produkt-ID
- Zielbetrag
- Sofortbetrag
- berechnete Ratenhöhe
- Gesamtbetrag

Diese Werte sollen aus `allocationId + capitalPotId` und den aktuellen Planallokationen abgeleitet werden.

Warum:

- keine veralteten Produktnamen / Beträge
- Zielbetrag reagiert automatisch auf Planänderungen
- keine Doppelzählung
- Prozent- und EUR-Modus bleiben konsistent

## 5.2 Impliziter Direkteinstieg

Für `Komplett sofort` wird **kein redundanter PhasedEntryPlan** benötigt.

Regel:

- kein PhasedEntryPlan für `allocationId + capitalPotId` → `Komplett sofort`
- expliziter PhasedEntryPlan → teilweise oder komplett gestaffelt
- Wechsel zurück zu `Komplett sofort` → vorhandenen PhasedEntryPlan dieser Pair-Relation löschen

Damit bleibt der Standardzustand einfach und robust.

## 5.3 Sparplan

Sinngemäße Struktur:

```ts
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

Kein Feld:

- `capitalPotId`
- `bucketId`
- verpflichtende `installments`
- verbindlicher Gesamtbetrag
- Rendite
- Inflation
- Laufzeit

## 5.4 Zielreferenz des Sparplans

Bevorzugt als diskriminierte Referenz statt mehrerer unabhängiger optionaler IDs.

Sinngemäß:

```ts
type SavingsTargetRef =
  | { kind: "savingsGoal"; id: string }
  | { kind: "need"; id: number };
```

`need` ist nur eine informative Referenz zu einem bereits vorhandenen echten Kapitalbedarf.

Sie beeinflusst weder Topfabdeckung noch die Sparplanrechnung.

## 5.5 Sparziel auf Case-Ebene

Empfehlung:

```ts
type SavingsGoal = {
  id: string;
  name: string;
  targetAmount: number;
  targetYear?: number;
  targetDate?: string;
  note?: string;
};
```

und im `AdvisoryCase`:

```ts
savingsGoals: SavingsGoal[];
```

### Warum Case-Ebene statt StructurePlan-Ebene?

Ein Sparziel ist ein Kundenziel und keine Eigenschaft einer einzelnen Strukturvariante.

Beispiel:

> Studium Kind · 100.000 € · 2038

Dieses Ziel bleibt fachlich dasselbe, auch wenn Plan A und Plan B unterschiedliche Sparplan-Umsetzungen enthalten.

Planvarianten können dadurch unterschiedliche SavingsPlans auf dasselbe SavingsGoal referenzieren.

Das entspricht der bestehenden Trennung:

- Ziel = fallweit
- konkrete Umsetzung = planvariantenspezifisch

### Kein Kapitaltopf

`SavingsGoal` darf niemals in `capitalPots(...)`, `data.needs`, `planningShortfall(...)`, strategischer Restberechnung oder Topfabdeckung einfließen.

---

# 6. Berechnungsmodell gestaffelter Einstieg

## 6.1 Zielbetrag

Immer live aus:

`allocationAmountInCapitalPot(allocation, capitalPotId)`

Nicht als separaten editierbaren Wert speichern.

## 6.2 Prozentmodus

Gespeichert wird beispielsweise:

- `stagedMode = "percent"`
- `stagedValue = 60`

Aktueller gestaffelter Betrag:

`targetAmount × 60 %`

Bei Änderung des Zielbetrags skaliert der Staffelbetrag automatisch.

## 6.3 EUR-Modus

Gespeichert wird beispielsweise:

- `stagedMode = "amount"`
- `stagedValue = 60000`

Bei Änderung des Zielbetrags bleibt dieser Betrag bestehen.

Wenn `stagedValue > targetAmount`:

- sichtbare Inkonsistenzwarnung
- keine stille Kappung
- keine automatische Umstellung auf 100 %

## 6.4 Sofortbetrag

Ableiten:

`targetAmount - stagedAmount`

Untergrenze 0 nur für Anzeige/Berechnung, aber bei fachlich ungültigem EUR-Modus zusätzlich die Warnung zeigen.

## 6.5 Ratenbetrag

Nicht unabhängig speichern.

Ableiten aus:

`stagedAmount / installments`

## 6.6 Cent-Rundung

Beträge möglichst in Cent rechnen.

Empfohlen:

1. gestaffelten Betrag in Cent runden
2. Grundrate ganzzahlig in Cent teilen
3. letzte Rate nimmt verbleibenden Rundungsrest auf

Damit gilt immer:

`Summe aller Raten = gestaffelter Betrag`

Für glatte Fälle wie 60.000 € / 6 wird einfach 6 × 10.000 € gezeigt.

Bei Rundungsrest entweder:

- einzelne letzte Rate explizit anzeigen
- oder einen kurzen Hinweis `letzte Rate rundungsbedingt angepasst`

Keine Scheingenauigkeit mit widersprüchlicher Summe.

---

# 7. Startdatum und Rhythmus

## 7.1 Gemeinsamer Frequenztyp

Die vorhandenen vier Werte können weiterverwendet werden:

- monthly
- quarterly
- semiannual
- annual

Der Typ sollte nicht mehr davon abhängen, dass `InvestmentPlan` einen gemeinsamen Shape besitzt.

Sinnvoll ist ein eigener `InvestmentFrequency`-Typ.

## 7.2 Standarddatum nächster 1. / 15.

Pure Helper-Funktion einführen, sinngemäß:

`nextImplementationDate(referenceDate)`

Regel:

- Kalendertag 1–14 → 15. desselben Monats
- Kalendertag ab 15 → 1. des Folgemonats

Wichtig:

Nicht über `toISOString()` eine UTC-Datumsverschiebung riskieren.

Das Ergebnis lokal als `YYYY-MM-DD` aufbauen.

## 7.3 Bedeutung beim gestaffelten Einstieg

Bei teilweiser Staffelung gilt:

- `Sofortanlage` = direkt umzusetzender Anteil
- `startDate` = Termin der **ersten gestaffelten Rate**

Keine zweite Startdatumslogik für den Sofortbetrag einführen.

---

# 8. Lifecycle des Einstiegsplans

Eine zentrale Reconcile-Logik ist erforderlich.

## 8.1 Gültige Relation

Ein PhasedEntryPlan ist nur gültig, wenn:

- referenzierte `allocationId` im selben StructurePlan existiert
- referenzierte `capitalPotId` aktuell existiert
- `allocationAmountInCapitalPot(...) > 0`

Sonst ist die konkrete Produkt×Topf-Allokation nicht mehr vorhanden.

## 8.2 Produktallokation löschen

Beim Löschen einer PlannerAllocation:

- alle PhasedEntryPlans mit dieser `allocationId` entfernen
- SavingsPlans unverändert lassen

## 8.3 Einzelnen Topfanteil entfernen

Wenn eine Multi-Topf-Allokation einen Kapitaltopfanteil verliert bzw. dieser auf 0 gesetzt wird:

- nur PhasedEntryPlan für diese `allocationId + capitalPotId` entfernen
- andere Topf-Einstiege derselben Allocation bleiben bestehen

## 8.4 Kapitaltopf verschwindet

4A.1-Logik erweitern:

- betroffener Allokationsanteil wird entfernt
- zugehöriger PhasedEntryPlan wird ebenfalls entfernt
- SavingsPlan bleibt bestehen

## 8.5 Allocation-Betrag ändern

Wenn Pair weiterhin existiert:

- Prozentmodus skaliert automatisch durch Ableitung
- EUR-Modus bleibt gespeichert
- ggf. Warnung, wenn EUR-Betrag nun Zielbetrag übersteigt

## 8.6 Single / Overflow / Manual wechseln

Nach jedem Wechsel / jeder Neuverteilung:

- bestehende Pairs ermitteln
- PhasedEntryPlans gültiger Pairs behalten
- verschwundene Pairs bereinigen
- neue Pairs standardmäßig `Komplett sofort`

Keine Staffelungsentscheidung automatisch von einem alten Topf auf einen neu entstandenen Topf übertragen.

---

# 9. Planvarianten und ID-Lifecycle

Mit der neuen expliziten `allocationId`-Relation werden Klonvorgänge wichtig.

## 9.1 `duplicatePlan`

Aktueller Code regeneriert beim Duplizieren die IDs der PlannerAllocations, die InvestmentPlans werden heute jedoch ohne Relation einfach mitgeklont.

4B muss beim Duplizieren:

1. Map `alte allocationId → neue allocationId` erzeugen
2. PhasedEntryPlans duplizieren und ihre `allocationId` auf neue IDs remappen
3. IDs der neuen PhasedEntryPlans ebenfalls neu erzeugen
4. SavingsPlans duplizieren und neue eigene IDs vergeben
5. SavingsGoal-Referenzen unverändert lassen, da das Ziel caseweit ist

Keine identischen planinternen InvestmentPlan-IDs über Varianten erzeugen.

## 9.2 `createNewPlan`

Neue leere Planvariante:

- keine Einstiegspläne
- keine Sparpläne
- SavingsGoals bleiben auf Case-Ebene natürlich vorhanden

## 9.3 Modellportfolio `new`

Wenn eine neue Variante aus einem bestehenden Plan erzeugt und ein Teil der Allokationen ersetzt wird:

- gültige Einstiegspläne nicht ersetzter Allokationen erhalten / sauber remappen
- Einstiegspläne ersetzter Allokationen entfernen
- SavingsPlans als unabhängige Umsetzungsentscheidung der Variante mitkopieren, sofern der bestehende Plan komplett dupliziert wird

## 9.4 Modellportfolio `replace`

Alle bisherigen Einmal-Allokationen werden ersetzt.

Daraus folgt:

- alle PhasedEntryPlans alter Allokationen entfernen
- SavingsPlans bleiben bestehen

## 9.5 VV-Update

Wenn eine bestehende VV-Allokation aktualisiert wird und derselbe Pair-Bezug erhalten bleibt:

- Einstiegsplan bleibt bestehen und reagiert auf neuen Zielbetrag

Wenn der Kapitaltopf gewechselt wird:

- alter Pair-Einstiegsplan entfernen
- neuer Pair standardmäßig komplett sofort

---

# 10. UI-Ziel direkt an Produktposition

## 10.1 Position im Kapitaltopf

Im bestehenden `bucket-items`-Rendering ist der richtige Ort für den Umsetzungsstatus.

Bei jeder sichtbaren Produkt×Topf-Position soll unter den Produktinformationen kompakt stehen:

> **Umsetzung: Komplett sofort · Ändern**

oder beispielsweise:

> **Umsetzung: 40.000 € sofort · 60.000 € gestaffelt · 6 × 10.000 € monatlich ab 15.09.2026 · Ändern**

## 10.2 Entscheidend bei Multi-Topf-Allokation

Wenn dieselbe Allocation in zwei Töpfen erscheint, ist der sichtbare Zielbetrag der jeweilige Topfanteil.

Nicht die Gesamt-Allocation anzeigen, wenn der Umsetzungsblock diesen Pair beschreibt.

## 10.3 Bearbeitung

`Ändern` klappt unmittelbar an der Position einen kompakten Editor auf.

Kein globales Modal erforderlich, sofern die Inline-UX sauber funktioniert.

Mögliche Umschaltung:

- Komplett sofort
- Teilweise gestaffelt
- Komplett gestaffelt

Bei `Komplett sofort`:

- PhasedEntryPlan entfernen
- Editor wieder einklappbar

Bei Staffelung:

- `% / €` Umschalter
- gestaffelter Wert
- automatisch Sofortbetrag
- Anzahl Raten
- automatisch Rate
- Rhythmus
- erste Rate / Startdatum
- optional Hinweis

## 10.4 Nur ein geöffneter Editor

UI-State bevorzugt mit Pair-Key, z. B. sinngemäß:

`allocationId::capitalPotId`

Nur als React-UI-State. Nicht als fachlichen Datensatz speichern.

---

# 11. Neue Umsetzungsübersicht

Der bisherige Bereich `Spar- und Investitionspläne` bleibt, ändert aber seine Funktion.

## 11.1 Geplante Einstiege

Die Übersicht wird **aus den aktuellen PlannerAllocations und ihren positiven CapitalPot-Anteilen abgeleitet**.

Deshalb erscheinen auch implizite Direkteinstiege ohne InvestmentPlan-Datensatz.

Beispiele:

- UniMarktführer · Strategisch · 150.000 € → Komplett sofort
- ZinsFix · Strategisch · 100.000 € → 40.000 € sofort + Staffelung
- ZinsFix · 2034 · 50.000 € → Komplett sofort

## 11.2 Kein zweiter Erfassungsort

Globalen Button `+ Gestaffelte Anlage` entfernen.

Einstieg nur an der konkreten Produktposition ändern.

## 11.3 Laufende Sparpläne

Eigener Abschnitt.

`+ Sparplan` bleibt als globaler Erfassungsweg sinnvoll, weil ein Sparplan nicht aus einer bestehenden Einmalallokation kommen muss.

---

# 12. Sparplan-Produktpicker

## 12.1 Bestehenden Katalog wiederverwenden

Der Planner baut heute bereits einen Katalog aus:

- `houseProducts`
- `managedPortfolios`
- Modellportfolio-Bausteine sind soweit relevant bereits über die Produktdaten abgedeckt

Für Sparpläne nicht einen parallelen Datenbestand erstellen.

Bevorzugt gemeinsamen Helper / gemeinsame Katalogstruktur extrahieren, damit Planner-Katalog und Sparplan-Picker dieselben Produktquellen verwenden.

## 12.2 Gruppe `Im aktuellen Plan`

Produkte aus der aktuellen Planvariante aggregieren nach `productId`.

Bei demselben Produkt in mehreren Allokationen / Kapitaltöpfen:

- Produkt nur einmal im Sparplan-Picker zeigen
- geplanten Gesamtbetrag dieses Produkts summieren

Sortierung:

- geplanter Gesamtbetrag absteigend

Beispiel:

- ZinsFix Index · 150.000 € im Plan
- UniMarktführer · 100.000 € im Plan

## 12.3 Weitere Lösungsbausteine

Danach vollständiger interner Produktkatalog.

Produkte, die bereits in Gruppe 1 stehen, dort nicht erneut als Dublette anzeigen.

## 12.4 Suche

Bei ausreichend großem Katalog eine kleine Suche nach:

- Produktname
- WKN, soweit vorhanden

wiederverwenden.

Kein externer Freitext in 4B.

---

# 13. Sparziel technisch sauber trennen

## 13.1 Erstellung

Aus dem Sparplan-Editor:

- kein Zielbezug
- vorhandenes SavingsGoal
- neues SavingsGoal
- optional vorhandenen echten Kapitalbedarf nur referenzieren

## 13.2 Neues Sparziel

Minimal erforderlich:

- Zweck / Bezeichnung
- Zielbetrag
- Zieljahr oder Zieldatum

Kein Eintrag in `advisory.needs`.

## 13.3 Löschung SavingsGoal

Wenn ein SavingsGoal gelöscht wird:

- SavingsPlan bleibt bestehen
- nur `targetRef` bei allen betroffenen SavingsPlans aller Planvarianten entfernen

## 13.4 Löschung eines referenzierten echten Kapitalbedarfs

Nach 4B die 4A.1-Bedarfs-Lifecycle-Logik erweitern:

- Bedarf verschwindet normal aus Kapitaltopfstruktur
- SavingsPlans, die ihn nur informativ referenzieren, bleiben bestehen
- deren `targetRef` wird entfernt

## 13.5 Änderung des Sparziels

ID bleibt stabil.

Änderung von Betrag / Zieljahr löscht keine Sparpläne.

Der spätere Sparzielrechner kann die neuen Zielwerte live übernehmen.

---

# 14. Sparplan-Zusammenfassung

## 14.1 Originäre Rhythmen bleiben führend

Keine künstliche Monatsrate bei gemischten Rhythmen.

## 14.2 Aggregation

Sinnvoller Helper für Jahresbeitrag:

- monatlich × 12
- vierteljährlich × 4
- halbjährlich × 2
- jährlich × 1

### Darstellung

Wenn alle aktiven Sparpläne monatlich sind:

> Zusätzliche Sparpläne: 1.500 €/Monat

Bei gemischten Rhythmen:

> Laufende Sparbeiträge: 18.000 €/Jahr

Darunter die tatsächlichen Einzelrhythmen weiter anzeigen.

Die Jahreszahl ist nur eine Aggregationshilfe und kein Kapitaltopf-/Planungsbetrag.

---

# 15. Migration alter V0.14-InvestmentPlans

4B verändert die gespeicherte Struktur substanziell. `normalizeImportedCase(...)` muss alte Fälle weiter öffnen können.

## 15.1 Alte Sparpläne

Bestehender `type: "savings"` kann grundsätzlich migriert werden:

- `installmentAmount` → neuer Sparbeitrag
- `frequency` übernehmen
- `startDate` übernehmen
- `productId` / `productName` übernehmen
- `name` optional übernehmen
- `note` übernehmen

Bewusst entfernen / ignorieren:

- `capitalPotId`
- `bucketId`
- `installments` als fachliche Laufzeit
- daraus berechneten alten Gesamtbetrag

Kein SavingsGoal automatisch aus einem alten Kapitaltopf erfinden.

## 15.2 Alte gestaffelte Anlagen

Konservative Migration.

Möglicher Auflösungsweg:

1. `entry.productId` bestimmen
2. `entry.capitalPotId` bestimmen, sofern vorhanden
3. im selben Plan Allocation-Kandidaten mit passendem Produkt suchen
4. prüfen, ob der Kandidat in diesem Topf einen positiven Betrag besitzt
5. nur bei eindeutiger Relation auf `allocationId + capitalPotId` migrieren

Der alte `installmentAmount × installments`-Betrag darf **nicht automatisch als neue Zielsumme** verstanden werden, wenn er nicht zum tatsächlichen Topfanteil passt.

Wenn alte Daten eindeutig einem Pair zuordenbar sind, kann der alte Gesamtstaffelbetrag als EUR-Staffelbetrag übernommen werden, sofern er `<= aktueller Pair-Zielbetrag` ist.

Bei Unklarheit:

- keine fachliche Zuordnung erfinden
- entweder sichtbaren Migrationshinweis erzeugen oder den alten Phased-Datensatz kontrolliert als nicht migrierbar kennzeichnen
- keine falsche automatische Zuordnung auf erste Allocation

Work soll dafür die einfachste robuste Variante wählen und im Abschlussbericht nennen.

## 15.3 Schema-Version

4B benötigt aufgrund der neuen SavingsGoals und der discriminated InvestmentPlan-Struktur einen Schema-Schritt.

Die konkrete Nummer hängt vom finalen 4A.1-Stand ab:

- wenn 4A.1 Schema 7 einführt → 4B typischerweise Schema 8
- wenn 4A.1 bei Schema 6 bleibt → 4B mindestens auf eine neue Schema-Version erhöhen

Nicht mehrere konkurrierende `normalizeImportedCase`-Pfade bauen.

---

# 16. Export-Kompatibilität während 4B

Die vollständige Exportkonsolidierung bleibt ein späteres Paket. Trotzdem darf 4B die vorhandenen Exporte nicht technisch brechen.

## 16.1 Excel

Der aktuelle `Investitionspläne`-Export greift direkt auf die alten gemeinsamen Felder zu und muss mindestens kompatibel angepasst werden.

Sinnvolle Trennung der Zeilen:

### Phased Entry

- Plan
- Art = Gestaffelter Einstieg
- Produkt
- Kapitaltopf
- Zielbetrag
- Sofortbetrag
- Gestaffelter Betrag
- Staffelmodus
- Anzahl Raten
- Rate
- Rhythmus
- Start
- Hinweis

### SavingsPlan

- Plan
- Art = Sparplan
- Produkt
- Sparrate
- Rhythmus
- Start
- Zielbezug
- Hinweis

Kein fiktiver `Gesamtbetrag` eines fortlaufenden Sparplans.

## 16.2 PDF / Kundenübersicht

Wenn der heutige Print-Bereich InvestmentPlans auflistet, mindestens so anpassen, dass:

- kein Laufzeit-/Gesamtbetrag eines fortlaufenden Sparplans erfunden wird
- gestaffelter Einstieg aus dem echten Pair-Zielbetrag berechnet wird
- Sparplan separat erkennbar bleibt

Keine große visuelle Export-Neukonzeption in 4B. Diese folgt später.

## 16.3 JSON

Automatisch neue Felder exportieren.

Import läuft über aktualisierte Normalisierung.

---

# 17. Wichtige Regressionsrisiken

## 17.1 Doppelzählung

Nach 4B muss immer gelten:

`Summe PlannerAllocation.amount` bleibt die Einmalplanung.

Weder:

- Sofortbetrag
- Staffelbetrag
- Rate
- Summe der Raten
- Sparplanbeiträge

werden zusätzlich auf den Planungsbetrag addiert.

## 17.2 Vermögenshaus

Gestaffelter Einstieg ändert nicht die wirtschaftliche PLAN-Struktur.

Das Produkt ist bereits vollständig geplant.

Auch wenn 60 % später gekauft werden, bleibt das Zielbild 100 % der Produktallokation.

## 17.3 Depotcheck

4B ändert nicht automatisch die bestehende Logik `geplante Käufe aus aktivem Strukturplan`.

Der Depotcheck PLAN bleibt fachlich die Ziel-/Transaktionssimulation des vollständigen Strukturplans, nicht nur der sofortigen Tranche.

Keine neue Depotcheck-Timing-Logik in 4B hineinziehen.

## 17.4 Kapitaltopfabdeckung

Staffelung verändert nicht die Topfabdeckung.

Sparplan verändert nicht die Topfabdeckung.

SavingsGoal verändert nicht die Topfabdeckung.

## 17.5 Planvarianten

Einstiegspläne und Sparpläne gehören zur jeweiligen Planvariante.

SavingsGoals sind fallweit.

---

# 18. Fokussierte Regressionstest-Matrix 4B

## A – Default komplett sofort

- Produkt 100.000 € einem Topf zuordnen
- keine Umsetzung bearbeiten

Erwartung:

- Status `Komplett sofort`
- kein PhasedEntryPlan notwendig
- Planbetrag 100.000 €

## B – 60 % / 6 Raten

- Zielbetrag 100.000 €
- 60 % gestaffelt
- 6 Raten

Erwartung:

- 40.000 € sofort
- 60.000 € gestaffelt
- 6 × 10.000 €
- Planbetrag unverändert

## C – Prozentmodus Zieländerung

- vorher 100.000 € / 60 %
- Zielbetrag auf 150.000 € erhöhen

Erwartung:

- 90.000 € gestaffelt
- 60.000 € sofort

## D – EUR-Modus Zieländerung

- vorher 100.000 € / 60.000 € gestaffelt
- Zielbetrag auf 150.000 € erhöhen

Erwartung:

- gestaffelt 60.000 €
- sofort 90.000 €

## E – EUR-Modus wird ungültig

- 60.000 € gestaffelt
- Pair-Zielbetrag auf 50.000 € reduzieren

Erwartung:

- Warnung
- keine stille Änderung der 60.000 €

## F – dasselbe Produkt in zwei Töpfen

Eine Allocation mit:

- 50.000 € 2034
- 100.000 € strategisch

Erwartung:

- zwei getrennte Umsetzungsstatus
- 2034 kann sofort sein
- strategisch kann gestaffelt sein
- Änderungen unabhängig voneinander

## G – Multi-Topf-Pair entfernen

- nur 2034-Anteil auf 0 setzen / Topf entfernen

Erwartung:

- nur Einstiegsplan 2034 verschwindet
- strategischer Einstiegsplan bleibt

## H – Allocation löschen

Erwartung:

- alle PhasedEntryPlans dieser Allocation verschwinden
- SavingsPlans auf dasselbe Produkt bleiben

## I – Plan duplizieren

Erwartung:

- neue Allocation-IDs
- alle Phased-Referenzen korrekt remapped
- neue InvestmentPlan-IDs
- SavingsGoal-Referenzen bleiben gültig
- Ursprungsplan unverändert

## J – Modellplan ersetzen

Erwartung:

- alte Einstiegspläne verschwinden mit alten Allokationen
- Sparpläne bleiben

## K – Sparplan Planprodukt

- 500 €/Monat

Erwartung:

- Kapitaltopfwerte unverändert
- Planungsbetrag unverändert
- Topfabdeckung unverändert

## L – Sparplan Katalogprodukt

Produkt nicht in Einmalplanung auswählen.

Erwartung:

- zulässig
- Einmalplanung unverändert

## M – gemischte Sparrhythmen

- 500 €/Monat
- 1.500 €/Quartal

Erwartung:

- keine irreführende gemeinsame Monatsrate
- sinnvolle Jahresaggregation
- Einzelrhythmen sichtbar

## N – neues Sparziel

- Ziel 100.000 € / 2038
- mit Sparplan verknüpfen

Erwartung:

- `savingsGoals` enthält Ziel
- kein `advisory.need`
- kein `year-2038`-Topf dadurch
- strategisches Kapital unverändert
- Topfabdeckung unverändert

## O – Sparziel löschen

Erwartung:

- Sparplan bleibt
- Zielreferenz verschwindet

## P – echten Bedarf nur referenzieren

Erwartung:

- Sparplan kann Bedarf anzeigen
- keine Abdeckung / keine Veränderung der Bedarfssumme

## Q – Bedarf mit Referenz löschen

Erwartung:

- normale 4A.1-Topfbereinigung
- Sparplan bleibt
- Need-Referenz verschwindet

## R – alter V0.14-Sparplan importieren

Erwartung:

- Sparrate / Produkt / Rhythmus / Start bleiben sinnvoll erhalten
- keine alte Ratenanzahl als Endlaufzeit
- kein fiktiver Gesamtbetrag

## S – alte gestaffelte Anlage eindeutig migrierbar

Erwartung:

- Relation auf korrektes allocationId + capitalPotId
- kein Bezug auf erste Allocation aus Bequemlichkeit

## T – unzugeordneter Overflow-Rest

Erwartung:

- kein Einstiegsplan für unsichtbaren / unzugeordneten Rest
- bestehende Overflow-Warnung bleibt sichtbar

---

# 19. Technische Helper – empfohlene Extraktion

Keine zwingenden Namen, aber folgende Logik sollte nicht mehrfach in JSX stehen:

- `entryTargetAmount(plan, phasedEntry)` / Pair-Auflösung
- `stagedAmount(...)`
- `immediateAmount(...)`
- `installmentSchedule(...)`
- `entryImplementationSummary(...)`
- `nextImplementationDate(...)`
- `annualSavingsContribution(...)`
- `reconcileInvestmentPlans(...)`
- `clonePlanWithRelations(...)` oder gleichwertige Plan-Klonlogik
- `resolveProductCatalogItem(...)`

Je mehr davon reine Funktionen sind, desto einfacher sind gezielte Tests ohne Browser.

---

# 20. Test-/Build-Strategie

Im Repository existiert aktuell kein eigener Jest/Vitest-Testbestand. `npm test` führt TypeScript und den GitHub-Pages-Build aus.

Für 4B:

Pflicht:

- `npm run typecheck`
- `npm run build`
- `git diff --check`
- fokussierte deterministische Checks der neuen Rechen-/Reconcile-Helper
- manuelle bzw. agentische Kurzprüfung der zentralen UI-Pfade, soweit ohne lange Browser-E2E-Schleifen möglich

Kein schweres neues Testframework nur für dieses Paket einführen, sofern nicht klar nötig.

Bei Bedarf kleine pure Test-/Verify-Skripte bevorzugen.

---

# 21. Empfohlene Work-Checkpoints

## Checkpoint 1 – Datenmodell, Migration, Rechenlogik

Umfassen:

- neue Types
- SavingsGoals
- Migration
- Pair-Relation
- Berechnungshelper
- Lifecycle/Reconcile
- Plan-Klonlogik
- fokussierte Tests

Danach:

- Commit
- Push Arbeitsbranch

## Checkpoint 2 – Planner UX und Sparplan

Umfassen:

- Direkteinstieg-Status an Produktposition
- Inline-Editor
- Umsetzungsübersicht
- neuer Sparplanpicker
- Sparziel-Verknüpfung
- Export-Kompatibilität
- abschließende Tests

Danach:

- TypeScript
- Build
- `git diff --check`
- finaler Commit / Push
- erst bei vollständigem Paket Merge auf main

Keine unnötigen Zwischen-Merges oder mehrfachen Pages-Deployments.

---

# 22. Ressourcen-/Modell-Empfehlung

4B ist nach diesem Preflight kein fachlich offener Forschungsblock mehr, aber ein kohärenter Datenmodell-/UX-Umbau mit Migration und Lifecycle-Beziehungen.

Empfehlung:

> **GPT-5.6 Sol · Mittel**

Nicht Terra als Standard wählen, weil:

- discriminated union / Migration
- relationale Pair-Logik
- mehrere Plan-Mutationspfade
- Klon-/Lifecycle-Themen
- UI und Export müssen zusammenpassen

Sol Hoch erscheint nur notwendig, falls 4A.1 unerwartet einen größeren Refactor hinterlässt oder bei der Migration schwere Inkonsistenzen auftreten.

---

# 23. Ergebnis des technischen Preflights

## Stabiler Bezug

`PlannerAllocation.id` ist ausreichend als Allocation-Identifier.

Für das fachlich gewünschte Objekt ist aber zwingend die Kombination:

> **allocationId + capitalPotId**

zu verwenden.

Keine neue eigenständige Suballocation-ID ist derzeit erforderlich.

## Sparziel

Technisch sinnvoll auf **AdvisoryCase-Ebene** modellieren.

## Sparplan

Bleibt planvariantenspezifisch, aber vollständig unabhängig von Kapitaltopfabdeckung und Einmalplanung.

## Direkteinstieg

Impliziter Default ohne Datensatz ist technisch die sauberste Lösung.

## Migration

4B braucht einen echten Schema-/Normalisierungsschritt.

## Noch offene fachliche Entscheidung

Keine zentrale fachliche Entscheidung mehr offen.

Kleinere visuelle Details können aus der Master-Spezifikation und diesem Preflight abgeleitet werden.

---

# 24. Implementierungsreihenfolge nach Projektplan

1. 4A.1 implementieren und manuell abnehmen
2. aktuellen main nach 4A.1 als neue Basis prüfen
3. dieses 4B-Preflight gegen die tatsächlichen 4A.1-Helper kurz abgleichen
4. finalen 4B-Work-Prompt erzeugen
5. 4B auf eigenem Branch umsetzen
6. manuelle UX-Abnahme gemeinsam durchführen

Damit wird verhindert, dass Work während 4B erst das Grundmodell rekonstruieren oder fachliche Entscheidungen erraten muss.
