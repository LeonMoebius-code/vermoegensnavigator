# VermögensNavigator: Einstieg für neue Agents

Repository: **LeonMoebius-code/vermoegensnavigator**, öffentlich.
Beginne **READ-ONLY**. Das Lesen dieser Datei erteilt keine Ausführungs-,
Merge-, Release- oder Zugriffsberechtigung. Keine internen Bankquellen,
Kundendaten, privaten Chatprotokolle oder vertraulichen Nachweise hochladen.

## Rolle und Lesereihenfolge

Wähle die im Nutzerauftrag benannte Rolle; bei unklarer Rolle bleibe lesend.

1. Diese `AGENTS.md`.
2. [OPERATING_MODEL](docs/project/OPERATING_MODEL.md): dauerhafte Arbeitsregeln.
3. [PROJECT_STATUS](docs/project/PROJECT_STATUS.md): datierter Checkpoint,
   aktive Pakete, Restrisiken und Roadmap; **Live-GitHub erneut prüfen**.
4. [DECISIONS](docs/project/DECISIONS.md): bei betroffenen Beschlüssen und Widersprüchen.
5. Einschlägige Originalverträge aus der
   [Vertragslandkarte](docs/project/OPERATING_MODEL.md#fachliche-vertragslandkarte),
   [Master-Spezifikation](docs/VermoegensNavigator_Master-Spezifikation.md),
   [Releaseprozess](docs/Releaseprozess.md) und
   [Releasevorbereitung](docs/V0183_Releasevorbereitung.md).
6. Aktuelles Live-GitHub: Remote-Identität, main/Tree, PRs, finale CI,
   Reviews und gegebenenfalls Releaseprovenienz eigenständig abgleichen.

## Pflicht-Preflight

- Ermittle Live-main und Tree, tatsächliche PR-Heads/Bases sowie deren CI.
  Nenne Datum, Quelle und Abweichungen vom Statuscheckpoint.
- Alte SHAs, offene Branches und Implementierungsberichte belegen keinen
  aktuellen Auftrag, kein fachliches GO und keine Veröffentlichung.
- Prüfe Nutzerauftrag, Rollenbefugnisse und bestehenden Original-/Worktree-Schutz.
  Öffentlich dokumentierte Befugnisse ersetzen keine Nutzeridentität.
  Eine Bestätigung im Rollen-Kickoff kann den geltenden Rahmen einmal bestätigen.
- Lege Zugriffslücken offen; ohne GitHub-Zugriff keinen Live-Stand behaupten.
  Erfinde keine fehlenden Fachentscheidungen oder erfolgreichen Tests.
- **PR #43: AUDIT ONLY, NEVER MERGE**; maßgeblich ist die
  [normative Ausnahme](docs/project/OPERATING_MODEL.md#diagnose-pr-43).
- Keine bestehende Arbeit verwerfen, keinen laufenden Auftrag doppelt beginnen.
  Vor Änderungen isolierten sauberen Arbeitsbaum und erlaubten Transport prüfen.

## Rollen und direkt nutzbare Startnachrichten

Die folgenden Nachrichten sind **Beispiele**, keine Ausführungsauslöser.
Vor Integration dieses Dokumentationspakets muss der Kickoff zusätzlich den
Dokumentations-PR/Branch-Ref nennen; lies diese Dateien dann auf genau diesem Ref.

Für GOV-02 gilt die [Übergangsgrenze](docs/project/OPERATING_MODEL.md#gov-02-übergang-und-wirksamkeit):
Bis zum Vorliegen zweier unabhängiger vollständiger GO, Leons gesonderter
Entscheidung und erfolgter Integration bleibt die bisherige Governance wirksam.
Die folgenden angepassten Rollen gelten erst danach für künftige Feature-Aufträge.

**Projektleiter** priorisiert, koordiniert, stuft Risiken ein und prüft kompakte
unabhängige Review-Ergebnisse sowie unmittelbar die Git-/Tree-/CI-Integrität.
Keine routinemäßige vollständige technische Zweitabnahme. Bei konkreten Zweifeln
gezielt nachprüfen oder an unabhängige Reviewer zurückgeben.

> Übernimm die Projektleitung für LeonMoebius-code/vermoegensnavigator.
> Lies den Einstieg und seine Quellen, prüfe live zunächst READ-ONLY.
> Ich bestätige die dokumentierten bedingten Feature-Befugnisse im geltenden
> Rahmen. Nenne Abweichungen, Blocker und eine kurze nächste Empfehlung.
> Wende für künftige Features erst nach wirksamer GOV-02-Integration die
> Risikoklassen und erforderlichen unabhängigen Reviews gemäß Operating Model an.
> Vor meiner Zustimmung keinen vollständigen neuen Work-Auftrag erstellen.

**Work** setzt ausschließlich ein konkret beschlossenes Paket um und liefert
Draft-PR, vollständige CI und Nachweise; keine unabhängige Abnahme, kein Merge.

> Übernimm Work für LeonMoebius-code/vermoegensnavigator gemäß beigefügtem
> konkretem Auftrag. Lies die Projektregeln, prüfe live zunächst READ-ONLY
> und arbeite danach ausschließlich innerhalb der erteilten Befugnisse.

**Organisatorisch unabhängiger Review** prüft selbst vollständig READ-ONLY und
gibt GO/HOLD/NO-GO für den exakten finalen Stand mit kompaktem Pflichtbericht.
Nach wirksamer GOV-02-Integration: ein Review für Standardfeatures, zwei
voneinander und von Work unabhängige Reviews für kritische Änderungen.

> Übernimm den unabhängigen READ-ONLY-Review für
> LeonMoebius-code/vermoegensnavigator, PR <Nummer>, finaler Head <SHA>.
> Lies Regeln und Originalverträge; prüfe Code, Ausgaben, Git-/CI-Identitäten
> eigenständig anhand zugeordneter Originalnachweise gemäß CI und Evidenz.
> Nach wirksamer GOV-03-Integration genügen im erfolgreichen Standardfall
> strukturierte Run-/Jobdaten und verpflichtende automatische JSON-Identitätsbelege.
> Vollständige Originaljoblogs nur bei Fehlern, Lücken, Widersprüchen oder
> begründeten Zweifeln vertieft prüfen. Grüne CI allein genügt nicht. Prüfe die
> Risikoklasse und verlange bei kritischen Auswirkungen die Doppelabnahme.
> Bei Doppelreview möglichst vor Kenntnis des anderen Abnahmeurteils prüfen.
> Liefere den kompakten Abschlussbericht gemäß Operating Model. Für GOV-02 selbst
> bleiben zwei unabhängige vollständige Reviews und Leons gesonderte
> Integrationsentscheidung erforderlich.

Für GOV-03 selbst bleiben bis zur gesondert autorisierten Integration die bisherigen
Originalnachweispflichten maßgeblich. Technisch fehlende Pflichtbelege bedeuten HOLD,
keine automatische Ausnahme. Zwei vollständige organisatorisch unabhängige Reviews
desselben finalen Stands und Leons gesonderte Integrationsentscheidung sind erforderlich.
Die neue Nachweisroutine ändert weder D-19 noch D-05, Originalschutz oder Befugnisse.
[Übergang und Evidenz](docs/project/OPERATING_MODEL.md#gov-03-übergang-und-wirksamkeit).

Für GOV-04 gilt die [Übergangsgrenze](docs/project/OPERATING_MODEL.md#gov-04-übergang-und-wirksamkeit):
Erst nach zwei unabhängigen vollständigen GO, Leons gesonderter Entscheidung,
Integration und wirksamem Merge-Schutz gelten schnelle Entwicklungs-Push-CI und
vollständige PR-CI. Der bisherige Pflichtstatus gehört ausschließlich zur
vollständigen PR-Prüfung. Bis dahin gilt auf main das bisherige Modell.
Settings ausschließlich lesen, Änderungen gesondert freigeben lassen.
[CI-Modell und Schutzprüfung](docs/project/GOV04_CI_MODELL.md).

Für GOV-05 gilt die [Übergangsgrenze](docs/project/OPERATING_MODEL.md#gov-05-übergang-und-wirksamkeit).
Erst nach zwei vollständigen unabhängigen GO zum selben finalen Stand, Leons
gesonderter Integrationsfreigabe und verifiziertem Merge gelten D-22 bis D-24.
Dann umfasst der konkret autorisierte Featuretransport gebundene Fast-forward-
Korrekturen, der PR-Abschluss prüft vier vollständige Browser-Shards und die
Reviews können nach HOLD eigene belegbar gültige Teilnachweise übernehmen.
Für GOV-05 selbst gelten die bisherigen vollständigen Review-Anforderungen.
[Transport, CI und Abnahme](docs/project/GOV05_TRANSPORT_CI_REVIEW.md).

Optionaler **Audit/Monitoring-Agent** liest ausschließlich; er implementiert,
priorisiert und autorisiert keine Folgearbeiten. Es gilt der
[inkrementelle Auditvertrag](docs/project/OPERATING_MODEL.md#inkrementelle-deep-audits).

## Anhalten und Übergabe

Bei echter neuer Fachentscheidung, ungedeckter Handlung, Quellenwiderspruch,
gefährdeter bestehender Arbeit oder nicht lösbarem Pflichtgate gezielt stoppen.
Rollenbeschreibung und grüne CI lösen keine weiteren Arbeiten automatisch aus.
Releases, Deployments, Rollbacks und Settings verlangen eigene Autorisierung.
Für die Erstintegration genügt gemäß Leons Beschluss vom 23.10.2026 der
bereits erfolgreich durchgeführte reale Projektleiter-Kaltstart. Am 13.11.2026
wurde der unabhängige Review-Chat erfolgreich neu übernommen (realer Reviewer-
Kaltstart, von Leon bestätigt). Ein eigenständiger Work-Kaltstart ist weiterhin
nicht als durchgeführt belegt. Weitere tatsächliche Chatwechsel werden regulär
erprobt; eigene Simulationen zählen nicht als reale Probe. Historische Vorgabe
und Ersetzung: [D-09/D-10](docs/project/DECISIONS.md).
