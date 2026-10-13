# H2 – finanzielle Import- und Runtimevalidierung

## Ausgangsstand und unabhängig ausgeführte Reproduktion

BASE_SHA: `c629705021dab729b2227ca29031bd0bbdd3ffce`
BASE_TREE: `6f9bf7def59537e5c1befd3350e967908c271ed8`
Branch: `work/hardening-h2-financial-data-validation`

GitHub-main und PR #34 wurden unabhängig geprüft; H1 ist integriert, keine offenen
PRs zum Arbeitsbeginn. Der separate H2-Arbeitsbaum war sauber; frühere lokale
Feature-Arbeitsstände bleiben erhalten.

Vor der Korrektur mit ausschließlich synthetischen Daten ausgeführt:
`JSON.parse → normalizeImportedCase → insertCaseIntoStore → readCaseStore → Rechnung`.

- Astra F-005: 100.000 EUR Planvolumen, 5.000 EUR Reserve und Stringbedarfe
  `"10000"`/`"20000"` werden akzeptiert. Bedarfstopf `"01000020000"`, strategisches
  Kapital 0, Fehlbedarf 500000999920000. Numerischer Sollfall: 30.000/65.000/0 EUR.
- Audit 06 / F-006: zwei gültig identifizierte Allokationen mit Stringbeträgen
  `"1000"`/`"2000"` und gleichlautenden `strategic`-Mappingwerten werden akzeptiert.
  `planAssetAmounts.total` und `unresolved` ergeben `"010002000"`; die gemeinsame
  PLAN-Projektion ergibt als Gesamtwert `"00100020000"`. Die explizit numerisch
  konvertierende Topfabdeckung verarbeitet dieselben Zuordnungen anders.
  Damit ist der zuvor statische Audit-06-Befund eigenständig ausgeführt bestätigt.
- Direkte Runtime-Sparziele mit NaN/±Infinity werden vor H2 durch Clone und
  Normalisierung zu 0; Insert speichert den Originalwert dabei als JSON-null.

## Feldinventur und Semantik (vor Implementierung festgelegt)

Ein Geldbetrag ist eine echte endliche JavaScript-Zahl >= 0. Nullwerte bleiben
zulässig; `null`, Strings, Boolean, Array, Objekt, fehlende Pflichtwerte und
nichtendliche Zahlen sind ungültig. Keine neue Cent-Rundung oder globale Grenze.

| Eingangsbereich | Felder | Vertrag |
|---|---|---|
| Beratung | liquidAssets, depotValue, otherAssets, reserve | Pflichtzahlen; depotValue auch vor Ableitung aus physischen Holdings prüfen |
| Bedarfe | needs[].amount | Pflichtzahl; Collection und verwendete Elemente müssen strukturell lesbar sein |
| Pläne | total | Pflichtzahl; Unter-/Überplanung erlaubt |
| Modell | modelAmount | Optional, wenn vorhanden endliche nichtnegative Zahl |
| Allokation | amount | Pflichtzahl; keine Gleichheit mit Planvolumen oder Zuordnungssumme erzwingen |
| Zuordnungen | capitalPotAmounts, bucketAmounts | Optionales Objekt, keine Arrays/null; sämtliche vorhandenen Werte gültige Beträge; unvollständige/leer bleibende Zuordnung erlaubt |
| Review | capitalPotReviewAmount | Optionaler nichtnegativer Betrag; vorhandene Legacy-Reviewmigration erhalten |
| Sparpläne | contributionAmount | Pflichtzahl in Schema 10/11 |
| Gestaffelt | stagedValue | Pflichtzahl; percent zusätzlich <= 100, bestehende Null-/Entwurfssemantik erhalten; Ratenobergrenze bleibt H4 |
| Sparziele | targetAmount | Pflichtzahl in Schema 10/11; minimale Elementvorprüfung, keine H3-Restore-/Historienneugestaltung |
| VV | vvFilters.amount | Vorhandener Betrag prüfen; bestehender Default bei fehlendem Filter/amount bleibt zulässig |
| Physisches Depot | value | Bestehende verpflichtende positive Marktwertprüfung vor Clone; endliche Gesamtsumme |
| Verkäufe | plannedSale | Pflichtzahl in Schema 10/11; bestehende Begrenzung auf Holdingwert bleibt erhalten |

Optionale Bond-, Depot-, Risiko- und UI-Metadaten werden nicht allgemein
vollvalidiert. Insbesondere bleiben negative gainLossAmount/gainLossPercent
zulässig und die vorhandene optionale Depotvalidierung maßgeblich.

## Legacy-Abgrenzung

Schema 10/11: Prüfung des unveränderten Eingangs vor Graphrechnung und Clone.
Keine implizite aktuelle Betragskonvertierung.

Schema 0–9: Die allgemeinen Beratung-/Plan-/Allokationsbeträge müssen ebenfalls
numerisch gültig sein; für diese gab es keine ausdrücklich durchgängige
Betragsmigration. Bestehende Bucketkonvertierung, Sparraten-/Einstiegskonvertierung,
Sparzielnormalisierung und Verkaufsnormalisierung bleiben separat erhalten.
Nur dort dürfen nichtleere, endlich und nichtnegativ interpretierbare numerische
Legacy-Strings migrieren. Bestehende ausdrücklich ergänzte Defaults bei fehlenden
Legacy-Feldern bleiben bestehen; vorhandene negative, nichtendliche, nullartige
oder strukturell falsche Beträge werden nicht repariert. capitalPotAmounts werden
nicht als allgemeine Stringmigration behandelt: ihr bestehender Migrationspfad
konnte unveränderte Werte behalten. Nach Migration muss der aktuelle finanzielle
Arbeitsstand vor seiner abschließenden Graphprüfung gültig sein.

Keine Schemaänderung, pauschale Persistenzmigration oder Snapshotrekursion.
Beim tatsächlichen Normalisieren eines Snapshots greift dieselbe Eingangsprüfung.

## Vertrauensgrenzen und Recovery

Finanzprüfung vor `validCurrentPlanGraph`, `clone` und Depotwertableitung in
`normalizeImportedCase`. Speichermutationen prüfen die direkten Runtime-Kandidaten
zusätzlich vor `enforceCaseDepotValue`; die bestehende Normalisierung/Graphprüfung
und P1-Recovery laufen danach weiter.

Beschädigte gespeicherte Fälle werden durch den bestehenden P1-Leser geschützt;
gesunde Nachbarn bleiben verfügbar. Hauptstore und Backups werden bei ungültigen
Mutationen nicht verändert. Originale, Backupwiederverwendung, doppelte IDs,
Same-Case-Last-Write-Wins sowie P2/P3/P4/D1 bleiben die bestehenden Verträge.

## Dauerhafte Nachweise

Die H2-Suite wird einmalig vor Typecheck/Build/CP0B in `npm run verify` integriert.
Ein zusätzlicher H2-Step im bestehenden Planungslebenszyklus prüft echte
String-Importablehnung, Originalstore/-fall/-export und korrekte Finanzkennzahlen.
Der bestehende gültige JSON-Import samt Save/Reload bleibt erhalten. CP0B bleibt
bei drei unabhängigen Lebenszyklen, einem Worker und null Retries.
R1 und Artefaktprüfung bleiben getrennte nachgelagerte Gates.

## Lokaler Abnahmestand

- H2: 16 Gruppen, 476 ausdrückliche Schema-10-/11-Ablehnungsfälle; zusätzliche
  Save/Insert/Write-Matrix einschließlich unveränderter Hauptstore-/Backupdaten.
- Gültige Integer-/Cent-/höhere-Präzisions-/Nullfälle; negative G/V-Felder erhalten.
- P1: geschützte Finanzoriginale, vollständiges Originalbackup und Wiederverwendung,
  unvollständiges Vorbackup, Backupfehler, fehlgeschlagene Rückleseprüfung und
  Hauptstore-Schreibfehler mit erhaltenem Hauptstore.
- Legacy 0–9, ausdrückliche Stringkonversionen, fehlende Legacy-Defaults,
  opake Snapshots, aktuelle Snapshotnormalisierung und P4-Identitäten bestanden.
- Kanonisches `npm run verify` bestanden: H1 9 Gruppen; CP0A2 23/0/0/0;
  CP0B 3/3; P1 12, P2 8, P3 29 und P4 4 Gruppen; D1 und übrige Fachtests,
  Typecheck und genau ein Produktionsbuild erfolgreich.
- CP0B-H2: zwei tatsächlich hochgeladene beschädigte JSON-Dateien abgewiesen;
  bytegleicher Store, unveränderter aktiver Fall und Druckkennzahlen; bestehender
  gültiger numerischer JSON-Import mit neuer äußerer ID, Save und realem Reload.
- Separates R1: 55/55 ohne Skips; Artefaktvalidator und Diffcheck erfolgreich.

Finale Git-Identitäten, finale Push-/PR-CI und synthetische Merge-Identität werden
im separaten Abschlussbericht und PR nach deren tatsächlicher Ausführung belegt.
H2 ersetzt keine unabhängige Abnahme und schließt H3/H4 nicht. Finanzrechenkerne,
Schema, Dependencies, Launchflags, Retries und Workflowkonfiguration unverändert.
