# Operating Model

Dauerhafte Arbeitsregeln; veränderlicher Stand ausschließlich im
[PROJECT_STATUS](PROJECT_STATUS.md), wirksame Beschlüsse in [DECISIONS](DECISIONS.md).
Dieses öffentliche Dokument beschreibt Befugnisse, beglaubigt aber weder
Nutzeridentität noch private Zugriffsrechte. Zuerst READ-ONLY; ein Nutzer-Kickoff
kann den geltenden Rahmen einmal bestätigen. Daraus folgt keine wiederholte
Einzelfreigabe für ordnungsgemäße Feature-Merges oder den vorgesehenen API-Transport.
Außerhalb dieses Rahmens anhalten. Governance-Integration ist separat zu entscheiden.

## GOV-02: Übergang und Wirksamkeit

Der Folgebeschluss [D-19](DECISIONS.md#fortschreibung-16112026) vom 16.11.2026
ist fachlich bestätigt und zur Dokumentationsumsetzung freigegeben. Das hier
beschriebene risikobasierte Verfahren gilt **erst nach zwei organisatorisch
unabhängigen vollständigen GO für denselben finalen Governance-Stand und Leons
gesonderter ausdrücklicher Integrationsentscheidung sowie erfolgter Integration**.
Bis dahin gelten D-01/D-02 in ihrer bisherigen Fassung. GOV-02 darf seine eigenen
Review- oder Merge-Anforderungen nicht erleichtern. Abgeschlossene Reviews und
historische Merges werden nicht nachträglich umklassifiziert.

## GOV-03: Übergang und Wirksamkeit

[D-20](DECISIONS.md#gov-03-16112026) ersetzt die manuelle CI-Nachweisroutine
**erst nach zwei organisatorisch unabhängigen vollständigen GO-Reviews desselben
finalen GOV-03-Stands, Leons gesonderter Integrationsentscheidung und erfolgter
Integration**. GOV-02 / D-19 ist seit PR #75 integriert und bleibt wirksam.
Bis zur GOV-03-Integration gelten die bisherigen Originalnachweispflichten,
insbesondere auch für GOV-03 selbst: vollständige finale Originaljoblogs beider
regulären CI-Läufe prüfen und erforderliche Belege sichern. Die neuen JSON-Belege
sind für diesen PR zusätzliche Evidenz, keine automatische Befreiung. Sind alte
Pflichtbelege technisch nicht verfügbar, gilt HOLD und Vorlage an die
Projektleitung zur gesonderten Entscheidung. Keine automatische Ausnahme.
Frühere Reviews, HOLD-Entscheidungen und Ausnahmen bleiben historisch unverändert.
Die folgenden Nachweisregeln beschreiben den Zielzustand nach dieser Integration.

## GOV-04: Übergang und Wirksamkeit

[D-21](DECISIONS.md#gov-04-17112026) trennt schnelle Entwicklungs-Push-CI und
vollständige PR-CI. Die neue Routine gilt erst nach zwei organisatorisch
unabhängigen vollständigen GO desselben finalen GOV-04-Stands, Leons gesonderter
Integrationsentscheidung, erfolgter Integration und nachweislich wirksamem
Merge-Schutz. Bis dahin bleibt auf main die bisherige vollständige Push-/PR-CI
maßgeblich. Die neuen Workflows werden im isolierten GOV-04-Draft erprobt,
daraus folgt keine allgemeine vorzeitige Umstellung oder Integrationsfreigabe.
GOV-02/D-19 und GOV-03/D-20 sind in der Ausgangsbasis über #75/#76 integriert.
Ihre Review- und Identitätsanforderungen bleiben erhalten. D-05 und Originalschutz
werden nicht geändert. Die folgenden CI-Angaben beschreiben den Zielzustand
nach wirksamer GOV-04-Integration.

[Technischer Vertrag und Merge-Schutz](GOV04_CI_MODELL.md): Der bisherige
Pflichtstatus bleibt ausschließlich der vollständigen PR-CI zugeordnet.
Repository-Settings werden nur lesend geprüft. Fehlender strikter Merge-Schutz
ist eine gesondert zu autorisierende Integrationsvoraussetzung, kein Anlass
für eigenmächtige Änderungen. GOV-04 ist kritisch und benötigt zwei voneinander,
von Work und Projektleitung unabhängige vollständige Reviews.

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
| Projektleiter | Empfiehlt eigenständig kurz Priorität, Aufwand, Risiken und Alternativen; bittet um „Ja, passt“. Erst nach Zustimmung vollständiger neuer Work-Auftrag, außer Leon verlangt ihn direkt. Verantwortet fachliche Konzeption und Entscheidungen im bestätigten Rahmen, Priorisierung, Koordination, Risikoeinstufung und Statuskonsistenz. Prüft kompakte belastbare Review-Ergebnisse, Blocker und Restrisiken. Keine routinemäßige vollständige Code-/Diff-/CI-Originalprotokollprüfung. Unmittelbare Integritätskontrolle und bedingter Feature-Merge gemäß untenstehendem Vertrag. |
| Work | Nur beschlossenes Paket; Preflight, Originalschutz, Umsetzung, Commit, erlaubte Veröffentlichung, Draft-PR, eigene vollständige fachliche und technische Prüfung, volle reguläre Tests/CI, Korrekturen, überprüfbare Originalnachweise gemäß CI und Evidenz sowie kompakte Übergabe. Kein unabhängiges GO für eigene Umsetzung, kein Merge. |
| Unabhängige Reviewer | Je nach Risikoklasse ein oder zwei organisatorisch unabhängige Review-Chats, getrennt von Work und Projektleitung, bei Doppelreview auch voneinander unabhängig. Vollständige fachliche und technische Prüfung ausschließlich READ-ONLY: finaler Code-/Dateidiff, Fach-/Sicherheits-/Datenintegritätsverträge, Originale, Commit-Parents/Trees, originale CI-/Checkout-Belege, erforderliche Regressionen sowie kritische Anzeige-, Berechnungs- und Exportpfade. Eigene Entscheidung GO/HOLD/NO-GO, Befunde und Restrisiken. Keine Dateiänderungen, Commits, GitHub-Schreibaktionen oder Merges. |
| Audit | Separater READ-ONLY-Nebenprozess; Findings sind keine Fix-, Work-, Merge- oder Veröffentlichungserlaubnis. |

## Paketablauf und Feature-Merge

Kurze Empfehlung → Leons Zustimmung → vollständiger Work-Auftrag mit vorläufiger
Risikoklasse → isolierter Preflight/Transport → Umsetzung/Originalcommit und
Work-Selbstprüfung → Draft-PR → erfolgreiche finale schnelle Push-CI und vollständige PR-CI → ein oder
zwei vollständige unabhängige Reviews gemäß Risikoklasse → Prüfung der kompakten
Ergebnisse durch die Projektleitung → unmittelbare Integritätskontrolle → bedingt
autorisierter Feature-Merge → main-/Parent-/Tree-Nachprüfung → kurze nächste
Empfehlung. Kein automatischer Folgeauftrag nach Merge.

Work übergibt denselben finalen Prüfstand und identische vollständige Unterlagen
an die erforderlichen unabhängigen Reviewer, bei Doppelreview möglichst
gleichzeitig. Beide prüfen eigenständig, möglichst vor Kenntnis des anderen
Urteils. Fremdes GO darf nicht ungeprüft übernommen werden. Die Projektleitung
erhält vollständige Prüfberichte und Referenzen auf alle Originalnachweise.
CI ersetzt keine fachliche Abnahme.

Für von Leon beauftragte reguläre **Feature-PRs** bleibt der Projektleiter
dauerhaft bedingt zum Merge autorisiert: ein ausdrückliches unabhängiges GO bei
Standardfeatures, zwei voneinander unabhängige vollständige GO bei kritischen
Änderungen, jeweils für denselben konkreten finalen Stand. Es gelten alle
unveränderten Gates und die untenstehende unmittelbare Integritätskontrolle.
Governance-PRs, Release, Deployment, Rollback und Repository-Settings sind von
dieser allgemeinen Feature-Mergebefugnis ausgeschlossen. Ihre bisherigen
gesonderten Autorisierungs- und Freigabegrenzen bleiben bestehen. Ein positives
Review allein erlaubt insbesondere keine Governance-Integration.

## Risikoeinstufung und unabhängige Reviews

### Standardfeatures: ein vollständiger unabhängiger Review

Geringes oder begrenztes fachliches und technisches Risiko: rein visuelle
UI-Anpassungen, Text-/Layoutkorrekturen ohne fachliche Bedeutungsänderung,
isolierte Navigationsverbesserungen, nichtkritische Präsentationskomponenten
oder eng begrenzte Funktionen ohne Auswirkungen auf Berechnungen, Persistenz,
Sicherheit oder geschützte Daten.

Voraussetzungen sind Work-Selbstprüfung, erfolgreiche finale schnelle Push-CI
und vollständige PR-CI, vollständig vorliegende Originalnachweise, vollständige
Prüfung der tatsächlichen finalen Umsetzung und Originale durch einen
organisatorisch unabhängigen Reviewer, dessen ausdrückliches GO zur konkreten
finalen Identität und die unmittelbare Integritätskontrolle der Projektleitung.

### Kritische Änderungen: zwei vollständige unabhängige Reviews

Erhöhtes fachliches, technisches oder sicherheitsbezogenes Risiko, insbesondere:

- Finanzmathematische Berechnungen und Projektionen.
- Förder-, Steuer-, Renten- und Anspruchslogik.
- Risikoklassifikation und fachlich relevante Produktzuordnungen.
- Persistenz, Wiederherstellung, Import und Export.
- Integrität oder Vertraulichkeit von Kundendaten.
- Sicherheits- und Berechtigungskonzepte.
- Zentrale Datenmodelle oder wesentliche Architekturverträge.
- Sicherheits-, Verlustschutz- oder Validierungsmechanismen.
- Fachlich entscheidungsrelevante Kundenanzeigen, Warnungen und Beratungsergebnisse.

Entscheidend sind die tatsächlichen Auswirkungen, nicht Dateianzahl, Codeumfang
oder Paketname. Auch eine kleine UI-Änderung ist kritisch, wenn sie die
Interpretation eines Förderanspruchs, einer Berechnung oder einer wesentlichen
Risikowarnung beeinflusst. Beide Reviewer prüfen vollständig, unabhängig von
Work und voneinander, denselben finalen Stand.

### Einstufung, Eskalation und STOP

Die Projektleitung legt die vorläufige Risikoklasse bei Beauftragung fest.
Work prüft sie im Preflight und während der Umsetzung und meldet Abweichungen
unverzüglich. Jeder unabhängige Reviewer prüft die Einstufung ebenfalls und
kann eine Hochstufung verlangen.

- Bei Unsicherheit gilt kritisch.
- Keine Herabstufung nach einem Review zur Umgehung einer zweiten Abnahme.
- Kein künstliches Aufteilen zusammenhängender Änderungen zur Review-Reduzierung.
- Neu erkannte kritische Auswirkungen erfordern die fehlende Doppelabnahme.
- Bei NO-GO, widersprüchlichen Ergebnissen, fehlenden Nachweisen oder offenen
  Fachfragen gilt HOLD und Merge-STOP.
- Nach relevanten Änderungen am finalen Stand betroffene Prüfungen und Abnahmen
  erneuern. Fehlende finale Gates oder relevante Identitätsabweichungen sind STOP.

Die menschliche E2E-/Usability-Abnahme **AP-07c bleibt verpflichtend und offen**,
unabhängig von der technischen Review-Anzahl. Automatisierte Tests ersetzen sie
nicht. Die historische Ausnahme D-16 für PR #71 wird dadurch nicht erweitert.

## Review-Abschlussbericht und Übergabe

Jeder unabhängige Reviewer liefert einen kompakten, nachvollziehbaren Bericht:

| Feld | Pflichtinhalt |
| --- | --- |
| PR und Risikoklasse | PR-Nummer, Auftrag, Standard oder kritisch. Governance und andere Sonderfälle gesondert kennzeichnen. |
| Identitäten | Finaler Head, Base, Tree, synthetischer Merge und Parents. |
| Umfang | Tatsächlich geprüfte Dateien und Abweichungen vom Auftrag. |
| CI | Finale Push-/PR-Runs und tatsächliche Checkout-Identitäten. |
| Originalnachweise | Run-/Job- und JSON-Artefaktreferenzen, eigene Prüfung ihrer Commit-/Tree-/Parent-Zuordnung und Pflichtgates. Vertiefte Originalquellen samt Anlass und Ergebnis bei Eskalation. Für GOV-03 selbst gilt die Übergangsregel. |
| Teststatus | Relevante Tests, tatsächliche Ergebnisse, Skips und Abweichungen. |
| Fachprüfung | Wesentliche geprüfte Vertrags-, Sicherheits- und Datenintegritätsbereiche. |
| Befunde | Offene Probleme mit Schweregrad und Restrisiken. |
| Entscheidung | Eindeutig GO, HOLD oder NO-GO. |
| Gültigkeit | Exakter finaler Stand, für den das Urteil gilt. |

Ein bloßes GO ohne Identitäts- und Nachweiszuordnung genügt nicht. Originale
bleiben vollständig, unverändert und nachvollziehbar verfügbar. Die vollständige
unabhängige fachliche und technische Abnahme erfolgt in den Review-Chats.
Die Projektleitung muss Code, PR-Diff und CI-Originalprotokolle nicht routinemäßig
erneut vollständig prüfen. Bei konkreten Auffälligkeiten, relevanten
Widersprüchen oder Zweifeln muss sie gezielt nachprüfen oder an einen
unabhängigen Reviewer zurückgeben.

## Unmittelbare Integritätskontrolle und Feature-Merge

Die Projektleitung prüft anhand der Berichte die richtige Risikoklasse,
erforderliche Anzahl unabhängiger GO, denselben finalen Stand aller Urteile,
nachweislich erfolgreiche Pflichtgates, offene Befunde/Restrisiken und die
geltenden Befugnisse. Keine erneute vollständige technische Abnahme ohne
relevante Widersprüche oder Zweifel.

Unmittelbar vor dem Merge mindestens kontrollieren:

1. Aktuellen main und PR-Base.
2. Finalen PR-Head und erwartete Commit-/Tree-Identitäten.
3. Vorgesehenen Integrationstree und gültige Merge-Parents.
4. Zulässigen Umfang anhand des bestätigten Review-Berichts und der Dateiliste.
5. Finale schnelle Push-CI und vollständige PR-CI einschließlich verpflichtendem Abschlussjob, erfolgreiche Pflichtjobs und Identitätschecks, zugehörige JSON-Nachweise sowie korrekte Commit-/Tree-/Parent-/Run-/Attempt-Zuordnung. Aktuellen strikten Merge-Schutz gemäß GOV-04 prüfen. Ein grüner Status allein genügt nicht.
6. Erforderliche unabhängige GO-Entscheidungen für denselben finalen Stand.
7. Geltende bedingte Feature-Mergebefugnis und Sonderfreigabegrenzen.

Merge an die erwartete Head-SHA binden. Danach tatsächlichen main-Commit,
dessen Parents und erwarteten Integrationstree kontrollieren. Bei verändertem
Base-Stand, fehlenden Gates oder relevanten Abweichungen gezielter STOP.
Basewechsel erfordern erneute Integrationsbewertung und gültige CI, bei
relevanten Änderungen erneuerte Abnahmen. Mergeability ist keine Freigabe.

## Preflight und Originalschutz

Remote-Identität, Live-main/Tree, offene und gemergte PRs, Branches, lokale Heads,
Worktrees und uncommittete Änderungen lesend prüfen. Schon integrierte Pakete
nicht neu beginnen; langlebige Branches beweisen keinen offenen Auftrag.
Laufende Arbeiten und Originalnachweise intakt lassen; nur sauberen isolierten
Arbeitsbaum auf bestätigter Basis erzeugen. Kein Hard Reset, Force-Push oder
Löschen fremder Stände, kein heimliches Rebase/Cherry-Pick. Geschlossene oder
ersetzte PRs bedeuten nicht gelöschte lokale Originale. Bei langen Läufen einen
nachvollziehbaren persistenten Checkpoint erhalten. Kein Doppelstart derselben Arbeit.

Originalschutz verlangt keine zusätzliche Routinekopie: Sind Git-Originalobjekte
und erforderliche Belege zuverlässig erhalten und prüfbar, ist kein Git-Bundle
als allgemeiner Review-Anhang erforderlich. Bei konkret gefährdetem Erhalt eine
geeignete gezielte Sicherung vornehmen. Vorhandene Nachweisarchive nicht pauschal
löschen. Zusätzliche Archivierung und Erhalt der Originale sind getrennte Pflichten.

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

Der D-05-Vertrag zu Originalerhalt, identischem Tree einschließlich Bytes/Modi,
gleichem direkten Parent und transparenter lokaler/Remote-Identität bleibt
unverändert. Aus ihm folgt keine pauschale Pflicht zu zusätzlichen Bundles,
SHA-256-Manifesten oder ZIP-Übergaben. Originale weiter erhalten und prüfbar halten.
Der konkret freigegebene GOV-03-Auftrag erlaubt den nachvollziehbaren API-Transport
unter denselben Identitätsbedingungen, ohne allgemeine neue Transportbefugnisse.

## CI und Evidenz

Es gilt die [GOV-04-Übergangsgrenze](#gov-04-übergang-und-wirksamkeit).

[package.json](../../package.json) mit `npm run verify` und
[Feature CI](../../.github/workflows/ci.yml) sind die ausführbaren Gatequellen.
Entwicklungs-Push auf `work/**`: [Development CI](../../.github/workflows/development-ci.yml)
mit Checkout-JSON, CI-Sicherheitsregressionen, `npm run verify:development`
und Diffcheck. Das Paket umfasst gezielte Speicher-/Referenz-/Verlustschutztests,
Finanzvalidierung, Risiko- und Riester-Kern sowie Referenzbasis und Typecheck.
Kein regulärer Produktionsbuild, Chromiumlauf oder R1-Artefakttest im Push-Gate.
Es ist kein Integrationsnachweis und liefert niemals den bisherigen Pflichtstatus.

PR gegen `main`: vollständiges unverändertes `npm run verify` mit allen Fach-/
Domainprüfungen, Referenzbasis, Typecheck, genau einem regulären Build und echten
Playwright-Chromiumtests. Danach R1-Artefaktvalidator auf unveränderten Buildbytes,
Operationaltests ohne Skips und Diffcheck. CI-Sicherheitsregressionen und
GOV-03-Checkout-JSON bleiben zusätzlich verpflichtend. Der abschließende Job
**Tests, Typecheck, Build und Browser** läuft mit `always()` und verlangt einen
explizit erfolgreichen Vollprüfungsjob, dessen vollständige Step-Ergebnisse und
eine stand-/run-/attemptgebundene Bestätigung. Fehlende, fehlgeschlagene oder
übersprungene Vollgates geben keinen erfolgreichen Pflichtstatus frei.
Vor Bestätigung und Abschlussjob müssen aktuelle Remote-Refs für main, PR-Head
und synthetischen Merge exakt den geprüften Identitäten entsprechen.

R1 hatte historisch 55/55; CP0B ist die ursprüngliche Drei-Lebenszyklen-Baseline,
keine Obergrenze der heutigen Browser-Gesamtsuite. Keine volatile Browserzahl
als aktuelle Mindestzahl hardcodieren. Verify/Einzelskripte wegen gemeinsamer
temporärer Pfade sequenziell ausführen. Release- und Rollbackworkflows bleiben
unverändert. Kein Testfall entfällt aus der vollständigen Integrationsprüfung.

### Drei getrennte Prüfebenen

1. **Technische Tests:** Alle bestehenden Vollgatebefehle bleiben vor Integration vollständig und
   unverändert verpflichtend. Entwicklungs-Pushes nutzen das ausdrücklich begrenzte Schnellgate. Keine neuen Skips, Retries, Assertionabschwächungen
   oder pauschalen Timeout-Erhöhungen zum Erzwingen grüner CI.
2. **Technischer Identitätsnachweis:** Nach Checkout verpflichtend
   `scripts/verify-ci-checkout-identity.mjs` ausführen. Tatsächliche Commit-, Tree-
   und direkte Parent-Objekte prüfen. Push muss GitHub-SHA und Push-Payload auf
   `work/**` entsprechen. PR gegen `main` muss synthetischer Merge mit genau
   Base als erstem und Feature-Head als zweitem Parent sein. Repository, Workflow,
   Event, PR, Run und Attempt zuordnen. Fehlende oder widersprüchliche Daten sind
   Fehler, kein Fallback. `head_sha` allein beweist keinen Checkout.
3. **Zusätzliche manuelle Auswertung und Archivierung:** Vollständige
   Originaljoblogauswertung und separate Sicherung nur bei konkretem Bedarf.
   Keine allgemeine Pflicht zu großen ZIP-Paketen, historischen Logsammlungen,
   redundanten Artefaktkopien oder Git-Bundles für reguläre Übergaben.

### Erfolgreicher Standardfall

Für **beide finalen regulären Push-/PR-Läufe** genügen zugeordnete strukturierte
GitHub-Originalquellen: Run `completed` / `success`, erfolgreiche Pflichtjobs und
Steps ohne übersprungene Gates, erfolgreicher verpflichtender Identitätscheck,
vorhandener zugehöriger JSON-Nachweis und übereinstimmende Commit-/Tree-/Parent-
Identitäten. JSON unter `ci-checkout-identity-<run_id>-<attempt>` (Schema 1),
Run-/Job-Referenzen und kompakte Jobzusammenfassung nachvollziehbar prüfen.
JSON enthält zusätzlich `validation_scope` (`development`, `full` oder
`manual_limited`) und bestätigt ausschließlich die Checkout-Identität, nicht
den späteren Erfolg aller Tests. Push-Erfolg belegt nur das Schnellgate,
PR-Erfolg muss den vollständigen Prüfjob und den Abschlussjob umfassen.
Ein Artefakt aus fehlgeschlagener CI ist kein bestandenes Vollgate.

Die Regressionen des neuen Checks laufen zusätzlich und ersetzen keinen
bestehenden Test. `workflow_dispatch` wird als `manual_limited` mit
`regular_evidence: false` gekennzeichnet und prüft nur Branchref, Eventkontext
und Checkout-SHA. Die beiden CI-Workflows bieten keinen manuellen Trigger mehr an.
Ein manueller
Lauf ersetzt niemals einen regulären finalen Push- oder PR-Lauf.
Unbekannte Ereignisse schlagen fehl. Keine zusätzlichen Secrets/Berechtigungen.

Reviewer prüfen unverändert den tatsächlichen finalen Diff sowie alle relevanten
fachlichen, technischen und sicherheitsbezogenen Anforderungen entsprechend der
Risikoklasse. Nur die manuelle CI-Nachweisführung wird reduziert, nicht die
Review-Tiefe, Review-Anzahl oder organisatorische Unabhängigkeit.

### Vertiefte Prüfung und HOLD

Bei fehlgeschlagener/unvollständiger CI, fehlendem oder fehlerhaftem JSON,
Identitätsabweichungen, widersprüchlichen Run-/Job-/Git-Daten, Hinweisen auf
übersprungene Pflichtgates oder Testabschwächungen, unklaren Ausführungsbedingungen
oder begründeten Reviewerzweifeln gezielt GitHub-Originalquellen vertieft prüfen.
Dazu zählen Originaljoblogs, Artefakte und andere geeignete Originalbelege.
Wenn zur Klärung notwendig, vollständige Protokollsicherung anordnen.
Fehler nach Infrastruktur, Fixture/Selector, Fachdefekt und Flakiness ursächlich
trennen. Mögliche Datenverluste gezielt prüfen. Nach Korrekturen finalen Diff/Tree
und beide regulären CI-Seiten erneut nachweisen.

Fehlende oder nicht vertrauenswürdige Pflichtnachweise bedeuten **HOLD und
Merge-STOP**. Ein grüner Run allein genügt nicht. Ein nachweislich gleichwertiger,
nachvollziehbarer alternativer Originalbeleg darf zur Klärung dienen, wenn seine
Beweiskraft und eindeutige Zuordnung zum geprüften Stand ausdrücklich dokumentiert
und unabhängig bewertet werden. Eine bloße Identitätsbehauptung genügt nicht.
Dies hebt kein fehlgeschlagenes technisches Gate auf und ist keine automatische
Ausnahme für den GOV-03-Übergang.

### Kompakte Übergabe und Aufbewahrung

Abschlussbericht mit Head/Base/Parent/Tree, finalen Run-/Jobreferenzen,
JSON-Artefaktreferenzen und wesentlichen Fachbeweisen genügt im erfolgreichen
Standardfall. Reviewer bestätigen ihre eigene vollständige fachliche und
technische Prüfung sowie die konkrete Evidenzzuordnung im kompakten Bericht.
Die Projektleitung prüft belastbare Ergebnisse und unmittelbare Integrität,
ohne routinemäßige erneute Vollauswertung. D-05 und alle technischen Gates
bleiben unverändert.

Der Workflow fordert für das kleine Identitätsartefakt **30 Tage** Aufbewahrung
an. Die tatsächlich von GitHub ausgewiesenen Ablauf-/Verfügbarkeitsdaten prüfen,
keine unbegrenzte Verfügbarkeit behaupten. Ist langfristige Nachweisbarkeit
explizit erforderlich oder droht Verlust notwendiger Originalbelege, rechtzeitig
eine gezielte Sicherungsentscheidung treffen. Bestehende geschützte Originale
und Archive unverändert erhalten. Öffentlich ausschließlich unverfängliche
technische Metadaten veröffentlichen, keine Secrets oder vertraulichen Daten.

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
| Feature nach risikogemäß erforderlichen unabhängigen Reviews integriert | Checkpoint/aktive Arbeit prüfen, materielle Änderungen eng gebündelt nachführen. |
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

Ursprünglich verlangte der Auftrag vom 22.10.2026 drei neue Chats (Projektleiter,
Work, Review). **Für die Erstintegration ersetzt Leons ausdrücklicher Beschluss
vom 23.10.2026 diese Pflicht:** Der erfolgreich durchgeführte reale Projektleiter-
Kaltstart genügt als Einführungsnachweis; keine weiteren Pflichtproben für diese
Erstintegration. [D-09/D-10](DECISIONS.md) hält Ursprung und Ersetzung fest.

Leon bestätigt am 23.10.2026 den realen Projektleiter-Test als erfolgreich und
seine positive Bewertung durch beide Review-Chats. Work hat diesen Test nicht
selbst erneut durchgeführt. **Zum damaligen Stand 23.10.2026 waren Work- und
Review-Kaltstarts nicht durchgeführt; eigenständige Nachweise fehlten.**
Fortschreibung 13.11.2026: Der unabhängige Review-Chat wurde erfolgreich neu
übernommen (realer Reviewer-Kaltstart, von Leon bestätigt). Ein eigenständiger
Work-Kaltstart ist weiterhin nicht als durchgeführt belegt. Weitere tatsächliche
Chatwechsel werden im regulären Betrieb erprobt, ohne zusätzliche künstliche
Erstintegrationsproben. Der Einführungsbeschluss D-10 und die Governance bleiben
unverändert.

Bei zukünftigen tatsächlichen Rollenwechseln gelten die folgenden Prüfregeln;
sie begründen keine zusätzlichen Pflichtproben für die Erstintegration:
Vor Docs-Merge nur Rolle, Repositorylink, Docs-PR/Branch-Ref und Prüfauftrag geben;
Lesen genau dieses Refs belegen. Nach Integration bei tatsächlichem Chatwechsel
main mit Rolle und Repositorylink verwenden. Szenarien: P erkennt stale
F-012/PR #43 und priorisiert ohne neuen Vollauftrag; W prüft hypothetischen
API-Transport, Originalschutz/fremden Worktree und ein rotes Gate; R entscheidet
bei grünem Push und rotem synthetischem Merge **NO-GO**, selbstständig READ-ONLY.
Alle Tests sind synthetisch/hypothetisch und strikt READ-ONLY, auch für P/W.
Externer Testbogen enthält Aussagen, GitHub-Beleg, bestanden/nicht bestanden und
fehlende Regel. Ein kritischer Verstoß (Live-Ref, Befugnisse, PR #43, Tree/Parent/CI,
Unabhängigkeit, Releasegrenze, Geheimnisse, Schreibaktion) bedeutet Kaltstart-NO-GO.
Lücke gezielt korrigieren, betroffene Probe real wiederholen. Work-Simulationen
zählen nicht als bestanden. Die zwei unabhängigen Abnahmen des finalen Stands
und die gesonderte Governance-Mergeentscheidung bleiben erforderlich.
Keine fünfte Repo-Testbogendatei.
