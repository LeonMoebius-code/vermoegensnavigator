# F-020 – Konsistenz geplanter Depotverkäufe

Version 0.18.3 / Schema 11 bleiben unverändert. Ausgangs-main nach F-021:
`84fb5f79d69ea88333a1a2205173193f320d2455`, Tree
`10151616e78162d6f514060cc855c48897721a54`.

Der reale Diagnoseablauf aus Audit-only PR #43 zeigte nach manueller Reduktion
10.000/8.000 → 5.000/8.000 in UI, XLSX und Rohstore. Der bloße Reload begrenzte
nur die Arbeitskopie auf 5.000/5.000; erst ein zweiter Save änderte die Rohdaten.
Die auf null begrenzte PLAN-Restposition war kein korrekter Verkaufsauftrag.

## Fachvertrag und gemeinsame Grenze

`validDepotSale` prüft unveränderte Runtimezahlen: endlich, nichtnegativ und
`plannedSale <= value`. Die bestehende gemeinsame Finanzprüfung verwendet ihn
für Schema 10/11 vor Graphrechnung, JSON-Kopie, Depotwertableitung und Annahme.
P1 Save/Insert/Write verwenden weiterhin diese Grenze ohne Validierungsausnahme.
Auch ein zur Prüfung normalisiertes Ersatzobjekt legitimiert keinen anderen
ungültigen Schreibkandidaten. F-021 bleibt unbedingt aktiv.

Eine Marktwertänderung erhält den bewusst erfassten Verkaufsbetrag. Sie darf
einen unbereinigten Entwurf erzeugen. Wizard, Strukturplanung, Depotcheck und
Ergebnis zeigen dann einen positionsbezogenen Konflikt mit Depot, Name und
beiden Beträgen. Der Berater muss Verkauf oder Marktwert aktiv korrigieren.
Eine Warnbestätigung ohne Korrektur ist nicht vorgesehen. Der Wizard erhält
hierfür einen Verkaufeditor neben dem bestehenden Werteditor.

Alle Save-Buttons teilen den Home-Handler, der den Originalentwurf bereits vor
Clone, Zeitstempel und Versionsaufbau prüft. Die unabhängige P1-Grenze schützt
zusätzlich direkte Runtimeaufrufe. Bei Ablehnung bleiben Store, Historie und
aktive Entwurfsänderungen erhalten. Die Meldung bezeichnet Planungen und
Transaktionen ausdrücklich als vorläufig. Die bestehende KPI begrenzter
simulierter Verkäufe hat weiterhin nur ihre Rechenbedeutung.

JSON-Ausgabe ist im gemeinsamen Handler gesperrt, einschließlich Wizard-Ergebnis.
ExportCenter deaktiviert JSON/XLSX und beide PDF-/Druckausgaben, prüft zusätzlich
in den Ausgabehandlern und erzeugt bei Konflikten kein Kundendruckdokument.
Original-/Recoverydownloads geschützter P1-Rohbestände sind davon getrennt.
Gültige Ausgaben und D1-Projektionen bleiben unverändert.

## Originale, Legacy und Historie

Aktuelle Schema-10/11-Originale mit Verkauf über Marktwert werden nicht mehr
still gekappt, sondern vom bestehenden P1-Leser geschützt. Lesen verändert keine
Storebytes. Gesunde Nachbarn bleiben verfügbar. Vor ihrer Speicherung sichert P1
den vollständigen Originalstring und liest ihn bytegleich zurück; die geschützten
Falleinträge bleiben strukturell unverändert erhalten. Backup-/Quota-/Rücklesefehler
verhindern die Hauptstoremutation. Keine automatische Reparatur oder Migration.

Schema 0–9 behält seine dokumentierte Verkaufsbegrenzung, Default- und explizite
Stringmigration. Snapshots bleiben beim Lesen/P4-Import opak und vollständig
unverändert. Erst der tatsächliche H3-Restore prüft den ausgewählten Arbeitsstand
und verweigert einen inkonsistenten aktuellen Snapshot. H5a/H5b erhalten keine
Ausnahme; es entsteht keine neue Kopie oder reparierte Historie.

Der bestehende CSV-Replacement-Lifecycle begrenzt weiterhin den übernommenen
Verkauf auf den neuen Positionswert, ohne andere Depotkonten umzuschreiben.
Dies ist ein eigener dokumentierter Importvertrag; der Produktpfad bleibt unverändert.

## Dauerhafte Regressionen

`test:f020-depot-sales` ist im kanonischen Verify registriert. 13 Domain-/UI-Gruppen
prüfen strikte unveränderte Eingänge, Schema 10/11, Save/Insert/Write, P1-Backups und
Fehler, opake Historie/P4, tatsächlichen H3-Handler, Ausgabehandler, Legacy 0–9,
CSV-Lifecycle und exakte Projektionen.

Die H2-Positivmatrix testete Wert und Verkauf isoliert auch über Kreuz inkonsistent
(z.B. Marktwert 0 / Verkauf 50 oder Marktwert 1.000 / Verkauf 1.000,5).
Nur diese positiven Fixtures erhalten jetzt einen passenden Gegenbetrag; die jeweils
geprüfte Zahl/Präzision und alle negativen H2-Assertions bleiben unverändert.

15 zusätzliche echte Browserfälle übersetzen ausschließlich die F-020-Szenarien
von PR #43. Vier vollständige Abläufe (Wizard/Depotcheck × Verkauf-/Wertkorrektur)
prüfen jeden Save-/Versionierweg, beide JSON-Eingänge, Ausgabesperre, Rohbytes,
Reload, Version, reale XLSX-Downloads und beide Druckbuttons. Weitere Fälle prüfen
positive Werte, zwei Konflikte, beide CSV-Einstiege, aktuelle Originale, Backupfehler,
H3 und JSON-Ablehnung. Die gemeinsamen vorhandenen F-021-Browserhilfen werden
unverändert wiederverwendet. Keine Audit-only F-017-/F-021-Dateien übernommen.

Exakter synthetischer Sollfall nach Korrektur: A 5.000/5.000, B 6.000/0;
IST-Depot 11.000, PLAN-Rest 6.000; Vermögenshaus IST 211.000, PLAN/ZIELPLAN
206.000. Echte XLSX-Zellen `Depot!D2/H2/D3/H3` und ZIELPLAN-Struktursumme werden
geprüft. Erfolgreiche Downloads bleiben komprimiert mit SHA-256 im CI-Joblog
beweissichernd erhalten (bestehender unveränderter Browserhelper).

Lokale Chromiumrevision 1243 ist nicht installiert; verbindliche vollständige
Browser- und Gate-Ausführung erfolgt gemäß Auftrag durch Push- und PR-Feature-CI.
Tatsächliche Run-/Checkout-/Merge-Identitäten und Resultate stehen im separaten
Abschlussbericht. Kein Merge vor zwei organisatorisch unabhängigen positiven
Abnahmen, kein Release/Deployment. Diagnose-PR #43 bleibt AUDIT ONLY – NICHT MERGEN.
