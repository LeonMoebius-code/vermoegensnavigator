# Kapitalbedarfe, lokale Recovery-Hinweise und Vermögenshaus

Gezielte Korrekturen auf V0.18.3 / Schema 11, Ausgangs-main
`faf87d3c9ed143a392df87546f5d8886924d314b` (15.10.2026).

## Zeitrechnung

Relative Jahre werden mit `max(0, Math.round(years * 12))` auf ganze Monate
umgerechnet: nächster voller Monat, bei genau einem halben Monat aufwärts.
Die Monate werden zum aufgezeichneten Kalenderdatum von `case.createdAt`
addiert. Der Tag bleibt erhalten, begrenzt auf den letzten Tag des Zielmonats.
Die aus der Umsetzungsplanung übernommene Monatsaddition liegt gemeinsam in
`domain/planning/calendar.ts`; der bisherige öffentliche Export bleibt erhalten.
ISO-Referenzen verwenden das gespeicherte Kalenderdatum, ohne Verschiebung
beim Reload oder durch die lokale Browserzeitzone. Ein ungültiges übergebenes
Referenzdatum wird nicht durch das aktuelle Browserdatum ersetzt.

Beispiel 15.10.2026: Sowohl 1,49 als auch 1,50 Jahre ergeben 18 Monate,
15.04.2028 und den Kapitaltopf `year-2028`. 31.01.2028 + 1 Monat ergibt
29.02.2028; 29.02.2028 + 12 Monate ergibt 28.02.2029.
Ein ausdrücklich erfasster gültiger Termin führt weiterhin. Die bestehende
Laufzeitband-Systematik zählt dafür Kalender-Monatsdifferenzen, keine Tage;
vergangene Termine haben 0 verbleibende Monate und behalten ihr echtes Zieljahr.

Die Erfassung zeigt Termin, Monatslaufzeit und Zieljahr auch für relative und
betragslose Bedarfe. Bei einem konkreten Termin ist das alternative Jahresfeld
leer und mit einem erklärenden Platzhalter versehen. Ein dort eingetragener
relativer Wert wechselt ausdrücklich zurück in den relativen Modus.
`years` und `dueDate` werden beim Laden nicht umgeschrieben; kein Schemawechsel.

Kapitaltöpfe, Übersichten, Sparplan-Zielbezüge, Excel und Druck verwenden denselben
berechneten Termin. Der früheste Topftermin berücksichtigt alle relativen und
konkreten Bedarfe. Eine spätere explizite Fälligkeit darf eine frühere relative
Fälligkeit im selben Jahrestopf nicht verdecken. Umsetzungsraten müssen wie bisher
bis zu diesem frühesten Termin enden. Geldbeträge und wirtschaftliche
Asset-Allokationen werden dadurch nicht verändert.

### Historische Fälle und Schutzgrenze

Gespeicherte Bedarfe, Identitäten, Zuordnungen und historische Snapshots werden
nicht automatisch verändert. Fälle mit weiterhin gültigen Bezügen sind normal
lesbar und speicherbar. Historische Snapshots bleiben bis zum ausdrücklich
angeforderten Restore unverändert und werden dort weiterhin vollständig geprüft.

**Eine vorhandene Jahreszuordnung kann durch die korrigierte Jahresberechnung
ungültig werden.** Beispiel: Ein alter relativer 1,49-Jahres-Bedarf vom
15.10.2026 war fälschlich `year-2027` zugeordnet, korrekt ist `year-2028`.
Existiert der alte Jahrestopf danach nicht mehr, weist die unveränderte
P3-Graphprüfung den Fall zurück. P1 erhält ihn als geschützten Originalfall,
mit vollständiger Original-Wiederherstellung und unveränderter Sicherung vor
einer Nachbarfall-Änderung. Er wird nicht stillschweigend neu zugeordnet,
freigegeben oder gelöscht. Eine fachlich freizugebende Zuordnung solcher
historischen Daten ist nicht Bestandteil einer automatischen Migration.
Auch ein weiter existierender Jahrestopf kann nach der Korrektur andere Bedarfe
enthalten; dessen Produktdeckung sollte fachlich erneut geprüft werden.

## Recovery-Kommunikation

`recoveryNeeded` bleibt der unveränderte Sicherungsindikator. Die Darstellung
unterscheidet:

- Nicht lesbarer Gesamtbestand: Fehlermeldung, unveränderte Originaldaten,
  bestehender Schreibschutz und Originaldownload zur Wiederherstellung.
- Geschützte einzelne Fälle: Anzahl nicht lesbarer/inkonsistenter Originalfälle,
  keine Bearbeitungsfreigabe; lesbare Nachbarn bleiben verfügbar.
- Ausschließlich optionale Positionsdaten: sachlicher Statushinweis, Anzahl
  betroffener Positionen und feste verständliche Feldkategorien; Fälle bleiben lesbar.
- Gemischter Bestand: beide Diagnosen, insgesamt als Warnung dargestellt.

Die Positionsanzahl zählt jede betroffene Position einmal, auch bei mehreren
betroffenen Feldern. Kategorien enthalten ausschließlich fest vorgegebene
Bezeichnungen für Zahlen, Datumsangaben, Klassifikation, Import-Prüfhinweise
und Anleihe-Quellnachweise. Weder Positionswerte noch Namen oder Rohdaten
werden in die Meldung übernommen. Auch rein bereinigte Prüfmetadaten bleiben
als solche benannt, ohne sie als vollständig beschädigten Fall auszugeben.

Die bestehende Entscheidung für `recoveryEntries`, Originalbackup, dessen
Vollständigkeitsprüfung und Wiederverwendung sowie sämtliche Mutation-,
Identitäts-, Finanzvalidierungs- und Restore-Sperren bleiben erhalten.

## Vermögenshaus

Ein gemeinsamer horizontaler Scrollbereich umfasst Dach, fünf gleich breite
Säulen und Fundament. Das Haus nutzt die verfügbare Breite, mindestens 920 px,
um Überschriften, Prozentwerte und Eurobeträge lesbar zu halten. Bei kleinerem
Container ist die vollständige Einheit scrollbar, auch unabhängig von der
Viewport-Breite. Der Bereich ist per Tastatur fokussierbar, beschriftet und
besitzt einen sichtbaren Scrollhinweis. Modusschalter und Beitragsdetails
liegen außerhalb des Scrollbereichs.

Die alten konkurrierenden Haus-, Säulen- und Dachregeln wurden auf die aktive
fünf-Säulen-Darstellung begrenzt und zusammengeführt. Gleich breite Spalten mit
symmetrischem Abstand halten die dritte Säule unter der Dachmitte. Fundament
und Dach verwenden dieselbe Breite. Die wirtschaftliche Berechnung ist unverändert.

## Prüfungen

Die bestehende D1-Prüfung bindet zusätzliche Fach-, Render-, Speicher- und echte
XLSX-Regressionen ein. Alle ursprünglichen Prüfungen bleiben erhalten.
Die zusätzliche Browserdatei prüft reale relative/konkrete Eingaben, Downloads,
Druckinhalt, gespeicherten Reload und vier Recovery-Konstellationen.
Die fünf Geometriefälle verwenden 1440, 1180, 1024, 768 und 390 px; bei 1440 px
zusätzlich einen 680-px-Container. In IST, PLAN, ZIELPLAN und VERGLEICH werden
Bounding-Rects, gleiche Säulenbreiten, Dach-/Säulenmitte, Fundament, Textüberlauf
und sämtliche fünf echten Klickinteraktionen geprüft und Messwerte protokolliert.

Lokal werden das unveränderte kanonische browserunabhängige Gate, Typecheck,
Build und die commitgebundenen R1-Prüfungen ausgeführt. Das vollständige Verify
mit regulärem Chromium übernimmt gemäß Auftrag die vorhandene Feature CI auf
dem veröffentlichten Feature-Commit und auf dem synthetischen PR-Merge.
Keine Änderungen an Dependencies, Playwright, Workflows, Retries oder Workers.
