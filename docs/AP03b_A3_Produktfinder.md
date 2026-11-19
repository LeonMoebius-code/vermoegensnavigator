# AP-03b · A3 Produktfinder

A3 ist in der bestehenden Berater-Prüfansicht über **A3 Produktvergleich**
erreichbar. Drei freiwillige Orientierungsantworten bleiben innerhalb des
geöffneten Spezialentwurfs korrigierbar. Die Karten stehen in fester Reihenfolge
und wechseln je Zeile den Anbieter. Wünsche ändern weder Reihenfolge noch
Sichtbarkeit. Bis zu drei Produkte können aktiv ausgewählt werden. Die Matrix
erscheint ab zwei, die Auswahl kann auf beiden Ansichten korrigiert werden.

## Quellen und Freigaben

Herstellerquellen am 19.11.2026 geprüft und fachlich eingeordnet:

- [U1 · Union Investment, Produktübersicht][U1] und [U2 · Produktfragen, Stand Oktober 2026][U2].
- [U3 · Union Investment, Pressemitteilung][U3] als ergänzender Kontext zur Ankündigung.
- [R1 · R+V, Produktübersicht][R1] und [R2 · R+V, Pressemitteilung vom 23.10.2026][R2].

| Produkt | Öffentlich belegte Anzeige auf Ankündigungsstand | Offen oder ohne Anzeigefreigabe |
| --- | --- | --- |
| UniVorsorge Basis | U1/U2 · Zwei vorgegebene aktive ETFs, wählbare Aufteilung, Lebenszyklus, ohne Beitragsgarantie, Fondsauszahlplan. | Abschließender Tarif, Fondsdetails und Kosten. Die Kostenaussagen in FAQ und Übersicht bilden keinen gemeinsamen finalen Tarifstand. |
| UniVorsorge Pro | U1/U2 · Gemanagter globaler Aktienfonds, 80-%-Ziel vom Kapital bei Beginn der Stabilisierungsphase, Fondsauszahlplan. | Beitragsgarantie nicht vorgesehen. Steuerung des Ablaufmanagements, Tarifzugang und Kosten offen. |
| UniVorsorge Garantie | U1/U2 · 100 % der Beiträge und Zulagen zum Auszahlungsbeginn angekündigt, Fünfjahresfrist genannt, Fondsauszahlplan. | Endgültige Bedingungen, Sicherungsmechanik, Tarifzugang und Kosten. |
| R+V-AltersvorsorgeDepot standard | R1/R2 · Zwei vorgegebene ETFs mit anpassbarer Aufteilung, ohne Beitragsgarantie. | Öffentliche Zuordnung der konkreten passiven Kategorien und Fonds, ISINs, Startgewichte, Tarifkennung und Kosten. |
| R+V-AltersvorsorgeDepot individuell | R1/R2 · Eigene Auswahl aus elf angekündigten ETFs (drei aktiv, acht passiv) oder ETF-Komfortportfolios. | Zwei Komfortportfolios sind fachlich vorgesehen. Vollständige aktuelle Fondsliste, ISINs, TER, Gewichte, Tarifkennung und Kosten bleiben offen. |
| R+V-AltersvorsorgeGarantie 80 | R1/R2 · 80 % der Beiträge und Zulagen zum Auszahlungsbeginn angekündigt, Sicherungsvermögen und ETF-Teil. | Kein Beleg für einen durchgehenden Depotboden. Versicherungsbedingungen, konkrete ETF-Auswahl, Tarifkennung und Kosten offen. |

Union nennt den Fondsauszahlplan. Eine lebenslange Rente ist für diese
Alternativen nur über einen gesondert zu prüfenden Wechsel zum Versicherer
einzuordnen (U1). R+V nennt für die drei Alternativen die lebenslange Rente
sowie die Wahl eines Auszahlplans zum Start der Auszahlphase (R1). Das sind
öffentlich angekündigte Möglichkeiten. Individuelle Zahlungsansprüche oder
Leistungshöhen setzen die Prüfung des konkreten Tarifs voraus.

Herstellerstand und bankseitiger Status sind unabhängige Angaben. Die
bankseitige Verfügbarkeit und Beratung sind für alle Alternativen unbestätigt.
Die sechs internen Kostenarbeitswerte bleiben in ihrer privaten Originalquelle.
Der öffentliche Code enthält für sie ausschließlich Daten- und Freigabestatus.
Ein späterer Zahlenstand braucht belegte Gültigkeit und Anzeigefreigabe
(Quellen-/Publikations-Gate). A3 übernimmt keine Herstellertexte, Fondslisten,
Portfoliogewichte, vertraulichen Dateien oder Szenariozahlen.

## Zustand und Abnahme

Der Anzeigeadapter ist ein statischer Quellensnapshot. Externe Links werden auf
Anforderung geöffnet. Geänderte Webseiten aktualisieren den Stand im Finder
erst durch eine gezielte neue Prüfung und Codeänderung. Die qualitative Anzeige
erzeugt keine revisionsfähigen P1-Katalogdatensätze. Der Entwurf bindet weder P2
noch IndexedDB an. Beim Verlassen oder Neuladen wird der Zustand verworfen.
Eine neue Programmversion startet ebenfalls ohne alten A3-/A4-Entwurf.

A3-Änderungen entfernen eine vorige A4-Vorschau, entziehen die zugehörigen
Bestätigungen und erhalten eingegebene neutrale Modellannahmen. A4 meldet
die Entwertung ausdrücklich und berechnet seine bisherigen neutralen Szenarien
weiter mit AP-03a. A3 setzt keine Modellrendite, Kosten, Aktienquote oder
Garantieannahme. Produktbezogene M1/M2-Rechnung, ETF-Werkzeug, Kundenfall- und
Exportfreigabe sowie die menschliche AP-07c-Gesamtabnahme stehen separat aus.

`ap03b-product-finder.spec.ts` prüft öffentliche Quellen und Status, die drei
Fragen, Rückwärts- und Tastaturnavigation, Schutz, ETF-Auswahl, Auszahlung,
Zwei-/Drei-/Vierer-Auswahl und Abwahl, Responsive-Reflow sowie A/B und den
flüchtigen Reset. `ap04b-retirement.spec.ts` prüft zusätzlich A3/A4-Kopplung,
unveränderte numerische Orakel und die bestehende Ausgabestrecke.

[U1]: https://www.union-investment.de/familien-und-altersvorsorge/fuers-alter-vorsorgen/altersvorsorgedepot
[U2]: https://www.union-investment.de/familien-und-altersvorsorge/fuers-alter-vorsorgen/antworten/was-ist-fuer-das-altersvorsorgedepot-geplant
[U3]: https://unternehmen.union-investment.de/presseservice/aktuelles/pressemitteilungenarchiv/alle-pressemitteilungen/2026/univorsorge
[R1]: https://www.ruv.de/altersvorsorge/private-rentenversicherung/altersvorsorgedepot
[R2]: https://www.ruv.de/newsroom/pressemitteilungen/2026-10-23-altersvorsorge-testimonial
