# VermögensNavigator – Fachlicher Nachtrag zur Bond-Modellabdeckung

Stand: 22.09.2026. Dieser gezielte Nachtrag ersetzt ausschließlich die bisherige pauschale Aggregationssperre für mehrdeutige Kuponfrequenzen und ergänzt ein eng begrenztes Modell für eine verkürzte erste Jahreskuponperiode. Die historischen V0.18.2-Implementierungs- und Abnahmenachweise bleiben unverändert historische Nachweise. Bei Widersprüchen hat dieser Nachtrag Vorrang vor den entsprechenden Aussagen in `V0182_ZeroTouch_CSV_Only_Verbindlicher_Nachtrag.md` und `Bond_Engine_V2_Fachkonzept.md`.

## 1. Auswahl- und Aggregationsregel

Die Kandidaten jährlich, halbjährlich und vierteljährlich werden weiterhin vor der Stückzinsbeobachtung festgelegt. Es gibt weiterhin keine Auswahl nach kleinstem Stückzinsresidual und keine erhöhte Toleranz.

- Genau ein kompatibler regulärer Kandidat wird verwendet und aggregiert.
- Sind mehrere reguläre Kandidaten kompatibel und ist das Jahresmodell darunter, wird das Jahresmodell als ausdrücklich gekennzeichnetes indikatives Basismodell verwendet. YTM, Macaulay, Modified Duration, DV01 und Szenarien stammen vollständig aus diesem einen Plan und werden aggregiert. Die anderen kompatiblen Varianten bleiben technische Diagnosen.
- Sind mehrere ausschließlich unterjährige Kandidaten kompatibel, bleibt die couponabhängige Rechnung mangels fachlicher Auswahlregel gesperrt.
- Fehlt der Stückzins, bleibt die bisherige ungeprüfte Jahresmodellannahme zulässig.
- Das Jahresmodell wird niemals erzwungen, wenn es mit den vorhandenen Daten nicht kompatibel ist.
- Explizite Nullkuponanleihen bleiben frequenzunabhängig.

Die Kennzeichnung als Modellannahme ist keine Aussage über vertraglich bestätigte Jahreszahlung, Kuponfrequenz oder Zahlungsbedingungen.

## 2. Verkürzte erste Jahreskuponperiode

Der neue Kandidat wird nur geprüft, wenn kein regulärer Frequenzkandidat kompatibel ist und alle bisherigen Preis-, Stückzins-, Datums-, Währungs- und Strukturprüfungen bestanden sind. `Bewertungsanfang` wird weder gelesen noch als Zinsbeginn interpretiert.

Verbindliche Modellkonvention:

1. Die erste künftige Zahlung ist der nächste aus der Endfälligkeit abgeleitete reguläre Jahrestermin.
2. Ein möglicher Modellbeginn muss auf demselben Fälligkeitsanker liegen und genau 1 bis 11 ganze Kalendermonate vor diesem Termin liegen. Die bestehende Monatsendregel gilt unverändert.
3. Der Modellbeginn muss vor dem Bewertungsdatum, das Bewertungsdatum vor der ersten Zahlung liegen.
4. Die Stückzinsansparung wird ausschließlich als `Jahreskupon × tatsächliche Tage seit Modellbeginn / 365` geprüft.
5. Es gilt unverändert das Band `max(0,05 je 100; 2 × nachgewiesene Quantisierung je 100)`. Mehrere passende Modellbeginne führen zu keiner Auswahl.
6. Der erste Kupon beträgt `Jahreskupon × tatsächliche Tage der verkürzten Periode / 365` und muss positiv sowie kleiner als ein voller Jahreskupon sein. Danach folgen reguläre Jahreskupons; final kommt einmalig die angenommene Tilgung zu 100 hinzu.
7. Der Dirty-Preis enthält die Stückzinsen bereits. Sie werden weder dem Preis noch den Cashflows ein zweites Mal zugeschlagen.

Der abgeleitete Termin heißt ausschließlich **Modellbeginn der verkürzten Periode**. Er ist kein rekonstruierter Emissions-, Valuta- oder vertraglicher Zinsbeginn. Ein zufällig passender fehlerhafter Stückzins kann innerhalb eines CSV-only-Vertrags nie vollständig ausgeschlossen werden; die feste Anker-, Eindeutigkeits- und Strukturprüfung begrenzt dieses Restrisiko. Negative Stückzinsen, erkennbare Cum-/Ex-, Flat-/Gross-, Ausfall-, Callable-, amortisierende, strukturierte oder sonstige Sonderbedingungen bleiben gesperrt.

## 3. Aggregation und Qualitätskategorien

Portfolioaggregate verwenden pro Position ausschließlich den ausgewählten Plan. Voraussetzungen bleiben positiver vergleichbarer EUR-Marktwert, konsistente Dirty-Basis, erfolgreiche numerische Rechnung, unterstützte Struktur und kein manueller Ausschluss. Ø YTM und Ø Modified sind marktwertgewichtet, DV01 ist additiv, die vier Szenarien verwenden dieselbe DV01-Basis. Der Coverage-Nenner bleibt der vollständige direkte Anleihemarktwert.

Die technische Datenaufbereitung zerlegt den Bestand überschneidungsfrei in:

1. rechnerisch eindeutig identifiziert oder frequenzunabhängig,
2. einbezogene Jahresannahme bei mehrdeutiger Frequenz,
3. einbezogene verkürzte erste Jahresperiode,
4. sonstige ungeprüfte Jahresmodellannahme,
5. nicht modellierbar oder bewusst ausgeschlossen.

Anzahl und EUR-Marktwert werden im technischen Detailbereich und im separaten Excel-Nachweisblatt ausgewiesen. Die Kundenansicht behält vier KPIs, vier Szenarien, Fälligkeitsübersicht, Positionen und optionale technische Details.

## 4. Synthetischer Referenzfall

Nominal 2.000 EUR, Jahreskupon 4,125 %, Clean 98,25 %, Dirty-Marktwert 1.990,77 EUR, Stückzinsen 25,77 EUR, Bewertung 18.09.2026 und Endfälligkeit 27.01.2032 ergeben 1,2885 Stückzins je 100. Die Konvention identifiziert eindeutig den Modellbeginn 27.05.2026 und die erste Zahlung 27.01.2027.

- erster modellierter Kupon je 100: 2,7688356164,
- Dirty-Preis je 100: 99,5385,
- indikative YTM: 4,4973858683 %,
- Macaulay Duration: 4,8506607901 Jahre,
- Modified Duration: 4,6418967803 Jahre,
- DV01 der Position: 0,9240948853 EUR.

Die folgenden Zahlungen sind volle Jahreskupons; am 27.01.2032 werden 104,125 je 100 modelliert. `Bewertungsanfang` hat keinen Einfluss.

## 5. Synthetischer Vorher-/Nachher-Nachweis

Vergleichsbestand: eine eindeutig jährliche Kurzläuferposition (10.592,92 EUR), eine jährlich/halbjährlich/vierteljährlich mehrdeutige Position (10.000,00 EUR), der obige Stub-Fall (1.990,77 EUR) und eine widersprüchliche Position (10.000,00 EUR). Gesamtmarktwert direkte Bonds: 32.583,69 EUR.

| Kennzahl | Bisherige Regel | Neue Regel |
| --- | ---: | ---: |
| YTM-/Duration-/DV01-Coverage | 32,51 % | 69,31 % |
| Modellierte Positionen | 1 | 3 |
| Modellierter Marktwert | 10.592,92 EUR | 22.583,69 EUR |
| Zusätzlich modelliert | – | 2 Positionen / 11.990,77 EUR |
| Portfolio-DV01 | 0,0138199 EUR | 1,8813110 EUR |
| DV01-Beitrag der neuen Positionen | – | 1,8674911 EUR |
| Marktwertgewichtete YTM | 5,0000 % | 5,3985 % |
| Marktwertgewichtete Modified Duration | 0,0130463 | 0,8330398 |
| Szenario +100 bp | −1,3819854 EUR | −188,1310965 EUR |

Laufende Verzinsung und Fälligkeitsleiter ändern sich durch die Modellpolitik nicht; sie behalten ihre eigenen Voraussetzungen. Verbleibender Ausschluss im Vergleich: eine Position / 10.000,00 EUR wegen widersprüchlicher Stückzins-/Kuponmodelldaten. Die Werte sind ausschließlich synthetisch und erlauben keine Aussage zur Coverage eines realen Depots.

## 6. Verbleibende Grenze

Der CSV-only-Vertrag kann Vertragsbedingungen nicht bestätigen. Insbesondere werden rein unterjährig mehrdeutige Modelle, nicht eindeutig passende Stub-Anker, widersprüchliche Stückzinsen und erkennbare Sonderstrukturen nicht automatisch ausgewählt. Eine numerische Stückzinsübereinstimmung bleibt ein Modellkonsistenzsignal, kein unabhängiger Vertragsnachweis.
