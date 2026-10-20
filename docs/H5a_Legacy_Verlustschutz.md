# H5a – Schutz vor verlustbehafteter Legacy-Konvertierung

Basis: main `6fe15c12d1f814ec99e9e8c42b7e6f60b56f9620`, V0.18.3,
Schema 11. Branch `work/h5a-legacy-loss-protection`. Fachliche Grundlage:
H5-Analyse- und Entscheidungsbericht vom 15.10.2026, insbesondere X04 und
die Legacy-Evidenzgrenze. Dieser Auftrag implementiert ausschließlich H5a.

## Zuerst ausgeführte rote Regression

Vor jeder Produktänderung wurden sieben neue Regressionen ausgeführt.
Ergebnis: **0 bestanden, 7 fehlgeschlagen**. Die rohe synthetische Eingabe
blieb beim Lesen unverändert; der ausgegebene Arbeitsfall verlor dennoch Daten.

| Prüfung | Beobachtung vor Korrektur | Verbindlicher Sollzustand |
| --- | --- | --- |
| Schema 9, Allokation 10.000 EUR im entfallenen `year-2027` | Normalisierung erfolgreich, 0 Allokationen, 0 Einstiege | Ablehnung vor Konvertierung |
| 6.000 EUR alter Jahrestopf, 4.000 EUR strategisch | Erfolgreicher Fall mit auf 4.000 EUR gekürzter Allokation | Vollständiges Original schützen |
| Lesen mit gesundem Nachbarn | `recoveryNeeded=false`, 0 Protected Entries | Recovery erforderlich, nur Nachbar bearbeitbar |
| Nachbarspeichern | Altfall als Schema 11 ohne Allokation/Einstieg persistiert, 0 Backups | Originalobjekt erhalten, vollständige Quellbytes sichern |
| JSON-Einzelimport, direkt und mit `case`-Hülle | Gekürzte neue Fallkopie angenommen | Import ohne Seiteneffekt ablehnen |
| Tatsächlicher ExportCenter-Restorehandler | Gekürzter Snapshot wird Arbeitsstand | Kein State-/Historien-/Storageschreiben |
| Backupfehler vor Nachbarspeichern | Kein Backupversuch, Speicherung erfolgreich | Mutation abbrechen |

Es wurden ausschließlich synthetische Daten und isolierte In-Memory-Stores
verwendet. Die Reproduktion beweist keinen tatsächlichen Kundendatenverlust.

## Ursache und Schutzgrenze

Schema 10/11 besitzt die vorgeschaltete P3-Graphprüfung. Schema 0–9 konnte
zunächst alte Feldformate konvertieren und anschließend reconciliieren.
Reconciliation kann vollständige Allokationen entfernen, Teilbeträge kürzen
und abhängige Einstiege löschen. Die nachgelagerte Graphprüfung erkennt den
Verlust nicht, wenn der verbleibende leere Graph gültig ist.

`legacyCapitalProtection` liest den unveränderten Eingang vor Clone,
Depotwertableitung, Bucket-/Investmentmigration und Reconciliation. Sie ruft
weder Normalisierung noch Reconciliation auf und verändert keine Quelldaten.
Sie prüft sämtliche Varianten, beide expliziten Kapitaltopfreferenzformen,
auch Nullschlüssel, Beträge, alte Bucketziele und sämtliche Investmentpläne.
Die Prüfung prognostiziert erlaubte Konversionen anhand der dokumentierten
Feldverträge; ein bereits bereinigter Roundtrip ist kein Erhaltungsbeleg.

| Ergebnis | Bedeutung |
| --- | --- |
| `safe` | Keine hier erkannte verlustbehaftete Kapitalbindungskonversion; sämtliche übrigen Validatoren bleiben maßgeblich |
| `historical-bindings` | Gespeicherter Jahresbezug ist aktuell nicht vorhanden; mögliche historische Kalenderabweichung, keine bewiesene Beschädigung oder Herkunft |
| `ambiguous-legacy` | Keine sicher erhaltbare Interpretation, z.B. mehrere Bucketziele/Produktmatches, Nullzuordnungen mit möglicher Umdeutung, verlorener Einstieg oder Überzuordnung mit Betragsänderung |
| `invalid-data` | Unabhängiger Eingangsfehler, ungültige Identität/Referenz oder Finanz-/Ratenprüfung nicht bestanden |

Die Klassifikation ist kein vollständiger Korruptionsdiagnostiker. Gemischte
Fehler können zusätzlich vorliegen. Insbesondere beweist ein gespeicherter
Jahresschlüssel nicht seine Entstehung unter einer bestimmten früheren Formel.
Es gibt keine Ersatzrechnung mit geratenem Altjahr, kein Remapping und keinen
Validierungsfreipass. Ein erfolgreiches Ergebnis ersetzt niemals H2/P2/P3/H4.

## Weiterhin zulässige Migrationen und bewusst geschützte Formen

Erhalten sind eindeutig abbildbare Bucketzuordnungen, einschließlich expliziter
numerischer Legacy-Bucketstrings, eindeutige produktbasierte Einstiege vor
Schema 8 mit `installmentAmount × installments`, Sparratenkonversion,
Ratenstring-/Defaultregeln aus H4, Risikomigration, Einzeldepotmigration und
die Schema-6-retain-Auswahl. Vorhandene Reviewbeträge an erhaltenen aktuellen
Topfzuordnungen und unzugeordnete Betragsanteile bleiben erhalten. Es wird nicht
auf Cent gerundet. Unvollständige aktuelle Planungen bleiben zulässig.

Geschützt bleiben insbesondere entfallene Jahresbezüge, mehrdeutige alte
Bucketdarstellungen, die sonst nur noch in einen neuen Review-Sammelbetrag
überführt würden, mehrdeutige alte produktbasierte Einstiege, moderne
Investmentfelder unter einem alten Schema ohne erforderliche historische
Produkt-/Ratenfelder, explizite Nullbindungen mit möglicher Neudeutung und
Legacy-Einstiege, die Reconciliation entfernen würde. Auch eine alte
Überzuordnung, deren Bereinigung den Allokationsbetrag erhöhen würde, wird
geschützt. Keine Rekonstruktion bereits verlorener Werte.

Die Schema-0–9-Matrix mit heutigen Topffeldern belegt zugelassene synthetische
Feldkombinationen, nicht historische Erzeugungsformate jeder dieser Versionen.
Schema 8/9 besitzt bereits den aktuellen Allocation-/Topf-Einstiegsbezug.
Dokumentierte Bucket-/Produktdarstellungen werden deshalb separat getestet.

## Eintrittspunkte und bestehende Verträge

Die Prüfung liegt im gemeinsamen `normalizeImportedCase` und gilt dadurch
für `readCaseStore`, direkten/wrapped JSON-Import, tatsächliches Restore und
die Kandidatenprüfung sämtlicher P1-Mutatoren. Gefährdete Fälle gelangen nicht
in den normalen Editor. Dessen reguläre Bearbeitungs-Reconciliation bleibt
unverändert und ist kein Wiederherstellungsweg.

P1 schützt das vollständige rohe Eintragsobjekt in `protectedEntries` und
`recoveryEntries`; der Leser schreibt nichts. Vor einer Bestandsmutation
sichert der bestehende P1-Pfad den vollständigen Originalstring und liest ihn
zurück. Ein geeignetes vorhandenes Backup darf nach unverändertem
Vollständigkeits-/Multiplizitätsvertrag weiterverwendet werden. Hauptstore-
Serialisierung darf Formatierung/Reihenfolge ändern; die ursprünglichen
Gesamtbytes bleiben im verifizierten Backup. Geschützte IDs sind weder
überschreibbar noch löschbar. Gesunde aktuelle Nachbarn bleiben verfügbar.

P2, P3, H2 und H4 bleiben unverändert vollständig aktiv. P4 erzeugt bei
zulässigem Import weiterhin nur eine neue äußere ID. Historische Snapshots
werden weder beim Laden noch beim Anzeigen rekursiv migriert. Ein abgelehnter
Restore verändert weder Arbeitsstand, Historie noch Store/Backups. Ein gültiger
Restore erhält aktuelle Fall-ID und gesamte aktuelle Historie.

Die bestehende Recovery-Anzeige nennt historische Kapitalbindungen und die
notwendige fachliche Prüfung, ohne das Original als nachgewiesen beschädigt
zu bezeichnen. Import-/Restore-Ablehnung erhalten denselben sachlichen Hinweis.
Es werden keine Namen, Positionswerte oder Rohdaten in Fehlermeldungen aufgenommen.

## Regressionen und Anpassung älterer Testannahmen

`test:h5a-legacy-loss` ist im unveränderten sequenziellen Verify vor Typecheck,
einmaligem Build und Browsergate ergänzt. Die Suite prüft reale Speicher-APIs,
Originalbackup, Wiederverwendung/fehlendes Vorbackup, Rücklese-/Quota-/Hauptfehler,
geschützte IDs, neue Nachbarn bei veraltetem Lesestand, Duplikatmultiplizität,
opake Historie, Import und den tatsächlich produktiven Restore-Buttonhandler.
Fünf zusätzliche Playwright-Fälle prüfen echte Downloads, Save/Reload,
Import-/Restoreablehnung, Backupfehler und erfolgreichen alten Bucketimport.
CP0B bleibt bei drei eigenen Lebenszyklen; bestehende Modellportfolio- und
PR40-Browserfälle bleiben unverändert.

Ältere Assertions, die stille Allokations-/Einstiegslöschung ausdrücklich
erwarteten (4B/P3), verlangen nun Ablehnung des vollständigen Originals.
Ihre positiven Migrationsgegenproben bleiben erhalten. P3 verwendet vor
Schema 8 die dokumentierten Produkt-/Ratenfelder; H2 trennt in seiner
Betragsstringprobe ein eindeutiges Produktmatch von der nun separat getesteten
Mehrdeutigkeit. Die CP0A2-Depotmigrationsprobe erhält einen positiven eindeutigen
Bucketzielbetrag und prüft zusätzlich den Erhalt der Allokation, statt sich auf
die frühere Umdeutung ihrer synthetischen Nullvolumenplanung zu verlassen.
Keine Golden-Erwartung, Sicherheitsprüfung oder Finanzvalidierung wurde gelockert.

## Umfang und verbleibende Grenzen

Kein H5b-Assistent, keine Fallkopienreparatur, keine Herkunftsmetadaten,
kein Schema-/Dependency-/Workflow-/Produktdatenumbau. Gleichbleibende gültige
Jahres-IDs mit geänderter fachlicher Bedeutung oder früherer Einstiegsfrist
werden nicht allein durch H5a fachlich freigegeben oder automatisch korrigiert.
P1 bleibt Last-Write-Wins ohne atomare Cross-Tab-Garantie. Originalsicherungen
sind browserlokal; H5a macht die Anwendung nicht revisionssicher.

Vollständige Ergebnisse auf finalem Feature-Commit und tatsächlichem
synthetischem PR-Merge sowie Checkout-/Tree-/Artefaktidentitäten werden im
externen Abschlussbericht nach Ausführung der vorhandenen Feature CI belegt.
Kein Merge, Versionsbump, Release, Rollback oder Deployment.
