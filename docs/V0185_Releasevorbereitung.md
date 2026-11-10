# V0.18.5 – Versions-, Status- und Releasevorbereitung

Stand: **10.11.2026**. Ziel **V0.18.5 / Persistenzschema 11**.
Eng begrenzte Vorbereitung; kein eigenes GO, Merge, Release oder Deployment.
Historische [V0.18.4-Vorbereitung](V0184_Releasevorbereitung.md) und
[R1/R2-Releasevertrag](Releaseprozess.md) bleiben unverändert erhalten.

## Getrennte Identitäten und Freigabestufen

| Ebene | Belegter Stand / noch erforderlicher Schritt |
| --- | --- |
| Veröffentlicht | V0.18.4, Source `70cd8841d9d04d9b9e9de75213b7a6e210a3f78b`, Tree `8345eb6e7ffc3a322017e2845d70f4854af48a7a`; [R1-Run 41030503241](https://github.com/LeonMoebius-code/vermoegensnavigator/actions/runs/41030503241), 30.10.2026, Attempt 1, success. Candidate-Job `123978844496` und Deploy-Job `123984144039` erfolgreich. |
| Integrierte Entwicklung | Bei Preflight main `1a7f71fc70242fca2039c5ce76c81fe9288d9e77`, Tree `fd393d48f637a8d9fa01ca70466e8e2e7c4fe57f`, V0.18.4 / Schema 11; #69 integriert. |
| Versionsvorbereitung | Isolierter `work/release-v0185-preparation`, V0.18.5 / Schema 11; sieben erlaubte Dateien. Finaler Head/Tree, Parent und Push-/PR-Checkout im Draft-PR und externen identischen Abnahmepaket; noch nicht integriert oder veröffentlicht. |
| Integration | Erst nach zwei unabhängigen positiven Abnahmen desselben finalen Heads und Leons gesondertem Integrationsbeschluss für diesen Versions-/Dokumentations-PR. Keine bedingte Feature-Merge-Erlaubnis. |
| Readiness / Release / Deployment | Danach aktuellen main, fachlichen Gesamtumfang, CI, Provenienz, Datenstände, Pages-/Environmentregeln und Rollbackverfügbarkeit separat prüfen. Leon autorisiert R1-Start und später Deployment jeweils ausdrücklich. |

Am 10.11.2026 wurden Site- und Evidence-Originale erneut heruntergeladen und
ihre ZIP-Digests gegen GitHub geprüft. Alle elf gespeicherten Dateien und die
kanonische Checksum wurden nachgerechnet; zusätzlich historische R1-v1-Prüfung.
Öffentliche `build-info.json`, `index.html` und `app.js` sind bytegleich mit den
Originalen; das Programm enthält `Prototyp V0.18.4`. Buildzeit
`2026-10-30T09:03:23.559Z`, Lockfile-SHA-256
`24b89fefee5c92e854c271a01b4d29d7892226c7a15fe6b1c4c80e407f7373fa`.
Kanonische Website-Checksum:
`b4992a3243228fbb6f7ba702bd2066e691228a9718f9f407afda8cbf5bccee91`.
Das ist ein R1-Actions-/Artefakt-/Livebeleg, keine unterstellte Tagfreigabe.

## Vollständiger unveröffentlichter Sourceumfang

Der [Vergleich des R1-Source mit dem Ausgangs-main](https://github.com/LeonMoebius-code/vermoegensnavigator/compare/70cd8841d9d04d9b9e9de75213b7a6e210a3f78b...1a7f71fc70242fca2039c5ce76c81fe9288d9e77)
enthält **3 Commits einschließlich Merge und 9 Dateien**, ausschließlich
[#69 UX-03a/03b](https://github.com/LeonMoebius-code/vermoegensnavigator/pull/69).
Finaler Feature-Head `cd7d46c68c0f5f9468951984ec21b79dc861311e`, Integration
02.11.2026. [Verbindlicher UX-Vertrag](UX03ab_Kundenstrecke_Datenbruecke.md).

| Datei seit R1 | Wirkung |
| --- | --- |
| `app/globals.css` | Gekapselte responsive Kundenstrecke. |
| `app/presentation/retirement/customer-plan-adapter.ts` | Gemeinsamer geplanter Zahlungsplan für Jahresförderung und Kapitalmodell; getrennte Nachweise, Invalidierung. |
| `app/presentation/retirement/retirement-chart.tsx` | Drei Kurven aus echten Ledgerpunkten, Einzahlungslinie und zugängliche Originalwerttabelle. |
| `app/presentation/retirement/retirement-customer.tsx` | Kundenfragen, getrennte Förder-/Kapitalanzeige, ausdrückliche Kosten-/Einzelzulagenhypothesen; P2-Korrektur übernimmt bei Checkboxänderung auch entzogene Beitragsnachweise. |
| `app/presentation/retirement/retirement-entry.tsx` | Kundenstrecke im flüchtigen Lebenszyklus; separate Fachformulare bleiben erreichbar. |
| `docs/UX03ab_Kundenstrecke_Datenbruecke.md` | Fachlicher Datenbrücken-/Darstellungsvertrag. |
| `tests/browser/ux03ab-adapter.spec.ts` | Zahlungsplan-/Nachweis-/Ledgerregressionen. |
| `tests/browser/ux03ab-checkbox-regression.spec.ts` | Echte Handler- und Browserregression der aufgehobenen Beitragsbestätigung. |
| `tests/browser/ux03ab-customer.spec.ts` | Kundenpfade, Fehler, Hypothesen, Referenz, Navigation, Speicherung und Layout. |

Dazu kommen ausschließlich die sieben Dateien dieses Versions-PR:
`package.json` (Projektversion), `package-lock.json` (zwei Root-Versionswerte),
`app/page.tsx` (sichtbare Prototypversion), `README.md`,
`docs/project/PROJECT_STATUS.md`, `docs/project/DECISIONS.md` und dieses Dokument.
Der spätere R1-Run baut den gesamten genehmigten Source, keine Auswahl einzelner
Teile. #64 AP-05a, #65 AP-03a, #66 AP-04b und #67 sind bereits im R1-Source;
sie sind kein unveröffentlichter Zusatzumfang. Frühere Pakete gelten unverändert.
#43 bleibt **AUDIT ONLY – NEVER MERGE**; #60 bleibt ein offener älterer
Status-Draft. Beide gehören nicht zur Feature-/Releasebasis und werden nicht mutiert.

Keine Änderung an Schema/Falldaten, Originalschutz/Import/Restore, Domainrechenkernen,
Förderrules, Produktdaten, Dependencies, Integritäten, Tests, CI oder R1/R2-Pfaden.
Der Lokalspeicherhinweis unter der Versionskennzeichnung bleibt erhalten.

## Gezielte Fachtext-/Claimprüfung (READ-ONLY)

Prüfdatum 10.11.2026; sichtbare A-/B-/Kundenpfade und unveränderte
[AP-01a](AP01a_Direkte_Foerderung.md), [AP-01b](AP01b_Alt_Riester_Foerderung.md),
[AP-04a](AP04a_Altersvorsorge_Foerdercheck.md), [AP-05a](AP05a_Alt_Riester_UI.md),
[AP-04b](AP04b_A3_A4_Produktvergleich_Kapitalentwicklung.md) sowie deren
jahresbezogene Regel-/Aufruferverträge abgeglichen. Kein neuer Fach-/Rechenumfang.
Ein Quellenabruf ersetzt weder eine individuelle Vertragsprüfung noch die beiden
unabhängigen Abnahmen. Feste Domainprüfstände werden nicht auf heute umdatiert.

| Prüfpunkt | Amtlicher Sollstand und beobachteter Pfad / Grenze |
| --- | --- |
| Altbestand | § 52 Abs. 50a Satz 1 EStG lässt die dort genannten bisherigen Förderregeln für vor 2027 abgeschlossene zertifizierte Verträge bis zur Auszahlungsphase fortgelten. B1 verlangt bestätigten Altbestand ohne wirksamen Förderwechsel/auslösenden Neuvertrag. Keine automatische Umstellung, Kündigung oder Änderung sonstiger Vertragskonditionen durch die UI. |
| Personenbezogener Regimewechsel | Erklärung gegenüber dem Anbieter unwiderruflich und einheitlich für alle Bestandsverträge, wirksam ab Beitragsjahr des Zugangs; zertifizierter Neuabschluss nach 31.12.2026 löst ebenfalls einheitlich neues Recht aus. Mittelbar berechtigte Ehegatten: abgeleitete Anwendung bei Zulageantrag gemäß Satz 8. Die Oberfläche ermittelt diese Historien nicht; Mehrverträge, mittelbare Fälle und offene Übergänge werden nicht als bestätigter Standard gerechnet. B2 bestätigt nur vorgelagert geprüfte alternative Annahmen, keinen tatsächlichen Wechsel. Die Detailfolgen werden in der UI nicht vollständig erläutert; daraus darf keine eigenständige Wechselberatung gemacht werden. |
| Laufende Zulagen | Neues Recht: 120 € Mindesteigenbeitrag, 50 % auf erste 360 €, 25 % auf weitere 1.440 €, höchstens 540 € Grundzulage; je zugeordnetem Kind beitragsproportional bis 300 €. Altstandard: eigener Mindesteigenbeitrag und gekürzte Altzulagen. Getrennte AP-01a/b-Aufrufe, offene Rundung ohne Förderzahl; keine Übertragung von Bestätigungen. |
| B1/B2-Vergleich | Sichtbar zwei alternative Fördermodelle, gleicher eigener Jahresbeitrag und getrennte Nachweise; Differenz nur bei zwei berechneten Seiten plus bestätigter Vergleichsbasis. Kein Vertrags-, Kapital-, Garantie-, Wechselkosten-, Rentenbeginn-, Auszahlungs- oder Steuervorteilsvergleich. Keine Empfehlung aus einer positiven isolierten Jahreszulagendifferenz. Vertragswerte/Kosten/Rendite/Steuern sind ausdrücklich ausgenommen. |
| Gebühren | § 1 Abs. 1 Sätze 3–4 AltZertG enthält Gebühren-/Sonderfallgrenzen. BMF erläutert die Fünfjahresregel ausdrücklich für Wechsel innerhalb des neuen Systems. Alt-/Neuvertragsübergänge bleiben gesonderte Vertragsprüfung. Kein Gebührenfeld, keine Gebührenformel und keine pauschale Kostenfreiheitszusage im geprüften Pfad. |
| Standarddepotkosten | Gesetzliche 1,0-%-Grenze: § 2a Abs. 2 AltZertG für Verträge nach § 1 Abs. 1c. Keine allgemeine Obergrenze für freie Depots nach Abs. 1b und keine Bestandsgebühr. A3 nennt keine 1,5-%-Angabe und ordnet keine Produktlinie ungeprüft als Standarddepot ein; konkrete Tarifkosten bleiben offen. A4 nutzt nur getrennt bestätigte hypothetische Modellkosten. |
| Bonus / nicht modellierte Effekte | Kundenkarte und Fachformulare kennzeichnen den Einmalbonus als gesondert zu prüfen und nicht enthalten. Keine automatische 200-€-Einrechnung oder Anspruchszusage. Kapitalmodell ohne automatische Jahresförderübernahme; optionale Einzelzulage ist eine datierte Hypothese. Steuern, Garantien und tatsächlicher Rentenbeginn bleiben außerhalb. |

In dieser begrenzten Prüfung wurde kein konkreter dem gesetzlichen Soll
widersprechender oder umfassende Wechselberatung versprechender Kundenpfad
festgestellt. Das ist kein Gesamtumfangs-GO. Neue konkrete Gegenbelege sind mit
Quelle, Anzeige, reproduzierbarer Folge und Schweregrad zu dokumentieren; dann
**Release-Readiness HOLD**, minimale Folgeentscheidung durch die Projektleitung.
Keine stillschweigende UI-/Kernelkorrektur in diesem Versionsauftrag.

### Primärquellen und Abrufgrenzen

- [§ 52 Abs. 50a EStG, Jahresfassung 2027](https://rvrecht.deutsche-rentenversicherung.de/SharedDocs/rvRecht/05_Normen_und_Vertraege/02_C-K/EStG/0052/0052_2027_01_01.html?nn=1504386): insbesondere Sätze 1 und 4–10.
- [§ 1 AltZertG, Jahresfassung 2027](https://rvrecht.deutsche-rentenversicherung.de/SharedDocs/rvRecht/05_Normen_und_Vertraege/02_A-B/AltZertG/0001/0001_2027_01_01.html): Produktkategorien und Übertragungsgrenzen.
- [BGBl. 2026 I Nr. 156](https://www.recht.bund.de/bgbl/1/2026/156/regelungstext.pdf?__blob=publicationFile&v=1): verkündet 29.05.2026; insbesondere Artikel 2 und 6 einschließlich § 2a Abs. 2 AltZertG. Erneut 576.530 Bytes, SHA-256 `88e8bedbc87566c0943433e767a1f2b42d3089adade3235e38f2acf153dc04ce`, identisch zum AP-01b-Quellstand.
- [§ 86 EStG ab 2027](https://rvrecht.deutsche-rentenversicherung.de/SharedDocs/rvRecht/05_Normen_und_Vertraege/02_C-K/EStG/0086/0086_2027_01_01.html), §§ 84/85 in den unveränderten AP-01a-Quellen bzw. Reformgesetz.
- [BMF-Reform-FAQ](https://www.bundesfinanzministerium.de/Content/DE/FAQ/reform-der-privaten-altersvorsorge.html) und [DRV-FAQ](https://riester.deutsche-rentenversicherung.de/DE/FAQ), ergänzende amtliche Erläuterungen. Einzelne Rechercheabrufe scheiterten mit 503; direkte Originalabrufe sämtlicher hier genannter Kernquellen waren erfolgreich und separat gesichert. Ratgeberangaben wurden nicht als Norm oder neue Rechenregel übernommen.

## Datenstände und Prototypgrenzen

| Quelle / Regelmodell | Unveränderter dokumentierter Stand |
| --- | --- |
| Laufzeiten / Renditebandbreiten | 07.05.2026 |
| Modellportfolios PB / Hausmeinung Fonds-Matrix | jeweils 01.07.2026 |
| VV-Selektionsmatrix | 20.02.2026 |
| Depotoptimierer KCI | 15.07.2026 |
| AP-01a neue Förderung | geprüft 27.10.2026; explizite Regelkontexte 2027/2028, keine Fortschreibung |
| AP-01b Alt-Riester | geprüft 28.10.2026; explizite Kontexte 2026/2027/2028 |
| A3 öffentliche Produktankündigung | geprüft 29.10.2026; Tarifdetails und vollständige Kosten offen |

Quellen im Code: `app/data/investment-data-sources.ts`, Grant-Regelmetadaten und
`retirement-products.tsx`. Dieser PR aktualisiert keine Daten und behauptet keine
heutige Markt-/Hausmeinungsaktualität. Der erneute Rechtsabgleich erweitert keine
Anspruchs-, Produkt- oder Prognosefreigabe. Szenariorenditen sind explizite Beispiele,
keine Vorhersagen; offene Förderung wird nicht als bestätigt fortgeschrieben.

Öffentlicher Desktop-Testprototyp, keine produktive Bank-/Orderfreigabe.
Browserlokale allgemeine Fälle sind nicht revisionssicher; P1/H5-Originalschutz,
JSON-Sicherung, Restore- und Cross-Tab-Grenzen gelten unverändert. Vorsorgeentwürfe
bleiben flüchtig und gehen bei Verlassen/Reload verloren; Browserwarnung ist keine
Sicherung. Nur synthetische Testdaten, keine internen Bankquellen oder Kundendaten.

## Prüfmatrix und Nachweise

| Gate | Verbindlicher Nachweis |
| --- | --- |
| Umfang / Identität | Frisches main/Tree, Originalcommit/Parent/Tree, sieben erlaubte Dateien und Modi; Version exakt 0.18.5, Schema 11 unverändert; Lockfile ausschließlich zwei Versionswerte. |
| Installation / lokales Verify | `npm ci`, sequenzielles `npm run verify` mit Fach-/Domain-/Referenzprüfungen, Typecheck, genau einem Build und voller regulärer Chromium-Suite. Reale Laufzahlen im externen Bericht; kein veralteter Mindestzähler. |
| Lokaler Browsermangel | Regulärer Chromium-Download liefert beschädigte Archive. Ein dadurch unvollständiges lokales Verify ist kein bestandenes Gate. Vollständige reguläre Push-/PR-CI bleibt gemäß Operating Model maßgeblich; keine Konfigurations-/Testumgehung. |
| R1 / Diff | Artefaktvalidator auf unveränderten Buildbytes, `node --test scripts/verify-r1.test.mjs` ohne Skips und Diffcheck. Kein Neubau zur Artefaktnachprüfung. |
| Finale CI | Push prüft finalen Feature-Head; PR prüft synthetischen Merge mit aktueller Base. Originaljoblogs, tatsächliche Checkouts, Parents/Trees und reguläre Browser-/R1-/Diffbefunde separat abgleichen. |
| Übergabe / fehlende Logs | Identischer Bericht, erlaubte Dateidiff-Matrix, Testmatrix, SHA-256-Manifest und Originalbelege gleichzeitig an beide unabhängigen Abnahmen. Fehlende Joblogs sind **Nachweis-Gate HOLD**, kein Originalprotokoll aus Statusfeldern. Run-/Job-IDs und Transportfehler dokumentieren. Leons bestätigtes enges Nachweisverfahren ersetzt keine Fachabnahme. |

Finale Testergebnisse gehören zum tatsächlichen Commit/Run und werden hier
nicht vorweggenommen. Erlaubter API-Transport kann eine andere Commit-ID erzeugen;
Originalobjekte erhalten, identischen Tree einschließlich Modi und gleichen
frisch bestätigten direkten main-Parent einzeln nachweisen. Keine Force-Updates.

## Unveränderter R1-Vertrag und Rückfallweg

Es gilt ausschließlich der [bestehende Releaseprozess](Releaseprozess.md):
manueller R1-Dispatch auf main, exakte Sourcebindung, voller Gate-Lauf mit genau
einem Build, unveränderte elf Website-Dateien, gespeicherte Site/Evidence und
getrennte Environmentfreigabe für denselben Pages-Upload. Keine neuen Rootartefakte,
kein neuer Workflow oder administrativer Eingriff in diesem Auftrag.
Aktuelle Pages-Quelle und wirksame `github-pages`-Reviewerregeln sind vor späterem
Release erneut unabhängig zu kontrollieren; YAML und historischer Deployerfolg
allein belegen die heute wirksamen Settings nicht.

Der erfolgreiche Originalrun **41030503241** ist am Prüftag als bevorzugte
gespeicherte Rückfallquelle vorhanden, nicht abgelaufen, ZIP-Digests und
historischer Website-/Evidencevertrag erneut validiert:

| Originalartefakt | ID | Ablauf (UTC) | ZIP-SHA-256 |
| --- | --- | --- | --- |
| `r1-site-41030503241-1` | `12965718614` | 28.01.2027, 09:02:21 | `02ef52ec5a257cf8fd07d8fdd9de7fb092ac911a6300baa1156856fe658a49fb` |
| `r1-evidence-41030503241-1` | `12966158006` | 28.01.2027, 09:02:21 | `d6e86e93ad53308657ed1b83c6318e54e647b642e2a3ecc7689c464ffe31c1f5` |

Das Pages-Paket `12966497896` läuft bereits am 29.11.2026, 09:15:43 UTC ab;
das ist nicht die Retention der normalen Rückfallartefakte. Unmittelbar vor
Veröffentlichung Verfügbarkeit, unveränderte Identitäten und Ablauf erneut prüfen.
Späterer Rollback nur nach gesonderter Autorisierung über den bestehenden manuellen
Rollbackworkflow auf main mit numerischer Originalrun-ID, historischer Prüfung
und erneuter Environmentfreigabe. Gespeicherte Bytes ohne Neubau; kein Root-/Branch-
Fallback, keine Rollback-von-Rollback-Kette. Keine echte Rollbackprobe ausgeführt.
**Website-Rollback setzt keine browserlokalen Beratungsfälle zurück.**

Erst nach abgeschlossener Vorbereitung und gesonderten Freigabeschritten folgt
eine Veröffentlichungsentscheidung. V0.19 freier Planvergleich bleibt ein eigener
späterer Featureauftrag; diese Vorbereitung beginnt ihn nicht.
