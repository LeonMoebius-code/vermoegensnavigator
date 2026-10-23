# Projektstatus und nächste Schritte

**Datierte Momentaufnahme, keine Live-GitHub-Wahrheit. Live-GitHub erneut prüfen.**
Zuletzt geprüft: **23.10.2026, 11:40 Uhr Europe/Berlin**.
Quelle: GitHub Repository-, Ref-, Git-Commit-, PR- und Actions-APIs; lokale
Quellidentität bestätigt. [main](https://github.com/LeonMoebius-code/vermoegensnavigator/commit/422af328033adf0dba6360feca277d83a764f338):
`422af328033adf0dba6360feca277d83a764f338`, Tree
`3ff61790c38d238b5a18d0822dae1a910649ced5`.
Entwicklung **V0.18.3 / Schema 11**; öffentlich dokumentiert **V0.18.2** gemäß
[Releasevorbereitung](../V0183_Releasevorbereitung.md). Live-Pages-Provenienz hier
nicht neu geprüft. Integriert ≠ abgenommen ≠ releasebereit ≠ veröffentlicht.

## Seit dem Checkpoint geändert – live nachprüfen

PR #51 ist inzwischen integriert: Live-main am 23.10.2026 zu Beginn des
beauftragten P2-Pakets `a87be76dcd5e303f626de6bcebb7239939b02cb1`, Tree
`0e6d43e490461430e00805ca5192eae8da48858e`. Die frühere offene Governance-
Mergeentscheidung unten ist damit historisch. Work bearbeitet ausschließlich den
[Excel-Fix und die lesende F-026-Bewertung](../P2_F007_XLSX_F026_Bewertung.md)
im Branch `work/p2-f007-xlsx-sheet-integrity`; Integration/Abnahmen live prüfen.
F-026 bleibt ohne produktive Korrektur und ohne neu beschlossene Laufzeitgrenze.
Keine Release-/Deploymentfreigabe.

## Relevante Pakete

| Paket / Quelle | Verifizierter Zustand am Checkpoint |
| --- | --- |
| [F-021 #44](https://github.com/LeonMoebius-code/vermoegensnavigator/pull/44), [F-020 #45](https://github.com/LeonMoebius-code/vermoegensnavigator/pull/45), [F-017 #46](https://github.com/LeonMoebius-code/vermoegensnavigator/pull/46), [F-010/F-023 #47](https://github.com/LeonMoebius-code/vermoegensnavigator/pull/47) | **integriert**; keine neuen Implementierungsaufträge. Bestehende Detailverträge gelten. |
| [F-012 #50](https://github.com/LeonMoebius-code/vermoegensnavigator/pull/50) | **integriert**, gemergt am 23.10.2026 um 10:59 Uhr Europe/Berlin; tatsächlicher Merge ist main oben. Feature-Head `0f7965f18b87105135bf1489249b68a04cd90fc4`; damalige Basis `3f15854b89bf81b8ac62d00446e86859b9d426ab`. [Push 39829244030](https://github.com/LeonMoebius-code/vermoegensnavigator/actions/runs/39829244030) und [PR 39829253359](https://github.com/LeonMoebius-code/vermoegensnavigator/actions/runs/39829253359) success auf dem damaligen Feature bzw. synthetischen Merge. Kein neuer F-012-Implementierungsauftrag; keine Releasefreigabe daraus. |
| [F-012 #48](https://github.com/LeonMoebius-code/vermoegensnavigator/pull/48), [#49](https://github.com/LeonMoebius-code/vermoegensnavigator/pull/49) | **ersetzt / geschlossen, nicht gemergt**; lokale Originale und Branches bleiben geschützt. Historische rote #48-CI ist nicht der finale #50-Stand. |
| [Diagnose #43](https://github.com/LeonMoebius-code/vermoegensnavigator/pull/43) | offen / Draft; [normative Ausnahme](OPERATING_MODEL.md#diagnose-pr-43). |

Abfrage für den neuen main-SHA lieferte keine eigenen Actions-Runs; keine neue
Main-Gesamtprüfung behauptet. Der tatsächliche F-012-Merge ist über die PR-/Git-APIs
belegt; die vorangegangenen Abnahmen wurden hier nicht erneut fachlich durchgeführt.
Grüne CI und Integration sind keine Release-/Deploymentfreigabe.

## Einführungsnachweis Projektgedächtnis – Beschluss 23.10.2026

Für die Erstintegration von [PR #51](https://github.com/LeonMoebius-code/vermoegensnavigator/pull/51)
akzeptiert Leon den erfolgreich absolvierten realen Projektleiter-Kaltstart;
laut seiner Bestätigung haben beide Review-Chats diesen Test positiv bewertet.
**Work-/Review-Kaltstarts: nicht durchgeführt, kein eigenständiger Nachweis.**
Erprobung bei künftigen tatsächlichen Chatwechseln; keine zusätzlichen künstlichen
Erstintegrationsproben. Historische Drei-Test-Pflicht und gezielte Ersetzung:
[D-09/D-10](DECISIONS.md). Zwei GO für den bisherigen PR-Stand sind von Leon
bestätigt; diese letzte Änderung und ihre finalen Git-/CI-Nachweise sind noch
gezielt abzunehmen. Governance-Merge weiterhin gesondert entscheiden.

## Restrisiken und Evidenzgrenzen

Grundlage: READ-ONLY-Auditregister/Triage vom 22.10.2026 auf `478d17d…`, danach
Projektleiterbeschluss vom 22.10.; kein neuer Audit in diesem Dokumentationspaket.
Originalregister und Nachweise liegen separat; **keine öffentlichen Kopien privater
Archive**. Diese Referenz benennt Herkunft, öffentliche Detailverifizierbarkeit ist
begrenzt. Vor Entscheidung Originalbelege heranziehen und aktuellen Code abgleichen.

| Thema | Evidenzstatus / nächste Bewertung |
| --- | --- |
| Deep-Audit-08/F-007 XLSX-Namenskonflikt | Im Register **reproduziert**: normaler Planname `Fall` kollidiert mit festem Blatt. P2, Exportwirkung zeitnah bewerten. Nicht das durch H4 geschlossene Astra/F-007. |
| F-026 Extremjahre | Im Register **reproduziert**: falsche Zieljahre/Darstellungsfehler bei extremen Laufzeiten. P2; technische Kalenderdomäne fachlich entscheiden. F-021 dadurch nicht wieder öffnen. Redaktionell waren 19 statt 20 Stimuli enthalten; kein Anlass für neues Gesamtaudit. |
| F-024 Modellmetadaten | **statischer Mechanismus** mehrfacher Modellergänzung; niedriger priorisiert, keine unbelegte Finanzbeschädigung behaupten. |
| F-025 Sparplanstart | Register belegt Annahme/XLSX ohne Start; fachlicher Sollvertrag und heutige Reproduzierbarkeit **ungeklärt**, niedriger priorisiert. Kein belegtes vollständiges Browser-E2E. |
| Weitere F-008–F-025 | Register gezielt heranziehen: u. a. Encoding, Darstellungs-/Zuordnungssemantik, Berichtswährung, Bondwährung. Fehlende Originaldetails **ungeklärt**; nicht pauschal behoben, akzeptiert oder Releaseblocker. |

## Beschlossene Reihenfolge und offene Optionen

Beschlossene Reihenfolge: **F-012 ist inzwischen integriert**; als Nächstes
tatsächliche P2-Folgen bewerten/gegebenenfalls explizit
akzeptieren oder eng beheben → **einmalige V0.18.3-Readiness** → **gesonderte
Releaseentscheidung**. Keine automatische weitere Hardening-/Auditserie.

Nächstes größeres Feature: [V0.19 freier Planvergleich](../Workpaket_Planvergleich_V019.md).
Frühe schlanke Rechnervertiefung **prüfen**, Reihenfolge/Umfang noch nicht beschlossen.
Später [V0.20 Auszahlplan/Dynamik](../Workpaket_Auszahlplan_V020.md),
[Inflation](../Vertiefung_Inflation_Kaufkraft_Fachkonzept.md) und
[Ruhestandsplanung](../Vertiefung_Ruhestandsplanung_Fachkonzept.md).
Historische Schema-10-Ziele in Detailkonzepten sind überholt: heute Schema 11,
späteren Migrationsbedarf vom dann gültigen Stand ableiten.
[Beschlüsse](DECISIONS.md), [Pflegezuständigkeit und spätester Aktualisierungspunkt](OPERATING_MODEL.md#pflegevertrag).
