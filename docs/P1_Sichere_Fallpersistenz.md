# P1: sichere Fallpersistenz

Ausgangs-main: `225ee5df1c813396e3adf6b79e37b14e482bbbef` (P4, PR #15),
nach Remote-Fetch bestätigt. Sauberer Arbeitsbaum, keine offenen PRs.
Branch: `work/architecture-p1-safe-case-store`.

## Ursache und autoritative Quelle

`stale-local-list` entstand, weil `app/page.tsx` eine vollständige Liste aus
React-`savedCases` an `writeCaseStore` übergab. Dessen erneutes Lesen erhielt
nur geschützte Originaleinträge; gesunde Fälle wurden durch den UI-Snapshot
ersetzt. Fehlende IDs konnten sowohl bewusste Löschungen als auch unbekannte
zwischenzeitliche Neuanlagen bedeuten.

Autoritativ für die Fallmenge ist der unmittelbar aktuelle Store unter
`vermoegensnavigator-cases-v2`. `savedCases` dient Darstellung und Navigation.
Normale Aktionen übergeben einen Fall oder eine ID, keine vollständige Liste.

## Operationsvertrag in `app/case-storage.ts`

| API | Mutation am unmittelbar neu gelesenen Store |
| --- | --- |
| `saveCaseToStore(storage, item)` | Gesunden Fall gleicher äußerer ID an seiner Position ersetzen; sonst vorne hinzufügen. Alle anderen aktuellen gesunden Fälle erhalten. |
| `insertCaseIntoStore(storage, item)` | Eigenständigen neuen Fall vorne hinzufügen; vorhandene gesunde oder geschützte ID führt zum Abbruch. |
| `removeCaseFromStore(storage, id)` | Nur den gesunden Fall dieser ID entfernen. Fehlende ID sicher idempotent behandeln; geschützte Original-ID nicht löschen. |
| `writeCaseStore(storage, cases)` | Explizite niedrigstufige Vollersetzung des gesunden Bestands; geschützte Originale erhalten. Für bestehende vollständige Test-/Storeoperationen, nicht für normale UI-Aktionen. |

Alle vier APIs teilen einen internen Mutations-/Commitpfad. Dieser liest einmal
unmittelbar vor der Auswahl der Mutation, validiert und schreibt. Rückgabe ist
der erfolgreich gespeicherte gesunde Bestand in Store-Reihenfolge.
`readCaseStore` behält seine bisherige Normalisierung einschließlich des
technischen `updatedAt` beim Laden. Gesunde Nachbarn bleiben mit ihrer Identität
und aktuellen fachlichen Daten erhalten; P1 baut diese Normalisierung nicht um.

## Produktpfade und UI-State

Save erstellt weiterhin aus `activeCase` den Fall mit `updatedAt` und optionaler
Versionshistorie. Nur dieser Fall geht an `saveCaseToStore`; nach Erfolg werden
`savedCases` aus dem Ergebnis und `activeCase` aus dem gespeicherten Fall gesetzt.
Delete bestätigt wie bisher und übergibt allein die gewünschte ID.

Der vollständige JSON-Import parst und ruft `normalizeImportedCase` auf, danach
`insertCaseIntoStore`. Erst nach erfolgreicher Persistenz werden aktiver Fall,
Berater und Wizard gesetzt. Fehlschläge bleiben im vorhandenen `storageNotice`;
der bisherige aktive Fall wird nicht als erfolgreich importierter Fall ersetzt.
Der Dateieingang wird auch bei Abbruch zurückgesetzt.

Beispiele mit bewusst veraltetem UI-Snapshot:

- UI kennt `[A]`, Store inzwischen `[A, B]`: Save von A erhält B.
- UI kennt `[A, B]`, Store inzwischen `[A]`: Save von A belebt B nicht wieder.
- Store enthält inzwischen B: Neuanlage C/Import erhält B und fügt C hinzu.
- UI kennt alten Bestand, Store inzwischen `[A, B, C]`: Delete A erhält B/C.

## Recovery und Integrität

Malformed JSON oder ein Gesamtstore ohne Array blockiert jede Mutation; die
Originalbytes bleiben unverändert. Fehlende/doppelte Schreib-IDs, strukturell
ungültige Kandidaten und Kollisionen mit geschützten IDs werden abgelehnt.
Bestehende defekte, zukünftige Schema- und doppelte Originaleinträge bleiben
geschützt und recoverable. Depotwert-Normalisierung bleibt erhalten.

Vor einer erforderlichen bereinigenden Speicherung wird das bytegenaue Original
gesichert und das Backup zurückgelesen. Ein geeignetes vorhandenes Backup wird
weiterverwendet, wenn es sämtliche Recoveryeinträge einschließlich ihrer
Duplikatanzahl enthält. Unveränderte Defekte erzeugen keine Backup-Multiplikation;
neue beschädigte Daten erfordern eine neue Originalsicherung. Backupfehler
verhindern den Hauptschreibvorgang; dessen Quota-Fehler erhalten den Hauptstore.

## Absicherung und Grenzen

`scripts/verify-p1-case-store.ts` testet direkt die produktiven APIs mit zwei
logisch getrennten Clients und explizit veralteten Snapshots. Zwölf synthetische
Gruppen prüfen Mengen-/Inhaltsvertrag, Rückgaben, ID-Schutz, malformed Stores,
Protected Entries, bytegenaue Backups, Wiederverwendung und Schreibfehler.
`test:p1-case-store` folgt im sequenziellen Fail-Fast-Gate nach P4, dann P2, P3 und Typecheck;
danach genau ein Produktionsbuild und CP0B. `npm test` delegiert weiter an `verify`.

Im bestehenden CP0B-Planungs-/Fallidentitätsflow verändert ein externer Kontext
denselben LocalStorage ohne Reload. Der echte Speichern-Button erhält einen
hinzugefügten Nachbarn, synchronisiert die React-Liste und belebt diesen nach
externer Löschung nicht wieder. Ein fehlgeschlagener Import bei malformed Store
erhält zusätzlich Originalbytes, aktiven Fall und Exportansicht.
Es bleiben genau drei CP0B-Lebenszyklen.
CP0A2 `stale-local-list` wechselt allein C → A:
**19 A / 0 B / 3 C / 1 D → 20 A / 0 B / 2 C / 1 D**.

Same-ID-Bearbeitungen bleiben ausdrücklich Last-Write-Wins. Keine Konfliktauflösung,
Revisionierung, Live-Synchronisation oder Sperren. LocalStorage bietet hier keine
atomare, linearisierbare Cross-Tab-Transaktion; ein echtes gleichzeitiges Rennen
zweier Read-/Write-Operationen ist keine P1-Garantie. Abgesichert wird die bekannte
Ursache des vollständigen veralteten React-Snapshots.

Schema **11**, Speicherkey, P4-Import-/Plankopie- und Restore-ID-Verträge bleiben
erhalten. [P2](P2_Depotreferenzintegritaet.md) behebt inzwischen
`invalid-depot-fallback`: Ungültige aktuelle Depotreferenzen werden zentral
abgelehnt, Originale geschützt und beim gesunden Nachbar-Save samt bytegenauem
Backup erhalten; neue ungültige Save-/Insert-/Write-Kandidaten schreiben nichts.
Aktuell nach [P3](P3_Planintegritaet.md): **22 A / 0 B / 0 C / 1 D**.
`weak-plan-integrity` ist A: ungültige aktuelle Plangraphen werden abgelehnt,
P1-Protected-Entries und bytegenaue Backup-Wiederverwendung bleiben erhalten.
`general-export-scope` bleibt D. Keine Migration, Reportingentscheidung oder Releaseprozessänderung.
