# Projektstatus und nächste Schritte

**Datierte Momentaufnahme, keine Live-GitHub-Wahrheit. Live-GitHub erneut prüfen.**
Zuletzt geprüft: **23.10.2026, 10:16 Uhr Europe/Berlin**.
Quelle: GitHub Repository-, Ref-, Git-Commit-, PR- und Actions-APIs; lokale
Quellidentität bestätigt. [main](https://github.com/LeonMoebius-code/vermoegensnavigator/commit/3f15854b89bf81b8ac62d00446e86859b9d426ab):
`3f15854b89bf81b8ac62d00446e86859b9d426ab`, Tree
`4d3fc899dac77b3d3ea53b1f1ae052b699d84963`.
Entwicklung **V0.18.3 / Schema 11**; öffentlich dokumentiert **V0.18.2** gemäß
[Releasevorbereitung](../V0183_Releasevorbereitung.md). Live-Pages-Provenienz hier
nicht neu geprüft. Integriert ≠ abgenommen ≠ releasebereit ≠ veröffentlicht.

## Relevante Pakete

| Paket / Quelle | Verifizierter Zustand am Checkpoint |
| --- | --- |
| [F-021 #44](https://github.com/LeonMoebius-code/vermoegensnavigator/pull/44), [F-020 #45](https://github.com/LeonMoebius-code/vermoegensnavigator/pull/45), [F-017 #46](https://github.com/LeonMoebius-code/vermoegensnavigator/pull/46), [F-010/F-023 #47](https://github.com/LeonMoebius-code/vermoegensnavigator/pull/47) | **integriert**; keine neuen Implementierungsaufträge. Bestehende Detailverträge gelten. |
| [F-012 #50](https://github.com/LeonMoebius-code/vermoegensnavigator/pull/50) | **offen / Draft / zur unabhängigen Prüfung**. Head `0f7965f18b87105135bf1489249b68a04cd90fc4`, Base oben, synthetischer Merge `36d8f2b5aea5b2b406eafcd515ee38949194d3db`. [Push 39829244030](https://github.com/LeonMoebius-code/vermoegensnavigator/actions/runs/39829244030) und [PR 39829253359](https://github.com/LeonMoebius-code/vermoegensnavigator/actions/runs/39829253359) success. Kein eigenes fachliches GO daraus. |
| [F-012 #48](https://github.com/LeonMoebius-code/vermoegensnavigator/pull/48), [#49](https://github.com/LeonMoebius-code/vermoegensnavigator/pull/49) | **ersetzt / geschlossen, nicht gemergt**; lokale Originale und Branches bleiben geschützt. Historische rote #48-CI ist nicht der finale #50-Stand. |
| [Diagnose #43](https://github.com/LeonMoebius-code/vermoegensnavigator/pull/43) | offen / Draft; [normative Ausnahme](OPERATING_MODEL.md#diagnose-pr-43). |

main-SHA-Abfrage lieferte keine eigenen Actions-Runs; keine neue Main-Gesamtprüfung
behauptet. Grüne Feature-/PR-Läufe ersetzen unabhängige Urteile nicht; deren finaler Stand
wurde hier nicht neu verifiziert.

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

Beschlossen: **F-012 sicher fertigstellen** (bestehende Arbeit, CI und zwei
unabhängige Abnahmen) → tatsächliche P2-Folgen bewerten/gegebenenfalls explizit
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
