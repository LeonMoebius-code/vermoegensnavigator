# V0.18.3 – Vorbereitung des Stabilisierungsreleases

Stand: 14.10.2026. Beschlossene Zielversion: **V0.18.3 / Schema 11**.
**Noch nicht veröffentlicht.** Die technische Vorbereitung und ein grüner PR
sind keine fachliche Gesamtumfangsfreigabe und keine Deploymentfreigabe.

## Identität und eng begrenzte Änderung

| Stand | Identität |
|---|---|
| Weiterhin öffentlicher Prototyp | V0.18.2, Source `50a8a06d73ddc59472a2d66ef46ac624597e2c0f` |
| Historischer Originalrelease | R1-Run `36696150438` |
| Historische erfolgreiche Rollbackprobe | Run `36698314238` |
| BASE_SHA der Vorbereitung | `51e0a834c291a6252f56dfa51aa7bd48ae671e28` |
| BASE_TREE | `84a3a2002341ab1ad204a3232d33197dba6c9f4b` |
| Feature-Branch | `work/release-v0183-version-preparation` |
| Kandidat | V0.18.3; Feature-SHA/Tree und tatsächliche CI-Nachweise im PR-Abschlussbericht |

Diese Vorbereitung ändert nur die Projektversion in `package.json`, beide
Projektversionsfelder in `package-lock.json`, die sichtbare Kennzeichnung
`Prototyp V0.18.3` und aktuelle Status-/Entwicklungsdokumentation. Der Hinweis
`Browser-lokal, keine revisionssichere Speicherung.` bleibt unverändert.
Dependency-Auflösung, Paketintegritäten, Schema 11 und sämtliche bestehenden
Produkt-, Import-, Export-, Persistenz-, Finanz-, Daten- und Releaseverträge
bleiben erhalten. Historische V0.18.2-/CP-/R1-Nachweise behalten ihre Identitäten.
V0.19 bleibt für den freien Planvergleich vorgesehen; V0.20 bleibt unberührt.

## Gesamter integrierter Veröffentlichungsumfang

Der Git-Vergleich des bisherigen Live-Source mit BASE_SHA weist **50 zusätzliche
Commits einschließlich Mergecommits und 94 geänderte Dateien** nach. Die vollständige
Datei- und Commitliste ist über den
[Sourcevergleich](https://github.com/LeonMoebius-code/vermoegensnavigator/compare/50a8a06d73ddc59472a2d66ef46ac624597e2c0f...51e0a834c291a6252f56dfa51aa7bd48ae671e28)
nachprüfbar. Zu diesem integrierten Stand kommen nur die oben genannten
Versions-/Dokumentationsänderungen dieser Vorbereitung.

| Integrierter Teilumfang | Wirkung gegenüber dem bisherigen Live-Source |
|---|---|
| R2 | Alte generierte Root-Website-Dateien entfernt; Build aus `github-pages/`, `public/` und Produktquellen erhalten |
| P1–P4 | Operationsbasierte Persistenz/Recovery, Depot- und Plangraphintegrität, unabhängige aktive/bevorzugte Auswahl sowie verbindliche Fallimport-/Plankopieidentitäten |
| D1 | Vollständiges planunabhängiges IST, gemeinsame PLAN-/ZIELPLAN-Projektion und vollständige Zielstruktur in Ergebnis, Excel und Druck |
| A1–A11 einschließlich Teilpaketen | Extraktion von Klassifikation, Leaf-/Domainverträgen, Katalogen, Advisory-Inhalten, Formatierung, Vermögensprojektion, Kapitaltöpfen, Allokationen, Einstiegsplänen, Depot-/Planidentität, Depot-Lifecycle, Modellportfoliooperationen und Normalisierung |
| H1–H4 | Sichere deutsche Betragseingabe, Runtime-Finanzvalidierung, Historienanzeige/Restore und Ratenanzahl 1–1.200 |
| UI / Import / Export | Sichtbare Eingabefehler und stabile Entwürfe, kontrollierte Import-/Restore-Ablehnung und D1-Ausgaben |
| Tests / Build / Dokumentation | Erweitertes Verify-Gate, Extraktionspfade und Typecheck angepasst; Referenz-, Betriebs- und Produktdokumentation fortgeschrieben |

Diese Zeilen ordnen den vollständigen Sourcevergleich ein. Sie beschränken den
Umfang nicht auf ausgewählte Features: Der R1-Workflow bindet und baut den
gesamten beim späteren Dispatch freigegebenen Main. **Eine technische Auswahl
„nur H1–H4 veröffentlichen“ existiert nicht.** A1–A11, P1–P4, D1 und H1–H4 sind
integriert und unabhängig abgenommen. Die ursprünglichen Astra-Findings F-001
bis F-007 sind geschlossen; der eigenständige H1–H4-Abschlussaudit und der
Release-Readiness-Audit vom 13.10.2026 sind frühere Nachweise. Letzterer lautet
**B – bedingt vorbereitet**. Diese Vorbereitung ist kein erneuter Deep-Audit.

### Bestehender D1-Vertrag

Die bereits integrierte fachliche Ausgabesemantik wird unverändert aus dem
[verbindlichen D1-Sichtenvertrag](D1_Ergebnis_Export_Sichtenvertrag.md) übernommen:

- **IST:** vollständiges aktuelles Depot plus erfasste aktuelle Liquidität,
  unabhängig von Plan, Modus, Auswahl, simulierten Verkäufen und Neuanlagen.
- **PLAN:** aktive Planung mit modeabhängigem Bestand, Neuanlagen und nicht
  zugeordnetem Planungskapital als Liquidität.
- **ZIELPLAN:** dieselbe Projektion ausschließlich für die ausdrücklich bevorzugte
  Planung. Ohne preferred kein Ziel und kein Fallback auf Active.
- **Allgemeiner Export:** vollständige bevorzugte Zielstruktur; Ergebnis,
  Excel-Vermögensstruktur und gemeinsamer Kunden-/interner Druckabschnitt
  verwenden dieselbe Projektion.
- **Neuanlagen:** separate Produkt-/Umsetzungsinformation; Bestandspositionen
  werden dadurch nicht zu neuen Allokationen.

Ungeklärte Beträge bleiben separat und im vollständigen Prozentnenner enthalten.
Die eigenständige physische IST-Bondanalyse und Depotcheck-Projektion behalten
ihren bestehenden Fachkontext. D1 ist einzeln abgenommen; die spätere Freigabe
des gemeinsamen V0.18.3-Veröffentlichungsumfangs muss seine Semantik einschließen.

## Vorhandene Produktdaten und Prototypgrenze

Der Code dokumentiert in `app/data/investment-data-sources.ts` folgende Datenstände:

| Quelle / Inhalt | Im Code vorhandener Datenstand |
|---|---|
| Laufzeiten & Renditebandbreiten | 07.05.2026 |
| Modellportfolios PB | 01.07.2026 |
| Hausmeinung Fonds-Matrix | 01.07.2026 |
| VV-Selektionsmatrix | 20.02.2026 |
| Depotoptimierer KCI | 15.07.2026 |

Dies sind vorhandene Codeangaben, keine Bestätigung ihrer heutigen Aktualität
oder fachlichen Datenfreigabe. Der READ-ONLY-Release-Audit vom 13.10.2026 hat die
Initializer von `houseProducts`, `managedPortfolios`, `modelPortfolios`,
`dataSources` und `solutionTypes` gegenüber dem bisherigen Live-Source als
bytegleich nachgewiesen. Dieser frühere Nachweis wird übernommen; die aktuelle
Vorbereitung ändert keine Katalogdatei. Sie erzeugt keine neue Hausmeinung,
keine aktualisierten Marktinformationen und keine bankfachliche Datenfreigabe.
Fonds, Modellportfolios, Vermögensverwaltungen, Bondmodelle, Depotklassifikation
und Risikobewertungen werden nicht angepasst.

V0.18.3 soll eine **öffentliche Testversion / ein Desktop-Prototyp** bleiben.
Es besteht keine Freigabe für produktiven Bankberatungseinsatz. Die Freigabeprüfung
verwendet keine echten Kundendaten. Browserlokale Fallhaltung bleibt browserlokal
und nicht revisionssicher; keine neue Datenschutz- oder
Informationssicherheitszertifizierung wird behauptet.

## Weiterhin offene Releasevoraussetzungen

1. **Unabhängige PR-Abnahme und fachliche Gesamtumfangsfreigabe:** Die Projektleitung
   entscheidet gesondert über die Veröffentlichung des gesamten integrierten
   Main als öffentlichen Testprototyp, einschließlich A1–A11, P1–P4, D1, H1–H4,
   der enthaltenen Daten und Modellannahmen. Der Versionsbeschluss ersetzt das nicht.
2. **Pages-Quelleneinstellung:** Der berechtigte Betreiber muss
   `Settings → Pages → Build and deployment → Source` prüfen und `GitHub Actions`
   bestätigen. Diese administrative Bestätigung ist weiterhin offen. Die URL
   bleibt `https://leonmoebius-code.github.io/vermoegensnavigator/`.
3. **Environment:** Die Required-Reviewer-Regel für `github-pages` wurde im
   früheren Release-Readiness-Audit direkt bestätigt. Dieser Auftrag verändert
   sie nicht und erteilt keine manuelle Deploymentfreigabe.
4. **Rollback:** Die Originalartefakte des R1-Runs `36696150438` waren im früheren
   Audit verfügbar; dokumentierte Retention bis **29.12.2026**. Ihre Verfügbarkeit
   muss vor der späteren Releaseentscheidung erneut geprüft werden. Ein Rollback
   stellt Websitebytes zurück, keine browserlokalen Falldaten. Keine neue Probe.
5. **Späteres eigenes Release-Gate:** Der unveränderte Releaseworkflow muss gegen
   den dann ausdrücklich freigegebenen Main erneut prüfen und sein gebundenes
   Artefakt zur gesonderten Environment-Freigabe bereitstellen.

## Prüf- und Freigabegrenze dieser Vorbereitung

Gefordert sind fokussierte Versions-/Diff-/Treekontrolle, `npm ci`, vollständiges
`npm run verify` mit genau einem Build je Durchlauf und CP0B 3/3 sowie separat der
R1-Artefaktvalidator gegen den tatsächlichen Feature-SHA und 55/55 Operationaltests
ohne Skips. Push-CI und tatsächlicher synthetischer PR-Merge müssen erfolgreich
sein; Identitäten und ausgeführte Resultate werden im Abschlussbericht dokumentiert.
Das hier ist eine Prüfanforderung, keine vorweggenommene Erfolgsmeldung.

Kein Merge, Tag, Release, Workflowdispatch, Rollback, Deployment, Environment-Approval
oder Änderung von GitHub-Einstellungen durch diesen Auftrag.
