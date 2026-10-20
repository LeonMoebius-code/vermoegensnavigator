# H5b – Kontrollierte Wiederherstellung als unabhängige Fallkopie

## Zweck und Grenze

H5b setzt Variante C des H5-Entscheidungsberichts vom 15.10.2026 um. Die
Anwendung untersucht gespeicherte aktuelle Fälle und ausdrücklich gewählte
historische Snapshots. Sie erzeugt nach Einzelentscheidungen, Originalsicherung
und vollständiger Prüfung ausschließlich eine unabhängige Fallkopie. Der
reguläre Editor erhält nie einen ungültigen Originalfall als Zwischenzustand.
Version bleibt 0.18.3, Fallschema 11. Kein automatischer Bestandslauf.

## Module und Datenfluss

`domain/case/capital-recovery-diagnosis.ts` inventarisiert unveränderte Rohdaten.
Es ruft keinen Normalisierer und keine Reconciliation auf. Es prüft alle
Varianten einschließlich inaktiver Pläne, Need-/Goal-/Depotidentitäten,
Einzelreferenzen, vollständige Maps mit Nullschlüsseln, Review/unzugeordnete
Anteile, Legacy-Buckets und sämtliche Umsetzungspläne. A bezeichnet verwaiste
Referenzen, B geänderte Mitgliedschaften/Sollbeträge bei gleicher ID,
C geänderte maßgebliche Fristen und D unabhängige Datenfehler.

Die historische Vergleichsregel ist ausdrücklich **kein Nachweis der damaligen
Beraterabsicht**: explizites Jahr (>1900), sonst historisches Referenzjahr plus
`max(0, round(years))`; historische Topffrist: frühester expliziter Termin,
sonst Referenz plus minimale Monatslaufzeit. Die aktuelle Rechnung verwendet
unverändert PR40. Die frühere Zeitzone muss ausdrücklich aus dem damaligen
Nutzungskontext bekannt sein. Der Erstumfang unterstützt UTC und Europe/Berlin;
ungeklärte/andere Zeitzonen werden nicht geraten. Die Monats-/Schaltjahrrechnung
bleibt produktiv unverändert. Die alten Regeln sind ausschließlich Diagnose.

`capital-recovery.ts` wählt eine Quelle aus, verifiziert die Sicherung, baut
bei jeder Vorschau einen neuen tiefen Entwurf aus den Quellenbytes und wendet
streng typisierte Entscheidungen an. Erlaubt sind nur Teilbindungsziele und
exakte Aufteilungen, die Einzelreferenz derselben Allokation, der Topf eines
bestehenden Einstiegs sowie ausdrücklich bestätigte abgeleitete Legacybezüge.
Keine Objektpfade, JSON-Patches, Bypassflags oder schemaabhängige Abschaltung
aktueller Validatoren. `reconcilePlanCapitalPots` ist kein H5b-Aufrufpfad.

## Erhaltung und vollständiger Diff

Der zusätzliche vollständige Erhaltungsvergleich folgt einem Ausschlussprinzip:
Jedes Feld und jede Liste bleibt gleich, außer den konkret entschiedenen
Beziehungsfeldern und der deklarierten Schema-10→11-Anhebung. Er erhält auch
unbekannte additive Quelldaten. IDs, Reihenfolgen, Produkte/Namen,
Solution-/Modellbezüge, Allokationsgesamtbeträge, zugeordnete und unzugeordnete
Summen, Reviewwerte, Depot/Holdings, Sparpläne/Zielreferenzen und die gesamte
Historie sind erfasst. Varianten werden separat bilanziert.

Dezimale Summen vergleichen die exakten JSON-Zahlrepräsentationen mit BigInt;
keine implizite Cent-Rundung. Nicht als JSON-Zahl verlustfrei darstellbare
Ergebnisse blockieren. Beim Zusammenführen in einen schon besetzten Topf
werden alle ursprünglichen Teilbeträge addiert. Nullbindungen bleiben
strukturell relevant. Widersprüchliche Maps/Überzuordnung und unklare
Legacybezüge werden nicht automatisch interpretiert.

Der unveränderte H1-Höchstwert liegt in einem gemeinsamen kleinen Blattmodul;
der vorhandene `AmountInput` exportiert weiterhin denselben Wert und behält
seinen Parser. H5b benötigt wegen importierter Präzision einen eigenen exakten
Teilbetragsentwurf: kein Tausendertrennzeichen, Dezimalpunkt oder -komma,
keine still gerundete Eingabe, dieselbe H1-Grenze für neue Teilbeträge. Eine
vollständige unveränderte importierte Bindung darf ihre vorhandene Präzision
und Größenordnung behalten. Bestehende Gesamtbeträge sind nicht editierbar.

Jeder gestaffelte Einstieg behält ID, Allocation-ID, Betrag/Prozentwert,
Ratenanzahl, Rhythmus, Startdatum und Notiz. Die bestehenden
`phasedEntryAmounts`-/Scheduleprüfungen bleiben maßgeblich. Auch der tatsächlich
gestaffelte Betrag eines Prozentplans darf sich nicht durch ein größeres
Ziel ändern. Gemeinsame Einstiege dürfen dieselbe Deckung nicht überziehen.
Eine notwendige Einstiegsteilung oder Änderung von Konditionen ist gesperrt.

## Sicherung und Quellenbindung

Vor der ersten Entwurfsänderung schreibt H5b **immer** einen eigenen Eintrag
unter dem bestehenden Recoverypräfix und liest ihn exakt zurück. Dies gilt
auch bei `recoveryNeeded=false`. Geschriebener Inhalt ist der vollständige
Originalstring des lokalen Bestands oder der gesamten separat gewählten
UTF-8-Quelldatei, einschließlich Formatierung/BOM/Zeilenenden. Dateien werden
nur nach verlustfreiem UTF-8-Roundtrip angenommen. Unlesbare oder mehrdeutige
Eingaben bleiben geschützt.

Zwei getrennte SHA-256-Definitionen gelten:

- Vollquelle: SHA-256 der UTF-8-Originalbytes.
- Ausgewählter Fallinhalt bzw. Snapshot: SHA-256 des kanonischen JSON-Inhalts,
  Objektschlüssel lexikografisch sortiert, Arrayfolge und JSON-Zahlen erhalten.

Die vollständige Originaldatei liegt zusätzlich zum Hash vor. Der Download
liefert ihre unveränderten Bytes; ein Klick ist kein Nachweis einer extern
abgeschlossenen Speicherung. Bei Snapshotauswahl ist der Quellenhash der
Snapshotinhalt; die vollständige Originalquelle enthält zusätzlich den
besitzenden Fall und dessen ganze Historie. Diese Historie wird unverändert
in die neue Arbeitskopie übernommen.

Jede Vorschau und der Commit prüfen Sicherung, Auswahl und Quelle erneut.
Für lokale Quellen macht jede Änderung des vollständigen Originalbestands
die bisherige Sitzung ungültig, auch ein neuer Nachbar: frisch einlesen,
auswählen und bestätigen. Bei separaten Dateiquellen bleibt der aktuelle
Zielbestand unabhängig; P1 liest ihn erst zur Operation frisch ein. Es gibt
keine Speicherung aus einer alten UI-Liste.

## Bestätigung und Herkunft innerhalb Schema 11

`capitalPotRecovery?: CapitalPotRecovery` ist eine streng validierte additive
Erweiterung mit Nachweisformatversion 1. JSON-Export, Import, Reload und weiteres
Speichern erhalten den Nachweis. Er enthält Quelle/Snapshot, Schema/Referenz,
beide Quellenhashes, Regeln/Zone, Diagnoseversion/Unsicherheiten, alle expliziten
Entscheidungen, Beraterkontext, Begründung/Zeit, Prüfresultate und Deckungen sowie
verbleibenden Planungsbedarf. Bei einer weiteren Kopie bleibt eine vorherige
Herkunft als typisiertes `priorRecovery` erhalten; übermäßig verschachtelte
Nachweise werden abgelehnt.

Bestätigung bindet Quellen-/Eintragshash, Zone, Entscheidungen und den
Kandidateninhalt. Dessen SHA-256 umfasst sämtliche Fallinhalte einschließlich
vollständiger Historie, ausgenommen nur äußere Fall-ID, technisches `updatedAt`
und den Herkunftsnachweis selbst. Ein tatsächlicher Inhaltswechsel wird durch
`recoveryConfirmationStatus` neu beurteilt, ohne die alte Erklärung umzuschreiben.
Jede neue Eingabe/Entscheidung, Begründungs- oder Berateränderung hebt die
UI-Bestätigung auf. Noch nicht festgelegte Teilbetragseingaben entziehen auch
die vorherige Teilbindungsentscheidung. Fehlende Bestätigung blockiert Commit.

Offene Deckungen und unveränderte unzugeordnete Beträge dürfen als konkret
angezeigter weiterer Planungsbedarf bestätigt werden. Ungeklärte Reviewbeträge,
unvollständige Reparaturbeträge und Integritäts-/Terminfehler können nicht
bestätigt werden. Freigabe bedeutet ausschließlich weitere Bearbeitung,
keine Geeignetheit, Anlageempfehlung oder Abschlussreife.

Die Herkunft ist browserlokale Dokumentation. Formgerechte fremde Behauptungen
sind keine Authentisierung; manipulierte Nachweise setzen niemals H2/P2/P3/H4
außer Kraft. Unbekannte Zusatzfelder/Formatversionen und inkonsistente
Entscheidungshashes im Nachweis werden abgelehnt und schützen den Originaleintrag.

## Commit und Fehlerzustände

Unmittelbar vor dem Insert: aktueller Bestand und Malformed-Zustand, Quelle,
Sicherung, Erhaltungsdiff, Finanz-/Depot-/Graph-/Identitäts-/Raten-/Umsetzungs-
und Deckungsprüfungen sowie konkrete Bestätigung erneut prüfen. Danach neue
äußere UUID, keine Änderung innerer IDs, ausschließlich `insertCaseIntoStore`.
Erst der erfolgreiche P4/P1-Commit erlaubt die Aktivierung der Kopie.

Sicherungsfehler verhindern den Entwurf. Hauptschreibfehler erhalten den
Hauptbestand; die erfolgreiche Sicherung darf bestehen bleiben. Ein späterer
Anzeigefehler wird ausdrücklich als Anzeigefehler **nach erfolgreicher
Speicherung** gemeldet. P1s Last-Write-Wins-/Cross-Tab-Grenze besteht weiter;
Quellenvergleich und Storageereignisse sind keine atomare Transaktion.

Der reguläre H3-Restore behält seine aktuelle äußere ID und gesamte Historie,
speichert nicht automatisch und lehnt ungültige Snapshots unverändert ab.
Einziger Zusatz: Die Herkunft der aktuellen Kopie bleibt bei erfolgreichem
Restore erhalten; ihre alte Bestätigung legitimiert veränderte Inhalte nicht.
Historische Zeilen und Snapshots werden nicht umgeschrieben.

## Regressionen und Abnahme

`npm run test:h5b-recovery` ist im kanonischen Verify zusätzlich eingebunden.
35 synthetische Gruppen decken R01–R12 und X01–X06 ab: keine Bindung, gleiche
ID/andere Bedarfe, Voll-/Teilverlustschutz, Einstiegserhalt, inaktive Varianten,
Sparziele, unabhängige Fehler, Snapshotquelle, Nachbarn, Schemabegrenzung,
semantisch geänderte volle Deckung; Sicherungs-/Schreibfehler, Grenzen der
Removal-Prüfung, zusätzliche Umsetzungsprüfung, X04/H5a, frühere Frist und
Jahreswechsel rückwärts. Hinzu kommen exakte Summen/Splits, besetzte Ziele,
Nullschlüssel, Review-/Restbeträge, Prozentmodus, doppelte Umsetzung,
Erhaltungsdiff, Bestätigungs-/Quellenänderungen, ID-Kollisionen, UTF-8/BOM,
Herkunft und tatsächliche H3-Handler.

Elf zusätzliche echte Playwrightfälle prüfen vollständige und teilweise
Wiederherstellung mit Originaldownload/Insert/Reload, Bestätigungswiderruf,
gültige ID mit früherer Frist, Backupschreib-/Rücklese-/Hauptschreibfehler,
Snapshotkopie, geänderte Quelle mit neuem Nachbarn, separat importierte Datei
und graphgültige Bedeutungsänderung sowie ungültige Rohmetadaten. Jeder prüft `pageerror`. Die bestehenden
27 Browserfälle und ihre Konfiguration werden unverändert beibehalten.

Maßgeblich sind die tatsächlichen erfolgreichen Verify-/Browser-/R1-Läufe auf
dem finalen Feature-Commit und dem synthetischen PR-Merge, dokumentiert im
Abschlussbericht. Diese Dokumentation behauptet keinen lokalen Browserlauf.

## Bewusst gesperrte Formen

Schema 0–9, unbekannte Schemata, uneindeutige IDs, unbekannte historische Zone,
mehrdeutige Kalenderreferenzen, widersprüchliche Legacy-/Kapitalbindungen,
unabhängige Datenfehler, ungeklärte Reviewbeträge, nicht darstellbare
Präzisionssummen, weitere durch Normalisierung nötige Inhaltskorrekturen und
unmögliche Einstiegspläne bleiben gesperrt. Verlorene Daten werden nicht aus
verkürzten Beständen rekonstruiert. H5a und die bisherigen Migrationen bleiben
unverändert maßgeblich. Kein Versionsbump, Merge, Release oder Deployment.
