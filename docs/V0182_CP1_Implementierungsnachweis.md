# V0.18.2 CP1: Datenintegrität

Ausgangs-main: `3c5fd20bb13698db4436c0ba6be3e767d340d6d7` (CP0 über PR #6).
Arbeitsbranch: `work/v0182-bond-hardening`.

## Umfang

Nur CP1. Keine Bond-V2-Rechenengine, keine Schema-11-Migration, keine Ausschlusscheckbox und keine CP3-/CP4-Umsetzung. Persistenzschema bleibt 10, Anwendungsversion bleibt bis zum späteren Release 0.18.1. Der aktuelle Entwicklungsstand ist keine Freigabe der bisherigen V1-Bondmathematik als V2. CP0-Dokumente bleiben unverändert.

## Änderungen und Nachweise

| Bereich | Umsetzung | Regression |
| --- | --- | --- |
| Depotwert | Zentraler Guard vor jeder aktiven Fallmutation, abgeleitete Marktwertsumme, geschütztes Eingabefeld. Mutationen, Speichern, Snapshot, Restore, JSON sowie Excel/Druck konsistent. Ohne Holdings bleibt manuelle Erfassung auch mit leeren Accounts erhalten. Entfernen des letzten physischen Bestands setzt den bisherigen Bestandswert auf null. | Zwei Holdings mit 100.000 EUR und falschem Gesamtwert 1, Eingabe 0/1, hasDepot, Einzeländerung, Delete, leeres Konto, Snapshot, Kopie, Speichern/Laden, JSON. Tatsächlich gerendertes readonly-Eingabefeld und tatsächlich erzeugte Excel-Zelle. |
| Depot-Replacement | Eine depotbegrenzte 1:1-Tabelle. WKN-/productId-Widersprüche sperren auch identische technische IDs und Namensfallback. Mehrdeutige Kennungen dürfen nicht über Namen aufgelöst werden. Kollidierende/fehlende/doppelte Import-IDs werden entkoppelt. Zieldepotreferenzen gehen ausschließlich über die Tabelle. Verkäufe werden nur bei sicherem Match übernommen und begrenzt. Fremde Depots bleiben unverändert. | Mapping und endgültige Referenzen/Verkäufe bei gleicher ID und anderer WKN, gleichem Namen, productId-Konflikt, Mehrdeutigkeit, Reorder, fehlender/doppelter ID, zwei Depots mit derselben WKN, Sale Clamp und Delete. |
| CSV | Strikte Zahlengrammatik statt Zeichenentfernung. Pflichtmarktwertfehler brechen vor Importvorschau/Replacement ab. Optionale Fehler bleiben fehlend, mit feldbezogenen maschinenlesbaren Gründen und deutschen UI-Hinweisen. Kalenderprüfung ohne Date-Überlauf. Klassifikation berücksichtigt Quellfelder gemeinsam und schließt erkennbare Sonderformen vom Standardmodell aus. | Navigator und Strukturübersicht, n/a, 5abc, 1e3, NaN/Infinity, Überlauf, mehrdeutige Trennzeichen, explizite Null, Leerwert, negative Zahlen je Feldvertrag, ungültige Kalenderdaten/Schaltjahre, Fonds/Sonderformen, keine Übernahme zusätzlicher persönlicher Spalten. |
| Modellportfolio | Positiver strategischer Topf mit passender Art zwingend. Kein Fallback auf Reserve/Bedarf. Guard in allen drei Modellaktionen und ihren Datenfunktionen. Falsche/fehlende Allokationsreferenzen werden vor jeder Mutation abgelehnt. | Neue Variante, Ergänzen und Ersetzen mit manuell positivem Betrag bei gebundenem Kapital, fehlendem/ungültigem Topf sowie fehlerhaften Referenzen. Bestehende V0.18.1-Normalfälle bleiben bestehen. |
| Fallweiser Ladeschutz | Fälle einzeln normalisieren. Unlesbare Fälle bleiben als Originaleinträge erhalten. Vor einem Speichern mit beschädigten Daten wird der gesamte bisherige Originaltext separat gesichert und überprüft. Sicherungen bleiben nach Reload über die Oberfläche herunterladbar. Ungültige optionale Holdingfelder werden isoliert. Bei insgesamt syntaktisch beschädigtem JSON wird Schreiben gesperrt. | Gesunder und beschädigter Fall nebeneinander, spätere Speicherung/Löschung gesunder Fälle, unveränderter Originaleintrag und Originaltext, optionale Bondkorruption mit erneutem Laden, künftiges Schema, Sicherungs-/Speicherfehler. |

Neue Dateien: `app/depot-validation.ts`, `app/case-storage.ts`, `scripts/verify-cp1.tsx` und dieser Nachweis.
Weitere Änderungen: `app/case-model.ts`, `app/depot-csv.ts`, `app/depot-analysis.ts`, `app/page.tsx`, `scripts/verify-modelportfolio.ts`, `package.json`, `tsconfig.github.json`, `.github/workflows/ci.yml`.

Die optionalen `importIssues` sind additive Validierungshinweise innerhalb Schema 10. Sie enthalten keine Rohzellen. Quellprofil, Bondherkunft und Schema-11-Migration bleiben CP2 vorbehalten. Vorhandene numerische optionale Altwerte werden nicht rückwirkend als geprüfte CSV-Herkunft ausgegeben. Zukünftige Schemata über 10 werden unverändert geschützt statt heruntergestuft.

Zahlenschreibweise: Dezimalkomma, korrekt gruppierte deutsche Zahlen mit Dezimalkomma, ungruppierte Dezimalpunkte und korrekt gruppierte Leerzeichen werden unterstützt. Ein einzelner Punkt nach 1–3 Ziffern mit genau drei Nachkommastellen (z. B. `1.234`) ist ohne weitere Locale-Evidenz mehrdeutig und wird abgelehnt. `1234` oder `1.234,00` sind eindeutig. Es erfolgt keine stille Größenordnungsentscheidung. Der frühere CSV-Konverter hatte keine weiteren produktiven Aufrufer außerhalb des CSV-Moduls. Manuelle Betragsfelder wurden nicht global umgestellt.

## Ausgeführte Prüfungen

- `npm run test:cp1`
- `npm run test:multi-depot` (58 Assertions)
- `npm run test:modelportfolio` (16 bestehende Assertions)
- `npm run test:3b`
- `npm run test:4b`
- `npm run test:risk-v2`
- `npm run typecheck` (einschließlich neuer CP1-Tests und angepasster Modellportfolio-Tests)
- `npm run build` (nur lokaler Produktionsbuild)
- `git diff --check` und nach dem Commit `git diff --check origin/main...HEAD`

Die CP1-Suite ist ein obligatorischer Feature-CI-Schritt. Multi-Depot ist ebenfalls obligatorisch, ohne `--if-present`. Bestehende V1-Mathematikassertions wurden nicht verändert. Ausschließlich synthetische Testdaten.

Die UI-Prüfung verwendet React-Rendering des tatsächlichen Eingabefelds und der Druckansicht. Der echte Excel-Button wird ausgeführt und die erzeugte Arbeitsmappe wieder eingelesen. Ein interaktiver Browser-E2E-Lauf und ein tatsächlicher Druckdialog wurden nicht ausgeführt. Die fachliche Sichtabnahme und CP2 erfolgen separat. Kein Merge und kein Pages-Deployment durch CP1.
