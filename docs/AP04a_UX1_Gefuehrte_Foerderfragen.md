# AP-04a-UX1 – Anzeige- und Invalidierungsvertrag

Festlegung vor Produktänderung: 11.11.2026. Grundlage: freigegebene Fortsetzung
des UX1-Pakets nach Feld-STOP; Konzept V0.5.2, S1/S2 und M1/M2.
READ-ONLY bestätigt: main `e444d612d5ba5194d2816a592603744e4234aee3`, Tree
`44cfbe81202f6676712e5f49c9051e662a0caa86`, V0.18.5 / Schema 11.
Offene fremde Drafts #43 und #60 bleiben unberührt. PROJECT_STATUS enthält
noch den historischen Stand vor #70. Kein eigener Merge oder Release.

## Architektur und erlaubte Zusatzfläche

Ein neuer lokaler UI-Typ und die Präsentationskomponente
`retirement-questions.tsx` bündeln den Fragebogen, seine reinen Anzeigeregeln,
die gezielte Evidenzinvalidierung und öffentliche Orientierungstexte.
Besitzer aller Antworten ist die bestehende RetirementEntry. Diese zusätzliche
Datei ist notwendig, um den unabhängigen Fragezustand von CustomerPlan,
GrantDraft und den Berechnungsverträgen zu trennen. Kein persistenter Store,
kein A/B-Personenmodell, keine Algorithmus-/Schemaänderung. Navigation und
Detailöffnung sind keine fachlichen Antworten. Initial sind alle Antworten leer;
die bestehende Kapitalmodell-Voreinstellung ist eine sichtbar bezeichnete
Modellannahme und keine beantwortete Förderfrage.

## Quellen und vorläufige Anzeigeregel

Am 11.11.2026 erneut gelesene öffentliche Primärquellen:

- [§ 10a EStG 2027](https://rvrecht.deutsche-rentenversicherung.de/SharedDocs/rvRecht/05_Normen_und_Vertraege/02_C-K/EStG/0010a/0010a_2027_01_01.html), Absatz 1 Satz 1, Version 003.00.
- [§ 10a EStG 2028](https://rvrecht.deutsche-rentenversicherung.de/SharedDocs/rvRecht/05_Normen_und_Vertraege/02_C-K/EStG/0010a/0010a_2028_01_01.html), Absatz 1 Satz 1, Version 002.00.
- [§ 84 EStG 2027](https://rvrecht.deutsche-rentenversicherung.de/SharedDocs/rvRecht/05_Normen_und_Vertraege/02_C-K/EStG/0084/0084_2027_01_01.html), [§ 85 EStG 2027](https://rvrecht.deutsche-rentenversicherung.de/SharedDocs/rvRecht/05_Normen_und_Vertraege/02_C-K/EStG/0085/0085_2027_01_01.html), [§ 86 EStG 2027](https://rvrecht.deutsche-rentenversicherung.de/SharedDocs/rvRecht/05_Normen_und_Vertraege/02_C-K/EStG/0086/0086_2027_01_01.html).
- [BMF-FAQ](https://www.bundesfinanzministerium.de/Content/DE/FAQ/reform-der-privaten-altersvorsorge.html): amtlicher Suchinhalt zu Förderkreis, Sonderfällen und Höchstbeitrag verfügbar; Direktabruf zeitweise 503. Keine alleinige rechtliche Basis der positiven Arbeitnehmeranzeige.
- [Union: Funktionsweise](https://www.union-investment.de/familien-und-altersvorsorge/fuers-alter-vorsorgen/antworten/wie-funktioniert-das-altersvorsorgedepot): öffentliche Fassung Oktober 2026 erneut gelesen; Fondsauszahlplan, Steuern, Risiken. Keine internen Produktunterlagen.

**P** bezeichnet exakt den Text: „Nach Ihren Angaben kommt eine staatliche Förderung
grundsätzlich infrage. Die endgültige Berechtigung und Förderhöhe müssen noch
geprüft werden.“ Die Kurzmarke lautet „Förderung grundsätzlich denkbar“.
**O** bezeichnet „Weitere Angaben erforderlich“. Hinzu kommt immer der konkrete
unten genannte Text und nächste Prüfschritt. Die Anzeige ist kein Rechtsnachweis.

Eine positive Anzeige setzt ausschließlich voraus: gewähltes Jahr 2027 oder 2028,
identisch mit dem wirksamen Zahlungsstartjahr, und ausdrücklich gewählte
Beschäftigung in der inländischen gesetzlichen Rentenversicherung mit
Versicherungspflicht. Für alle anderen Konstellationen erfolgt in UX1 keine
negative Anspruchsklassifikation. Insbesondere sind Selbstständige, Beamte,
Pflege-/Erziehungs- und Partnerfälle nicht pauschal ausgeschlossen. Neue
Förderjahre nach 2028 werden nicht aus alten Fassungen fortgeschrieben.

## Mappingmatrix (verbindlich vor Implementierung)

Alle genannten Antwortwerte gehören nur zum lokalen Fragezustand. „Leer“ ist
unbeantwortet, „unknown“ eine ausdrückliche Unsicherheit. Keine Antwort setzt
`funding=checked` oder irgendeinen positiven rechtlichen Bestätigungswert.

| Kundenfrage / Optionen | UI-Wert | Vorstatus und tatsächlicher Zusatztext | Offen / nächste Aktion | Verbotener Übergang |
| --- | --- | --- | --- | --- |
| Erstes Beitragsjahr / frei oder offen | year: leer, vierstellig | O bei offen: „Bitte wählen Sie das Beitragsjahr für die Förderorientierung.“ | Jahr wählen; Weiterrechnen ohne persönliche Förderzahl möglich | Kein automatischer Regel-/Vertragsnachweis |
| Jahr 2027/2028 | year + Zahlungsstart | P nur zusammen mit employee; sonst konstellationsbezogen O | Jahr, Person, Vertrag und Beitrag fachlich prüfen | Kein confirmed durch Jahreswahl |
| Jahr vor 2027 | year | O: „Die neue Förderung beginnt erst ab 2027. Für dieses Jahr wird keine neue AVD-Förderung zugesagt.“ | Startjahr oder vorhandenen Riester prüfen | Keine falsche Verfügbarkeit |
| Jahr nach 2028 | year | O: „Für dieses Beitragsjahr ist hier noch kein geprüfter Förderregelstand hinterlegt.“ | Jahresrecht mit Berater prüfen | Keine Fortschreibung der Förderformel |
| Geburtsjahr / frei oder offen | bestehendes birthYear | Keine eigenständige positive/negative Klassifikation | Bonus/Altersgrenzen gesondert prüfen | Keine Bonus-/Personenbestätigung |
| Beruf: angestellt und inländisch gesetzlich rentenversicherungspflichtig | employment=employee | P in 2027/2028 | Versicherungspflicht für Person/Jahr, Vertrag, Eigenbeitrag und gegebenenfalls Kinder prüfen | Kein direct_confirmed |
| Beruf: verbeamtet | employment=civil | O: „Bei Beamten prüfen wir die begünstigte Besoldungs-/Versorgungssituation und die erforderliche Einwilligung zur Datenübermittlung.“ | Nachweis/Einwilligung mit zuständiger Stelle prüfen | Kein direct_confirmed, kein ineligible |
| Einwilligung: Ja/Nein/unsicher | civilConsent=yes/no/unknown | O bleibt; Antwort allein belegt nicht sämtliche Beamtenvoraussetzungen | Besoldung und wirksame Einwilligung prüfen | Kein positiver Beleg |
| Beruf: selbstständig/freiberuflich | employment=self | O: „Auch Selbstständige können zur Förderung gehören. Wir prüfen Versicherung, Versorgungseinrichtung und gegebenenfalls Einkünfte und Steuererklärung.“ | Konkrete Jahresvoraussetzungen prüfen | Kein ineligible aus Berufsbezeichnung |
| Beruf: nicht erwerbstätig | employment=none | O: „Ohne Erwerbstätigkeit können Versicherungszeiten oder eine Partnerberechtigung relevant sein.“ | Zusätzliche Zeiten und gegebenenfalls Partner prüfen | Keine Verneinung eines mittelbaren Anspruchs |
| Beruf: andere/unsicher | employment=other | O: „Bitte klären Sie Ihre konkrete Versicherungssituation für das Beitragsjahr.“ | Versicherungsauskunft prüfen | Keine erfundene Klassifikation |
| Versicherung: Pflichtversicherung/Versorgungseinrichtung/keine/unsicher | insurance=statutory/professional/none/unknown | O bleibt bei Sonderfällen | Jeweils tatsächliche Versicherung/gesetzliche Zusatzvoraussetzung prüfen | Keine Gleichsetzung Pflichtmitgliedschaft und geprüfter Anspruch |
| Zusätzliche Zeiten: Kindererziehung, Pflege (Mehrfachauswahl) | upbringing, care | P des employee bleibt vorläufig P; sonst O des Sonderfalls | Zuordnung der Erziehungszeiten bzw. Versicherungsvoraussetzungen der Pflege prüfen | Keine gegenseitige Ausschließung mit Beruf; keine Bestätigung |
| Keine weiteren / gemeinsam prüfen | additions=none/unknown | Hauptlage entscheidet; bei unknown zusätzlich konkrete offene Zeiten | Rentenversicherungsträger befragen | Keine Negativklassifikation |
| Partnerschaft Ja/Nein/unsicher | married=yes/no/unknown | O für nicht direkt orientierbare Fälle | Bei Ja dauernde Trennung und direkte Partnerberechtigung prüfen | Kein indirect oder direct_confirmed aus Ehe |
| Getrennt und Partner förderberechtigt: Ja/Nein/unsicher | separated, partner | O; „Partnerberechtigung und weitere Voraussetzungen der mittelbaren Förderung gemeinsam prüfen.“ | Eigener Vertrag/Mindestbeitrag und alle Ehegattenvoraussetzungen prüfen | Keine Partnerformel/keine pauschale Ablehnung |
| Riester vorhanden Ja/Nein/unsicher | riester=yes/no/unknown | Unabhängiger Hinweis bei Ja/unsicher: „Ein neuer Fördervertrag kann die Förderung Ihres bestehenden Vertrags beeinflussen.“ | B-Bereich ohne Datenübertrag erreichbar | Kein new_confirmed, single_eligible_confirmed oder stiller Wechsel |
| Kindergeld Ja/Nein/unsicher | childBenefit=yes/no/unknown | Eigenständiger offener Kinderhinweis, kein gesicherter Kinderbetrag | Tatsächlichen Jahresanspruch und zulässige Zuordnung je Kind prüfen | Nein erzeugt kein none_confirmed; Ja kein eligible_assigned_confirmed |

Unbeantwortete/unklare Kinder und Riesterangaben verhindern die Orientierung P
zur grundsätzlichen Personenkreis-Nähe nicht, bleiben jedoch ausdrücklich als
offene Einzelschritte sichtbar. Keine Vorstatusanzeige erlaubt eine Förderzahl.
Kindergeld Ja öffnet lediglich die vorhandene Kinder-Prüfansicht (`children=yes`);
Nein/unklar lässt `children=unknown`. Beides entzieht frühere Kinderzuordnung.

## Invalidierungsmatrix (verbindlich vor Implementierung)

Nur echte Wertänderungen invalidieren. Gleiche Werte, Zurück/Weiter und
Detailöffnung verändern keine Nachweise. Beim Verbergen einer Folgefrage bleiben
deren Antworten erhalten; die Anzeigeregel berücksichtigt nur die aktuelle Hauptlage.

| Änderung | Entzogene persönliche Evidenz | Erhalten / Begründung |
| --- | --- | --- |
| Erwerb, Versicherung, Beamteneinwilligung, Erziehung, Pflege, Zusatzzeiten | entitlement=unconfirmed; contributionConfirmed=false | Regime, Vertrag und unabhängige Kinderprüfung; Förderzahl dadurch gesperrt |
| Ehe/Trennung/Partner | entitlement=unconfirmed; contributionConfirmed=false; childrenStatus=unconfirmed und Kinderstatus assignment_unconfirmed | Regime/Vertrag; Partner kann Zuordnung beeinflussen |
| Riesterbestand | regime=unconfirmed; contract=unconfirmed; contributionConfirmed=false; Kinderzuordnung offen | Persönliche Erwerbsevidenz; keine fiktive Vertragsidentität |
| Manuelle Korrektur von geprüftem Regime oder Vertrag in der Kunden-Beraterprüfung | contributionConfirmed=false; childrenStatus=unconfirmed und alle Kinder assignment_unconfirmed | Die ausdrücklich bearbeitete Bestätigung erhält nur den bewusst gewählten Wert; andere unabhängige Nachweise und Kapitalhypothesen bleiben erhalten |
| Manuelle Korrektur der geprüften Berechtigung in der Kunden-Beraterprüfung | contributionConfirmed=false | Bearbeiteter Berechtigungswert ist eine ausdrückliche fachliche Aktion, kein Kundenantwort-Mapping |
| Kindergeldantwort / Kinderzuordnung | childrenStatus=unconfirmed; alle Kinder assignment_unconfirmed | Direkte Berechtigung, Regime, Vertrag, eigener Beitrag; keine leere bestätigte Liste |
| Fragejahr ändert sich (auch zu leer/ungültig) | Alle persönlichen GrantDraft-Nachweise über changeYear; bei gültigem Jahr gleicher Zahlungsstartjahr-Wechsel über editCustomerCapital | Keine Vermischung mit B; ungültiges Jahr bestätigt nie etwas |
| Wirksames Zahlungsstartjahr / Geburtsjahr | Vorhandenes changeYear-Verhalten: alle persönlichen Jahres-/Personenbelege offen | Keine neue Bonuslogik |
| Rate, Startmonat, Laufzeitende, eigene Einmalzahlung/Datum | Vorhandenes editCustomerCapital vollständig; Beitrag bei geändertem Jahressnapshot offen | PR-#69-Zweig unverändert; keine zweite Rate |
| Reine Marktannahmen | Vorhandenes editCustomerCapital; persönliche Beitragsbestätigung unverändert, solange Jahressnapshot gleich | Keine neue fachliche Invalidation |
| Ausdrückliche Kosten-/Einzelzulagenhypothese | Vorhandener gesonderter Checkboxzweig | Getrennte Hypothesenbelege nicht mit persönlichem Anspruch verwechseln |

Fragebogenänderungen alleine ändern keine Kapitalparameter und lassen explizite
Kosten-/Zulagenhypothesen erhalten. Tatsächliche Zahlungs-/Jahresänderungen
verwenden dagegen weiterhin den vollständigen unveränderten Adapter, auch wenn
er Kapitalhypothesen entzieht. Ein vorläufiger positiver Anzeigestatus übersteht
keine Änderung zu einem nicht belegbaren Standardfall.

## Beispiel und Nutzungsgrenzen

S1 zeigt ausschließlich das feste bedingte 2027-Beispiel: 30 €/Monat über zwölf
Monate = 360 € Eigenbeitrag; 180 € mögliche Grundzulage; 540 € Zufluss ohne Kind,
mit einem tatsächlich zugeordneten förderfähigen Kind +300 € = 840 €. Kein Bonus
oder Steuervorteil addiert. Keine Beispielzahl wird als Eingabe übernommen.
Neutrale Kapitalmodellierung bleibt unabhängig erreichbar. Die alte fachliche
Prüfung ist als Detail erreichbar, keine offene Selbstauskunft hebt ihre Gates auf.

## Abnahmegrenzen und Nachweise

Neue Prüfungen unter tests/browser laufen im vorhandenen vollständigen Gate.
Vorhandene Kunden-UI-Tests erhalten den neuen Einstieg und sichtbare Fragen;
ihre wirtschaftlichen Assertions, insbesondere #69, bleiben erhalten.
Desktop/Mobil 375/768/1280, 200-%-Zoom, Fokus, Fehler, getrennte Antworten,
Navigations- und Verlustschutz sind zu prüfen. Reale fachfremde/beraterseitige
Nutzungsabnahmen sind ausstehend und werden nicht durch automatisierte Tests
ersetzt. Beide vollständigen neuen CI-Nachweise bleiben Pflicht; fehlende
Originallogs bedeuten Nachweis-HOLD, nicht Testfehlschlag.

## Abschlussnachtrag S2 / R71-01 · 16.11.2026

Dieses reguläre Featurepaket ergänzt ausschließlich den Anzeige- und Bedienvertrag
auf main `e828095c46ced07735ca7f7a6c902344e16be2ca`. PR #71 ist bereits integriert.
Die obigen Mapping- und Invalidierungsmatrizen bleiben unverändert wirksam.

### Jahreskonflikt R71-01

Bei ausdrücklich gewähltem Beitragsjahr 2027 oder 2028 und abweichendem wirksamem
Zahlungsstartjahr lautet die Orientierung:

> Das gewählte Beitragsjahr stimmt nicht mit dem Beginn Ihres Sparplans überein.
> Bitte prüfen und korrigieren Sie die Jahresangaben, bevor wir Ihre persönliche
> Förderung für dieses Jahr beurteilen.

Nächster Prüfschritt: Beitragsjahr und Zahlungsstartjahr gemeinsam prüfen und die
abweichende Jahresangabe korrigieren. Kein positives oder negatives Anspruchsurteil,
keine automatische Jahreskorrektur. Leere/ungültige Jahre, Jahre vor 2027 und nach
2028 behalten ihre bisherigen Meldungen. Bei gleichen unterstützten Jahren bleibt
die bestehende Arbeitnehmer-/Sonderfallorientierung unverändert. Einziger fachlicher
Anzeigeursprung bleibt `fundingOrientation`, auch in der Zusammenfassung.

### Tatsächliche Fragenfolge

| Abschnitt | Inhalt / Sichtbarkeit |
| --- | --- |
| Zeitraum und Person | Beitragsjahr, optionales Geburtsjahr; bisherige feldbezogene Validierung |
| Erwerb und Versicherung | Bestehende Hauptsituation und unabhängig kombinierbare Erziehungs-/Pflegezeiten |
| Besondere Voraussetzungen | Nur bei Beamten oder self/none/other; unveränderte Einwilligungs-, Versicherungs- und Partnerbedingungen |
| Bestehende Vorsorge und Kinder | Bestehender Riester-Vertrag einschließlich B-Einstieg und Kindergeldfrage |
| Ihre erste Orientierung | Eigene relevante Antworten, offene Angaben, bestehende Förderorientierung und nächste Prüfungen |

Im Standardpfad gibt es vier Abschnitte, im Sonderfall fünf. Die Gliederung folgt
der fachlichen Abhängigkeit: Hauptsituation vor bedingten Nachfragen, eigene
Vertrags-/Kinderangaben vor der abschließenden Einordnung. Keine zusätzlichen
fachlichen Felder. Fortschritt zählt die tatsächlich relevanten Abschnitte und
markiert den aktuellen mit `aria-current=step`. Weiter/Zurück und Abschnittswahl
sind Tastaturbuttons. Schrittwechsel fokussiert die Abschnittsüberschrift;
ungültige Jahres-/Geburtsangaben fokussieren das betroffene Feld im ersten Abschnitt.
Offene Angaben bleiben zulässig. Der bestehende direkte Button zum eigenen
Sparplan ist weiterhin in jedem Abschnitt verfügbar. Er erlaubt neutrale Planung
bei offener persönlicher Förderung; er bestätigt keine übersprungenen Antworten.

Antworten bleiben ausschließlich im bisherigen RetirementEntry-State. Der lokale
Abschnittsindex besitzt weder Antworten noch Nachweise. Rückkehr aus Kundenplanung,
Einführung oder B startet die Fragenanzeige wieder im ersten Abschnitt und erhält
die Antworten. Ausgeblendete Antworten bleiben erhalten; die Zusammenfassung zeigt
nur die aktuell relevanten Folgeangaben. Weder Aus-/Einblenden noch reine Navigation
bestätigt oder invalidiert Evidenz. Nur tatsächliche Wertänderungen verwenden die
bestehenden Handler und die unveränderte gezielte Invalidierungsmatrix.

Fach-/Bedienkonzept V0.5.2 §2/§3 und Bildschirmkonzept V0.5.2 S2/M2 wurden außerhalb
des öffentlichen Repositorys eingesehen. Dieser Nachtrag setzt die freigegebene
begrenzte S2-Nachbesserung um, keine vollständige Konformität mit sämtlichen Funktionen
des Gesamtkonzepts. Insbesondere bleiben umfassende Kindererfassung, alternative
Vorstatusklassen und weitere A-/B-Funktionen außerhalb dieses Pakets.

### Regressionen und Grenzen

`ap04a-s2-closeout.spec.ts` ergänzt die Jahreskonfliktmatrix und echte geführte
Standard-/Sonderfall-, Partner-, Beamten-, Kindergeld-, Validierungs- und Rückwege.
`ap04a-ux1-guided.spec.ts` erhält ausschließlich notwendige Abschnittsnavigation
und zusätzliche Beweise zum Erhalt bereits bestätigter Förderung. Bestehende
wirtschaftliche Assertions bleiben erhalten. Die bisherigen UX03-/PR69-Tests
können den unverändert erlaubten direkten neutralen Einstieg weiter benutzen.

Die finalen vollständigen Push-/PR-Gates und Originalcheckout-Belege gehören in
identische externe Abnahmeunterlagen. Automatisierte responsive Ansichten und
CSS-Zoom bleiben technische Regressionen. R71-02 und die menschliche AP-07c-Abnahme
bleiben offen. Kein unabhängiges GO, Merge, Release oder Deployment durch Work.
