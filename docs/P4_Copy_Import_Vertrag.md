# P4 – verbindlicher Copy-/Import-Vertrag

## Zweck und Ausgangsbasis

Dieser Vertrag fixiert die fachlich entschiedene Identitäts- und Referenzsemantik
als Sicherheitsbaseline für spätere Refactorings. Ausgangs-main nach R2:
`5cbc1f50eee3b71691dde25a562c0267f0170d8d`, am 30.09.2026 durch `git fetch origin`
bestätigt; keine Änderungen seit dem im Auftrag genannten main. Sauberer Ausgangsbaum
auf `work/operations-r2-root-cleanup`, keine offenen PRs. Arbeitsbranch:
`work/architecture-p4-copy-contract`. Produktionscode und Schema **11** bleiben unverändert.

## Identitätsräume und Operationen

Identitäten werden nur regeneriert, wenn ein neues Objekt im selben Identitätsraum
entsteht. Fallinterne IDs dürfen zwischen unabhängigen Fällen identisch sein.
Plan-Kopien koexistieren dagegen innerhalb desselben Falls; ihre Plan-, Allocation-
und InvestmentPlan-IDs müssen auch über mehrere Varianten hinweg eindeutig sein.

Die folgenden Erhaltungsregeln beziehen sich auf vorhandene gültige IDs und Referenzen
eines aktuellen Schema-11-Falls. Historische Migrationen bleiben separat bestehen.

| Operation / produktiver Pfad | Aktuelle äußere Fall-ID | Plan-ID | Allocation-ID | InvestmentPlan-ID | Caseweite IDs / Referenzen | Historie |
| --- | --- | --- | --- | --- | --- | --- |
| Laden: `readCaseStore` → `normalizeImportedCase(value, false)` | Erhalten; kein neuer Fall | Erhalten | Erhalten | Erhalten | Erhalten | Erhalten, Snapshots unverändert |
| Vollständiger JSON-Sicherungsimport: `importJson` → `normalizeImportedCase(value)` | Neu; unabhängiger neuer Fall | Erhalten | Erhalten | Erhalten | Erhalten im neuen Fall-Namespace | Gesamte Historie einschließlich Versions-IDs und Snapshotinhalten kopiert |
| Versions-Restore: `ExportCenter.restoreVersion` | Aktuelle ID des Ziel-Falls erhalten, auch bei einer importierten Kopie | Aus kontrolliert normalisiertem Snapshot | Aus kontrolliert normalisiertem Snapshot | Aus kontrolliert normalisiertem Snapshot | Historischer Inhalt wird für den aktuellen Zustand normalisiert | Gesamte aktuelle Historie erhalten; gespeicherte Snapshots unverändert |
| Planvariante kopieren: `duplicateStructurePlan`, UI `duplicatePlan` | Umgebender Fall unverändert | Neu | Alle neu | Alle neu, sowohl `phased` als auch `savings` | Bestehende caseweite Referenzen erhalten | Fallhistorie unverändert; keine neue Version durch Kopieren |

### Vollständiger Fallimport

Ein gültiger vollständiger Import ist eine unabhängige Kopie des gesamten Beratungsfalls.
Nur `AdvisoryCase.id` wird wegen dieses Kopierens neu erzeugt. Original und Import
können gleichzeitig gespeichert und unabhängig bearbeitet werden. Der Import ist
weder Restore noch Überschreiben, Merge oder Deep-Rekeying.

Erhalten bleiben `DepotAccount.id`, `DepotHolding.id`, `StructurePlan.id`,
`PlannerAllocation.id`, sämtliche `InvestmentPlan.id`, `SavingsGoal.id`,
`CustomerChecklistItem.id`, `CaseVersion.id` und die numerischen `Need.id` aus
`advisory.needs`. Das tatsächliche Modell enthält daneben Katalogreferenzen und
Schlüssel, keine weiteren eigenständigen persistierten Entity-IDs:
`advisorId`, Produkt-/Modell-/Solution-IDs, `selectedVvIds`, Modul-IDs
(`advisory.modules`, `moduleStates`-Schlüssel, `CustomerChecklistItem.moduleId`)
und Modul-/Checklistenpositionen bleiben in ihrem bestehenden Bezugsraum.
Bond-Profil-IDs sind Provenienz, keine zu regenerierenden Fallidentitäten.

Alle gültigen Beziehungen bleiben innerhalb des importierten Graphen erhalten:

- `DepotHolding.depotId` → `DepotAccount.id` und `StructurePlan.depotHoldingIds` → `DepotHolding.id`.
- `activePlanId` → `StructurePlan.id`.
- `PhasedEntryPlan.allocationId` → Allocation desselben Plans, zusammen mit `capitalPotId`.
- `SavingsPlan.targetRef` → caseweites `SavingsGoal.id` oder numerische `Need.id`.
- Produkt-, Modell-, Solution-, VV- und Modulreferenzen bleiben erhalten.

Kapitaltöpfe sind aus Advisory-Daten, Betrag und Referenzdatum abgeleitet;
`reserve`, `strategic` und `year-<Jahr>` sind semantische Topfschlüssel.
Persistierte `capitalPotId` und Schlüssel in `capitalPotAmounts`/`bucketAmounts`
werden bei gültigen Zuordnungen durch Kopieren nicht rekeyt.

### Historische Snapshots und zulässige Normalisierung

`CaseVersion` und `CaseSnapshot = Omit<AdvisoryCase, "versions">` gehören zur
vollständigen Sicherung. Versions-IDs, Reihenfolge, Metadaten und vollständige
Snapshotinhalte bleiben erhalten. Eine historische `snapshot.id` darf die damalige
Fall-ID enthalten und wird nicht auf die neue aktuelle Import-ID umgeschrieben.
Historie bleibt Historie des kopierten Ausgangsfalls; erst beim tatsächlichen Restore
wird eine Arbeitskopie des Snapshots kontrolliert normalisiert.

Der aktuelle Import muss nicht byteidentisch zur aktuellen Quellwurzel sein:
neue äußere ID, aktuelles `updatedAt`, bestehende Schema-/Migrations- und
Kompatibilitätsnormalisierung sowie abgeleiteter Depotwert bleiben zulässig.
`createdAt` bleibt beim gültigen aktuellen Fall erhalten. P4 definiert diese
Normalisierungen nicht neu und verlangt keine zusätzliche innere Rekeying-Operation.
Quelle, eingebettete Arrays/Objekte und historische Snapshots dürfen nicht mutiert
werden. Bearbeitbare Importdaten dürfen keine Objekt-Aliase zur Quelle besitzen.

### Plan-Kopie

`duplicateStructurePlan` erzeugt eine neue Plan-ID, neue IDs aller Allocations
und aller InvestmentPlans. Jeder kopierte `PhasedEntryPlan` referenziert über eine
alte-ID → neue-ID-Zuordnung exakt die entsprechende kopierte Allocation.
Caseweite Depot-Holding- und Sparziel-/Bedarfsreferenzen sowie Katalog- und
Kapitaltopfreferenzen bleiben erhalten. Die gesamte übrige Planstruktur wird
unabhängig kopiert, einschließlich verschachtelter Betragsmaps und Zielreferenzobjekte.
Quellplan, IDs, Referenzen und `preferred` bleiben unverändert; Mutationen an einer
Kopie dürfen Quelle oder Geschwisterkopien nicht ändern.

`nextPlanCopyName` liefert `– Kopie`, dann `– Kopie 2`, `– Kopie 3` usw.
Die bestehende UI reconciliiert die Kopie mit denselben Advisory-Daten/Sparzielen,
hängt sie an `plans` an und setzt `activePlanId` auf die Kopie.

## Aktiv, bevorzugt, Restore und Laden

`activePlanId` bezeichnet die aktuell bearbeitete Variante, `preferred` die fachlich
bevorzugte Zielvariante. Plan B darf aktiv sein, während Plan A bevorzugt bleibt.
Die Kopie hat stets `preferred=false`; weder Quelle noch andere Pläne werden allein
durch Kopieren bevorzugt oder entpräferiert. Ein gültiger Entwurf darf keinen
bevorzugten Plan besitzen. Import erhält auch diesen Zustand und verwendet
`activePlanId` nicht als bevorzugte Ersatzwahl. Bestehende Fallbacks bei der Darstellung
ändern den persistierten `preferred`-Zustand nicht; Reporting ist kein P4-Thema.

Restore erhält ausdrücklich die aktuelle Ziel-Fall-ID (`id: item.id`), die gesamte
aktuelle Historie und aktualisiert `updatedAt`. In einer JSON-Kopie gilt daher
`restored.id === imported.id` und `restored.id !== original.id`, unabhängig von
`snapshot.id`. Normales Laden mit `regenerateId=false` erzeugt keinen neuen Fall.
Diese vier Operationen dürfen bei Refactorings nicht semantisch vereinheitlicht werden.

## Ausführbare Absicherung und Grenzen

`npm run test:p4-copy-contract` führt
[`verify-p4-copy-contract.ts`](../scripts/verify-p4-copy-contract.ts) aus:
explizite synthetische IDs, zwei Depots/Pläne/Versionen, zwei Allocations und
Einstiegspläne, beide Sparzielreferenzarten, bekannte innere Identitäten,
gleichzeitiges Speichern/Laden, mehrere Plankopien, vollständige Objekt-Aliasprüfung
und echte Mutationsgegenproben. Zeitstempel werden nur im Operationszeitfenster,
generierte IDs nur auf Ungleichheit, Eindeutigkeit und Mappingrelationen geprüft.
Keine Sleeps oder erwarteten konkreten Zufalls-IDs.

Der Test läuft einmal an Position 12 in `npm run verify`, nach `test:cp0a2`
und vor `test:p1-case-store`, `test:p2-depot-integrity`, `test:p3-plan-integrity` und `typecheck`. Das Gate bleibt sequenziell und Fail-Fast; danach folgen
genau ein Produktionsbuild und die genau drei CP0B-Lebenszyklen. Der neue Test
ist auch im Typecheck enthalten und importiert keine andere Verify-Suite.
CP0B prüft zusätzlich im bestehenden Planungsflow den echten Duplizieren-Button:
Kopie aktiv, Quelle weiterhin bevorzugt/unverändert, Kopie nicht bevorzugt.
Die tatsächlichen Restore-Handler bleiben durch CP0A2 `restore-id` und CP0B geprüft.

Nur CP0A2 `import-copy` wird durch P4 von B nach A überführt:
**18 A / 1 B / 3 C / 1 D → 19 A / 0 B / 3 C / 1 D**.

Nicht-Ziele: Produktumbau, neue UI, Schema-/ID-Migration, UUIDs, vollständige
Planintegritätslogik, Architekturmodernisierung, Reporting oder Betriebsänderungen.
[P1](P1_Sichere_Fallpersistenz.md) behebt inzwischen `stale-local-list` durch
operationsbasierte Save-/Insert-/Delete-Persistenz; nur dieser Befund wechselt C → A.
Historisch nach [P2](P2_Depotreferenzintegritaet.md): **21 A / 0 B / 1 C / 1 D**.
Nur `invalid-depot-fallback` wechselt zusätzlich C → A: Ungültige aktuelle
Depotzuordnungen werden beim Import/Restore abgelehnt, gültige Importidentitäten
und historische Snapshots bleiben erhalten. Aktuell nach [P3](P3_Planintegritaet.md):
**22 A / 0 B / 0 C / 1 D**. `weak-plan-integrity` ist A; aktuelle ungültige
Plangraphen werden abgelehnt, ohne innere Import-IDs oder historische Snapshots
zu rekeyen. Die Aliasgegenprobe bestätigt nun Ablehnung ihrer absichtlichen
Korruption, bevor ausschließlich die Testkopie für den Save-Nachweis berichtigt wird.
`general-export-scope` bleibt D und benötigt eine separate fachliche Entscheidung.
Kein Release, Rollback, Deployment oder Änderung von GitHub-Einstellungen.

Bei einem echten Produktionsbruch dieses Vertrags: reproduzierbaren synthetischen
Fall sichern, Abweichung dokumentieren und P4 stoppen. Weder Vertrag abschwächen
noch einen stillen Produktfix einbauen.
