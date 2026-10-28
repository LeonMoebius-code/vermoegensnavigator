# AP-03a · Neutraler Projektionsvertrag V1.0

**Fachlich freigegeben am 28.10.2026; Implementierungsfreigabe für den isolierten AP-03a-Kern erteilt.**

Normative Grundlage: konsolidierter G-07-Vertrag V0.2, SHA-256 `dbc9928636f8a9153fb916294f89aba1c7ebaa1efa31199af11e72bad350c35d`.

K01–K26 und D02-A bis D02-D sind in ihrer bevorzugten Fassung bestätigt. Einziger inhaltlicher redaktioneller Eingriff am übernommenen Vertragskörper: Abschnitt 7.1 stellt die Dokumentkennung den vier ausführbaren API-Versionen aus 12.1 ausdrücklich gegenüber. Keine mathematische Konvention, Grenze, Feldliste oder Sollzahl geändert. Zusätzlich wurden exakt zwei übernommene Markdown-Endleerzeichen für den unveränderten CI-Diffcheck entfernt; dies ist ausschließlich technische Whitespace-Normalisierung.

Die nachfolgenden V0.2-Prüfungs-, Status- und HOLD-Formulierungen dokumentieren den unveränderten historischen Entstehungsstand. Für die nun erteilte Vertrags-/Implementierungsfreigabe gilt dieses Deckblatt. Es entsteht keine Merge-, Release- oder Deploymentbefugnis. Work erteilt keine unabhängige Abnahme.

Die SHA-256 dieser endgültigen Datei wird im gesonderten Integritätsnachweis angegeben; sie ist wegen Selbstreferenz nicht in ihren eigenen Inhalt eingebettet.

---

# AP-03a · Konsolidierter G-07-Rechenvertrag V0.2

**VermögensNavigator · Stufe 1 · Version 0.2 · 28.10.2026**
**Status: gezielt konsolidierter Vertragskandidat V0.2 zur Projektleiterprüfung. Kein eingefrorener V1.0-Vertrag; Stufe 2 bleibt HOLD.**

Adressaten: bestehender Projektleiter-Chat und organisatorisch unabhängiger Review-Chat. Rolle: Work, ausschließlich Fortsetzung von Stufe 1. Ausgangsstand ist das Fachprüfpaket V0.1 vom 28.10.2026, SHA-256 `96baf78c2bee6b8452b51c9a7e0b8d700f51ebe41de3d3d29ef5fba52e3faf1e`. Nach Leons Nachbesserungsauftrag wurden V0.1 und die 26 Konventionsvorschläge grundsätzlich positiv bewertet, verbunden mit drei fachlichen Auflagen und einer Quellenkorrektur. Diese mitgeteilten Urteile sind keine neue Work-Abnahme und keine Stufe-2-Freigabe.

V0.2 enthält den vollständigen fortgeschriebenen Vertrag einschließlich der bisherigen Mathematik und Sollfälle. Präzisiert sind ausschließlich Zulagenabdeckung, lange Berechnungen/Ausgabegrenzen, öffentliche JSON-/Ergebnisstrukturen und der Bezug zu § 9 Abs. 3 AltvPIBV. Abschnitte 12 und 13 spezifizieren die bisher nur skizzierten Daten- und Ressourcenverträge vollständig. Die Änderungsübersicht steht in Abschnitt 11. Neue Grenzfälle stehen in Abschnitt 14. **Alle Festlegungen sind als zusammenhängender Freigabevorschlag formuliert; verbindlich werden sie ausschließlich durch Projektleiterentscheid.**

## 1. Ergebnis und Freigabegrenze

Ein gemeinsamer neutraler Monatskern ist innerhalb des Auftrags abgrenzbar. Ein produkt- oder tarifscharfer Ergebnisanspruch ist damit nicht verbunden. Die Fachgrundlage V0.4 lässt gerade die entscheidenden Zeit-, Kosten-, Zulagen- und Centkonventionen offen. Daher wurde **kein AP-03a-Code, kein Test, kein Branch, kein Commit, kein PR und keine Workflowänderung** angelegt. Bestehende Arbeitsbäume, Originalarchive und PR #43/#60 wurden nicht verändert. Erstellt wurden ausschließlich diese externe Prüfunterlage, lokale Lesebelege und temporäre Rechenkontrollen.

Die wichtigsten Entscheidungspunkte:

1. **Zulagentermin:** Ende Juni des Folgejahrs ist keine allgemeine gesetzliche oder vertragliche Fälligkeit. Der Termin darf ausschließlich als explizit gewählte hypothetische Modellbuchung verwendet werden. Ohne datierten Zufluss oder ausdrückliche Annahme kein geförderter Endbetrag.
2. **Kosten:** Effektivkosten sind keine monatlich abziehbare Depotgebühr. Brutto mit ausdrücklich abgegrenzten Kosten und eine bereits nach Kosten definierte Rendite sind getrennte Wege. Unbekannte Kosten bleiben unbekannt.
3. **Stress:** vorgeschlagen wird ein zusätzlicher Schock nach der Monatsrendite, vor Kosten und Monatsendzuflüssen, ausschließlich auf den dann vorhandenen Aktienbestand. Monatliches Zurücksetzen auf die vorgegebene Quote ist eine eigene Rebalancingannahme.
4. **Centvertrag:** externe Geldereignisse in exakten Ganzzahl-Cents; interne Rechnung ohne Centzwischenrundung; Ausgabe mit ausdrücklich beschlossener Modellrundung. Gesetzliche Förder-Centregeln bleiben unverändert.
5. **Objektgrenze:** Eine beliebige JavaScript-Objekteingabe lässt sich im Browser nicht verlässlich ohne jede Proxy-Trap prüfen. Vorgeschlagen wird deshalb ein strikt typisierter DTO-Vertrag mit einer **öffentlichen primitiven JSON-Textgrenze**, ohne Objektüberladung. Das ist ein ausdrücklich zu bestätigender Architekturentscheid.
6. **CI:** Neue isolierte Domainprüfungen können über eine neue Playwright-Spec unter `tests/browser/` automatisch in die bestehende Verify-/Typecheckkette gelangen. Ein beliebiger Test unter `tests/` wäre dagegen nicht automatisch Teil des aktuellen Gates. Workflow- oder package.json-Änderungen erscheinen mit dem vorgeschlagenen Weg nicht notwendig.

Die bisherigen Konventionen bleiben als bevorzugter Vorschlag bestehen. Ihre vollständige Operationalisierung ist nachfolgend beschrieben. Verbleibende Entscheidungsalternativen sind in Abschnitt 9 ausdrücklich gebündelt; keine offene Variante darf erst während der Implementierung ausgewählt werden.

## 2. Live-Preflight und Evidenzstand

### 2.1 Ausgangspreflight V0.1 und erneuter V0.2-Abgleich

Der folgende historische Ausgangspreflight stammt aus V0.1. Im V0.2-Auftrag wurden main/Tree und die beiden offenen PR-Heads erneut per GitHub-GET geprüft und unverändert gefunden; die feste Quellidentität erlaubt die weitere Verwendung der bereits gelesenen Architekturverträge. Ein neuer CI-/Browserlauf fand nicht statt. Historischer erster lokaler Zeitbeleg 16:18:44 Uhr Europe/Berlin. Der dokumentierte Prüfzeitpunkt ist kein Beginn des gesamten Auftrags. Erneute Refkontrolle während der Prüfung: unverändert. Abschließende Kontrolle siehe Nachtrag am Dokumentende.

| Gegenstand | Tatsächlich verifizierter Stand |
|---|---|
| Repository | `LeonMoebius-code/vermoegensnavigator`, öffentlich |
| main | `0bb89fd7e0aad99247c8d23a7efcfa7c86a52841` |
| main-Tree | `8828061cb4bb242d5265b259a2ef7890d3b1624e` |
| Mergeparents von main | `d2ef1d5b59b729ccdecc04f8d45095bb18bcb56f` und `835543e0ab54d7f2902fd1bf2e3518ca66ce42d5` |
| Version / Schema | package.json `0.18.4`; aktuelle Fallanlage `schemaVersion: 11` |
| Offene PRs, vollständig innerhalb einer Seite erfasst | #60 und #43; beide Draft |
| PR #60 | `work/project-status-ap01a-20261028`, Head `3aec3f0ffd9e873adad85cfaf95fea918fa9cb9c`; unverändert lassen |
| PR #43 | `work/audit-e2e-f020-f021-f017`, Head `5a8963a4f7c6fd80c83da7f6872139400c51e656`; AUDIT ONLY – NEVER MERGE |
| AP-03a-Branch/PR | Unter den 73 gelieferten Remote-Branches und den offenen PRs nicht vorhanden |
| Laufende/queued GitHub Actions | Beide gesonderten Statusabfragen lieferten 0 Runs |
| Aktuelle AP-05a-CI-Metadaten | Push `40700660996`, PR `40700668537`: completed/success, Head `835543e0…`, jeweils Head-Tree `8828061c…` |

Quellen: [main-Ref](https://api.github.com/repos/LeonMoebius-code/vermoegensnavigator/branches/main), [offene PRs](https://api.github.com/repos/LeonMoebius-code/vermoegensnavigator/pulls?state=open&per_page=100), [Branches](https://api.github.com/repos/LeonMoebius-code/vermoegensnavigator/branches?per_page=100), [Actions](https://github.com/LeonMoebius-code/vermoegensnavigator/actions).

**CI-Evidenzgrenze:** Die genannten Erfolgsstatus wurden gelesen, keine vollständigen Originaljoblogs erneut heruntergeladen. Run-Metadaten allein beweisen insbesondere den synthetischen PR-Checkout nicht. Daraus wird weder eine neue vollständige AP-05a-Abnahme noch irgendein AP-03a-Gate abgeleitet. Stufe 1 hat keine CI ausgelöst. Es gibt noch keinen AP-03a-Feature-Head und keinen AP-03a-Mergecheckout.

### 2.2 Vorhandene lokale Arbeit und Konkurrenz

Die vorhandenen Clones wurden ausschließlich lesend inventarisiert. Keiner wurde als aktuelle AP-03a-Basis benutzt. `git status` zeigte dort keine uncommitteten Dateidiffs. Das beweist weder die Abwesenheit anderer Chats noch eine exklusive Arbeitssperre.

| Lokaler Arbeitsstand | Head / zusätzliche Worktrees |
|---|---|
| `/workspace/sites/vermoegensnavigator` | `main`, `6e20ee5ce8221c10aa8185ce5f2f8a241d073cbd`; deutlich veraltet |
| `/workspace/scratch/7fd85bfc8471/repo` | AP-05a, `d01bb400851b340d42fa69c49721dc52b9483fe3`; anderer Originalcommit als API-Head |
| `/workspace/scratch/5a2ba6893c67/vermoegensnavigator` | AP-04a-v2, `2c98d39e533473cd5a34b8d13e291705b07a10bf` |
| `/workspace/scratch/fb252207623d/vermoegensnavigator` | AP-01b, `284e16d65e29ec6df465b30df4207cd67d5a9f98` |
| `/workspace/scratch/0a14918e7392/vermoegensnavigator` | AP-01a, `6e648e6d7b23e3e018f20284a0a117705f73a477`; weiterer Arrayfix-Worktree `9a7022dd6194f6722d5bffb655f18cbbc93b7a08` |
| `/workspace/scratch/3bde2baa375c/repo` | F-007, `cc77be454b867dc89e74b791b0cbc5942d9b29a9`; F-026-Worktree `a725877077c44a07c65d558bc5f0c231daa54f87` |
| `/workspace/scratch/b9f122a6668d/repo` | erhaltener UX-Originalstand `b35e71c174fb0e3ecc0299a7fe12d7c86e52fe4c` |

Keine dieser abweichenden Identitäten wurde zurückgesetzt, gefetcht, umgehängt, gelöscht oder überschrieben. Der aktuelle main-Commit fehlte im untersuchten AP-05a-Originalclone; deshalb erfolgte die Quellenprüfung über die autorisierte GitHub-Leseschnittstelle auf der **festen SHA**, nicht über einen alten Checkout. Ein lesender Prozessüberblick zeigte keinen erkennbaren laufenden Git-/npm-/Playwright-Build außerhalb der eigenen Abfrage; das ist keine globale Koordinationsgarantie. Direkt vor Stufe 2 sind sämtliche Identitäten und Konkurrenzarbeiten erneut zu prüfen.

### 2.3 Gelesene Originalverträge und Abweichungen

Gelesen auf main-SHA `0bb89fd7…`: `AGENTS.md`, `docs/project/OPERATING_MODEL.md`, `PROJECT_STATUS.md`, `DECISIONS.md`; P1, D1, H5a, H5b, F-026; Releaseprozess/Releasevorbereitung; einschlägige Master-Spezifikation; beide Förderkern-Verträge und Implementierungen, ihre Regelmodule, beide Präsentationsadapter, die flüchtige RetirementEntry, A-/B-Browserspecs, package.json, TypeScript-/Playwright-Konfiguration und Feature-CI. Die Master-Spezifikation und Releaseunterlagen sind umfangreiche historische Quellen; aus ihnen wird keine neue aktuelle Freigabe abgeleitet.

**Bekannte Statusabweichung:** PROJECT_STATUS enthält noch ältere 26.10.-Checkpoints/UX-Aktivstände. Der tatsächliche main integriert inzwischen #59/#61/#63/#64. PR #60 aktualisiert nur einen älteren AP-01a-Zwischenstand und ist kein heutiger Gesamtstatus. Diese Dokumentation wird im READ-ONLY-Auftrag nicht fortgeschrieben. Der Projektleiter sollte den materiellen Unterschied beim nächsten zulässigen Pflegecheckpoint sichtbar nachführen; daraus entsteht keine Work-Schreiberlaubnis.

Fachkonzept V0.4: Originalfassung Version 1, 615 Textzeilen, 64.563 Bytes, [Fach- und Bedienkonzept](https://chatgpt.com/library?file_id=libfile_9b3406146dc08191a36df96425c74ed6&account_id=personal). Für dieses Paket maßgeblich insbesondere §§ 3.4, 6.1–6.3, 7.1–7.3, 9, 12, 13. § 7 kennzeichnet seine Konventionen selbst ausdrücklich als Vorschläge. Der spätere konkrete AP-03a-Auftrag beschränkt § 6: ausschließlich gleicher Eigenbeitrag; keine Nettoaufwandsoptimierung.

Die fünf allgemeinen Projekt-PDFs/-Matrizen wurden für diesen neutralen Monatsvertrag nicht als Tarif-, Kosten- oder Rechtsbeleg verwendet. Sie beantworten keine der offenen G-07-Konventionen. Insbesondere wurde aus Hausmeinung oder Modellportfolio weder eine ETF-Kostenquote noch ein Hersteller-Sicherungsverfahren abgeleitet. Interne Herstellerfolien waren nicht Grundlage dieses öffentlichen Schnittstellenentwurfs.

## 3. Quellen- und Herkunftsregister

Abrufdatum aller nachfolgend verwendeten Webquellen: **28.10.2026**. Amtliche/vertragliche Aussagen bestimmen nicht automatisch die neutrale Modellbuchung. Die Zuordnung zu einem künftigen Rechtsjahr wird nicht aus einem heutigen Seitenabruf garantiert.

| ID | Quelle / Typ | Belegter Inhalt und Grenze |
|---|---|---|
| Q01 | AP-03a-Arbeitsauftrag vom 28.10.2026, beigefügte Originaldatei | Zweistufigkeit, READ-ONLY, Minimaldiff, Scope und Stop-Gate; keine Freigabe der Zahlenkonventionen |
| Q02 | V0.4, Version 1, §§ 3.4/6/7/9/12/13 | Monatliche Geometrie, Monatsendbeiträge und Juni als ausdrücklich vorgeschlagene Annahmen; G-07 offen |
| Q03 | [§ 15 AltvDV](https://www.gesetze-im-internet.de/altvdv/__15.html), amtlich bereitgestellter Normtext | Zahlungsanweisung jeweils am 15. Februar, Mai, August, November; zusätzlich Antrags-/Ermittlungsbedingungen. Kein individueller Kontogutschrifttag und keine Juni-Zusage |
| Q04 | [§ 90 Abs. 2 EStG](https://www.gesetze-im-internet.de/estg/__90.html), amtlich bereitgestellter Normtext | Zahlung an Anbieter nach Berechnung/Überprüfung und unverzügliche Vertragsgutschrift; kein allgemeiner Juni-Termin |
| Q05 | [AltvDV-Gesamttext](https://www.gesetze-im-internet.de/altvdv/BJNR454400002.html) und [BGBl. 2026 I Nr. 156](https://recht.bund.de/bgbl/1/2026/156/VO.html) | Normseite nennt Änderung durch Art. 10 des Gesetzes vom 26.05.2026; Verkündungsmetadaten gelesen. Kein vollständiger eigener intertemporaler Abgleich des gesamten Reformgesetzes/PDF; keine Zusage für jedes zukünftige Förderjahr |
| Q06 | [Union: Wann erhalte ich die Zulage?](https://www.union-investment.de/unsere-services/haeufige-fragen/haeufige-fragen/frage/Wann-erhalte-ich-die-Zulage), öffentliche Anbieter-FAQ | Bestätigt die vier Termine Mitte Februar/Mai/August/November und unmittelbare Gutschrift; Anbieterinformation, kein individueller zukünftiger Buchungsbeleg |
| Q07 | [§ 8 Nr. 3 AltvPIBV](https://www.gesetze-im-internet.de/altvpibv/__8.html), Normtext | Effektivkosten als Minderung der Wertentwicklung in Prozentpunkten; kein Depotbestandssatz |
| Q08 | [§ 10 Abs. 5–7 AltvPIBV](https://www.gesetze-im-internet.de/altvpibv/__10.html), Normtext | Gesamtkosten und vorgegebene Methodik für Effektivkosten; PIB-Rundungsvorschriften werden nicht als allgemeine Centregel dieses Szenariokerns übernommen |
| Q09 | [ECMA-262, Proxy-Methoden § 10.5](https://tc39.es/ecma262/2024/multipage/ordinary-and-exotic-objects-behaviours.html#sec-proxy-object-internal-methods-and-internal-slots), technische Primärnorm | Prototyp-/Own-Key-/Descriptorabfragen können Proxy-Handler ausführen. Grundlage der Architekturfolgerung zur primitiven Textgrenze |
| Q10 | [Repository auf geprüftem Commit](https://github.com/LeonMoebius-code/vermoegensnavigator/tree/0bb89fd7e0aad99247c8d23a7efcfa7c86a52841) | Tatsächliche Istarchitektur/CI; keine Rechtsquelle und kein fachliches GO |
| Q11 | Kontrollrechnungen dieses Pakets | Eigenständige synthetische Zahlen, keine Kapitalmarktprognosen. Decimal mit 90 Stellen und exakte rationale Kurzrechnungen, kein produktiver Monatsalgorithmus |
| Q12 | [§ 9 Abs. 1 und 3 AltvPIBV](https://www.gesetze-im-internet.de/altvpibv/__9.html), amtlicher Normtext; zusätzlich [Gesamttext, §§ 9/14](https://www.gesetze-im-internet.de/altvpibv/BJNR141300015.html) | Gesetzlich vorgegebene Rechenannahme für die dort genannten Informationsberechnungen: Gutschrift am 15. Mai nach dem Beitragsjahr; nach Beginn der Auszahlungsphase zufließende Zulagen bleiben dort unberücksichtigt. Keine allgemeine tatsächliche Zahlungsgarantie und kein neutraler AP-03a-Default |
| Q13 | Nachbesserungsauftrag AP-03a/G-07 vom 28.10.2026, in diesem Chat | Drei Auflagen und Quellenpräzisierung; Auftrag zur V0.2-Konsolidierung, ausdrücklich keine Implementierungsfreigabe |

**Quellenbefund Zulagen:** Q03/Q04/Q06 widerlegen nicht, dass eine konkrete Gutschrift im Juni vorkommen kann. Sie belegen aber keinen allgemeinen Juni-Zufluss für alle Verträge und Jahre. Genau deshalb wird kein neuer gesetzlicher Ersatztermin aus den vier Auszahlungsterminen errechnet. Auch der früheste denkbare Termin ist ohne Antrags- und Bearbeitungsdaten keine sichere Kundengutschrift.

**Quellenbefund Kosten:** Q07/Q08 sind ausreichend, um die ungeprüfte Verwendung einer Effektivkostenquote als laufenden Bestandssatz zu sperren. Sie liefern keine individuellen Vertragsgebühren, keine neutrale Gebührenhöhe und keine Jahres-zu-Monats-Abrechnungsmethode für ein beliebiges Produkt. Dafür bleibt AP-03b zuständig.

### 3.1 Abgrenzung des 15.-Mai-Ansatzes

Der erneut gelesene amtliche Gesamttext nennt als letzten Änderungsstand den 12.11.2021. § 9 Abs. 1 AltvPIBV benennt Berechnungen für Angaben nach §§ 7, 8, 11 und 12. Für diesen Informationszweck setzt Abs. 3 den 15. Mai des Folgejahrs an; tatsächliche Bearbeitungszeiten und Depotbuchungen werden damit nicht zugesagt. Die ebenfalls geregelte Ausblendung später Zuflüsse ist auf den Beginn der Auszahlungsphase bezogen. AP-03a erstellt kein Produktinformationsblatt und berechnet keine Auszahlungsphase. Sein frei gewähltes Modellende ist nicht automatisch dieser Rechtsstichtag.

Deshalb ist die Anlehnung an Mai als **ausdrücklich gewählte, auf Monatsende abstrahierte Illustration** zulässig, nicht als Behauptung einer vollständigen AltvPIBV-konformen PIB-Berechnung. Dafür wären weitere Pflichtannahmen und Produktdaten notwendig. Die Kennung `pib_may15_month_end_illustration` bewahrt sowohl den normativen Bezugszeitpunkt 15. Mai als auch die davon abweichende Modellbuchung Ende Mai. Eine individuelle Mai-Buchung ist dagegen mit dem tatsächlichen Datum und anderer Herkunft zu erfassen. Juli, Juni oder ein anderer expliziter Monat bleiben bei passender Hypothese zulässig; aus Q12 entsteht kein automatischer Ersatz für diese Eingabe.

§ 15 AltvDV regelt Zahlungsanweisungen; § 90 EStG die Anbietergutschrift. Beide bleiben von der Informations-Rechenannahme getrennt. Quellenbefund und neutrale Modellkonvention stehen somit widerspruchsfrei nebeneinander. In V0.1 fehlte Q12; diese Ergänzung korrigiert die Vollständigkeit des Quellenregisters, nicht den Befund, dass ein allgemeiner tatsächlicher Juni-Termin unbelegt ist.

## 4. Vorgeschlagener Rechenvertrag – noch nicht freigegeben

### 4.1 Zeitachse und Ereignisse

**Monatsdomäne:** `YYYY-MM`, Jahre 0100–9999. Start- und Endmonat beide eingeschlossen, Anfangsbestand unmittelbar vor Beginn des Startmonats, Ergebnis unmittelbar nach sämtlichen zulässigen Endmonatsereignissen. Anzahl `N = 12 × (Endjahr − Startjahr) + Endmonat − Startmonat + 1`; maximal 118.800 Monate. Ein Monat ist der kürzeste Horizont; Ende vor Start ist ungültig. Keine zusätzliche 100-/120-Jahre-Grenze. Die Übernahme der F-026-Kalendergrenzen auf den neuen Kern ist ein Vorschlag; bestehende F-026-Regeln werden nicht verändert.

Keine Tagesgenauigkeit, keine Teilmonatsverzinsung und keine automatische Rundung eines Tagesdatums auf einen Monat. Liegt ein heutiger Wert vom 28.10. vor, darf er nicht als 01.10.-Anfangsbestand mit voller Oktoberverzinsung eingehen. Entweder ausdrücklich November als ersten vollen Modellmonat wählen und bis dahin nicht modellierte Veränderungen offenlegen, oder `review_required` für den Teilmonat. Das spätere UI muss diese Bedeutung vermitteln. Ein Auszahltermin am 01.01. bedeutet nicht automatisch einen zusätzlichen Januar-Sparmonat; Auszahlung selbst bleibt AP-06.

**Beiträge:** nichtnegative monatliche Rate als Schedule ab explizitem Wirksamkeitsmonat, mindestens ein Eintrag zum Start; `0` bedeutet bestätigte Pause. Rate gilt bis zum nächsten Wechsel einschließlich in jedem Monat genau einmal am Monatsende. Keine automatische Jahresrate/12 und keine Hochrechnung eines Oktoberstarts auf zwölf Beiträge. Jahresbeiträge werden aus den tatsächlich modellierten Monaten plus gesonderten Eigen-Einmalbeiträgen summiert. Ein Anfangsbestand zählt nicht erneut als heutiger Eigenbeitrag.

**Einmalbeiträge:** eigenes datiertes Monatsendereignis, zusätzlich zur Monatsrate; stets als eigener Beitrag ausgewiesen. Externer Transfer/Übertrag ist kein Eigenbeitrag und wird in AP-03a nicht automatisch interpretiert; Anfangsbestand nur zum definierten Startstichtag.

**Sortierung:** Validierung vor Sortierung; eigene Kopien statt Mutationen. Monate aufsteigend; innerhalb eines Monats feste Phasen. In derselben Cashflowphase exakte Summierung, für die Ledgerdarstellung Typ und danach opake ASCII-ID lexikografisch. Keine Locale-Sortierung, keine Reihenfolge aus der Objektiteration. Zwei Beitrags-, Quoten-, Rendite- oder Kostensatzwechsel für denselben Wirksamkeitsmonat: `invalid_input`, kein „letzter gewinnt“. Doppelte Ereignis-ID oder identischer externer Buchungsbezug: `invalid_input`, keine automatische Deduplizierung.

Ereignisse vor Start sind nicht stillschweigend Teil des Anfangsbestands. Eigenbeiträge/Wechsel/Stress außerhalb des Horizonts sind ungültig. **Explizite Zulagenzuflüsse und Kostenereignisse nach Modellende** können separat als `after_end_not_booked` aufgeführt werden; sie erhöhen weder Endkapital noch gebuchte Summen. Zur Vergleichbarkeit sind Betrag, Bezug und Monat sichtbar. Vor Start gebuchte Zulagen gehören gegebenenfalls in einen extern bestätigten Anfangsbestand; derselbe Zufluss darf nicht zusätzlich gebucht werden.

### 4.2 Renditen, Quoten und monatliche Umschichtung

Renditen sind geometrische Jahresannahmen als Dezimalbruch: `0.12` bedeutet 12 %, nicht 0,12 %. Je Monat vollständig vorgegebene Aktien- und Rentenannahme sowie Aktienquote `q` zwischen 0 und 1; Rentenquote `1−q`. Kein impliziter risikoloser Rest. Der Rentenanteil ist ein modellierter Marktbaustein, keine Garantie.

Je Baustein gilt bei `R > −1` der Faktor `g = (1+R)^(1/12)`. Zuerst auf Bausteine umrechnen, danach gewichten. Die zwölfte Wurzel einer gewichteten Jahresrendite wäre bei monatlichem Rebalancing eine andere Annahme. Rendite-/Quotenwechsel gelten ab Monatsanfang des angegebenen Monats. Eingehende Zahlungen erhalten im Buchungsmonat keine Rendite; im Folgemonat unterliegen sie dessen Quote und Faktoren.

Vorgeschlagene Rechendomäne: `−1 < R ≤ 1000000` je Baustein, bis 36 Dezimalstellen; keine Exponentialnotation, kein NaN/Infinity, kein stilles Kappen. Der obere Wert ist eine **technische Modellgrenze**, kein sinnvoller Kapitalmarktparameter. Seine konkrete Festlegung ist offen zu bestätigen. Alle finanziellen Zwischenbestände und ausgegebenen Summen müssen innerhalb der in 4.5 definierten Betragsdomäne bleiben; sonst kontrollierter Stopp.

`R = −1`: `review_required/annual_total_loss_timing_required`, kein Endbetrag. Eine Jahresangabe −100 % bestimmt den unterjährigen Verlustzeitpunkt nicht. Insbesondere wird nicht stillschweigend jeder Monat auf −100 % gesetzt. Ein **datierter Aktien-Totalverlust** ist dagegen als Stress `s = −1` zulässig. `R < −1` ist `invalid_input`. Sehr nahe an −1 liegende gültige Werte bleiben zulässig, sofern die Präzision nachweisbar genügt; gerundete Ausgabe 0,00 € ist nicht gleichbedeutend mit intern exakt null.

**Rebalancingvorschlag:** zu jedem Monatsanfang den gesamten vorhandenen Bestand kostenfrei auf q und 1−q verteilen. Kein Übertrag einer abgedrifteten Quote, keine versteckten Transaktionskosten. Das ist eine rein hypothetische Umschichtung; belegte Kosten lassen sich nur innerhalb des freigegebenen Gebührenvertrags berücksichtigen. Ein Buy-and-hold-Pfad wäre eine Alternative mit anderen Ergebnissen und wird nicht parallel implementiert. Kein automatischer altersabhängiger Aktienpfad; vollständiger neutraler Schedule von außen. Kein CPPI, keine Garantieuntergrenze, kein 80-%-Schutz.

### 4.3 Exakte Monatsreihenfolge einschließlich Stress

Notation in Euro, positive Kosten als Abzug, Stressverlust `S ≥ 0`:

1. `B`: Endbestand des Vormonats, im Startmonat ausdrücklich übergebener Anfangsbestand.
2. Verteilung: Aktien `A = q × B`, Renten `D = (1−q) × B`.
3. Marktertrag `G = A × (g_A−1) + D × (g_D−1)`; Aktien nach Rendite `A' = A × g_A`, Renten `D' = D × g_D`.
4. Optionaler **zusätzlicher** Stress nur im Ereignismonat: `S = A' × (−s)` für `−1 ≤ s ≤ 0`; nach Stress `V = B + G − S`. Renten unverändert. Stress ist kein Ersatz für den Monatsmarktertrag.
5. Zulässige laufende Kosten auf V und explizite feste Bestandskosten abziehen: `K = V × c_m + F`. Bei `K > V`: `review_required/insufficient_fee_basis`, kein negatives Depot, keine stille Deckelung und keine Finanzierung aus noch nicht gebuchten Monatsendbeiträgen.
6. Monatsende: regulärer eigener Beitrag `E`, eigener Einmalbeitrag `L`, separat bezeichnete Zulage `Z`. Endbestand `W = V − K + E + L + Z`.

Gleichzeitige Zuflüsse erhalten weder den aktuellen Monatsmarktertrag noch den aktuellen Crash oder laufende Bestandskosten. Beiträge, Einmalzahlungen und Zulagen bleiben getrennte Ledgerkomponenten. Die interne Reihenfolge ihrer positiven Addition darf den Betrag nicht verändern. Ein Stress im ersten Monat bei Anfangsbestand 0 trifft daher kein Vermögen. Ein Stress im letzten Monat trifft das vorhandene Vermögen, nicht den gerade eingehenden letzten Sparbeitrag.

Nach dem einmaligen Schock gelten die ausdrücklich vorgegebenen Folgemonatsrenditen und Quoten; kein weiterer Crash und keine automatische Erholung. Eine Erholungsannahme muss als eigener zukünftiger Renditeschedule vorliegen. Nach −30 % braucht derselbe isolierte Aktienbetrag +42,857142… %, um wieder auf seinen Ausgangswert zu kommen; +30 % reichen nicht. Diese Identität ist keine Prognose. Kosten, neue Beiträge und Rebalancing können den Vergleich zusätzlich verändern.

### 4.4 Zulagenvertrag: Betrag, Förderjahr und Zufluss getrennt

AP-03a berechnet **keinen Förderanspruch**. Jeder Zufluss wird von außen als einmaliges Ereignis mit Betrag in ganzen Cents, Beitragsjahr, Komponente, Buchungsmonat, Herkunft und Qualität übergeben. Keine Rekursion, kein Feld „jährlich wiederholen“, keine Fortführung eines bestätigten Jahresbetrags bis zur Rente.

Erforderliche Unterscheidung:

| Feld | Inhalt |
|---|---|
| `grantKey.contributionYear` | Anspruchs-/Beitragsjahr; keine zeitliche Kapitalbuchung allein dadurch |
| `amountBasis` | `actual_booking_confirmed`, `external_rule_result` oder `hypothetical_amount` |
| `booking.basis` | `actual_date_confirmed`, `hypothetical_month_end` oder `pib_may15_month_end_illustration` |
| Quellenbindung über Binding und Source | konkreter Buchungsbeleg oder externer Förderkernstand; bei Hypothese eigene Quellen-/Versions-ID |
| `booking.month` / `booking.referenceDate` | zwingender Modellmonat; tatsächliches Tagesdatum bleibt Herkunft, kein Tagesszins |
| `grantKey` | opake Person-/Vertrags-/Jahres-/Komponentenidentität ohne Namen oder Vertragsnummer |

Ein bestätigter Anspruch ist **kein bestätigter Zufluss**. Ein bekanntes Gutschriftdatum innerhalb eines Monats wird im Monatskern am Ende dieses Monats angesetzt und zusätzlich als zeitlich modelliert markiert, sofern es nicht tatsächlich Monatsende ist. Das Belegdatum wird nicht überschrieben. Eine Tagesrechnung ist nicht Bestandteil des Vertrags.

Juni des Folgejahrs ist nur zulässig, wenn **für das einzelne Ereignis** als hypothetischer Termin bestätigt; kein global unsichtbarer Default. Auch Betrag und zukünftige Fördervoraussetzungen müssen je Jahr explizit vorliegen oder als eigene Hypothese markiert sein. Ein externer AP-01a/b-Status `review_required` darf nicht durch eine auf Cent gerundete Eigenberechnung „geheilt“ werden. Externe Subcent- oder Halbcentansprüche bleiben gesperrt; keine AP-03a-Neurundung.

Ein tatsächlicher Zufluss ersetzt in einer neuen Request-Version das zugehörige hypothetische Ereignis; beide dürfen nicht gleichzeitig als derselbe Anspruch gebucht werden. Im Minimalumfang höchstens ein Ereignis pro `grantKey`. Tatsächliche Teilgutschriften derselben Komponente brauchen einen gesondert bestätigten Tranchierungsvertrag und gehen zunächst in `review_required`; keine heuristische Zusammenfassung. Rückforderungen, negative Zulagen und rückwirkende Anspruchsänderungen werden nicht als negative Sparrate eingeschleust; neuer fachlicher Auftrag bzw. vorgelagert eindeutig abgegrenzter Bestand nötig.

**Zulagenabdeckung ist eine Aussage über die Vollständigkeit, kein Filter für Ereignisse.** Jede gültig explizit übergebene Zulage innerhalb des Horizonts wird in jedem Modus genau einmal gebucht. Bekannte Ereignisse bleiben auch bei unbekannten weiteren Zulagen erhalten; fehlende Ereignisse werden niemals erzeugt.

| `grantCoverage.mode` | Bedeutung | Explizite Ereignisse | Weitere nicht aufgeführte Zuflüsse / Gesamtergebnis |
|---|---|---|---|
| `complete_events` | Die Liste bildet alle für diese Modellrechnung berücksichtigten Zulagen vollständig ab; Vollständigkeit muss ausdrücklich belegt oder als Hypothese bestätigt sein | Alle buchen, auch wenn der Betrag oder Termin als Hypothese gekennzeichnet ist | Keine weiteren Ereignisse; vollständiger **Modell**endwert berechenbar, kein Beleg künftiger Rechtsansprüche |
| `none_assumed` | Zusätzlich zu den ausdrücklich aufgeführten Ereignissen werden im Szenario keine weiteren Zulagen angenommen | Alle buchen; die Liste darf leer oder nicht leer sein | Die Ergänzung ist ausdrücklich eine Nullannahme. Vollständiger Szenarioendwert berechenbar, sichtbar „keine weiteren Zulagen angenommen“ |
| `unknown` | Mindestens ein weiterer im Horizont möglicherweise wirksamer Förderjahres-/Zuflussbereich ist nicht geklärt | Alle bezifferten und datierten Ereignisse weiter buchen | Kein vollständiger geförderter Endwert. Nur separat bezeichnete Projektion der spezifizierten Cashflows und unabhängige bekannte Summen; offene Jahre ausdrücklich ausweisen |

`complete_events` bestätigt die Vollständigkeit des **definierten Modellkatalogs**, nicht die rechtliche Gewissheit zukünftiger Ereignisse. `none_assumed` erklärt die verbleibende Lücke bewusst zur Modellnull. `unknown` lässt diese Lücke offen; es ist kein anderer Name für Null. Diese Unterscheidung wirkt auf Status und Aussageumfang, nicht auf das Verschwinden vorhandener Zahlungen. Ein unaufgeführter bekannter Zufluss darf durch `none_assumed` nicht fachlich wegdefiniert werden; die vollständige Übermittlung bekannter Buchungen bleibt eine ausdrückliche Callerpflicht.

Für `complete_events` und `none_assumed` ist `unresolvedContributionYears=[]` vorgeschrieben; für `unknown` mindestens ein aufsteigend eindeutig aufgeführtes Beitragsjahr. Diese Jahresliste bezeichnet nur ungeklärte mögliche Zuflüsse innerhalb der Modellzeit, erzeugt selbst keine Zahlung und sagt nichts über deren Höhe aus. Nach-Ende-Ereignisse bleiben separat vorhanden. Die ungeförderte Referenz verlangt ausdrücklich `none_assumed`, eine leere Zulagenliste und keine offenen Zulagenjahre; hier ist die Null Bestandteil der ungeförderten Vergleichsdefinition.

Die API liefert die Kennzahlen `specifiedEndBalance` und `completeEndBalance` getrennt. Bei unbekannter Abdeckung bleibt die erste unter ausreichenden übrigen Annahmen berechenbar, die zweite ist `review_required/allowance_coverage_unknown`. Es gibt keinen automatisch als vollständig ausgegebenen „Eigenbeitragswert“, der bereits bekannte Zulagen herausrechnet. Ein reiner Eigenbeitragsvergleich ohne solche Zahlungsbestände wäre eine andere ausdrücklich abgegrenzte Anfrage, kein Fallback.

F08 verwendet nun ausdrücklich `complete_events` für den isolierten Musterfall oder alternativ `none_assumed` mit beibehaltener einzelner 120-€-Zulage. F10 wird in drei Abdeckungsvarianten getrennt: bestätigte Einmalzahlung plus bewusste Nullfortschreibung, vollständiger Modellkatalog oder unbekannte weitere Förderung. In allen drei Fällen verbleiben 120 € in den spezifizierten Cashflows. Abschnitt 14 enthält die genauen Status-Sollwerte.

### 4.5 Kosten, Geldpräzision und Ausgabe

**Zwei Abzugspfade und eine gesonderte Bruttoansicht:**

| Modus | Rendite / zulässiger Abzug | Kostenbetrag / Ergebnisstatus |
|---|---|---|
| `gross_plus_explicit_costs` | Renditen vor den erfassten Kosten; explizite vollständige Kostenabgrenzung | Kosten ledgerfähig; nach den erfassten Modellkosten, vor Steuern. Bei Tarifbezug nur mit passendem Kostenbeleg |
| `net_return` | Renditen nach **allen** in diesem Modus erfassten Kosten; keine zusätzlichen Gebührenereignisse | Endwert modellierbar, Gesamtkosten in Euro **nicht aus der Nettorendite ableitbar**, daher `not_determinable`, nicht 0 |
| `gross_only` | ausdrücklich gewünschte Vor-Kosten-Projektion, keinerlei Aussage über tatsächliche Kosten | Bruttoendwert möglich; Kosten/Endwert nach Kosten nicht bestimmbar. Unbekannt wird nicht als Nullkostenannahme ausgegeben |

Neutrale Nullkosten oder andere frei gewählte Kostensätze sind nur als **explizite hypothetische Kostenszenarien** zulässig. „Quelle unbekannt“ ist weder ein Beleg noch eine solche Bestätigung. Produktbezeichnung allein bestätigt keine Netto-/Bruttoabgrenzung. Überschneidende TER, Depotentgelt und all-in-Rendite nicht addieren.

Für den ersten Bruttokostenpfad wird ausschließlich eine **effektive jährliche Bestandsminderung** `0 ≤ c < 1` vorgeschlagen: `c_m = 1 − (1−c)^(1/12)`. Der verbleibende Bestand nach zwölf kostenbehafteten Monaten ohne andere Bewegungen ist exakt der Faktor `1−c`. Dieser Umrechnungsvertrag gilt nur, wenn die Eingabe genau diese Bedeutung bestätigt. Ein nominelles jährliches Depotentgelt mit Abrechnung `c/12`, tägliche TER, durchschnittlicher Bestand, Mindestentgelt oder Beitragskosten ist **eine andere Kostenart** und wird ohne passenden Vertrag nicht eingepasst. Keine Behauptung, reale Produktkosten würden generell so berechnet. Auch `c = 1` bekommt keine wiederkehrende monatliche Vollentleerungsinterpretation, sondern `review_required`; negative Kosten oder c > 1 ungültig.

Kostenbasis V nach Rendite und Stress, vor aktuellen Zuflüssen. Feste einmalige, explizit datierte Eurokosten F belasten ausschließlich diesen vorhandenen Bestand; innerhalb eines Monats exakt summieren. Quelle/Version, Gültigkeit, Währung, betroffene Kostenarten und Abgrenzung zu Renditen müssen feststehen. Satzwechsel ab angegebenem Monat. Auf Einzahlungen erhobene Abschluss-/Orderkosten, gestaffelte Abschlusskosten, Verkäufe oder externe Barzahlung von Gebühren werden im Minimalumfang nicht simuliert. Bei Bedarf `review_required/cost_type_not_supported`, **keine stille Null**. Ein Einstieg mit B=0, E=100 und Abschlussgebühr 5 kann deshalb nicht als 95 € ausgegeben werden, solange der Gebührenvertrag nur vorfinanzierte Bestandskosten unterstützt.

**Geldgrenze:** EUR, einzelne Eingabeereignisse/Anfangsbestand exakte nichtnegative sichere Ganzzahl-Cents, kein `−0`, kein String-zu-Zahl-Coercing, keine Subcents. Obergrenze für Geldwerte und Ergebnis-/Summendomäne: `9.007.199.254.740.991 Cent = 90.071.992.547.409,91 €`. Ein Überlauf bei rechnerisch gültigen Eingaben führt zu `review_required/numeric_domain_exceeded`; eine bereits übergroße Eingabe ist `invalid_input`. Diese technische Obergrenze ist kein zulässiger Produktbeitrag; Produktgrenzen prüft AP-03a nicht.

**Interne Rechnung:** keine Binärfloat-Geldarithmetik und keine Cent-Rundung pro Monat, Kostenart oder Ereignis. Vorgeschlagen: deterministische Dezimal-/BigInt-Intervallrechnung mit 36 Dezimalstellen für Faktoren und Eurobeträge, nach außen gerundeten unteren/oberen Grenzen. Die zwölfte Wurzel wird über rationale Potenzvergleiche eingegrenzt; exakt auflösbare rationale Faktoren dürfen exakt bleiben. Alle weiteren Operationen propagieren die Grenzen. Keine neue Laufzeitbibliothek und kein browserabhängiges `Math.pow` als Centoracle. Bloß „36 Stellen“ garantiert nicht für jeden Grenzfall einen Cent: Jede ausgegebene Geldkomponente braucht denselben gerundeten Cent an beiden Intervallgrenzen. Bei nicht eindeutigem Cent `review_required/precision_ambiguous`, keine Zahl. Ein bewiesener exakter Halbcent folgt der nachstehenden Modellregel.

**Ausgabevorschlag:** nächster Cent, exakte Mitte „half to even“. Das ist ausschließlich eine vorgeschlagene Modell-/Anzeigeregel, keine gesetzliche Rundungsbehauptung. Externe Förder-Cents werden unverändert übernommen. Monatskosten/Erträge/Endwerte können für die Ausgabe auf Cent dargestellt werden; für die Weiterrechnung bleibt der interne Wert maßgeblich. Ausgabe enthält zusätzlich hochpräzise Werte bzw. Intervalle als Dezimalstrings. Negative Null wird nur beim Ergebnisformat als `0` dargestellt, niemals aus Eingaben repariert.

**Bilanz:** intern pro Monat `W−B = G−S−K+E+L+Z`; über N Monate `W_N = B_0 + ΣG − ΣS − ΣK + ΣE + ΣL + ΣZ`. Summen aus internen Werten, nicht Summe gerundeter Zeilen. Für die Centdarstellung ein ausdrücklich bezeichnetes `displayRoundingResidual`, falls die gerundeten Komponenten den gerundeten Endwert nicht ergeben; keine Verlagerung dieses Ausgleichs in Kosten oder Zulagen. Im `net_return`-Pfad ist G der modellierte Ertrag **nach enthaltenen Kosten**, nicht der Bruttoertrag; enthaltene Kosten bleiben unbeziffert und werden nicht zusätzlich subtrahiert.

### 4.6 Referenz, Verlässlichkeit und Versionierung

Die ungeförderte ETF-/Fondsreferenz erhält genau denselben Start/Endmonat, Anfangsbestand und **monatlich identischen Eigenbeitrag einschließlich Einmalbeiträgen**. Nicht nur gleiche Jahressumme: auch Zeitpunkte müssen gleich sein. Bei abweichendem Anfangsbestand ist ein Vergleich auf dieser Basis nicht vergleichbar. Die Referenz hat keine Zulagen. Ein identischer Markt-/Quoten-/Stresspfad kann für die isolierte Förderwirkung gewählt werden; abweichende Annahmen müssen getrennt bezeichnet werden. Keine Aussage über identische reale Produkteigenschaften.

Referenzkennzeichen: „ungefördert; grundsätzlich freier verfügbar; hypothetisches Markt-/Kostenszenario; vor Steuern“. Keine automatische Kapitalertragsteuer, Vorabpauschale, Teilfreistellung, keine Renditeannahme als Hausmeinung, keine Netto-Rangliste und keine Optimierung auf gleichen Nettoaufwand. G-05 bleibt offen. Kein automatischer Sieg aus einem höheren Endkapital. AVD-Auszahlungsbindung, Steuerbasis, Garantien und Tarifmerkmale werden durch den neutralen Kern nicht berechnet.

| Ergebnisqualität je Kennzahl | Bedeutung / erlaubte Ausgabe |
|---|---|
| `regelbasiert` | Von außen eindeutig abgedeckter Anspruch mit eigenem Rechts-/Regelstand; AP-03a leitet diese Qualität niemals aus der Kapitalprojektion ab |
| `modelliert_unter_annahmen` | Kapital-/Stress-/Kostenszenario mit vollständigen expliziten Parametern; auch bei bestätigtem Anfangsbestand und tatsächlich bekannten historischen Zuflüssen bleibt eine zukünftige Marktentwicklung Modell |
| `review_required` / `nicht_hinreichend_bestimmbar` | Ursache und fehlender Parameter; kein betroffener Betragswert, nicht 0. Unabhängige sichere Kennzahlen bleiben separat möglich |
| `invalid_input` | Ungültige Form, Typen, Domäne, Doppelereignisse oder Widerspruch im Eingabevertrag; keine still korrigierte Berechnung |

Status und Evidenzqualität sind getrennt: eine berechenbare Hypothese ist nicht rechtlich belegt; ein bestätigter Zahlungsbetrag macht die angenommene Monatsendverzinsung nicht zum Vertragsfakt. `actual` bestätigt nur den konkret benannten Sachverhalt, keine Authentisierung des externen Belegs.

Jeder Parameter besitzt eine deterministische Identität durch seinen Binding-Pointer und wird mit den expliziten Quellen-IDs, Versionen, Gültigkeitsbereichen und Qualitätsangaben aus Abschnitt 12 gebunden. Dies gilt auch für Nullannahmen, Zeitraum, Anfangsbestand, Schedules, Stress, Kosten, externe Zulagen und Referenzbasis. Kein Systemdatum ergänzt einen Quellenstand. Es gibt keine zusätzlichen undokumentierten öffentlichen Parameterfelder.

Feste Ergebnisversion: `modelVersion`, `inputContractVersion`, `numericConventionVersion` und externe `ExternalRule.ruleVersion`/Quellenstände. Kein „latest“-Fallback, kein `Date.now()`, keine Zufalls-ID, kein versteckter Rechtsjahreswechsel. Dieselbe kanonische Eingabe und Version erzeugen dieselbe vollständige Ausgabe in derselben Reihenfolge. Änderung einer Konvention verlangt neue Modellversion, keine Umschreibung alter Ergebnisse. AP-03a speichert nichts und führt keine Schemainnovation ein; ein späterer Persistenzvertrag bleibt AP-02b vorbehalten.

## 5. Architekturprüfung und vorgeschlagener Minimaldiff

### 5.1 Istarchitektur und Schutzfolgen

| Gelesener Bereich | Feststellung | Folgerung für AP-03a |
|---|---|---|
| AP-01a | `calculateDirectGrant(unknown)` mit eigenem Regelvertrag; nicht volle Cents gehen in `review_required/rounding_convention_required` | Nicht ändern/importieren zur automatischen Dauerförderung; ausschließlich explizite externe Centereignisse übernehmen |
| AP-01b | Eigenständiger Alt-Riester-Vertrag; exakte BigInt-Faktoren; ungeklärte Halb-/Teilcentfälle gesperrt | Keine Neuimplementierung/Neurundung und kein Ersatz durch Kapitalmodell |
| AP-04a/AP-05a | RetirementEntry hat lokale A-/B-Entwürfe, Vorschau und Dirty-/Verlustschutz; keine eigene Vorsorgepersistenz | Kein tatsächlicher Import des neuen Kerns in die Oberfläche, kein neuer Navigations-/Speicherpfad |
| Bisherige Beiträge | Adapter besitzen jahresbezogene Monats-/Einmalbeitragslogik, noch keinen mehrjährigen datierten Cashflowvertrag | Späterer AP-04b-Adapter muss explizite Monate erzeugen; AP-03a ändert die existierenden Adapter nicht |
| P1 | Frisch gelesener Store, geschützte Originaleinträge/Backups, keine atomare Cross-Tab-Garantie | Neuer Kern erhält keine Storage-/Case-API und schreibt keine Fälle oder Backups |
| D1 | IST planunabhängig; PLAN aktiv; ZIELPLAN nur preferred; gemeinsame Exportberechnung | Keine Beimischung von Projektionskapital/Zulagen in allgemeine Vermögenswerte oder Exporte |
| H5a/H5b | Keine verlusthafte Legacy-Normalisierung; kontrollierte Kopie/Quellenbindung | Kein Aufruf von Normalisierung, Reconciliation, Restore oder Recovery aus dem Kern |
| Schema/Version | 11 / 0.18.4 | Unverändert; Modellversion nur im flüchtigen Ergebnisvertrag |
| Reguläre CI | `verify` enthält Typecheck, einen Build und Playwright; danach R1 und Diffcheck | Neue Tests müssen tatsächlich automatisch entdeckt und streng typgeprüft werden |

Ein neuer, aus dem UI nicht importierter Kern muss nicht im Websitebundle erscheinen. **Das ist kein Testnachweis**: Er wird durch seine Tests transitiv in die Typeprüfung aufgenommen. Im späteren Integrationspaket ist zusätzlich auf verbotene Importkanten, Side Effects und tatsächlich unveränderte Bestandsausgaben zu prüfen.

### 5.2 Getter-/Proxy-Grenze – ausdrücklicher Architekturentscheid

Die vorhandenen AP-01a/b-Muster benutzen unter anderem `Object.getPrototypeOf` und Property-Deskriptoren. Damit lassen sich Accessorwerte vermeiden und feindliche Formen kontrolliert ablehnen. Bei einem Proxy können gerade diese Strukturabfragen jedoch Handler ausführen. Ein `try/catch` fängt Fehler ab, verhindert aber keine bereits erfolgte Trap-Nebenwirkung. Das ist eine technische Folgerung aus Q09 und dem gelesenen Code, **kein Auftrag zur Änderung der Förderkerne**.

Für AP-03a wird zur wörtlichen Einhaltung „keine Getter-/Proxy-Auswertung zur Normalisierung“ vorgeschlagen:

- Öffentliche Rechenfunktion nimmt ausschließlich einen **primitiven String** an; jede Objekt-/Funktions-/boxed-String-Eingabe wird nach `typeof` zurückgewiesen, ohne Prototypabfrage, Deskriptorzugriff, Stringkonversion oder JSON.stringify auf diesem fremden Objekt.
- JSON.parse ohne Reviver erzeugt eigene Daten; Schema strikt validieren. Kein Spread aus fremden Objekten. Unbekannte Felder, gefährliche Schlüssel und falsche Typen ablehnen.
- Dezimalstrings verwenden Punkt, optionales Minus und höchstens 36 Nachkommastellen; kein Plus, keine führenden Nullen, keine Exponenten, keine nachlaufenden Dezimalnullen, kein `−0`. Prozentwerte werden nicht aus Zeichenketten wie „12 %“ interpretiert. Kanonisches JSON ist Teil des Request-Vertrags: feste lexikografische Schlüsselreihenfolge, keine Leerraumvarianten, keine doppelten Schlüssel, Geld als Integer-Cents, Raten als Dezimalstrings. Nach Validierung eigener Daten muss die exakt vorgeschriebene kanonische Ausgabe dem Eingabestring entsprechen. Dadurch werden auch doppelte JSON-Schlüssel und nichtkanonische Zahlformen abgelehnt, nicht still normalisiert.
- Typisierte DTO-Interfaces dokumentieren weiterhin den Inhalt. Keine zweite öffentliche Objektüberladung. Spätere Verbraucher erzeugen den JSON-Text ausschließlich aus ihren eigenen vertrauenswürdigen Daten, nicht durch Normalisierung beliebiger fremder Objekte.

Die Alternative ist eine öffentliche Objekt-API mit eingeschränkter Sicherheitszusage „keine Getterwerte; Proxy-Traps können bei der Validierung laufen“. Das entspricht der strikten Auslegung des Auftrags nicht und braucht vorab eine ausdrückliche Präzisierung. Work wählt diese Lockerung nicht selbst.

Ressourcen werden ausdrücklich von der Kalenderdomäne getrennt. Der vollständige Vorschlag in Abschnitt 13 erhält 0100–9999 und 118.800 Monatsrechnungen. Er trennt bis 1.200 detaillierte Ausgabezeilen pro Gesamtanfrage, automatische bzw. ausdrücklich kompakte Ausgabe in höchstens 120 lückenlosen Zeitblöcken je Projektion sowie deterministische Ressourcenfehler. Keine Laufzeitverkürzung, kein stiller Abbruch und kein automatischer Wechsel bei ausdrücklich verlangter Detailausgabe.

### 5.3 Pure API – nur Entwurf

Öffentliche Funktionen, keine Implementierung in Stufe 1:

| Entwurf | Aufgabe |
|---|---|
| `projectRetirement(inputJson: string): Response` | Validiert einen vollständigen Request und liefert denselben neutralen Algorithmus für jede Marktannahme |
| `compareRetirement(inputJson: string): Response` | Validiert gemeinsame Basis; ruft pro ausdrücklich übergebenem Szenario und ungeförderter Referenz denselben Kern auf; keine zweite ETF-Formel |

Die öffentlichen primitiven Textgrenzen bleiben erhalten. Die vollständigen geschlossenen DTO-/Ergebnisstrukturen, ihre zulässigen Kombinationen und die kanonische Serialisierung stehen in Abschnitt 12. Die Signaturen in der Tabelle bezeichnen spezifizierte Funktionen, keine in diesem Auftrag angelegte Implementierung.

`projectRetirement` akzeptiert ausschließlich `ProjectionRequest`; `compareRetirement` ausschließlich `ComparisonRequest`. Ein Vergleich enthält genau drei benannte Marktannahmen mit je einer geförderten und einer ungeförderten Projektion. Jede benutzt denselben mathematischen Kern. Abweichende Quoten-/Kosten-/Marktannahmen sind ausdrücklich sichtbar; gemeinsame Eigenbeiträge, Zahlungszeitpunkte, Zeitraum und Anfangsbestand werden auf Gleichheit geprüft. Es gibt keine automatische Auswahl eines mittleren Szenarios und keine zweite ETF-Formel.

### 5.4 Erlaubtes Dateipaket nach Gate-GO – Vorschlag

Nur neue Dateien:

1. `app/domain/retirement/projection-contract.ts` – DTO-/Ergebnis-/Versions-/Quelltypen.
2. `app/domain/retirement/projection-decimal.ts` – isolierte deterministische Präzisionsoperationen.
3. `app/domain/retirement/projection.ts` – Validierung, Monatsledger und derselbe Kern für alle Varianten/Referenz.
4. `tests/browser/ap03a-projection.spec.ts` – reine Domain-Sollfälle, Negativ-/Präzisions-/Determinismuskontrollen, direkte Imports des neuen Kerns; kein UI-Einbau.
5. `docs/AP03a_Neutraler_Projektionsvertrag.md` – öffentlich freigegebener Rechenvertrag mit ausschließlich synthetischen Beispielen und öffentlichen Quellen.

**Warum eine Playwright-Spec für Domainprüfungen?** Der vorhandene Runner entdeckt `tests/browser/**/*.spec.ts`; TypeScript umfasst `tests/browser/**/*.ts`, damit auch dessen Domainimports. Die neue Spec kann ohne `page`-/Browserfixture reine Funktionen prüfen; die bestehenden echten Browserpfade laufen daneben regulär. Der dokumentierte Runner ist eine notwendige Integrationsentscheidung, keine behauptete Durchführung. Tests mit langen Kalender-/Präzisionsläufen brauchen nach Umsetzung echte Laufzeitbelege unter der unveränderten 60-s-Testgrenze; der festgelegte Ressourcenvertrag darf nicht erst wegen einer roten CI geändert werden. Ein bislang nicht belegtes Laufzeitversprechen wird hier nicht behauptet.

Falls der Projektleiter getrennte Node-Domainprüfungen außerhalb dieses Runners verlangt, sind diese aktuell **nicht automatisch Teil von Verify**. Dann wäre vorher eine ausdrücklich autorisierte minimale bestehende Dateianpassung nötig. Keine solche Änderung wird hier vorweggenommen. Kein neuer npm-Befehl, keine Workflowänderung und keine Runtime-Abhängigkeit sind im vorgeschlagenen Minimalpaket vorgesehen.

## 6. Vollständiges Entscheidungs-/Konventionsregister

Status `belegt` betrifft nur die Quellenfeststellung; neue Rechenvorschläge sind `nur Modellannahme` oder `offen`. **Alle vorgeschlagenen Modellannahmen sind noch unbestätigt.** Eurofolgen sind synthetisch, vor Steuern und keine Produktprognose. Verweise F/N beziehen sich auf die Sollfallmatrix in Abschnitt 7.

| ID / Priorität | Rechts-/Quellentyp, Status | Vorschlag / Alternative | Fachliche Eurofolge im Grenzfall | Entscheidungsvorschlag |
|---|---|---|---|---|
| K01 / P2 | Q02; offen | Start/Ende inklusive, Anfangsbestand vor Start; alternativ Endmonat exklusiv | Okt–Dez je 100 €: 300 statt 200 €; falsche Jahreshochrechnung 1.200 € (+900 €), F02 | Inklusiven Monatsvertrag bestätigen |
| K02 / P2 | Q02; nur Modellannahme | Monatsende statt Monatsanfang; keine Tagesrechnung | 3×100 €, monatlich 1 %: 303,01 statt 306,04 €, F04 | Monatsende; Teilmonate ohne Ersatzannahme sperren |
| K03 / P2 | Q02, mathematische Äquivalenz | Geometrisch statt R/12; R=−1 nicht terminiert | 1.000 €, 12 % p.a.: 1.120,00 statt 1.126,83 €; −100 % kann bei späterem 100-€-Zufluss 0 oder 100 € ergeben, F05/F07 | Geometrie bestätigen; R=−1 Review |
| K04 / P2 | Q02/Q10; offen | Kalender 0100–9999; Rate ≤1000000, 36 Dezimalstellen; technische Betragsgrenze | Überschreitung darf keinen gekappten 90.071.992.547.409,91-€-Scheinwert erzeugen; F31/N03 | Technische Domänen und kontrollierte Nichtberechnung bestätigen |
| K05 / P2 | Q03/Q04/Q06/Q12; belegt für Quellenbefund, Modelltermin offen | Nur datierte Istbuchung oder explizite hypothetische Buchung; kein Juni-Default | 120 € im Mai/Jun bei +1 % monatlich bis Dez: 128,66/127,38 €, Δ1,28 €, F08 | Kein Default; Juni nur Hypothese, Mai-Bezug nach Q12 ausdrücklich als Monatsillustration kennzeichnen |
| K06 / P1 | Q01/Q02; offen | Förderjahr und Buchungsjahr getrennt, kein Fortschreiben | 2027 einmal 120 €; unterstellte Wiederholung 2028 würde bei 0 % +120 € erfinden, F10 | Keine Wiederholungsfelder; Jahr für Jahr explizit |
| K07 / P2 | Q01/Q02; nur Modellannahme | Nach Ende aussondern statt Ende verlängern oder Anspruch vorziehen | Ende Dez 2027, Z im Jun 2028: 0 statt 120 € gebucht, F09 | Separates Nach-Ende-Register, keine Kapitalbuchung |
| K08 / P2 | Q02; offen | Monatsrendite → Stress → Kosten → Zuflüsse | B 1.000, E 100, q 100 %, Crash−30 %, Rendite 0: 800 statt 770 € bei Crash auch auf E, F18 | Reihenfolge 4.3 bestätigen |
| K09 / P2 | Q02; nur Modellannahme | Monatliches kostenfreies Rebalancing statt Buy-and-hold | B 1.000, q 50 %, Aktien +10 %/Monat, Renten 0, 2 Monate: 1.102,50 statt 1.105,00 €, F22 | Rebalancing als sichtbare Hypothese bestätigen |
| K10 / P2 | Q02; offen | Wurzeln je Baustein statt Wurzel der gemischten Jahresrendite | Aktien+12 %, Renten 0, q 50 %, B 1.000, 12 Monate: 1.058,44 statt 1.060,00 €, F23 | Bausteingeometrie vor Gewichtung |
| K11 / P2 | Q07/Q08; belegt für Sperre, Pfad offen | Brutto+explizite Kosten ODER Netto; alternativ doppelt belasten | B 10.000, bereits Netto−1 %: 9.900; zusätzliche 1 % Kosten ergäben 9.801 € (−99 €), F13 | Strikt diskriminierte Kostenmodi |
| K12 / P2 | Q02/Q07/Q08; offen | Effektive jährliche Bestandsminderung über Wurzel; nominell c/12 nur bei anderem freigegebenem Typ | B 10.000, c 1 %, R 0: 9.900,00 statt 9.900,46 €, F12 | Nur explizit bestätigte effektive Kostenart unterstützen |
| K13 / P2 | Q02; nur Modellannahme | Kostenbasis nach Rendite/Stress, vor Zufluss; alternativ Anfangsbestand oder inkl. Beitrag | B 1.000, +10 % Monatsrendite, c_m 1 %, E 100: 1.189 statt 1.190 bzw. 1.188 €, F14 | Basis V bestätigen |
| K14 / P2 | Q01/Q02; offen | Einmalkosten nur aus vorhandenem Bestand; keine stille Vorfinanzierung aus späterem Zufluss | B 0, E 100, F 5: kein Wert; „95 €“ setzt anderen Kostenvertrag voraus, F15 | Im Minimalumfang Review für Beitragskosten/Unterdeckung |
| K15 / P2 | Q07/Q08; belegt für Begriff, Kostenwissen offen | Effektivkostenquote/fehlende Kosten nicht als Depotgebühr oder 0 | B 10.000, „1 % Effektivkosten“: 9.900 € wäre ungesichert; nur ausdrücklich Brutto 10.000 € möglich, F16/F17 | Betroffenen Nach-Kosten-Wert sperren |
| K16 / P2 | Q01/Q02; offen | Keine monatlichen Centzwischenrundungen; Anzeige half-even; alternativ half-up | 0,01 €, Faktor 1,5 für 2 Monate: 0,02 statt 0,03 € bei monatlicher Rundung; 0,005 €: 0,00 statt 0,01 €, F27/F28 | Interne Präzision und explizite Modellanzeigeregel bestätigen |
| K17 / P1 | Q01/Q10; belegt als Bestandsschutz | Externe Förder-Cents unverändert; unaufgelöster Halbcent bleibt Review | Externer Anspruch 60,005 € darf weder 60,00 noch 60,01 € werden, F29 | Kein AP-01a/b-Rundungsersatz |
| K18 / P2 | Q02; nur Modellannahme | Crash nach Rendite ausschließlich auf Aktien; danach kein automatischer Rebound | B 1.000, q 50 %, Aktien+10 %, Crash−30 %, E 100: 985 €; pauschal ganzer Vorbeitragsbestand×0,7 +100 wäre 835 €, F19 | Exakte Stressbasis und einmaligen Charakter bestätigen |
| K19 / P2 | Q01/Q02; offen | Monatlich identischer Eigenbeitrag/Anfangsbestand; Zulage nur AVD | E 100 Okt–Dez, Z 120 im Dez, R 0: AVD420, Referenz 300; E 220 in beiden wäre falsche +360-€-Eigenbasis, F25 | Gleiches eigenes Geld, keine Nettooptimierung |
| K20 / P2 | Q02; offen | Kosten/Anspruch/Projektion getrennte Qualitätsstatus | Nettorenditepfad liefert 9.900 € Kapital, aber nicht „Kosten 0 €“, F13 | Status je Kennzahl und Null-vs-unbekannt bestätigen |
| K21 / P1 | Q09/Q10; technische Folgerung, offen | Primitive JSON-Grenze ohne Objektüberladung; alternativ objektbasierte eingeschränkte Proxy-Zusage | Wechselnder Getter 100/200 € könnte bei 1 Monat 100 € Differenz erzeugen; korrekt gar kein Wert und 0 Zugriffe, N10 | Textgrenze ausdrücklich freigeben |
| K22 / P2 | Q01/Q10; offen | Neue automatisch entdeckte Tests/browser-Spec; alternativ vorher genehmigte Testharnessänderung | Kein eigener Europarameter; ohne Entdeckung bliebe z.B. der +900-€-Oktoberfehler aus F02 ungetestet | Minimaldiff mit bestehendem Runner bestätigen |
| K23 / P2 | Q02; offen | Eine vollständige Monatsquote/-rendite ab Start; keine Defaults, deterministische Versionsbindung | F22 kann allein durch Quotendrift 2,50 € abweichen; ein später geänderter Default würde alte Werte ändern | Vollständige Schedules und feste Versionen |
| K24 / P2 | Q01/Q02; nur Modellannahme | Belegdatum im Monat als Monatsendbuchung; alternativ Tageszins | 120 € am 15. Mai bei +1 % Monatsannahme: Monatsendmodell bis Dez 128,66 €; angenommener halber Mai zusätzlich ca.129,30 € (Δ0,64 €), F11 | Monatsauflösung offen benennen, keine Tagesgenauigkeit behaupten |
| K25 / P2 | Q01/Q02; offen | Pro grantKey nur ein Ereignis; tatsächlicher Zufluss ersetzt Hypothese statt Addition | Zweimal 120 € ergäben bei R 0 unzulässig 240 €; F30 | Doppelidentität ablehnen, Teilgutschriften zunächst Review |
| K26 / P2 | Q01/Q02; nur Modellannahme | Interne Bilanz und separater Anzeigeausgleich | Exakt B 0,01 + Ertrag 0,005 = End 0,015 €; gerundet 0,01+0,00 ≠0,02: Ausgleich+0,01 €, F28 | Kein versteckter Kosten-/Zulagenausgleich |

**Entscheidungsreife bedeutet hier:** Die bevorzugte Variante, Alternativen und materielle Folgen sind benannt. Keine fehlende individuelle Tarifunterlage wird für den neutralen Kern vorausgesetzt, solange dieser keine Tarifbehauptung erzeugt. Sollen weitere Kostenarten, Teilmonate, tatsächliche Tranchengutschriften, Buy-and-hold oder ein anderer Eingabetyp unterstützt werden, muss der Vertrag vor Implementierung entsprechend neu versioniert werden.

## 7. Sollfallmatrix und unabhängige Rechenwege

### 7.1 Konkrete Basiseingaben und Oracle-Trennung

Alle nachstehenden Fälle sind **synthetisch**. Wo nichts anderes steht, gilt folgende vollständige Basiseingabe B:

- Dokumentrevision `ap03a-g07-candidate-0.2` (ausschließlich Dokumentstand). Ausführbare Anfragen verwenden die vier API-Versionen aus Abschnitt 12.1: `ap03a-model-v1.0`, `ap03a-input-v1.0`, `ap03a-decimal36-v1.0`, `ap03a-result-v1.0`. Start `2027-01`, Ende `2027-12`, Anfangsbestand 0 Cent unmittelbar vor Januar.
- Rate 10.000 Cent ab Januar, keine Wechsel, keine Einmalbeiträge, keine Zulagen, Coverage `none_assumed`: außer der ausdrücklich genannten Liste keine weiteren Zulagen als Hypothese, keine Kostenereignisse, kein Stress.
- Aktienquote1 ab Start; Aktien-/Rentenjahresrendite0 ab Start, monatliches Rebalancing.
- Kostenmodus brutto+explizite hypothetische Nullkosten, vollständig bestätigt; effektiver Jahressatz0, feste Gebühren 0. Alle Quellen als synthetische Annahme Q11 mit eigener Fall-ID. Keine Steuern.

Alle numerischen Projektionsergebnisse dieser Matrix tragen den Status `modelliert_unter_annahmen`; ausdrücklich angegebene Review-/Invalid-Fälle liefern keinen betroffenen Endbetrag. Die Kennzeichnung „tatsächlich bestätigt“ ist im Sollfall eine synthetische externe Bestätigung, kein realer Kundenbeleg.

Jeder Tabellenfall überschreibt die genannten Felder von B; nicht überschriebene Werte bleiben genau B. B ist selbst F01. „Rate 0“ setzt den Schedule ausdrücklich auf 0, keine fehlende Angabe. Bei Änderung von Start wird der erste Satz-/Quoten-/Beitragswechsel automatisch **für die Fallbeschreibung** auf diesen Start gesetzt, nicht durch die spätere API. Aufgelistete Buchungen sind jeweils eindeutige Einzelereignisse mit Fall-ID, Förderjahr und Quellenstatus wie beschrieben.

Hilfsgrößen, ausschließlich zur lesbaren Fallbeschreibung:

| Symbol | Exakter Jahreswert / Bedeutung |
|---|---|
| J1 | `0.126825030131969720661201`, denn `1+J1 = (1.01)^12` |
| J2 | `0.268241794562545318301696`, entsprechend Monatsfaktor 1,02 |
| J10 | `2.138428376721`, entsprechend Monatsfaktor 1,10 |
| J50 | `128.746337890625`, entsprechend Monatsfaktor 1,5 |
| JM1 | `−0.113615128283870719341199`, entsprechend Monatsfaktor 0,99 |
| C1 | `0.113615128283870719341199`, effektive jährliche Bestandsminderung entsprechend monatlich1 % Kosten |

Die Matrix wird **nicht** durch einen kopierten Monatsloop zum Oracle gemacht:

1. Nullrenditefälle durch Abzählen datierter Zahlungen, ohne Zinsformel.
2. Einjahresfälle ohne Cashflows direkt über Jahresfaktoren.
3. Zahlungszeitpunkte über einzelne Zinsmonome bzw. eine geschlossene geometrische Summe.
4. Stress über getrennte Aktien-/Renten-Eurobeträge und einen einmaligen Verlust.
5. Rundungsgrenzen durch exakte rationale Brüche, nicht durch decimal/binary Näherungszahlen.
6. Bilanzfälle durch getrennte komponentenweise Addition und explizite Ledgerzeilen.

Zur numerischen Kontrolle wurden die nichttrivialen Wurzeln/geschlossenen Ausdrücke mit Python Decimal bei 90 Stellen und rationale Rundungsbeispiele mit Brüchen gerechnet. In der abschließenden Kontrolle bestanden 38 konkrete Geldwertprüfungen einschließlich Alternativrechnungen sowie der Kalenderzählungsabgleich aus der V0.1-Prüfung. Das ist eine Work-Kontrollrechnung, **keine organisatorisch unabhängige Abnahme** und keine AP-03a-Testausführung. Stufe 2 muss diese eingefrorenen konkreten Werte als Referenz nutzen; erwartete Werte dürfen nicht aus dem Prüfling erzeugt werden. Der unabhängige Review rechnet die kritischen Fälle selbst nach.

### 7.2 Zeit, Rendite und Zulagen

| Fall | Eingabeänderung gegenüber B | Sollausgabe und unabhängig nachvollziehbarer Weg |
|---|---|---|
| F01 | keine | 12 Zahlungen×100 = **1.200,00 €**, Eigen 1.200, Zulage 0, Kosten 0, Ertrag 0. Monatsenden 100/200/…/1.200 |
| F02 | Start 2027-10 | 3 Zahlungen Okt/Nov/Dez = **300,00 €**; 1.200 € wäre falsch. Erster Jahres-Eigenbeitrag 300 |
| F03 | Okt–Dez; Rate 100 Okt, 200 ab Nov; Einmal 500 Ende Nov | Monatsenden 100/800/1.000; Eigen 100+200+500+200 = **1.000,00 €**. Regulär 500, einmalig 500 |
| F04 | Okt–Dez; Aktienjahresrendite J1 | Endwert 100×(1,01²+1,01+1) = **303,01 €**, Ertrag 3,01. Alternative Monatsanfang 306,0401 →306,04 |
| F05 | B 1.000 €, Rate 0, Aktien R 0,12 | 12 Monate: Jahresidentität 1.000×1,12 = **1.120,00 €**, Ertrag 120. Monatsrate≈0,009488792934582974126355069193494. Falsches R/12 ergäbe 1.126,825030… →1.126,83 |
| F06 | B 1.000 €, Rate 0, Aktien R=JM1 | Jahresidentität 1.000×0,886384871716129280658801 = **886,38 €**; Monatsfaktor 0,99. Negativer Ertrag −113,615128… |
| F07 | B 1.000 €, Rate 0; Aktien R=−1 | **review_required**, Endwert nicht vorhanden. Kein stiller Monats-Totalverlust. Zum Vergleich −100-%-Stress mit B 1.000 und Monatsendbeitrag 100: End 100 €, F21 |
| F08a | Jan–Dez 2028; Rate 0, Aktien R=J1; tatsächliche Z 120 für 2027 am 31.05.2028 | 7 verzinste Folgemonate Jun–Dez:120×1,01⁷ =128,656242… → **128,66 €**; gebuchte Zulage 120, Ertrag 8,656242…; Zuflussbasis tatsächlich bestätigt |
| F08b | wie F08a, stattdessen Z 120 für 2027 hypothetisch 30.06.2028 | 6 Folgemonate:120×1,01⁶ =127,382418… → **127,38 €**, Δzu 8a **1,28 €**; Betrag/Zeitpunkt als Hypothese. Ein extern bestätigter Anspruch plus hypothetischer Juni bleibt zeitlich modelliert |
| F09 | Jan–Dez 2027; Rate 0; Z 120 für 2027 hypothetisch Jun 2028 | Gebucht 0, End **0,00 €**; Nach-Ende-Liste enthält 120 € im Jun 2028. Kein erfundener Anspruchsbestandswert 120 |
| F10 | Jan 2027–Dez 2028; Rate 0; nur ein tatsächlicher Zufluss 120 im Dez 2027 für 2026 | End **120,00 €**, genau ein Ereignis. Keine Wiederholung 2028; automatisch 240 € wäre falsch. Bei unbekannten weiteren Zulagen bleibt die spezifizierte 120-€-Projektion erhalten; nur der vollständige Endwert ist gesperrt |
| F11 | wie F08a, tatsächliches Belegdatum 15.05.2028 | Monatsendmodell weiterhin **128,66 €**, Belegdatum 15.05 erhalten, Zeitauflösung modelliert. Nur zum Alternativenvergleich:120×1,01^(7,5)≈129,2979 →129,30 €; nicht behaupteter Tageszinssollwert |

### 7.3 Kostenpfade und unzulässige Kostenverwendung

| Fall | Eingabeänderung | Sollausgabe / Weg |
|---|---|---|
| F12 | B 10.000 €, Rate 0, R 0; hypothetisch effektive Jahresbestandskosten 0,01 | 12 Monate:10.000×0,99 = **9.900,00 €**, explizite Kosten 100. Monatlicher Kostenfaktor≈0,000837177359120559528581967270855. Nominal c/12 wäre 9.900,457063… →9.900,46, also andere Konvention |
| F13 | B 10.000 €, Rate 0; `net_return`, beide Jahresrenditen−0,01; keine separaten Gebühren | End **9.900,00 €**, modellierter Nettoertrag−100; enthaltene Kosten in Euro **nicht bestimmbar**, nicht 100 und nicht 0. Zusätzlich 1-%-Gebührenfeld: invalid_input. Unzulässige Doppelbelastung gäbe 9.801 € |
| F14 | nur Jan; B 1.000 €, Rate 100; Aktien J10, q 1; Kosten C1 | Nach Rendite 1.100; Kosten 11; dann E 100: **1.189,00 €**. Alternative Kosten auf B:10 →1.190; inkl. Zufluss:12 →1.188 |
| F15a | nur Jan; B 1.000 €, Rate 100, R 0; feste belegte/hypothetisch freigegebene Bestandskosten 5 | **1.095,00 €**; Kosten 5, Eigen 100. Keine wiederkehrende Februar-Gebühr |
| F15b | nur Jan; B 0, Rate 100; gleiche feste Bestandskosten 5 | **review_required/insufficient_fee_basis**, kein Endwert 95 oder 100. Eine aus dem Beitrag finanzierte 5-€-Ordergebühr benötigt anderen bestätigten Vertrag |
| F16 | B 10.000 €, Rate 0; einzig Kostenquelle „Effektivkosten 1 %“, gewünschter Nach-Kosten-Wert | **review_required/effective_cost_not_balance_fee**, kein Endwert 9.900. Separat explizit `gross_only`: Brutto **10.000,00 €**, Kosten / nach Kosten unbekannt |
| F17 | wie F16, Kosten vollständig unbekannt | Nach Kosten **review_required**. `gross_only` nur ausdrücklich:10.000 € Brutto. Hypothetisch vollständig bestätigte Nullkosten wäre eigenständiger Request mit 10.000 € Modellendwert; nicht automatisch erzeugen |

### 7.4 Stress, Quote, Erholung und Vergleich

| Fall | Eingabeänderung | Sollausgabe / Weg |
|---|---|---|
| F18a/b/c | nur Jan; B 1.000 €, Rate 100, R 0; Stress −0,30; q 1 /0,5 /0 | Aktienverluste 300/150/0; Endwerte **800,00 /950,00 /1.100,00 €**. Eigenbeitrag 100 jeweils unberührt |
| F19 | nur Jan; B 1.000 €, E 100; q 0,5, Aktien J10, Renten 0; Stress −0,30 | Aktien 500→550→385; Renten 500; dann 100: **985,00 €**. Ertrag 50, Stress 165;1.000+50−165+100=985 |
| F20 | Jan–Feb; B 1.000 €, E 100/Monat; q 1, Januar R 0, Februar R=J10; Stress nur Jan −0,30 | Jan 700+100=800; Feb 800×1,10+100 = **980,00 €**. Stress 300 einmal, Ertrag 80, Eigen 200. Kein zweiter Crash; kein automatischer Wiederanstieg auf 1.000 |
| F21 | nur Jan; B 1.000 €, E 100, R 0, q 1; Stress −1 | Aktienbestand 0, E 100 danach: **100,00 €**, Stress 1.000. Im Unterschied zu F07 ist der Verlustmonat bekannt |
| F22 | Jan–Feb; B 1.000 €, Rate 0; q 0,5, Aktien J10, Renten 0 | Monatlich rebalanciert:1.000×1,05² = **1.102,50 €**. Buy-and-hold:500×1,10²+500=1.105,00 €, Δ2,50 |
| F23 | Jan–Dez; B 1.000 €, Rate 0; q 0,5, Aktien R 0,12, Renten 0 | Geschlossen 1.000×[(1+1,12^(1/12))/2]^12 = **1.058,44 €**. Jahresmischung 0,06 mit Wurzel ergäbe 1.060,00. Unterschied erklärt Rebalancingvertrag |
| F24 | Jan–Feb; B 1.000 €, Rate 0; Aktien J1, Renten J2; q 1 Jan,0 ab Feb | Januar 1.010; Februar Renten 1.010×1,02 = **1.030,20 €**. Kein Januarverlust/Ertrag rückwirkend ändern |
| F25 | Okt–Dez 2027; E 100/Monat, B 0, R 0/K 0; AVD Z 120 für 2027 hypothetisch Dez; Referenz Z 0 | AVD **420,00 €**, Referenz **300,00 €**; Eigen je 300, Zulage 120/0. Differenz 120 allein aus expliziter Hypothese, kein Nachsteuervergleich/Ranking |
| F26 | wie F25 ohne Z, beide Varianten gleicher kompletter Parameterstand | Beide **300,00 €**, identische Monatsledger. Vertauschte Szenarionamen ändern keinen Betrag. Referenz bleibt ungefördert gekennzeichnet |

### 7.5 Präzision, Zahlungsbilanz und extreme gültige Inputs

| Fall | Eingabeänderung | Sollausgabe / Weg |
|---|---|---|
| F27 | Jan–Feb; B 0,01 €, Rate 0, q 1, Aktien J50 | Exakter Bruch in Cent:1×(3/2)²=9/4 Cent; End 0,0225 € → **0,02 €**. Falsches monatliches Runden 0,015→0,02, danach 0,03 ergäbe 0,03 € |
| F28a | nur Jan; B 0,01 €, Rate 0; Aktienjahresrendite −0,999755859375, Monatsfaktor 0,5 | End exakt 0,005 € → **0,00 €** bei vorgeschlagenem half-even, alternativ half-up 0,01. Keine gesetzliche Aussage |
| F28b | nur Jan; B 0,01 €, Rate 0, Aktien J50 | End 0,015 → **0,02 €**, Ertrag 0,005→0,00; sichtbarer Rundungsausgleich **+0,01 €**, nicht als Gebühr oder Zulage ausweisen |
| F29 | Zulagenereignis aus externem Kern mit 60,005 € statt ganzen Cents bzw. Status review_required | Keine Buchung 60,00/60,01; externes Review bleibt erhalten. Subcent als Eingabe: invalid_input, externer ungeklärter Anspruch: review_required |
| F30 | nur Jan; zwei Z 120 mit gleichem grantKey, eines Hypothese/eines Ist | **invalid_input/duplicate_identity**, kein End 240. Neue Request-Version darf die Hypothese durch Ist ersetzen: End 120 |
| F31 | Jan–Dez; B 1.000 €, Rate 0; Aktien R −0,999999 | End intern 1.000×0,000001 =0,001 €; Anzeige **0,00 €**, intern positiv. Kein Runden zu R −1, kein Kapitalgarantieversprechen |
| F32 | Jan–Dez; B 1.000 €, Rate 0; Aktien R 100 | Jahresfaktor 101: **101.000,00 €**, extrem, aber innerhalb vorgeschlagener Domäne. Keine automatische Plausibilitätskappung; sichtbare Hypothese |
| F33 | nur Jan; B 90.071.992.547.409,91 €, Rate 0, R 0 | End **90.071.992.547.409,91 €**, exakt durch Cent-Ganzzahl. Ein weiterer Cent Eigenbeitrag überschreitet Ergebnisdomäne: review_required, kein abgeschnittener Endwert |
| F34 | nur Jan; B 1.000 €, E 100, Einmal 50, Z20 für 2026 tatsächlich Jan 2027; q 0,5, beide R=J1; Stress −0,30; Kosten C1, feste Kosten 5 | Rendite 10; Aktien 505, Stress 151,50; V 858,50; laufende Kosten 8,585; Gesamtkosten 13,585; End **1.014,915 €**, Anzeige **1.014,92 €**. Exakte Bilanz 1.000+10−151,50−13,585+100+50+20=1.014,915. Eigen 150, Zulage 20, Kosten 13,585; keine Vermischung |
| F35 | Jan–Feb; B 1.000 €, E 0, q 0, R 0; effektive Kosten 0 Jan,0,113615128283870719341199 ab Feb; feste Kosten 0 | Jan 1.000; Feb 1.000×0,99 = **990,00 €**; Kosten 10. Satzwechsel wirkt nicht rückwirkend |
| F36 | Dez 2027–Feb 2028; E 100, R 0/K 0 | Je 1/2 Beiträge in 2027/2028, Summe **300,00 €**; Monate Dez/Jan/Feb. Kein Jahresbeitrag 1.200 und kein zusätzlicher März |
| F37 | nur Dez 9999; B 1.000 €, E 0, R 0 | Ein Monat **1.000,00 €**, keine Erzeugung Januar 10000. Start 0100-01 bis 9999-12 mit B 0/E 0: 118.800 berechnete Monate; Ausgabe compact nach Abschnitt 13, End 0 bei vollständiger Nullannahme |

### 7.6 Kontrolliert abzulehnende Eingaben

Die jeweils nicht genannten Felder entsprechen B. „Kein Wert“ bedeutet kein betroffener Endbetrag und insbesondere keine 0-Ersatzberechnung.

| Fall | Konkrete Eingabe | Sollstatus / Wirkung |
|---|---|---|
| N01 | `initialCents=-1`, `-0`, `0.5`, `NaN`, `Infinity`, `"100"` | invalid_input; nicht korrigieren. NaN/Infinity sind als kanonische JSON-Zahlen ohnehin unzulässig; primitive Objekt-/Zahleingabe schon an Typgrenze ablehnen |
| N02 | Jahr 0099 oder 10000; Monat 00/13; Start 2027-12, Ende 2027-11; Tagesdatum 2027-10-28 | invalid_input. Teilmonatswunsch nur mit gesonderter Klärung; keine automatische Monatsumwandlung |
| N03 | `initialCents=9007199254740992`; Rategrößen überGeldgrenze; RateR 1000000,0001 | invalid_input; Grenze/Typ kontrolliert, kein clamp. Als DezimalstringR oberhalb Grenze ebenfalls invalid |
| N04 | R −1,01; Quote−0,01/1,01; Stress −1,01 oder+0,01; laufende Kosten−0,01/1,01 | invalid_input. R −1 undKosten 1 separatReview, keine mathematisch beliebige Zeitinterpretation |
| N05 | fehlender Start-Quotensatz oder Kostenmodus; `coverage=unknown` bei verlangtem gefördertemGesamtendwert | review_required bei fachlich unbekannter Grundlage; fehlende strukturell erforderliche Felderinvalid_input. Kein Defaultq 0/Nullkosten/Nullzulage |
| N06 | zwei Beitragswechsel Nov 2027, beide 100/200; doppelte Event-ID; gleicher SourceBookingRef | invalid_input; keine Sortierpriorität „letzter gewinnt“ |
| N07 | Eigenbeitrag vor Start oder nach Ende; Stress außerhalb Horizont; Beitragswechsel ohne Monat | invalid_input. Explizite Z/Kosten nach Ende nur nach 4.1 separat aussondern |
| N08 | Kostenmodus net_return zusammen mit c 0,01 oder fester Gebühr 5 | invalid_input/invalid_shape; keine Doppelbelastung |
| N09 | B 1 €, feste Bestandskosten 2 €, E 100 €amMonatsende | review_required/insufficient_fee_basis; weder 0 noch 99 €als Endwert |
| N10 | beliebiges Objekt mit Getter; Proxy mit get-/ownKeys-/getPrototypeOf-Trap; boxed String; Funktion | invalid_input an primitiverTextgrenze; **0 Getter-/Trapaufrufe**, kein stringify. Konkrete spätereRegression muss Zähler 0 nachweisen; in Stufe 1 nicht als ausgeführt behauptet |
| N11 | JSON mit doppeltem Schlüssel, unbekannten Feldern/Symbolersatz, `__proto__`, Exponentialbetrag, nichtkanonischem Whitespace, verschachteltem falschem Typ | invalid_input; keine stille Normalisierung. „Proxy alsJSON“ ist kein echter Proxy und darf nicht als solcher bezeichnet werden |
| N12 | Request größer 16 MiB oder mehr 10.000 fachliche Einträge | resource_error/input_bytes_limit bzw. entry_limit nach Abschnitt 13; keine Teilverarbeitung. Die frühere V0.1-Klassifikation invalid_input ist hier gezielt ersetzt. |
| N13 | Gültige Parameter, deren Rechenintervall eine Cententscheidungsgrenze überlappt | review_required/precision_ambiguous; kein geratener Cent. Die bloße Nähe einer Jahresrendite zu −1 reicht hierfür nicht aus. |
| N14 | F33-Grenzbestand plus 1 Cent oder gültige hohe R über lange Laufzeit | review_required/numeric_domain_exceeded; kein Infinity, kein saturierter Endwert |
| N15 | AVD-Referenz unterschiedliche Monatsbeiträge 100/101 € oder anderer Anfangsbestand | comparison review_required/basis_mismatch; einzelne abgegrenzte Projektionen ggf. modellierbar, keine gemeinsame Fairnessbehauptung |
| N16 | Unbekannte Modellversion, fehlendes Quellenversionsfeld oder fehlende notwendige Binding | Wohlgeformte andere Version: review_required/version_not_supported; fehlendes Pflichtfeld: invalid_input/invalid_shape; fehlende Binding bei sonst gültiger Struktur: review_required/evidence_required. |
| N17 | Kostenrate genau1; echte TER ohne definierte Bestandsminderung; Beitragskosten/Tranchen ohne Vertrag | review_required mit cost_rate_total_loss_timing_required bzw. cost_type_not_supported; keine Nullkosteninterpretation. Negative Zulagen sind dagegen invalid_input/invalid_value. |

### 7.7 Noch erforderliche Testeigenschaften nach Freigabe

Zusätzlich zu den konkreten Sollwerten: Deep-Freeze der vertrauenswürdigen internen DTOs bzw. unveränderte Eingabestrings; keine Systemzeit-/Locale-/Reihenfolgenabhängigkeit; identische wiederholte und browser-/Node-seitige Ergebnisse; exakte Cashflow-Summen; jede Monatsbilanz und Jahres-/Gesamtbilanz; keine verlorenen Nach-Ende-Ereignisse; Schaltjahr-/Jahreswechsel ohne Tageszins; q 0/0,5/1; Stress im ersten/letzten Monat; Monatsrendite-/Kostenfaktor-Identitäten; präzise Nachbarwerte um Halbcent und Geldgrenzen. Inputpermutation muss entweder denselben kanonischen Inhalt liefern oder explizit als nichtkanonisch abgelehnt werden, niemals andere Zahlen.

Bei `net_return` keine erfundene Kostenbilanz; bei `gross_only` keine implizite Nettobilanz. Für getrennte Szenarien identische Algorithmusnachweise und getrennte Quellenstatus. Kalendermaximaltest innerhalb unveränderterRunnergrenzen sinnvoll segmentieren, ohne Assertions oder Gates auszulassen. Begrenzungen/Präzisionsstopps gehören in den Vertrag und dürfen nicht erst nach einem roten Test erfunden werden.

## 8. Ausgangs-Bytes und spätere Regressionsgates

Die vom festen main-Commit gelesenen Inhalte der folgenden Dateien wurden lokal als UTF-8 gehasht. Für alle 11 erfassten Baseline-Dateien stimmt der aus `blob <Bytelänge>\0<Bytes>` berechnete Git-Blob-SHA mit dem GitHub-Blob überein. Das ist ein Integritätsnachweis der **gelesenen Ausgangsbytes**, noch kein Nachweis eines späteren Implementierungsdiffs.

| Schutzdatei | Git-Blob am Ausgangsstand | SHA-256 |
|---|---|---|
| direct-grant-contract.ts | `aae86667b798e24a26491eb8be7f05afad41bae0` | `e89c2dbd012b2fcbc0b94a978792da6a2bf7a2188d30978d6b5fdaed3b39faa1` |
| direct-grant-rules.ts | `0c8f0bbf0b96c1bfd97814ca56d71fb125ca0fce` | `1b12eecef27d6cd5aac782d15fb6dcd45791316c8b90c91d972a9b7d56dddc53` |
| direct-grant.ts | `a28ab513c0676d1724a4c861f7b500ee453fe277` | `5b7c57d4a00d2780a27798e8aa471ee6aae8ecd2a1f3aefea23c2aa2bfff1ed2` |
| old-riester-grant-contract.ts | `0b06926a8bb357680fd6a124321696b736b5eb54` | `a0c951bbcafa3dee396ef4c362e1ba837ef9f24c1cc6d2874a1f58adbf26b263` |
| old-riester-grant-rules.ts | `0417825d39d8a7a6d0c52f9e5fe3cb0e8b53cdb8` | `ddc956c37b86f526ff8cffcc3edf23532c76e207d6d69428e91e580a12811a4c` |
| old-riester-grant.ts | `e31c4ffabb2192c4407a457f5163c591ab00124c` | `8ec9ec7e1e857dc36a8d8995168504b54e6be0f91ad6ac373962e7e394aa6a2d` |
| retirement-entry.tsx | `b9c89e5fd80961fb5463c289917ccc967c58767a` | `bdbeef8bf6b2373d62909ae14b9247d08dca782c105fe85c4e29f8c554477fe6` |
| package.json | `94ba9dc357b98331912755f80f66f8bc3fbec58c` | `127938399b8526a4bd8482afe14d160fdad04aa0f7240da477f8685201955f07` |
| .github/workflows/ci.yml | `27fbde43b0d754ad496c436b0b5e7e08d9581a7b` | `1ed631815b2be2e3c795a8a1134e1aff133131f5e651367e1de3d4ab35aa8a80` |
| tsconfig.github.json | `ebe725b1b5acce0484d0491efb4243302401a231` | `91b9af86835c2c811d08098f558a9d885d9ed82542e0cb3882ba25ead07caeae` |
| playwright.config.ts | `112d94a83fbd34a8b08efe3f303eb91aad86c8ec` | `f9cde2f2b8e8145bd060abaf324863a504cdfad01820ae76f4ae0a429e032d65` |

Die sechs Förderdateien liegen unter `app/domain/retirement/`, RetirementEntry unter `app/presentation/retirement/`. Bei veränderter Base vor Stufe 2 muss eine neue Baseline erstellt und jeder fachliche Unterschied bewertet werden; diese Hashes sind nicht zeitlos.

Nach dokumentiertem Gate-GO verbindlich, hier **nicht ausgeführt**:

1. Neue Sollfälle und systematische Präzisions-/Negativprüfungen tatsächlich über reguläre CI erfasst, keine generierten Sollwerte aus dem Prüfling.
2. Vollständiges unverändertes `npm run verify`, echte A1/A2/B1/B2-Pfade, allgemeine Speicherung, Import/Export/XLSX/Druck und Verlustschutz; Typecheck, genau ein regulärer Build, Browser ohne Testskips oder abgeschwächte Konfiguration.
3. R1-Artefaktvalidator auf denselben Buildbytes, Operationaltests und Diffcheck; keine neue Artefaktproduktion zwischen Prüfung und Nachweis.
4. Bytegleichheit aller bestehenden Förderkern-Dateien und sonstigen geschützten Dateien zum unmittelbar vor Umsetzung bestätigten Ausgangsstand; ausschließlich erlaubte neue Dateien im Diff.
5. Vollständige finale Push-CI auf dem tatsächlichen Feature-Head **und** PR-CI auf dem tatsächlichen synthetischen Mergecheckout. Originaljoblogs für Checkout-SHAs, Parents/Trees, Job-/Schrittstatus; Run-Metadaten nicht als Checkoutbeweis ersetzen.
6. Gleicher finaler Head und identisches vollständiges Paket für Projektleitung und unabhängigen Review. Work erklärt keinen eigenen GO. Kein Merge/Release/Deployment. PR #43/#60 unberührt.

Bei fehlenden vollständigen Originallogs: originale verfügbare Auszüge und API-Schrittstatus exakt benennen, Zugriffslücke sichtbar halten und am verbindlichen Gate stoppen. Keine Zugangsdaten von Leon anfordern. Die einmalige Abnahmeausnahme AP-05a/#64 gilt ausdrücklich nicht für AP-03a.


## 9. Verbleibende Entscheidungen und Empfehlung für V1.0

Empfohlen wird, K01–K26 mit den vier Präzisierungen als ein geschlossenes Paket zu bestätigen. Die folgenden normativen Definitionen beschreiben den vorgeschlagenen Inhalt der späteren Freigabe; sie sind kein Work-GO.

| Entscheidung | Empfehlung V0.2 | Alternative vor Einfrieren | Folge einer Alternative |
|---|---|---|---|
| D02-A Abdeckung | Ereignisse immer erhalten; none_assumed schließt nur zusätzliche Zulagen aus | none_assumed ausschließlich für leere Listen reservieren und einen vierten Modus ergänzen | Gleiche Mathematik, aber geänderter API-Vertrag und neue Fälle erforderlich |
| D02-B Langlauf | Volle Kalenderdomäne; Ausgabe- und Ressourcenvertrag nach Abschnitt 13 | Andere Detail-, Block-, Byte- oder Arbeitsgrenzen | Vorab neue Vertragsversion und Grenzfälle; keine implizite Laufzeitverkürzung |
| D02-C JSON/Ergebnis | Geschlossene Strukturen, primitive JSON-Grenze, feste Status- und Fehlerregeln | Objektüberladung oder andere Schemavarianten | Sicherheits-/Verbrauchervertrag neu prüfen; keine Wahl durch den Implementierer |
| D02-D Mai-Bezug | Kein Default; ausdrücklich gewählte Mai-Monatsillustration möglich | Mai als vorausgewählter neutraler Termin | Zusätzliche Fach-/UX-Entscheidung; keine tatsächliche Gutschriftzusage |

Die übrigen Alternativen in K01–K26 bleiben historisch nachvollziehbar. Die Freigabeempfehlung bezieht sich jeweils auf die bevorzugte Variante. Keine Alternative ist eine bereits spezifizierte zweite Laufzeitmathematik.

**Empfehlung:** V0.2 nach Prüfung der Auflagenerfüllung inhaltlich unverändert als **AP-03a/G-07-Rechenvertrag V1.0** einfrieren. Dabei Dokumenthash, Datum und Projektleiterentscheid binden. Die dafür reservierten vier API-Versions-IDs sind nachstehend bereits festgelegt. Bei Auswahl einer Alternative muss die Projektleitung zunächst eine vollständig nachgeführte Fassung prüfen. Ein Restentscheid mit materieller Wirkung darf nicht in Stufe 2 verschoben werden.

**Vertragsfreigabe und anschließende Implementierungsfreigabe bleiben zwei gesondert zu dokumentierende Entscheidungen. Stufe 2 bleibt HOLD.** Die organisatorisch unabhängige Bewertung der Auflagenerfüllung ist keine Work-Aufgabe.

## 10. Abgrenzung der erbrachten Arbeit

Erstellt wird ausschließlich diese externe Vertragsunterlage. Keine Implementierung, kein neuer Test, kein Branch, Commit, PR, Workflow, Merge, Release oder Deployment. Abschnitt 8 dokumentiert weiterhin die Ausgangsbytes; er behauptet keine neue technische Abnahme. Die aktuellen GitHub-Identitäten werden nur gelesen. Tatsächliche Dokumentkontrollen und der Abschlusscheckpoint stehen am Ende.

## 11. Änderungsübersicht gegenüber V0.1

| Bereich | Änderung V0.2 | Unverändert |
|---|---|---|
| Zulagen | Alle Coverage-Modi definiert; spezifizierte und vollständige Kennzahlen getrennt; F08/F10 präzisiert | Kein Anspruchskern, keine Wiederholung, keine Änderung von AP-01a/b |
| Langlauf | Rechen-/Ausgabedomäne getrennt; Detail-, Block-, Byte- und Arbeitsgrenzen vorab festgelegt | 0100–9999, maximal 118.800 Monate je Projektion, ein Monatsalgorithmus |
| JSON/Ergebnis | Geschlossene Pflichtfelder, Kombinationen, Quellen-/Versionsbindung, Serialisierung und Fehlerkatalog | Primitive Textgrenze, keine Getter-/Proxy-Normalisierung, kein Store/Schema/UI-Einbau |
| Recht | Q12 ergänzt; Mai-Rechenannahme von Zahlungsanweisung und Istgutschrift getrennt | Kein allgemeiner tatsächlicher Mai-/Juni-Termin; keine PIB-Konformitätsbehauptung |
| Fälle | F08/F10/F37/N05/N12 aktualisiert; F38–F44 und N18–N31 ergänzt | Übrige mathematische Sollwerte F01–F37 |
| Freigabe | Konkrete Empfehlung für V1.0 und ausdrücklich bezeichnete Alternativen | Work erteilt kein eigenes GO; Stufe 2 HOLD |

## 12. Vollständiger öffentlicher JSON- und Ergebnisvertrag

### 12.1 Notation, primitive Typen und Versionen

Die Definitionen sind Spezifikationsnotation in dieser Markdown-Datei, keine Implementierung. `A | B` bedeutet genau eine Variante; `T[]` eine dichte Liste. **Alle aufgeführten Felder sind Pflicht.** Null ist ausschließlich dort zulässig, wo der Typ ausdrücklich `null` enthält. Alle Objektformen sind geschlossen; unbekannte Schlüssel sind unzulässig. Es gibt keine Defaults.

| Typ | Vollständige Definition |
|---|---|
| Id | ASCII-String, 1–128 Zeichen; Muster `[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}`; ausschließlich opake technische Identitäten |
| SourceRef | 1–512 druckbare ASCII-Zeichen U+0020–U+007E, keine Rand-Leerzeichen; URL, Dokument-ID oder anderer Bezug; kein automatischer Abruf |
| Hash | `sha256:` und genau 64 kleine Hexzeichen |
| Year | JSON-Ganzzahl 100–9999 |
| Month | `YYYY-MM`, Jahr 0100–9999, Monat 01–12 |
| Date | Gültiger gregorianischer Tag `YYYY-MM-DD`, Jahre 0100–9999; keine Uhrzeit oder Zone |
| Cents | JSON-Ganzzahl 0–9007199254740991; kein −0, keine Subcents, kein String |
| SignedCents | Sichere JSON-Ganzzahl im Bereich ±9007199254740991; Ausgabe 0 statt −0 |
| UInt | Nichtnegative sichere JSON-Ganzzahl; zusätzliche Feldgrenzen unten |
| Decimal | Dezimalstring mit optionalem ASCII-Minus; ganzzahliger Teil 0 oder ohne führende Null; optional Punkt und 1–36 Nachkommastellen, letzte Ziffer 1–9. Kein −0, Plus, Komma, Exponent oder Leerraum |
| Rate | Decimal, numerisch −1 bis 1000000; genau −1 ist strukturell gültig, fachlich prüfpflichtig |
| Weight | Decimal, 0–1 |
| Shock | Decimal, −1–0 |
| CostRate | Decimal, 0–1; genau 1 ist fachlich prüfpflichtig |
| Pointer | JSON-Pointer zu bekannten Feldern des jeweiligen Kontexts; Index ohne führende Null. Binding-/Ausgabequellenpfade sind relativ zu ProjectionSpec, Fehlerpfade relativ zum vollständigen Request; Rootpfad ist der leere String |

`Versions={modelVersion:Id,inputContractVersion:Id,numericConventionVersion:Id,resultContractVersion:Id}`.

Reservierte Werte für die spätere unveränderte V1.0-Freigabe:

- modelVersion: `ap03a-model-v1.0`
- inputContractVersion: `ap03a-input-v1.0`
- numericConventionVersion: `ap03a-decimal36-v1.0`
- resultContractVersion: `ap03a-result-v1.0`

Andere wohlgeformte IDs: review_required/version_not_supported. Fehlende oder falsch typisierte Felder: invalid_input. Keine Auslegung als „latest“. Die Dokumentkennung `ap03a-g07-candidate-0.2` behauptet keine bereits implementierte Unterstützung dieser reservierten IDs. Externe Förderregelversionen sind unabhängig.

`Fact<T>` ist entweder `{state:"known",value:T}` oder `{state:"unknown",reason:R}`, wobei R genau missing, unconfirmed, conflicting oder unsupported ist. Unknown hat kein value-Feld. Known bedeutet explizit definiert; zusätzlich müssen die Quellen bereit sein.

### 12.2 Quellen und Bindungen

```text
Source = {
  sourceId: Id,
  kind: "official_rule" | "booking_evidence" | "contract_evidence"
      | "external_rule_result" | "model_assumption" | "technical_contract",
  quality: "confirmed" | "hypothetical" | "unconfirmed" | "conflicting",
  reference: SourceRef,
  version: Id,
  contentHash: Hash | null,
  checkedOn: Date | null,
  effectiveFromMonth: Month | null,
  effectiveToMonth: Month | null
}
Binding = {path: Pointer, sourceIds: Id[]}
BoundProjection = {parameters: ProjectionSpec, bindings: Binding[]}
```

Quellen-IDs sind global eindeutig und die Liste ist streng nach ID sortiert. Bei zwei Gültigkeitsmonaten muss das Ende mindestens dem Beginn entsprechen. Die Version ist ausdrücklich angegeben, nicht aus einem Abrufdatum abgeleitet. Ein contentHash ist eine mitgeführte Behauptung, keine durch AP-03a bestätigte Dokumentauthentisierung. Null ist nur für fehlenden Digest bzw. nicht anwendbare Datumsangaben erlaubt. Keine externen Abrufe.

Jede Binding verweist auf 1–8 eindeutige, sortierte vorhandene sourceIds. Binding-Pfade sind eindeutig und ASCII-sortiert. Exakt diese Pfade sind vorgeschrieben, relativ zu ProjectionSpec:

- `/period`, `/initial`, `/rebalancing`, `/grantCoverage`, `/stress`, `/costs`;
- je vorhandenem Element `/contributionSchedule/i`, `/oneOffContributions/i`, `/grantEvents/i`, `/marketSchedule/i`, `/allocationSchedule/i`;
- im Bruttokostenmodus außerdem `/costs/annualRates/i` und `/costs/fixedFees/i`.

Leere Listen erzeugen keine Elementpfade. Andere Pfade sind unzulässig. Eine Binding deckt sämtliche Felder des bezeichneten Parameters ab: Wert, Datum, Typ und Herkunft. Bei Kosten deckt die Elternbindung Modus/Vollständigkeit ab; Unterbindungen die konkreten Sätze/Gebühren. Der Binding-Pointer ist die deterministische Parameteridentität; es gibt kein zusätzliches öffentliches parameterId-Feld.

Fehlende notwendige Bindung: evidence_required. Unbekannte Quellen-ID: dangling_source; zusätzliche/doppelte Pfade: invalid_shape. Jede Quelle muss verwendet sein, sonst inconsistent_input. Der Vertrag erzeugt keinen Defaultbeleg.

Ein bekannter Parameter ist berechnungsbereit, wenn alle gebundenen Quellen confirmed oder ausdrücklich hypothetical sind. Unconfirmed/conflicting blockieren abhängige Kennzahlen mit evidence_required. Hypothetical ist genau dem Quellentyp model_assumption vorbehalten; model_assumption trägt umgekehrt ausschließlich diese Qualität. Die übrigen Typen erlauben confirmed, unconfirmed oder conflicting. Der Kern bestätigt nicht selbst die Wahrheit der Angaben.

Ist-Grants brauchen mindestens eine bestätigte booking_evidence-Quelle; externe Förderresultate eine bestätigte external_rule_result-Quelle; hypothetische Beträge eine model_assumption. Die Mai-Illustration braucht zusätzlich eine bestätigte official_rule-Quelle Q12 und eine model_assumption zur Monatsabstraktion. Null-Stress, Nullkosten und die Nullergänzung der Zulagen sind ebenfalls gebundene ausdrückliche Parameter.

### 12.3 Vollständige Eingabestrukturen

```text
ProjectionRequest = {
  kind: "projection",
  versions: Versions,
  output: OutputRequest,
  sources: Source[],
  projection: BoundProjection
}
ComparisonRequest = {
  kind: "comparison",
  versions: Versions,
  output: OutputRequest,
  sources: Source[],
  scenarios: Scenario[3]
}
Scenario = {scenarioId:Id, retirement:BoundProjection, reference:BoundProjection}
OutputRequest = {mode:"auto" | "detailed" | "compact"}

ProjectionSpec = {
  projectionId: Id,
  instrument: "retirement_model" | "unfunded_reference",
  period: {startMonth:Month, endMonth:Month},
  initial: {
    balanceCents:Fact<Cents>,
    valuationMonth:Month,
    position:"immediately_before_start"
  },
  rebalancing:"monthly_target_weight",
  contributionSchedule: ContributionChange[],
  oneOffContributions: OwnEvent[],
  grantCoverage: GrantCoverage,
  grantEvents: GrantEvent[],
  marketSchedule: MarketChange[],
  allocationSchedule: AllocationChange[],
  stress: StressEvent | null,
  costs: Costs
}
ContributionChange = {fromMonth:Month, monthlyCents:Fact<Cents>}
OwnEvent = {eventId:Id, month:Month, cents:Cents}
MarketChange = {
  fromMonth:Month,
  equityAnnualReturn:Fact<Rate>,
  bondAnnualReturn:Fact<Rate>
}
AllocationChange = {fromMonth:Month, equityWeight:Fact<Weight>}
StressEvent = {month:Month, equityShock:Fact<Shock>}
GrantCoverage = {
  mode:"complete_events" | "none_assumed" | "unknown",
  unresolvedContributionYears:Year[]
}
GrantKey = {
  personId:Id,
  contractId:Id,
  contributionYear:Year,
  component:"base" | "child" | "bonus" | "aggregate",
  childId:Id | null
}
ExternalRule = {ruleId:Id, ruleVersion:Id, resultStatus:"calculated"}
GrantEvent = {
  eventId:Id,
  grantKey:GrantKey,
  cents:Cents,
  amountBasis:"actual_booking_confirmed" | "external_rule_result" | "hypothetical_amount",
  externalRule:ExternalRule | null,
  sourceBookingRef:Id | null,
  booking:{
    basis:"actual_date_confirmed" | "hypothetical_month_end"
         | "pib_may15_month_end_illustration",
    month:Month,
    referenceDate:Date | null
  }
}
Costs = GrossCosts | NetCosts | GrossOnlyCosts
GrossCosts = {
  mode:"gross_plus_explicit_costs",
  coverage:"complete" | "unknown" | "effective_cost_only" | "unsupported_type",
  annualRates:CostChange[],
  fixedFees:FeeEvent[]
}
CostChange = {fromMonth:Month, effectiveAnnualReduction:Fact<CostRate>}
FeeEvent = {eventId:Id, month:Month, cents:Cents, sourceBookingRef:Id | null}
NetCosts = {
  mode:"net_return",
  coverage:"all_costs_included" | "unconfirmed"
}
GrossOnlyCosts = {mode:"gross_only", costKnowledge:"not_assessed" | "unknown"}
```

Dies sind sämtliche Eingabefelder. Insbesondere keine Felder für Systemzeit, Steuern, Entnahmen, Auszahlung, Tarife, Garantie, Wiederholungszulagen, freie Formeln, Callback, Normalisierung oder Erweiterungsmaps.

Verbindliche Querverträge:

1. Ende mindestens Start; valuationMonth gleich Start. Anfangsbestand vor Monatsbeginn, keine Tageswert-Konversion.
2. Beitrags-, Markt- und Quotenschedule jeweils mindestens eine Startzeile; danach streng chronologisch innerhalb des Horizonts. Nullrate ausdrücklich known/0. Unknown-Facts sind zulässig, sperren aber die abhängige Rechnung. Eine fehlende Startzeile ist invalid_shape.
3. Events sind nach Monat und ID sortiert; Grant-Monat ist booking.month. Event-IDs je Projektion über Eigen-, Grant- und Gebührenereignisse eindeutig. Nichtnull-Buchungsreferenzen über Grant-/Gebührenlisten ebenfalls eindeutig. Keine Deduplizierung. Alternative Vergleichsprojektionen dürfen bewusst dieselben Buchungsbezüge verwenden.
4. Eigen-Einmalzahlungen und Stress innerhalb des Horizonts; keine Events vor Start. Grants/feste Gebühren nach Ende bleiben als ausgeschlossene Ereignisse erhalten. Auch diese Datumswerte bleiben innerhalb 0100–9999.
5. childId ist genau dann nichtnull, wenn component=child. Identische vollständige GrantKeys sind verboten. Aggregate plus Teilkomponenten derselben Person/Vertrag/Jahr ebenfalls verboten. Ist ersetzt Hypothese in einer neuen Anfrage, keine additive Korrektur. Keine materiell-rechtliche Mehrvertragsprüfung.
6. complete_events/none_assumed haben keine offenen Jahre; unknown hat mindestens ein sortiertes eindeutiges offenes Beitragsjahr. Auch ein früheres Beitragsjahr ist zulässig, wenn dessen ungeklärter Zufluss in den Horizont fallen könnte. Die Jahresliste erzeugt keine Zahlungen.
7. Geldereignisse mit 0 Cent bleiben explizite Nullereignisse; negativ/Subcent ungültig. Ein extern gesperrter Förderwert wird als ungeklärte Abdeckung/Quelle geführt, niemals zu einem Grant auf Cent geschätzt. Ein reiner externer Halbcent wird nicht durch AP-03a neu gerundet.
8. GrossCosts mit complete verlangt mindestens einen bekannten Startsatz, vollständig bekannte Sätze und bestätigte/hypothetisch vollständige Abgrenzung. Complete plus Unknown-Fact ist inconsistent_input. Bei anderer Coverage darf annualRates leer sein; der Nachkostenpfad ist dann gesperrt. NetCosts erlaubt keine zusätzlichen Gebührenfelder. Unconfirmed-Nettoabgrenzung sperrt die Trajektorie. GrossOnly bleibt ausdrücklich vor Kosten.
9. Rate −1 und CostRate 1 führen zu den bezeichneten Review-Fällen. Außerhalb der Wertbereiche: invalid_value. Auch ein mit Gewicht 0 versehener Baustein muss gültig und evidenzbereit sein; keine Validierungsumgehung.
10. Einzelanfragen dürfen beide Instrumentarten verwenden. In Comparison: retirement_model auf der retirement-Seite und unfunded_reference auf der reference-Seite. Referenz mit none_assumed, leerer Grantliste und ohne offene Jahre. Drei scenarioIds eindeutig/sortiert, sechs projectionIds global eindeutig. Zeitraum, Anfangswert und sämtliche Eigenbeitragszeitpunkte/-beträge über alle sechs Alternativen identisch; andernfalls nur der Vergleich basis_mismatch. Unbekannte Basiswerte erlauben keine Gleichheitsbehauptung.

Zulässige Grant-Kombinationen:

| amountBasis | externalRule | booking.basis | referenceDate / sourceBookingRef |
|---|---|---|---|
| actual_booking_confirmed | null | actual_date_confirmed | Bestätigtes Datum im Buchungsmonat; Buchungsref nichtnull |
| external_rule_result | Nichtnull, calculated mit fester Regel-/Versions-ID | hypothetical_month_end oder pib_may15_month_end_illustration | Freier Termin: Datum null; Mai-Illustration: 15.05. des Folgejahrs; Buchungsref null |
| hypothetical_amount | null | dieselben zwei hypothetischen Zeitmodi | wie vorige Zeile; kein Istbeleg |

Andere Kombinationen: inconsistent_input. Bei Mai-Illustration muss das Folgejahr innerhalb der Kalenderdomäne liegen, booking.month exakt dessen Mai und referenceDate dessen 15. Mai sein. Intern wird am Monatsende gebucht. Das Datum wird nicht automatisch aus dem Förderjahr ergänzt. Eine echte Mai-Buchung kann denselben Monat treffen, hat aber andere Herkunft. Der Enum bestätigt keine taggenaue PIB-Konformität.

### 12.4 Kanonische Serialisierung und Hashbindung

Die jeweilige öffentliche Funktion erwartet ausschließlich einen primitiven String mit passendem kind. Nichtstring wird vor jeder Strukturabfrage oder Konversion abgewiesen. Keine Entpackung eines Stringobjekts und kein stringify auf einem fremden Objekt; dadurch 0 Getter-/Proxy-Zugriffe an dieser Grenze.

Kanonische Regeln:

1. UTF-8 ohne BOM, nur gültige Unicode-Skalarwerte. Keine isolierten Surrogates, keine rohen Steuerzeichen. Objektkeys sind bekannte ASCII-Namen, streng nach Codewert sortiert.
2. Kein Whitespace außerhalb von Strings, kein End-Newline, keine doppelten Keys. Genau die geschlossene Feldliste; null nur, wo definiert.
3. Zahlen ausschließlich kanonische Ganzzahlen: kein Exponent, Dezimalpunkt, −0 oder führende Null. Dezimalparameter sind Strings nach Decimal. Booleans nur an den im Ergebnisschema bezeichneten Stellen.
4. Stringescaping: Quote/Backslash als `\"`/`\\`; Steuerzeichen als `\u00xx` mit kleinen Hexziffern, alle übrigen Zeichen direkt. Keine unnötigen Unicode-/Slashescapes. Die Eingabefeldtypen erlauben ohnehin keine Steuerzeichen.
5. Arrayfolgen wie fachlich festgelegt: Schedules chronologisch, Events nach Monat/ID, Szenarien/Quellen/Bindings nach ID/Pointer, offene Jahre aufsteigend. Keine Reparatursortierung.
6. Parse ohne Reviver; danach Strukturprüfung. Kanonische Rekonstruktion aus eigenen Daten muss den Eingabetext exakt reproduzieren. Andernfalls noncanonical_json; auch doppelte Schlüssel erhalten diesen Code, soweit keine vorrangige Strukturverletzung vorliegt. Keine plattformspezifischen Parserfehlertexte.

Das ist der eigene AP-03a-Vertrag, keine ungeprüfte RFC-8785/JCS-Konformitätsbehauptung. SHA-256 wird über die exakten kanonischen UTF-8-Requestbytes gebildet. requestHash erst nach erfolgreicher Struktur-/Kanonizitätsprüfung; davor null. Der Digest ersetzt keine bewahrte Eingabe. Spätere Verbraucher müssen den kanonischen Request samt Quellen/Versionen behalten; AP-03a persistiert nichts.

Ausgaben folgen derselben Schlüssel-/String-/Integerkonvention und den unten festgelegten Listenfolgen. Kein Zeitstempel, Zufall, Exceptiontext oder Stacktrace. Identische Eingabebytes und Versionen ergeben identische Ergebnisbytes einschließlich kontrollierter Fehler. Unterschiedliche OutputRequests haben unterschiedliche Hashes, aber identische mathematische Kennzahlen, soweit sie berechenbar sind.

### 12.5 Vollständige Ergebnisstrukturen

```text
Issue = {code:IssueCode, path:Pointer, month:Month | null}
Interval = {lowerEuro:Decimal, upperEuro:Decimal}
FactorInterval = {lower:Decimal, upper:Decimal}
MoneyValue = {
  status:"regelbasiert" | "bestaetigte_eingabe" | "modelliert_unter_annahmen",
  interval:Interval,
  displayCents:SignedCents
}
MoneyBlocked = {status:"review_required", issue:Issue}
MoneyNA = {status:"not_applicable", reason:"not_computed_in_selected_cost_mode"}
MoneyMetric = MoneyValue | MoneyBlocked | MoneyNA

FlowTotals = {
  regularOwn:MoneyMetric,
  oneOffOwn:MoneyMetric,
  totalOwn:MoneyMetric,
  specifiedAllowances:MoneyMetric,
  marketResult:MoneyMetric,
  stressLoss:MoneyMetric,
  explicitRunningCosts:MoneyMetric,
  explicitFixedCosts:MoneyMetric,
  totalCostAmount:MoneyMetric,
  deductionInThisCalculation:MoneyMetric
}
BalanceCheck = {identity:"opening_plus_flows",residualInterval:Interval,status:"interval_consistent"}
Summary = {
  initialBalance:MoneyMetric,
  totals:FlowTotals,
  completeAllowanceInflow:MoneyMetric,
  specifiedEndBalance:MoneyMetric,
  completeEndBalance:MoneyMetric,
  beforeCostEndBalance:MoneyMetric,
  afterCostEndBalance:MoneyMetric,
  displayRoundingResidual:MoneyMetric,
  balanceCheck:BalanceCheck | null
}
MonthRow = {
  month:Month,
  index:UInt,
  openingBalance:MoneyMetric,
  equityWeight:Decimal,
  bondWeight:Decimal,
  equityOpening:MoneyMetric,
  bondOpening:MoneyMetric,
  equityFactor:FactorInterval,
  bondFactor:FactorInterval,
  stressApplied:boolean,
  stressedEquityBasis:MoneyMetric,
  totals:FlowTotals,
  closingBalance:MoneyMetric,
  displayRoundingResidual:MoneyMetric,
  balanceCheck:BalanceCheck,
  appliedSourcePaths:Pointer[],
  ownEventIds:Id[],
  grantEventIds:Id[],
  feeEventIds:Id[]
}
BlockRow = {
  startMonth:Month,
  endMonth:Month,
  monthCount:UInt,
  openingBalance:MoneyMetric,
  closingBalance:MoneyMetric,
  totals:FlowTotals,
  displayRoundingResidual:MoneyMetric,
  balanceCheck:BalanceCheck,
  appliedSourcePaths:Pointer[],
  ownEventIds:Id[],
  grantEventIds:Id[],
  feeEventIds:Id[]
}
ExcludedEvent = {
  eventType:"grant" | "fixed_fee",
  eventId:Id,
  month:Month,
  cents:Cents,
  reason:"after_end_not_booked"
}
ProjectionResult = {
  projectionId:Id,
  instrument:"retirement_model" | "unfunded_reference",
  status:"calculated" | "partial" | "review_required",
  period:{startMonth:Month,endMonth:Month,monthCount:UInt},
  valueBasis:"before_costs" | "after_explicit_costs" | "after_included_costs",
  returnBasis:"gross_before_costs" | "net_of_included_costs",
  allowanceCoverage:"complete_events" | "none_assumed" | "unknown",
  unresolvedContributionYears:Year[],
  summary:Summary,
  ledger:DetailedLedger | CompactLedger | null,
  excludedEvents:ExcludedEvent[],
  primaryIssue:Issue | null
}
DetailedLedger = {mode:"detailed",rows:MonthRow[]}
CompactLedger = {mode:"compact",blockSizeMonths:UInt,blocks:BlockRow[]}
ScenarioComparison = {
  scenarioId:Id,
  retirementProjectionId:Id,
  referenceProjectionId:Id,
  status:"calculated" | "partial" | "review_required",
  basis:"same_own_cashflows",
  completeDifference:MoneyMetric,
  specifiedDifference:MoneyMetric,
  primaryIssue:Issue | null
}
SourceManifestItem = {sourceId:Id,version:Id,contentHash:Hash | null}
Response = {
  operation:"projection" | "comparison" | null,
  status:"calculated" | "partial" | "review_required" | "invalid_input" | "resource_error",
  supportedVersions:Versions,
  requestedVersions:Versions | null,
  requestHash:Hash | null,
  sourceManifest:SourceManifestItem[],
  projectionResults:ProjectionResult[],
  comparisonResults:ScenarioComparison[],
  primaryIssue:Issue | null
}
```

Weitere Ergebnisfelder sind ausgeschlossen. UInt bei Monatsanzahlen 1–118800, MonthRow.index 0–118799, Blockgröße 1–118800. MoneyValue hat nie gleichzeitig ein Issue; MoneyBlocked hat keinen Betrag/Intervall. Keine 0-, NaN- oder undefined-Ersatzwerte.

Intervalle sind geordnet. Bestände, Einzahlungen, Kosten und Stressverluste nichtnegativ; Ertrag, Differenz und Anzeigeausgleich dürfen negativ sein. Jede ausgegebene Geldkomponente braucht einen eindeutigen Cent. Regelbasiert ist nur für reine, ausreichend bestätigte externe Förderwertsummen zulässig; nie für Kapital, Rendite, Stress oder eine zukünftige Monatsentwicklung. Bestaetigte_eingabe bedeutet direkte bestätigte Angaben/exakte Summen, keine Prognose.

appliedSourcePaths enthält die sortierten tatsächlich wirksamen Binding-Pfade. Ein Block enthält deren Vereinigung. Event-IDs bleiben zeitlich und danach nach ID geordnet und enthalten nur dort gebuchte Ereignisse. ExcludedEvents nach Monat, Eventtyp, ID sortiert. Nach-Ende-Ereignisse werden nicht erneut in Monats-/Blocksummen gezählt. GrantKey/Buchungsref bleiben über Request und Hash nachvollziehbar; kein zusätzliches Kundendatenecho.



balanceCheck ist bei berechneter Trajektorie in Summary und jeder Monats-/Blockzeile vorhanden, bei gesperrter Trajektorie in Summary null. residualInterval ist das nach außen begrenzte Intervall von Endbestand minus Anfangsbestand minus Ertrag plus Stress plus Methodenabzug minus Eigenbeiträge minus spezifizierte Zulagen, genau in dieser Reihenfolge. Es muss 0 enthalten und erhält dann interval_consistent. Das ist eine Konsistenzprüfung der ausgewiesenen Intervalle, kein Ersatz für die algebraische Identität oder unabhängige Sollfälle. Ein Intervall, das 0 ausschließt, ist ein Implementierungsdefekt und darf nicht mit einem fingierten erfolgreichen Bilanzstatus ausgegeben werden.

### 12.6 Status- und Kennzahlmatrix

| Voraussetzung | specifiedEndBalance | completeEndBalance / vollständiger Zufluss | Projektion |
|---|---|---|---|
| Trajektorie bereit, complete_events oder none_assumed | Wert einschließlich aller expliziten Ereignisse | Wert, identisch zur spezifizierten Modellrechnung | calculated; primaryIssue null |
| Trajektorie bereit, unknown | Wert einschließlich aller expliziten Ereignisse, ausschließlich Teilszenario | review_required/allowance_coverage_unknown ohne Betrag | partial; Ledger bleibt verfügbar |
| Anfangswert/Rendite/Quote/Stress/Kostenbasis unklar oder Arithmetikstopp | gesperrt | gesperrt | review_required; ledger null, kein Prefix |
| Global ungültiger Request | keine Ergebnisobjekte | keine | invalid_input |
| Ressourcenstopp | keine Ergebnisobjekte | keine | resource_error, keine Kürzung |

Unabhängige valide Eingabesummen dürfen trotz gesperrter Trajektorie verfügbar bleiben. Eine unbekannte Monatsrate sperrt dagegen auch ihre Beitragssumme. Bei unknown bleibt totals.specifiedAllowances verfügbar; completeAllowanceInflow ist gesperrt. Bei vollständiger Abdeckung umfasst letzterer nur tatsächlich im Horizont modellierte Grants, keine Nach-Ende-Ereignisse oder erfundenen Folgejahre.

| Kostenmodus | valueBasis / returnBasis | Kosteninformation | Endkennzahlen |
|---|---|---|---|
| gross_only | before_costs / gross_before_costs | explizite Kostenfelder not_applicable; totalCostAmount gesperrt mit cost_source_unknown; deductionInThisCalculation=0 ausschließlich als Methodenabzug | beforeCostEndBalance=completeEndBalance; afterCostEndBalance gesperrt |
| gross_plus_explicit_costs, vollständig | after_explicit_costs / gross_before_costs | explizite Kosten und Gesamtabzug berechenbar | afterCostEndBalance=completeEndBalance; beforeCostEndBalance not_applicable, keine zweite Bruttosimulation |
| net_return, all_costs_included | after_included_costs / net_of_included_costs | explizite Kostenfelder not_applicable; totalCostAmount gesperrt mit included_cost_amount_unknown; Methodenabzug 0, enthaltene Kosten bereits im Ertrag | afterCostEndBalance=completeEndBalance; beforeCostEndBalance not_applicable |

Unknown-Coverage sperrt auch die betreffenden vollständigen Vor-/Nachkostenendwerte. Erwartete Nichtbestimmbarkeit einer Kostenkennzahl verändert einen ansonsten vollständig definierten Hauptendwert nicht zu einem globalen Review. Status je Kennzahl ist verbindlich; Methodenabzug 0 ist niemals die Aussage „reale Kosten 0“.

Qualität einer reinen Eingabesumme: mindestens eine Hypothese in Summanden oder relevanter Zeit-/Vollständigkeitsbasis → modelliert_unter_annahmen. Sonst ausschließlich bestätigte Istbeträge → bestaetigte_eingabe. Sonst ausschließlich vollständig bestätigte externe Regelbeträge → regelbasiert. Gemischte Ist-/Regel-/Planbasis → modelliert_unter_annahmen. Bei leerer Liste entscheidet deren explizite Quellen-/Coveragebindung; fehlende Liste ist ungültig. Jede Trajektorie und daraus abgeleitete Geldgröße bleibt modelliert.

Vergleiche brauchen identische Eigenbeitragsbasis sowie dieselbe Kostenstufe: beide vor Kosten oder beide nach den vollständig modellierten Kosten. Unterschiedliche klar abgegrenzte Nachkostenpfade sind zulässig; Vor- gegen Nachkosten ist basis_mismatch. Einzelprojektionen bleiben dabei unabhängig verfügbar. completeDifference nur bei zwei verfügbaren vollständigen Endwerten; specifiedDifference ist separat als spezifizierter Cashflowvergleich möglich und ersetzt niemals eine gesperrte vollständige Differenz. Keine Nachsteuerkennzahlen oder Rangliste.

ProjectionResult.status ist calculated bei bereiter Trajektorie und vollständiger Modellabdeckung, partial bei bereiter Trajektorie mit unknown-Coverage, sonst review_required. primaryIssue bei partial ist allowance_coverage_unknown, bei Review der erste einschlägige Fehler nach 12.7. Vergleichstatus calculated bei vollständiger vergleichbarer Differenz, partial bei nur spezifizierter vergleichbarer Differenz, sonst review_required.

Response.status ist calculated, wenn alle erforderlichen Projektionen/Vergleiche calculated sind; partial, wenn mindestens eine Trajektorie berechenbar ist, aber nicht alle vollständigen Ergebnisse vorliegen; sonst review_required. Ein globaler Versionsstopp hat review_required ohne Resultate. Invalid-/Ressourcenfehler haben leere Resultatlisten. Einzelanfrage: genau ein ProjectionResult, comparisonResults leer. Comparison: sechs ProjectionResults, je scenarioId retirement vor reference, und drei Vergleiche in derselben Szenarioreihenfolge. Gesperrte Teilprojektionen werden nicht weggelassen.



Zusätzliche Ergebnisinvarianten: stressApplied ist genau im konfigurierten Ereignismonat true, auch bei Aktiengewicht 0; stressedEquityBasis ist dann der Aktienbestand nach Rendite, sonst explizit 0. Ohne Stress ist stressLoss 0. equityWeight und bondWeight sind die im Monat wirksamen Gewichte und ergeben exakt 1. FactorInterval enthält dieselben Wurzelgrenzen, die intern verwendet wurden.

In jeder verfügbaren Ledgerzeile sind `/period`, `/initial`, `/rebalancing`, `/grantCoverage`, `/stress` und `/costs` sowie die jeweils wirksamen Beitrags-/Markt-/Quotensätze und gebuchten Event-/Kostensatzpfade in appliedSourcePaths enthalten; Blockzeilen vereinigen diese Pfade. Die Referenzen sind eindeutig und sortiert.

Bei gesperrter Trajektorie werden initialBalance sowie valide reguläre/Einmal-/Gesamt-Eigenbeitragssummen und spezifizierte Grant-Summen unabhängig geprüft und gegebenenfalls ausgegeben. completeAllowanceInflow ist nur bei vollständiger Coverage verfügbar. Ertrag, Stress, Gebührenabzüge, Anzeigeausgleich und sämtliche Endwerte bleiben dann gesperrt; nicht anwendbare Kosten-/Vorsteuerfelder behalten ihren modusspezifischen not_applicable-Status. Es gibt keinen Anspruch auf Auswertung eines gültigen Rechenprefix. Rein unabhängige Summen erhalten ihre eigenen Überlauf-/Evidenzfehler, statt einen falschen Wert zu übernehmen.

### 12.7 Vollständiger Fehlerkatalog und Priorität

Öffentlich nur code, bekannter path und gegebenenfalls month. Kein freier Text. Reihenfolge nach Phasen, darin nach der folgenden Codefolge; danach bekannter Pointer in ASCII-Reihenfolge. Bei Monatsfehlern zuerst frühester Monat, dann Codefolge. Unbekannte Schlüssel werden nicht in Pfade oder Fehlermeldungen übernommen. Rootpfad leer. Jede Response/Projektion hat genau ein primaryIssue oder null; gesperrte Kennzahlen können zusätzlich ihren konkreten Abhängigkeitsfehler tragen.

| Phase | Codes in Prioritätsreihenfolge | Wirkung |
|---|---|---|
| 1 Textgrenze | invalid_type; invalid_unicode; input_bytes_limit | Erste zwei invalid_input, Bytegrenze resource_error; noch keine Metadaten/Resultate |
| 2 Syntax/Struktur | input_depth_limit; invalid_json; invalid_shape; invalid_value; invalid_calendar; invalid_order; duplicate_identity; inconsistent_input; dangling_source; wrong_operation; noncanonical_json; entry_limit | Tiefen-/Eintragsgrenzen resource_error; andere invalid_input. Noch kein Hash/Quellenmanifest |
| 3 Version/Detailwahl | version_not_supported; detail_rows_limit | Review bzw. resource_error; kanonischer Hash verfügbar, noch keine Rechnung |
| 4 Evidenz/Fachbereitschaft | evidence_required; input_fact_unknown; annual_total_loss_timing_required; cost_rate_total_loss_timing_required; cost_source_unknown; effective_cost_not_balance_fee; cost_type_not_supported | Betroffene Projektion review_required; unabhängige Eingabesummen bleiben möglich |
| 5 Rechnung | work_limit; insufficient_fee_basis; numeric_domain_exceeded; precision_ambiguous | Worklimit global resource_error; andere Projektion review_required ohne Ledgerprefix |
| 6 Abdeckung/Vergleich | allowance_coverage_unknown; basis_mismatch | Nur betroffene vollständige bzw. Vergleichskennzahlen gesperrt |
| 7 Kostenwissen/Ausgabegröße | included_cost_amount_unknown; output_bytes_limit | Erstes nur Kostenkennzahl; Größenlimit global resource_error |

IssueCode ist exakt die Vereinigung dieser Wörter. MoneyNA.reason ist kein IssueCode. cost_source_unknown gilt auch für den nicht berechneten Nachkostenwert in gross_only. expected Kostenunbestimmbarkeit im Nettopfad ist kein weiterer globaler Stopp. Strukturfehler gehen fachlichen Reviews vor.

requestedVersions und requestHash sind erst ab vollständig erfolgreicher Phase 2 verfügbar, davor null. sourceManifest nur bei gültiger Quellenstruktur und unterstützten Versionen, sonst leer. Es enthält alle und nur verwendeten Quellen, nach sourceId sortiert. Bei globalem invalid_input/resource_error werden intern bereits entstandene Resultate vollständig verworfen. Operation null, solange kein gültiger kind erkannt ist; bei Nichtstring immer null. Bei Version-Review keine Resultate. Keine Parserpositionen, Exceptions oder Stacktraces nach außen.

Nichtstring ergibt damit eindeutig: invalid_input; operation, requestedVersions und requestHash null; alle drei Listen leer; primaryIssue `{code:"invalid_type",path:"",month:null}`; supportedVersions enthält die vier festgelegten IDs. Boxed String und Proxy bekommen dieselbe Form mit 0 Strukturzugriffen.

## 13. Lange Berechnung, numerische Reproduzierbarkeit und Ressourcen

### 13.1 Berechnungsdomäne und Ausgabearten

Je Projektion bleiben bis zu 118.800 Monate zulässig. Ein Vergleich hat sechs alternative Projektionen, somit bis 712.800 Monatsfortschreibungen. Jeder Monat benutzt denselben Kern. Keine Jahresersatzformel, kein früheres Ende, keine zweite Langlaufmathematik. Ein numerischer Überlauf ist kein Anlass, den Kalender zu verkürzen.

0100-01 bis 9999-12 sind 118.800 Monate. Bei Nullbestand, Nullbeitrag, Nullrendite, expliziten Nullkosten und Nullförderung ist jeder Monat exakt 0. Positive Beiträge können ebenfalls bis zum Kalenderende laufen, solange die monetären Grenzen eingehalten werden. Ökonomische Prognosesicherheit über 9.900 Jahre wird nicht behauptet.

Sei D die Summe der angeforderten Monatszeilen über die 1 oder 6 Projektionen. Ausgabeentscheidung nach Struktur-/Versionsvalidierung, vor Rechnung:

| mode | Verbindliche Regel | Überschreitung |
|---|---|---|
| detailed | Alle Monatszeilen; D höchstens 1.200 | resource_error/detail_rows_limit; kein Fallback oder Abschneiden |
| compact | Alle Monate rechnen, Summary und höchstens 120 lückenlose Blöcke je Projektion ausgeben | Detailgrenze irrelevant; übrige Limits gelten |
| auto | detailed bei D≤1.200, sonst compact für die ganze Anfrage | Deterministische Wahl, nicht nach Hostlast oder erfolgreicher Teilvariante |

Angeforderte später gesperrte Projektionen zählen bei D mit. Review-Trajektorien haben ledger null, niemals einen als vollständig dargestellten Prefix. Der Ausgabemodus ändert keine berechenbaren Endwerte, Summen oder fachlichen Status.

**Blockbildung:** b=ceil(N/120), Bereiche 0…b−1, b…2b−1 usw.; letzter Index N−1. Bei 118.800 Monaten: b=990, genau 120 Blöcke. Bei 1.201: b=11, genau 110 Blöcke, letzter Block 2 Monate. Jeder Block nennt tatsächlichen Beginn/Ende, Monatsanzahl, Anfangs-/Endbestand, FlowTotals und Quellen-/Eventbezüge. Keine Jahresbezeichnung für einen beliebigen Zeitraum.

Blöcke umfassen jeden Monat genau einmal; Öffnung eines Blocks entspricht Abschluss seines Vorgängers. Summen aus internen Werten, nicht aus Centzeilen. Gesamtsummen unabhängig von der Partition bilden. Quellenmanifest und Nach-Ende-Ereignisse bleiben erhalten. Keine verdeckte Trunkierung, keine automatische Reduktion auf Endkapital.

Eine Detailanfrage für 118.800 Monate scheitert am **Ausgabewunsch**, nicht an einer ungültigen Laufzeit. Der Caller kann ausdrücklich auto/compact anfordern. Pagination, Streaming oder ein zusätzlicher Downloadkanal sind nicht stillschweigend Bestandteil von AP-03a.

### 13.2 Vorab festgelegte Ressourcenlimits

Alle Grenzen inklusive, über die gesamte öffentliche Anfrage und alle Varianten:

| Größe | Grenze | Fehler |
|---|---:|---|
| Request | 16.777.216 UTF-8-Bytes, ohne BOM | input_bytes_limit |
| Verschachtelung | 16 gleichzeitig offene Objekt-/Arraycontainer; Roottiefe 1 | input_depth_limit |
| Fachliche Einträge | 10.000 insgesamt: alle Schedules, Eigen-/Grant-/Gebührenevents und offene Förderjahre | entry_limit |
| Quellen | 10.000 insgesamt | entry_limit |
| Bindings | 30.000 insgesamt, je 1–8 sourceIds | entry_limit |
| Detailzeilen | 1.200 insgesamt | detail_rows_limit |
| Kompaktblöcke | höchstens 120 je Projektion, durch Blockformel | keine frei wählbare Blockgrenze |
| Arbeit | 1.000.000 Ticks nach 13.3 | work_limit |
| Response | 33.554.432 kanonische UTF-8-Bytes, ohne BOM/Endnewline | output_bytes_limit |

Ressourcenfehler liefern einen kleinen Response-Umschlag mit festem Code und leeren Ergebnislisten. Keine gekürzte Reihe, kein gekappter Endwert, kein 0-Ersatz, keine automatische Laufzeitänderung. Bei output_bytes_limit wird das zu große Resultat vollständig verworfen. Es gibt keine Speicherung oder Mutation der Eingabequelle.

Kein Sekunden-Timeout als fachliche Entscheidung: Hostlast darf gleiche Anfragen nicht unterschiedlich klassifizieren. Eine äußere Prozess-/Browserbeendigung ist keine gültige Response und darf nicht als 0 oder früheres Endkapital angezeigt werden. Unerwartete Programmier-/Umgebungsfehler werden nicht zu vermeintlich validierten Ressourcenfehlern umetikettiert. Die spätere Implementierung muss die festgelegten Grenzen kontrolliert erkennen; sie verspricht keine überlebende Antwort nach einem Prozessabsturz.

### 13.3 Deterministische Rechen- und Tickkonvention

Die Mathematik aus 4.2–4.5 bleibt bestehen. Die dort vorgeschlagene Intervalltechnik wird für reproduzierbare Ergebnisse konkretisiert, ohne hier einen Kern zu implementieren:

1. S=10^36. Geld-/Faktorintervalle als Ganzzahlgrenzen auf diesem Raster. Cents und Decimal exakt einlesen. Addition/Subtraktion mit Intervallgrenzen. Multiplikation: Minimum/Maximum der vier exakten Grenzprodukte, dann floor/ceil nach außen auf das Raster. Keine Centzwischenrundung.
2. Aktive bekannte Faktoren berechnungsbereiter Projektionen vor der Monatsschleife bestimmen. Cachekey `return:<Decimal>` bzw. `cost:<Decimal>`, global je Request einmal, ASCII-sortiert. Fachlich bereits gesperrte Projektionen verursachen keine Faktorarbeit. Bei Q=1 ist Faktor 1 exakt und benötigt keinen Potenzvergleich.
3. Sonst Q=1+R bzw. 1−c als exakter positiver Bruch. Initial L=0, U=4S; m=floor((L+U)/2). m^12 mit Q×S^12 per exakter Kreuzmultiplikation vergleichen. Gleichheit ergibt exakten Faktor; sonst entsprechende Hälfte, bis U−L=1. Dann Faktorintervall [L/S,U/S]. Der Start deckt die gesamte Renditedomäne ab, höchstens 122 Vergleiche. Andere Faktorverfahren unter derselben NumericVersion sind unzulässig.
4. Je Potenzvergleich 1 Tick, Beginn einer Monatsfortschreibung 1 Tick, fachliche Prüfung einer Binding 1 Tick. Strukturprüfung zuvor zählt nicht erneut. Projektionen in Response-Reihenfolge, Monate aufsteigend. Vor dem Tick, der 1.000.000 überschreiten würde, work_limit. Kein Cache über Requests, kein Rabatt aus Zeit-/Hostzustand. Kanonisierung/Ausgabe sind durch Byte-/Eintragsgrenzen abgesichert, keine geschätzten Hostticks.
5. Fester Intervallgraph je Monat: A=B×q; D=B×(1−q); A'=A×g_A; D'=D×g_D; G=[A×(g_A−1)]+[D×(g_D−1)]; S_loss=A'×(−s); V=[A'×(1+s)]+D'; K_laufend=V×(1−h); K=K_laufend+F; Rest=(V×h)−F; W=((Rest+E)+L)+Z. Ohne Stress s=0; h=(1−c)^(1/12). Netto-/Bruttoreinmodus verwendet h=1,F=0 ausschließlich für den Methodenabzug, keine Kostenaussage. Die positive Form von V ist algebraisch B+G−S_loss und vermeidet künstliche negative Intervallbestände aus korrelierten Subtraktionen.
6. Rest.upper<0: insufficient_fee_basis. Rest.lower<0≤Rest.upper: precision_ambiguous. Exakt 0 ist zulässig. Kein Clamping. Das gesamte Intervall jeder Geldkomponente/Summe muss innerhalb der bisherigen Betragsgrenze liegen, sonst numeric_domain_exceeded; signed Komponenten absolut begrenzen. Externe Förder-Cents unverändert.
7. Alle Geldkomponenten einer hypothetischen MonthRow müssen centauflösbar sein, auch bei compact. Half-even-Cent an beiden Intervallgrenzen identisch, sonst precision_ambiguous. Exakte Halbcent-Rasterpunkte folgen der Modellanzeigeregel. Kompaktmodus darf Präzisionsprobleme verdeckter Monate nicht beseitigen.
8. Globale und Blocksummen jeweils chronologisch aus internen Monatsintervallen; Gesamtbilanz nicht aus Cent-/Blockendwerten zusammensetzen. Anzeigeausgleich = Endcent − (Anfangscent + Ertragscent − Stresscent − Methodenabzugcent + Eigenbeitragscent + Zulagencent). Kein Bestandteil von Kosten, Förderung oder Weiterrechnung.

Die volle Nullanfrage benötigt 118.800 bzw. 712.800 Monatsticks plus wenige Bindings und keinen Wurzelvergleich für Q=1. Die Kalenderdomäne wird somit nicht allein wegen ihrer Monatszahl ausgeschlossen. Dichte unterschiedliche Faktoren können dagegen work_limit auslösen; Ursache ist die vorab deklarierte Arbeitsmenge. Die Laufzeit-/Speicherprobe eines implementierten Kerns steht weiterhin aus.

## 14. Präzisierte und ergänzende Soll-/Negativfälle

### 14.1 Präzisierte bisherige Fälle

Die Zahlen bleiben bestehen. Die Fallnotation in Abschnitt 7 ist fachliche Kurznotation, kein vollständiger JSON-Request. Sämtliche Pflichtfelder und Quellenbindungen nach 12 gelten zusätzlich. Baseline B: none_assumed, leere Events/offene Jahre, ausdrückliche Nullergänzung, Output auto.

| Fall | Präzisierung V0.2 | Verbindliches Soll |
|---|---|---|
| F08a | 120 € für 2027, Istzufluss 31.05.2028; complete_events im isolierten Szenario | specifiedEndBalance=completeEndBalance=128,66 €; spezifizierte Zulagen 120 €; Istbezug erhalten, Kapital modelliert |
| F08b | Betrag 120 € und Juni 2028 hypothetisch; complete_events oder none_assumed mit diesem Event | Endwerte jeweils 127,38 €; Zulage 120 € bleibt; None schließt nur zusätzliche Events aus |
| F08c | Wie F08a, unknown, offene Jahre [2028] | specifiedEndBalance 128,66 € und gebuchte 120 € erhalten; vollständige Kennzahlen gesperrt; partial |
| F10a | Einmal 120 € Dezember 2027 für 2026, Horizont Januar 2027–Dezember 2028, R0, none_assumed | Beide Endwerte 120,00 €; keine Wiederholung; nicht „alle Zulagen 0“ |
| F10b | Dasselbe Event mit complete_events und bestätigtem vollständigem Modellkatalog | Beide 120,00 €; keine allgemeine Gewissheit zukünftiger Rechtsansprüche |
| F10c | Dasselbe Event mit unknown, offene Jahre 2027 und 2028 | specifiedEndBalance 120,00 €; completeEndBalance gesperrt; weder 0 noch 240 € als Ersatz |
| F37 | Gesamter Nullhorizont, Output auto/compact | 118.800 Monate berechnet, 0,00 € Endwert, 120 Blöcke à 990 Monate; keine vollständige Detailausgabe behaupten |
| N05 | Fehlende Pflichtfelder versus ausdrückliche Unbekanntheit | Fehlende Struktur invalid_input; unbekannte Facts/Quellen sperren Abhängigkeiten; unknown-Coverage erhält spezifizierte Werte |
| N12 | Neue Ressourcenklassifikation | Über 16 MiB oder 10.000 Fach-Einträge: resource_error, nicht invalid_input; Code nach 13.2 |

### 14.2 Neue positive und differenzierende Fälle

| Fall | Eingabe | Soll / Oracle |
|---|---|---|
| F38 | 0100-01–0199-12, N=1200, alle Werte 0, none_assumed, auto | detailed mit genau 1200 Zeilen; End0,00 € |
| F39 | 0100-01–0200-01, N=1201, sonst F38 | compact; b11, 110 Blöcke, letzter2 Monate; alle1201 Monate gerechnet, End0,00 € |
| F40 | F38/F39 jeweils ausdrücklich compact | Gleiche Summaries wie bei auto/detailed; andere Darstellung, keine andere Mathematik |
| F41 | Gesamter Kalender, monatlich1 Cent, R/K/B0, none_assumed | 118800×0,01 €=1.188,00 €; 120 Blöcke mit je9,90 € Eigenbeitrag |
| F42 | Sechs volle Nullprojektionen im Vergleich, drei Szenarien/ungeförderte Referenzen | 712800 Monatsschritte; alle Endwerte/Differenzen0; auto→compact, je120 Blöcke |
| F43 | 120 € hypothetisch für2027; Mai-Illustration, Datum2028-05-15, Buchungsmonat2028-05 | 120×1,01^7=128,66 €; kein Istzufluss. Freie Juni-Hypothese bleibt127,38 € |
| F44 | F10a, neue Anfrage mit expliziten zusätzlichen80 € für2027 im Mai2028, R0, none_assumed | 120+80=200,00 €; vorhandene120 € erhalten; keine automatische120-€-Fortschreibung |

Alle Schedules beginnen jeweils am Start, sämtliche Quellenbindungen sind explizit vorhanden. Die sechs Projektionen sind Alternativen, kein zu addierendes Kundengeld. F41/F42 sind Zähloracles, kein gemessener Leistungsnachweis.

### 14.3 Neue Negativ-/Protokollfälle

| Fall | Eingabe/Grenze | Verbindliches Soll |
|---|---|---|
| N18 | none_assumed mit 120-€-Event und offenen Jahren [2028] | invalid_input/inconsistent_input |
| N19 | unknown ohne offenes Jahr | invalid_input/inconsistent_input |
| N20 | F39 mit detailed | resource_error/detail_rows_limit; keine Ergebnisobjekte; auto wäre neue zulässige Anfrage |
| N21 | Volle Kalenderdomäne mit detailed | Derselbe Detailfehler; kein invalid_calendar, keine Laufzeitkappung |
| N22 | 16 MiB+1 gültige UTF-8-Bytes | resource_error/input_bytes_limit vor Parse, Hash null; exakt16 MiB nicht allein deshalb Fehler |
| N23 | 17 offene Container bzw. 10.001 Fach-Einträge | resource_error/input_depth_limit bzw. entry_limit |
| N24 | Doppelte balanceCents-Keys, Whitespace oder Exponentbetrag | noncanonical_json nach sonst erfolgreicher Strukturprüfung; bei vorrangig falschem Typ invalid_shape/invalid_value; nie still überschreiben |
| N25 | Fehlende Binding bei sonst gültiger Quellenstruktur; separat unbekannte sourceId | evidence_required bzw. invalid_input/dangling_source; kein Defaultbeleg |
| N26 | unknown-Coverage, vollständiger Endwert dennoch120 € | Unzulässige Responseform; Soll gesperrte Kennzahl ohne Betrag mit allowance_coverage_unknown |
| N27 | Mai-Illustration mit Monat2028-06 oder Datum2028-05-31 | invalid_input/inconsistent_input; keine Datumsreparatur |
| N28 | actual_booking_confirmed mit hypothetischer Zeitbasis oder ohne Buchungsref | invalid_input/inconsistent_input |
| N29 | Andere wohlgeformte Modellversion, ansonsten kanonisch | review_required/version_not_supported, Hash verfügbar, keine Resultate |
| N30 | Vor- gegen Nachkosten bei gleicher Eigenbeitragsbasis | Einzelwerte bleiben; Vergleich review_required/basis_mismatch |
| N31 | Tick-/Responsegrößengrenze | Tick1.000.000 zulässig, Versuch1.000.001 work_limit;32 MiB zulässig,+1 Byte output_bytes_limit; kein Teilergebnis |

Limits sind keine Requestfelder. Der spätere Test muss Zähler-/Serialisierungsgrenzen am inneren Validator und dichte gültige Anfragen mit verschiedenen Faktoren bis work_limit prüfen. Keine gesenkte Produktivgrenze oder Timeoutmanipulation. Ist output_bytes_limit unter den übrigen Obergrenzen praktisch unerreichbar, Grenzvalidator und reale Obergrenze getrennt belegen; keinen fingierten End-to-End-Fall behaupten.

### 14.4 Vollständiges kanonisches Minimalbeispiel

Synthetisches Einmonats-Nullszenario mit allen Pflichtfeldern. Soll: calculated, Endwert0 Cent, Nullbilanz, auto→detailed mit einer Zeile. Genau eine gebundene Hypothesenquelle. Dies ist dokumentierter Datentext, kein Testprogramm oder Rechenkern.

```json
{"kind":"projection","output":{"mode":"auto"},"projection":{"bindings":[{"path":"/allocationSchedule/0","sourceIds":["assumption-minimal"]},{"path":"/contributionSchedule/0","sourceIds":["assumption-minimal"]},{"path":"/costs","sourceIds":["assumption-minimal"]},{"path":"/costs/annualRates/0","sourceIds":["assumption-minimal"]},{"path":"/grantCoverage","sourceIds":["assumption-minimal"]},{"path":"/initial","sourceIds":["assumption-minimal"]},{"path":"/marketSchedule/0","sourceIds":["assumption-minimal"]},{"path":"/period","sourceIds":["assumption-minimal"]},{"path":"/rebalancing","sourceIds":["assumption-minimal"]},{"path":"/stress","sourceIds":["assumption-minimal"]}],"parameters":{"allocationSchedule":[{"equityWeight":{"state":"known","value":"1"},"fromMonth":"2027-01"}],"contributionSchedule":[{"fromMonth":"2027-01","monthlyCents":{"state":"known","value":0}}],"costs":{"annualRates":[{"effectiveAnnualReduction":{"state":"known","value":"0"},"fromMonth":"2027-01"}],"coverage":"complete","fixedFees":[],"mode":"gross_plus_explicit_costs"},"grantCoverage":{"mode":"none_assumed","unresolvedContributionYears":[]},"grantEvents":[],"initial":{"balanceCents":{"state":"known","value":0},"position":"immediately_before_start","valuationMonth":"2027-01"},"instrument":"retirement_model","marketSchedule":[{"bondAnnualReturn":{"state":"known","value":"0"},"equityAnnualReturn":{"state":"known","value":"0"},"fromMonth":"2027-01"}],"oneOffContributions":[],"period":{"endMonth":"2027-01","startMonth":"2027-01"},"projectionId":"minimal-retirement","rebalancing":"monthly_target_weight","stress":null}},"sources":[{"checkedOn":null,"contentHash":null,"effectiveFromMonth":null,"effectiveToMonth":null,"kind":"model_assumption","quality":"hypothetical","reference":"Q11: synthetic zero scenario","sourceId":"assumption-minimal","version":"synthetic-v02"}],"versions":{"inputContractVersion":"ap03a-input-v1.0","modelVersion":"ap03a-model-v1.0","numericConventionVersion":"ap03a-decimal36-v1.0","resultContractVersion":"ap03a-result-v1.0"}}
```

Requesthash des Beispiels: `sha256:c420902072b639a90a26579e626ed0b603df5cba0ec9628b3718908672cdba01`. Der abschließende Zeilenumbruch des Markdown-Codeblocks gehört nicht zum Eingabestring.

## 15. Dokumentkontrolle und Abschlusscheckpoint V0.2

Durchgeführt wurden: erneuter Abruf der amtlichen AltvPIBV-Gesamtfassung einschließlich § 9 Abs. 1/3 und § 14; Abgleich mit dem bereits erfassten tatsächlichen Zahlungs-/Gutschriftverfahren; Prüfung der konsolidierten Verweise und aufgelösten öffentlichen Typen; Kontrolle auf verbliebene Platzhalter/alte widersprechende Fehlernamen; kanonischer JSON-Roundtrip und SHA-256 des vollständig angegebenen Minimalbeispiels; unabhängige Zähl-/Blockgrenzenrechnungen für 1.200, 1.201 und 118.800 Monate; geschlossene Kontrollen der Mai-/Juni-Werte sowie der 1-Cent-Langlauf- und zusätzlichen 80-€-Zahlung. Die ursprünglichen mathematischen V0.1-Kontrollen werden nicht als neu ausgeführte Implementierungstests ausgegeben.

Formaler Fallabgleich: F01–F44, N01–N31 und K01–K26 sind vorhanden; Unterfälle präzisieren insbesondere die Coverage. Das V0.1-Original im Workspace bleibt bytegleich mit dem eingangs angegebenen SHA-256 erhalten. Der neue Vertrag ist vollständig in dieser Datei konsolidiert; V0.1 muss zur Auslegung nicht zusätzlich geöffnet werden.

**Letzter lesender GitHub-Abgleich: 28.10.2026, 17:23:25 Uhr Europe/Berlin** (`2026-10-28T16:23:25Z`). main unverändert `0bb89fd7e0aad99247c8d23a7efcfa7c86a52841`, Tree `8828061cb4bb242d5265b259a2ef7890d3b1624e`; offene PRs ausschließlich #60 mit Head `3aec3f0ffd9e873adad85cfaf95fea918fa9cb9c` und #43 mit Head `5a8963a4f7c6fd80c83da7f6872139400c51e656`. Keine GitHub-Schreibaktion. Keine neue unabhängige Abnahme, keine neue Push-/PR-CI und kein gemessener maximaler Kernlauf werden behauptet.

**Abschluss: Die vier Nachbesserungen sind als prüfbarer V0.2-Vertragsvorschlag eingearbeitet. Empfehlung zur späteren Freigabe als V1.0 gemäß Abschnitt 9. Einfrieren und Implementierungsfreigabe ausschließlich durch die Projektleitung; AP-03a Stufe 2 bleibt HOLD.**
