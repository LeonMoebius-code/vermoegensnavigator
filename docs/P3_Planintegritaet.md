# P3 – vollständige Planintegrität

Ausgangs-main: `24fc42535aeb3363f4478bee71d571443c3ef9da`, frisch abgerufen am
30.09.2026. Branch: `work/architecture-p3-plan-integrity`; Arbeitsbaum vor Beginn
sauber. Schema **11**, Speicherkey und persistierte Felder bleiben unverändert.

## Ursache und aktueller Vertrag

`weak-plan-integrity` akzeptierte doppelte Plan-IDs, eine ungültige aktive ID und
mehrere bevorzugte Varianten. UI-Fallbacks wählten stattdessen den ersten oder
aktiven Plan. Die gemeinsame Legacy-Normalisierung konnte aktuelle Zuordnungen,
Einstiegspläne, Holdingauswahlen und Sparzielreferenzen still entfernen.

Schema 10/11 wird deshalb vor jeder destruktiven Normalisierung geprüft:

- Mindestens ein Plan; nichtleere String-Plan-IDs, eindeutig innerhalb des Falls.
- `activePlanId` ist ein nichtleerer String und trifft genau einen vorhandenen Plan.
- Null oder eine bevorzugte Variante. Keine automatische Präferenz oder Ersatzwahl.
- Allocation- und InvestmentPlan-IDs sind jeweils nichtleere Strings und **caseweit**
  eindeutig, auch zwischen verschiedenen Varianten. Dies folgt dem P4-Kopiervertrag.
- Gestaffelte Einstiege referenzieren eine Allocation desselben Plans und einen
  bestehenden CapitalPot mit positiver Zuordnung des Allocation-/Topfpaars (4B).
- Persistierte `capitalPotId` und Schlüssel von `capitalPotAmounts` müssen zu den
  aus Advisory, Planvolumen und Fall-Erstellungsdatum abgeleiteten Töpfen gehören.
- `depotHoldingIds` enthält ausschließlich existierende, nichtleere String-IDs;
  innerhalb einer Auswahl sind Duplikate unzulässig.
- Ein vorhandenes Savings-`targetRef` muss als `need` eine existierende numerische
  Need-ID oder als `savingsGoal` eine existierende String-Ziel-ID referenzieren.
  Unbekannte Arten und ungültige Referenzen werden abgelehnt.
- Version-IDs sind nichtleere Strings und innerhalb des Falls eindeutig.

Ein ungültiger aktueller Graph ergibt `null`, keine Reparatur, Löschung oder
Neuvergabe innerer IDs. Gültige aktuelle Planbeziehungen bleiben beim Laden erhalten.
Die vorhandene optionale Depotnormalisierung aus P2 bleibt bestehen.

## Auswahl und Operationen

Active ist die bearbeitete Variante; preferred ist die ausdrücklich gewählte
Zielvariante für Ergebnis/Export. Öffnen ändert nur Active. Bevorzugen setzt genau
eine Präferenz und erhält Active. Reine Helper kapseln diese Operationen sowie
Append und Delete; unbekannte Ziel-IDs ändern nichts. Der aktive Getter wirft bei
einer ungültigen Referenz, ohne den ersten Plan als Ersatz zu benutzen.

Neue, duplizierte und neue Modellvarianten werden aktiv und nicht bevorzugt.
Nur die ursprüngliche Fallanlage setzt ihre initiale Präferenz ausdrücklich.
Bestehende Varianten bleiben beim Anhängen unverändert. P4-Plankopien erhalten
frische Plan-/Allocation-/Investment-IDs und remappen planinterne Einstiegsbezüge.

Der letzte Plan kann nicht gelöscht werden. Löschen eines nicht aktiven Plans
erhält Active. Beim aktiven Plan wird der nächste Plan in der ursprünglichen
Reihenfolge gewählt, am Ende der vorherige. Eine gelöschte bevorzugte Variante
erzeugt keine neue Präferenz. Der Szenarienvergleich erlaubt auch das Löschen
einer nicht aktiven Variante über einen eindeutig benannten Button.

Ohne preferred bleiben Fall, JSON-Sicherung/-Import, Versionen, Checkliste und
Bearbeitung verfügbar. Ergebnis und ZIELPLAN zeigen den stabilen Hinweis
„Keine bevorzugte Zielvariante gewählt. Bitte in der Strukturplanung eine Variante
als bevorzugt markieren.“ Es gibt keine Zielberechnung mit Active oder dem ersten
Plan. Zielabhängige Excel- und Druckbuttons sind deaktiviert; das Druckdokument
wird nicht erzeugt. IST und aktive PLAN-Betrachtung bleiben nutzbar.

## Legacy, Recovery und Restore

Dokumentierte Migrationen für Schema 0–9 bleiben erhalten: Legacy-Buckets und
Reviewbeträge, Schema-6-retain-Auswahl, Schema-7-Produkt-/Topfkonversion zum
gestaffelten Einstieg und Sparratenkonversion, Entfernung mehrdeutiger alter
Einstiege, Schema-8-Risikomigration und Schema-9-Einzeldepotmigration. Der fertige
migrierte Graph wird ebenfalls geprüft; es gibt keine neue allgemeine ID-Reparatur.

`readCaseStore` schützt aktuelle ungültige Originale in `protectedEntries` und
`recoveryEntries`, setzt `recoveryNeeded`, und hält gesunde Nachbarn verfügbar.
Valides JSON ist dabei nicht `malformed`. Gesunde Nachbar-Saves erhalten die
geschützten Inhalte samt bytegenauem, wiederverwendbarem P1-Originalbackup.
Save/Insert/Write validieren neue Kandidaten vor Store- oder Backupmutation.

P4-Fallimport erneuert weiterhin ausschließlich die aktuelle äußere Fall-ID.
Historische Snapshotinhalte bleiben beim normalen Laden unverändert und werden
nicht rückwirkend geprüft oder rekeyed; `snapshot.id` darf die frühere Fall-ID
enthalten. Erst tatsächliches Restore prüft `normalizeImportedCase(snapshot, false)`.
Bei Ablehnung bleiben Live-Fall, aktuelle ID und vollständige Historie erhalten;
bei Erfolg bleiben aktuelle Fall-ID und gesamte aktuelle Versionsliste bestehen.

## Nachweis und Grenzen

`npm run test:p3-plan-integrity` führt `scripts/verify-p3-plan-integrity.tsx` aus:
29 getrennte synthetische Gruppen für Schema 10/11, alle Identitäten/Referenzen,
Input-Unverändertheit, P1-Recovery/Schreibschutz, Legacy, Operationen, fehlende
Präferenz und gültiges/ungültiges Restore über den tatsächlichen ExportCenter-Button.
TSX ist für diese reale Handlerprüfung nötig. Keine Suiteimporte oder Dependencies.

Die P4-Aliasgegenprobe erzeugt absichtlich ungültige Referenzen und eine doppelte
Version-ID. Jetzt bestätigt sie zuerst Schreibablehnung und repariert ausschließlich
diese Testkopie vor dem unveränderten Namespace-/Persistenznachweis. Die CP1-
Nullkupon-Fixture verwendet nun Pläne und Active-ID aus demselben synthetischen Fall.

CP0B bleibt bei genau drei Lebenszyklen. Benannte P3-Schritte im vorhandenen
Planungsflow prüfen A: getrennte Auswahl mit Save/Reload, B: Löschung der nicht
aktiven bevorzugten Variante und persistierte Nullpräferenz, C: sichtbaren Hinweis
ohne Export-/Ergebnisfallback, D: Löschung der aktiven Kopie und Nachbarwahl,
E: beschädigten tatsächlichen JSON-Backupimport mit unveränderten Storebytes,
Live-Fall und Ansicht. Globale Relationsprüfungen erlauben null oder eine Präferenz.

P3 folgt im sequenziellen Fail-Fast-Gate nach P2 und vor D1/Typecheck; danach genau
ein Produktionsbuild und CP0B. `npm test` delegiert vollständig an `verify`.
P3 ist im vorhandenen Typecheck enthalten; CI und Releaseworkflow bleiben unverändert.

Nur `weak-plan-integrity` wechselt C → A: **21 A / 0 B / 1 C / 1 D →
22 A / 0 B / 0 C / 1 D**. `general-export-scope` war zu diesem historischen P3-Stand noch D.
Aktuell nach [D1](D1_Ergebnis_Export_Sichtenvertrag.md): **23 A / 0 B / 0 C / 0 D**;
`general-export-scope` ist A und der fehlende-preferred-Vertrag bleibt erhalten. Keine Schema-/UUID-/Persistenzmigration,
Monolithzerlegung, Bond-/CSV-/Reportingänderung, Veröffentlichung oder GitHub-
Einstellungsänderung. Abnahme und tatsächliche CI-Logs werden in der offenen PR
und im Abschlussbericht dokumentiert; Merge und Release sind separate Aufträge.
