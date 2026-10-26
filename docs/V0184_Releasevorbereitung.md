# V0.18.4 – Versions- und Releasevorbereitung

Stand: **26.10.2026**. Beschlossene Zielversion **V0.18.4 / Schema 11**.
Dies ist eine eng begrenzte technische Versions- und Dokumentationsvorbereitung,
**kein Release-GO, kein Merge und keine Veröffentlichung**.

## Vier getrennte Zustände

| Ebene | Nachweis / offener Schritt |
| --- | --- |
| Tatsächlich öffentlich | **V0.18.3**, Originalrelease vom 14.10.2026, Source `80c3317162f79f9a01d2d6f0428d02d14e4e806c`; [R1-Run 38542251552](https://github.com/LeonMoebius-code/vermoegensnavigator/actions/runs/38542251552), Attempt 1, success. |
| Integrierte Entwicklung bei Auftragseingang | main `60b6f51c2a05cdc9fa387fa1830ec323b528a304`, Tree `9bbd0e853cc1b790d6511e9a1362654942a0e12b`, noch Version 0.18.3 / Schema 11; einschließlich PR #54. |
| Neue Versionsvorbereitung | Branch `work/release-v0184-version-preparation` auf diesem main; Version 0.18.4 / Schema 11. Finaler Feature-Head/Tree, synthetischer PR-Merge und Original-CI im Draft-PR und identischen Abnahmebericht. Noch nicht integriert. |
| Freigabe und Veröffentlichung | Zwei unabhängige Abnahmen desselben finalen Stands; Leon entscheidet die Integration dieses Versions-PR gesondert. Erst danach aktuelle Releasevoraussetzungen prüfen und konkrete Entscheidung vorbereiten. Release und später Deployment benötigen Leons ausdrückliche Autorisierung. |

Die erneute öffentliche Prüfung am 26.10.2026 bestätigt `build-info.json` mit
diesem Source-SHA, Run/Attempt und Buildzeit `2026-10-14T09:26:19.691Z`.
`index.html`, `app.js` und `build-info.json` stimmen in Größe und SHA-256 mit den
erneut heruntergeladenen Originalartefakten überein; das Programm enthält
`Prototyp V0.18.3`. Der unveränderte historische R1-Validator prüfte zusätzlich
die vollständige gespeicherte Website gegen ihre Evidence erfolgreich.
Die kanonische Originalchecksum lautet
`dc832cefe89a145d4b618b52aa5112ffc6762e31f95587e35099ee6ce247970a`.

Die GitHub-Releases-Liste enthält bei dieser Prüfung keine Releaseobjekte.
Der Veröffentlichungsnachweis ist der erfolgreiche Original-R1-Actions-Run
mit Site/Evidence und passender öffentlicher Provenienz, kein unterstellter Tag.
Die früher dokumentierte öffentliche V0.18.2 ist nicht der heutige Live-Stand.
Die [V0.18.3-Vorbereitung](V0183_Releasevorbereitung.md) und ältere
V0.18.2-/R1-Nachweise bleiben als historische Checkpoints unverändert erhalten.

## Enger Umfang dieses Versions-PR

- `package.json`: Projektversion 0.18.3 → 0.18.4.
- `package-lock.json`: ausschließlich oberste Projektversion und Root-Paketversion.
- `app/page.tsx`: ausschließlich sichtbare Kennzeichnung `Prototyp V0.18.4`.
  `Browser-lokal, keine revisionssichere Speicherung.` bleibt bytegleich.
- README und Projektstatus aktualisieren, bestätigte F-019-Entscheidung
  dokumentieren und die frühere P2-Quellenbewertung sichtbar fortschreiben.
  Dieses Dokument beschreibt Umfang, Nachweise und spätere Freigaben.

Keine Änderung an Datenschema 11, Falldaten, Migrationen, Finanz-/Berechnungslogik,
CSV-Import, Bond-Engine, Produkt-/Marktdaten, Export/Druck, Abhängigkeiten,
Paketintegritäten oder Release-/Rollbackworkflows. Keine neue F-019-Implementierung.
Die Versionsnummer ändert keine gespeicherte Fallstruktur.

## Gesamter integrierter Umfang seit dem tatsächlichen Originalrelease

Der Vergleich des Live-Source mit dem bestätigten Ausgangs-main enthält
**42 zusätzliche Commits einschließlich Mergecommits und 100 geänderte Dateien**:
[vollständiger Sourcevergleich](https://github.com/LeonMoebius-code/vermoegensnavigator/compare/80c3317162f79f9a01d2d6f0428d02d14e4e806c...60b6f51c2a05cdc9fa387fa1830ec323b528a304).
Dazu kommen ausschließlich die Versions-/Dokumentationsänderungen dieses PR.
Diese Zählung beschreibt den Ausgangsvergleich, nicht eine neue Auditbewertung.

| Bereits integrierter Teilumfang | Wesentliche Wirkung / geltender Detailvertrag |
| --- | --- |
| [#39](https://github.com/LeonMoebius-code/vermoegensnavigator/pull/39) Modellportfolio | Freigegebene modellimplizite Private-Select-Zielquoten, ausdrückliche ZinsFix-/MEA-Klassifikation und dynamischer nicht blockierender Mindestanlagehinweis. Keine nachgewiesene aktuelle Depotzusammensetzung. [Vertrag](Modellportfolio_Produktdurchschau.md). |
| [#40](https://github.com/LeonMoebius-code/vermoegensnavigator/pull/40) Termine / Recovery / Vermögenshaus | Monatsgenaue relative Bedarfstermine auf festem Fallreferenzdatum, gemeinsame Termine in Topf-/Ausgabepfaden, differenzierte lokale Recovery-Hinweise, konsistente scrollbar angeordnete Vermögenshausdarstellung. [Vertrag](Kapitalbedarfe_Recovery_Vermoegenshaus.md). |
| [#41](https://github.com/LeonMoebius-code/vermoegensnavigator/pull/41) H5a | Historische Jahresbindungen und mehrdeutige Legacy-Formen vor verlustbehafteter Konvertierung schützen. Keine stille Reparatur. [Vertrag](H5a_Legacy_Verlustschutz.md). |
| [#42](https://github.com/LeonMoebius-code/vermoegensnavigator/pull/42) H5b | Kontrollierte Wiederherstellung ausschließlich als geprüfte unabhängige Fallkopie mit Sicherung, ausdrücklichen Entscheidungen und Originalerhalt. [Vertrag](H5b_Kontrollierte_Fallkopie.md). |
| [#44](https://github.com/LeonMoebius-code/vermoegensnavigator/pull/44) F-021 | Strikte Laufzeitvalidierung ohne neue fachliche Obergrenze; explizite Termine haben Priorität. [Vertrag](F021_BEDARFSLAUFZEITEN.md). |
| [#45](https://github.com/LeonMoebius-code/vermoegensnavigator/pull/45) F-020 | Depotverkaufskonflikte sichtbar und aktiv klärungspflichtig; ungeklärte Ausgaben/Speicherung blockiert. [Vertrag](F020_DEPOTVERKAUF_KONSISTENZ.md). |
| [#46](https://github.com/LeonMoebius-code/vermoegensnavigator/pull/46) F-017 | Produktrisikohinweise aus der tatsächlichen Produktquelle; keine neue Kaufsperre. [Vertrag](F017_PRODUKTRISIKOWARNUNGEN.md). |
| [#47](https://github.com/LeonMoebius-code/vermoegensnavigator/pull/47) F-010/F-023 | Manuelle Klassifikationsklärung, strikte aktuelle Klassen und Vorrang vorhandener Katalogmixe. [Vertrag](F010_F023_KLASSIFIKATIONSINTEGRITAET.md). |
| [#50](https://github.com/LeonMoebius-code/vermoegensnavigator/pull/50) F-012 Variante A | Lokale Terminentwürfe, tatsächliche plangenaue Verlustvorschau und ausdrückliche zustandsgebundene Bestätigung; bei Falländerung neu prüfen, Abbruch ohne Verlust, keine Umbuchung. #48/#49 sind ersetzte, nicht gemergte Stände. |
| [#51](https://github.com/LeonMoebius-code/vermoegensnavigator/pull/51) Projektgedächtnis | Rollen-/Pflege-/Übergabeverträge und D-10-Kaltstartentscheidung; keine automatische Merge-/Releasefreigabe. [Operating Model](project/OPERATING_MODEL.md). |
| [#52](https://github.com/LeonMoebius-code/vermoegensnavigator/pull/52) F-007 | Sichere eindeutige Excel-Blattnamen; damalige F-026-Bewertung ausschließlich READ-ONLY. [Bewertung](P2_F007_XLSX_F026_Bewertung.md). |
| [#53](https://github.com/LeonMoebius-code/vermoegensnavigator/pull/53) F-026 | Kalenderdomäne 0100–9999, kontrollierte Ablehnung ungültiger Referenzen/Ergebnisse und numerischer Überläufe; Monats-/Schaltjahrvertrag erhalten. [Vertrag](F026_KALENDERDOMAENE.md). |
| [#54](https://github.com/LeonMoebius-code/vermoegensnavigator/pull/54) F-008/F-013/F-016 | CSV-Encoding und referenzerhaltender Ersatzimport; gemeinsamer planbezogener Unterdeckungskern; explizite Nullmaps bleiben null. Einschließlich F-016 × F-012: Verlust einer sekundären Nullbindung erfordert Bestätigung als Zuordnungsinformation mit 0 €, kein finanzieller Verlust; verbleibende strategische Nullbindung bleibt erhalten. [Vertrag](P2_RELEASE_INTEGRITAET.md). |
| F-024/F-025 innerhalb #54 | „Zuletzt angewendetes Modell“ als begrenzte Metadatenklarstellung; Sparplan ohne Start wird als unvollständiger Entwurf in Editor, XLSX und Druck gekennzeichnet. Keine Modellhistorienarchitektur oder erfundene Termin-/Renditerechnung. |

Diese Einordnung deckt den gesamten Ausgangsvergleich ab. Die integrierten Tests,
Typecheck-Anpassungen und Dokumentationen gehören dazu. Bereits im Originalrelease
enthaltene A1–A11, P1–P4, D1 und H1–H4 gelten weiter. Eine technische Auswahl
„nur einzelne neue Fixes veröffentlichen“ existiert nicht: Der spätere R1-Run
baut den gesamten ausdrücklich freigegebenen main-Commit.

## F-019: tatsächlich entschiedener Anwendungsbereich

Leons Beschluss vom 26.10.2026 ([D-12](project/DECISIONS.md)) bestätigt als
reguläre CSV-Quelle das vollständige unterstützte agree21-Exportprofil mit
29 Spalten. Die EUR-Berichtswährung wurde bereits am 21.09.2026 fachlich
bestätigt und ist technisch berücksichtigt. Der [damalige Quellvertrag](V0182_ZeroTouch_CSV_Only_Verbindlicher_Nachtrag.md)
bleibt maßgeblich. Für diesen vorgesehenen Umfang ist F-019 fachlich geklärt;
keine zusätzliche Benutzerbestätigung, Währungsarchitektur oder neue Implementierung.

Das ist keine Herstellerzertifizierung und keine Freigabe beliebiger CSV-Dateien.
Generische Strukturübersichten erhalten weiterhin keine belegte EUR-Identität;
`reportingCurrency: null`/Profilannahmen und die bestehenden Bond-Sicherheitsgrenzen
bleiben bestehen. Das Feld „Währung“ wird nicht pauschal zur Berichtswährung
umgedeutet. Allgemeine bisherige EUR-Anwendungsanzeigen sind kein zusätzlicher
Herkunftsnachweis. Die historische P2-Bewertung bleibt sichtbar erhalten und ist
für den ausdrücklich entschiedenen Profilumfang fortgeschrieben.

## Datenstände und unveränderte Prototypgrenzen

| Im Code dokumentierte Quelle | Datenstand |
| --- | --- |
| Laufzeiten & Renditebandbreiten | 07.05.2026 |
| Modellportfolios PB / Hausmeinung Fonds-Matrix | jeweils 01.07.2026 |
| VV-Selektionsmatrix | 20.02.2026 |
| Depotoptimierer KCI | 15.07.2026 |

Quelle: `app/data/investment-data-sources.ts`. Diese Angaben bestätigen keine
heutige Aktualität. Seit dem öffentlichen Originalrelease wurden im integrierten
#39 bewusst Produktdurchschauen angepasst; sie sind im Umfang oben enthalten.
Dieser Versions-PR aktualisiert keine Daten oder Modellannahmen. Die spätere
fachliche Gesamtumfangsentscheidung muss deren Eignung für den öffentlichen
Testprototyp ausdrücklich berücksichtigen; aktuelle Marktdaten oder eine neue
Hausmeinungsfreigabe werden nicht behauptet.

V0.18.4 bleibt ein **öffentlicher Desktop-Testprototyp**. Keine Freigabe für
produktiven Bankberatungseinsatz oder Orders. Browserlokale Beratungsfälle sind
nicht revisionssicher; JSON-Sicherung/-Übertragung, P1/H5-Originalschutz und deren
Grenzen gelten weiter. Keine neue Datenschutz-/Informationssicherheitszertifizierung
oder atomare Cross-Tab-Speichergarantie. Bekannte Grenzen der Quellen, indikativen
Bondmodelle, unvollständigen Entwürfe sowie der nativen Excel-/Druckdarstellung
werden durch grüne CI nicht pauschal aufgehoben. Nur synthetische Testfälle,
keine vertraulichen Bankquellen oder echten Kundendaten veröffentlichen.

## Technische Nachweise und spätere Freigaben

Für diesen Draft sind Versions-/Diffkontrolle, unveränderte Abhängigkeitsauflösung,
`npm ci`, vollständiges reguläres `npm run verify` mit genau einem Build und
vollständiger Playwright-Chromium-Suite, R1-Artefaktvalidierung desselben Builds,
alle regulären R1-Regressionen ohne Skips und `git diff --check` erforderlich.
Finale Push-CI muss den tatsächlichen Feature-Head, PR-CI den synthetischen Merge
aus aktueller Base und Head prüfen. Originaljoblogs, Build-/Versionsnachweis,
vollständige Identitäten und SHA-256-Manifest gehören ins gemeinsame Abnahmepaket.
Die drei ursprünglichen CP0B-Lebenszyklen sind keine Obergrenze der heutigen Suite.
Ein lokaler Browsermangel ist als Nachweisgrenze auszuweisen; kein Testvertrag
wird zur Umgehung angepasst. Dieses Dokument behauptet keine vorweggenommenen
Prüfergebnisse des Versions-PR.

Nach beiden unabhängigen Abnahmen und Leons gesonderter Integrationsentscheidung
ist der dann aktuelle main erneut zu kontrollieren. Vor einem autorisierten
Release bleiben insbesondere erforderlich:

1. Fachliche Gesamtumfangsentscheidung einschließlich Daten-/Modellannahmen und
   vorgesehener öffentlicher Prototypnutzung; integrierte Feature-Abnahmen und
   D-12 ersetzen diese Releaseentscheidung nicht.
2. Aktuelle Pages-Quelle `GitHub Actions` und wirksame Required-Reviewer-Regel für
   `github-pages` kontrollieren. Die derzeitigen Settings sind mit den hier
   verfügbaren Connector-Leserechten **nicht unabhängig verifiziert**; YAML und
   historische Deploymenterfolge ersetzen den heutigen Regelbeleg nicht.
3. Noch vorhandene Rollbackquelle samt Site/Evidence, Runstatus und Ablaufdaten
   unmittelbar vor Veröffentlichung erneut prüfen.
4. Erst nach Leons ausdrücklicher Releaseautorisierung den unveränderten manuellen
   R1-Workflow auf main starten: exakte SHA-Bindung, reguläres vollständiges Gate,
   genau ein Build, unveränderte Artefakte, Dateiliste und Provenienz sichern.
5. Den vorbereiteten konkreten Kandidaten und den tatsächlichen Environment-Halt
   prüfen. Erst nach Leons gesonderter Deploymentautorisierung freigeben; danach
   Live-Provenienz und zentralen synthetischen Bedienpfad kontrollieren.

Diese Schritte beschreiben den späteren Vertrag und autorisieren seine Ausführung
nicht. Die Feature-CI hat nur Leserechte und deployt nicht. Keine Änderung der
Workflows, Settings, Schutzregeln, Environmentfreigaben oder Pages-Ziele.

## Verfügbarer Rollbackweg

Bevorzugter gespeicherter Rückfallkandidat für eine spätere V0.18.4-Veröffentlichung
ist der heute öffentliche erfolgreiche Originalrelease **38542251552**. Am
26.10.2026 erneut abrufbar, nicht abgelaufen und anhand heruntergeladener Bytes
vollständig historisch validiert:

| Originalartefakt | ID | Tatsächliches Ablaufdatum (UTC) |
| --- | --- | --- |
| `r1-site-38542251552-1` | `11882333657` | 12.01.2027, 09:25:36 |
| `r1-evidence-38542251552-1` | `11882738200` | 12.01.2027, 09:25:36 |

ZIP-SHA-256 laut GitHub und erneut heruntergeladenen Bytes: Site
`c50787cec2a4d834a274c929dd3eb9676e8ef4a2611ec193bf728bf074f535c8`, Evidence
`4645899b0a8a5cdc28ff07c1ceb89d253d9e84f5c506eb7bf27497d67103053a`.
Die kürzere Pages-Paketfrist bis 13.11.2026 ist nicht die Retention dieser
wiederverwendbaren normalen Site-/Evidence-Artefakte.

Der ältere V0.18.2-Originalrun **36696150438** ist ebenfalls success/Attempt 1;
Site `11087408075` und Evidence `11087123359` sind laut erneuter API-Abfrage noch
vorhanden, Ablauf 29.12.2026, 09:26:44 UTC. Seine Bytes wurden in diesem Auftrag
nicht erneut vollständig heruntergeladen/validiert. Er bleibt historischer
Zusatznachweis und wird nicht mit der bevorzugten V0.18.3-Rückfallquelle verwechselt.

Späterer Rollback ausschließlich nach eigener Autorisierung gemäß
[Releaseprozess](Releaseprozess.md): manueller Rollbackworkflow auf main,
numerische Originalrelease-Run-ID, gespeicherte Site/Evidence und deren Identität,
historisches Manifest/Checksum und Provenienz prüfen, gespeicherte Bytes ohne
Neubau paketieren, erneute ausdrückliche Environmentfreigabe. Kein Root-/Branch-
Fallback und keine Rollback-von-Rollback-Kette. Ablauf/Löschung eines Runs oder
Artefakts begrenzt den Weg; Verfügbarkeit nie dauerhaft unterstellen.
**Website-Rollback setzt keine browserlokal gespeicherten Beratungsfälle zurück.**
Eine echte neue Rollbackprobe wurde nicht ausgeführt.

PR #43 bleibt **AUDIT ONLY – NEVER MERGE**. Die Versionsvorbereitung endet mit
Draft-PR und identischen Unterlagen für die zwei unabhängigen Abnehmer.
