# Projektstatus und nächste Schritte

## Aktueller Checkpoint · 10.11.2026

Erneut READ-ONLY anhand Git-Objekten, GitHub-PR-/Actions-/Artefaktbelegen und
öffentlicher Provenienz geprüft. Dieser Abschnitt ersetzt die Aktualitätsansprüche
der unten unverändert erhaltenen Oktober-Momentaufnahmen. Kein eigenes Abnahme-GO.

| Ebene | Bestätigter Stand / Grenze |
| --- | --- |
| Integrierte Entwicklung | `main` = `1a7f71fc70242fca2039c5ce76c81fe9288d9e77`, Tree `fd393d48f637a8d9fa01ca70466e8e2e7c4fe57f`, V0.18.4 / Schema 11; #69 integriert. |
| Öffentlich belegter Release | V0.18.4 aus `70cd8841d9d04d9b9e9de75213b7a6e210a3f78b`, Tree `8345eb6e7ffc3a322017e2845d70f4854af48a7a`; [R1 41030503241](https://github.com/LeonMoebius-code/vermoegensnavigator/actions/runs/41030503241), 30.10.2026, Attempt 1, Candidate und Deploy success. Live-Provenienz/HTML/Programm bytegleich mit Originalen; vollständiges gespeichertes Manifest geprüft. |
| Beauftragte Vorbereitung | V0.18.5 / Schema 11 auf isoliertem `work/release-v0185-preparation`; ausschließlich Versionsmetadaten, Kennzeichnung und Dokumentation. Finaler Head/Tree und Doppel-CI im Draft-PR und identischen externen Nachweisen. Noch nicht integriert oder veröffentlicht. |
| Readiness / Freigabe | Vorbereitung ersetzt keine unabhängige Abnahme oder Veröffentlichungsentscheidung. Zwei unabhängige Abnahmen desselben finalen Heads, gesonderter Integrationsbeschluss für diesen Versions-PR, danach Readiness des dann aktuellen main. Release und Deployment jeweils ausdrücklich durch Leon. |
| Offene fremde Drafts | #43, Head `5a8963a4f7c6fd80c83da7f6872139400c51e656`: **AUDIT ONLY – NEVER MERGE**. #60, Head `3aec3f0ffd9e873adad85cfaf95fea918fa9cb9c`: älterer Status-Draft. Beide außerhalb der Feature-/Releasebasis; weder verändert, gemergt noch geschlossen. |

### Seit Oktober tatsächlich integriert

Die folgenden Mergecommits sind Vorfahren des aktuellen main; die Altersvorsorge-
pakete bis #66 sind bereits im veröffentlichten R1-Source enthalten. Langlebige
Featurebranches sind keine erneuten Aufträge. Die Tabelle belegt Integration,
nicht eine eigene Wiederholung früherer Abnahmen.

| Paket / PR | Tatsächlicher Merge-Source |
| --- | --- |
| V0.18.4-Versionsvorbereitung #55 | `ae798dfff80b6f805b013e0a1aa871120bdde1d1` |
| Navigation / Recovery / Vermögenshaus #58 | `d57b3289911cbc35d93cf72cb0ee4ab39dc645c5` |
| AP-01a neue unmittelbare Förderung #59 | `add55a43ff8b93545b490d6df5bec2d17c4d1f03` |
| AP-01b Alt-Riester-Jahreskern #61 | `27a896799d0c02eb8976dbe74700956dfd58d69d` |
| AP-04a A1/A2 #63 | `d2ef1d5b59b729ccdecc04f8d45095bb18bcb56f` |
| AP-05a B1/B2 #64 | `0bb89fd7e0aad99247c8d23a7efcfa7c86a52841` |
| AP-03a neutraler Monatskern #65 | `1303ca25776389f0cef1557ae9062a22914f8378` |
| AP-04b A3/A4 #66 | `c25c2bdd471f77efa0c0e38e77792d153db64f05` |
| R1 Checkout-Historie #67 | `70cd8841d9d04d9b9e9de75213b7a6e210a3f78b` |
| UX-03a/03b mit P2-Checkboxregression #69 | `1a7f71fc70242fca2039c5ce76c81fe9288d9e77` (02.11.2026), finaler Feature-Head `cd7d46c68c0f5f9468951984ec21b79dc861311e` |

Der vollständige noch unveröffentlichte Ausgangsvergleich
`70cd8841…` → `1a7f71fc…` umfasst **3 Commits / 9 Dateien**, ausschließlich #69.
Hinzu kommen die sieben Versions-/Dokumentationsdateien dieses Drafts.
[Umfang, aktuelle Fachtext-Sichtprüfung, Datenstände und Rückfallweg](../V0185_Releasevorbereitung.md).
B1/B2 bleibt ein bedingter bonusfreier Jahreszulagenvergleich, keine individuelle
Vertragswechselberatung. Neue Regime-/Partner-/Mehrvertragsfälle werden nicht aus
historischen Angaben automatisch bestätigt. Keine neuen Förderrules oder Produktdaten.

Beschlossene Reihenfolge vom 10.11.2026: zuerst V0.18.5 vorbereiten und getrennte
Abnahme-/Integrations-/Veröffentlichungsschritte beachten; danach V0.19 freier
Planvergleich als nächstes größeres Feature priorisieren ([D-15](DECISIONS.md)).
V0.19 wird hier nicht begonnen. Öffentlicher Desktop-Testprototyp; keine produktive
Bankfreigabe, keine revisionssichere Speicherung und keine neue Datenaktualitätszusage.

---

## Historische Dokumentation vom 26.10.2026 und davor

**Sämtliche folgenden Aktualitäts-/Offen-/Liveaussagen gehören ausschließlich zu
ihrem damaligen Checkpoint. Für den Stand 10.11.2026 gilt der Abschnitt oben.**


**Datierter Checkpoint vom 26.10.2026; Live-GitHub vor Entscheidungen erneut prüfen.**
Quelle: GitHub Commit-/PR-/Actions-/Artefakt-APIs, öffentliche Build-Provenienz
und erneuter Vergleich mit Originalreleaseartefakten. Dieser Pflegeauftrag
aktualisiert die frühere Momentaufnahme; sie bleibt unten historisch erhalten.

## Seit diesem Checkpoint geändert – UX-Auftrag 26.10.2026

Live-main am Beginn dieses Auftrags: `ae798dfff80b6f805b013e0a1aa871120bdde1d1`,
Tree `c7aab3392c7f5d705b30f0aeef4462c891417973`; PR #55 integriert,
V0.18.4 / Schema 11. Der ausdrücklich benannte
[Release 40334944352](https://github.com/LeonMoebius-code/vermoegensnavigator/actions/runs/40334944352)
ist auf dieser Source-SHA erfolgreich abgeschlossen (Attempt 1).
Die untenstehenden Aussagen „Versionsvorbereitung noch nicht integriert“ und
„öffentlich V0.18.3“ sind damit überholt; kein neuer Live-Bytevergleich in diesem UX-Auftrag.

Aktives Paket: [vier beschlossene UX-Korrekturen](../UX_Navigation_Recovery_Vermoegenshaus.md)
auf isoliertem `work/ux-navigation-recovery-house-v3`; keine Versionsanhebung.
Finale Identitäten, Gates und Abnahmeunterlagen im Draft-PR live prüfen.
Zwei unabhängige Abnahmen stehen aus; kein Merge, Release oder Deployment in diesem Auftrag.
PR #43 bleibt unverändert **AUDIT ONLY – NEVER MERGE**.

## Aktueller Integrations- und Veröffentlichungsstand

| Ebene | Verifizierter Stand / Grenze |
| --- | --- |
| Integrierte Entwicklung auf main | `60b6f51c2a05cdc9fa387fa1830ec323b528a304`, Tree `9bbd0e853cc1b790d6511e9a1362654942a0e12b`, Version 0.18.3 / Schema 11. PR #54 integriert. |
| Aktuelle Versionsvorbereitung | Ziel V0.18.4 / Schema 11, Branch `work/release-v0184-version-preparation`, auf diesem main isoliert vorbereitet. Finaler Head/Tree und Doppel-CI im Draft-PR bzw. Abschlussbericht; noch keine Integration. |
| Tatsächlich öffentlich | V0.18.3 aus `80c3317162f79f9a01d2d6f0428d02d14e4e806c`, [Originalrelease 38542251552](https://github.com/LeonMoebius-code/vermoegensnavigator/actions/runs/38542251552), 14.10.2026, Attempt 1 success. Live-HTML, Programm und Build-Provenienz erneut bytegleich mit den Originalartefakten geprüft. |
| Releasebereitschaft / Freigabe | Diese Vorbereitung ist kein Gesamtumfangs-GO. Zwei unabhängige Abnahmen, Leons gesonderte Integrationsentscheidung, spätere Kontrolle des dann aktuellen main sowie ausdrückliche Release- und Deploymentautorisierung bleiben erforderlich. |
| Diagnose-PR #43 | Offen/Draft, Head `5a8963a4f7c6fd80c83da7f6872139400c51e656`; **AUDIT ONLY – NEVER MERGE**, nicht verändern. |

Der tatsächliche GitHub-Stand hat Vorrang vor der älteren Momentaufnahme.
Integriert ≠ technisch/fachlich releasebereit ≠ durch Leon freigegeben ≠ live.
Kein neuer eigener main-CI-Lauf wurde für `60b6f51…` gefunden; daraus wird kein
zusätzliches bestandenes main-Gate behauptet. Die finale PR-#54-CI prüfte Head
`d96a87822a7a04b0e4e8af9055a093eac1a35b81` und synthetischen Merge
`ac1834a1c2b61a91ee366a0109012001aff2dadc`, beide mit dem Integrationstree oben:
[Push 40303312824](https://github.com/LeonMoebius-code/vermoegensnavigator/actions/runs/40303312824)
und [PR 40303318267](https://github.com/LeonMoebius-code/vermoegensnavigator/actions/runs/40303318267),
jeweils 212 Browserfälle erfolgreich, R1 55/55 ohne Skips. Das ersetzt weder
die neue Versions-PR-CI noch das spätere eigene Release-Gate.

## Seit dem alten Checkpoint integriert

| Paket | Aktueller Stand und fachlicher Umfang |
| --- | --- |
| [#51 Projektgedächtnis](https://github.com/LeonMoebius-code/vermoegensnavigator/pull/51) | Integriert als `a87be76dcd5e303f626de6bcebb7239939b02cb1`; D-10 bleibt maßgeblich. Reale Work-/Review-Kaltstarts weiterhin nicht als durchgeführt behaupten. |
| [#52 F-007](https://github.com/LeonMoebius-code/vermoegensnavigator/pull/52) | Integriert als `0ec08f7a6f3132af3ff51d8eed0a921fc35aa1a9`; Excel-Blattnamenskonflikte behoben. Damalige F-026-Untersuchung war READ-ONLY. |
| [#53 F-026](https://github.com/LeonMoebius-code/vermoegensnavigator/pull/53) | Integriert als `02e33028f6f3790a237f319064cea362e367117c`; [Kalenderdomäne 0100–9999](../F026_KALENDERDOMAENE.md) nach D-11, keine neue fachliche Höchstlaufzeit. |
| [#54 P2-Integrität](https://github.com/LeonMoebius-code/vermoegensnavigator/pull/54) | Integriert als `60b6f51c2a05cdc9fa387fa1830ec323b528a304`; F-008 CSV-Encoding und Referenzschutz, F-013 gemeinsame planbezogene Unterdeckungswarnung, F-016 explizite Nullmaps. Einschließlich F-016 × F-012: Entfallende sekundäre Nullbindung erfordert Bestätigung als Zuordnungsinformation mit 0 €, keine Umbuchung. [Vertrag](../P2_RELEASE_INTEGRITAET.md). |
| F-024 innerhalb #54 | „Zuletzt angewendetes Modell“ bezeichnet den Metadatenbezug. Mehrere Modellallokationen und ihre IDs bleiben erhalten; keine neue Modellhistorienarchitektur. |
| F-025 innerhalb #54 | Sparplan ohne Startdatum bleibt unvollständiger Entwurf; Editor, XLSX und gemeinsamer Druckabschnitt kennzeichnen das fehlende Datum. Keine erfundene Termin-/Renditerechnung. |
| F-019, Beschluss 26.10.2026 | Für den vorgesehenen vollständigen unterstützten agree21-Import mit 29 Spalten fachlich geklärt: EUR-Berichtswährung bereits am 21.09.2026 bestätigt und technisch umgesetzt. Keine erneute Implementierung oder Benutzerbestätigung. **Generische Profile bleiben davon ausgenommen**; ihre Herkunfts-/Währungsgrenzen und bestehenden Sperren gelten weiter. [D-12](DECISIONS.md). |

F-021 #44, F-020 #45, F-017 #46, F-010/F-023 #47 und F-012 #50 sind weiterhin
integriert. #48/#49 bleiben ersetzt/geschlossen, nicht gemergt; lokale Originale
bleiben geschützt. Bereits abgeschlossene Abnahmen werden durch diese Pflege
nicht wiederholt oder als eigene neue Abnahme ausgegeben.

## Aktuelle Grenzen und nächster Ablauf

Der vollständige veröffentlichungsrelevante Vergleich beginnt beim tatsächlichen
Live-Source `80c3317…`, nicht beim früher vermuteten V0.18.2-Stand. Er umfasst
auch Modellportfolio-Durchschau/Mindestanlage (#39), Termine/Recovery-Anzeige/
Vermögenshaus (#40) und H5a/H5b (#41/#42). Details, Datenstände, Prototypgrenzen,
Veröffentlichungsvoraussetzungen und verfügbarer Rückfallweg stehen in der
[V0.18.4-Vorbereitung](../V0184_Releasevorbereitung.md).

Nächste Schritte: Versions-Draft und finale Doppel-CI → zwei unabhängige
Nachabnahmen desselben Stands → **Leons gesonderte Integrationserlaubnis für
diesen Versions-PR** → aktuelle Releasevoraussetzungen prüfen → Leon autorisiert
Release und später Deployment separat. Keine automatische Folgeauditserie.
V0.19 freier Planvergleich bleibt das nächste größere vorgesehene Feature;
V0.20 und weitere Vertiefungen bleiben spätere Optionen. Keine neue Priorisierung.

Finanz-/Produktdaten wurden nicht aktualisiert. Öffentlicher Desktop-Testprototyp,
keine produktive Bankfreigabe; lokale, nicht revisionssichere Speicherung,
P1/H5-Originalschutz und sonstige Detailverträge bleiben maßgeblich. Die
F-019-Entscheidung zertifiziert weder beliebige CSV-Dateien noch Datenaktualität.

---

## Historischer Checkpoint 23.10.2026 – durch obigen Stand fortgeschrieben

Die folgenden früheren Angaben einschließlich offener Integrations-/Quellenfragen
bleiben als historische Momentaufnahme erhalten; sie sind kein aktueller Auftrag.

**Datierte Momentaufnahme, keine Live-GitHub-Wahrheit. Live-GitHub erneut prüfen.**
Zuletzt geprüft: **23.10.2026, 11:40 Uhr Europe/Berlin**.
Quelle: GitHub Repository-, Ref-, Git-Commit-, PR- und Actions-APIs; lokale
Quellidentität bestätigt. [main](https://github.com/LeonMoebius-code/vermoegensnavigator/commit/422af328033adf0dba6360feca277d83a764f338):
`422af328033adf0dba6360feca277d83a764f338`, Tree
`3ff61790c38d238b5a18d0822dae1a910649ced5`.
Entwicklung **V0.18.3 / Schema 11**; öffentlich dokumentiert **V0.18.2** gemäß
[Releasevorbereitung](../V0183_Releasevorbereitung.md). Live-Pages-Provenienz hier
nicht neu geprüft. Integriert ≠ abgenommen ≠ releasebereit ≠ veröffentlicht.

### Seit dem Checkpoint geändert – live nachprüfen

PR #51 und [PR #52](https://github.com/LeonMoebius-code/vermoegensnavigator/pull/52)
sind integriert. Live-main zu Beginn des F-026-Auftrags am 23.10.2026:
`0ec08f7a6f3132af3ff51d8eed0a921fc35aa1a9`, Tree
`030dfa9eded4a4358cb72f7d0b522ca2cae56c43`. Die älteren offenen Governance-/
P2-Implementierungsaussagen unten sind historische Checkpoints.
F-007 ist durch #52 behoben; dessen F-026-Anteil war ausschließlich READ-ONLY.
Work setzt jetzt nur [F-026](../F026_KALENDERDOMAENE.md) im isolierten Branch
`work/f026-calendar-domain-integrity` um. [D-11](DECISIONS.md) beschließt die
technische Domäne 0100–9999, keine fachliche Höchstlaufzeit. Abnahmen und
Integration des neuen Featurestands live prüfen. Kein Release oder Deployment.

### Relevante Pakete

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

### Einführungsnachweis Projektgedächtnis – Beschluss 23.10.2026

Für die Erstintegration von [PR #51](https://github.com/LeonMoebius-code/vermoegensnavigator/pull/51)
akzeptiert Leon den erfolgreich absolvierten realen Projektleiter-Kaltstart;
laut seiner Bestätigung haben beide Review-Chats diesen Test positiv bewertet.
**Work-/Review-Kaltstarts: nicht durchgeführt, kein eigenständiger Nachweis.**
Erprobung bei künftigen tatsächlichen Chatwechseln; keine zusätzlichen künstlichen
Erstintegrationsproben. Historische Drei-Test-Pflicht und gezielte Ersetzung:
[D-09/D-10](DECISIONS.md). Zwei GO für den bisherigen PR-Stand sind von Leon
bestätigt; diese letzte Änderung und ihre finalen Git-/CI-Nachweise sind noch
gezielt abzunehmen. Governance-Merge weiterhin gesondert entscheiden.

### Restrisiken und Evidenzgrenzen

Grundlage: READ-ONLY-Auditregister/Triage vom 22.10.2026 auf `478d17d…`, danach
Projektleiterbeschluss vom 22.10.; kein neuer Audit in diesem Dokumentationspaket.
Originalregister und Nachweise liegen separat; **keine öffentlichen Kopien privater
Archive**. Diese Referenz benennt Herkunft, öffentliche Detailverifizierbarkeit ist
begrenzt. Vor Entscheidung Originalbelege heranziehen und aktuellen Code abgleichen.

| Thema | Evidenzstatus / nächste Bewertung |
| --- | --- |
| Deep-Audit-08/F-007 XLSX-Namenskonflikt | Durch PR #52 auf obigem Live-main **behoben und integriert**; beide unabhängigen Abnahmen laut beauftragtem Folgepaket positiv. Nicht das durch H4 geschlossene Astra/F-007. Kein Release daraus. |
| F-026 Extremjahre | Im Register **reproduziert**: falsche Zieljahre/Darstellungsfehler bei extremen Laufzeiten. P2; technische Kalenderdomäne durch D-11 entschieden, gezielte Umsetzung im aktuellen F-026-Paket; Abnahme/Integration noch separat. F-021 dadurch nicht wieder öffnen. Redaktionell waren 19 statt 20 Stimuli enthalten; kein Anlass für neues Gesamtaudit. |
| F-024 Modellmetadaten | **statischer Mechanismus** mehrfacher Modellergänzung; niedriger priorisiert, keine unbelegte Finanzbeschädigung behaupten. |
| F-025 Sparplanstart | Register belegt Annahme/XLSX ohne Start; fachlicher Sollvertrag und heutige Reproduzierbarkeit **ungeklärt**, niedriger priorisiert. Kein belegtes vollständiges Browser-E2E. |
| Weitere F-008–F-025 | Register gezielt heranziehen: u. a. Encoding, Darstellungs-/Zuordnungssemantik, Berichtswährung, Bondwährung. Fehlende Originaldetails **ungeklärt**; nicht pauschal behoben, akzeptiert oder Releaseblocker. |

### Beschlossene Reihenfolge und offene Optionen

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
