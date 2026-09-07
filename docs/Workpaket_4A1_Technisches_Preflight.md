# Work-Paket 4A.1 – Technisches Preflight

> Technische Umsetzungskarte zum fachlich freigegebenen Abschnitt 4A.1 der `VermoegensNavigator_Master-Spezifikation.md`.
>
> Stand: 07.09.2026  
> Ausgangsversion: V0.14  
> Zielversion bei erfolgreicher Umsetzung: V0.14.1  
> Empfohlener Arbeitsbranch: `work/4a1-bestandsdepot-fixes`

---

## 1. Zweck und Abgrenzung

Dieses Dokument soll Work vor der Implementierung die bereits identifizierten technischen Ursachen, Invarianten, betroffenen Codebereiche und fokussierten Regressionstests nennen. Es ersetzt weder die Master-Spezifikation noch den finalen Work-Prompt.

4A.1 bleibt ein Korrekturpaket. Nicht hineinziehen:

- neue InvestmentPlan-/Sparplanlogik aus 4B
- Depotcheck 3B
- Risiko V2
- neue Vertiefungsinhalte
- Export-Endkonsolidierung außerhalb der vereinbarten Branding-Korrektur
- Mobile-Optimierung

---

# 2. Betroffene Codebereiche

## `app/case-model.ts`

Relevant sind insbesondere:

- `CapitalPotId`
- `PlannerAllocation`
- `StructurePlan`
- `InvestmentPlan`
- `capitalPots(...)`
- `allocationCapitalPotAmounts(...)`
- `allocationCapitalCoverageTotal(...)`
- `legacyBucketAmountsForCapitalPots(...)`
- `planAssetAmounts(...)`
- `depotAssetAmounts(...)`
- `depotPlanAssetAmounts(...)`
- `normalizeImportedCase(...)`

Wichtig: `normalizeImportedCase(...)` wird bereits beim Laden gespeicherter Fälle, beim JSON-Import und beim Wiederherstellen eines Versions-Snapshots verwendet. Die bestehende Funktion ist daher der richtige Ort, um bereits gespeicherte kaputte Fälle zu reparieren. Historische `versions`-Snapshots selbst nicht rückwirkend mutieren. Erst die wiederhergestellte Arbeitskopie wird normalisiert.

## `app/page.tsx`

Relevant sind insbesondere:

- `Home` / Laden aus LocalStorage / JSON-Import
- `WizardView.updateData(...)`
- `SituationStep` und seine Depot-Setter
- `useDepotCsvImport(...)`
- `NeedsStep` und das Löschen eines Bedarfs
- `PlannerView`
  - `visibleCapitalPots`
  - `selectedDepotIds`
  - `selectedDepot`
  - `includedDepotTotal`
  - `consideredTotal`
  - `depotStatus`
  - Bestandsdepot-Panel
  - Plan-/Allokationsupdates
- `WealthHouse`
  - IST-/PLAN-/ZIELPLAN-Snapshots
  - Depotbeiträge
  - Tabelle unter dem Vermögenshaus
  - Säulendetail
- `DepotOptimizer`
- `ExportCenter` / `print-document`
- `ModuleWorkspace` enthält ebenfalls noch einen alten `brand-placeholder`

## Styles / Build

Source-of-Truth für die Web-/Print-Styles ist `app/globals.css`.

Der GitHub-Pages-Build kopiert bereits:

- `app/globals.css` nach `.pages-dist/styles.css`
- `public/branding/.` vollständig nach `.pages-dist/branding/`

Daher für 4A.1 **keine neue Asset-Pipeline bauen**. `scripts/build-github-pages.sh` muss für die bereits vorhandenen Branding-Dateien nicht erneut grundlegend geändert werden.

---

# 3. Technisch bestätigte Ursachen im aktuellen V0.14-Code

## 3.1 Geister-Kapitaltopf

Beim Löschen eines Bedarfs wird aktuell nur `data.needs` gefiltert. Allokationen und InvestmentPlans werden nicht mitbereinigt.

Zusätzlich validiert `normalizeImportedCase(...)` bestehende `capitalPotAmounts` nicht gegen die aktuell aus `capitalPots(...)` abgeleiteten gültigen Topf-IDs. Wenn `capitalPotAmounts` bereits positive Werte enthält, wird die bestehende Zuordnung derzeit im Wesentlichen übernommen.

Folge:

- verschwundene Jahres-Topf-ID bleibt in Allokationen gespeichert
- Produktbetrag wird weiter in `planAssetAmounts(...)` / Vermögenshaus gerechnet
- `Produkten zugeordnet` bleibt zu hoch
- `Topfabdeckung` kann auf unsichtbare Topf-IDs verweisen
- Umsetzungspläne können auf nicht mehr existierende Töpfe zeigen

## 3.2 Bestandsdepot-Modi

`StructurePlan.depotMode` ist aktuell:

`none | compare | retain | afterSales`

Die aktuelle UI-/Berechnungslogik vermischt dabei teilweise Positionsauswahl und Modus:

- `depotHoldingIds` wird für mehrere Modi verwendet
- wenn `depotHoldingIds` leer ist, wird aktuell häufig implizit „alle Positionen“ angenommen
- `afterSales` filtert dadurch derzeit ebenfalls über IDs, obwohl fachlich der vollständige Restbestand verwendet werden soll

## 3.3 IST der Strukturplanung

`WealthHouse` baut den IST-Snapshot der Strukturplanung aktuell grundsätzlich aus gesamtem Depot + erfasster Liquidität. `plan.depotMode === "none"` entfernt das Depot nicht aus IST.

Das erklärt den beobachteten Fehler, dass `Nicht berücksichtigen` zwar PLAN beeinflusst, aber IST weiterhin das Depot enthält.

## 3.4 Depotcheck

Die Kernberechnung `depotPlanAssetAmounts(depot, plan)` verwendet bereits den vollständigen Depotrest nach simulierten Verkäufen plus Plan-Käufe.

Auch `WealthHouse` im `context="depot"` hat bereits eine weitgehend eigenständige PLAN-Logik.

Deshalb gilt für 4A.1:

> **Depotcheck-Entkopplung zuerst als Regression testen. Nur refactoren, wenn die tatsächliche Laufzeitlogik noch vom Strukturplan-Depotmodus abhängt.**

Keinen unnötigen Umbau einer bereits korrekten Berechnung erzeugen.

## 3.5 CSV-Neuimport

`useDepotCsvImport(...)` ersetzt beim Modus `replace` lediglich den Depot-Array. Die in den Planvarianten gespeicherten `depotHoldingIds` werden dabei nicht reconciliiert.

Wenn die neu importierten Positionen neue IDs erhalten, können alte IDs nicht mehr aufgelöst werden.

## 3.6 Branding

Der Header nutzt die beiden korrekten Branding-Dateien bereits, das Private-Banking-Logo wird aber über eine Crop-/Positionierungslogik gerendert, die im sichtbaren Ergebnis links abschneidet.

Im `print-document` der Kundenübersicht existiert weiterhin ein expliziter `brand-placeholder` mit „Logo“.

Auch `ModuleWorkspace` enthält noch denselben alten Platzhalter. Da in 4A.1 das Branding ohnehin angefasst wird, diesen verbliebenen sichtbaren Platzhalter ebenfalls durch die vorhandene Markenkomponente bzw. eine kleine wiederverwendbare Branding-Komponente ersetzen. Keine neue Vertiefungslogik bauen.

---

# 4. Ziel-Invarianten Kapitaltopf-Lifecycle

## 4.1 Gültige Topf-IDs

Für jede Planvariante ist die Menge gültiger `CapitalPotId` immer aus

`capitalPots(advisory, plan.total, referenceDate)`

abzuleiten.

Nach jeder Normalisierung / relevanten Topologieänderung gilt:

- `capitalPotId` verweist nur auf einen existierenden Topf oder ist leer
- `capitalPotAmounts` enthält nur existierende Topf-IDs
- `bucketAmounts` wird aus den bereinigten gültigen Topfanteilen neu konsistent abgeleitet
- keine unsichtbare Topf-ID darf in Topfabdeckung oder UI weitergerechnet werden

## 4.2 Reusable Reconcile-Helper

Bevorzugt eine reine bzw. gut testbare zentrale Helper-Logik in `case-model.ts` einführen, z. B. sinngemäß:

- `reconcilePlanCapitalPots(...)`
- oder `reconcilePlansWithCapitalPots(...)`

Keine verstreuten Sonderfälle ausschließlich in React-Handlern.

Der Helper soll für

- Live-Änderungen
- Laden alter Fälle
- JSON-Import
- Wiederherstellen alter Versionen

wiederverwendbar sein.

## 4.3 Entfernen eines verschwundenen Topfanteils

Wenn eine Allokation mehrere gültige Topfanteile hat und ein Topf verschwindet:

- nur der Anteil des ungültigen Topfs entfernen
- gültige Topfanteile erhalten
- nicht automatisch nach `strategic` verschieben

Wenn danach **kein gültiger Topfanteil mehr übrig bleibt**, die auf diesen verschwundenen Topf verankerte Produktallokation vollständig entfernen. Damit bleiben keine Produkte eines gelöschten Bedarfs als Geisterposition im Vermögenshaus oder Umsetzungsweg bestehen.

Wenn gültige Anteile übrig bleiben:

- `allocation.amount` um den entfernten ungültigen zugeordneten Betrag reduzieren
- einen bereits vorher vorhandenen echten, nicht zugeordneten Überplanungsbetrag nicht künstlich einem neuen Topf zuweisen
- verbleibende gültige Topfanteile konsistent erhalten

Ziel ist: keine automatische neue Anlageentscheidung, keine unsichtbaren Anteile, keine Doppelzählung.

## 4.4 Jahrestopf bleibt bestehen

Wenn nur einer von mehreren Bedarfen desselben Jahres gelöscht wird und der Jahrestopf weiterhin existiert:

- Topf-ID bleibt gleich
- Produktzuordnungen bleiben bestehen
- nur Topf-Zielbetrag / Bedarfsliste ändert sich
- mögliche Überdeckung wird sichtbar, aber nicht automatisch gekürzt

## 4.5 Reine Überplanung

Wenn ein Topf weiterhin existiert, sein Zielbetrag aber sinkt oder das Planvolumen kleiner wird:

- Produktallokationen nicht automatisch auf den Zielbetrag kürzen
- Überplanung / Überdeckung bleibt sichtbar

Bereinigt wird nur eine **tatsächlich ungültige Topf-ID**, nicht bloß eine Überdeckung eines weiterhin existierenden Topfs.

## 4.6 Alle Planvarianten

`advisory.needs`, Reserve und Liquidität sind fallweite Grundlagen. Eine Topologieänderung muss daher **alle `item.plans`** prüfen, nicht nur `activePlanId`.

Ein gelöschter Jahrestopf darf nicht in einer inaktiven Planvariante als Geisterzuordnung weiterleben.

## 4.7 InvestmentPlans

Bestehende V0.14-InvestmentPlans haben nur Produkt-/Topfbezug und noch keine stabile Allocation-ID.

Für 4A.1:

- InvestmentPlans mit einer nicht mehr existierenden `capitalPotId` dürfen nicht verwaist bleiben
- wenn der betroffene Topf vollständig verschwindet, entsprechenden alten Umsetzungsbezug entfernen
- 4A.1 noch **nicht** auf das neue 4B-Datenmodell umbauen

---

# 5. Live-Änderungen an Bedarfen

## 5.1 Explizites Löschen

`NeedsStep` soll das Löschen nicht mehr direkt mit `update("needs", filter(...))` ausführen, wenn dadurch ein belegter Jahrestopf vollständig verschwindet.

Bevorzugte technische Route:

- Delete-Handler in eine Ebene verschieben, die Zugriff auf den gesamten `AdvisoryCase` und alle Pläne hat
- Vorher/Nachher-Topfmenge je Plan vergleichen
- betroffene Allokationen/InvestmentPlans zählen und Betrag bestimmen
- nur wenn der Topf wirklich verschwindet und Bezüge vorhanden sind, Bestätigung anzeigen

Sinngemäße Meldung:

> Kapitalbedarf 2034 löschen? Dem dadurch entfallenden Kapitaltopf sind 2 Produktzuordnungen über 150.000 € und ggf. Umsetzungsbezüge zugeordnet. Bedarf und zugehörige Topfzuordnungen löschen oder abbrechen.

Kein Warnfenster, wenn derselbe Jahrestopf wegen anderer Bedarfe weiterhin existiert.

## 5.2 Andere Topologieänderungen

Auch Änderungen an

- `needs` (Jahr / Termin / Betrag 0)
- `reserve`
- `liquidAssets` bei verknüpften Plänen
- manuellem `plan.total`

können sichtbare Topf-IDs verändern.

Nach solchen Änderungen muss der zentrale Reconcile-Helper die Datenintegrität wiederherstellen. Keine ungültige Topf-ID darf bis zum nächsten Reload weiterleben.

---

# 6. Normalisierung alter / bereits kaputter Fälle

`normalizeImportedCase(...)` muss nicht nur Legacy-Buckets migrieren, sondern anschließend existierende `capitalPotId` / `capitalPotAmounts` gegen die **aktuellen** Pots validieren.

Wichtig:

- bestehende positive `capitalPotAmounts` nicht mehr ungeprüft früh zurückgeben
- erst auf gültige Topf-IDs filtern
- anschließend Allocation-Betrag / Mode / Legacy-Bucket-Ableitung konsistent machen
- verwaiste alte InvestmentPlans entfernen
- alte `depotHoldingIds` auf existierende Depotpositionen begrenzen bzw. gemäß Abschnitt 7 normalisieren

Da dies eine echte Persistenz-/Semantikmigration ist, ist eine minimale Schemaerhöhung von 6 auf **7** für 4A.1 fachlich sinnvoll. Falls Work nach Prüfung eine gleichwertig saubere kompatible Lösung ohne Bump findet, nicht künstlich erzwingen; die Migration muss aber eindeutig und testbar sein.

Historische `versions`-Snapshots nicht in-place verändern. Beim Wiederherstellen wird die Arbeitskopie normalisiert.

---

# 7. Bestandsdepot-Modi – technische Zielsemantik

| Modus | IST Strukturplanung | PLAN/ZIELPLAN Strukturplanung | Positionsauswahl |
|---|---|---|---|
| `none` | kein Depot | kein Depot | ignorieren |
| `compare` | vollständiges aktuelles Depot | kein Depot | ignorieren |
| `retain` | vollständiges aktuelles Depot | nur explizit gewählte Positionen zum aktuellen Wert | Checkboxen |
| `afterSales` | vollständiges aktuelles Depot | kompletter aktueller Depotrest nach simulierten Verkäufen | keine Checkboxen |

UI-Bezeichnung für `compare`: **Nur im IST berücksichtigen**.

## 7.1 Retain-IDs eindeutig machen

Die bisherige Semantik „leere ID-Liste bedeutet automatisch alle“ ist für `retain` problematisch, weil sie „noch nicht initialisiert“ und „bewusst keine Position ausgewählt“ nicht unterscheidet.

Bevorzugtes Ziel:

- beim Wechsel **in `retain`** initial alle aktuell vorhandenen Depotpositionen als explizite IDs setzen, sofern keine sinnvolle frühere Auswahl vorhanden ist
- danach bedeutet eine leere Liste tatsächlich „keine Position ausgewählt“
- `retain` rechnet ausschließlich explizite gültige IDs
- `afterSales` ignoriert `depotHoldingIds` vollständig
- `none` und `compare` ignorieren `depotHoldingIds` für die Berechnung

Alte V0.14-Fälle mit `retain` + leerer ID-Liste im Normalizer kompatibel auf die bisher gemeinte Vollauswahl migrieren.

## 7.2 Status / Kennzahlen

Planer-Status und `consideredTotal` müssen dieselbe Semantik verwenden:

- none: nur Neuanlage
- compare: nur Neuanlage im PLAN, Depot nur im IST
- retain: Neuanlage + explizit beibehaltener Bestand
- afterSales: Neuanlage + gesamter Restbestand nach Verkäufen

---

# 8. CSV-Ersetzen und Auswahl-Reconciliation

Beim **Ersetzen** eines Depots:

1. neue Holdings haben ggf. neue interne IDs
2. gespeicherte `depotHoldingIds` aller Pläne dürfen nicht unverändert auf alte IDs zeigen

Für jeden Plan:

- vorhandene noch gültige IDs beibehalten, falls technisch identisch
- ansonsten ausgewählte alte Positionen bevorzugt über normalisierte **WKN** auf neue Positionen mappen
- wenn WKN fehlt, optional ein konservatives stabiles Fallback wie `productId` bzw. eindeutige Kombination aus Name + Wertpapiertyp nutzen, aber nur bei eindeutiger Übereinstimmung
- neue/unbekannte Positionen **nicht automatisch** als bewusst `retain` markieren

Beim **Anhängen** von Positionen:

- existierende IDs/Selektion erhalten
- neue Positionen bei `retain` nicht automatisch selektieren

Für `afterSales` spielt diese Liste rechnerisch keine Rolle, da immer der komplette aktuelle Restbestand verwendet wird.

Die Reconciliation sollte fallweit erfolgen, weil jede Planvariante eine eigene Auswahl haben kann.

---

# 9. Vermögenshaus Strukturplanung

## 9.1 IST

Für `context="planner"`:

- current liquidity bleibt Bestandteil der IST-Ausgangslage
- Depotbeitrag im IST richtet sich nach `depotMode`
- `none` → kein Depot
- `compare`, `retain`, `afterSales` → vollständiges aktuelles Depot im IST

Für `context="depot"` bleibt IST immer das physische aktuelle Depot.

## 9.2 PLAN / ZIELPLAN

`snapshotFor(selectedPlan)` muss je Planvariante die Matrix aus Abschnitt 7 anwenden:

- none / compare: kein Depot im Plan
- retain: explizit ausgewählte Positionen, voller aktueller Wert
- afterSales: alle Positionen, Restwert nach Verkäufen

ZIELPLAN nutzt weiterhin die preferred Planvariante mit deren eigenem Persistenzzustand.

## 9.3 Tabelle unter dem PLAN-Haus

Die Tabelle soll fachlich erklären, wie der Gesamtplan entsteht.

Bevorzugte Spalten:

- **Anlageklasse**
- **Berücksichtigter Bestand**
- **Neuanlage**
- **Gesamtplan**

Wenn in `Gesamtplan` ein Prozentwert gezeigt wird, zusätzlich den Betrag oder eine klar separate Quote anzeigen. Nicht einfach eine Prozentquote unter einer Betragsüberschrift ausgeben.

`Berücksichtigter Bestand` muss exakt dem im PLAN enthaltenen Bestand entsprechen:

- none / compare = 0
- retain = ausgewählte Positionen
- afterSales = gesamter Restbestand

---

# 10. Depotcheck

Verbindliche fachliche Logik bleibt:

- IST = vollständiges physisches Depot
- PLAN = vollständiges physisches Depot nach simulierten Verkäufen + Käufe des aktiven Plans

Der aktuelle Core (`depotPlanAssetAmounts`) erfüllt dies bereits weitgehend unabhängig von `depotMode`.

Deshalb:

1. zuerst Regressionstest mit allen vier Strukturplan-Depotmodi
2. prüfen, dass Depotcheck IST und PLAN jeweils identisch bleiben, solange Verkäufe/Käufe unverändert sind
3. nur bei echtem Fehler Code ändern

Keine unnötige zweite Depot-PLAN-Engine bauen.

---

# 11. Säulendetail-Toggle

In `WealthHouse` aktuell sinngemäß:

`onClick={() => setSelectedAsset(name)}`

Ziel:

`onClick={() => setSelectedAsset(selectedAsset === name ? null : name)}`

Verhalten:

- erste Auswahl öffnet
- gleicher Klick schließt
- andere Säule wechselt Detail
- `Schließen ×` bleibt

`CapitalPotStructure` verwendet dieses Toggle-Prinzip bereits und kann als Muster dienen.

---

# 12. Branding / Export

## 12.1 Header

Vorhandene Assets beibehalten:

- `public/branding/volksbank-pur-logo.png`
- `public/branding/private-banking-logo.png`

Private-Banking-Wortmarke vollständig sichtbar rendern. Keine Lösung, die die sichtbaren Logo-Pixel über harte negative Offsets / `overflow:hidden` abschneidet.

Wenn das PNG unnötigen transparenten Rand enthält, sind zulässig:

- robuste `object-fit: contain` / passende Wrapper-Dimensionen
- oder ein nicht-destruktiv aus dem vorhandenen Asset erzeugtes, transparent beschnittenes Derivat, das keine Logo-Pixel verändert

Keine Textnachbildung des offiziellen Logos.

## 12.2 PDF / Kundenübersicht

Im `print-document` den Platzhalter ersetzen durch:

- Volksbank-pur-Logo
- Private-Banking-Logo
- VermögensNavigator als Produktbezeichnung

Beide Logos müssen beim Browserdruck / „Als PDF speichern“ sichtbar und vollständig sein.

Lokale relative Branding-Pfade verwenden.

## 12.3 Fachmodul-Header

Im `ModuleWorkspace` existiert ebenfalls noch ein sichtbarer alter `brand-placeholder`. Da dasselbe Branding ohnehin korrigiert wird, diesen Restplatzhalter im selben Paket konsistent ersetzen. Keine sonstige Vertiefungs-UX verändern.

## 12.4 Build

`build-github-pages.sh` kopiert `public/branding` bereits vollständig. Keine weitere Build-Pipeline dafür bauen, sofern der finale Buildtest die Assets bestätigt.

---

# 13. Fokussierte Regressionstest-Matrix 4A.1

## A – Belegten Jahrestopf löschen

- Plan mit Bedarf 2034 und Produktzuordnung 150.000 € erstellen
- ggf. Umsetzungsplan daran hängen
- letzten Bedarf 2034 löschen

Erwartung:

- Warnung nennt betroffene Zuordnung / Betrag
- nach Bestätigung kein Topf 2034
- keine 150.000 € in `Produkten zugeordnet`
- keine unsichtbare Topfabdeckung
- Produktanteil des entfernten Topfs nicht im Vermögenshaus
- kein verwaister Umsetzungsplan

## B – Mehrere Bedarfe im selben Jahr

- zwei Bedarfe 2034
- Produkt am Topf 2034
- nur einen Bedarf löschen

Erwartung:

- Topf 2034 bleibt
- Produktzuordnung bleibt
- Zielbetrag des Topfs sinkt
- eventuelle Überdeckung sichtbar

## C – Multi-Topf-Allokation

- ein Produkt auf 2034 + strategisch verteilen
- 2034 vollständig entfernen

Erwartung:

- nur 2034-Anteil entfernt
- strategischer Anteil bleibt
- keine automatische Umverteilung

## D – Bereits kaputten Altfall normalisieren

Synthetischen Schema-6-Fall mit `capitalPotAmounts` auf nicht existierendes `year-XXXX` laden.

Erwartung:

- nach Normalisierung keine ungültige ID
- keine Geisterbeträge
- gültige andere Topfanteile bleiben

## E – Bestandsdepot-Modi

Mit bekanntem Depot vier Modi durchtesten.

Erwartung Strukturplanung:

- none: IST ohne Depot, PLAN ohne Depot
- compare: IST volles Depot, PLAN ohne Depot
- retain: IST volles Depot, PLAN nur gewählte Holdings
- afterSales: IST volles Depot, PLAN kompletter Restbestand

## F – CSV ersetzen bei retain

- retain mit ausgewählten Positionen
- neues CSV-Depot mit neuen IDs importieren, einige WKN bleiben identisch, mindestens eine neue WKN

Erwartung:

- identische alte Auswahl soweit eindeutig über WKN wiederhergestellt
- neue Position nicht automatisch ausgewählt
- keine stale IDs

## G – afterSales nach CSV-Ersetzen

Erwartung:

- keine Checkbox-Abhängigkeit
- immer alle aktuellen Holdings nach simulierten Verkäufen

## H – Depotcheck-Entkopplung

Bei unveränderten Verkäufen/Käufen Strukturplan-Modus nacheinander none / compare / retain / afterSales schalten.

Erwartung Depotcheck:

- IST unverändert
- PLAN unverändert

## I – Branding

- Header: beide Logos vollständig
- Fachmodul-Header: kein Platzhalter
- Kundenübersicht/PDF: beide Logos + VermögensNavigator, kein Platzhalter
- Browser-PDF prüfen

## J – Säulendetail

- Säule einmal → offen
- gleiche Säule → geschlossen
- andere Säule → anderes Detail
- Schließen × → geschlossen

---

# 14. Git-/Work-Empfehlung für 4A.1

Empfohlen:

- Modell: GPT-5.6 Sol
- Reasoning: Mittel
- Branch: `work/4a1-bestandsdepot-fixes`
- Zielversion: V0.14.1

## Checkpoint 1 – Datenintegrität / Depotmodi

Nach:

- zentralem Pot-Reconcile
- Normalisierung alter Fälle
- Need-/Topologie-Lifecycle
- Bestandsdepot-Modi
- CSV-ID-Reconciliation
- fokussierten Tests A–H

Commit + Branch-Push.

## Finaler Block – Branding / kleine UX

Danach:

- Header-/Print-/Module-Branding
- Säulendetail-Toggle
- Tabelle unter dem Vermögenshaus
- TypeScript
- Produktionsbuild
- `git diff --check`
- fokussierte Tests I/J plus Smoke der Kernfälle

Nur bei vollständig grünem Stand nach `main` übernehmen und Pages einmal ausführen.

Keine lange vollständige Browser-E2E-Abnahme der gesamten Anwendung. Sichtbare Gesamt-UX-Abnahme erfolgt anschließend im Produkt-Chat.

Bei knappem Nutzungslimit: stabilen Branch-Checkpoint pushen, nicht unvollständig auf `main` mergen.

---

# 15. Hinweise für den finalen Work-Prompt

Der finale Prompt sollte Work ausdrücklich anweisen:

1. nur aktuellen `main`, relevante 4A.1-Sektion der Master-Spezifikation und dieses Preflight lesen
2. keine vollständige Repository-Analyse
3. vorhandene Berechnungsfunktionen wiederverwenden
4. Depotcheck-Entkopplung zuerst regressionstesten statt vorsorglich refactoren
5. `app/globals.css` als Style-Quelle behandeln
6. vorhandene Branding-Pipeline nicht erneut umbauen
7. keine 4B-Funktionen anfangen
8. Checkpoint 1 früh persistent auf GitHub sichern
9. finale sichtbare UX-Abnahme nicht als langes Agenten-E2E ausführen
