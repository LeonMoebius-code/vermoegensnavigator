# H3 – Sichere Historienanzeige und Restore

Ausgangsstand: `90df6e3cf5ad5f3f1b46b5717dae625ab20164d2`, Tree
`ebb87de0d6a4a52f4cb495fdd01bc7b4d1c954fe`. H1 und H2 sind integriert.
H4 bleibt ein eigener Auftrag. Schema bleibt 11.

## Auf dem Ausgangsstand ausgeführte Reproduktion

Nur synthetische Fälle; produktives ExportCenter und echter Restore-Handler,
zusätzlich die tatsächliche Importnormalisierung auf einem separaten Base-Worktree:

| Finding | Ausgeführter Fall | Ausgangsergebnis |
| --- | --- | --- |
| F-001 | Snapshot fehlt; `plans: null`; `plans: [null]` | Renderexception bei `plans`, `length` beziehungsweise `preferred` |
| F-002 | Label als Objekt | React lehnt das Objekt als Child ab |
| F-003 | Sparziele mit null, Zahl, String, Array, leerem Objekt, fehlendem targetAmount oder Stringbetrag | H2 liefert bereits kontrolliert null; tatsächlicher Restore eines null-Elements verändert keinen State |
| F-004 | Numerischer Depotkontoname im aktuellen Import oder historischen Snapshot | Normalisierung wirft `.trim()`-Exception; diese verlässt auch den tatsächlichen Restore-Handler |

Beschädigte historische Snapshots bleiben beim normalen Laden opak. Der gültige
aktuelle Fall mit diesen Versionen wird auf dem Ausgangsstand angenommen.
F-003 wird deshalb nicht als neu durch H3 behobene finanzielle Validierung dargestellt.

## Kleine Korrektur

`ExportCenter` verwendet zwei lokale Anzeigehelfer. Ein nichtleerer Stringlabel
bleibt einschließlich seiner ursprünglichen Leerzeichen erhalten. Fehlende,
leere, nur aus Leerzeichen bestehende oder typfalsche Labels zeigen
„Version ohne gültige Bezeichnung“. Derselbe sichere Text erscheint in der
Restore-Bestätigung. Das Original wird nicht umgeschrieben.

Die Vorschau liest ausschließlich Snapshot-Objekt, Planarray und die primitiven
Metadaten `name` und `preferred`. Für fehlende oder nicht sicher lesbare Strukturen
erscheint „Historische Vorschau nicht verfügbar“. Leere Arrays zeigen wahrheitsgemäß
0 Planungen; ohne bevorzugte Variante erscheint „–“. Mehrere Preferred-Markierungen
ergeben keine erfundene Zielvariante. Keine Snapshotnormalisierung oder
Kapitaltopfrechnung beim Rendern. Alle Historienzeilen und ihre Restore-Schaltflächen
bleiben vorhanden; eine echte Wiederherstellbarkeit wird erst beim Restore geprüft.

Nach Bestätigung wird ausschließlich `normalizeImportedCase(snapshot, false)`
innerhalb einer Fehlergrenze ausgeführt. Sowohl null als auch Exceptions führen zu
folgendem Browserhinweis:

> Diese historische Version kann aufgrund beschädigter Daten nicht wiederhergestellt werden. Der aktuelle Arbeitsstand bleibt unverändert.

Ergänzung durch [H5a](H5a_Legacy_Verlustschutz.md): Bei geschützten historischen
Kapitalbindungen erscheint stattdessen ein sachlicher Hinweis auf fachliche
Prüfung und Originalerhalt. Eine mögliche verlustbehaftete Konvertierung wird
nicht als bewiesene Beschädigung des Originals bezeichnet. Die vollständige
Prüfung und die Seiteneffektfreiheit der Ablehnung bleiben bestehen.

Keine Rohdaten im Fehlertext. Abbruch vor Normalisierung bleibt folgenlos.
Erst erfolgreiche Normalisierung ruft die bisherige State-Aktualisierung auf:
aktuelle äußere Fall-ID und vollständige Historie bleiben erhalten, `updatedAt`
wird aktualisiert. Kein automatisches Speichern oder Recovery-Schreiben.

Die vorhandene Depotkontonormalisierung weist einen vorhandenen Nicht-Stringnamen
vor `.trim()` mit null zurück. Dazu zählen Zahl, null, Array, Objekt und Boolean.
Fehlender Name, leerer String und Whitespace behalten den bisherigen `Depot N`-Default;
gültige Strings behalten das bisherige Trimmen. Keine allgemeine Depotvalidierungsreform.

## Dauerhafte Nachweise

`npm run test:h3-history-restore` läuft genau einmal in `npm run verify` vor
Typecheck, dem einzigen Produktionsbuild und CP0B. Der neue Test ist im Typecheck.

- 11 Gruppen: 33 produktive Rendervarianten, 34 kontrollierte Restore-Ablehnungen.
- Produktiver Eventhandler: gültiger Restore, ungültige Planidentitäten/Referenzen,
  widersprüchliches Preferred, F-003/F-004 und H2-Finanzbeträge.
- Eine echte BigInt-Serialisierungs-Exception in synthetischen Runtime-Metadaten
  prüft den catch-Pfad; keine bloß simulierte Ausnahme oder neue Dependency.
- JSON-Import → Normalisierung → Insert → Reload → produktives ExportCenter →
  Restore → explizites Speichern → Reload. Historische Originale unverändert,
  neue äußere Import-ID, unveränderte innere Identitäten und gesunde Nachbarn.
- P1: ungültige aktuelle Kontonamen geschützt; vollständiges bytegleiches
  Originalbackup erzeugt und wiederverwendet. Fehlgeschlagener Restore verändert
  auch bereits vorhandene Recoverybackups nicht.
- Fachliche Kontrollwerte für IST und PLAN; aktive und bevorzugte Planung unabhängig.

Der bestehende CP0B-Planungslebenszyklus ergänzt einen realen JSON-Upload mit sechs
Versionen: gültiger Snapshot, null-Snapshot, null-Sparziel, numerischer Kontoname,
Stringfinanzbetrag und gültiger Snapshot mit Objektlabel. Alle sechs bleiben
sichtbar. Vier bestätigte Fehlversuche prüfen exakte Benutzerinformation,
unveränderten Arbeitsstand und bytegleichen Hauptstore sowie sämtliche anderen
localStorage-Werte. Der sichere Bestätigungstext wird mit Abbruch geprüft.
Der gesunde Restore, explizites Speichern und echter Reload erhalten Fall-ID,
Historie, Planungen und Nachbarfälle. Browser-pageerror wird mitüberwacht.

Die vorhandenen gültigen Restore- und Abbruchprüfungen bleiben bestehen.
CP0B bleibt bei genau drei unabhängigen Lebenszyklen, einem Worker, null Retries
und unveränderten Launchflags. Bestehende CP0A2-/P3-Testumgebungen ergänzen nur die
jetzt benötigte `window.alert`-Funktion mit Prüfung des vollständigen Fehlertexts;
alle bestehenden Assertions bleiben erhalten. Keine Goldenänderung.

## Bewusst erhaltene Grenzen

Historische Originalsnapshots werden weder tief geprüft noch migriert, gelöscht
oder repariert. Historische Vorschaumetadaten sind keine Vollvalidierung der
Wiederherstellbarkeit. H2-Finanzregeln und P3-Graphprüfung bleiben maßgeblich.
Keine Änderung an P1-Persistenz, P4-Identitäten, H1-Parser, D1-Kennzahlen,
Finanzrechenkernen, Dependencies, CI-Verträgen oder Playwright-Konfiguration.
Keine neue Cross-Tab-Transaktion und kein Preferred-Fallback.

Kanonisches Verify und nachgelagertes R1/Artefaktvalidator sind getrennte Gates.
Ergebnis- und Git-/CI-Identitäten werden im externen Abschlussbericht dokumentiert.
Kein Merge, Release, Rollback oder Deployment.
