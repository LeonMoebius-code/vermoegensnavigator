# F-021: relative Bedarfslaufzeiten

Version 0.18.3 / Schema 11 bleiben unverändert.

`validCaseFinancialInputs` prüft den unveränderten Fall vor P3-Graphrechnung,
JSON-Kopie und Normalisierung. Wenn keine vom bestehenden Kalender erkannte
gültige explizite `dueDate` führt, muss `needs[].years` eine echte endliche,
nichtnegative Zahl sein. `null`, Booleans, Strings, negative, fehlende und
nichtendliche Werte werden abgelehnt, ohne Konversion oder Ersatznull.

Die bestehende Priorität einer gültigen expliziten `dueDate` bleibt bestehen:
Eine dabei unbenutzte relative Laufzeit wird nicht zusätzlich vorgeschrieben.
Die separate H5b-Rohdiagnose behält ihren bereits strengeren Vertrag.
Monatsrundung, Referenzdatum, Monatsschnitt und Schaltjahre bleiben unverändert.

Die gemeinsame Grenze gilt für regulären Import, lokales Lesen, Save/Insert/Write
und den tatsächlichen H3-Restore. P1 schützt unbrauchbare Originaleinträge und
sichert vor einer Nachbarspeicherung vollständige Originalbytes mit Rückleseprüfung.
Geeignete Backups werden wiederverwendet. Snapshotinhalte bleiben beim Laden und
P4-Kopieren opak; sie werden erst beim Restore validiert. H5a/H5b gewähren keine
Ausnahme und reparieren keine ungültige Laufzeit.

## Regressionen

`npm run test:f021-need-duration` ist Teil von `npm run verify`. Acht Gruppen prüfen
die produktive Grenze, Guard-Reihenfolge, Runtime-Mutatoren, P1-Backupfehler,
P4-Historienerhalt, explizite Termine, Kalendergrenzen und historische Grenzen.

`tests/browser/f021-need-duration.spec.ts` enthält 58 reale Browserfälle zusätzlich
zu den bestehenden Fällen. Zwei unabhängig gültige Ausgangsfälle (A mit fester
`year-2028`-Allokation, B ohne Jahresbindung) variieren ausschließlich `years`.
Pro Variante werden JSON-Dateiimport, Rohstore/Reload/Nachbar-Save, Restorebutton
und separate H5b-Diagnose geprüft. Gültige XLSX-Buttondownloads werden anhand der
tatsächlichen Zellen geprüft. Die unveränderte CI lädt Artefakte nur bei Fehlern
hoch; erfolgreiche synthetische XLSX-Bytes werden deshalb komprimiert und mit
SHA-256 im Joblog beweissichernd ausgegeben.

| years | Finanzguard | Annahme A | Annahme B |
| --- | --- | --- | --- |
| 1.49 | gültig | ja, 15.04.2028 | ja, 15.04.2028 |
| 0 | gültig | nein, bestehender P3-Jahreskonflikt | ja, 15.10.2026 |
| null / false / "2" / -1 / fehlend | ungültig | nein, vor P3 | nein, vor P3 |

Die F-021-Szenarien stammen aus Diagnose-PR #43; dessen Dateien und die weiterhin
offenen Findings F-020/F-017 werden nicht in den Produktbranch übernommen.
Kein Merge vor zwei unabhängigen positiven Abnahmen; kein Release oder Deployment.
