# UX-03a/03b – Kundenstrecke und Zahlungsplan

## Technische Festlegung vor Implementierung · 02.11.2026

Freigegebenes Paket: verständliche Kundenfragen, gemeinsame geplante Sparrate,
drei echte Kernelkurven, separate fachliche Prüfung. Basis `70cd8841d9d04d9b9e9de75213b7a6e210a3f78b`,
Tree `8345eb6e7ffc3a322017e2845d70f4854af48a7a`, V0.18.4 / Schema 11.
Live-main und offene PRs #43/#60 erneut lesend bestätigt; kein konkurrierendes UX-Paket.
PROJECT_STATUS enthält ältere Checkpoints und ist keine aktuelle Integrationsliste.
Rolle Work: kein eigenes GO, Merge, Release oder Deployment.

### Gemeinsame Datenquelle A2 → A4

Die Kundenstrecke besitzt genau einen flüchtigen geplanten Zahlungsplan:
`capital.monthly`, `capital.start`, `capital.end` und optional einen datierten
Eigen-Einmalbeitrag. Es gibt keinen zweiten editierbaren A2-Beitrag. Der A2-Adapter
erhält eine abgeleitete monatliche GrantDraft: Beitragsjahr = Startjahr,
Monatsanzahl = tatsächlich im ersten Kalenderjahr bis einschließlich Zielmonat
geplante Monate. Späterer Jahreswechsel setzt die laufende Rate fort; keine
automatische Jahresbetrag/12-Konversion. Der Monatskern erhält denselben Start,
dieselbe Rate und dasselbe Ende ohne Veränderung seiner Monatsendkonvention.
Eine Einmalzahlung zählt in A2 ausschließlich im ersten Beitragsjahr und nur
innerhalb der Modelllaufzeit; A4 bekommt das datierte Ereignis genau einmal.
Anfangskapital ist kein neuer Eigenbeitrag. Geplante Beiträge sind keine Istbuchung.

Ungültige Zeit-/Betragsangaben werden lokal erklärt. Unklare Rechtsverhältnisse
verhindern allein die betroffene Förderzahl, nicht das unabhängige Kapitalmodell.
Geburtsjahr dient nur der Orientierung: weder Bonus, Berechtigung noch tatsächlicher
Rententermin werden daraus abgeleitet. Zielmonat ist ausdrücklich ein Modellziel.

### Nachweise und Ergebniszustand

Die Kundenantwort „geklärt“ ersetzt keinen Nachweis. Berechtigung, Regime, Vertrag,
Kinderzuordnung und förderfähiger Eigenbeitrag bleiben in einer geschlossenen
Beraterprüfung mit den unveränderten AP-04a/AP-01a-Sperren. Jede Änderung der
Zahlungsdaten entzieht die Beitragsbestätigung; Personen-/Jahreswechsel entzieht
zusätzlich die person-/jahresbezogenen Bestätigungen. Änderungen an der
Kinderantwort entziehen die Kinderprüfung. Unklare Kinder werden nie zu einer
bestätigten leeren Liste. Bonus bleibt ohne Betrag offen.

Der Button zur unverbindlichen Modellrechnung ersetzt allein die routinemäßige
UI-Snapshot-Checkbox (`CapitalDraft.confirmed`). Dieser Präsentationsschalter ist
kein Domain-Nachweis. Kosten- und manuelle Einzelzulagenbestätigungen bleiben
gezielt in der Prüfansicht und werden nicht automatisch gesetzt. Alle Domainquellen
bleiben hypothetische Modellannahmen; keine erfundene confirmed-Quelle.
Es gibt keinen A2-Zulagenübertrag und keine Fortschreibung von Förderzahlen.
Das Kapitalmodell wird ausdrücklich ohne automatisch angerechnete Förderzulagen
berechnet. Manuelle Einzelereignisse bleiben als Hypothesen erkennbar.

### Kurven und Details

Szenariowerte werden ausschließlich aus ProjectionResult.ledger übernommen:
Monatsendwerte bei detailed, echte Blockendwerte bei compact. SVG-Koordinaten
skalieren nur diese Werte; keine neue Finanzformel, Glättung oder Zwischenwerte.
Die Einzahlungslinie addiert ausschließlich originale Ganzzahl-Cent-Cashflows
des Ledgers. Gesperrte Trajektorien werden nicht gezeichnet; partial wird als
Teilszenario bezeichnet. Eine zugängliche Tabelle enthält tatsächliche Ledgerpunkte.
Der optionale Referenzvergleich verwendet compareRetirement mit identischen
Eigenzahlungen und Terminen; keine Netto-/Steuerüberlegenheit.

Die bisherigen eigenständigen Fachformulare bleiben als ausdrücklich bezeichnete
separate Diagnose-/Prüfansicht für bestehende Regressionen verfügbar. Sie sind
kein zweiter Eingabeschritt der Kundenstrecke und übertragen keine Bestätigungen
in deren Zahlungsplan. B1/B2, Domain, bestehende Tests, Workflows, Version, Schema,
Persistenz, allgemeine Fälle und Exporte bleiben unverändert. Alle Entwürfe sind
flüchtig; der bestehende Verlustschutz gilt auch für die Kundenstrecke.

## Nachweise

Neue Adapter-/Browserprüfungen: gemeinsame Beiträge/Teiljahr/Einmalzahlung,
Statusgrenzen/Invalidierung, Originalledgerpunkte, U1/U2, Tastatur, Mobil/Desktop,
Verlustschutz und Speicherisolation. Bestehende Regressionen werden unverändert
im vollständigen Gate ausgeführt. Finale Git-/CI-Identitäten und Originallogs
gehören in dasselbe externe Paket für beide unabhängigen Abnahmen.
