# F-026 – sichere Kalenderdomäne für Kapitalbedarfe

Beschluss 23.10.2026: [D-11](project/DECISIONS.md). Basis ist die
[READ-ONLY-Folgenabschätzung aus PR #52](P2_F007_XLSX_F026_Bewertung.md), integriert
auf `0ec08f7a6f3132af3ff51d8eed0a921fc35aa1a9`. Kein Release/Deployment.

## Verbindlicher Umfang

Gültiges festes Fallreferenzdatum und tatsächlicher Bedarfstermin müssen in den
vierstelligen Jahren **0100–9999** liegen. Keine zusätzliche fachliche Grenze,
insbesondere keine 100-/120-Jahre-Grenze. Die bisherige Rundung auf ganze Monate
(`Math.round(years * 12)`), Monatsendklemmung und Schaltjahre bleiben erhalten.
Ein vom bestehenden Kalender erkannter gültiger expliziter Termin führt weiterhin;
eine ungenutzte relative Laufzeit wird dadurch nicht zusätzlich vorgeschrieben.
Der bestehende Rückgriff auf eine gültige relative Laufzeit bei nicht führendem
explizitem Termin bleibt erhalten; es wird kein neuer Termin aus ungültigen years
ersetzt oder auf einen Grenzwert gekappt.

`needCalendarDate` prüft Originaltyp/-wert, festes Referenzdatum, sicheren gerundeten
Monatswert und resultierenden Termin gemeinsam. `targetDateForNeed`, Zieljahr und
Horizont verwenden diese Grenze; ungültige Berechnungen werfen kontrolliert statt
`NaN` oder abgeschnittene Jahreswerte weiterzugeben. Das Ergebnis wird vor P3-
Graphrechnung und JSON-Kopie in der gemeinsamen Finanzgrenze abgelehnt. Alle
bisherigen Finanz-/Verkaufs-/Ratenprüfungen bleiben davor erhalten.

Die gemeinsame Monatsarithmetik erkennt unbrauchbare Date-Ergebnisse und formatiert
Jahre unter 1000 vierstellig. Sie übernimmt keine neue Bedarfslaufzeitobergrenze für
andere Verbraucher. Gültige bestehende Einstiegs-/Scheduleergebnisse bleiben gleich.
Auch die zeitzonenbezogene H5b-Vergleichsreferenz wird vierstellig serialisiert;
historische Rechenregeln und Reparaturbefugnisse bleiben unverändert.

Der F-012-Editor prüft Entwürfe am festen Referenzdatum, zeigt die Kalendergrenze
verständlich an und lässt ungültige Entwürfe weder übernehmen noch bestätigen.
Die frühere lokale 50-Jahre-Eingabesperre wird durch die beschlossene technische
Prüfung ersetzt. Gültige 100/200 Jahre sind kein neuer Sonderfall. Verlustvorschau,
zustandsgebundene Zustimmung und Abbruch ohne Änderungen bleiben erhalten.

## Originalschutz und Regressionen

Die gemeinsame Grenze gilt unverändert für JSON-Import, Normalisierung, Rohstore-
Lesen, Save/Insert/Write und tatsächlichen H3-Restore. Problematische Originale
bleiben geschützt; Nachbarspeicherung benötigt vollständiges verifiziertes Backup.
Historische Snapshots bleiben beim Laden und Kopieren opak und werden erst beim
Restore validiert. H5a/H5b erhalten keine Ausnahme und keine automatische Reparatur.

`npm run test:f026-calendar` ist zusätzlich in das reguläre Verify eingebunden.
24 synthetische Varianten prüfen normale Horizonte, 0100, 9999/10000,
Rundungsnachbarn, unterschiedliche Referenzen, Überläufe, explizite Priorität,
P1-Operationen/Backups, opake Snapshots, Legacy/H5 und F-012-Commitkontrolle.
Die neuen realen Browserfälle prüfen Importablehnung, Save/Reload/Anzeige und
wieder eingelesene XLSX-Downloads gültiger Fälle, geschützte Rohdaten,
Nachbarspeicherung/Backupwiederverwendung, H3-Restoreablehnung, H5b sowie den
F-012-Editor und eine durch Referenzänderung ungültig gewordene Bestätigung.
Bestehende Tests bleiben unverändert; finale CI-/Git-Nachweise im Abnahmepaket.

V0.18.3 / Schema 11, Migrationen, Kataloge, Dependencies, D1 und alle übrigen
Fach-/Sicherheitsverträge unverändert. PR #43: AUDIT ONLY – NEVER MERGE.
Keine F-024/F-025-Arbeit oder neue Auditserie; zwei unabhängige Abnahmen,
einmalige V0.18.3-Readiness und spätere Releaseentscheidung bleiben separat.
