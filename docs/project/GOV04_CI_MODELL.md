# GOV-04: Entwicklungs-CI und vollständige Integrationsprüfung

Status: zur Umsetzung freigegeben, noch nicht integriert. Kritische Governance-
und CI-Änderung. Zwei organisatorisch unabhängige vollständige Reviews und Leons
gesonderte Integrationsentscheidung erforderlich. Es gilt die
[Übergangsgrenze](OPERATING_MODEL.md#gov-04-übergang-und-wirksamkeit).

## Ausführbarer Vertrag

| Auslöser | Workflow / Job | Pflichtumfang |
| --- | --- | --- |
| Push auf `work/**` | Development CI / Schnelle Entwicklungsprüfung | GOV-03-Checkout-JSON, Identitäts-/Integrationsregressionen, `npm run verify:development`, Diffcheck. |
| PR gegen main | Feature CI / Vollständige PR-Prüfung (`verify`) | GOV-03-JSON, CI-Regressionen, npm ci, Chromium, unverändertes `npm run verify`, R1-Artefaktvalidator, vollständige R1-Operationaltests, Diffcheck, Vollständigkeits- und Aktualitätsbestätigung. |
| Abschluss desselben PR-Laufs | Feature CI / **Tests, Typecheck, Build und Browser** (`integration`) | `always()` nach `verify`. Nur explizites `success`, vollständige Bestätigung und aktuelle identische main-/Head-/Merge-Refs geben den bisherigen erforderlichen Status erfolgreich frei. |

Schnellumfang: H2-Finanzvalidierung, P1/P2/P3/P4-Speicher-/Referenz-/Copyverträge,
H3/H4/H5a/H5b-Verlustschutz, P2-Releaseintegrität, Risiko-V2, beide vorhandenen
Riester-Förderkerne, CP0A2-Referenzbasis und vollständiger Typecheck. Diese
festgelegte Auswahl ist keine Vollprüfung. Build, Browser und R1-Artefaktprüfung
laufen regulär erst im PR. Alle bestehenden Vollgatebefehle und Testfälle bleiben
erhalten. Keine neuen Secrets, Schreibberechtigungen oder Testausnahmen.
Release- und Rollbackworkflows einschließlich ihrer Tests bleiben bytegleich.

Beide Workflows haben getrennte Concurrency-Gruppen. Neue Pushes ersetzen alte
Entwicklungsläufe, neue PR-Heads ersetzen alte PR-Läufe. Es gibt keine Pfadfilter,
Draft-Ausnahme oder bedingte Deaktivierung der Vollprüfung. Die bisherigen
manuellen CI-Dispatches entfallen, damit manuelle Branchprüfungen den erforderlichen
PR-Status nicht liefern können. Die GOV-03-Validierung historischer manueller
Ereignisse bleibt als eingeschränkter, nicht regulärer Evidenzfall erhalten.

## Identität, Vollständigkeit und Aktualität

GOV-03 prüft unverändert tatsächliche Commit-, Tree- und Parent-Objekte. Schema 1
bleibt erhalten, `validation_scope` ergänzt die Kennzeichnung `development`,
`full` oder `manual_limited`. Development CI akzeptiert ausschließlich Pushes.
PR-Nachweis verlangt genau zwei geordnete Parents: Base, dann Feature-Head.
Fehlende oder abweichende Identitäten schlagen fehl.

Der Vollprüfungsjob kontrolliert ausdrücklich `outcome` **und** `conclusion`
aller Pflichtsteps. Ein durch `continue-on-error` verdeckter Fehler genügt nicht.
Nur danach entsteht eine Bestätigung mit Merge, Base, Head, Tree, Run und Attempt.
Der erforderliche Abschlussjob akzeptiert ausschließlich Jobresultat `success`
und exakt diese Bestätigung für seinen erneut geprüften Checkout. Er läuft auch
bei einem übersprungenen oder fehlgeschlagenen Vorgänger. Fehlender Checkout,
fehlende Bestätigung, Parser-/Netzfehler oder falsche Identität ergeben Fehler.

Beide Bestätigungsschritte lesen mit `git ls-remote` die aktuellen Referenzen
`refs/heads/main`, `refs/pull/<PR>/head` und `refs/pull/<PR>/merge`. Jede Abweichung
vom tatsächlich geprüften Stand sperrt den Abschluss. Dieses Prüfergebnis ist
eine Momentaufnahme. Den Zeitraum bis zur tatsächlichen Integration deckt der
verpflichtende strikte GitHub-Merge-Schutz ab. Unmittelbare Integritätskontrolle
und Head-SHA-Bindung durch die Projektleitung bleiben zusätzlich erforderlich.
Bei Basewechsel: aktuelle synthetische Merge-Identität und gültige Voll-CI erneut
belegen, bei relevanten Änderungen betroffene Abnahmen erneuern. Ein manueller
Rerun eines alten Event-Payloads macht einen veralteten Stand nicht aktuell.

GitHub kann `skipped` und `neutral` bei erforderlichen Checks akzeptieren.
Darum wird der Vollprüfungsjob nicht allein als Required Check verwendet.
Der vorhandene Pflichtname gehört dem unbedingten Abschlussjob, der solche
Vorgängerresultate aktiv ablehnt. Ein auf Workflowebene ausgelassener Lauf
liefert keinen neuen erfolgreichen Pflichtstatus. Die Regressionen prüfen
diese Workflowstruktur zusätzlich. Quellen:
[Statuscheck-Verhalten](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks),
[strikte Ruleset-Checks](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets).

## Lesender Schutz-Preflight vom 17.11.2026

| Merkmal | GitHub-Originalquelle / Ergebnis |
| --- | --- |
| Live-main / Tree | `0edde578a9e3bc68b0132674dd3aa7e0809208a7` / `86018066fddce2f18cd08c2bdfef00b4b6898f35`, identisch zur Auftragsbasis. |
| Aktives Ruleset | [Protect main, ID 23643422](https://github.com/LeonMoebius-code/vermoegensnavigator/rules/23643422), `enforcement: active`, Ziel `~DEFAULT_BRANCH`, Defaultbranch main, keine Ausnahmen. |
| Pflichtstatus | `Tests, Typecheck, Build und Browser`, erwartete Integration `15368` (GitHub Actions). Name bleibt erhalten und wird nicht für das Schnellgate verwendet. |
| Base-Aktualität | `strict_required_status_checks_policy: true`, `do_not_enforce_on_create: false`. |
| PR-Weg / Umgehung | Regel `pull_request`, `bypass_actors: []`, `current_user_can_bypass: never`, zusätzlich Deletion-/Non-Fast-Forward-Schutz. Kein ungeschützter Weg für gewöhnliche direkte main-Commits. |
| Klassische Branch Protection | Branch-API zeigt `protected: true`, klassische `protection.enabled: false`. Separater vollständiger Protection-Endpunkt liefert dem Connector HTTP 403. Diese Zugriffslücke wird nicht als vollständige Settings-Prüfung ausgegeben. Das eigenständig aktive Ruleset ist vollständig lesbar. |

Lesende API-Quellen:
[Ruleset-Liste](https://api.github.com/repos/LeonMoebius-code/vermoegensnavigator/rulesets?includes_parents=true),
[Ruleset-Details](https://api.github.com/repos/LeonMoebius-code/vermoegensnavigator/rulesets/23643422),
[Branch](https://api.github.com/repos/LeonMoebius-code/vermoegensnavigator/branches/main).

Nach diesem Befund ist keine Settings-Änderung für GOV-04 erforderlich. Vor
Integration muss die Projektleitung das fortbestehende Ruleset erneut lesend
bestätigen und die Zugriffslücke zur klassischen Protection berücksichtigen.
Falls Pflichtstatus/App-Bindung, strikte Aktualität oder PR-Pflicht ohne Bypass
fehlen: HOLD. Genau diese Regeln müssen dann nach gesonderter ausdrücklicher
Freigabe eingerichtet werden. Den bisherigen Pflichtstatus niemals durch
„Schnelle Entwicklungsprüfung“ ersetzen. Dieser Auftrag ändert keine Settings.
Die zwei unabhängigen Governance-Reviews sind weiterhin Prozesspflicht, keine
neu eingerichtete GitHub-Approval-Regel (vorhandene Required Approvals: 0).

## Technische Nachweisgrenze

Automatisierte Regressionen verwenden echte synthetische Git-Objekte und lokale
Remote-Refs. Sie prüfen positive Vollständigkeit, jede fehlende/übersprungene/
fehlgeschlagene Pflichtstufe, verdeckte Fehler, veraltete Bestätigungen,
Head-/Base-/Mergewechsel sowie fehlende Referenzen und nicht erfolgreichen
Jobabschluss. Die ausführbaren Prozesspfade und Nichtnull-Exitcodes sind geprüft.
Die Workflowregressionen sichern Trigger, exklusiven Pflichtnamen, `always()`
und die Anbindung der Bestätigung. Vorhandene GOV-03-Negativtests bleiben erhalten.

Die tatsächlichen finalen Push-/PR-Runs, Checkout-JSONs, Jobs und Steps müssen
im Draft-PR anhand ihrer Originalquellen zugeordnet werden. Lokale Regressionen
ersetzen weder diese CI noch die unabhängige Abnahme. Es werden keine realen
main-Pushes, Merges, Settings-Manipulationen oder Deployments als Negativprobe
ausgeführt. Kein erfolgreicher realer Umgehungsversuch wird behauptet.
