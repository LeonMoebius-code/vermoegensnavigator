# VermögensNavigator – Master-Spezifikation

> **Kanonischer Produkt- und Entscheidungsstand**
>
> Letzte fachliche Aktualisierung: **04.09.2026**  
> Aktuell veröffentlichte Version: **V0.14**  
> Codebasis: **GitHub `main`**  
> Zielumgebung: **Desktop-Prototyp**  
> Öffentliche Testversion: GitHub Pages

---

## 0. Zweck dieses Dokuments

Dieses Dokument ist die zentrale **Source of Truth** für Produktkonzept, fachliche Entscheidungen, offenen Konzeptbedarf, Work-Pakete und bekannte Fixes des VermögensNavigators.

Es ersetzt **nicht** den Quellcode und **nicht** einzelne Work-Prompts. Es dokumentiert den aktuellen fachlichen Sollstand der Anwendung und trennt klar zwischen:

- bereits umgesetzt und veröffentlicht
- beschlossen, aber noch nicht umgesetzt
- in Konzeption
- fachlich offen
- bewusst später / nicht geplant

Work-Prompts werden künftig aus diesem Dokument, dem aktuellen GitHub-`main` und dem jeweils aktuellen Brainstorming-Stand abgeleitet. Alte Work-Prompts werden hier nicht archiviert.

### Source-of-Truth-Hierarchie

Bei Widersprüchen gilt künftig:

1. **Aktueller GitHub-`main`** für die tatsächlich implementierte Software
2. **Diese Master-Spezifikation** für den fachlich beschlossenen Sollstand
3. aktueller Brainstorming-Chat für noch nicht in diese Datei übernommene neue Entscheidungen
4. ältere Chats und alte Work-Prompts nur als historische Referenz

Nach einem abgeschlossenen Brainstorming-Block oder Work-Paket wird diese Datei aktualisiert. Nicht jede kleine Zwischenidee wird sofort eingetragen.

---

# 1. Statussystem

| Status | Bedeutung |
|---|---|
| ✅ **UMGESETZT** | Auf `main`, veröffentlicht und grundsätzlich abgenommen |
| 🟢 **BESCHLOSSEN / WORK-READY** | Fachlich fertig konzipiert, kann als Work-Paket umgesetzt werden |
| 🟡 **IN KONZEPTION** | Grundidee steht, konkrete Entscheidungen fehlen noch |
| 🔴 **FACHLICH OFFEN** | Fachmodell oder zentrale Logik muss erst entwickelt werden |
| ⏳ **SPÄTER** | Bewusst zurückgestellt |

---

# 2. Produktziel und Leitprinzipien

## 2.1 Produktidee

Der VermögensNavigator ist ein modularer Beratungsnavigator für die strukturierte Vermögensplanung. Kernidee:

> **Ein Fall. Mehrere Planungen. Eine konsistente Struktur.**

Die Anwendung soll Vermögenssituation, Liquiditätsbedarfe, Anlagehorizonte, Bestandsdepot, Vermögensstruktur, Modellportfolios, Vermögensverwaltungen, Produktauswahl, Umsetzung und Ergebnis in **einem konsistenten Beratungsfall** verbinden.

## 2.2 Fachliche Grundlogik

Der Kernprozess ist grundsätzlich:

1. Beratungsanlass / Vermögensart
2. Ausgangslage und verfügbare Liquidität
3. Kapitalbedarfe und Bedarfstermine
4. Bestandsvermögen / Bestandsdepot
5. Risiko und Zielsetzung
6. Zeitstruktur über Kapitaltöpfe
7. Strukturplanung über fünf wirtschaftliche Anlageklassen
8. Produkte / Modellportfolios / Vermögensverwaltungen
9. Umsetzung des geplanten Investments
10. Ergebnis, Vergleich und Export

Private und betriebliche Fälle sollen denselben Kern nutzen, aber dort differenzieren, wo fachlich unterschiedliche Logik notwendig ist.

## 2.3 UX-Grundsätze

- **Desktop ist Zielumgebung. Mobile-Optimierung ist aktuell kein Entwicklungsziel.**
- Beratungslogik vor technischer Systemlogik.
- Details nur bei Bedarf anzeigen, keine überladenen Tabellen.
- Relevante Warnungen möglichst direkt am betroffenen Objekt anzeigen.
- Keine Informationen oder wirtschaftlichen Durchschauen erfinden.
- Fachlich ungeklärte Informationen sichtbar als ungeklärt behandeln.
- Einmal erfasste Informationen sollen an allen relevanten Stellen konsistent wiederverwendet werden.
- Rechen- und Beratungszustände sollen klar benannt werden.
- Die Anwendung soll nicht wie ein internes Entwickler-Dashboard wirken.

## 2.4 Einheitliche Begriffe

**Vermögenshaus** ist der einheitliche Produktbegriff für die wirtschaftliche Fünf-Säulen-Struktur.

Nicht mehr als sichtbare Hauptbegriffe verwenden:

- „Fünf-Säulen-Durchschau“
- „Wirtschaftliche Durchschau statt Produktetikett“ als Haupttitel

Die wirtschaftlichen Anlageklassen sind:

1. Liquidität
2. Geldwerte
3. Substanzwerte
4. Alternative Anlagen
5. Sachwerte

---

# 3. Aktuell implementierter Stand

## 3.1 ✅ V0.12 – Kapitaltöpfe, Zeitstruktur und Kernplanung

Umgesetzt sind insbesondere:

- dynamische Kapitaltöpfe
- Liquiditätsreserve nur, wenn tatsächlich vorhanden
- Jahres-Kapitaltöpfe für konkrete Bedarfe
- Zusammenfassung mehrerer Bedarfe desselben Zieljahres in einem Topf
- Erhalt einzelner Bedarfszwecke und Termine innerhalb eines Jahrestopfs
- strategisch verfügbares Kapital als positiver Restbetrag
- sichtbarer Fehlbetrag statt negativem strategischem Kapital
- Zeitstruktur / Kapitaltopf-Navigation
- Zuordnung von Produkten zu Kapitaltöpfen
- automatische und manuelle Mehrtopf-Zuordnung
- bestehende Laufzeit-/Horizont-Plausibilisierung
- wirtschaftliche Produktdurchschau über Asset-Mix
- Vermögenshaus mit IST / PLAN / SOLL / VERGLEICH auf damaligem Stand
- Planvarianten und aktive Planlogik
- kompaktere Risiko-Orientierungs-UX mit geführter Klickstrecke
- manuelle Risikofestlegung weiterhin möglich
- CSV-Funktionalität aus der Ausgangslage
- sichtbarer Schließen-Mechanismus bei Vertiefungsansichten

### Bestehende interne Kompatibilität

Alte Laufzeitbänder / Legacy-Buckets dürfen intern für Plausibilisierung und Bestandsfälle weiterbestehen, sind aber nicht mehr die primäre sichtbare Zeitstruktur.

---

## 3.2 ✅ V0.13 – Depotcheck Datenbasis und Vermögenshaus

Umgesetzt sind insbesondere:

### Depotdatenmodell / CSV

Die Strukturübersicht kann wesentlich vollständiger übernommen werden. Relevante optionale Daten umfassen unter anderem:

- Anlagesegment
- Anlagemedium
- Wertpapiertyp
- ursprünglichen Landcode
- Währung
- Branche
- Zertifikateklasse
- Zinssatz / Coupon
- Endfälligkeit
- Stück / Nominal
- letztes Kaufdatum
- durchschnittlichen Einstandskurs
- Kaufkosten
- aktuellen Kurs
- Kursgewinn/-verlust in EUR und Prozent
- Stückzinsen
- Depotanteil laut Quelldatei
- Einstandsdevisenkurs
- Devisenkurs
- Bewertungsanfang / Bewertungsende
- Bestand zu Bewertungsanfang / Bewertungsende

Personenbezogene Depotfelder wie Depotnummer und Depotinhaber werden nicht in das Fallmodell übernommen.

### Ländercodes

- verbindliche Mappinglogik aus der bereitgestellten Referenzliste
- ursprünglicher Code bleibt erhalten
- unbekannte Codes werden nicht pauschal Europa zugeordnet
- Produkt-/Domizilland wird nicht mit wirtschaftlicher Fonds-Länderallokation gleichgesetzt

### Depotcheck UI / Berechnung

- Bereich „Bestand & Transaktionen“
- Bereich „Vermögenshaus“
- dynamischer Depotanteil je Position
- Risikoklasse aus sichtbarer Depotpositionstabelle entfernt
- Positionsdetails mit kontextabhängigen Daten
- Depot-Vermögenshaus mit IST / PLAN / VERGLEICH
- PLAN berücksichtigt simulierte Verkäufe und geplante Käufe
- aktive Planvariante ist Grundlage für geplante Käufe
- keine separate große Ansicht „Nach Verkäufen“
- bekannte Asset-Mix-Durchschau wird wiederverwendet
- ungeklärte Durchschau bleibt ungeklärt

---

## 3.3 ✅ V0.14 – Strukturplan-UX, VV-Selektion, Startseite und Branding

Umgesetzt sind insbesondere:

### Kapitaltopf-UX

- großes Vermögenshaus je Kapitaltopf entfernt
- kompakte „Struktur des Kapitaltopfs“ eingeführt
- nur tatsächlich belegte wirtschaftliche Anlageklassen werden prominent gezeigt
- Produktbeiträge bleiben nachvollziehbar
- direkte Warnung, wenn ein Produktüberschuss keinem weiteren Kapitaltopf zugeordnet werden kann
- globale Überplanung bleibt zusätzlich sichtbar

### Vermögensstruktur

- einheitlicher Titel `VERMÖGENSHAUS`
- Haupttitel „Geplante Vermögensstruktur“
- `SOLL` sichtbar in `ZIELPLAN` umbenannt
- PLAN = aktive Planvariante
- ZIELPLAN = bevorzugte Planvariante
- Szenarienüberschrift neutralisiert zu „Planvarianten im Vergleich“

### Bestandsdepot-UX

- Bestandsdepot-Modus im Planbereich sichtbar gemacht
- Modus kann über „Ändern“ bearbeitet werden
- bestehende Bestandsintegration rechnerisch weiterhin vorhanden

### VV-Selektion

- Nachhaltigkeit nur `Keine Präferenz` oder `Ja`
- Anlagebetrag vor Übernahme editierbar
- Anlagebetrag wird aus der Einstiegsgröße vorbelegt
- Betrag unter Mindestanlage wird nicht hart blockiert
- Warnung bei Unterschreitung der Mindestanlage
- sichtbares Feedback nach Übernahme in den Plan
- identisches wiederholtes Klicken erzeugt keine unbeabsichtigte Dublette
- bestehender Direktvergleich bleibt erhalten
- wirtschaftliche Durchschau der VV bleibt erhalten

### Startseite / Header

- technische Kennzahlenkarten entfernt
- „Zuletzt bearbeitet“ entfernt
- redundanter zusätzlicher „Neue Beratung starten“-Button entfernt
- Schnellstart bleibt
- feste Testszenarien bleiben
- Testumgebungs-Badge und Fragezeichen entfernt
- Branding-Assets grundsätzlich eingebunden

### Depotcheck-Korrekturen

- Aktien werden nicht mehr als Rentenposition dargestellt
- `Stück` und `Nominal` werden fachlich differenziert
- Vergleichsdach zeigt IST → PLAN verständlicher

---

# 4. 🟢 Work-Paket 4A.1 – Bestandsdepot-Logik & V0.14-Fixes

**Status: BESCHLOSSEN / WORK-READY**

Dieses Paket ist bewusst klein und fachlich klar abgegrenzt. Es soll vor dem InvestmentPlan-Umbau umgesetzt werden.

## 4.1 Branding-Fixes

### Header

Das Private-Banking-Logo ist aktuell sichtbar abgeschnitten. Ziel:

- Volksbank-pur-Logo vollständig sichtbar
- Private-Banking-Logo vollständig sichtbar
- keine aggressive negative Positionierung / Clipping-Lösung
- bekannte Größenrelation der beiden Marken einhalten
- VermögensNavigator als Produktbezeichnung daneben

### PDF / Kundenübersicht

Aktuell existiert im PDF-/Print-Export noch ein alter `Logo`-Platzhalter.

Verbindlich umsetzen:

- Volksbank-pur-Logo im PDF
- Private-Banking-Logo im PDF
- VermögensNavigator als Produktbezeichnung
- kein Platzhalterlogo
- beide Logos vollständig sichtbar
- lokale Assets aus `public/branding`
- Print-/PDF-CSS so anpassen, dass Browserdruck / „Als PDF speichern“ zuverlässig funktioniert

## 4.2 Bestandsdepot-Modi der Strukturplanung

Die Semantik wird verbindlich wie folgt festgelegt:

| Modus | IST in der Strukturplanung | PLAN / ZIELPLAN |
|---|---|---|
| **Nicht berücksichtigen** | Depot nicht enthalten | Depot nicht enthalten |
| **Nur im IST berücksichtigen** | gesamtes aktuelles Depot enthalten | Depot nicht enthalten |
| **Ausgewählte Positionen beibehalten** | gesamtes aktuelles Depot enthalten | nur ausgewählte Positionen enthalten |
| **Nach simulierten Verkäufen** | gesamtes aktuelles Depot enthalten | kompletter Restbestand nach simulierten Verkäufen enthalten |

### Wichtige Regeln

- Bei `Nicht berücksichtigen` muss das Depot auch aus **IST der Strukturplanung** verschwinden.
- `Nur im IST berücksichtigen` entspricht fachlich einer reinen Vergleichssicht.
- Bei `Ausgewählte Positionen beibehalten` darf die Positionsauswahl nur den PLAN beeinflussen. IST zeigt das vollständige aktuelle Depot.
- Bei `Nach simulierten Verkäufen` werden automatisch alle vorhandenen Positionen mit ihrem Restwert nach simulierten Verkäufen berücksichtigt.
- Bei `Nach simulierten Verkäufen` sind einzelne Positionscheckboxen nicht notwendig.
- Checkboxen werden nur bei `Ausgewählte Positionen beibehalten` aktiv benötigt.

## 4.3 CSV-Neuimport / Holding-IDs

Bekannter Fehler:

Nach Ersetzen eines bestehenden Depots durch einen neuen CSV-Import können alte gespeicherte Holding-IDs weiterbestehen und dadurch die neue Auswahl unplausibel leer erscheinen.

Ziel:

- veraltete Holding-IDs nach Ersetzen des Depots bereinigen
- für `Nach simulierten Verkäufen` ohnehin automatisch den vollständigen aktuellen Bestand verwenden
- bei `Ausgewählte Positionen beibehalten` bestehende Auswahl nach Möglichkeit fachlich sinnvoll über stabile Merkmale, bevorzugt WKN, reconciliieren
- neue Positionen nicht stillschweigend als bewusst „beibehalten“ interpretieren

## 4.4 Strukturplanung und Depotcheck entkoppeln

Die Bestandsdepot-Steuerung in der Strukturplanung und die physische Depotlogik im Depotcheck beantworten zwei unterschiedliche Fragen.

### Strukturplanung

Frage:

> Soll und in welchem Umfang soll das vorhandene Depot Bestandteil dieser Gesamtvermögensplanung sein?

Hier gelten die vier Modi aus Abschnitt 4.2.

### Depotcheck

Frage:

> Wie sieht das tatsächlich vorhandene Depot heute und nach simulierten Verkäufen plus geplanten Käufen aus?

Verbindliche Logik:

**IST Depotcheck**  
= immer das tatsächlich vorhandene Depot.

**PLAN Depotcheck**  
= tatsächliches Depot nach simulierten Verkäufen + geplante Käufe des aktiven Strukturplans.

Diese Depotcheck-Logik darf **nicht davon abhängen**, ob das Depot in der Strukturplanung auf `Nicht berücksichtigen`, `Nur im IST`, `Ausgewählte Positionen` oder `Nach simulierten Verkäufen` steht.

## 4.5 Tabelle unter dem Vermögenshaus

Bezeichnungen verständlicher machen.

Statt missverständlicher Begriffe wie `Neue Planung` bevorzugt:

- **Berücksichtigter Bestand**
- **Neuanlage**
- **Gesamtplan**

Ziel: klar zeigen, dass bestehende Positionen und neue Produktanlage gemeinsam den PLAN bilden.

## 4.6 Depotcheck Säulendetail

Im Depot-Vermögenshaus:

- Säule anklicken → Detail öffnet
- dieselbe Säule erneut anklicken → Detail schließt
- andere Säule anklicken → anderes Detail öffnet
- `Schließen ×` bleibt zusätzlich verfügbar

---

# 5. 🟡 Work-Paket 4B – Einstieg & Sparpläne

**Status: IN KONZEPTION**

Der heutige Bereich `Spar- und Investitionspläne` ist fachlich und UX-seitig nicht ausreichend. Insbesondere die gestaffelte Anlage wird grundlegend neu gedacht und nicht nur kosmetisch angepasst.

## 5.1 Gestaffelter Einstieg – bereits beschlossen

Eine gestaffelte Anlage ist **kein zusätzliches Anlagevolumen**, sondern der Umsetzungsweg einer bereits geplanten Produktallokation.

Beispiel:

- geplante Produktallokation: 100.000 €
- gestaffelter Anteil: 60 % bzw. 60.000 €
- Sofortanlage: 40.000 €
- gestaffelter Betrag: 60.000 €
- Anzahl Raten: 6
- Rate: 10.000 €

### Verbindliche Regeln

- Eingabemodus wahlweise **Prozent** oder **EUR**
- beide Eingabemodi beschreiben denselben gestaffelten Betrag
- Prozentmodus skaliert bei späterer Änderung des Zielbetrags mit
- EUR-Modus bleibt grundsätzlich als fester Betrag bestehen, soweit nicht > Zielbetrag
- Sofortanlage wird automatisch berechnet
- Ratenbetrag wird automatisch berechnet
- keine widersprüchliche manuelle Eingabe von Zielbetrag, Rate und Anzahl zulassen
- 0 % gestaffelt = alles sofort
- 100 % gestaffelt = alles gestaffelt
- Cent-Rundungen automatisch sauber behandeln
- letzte Rate darf Rundungsdifferenz aufnehmen
- geplantes Produktvolumen wird exakt einmal gezählt
- InvestmentPlan / Raten dürfen nicht zusätzlich zum Planungsvolumen addiert werden

## 5.2 Noch offene Entscheidung A – Wo wird der Einstieg geplant?

Bevorzugtes Zielbild:

Direkt an einer geplanten Produktposition in `Laufzeiten & Produkte`:

> Produktname  
> 150.000 €  
> **Einstieg planen**

Beim Klick öffnet sich die konkrete Umsetzungsplanung inline oder in einem unmittelbar zugeordneten Detailbereich.

Der bisherige separate Bereich `Spar- und Investitionspläne` könnte danach primär als **Zusammenfassung aller Umsetzungswege** dienen.

**Noch final zu bestätigen.**

## 5.3 Noch offene Entscheidung B – Produkt über mehrere Kapitaltöpfe

Beispiel:

- Produkt X insgesamt 150.000 €
- 50.000 € im Kapitaltopf 2034
- 100.000 € strategisch

Offene Frage:

- ein gemeinsamer Einstiegsplan für 150.000 €
- oder eigener Einstiegsplan je Produkt × Kapitaltopf

Bevorzugte fachliche Empfehlung:

**pro konkrete Produktallokation / Kapitaltopf**, weil sich Umsetzungshorizont und Bedarfstermin unterscheiden können.

**Noch final zu bestätigen.**

## 5.4 Sparplan – bereits beschlossen

Ein Sparplan ist fachlich getrennt von einer bestehenden Einmalanlage.

Verbindlich:

- Sparplan ist zusätzliches zukünftiges Vermögensaufbauen
- Sparplan zählt nicht zum einmaligen Planungsbetrag
- alle Produkte gelten im Prototyp als grundsätzlich sparplanfähig
- Produkte der aktuellen Planung zuerst anbieten
- danach vollständigen Produktkatalog anbieten
- Sparplansummen separat darstellen

Beispiel:

> Einmalige Neuplanung: 1.100.000 €  
> Zusätzliche laufende Sparpläne: 1.500 €/Monat

## 5.5 Noch offene Entscheidung C – Externes Sparplanprodukt

Offen:

Soll zusätzlich zum Produktkatalog ein frei erfassbares Sparplanprodukt möglich sein, zum Beispiel über:

- Produktbezeichnung
- WKN

**Noch nicht entschieden.**

## 5.6 Spätere Vertiefung direkt aus 4B

Die Umsetzungsmaske soll perspektivisch kontextbezogene Vertiefungen öffnen können, zum Beispiel:

- „Warum gestaffelt investieren?“
- „Entwicklung des Sparplans anzeigen“
- „Zinseszinseffekt zeigen“

Diese interaktiven Wissens-/Rechnerkomponenten werden jedoch als gemeinsames Vertiefungsframework konzipiert und nicht ungeplant in 4B hineingebaut.

---

# 6. 🟢 Depotcheck 3B – Portfolioanalyse

**Status: fachlich weitgehend beschlossen / nahezu WORK-READY**

Der durch V0.13 geschaffene Depotdatenbestand bildet die Grundlage.

Zukünftige Depotcheck-Unterbereiche:

1. Bestand & Transaktionen
2. Vermögenshaus
3. Diversifikation
4. Zins & Laufzeiten
5. Einstand & Ergebnis

## 6.1 Diversifikation

### Positionen / Konzentration

- Positionsgewichte
- Top-3-Konzentration
- Top-5-Konzentration
- größte Positionen
- geeignete Balken-/Donutdarstellung

### Produktarten hierarchisch

Gewünscht ist eine Haupt-/Unterkategorienlogik.

Beispiel:

**Renten**
- Festverzinsliche Anleihen
- Floater
- Stufenzinsanleihen
- Rentenfonds

**Aktien**
- Einzelaktien

Weitere Kategorien auf Basis von Anlagesegment, Anlagemedium und Wertpapiertyp.

### Branchen

- primär dort auswerten, wo die CSV eine belastbare Branche liefert
- insbesondere Einzelaktien
- Fonds nicht künstlich einer Branche zuordnen
- Fonds je nach Darstellung als `Sonstige / nicht durchgeschaut` bzw. außerhalb der direkten Branchenanalyse führen

### Länder

- direkte Produkt-/Emittentenländer aus vorhandenen Codes verwenden
- nicht mit wirtschaftlicher Fonds-Länderallokation verwechseln
- Fonds ohne Lookthrough separat / Sonstige
- sinnvoll sind Ansichten **inklusive Sonstige/Fonds** und **nur direkt zuordenbare Positionen**

### Währungen

- vorhandene Produktwährung anzeigen
- Produktwährung nicht als vollständiges wirtschaftliches Währungsrisiko eines Fonds darstellen
- direkte Wertpapiere belastbarer als Fonds
- transparente Coverage / nicht zuordenbare Anteile

## 6.2 IST und PLAN

Für Portfolioanalysen sind grundsätzlich nur zwei wirtschaftliche Zustände relevant:

- **IST**
- **PLAN nach allen simulierten Verkäufen und geplanten Käufen**

Kein zusätzlicher Analysezustand `Nach Verkäufen`.

## 6.3 Zins & Laufzeiten

Primär für geeignete direkte Rentenpositionen.

Mögliche Kennzahlen:

- Nominal
- Coupon / Zinssatz
- Fälligkeit
- Restlaufzeit
- Fälligkeitsleiter
- Current Yield
- modellierte Yield to Maturity bei geeigneten Festzinsanleihen
- Macaulay Duration
- Modified Duration
- DV01
- einfache Zinsszenarien

### Fachliche Einschränkungen

- nur berechnen, wenn Produkttyp und Datenlage die Berechnung belastbar zulassen
- Floater, Stufenzinsstrukturen oder Sonderbedingungen nicht fälschlich mit Standard-Festzinsformeln behandeln
- Coverage-Quote anzeigen: welcher Anteil des Rentenbestands ist tatsächlich berechenbar?
- tatsächliche Anleihefälligkeit, empfohlener Produktanlagehorizont und Kundenbedarfstermin bleiben getrennte Größen

## 6.4 Einstand & Ergebnis

Vorhandene CSV-Daten ermöglichen unter anderem:

- durchschnittlicher Einstand
- aktueller Kurs
- Kursgewinn/-verlust EUR
- Kursgewinn/-verlust Prozent
- Gewinner / Verlierer
- geeignete Visualisierung

### Wichtig

Diese Daten sind **keine echte Gesamtperformance**.

Ohne vollständige Zahlungsströme, Käufe, Verkäufe, Ausschüttungen und zeitgewichtete Berechnung darf keine vollständige Depotperformance behauptet werden.

---

# 7. 🔴 Risiko V2

**Status: FACHLICH OFFEN**

Die aktuelle Risikoorientierung nutzt weiterhin eine zu einfache aggregierte Logik. Die UX der Klickstrecke kann bleiben, das Fachmodell soll später neu entwickelt werden.

## 7.1 Zukünftig getrennte Dimensionen

Mindestens unterscheiden:

- **Risikowille**
- **finanzielle Risikotragfähigkeit**
- **Anlagehorizont**
- **Kenntnisse / Erfahrungen**

Diese Größen dürfen nicht einfach gleichgewichtet gemittelt werden.

## 7.2 Noch zu konzipieren

- welche Dimension bestimmt welches Limit?
- mögliche Caps durch fehlende Tragfähigkeit
- Umgang mit Konflikten, z. B. hohe Risikobereitschaft bei niedriger finanzieller Tragfähigkeit
- Rolle von Horizont und Liquiditätsbedarfen
- Rolle von Kenntnissen / Erfahrungen
- manuelle fachliche Bestätigung
- dokumentierte Abweichungsbegründung
- Visualisierung des Ergebnisses

---

# 8. 🟡 Vertiefungen – Wissens- und Rechnerframework

**Status: IN KONZEPTION**

Vertiefungen sollen nicht nur statische Textseiten sein. Ziel ist ein gemeinsames Framework, das kontextbezogene Erklärungen, Beispiele und interaktive Rechner verbinden kann.

## 8.1 Grundprinzip

Vertiefungen können:

- vor einer konkreten Produktempfehlung kontextbezogen angeboten werden
- aus einem konkreten Produkt / Kapitalbedarf / Sparplan geöffnet werden
- zusätzlich über eine dauerhafte `Vertiefen`-Navigation erreichbar sein

## 8.2 Gemeinsames Seiten-/Modulformat

Bevorzugter Aufbau:

1. Titel
2. kurze Kernaussage
3. 2–4 Erklärblöcke
4. optional interaktiver Rechner
5. optional Diagramm / Szenariovergleich
6. `Was bedeutet das für diesen Fall?`
7. Quelle / Datenstand bei fachlich zeitabhängigen Themen
8. Schließen

## 8.3 Themenbibliothek – Kern

### Vermögensplanung

- Vermögen strukturieren
- Liquidität & Anlagehorizont
- Risiko verstehen

### Kapitalanlage

- Anleihen & Zinsen
- Aktien & langfristiges Investieren
- Alternative Anlagen

### Umsetzung & Vermögensaufbau

- Einmalanlage oder gestaffelter Einstieg
- Durchschnittskosteneffekt
- langfristig Vermögen aufbauen
- Sparziel berechnen

### Spezialthemen

- Unternehmensliquidität
- Vorsorge & Versicherungslösungen

## 8.4 Gestaffelter Einstieg / Durchschnittskosteneffekt

Besonders relevant direkt aus 4B.

Mögliche Inhalte:

- Sofortanlage vs. zeitliche Staffelung
- Funktionsweise regelmäßiger Käufe
- schwankender Kursverlauf
- steigender Kursverlauf
- fallender Kursverlauf
- psychologische Wirkung einer Staffelung
- Opportunitätskosten nicht investierten Kapitals

### Wichtige fachliche Formulierung

Nicht pauschal behaupten, der Cost-Average-Effekt führe automatisch zu einer höheren Rendite oder sei einer Einmalanlage überlegen.

Stattdessen erklären:

> Bei festen regelmäßigen Anlagebeträgen werden bei niedrigeren Kursen mehr und bei höheren Kursen weniger Anteile erworben. Dies kann den durchschnittlichen Einstand beeinflussen. Eine höhere Rendite gegenüber einer Sofortanlage folgt daraus nicht automatisch.

## 8.5 Sparplan / Zinseszins

Direkt aus einem konkreten Sparplan aufrufbar.

Eingaben können aus dem Fall vorbefüllt werden:

- monatliche Sparrate
- optionales Startkapital
- Laufzeit
- angenommene Rendite
- optional Inflation

Ausgaben:

- Summe der Einzahlungen
- angenommener Wertzuwachs
- Endkapital
- Zinseszinseffekt
- optional verbleibende Kaufkraft nach Inflation
- Verlauf über die Zeit

## 8.6 Vermögensaufbaurechner

Eingaben:

- Startkapital
- monatliche Sparrate
- Laufzeit
- Renditeannahme
- Inflation optional

Ergebnis:

- Einzahlungen gesamt
- angenommener Wertzuwachs
- nominaler Endwert
- realer / kaufkraftbereinigter Wert optional
- Diagramm

## 8.7 Sparzielrechner

Umgekehrte Fragestellung:

- Zielbetrag
- vorhandenes Startkapital
- Zeitraum
- angenommene Rendite
- Inflation optional

Ergebnis:

- benötigte monatliche Sparrate

Perspektivisch direkte Verknüpfung mit einem Beratungsbedarf:

> Bedarf 2040 · 300.000 € → `Sparziel berechnen`

## 8.8 Steuern bei Kapitalanlagen – Privatvermögen

Als gemeinsame Vertiefung mit Unterbereichen denkbar:

### Grundlagen

- Zinsen
- Dividenden
- Kursgewinne
- Abgeltungsteuer
- Solidaritätszuschlag
- Kirchensteuer nur kontextabhängig

### Freistellungsauftrag

- Sparer-Pauschbetrag
- bereits genutzt
- noch verfügbar
- zunächst ggf. manuelle Eingabe, solange diese Daten nicht im Fallmodell vorhanden sind

### Verlustverrechnung

- Aktienverlusttopf
- allgemeiner / sonstiger Verlusttopf
- verständliche Beispiele
- keine unzulässige Vereinfachung komplexerer Sonderfälle

### Fonds / Teilfreistellung

Teilfreistellung soll ausdrücklich berücksichtigt werden.

Zu unterscheiden sind fachlich unter anderem:

- Aktienfonds
- Mischfonds
- Immobilienfonds
- weitere Fondsarten nach aktuellem Rechtsstand

Steuersätze, Freibeträge und Teilfreistellungen sind zeitabhängig. Deshalb:

- nur mit belastbarer Quelle
- sichtbarer Datenstand
- keine dauerhaft im UI behaupteten Werte ohne Quellen-/Aktualisierungslogik

## 8.9 🔴 Steuern & Bilanzierung bei Betriebsvermögen

Private Steuerlogik darf nicht einfach auf betriebliche Beratungsfälle übertragen werden.

Eigenes Fachkonzept erforderlich.

Zu prüfen sind je nach Rechtsform und Produkt unter anderem:

- handelsrechtliche Bilanzierung
- steuerliche Bilanzierung
- Bewertung zum Bilanzstichtag
- Ausschüttungen
- Veräußerungsgewinne / -verluste
- Fondsbesteuerung und Teilfreistellungen
- Körperschaftsteuer-Kontext
- Gewerbesteuer-Kontext
- Rechtsformabhängigkeit
- mögliche Abschreibungs-/Zuschreibungsthemen

**Noch keine fachliche Logik festgelegt.** Belastbare Quellen zwingend erforderlich.

## 8.10 Produktspezifische Steueroptimierungsrechner

Darstellungen wie `klassische Anlage vs. steueroptimierte Anlage` können als Visualisierung interessant sein, dürfen aber nicht pauschal als generischer Rechner umgesetzt werden.

Vor Umsetzung muss immer geklärt werden:

- konkretes Produkt
- konkrete steuerliche Regelung
- Laufzeit / Mindesthaltedauer
- Alter / Auszahlungsart, falls relevant
- Privat- oder Betriebsvermögen
- aktueller Rechtsstand

## 8.11 Vorsorge & Versicherungslösungen

Spätere eigene Vertiefung, primär für private Beratungsfälle.

Mögliche Themen:

- private Rentenversicherung
- Kapital vs. lebenslange Rente
- Langlebigkeitsrisiko
- Flexibilität
- Kosten
- Steuerbehandlung
- Vorsorgeziel

Nicht ungefiltert in betriebliche Beratungsfälle übernehmen.

---

# 9. 🟡 Ergebnis & Export

**Status: nach 4B erneut systematisch prüfen**

Der Export soll erst nach dem Umbau von Einstieg und Sparplänen endgültig konsolidiert werden, damit nicht zweimal dieselbe Logik angepasst wird.

## 9.1 Zukünftig konsistent exportieren

- Kapitaltöpfe
- Bedarfe / Termine
- aktive Planvariante
- ZIELPLAN / bevorzugte Variante
- Bestandsdepot-Berücksichtigung
- wirtschaftliche Vermögensstruktur
- Produkte
- Sofortanlage
- gestaffelter Betrag
- Anzahl / Höhe der Raten
- zusätzliche Sparpläne separat
- Depotcheck / Transaktionen soweit sinnvoll

## 9.2 Branding

Bereits für 4A.1 beschlossen:

- Volksbank-pur-Logo im PDF
- Private-Banking-Logo im PDF
- VermögensNavigator als Produktbezeichnung
- kein Logo-Platzhalter

---

# 10. Daten- und Quellenprinzipien

## 10.1 Interne Referenzdateien

Fachliche Referenzdateien können für die Implementierung genutzt werden, sollen aber nicht automatisch in das öffentliche Repository übernommen werden.

Insbesondere gilt für sensible oder rein interne Originaldateien:

- nur als Referenz verwenden
- nicht committen, sofern nicht ausdrücklich freigegeben
- relevante fachliche Zuordnungen gezielt in wartbare Code-/Datenstrukturen übernehmen

Dies wurde bereits beim Strukturübersicht-CSV und der Ländercode-Referenz so gehandhabt.

## 10.2 Bestehende fachliche Datenquellen des Prototyps

Der Prototyp verwendet unter anderem Informationen aus:

- Orientierung zu Anlagemöglichkeiten / Anlagehorizonten
- Modellportfolios Private Banking
- Hausmeinung / Fondsmatrix
- VV-Selektionsmatrix
- Depotoptimierer / bestehende KCI-Logik
- Corporate-Design-/Styleguide

Quellenstände sollen bei relevanten Modulen weiterhin sichtbar bzw. nachvollziehbar bleiben.

## 10.3 Ungeklärte Produktdurchschau

Private Select Defensiv / Ausgewogen / Offensiv bleiben aktuell bewusst **ungeklärt**, solange keine belastbare Quelle für die wirtschaftliche Durchschau vorliegt.

Keine automatische Gleichsetzung mit anders benannten Private-Select-Modellen.

---

# 11. Branding / Corporate Design

## 11.1 Farbwelt

Bestehende Kernfarben orientieren sich am Corporate Design, insbesondere:

- VR Blau
- VR Ultramarin
- VR Orange
- Weiß

## 11.2 Logos

Repository-Assets:

- `public/branding/volksbank-pur-logo.png`
- `public/branding/private-banking-logo.png`

Grundsatz:

- zwei getrennte Markenassets
- nicht künstlich zu einer neuen Grafik zusammenbauen
- Volksbank pur = Hauptmarke
- Private Banking = Bereichskennzeichnung
- VermögensNavigator = Produktname, kein drittes Logo

Die bekannte CD-Vorgabe zur relativen Größe des Private-Banking-Schriftzugs gegenüber `Volksbank pur` soll eingehalten werden.

## 11.3 Schrift

Die CSS-Familie ist auf `GenosGFG` mit Fallbacks vorbereitet. Ein echter `@font-face`-Einsatz soll erst erfolgen, wenn offizielle und nutzungsrechtlich geklärte Webfontdateien vorliegen.

Keine zufällig aus dem Internet beschafften Fontdateien verwenden.

---

# 12. Technische / fachliche Kernzustände

## 12.1 Planvarianten

- `activePlanId` bestimmt die aktive Arbeits-/PLAN-Variante
- bevorzugte / `preferred` Variante bestimmt den ZIELPLAN
- Existieren mehrere Varianten, darf keine andere Variante automatisch anhand Erstellungsdatum o. Ä. als PLAN gewählt werden

## 12.2 Kapitaltöpfe

Sichtbare Topfarten:

- Reserve
- Jahresbedarf
- strategisch

Regeln:

- keine Nulltöpfe anzeigen
- gleicher Zieljahrgang kann mehrere Bedarfe zusammenfassen
- Einzelbedarfe bleiben innerhalb des Topfs erhalten
- strategischer Topf nur positiv
- Fehlbetrag separat sichtbar

## 12.3 Bedarfstermin / Produkthorizont / Anleihefälligkeit

Diese drei Größen sind fachlich verschieden und dürfen nicht gleichgesetzt werden:

1. Kundenbedarfstermin
2. empfohlener Produktanlagehorizont
3. tatsächliche Fälligkeit eines Wertpapiers

Bei allgemeiner Zuordnung eines Produkts zum Jahrestopf ist der früheste konkrete Bedarf innerhalb dieses Topfs für die zeitliche Plausibilisierung relevant. Bei expliziter Zuordnung zu einem einzelnen Unterbedarf kann dessen eigener Termin verwendet werden.

---

# 13. Beratungslogik Privat vs. Betrieblich

Der Kern der Anwendung soll gemeinsam bleiben, aber nicht jede Vertiefung oder Fachlogik ist identisch.

## Privatvermögen

Typische Schwerpunkte:

- Liquiditätsreserve
- persönliche Ziele / Bedarfe
- Depot
- Vermögensaufbau
- Vorsorge
- Nachfolge
- private Kapitalertragsteuer

## Betriebsvermögen

Typische Schwerpunkte:

- tatsächlich investierbare Firmenliquidität
- operative Liquiditätsbedarfe
- Bilanzierung
- Steuern
- Rechtsform
- Anlagehorizonte der Firmenliquidität

Eine gemeinsame UI darf diese Unterschiede nicht durch falsche Vereinheitlichung verwischen.

---

# 14. Work- und Git-Strategie

## 14.1 GitHub als einzige gepflegte Codebasis

- GitHub-`main` ist der veröffentlichte Entwicklungsstand
- GitHub Pages stellt die öffentliche Testversion bereit
- frühere alternative Prototypquellen werden nicht parallel weiterentwickelt

## 14.2 Feature-Branches für größere Pakete

Größere Work-Pakete auf eigenem Arbeitsbranch.

Ziel:

- frühe stabile Checkpoints
- Zwischenstände remote sichern
- keine wiederholten Main-/Pages-Deployments
- Merge auf `main` nur bei vollständigem, getestetem Paket

## 14.3 Checkpoints

Bei größeren Paketen mindestens fachlich sinnvolle Checkpoints verwenden.

Wenn das Nutzungslimit knapp wird:

- keine neue große Teilaufgabe beginnen
- stabilen Stand committen
- Branch pushen
- nicht unvollständig nach `main` mergen

## 14.4 Tests

Pflicht bei größeren Paketen:

- TypeScript
- Produktionsbuild
- `git diff --check`
- fokussierte Funktionstests
- offensichtliche angrenzende Regressionen
- Commit / Push
- erfolgreicher GitHub-Workflow / Pages bei finaler Veröffentlichung

Nicht automatisch für jedes Paket:

- komplette E2E-Abnahme der gesamten Anwendung
- lange Agenten-Browserprüfungen, wenn lokale Ports technisch nicht erreichbar sind

Die sichtbare UX-Abnahme erfolgt anschließend gemeinsam manuell.

## 14.5 Modell-/Ressourcenstrategie

Aktuelle Arbeitsregel:

- kleine gesammelte klare Änderungen: eher Terra Mittel oder an größeres Paket anhängen
- normaler kohärenter Featureblock: Sol Mittel
- schwieriger Refactor / Architektur / hartes Debugging: Sol Hoch
- Max nur ausnahmsweise

### Credits

Aus dem V0.14-Lauf abgeleitete Regel:

- große Pakete grundsätzlich aus regulärem Work-Kontingent starten
- bezahlte Credits nicht als Standardersatz für das Wochen-/5h-Kontingent verwenden
- Credits können sinnvoll sein, wenn ein regulärer Lauf fachlich nahezu fertig und bereits persistent gesichert ist und nur noch kleiner Fix, Merge oder Deployment fehlt
- entscheidend ist der Fortschritt des gesicherten fachlichen Kerns, nicht eine starre Creditzahl

---

# 15. Bekannte Regressionstest-Fälle

Keine realen Referenzdateien als öffentliche Testfixtures committen. Werte können für manuelle Plausibilisierung genutzt werden.

## 15.1 Kapitaltopf-Referenzfall

Planungsbetrag: **1.100.000 €**

- Reserve: 240.000 €
- Bedarf 2029: 300.000 €
- Bedarf 2034: 200.000 €
- strategisch: 360.000 €

Geeignet für Tests von:

- Topfabdeckung
- Produktzuordnung
- Overflow
- Überplanung
- gemischten Topfstrukturen
- PLAN / ZIELPLAN

## 15.2 Depot-Referenzfall

Bekannte Teststruktur:

- 11 Positionen
- Gesamtwert ungefähr 423.953 €
- Mischung aus Einzelaktien, direkten Rentenwerten und Rentenfonds

Geeignet für:

- CSV-Import
- Stück / Nominal
- Positionsdetails
- simulierte Verkäufe
- Depot-Vermögenshaus
- spätere 3B-Analysen

## 15.3 Bestandsdepot-Gesamtstruktur

Bekannter Testbestand: ungefähr **620.000 €**.

Zusammen mit 1.100.000 € Neuanlage ergibt sich im passenden Modus eine Gesamtbetrachtung von etwa **1.720.000 €**.

Geeignet für:

- Bestandsdepot-Modi
- Vermögenshaus IST / PLAN
- Neuanlage vs. Bestand

## 15.4 PLAN / ZIELPLAN

Test:

- Plan A aktiv
- Plan B deutlich verändert
- Plan B als bevorzugt markieren
- wieder Plan A aktivieren

Erwartung:

- PLAN = Plan A
- ZIELPLAN = Plan B

---

# 16. Bewusst später / aktuell nicht planen

## ⏳ Mobile

Keine Mobile-Optimierung in der aktuellen Prototyp-Phase.

## ⏳ Vollständige echte Depotperformance

Erst möglich mit belastbaren vollständigen Zahlungsstromdaten.

## ⏳ Vollständiger Fonds-Lookthrough

Nur mit belastbaren Quellen / Datenbeständen.

## ⏳ Private Select D/A/O

Durchschau bleibt ungeklärt, bis belastbare Quelle vorhanden ist.

## ⏳ Produktspezifische Steueroptimierungsrechner

Nur nach eigenem Fachkonzept und mit aktuellen Quellen.

---

# 17. Roadmap – empfohlene Reihenfolge

| Reihenfolge | Paket / Konzept | Status |
|---:|---|---|
| 1 | **4A.1 Bestandsdepot-Logik & V0.14-Fixes** | 🟢 Work-ready |
| 2 | **4B Einstieg & Sparpläne** | 🟡 letzte Entscheidungen offen |
| 3 | **Depotcheck 3B Portfolioanalyse** | 🟢 nahezu Work-ready |
| 4 | **Risiko V2** | 🔴 Fachkonzept nötig |
| 5 | **Vertiefungsframework** | 🟡 Konzept weiter ausarbeiten |
| 6 | **Ergebnis & Export konsolidieren** | 🟡 nach 4B vollständig testen |
| 7 | finaler Gesamt-UX-/Regressionsblock | ⏳ später |

Die Reihenfolge kann sich ändern, wenn ein fachlicher Block priorisiert werden muss. Kleine Fixes sollen möglichst gebündelt werden.

---

# 18. Offene Entscheidungen – nächste Brainstorming-Punkte

## 4B

1. `Einstieg planen` direkt an jeder Produktallokation endgültig bestätigen
2. gestaffelter Einstieg pro Gesamtprodukt oder pro Produkt × Kapitaltopf endgültig bestätigen
3. freie WKN / Produktbezeichnung für Sparpläne außerhalb des Produktkatalogs ja/nein
4. Startdatum / Frequenz / mögliche individuelle Ratenlogik nach dem Kernmodell konkretisieren

## Risiko V2

- Bewertungslogik der getrennten Risikodimensionen
- Caps / Konflikte / Override

## Vertiefungen

- konkrete Triggerlogik
- zentrale `Vertiefen`-Navigation
- Quellen-/Datenstand-Konzept
- Welche Rechner gehören in den ersten MVP des Vertiefungsframeworks?
- steuerliche Inhalte Privat
- separates Fachkonzept Betrieblich / Bilanzierung

## Depotcheck 3B

- exakte Visualisierungen je Analyse
- finale Produkttyp-Kategorisierung aus den CSV-Enums
- robuste mathematische Abgrenzung berechenbarer Rentenwerte

---

# 19. Entscheidungslog

## 04.09.2026

- Master-Spezifikation als kanonischer Produktstand eingeführt.
- V0.14 grundsätzlich abgenommen, aber 4A.1 als separates Fixpaket definiert.
- Private-Banking-Logo muss im Header vollständig sichtbar sein.
- PDF/Kundenübersicht muss Volksbank-pur-Logo **und** Private-Banking-Logo verwenden.
- Bestandsdepot-Modi der Strukturplanung fachlich neu präzisiert.
- `Nicht berücksichtigen` entfernt das Depot auch aus IST der Strukturplanung.
- Modus `Nur im IST berücksichtigen` wird fachlich explizit geführt.
- `Nach simulierten Verkäufen` berücksichtigt automatisch den gesamten Restbestand, keine Positionscheckboxen notwendig.
- `Ausgewählte Positionen beibehalten` verwendet eine bewusste Positionsauswahl nur für PLAN.
- Depotcheck IST/PLAN wird von der Bestandsdepot-Steuerung der Strukturplanung entkoppelt.
- Depotcheck-Säulendetail soll durch erneuten Klick auf dieselbe Säule geschlossen werden können.
- Gestaffelte Anlage und Sparplan bleiben eigenes Paket 4B.
- Sparplan-/Einstiegsvertiefungen sollen später konkrete Kundendaten in Rechnern verwenden können.
- Zinseszinsdarstellung für konkrete Sparpläne als wichtige Vertiefungsidee aufgenommen.
- Steuervertiefungen sollen Teilfreistellungen berücksichtigen.
- Betriebliche Steuer-/Bilanzierungslogik wird nicht aus der Privatlogik abgeleitet, sondern separat fachlich konzipiert.
- Bezahlte Work-Credits künftig primär als Verlängerung bereits weit fortgeschrittener und gesicherter Runs, nicht als Standardstart großer Pakete.

---

# 20. Pflege dieses Dokuments

Nach jedem größeren abgeschlossenen Brainstorming oder Work-Paket:

1. Versions-/Umsetzungsstand aktualisieren
2. neue Entscheidungen aus `IN KONZEPTION` nach `WORK-READY` verschieben
3. nach Umsetzung nach `UMGESETZT` verschieben
4. echte neue offene Punkte ergänzen
5. Entscheidungslog um wenige relevante Entscheidungen erweitern
6. keine vollständigen Work-Prompts in diese Datei kopieren

Ziel ist ein **präziser, ausführlicher, aber aktueller Produktstand**, kein historisches Chatarchiv.
