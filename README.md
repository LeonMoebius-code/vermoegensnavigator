# VermögensNavigator

Der VermögensNavigator ist ein browserbasierter Prototyp für eine strukturierte
Vermögensberatung. GitHub ist die einzige gepflegte Codebasis. Die öffentliche
Version wird über GitHub Pages bereitgestellt.

## Öffentliche Version

https://leonmoebius-code.github.io/vermoegensnavigator/

## Entwicklung

Voraussetzungen sind Node.js ab Version 20 sowie Bash mit den vom bestehenden
Build verwendeten Unix-Werkzeugen. Die Feature-CI nutzt Node.js 22 auf Ubuntu.
Unter Windows die npm-Skripte mit Git Bash als `script-shell` ausführen und
Bash im `PATH` verfügbar machen; die vorhandenen Tests verwenden `/tmp`-Pfade.

```bash
npm ci
npx playwright install chromium
npm run verify
```

`npm run verify` ist der kanonische vollständige Prüfbefehl. `npm test` delegiert
auf dasselbe Gate. Der Produktionsbuild liegt anschließend in `.pages-dist`;
dieser lokale Build veröffentlicht nichts.

### CP0A1: Umfang und Referenzstand des Gates

Inventarisiert am 23.09.2026 anhand des frisch abgerufenen Remote-`main`
`6ec5ced21704e0474dc91cc27fc5c80d7ad73792`. Dieser Stand entspricht dem im
CP0A1-Auftrag genannten Referenzcommit; es gab keine Abweichung.

Das Gate führt in dieser Reihenfolge die elf direkten Fachtest-Einstiege und
anschließend Typecheck, Produktionsbuild und die drei CP0B-Browserabläufe aus:

| Nr. | npm-Skript | Einstieg / Prüfung |
| --- | --- | --- |
| 1 | `test:3b` | `scripts/verify-3b.ts` |
| 2 | `test:4b` | `scripts/verify-4b.ts` |
| 3 | `test:risk-v2` | `scripts/verify-risk-v2.ts` |
| 4 | `test:multi-depot` | `scripts/verify-multi-depot.ts` |
| 5 | `test:modelportfolio` | `scripts/verify-modelportfolio.ts` |
| 6 | `test:cp1` | `scripts/verify-cp1.tsx`, einschließlich `verify-cp1-review.ts` |
| 7 | `test:bond-v2` | `scripts/verify-bond-v2.ts` |
| 8 | `test:cp3` | `scripts/verify-cp3.tsx` |
| 9 | `test:cp4` | `scripts/verify-cp4.tsx`, einschließlich `verify-asset-classification.tsx` |
| 10 | `test:bond-final` | `scripts/verify-bond-final.tsx` |
| 11 | `test:cp0a2` | `scripts/verify-cp0a2.tsx` – deterministische Referenzen, Kategorien A–D |
| 12 | `typecheck` | `tsc -p tsconfig.github.json --noEmit` |
| 13 | `build` | `bash scripts/build-github-pages.sh` |
| 14 | `test:browser` | `tests/browser/cp0b.spec.ts` gegen genau diesen `.pages-dist`-Build |

Die ausführbare Liste wird ausschließlich im `verify`-Skript in `package.json`
gepflegt. Alle Einzelskripte bleiben nutzbar. Die `&&`-Verknüpfung führt sie
sequenziell aus und bricht beim ersten Fehler ab; nur Exitcode 0 bestätigt den
vollständigen Durchlauf. Wegen fester temporärer Dateinamen und prozessweiter
Zustände keine parallelen Gate- oder Einzelskript-Läufe starten.

Die Importprüfung aller Verify-Skripte ergibt genau zwei Suite-Importkanten:
`verify-cp1.tsx` → `verify-cp1-review.ts` und `verify-cp4.tsx` →
`verify-asset-classification.tsx`. Beide werden jeweils einmal über ihren
direkten Einstieg ausgeführt, ohne zusätzlichen Einzelaufruf. Der CP1-Review
war bereits aktiv; die gegenteilige frühere Preflight-Aussage war falsch.
Seine Ausführung ist an den 13 `node:test`-Subtests und der TAP-Zusammenfassung
erkennbar, die Asset-Class-Prüfung an der Meldung `Economic classification:`.
`cp4-fixtures.ts` und `bond-final-fixtures.ts` liefern nur Testdaten.
`bond-v2-reference.py` erzeugt die bereits in den Bond-V2-Tests verwendeten
Referenzwerte und ist kein aktiver Testeinstieg. Weitere Verify-Suite-Importe
oder dynamische Suite-Aufrufe bestehen am Referenzstand nicht.

Die Feature-CI (`.github/workflows/ci.yml`) installiert nach `npm ci` mit
`npx playwright install --with-deps chromium` den zur fixierten Playwright-Version
gehörenden Browser und ruft dasselbe
`npm run verify` auf. Ihr `git diff --check origin/main...HEAD` bleibt als
separate Whitespace-Prüfung bestehen. Deploymentworkflow und Releaseprozess
werden durch CP0A1 nicht verändert.

### Grenzen und bekannte Befunde

**CP0A1 ist noch keine vollständige Refactoring-Sicherheitsbaseline.** Das Gate
orchestriert die bestehenden Assertions unverändert und belegt nur deren
heutigen Prüfumfang. Der Typecheck verwendet weiterhin den bestehenden Umfang
von `tsconfig.github.json`. Die Render- und Exportprüfungen laufen in Node;
auch als „end-to-end“ bezeichnete bestehende Tests sind keine Browserabläufe.

CP0A2 ergänzt 23 kleine synthetische Referenzen mit getrennten Kategorien für
bestätigtes Verhalten, technische Beobachtungen, bekannte Fehler und offene Semantik.
Matrix, Kanonisierung und Vergleichsvertrag: [CP0A2-Referenzbasis](docs/CP0A2_Referenzbasis.md).
CP0B ergänzt genau drei Browser-Lebenszyklen mit Playwright/Chromium:
Depot, Planung/Fallidentität und Ausgaben. Einrichtung, Assertions und Grenzen:
[CP0B-Browserbaseline](docs/CP0B_Browserbaseline.md).
Weiterhin außerhalb des Gates bleiben visuelle Regressionen,
native Excel-Desktop-Abnahme, native Druck-/PDF-Paginierungsabnahme,
Architektur-Abhängigkeitsregeln und Releaseentkopplung.

Aus dem unabhängigen Architekturreview sind folgende getrennt zu behandelnde
Befunde bekannt. CP0A1 dokumentiert sie; ein grünes Gate widerlegt sie nicht:

- **Restore-ID-Fehler (nach CP0A2 behoben):** Historischer Restore erhält jetzt
  die aktuelle Fall-ID der JSON-Kopie; Original und Kopie bleiben getrennt gespeichert.
  Regressionstest `restore-id` ist Kategorie A, siehe [Referenzbasis](docs/CP0A2_Referenzbasis.md#priorisierter-restore-id-fix-nach-cp0a2).
- **Veraltete Fallliste:** Speichern aus einem veralteten lokalen Zustand kann
  zwischenzeitlich gespeicherte gesunde Fälle verdrängen.
- **Ungültige Depotreferenz:** Eine ungültige `depotId` kann bei der
  Normalisierung auch im aktuellen Schema still auf das erste Depot umgebogen
  werden. Die Migrations- und Reparatursemantik bleibt unverändert.
- **Planidentitäten:** Doppelte Plan-IDs, ungültige `activePlanId` und mehrere
  bevorzugte Pläne besitzen derzeit schwächere Integritätsprüfung.
- **Architektur:** CSV-Klassifikation ist an das umfangreichere Analysemodul
  gekoppelt; historische abgeleitete Ergebnisse können durch später veränderte
  Produktkatalogstände beeinflusst werden.
- **Betrieb:** Merge und Veröffentlichung sind gekoppelt. Der veröffentlichte
  Artefaktumfang des aktuellen Pages-Pfads muss separat überprüft werden.

Diese Befunde werden in CP0A1 nicht behoben. Produktionscode, Fachlogik,
Schema 11 und vorhandene Tests bleiben unverändert. CP0A1 endet mit einem
offenen, CI-grünen Pull Request zur unabhängigen Abnahme; Merge und
Veröffentlichung benötigen eine separate Entscheidung.

## Automatische Veröffentlichung

Bei Änderungen auf `main` prüft die GitHub Action den TypeScript-Quellstand,
erzeugt die statischen GitHub-Pages-Dateien und aktualisiert die veröffentlichten
Dateien im Wurzelverzeichnis. Die bestehende GitHub-Pages-Konfiguration für
`main` bleibt dadurch verwendbar.

## Speicherung

Beratungsfälle werden ausschließlich im lokalen Browser gespeichert. Für eine
Sicherung und Übertragung stehen JSON-Export und JSON-Import zur Verfügung.

## Wichtiger Hinweis

Der Prototyp erzeugt keine Anlageempfehlung. Für einen produktiven Einsatz sind
insbesondere bankfachliche Freigabe, Datenschutz, Informationssicherheit und
revisionssichere Dokumentation gesondert umzusetzen.
