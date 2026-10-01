# D1 – Ergebnis- und Export-Sichtenvertrag

Ausgangs-main: `fd524d0d0d5acbbd7893a834ee58ae2c41529d40` (P3, PR #18),
am 01.10.2026 mit `git fetch origin main` bestätigt. Der Ausgangsarbeitsbaum war
sauber, keine offenen PRs. Branch: `work/architecture-d1-view-contract`.

## Verbindliche Sichten

| Sicht | Quelle und Umfang |
|---|---|
| IST | Vollständiges aktuelles Depot plus `advisory.liquidAssets`, unabhängig von aktiver/preferred Variante, Depotmodus, Holdingauswahl, Verkäufen und Käufen |
| PLAN | Aktive Variante: modeabhängiger Bestand plus Neuanlagen plus nicht zugeordnetes Planungskapital als Liquidität |
| ZIELPLAN | Dieselbe Berechnung ausschließlich für die explizit bevorzugte Variante |
| VERGLEICH | IST gegen wahlweise aktive PLAN- oder bevorzugte ZIELPLAN-Struktur; Beträge, Anteile, Differenzen und ungeklärter Anteil beziehen sich auf diese Auswahl |
| Szenarien | Separater Vergleich von Planvarianten; kein Ersatz für den IST-Vergleich des Vermögenshauses |
| Neuanlagen | Ausschließlich `plan.allocations`; bestehende Holdings werden niemals als neue Allokationen erzeugt |

## Depotmodus-Matrix

IST enthält in allen Modi den vollständigen aktuellen Bestand und die aktuelle
Liquidität. Nur der Bestandsanteil von PLAN/ZIELPLAN hängt vom Modus ab:

| `depotMode` | Berücksichtigter Bestand in PLAN/ZIELPLAN |
|---|---|
| `none` | Kein Depotbestand |
| `compare` | Kein Depotbestand |
| `retain` | Ausschließlich `depotHoldingIds`, mit vollständigem aktuellem Wert; Verkäufe reduzieren diese Sicht nicht |
| `afterSales` | Alle Positionen mit `max(0, value - plannedSale)`; Holdingauswahl ohne Wirkung |

In jedem Modus kommen die Neuanlagen und `max(0, plan.total - Summe Neuanlagen)`
als Liquidität hinzu. Verkäufe werden nicht ein zweites Mal als Liquidität addiert.
Die aktuelle Liquidität gehört in IST; PLAN verwendet das Planungskapital des
gewählten Plans. Keine Doppelzählung von Bestand und Neuanlagen.

`unresolved` enthält ungeklärte berücksichtigte Holdings plus ungeklärte Neuanlagen.
Sie werden keiner bekannten Anlageklasse zugeschlagen und bleiben im Nenner.
`total` umfasst bekannte Beträge und `unresolved`. Anteile beziehen sich immer auf
diesen vollständigen Gesamtbetrag, ohne Renormalisierung der bekannten Klassen.

## Gemeinsame reine Projektion

`app/case-model.ts` exportiert `WealthStructureSnapshot` mit `amounts`, `unresolved`
und `total` sowie zwei kleine Funktionen:

- `buildIstWealthStructure(depot, currentLiquidity)` benötigt bewusst keinen `StructurePlan`.
- `buildPlanWealthStructure(depot, plan)` verwendet `planAssetAmounts`,
  `plannerPlanHoldingValue` und den nicht allokierten Planbetrag. PLAN/ZIELPLAN
  unterscheiden sich ausschließlich durch die Auswahl des Plans.

Die Funktionen erzeugen neue Ergebnisse und verändern keine Fälle, Pläne,
Holdings oder Allokationen. `WealthHouse` verwendet diese Projektionen für die
Strukturplanung und das kompakte Ergebnis. Contributor- und Aufteilungsanzeigen
bleiben lokale Darstellungslogik. Die Vergleichsauswahl steuert auch Fundament
und Warnung für ungeklärte Beträge.

`plannerIstHoldingValue` wurde nach Nutzungsprüfung entfernt: Die einzigen
produktiven Nutzungen waren die historische IST-Kopplung in `WealthHouse`; die
beiden alten 4B-Assertions wurden auf die planunabhängige IST-Projektion korrigiert.
Es verbleibt keine Nutzung.

`depotPlanAssetAmounts` bleibt unverändert: Im Depotcheck bedeutet PLAN vollständiger
Restbestand nach Verkäufen plus Käufe, unabhängig vom Strukturplanmodus und ohne
unallokiertes Planungskapital. Diese physische Depotprojektion ist ein eigener
Fachkontext. Auch das Depot-Vermögenshaus verwendet weiterhin diese Sicht.

## Ergebnis, Excel und Druck

Die allgemeine Vermögensstruktur entspricht dem vollständigen ZIELPLAN:
Vermögenshaus, kompaktes Ergebnis, Excel-Blatt `Vermögensstruktur` und gemeinsamer
Kunden-/interner Druckabschnitt `Vermögensstruktur der bevorzugten Planung`
verwenden denselben Rechenkern. Jede Anlageklasse, `Nicht durchgeschaut` und jeder
Prozentnenner berücksichtigen den gesamten Zielplan.

Planbezogene Produktblätter, Lösungsbausteine und Umsetzungsübersicht bleiben
Neuanlagen-/Umsetzungsinformation. D1 erzeugt keine Produkte aus Bestandspositionen
und verändert keine Allokationen oder Einstiegspläne.

Ohne preferred gibt es keinen ZIELPLAN und keine Zielstruktur im Export. Die drei
Zielausgabebuttons bleiben gemäß P3 deaktiviert, das Druckdokument entfällt und der
Hinweis bleibt sichtbar. Kein Fallback auf Active; IST und PLAN bleiben nutzbar.

## Synthetische Beispiele

- Retain: A 10.000 EUR, B 6.000 EUR; Auswahl nur A, Planung 5.000 EUR,
  Neuanlage 3.000 EUR ⇒ Ziel 15.000 EUR einschließlich 2.000 EUR Liquidität.
- After-Sales: A 10.000 / Verkauf 2.500 EUR, B 6.000 / Verkauf 6.000 EUR,
  C 4.000 / Verkauf 0 EUR ⇒ Rest 11.500 EUR plus Neuanlagen und Planliquidität.
  IST bleibt 20.000 EUR Depot plus aktuelle Liquidität.
- Planung 100.000 EUR / Neuanlage 80.000 EUR ⇒ 20.000 EUR Planliquidität,
  auch in Excel und Druck.
- CP0A2 `multiCase`: preferred retain nur A, keine Neuanlagen, Planung 0 EUR
  ⇒ ZIELPLAN und allgemeiner Export exakt 10.000 EUR, weder 0 noch 11.500 EUR.

## Nachweise und Grenzen

`scripts/verify-d1-view-contract.tsx` prüft synthetisch alle vier Modi, unverändertes
IST, gemeinsame PLAN/ZIELPLAN-Berechnung, unterschiedliche Active/preferred,
ungeklärte Bestands- und Kaufanteile, Liquiditätsrest, Überallokation, leere
Struktur, echte XLSX-Dateien mit allen Beträgen/Anteilen, tatsächlichen Druckabschnitt,
kompaktes Ergebnis, getrennte Produktinformation, fehlende Präferenz und eingefrorene
unveränderte Inputs. Der aktualisierte Asset-Classification-Test behält seine
CSV-/Klassifikationsabdeckung und prüft jetzt die vollständige Zielstruktur.

CP0B bleibt bei genau drei Lebenszyklen. Benannte D1-Schritte A–D im bestehenden
Planungsflow prüfen IST trotz `none` inklusive Contributors, aktive PLAN-Variante,
abweichende preferred-Zielvariante und Vergleichsauswahl sowie echten Excel-Download
und Druckwerte gegen zuvor erfasste ZIELPLAN-Anzeige. Keine kopierte Projektionsformel.

`general-export-scope` wechselt ausschließlich D → A. Alle anderen CP0A2-Referenzen
bleiben unverändert: **23 A / 0 B / 0 C / 0 D**. Es gibt keine offene CP0A2-Fachfrage.
D1 folgt im sequenziellen Fail-Fast-Gate nach P3, vor Typecheck, einem Produktionsbuild
und den drei CP0B-Abläufen. `npm test` delegiert vollständig an `verify`.

Schema **11**, persistierte Felder, Identitäten, Snapshots, Storage-Key und Migrationen
bleiben unverändert. Produktionsänderungen betreffen nur `case-model.ts` und
`page.tsx`. Keine Monolithzerlegung, neue Abhängigkeit, Release-/CI-Workflowänderung,
GitHub-Einstellungsänderung, Veröffentlichung oder Merge. Der historische
Releaseprozess bleibt unverändert. Vollständige lokale Abnahme und tatsächliche
Push-/PR-Joblogs werden in der offenen PR und im Abschlussbericht dokumentiert.
