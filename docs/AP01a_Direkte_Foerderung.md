# AP-01a – Neue unmittelbare Förderung, isolierter Rechenkern

Regelprüfung: 27.10.2026. Rechenversion `ap01a-v1`. Öffentliche Dokumentation
des begrenzten Fachvertrags; keine Herstellerunterlagen oder echten Fälle.
Keine Oberfläche, Speicherung, Vertragsbuchung oder individuelle Förderzusage.

## Aufruf und Verantwortungsgrenze

`calculateDirectGrant(input: unknown): DirectGrantResult` ist die validierende
Laufzeitgrenze. `DirectGrantInput` dokumentiert den typisierten Aufrufervertrag.
Der Aufrufer bestätigt **für genau diese Person und das Beitragsjahr**:

| Feld | Pflicht / Bedeutung |
| --- | --- |
| `contributionYear` | Numerisches Kalenderjahr 0100–9999; nur 2027/2028 sind freigegeben. |
| `ruleContext` | Explizit `estg-2027-v1` oder `estg-2028-v1`, passend zum Beitragsjahr. Keine Fortschreibung. |
| `entitlement` | `direct_confirmed` nach vorgelagerter rechtlicher Prüfung. `unconfirmed` → Prüfung; `indirect`/`ineligible` → außerhalb Umfang. Ein Berufstext ist kein Nachweis. |
| `regime` | `new_confirmed`; `unconfirmed` → Prüfung, `old` → nicht unterstützt. Bei Bestand ist ein wirksamer Wechsel vorgelagert zu bestätigen. |
| `eligibleContractContext` | `single_eligible_confirmed` bestätigt genau einen zulässigen förderfähigen Vertrag. `multiple` → nicht unterstützt; `transition_unconfirmed`/`unconfirmed` → Prüfung. |
| `eligibleOwnContributionCents` | Tatsächlicher förderfähiger Jahres-Eigenbeitrag als nichtnegative sichere Ganzzahl; keine Hochrechnung, Konvertierung oder Rundung. `-0` wird als ungewöhnliche Zahlenrepräsentation abgelehnt. |
| `children` | Vollständige Liste der hier einzubeziehenden Kinder. `[]` bestätigt, dass keine einzubeziehen sind. Unbekannte Zuordnung muss ausdrücklich als Prüfstatus oder `pendingEvidence: ["children"]` geliefert werden. |
| `children[].id` | Stabile opake ID: 1–128 ASCII-Zeichen, beginnend alphanumerisch, danach zusätzlich `_ . : -`. Keine Leer-/Steuerzeichen; Duplikate werden abgelehnt. |
| `children[].contributionYear/status` | Gleiches Beitragsjahr und `eligible_assigned_confirmed`. Unbestätigte Berechtigung, offene/widersprüchliche Zuordnung oder ein anderes Jahr → Prüfung. |
| `pendingEvidence` | Optional Liste aus `entitlement`, `regime`, `contract`, `children`, `bonus`. Jeder offene Pflichtnachweis sperrt das Ergebnis. Nur `bonus` sperrt den hier ausdrücklich bonusfreien Standardbetrag nicht. |

Der Kern akzeptiert einfache Datenobjekte und lehnt unbekannte Felder (auch
Partner-/Haushaltsdaten), fehlende Pflichtwerte, Getter und falsche Typen ab.
Bei `children` und `pendingEvidence` werden sämtliche eigenen Property-Deskriptoren
vor Elementzugriff oder Traversierung geprüft. Accessor-Eigenschaften (auch
nicht werfende Getter und reine Setter), eigene Traversierungsmethoden/-Iteratoren,
Zusatzfelder und abweichende Arrayprototypen werden als `invalid_input` abgewiesen.
Getter werden dabei nicht ausgeführt. Auch Ausnahmen bei der strukturellen
Untersuchung ungewöhnlicher JavaScript-Eingaben (z. B. Proxy-Traps oder widerrufene
Proxies) liefern kontrolliert `invalid_input / invalid_shape`; kein Ersatzbetrag.
Er interpretiert keine Erwerbs-, Kindergeld-, Vertragsabschluss- oder Wechselhistorie.
Die sicheren Zahlengrenzen sind eine **technische** Eingangsgrenze, keine Aussage
über zulässige Vertragsbeiträge. Die rechtliche Förderfähigkeit des gelieferten
Eigenbeitrags einschließlich Vertrags-/Einzahlungsgrenzen bleibt beim Aufrufer.
Der Kern berechnet weder Vertragsrang noch zulässige Einzahlung aus Rohzahlungen.
Die bestätigten Statusangaben sind ein Aufrufervertrag, keine Verifikation von Belegen.

## Rechen- und Centvertrag

Für bestätigte Standardfälle mit E in Jahres-Cent:

- E < 12000: Grund- und Kinderzulagen jeweils 0.
- Sonst Grundzulage: `(2 × min(E, 36000) + min(max(E − 36000, 0), 144000)) / 4`.
  Der Zähler ist ein exakter, auf 216000 begrenzter Ganzzahlwert; maximal 54000 Cent.
- Je bestätigtem Kind `min(E, 30000)` Cent. Derselbe Eigenbeitrag ist für mehrere
  Kinder nutzbar. Keine erneute Mindestbeitragsanforderung pro Kind.
- Gesamtbetrag = Grundzulage + Summe der Kinderbeträge; **ohne Einmalbonus**.

Ist der Zähler nicht durch vier teilbar, liefert der Kern `review_required` mit
`rounding_convention_required` und einem exakten rationalen `openRounding`-
Zwischenwert in Cent. Es gibt dann **keine** Felder für Grund-/Kinder-/Gesamtbetrag.
Auch ein mathematisch ganzzahliger Gesamtbetrag könnte die offene Rundung eines
Förderbestandteils nicht ersetzen. Keine Auf-/Abrundung und keine ZfA-Centverteilung.
Beispiel: 120,01 € → Grundbetrag mathematisch 6000,5 Cent, Prüfstatus.
360,01 € → 18000,25 Cent, ebenfalls Prüfstatus. Unter 120 € gilt zuerst die
Mindestbeitragsregel; aus 119,99 € entsteht daher kein offener Fördercent.

## Ausgabe und Rechtsstand

Discriminated union: `calculated` ausschließlich für den bestätigten engen
Standardfall; ansonsten `review_required`, `unsupported` oder `invalid_input`
mit festem Fehlercode und Begründung. Fehlermeldungen kopieren keine fremden
Personen-/Vertragsdaten. Nur berechnete Kinderpositionen referenzieren ihre
übergebenen technischen IDs. Kein numerischer Ersatzwert bei Fehler-/Prüfstatus.
Jede Ausgabe trägt einen getrennten Bonusstatus `not_calculated_requires_review`
mit `includedInTotal: false`, Modellhinweis und, soweit auswählbar, Regelmetadaten.
Diese enthalten Regel-ID, Jahr, Rechenversion, festen Prüfstand und Primärquellen.
Unlesbare Eingaben vor Regelauswahl tragen `ruleContext: null`.

2027 und 2028 unterscheiden sich in der maßgeblichen Kinderzuordnungsfassung;
der Kern ermittelt diese Zuordnung **nicht selbst**. Sie muss rechtlich nach der
zutreffenden Jahresfassung bestätigt sein. Nach 2028 → Prüfstatus; vor 2027 →
nicht unterstützt. Falscher ausgewählter Jahreskontext → Prüfstatus.

Öffentliche, am 27.10.2026 erneut gelesene Primärquellen:

- [§ 84 EStG, ab 01.01.2027: Grundzulage](https://rvrecht.deutsche-rentenversicherung.de/SharedDocs/rvRecht/05_Normen_und_Vertraege/02_C-K/EStG/0084/0084_2027_01_01.html).
- [§ 85 EStG, 2027: Kinderzulage](https://rvrecht.deutsche-rentenversicherung.de/SharedDocs/rvRecht/05_Normen_und_Vertraege/02_C-K/EStG/0085/0085_2027_01_01.html).
- [§ 85 EStG, ab 2028: Kinderzulage](https://rvrecht.deutsche-rentenversicherung.de/SharedDocs/rvRecht/05_Normen_und_Vertraege/02_C-K/EStG/0085/0085_2028_01_01.html).
- [§ 86 EStG, ab 2027: Mindesteigenbeitrag](https://rvrecht.deutsche-rentenversicherung.de/SharedDocs/rvRecht/05_Normen_und_Vertraege/02_C-K/EStG/0086/0086_2027_01_01.html).

## Tests und bewusste Folgegates

`tests/fixtures/ap01a-direct-grant.synthetic.json` ist die maschinenlesbare,
vollständig künstliche Sollmatrix: D-01 bis D-11, Oktober–Dezember, Bonusgrenze,
Centstufen, Typ-/ID-/Jahresfehler, Nachweissperren, Mehrverträge und mittelbare
Fälle. Nicht-JSON-Zahlen verwenden explizite `runtimeContribution`-Testmarker,
die ausschließlich der Testrunner in NaN/±Infinity/-0/undefined/BigInt auflöst.
Der Runner prüft vollständige Centbeträge, einzelne Kinderpositionen, fehlende
Zahlen bei Sperre, Rechtsstandsmetadaten, Eingabeunveränderlichkeit, Determinismus
und einen vollständigen Cent-Sweep von 0 bis 180004 Cent ohne Rundungsoracle.

`npm run test:ap01a-direct-grant` führt eine eigene strikte TypeScript-Prüfung
einschließlich aller neuen Domänenmodule aus, dann die ausführbare Matrix.
Die eigene Typprüfung ist nötig, weil unintegrierte reine Module noch nicht vom
App-Einstieg importiert werden. Das Skript ist vorne im sequenziellen kanonischen
`npm run verify` ergänzt; alle bestehenden Gatebefehle bleiben erhalten.
Browser-/Build-Regressionen prüfen den bestehenden Appumfang; es gibt keine
neue AVD-Oberfläche und damit keinen behaupteten AVD-Browserflow.

Nicht implementiert: Alt-Riester, Partner-/Mehrvertragszuordnung (insbesondere
T-N04 bis T-N09), T-W-/T-R-/T-C-/T-E-Verfahrenslogik, Bonusberechnung, Steuern,
Produkte, Kapitalentwicklung, UI, Speicherung, allgemeine Fallverknüpfung und
Ausgabenintegration. Einzelne synthetische Gatefälle dieser Familien prüfen
nur die Abgrenzung, keine vollständige Umsetzung oder Freigabe der AP-00-Familie.
Allgemeiner Store, Schema 11, D1-Projektionen und bestehende Regressionen werden
nicht geändert. Unabhängige Projektleiter- und Reviewabnahme desselben finalen
PR-Heads bleiben erforderlich; Work gibt kein Eigen-GO und führt keinen Merge aus.
