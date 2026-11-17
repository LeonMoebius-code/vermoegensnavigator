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
| Anbieter, Produkt, Abschlussjahr | Altvertrag/Regime und Beitragsbestätigung offen, Kinderzuordnung erneut prüfen; neues Szenario zurücksetzen; Auszahlungsinteresse zurücksetzen |
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
Vor 2027 kein auswählbares Abwahl-Prüfinteresse für dieses Beitragsjahr. Ab 2027
bleiben Anbieter, Tarif, Abschlussjahr, Frist, Leistungsbeginn und Bedingungen
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
Auszahloption/2026, B2 ohne Vertragsdaten, unveränderte Förderzahlen, gezielte
Invalidierung, A/B-Isolation, Verlustdialog, Neustart/Reload, Speicherneutralität,
Tastatur/Fokus und schmale Ansichten. Bestehende AP05a-Fachtests öffnen lediglich
die neu getrennte Beraterprüfung, ihre fachlichen Assertions bleiben erhalten.
Reale menschliche Usability-Abnahme AP-07c und unabhängige Doppelabnahme offen.


## Lokaler Prüfstand vor Draft-PR

Typecheck und Build erfolgreich. Playwright-Browserdownload liefert beschädigtes
Archiv. Zusätzlich geprüfter System-Chromium 156 kann wegen verweigertem
Unix-Socket im lokalen Ausführungscontainer nicht starten. Keine produktive
Schutzregel oder CI-Konfiguration dafür verändert. Lokale Browserausführung
ist damit kein Erfolgsnachweis. Autoritative Browser-/R1-Nachweise müssen aus
den beiden regulären finalen GitHub-CI-Läufen stammen.
