# AP-04b-CORE-M1M2

## Einstieg und Eingaben

`app/domain/retirement/savings-model.ts` exportiert `calculateM1(jsonText)` für
`avd.m1.v1` und `calculateM2(jsonText)` für `avd.m2.v1`. Beide Funktionen verarbeiten
`format: "avd.savings-model.v1"` deterministisch. Das Modul hat keinen Zugriff auf Uhr,
Browser, Fallstore oder Netz. Die Eingangsregeln stehen in
[`model-input.ts`](../app/domain/retirement/model-input.ts).

| Eingabe | Vertrag |
| --- | --- |
| `catalog`, `catalog_ref`, `as_of` | Vollständiger P1-Katalog mit expliziter Identität `id/revision/hash` und Stichtag. Tarif, Produkt, Fonds, Portfolio, Quelle und Kosten verwenden exakte aktuelle Refs. Die Gültigkeit richtet sich nach dem Katalogstichtag. Die Rechnung schreibt diesen Annahmenstand über den gewählten Modellzeitraum fort. |
| `start_month`, `months`, `opening_cents` | Erster Modellmonat im Format `YYYY-MM`, 1–1.200 vollständig modellierte Kalendermonate bis spätestens 9999-12 und Anfangskapital in ganzen Cent. |
| `subject`, `payments` | Optionale Personen- und Vertrags-ID für die gemeinsame Szenariobasis. Ein Zahlungsereignis enthält eine eindeutige ID, tatsächliches oder angenommenes Datum, Centbetrag und Art `contribution`, `special_payment` oder `grant`. Das Buchungsdatum bestimmt den Modellmonat. |
| `market` | Explizite Bruttorenditen in ganzzahligen Jahresbasispunkten. `class: "S"`, Grund und aktueller P1-Szenarioquellenbezug. M1 verwendet je Szenario eine Rendite. M2 hat je Szenario fünf Modell-Anlageklassen mit optionalen S-Einzelrenditen je Fonds. |
| `paths` | Sechs unterschiedliche Produktidentitäten für M1 oder ein bis sechs gewählte Pfade für M2. Je Pfad genaue Produkt- und Tarif-Ref, entweder eine K1-Ansparkosten-Ref für das jeweilige Modell oder eine explizite S-Kostenparameter-Ref. Bei M2 kommt ein Modellprofil hinzu. |

Jahresrenditen liegen zwischen −10.000 und +100.000 Basispunkten. Faktoren für
die Monatsverzinsung müssen positiv sein. Ein Crash von −10.000 Basispunkten
ist zulässig. Ein fehlender Szenariowert wird mit `null` angegeben. Für M2 wird
er nur dann benötigt, wenn die Modellposition einen positiven Gewichtungsanteil
haben kann. Die fünf überschreibbaren Startannahmen pro Szenario liefert
`MODEL_M2_START_RATES`. Der Aufrufer muss die Annahmen ausdrücklich übergeben.
Die drei Szenarien heißen `cautious`, `medium` und `opportunity`.

Zulagenereignisse benötigen ein eigenes Förderjahr und eine Anspruchs-ID.
Dieselbe Kombination aus Förderjahr und Anspruch darf in der gemeinsamen
Zahlungsfolge nur einmal vorkommen. Förderjahr und Buchungsmonat bleiben in
der Ausgabe getrennt. Alle Zahlungen bleiben S-Modellereignisse. Die optionale
Personen- und Vertrags-ID belegt weder Förderanspruch noch Buchungstermin.
Ein Datum im Folgemonat oder Folgejahr erzeugt ausschließlich dort einen
Zufluss. Jeder Zufluss wird für die Verzinsung ans Monatsende gestellt.

Die Eingabegrenze nimmt ausschließlich JSON-Text bis 2.000.000 Zeichen an.
Nach dem Parsen greifen die begrenzte passive Datenkopie und die strikten
Feldregeln. Unbekannte Felder, Prototypschlüssel, ungültige Monate oder
Kalendertage, negative Einzahlungen, Doppelidentitäten, nicht endliche Zahlen
und Minusnull führen zu Fehlercode und Feldpfad. Aufrufargumente mit Gettern,
Proxies oder fremdem Prototyp werden allein aufgrund ihres Typs abgewiesen.

## K1 und Freigabe

Ein A-Kostenwert stammt aus einer gültigen P1-K1-Ansparkostenreferenz mit
genehmigtem Arbeitsparameter. Alternativ kann ein genehmigter S-Parameter aus
dem Katalog explizit übergeben werden. Er benötigt eine Szenarioquelle,
`annual_ratio`, `savings`, das exakte Produkt, den Tarif und die Modellversion.
Der Szenariowert verwendet dieselbe K1-Formel. Die Ergebnisdaten unterscheiden
K1-Kostenvertrag und Szenarioparameter. Für fehlende oder offene Kosten bleibt
der Pfad `nicht_berechenbar` mit Kostenklasse O. Numerische Null setzt einen
expliziten gültigen Parameter voraus. B ist keine Ersatzkennzeichnung für
K1-Arbeits- oder Szenariowerte. Nettorenditen, zusätzliche Kostenmodi und
Auszahlkosten werden am Recheneingang gesperrt.

Der tatsächliche Rechenpfad prüft vor einer Ergebnisausgabe die vollständige
P1-Kanalfreigabe `display`, einschließlich historischer Katalogdatensätze.
Die Sperre liefert keine Kosten, Quellenwerte oder Katalog-IDs zurück.
`source` und `asset` sind die vorgelagerten P1-Kanäle zur Auslieferung von
Quelldaten und Assets. `export` bleibt ein eigener P1-Kanal. Der Kern erzeugt
keinen dieser Ausgabepfade und keine kundenbezogenen Exporte. Die zuständige
Stelle muss Herkunft und kanalbezogene Freigabe vor der Verteilung realer
Daten prüfen. Deklarierte Freigaben und Inhaltshashes ersetzen keine
Authentifizierung, Zugriffskontrolle, tatsächliche Bankverfügbarkeit oder
ein individuelles Angebot.

## Rechenkonvention

Für M1 werden der Brutto- und Nettopfad vom selben Anfangswert und mit den
gleichen datierten Beiträgen für alle Produkte berechnet. Auf den vorhandenen
Bestand wirken je Monat `(1 + r)^(1/12)` und `(1 + r − k)^(1/12)`.
Eigenbeitrag, Sonderzahlung und hypothetische Zulage folgen am Monatsende.
Ein unvollständiger Kostenvergleich trägt `complete: false`. Berechenbare
Teilpfade bleiben einzeln prüfbar. Die Eingabereihenfolge bleibt erhalten.

M2 führt Bestände je Position. Gewichte sind ganzzahlige Basispunkte und
summieren sich exakt zu 10.000. Bei einem vorab deklarierten Wechsel wird der
gesamte vorhandene Bestand zu Monatsbeginn auf die neuen Ziele umgeschichtet.
Danach folgen die Renditen der Positionen und gegebenenfalls ein einmaliger
Aktiencrash auf bestehende Aktienpositionen. Auf den resultierenden Bestand
wirkt `(1 − k)^(1/12)`. Die Monatsendzuflüsse gehen nach den für diesen Monat
geltenden Zielgewichten in die Positionen. Bei `annual` wird nach diesen
Zuflüssen zum Ende jedes zwölften vollständigen Modellmonats rebalanciert.
Bei `none` entfällt das jährliche Rebalancing. Ein expliziter Zielwechsel und
das jährliche Rebalancing sind betragsneutral und eigene Ereignisse. Die
Monatsreihen geben den Kostenbetrag, den Zufluss und den Wert nach dem
Monatsabschluss aus.

| M2-Profil | Modellierung |
| --- | --- |
| Basis | Explizit modellierter Lifecycle mit optionalen Wechselmonaten im Betrachtungszeitraum. Start- und Wechselquoten sind S-Annahmen. |
| Pro und Garantie | Vereinfachtes frei gewähltes S-Portfolio. |
| R+V standard | Ausdrücklich gewählte Aktien- und Anleihenzielgewichte ohne voreingestellte Quote. |
| R+V individuell | Tarifgebundene Fondsreferenzen. Individuelle Zielgewichte in 1.000-Basispunkte-Schritten oder ein genau gebundenes P1-Komfortportfolio mit seinen Originalgewichten. Im Arbeitskatalog braucht es einen Herstellerbeleg. |
| R+V Garantie 80 | Vereinfachte Zuflussaufteilung mit Sicherungsvermögensposition. Bei positivem Anfangskapital sind Anfangsbestände separat zu gewichten. Zielwechsel für den Altbestand und jährliches Rebalancing sind gesperrt. Die Bestände entwickeln sich nach den zugewiesenen Anlageklassenrenditen. |

Bei einem Arbeitskatalog muss die P1-Produkt-ID der jeweiligen A3-Profil-ID
entsprechen. Für andere IDs benötigt die spätere Integration eine geprüfte
Zuordnung. Synthetische Kataloge können die Profile mit künstlichen IDs testen.
Tarifgrenzen, Fondsbezüge, Anlagedaten und Modellannahmen werden getrennt
geprüft. Tatsächliche Garantien bleiben gesonderte P1-Stichtagsfakten.

Die Konten laufen in 36 Dezimalstellen als Ganzzahlen. Die Monatswurzel nutzt
den vorhandenen AP-03a-Helfer mit maximal einem Fehlerintervall von einer
Einheit in der 36. Dezimalstelle. Bei Gewichtungen werden kumulierte Ziele
aufgelöst, damit die Summe der Einzelbestände unverändert bleibt. Für die
Ausgabe wird die Modellpräzision auf 18 Dezimalstellen in EUR normalisiert und
kaufmännisch auf Cent gerundet. Ausgabewerte fließen nicht in die Rechnung
zurück. Gerundete Positionssalden können daher zusammen vom gerundeten
Gesamtsaldo abweichen. Geldbeträge außerhalb des sicheren Centbereichs werden
kontrolliert gesperrt. Die Ergebnisse bewerten nominale EUR-Szenarien.

## Ergebnisidentität und P2

Ein blockierender Fehler am gemeinsamen Recheneingang liefert
`{ ok: false, issue: { code, path } }`. Bei gültiger Basis liefern die
Pfade jeweils `bedingt_berechnet` oder `nicht_berechenbar`. Blockierte
Pfade liefern keine Zeitreihe und nennen den Grund. Die Ausgabe enthält den
Katalog- und Modellstand, Modell- und Kostenmodus, Annahmen und Quellenbezüge,
Zahlungs- und Szenariohash, Stichtag und Monatskonvention.

Der Teilhash bindet die exakten Pfadreferenzen, das Modellprofil und die
gemeinsame Finanzbasis. Die Refs binden über P1 auch ihre exakten Abhängigkeiten.
Eine isolierte Kostenrevision kann deshalb den Hash eines Nachbarpfads
unverändert lassen. Der gemeinsame Snapshot-Hash bindet den Katalogstand und
alle Teilhashes. Für einen neuen Vergleich muss die spätere Einbindung den
tatsächlich aktiven Katalog und Fall verwenden. `case_ref` und
`comparison_ref` sind hier null. Die Modellhashes sind ein zusätzlicher
Herkunftsnachweis und autorisieren keine P2-Wiederverwendung. Für eine
Bestandsprüfung gelten das separate P2-Manifest und dessen Vergleichsrevision.

## Prüforakel

Die Testdatei `tests/browser/savings-model.spec.ts` läuft im bestehenden
vollständigen PR-Gate. Ihre künstlichen Werte repräsentieren keine
Herstellerdaten. C03, C04, C08 und die sechs C11-Endwerte lassen sich getrennt
mit 65 Dezimalstellen nachrechnen.

```python
from decimal import Decimal as D, ROUND_HALF_UP, localcontext

with localcontext() as ctx:
    ctx.prec = 65
    month = D(1) / 12
    def cents(value):
        return value.quantize(D(".01"), rounding=ROUND_HALF_UP)

    for cost in ("0.02", "0.027", "0.037", "0.041", "0.051", "0.062"):
        print(cents(D(10000) * (D("1.10") - D(cost)) ** month))
    print(cents(D(10000) * (D("1.10") * D("0.98")) ** month))
    print(cents(D(600) * D("1.21") ** (11 * month)))
```

Für C07 ergibt sich der Monatsabschluss aus 420 EUR Aktien, 400 EUR Anleihen
und 100 EUR Zufluss. Für C09 ergeben 726 EUR Aktien, 400 EUR Anleihen und
124 EUR Zufluss am Rebalancingstichtag genau 1.250 EUR. Nach der Umschichtung
betragen die Bestände 750 EUR und 500 EUR. C21 und der 1.200-Monats-Fall nutzen
unabhängig von der Produktionsrechnung geschlossene Vergleichsformeln. Die
bestehenden AP-03a-, P1- und P2-Tests laufen zusammen mit dem Schema-11-Test C30.
