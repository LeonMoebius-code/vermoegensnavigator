# AP-04b – A3 Produktvergleich und A4 Kapitalentwicklung

## Preflight vor Implementierung · 29.10.2026

Frisch bestätigter main `1303ca25776389f0cef1557ae9062a22914f8378`, Tree
`27fbb1235fb37a82525ab85b5f7230edc8c6383e`, Version 0.18.4 / Schema 11.
AP-03a/#65 ist integriert; sein Vertrag bleibt bytegleich mit SHA-256
`c1546f4dcecc6b7172c8f9404d46ddb9bc32a740fab9a26bfabec7f84f01a9d2`.
Der ältere PROJECT_STATUS-Checkpoint ist überholt. Offene #43 und #60 sowie
lokale Originale bleiben geschützt. Sauberer neuer Worktree auf diesem main;
autorisierter API-Transport nach lesend bestätigtem Pushrecht. Kein eigenes GO.

Geplanter enger Diff: RetirementEntry als flüchtiger Lebenszyklus, neuer
`projection-adapter.ts`, getrennte neue `retirement-products.tsx` und
`retirement-projection.tsx`, ausschließlich `.retirement-*`-CSS-Ergänzungen,
zwei neue `ap04b-*.spec.ts` und diese Datei. Die Komponenten trennen öffentliche
qualitative Produktinformationen von neutralen Annahmen und Ergebnissen und
halten den unveränderten B1/B2-Teil aus dem neuen Formular heraus.

Keine Änderung an Domain, AP-03a-Vertrag/Oracle, AP-01a/b, A1/A2-/B1/B2-Adaptern,
allgemeinem Fall/Store/Export/Druck/Backup, Produktkatalog, Schema, Version,
Abhängigkeiten oder CI. Kein Release oder Deployment.

## A3: öffentlich geprüfte Ankündigung, keine Angebotsrechnung

Öffentliche Herstellerseite, erneut direkt geprüft am 29.10.2026:
[Union Investment – Altersvorsorgedepot](https://www.union-investment.de/familien-und-altersvorsorge/fuers-alter-vorsorgen/altersvorsorgedepot).
Ergänzende öffentliche Ankündigung:
[Pressemitteilung vom 11.05.2026](https://unternehmen.union-investment.de/presseservice/aktuelles/pressemitteilungenarchiv/alle-pressemitteilungen/2026/univorsorge).

Qualitative Einordnung: Basis ETF-orientiert, Pro aktiv und aktienbetont,
Garantie mit angekündigter Absicherung der Beiträge und Zulagen zum Ende der
Ansparphase. Dies sind Herstellerankündigungen, keine individuelle Tarifzusage.
Konkrete Gesamtkosten, Fondslisten und vollständige Steuerungsverfahren sind
nicht hinreichend für eine Angebotsrechnung bestätigt. Kosten bleiben sichtbar
offen. Interne Indikationen und Preise aus Sekundärquellen werden nicht benutzt.
Keine Sicherungs-/Ablaufmechanik wird simuliert. Höchstens zwei qualitative
Detailkarten sind auswählbar; keine Rangliste oder automatische Empfehlung.

A3-Auswahl ist kein Parameter der AP-03a-Anfrage. Jede Produktänderung entwertet
eine A4-Anzeige, ohne deren Rechenannahmen in Produktdaten umzudeuten.

## A4: explizite UI-Annahmen und kanonische Domainanfragen

Ein begrenzter Präsentationsadapter liest einen primitiven JSON-Snapshot mit
geschlossener UI-Feldliste. Fremde Objekte, falsche Typen, mehrdeutige JSON-
Schreibweisen und ungültige Eingaben erhalten feldbezogene Fehler. Eurobeträge
werden mit dem unveränderten deutschen BigInt-Centparser aus AP-04a verarbeitet;
Prozentwerte werden durch exakte dezimale Einheitenumrechnung zu Decimal-Strings.
Keine Float-Rundung, keine neue Kapital- oder Förderformel.

Alle benötigten Bindings und eine ausdrücklich hypothetische model_assumption
werden erzeugt. PROJECTION_VERSIONS wird importiert, nicht nachgebaut. Quelle:
`ap04b-ui-v1`, ausschließlich bestätigte Modellannahmen; kein erfundener Digest,
keine Fake-confirmed-Hersteller-/Buchungsquelle. AP-03a bekommt nur kanonischen
JSON-Text. Ohne Referenz: drei getrennte Einzelprojektionen über projectRetirement.
Mit Referenz: exakt drei Szenariopaare über compareRetirement, unveränderte eigene
Beiträge, Anfangswerte und Zeitachse; keine Zulage auf der Referenzseite.

Start/Ende, Anfangskapital, Monatsrate, Quote und drei Aktien-/Rentenannahmen sind
sichtbar. Optionale Einmalzahlung, datierter einmaliger Aktien-Stress und manuelle
Zulage werden ausdrücklich aktiviert. Erholung folgt nur den sichtbaren Renditen.
Unbekannte Kosten ergeben ein Bruttomodell ohne bekannten Euro-Kostenbetrag.
Ein optionaler expliziter Kostenpfad muss als vollständige hypothetische jährliche
Bestandsminderung bestätigt werden; er ist keine Hersteller-Effektivkostenquote.
Ohne diese Bestätigung bleibt dessen Nachkostenrechnung fachlich gesperrt.

Ergebnisse und Geldkennzahlen stammen ausschließlich aus Domainantworten.
Spezifizierter und vollständiger Endwert werden getrennt angezeigt; gesperrte
Werte bleiben ohne Betrag. Vergleichsdifferenz nur aus completeDifference eines
calculated-Vergleichs. Keine Nettoaufwands-, Steuer-, Garantie- oder Rentenrechnung.
Steuer-/Verfügbarkeitsgrenzen stehen direkt am Referenzvergleich.

Automatische, kompakte und detaillierte Ausgabe bleiben Vertragsoptionen. Die
UI zeichnet höchstens zwölf echte Monats-/Blockzeilen je Projektion als klaren
Auszug. Keine gekürzte Berechnung und keine interpolierte Finanzreihe.

## Zulagen-Teilgate: keine scheinbar belegte A2-Übernahme

Die bestehende A2-Vorschau liefert jahresbezogene Regelmetadaten, jedoch keinen
eindeutig gebundenen Transfer für Person/Vertrag und die mehrjährige A4-Zahlungs-
folge. Gemäß der ausdrücklich erlaubten sicheren Teilgrenze wird keine automatische
oder als externe Evidenz ausgegebene Schnittstelle konstruiert. A2-Transfer bleibt
sichtbar eine spätere Etappe. Der neutrale A4-Fall benötigt keinerlei A1-Bestätigung.

Wählbar sind none_assumed (keine weiteren Zulagen als Modellannahme, keine Aussage
über den Anspruch) oder unknown mit ausdrücklich benannten offenen Jahren. Ein
manuelles Einzelereignis verlangt Förderjahr, Betrag, selbst gewählten Buchungsmonat
und bewusste Bestätigung als Hypothese. Es wird niemals wiederholt oder als realer
Bescheid/Vertragsbuchung bezeichnet. Es gibt keinen automatischen Mai-/Junitermin.
Jede A1/A2-Änderung entwertet A4 und entzieht eine manuelle Zulagenbestätigung.

## Zustand und bestehender Verlustschutz

A3/A4 bleiben ausschließlich flüchtiger React-State im bestehenden Entwurf.
Alle Eingabe-, Produkt-, Szenario- und Navigationsänderungen entfernen abhängige
A4-Ergebnisse synchron. Bestätigungen gehören zum aktuellen Snapshot. A/B bleiben
getrennt; keine Werteübernahme aus B. Neustart/Verlassen nutzen den bestehenden
Verlustdialog; Reload speichert nichts. B1/B2-Inhalt und Rechenweg bleiben erhalten.

## Unabhängige Orakel vor Adapterimplementierung

Alle Fälle synthetisch, ohne Zulagen/Kosten und mit Nullrendite, soweit bezeichnet:

| Fall | Erwartung |
| --- | --- |
| Anfang/Rate null | Endwert 0 Cent |
| 100 EUR monatlich, Januar–Dezember | 120000 Cent |
| 100 EUR monatlich, Oktober–Dezember | 30000 Cent |
| 1000 EUR Anfang, 100 EUR monatlich, drei Monate, kein Stress | 130000 Cent |
| Derselbe Fall, Aktienquote 100 %, Stress −20 % am Anfang / Mitte / Ende | 110000 / 108000 / 106000 Cent |
| Derselbe Fall, Aktienquote 100 %, Stress −30 % am Anfang / Mitte / Ende | 100000 / 97000 / 94000 Cent |
| Derselbe Fall, Aktienquote 100 %, Stress −40 % am Anfang / Mitte / Ende | 90000 / 86000 / 82000 Cent |
| Aktienquote 0 %, derselbe reine Aktien-Stress | immer 130000 Cent |
| Aktienquote 50 %, −30 % am Anfang | 115000 Cent |
| 100 EUR monatlich über drei Monate plus einmalig 500 EUR | 80000 Cent |
| 1000 EUR Anfang, keine Beiträge, ein Jahr Aktien 3/6/8 % | 103000 / 106000 / 108000 Cent |
| 1000 EUR Anfang, keine Beiträge, ein Jahr Renten 1/2/3 % | 101000 / 102000 / 103000 Cent |
| 0,01 EUR monatlich über 118800 Modellmonate, Nullrendite | 118800 Cent, kompakte Ausgabe |

Die Null-/Stressorakel folgen unabhängig aus den expliziten Monatsendzahlungen:
Anfangsstress trifft 1000 EUR, Mittelstress 1100 EUR, Endstress 1200 EUR; spätere
Beiträge werden unverändert ergänzt. Die Jahresfälle folgen den vorgegebenen
effektiven Jahresrenditen. Erwartete Zahlen werden nicht aus dem Prüfling erzeugt.

Die neuen Tests umfassen 26 Adapterfälle und 21 Browserfälle, zusätzlich zu den
unveränderten AP-03a-Originaltests. Sie prüfen Status/Quellen, A1→A4, B-Isolation,
Navigation, 390/1440 px und synthetische Export-/Speicherintegrität. Reguläres
Verify, R1 und Diffcheck laufen sequenziell.
Beide finalen CI-Arten und vollständige Originallogs bleiben Pflicht; bei erneutem
Exportproblem HOLD. Finale Ausführungsbefunde stehen im identischen externen Paket.
