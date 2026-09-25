# CP0B: Browser-Sicherheitsbaseline

Ausgangs-main: `70524a34ecbe2aa9430c9f306f1072cc3dd28f2d`, frisch von
`origin/main` abgerufen. Branch: `work/architecture-cp0b-browser-baseline`.
Arbeitsverzeichnis vor Beginn sauber; Restore-ID-Fix integriert.
Vor Änderungen wurden CP0A2 und der vorhandene Produktionsbuild erfolgreich ausgeführt.

## Ausführen

Node 22 (wie CI), npm und die vorhandene Bash-Buildumgebung verwenden:

```bash
npm ci
npx playwright install chromium
npm run verify
```

`npm test` delegiert unverändert ausschließlich an `npm run verify`.
Das Gate führt bestehende Fachtests → Typecheck → Produktionsbuild → CP0B aus.
Es gibt genau einen Build pro Gate, keinen Build innerhalb oder nach CP0B.
Der Typecheck umfasst auch Konfiguration, Browsertests und deren Fixturehelper.

Für einen bereits vorhandenen `.pages-dist`-Build:

```bash
npm run test:browser
# Optionale Diagnose mit demselben Runner und Build:
npm run test:browser -- --ui
npx playwright show-report
```

Unter Windows ist Git Bash als npm-`script-shell` und im `PATH` erforderlich;
die bestehenden Node-Suites verwenden `/tmp`. Beispiel in PowerShell:

```powershell
$env:PATH = 'C:\Program Files\Git\bin;' + $env:PATH
$env:npm_config_script_shell = 'C:\Program Files\Git\bin\bash.exe'
npm run verify
```

Die Browserinstallation ist vor dem ersten Lauf und nach Playwright-Updates nötig.
Es wird kein systemweit installierter Chrome oder Edge vorausgesetzt.

## Runner und Produktionsserver

Einzige neue DevDependency: `@playwright/test`, exakt `1.63.0`.
Das zugehörige Chromium-Bundle ist Revision `1243`, Chrome for Testing bzw.
Headless Shell `153.0.8010.12`. Kein weiteres Testframework oder Serverpaket.
Ein Chromium-Projekt, ein Worker, keine Retries, keine Videos oder Screenshot-Goldens.
Pro Test 60 Sekunden, Assertions 5 Sekunden, Aktionen 10 Sekunden,
Navigation/Serverstart 15 Sekunden. Jeder Test besitzt einen isolierten Kontext.

`scripts/serve-browser-build.mjs` liest ausschließlich `.pages-dist` und liefert
es unter `http://127.0.0.1:4173/vermoegensnavigator/` aus. Relative Asset-URLs
entsprechen dem bestehenden Pages-Build. Außerhalb des Unterpfads und bei
fehlenden Dateien gibt es 404; keine SPA-Ersatzseite, Quellcodeauslieferung,
Buildausführung oder Staging-Kopie. Playwright startet und stoppt den Server;
ein bereits laufender Server wird nicht wiederverwendet.
Der Browserlauf vergleicht ausgeliefertes HTML, JavaScript und CSS per SHA-256
mit `.pages-dist` und prüft nach den Szenarien, dass diese Builddateien unverändert
sind. Der falsche Root-Pfad `/app.js` muss 404 liefern.

Abweichung von der esbuild-Präferenz im Preflight: dessen `servedir` wird an der
URL-Wurzel eingebunden. Für den Pages-Unterpfad wären zusätzlich Proxy oder
Staging-Verzeichnis/Symlink nötig. Der kleine Node-Server ordnet den Unterpfad
direkt zu und vermeidet diese zusätzliche Infrastruktur und Windows-Symlinkrechte.
Der vorhandene esbuild-Produktionsbuild bleibt unverändert.

## Genau drei unabhängige Lebenszyklen

1. **Depot:** Leerer LocalStorage und leere Fallliste; Fall über UI anlegen;
   zwei echte CSV-Dateiauswahlen samt Importvorschau. Zwei Depots, drei Holdings,
   gleiche WKN `ZZCP01` in A/B, 20.000 EUR IST. Verkäufe 2.500/6.000 EUR ergeben
   11.500 EUR PLAN. Über Strukturplanung wird eine B-spezifische Holdingreferenz
   erzeugt. `CSV ersetzen` am Depot B wählt B vor; Replacement erhöht die Aktie
   auf 8.000 EUR, IST/PLAN auf 22.000/13.500 EUR. A bleibt samt ID und Inhalten
   gleich; B-Referenz zeigt auf die aktuelle Holding in B und nie auf A.
   Speichern, tatsächlicher LocalStorage, Reload und Wiederöffnen erhalten IDs,
   Beträge und Beziehungen. Zufällige Replacement-IDs werden nicht festgeschrieben.
2. **Planung/Fallidentität:** Einmaliger synthetischer LocalStorage-Startzustand
   über Playwright `storageState`, kein erneut schreibendes Init-Skript.
   UI-Kaufänderung 3.000 → 4.000 EUR ergibt PLAN 14.500 → 15.500 EUR bei
   unverändertem IST 20.000 EUR; Variante ohne Kauf ergibt 11.500 EUR.
   Bevorzugte und aktive Variante werden getrennt gewählt und als gültige IDs
   geprüft; Ergebnisansicht verwendet die bevorzugte Variante. UI-Version,
   sichtbare Statusänderung, echter JSON-Download und Import genau dieser Datei
   erzeugen eine eigenständig gespeicherte Kopie. Nach weiterer sichtbarer
   Änderung und zweiter Version: Restore-Abbruch verändert nichts; Bestätigung
   stellt historische Inhalte wieder her, erhält exakt die aktuelle Kopie-ID
   sowie beide Versionen. Original bleibt vollständig unverändert. Speichern,
   Reload und tatsächliches Wiederöffnen beider Fälle werden anhand exportierter
   Fall-IDs und Inhalte geprüft, auch wenn die Namen nach Restore gleich sind.
3. **Ausgaben:** Synthetischer Bondfall mit `=1+1`; Vollverkauf über das echte
   Verkaufsfeld. Echter Excel-Download mit exakt bereinigtem Dateinamen
   `CP0B-Bond-1-1.xlsx`; erneutes Einlesen genau dieser Datei mit bestehendem
   `xlsx`. Fallzuordnung, physischer Depotwert, Bond-Blätter, wenige bestätigte
   IST-Werte und Stringtyp ohne Formel bleiben erhalten. Beide produktiven
   Druckbuttons lösen den echten Timer-/Printpfad aus. Ein testlokaler
   `window.print`-Beobachter erfasst beim Aufruf Druckmodus und berechnete CSS-
   Zustände unter emuliertem Druckmedium: interne Abschnitte nur intern sichtbar,
   Bedienoberfläche verborgen, Dokument sichtbar. Danach muss `data-print-mode`
   verschwinden. Keine Sleeps, native PDF-Erzeugung oder Druckertreiberautomation.

## Fixtures und minimale Produktänderungen

Nur erfundene Daten. `tests/browser/fixtures.ts` nutzt die neutralen Helper aus
`scripts/cp0a2-fixtures.ts` und `scripts/bond-final-fixtures.ts` ohne ausführbare
Suites zu importieren. CSVs verwenden deren bestehendes 29-spaltiges synthetisches
Strukturübersichtsformat. Die Planungsableitung ergänzt UI-taugliche Namen,
Scope und eine explizite aktuelle Kapitaltopfzuordnung zum synthetischen Kauf.
Der Bondfall übernimmt die bestehende unabhängige Short-Bond-Referenz.
Keine echten oder anonymisierten Kundenbestände; keine global fixierten IDs,
Uhren, Zufallszahlen oder Timer.
Technische Zeitstempel werden auf gültige/logische Änderungen geprüft: Replacement
aktualisiert den Depotzeitstempel, Normalisierung beim Laden den Fallzeitstempel.
Dies ersetzt keine ID-, Inhalts- oder Historienassertion.

Einzige Produktionsdateiänderung: `app/page.tsx` erhält `aria-label` am
Kaufbetrag und am geplanten Verkauf (mit Depot-/Positionsbezug). Diese Änderungen
dienen Zugänglichkeit und stabilen Selektoren. Keine fachlichen Handler,
Berechnungen, CSS-Regeln oder Datenmodelle werden geändert.

## CI und Grenzen

Lokale Abnahme am 24.09.2026 mit Node `22.23.2` unter Windows/Git Bash:
`npm run test:browser` 3/3 erfolgreich, `npm run verify` erfolgreich,
`npm test` erfolgreich, Typecheck und Produktionsbuild erfolgreich,
`git diff --check` ohne Whitespacefehler. Beide vollständigen Gates meldeten
18 A / 1 B / 3 C / 1 D und genau drei erfolgreiche Browserfälle nach einem Build.
Während der Selektorabstimmung wurden Fehler-Screenshots, Traces und der
HTML-Bericht tatsächlich erzeugt. Das CI-Ergebnis wird in der PR dokumentiert.

Feature-CI bleibt auf Node 22. Vor `npm run verify` installiert der offizielle
Playwright-Befehl nur Chromium samt Linux-Abhängigkeiten. Kein Browsercache,
keine Matrix oder doppelte Fachtestliste. Whitespace-Check bleibt erhalten.
Bei Fehlern werden vorhandene `test-results/` und `playwright-report/` als
`cp0b-browser-diagnostics` für fünf Tage hochgeladen. Trace und Screenshot entstehen
bei Testfehlern; Downloads und Berichte enthalten ausschließlich synthetische Daten.

Restore-ID ist bestätigter Sollzustand (CP0A2 Kategorie A), im Browser aktiv
und ohne Skip geprüft. CP0A2 bleibt **18 A / 1 B / 3 C / 1 D**.
`stale-local-list`, `invalid-depot-fallback`, `weak-plan-integrity` bleiben als
drei C-Befunde offen; CP0B benutzt gültige Referenzen und akzeptiert diese Fehler
nicht als Sollverhalten. `general-export-scope` bleibt Kategorie D, ohne neue
Browser-Golden-Assertion zur Neuanlagen-/ZIELPLAN-Frage.

Breite Excel-Fachprüfung bleibt Aufgabe der Node-Suites. Native Excel-Desktop-
und PDF-/Paginierungsabnahme, visuelle Regression und weitere Browser liegen
außerhalb dieses Gates. Kein Architekturrefactoring, Releaseumbau, Schemawechsel,
Migration, Bond-/CSV-Logikänderung, Deployment oder Merge ist Teil von CP0B.

Quellen zur Werkzeugkonfiguration:
[Playwright-Browserinstallation](https://playwright.dev/docs/browsers),
[Playwright-Webserver](https://playwright.dev/docs/test-webserver),
[esbuild-Serve-API](https://esbuild.github.io/api/#serve).
