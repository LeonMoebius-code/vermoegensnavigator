# Work-Paket 3B – Technisches Preflight

> Technische und fachliche Umsetzungskarte für die Portfolioanalyse des Depotchecks.
>
> Stand: 07.09.2026  
> Ausgangsbasis der Analyse: `main` V0.14 plus Dokumentations-Preflights  
> Abhängigkeit: Umsetzung erst nach 4A.1 und 4B bzw. gegen den dann aktuellen `main` erneut kurz abgleichen  
> Voraussichtliche Zielversion bei dieser Roadmap: V0.16.0  
> Empfohlener Arbeitsbranch: `work/depotcheck-3b-analyse`

---

# 1. Ziel

Depotcheck 3B erweitert den bereits vorhandenen Depotcheck um belastbare Portfolioanalysen auf Basis der in V0.13 erhaltenen CSV-Rohdaten.

Nach 3B bestehen im Depotcheck fünf funktionierende Unterbereiche:

1. **Bestand & Transaktionen**
2. **Vermögenshaus**
3. **Diversifikation**
4. **Zins & Laufzeiten**
5. **Einstand & Ergebnis**

3B soll vorhandene Daten analysieren, aber keine Informationen erfinden und keine vollständige Depotperformance behaupten.

---

# 2. Nicht Teil von 3B

Nicht in dieses Paket hineinziehen:

- Risiko V2
- Sparplan-/InvestmentPlan-Umbau
- Zinseszins-/Sparzielrechner
- Steuervertiefungen
- Fonds-Lookthrough nach Branchen, Ländern oder Währungen ohne belastbare Quelldaten
- echte zeitgewichtete oder geldgewichtete Gesamtperformance
- Realisierte Gewinne/Verluste ohne vollständige Transaktionshistorie
- automatische Kauf-/Verkaufsempfehlungen aus Analysekennzahlen
- vollständige Ergebnis-/PDF-Endkonsolidierung
- Mobile-Optimierung
- externe Marktdaten-APIs

---

# 3. Bestehende Datenbasis

`DepotHolding` enthält bereits unter anderem:

- `name`
- `value`
- `assetClass`
- `region`
- `productId`
- `wkn`
- `segment`
- `investmentMedium`
- `securityType`
- `rawCountry`
- `currency`
- `industry`
- `certificateClass`
- `coupon`
- `maturity`
- `nominalOrUnits`
- `lastPurchaseDate`
- `averageEntryPrice`
- `purchaseCosts`
- `currentPrice`
- `gainLossPercent`
- `gainLossAmount`
- `accruedInterest`
- `sourceDepotShare`
- `averageEntryFx`
- `fxRate`
- `valuationStart`
- `valuationEnd`
- `holdingAtValuationStart`
- `holdingAtValuationEnd`

Die Strukturübersicht speichert weiterhin bewusst **nicht** Depotnummer oder Depotinhaber.

Der aktuelle CSV-Parser erhält Anlagesegment, Anlagemedium und Wertpapiertyp im Original. Diese drei Felder sind die wichtigste Basis für die Produktartenklassifikation.

---

# 4. Grundarchitektur der Analyse

## 4.1 Keine zweite persistierte Depotstruktur

3B soll keine neue persistierte Kopie des Depots erzeugen.

Stattdessen reine bzw. gut testbare Analysefunktionen in einer kleinen eigenen Datei, bevorzugt:

`app/depot-analysis.ts`

Dort sollen aus `DepotHolding[]`, aktivem Strukturplan und vorhandenen Produktdaten abgeleitete Analysemodelle erzeugt werden.

## 4.2 Abgeleitete Analysepositionen

Für IST und PLAN kann ein nicht persistierter View-Typ verwendet werden, sinngemäß:

```ts
type DepotAnalysisPosition = {
  id: string;
  source: "holding" | "planned-purchase";
  name: string;
  value: number;
  productId?: string;
  wkn?: string;
  segment?: string;
  investmentMedium?: string;
  securityType?: string;
  rawCountry?: string;
  currency?: string;
  industry?: string;
  coupon?: number;
  maturity?: string;
  nominalOrUnits?: number;
  currentPrice?: number;
  gainLossAmount?: number;
  gainLossPercent?: number;
  ...
}
```

Der konkrete Name ist frei. Wichtig ist die Trennung zwischen gespeicherten Bestandsdaten und abgeleiteten Analysepositionen.

## 4.3 IST und PLAN

**IST**

= vollständiger aktueller Depotbestand.

**PLAN**

= aktuelles Depot nach allen simulierten Verkäufen + geplante Käufe aus dem aktiven Strukturplan.

Für Bestandspositionen:

`planValue = max(0, value - plannedSale)`

Für geplante Käufe:

- Betrag aus der Produktallokation
- bekannte Produktdaten aus `houseProducts` / `managedPortfolios` dürfen ergänzt werden
- fehlende CSV-spezifische Daten wie Emittentenland, Branche, Bond-Cashflows oder Einstandswerte **nicht erfinden**

InvestmentPlan-Raten aus 4B dürfen nicht zusätzlich als neue Käufe gezählt werden. Sie sind nur Umsetzungsweg des bereits geplanten Betrags.

---

# 5. Schema / Migration

3B benötigt voraussichtlich **keine neue Schema-Version**, wenn:

- Produktartenklassifikation rein abgeleitet wird
- Kennzahlen nicht persistent gespeichert werden
- keine neuen Pflichtfelder in `DepotHolding` eingeführt werden

Bevorzugt deshalb:

> Analyse aus vorhandenen Daten berechnen statt neue redundante Klassifikationsfelder zu persistieren.

Falls der dann aktuelle `main` nach 4B bereits eine neue Schema-Version besitzt, diese unverändert weiterverwenden.

Schema nur erhöhen, wenn bei der konkreten Implementierung tatsächlich persistente neue Daten erforderlich werden.

---

# 6. Produktartenklassifikation

## 6.1 Ziel

Die Analyse soll Originalfelder nicht ersetzen, sondern daraus eine Navigator-Klassifikation ableiten.

Bevorzugter Rückgabetyp:

```ts
type ProductClassification = {
  main: string;
  sub: string;
  direct: boolean;
  bondKind?: "fixed" | "floater" | "step-up" | "other";
  confidence: "source" | "derived" | "unknown";
}
```

`confidence` kann intern bleiben. Eine UI-Anzeige ist nur nötig, wenn Klassifikation unsicher ist.

## 6.2 Priorität der Quelldaten

Klassifikation anhand der kombinierten normalisierten Texte aus:

1. `securityType`
2. `investmentMedium`
3. `segment`
4. bekannte `houseProducts.category` bei Produktmatch
5. `assetClass` nur als konservativer Fallback

Nicht ausschließlich aus dem Produktnamen ableiten.

## 6.3 Verbindliche Haupt-/Unterkategorien

### Renten

Unterkategorien mindestens:

- **Festverzinsliche Anleihen**
- **Floater**
- **Stufenzinsanleihen**
- **Sonstige direkte Rentenwerte**
- **Rentenfonds**
- **Geldmarktfonds**

Regeln:

- Text enthält `floater`, `floating`, `variabel`, `variabel verzinslich` → Floater
- Text enthält `stufenzins`, `step-up`, `step up` → Stufenzinsanleihe
- direkte Anleihe-/Renten-/Schuldverschreibungsbegriffe ohne Floater/Step-up → Festverzinsliche Anleihe, sofern keine gegenteilige Struktur erkennbar ist
- Fonds + Renten/Anleihe/Bond/Credit → Rentenfonds
- Fonds + Geldmarkt/Money Market → Geldmarktfonds

### Aktien

Unterkategorien mindestens:

- **Einzelaktien**
- **Aktienfonds / Aktien-ETF**

Direkte Aktie nicht mit Aktienfonds vermischen.

### Misch- / Multi-Asset

Unterkategorien:

- **Mischfonds / Multi-Asset**
- ggf. **Vermögensverwaltung** für geplante Produkte, wenn als solche eindeutig bekannt

### Strukturierte Produkte

Unterkategorien beispielsweise:

- **Zertifikate / strukturierte Produkte**
- weitere Unterteilung nur, wenn `certificateClass` oder Quelldaten belastbar sind

### Immobilien / Sachwerte

- Immobilienfonds
- sonstige Immobilien-/Sachwertprodukte nur bei eindeutiger Quelle

### Alternative Anlagen

- Rohstoffe / Edelmetalle
- sonstige Alternative Anlagen

### Liquidität

- Kontoguthaben / Tagesgeld / Termingeld
- Geldmarktprodukt nur dann hier, wenn die Quelle es tatsächlich als Liquiditätsmedium statt Fonds klassifiziert; Fonds bleiben bevorzugt unter Renten > Geldmarktfonds

### Nicht zugeordnet

Wenn die vorhandenen Felder keine belastbare Klassifikation erlauben:

- Hauptkategorie `Nicht zugeordnet`
- Unterkategorie `Nicht zugeordnet`

Keine künstliche Zuordnung anhand bloßer Vermutung.

---

# 7. Diversifikation – Navigation und Zustände

Der Bereich **Diversifikation** bekommt einen kompakten IST/PLAN-Umschalter.

Kein dritter Zustand `Nach Verkäufen`.

Default: **IST**.

PLAN folgt ausschließlich der bereits bestehenden finalen Depot-PLAN-Logik.

Innerhalb des Bereichs vier Analyseblöcke:

1. Positionen / Konzentration
2. Produktarten
3. Branchen & Länder
4. Währungen

Diese können auf einer Seite untereinander liegen. Keine unnötige weitere Tab-Hierarchie.

---

# 8. Positionen / Konzentration

## 8.1 Kennzahlen

Aus Marktwerten des gewählten IST-/PLAN-Zustands:

- Depotwert
- Anzahl Positionen
- größte Position
- Top-3-Konzentration
- Top-5-Konzentration

Formeln:

`weight = position.value / total`

`top3 = Summe der drei größten weights`

`top5 = Summe der fünf größten weights`

Wenn weniger als 3 bzw. 5 Positionen vorhanden sind, Summe der vorhandenen Positionen verwenden und entsprechend beschriften.

## 8.2 Visualisierung

**Horizontale Balken**, absteigend nach Marktwert/Depotanteil.

Warum kein Donut:

- Positionen können schnell zahlreich werden
- Balken sind für Rangfolge und Klumpenrisiken besser lesbar

Mindestens die größten 10 Positionen zeigen. Bei mehr Positionen optional `Alle anzeigen`.

Keine harte Bewertung wie `zu konzentriert` ohne fachlich festgelegten Schwellenwert.

Stattdessen rein beschreibend:

> Top 3 machen 42,3 % des analysierten Depotwerts aus.

---

# 9. Produktarten

## 9.1 Hauptdarstellung

**Donut** für Hauptkategorien, wenn maximal 7 Kategorien vorhanden sind.

Zusätzlich daneben bzw. darunter eine hierarchische Legende:

- Renten 62 %
  - Festverzinsliche Anleihen 48 %
  - Floater 7 %
  - Stufenzinsanleihen 4 %
  - Rentenfonds 3 %
- Aktien 30 %
  - Einzelaktien 30 %
- Nicht zugeordnet 8 %

Damit bleibt die Hierarchie verständlich, ohne mehrere Donuts zu stapeln.

## 9.2 PLAN-Daten

Geplante Käufe dürfen über bekannte interne Produktkategorien eingeordnet werden, soweit belastbar.

Beispiel:

- `houseProducts.category = Aktienfonds` → Aktien > Aktienfonds
- `Rentenfonds` → Renten > Rentenfonds

Vermögensverwaltungen mit heterogener Asset-Mischung sind **Produktart Vermögensverwaltung**, nicht automatisch Renten/Aktien. Das Vermögenshaus bleibt für wirtschaftlichen Lookthrough zuständig.

---

# 10. Branchenanalyse

## 10.1 Grundsatz

Das vorhandene CSV-Feld `industry` ist primär bei direkten Aktien sinnvoll.

Keine Fondsbranche aus Fondsnamen oder Asset-Mix ableiten.

Keine Anleihe-Emittentenbranche als vollständige wirtschaftliche Branchenallokation des Depots verkaufen.

## 10.2 Zwei Bezugsansichten

Kompakter Umschalter:

- **Aktienbestand**
- **Gesamtdepot**

### Aktienbestand

Nenner = alle als direkte Einzelaktien klassifizierten Positionen im gewählten IST-/PLAN-Zustand.

Bekannte Branche → jeweilige Branche.

Fehlende Branche bei Einzelaktie → `Nicht zugeordnet`.

### Gesamtdepot

Direkte Aktien werden nach Branche gezeigt.

Alle übrigen Positionen werden gemeinsam als:

> **Nicht branchenbezogen / ohne Lookthrough**

geführt.

Nicht einfach `Sonstige` nennen, da Rentenfonds, Anleihen oder andere Produkte keine unbekannte Aktienbranche sind.

## 10.3 Visualisierung

Bei bis zu 7 sichtbaren Branchen: **Donut**.

Bei mehr als 7: **horizontale Balken** nach Anteil absteigend.

Coverage-Hinweis sichtbar, z. B.:

> Brancheninformation für 92 % des direkten Aktienbestands vorhanden.

---

# 11. Länderanalyse

## 11.1 Begriff

Sichtbare Bezeichnung:

> **Produkt-/Emittentenland**

Nicht `wirtschaftliche Länderallokation`.

Bei Fonds beschreibt der vorhandene Code primär Produkt-/Domizilland.

## 11.2 Zwei Ansichten

- **Direktwerte**
- **Gesamtdepot**

### Direktwerte

Direkte Aktien und direkte Rentenwerte nach `rawCountry` / `depotCountryName(...)`.

Dies ist die fachlich aussagekräftigere Default-Ansicht.

### Gesamtdepot

Alle Positionen nach vorhandenem Quell-Land.

Hinweis:

> Bei Fonds und Sammelprodukten ist dies das Produkt-/Domizilland und keine wirtschaftliche Länderallokation.

Unbekanntes Land = `Nicht zugeordnet`.

## 11.3 Visualisierung

**Horizontale Balken**, absteigend.

Keine dynamische Kartenvisualisierung.

Grund:

- Länderanzahl kann stark variieren
- Balken sind präziser und günstiger umzusetzen
- unbekannte/kleine Länder bleiben lesbar

---

# 12. Währungsanalyse

## 12.1 Begriff

Sichtbar immer:

> **Produktwährung**

Hinweis:

> Produktwährung ist nicht gleich wirtschaftliches Währungsrisiko. Insbesondere Fonds können wirtschaftlich in mehreren Währungen investiert sein.

## 12.2 Nenner

Gesamter Marktwert des gewählten IST-/PLAN-Zustands.

Fehlende Währung = `Nicht zugeordnet`.

## 12.3 Visualisierung

Bei maximal 7 Währungen: **Donut** + Legende.

Bei mehr als 7: Balken.

Keine Währungsrisiko-Kennzahl oder FX-Hedge-Annahme erzeugen.

---

# 13. Coverage-Prinzip im gesamten 3B

Jede Analyse, die nur einen Teil des Depots belastbar auswerten kann, zeigt eine Coverage.

Bevorzugte Definition:

`Coverage = Marktwert der belastbar klassifizierbaren Positionen / Marktwert des relevanten Nenners`

Beispiele:

- Produktart-Coverage
- Branchen-Coverage im direkten Aktienbestand
- Länder-Coverage
- Währungs-Coverage
- Laufzeiten-Coverage
- YTM-/Duration-Coverage
- Einstands-/Ergebnis-Coverage

Positionen mit fehlenden Daten nicht stillschweigend aus Prozentverteilungen verschwinden lassen. Wenn sinnvoll als `Nicht zugeordnet` bzw. `ohne Lookthrough` führen.

---

# 14. Zins & Laufzeiten – Ziel

Dieser Bereich analysiert direkte Rentenpositionen und grenzt Fonds/Sonderstrukturen sauber ab.

Default: **IST**.

IST/PLAN-Umschalter zulässig. PLAN darf geplante Käufe enthalten, aber nur bestehende und belastbar vorhandene Bond-Rohdaten werden mathematisch ausgewertet. Geplante Produkte ohne Coupon-/Fälligkeits-/Preis-Daten erhöhen die mathematische Coverage nicht.

---

# 15. Rentenuniversum und Untergruppen

Aus der Produktklassifikation werden mindestens unterschieden:

1. **Direkte Festzinsanleihen**
2. **Floater**
3. **Stufenzinsanleihen**
4. **Sonstige direkte Rentenwerte**
5. **Rentenfonds / Geldmarktfonds**

Rentenfonds niemals mit einer einzelnen Fälligkeit, einem einzelnen YTM oder einer aus Fondsnamen geratenen Duration behandeln.

---

# 16. Fälligkeit und Restlaufzeit

## 16.1 Bewertungsdatum

Bevorzugt:

1. `valuationEnd`, wenn als valides Datum für die Position vorhanden
2. ansonsten aktuelles lokales Datum

Für Portfolioaggregation soll ein einheitliches Bewertungsdatum verwendet werden. Wenn im Import mehrere unterschiedliche `valuationEnd` vorkommen, bevorzugt den häufigsten/neueren plausiblen gemeinsamen Stichtag verwenden und abweichende Positionen nicht stillschweigend als exakt gleich behandeln.

Einfachere zulässige Umsetzung:

- globaler Depot-Stichtag aus dem häufigsten vorhandenen `valuationEnd`
- Fallback aktuelles Datum

## 16.2 Restlaufzeit

Für gültige Fälligkeit:

`remainingYears = max(0, daysBetween(valuationDate, maturity) / 365.25)`

Anzeige z. B. `4,7 Jahre`.

Bereits fällige/abgelaufene Daten nicht negativ anzeigen. Als `fällig / Daten prüfen` markieren.

---

# 17. Fälligkeitsleiter

## 17.1 Inhalt

Direkte Rentenwerte mit gültiger Endfälligkeit.

Gruppierung nach Fälligkeitsjahr.

Primäre Größe:

> **Nominal**

Nicht Marktwert als primäre Fälligkeitsleiter verwenden.

Zusätzlich im Tooltip/Detail darf Marktwert gezeigt werden.

## 17.2 Visualisierung

**Vertikale Balken nach Fälligkeitsjahr** oder kompakte horizontale Jahresbalken, je nachdem was im vorhandenen Layout sauberer passt.

Bevorzugt horizontal scrollfreie Darstellung auf Desktop.

Je Jahr:

- Fälligkeitsjahr
- Nominalsumme
- Anzahl Positionen
- optional Marktwert

Floater und Stufenzinsanleihen dürfen in die Fälligkeitsleiter, wenn ihre Fälligkeit bekannt ist. Sie werden nur aus YTM/Duration ausgeschlossen, wenn die Cashflows nicht belastbar modellierbar sind.

---

# 18. Current Yield / laufende Verzinsung

Für direkte Rentenwerte mit:

- aktuellem Coupon
- plausiblem aktuellen Kurs > 0

Formel bei prozentnotierter Anleihe:

`currentYield = coupon / currentPrice * 100`

Beispiel 4 % Coupon bei Kurs 96:

`4 / 96 * 100 = 4,17 %`

## Einschränkung

Bei Floatern/Stufenzinsanleihen ist dies nur eine **Momentaufnahme der aktuell gespeicherten Kuponhöhe**.

Daher sichtbare Bezeichnung bevorzugt:

> Laufende Verzinsung auf aktuellen Kurs

und nicht als Rendite bis Fälligkeit verkaufen.

Plausibilitätsgrenzen für eine Berechnung verwenden, z. B. aktueller Kurs im sinnvollen Prozentbereich. Unplausible Quotierungen ausschließen statt falsche Prozentwerte zu erzeugen.

---

# 19. Modellierte Yield to Maturity

## 19.1 Zulässige Positionen

YTM nur für Positionen, die als **direkte Festzinsanleihe** klassifiziert sind und mindestens enthalten:

- gültige zukünftige Fälligkeit
- Coupon
- `currentPrice` > 0 und plausible Prozentnotierung
- Nominal/Stückdaten soweit für Plausibilität erforderlich

Ausschließen:

- Floater
- Stufenzinsanleihen ohne vollständigen zukünftigen Couponpfad
- Rentenfonds
- strukturierte Produkte
- Anleihen mit unklarer Tilgungsstruktur
- unplausible oder fehlende Kursdaten

## 19.2 Modellannahmen

Da die CSV keine vollständigen Coupontermine, Day-Count-Konventionen oder Settlement-Daten enthält, YTM ausdrücklich als:

> **modellierte YTM**

kennzeichnen.

Annahmen für V1:

- Rückzahlung zu 100
- jährliche Couponzahlung
- keine Steuern
- keine Transaktionskosten
- kein Ausfall
- aktueller Kurs wird als Clean-Preis in % des Nominals interpretiert
- vereinfachte Zeitabstände auf Basis der Restlaufzeit
- keine exakte Stückzinstageszählung

Keine Nachkommastellen-Präzision suggerieren, die die Datenbasis nicht trägt. Anzeige vorzugsweise 2 Dezimalstellen.

## 19.3 Berechnung

Numerische Lösung der Rendite `y`, sodass der modellierte Barwert der künftigen Cashflows dem aktuellen Preis entspricht.

Robuster Root-Finder, z. B. Bisektion, mit plausiblen Grenzen.

Kein externes Finance-Paket notwendig.

Wenn keine stabile Lösung gefunden wird:

- Wert nicht anzeigen
- Position als `nicht berechenbar` mit Grund führen

---

# 20. Macaulay Duration und Modified Duration

Für denselben berechenbaren Festzins-Subset wie YTM.

Aus den modellierten Cashflows:

`Macaulay = Sum(t * PV(CF_t)) / Preis`

bei jährlicher Verzinsungsannahme:

`Modified = Macaulay / (1 + YTM)`

Anzeige in Jahren.

Portfolio-Duration:

marktwertgewichtete Modified Duration der tatsächlich berechenbaren Positionen.

Immer zusammen mit Coverage anzeigen.

Beispiel:

> Modellierte Modified Duration: 6,9 Jahre  
> Berechenbare Coverage: 74 % der direkten Rentenwerte

Nicht so darstellen, als gelte die Kennzahl für Rentenfonds oder ausgeschlossene Sonderstrukturen.

---

# 21. DV01

Für jede berechenbare Position:

`DV01 ≈ Marktwert * ModifiedDuration * 0.0001`

Portfolio-DV01 = Summe der Positions-DV01 des berechenbaren Subsets.

Sichtbare Erklärung:

> Näherungsweiser Wertverlust/-gewinn des berechenbaren Rentenbestands bei einer parallelen Renditeänderung um 1 Basispunkt.

Vorzeichen in der Kennzahl selbst als absoluter Sensitivitätsbetrag anzeigen.

---

# 22. Zinsszenarien

Szenarien:

- Rendite -1,00 %-Pkt.
- Rendite -0,50 %-Pkt.
- Rendite +0,50 %-Pkt.
- Rendite +1,00 %-Pkt.

V1 nutzt bewusst eine **lineare Modified-Duration-Näherung**:

`priceChangePct ≈ -ModifiedDuration * deltaYield`

Portfolio-Effekt in EUR = Summe der modellierten Effekte je berechenbarer Position.

Keine Convexity in 3B erzwingen.

Sichtbar kennzeichnen:

> Lineare Durationsnäherung. Größere Zinsbewegungen, Spreadänderungen, Bonitätsänderungen und nichtlineare Effekte werden nicht vollständig abgebildet.

Dies vermeidet Scheingenauigkeit und hält die erste Version robust.

---

# 23. Zins-/Laufzeiten-Coverage

Im Kopf des Bereichs kompakte Coverage-Karten:

- **Direkte Rentenwerte** – Marktwert / Anteil am Depot
- **Mit Fälligkeit** – Anteil der direkten Rentenwerte mit gültiger Fälligkeit
- **YTM/Duration berechenbar** – Anteil des direkten Rentenmarktwerts im Festzins-Subset
- **Ausgeschlossen** – Marktwert Rentenfonds/Sonderstrukturen

Darunter eine kleine Liste ausgeschlossener Positionen mit Grund, z. B.:

- VW Floater – variable Verzinsung
- Stufenzinsanleihe – zukünftige Couponstaffel fehlt
- Rentenfonds – keine Einzeltitel-Cashflows

Keine Position stillschweigend aus der Mathematik verschwinden lassen.

---

# 24. Zins & Laufzeiten – empfohlene UI

Reihenfolge:

1. Kennzahlen/Coverage
2. Fälligkeitsleiter
3. Tabelle direkte Rentenpositionen
4. Portfolio-Sensitivität / Zinsszenarien
5. Annahmen und ausgeschlossene Positionen

Tabelle mindestens:

- Position
- Typ
- Nominal
- Coupon
- Fälligkeit
- Restlaufzeit
- aktueller Kurs
- laufende Verzinsung
- modellierte YTM, falls berechenbar
- Modified Duration, falls berechenbar
- DV01, falls berechenbar

Nicht berechenbare Zellen mit `–` und klarer Detailbegründung statt `0`.

---

# 25. Einstand & Ergebnis – fachliche Abgrenzung

Dieser Bereich ist **keine Performanceanalyse**.

Sichtbare Hauptbezeichnung bevorzugt:

> **Unrealisierte Kursentwicklung ggü. Einstand**

Nicht verwenden:

- Depotperformance
- Gesamtrendite
- Total Return

Ohne vollständige Historie fehlen unter anderem:

- Ausschüttungen
- Dividenden
- Couponzahlungen
- realisierte Gewinne/Verluste
- Zu-/Abflüsse
- alle historischen Käufe/Verkäufe
- steuerliche Effekte

---

# 26. Einstand & Ergebnis – Zustand

Primär **IST-Bestand** analysieren.

Kein universeller PLAN-Modus erforderlich, weil geplante Käufe noch keinen tatsächlichen Einstand und kein Kursresultat besitzen.

Simulierte Verkäufe sind ebenfalls keine realisierten Transaktionen und erzeugen daher keine neue historische Performance.

Die vorhandenen Quelldaten bleiben auf den tatsächlichen aktuellen Bestand bezogen.

---

# 27. Einstand & Ergebnis – Kennzahlen

Nur auf Positionen mit vorhandenen Ergebnisdaten.

Kompakte Kennzahlen:

- Marktwert mit Ergebnisdaten
- Coverage des Gesamtdepots
- Summe importierter `gainLossAmount`
- Anzahl Positionen im Plus
- Anzahl Positionen im Minus
- beste Position nach importiertem G/V %
- schwächste Position nach importiertem G/V %

Die Summe von `gainLossAmount` darf gezeigt werden als:

> **Summe der importierten unrealisierte Kursgewinne/-verluste**

Nicht als Gesamtperformance.

Keinen aggregierten Prozentwert konstruieren, wenn die fachlich saubere Bezugsbasis nicht eindeutig aus den Quelldaten hervorgeht.

---

# 28. Einstand & Ergebnis – Visualisierung

Bevorzugt:

**Horizontale Ergebnisbalken je Position**, sortiert nach G/V EUR oder G/V %.

Umschalter:

- EUR
- %

Positive/negative Richtung klar sichtbar. Farben nur gemäß bestehendem CD-/Statussystem und nicht als zusätzliche neue Farbwelt erfinden.

Zusätzlich kompakte Tabelle:

- Position
- letzter Kauf
- Ø Einstand
- aktueller Kurs
- G/V EUR
- G/V %

`purchaseCosts` nicht in aggregierte Performanceberechnungen einbauen, solange die genaue Quellsemantik nicht belastbar definiert ist. Auf Positionsebene weiterhin als Quelddatum anzeigen.

---

# 29. Leere / unvollständige Datenzustände

Jeder neue Bereich braucht einen sinnvollen Empty State.

### Kein Depot

Keine Nullcharts.

Hinweis:

> Für diese Analyse sind noch keine Depotpositionen vorhanden.

### Keine Brancheninformationen

> Für den direkten Aktienbestand liegen keine belastbaren Brancheninformationen vor.

### Keine direkten Rentenwerte

> Im Depot sind keine direkten Rentenwerte für eine Laufzeitenanalyse vorhanden.

### Direkte Renten, aber keine berechenbaren YTM-Werte

Fälligkeitsleiter weiterhin zeigen, wenn möglich.

YTM/Duration-Bereich mit Coverage 0 % und konkreten Ausschlussgründen.

### Keine Einstandsdaten

> Für die vorhandenen Positionen liegen keine ausreichenden Einstands-/Ergebnisdaten vor.

---

# 30. Navigation

Bestehenden Depotcheck-Tabmechanismus erweitern auf:

- `Bestand & Transaktionen`
- `Vermögenshaus`
- `Diversifikation`
- `Zins & Laufzeiten`
- `Einstand & Ergebnis`

Alle fünf Tabs erst sichtbar machen, wenn 3B vollständig implementiert ist.

Keine leeren Platzhalter-Tabs committen.

Desktop-Ziel bleibt bestehen.

---

# 31. Bestehende Kernlogik nicht doppeln

Unverändert wiederverwenden:

- Depot-CSV-Import
- `DepotHolding`
- Ländercode-Mapping
- aktiver Strukturplan
- Verkaufssimulation
- geplante Käufe
- Vermögenshaus
- Produktdaten / Hausmeinung
- Asset-Mix-Durchschau

3B erweitert Analysefunktionen, baut aber keine zweite Depot-/Transaktionsengine.

---

# 32. PLAN und fehlende Metadaten

Bei geplanten Käufen ist nur das verwenden, was der interne Produktkatalog wirklich enthält.

Beispiel:

Ein geplanter Aktienfonds kann zuverlässig als Produktart `Aktienfonds` klassifiziert werden.

Nicht automatisch vorhanden sind aber:

- Produktwährung bei jedem HouseProduct
- Emittentenland
- Branchenlookthrough
- Einzelanleihe-Coupon
- Endfälligkeit
- Einstand

Fehlende Metadaten bleiben in PLAN als `Nicht zugeordnet` bzw. ohne Coverage sichtbar.

Keine Informationen aus dem Produktnamen erraten.

---

# 33. Exporte

3B muss bestehende JSON-/Excel-/PDF-Exporte **nicht vollständig um neue Analyseseiten erweitern**.

Pflicht:

- bestehende Exporte weiterhin funktionieren
- keine neue Analyseberechnung darf bestehende Exportdaten beschädigen

Die vollständige Konsolidierung der neuen 3B-Analysen in Kunden-/internen Export bleibt beim späteren Paket `Ergebnis & Export`.

Optional darf der Excel-Export bereits zusätzliche analytische Rohdaten aufnehmen, wenn dies ohne Scope-Ausweitung einfach möglich ist. Dies ist aber **kein Abnahmekriterium** für 3B.

---

# 34. Technische Testbarkeit der Finanzmathematik

Bond-Mathematik als reine Funktionen implementieren.

Beispiele für Funktionen, sinngemäß:

- `classifyDepotProduct(...)`
- `buildDepotAnalysisPositions(...)`
- `remainingMaturityYears(...)`
- `currentYield(...)`
- `solveModeledYtm(...)`
- `bondDurationMetrics(...)`
- `bondDv01(...)`
- `interestScenarioEffect(...)`
- `analysisCoverage(...)`

Kein React-State in diesen Funktionen.

Keine neue große Finanzbibliothek einführen.

---

# 35. Synthetische Mathematiktests

Keine echte Strukturübersicht als Testfixture committen.

Mindestens mit synthetischen Positionen prüfen:

### A – Par-Bond

- Nominal 100.000
- Coupon 5 %
- Kurs 100
- Restlaufzeit 5 Jahre

Erwartung:

- modellierte YTM ungefähr 5 %
- Duration plausibel unter 5 Jahren
- DV01 positiv und plausibel

### B – Discount-Bond

- Coupon 3 %
- Kurs 95
- Restlaufzeit 5 Jahre

Erwartung:

- YTM > 3 %

### C – Premium-Bond

- Coupon 5 %
- Kurs 105
- Restlaufzeit 5 Jahre

Erwartung:

- YTM < 5 %

### D – Floater

- Coupon vorhanden
- Wertpapiertyp Floater

Erwartung:

- Current Yield darf als Momentaufnahme berechenbar sein
- keine modellierte YTM
- keine Standard-Duration

### E – Stufenzins

- aktuelle Couponhöhe vorhanden
- künftige Couponstaffel fehlt

Erwartung:

- keine modellierte YTM/Duration

### F – Rentenfonds

Erwartung:

- keine direkte Anleihefälligkeit
- keine YTM/Duration aus Fondsposition erfinden

### G – fehlender Kurs

Erwartung:

- keine YTM
- klare Ausschlussbegründung

---

# 36. Funktionale Regressionstests

Mindestens:

### H – Leeres Depot

Alle neuen Tabs mit sinnvollen Empty States.

### I – Produktarten

Synthetisches Depot mit:

- Aktie
- Festzinsanleihe
- Floater
- Stufenzinsanleihe
- Rentenfonds
- Aktienfonds
- unbekannter Position

Erwartung: korrekte Hierarchie, unbekannt bleibt unbekannt.

### J – Top-3 / Top-5

Gewichte absteigend korrekt, Summe plausibel.

### K – Branchen

Nur direkte Aktien bilden den Aktienbestand-Nenner.

Fonds werden nicht künstlich einer Branche zugeordnet.

### L – Länder

Direktwerte und Gesamtdepot getrennt.

Fondsland als Produkt-/Domizilland gekennzeichnet.

### M – Währungen

Produktwährung korrekt, fehlende Währung `Nicht zugeordnet`.

### N – PLAN nach Verkäufen + Käufen

- verkaufte Bestandswerte reduziert
- geplante Käufe einmal ergänzt
- InvestmentPlan aus 4B nicht doppelt gezählt

### O – Einstand & Ergebnis

- nur vorhandene Ergebnisdaten aggregiert
- keine künstliche Gesamtperformance
- Coverage korrekt

### P – Bestehende Depotfunktionen

- CSV-Import
- Positionsdetails
- Verkaufssimulation
- Vermögenshaus IST/PLAN/VERGLEICH

weiter funktionsfähig.

---

# 37. Plausibilitätsregeln

Keine Kennzahl anzeigen, wenn Eingaben offensichtlich unplausibel sind.

Beispiele:

- negativer oder null Kurs für YTM
- Fälligkeit vor Bewertungsdatum
- negative Nominalwerte
- extreme Coupon-/Kurswerte außerhalb plausibler Prozentnotierung

Statt stiller Korrektur:

- `–`
- Ausschlussgrund
- Coverage entsprechend reduzieren

---

# 38. UI-Texte / Fachsprache

Verbindliche Begriffe:

- **Diversifikation**
- **Produktarten**
- **Produkt-/Emittentenland**
- **Produktwährung**
- **Zins & Laufzeiten**
- **Fälligkeitsleiter**
- **Laufende Verzinsung auf aktuellen Kurs**
- **Modellierte YTM**
- **Modified Duration**
- **DV01**
- **Unrealisierte Kursentwicklung ggü. Einstand**
- **Coverage / Datenabdeckung**

Nicht behaupten:

- wirtschaftliche Fonds-Länderallokation aus Domizilland
- vollständiges Währungsrisiko aus Produktwährung
- Gesamtperformance aus Kurs-G/V
- exakte YTM bei unvollständigen Bond-Cashflows

---

# 39. Empfohlene Work-Reihenfolge

## Checkpoint 1 – Analyseengine

1. aktuellen `main` nach 4B kurz prüfen
2. `depot-analysis.ts` anlegen
3. IST-/PLAN-Analysepositionen
4. Produktartenklassifikation
5. Konzentration / Produktart / Branche / Land / Währung
6. Bond-Mathematik und Coverage
7. Einstand-/Ergebnisaggregation
8. fokussierte synthetische Tests
9. TypeScript
10. `git diff --check`
11. Commit + Branch pushen

Noch kein Pages-Deployment.

## Checkpoint 2 – UI

1. fünf Depotcheck-Tabs
2. Diversifikation
3. Zins & Laufzeiten
4. Einstand & Ergebnis
5. Empty States
6. IST/PLAN-Umschalter nur wo fachlich sinnvoll
7. Regression gegen Bestand & Transaktionen + Vermögenshaus
8. Commit + Branch pushen

## Final

1. TypeScript
2. Produktionsbuild
3. `git diff --check`
4. fokussierte Tests
5. offensichtliche angrenzende Regressionen
6. finalen Branchstand pushen
7. `main` synchronisieren
8. nur bei vollständigem Paket sauber mergen
9. `main` einmal pushen
10. Pages-Workflow prüfen

---

# 40. Nutzungslimit

Wenn das Work-Limit knapp wird:

- keine neue größere Teilaufgabe beginnen
- stabilen Stand committen
- Arbeitsbranch pushen
- nicht unvollständig nach `main` mergen

Priorität bei knapper Zeit:

1. Analyseengine + mathematische Korrektheit persistent sichern
2. Diversifikation
3. Zins & Laufzeiten
4. Einstand & Ergebnis
5. finales UI-Polishing

Keine bezahlten Credits als Standardstart eines großen 3B-Laufs verwenden.

---

# 41. Modell-/Ressourcenempfehlung

Da 3B nach diesem Preflight fachlich und technisch stark eingegrenzt ist, ist als Startpunkt sinnvoll:

> **GPT-5.6 Sol · Mittel**

Sol Hoch nur, wenn beim aktuellen Code nach 4B unerwartet ein größerer mathematischer oder architektonischer Refactor nötig wird.

3B aus regulärem Work-Kontingent starten.

---

# 42. Abnahmekriterien

3B ist erst fertig, wenn:

- alle fünf Depotcheck-Unterbereiche funktional sind
- Diversifikation auf IST und PLAN belastbar funktioniert
- Produktarten hierarchisch und ohne erfundene Klassifikation dargestellt werden
- Branchen, Länder und Währungen fachlich korrekt beschriftet und abgegrenzt sind
- Konzentrationskennzahlen korrekt sind
- direkte Renten sauber von Fonds/Sonderstrukturen getrennt werden
- Fälligkeitsleiter funktioniert
- Current Yield nur mit plausiblen Daten berechnet wird
- modellierte YTM nur für geeignete Festzinsanleihen berechnet wird
- Macaulay/Modified Duration und DV01 auf demselben berechenbaren Subset beruhen
- Zinsszenarien als lineare Näherung gekennzeichnet sind
- Coverage und Ausschlussgründe sichtbar sind
- Einstand & Ergebnis nicht als Gesamtperformance bezeichnet wird
- bestehende CSV-, Depot-, Verkaufs- und Vermögenshausfunktionen nicht regressieren
- TypeScript, Build und `git diff --check` erfolgreich sind
- finaler Branch gesichert und nur bei vollständigem Paket nach `main` übernommen wurde

---

# 43. Status nach diesem Preflight

**Depotcheck 3B ist fachlich und technisch WORK-READY.**

Vor dem tatsächlichen Work-Lauf ist nur ein kurzer Delta-Check gegen den dann aktuellen `main` nach 4A.1 und 4B nötig. Das Fachkonzept muss nicht erneut geöffnet werden, solange keine neue Datenquelle oder neue Produktart hinzukommt.
