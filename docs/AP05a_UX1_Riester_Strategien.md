# AP-05a-UX1 – Riester-Einstieg und qualitative Strategien

## Vertrag und Preflight · 17.11.2026

Freigegebener Work-Auftrag A. Basis und Live-main: `0edde578a9e3bc68b0132674dd3aa7e0809208a7`,
Tree `86018066fddce2f18cd08c2bdfef00b4b6898f35`. Frischer isolierter Clone,
sauberer Arbeitsbaum. Offene fremde PRs #43 (AUDIT ONLY) und #60 bleiben erhalten.
Git-Remote und GitHub-API am 17.11.2026 geprüft. GitHub-App mit Pushrecht,
Shell ohne GitHub-CLI-Anmeldung. D-05-API-Transport mit lokalem Originalcommit,
gleichem direkten Basisparent und vollständig identischem Tree vorgesehen.
PROJECT_STATUS ist ein historischer Checkpoint vor den integrierten #72–76.
GOV-02 und GOV-03 sind integriert, GOV-04 nicht. Volle unveränderte Push-/PR-CI
mit Verify, Browsern, R1 und Diffcheck bleibt verpflichtend.

Verbindliche private Sollquelle: Fach- und Bedienkonzept V0.5.2 vom 11.11.2026,
§§ 11–15 und S5. Die Originaldatei wird nicht ins öffentliche Repository kopiert.
**Risikoklasse kritisch:** entscheidungsrelevante Riester-Hinweise und gezielte
Invalidierung fachlicher Nachweise. Zwei unabhängige Reviews erforderlich.
Dieser Work-PR erteilt kein unabhängiges GO und erlaubt keinen Merge/Release/Deploy.

## Abgegrenzter Umfang und Schnittstelle

Neue B-Präsentationskomponenten für Bestandseinstieg, Strategien und Vergleich.
`retirement-entry.tsx` besitzt weiterhin alle flüchtigen A-/B-Entwürfe und den
bestehenden Verlustschutz. Nur B-Einhängung, B-Reset und B-Lebenszyklus ergänzen.
A-Beitragslogik und gemeinsame Komponenten bleiben unverändert. CSS nur unter
`.retirement-riester-*`. Keine neue Persistenz, Schema-, Kern-, Store-, Export-,
Build-, Workflow- oder Dependencyänderung.

Der neue Einstieg verwendet für Jahr, Beitrag und Vorjahresbetrag ausschließlich
die bestehenden OldDraft-Felder und Parser. Monatsmodus erfordert ausdrücklich
Startmonat und Monatsanzahl. Kein zweiter wirksamer Beitrag, keine gerundete
Umrechnung, kein automatischer Nullwert bei Zahlungspause. Kundenantworten zu
Anbieter, Produkt, Abschlussjahr, Zahlungen, Kindern und Partner sind getrennte
unbestätigte Selbstauskünfte. Sie bestätigen keine Fördervoraussetzungen.
Unbekannte Angaben und fehlender Vertragsauszug sperren den Zugang zu B2 nicht.
Die vorhandenen Einzelgates für tatsächliche Förderzahlen bleiben unverändert.

| Änderung | Betroffene Evidenz / Ergebnisse |
| --- | --- |
| Anbieter, Produkt, Abschlussjahr | Altvertrag/Regime und Beitragsbestätigung offen, Kinderzuordnung erneut prüfen; neues Szenario zurücksetzen; Strategieauswahlen, 4A/4B und Auszahlungsinteresse zurücksetzen, auch bei bloßer Eingabekorrektur |
| Partner/Kinder-Selbstauskunft | Betroffene Alt-Partner-/Kinderbelege offen; neue Kinderzuordnung und Szenariobestätigung offen |
| Regelmäßige Zahlung | Beitragsbestätigungen Alt/Neu offen; Beträge bleiben erhalten, Einmalzahlungen weiterhin möglich |
| Beitrag, Modus, Monatsanzahl | Bestehender Beitragsinvalidierungsvertrag, keine neuen Rechtsannahmen |
| RV-Vorjahresbetrag | Bemessungsbeleg und Alt-Gesamtbeleg offen |
| Förderjahr | Vorhandenes changeOldYear, zusätzlich Auszahlungsinteresse offen |
| Strategieauswahl, 4A/4B, Auszahlungs-Prüfinteresse | Nur qualitative Auswahl, keine Änderung der Fördermodelle oder ihrer Nachweise |
| Navigation, Öffnen der Beraterprüfung/Details | Keine fachliche Änderung; bisherige Ergebnisinvalidierung bei B1/B2-Navigation bleibt |

Alle fachlichen Eingaben und Auswahlentscheidungen aktivieren den vorhandenen
Verlustschutz. A/B-Navigation erhält getrennte Entwürfe, Neustart/Unmount/Reload
verwerfen sämtliche neuen Angaben. Abbruch des Verlustdialogs erhält sie. Auch Änderungen am Vertrags-/Regimestatus
in der Beraterprüfung setzen das Auszahlungsinteresse zurück.

## Anzeigevertrag

Genau vier gleichrangige Karten ohne Empfehlung oder Rangfolge. Karte 4 enthält
4A (Alt beitragsfrei) und 4B (Alt weiter bespart). Bis zu vier Karten auswählbar,
ab zwei Auswahlkarten qualitative Gegenüberstellung auf vier gemeinsamen Achsen.
B2-Ergebnisse werden nur als getrennte Fördermodelle bei gleichem Jahresbeitrag
wiedergegeben, niemals einer Strategie als errechneter Vorteil zugeordnet.
Auswahl einer Strategie bestätigt weder Wechsel noch Anspruch und startet keine
Berechnung. Kein Nettoaufwandsmodell, kein Steuerbetrag, kein Kapitalübertrag.
Fehlende Werte bleiben ausdrücklich offen, niemals Null oder Garantiedifferenz.

Auszahlungsform als gesonderte Queroption, auch neben Strategie 1 sichtbar.
Keine vorausgewählte Abwahl. Nur Prüfinteresse, keine bestätigte Verfügbarkeit.
Die neue Wahlmöglichkeit beginnt frühestens 2027. Das Beitragsjahr des Förderchecks
ist kein Auszahlungsbeginn und steuert keine Tarifverfügbarkeit. Anbieter, Tarif,
Abschlussjahr, Frist, Leistungsbeginn und Bedingungen bleiben
konkret zu prüfen. Änderung von Vertrag/Jahr entfernt das frühere Prüfinteresse.
Anfangsleistung, Kapitalverzehr, Leistung nach 85, Vererbung und Steuern werden
qualitativ behandelt. Keine verbindliche Vertragsentscheidung oder Garantie.

## Öffentlicher Quellenabgleich · 17.11.2026

- [DRV: Altersvorsorge-Reformgesetz](https://www.deutsche-rentenversicherung.de/DRV/DE/Rente/Moeglichkeiten-der-Altersvorsorge/Altervorsorgereformgesetz): Bestand, Förderwechsel, Übertrag und neues Regime bei Parallelverträgen.
- [BMF: Reform-FAQ](https://www.bundesfinanzministerium.de/Content/DE/FAQ/reform-der-privaten-altersvorsorge.html): Weiterführung, Regimewechsel, Wechselkosten, Auszahlung und steuerliche Grenzen. Indexinhalt verfügbar, Direktabruf 503.
- [Union: Auszahlphase](https://www.union-investment.de/unsere-services/haeufige-fragen/haeufige-fragen/frage/Wie-funktioniert-die-Auszahlphase-bei-Union-Investment): bedingte Wahl ab 2027, bisherige lebenslange Komponente ab 85, Ende der Leistung bei befristetem Plan.
- [Union: AVD-Funktionsweise](https://www.union-investment.de/familien-und-altersvorsorge/fuers-alter-vorsorgen/antworten/wie-funktioniert-das-altersvorsorgedepot): Chancen, Verlustrisiken und Garantie zum vertraglichen Auszahlungsbeginn statt laufendem Depotwert.

Kein automatisierter neuer Anspruch und keine Vertragsfreigabe aus diesen
Orientierungsquellen. Die bestehenden jahresgebundenen AP-01a/b-Regelstände
bleiben unverändert. Direktzugriff auf DRV-§52-Jahresfassung im Recherchewerkzeug
nicht verfügbar. Daher keine neue rechtliche Berechnungsregel eingeführt.

## Prüfung und Übergabe

Gezielte Browserfälle: vier Karten/4A/4B, Mehrfachauswahl, Vergleich, separate
Auszahloption ohne Ableitung des Auszahlungstermins aus dem Beitragsjahr, B2 ohne Vertragsdaten, unveränderte Förderzahlen, gezielte
Invalidierung, A/B-Isolation, Verlustdialog, Neustart/Reload, Speicherneutralität,
Tastatur/Fokus und schmale Ansichten. Bestehende AP05a-Fachtests öffnen lediglich
die neu getrennte Beraterprüfung, ihre fachlichen Assertions bleiben erhalten.
Reale menschliche Usability-Abnahme AP-07c und unabhängige Doppelabnahme offen. Automatisierte CSS-Vergrößerung ist kein menschlicher Browserzoomtest.


## Lokaler Prüfstand vor Draft-PR

Typecheck und Build erfolgreich. Playwright-Browserdownload liefert beschädigtes
Archiv. Zusätzlich geprüfter System-Chromium 156 kann wegen verweigertem
Unix-Socket im lokalen Ausführungscontainer nicht starten. Keine produktive
Schutzregel oder CI-Konfiguration dafür verändert. Lokale Browserausführung
ist damit kein Erfolgsnachweis. Autoritative Browser-/R1-Nachweise müssen aus
den beiden regulären finalen GitHub-CI-Läufen stammen.


## Präzisierung nach erster Sichtprüfung

Auszahlungsbeginn und Beitragsjahr sind unabhängig. Die Queroption bleibt ein
ungeprüftes Interesse auch bei einem Fördercheck für 2026, keine Behauptung einer
2026 verfügbaren Vertragsänderung. Kartenaktionen haben eindeutige zugängliche
Namen. Innenabstände und Buttondarstellung wurden anhand eines tatsächlichen
CI-Browserscreenshots verbessert.

Der erste Entwurf bleibt auf seinem eigenen Branch und in PR #78 erhalten.
Für den abschließenden Stand wird ein neuer Branch auf derselben beauftragten
Basis verwendet. Kein Force-Push, keine Neuschreibung oder Löschung vorhandener
Originale. PR #78 wird nach Erstellung des ersetzenden Draft-PR geschlossen.


## Gezielter Abschluss nach Browserdiagnose

Der zweite vollständige PR-Lauf ergab 636/638 erfolgreich, ohne Skips oder Flakes.
Zwei verbliebene Befunde werden gezielt korrigiert:

- Bei 375 px und 200-%-Vergrößerung können lange Überschriften/Wörter außerhalb
  der Karten den Dokumentrand überschreiten. Nur die B-Ansicht erhält vererbten
  Wortumbruch, einschließlich ihrer Hauptüberschrift. Keine versteckte
  Overflow-Unterdrückung, die abgeschnittene Inhalte kaschiert.
- Ein bewusst abgebrochener Reload garantiert keinen bestimmten Playwright-
  Fehlertext. Der Test beobachtet stattdessen den tatsächlichen beforeunload-
  Dialog, dessen Abbruch, dieselbe erhaltene Dokumentidentität und die erhaltene
  Strategieauswahl. Der anschließende bestätigte Reload muss sie verwerfen.
  Kein erhöhter Timeout, kein Skip und keine Änderung am Produkt-Verlustschutz.

Auch der zweite Entwurf samt PR #80 bleibt als Original erhalten. Der erneute
abschließende Snapshot liegt auf einem neuen Branch direkt auf der beauftragten
Basis. Seine vollständigen regulären Push-/PR-Gates bleiben erforderlich.


## Doppelreview-Nachbesserung AP05a-R1-01 / R2-01 · 17.11.2026

Eng begrenzter Folgefix auf Feature-Head `ac85e2e3d2cc320773e4f322180517fc9f18bfb3`,
Base `3027ef194fec4e15f75015d1b8030b1e58a91ec9`. main ist erneut unverändert
bestätigt. Bestehender Branch und Draft-PR #82 werden ohne Rebase/Force-Push
fortgeschrieben. Die früheren Originale bleiben erhalten. Aktuell gelten die
über main übernommenen GOV-04-Gates: schnelle Push-CI, vollständige PR-CI mit
verpflichtendem Abschlussjob. Frühere Preflight-/CI-Angaben oben sind historisch.

### Verbindlicher Anzeigetext zu Strategie 4

Ein tatsächlicher Abschluss eines weiteren zertifizierten Altersvorsorgevertrags
ab 2027 löst die neue Förderung einheitlich für alle Altersvorsorgeverträge
derselben zulageberechtigten Person aus. Das ist keine bloße Möglichkeit.
Karte, Varianten 4A/4B und qualitative Gegenüberstellung verwenden dieselbe
fachliche Aussage. Die bloße Strategieauswahl in der Anwendung schließt keinen
Vertrag ab und ändert keine Förderung.

Bei 4A kann das vorhandene Vertragsvermögen mit vertraglichen Rechten im
beitragsfreien Altvertrag erhalten bleiben, während die Förderregeln umgestellt
werden. Bei 4B sind beide Beitragsströme nach einheitlichem neuem Förderrecht
und personenbezogenen Zulagengrenzen zu betrachten. Weitere Altverträge sowie
gegebenenfalls ein mittelbar zulageberechtigter Ehegatte und dessen Zulagenantrag
sind Prüfpunkt. Förderwechsel, Kapitalübertrag und vertragliche Garantie sind
getrennte Sachverhalte. Keine individuelle Förder-/Steuer-/Wechselberechnung.

Maßgeblich ist [§ 52 Abs. 50a Sätze 6–9 EStG ab 01.01.2027](https://rvrecht.deutsche-rentenversicherung.de/SharedDocs/rvRecht/05_Normen_und_Vertraege/02_C-K/EStG/0052/0052_2027_01_01.html).
Erneuter amtlicher Abgleich am 17.11.2026: DRV-Jahresfassung Version 003.00 über
die amtliche URL mit `?nn=1504386` erfolgreich gelesen, einschließlich Satz 8
zum mittelbaren Ehegatten und Satz 9 zum Bestandsvertragsstatus. Der Direktaufruf
ohne diesen Navigationsparameter war im Recherchewerkzeug gesperrt. Die
[DRV-Reforminformation](https://www.deutsche-rentenversicherung.de/DRV/DE/Rente/Moeglichkeiten-der-Altersvorsorge/Altervorsorgereformgesetz)
bestätigt die automatische Anwendung bei zusätzlichem Neuabschluss. BMF-FAQ
weiterhin Direktabruf 503. Keine Änderung an den vorhandenen Rechenkernen.

### Vertragsidentität und Reset

Nur Änderungen von Anbieter, Produkt oder Abschlussjahr setzen `selected`,
`variant` und `payout` zurück. Das umfasst jede echte Wertänderung einschließlich
Korrektur/Leeren, ohne automatische Tippfehlererkennung. Der sichtbare Hinweis
nennt Grund und Umfang. Gleicher Wert, andere B-Eingaben oder reine Navigation
lösen keinen zusätzlichen Strategie-Reset aus. Bestehende Evidenzinvalidierung
bleibt erhalten. Andere B-Angaben und der unabhängige A-Entwurf bleiben erhalten.
Kein zusätzliches Vertragsmodell und keine Persistenz.

### Gezielte Nachweise und Abnahmegrenze

Bestehende Fälle bleiben bestehen. Ergänzt werden Rechtsfolgen 4A/4B in Karte
und Vergleich, alle drei vertragsidentifizierenden Felder mit beiden Varianten,
Erhalt anderer B-/A-Eingaben und Evidenzinvalidierung sowie ausdrücklich 1280
CSS-Pixel zusätzlich zu 375/768/1440. CSS-Vergrößerung wird nur als automatisierte
Layoutprüfung bezeichnet. Echter menschlicher Browserzoom und Usability bleiben
AP-07c vorbehalten. Beide Reviewer müssen den vollständigen neuen Head erneut
mit GO abnehmen. Work erteilt kein unabhängiges GO.
