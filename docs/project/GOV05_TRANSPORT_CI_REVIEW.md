# GOV-05 · Transport, vollständige CI und unabhängige Abnahme

Kritische Governance. Die vorgeschlagenen D-22 bis D-24 werden erst nach der
[gesonderten Integration](OPERATING_MODEL.md#gov-05-übergang-und-wirksamkeit)
wirksam. Der Draft führt die technische PR-Prüfung aus. Für seine Abnahme
gelten die bisherigen vollständigen unabhängigen Doppelreviews.

## D-22 · Transport

- Der konkrete Work-Auftrag bestimmt Branch, Scope und Befugnis. Bei neuen
  Branches die Abwesenheit des autorisierten Namens und die Basis frisch prüfen.
  Direktes Parentpaar ist lokal und remote identisch: bei der Erstanlage der
  verifizierte main-Stand, bei der Korrektur der frisch bestätigte Feature-Head.
- Neue Refs exklusiv anlegen. Für Korrekturen die erwartete alte Head-SHA beim
  tatsächlichen Ref-Update atomar oder gleichwertig absichern und nur einen
  direkten Fast-forward zulassen. Eine Vorabprüfung allein bindet den Ref nicht.
  Jeden Folgecommit erneut binden. Lokale Originalobjekte prüfbar erhalten.
- Vor und nach Transport tatsächliche Commit- und Tree-Objekte prüfen. Die
  vollständige rekursive Identität schließt Pfade, Struktur, Bytes und
  Dateimodi ein. Original, Remote, Parent und Tree transparent festhalten.
  Abweichende Commitmetadaten allein brauchen keine weitere Einzelgenehmigung.
- Bei unerwartetem Ref-/Base-Wechsel, fremder Arbeit, fehlenden Originalen,
  fehlender Bindung, fehlenden Rechten oder neuer Scope-/Fachentscheidung
  anhalten. Bestehende Arbeit schützen und Basiswechsel beurteilen.
  Rebase, Squash, Force-Push, Direkt-main, Merge und Sonderoperationen
  brauchen ihre eigenen geltenden Voraussetzungen und Befugnisse.
- Die einmalige historische Transportausnahme zum PR-#88-Original
  `5384c0a6282b82565c4e3ae50235d1d302b919a2` bleibt ausschließlich diesem
  Fall zugeordnet. Governance-Transport und Governance-Merge sind jeweils
  konkret zu autorisieren. D-21 verlangt weiterhin finale Push- und PR-CI.

## D-23 · Vollständige PR-Prüfung

| Job | Verbindliche Prüfung |
| --- | --- |
| Build, Browserinventar und R1 | Ein Pages-Build auf dem synthetischen PR-Merge. R1 prüft die versiegelten Buildbytes und führt die vollständigen Operationalregressionen mit Wegwerfkopien aus. Playwright liefert das vollständige Inventar und vier Zuordnungen. Ein Run-/Attempt-Artefakt enthält Build und Plan. |
| Fachtests und Typecheck | Der Fach- und Typecheck-Teil von `npm run verify` läuft auf einem eigenen Runner. GOV-03/04-Regressionsschutz und Diffcheck bleiben Pflicht. |
| Browser-Shards 1–4 | Eigene Runner, je ein Worker, eigene Server und Diagnosen. Der Build wird vor und nach dem Lauf anhand von R1-Manifest, Build- und Planprüfsumme geprüft. Das Inventar identifiziert Fälle über Playwright-ID, Projekt, Datei und vollständigen internen Titelpfad. Ergebnisse müssen für jeden zugeordneten Fall genau einmal `passed` sein. |
| Tests, Typecheck, Build und Browser | Einziger Pflichtstatus, `always()` nach allen drei Jobgruppen. Prüft GitHub-Jobresultate und veröffentlichte Pflichtstep-Abschlüsse des exakten Attempts, `outcome` und `conclusion` in den Receipts, die vollständige Shard-Menge und Buildbindung. Prüft tatsächliche Git-Objekte und aktuelle main-/PR-Head-/Merge-Refs erneut. |

Die Artefaktnamen binden Run und Attempt. Fehlende oder fremde Receipts, Jobs
oder Testidentitäten sperren das Gate. Bei Wiederholung den vollständigen
regulären Lauf ausführen. Job- oder Fehlerruns allein liefern keinen
vollständigen neuen Attempt. Der Abschluss verwendet ein auf Lesen begrenztes
Actions-Token für die strukturierten Jobdaten. Der Required Check bleibt an
GitHub Actions (App 15368) und das bestehende strikte main-Ruleset gebunden.

Der lokale Einstieg und der Releasepfad führen `npm run verify` weiterhin
vollständig aus. Development CI bleibt der schnelle Push-Pfad. Die verteilte
Browserprüfung verwendet die bestehende Suite und den echten Pages-Server.
Bereits vorhandene fachliche Vergleichs-Fixtures behalten ihre Aufgabe.
Testdateien, CP0B, Retry-Verhalten, Release- und Rollback-Verträge bleiben
unverändert. Laufzeiten werden an erfolgreichen regulären Läufen verglichen.

## D-24 · Unabhängige Abnahme und Übergabe

- Im Initialreview den gesamten relevanten Diff und alle betroffenen Verträge
  risikogerecht prüfen. Eigene gezielte Gegenproben decken kritische Grenzen,
  neu entstandene Risiken, Ausgabepfade und konkrete Zweifel ab. Verifizierte
  vollständige finale CI belegt die Vollsuite. Ein weiterer Vollbrowserlauf
  pro Reviewer ist bei schlüssigen Originalbelegen entbehrlich.
- Standardfeatures erfordern einen vollständigen unabhängigen Review.
  Kritische Änderungen erfordern zwei voneinander und von Work unabhängige
  vollständige Reviews. Beide Entscheidungen binden den exakten finalen Head.
  Gleichwertige Assertions dürfen mehrere Anforderungen gemeinsam belegen.
- Nach HOLD prüft jeder erforderliche Reviewer Korrekturdiff, tatsächliche
  Abhängigkeiten, ursprüngliche Gegenproben, neue Risiken und finale Identität.
  Eigene frühere Teilnachweise nur mit kurzer Begründung übernehmen, wenn
  Code, Daten, Fachregeln, Abhängigkeiten und Prüfbedingungen unverändert
  oder nachweislich weiter gültig sind. Bei neuer Abhängigkeit die betroffene
  Prüfung erneuern. Ein Fremdvotum oder früheres Gesamt-GO reicht dafür nicht.
- Neue materielle Befunde, ungedeckte Anforderungen und unklare Bedingungen
  bedeuten HOLD. Aus R88-A01 bis A03 folgen schlanke Gegenproben und
  gebündelte Evidenz. R88-A04 (CP0B) und R88-A05 (konkrete Tarifnachweise)
  gelten jeweils fallbezogen. Ein Bestandsfehler erfordert einen Base-/Head-
  Nachweis, begrenztes Risiko und die zuständige separate Entscheidung.
- Work und Reviewer liefern jeweils maximal 10–12 Chatzeilen und ein kompaktes
  ZIP mit Identitäten, CI-/Originalreferenzen, wesentlichen Gegenproben und
  offenen Punkten. Gefährdete notwendige Originale gezielt sichern. Die
  Projektleitung prüft Identität, Gates, Ergebnisse und Restrisiken kompakt.
  AP-07c und ORG-O01 bleiben offen.
