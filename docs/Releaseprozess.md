# R1: Releaseprozess und manuelle Migration

Stand: 30.09.2026. Ausgangs-main: `6deddd177d16b067e638808f90b8bab88df6a94e`.
Branch: `work/operations-r1-release-decoupling`. R1 implementiert den neuen Weg;
erst die unten beschriebene manuelle Migration aktiviert ihn vollständig.
Keine Produkt-, Fachlogik-, Schema- oder Datenmigrationsänderung. CP0A1, CP0A2,
Restore-ID-Fix und CP0B bleiben unverändert. R2 ist ausdrücklich ausgeschlossen.

## Entwicklung und Release

Featurebranch → PR → **Feature CI** → Merge nach main → Live-Seite unverändert
(nach Umstellung von Pages auf Actions). Feature-CI hat nur `contents: read`.
Ihr Pflichtcheck heißt exakt **Tests, Typecheck, Build und Browser**; die UI
kann ihn als `Feature CI / Tests, Typecheck, Build und Browser` darstellen.

Actions → **Release GitHub Pages** → Run workflow → Branch **main** wählen.
Es gibt kein SHA-Eingabefeld. GitHub bindet den aktuellen main-SHA beim Dispatch
als `github.sha`; Checkout und zusätzliche HEAD-Prüfung binden exakt diesen
Commit. Spätere Merges verändern den bereits gestarteten Kandidaten nicht.
Ein Start auf einem anderen Ref überspringt alle Jobs und kann nichts deployen.

Der Prepare-Job führt aus:

1. main-Ref und ersten Run Attempt prüfen; SHA aus dem Workflow festhalten.
2. Exakten SHA ohne persistierte Git-Credentials auschecken; HEAD vergleichen.
3. Node 22 einrichten, `npm ci`, Chromium der fixierten Playwright-Version
   über `npx --no-install playwright install --with-deps chromium` installieren.
4. Einmal `npm run verify`: Fachtests → CP0A2 → Typecheck → **ein** Build → CP0B.
5. Website gegen Allowlist, Provenienz und das beim Build gespeicherte Manifest
   prüfen; erfolgreichen Gate-Nachweis außerhalb der Website schreiben.
6. Website und Evidence als normale unveränderliche Actions-Artefakte sichern;
   denselben Ordner als Pages-Artefakt paketieren und hochladen.
7. Erneut gegen das Buildmanifest prüfen. Erst danach darf Deploy beginnen.

Der Deploy-Job wartet am Environment **github-pages** auf Leon. Er verwendet
nur `configure-pages` mit `enablement: false` und `deploy-pages`. Kein Checkout,
keine Abhängigkeiten, Tests, Produktcode oder Builds in diesem Job. Der benannte
Pages-Upload desselben Runs wird veröffentlicht. Öffentliche URL bleibt:
<https://leonmoebius-code.github.io/vermoegensnavigator/>.

**Wichtig:** YAML allein erzwingt keine menschliche Freigabe. Die Required-
Reviewer-Regel muss vor dem ersten Release manuell eingerichtet sein. Ohne
diese Einstellung würde GitHub den Deploy-Job automatisch starten.

## Artefaktvertrag und Provenienz

`scripts/build-github-pages.sh` bereinigt ausschließlich den fest bestimmten
Projektordner `.pages-dist` über Node. Ein umgeleiteter Outputordner/Symlink
wird abgelehnt. Windows/Git Bash und Linux verwenden denselben Build.
Der Cacheparameter bleibt zwölf hexadezimale Zeichen: SHA-256 über die zwei
fest geordneten Inhaltsdigests von `app.js` und `styles.css`; absolute Pfade
fließen nicht ein. Die Werte ändern sich einmalig durch den korrigierten Hash.

Der Build schreibt `build-info.json` **vor CP0B** mit Source-SHA, UTC-Bauzeit,
Workflow, Run-ID/-Attempt, Node-/npm-, esbuild-/TypeScript-/Playwright-Version
und SHA-256 des Lockfiles. Nur explizite Metadaten werden übernommen; keine
Tokens, Secrets, Benutzernamen oder komplette Umgebungsvariablen. Lokal stehen
Workflow `local` und Run/Attempt `0`; der SHA stammt aus HEAD. Ein lokaler Build
mit uncommittierten Änderungen ist damit noch kein freigegebener Release.

Am Ende des Builds entsteht `outputs/r1-build-manifest.json`. CP0B startet den
bestehenden Static-Server direkt auf `.pages-dist` unter
`/vermoegensnavigator/`, ohne Staging/Neubau. Nach CP0B vergleicht
`verify-release-artifact.mjs` alle Dateinamen, Größen und Inhaltsdigests mit
diesem Manifest. Auch eine strukturell erlaubte Byteänderung wird abgelehnt.
Die Website wird danach nur gelesen, paketiert und hochgeladen.

Für neue Releasekandidaten enthält die aktuelle geschlossene Allowlist genau elf Dateien:

```text
.nojekyll
404.html
app.js
branding/private-banking-logo-cropped.png
branding/private-banking-logo.png
branding/volksbank-pur-logo.png
build-info.json
favicon.svg
index.html
og.png
styles.css
```

Nur `branding` ist als Unterordner erlaubt. Symlinks, Hardlinks, Spezialdateien,
fehlende/unerwartete Dateien, Dateien über 10 MiB und erkennbare private Keys,
GitHub-Token- oder AWS-Key-Signaturen werden abgelehnt. Das ist eine fokussierte
Auslieferungsprüfung, kein vollständiger Secret-Scanner. Repositoryquellen,
Tests, Dokumentation, `.git`, `node_modules` und Konfigurationsreste können
nicht als zusätzliche Dateien passieren. Das deployfähige `app.js` ist das
beabsichtigte gebündelte Browserprogramm, keine zusätzliche Quellcodesammlung.

Der Artefaktnachweis `sha256-canonical-file-manifest-v1` ist SHA-256 über
`JSON.stringify` der nach relativem Pfad sortierten Liste von Objekten mit
genau `path`, `bytes`, `sha256` in dieser Reihenfolge. Er hängt nur von
relativen Namen und Bytes ab, nicht von absoluten Pfaden, Dateizeiten oder
ZIP-/TAR-Metadaten. `build-info.json` ist eingeschlossen; die Buildzeit macht
unterschiedliche Buildkandidaten unterscheidbar. Es gibt keinen universellen
vorab feststehenden Releasehash. Der tatsächliche Hash steht in Summary und
Evidence des jeweiligen Runs. Artifact-IDs werden nie in die Website geschrieben.

## Evidence, Retention und Rollback

Originalrelease: `r1-site-<run-id>-1` enthält den finalen Websiteinhalt,
`r1-evidence-<run-id>-1` enthält `evidence.json`: Source-SHA, erfolgreiches
kanonisches Gate, Manifest/Checksum, Provenienz, Repository, Run-URL/-Attempt.
Beide haben angeforderte **90 Tage** Retention, begrenzt durch GitHub- und
Repositoryrichtlinien. Pages-Upload `pages-<run-id>-1` hat **30 Tage** für die
Freigabe. `.nojekyll` wird durch `include-hidden-files: true` mitgesichert.
Keine dauerhaften großen Logs oder Nutzerdaten werden zusätzlich archiviert.
Feature-CI sichert bei Fehlern nur synthetische CP0B-Diagnosen für fünf Tage.

GitHub dokumentiert standardmäßig 90 Tage für Actions-Artefakte und bietet
`expires_at` zur Prüfung der tatsächlichen Verfügbarkeit. Das Entfernen eines
Runs entfernt auch dessen Artefakte. Der zusätzliche normale Websiteupload
entkoppelt Rollback von Pages-Paketformat und kürzerer Freigabefrist.
Quellen: [Retention](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/remove-workflow-artifacts),
[Pages-Artefakt](https://github.com/actions/upload-pages-artifact),
[Download aus anderem Run](https://github.com/actions/download-artifact).

Konservativer Rollback:

1. Einen **erfolgreich abgeschlossenen Original-R1-Release** (Attempt 1) in
   Actions auswählen. Run-ID und noch vorhandene Site-/Evidence-Artefakte prüfen.
2. **Rollback GitHub Pages** auf **main** starten; nur diese numerische
   `release_run_id` eingeben. Kein SHA, ZIP, URL oder fremdes Repository erlaubt.
3. Aktuelle Prüfscripte aus dem beim Rollbackstart gebundenen main ausführen.
   GitHub API prüft Repository, Originalworkflowpfad, Dispatch, main, Erfolg,
   Attempt, historischen Source-SHA und nicht abgelaufene, eindeutige Artefakte.
4. Downloads erfolgen über die ermittelten Artifact-IDs aus genau diesem Run.
   Gate-Evidence, historische Provenienz, Source-SHA, gespeichertes Dateimanifest
   und neu berechnete Gesamtchecksum prüfen; aktuelle generische Sicherheitsregeln anwenden.
5. Gespeicherte Bytes als neues Pages-Artefakt paketieren; erneut vergleichen.
   Neue Rollback-Evidence enthält Auswahl/Originalnachweis. Keine historischen
   npm-Abhängigkeiten, kein alter Code, keine Kompilierung werden ausgeführt.
6. Leon prüft Original-SHA und Checksum in Summary/Evidence, genehmigt erneut
   `github-pages`; der getrennte Deploy-Job veröffentlicht das gespeicherte Paket.

Neue Releasekandidaten prüft `release-artifact.mjs` weiterhin streng gegen den
aktuellen Produktionsvertrag: Allowlist, Build-info-Felder, Cachehash und
Buildanforderungen. Historische Rollbacks verwenden dagegen den getrennten
Pfad `historical-release-artifact.mjs`: Das vertrauenswürdige damalige Evidence
(unterstützte Schemaversion 1, `r1-release`, erfolgreiches `npm run verify`)
bestimmt den Inhaltsvertrag. Tatsächlich gefundene Pfade, Dateigrößen und
SHA-256-Digests müssen exakt `evidence.files` entsprechen; die kanonische
Checksum wird erneut aus diesen Dateien berechnet. `build-info.json` muss exakt
der gespeicherten Provenienz und dem weiterhin unterstützten historischen
Provenienzvertrag v1 entsprechen, einschließlich Source-SHA, Releaseworkflow,
Run-ID und Attempt. Künftige Provenienzversionen erfordern explizite zusätzliche
historische Unterstützung; der bestehende v1-Vertrag bleibt erhalten.

Evidence kann die allgemeinen Sicherheitsregeln nicht überschreiben: sichere
relative Pfade, keine `.git`-/`.github`-Strukturen, Symlinks, Hardlinks oder
Spezialdateien, weiterhin Credential-Signaturprüfung. Grenzen: 10 MiB je Datei,
100 MiB insgesamt, höchstens 1000 Datei-/Verzeichniseinträge, 16 Pfadsegmente
und 240 Pfadzeichen. Verzeichnisse müssen zum gespeicherten Manifest gehören.
Die historische Prüfung liest ausschließlich gespeicherte Bytes, ohne sie zu
ergänzen, zu ändern oder zu entfernen. Ein erfolgreiches R1-Release bleibt so
innerhalb seiner Artifact-Retention auch nach legitimen späteren Änderungen
der Website-Dateiliste rückspielbar, soweit es die generischen Sicherheitsregeln
und einen unterstützten historischen Provenienzvertrag erfüllt.

Bewusste Einschränkung: nur erfolgreich **veröffentlichte** Originalruns,
keine abgebrochenen vorbereiteten Kandidaten, keine Rollback-von-Rollback-Kette
und keine Originalruns mit Attempt > 1. Abgelaufene/gelöschte Artefakte sind
nicht nutzbar. Der ursprüngliche Source-SHA steht im live ausgelieferten
`build-info.json`; der GitHub-Deploymentdatensatz eines Rollbacks gehört zum
aktuellen Workflow-SHA. Beide Identitäten werden bewusst unterschieden.

Ein erneuter Prepare-Lauf desselben Originalruns wird vor dem Build abgewiesen.
Bei Buildfehlern neuen Dispatch starten. Ein isolierter Retry des fehlgeschlagenen
Deploy-Jobs kann den bestehenden Upload verwenden; solche Originalruns sind
wegen Attempt > 1 konservativ keine Rollbackquelle. Niemals „Re-run all jobs“
verwenden, um einen bereits geprüften Kandidaten neu zu bauen.

Release und Rollback teilen `pages-release`, `cancel-in-progress: false`.
Ein laufender Kandidat samt Freigabe/Deployment wird nicht von einem neueren
Start abgebrochen. GitHubs Standardqueue hält höchstens einen noch nicht
gestarteten Pending-Run; weitere Starts können diesen ersetzen. Deshalb nur
einen Vorgang bewusst starten; keine FIFO-Garantie behaupten.
[Concurrency-Dokumentation](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency).

## Offizielle Actions und Rechte

Am 30.09.2026 anhand offizieller `releases/latest`, Tag-Refs und `action.yml`
verifiziert. Alle direkten Referenzen sind auf unveränderliche Commit-SHAs
gepinnt; Versionskommentare stehen jeweils daneben.

| Action | Version | Commit-SHA |
| --- | --- | --- |
| [checkout](https://github.com/actions/checkout/releases/tag/v7.0.1) | v7.0.1 | `3d3c42e5aac5ba805825da76410c181273ba90b1` |
| [setup-node](https://github.com/actions/setup-node/releases/tag/v7.0.0) | v7.0.0 | `820762786026740c76f36085b0efc47a31fe5020` |
| [configure-pages](https://github.com/actions/configure-pages/releases/tag/v6.0.0) | v6.0.0 | `45bfe0192ca1faeb007ade9deae92b16b8254a0d` |
| [upload-pages-artifact](https://github.com/actions/upload-pages-artifact/releases/tag/v5.0.0) | v5.0.0 | `fc324d3547104276b827a68afc52ff2a11cc49c9` |
| [deploy-pages](https://github.com/actions/deploy-pages/releases/tag/v5.0.1) | v5.0.1 | `368f82528645a54fb793d4d04e342629a3f51346` |
| [upload-artifact](https://github.com/actions/upload-artifact/releases/tag/v7.0.1) | v7.0.1 | `043fb46d1a93c77aae656e7c1c64a875d1fc6a0a` |
| [download-artifact](https://github.com/actions/download-artifact/releases/tag/v8.0.1) | v8.0.1 | `3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c` |

Die JavaScript-Actions verwenden Node 24 als **Action-Runtime**; der Projektcode
läuft weiterhin mit Node 22. `upload-pages-artifact` ist eine Composite Action
und pinnt intern die offizielle `upload-artifact` v7.0.0 auf
`bbbca2ddaa5d8feaa63e36b76fdaad77386f024f`.

Top-level Rechte der Releaseworkflows: `{}`. Prepare: nur `contents: read`;
Rollback-Prepare zusätzlich `actions: read` für Historie und Downloads.
Deploy: ausschließlich `pages: write` und `id-token: write`. Checkout immer
`persist-credentials: false`. Kein PAT, `contents: write`, Bot-Push,
`pull_request_target`, PR-Deployment oder Secret im Produktbuild. Der kurzlebige
GitHub-Token wird nur durch Actions bzw. für die lesende Rollback-API verwendet.

## Manuelle GitHub-Konfiguration und exakte Migrationsreihenfolge

**Erst nach unabhängiger PR-Abnahme, gemeinsam mit Leon. Keine dieser
Administrations-, Merge- oder Deploymentaktionen gehört zur Implementierung.**

1. Aktuelles Remote-main, offenen R1-PR und grüne Checks erneut vergleichen.
   Live-URL aufrufen; HTML und `app.js`/`styles.css`-Cacheparameter notieren.
   Letzten funktionierenden Root-Stand/Commit notieren (Ausgangsstand oben).
2. Unter Actions sicherstellen, dass **Build GitHub Pages**, **pages build and
   deployment** sowie Release/Rollback weder laufen noch auf Freigabe warten.
   Gegebenenfalls bewusst beenden/abwarten. Keine konkurrierenden Änderungen.
3. Actions → **Build GitHub Pages** → Menü `…` → **Disable workflow**.
   Dieser administrative Schritt erfolgt vor der Pages-Umstellung und dem Merge.
4. Settings → Environments → **github-pages**: **Required reviewers** aktivieren,
   `LeonMoebius-code` (Leon) auswählen. **Prevent self-review** ausgeschaltet
   lassen. **Allow administrators to bypass configured protection rules**
   ausschalten, soweit verfügbar. Deployment branches/tags → **Selected branches
   and tags** → ausschließlich Branch **main**, keine Tags. Keine Secrets nötig.
   Speichern und die wirksamen Regeln kontrollieren. Bei fehlender Reviewer-
   Funktion nicht fortfahren; keine automatische Freigabe als Ersatz.
5. Settings → Rules → Rulesets → New branch ruleset **main-pr-verify**, Status
   **Active**, Zielbranch `main`. Keine normale Bypass-Liste; Deletions und Force
   Pushes sperren. **Require a pull request before merging**, erforderliche
   Approvals **0** (kein zusätzlicher Pflichtreviewer). **Require status checks
   to pass** → **Tests, Typecheck, Build und Browser**, erwartete App **GitHub
   Actions**, **Require branches to be up to date before merging** aktivieren.
   Keine weiteren alten Build-/Pageschecks als Pflicht. Falls nötig den grünen
   R1-PR erneut auf aktuellem main prüfen. Regelwirkung auch für den Eigentümer
   kontrollieren; normaler direkter Push auf main soll scheitern.
6. Settings → Actions → General → Artifact and log retention: vorhandene
   Obergrenze prüfen; für die angestrebten 90 Tage mindestens 90 erlauben.
   Settings → Pages → Build and deployment → Source **GitHub Actions** wählen.
   Keine Domain, kein Repository und keinen Basepath ändern.
7. Unmittelbar die bisherige Live-URL erneut prüfen. Bei Störung zunächst den
   unten beschriebenen Rückfall durchführen. Keine Zero-Downtime-Garantie.
8. Den unabhängig abgenommenen, CI-grünen R1-PR bewusst mergen.
9. Actions kontrollieren: Der Merge startet **kein** Website-Deployment und
   keinen alten Bot-Build. `build-pages.yml` ist nun entfernt. Live-Stand prüfen.
10. **Release GitHub Pages** → Run workflow → **main**. Keine Featurebranchwahl.
11. Source-SHA des Runs mit dem beabsichtigten main-Commit vergleichen und notieren.
12. Prepare vollständig abwarten: Fachtests, CP0A2 18 A / 1 B / 3 C / 1 D,
    Typecheck, ein Produktionsbuild, CP0B 3/3 und Artefaktvalidierung grün.
13. Summary, `r1-site-<id>-1` und `r1-evidence-<id>-1` prüfen: SHA, Gate,
    elf Dateien, Provenienz, Checksum, Run/Attempt, tatsächliche Ablaufdaten.
14. Sicherstellen, dass Deploy **Waiting for review** zeigt. Noch nicht freigeben.
    Fehlt die Sperre, Vorgang abbrechen und Environment-Regel korrigieren.
15. Erst nach bewusster Kandidatenprüfung **Review deployments** → `github-pages`
    → **Approve and deploy**. Die Freigabe gilt diesem vorbereiteten Kandidaten,
    auch wenn main inzwischen weitergelaufen ist.
16. Deployment abwarten; Run und veröffentlichte URL dokumentieren.
17. Live unter `/vermoegensnavigator/` laden und die zentralen synthetischen
    Bedienabläufe prüfen. Keine echten Kundendaten für die Abnahme verwenden.
18. `/vermoegensnavigator/build-info.json` abrufen: Source-SHA, Run/Attempt,
    Buildzeit und Lockfilehash gegen Evidence prüfen. Website-Dateien bei Bedarf
    herunterladen und Inhaltsdigests vergleichen. `/package.json`, `/scripts/`,
    `/docs/` unter dem Projektpfad dürfen keine Repo-Inhalte liefern (404).
19. Rollbackweg kontrolliert verifizieren: den eben erfolgreich veröffentlichten
    Originalrun als Rückspielprobe auswählen, Historie/Checksum abwarten,
    erneute Freigabesperre prüfen; erst bewusst freigeben und dieselbe Provenienz
    live bestätigen. Sobald vorhanden, ist ein älterer erfolgreicher R1-Run
    die echte Rückfalloption. Probe und Originalrun dokumentieren.
20. Erst nach diesen Prüfungen R1 als vollständig **live abgenommen** markieren.
21. R2 **nicht** automatisch starten. Alte Root-Dateien bleiben bis zum separaten
    R2-Auftrag unverändert im Repository.

## Notfall: Migration zurücknehmen

Alle aktiven Release-/Rollbackläufe bewusst abbrechen; keine wartende Freigabe
erteilen. Actions-Releaseworkflows bei Bedarf administrativ deaktivieren.
Settings → Pages → Source **Deploy from a branch** → Branch **main**, Ordner
**/ (root)** → Save. Das ist die vor R1 per API bestätigte Einstellung
(`build_type: legacy`, keine eigene Domain). Legacy-Pageslauf und Live-URL
anschließend kontrollieren; eine Unterbrechung ist möglich.

Die unveränderten Root-Dateien `index.html`, `404.html`, `app.js`, `styles.css`,
`favicon.svg`, `og.png`, `branding/**`, `.nojekyll` stehen weiterhin bereit.
Sie repräsentieren den letzten alten Veröffentlichungsstand und müssen nicht
dem neuesten Produktquellcode entsprechen. Für das Rückspielen dieses Stands
ist kein Produktbuild und kein Revert von Fachcode erforderlich.

Falls der alte **automatische** Betrieb wiederhergestellt werden soll: separaten
Revert-PR für R1 prüfen und mergen oder gezielt `build-pages.yml` aus dem
notierten Vor-R1-Commit per PR wiederherstellen; danach alten Workflow bewusst
wieder aktivieren. Seine Bot-Pushes kollidieren mit dem neuen main-Regelschutz:
diese Rechte-/Regeländerung müsste Leon separat und bewusst entscheiden. Den
Main-Schutz nicht still aufweichen. Für den reinen Notfall-Rückfall genügt
Branch/Root-Pages; der Bot-Workflow muss dafür nicht wieder aktiv sein.

## Lokale Prüfung und Grenzen

Node 22, installierte Lockfile-Abhängigkeiten und passendes Chromium verwenden.
Unter Windows Git Bash im PATH und als npm `script-shell`, wie im README.

```bash
npm run verify
node scripts/verify-release-artifact.mjs "$(git rev-parse HEAD)"
node --test scripts/verify-r1.test.mjs
npm test
node scripts/verify-release-artifact.mjs "$(git rev-parse HEAD)"
npm run test:browser
node scripts/verify-release-artifact.mjs "$(git rev-parse HEAD)"
npm run typecheck
npm run build:github
npm run test:browser
node scripts/verify-release-artifact.mjs "$(git rev-parse HEAD)"
git diff --check
```

Die getrennt verlangten lokalen Build-/Gateprüfungen sind unterschiedliche
Testkandidaten. Im echten Releaseworkflow gibt es nach dem einmaligen Gate
keinen weiteren Build. Regressionstests arbeiten nur mit temporären Kopien.
`package.json`, Lockfile, CP0B-Konfiguration und Produktquellen bleiben unverändert.
Die PR-CI ergänzt nach dem Gate die Artefaktprüfung und vollständigen
Betriebsregressionen, einschließlich historischer Kompatibilität bei später
geänderter Dateiliste/Provenienz sowie Manipulations- und Sicherheitsgegenproben.

Der erste echte Dispatch, Environment-Halt, Upload/Deployment und Cross-Run-
Rollback sind im Featurebranch bewusst nicht live ausführbar. Die Workflow-
Definitionen werden statisch geprüft; Historie/Evidence/Manipulationsabwehr
werden lokal getestet. Die echte Integration bleibt Bestandteil der manuellen
Migration, ohne temporäre Deploymenthintertür. R2 entfernt erst nach dieser
Liveabnahme die alten Root-Artefakte und ergänzt dann passende Ignore-Regeln.
