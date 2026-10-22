# F-017 – Produktbezogene Risikoprüfung

Ausgangs-main `6dbe4d67536f917b6a0721c7e6361f14dd6ec221`, Tree
`4acefc59882559d03c821368a60d34c5d5878cd0`. Version 0.18.3 / Schema 11 unverändert.
F-020 und F-021 sind integriert und bleiben unabhängig wirksam.

`allocationProductRisk` vergleicht für jede aktuelle Allokation die aktuelle
Katalogrisikoklasse mit ausschließlich `advisory.risk`. Quelle und Produkt-ID
bestimmen den Katalog: product → Hausprodukte, vv → Vermögensverwaltungen,
model → die tatsächlichen enthaltenen Produkt-/VV-Bausteine. Modell-RK,
Anzeigenamen, recommendedRisk, lossCapacity und riskSelectionSource ersetzen
keinen dieser Werte. Fehlende, mehrdeutige oder ungültige Katalogwerte führen
zum separaten Zustand „nicht bestimmbar“, niemals zu einer erfundenen RK 1.

Die reine Projektion speichert keine Felder, ändert keine Allokation und keine
Risikostufe. Jede Render-/Exportausführung berechnet neu. Produktrisiko über
Kundenstufe ergibt einen Hinweis mit Name und beiden Werten; Gleichheit oder
niedrigere RK sind allein für diesen Vergleich unauffällig. Keine
Geeignetheitsfreigabe, Bestätigungspflicht oder technische Sperre. Ein Betrag
von null wird ausdrücklich als Vorschau ohne Kaufbetrag bezeichnet.

Der Planner zeigt den Hinweis in der konkreten Allokationskarte und zusätzlich
planweit für alle Töpfe. Kompaktes Ergebnis und Exportübersicht zeigen die
Planvarianten getrennt. Beide Druckmodi zeigen die Prüfung ausschließlich für
den tatsächlich bevorzugten Plan; vorhandene interne Zusatzinformationen
bleiben intern. Mindesthorizont, Kenntnisse und Topfzuordnung sind separate
Kriterien; der bisherige Horizonthinweis bleibt unverändert.

Excel erhält das zusätzliche Blatt `Produktrisikoprüfung` für sämtliche
Allokationen aller Pläne: Plan/ID/Präferenz, Zuordnungs-ID, Produkt/ID,
Quelle/Modell, Topfbeträge, Kaufbetrag/Vorschaustatus, Kundenstufe,
Produktrisikoklasse, Vergleichsergebnis und begrenzter Prüfumfang. Bestehende
Blätter, Spalten und D1-Berechnungen bleiben unverändert. Warnungen verhindern
weder JSON noch XLSX noch Druck. F-020 behält seine eigenen Ausgabesperren.

`test:f017-product-risk` ist im regulären Verify registriert. Es prüft den
vollständigen echten Produktkatalog gegen alle fünf Kundenstufen, alle VV und
Modellbausteine, unbekannte/mehrdeutige Werte, Quellen, dynamische Neuberechnung,
Unveränderlichkeit, echte React-Ausgaben und einen echten XLSX-Export.

Die dauerhaften Browsertests übersetzen die sieben F-017-Fälle und die
Zwei-Topf-Assertion aus AUDIT ONLY PR #43 einschließlich der sechs ehemals roten
Assertions. Ergänzt sind alle Auswahlquellen, tatsächlich erfasste Kaufbeträge,
Profilwechsel nach Save/Reload, RK3-Filtererweiterung, entfernte Allokationen,
Modellbausteine, abweichende Pläne/Präferenz, Nullbeträge, unbekannte IDs,
separate Horizontkonflikte und echter H3-Restore bei unverändertem Snapshot.
Die echten Downloadbytes werden mit SHA-256 im unveränderten CI-Log gesichert;
Zellen sowie beide über echte Buttons ausgelösten Druckmodi werden geprüft.
Keine behauptete OS-PDF-Speicherung. Ausgewählte synthetische Planner-/Ergebnis-
und Druckbilder werden als Nachweis ebenfalls im Joblog gesichert.

Lokal fehlt das reguläre Playwright-Chromium 1243. Vollständige Push-/PR-CI auf
tatsächlichem Feature-Commit und synthetischem Merge ist gemäß Auftrag der
maßgebliche Browsernachweis. Tatsächliche Zahlen und Identitäten stehen im
separaten Abschlussbericht. Keine Skips, Umgehungen oder Workflowänderungen.
Diagnose-PR #43 bleibt unverändert offen und darf niemals gemergt werden.
Kein Merge, Release oder Deployment; zwei organisatorisch unabhängige Abnahmen
stehen nach Bereitstellung aus.
