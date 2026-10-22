# F-010/F-023 – Klassifikationsintegrität

Basis `478d17d5bcfa03c9d287188ae2db59da0e16108a`, Tree
`0a09663dd96bdb048f5e785bc0636ee630303b43`. Version 0.18.3 / Schema 11.

Die Reproduktion auf unverändertem main ruft den wirklichen Situation-Handler auf:
10.000 EUR ungeklärt, aktive Auswahl Substanzwerte, weiterhin `unresolved`,
Substanzwerte 0 EUR, ungeklärt 10.000 EUR. Derselbe Stand akzeptiert aktuelle
`Krypto`/`mapped`-Eingänge; die Projektion erzeugt einen fremden `Krypto: NaN`-Key,
0 EUR ungeklärt und meldet vollständige Durchschau trotz fehlender 10.000 EUR
in den fünf Säulen. Nachweise und Messdaten stehen im externen Abschlussarchiv.

## Fachvertrag

`isAssetClass` prüft exakt die fünf Domainstrings ohne Casting oder Coercion.
Beide manuellen Depotselektoren zeigen bei ungeklärten Positionen einen eigenen
Platzhalter. Erst ein tatsächliches Change-Ereignis mit gültiger Auswahl übernimmt
Klasse und `mapped` gemeinsam für genau diese Holding-ID. Insbesondere ist auch
die bewusste Wahl des zuvor nur intern vorbelegten Geldwerte möglich. Initiales
Rendern, Öffnen und Speichern klären keine ungeklärten Bestände automatisch.

Der Sonderfall des bisherigen Selektors wurde bestätigt: Bei vorhandenem
Katalogmix ließ sich zuvor die sichtbare Einzelklasse ändern, obwohl die
Projektion weiterhin den Produktmix verwendete. Es wird **keine Überschreibungsregel**
eingeführt. Der Selektor zeigt dann ausdrücklich `Katalogdurchschau` und ist
nicht editierbar; auch sein Handler lehnt manuelle Änderungen ab. Produkt-ID,
Status und der bestehende wirtschaftliche Mix bleiben erhalten. Ein zukünftiger
manueller Override benötigt einen gesonderten fachlichen Auftrag.

Aktuelle Schema-10/11-Eingänge mit ungültiger Klasse und geklärtem Status werden
vor Clone/Graphrechnung abgelehnt. Dies umfasst mapped, matched und den bisher
auf mapped fallenden fehlenden Status. Explizit ungeklärte Originaldaten dürfen
ihren unbekannten Quellwert behalten: Er wird niemals als gültige Klasse behandelt.
P1 prüft die Schreibkandidaten zusätzlich vor jeglichem Backup-/Hauptschreiben.
Import, Save und bestätigter H3-Restore erhalten eine konkrete Fehlermeldung mit
den fünf erlaubten Klassen und Originalerhalt. Kein Klassenwert wird geraten.

Unabhängig vom Eingangsschutz zählt ein ungültiger Runtime-Klassenschlüssel im
reinen Projektionskern vollständig als ungeklärt – auch wenn eine Katalog-ID
mitgeliefert wurde. Keine Mutation, NaN oder zusätzlichen amount-Keys. Bei gültigem
Klassenschlüssel behält die vorhandene Katalogdurchschau ihre Priorität.
Contributor-Anzeige und wirtschaftliches XLSX-Label behandeln ungültige Schlüssel
entsprechend. Die bestehende fehlende Contributor-Darstellung bei nicht mehr im
Katalog vorhandener Produkt-ID (F-014) ist kein Bestandteil dieser Korrektur.

## Erhaltungsgrenzen

P1 behandelt neue ungültige aktuelle Rohfälle als geschützt. Nachbarspeichern
bewahrt deren Originalobjekt und sichert die vollständigen ursprünglichen Bytes;
vorhandene sichere Backups werden wiederverwendet. Ablehnung eines ungültigen
Kandidaten schreibt weder Hauptstore noch Backups. H3-Fehlschlag oder Abbruch
ändert weder Arbeitsstand noch Historie. H5 bleibt ohne Validierungsausnahme.

Schema 0–9 behält seine bereits bestehenden Migrationen. Es gibt **keine neue
assetClass-Migration**. Ein unbekannter historischer Klassenwert wird nicht
repariert: Die bisherige Legacy-Normalisierung kann ihn unverändert in eine
Arbeitskopie übernehmen; die defensive Projektion zeigt den Wert vollständig
ungeklärt, ein danach aktueller ungültiger Schreibkandidat bleibt gesperrt.
Dies ist keine Freigabe solcher Altbestände für aktuelle Persistenz und keine
Behauptung eines dokumentierten historischen Klassenmappings. Historische
Originale und opake Snapshots werden nicht umgeschrieben. Gültige Legacyklassen,
Einzeldepot-, Risiko-, Verkaufs-, Bucket- und Einstiegs-Migrationen bleiben bestehen.

IST, PLAN und ZIELPLAN verwenden dieselben bisherigen Sichtenverträge.
Ungeklärtes bleibt im Gesamtwert/Prozentnenner, Active und Preferred getrennt.
Ohne Preferred keine Zielstruktur und kein Excel-/Druckfallback. Keine Änderung
an Verkäufen, Laufzeit-, RK-/Geeignetheitsregeln, Runden, Katalogen oder F-012/F-026.

## Dauerhafte Prüfungen

`test:f010-f023` ist im sequenziellen Verify registriert und im Typecheck erfasst:
9 Gruppen für reale React-Handler, alle Klassen, Mehrdepot/IDs/WKN, Vorrang von
Produktmixen, Schema 10/11 mit zwölf ungültigen Werten und drei Statusformen,
immutable defensive Projektion, Save/Insert/Write, P1-Backups/Fehler, opake
Historie/H3/H5, gültige Legacy-Migration und echten XLSX-Export/Renderausgaben.
Vorhandene Tests/Erwartungswerte und PR #43 bleiben unverändert.

15 neue Chromiumfälle: fünf manuelle Klassen mit Situation/Depotcheck,
IST/PLAN/ZIELPLAN, kompaktem Ergebnis, echten XLSX-Downloads und beiden echten
Druckbuttons mit Print-Media; Substanzwerte zusätzlich JSON-Import,
Versionsspeicherung, abweichender Entwurf, bestätigter H3-Restore und Reload.
Weitere Fälle prüfen keine Nutzerentscheidung, drei Holdings in zwei Depots mit
identischen Namen/WKN, Produktmix, unterschiedliche aktive/bevorzugte Beträge,
sechs aktuelle Schema-/Klassenkombinationen mit Import/Restore/P1/Backup/Nachbar
und fehlendes Preferred. Jeder relevante Betrag und Nenner wird konkret geprüft.
Die 126 vorhandenen Browserfälle bleiben unverändert; insgesamt 141 ohne Skips.

Das unveränderte CI-Workflow lädt Erfolgsartefakte nicht separat hoch. Daher
sichern die vorhandenen Download-/Screenshothelfer die synthetischen Originalbytes
mit SHA-256 als gzip/Base64 im originalen Joblog. Das externe Nachweisarchiv
enthält rekonstruierte Originalbytes, Logs und Hashmanifest. Das ist ein
Print-Media-/Druckhandlernachweis, kein behaupteter gespeicherter Betriebssystem-PDF.

Lokaler regulärer Chromiumstart scheitert am fehlenden Headless-Shell-Binary
Revision 1243. Lokal bestandenes Domain-/Typecheck-/Build-Gate wird daher nicht
als vollständig grünes Verify bezeichnet. Maßgeblich sind die vollständigen
Feature-CI-Läufe auf finalem Feature-Commit und synthetischem PR-Merge;
tatsächliche IDs, Checkout-SHAs, Resultate und Hashes stehen im Abschlussbericht.
Kein Merge, Release, Tag, Rollback, Deployment oder Workflow-/Einstellungsänderung.
