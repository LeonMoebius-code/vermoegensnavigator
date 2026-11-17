# AP-04a-UX2 – Beitrags- und Förderoptimierer

Work B, kritisch, 17.11.2026. Umsetzungsgrundlage: freigegebener Work-Auftrag B,
Fach-/Bedienkonzept V0.5.2 vom 11.11.2026 §4 A2 und Bildschirm S3/M3.
Die externen Konzeptoriginale wurden gelesen, nicht in das öffentliche Repository
kopiert. AP01a und AP04a-UX1 bleiben die fachlichen Schutzverträge.

## Preflight und Umfang

Am 17.11.2026 frisch geklonter, isolierter sauberer Arbeitsbaum. Live-main und
verbindlicher Parent: `0edde578a9e3bc68b0132674dd3aa7e0809208a7`, Tree
`86018066fddce2f18cd08c2bdfef00b4b6898f35`. Der Checkpoint 13.11.2026 im
Projektstatus liegt dahinter. PR #76 / GOV-03 ist bereits integriert.
Die offenen fremden Drafts #43 (AUDIT ONLY, NEVER MERGE) und #60 bleiben intakt.
Bei Preflight kein offener Work-A-PR. Der eigene Branch verwendet dieselbe
verbindliche Ausgangsbasis. Keine Änderung an retirement-entry.tsx oder
Riester-B-Komponenten, keine neue Persistenz, kein Schemawechsel.

Verantwortungsgrenze zu Work A: `CustomerPlan` bleibt der A-Zustand.
`contribution` ist eine optionale A-interne Jahreszielabsicht. Bestehende Aufrufer
funktionieren ohne dieses Feld. Keine B-Daten oder B-Nachweise werden übernommen.
`retirement-projection.tsx` exportiert zusätzlich seine reine Ergebnisansicht.
Die A-Kundenansicht verwendet diese, damit in den Rechendetails kein zweiter
Zahlungseditor oder alternativer Berechnungsweg das aktive Jahresziel umgehen kann.

## Ein gemeinsamer Zahlungsplan

`customerPayments(CustomerPlan)` leitet die wirksamen Zahlungen ab. Monatsmodus:
Monatsbetrag aus `capital.monthly`. Jahres-/Zielmodus: Jahresziel aus
`contribution.annual`, abzüglich eigener Einmalzahlung im ersten Kalenderjahr,
verteilt auf die tatsächlich verbleibenden Zahlmonate. Ganzzahlige Centteilung
liefert Monatsrate und einen Rest von höchstens elf Cent. Dieser Rest wird als
sichtbarer eigener Monatsendbeitrag im letzten Zahlmonat des ersten Jahres
modelliert, getrennt von der ausdrücklich eingegebenen Einmalzahlung.

Keine zweite aktive Rate im Komponenten-State. Zielwahl, individuelle Eingabe,
Datumsänderungen und Einmalzahlungen laufen durch denselben Planadapter.
Die Monatsanzeige wird synchronisiert. Direkte Monatsänderung beendet den
Jahreszielmodus und entfernt die aktive Kartenmarkierung. Individuelle Jahres-
eingabe zeigt ebenfalls „Individuell“. Identische Zielwahl ist eine echte No-op.
Ungültiger Jahresbetrag sperrt Förder-/Kapitalzahlen statt alte Werte zu verwenden.

Das Jahresziel gilt für das erste Kalenderjahr. Die ermittelte Monatsrate läuft
anschließend bis zum Modellende weiter. Der Centrest wird nicht wiederholt.
Das ist am Eingabefeld und in der Zahlungsaufstellung sichtbar. Eine bereits
höhere Einmalzahlung wird erhalten, die Monatsrate wird null und die Überschreitung
explizit genannt. Keine negative Rate, keine versteckte Kappung.

Die Datumsgranularität bleibt der bestätigte Monatsendvertrag. Die eigene
Einmalzahlung hat Betrag und expliziten Monat. Ein späteres Kalenderjahr zählt
nicht zum ersten Förderjahr. Anfangskapital zählt nicht zum förderfähigen Beitrag.
Keine taggenaue Gutschrift oder unterjährige Anbieterbuchung wird behauptet.

## Förderung und Projektion

Fünf auswählbare Jahresziele: 120, 300, 360, 1800 und 6840 Euro. Die zweite Karte
ist ein Beitragsziel für eine mögliche volle Kinderzulage je tatsächlich
förderfähigem und zugeordnetem Kind. Sie bestätigt keine Kinder oder Zuordnung.
Jede Karte zeigt die aus Zeitraum und Einmalzahlung benötigte Rate.

Bestehendes `customerGrant` / `previewGrant` prüft unverändert sämtliche
persönlichen Evidenzgates und nutzt den bestehenden Förderkern.
`conditionalBaseGrant` ist eine getrennte, ausdrücklich bedingte Standard-
Szenariorechnung mit demselben Kern. Sie schreibt keine angenommene Evidenz in
den Plan und wird nie automatisch in die Kapitalprojektion übertragen.
Bei bekannten nicht unterstützten Rechtsfällen gibt es kein direktes Szenario.
Kinder sind in dieser bedingten Grundzulagenspalte ausdrücklich nicht enthalten.
Bestätigte Kinderfälle bleiben über den bisherigen Prüfpfad nutzbar.

Unbestätigte Zahlen heißen mögliche Grundzulage und möglicher Vertragszufluss.
Daneben steht der eigene Beitrag ohne ungeprüfte Zulagen. Bonus und zusätzliche
Steuerentlastung bleiben offen und sind kein stiller Bestandteil des Zuflusses.
Jahresbeiträge über 6840 Euro und offene Fördercent-Rundung erhalten keine
bestätigten oder ersatzweise gerundeten Förderzahlen.

Kapitalentwicklung ausschließlich über `calculateCapital`, `buildCapitalRequests`
und die unveränderten AP03a-Schnittstellen. Der Adapter akzeptiert zusätzlich nur
einen validierten eigenen Centausgleich von 1–11 Cent innerhalb der Modellzeit.
Er erzeugt dafür ein reguläres `oneOffContributions`-Ereignis mit Quellenbindung.
Referenz und Vorsorgemodell erhalten identische Eigenzahlungen und Zeitpunkte.
Kein neuer Förder-, Kapital-, Steuer- oder Rentenkern. Eine regelbasierte Jahres-
zulage ist ohne geklärten Buchungszeitpunkt kein automatisches Kapitalereignis.
Die bisherige ausdrücklich hypothetische Einzelzulage bleibt getrennt bedienbar.

## Unabhängige Sollwerte und Regressionen

Die neuen Tests benutzen feste Sollwerte aus V0.5.2 A2/§5 und der vorhandenen
AP01a-Golden-Matrix, keinen zweiten Aufruf derselben Formel als Sollwert:

| Fall | Eigene Zahlungen im ersten Jahr | Grundzulage im direkten Standardfall |
| --- | ---: | ---: |
| Oktober, 3 × 10 Euro | 30 Euro | 0 Euro |
| Oktober, 3 × 39,99 Euro | 119,97 Euro | 0 Euro |
| Oktober, 3 × 40 Euro | 120 Euro | 60 Euro |
| Jahresziele 300 / 360 / 1800 / 6840 Euro | jeweiliges Ziel | 150 / 180 / 540 / 540 Euro |
| Oktober, 3 × 10 Euro + 90 Euro einmalig + 1 Cent | 120,01 Euro | offen, keine erfundene Centkonvention |

Bei Nullrendite müssen Endwerte und Originalledger genau den festen
Einzahlungssummen entsprechen. Getrennte Tests prüfen Referenzgleichheit,
Restcent nur im ersten Jahr, Januar/Februar/Dezember, spätere Einmalzahlungen,
überschrittenes Ziel, Evidenzentzug, No-op, Jahreswechsel, unsichere Beträge,
Rechtsfälle außerhalb des Standards sowie Navigation und Eingabefokus.
UI-Prüfungen bei 375/768/1280 px einschließlich 2×-Skalierung mit halbierter CSS-Viewportbreite.
An zwei bisherigen UI-Tests ändern sich nur die neue Eingabeanzahl und der
Öffnungsweg zur Einmalzahlung. Wirtschaftliche Assertions bleiben erhalten.
Neue Tests laufen automatisch im unveränderten vollständigen Browsergate.

## Ausdrücklich offen

AP01c: neue Kinder-/Partner-/Mehrvertrags-/Sonderfall-/Regimeberechnungen,
Bonusentscheidung und dessen Vorbezugsprüfung, neue Jahresregelstände,
Fördercent-Rundung. Ebenfalls kein Ausbau um Beitragspausen/-steigerungen,
Budget- oder Rückwärtsrechner, neue Produkt-/Auszahlungs-/Steuerrechnung.
Diese Punkte sind kein vollständiger A2-/Gesamtfertigstellungsnachweis.
AP07c einschließlich menschlicher Nutzungs- und echter Browserzoomprüfung offen.

Kritisches Paket: zwei organisatorisch unabhängige Reviews desselben finalen
Stands erforderlich. Work-Selbstprüfung ist kein unabhängiges GO.
Finale Push-/PR-CI und Checkout-Identitätsbelege gemäß integriertem GOV-03,
alle bestehenden technischen Gates unverändert. GOV-04 wird nicht vorweggenommen.
Kein Merge, Release oder Deployment durch diesen Auftrag.

### Präzisierung der Zoom-Testbedingungen

Der erste vollständige Pushlauf zeigte 656 erfolgreiche Tests und einen Fehler
in der neu hinzugefügten Root-CSS-Zoomprüfung bei 1280 px. CSS `zoom: 2` am
Wurzelelement verkleinert den Media-Query-Viewport nicht. Dadurch wurde der
vorhandene globale Header im Desktoplayout vergrößert, während die Prüfung eine
Browserzoom-Reflow-Bedingung behauptete. Die Originaldiagnose bleibt dem alten
Prüfstand zugeordnet. Die Testbedingung simuliert jetzt 2×-Skalierung mit 640 CSS-
Pixeln und Faktor 2. Die unveränderte Forderung nach fehlendem horizontalen
Überlauf wird weiterhin geprüft, zusätzlich Fokus und wirksamer Beitrag.
Dies ersetzt keinen realen menschlichen Browserzoomtest. AP07c bleibt offen.
Der neue CSS-Block liegt vor dem vorhandenen UX1-Block, damit er nicht mit dem
separaten Work-A-Anhang am bisherigen Dateiende konkurriert.
