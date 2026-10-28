# AP-01b – isolierter bonusfreier Alt-Riester-Jahreskern

Fach-/Quellenprüfstand 28.10.2026, Rechenversion `ap01b-v1`.
Jahresbezogene Modellrechnung; keine individuelle Förderzusage.
Kein ZfA-Bescheid, keine Buchungs-/Steuerberechnung. Sämtliche Beispiele sind synthetisch.

## Preflight und zulässiger Diff

Live-main vor Beginn am 28.10.2026: `add55a43ff8b93545b490d6df5bec2d17c4d1f03`,
Tree `93d6e3b6533f7cf3ef286bbceb8c8f7e44a76742`, Version 0.18.4 / Schema 11.
AGENTS, Operating Model, datierter Projektstatus und Decisions gelesen.
Der Statuscheckpoint ist gegenüber #58/#59 veraltet; der konkrete Auftrag und
Live-Git bestimmen die Basis. Offene PRs: #60 (separate Governance), #43
(AUDIT ONLY – NEVER MERGE); kein vorhandener AP-01b-Remotezweig gefunden.
Sauberer separater Clone; ältere Originale/Worktrees erhalten.
Authentifizierter API-Transport gemäß D-05 erlaubt, Pushrecht lesend bestätigt.
Originalcommit, Parent/Tree, Remoteidentität und finale Doppel-CI sind gesondert nachzuweisen.

Erlaubt sind ausschließlich drei neue `old-riester-grant*.ts`-Domainmodule,
diese Dokumentation, `tests/fixtures/ap01b-old-riester.synthetic.json`,
`scripts/verify-ap01b-old-riester.ts` und zwei Skriptergänzungen in `package.json`.
AP-01a einschließlich Tests/Fixtures, App-Roots, UI, Schema/Store, Import/Restore,
Exporte, Lockdatei, Version und Workflows bleiben bytegleich. Keine Integration
in eine Oberfläche oder Speicherung. Kein Merge, Release oder eigenes Abnahme-GO.

## Öffentliche API vor Ausbau der Testmatrix

`calculateOldRiesterGrant(input: unknown): OldRiesterGrantResult` validiert
vollständige reine Daten. `OldRiesterGrantInput` und `OldRiesterChild` in
`old-riester-grant-contract.ts` definieren alle erlaubten Schlüssel und Literale.
Alle Felder sind Pflicht; kein Bestätigungsdefault. Pro Aufruf eine Person/ein Jahr.

| Feld | Bestätigter Standard / Bedeutung |
| --- | --- |
| contributionYear / ruleContext | Explizit 2026 / alt-2026-checked-20261028, 2027 / alt-bestand-2027-checked-20261028, 2028 / alt-bestand-2028-checked-20261028. |
| entitlement | direct_old_confirmed; keine Ableitung aus Beruf, Einkommen oder Vertrag. |
| regime | old_2026_confirmed für 2026; old_protected_confirmed für 2027/2028 einschließlich fehlendem wirksamen Wechsel/Neuabschluss. |
| contract | single_private_eligible_confirmed bestätigt Person, Förderfähigkeit, privaten Ansparvertrag und geprüfte relevante ruhende/übertragene/beendete Verträge. |
| incomeBasis / priorYearIncomeCents / incomeYear | simple_domestic_prior_rv_confirmed; richtige einfache inländische Vorjahres-RV-Bemessung, keine eigene BBG-/Bruttoermittlung; incomeYear = Beitragsjahr minus eins. Nullbetrag zulässig; null bedeutet unbekannt. |
| partner | none_relevant_confirmed oder direct_independent_confirmed nach geklärter eigener Berechtigung und Kinderzuordnung; keine Paarrechnung. |
| bonus | age_excluded_confirmed oder history_no_current_confirmed. Aufrufer bestätigt Jahresbeginn-Altersstichtag bzw. vollständige Erstanspruchs-/Verbrauchshistorie. Kein DOB-Feld und keine Bonusermittlung im Kern. |
| childrenStatus / children | complete_confirmed und vollständige Liste; [] bestätigt keine Kinder. Jede Position: opake ID, birthYear, contributionYear, ruleContext, assignment = eligible_assigned_confirmed. |
| eligibleOwnContributionCents / contributionQuality | Nur förderfähige Eigenzahlung; actual_confirmed oder planned_confirmed. Nullbetrag ist bestätigt null, null unbekannt. Keine Hochrechnung, Erträge, Zulagen oder Überträge. |
| evidenceQuality / pendingEvidence | confirmed und leere Liste; sonst offen/widersprüchlich. Keine Belege oder personenbezogenen Daten im Kern. |
| correction | none_confirmed; keine rückwirkende Wiederberechnung bereits abgeschlossener Zulagen. |

Kinder-IDs: 1–128 ASCII-Zeichen, beginnend alphanumerisch, danach zusätzlich
`_.:-`; Namen/Belegnummern sind ausdrücklich kein zulässiger fachlicher ID-Inhalt.
Jahre technisch 0100–9999; Geburtsjahr nicht später als Kinder-Beitragsjahr.
Technische Domäne ist keine Kindergeld-Altersgrenze. Abweichender Kind-Jahr-/Regimebezug
sperrt die Rechnung. Die rechtliche Zuordnung wird vorgelagert bestätigt.

Bestätigte Standardwerte werden nicht aus `unconfirmed`, `conflicting`,
`timeline_unconfirmed` oder `transition_unconfirmed` abgeleitet.
Fehlende Pflichtstruktur, unbekannte Statusliterale, Zusatzschlüssel, falsche Typen,
NaN/Infinity/-0, BigInt-Eingaben, Bruchteile und Überläufe sind `invalid_input`.
Unbekannte stringförmige Regel-ID: `review_required / rule_context_required`.
Strukturfehler haben Vorrang vor offenen Tatsachen, diese vor sämtlichen
bekannten Scope-Ausschlüssen. Jeweils erster Grund in dokumentierter API-Reihenfolge:
Jahr/Regel, Anspruch, Regime, Vertrag, Einkommen/Jahr, Partner, Bonus, Kinder,
Beitrag, Nachweisqualität, offene Nachweisliste, Korrektur.

Alle eigenen Deskriptoren werden vor dem Lesen in eigene einfache Daten kopiert.
Eigene Getter/Setter werden nicht ausgewertet. Arrays müssen dicht sein und den
nativen Arrayprototyp tragen; eigene Methoden/Iteratoren, Symbole, Accessors und
Zusatzfelder werden abgewiesen. Werfende/widerrufene Proxys liefern kontrolliert
invalid_shape. Portable JavaScript kann transparente Proxys nicht allgemein von
gewöhnlichen Daten unterscheiden; es gibt keine Zusage, dass beliebige Proxy-Traps
keinen Fremdcode ausführen. Die Rechnung nutzt ausschließlich den geprüften Snapshot.
Gefrorene Daten werden unterstützt; Eingaben bleiben unverändert.

## Status- und Scopevertrag

| Status | Grenze und nächste fachliche Klärung |
| --- | --- |
| calculated | Alle Nachweise bestätigt, Standard erfüllt und Rundung eindeutig. Nur hier M, exakte gedeckelte Erfüllungsquote, Grund-/Einzelkinder-/Kinder-/Gesamtsumme. Tatsächlich/geplant und Aufruferbestätigung werden getrennt ausgewiesen. |
| review_required | Offene/widersprüchliche Tatsache, unpassender Jahr-/Regimekontext, ungeprüfte Folgejahre oder Rundungssperre. Fachstelle klärt konkreten Nachweis bzw. BMF-/ZfA-Konvention. Keine Förderzahlen. |
| unsupported | Bestätigte mittelbare Berechtigung/Partnerabhängigkeit, Mehrverträge, Neu-Regime, Bonusjahr, Wohn-Riester/bAV, Sonderbemessung, ungeeigneter Beitrag/Vertrag oder Rückrechnung. Separater Fachauftrag nötig; keine Aussage, dass rechtlich keine Zulage existiert. |
| invalid_input | Strukturell falsche Daten einschließlich doppelter Kind-ID. Daten berichtigen; keine Ersatznull, Teilzulage oder Summe. |

Fehlstatus enthält nur stabilen Code, datensparsamen Erklärungstext,
Modellhinweis und auswählbaren Rechtskontext. Kein öffentliches Rundungsdiagnosegeld.

## Rechnung und konservative Rundung

Alle Geldgrößen sind nichtnegative sichere Ganzzahl-Cents, intern BigInt.
Y = floor(Y_raw / 100) Euro; B = min(4 × Y, 210000) Cent;
Z = 17500 plus je Kind 18500 (vor 2008) oder 30000 Cent.
M = max(6000, floor((B − Z) / 100) × 100) Cent. Der Deckel gilt vor Abzug;
negativer Rest führt zum Sockel. M wird niemals mit gekürzten Zulagen neu bestimmt.

E ≥ M: volle Einzelzulagen. E = 0: echte Nullkomponenten nach allen Nachweisprüfungen.
Sonst Quote E/M auf neun Stellen und unabhängig Prozentwert 100 E/M auf neun
Stellen (entspricht Quote auf elf Stellen). Beide Wege werden auf jede maximale
Teilzulage angewandt und einzeln auf Cent geprüft. Exakter Halbwert bei Faktor
oder Produkt sowie divergierende Komponentencents sperren das gesamte Ergebnis:
`review_required / rounding_convention_required`.
Kein universeller Halbwertmodus, keine neue behauptete ZfA-Norm.
Summe ausschließlich aus geprüften Einzelkomponenten, kein Restcentausgleich.
Die Erfüllungsquote bleibt exakt und kann trotz auf volle Zulage gerundetem
Centbetrag weiterhin als reduziert ausgewiesen werden.

| Synthetischer Fall (2027, Bestand, ohne aktuellen Bonus) | Ergebnis |
| --- | --- |
| Y 35000 €, E 360 €, kinderlos | M 1225 €, Grund/Gesamt 51,43 €. |
| Y 18000 €, zwei Kinder ab 2008, E 60/120/360 € | M 60 €, jeweils 175 + 300 + 300 = 775 €. |
| Y 35000 €, kinderlos, E 60/120 € | 8,57 / 17,14 €. |
| G13: Y 35000 €, Kinder 2007/2008, E 0,01 € | M 740 €, alle drei Komponenten 0 Cent. Gemeinsame Rundung auf 1 Cent wäre falsch. |
| G14: Y 0, E 0,06 € | Halbcent; Prüfstatus ohne Beträge. |
| N29: Y 6125 €, E 0,03 € | Faktor-/Prozentdivergenz; Prüfstatus ohne Beträge. |

## Amtlicher Quellenabgleich

Am 28.10.2026 vor Implementierung erneut abgerufen:

- § 86 a. F. (DRV 31.07.2014), § 84 a. F. (01.01.2018),
  § 85 a. F. (15.12.2018), § 79 a. F. (31.07.2014):
  amtliche URLs in den Regelmetadaten.
- BGBl. 2026 I Nr. 156, Gesetz 26.05.2026, verkündet 29.05.2026;
  Artikel 2, 3, 14: Übergang 2027/2028.
  Original 576530 Bytes; SHA-256
  `88e8bedbc87566c0943433e767a1f2b42d3089adade3235e38f2acf153dc04ce`.
- BMF 05.10.2023, IV C 3 – S 2015/22/10001 :001,
  insbesondere Rn. 46, 63–69, 89–90. Original 1053086 Bytes; SHA-256
  `1e4a497736773c4ec9a4f9751daf3a72bd32cc72d1739a0e6804b7eb87fba62b`.
  Beide Original-PDFs bytegleich zum AP-00-Prüfstand.
- § 52 Abs. 50a 2027/2028, § 85 2027/2028: Bestand friert Absatz 1 ein,
  Absatz 2 wird 2028 geschlechtsneutral. Erster Anspruchszeitraum bleibt im
  Altbestand; im neuen Regime 2028 letzter. Keine automatische Elternzuordnung.
- Gezielte amtliche Suche nach ersetzender Verwaltungsregel: kein einschlägiger
  Ersatz der genannten BMF-Randnummern gefunden. Keine Vollständigkeitsgarantie.

Gesetz/BMF sind Rechts-/Verwaltungsgrundlage; die Zweifachprüfung und Umfangsgrenzen
sind konservatives Prüfdesign. Projektbasis ist das vollständig gelesene AP-00-
Fachprüfpaket 28.10.2026 (SHA-256
`2ef794ad3622fdcecdc57107aad47c9fbb6bfaf8ddd7a36b859cb317968dbf54`).
V0.4-Rekonstruktionen bleiben Rekonstruktionen, keine behauptete Original-V0.1-Abnahme.

## Prüfnachweise und offene Grenzen

Die maschinenlesbare Fixture ordnet jede ID G01–G17 und N01–N29 explizit zu.
Neurechts-/Partnerfälle testen nur die Abgrenzung. Varianten/Splittings und
abweichender AP-01b-Status gegenüber ursprünglichem Neurechts-Soll sind einzeln
begründet. Vier rekonstruierte Szenariofamilien werden mit allen AP-00-Varianten geprüft.
Der Runner protokolliert je Fall Soll/Ist, Komponenten oder Sperrcode, prüft
Statuspriorität, defensive Validierung und ein unabhängig implementiertes
Dezimal-/Integeroracle mit synthetischen Cent-/Einkommens-Sweeps.
Strikter TypeScript-Test wird für die unintegrierten Domainmodule separat ausgeführt.
Das kanonische verify erhält den neuen Test sequenziell; vorhandene Gates unverändert.

P1-B01 (Rundungsmodus/Faktoreinheit), B02 (Bonus/Wechsel/Centzerlegung),
B03 (Original-V0.1), B04 (Mehrvertragsverteilung), B05 (Partnerhistorie),
B06 (Kinderzuordnung 2028), B07 (neue Berechtigungsgruppen/Teiljahre) und
B08 (Sonder-/Mehrquelleneinkommen) bleiben ausdrücklich offen bzw. außerhalb.
Keine Zusage über künftige Buchungstermine oder Rechtsfortschreibung.
Projektleiter und organisatorisch unabhängiger READ-ONLY-Review erhalten dasselbe
finale Head-/CI-/Nachweispaket. Work ersetzt keine dieser beiden Abnahmen.
