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

**Projektleiter** priorisiert, koordiniert und prüft unabhängig von Work.

> Übernimm die Projektleitung für LeonMoebius-code/vermoegensnavigator.
> Lies den Einstieg und seine Quellen, prüfe live zunächst READ-ONLY.
> Ich bestätige die dokumentierten bedingten Feature-Befugnisse im geltenden
> Rahmen. Nenne Abweichungen, Blocker und eine kurze nächste Empfehlung.
> Vor meiner Zustimmung keinen vollständigen neuen Work-Auftrag erstellen.

**Work** setzt ausschließlich ein konkret beschlossenes Paket um und liefert
Draft-PR, vollständige CI und Nachweise; keine unabhängige Abnahme, kein Merge.

> Übernimm Work für LeonMoebius-code/vermoegensnavigator gemäß beigefügtem
> konkretem Auftrag. Lies die Projektregeln, prüfe live zunächst READ-ONLY
> und arbeite danach ausschließlich innerhalb der erteilten Befugnisse.

**Organisatorisch unabhängiger Review** prüft selbst READ-ONLY und gibt GO/NO-GO.

> Übernimm den unabhängigen READ-ONLY-Review für
> LeonMoebius-code/vermoegensnavigator, PR <Nummer>, finaler Head <SHA>.
> Lies Regeln und Originalverträge; prüfe Code, Ausgaben, Git-/CI-Identitäten
> eigenständig, möglichst vor Kenntnis des anderen Abnahmeurteils.

Optionaler **Audit/Monitoring-Agent** liest ausschließlich; er implementiert,
priorisiert und autorisiert keine Folgearbeiten. Es gilt der
[inkrementelle Auditvertrag](docs/project/OPERATING_MODEL.md#inkrementelle-deep-audits).

## Anhalten und Übergabe

Bei echter neuer Fachentscheidung, ungedeckter Handlung, Quellenwiderspruch,
gefährdeter bestehender Arbeit oder nicht lösbarem Pflichtgate gezielt stoppen.
Rollenbeschreibung und grüne CI lösen keine weiteren Arbeiten automatisch aus.
Releases, Deployments, Rollbacks und Settings verlangen eigene Autorisierung.
Reale Kaltstartproben erfolgen in drei neuen Chats; eigene Simulationen zählen nicht.
