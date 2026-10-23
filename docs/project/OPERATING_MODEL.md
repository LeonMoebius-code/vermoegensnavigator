# Operating Model

Dauerhafte Arbeitsregeln; veränderlicher Stand ausschließlich im
[PROJECT_STATUS](PROJECT_STATUS.md), wirksame Beschlüsse in [DECISIONS](DECISIONS.md).
Dieses öffentliche Dokument beschreibt Befugnisse, beglaubigt aber weder
Nutzeridentität noch private Zugriffsrechte. Zuerst READ-ONLY; ein Nutzer-Kickoff
kann den geltenden Rahmen einmal bestätigen. Daraus folgt keine wiederholte
Einzelfreigabe für ordnungsgemäße Feature-Merges oder den vorgesehenen API-Transport.
Außerhalb dieses Rahmens anhalten. Governance-Integration ist separat zu entscheiden.

## Quellen und Widersprüche

Live-GitHub belegt implementierten Code, Ref-/PR-/CI-Zustand; Releaseartefakte
belegen veröffentlichte Bytes. Originalfachverträge und spätere konkrete
Nutzerbeschlüsse bestimmen den Sollstand. Datierte Dokumente sind Checkpoints.
Bei Kollision neueren bestätigten Beschluss, alte Aussage und Auswirkung sichtbar
benennen; keinen stillen Normwechsel vornehmen. Fachlich unaufgelöste Widersprüche
sind STOP. Der Kopf der Master-Spezifikation und alte Schema-/Testzahlen können
überholt sein; neue Detailverträge ergänzen sie, ohne sie vollständig zu kopieren.

## Rollen und Befugnisse

| Rolle | Verantwortung und Grenze |
| --- | --- |
| Leon | Entscheidet Fachvarianten, Prioritäten und Veröffentlichungen; führt selbst keine Shell-/Git-/npm-Befehle aus. |
| Projektleiter | Empfiehlt eigenständig kurz Priorität, Aufwand, Risiken und Alternativen; bittet um „Ja, passt“. Erst nach Zustimmung vollständiger neuer Work-Auftrag, außer Leon verlangt ihn direkt. Eigene unabhängige Code-/Fach-/Architekturabnahme; führt beide Urteile zusammen. Bedingter Feature-Merge gemäß untenstehendem Vertrag. |
| Work | Nur beschlossenes Paket; Preflight, Originalschutz, Umsetzung, Commit, erlaubte Veröffentlichung, Draft-PR, volle CI, Korrekturen und kompakte Nachweise. Kein unabhängiges GO, kein Merge. |
| Separater Reviewer | Organisatorisch unabhängig, ausschließlich READ-ONLY: tatsächlicher Produktionsdiff, Fach-/Sicherheitsverträge, Originale, Git-/CI-Identitäten und konkrete Anzeige-/Exportpfade. Eigenes GO/NO-GO; keine GitHub-Schreibaktionen. |
| Audit | Separater READ-ONLY-Nebenprozess; Findings sind keine Fix-, Work-, Merge- oder Veröffentlichungserlaubnis. |

## Paketablauf und Feature-Merge

Kurze Empfehlung → Leons Zustimmung → vollständiger Work-Auftrag → isolierter
Preflight/Transport → Umsetzung/Originalcommit → Draft-PR → vollständige Push-
und PR-CI → zwei parallel unabhängige GO/NO-GO → unmittelbare Integritätsprüfung
→ bedingt autorisierter Feature-Merge → main-/Parent-/Tree-Nachprüfung → kurze
nächste Empfehlung. Kein automatischer Folgeauftrag nach Merge.

Work übergibt **identische finale Unterlagen gleichzeitig** an Projektleiter und
separaten Reviewer. Beide prüfen möglichst vor Kenntnis des anderen Urteils.
Sie entscheiden selbst anhand desselben finalen Stands; fremdes GO ist kein eigenes.
CI ersetzt keine fachliche Abnahme. Veränderte Stände, widersprüchliche Urteile,
offene Fachfragen oder fehlende finale Gates sind Merge-STOP.

Für von Leon beauftragte reguläre **Feature-PRs** ist der Projektleiter dauerhaft
bedingt zum Merge autorisiert: zwei positive unabhängige Abnahmen desselben
finalen Heads; aktuelle Base/Head/Parents/Trees, erlaubter Dateidiff und beide
vollständigen Gates unmittelbar vorher prüfen. Merge an die erwartete Head-SHA
binden. Danach tatsächlichen main, Mergeparents und erwarteten Integrationstree
kontrollieren. Ein Basewechsel erfordert erneute Integrationsbewertung und gültige
CI; Abnahmen bei relevanten Änderungen erneuern. Keine Freigabe aus Mergeability.
Governance-PRs, Release, Deployment, Rollback und Settings sind davon ausgeschlossen.

## Preflight und Originalschutz

Remote-Identität, Live-main/Tree, offene und gemergte PRs, Branches, lokale Heads,
Worktrees und uncommittete Änderungen lesend prüfen. Schon integrierte Pakete
nicht neu beginnen; langlebige Branches beweisen keinen offenen Auftrag.
Laufende Arbeiten und Originalnachweise intakt lassen; nur sauberen isolierten
Arbeitsbaum auf bestätigter Basis erzeugen. Kein Hard Reset, Force-Push oder
Löschen fremder Stände, kein heimliches Rebase/Cherry-Pick. Geschlossene oder
ersetzte PRs bedeuten nicht gelöschte lokale Originale. Bei langen Läufen einen
nachvollziehbaren persistenten Checkpoint erhalten. Kein Doppelstart derselben Arbeit.

## Authentifizierter GitHub-Transport

Vor größerer Arbeit tatsächlich nutzbaren autorisierten Publikationsweg prüfen.
Shell-HTTPS-Credentials, GitHub-App-Rechte und Leons Rechner sind unterschiedliche
Voraussetzungen; fehlenden Shellzugang nicht wiederholt nutzlos testen oder durch
Auslesen von Geheimnissen umgehen. Beauftragte reguläre **Featurearbeit** darf
dauerhaft per berechtigter GitHub-API veröffentlicht werden, auch mit anderer
Remote-Commit-ID, ausschließlich wenn:

1. Lokaler Originalcommit samt sämtlichen Git-Objekten und Nachweisen erhalten ist.
2. Exakter Git-Tree inklusive Bytes, Dateimodi und Struktur identisch ist.
3. Original und Remote denselben frisch bestätigten direkten main-Parent haben.
4. Original/Remote/Parent/Tree und Identitätsabweichungen transparent belegt sind.
5. Vollständige reguläre CI auf tatsächlichem finalem Remote-Head und synthetischem
   PR-Merge erfolgreich ist; Metadatenabweichung nicht als gleiche SHA ausgegeben wird.

Kein regelmäßiger neuer Sonderfreigabebedarf allein wegen dieser Metadatenabweichung.
Frühere fallbezogene API-Erlaubnisse sind historische Vorläufer, kein heutiges Verbot.
Andere Auftragsarten benötigen passenden Scope; der initiale Governance-Auftrag
erlaubt diese Alternative einmalig unter denselben Identitätsbedingungen.
Bei zwischenzeitlich verändertem main: Ausgangslage erneut bewerten, vorhandene Arbeit erhalten;
keine unkontrollierte Neuschreibung. Ohne sicheren Transport gezielter STOP.

## CI und Evidenz

[package.json](../../package.json) mit `npm run verify` und
[Feature CI](../../.github/workflows/ci.yml) sind die ausführbaren Gatequellen.
Regulär Push auf `work/**` **und** PR gegen `main`: Fach-/Domainprüfungen,
Referenzbasis, Typecheck, genau ein regulärer Build, echte Playwright-Chromiumtests;
danach R1-Artefaktvalidator auf unveränderten Buildbytes, Operationaltests ohne
Skips und Diffcheck. R1 hatte historisch 55/55; CP0B ist die ursprüngliche
Drei-Lebenszyklen-Baseline, keine Obergrenze der heutigen Browser-Gesamtsuite.
Keine volatile Browserzahl als aktuelle Mindestzahl hardcodieren.
Verify/Einzelskripte wegen gemeinsamer temporärer Pfade sequenziell ausführen.

Originaljoblogs müssen tatsächlichen **Push-Checkout = Feature-Head** und
**PR-Checkout = synthetischer Merge** belegen. Run-Metadatum `head_sha` allein
beweist den Mergecheckout nicht. Mergeparents und Tree, finale Base und Runs
abgleichen. Lokaler Browsermangel ist kein bestandener Test; reguläre GitHub-CI
kann auf beiden Identitäten den maßgeblichen vollständigen Nachweis erbringen.
Keine Abschwächung von Assertions, Retries, Flags, Browserkonfiguration oder
Workflows zum Grünfärben. Fehler nach Infrastruktur, Fixture/Selector, Fachdefekt
und Flakiness ursächlich trennen; mögliche Datenverluste gezielt prüfen.
Nach Korrektur finalen Diff/Tree und beide CI-Seiten erneut nachweisen.

Abnahmepaket: Abschlussbericht, originale Run-/Jobbelege, Head/Base/Parent/Tree,
Prüfmatrix, SHA-256-Manifest und wesentliche Fachbeweise. Große historische Logs,
Diagnosen und Traces separat geschützt und unverändert verfügbar halten.
Bericht oder Testzählung ohne originären Lauf sind keine Ersatzbeweise.

## Diagnose-PR 43

**[PR #43](https://github.com/LeonMoebius-code/vermoegensnavigator/pull/43):
AUDIT ONLY, NEVER MERGE.** Nicht verändern, mergen oder mit Produktfixes verbinden.
Absichtlich rote Diagnose-Solltests können reale Defekte belegen, sind aber kein
grünes Feature-/Releasegate. Folgefixes benötigen eigene grüne Regressionen.
Eine spätere Schließung erfordert einen eigenen ausdrücklichen Auftrag.

## Fachliche Vertragslandkarte

Die verlinkten Originale bestimmen Details; diese Landkarte ist keine zweite Spezifikation.

| Vertrag | Leitplanke / Quelle |
| --- | --- |
| P1 | [Aktueller Store, sichere Fallpersistenz, Originalbytes, verifizierte Backups](../P1_Sichere_Fallpersistenz.md). Gesunde Nachbarn erhalten; keine atomare Cross-Tab-Garantie behaupten. |
| P2 | [Depot-/Holdingreferenzen](../P2_Depotreferenzintegritaet.md); keine stille Zufallszuordnung. |
| P3 | [Plan-/Allocation-/Investment-Graph](../P3_Planintegritaet.md); activePlanId und preferred unabhängig, kein Preferred-Fallback. |
| P4 | [Copy/Import](../P4_Copy_Import_Vertrag.md): Fallimport erneuert äußere Fall-ID; Plankopie kontrolliert innere IDs/Referenzen; gültige Historie erhalten. |
| D1 | [Ergebnis-/Export-Sichtenvertrag](../D1_Ergebnis_Export_Sichtenvertrag.md): IST tatsächlicher planunabhängiger Bestand, PLAN aktiv, ZIELPLAN ausschließlich preferred, VERGLEICH Darstellung. Ergebnis/XLSX/Druck konsistent, keine Doppelzählung. |
| H1/H2 | [H1 / PR #34](https://github.com/LeonMoebius-code/vermoegensnavigator/pull/34), [Betragseingabe](../../app/presentation/amount-input.tsx), [strikte Finanzvalidierung](../H2_Finanzvalidierung.md); keine stille aktuelle Typkonversion. |
| H3 | [Opake historische Snapshots und kontrollierter Restore](../H3_Historie_Restore.md); keine stille Bereinigung, Abbruch ohne Verlust. |
| H4 | [Gestaffelte Raten 1–1.200](../H4_Ratensicherheit.md); nicht mit dem XLSX-Finding gleichen F-Schlüssels verwechseln. |
| H5a/H5b | [Legacy-Verlustschutz](../H5a_Legacy_Verlustschutz.md), [kontrollierte Wiederherstellungskopie](../H5b_Kontrollierte_Fallkopie.md) historischer PR40-Bindungen; niemals stille In-place-Reparatur oder Validatorausnahme. |
| F-021 | [Bedarfslaufzeiten](../F021_BEDARFSLAUFZEITEN.md); Typ/Endlichkeit/Nichtnegativität und explizite Terminpriorität, keine unbeschlossene Laufzeitobergrenze. |
| F-020 | [Depotverkaufskonsistenz](../F020_DEPOTVERKAUF_KONSISTENZ.md); ungeklärter Entwurf sichtbar, Speicherung/Ausgaben bis aktiver Korrektur blockiert. |
| F-017 | [Produktrisikohinweise](../F017_PRODUKTRISIKOWARNUNGEN.md); tatsächliche Produktquelle, getrennte Risiken, keine neue Kaufsperre. |
| F-010/F-023 | [Klassifikationsintegrität](../F010_F023_KLASSIFIKATIONSINTEGRITAET.md); manuelle Klärung, strikte Klassen und Katalogmix-Priorität. |
| F-012 Variante A | [Fachumfang und Implementierungs-PR #50](https://github.com/LeonMoebius-code/vermoegensnavigator/pull/50): lokale Terminentwürfe, tatsächliche plangenaue Verlustvorschau, ausdrückliche zustandsgebundene Bestätigung; bei verändertem Zustand neu prüfen; Abbruch verlustfrei, keine automatische Umbuchung. Aktiven Nachfolge-/Mergezustand live ermitteln. |
| Produktdaten | [Master-Spezifikation](../VermoegensNavigator_Master-Spezifikation.md), [Modellportfolio-Vertrag](../Modellportfolio_Produktdurchschau.md); Datenstände und begrenzte Freigaben beachten. |
| R1/R2 | [Releaseprozess](../Releaseprozess.md), [V0.18.3-Vorbereitung](../V0183_Releasevorbereitung.md); Merge ist kein Release/Deployment, keine neuen generierten Root-Artefakte. |

## Inkrementelle Deep-Audits

Nur seit der letzten Projektleiterübergabe **neu abgeschlossene** Auditläufe
berichten; Zeitraum, bisherigen und neuen Checkpoint festhalten. Findings
deduplizieren; Bekanntes nur bei relevanter neuer Evidenz-/Statusänderung erneut.
Statische Indizien, ausgeführte Komponenten-/Domainprüfungen und reproduzierte
Browser-E2E-Folgen trennen. Findingnummern bei historischen Kollisionen mit Reihe
und Thema qualifizieren (z. B. Astra/F-007 versus Deep-Audit-08/F-007).
Projektleiter priorisiert nach realer Kunden-, Integritäts-, Export- und
Bedienwirkung, nicht nach Nummer. Keine pauschale Folgeaudit-/Hardening-Serie.
Nach Stabilisierung wieder Features priorisieren; neue Risiken gezielt bewerten.
Audit schreibt weder Code, Tests, PRs, Issues, Workflows noch Automations-Settings.
Historische Auditintervalle beweisen keine heute aktive Automation.

## Release und öffentliche Vertraulichkeit

Merge, Releasebereitschaft, Releasefreigabe und tatsächliches Deployment getrennt
belegen. Release/Deployment/Rollback und Repositorysettings immer eigens erlauben
lassen. R1/R2-Quellbindung, genau ein Build, unveränderte Artefakte, Environment-
Freigabe und gespeicherten Rollbackvertrag erhalten; kein historischer Root-Fallback.
Rollback von Websitebytes setzt keine lokalen Beratungsfälle zurück.

Öffentliches Repository: keine internen Bankdateien, Kundendaten, echten Fälle,
vertraulichen Mitarbeiter-/Geschäftsdaten, Secrets, privaten Chats oder Archive
hochladen. Nur öffentlich vertretbaren Beschlusskern und unverfängliche Referenz
dokumentieren. Beispiele/Nachweise als synthetisch kennzeichnen; sie beweisen
keinen realen Kundenverlust oder produktiven Einsatz. Produkt-/Datenquellen sind
keine regulatorische oder bankinterne Freigabe. Prototyp ist weder produktives
Ordersystem noch revisionssicherer Speicher. Vor jedem Publizieren prüfen.

## Pflegevertrag

Projektleiter verantwortet PROJECT_STATUS, DECISIONS und Prozesskonsistenz.
Work darf Änderungen im eigenen Auftrag vorbereiten, keine neuen Grundsätze
beschließen. Separater Reviewer prüft Widersprüche und Vertraulichkeit; Leon
entscheidet neue Fach-/Berechtigungsfragen. Pflege als Abschluss-/Entscheidungs-
checkpoint durchführen, ohne Verwaltungsauftrag pro Commit/Testzahl.

| Auslöser | Kleinste erforderliche Aktion des Projektleiters |
| --- | --- |
| Feature nach zwei Reviews integriert | Checkpoint/aktive Arbeit prüfen, materielle Änderungen eng gebündelt nachführen. |
| Neuer bestätigter Fach-/Organisationsbeschluss | Knapper DECISIONS-Eintrag oder Ersatzmarkierung; Status nur bei geänderter Priorität/Umfang. |
| Neue belastbare P1-/P2-Evidenz oder Entscheidung | Risikostatus/Quellenlink aktualisieren, kein Vollaudit wiederholen. |
| Readiness-/Releaseentscheidung | integriert / bereit / freigegeben / live getrennt mit tatsächlichen Nachweisen führen. |
| Rollen-/Befugnis-/Prozessänderung | Nur nach ausdrücklichem Beschluss Operating Model, ggf. AGENTS und DECISIONS gezielt ändern. |
| Chatwechsel oder wesentliche Paketpriorisierung | Live-Refs prüfen, Staleness und Zugriffslücken sichtbar machen. |

**Spätestens vor der nächsten verbindlichen Paketbeauftragung oder wesentlichen
Übergabe** materielle bekannte Abweichungen aktualisieren oder in PROJECT_STATUS
„seit letztem Checkpoint geändert – live nachprüfen“ mit konkret betroffenem
Punkt ausweisen. Kleine Änderungen bündeln; keine konkurrierende Roadmap.
Pflege darf ein sonst freigegebenes laufendes Feature nicht blockieren.
Dokumentations-PRs eng begrenzen; initialer und spätere Governance-Merges fallen
nicht automatisch unter die bedingte Feature-Merge-Erlaubnis.

## Kaltstartproben

Vor Einführung drei **tatsächlich neue Chats** ohne alte Übergaben: Projektleiter,
Work, Review. Vor Docs-Merge nur Rolle, Repositorylink, Docs-PR/Branch-Ref und
Prüfauftrag geben; Lesen genau dieses Refs belegen. Szenarien: P erkennt stale
F-012/PR #43 und priorisiert ohne neuen Vollauftrag; W prüft hypothetischen
API-Transport, Originalschutz/fremden Worktree und ein rotes Gate; R entscheidet
bei grünem Push und rotem synthetischem Merge **NO-GO**, selbstständig READ-ONLY.
Alle Tests sind synthetisch/hypothetisch und strikt READ-ONLY, auch für P/W.
Externer Testbogen enthält Aussagen, GitHub-Beleg, bestanden/nicht bestanden und
fehlende Regel. Ein kritischer Verstoß (Live-Ref, Befugnisse, PR #43, Tree/Parent/CI,
Unabhängigkeit, Releasegrenze, Geheimnisse, Schreibaktion) bedeutet Kaltstart-NO-GO.
Lücke gezielt korrigieren, betroffene Probe real wiederholen. Work-Simulationen
zählen nicht als bestanden. Nach gesonderter Integration kleine Wiederholungsprobe
auf main nur mit Rolle und Repositorylink. Keine fünfte Repo-Testbogendatei.
