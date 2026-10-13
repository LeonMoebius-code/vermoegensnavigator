# H4 – Sichere Ratenanzahl gestaffelter Einstiege

Stand: 13.10.2026. Technischer Hardeningvertrag; keine neue Investmentplanarchitektur.

## Ausgangsstand und Reproduktion

- BASE_SHA: `bde76ce23e54486e021ab3d72b555e54fb8ee6f7`
- BASE_TREE: `ac04f8c14849c82563e34ed7ad289dc0f77a8384`
- Branch: `work/hardening-h4-safe-installment-count`
- H1/H2/H3 waren über PR #34/#35/#36 integriert; Ausgangsprüfung: keine offenen PRs.
- Der vorherige saubere H3-Arbeitsbaum blieb unverändert. H4 verwendet einen eigenen Git-Arbeitsbaum.

F-007 wurde vor der Änderung mit einem synthetischen, vollständig zugeordneten
Schema-11-Fall unabhängig reproduziert. `installments: 4294967296` durchlief
JSON.parse → normalizeImportedCase → Insert → Store → Reload als gesunder Fall.
Der tatsächliche `phasedEntryAmounts()`-Aufruf warf `RangeError: Invalid array length`;
`phasedEntryLastDate()` lieferte `NaN-NaN-NaN`.

Weitere direkte Ausgangsbeobachtungen: Infinity warf dieselbe RangeError; 1.5 wurde
zu einer Rate abgeschnitten, der Runtime-String "12" zu zwölf Raten konvertiert.
0, -1, null und NaN ergaben bereits ungültige leere Ratenlisten. Der bisherige
UI-Parser deutete "1.5" zu 15 und "1.200" zu 1200 um. 1201, MAX_SAFE_INTEGER und
1e100 wurden vom Import akzeptiert; ihre übergroßen Arrays wurden ausdrücklich
nicht aufgebaut. Der Ressourcenverbrauch dieser Werte ist ein statisch erkannter
Risikoaspekt, kein behaupteter Belastungstest.

## Zentraler Vertrag

`app/domain/planning/installment-validation.ts` definiert genau einmal
`MAX_PHASED_INSTALLMENTS = 1200` und die unknown-Prüfung `validPhasedInstallments`.
Aktuelle Werte müssen echte sichere JavaScript-Integer zwischen 1 und 1200 sein.
Keine Stringkonvertierung, Abschneidung, Kappung oder Reparatur aktueller Werte.
Die Grenze beschränkt Ressourcen; sie ist keine Aussage über sinnvolle Laufzeiten.
Kapitaltopftermine und Rhythmusregeln bleiben zusätzlich maßgeblich.

Die gezielte Prüfung der 4B-Spezifikation, Master-Spezifikation und vorhandenen
Regressionen fand keinen ausdrücklich gültigen Phased-Entry-Vertrag oberhalb
1200. Die alte Sparplan-Metadatenzahl 10000000 ist davon unabhängig.

## Domain, Termine und Graph

- `phasedEntryAmounts`: frühe Prüfung vor jeder Ratenallokation; bei ungültiger Zahl
  `invalid: true`, leere Ratenliste und neutralisierte Betrags-/Ratenkennzahlen.
- `phasedEntryLastDate`: null bei ungültiger Zahl; Schedulevalidation damit ungültig.
- `defaultPhasedEntryInstallments`: ungültige externe Präferenzen verwenden den
  normalen Vorschlag 12; höchstens 1200 Schleifenschritte bei gültiger Präferenz.
  Das ist Vorschlagslogik und keine Umdeutung eines bestehenden Einstiegswerts.
- `reconcilePlanCapitalPots`: verwendet dieselbe Regel für überlebende Einstiege.
  Import-/Speicherprüfungen greifen vorher, damit beschädigte Originale nicht
  durch Reconciliation still verschwinden.
- `validCurrentPlanGraph`: prüft die Ratenzahl auch bei Plananhängen/Kopien.
  Kopieren legitimiert keine beschädigte Ratenzahl.

Rundung und Termine gültiger Werte bleiben unverändert: 100 EUR / 3 =
33,33 / 33,33 / 33,34. Bei 1200 Raten ergeben sich 1199 × 0,08 und zuletzt 4,08 EUR.
Euro-/Prozentmodus, Sofortanteile, die bestehende Null-Entwurfssemantik,
Monatsende, Schaltjahr und alle vier Rhythmen bleiben erhalten.

## React-Eingabe

Der kontrollierte Entwurf bleibt erhalten. Das Ratenfeld ist ein Textinput mit
numeric inputMode, Ziffernpattern und gemeinsamem max-Wert. Die Textdarstellung
verhindert Browserkonvertierungen wissenschaftlicher Notation; die tatsächliche
Obergrenze wird im Parser durchgesetzt, unabhängig von HTML-Attributen.

Nur ungruppierte Dezimalziffern werden akzeptiert (äußere Leerzeichen dürfen
getrimmt werden). Punkt, Komma, innere Leerzeichen, Vorzeichen, Dezimalwerte und
wissenschaftliche Notation sind ungültig. Ungültige/geleerte Entwürfe verändern
keinen Modellwert und bleiben auch bei Blur/Enter sichtbar. Eine verknüpfte
aria-Fehlermeldung nennt 1 bis 1200 und den letzten gültigen Wert. Gültige Entwürfe
aktualisieren sofort das Modell und werden bei Blur abgeschlossen.

Entwurfsschlüssel enthalten Fall-, Plan-, Allokations- und Kapitaltopf-ID.
Der Wechsel des Umsetzungsmodus verwirft den zugehörigen Entwurf. Andere
Produkt-/Topf-/Planentwürfe werden nicht übernommen. Die bestehende Anzeige von
Eurobeträgen auf ganze Euro bleibt erhalten; Centwerte werden in Domain und
produktivem Excel-Export geprüft.

## Import, Store und historische Verträge

Die bestehende H2-Vertrauensgrenze prüft nun zusätzlich Phased-Entry-Ratenzahlen.
Schema 10/11: unveränderte Runtime-Eingänge → Finanz-/Ratenprüfung → Graph →
Clone/Normalisierung → abschließende Finanz-/Graphprüfung. Save, Insert und Write
prüfen vor Depotwertableitung, Serialisierung und Recoverybackup-Schreiboperationen.
Ungültige Mutationen verändern weder Hauptstore noch vorhandene Backups.

Schema 0–9: der vorhandene Default 1 für fehlende/undefined Ratenfelder bleibt.
Bereits historisch konvertierte, nichtleere numerische Strings dürfen weiterhin
zu gültigen Integern 1..1200 werden. Explizite 0, negative/gebrochene/übergroße,
null, Boolean, Array/Objekt oder nichtendliche Werte werden kontrolliert abgelehnt;
es gibt keine neue automatische Reparatur. Schema 0–7 verwendet weiter
`installmentAmount × installments`, Schema 8/9 den bereits vorhandenen Einstieg.
Alte Sparplanfelder `installments` werden weiter unabhängig vom Wert entfernt.

Historische `versions[].snapshot` bleiben opak und unverändert. Erst ein Restore
prüft sie als Arbeitsstand. Der produktive H3-Handler lehnt beschädigte Raten
kontrolliert ab; State, Hauptstore, Backups und Historie bleiben unverändert.
Gesunde Snapshots bleiben wiederherstellbar.

P1 erhält beschädigte aktuelle Fälle als Originale, gesunde Nachbarn und
Identitätsschutz. Das vollständige Backup enthält die originalen Storebytes;
unvollständige Vorbackups genügen nicht, vollständige Backups werden wiederverwendet.
Same-Case-Last-Write-Wins bleibt unverändert, ohne neue Cross-Tab-Garantie.

## Dauerhafte Regressionen und Gates

`test:h4-installment-safety` ist genau einmal vor Typecheck in `npm run verify`
eingebunden. 13 Testgruppen prüfen 38 aktuelle Schemaablehnungen und 170
Legacyablehnungen, zentrale Matrix, echte Domain-Aufrufe, 1200er-Rundung,
Termine, Parser, Store, P1, P4 und tatsächliche produktive H3-Restorehandler.

CP0B bleibt bei drei Lebenszyklen, einem Worker, null Retries und unveränderter
Chromium-Konfiguration. Der zusätzliche H4-Schritt im Planungslebenszyklus prüft
produktive React-Eingaben 12/1200/1201/4294967296, Löschen/Ersetzen,
Trennzeichen/Brüche/negative Werte/wissenschaftliche Notation, echte Zwischenablage,
Tab/Enter/Blur, Wechsel zwischen Produkten/Töpfen/Planvarianten, bad/good Restore,
Schema-10/11-JSON-Ablehnung mit unverändertem aktivem Fall und Storebytes,
anschließendes Speichern/Reload sowie tatsächlich heruntergeladene Excel-Centwerte.
Es werden keine pageerrors toleriert und keine alten Assertions entfernt.

Kanonisches Gate: alle vorhandenen Fach-/Identitäts-/Hardeningprüfungen,
CP0A2 23/0/0/0, Typecheck, genau ein Produktionsbuild, anschließend CP0B 3/3.
Separat auf demselben unveränderten Artefakt: Artefaktvalidator und R1 55/55 ohne
Skips sowie git diff --check. Finale lokale und Push-/PR-CI-Identitäten werden
im externen H4-Abschlussbericht und der PR-Beschreibung dokumentiert.

Keine Dependency-, Schema-, Releaseversions-, Workflow-, Sicherheitsflag- oder
Produktarchitekturänderung. Kein Merge, Release, Rollback oder Deployment.
