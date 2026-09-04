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

Dieses Dokument ist die zentrale **Source of Truth** für Produktkonzept, fachliche Entscheidungen, bekannte Fehler, offene Fachthemen, Work-Pakete und Roadmap des VermögensNavigators.

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

Nach einem abgeschlossenen Brainstorming-Block oder Work-Paket wird diese Datei aktualisiert. Nicht jede Zwischenidee wird sofort eingetragen.

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
- Bestehende Planbeträge dürfen durch nachgelagerte Umsetzungswege nicht doppelt gezählt werden.
- Fachliche Beziehungen sollen im Datenmodell explizit sein und nicht aus Produktnamen oder UI-Zuständen rekonstruiert werden.

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

Wichtige begriffliche Trennung:

- **Kapitalbedarf** = Bedarf, der die heutige Kapital-/Zeitstruktur tatsächlich beeinflusst und einen Kapitaltopf erzeugen oder verändern kann.
- **Sparziel** = zukünftiges Ziel eines Sparplans bzw. Vermögensaufbaus, das **nicht automatisch heutiges Kapital reserviert**, keinen Kapitaltopf erzeugt und keine Topfabdeckung verursacht.

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

# 4. 🟢 Work-Paket 4A.1 – Bestandsdepot-Logik, Kapitaltopf-Lifecycle & V0.14-Fixes

**Status: BESCHLOSSEN / WORK-READY**

Dieses Paket ist fachlich klar abgegrenzt und soll **vor** dem InvestmentPlan-Umbau umgesetzt werden. Es enthält keine neue Depotanalyse und keine neue Spar-/Investmentplanlogik.

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
- für `Nach simulierten Verkäufen` automatisch den vollständigen aktuellen Bestand verwenden
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

## 4.7 Kapitaltopf-Lifecycle / verwaiste Zuordnungen

### Bekannter Fehler

Wenn ein Kapitalbedarf gelöscht wird und dadurch ein Kapitaltopf verschwindet, können im aktuellen Stand Produktzuordnungen und Umsetzungspläne weiter auf den nicht mehr sichtbaren Topf verweisen.

Beobachteter Regressionstest:

- vorher zusätzliche Bedarfe / Kapitaltöpfe vorhanden
- diesen Bedarf anschließend löschen
- Gesamtliquidität auf 350.000 € reduzieren
- sichtbarer Topf: nur noch strategisch 350.000 €
- trotzdem können z. B. 500.000 € als „Produkten zugeordnet“ / Topfabdeckung sowie in Vermögensstruktur und Umsetzungsweg weiterleben

Solche **Geisterzuordnungen sind unzulässig**.

### Verbindliche Regeln

- Jede `capitalPotId` einer Allokation muss auf einen aktuell existierenden Kapitaltopf verweisen.
- Wird der **letzte Bedarf eines Jahrestopfs** gelöscht und verschwindet der Topf dadurch vollständig, müssen betroffene Produktzuordnungen fachlich bereinigt werden.
- Bei einer Multi-Topf-Allokation wird nur der Anteil des verschwundenen Topfs entfernt.
- Andere weiterhin gültige Topfanteile derselben Produktposition bleiben erhalten.
- Betroffene Umsetzungspläne / Einstiegspläne des verschwundenen konkreten Topfanteils dürfen nicht verwaist weiterbestehen.
- Nicht automatisch nach `strategisch` verschieben. Das würde eine nicht getroffene Beratungsentscheidung erfinden.
- Wenn ein belegter Kapitaltopf durch Löschen eines Bedarfs verschwinden würde, soll die Oberfläche vor dem Löschen transparent warnen, z. B. Anzahl und Betrag betroffener Produktzuordnungen / Umsetzungsbezüge nennen.
- Zulässige Aktion: Bedarf und damit verbundene Topfzuordnungen bewusst löschen oder Vorgang abbrechen.
- Wenn nach dem Löschen anderer Bedarfe **derselbe Jahrestopf weiterhin existiert**, bleiben seine Produktzuordnungen bestehen.
- Änderungen an Liquidität, die lediglich eine bewusste Überplanung erzeugen, dürfen Produkte nicht automatisch kürzen. Überplanung bleibt sichtbar und bewusst möglich.
- Nach jeder Änderung der Bedarfe / Topfstruktur muss eine Integritätsprüfung verhindern, dass unsichtbare Topf-IDs in Produktzuordnung, Topfabdeckung, Vermögensstruktur oder Umsetzung weitergerechnet werden.

### Regressionstest

Nach Entfernen eines Topfs müssen folgende Größen nur noch auf existierende Töpfe / gültige Allokationen zurückgreifen:

- `Produkten zugeordnet`
- `Topfabdeckung`
- Vermögensstruktur / Vermögenshaus
- Modellportfolio-/VV-Beiträge
- Umsetzungsübersicht / InvestmentPlan-Bezüge

---

# 5. 🟢 Work-Paket 4B – Einstieg & Sparpläne

**Status: BESCHLOSSEN / WORK-READY**

Der heutige Bereich `Spar- und Investitionspläne` ist fachlich und UX-seitig nur eine Übergangslösung. 4B baut die Umsetzung einer geplanten Produktallokation fachlich neu auf und trennt sie sauber von zusätzlichem zukünftigen Sparen.

## 5.1 Grundprinzip: Produktplanung und Umsetzung sind zwei Ebenen

Eine Produktallokation beantwortet:

> **Welcher Betrag soll in welches Produkt und welchen Kapitaltopf investiert werden?**

Der Umsetzungsweg beantwortet:

> **Wie wird genau dieser bereits geplante Betrag umgesetzt?**

Ein Sparplan beantwortet dagegen:

> **Welche zusätzlichen zukünftigen Beiträge sollen laufend investiert werden?**

Daraus folgen drei feste Regeln:

1. Ein Einstiegsplan darf das geplante Produktvolumen **nicht erhöhen**.
2. Ein Sparplan darf den einmaligen Planungsbetrag **nicht erhöhen**.
3. Sparplan-Ziele dürfen die heutige Kapitaltopfstruktur **nicht automatisch verändern oder abdecken**.

---

## 5.2 Gestaffelter Einstieg – Bezugsobjekt

Ein Einstiegsplan gehört **nicht zum Produktnamen global**, sondern zu einer konkreten:

> **Produktallokation × Kapitaltopf**

Beispiel:

- ZinsFix Index · Kapitaltopf 2034 · 50.000 €
- ZinsFix Index · Strategisch · 100.000 €

Für beide Allokationen darf ein unterschiedlicher Umsetzungsweg gelten.

Beispiel:

- 50.000 € im Topf 2034 → komplett sofort
- 100.000 € strategisch → 40.000 € sofort + 60.000 € gestaffelt

Der Bezug muss über stabile IDs erfolgen und darf nicht aus Produktname + Topflabel rekonstruiert werden.

---

## 5.3 Standardzustand: Komplett sofort

Der Berater soll **nicht gezwungen werden**, für jede Produktposition aktiv einen Einstiegsplan anzulegen.

Jede Produktallokation gilt standardmäßig als:

> **Umsetzung: Komplett sofort**

Direkt an der Produktposition beispielsweise:

> ZinsFix Index  
> Strategisch verfügbares Kapital · 100.000 €  
> **Umsetzung: Komplett sofort · Ändern**

Dafür ist kein zusätzlicher Klick erforderlich.

Technisch darf `Komplett sofort` implizit aus der Produktallokation folgen, solange keine abweichende Umsetzungsentscheidung gespeichert wurde. Es ist nicht erforderlich, für jede unangetastete Position einen redundanten InvestmentPlan-Datensatz anzulegen.

---

## 5.4 Einstieg direkt an der Produktposition bearbeiten

Der bisherige globale Button `+ Gestaffelte Anlage` ist nicht mehr der primäre Erfassungsweg und soll im Zielbild entfallen.

Direkt an jeder konkreten Produktallokation wird der Umsetzungsstatus sichtbar und über `Ändern` bearbeitet.

Mögliche Modi:

- **Komplett sofort**
- **Teilweise gestaffelt**
- **Komplett gestaffelt**

Bei `Teilweise gestaffelt` oder `Komplett gestaffelt` öffnet sich die Umsetzungsplanung unmittelbar bei der betreffenden Produktposition.

Der Zielbetrag ist **nicht frei editierbar**. Er stammt aus der Produktallokation.

---

## 5.5 Staffelungslogik Prozent / EUR

Beispiel:

- geplante Produktallokation: 100.000 €
- gestaffelter Anteil: 60 % bzw. 60.000 €
- Sofortanlage: 40.000 €
- gestaffelter Betrag: 60.000 €
- Anzahl Raten: 6
- Rate: 10.000 €

### Verbindliche Regeln

- Eingabemodus wahlweise **Prozent** oder **EUR**.
- Beide Modi beschreiben denselben gestaffelten Betrag, sie sind keine zwei unabhängigen Eingaben.
- Sofortanlage = Zielbetrag minus gestaffelter Betrag.
- Ratenbetrag = gestaffelter Betrag geteilt durch Anzahl Raten.
- Rate wird automatisch berechnet und nicht unabhängig widersprüchlich manuell gepflegt.
- 0 % gestaffelt = komplett sofort.
- 100 % gestaffelt = komplett gestaffelt.
- Cent-Rundungen automatisch sauber behandeln.
- Letzte Rate darf einen Rundungsrest aufnehmen, damit die Summe exakt dem gestaffelten Betrag entspricht.
- Geplantes Produktvolumen wird exakt einmal gezählt.
- Raten dürfen nicht zusätzlich zum Planungsvolumen addiert werden.

### Verhalten bei späterer Änderung der Produktallokation

**Prozentmodus**

Beispiel: 100.000 € Zielbetrag, 60 % gestaffelt. Zielbetrag wird auf 150.000 € erhöht.

Erwartung:

- 60 % bleiben gespeichert
- gestaffelter Betrag wird 90.000 €
- Sofortanlage wird 60.000 €

**EUR-Modus**

Beispiel: 100.000 € Zielbetrag, 60.000 € gestaffelt. Zielbetrag wird auf 150.000 € erhöht.

Erwartung:

- 60.000 € bleiben gespeichert
- Sofortanlage wird 90.000 €

Wird der Zielbetrag im EUR-Modus unter den gespeicherten Staffelbetrag reduziert, darf die Anwendung nicht stillschweigend eine neue fachliche Entscheidung treffen.

Stattdessen sichtbar warnen:

> Gestaffelter Betrag übersteigt den aktuellen Zielbetrag. Bitte Einstieg anpassen.

---

## 5.6 Raten, Rhythmus und Start

### Anzahl Raten

- bei Staffelung manuell festlegen
- positive ganze Zahl
- Rate automatisch daraus berechnen

### Rhythmus

Für den Prototyp ausreichend:

- monatlich
- vierteljährlich
- halbjährlich
- jährlich

Keine freie komplexe Intervalllogik in 4B.

### Startdatum

Startdatum bleibt frei änderbar.

Sinnvolle Vorbelegung:

- aktuelles Datum 1.–14. → nächster 15.
- aktuelles Datum ab 15. → 1. des Folgemonats

Beispiel am 04.09.2026:

> Standard: 15.09.2026

Die Vorbelegung gilt sinngemäß auch für neue Sparpläne.

### Optionaler Hinweis

Freitext für operative Hinweise kann bleiben, z. B. „nach Freigabe starten“.

---

## 5.7 Umsetzungsübersicht statt zweiter Produktplanung

Der bisherige Bereich `Spar- und Investitionspläne` bleibt als **Umsetzungsübersicht**, ist aber nicht mehr der primäre Erfassungsort für gestaffelte Einstiege.

Beispiel:

### Geplante Einstiege

**UniMarktführer · Strategisch · 150.000 €**  
Komplett sofort

**ZinsFix Index · Strategisch · 100.000 €**  
40.000 € sofort · 6 × 10.000 € monatlich ab 15.09.2026

**ZinsFix Index · 2034 · 50.000 €**  
Komplett sofort

### Laufende Sparpläne

**UniGlobal · 500 €/Monat**  
ab 01.10.2026 · fortlaufend  
Ziel: optionales Sparziel

Die Übersicht darf keine eigene unabhängige Produkt- oder Kapitaltopfzuordnung erzeugen.

---

## 5.8 Sparplan – fachliche Abgrenzung

Ein Sparplan ist **zusätzliches zukünftiges Vermögensaufbauen** und getrennt von der aktuellen Einmalanlage.

Verbindlich:

- Sparplan zählt nicht zum einmaligen Planungsbetrag.
- Sparplan zählt nicht zu `Produkten zugeordnet` der heutigen Kapitaltöpfe.
- Sparplan zählt nicht zur `Topfabdeckung`.
- Sparplan verändert nicht automatisch Reserve, Jahrestöpfe oder strategisch verfügbares Kapital.
- alle Produkte gelten im Prototyp als grundsätzlich sparplanfähig.
- Sparplansummen werden separat dargestellt.

Beispiel:

> Einmalige Neuplanung: 1.100.000 €  
> Zusätzliche Sparpläne: 1.500 €/Monat

Die heute bereits richtige Trennung, dass ein Sparplan Kapitaltöpfe, Produktzuordnung und Planungsbetrag nicht verändert, muss erhalten bleiben.

---

## 5.9 Sparplan – Produktwahl

Der heutige Stand beschränkt den Produktpicker auf Produkte der aktuellen Planung. Das wird erweitert.

Ziel:

### Gruppe 1: Im aktuellen Plan

- aktuelle Planprodukte zuerst
- innerhalb der Gruppe sinnvoll priorisieren, bevorzugt nach geplantem Gesamtbetrag absteigend

### Gruppe 2: Weitere Lösungsbausteine

- vollständiger interner Produktkatalog

Regeln:

- dasselbe Produkt nicht doppelt in beiden Gruppen als separate auswählbare Dublette anbieten
- Suchfunktion nutzen, falls vorhandene Picker-Architektur dies unterstützt
- **kein freies externes Produkt / keine freie WKN in 4B**
- externe Freitextprodukte erst später bei nachgewiesenem Bedarf

---

## 5.10 Sparplan – operative Felder

Im eigentlichen Sparplan nur die operative Umsetzung speichern.

### Felder

- **Bezeichnung** optional
- **Produkt**
- **Sparrate**
- **Rhythmus**
- **Startdatum**
- **Zielbezug / Sparziel** optional
- **Hinweis** optional
- Status grundsätzlich `fortlaufend`

### Rhythmus

- monatlich
- vierteljährlich
- halbjährlich
- jährlich

### Nicht im operativen Sparplan erzwingen

- keine verpflichtende Anzahl Raten
- kein verpflichtendes Enddatum
- kein Kapitaltopf-Auswahlfeld
- keine Renditeannahme
- keine Inflationsannahme
- keine prognostizierte Endsumme als Teil des verbindlichen Planvolumens

Laufzeit, Rendite und Inflation gehören in die spätere Vertiefung / Beispielrechnung.

---

## 5.11 Sparziel statt neuem Kapitalbedarf

### Entscheidender Grundsatz

Ein langfristiges Sparziel, das **nicht aus dem heute vorhandenen Kapital reserviert werden soll**, ist **kein Kapitalbedarf**.

Dafür wird der eigene Begriff / Zustand:

> **Sparziel**

verwendet.

Ein Sparziel:

- erzeugt **keinen Kapitaltopf**
- reduziert **nicht** das strategisch verfügbare Kapital
- verändert **nicht** die heutige Kapitaltopfstruktur
- deckt **keinen Kapitaltopf** ab
- erhöht **nicht** die Topfabdeckung
- erhöht **nicht** das heutige Planungsvolumen
- kann später als Zielgröße für Sparziel-/Zinseszinsrechner dienen

### Zielbezug im Sparplan

Mögliche Auswahl:

- **Kein Zielbezug**
- **Bestehendes Sparziel verknüpfen**
- **Neues Sparziel anlegen**
- optional: **Bestehenden echten Kapitalbedarf referenzieren**, jedoch nur als informative Verbindung, niemals als automatische Deckung durch den Sparplan

### Neues Sparziel

Mindestens sinnvoll:

- Bezeichnung / Zweck
- Zielbetrag
- Zieljahr / Zieldatum

Optional weitere Felder erst später.

Wichtig:

> Das Anlegen eines neuen Sparziels aus einem Sparplan darf **keinen neuen Kapitalbedarf in `data.needs` erzeugen** und darf daher auch keinen neuen Jahrestopf erzeugen.

### Bestehender echter Kapitalbedarf als Referenz

Ein Sparplan darf perspektivisch mit einem bereits vorhandenen echten Kapitalbedarf verknüpft werden, z. B. als Hinweis, dass parallel für diesen Zweck gespart wird.

Auch dann gilt:

- der Sparplan deckt den Bedarf nicht automatisch
- der Sparplan verändert die heutige Topfabdeckung nicht
- der echte Kapitalbedarf behält seine normale Wirkung auf die heutige Kapitaltopfstruktur
- Verknüpfung ist zunächst informativ

### Löschen / Ändern eines Zielbezugs

- wird ein Sparziel gelöscht, bleibt der Sparplan bestehen und verliert nur seinen Zielbezug
- wird ein verknüpfter echter Kapitalbedarf gelöscht, bleibt der Sparplan bestehen und verliert nur diese Referenz
- Zieländerungen dürfen den operativen Sparplan nicht löschen

---

## 5.12 Zusammenfassung von Sparplänen

Bei ausschließlich monatlichen Sparplänen beispielsweise:

> Zusätzliche Sparpläne: 1.500 €/Monat

Bei unterschiedlichen Rhythmen keine irreführende künstliche Monatsrate erzwingen.

Sinnvoll beispielsweise:

> Laufende Sparbeiträge: 18.000 €/Jahr

und darunter die tatsächlichen Rhythmen, z. B.:

- 1.000 €/Monat
- 1.500 €/Quartal
- 3.000 €/Jahr

Die Jahresaggregation kann rein informativ sein. Die originären Rhythmen bleiben sichtbar.

---

## 5.13 Lifecycle der Umsetzung

Die neue 4B-Logik muss robust auf Änderungen der zugrunde liegenden Planung reagieren.

### Wird eine Produktallokation gelöscht

- zugehöriger expliziter Einstiegsplan dieser konkreten Produktallokation wird ebenfalls entfernt
- keine verwaiste Umsetzung darf weiter in der Übersicht erscheinen

### Wird ein Kapitaltopf entfernt

- Verhalten folgt 4A.1 Abschnitt 4.7
- Einstiegspläne verwaister Produkt×Topf-Allokationen werden bereinigt

### Wird Produktbetrag verändert

- Verhalten gemäß Prozent-/EUR-Modus aus 5.5

### Wird ein Sparplanprodukt aus der Einmalplanung entfernt

- Sparplan bleibt bestehen, da er fachlich unabhängig von der Einmalallokation ist
- Produkt bleibt über den Produktkatalog referenzierbar

---

## 5.14 Nicht Teil von 4B

Nicht in dieses Paket hineinziehen:

- vollständiger Durchschnittskosteneffekt-Rechner
- Sparzielrechner mit Renditeannahme
- Zinseszins-/Wertentwicklungsrechner
- Inflation / Kaufkraftberechnung
- steuerliche Sparplanberechnungen
- externe freie WKN / Freitextprodukte
- Depotcheck 3B
- Risiko V2
- Export-Endkonsolidierung

4B schafft lediglich die fachlich sauberen Daten, Zustände und Verknüpfungen, auf die spätere Vertiefungen aufsetzen.

---

## 5.15 Regressionstestfälle für 4B

### A – Standard Sofortanlage

Produktallokation 100.000 € anlegen und nichts an der Umsetzung ändern.

Erwartung:

- sichtbarer Status `Komplett sofort`
- Planvolumen bleibt 100.000 €
- kein unnötiger manueller Einstiegsdatensatz erforderlich

### B – 60 % gestaffelt

100.000 € Zielbetrag, 60 %, 6 Raten.

Erwartung:

- sofort 40.000 €
- gestaffelt 60.000 €
- 6 × 10.000 €
- Planvolumen weiterhin exakt 100.000 €

### C – 60.000 € gestaffelt im EUR-Modus

Zielbetrag anschließend auf 150.000 € erhöhen.

Erwartung:

- gestaffelt bleibt 60.000 €
- sofort 90.000 €

### D – Prozentmodus bei Zielbetragsänderung

100.000 €, 60 % → Zielbetrag 150.000 €.

Erwartung:

- gestaffelt 90.000 €
- sofort 60.000 €

### E – EUR-Modus über Zielbetrag

60.000 € gestaffelt, Zielbetrag danach auf 50.000 € reduzieren.

Erwartung:

- sichtbare Inkonsistenzwarnung
- keine stille automatische fachliche Entscheidung

### F – Gleiches Produkt in zwei Kapitaltöpfen

ZinsFix Index 50.000 € in 2034 und 100.000 € strategisch.

Erwartung:

- zwei unabhängige Umsetzungswege
- Änderungen an einem Einstieg beeinflussen den anderen nicht

### G – Sparplan auf Planprodukt

500 €/Monat auf Produkt aus aktueller Einmalplanung.

Erwartung:

- Planungsbetrag unverändert
- Produktzuordnung der Kapitaltöpfe unverändert
- Topfabdeckung unverändert
- Sparplan separat sichtbar

### H – Sparplan auf Produkt nur aus Katalog

Produkt auswählen, das nicht in der Einmalplanung enthalten ist.

Erwartung:

- Sparplan zulässig
- Einmalplanung bleibt unverändert

### I – Sparziel

Sparplan mit neuem Sparziel 100.000 € im Jahr 2038 verknüpfen.

Erwartung:

- kein neuer Kapitaltopf 2038
- strategisches Kapital unverändert
- keine Topfabdeckung durch den Sparplan
- Zielbezug im Sparplan sichtbar

### J – Zielbezug löschen

Sparziel entfernen.

Erwartung:

- Sparplan bleibt bestehen
- nur Zielreferenz verschwindet

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
- aus einem konkreten Produkt / Kapitalbedarf / Sparplan / Sparziel geöffnet werden
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

### Kontextbezug

Aus einer konkreten gestaffelten Produktallokation können später automatisch übernommen werden:

- Zielbetrag
- Sofortbetrag
- gestaffelter Betrag
- Anzahl Raten
- Rhythmus
- Startdatum

Die Vertiefung darf daraus Beispiel-Kursverläufe und Umsetzungsvergleiche erzeugen, ohne eine sichere Renditeaussage zu behaupten.

## 8.5 Sparplan / Zinseszins

Direkt aus einem konkreten Sparplan oder Sparziel aufrufbar.

Operative Daten aus 4B können vorbefüllt werden:

- Sparrate
- Rhythmus
- Startdatum
- optional Zielbetrag / Zieljahr aus einem Sparziel

Zusätzliche Annahmen in der Vertiefung:

- Betrachtungsdauer
- angenommene Rendite
- optional Inflation
- optional Startkapital

Ausgaben:

- Summe der Einzahlungen
- angenommener Wertzuwachs
- Endkapital
- Zinseszinseffekt
- optional verbleibende Kaufkraft nach Inflation
- Verlauf über die Zeit
- bei Sparziel optional rechnerische Lücke / Überschuss zum Zielbetrag

Diese Berechnung ist eine Beispielrechnung und keine aktuelle Topfabdeckung.

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
- Zeitraum / Zieljahr
- angenommene Rendite
- Inflation optional

Ergebnis:

- benötigte Sparrate
- erwarteter Endwert bei vorhandener Sparrate
- rechnerische Lücke / Überschuss

Der Rechner soll primär mit dem eigenen 4B-Begriff **Sparziel** arbeiten.

Ein vorhandener echter Kapitalbedarf kann perspektivisch als Zielgröße referenziert werden, ohne dass ein Sparplan dadurch dessen heutige Kapitaltopfabdeckung übernimmt.

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
- echte Kapitalbedarfe / Termine
- Sparziele separat und klar vom Kapitalbedarf getrennt
- aktive Planvariante
- ZIELPLAN / bevorzugte Variante
- Bestandsdepot-Berücksichtigung
- wirtschaftliche Vermögensstruktur
- Produkte
- Sofortanlage
- gestaffelter Betrag
- Anzahl / Höhe der Raten
- zusätzliche Sparpläne separat
- Zielbezug eines Sparplans, sofern vorhanden
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
- gleicher Zieljahrgang kann mehrere echte Kapitalbedarfe zusammenfassen
- Einzelbedarfe bleiben innerhalb des Topfs erhalten
- strategischer Topf nur positiv
- Fehlbetrag separat sichtbar
- nur **echte Kapitalbedarfe** beeinflussen diese Zeitstruktur
- Sparziele aus 4B gehören ausdrücklich nicht in diese Kapitaltopflogik
- jede gespeicherte Allokation muss auf einen existierenden Kapitaltopf verweisen oder fachlich bereinigt werden

## 12.3 Bedarfstermin / Produkthorizont / Anleihefälligkeit

Diese drei Größen sind fachlich verschieden und dürfen nicht gleichgesetzt werden:

1. Kundenbedarfstermin
2. empfohlener Produktanlagehorizont
3. tatsächliche Fälligkeit eines Wertpapiers

Bei allgemeiner Zuordnung eines Produkts zum Jahrestopf ist der früheste konkrete Bedarf innerhalb dieses Topfs für die zeitliche Plausibilisierung relevant. Bei expliziter Zuordnung zu einem einzelnen Unterbedarf kann dessen eigener Termin verwendet werden.

## 12.4 Kapitalbedarf / Sparziel / Sparplan

Diese Größen sind ebenfalls fachlich verschieden:

### Kapitalbedarf

- Teil der heutigen Vermögensplanung
- kann Jahrestopf erzeugen
- reduziert je nach Fall strategisch verfügbares Kapital
- wird durch heutige Produktallokationen abgedeckt

### Sparziel

- zukünftiges Zielbild des Vermögensaufbaus
- erzeugt keinen Kapitaltopf
- reserviert kein heutiges Kapital
- verändert keine Topfabdeckung

### Sparplan

- operative zukünftige Einzahlung
- kann mit Sparziel oder informativ mit einem bestehenden Bedarf verknüpft sein
- deckt weder Sparziel noch Kapitalbedarf automatisch als heutige Topfabdeckung
- bleibt getrennt von der Einmalanlage

---

# 13. Beratungslogik Privat vs. Betrieblich

Der Kern der Anwendung soll gemeinsam bleiben, aber nicht jede Vertiefung oder Fachlogik ist identisch.

## Privatvermögen

Typische Schwerpunkte:

- Liquiditätsreserve
- persönliche Ziele / Bedarfe
- Sparziele / Vermögensaufbau
- Depot
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
- auch 50–100 Credits können als Verlängerung sinnvoll sein, wenn der fachliche Kern bereits persistent gesichert ist
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

## 15.5 Kapitaltopf-Lifecycle

Test:

- Plan mit zusätzlichem Bedarf und belegtem Jahrestopf erzeugen
- Produktzuordnung und ggf. Umsetzung an diesen Topf hängen
- Bedarf anschließend löschen, sodass der Jahrestopf vollständig verschwindet

Erwartung:

- Warnung vor Löschung, sofern Zuordnungen betroffen
- keine verwaiste `capitalPotId`
- kein unsichtbarer Produktbetrag in `Produkten zugeordnet`
- keine unsichtbare Topfabdeckung
- keine Beiträge im Vermögenshaus aus verschwundenem Topf
- keine verwaiste Umsetzung

## 15.6 4B Einstiegsplan

Referenz:

- 100.000 € Produktallokation
- 60 % gestaffelt
- 6 Raten

Erwartung:

- 40.000 € sofort
- 60.000 € gestaffelt
- 6 × 10.000 €
- Planungsbetrag bleibt 100.000 €

## 15.7 4B Sparziel

Referenz:

- Sparplan 500 €/Monat
- neues Sparziel 100.000 € in 2038

Erwartung:

- Sparplan separat
- kein Kapitaltopf 2038
- strategisches Kapital unverändert
- keine Topfabdeckung

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

## ⏳ Externe freie Sparplanprodukte

Freie WKN / freie Produktbezeichnung für Sparpläne zunächst bewusst nicht in 4B. Erst bei tatsächlichem fachlichem Bedarf ergänzen.

---

# 17. Roadmap – empfohlene Reihenfolge

| Reihenfolge | Paket / Konzept | Status |
|---:|---|---|
| 1 | **4A.1 Bestandsdepot-Logik, Kapitaltopf-Lifecycle & V0.14-Fixes** | 🟢 Work-ready |
| 2 | **4B Einstieg & Sparpläne** | 🟢 Work-ready |
| 3 | **Depotcheck 3B Portfolioanalyse** | 🟢 nahezu Work-ready |
| 4 | **Risiko V2** | 🔴 Fachkonzept nötig |
| 5 | **Vertiefungsframework** | 🟡 Konzept weiter ausarbeiten |
| 6 | **Ergebnis & Export konsolidieren** | 🟡 nach 4B vollständig testen |
| 7 | finaler Gesamt-UX-/Regressionsblock | ⏳ später |

Die Reihenfolge kann sich ändern, wenn ein fachlicher Block priorisiert werden muss. Kleine Fixes sollen möglichst gebündelt werden.

---

# 18. Offene Entscheidungen – nächste Brainstorming-Punkte

## 4A.1

Keine zentrale fachliche Entscheidung mehr offen. Paket ist Work-ready.

## 4B

Keine zentrale fachliche Entscheidung mehr offen. Paket ist Work-ready.

Kleinere UI-Details dürfen bei der Prompt-Erstellung aus den hier festgelegten Regeln abgeleitet werden, ohne das Fachmodell erneut zu öffnen.

## Risiko V2

- Bewertungslogik der getrennten Risikodimensionen
- Caps / Konflikte / Override

## Vertiefungen

- konkrete Triggerlogik
- zentrale `Vertiefen`-Navigation
- Quellen-/Datenstand-Konzept
- welche Rechner gehören in den ersten MVP des Vertiefungsframeworks?
- genaue UI für Cost-Average-/Einstiegsvertiefung
- genaue UI für Sparziel-/Zinseszinsrechner
- steuerliche Inhalte Privat
- separates Fachkonzept Betrieblich / Bilanzierung

## Depotcheck 3B

- exakte Visualisierungen je Analyse
- finale Produkttyp-Kategorisierung aus den CSV-Enums
- robuste mathematische Abgrenzung berechenbarer Rentenwerte

---

# 19. Entscheidungslog

## 04.09.2026

### Projektorganisation

- Master-Spezifikation als kanonischer Produktstand eingeführt.
- V0.14 grundsätzlich abgenommen, aber 4A.1 als separates Fixpaket definiert.
- 4B nach gezieltem Test von gestaffelter Anlage und Sparplan fachlich abgeschlossen und auf **Work-ready** gesetzt.

### 4A.1

- Private-Banking-Logo muss im Header vollständig sichtbar sein.
- PDF/Kundenübersicht muss Volksbank-pur-Logo **und** Private-Banking-Logo verwenden.
- Bestandsdepot-Modi der Strukturplanung fachlich neu präzisiert.
- `Nicht berücksichtigen` entfernt das Depot auch aus IST der Strukturplanung.
- Modus `Nur im IST berücksichtigen` wird fachlich explizit geführt.
- `Nach simulierten Verkäufen` berücksichtigt automatisch den gesamten Restbestand, keine Positionscheckboxen notwendig.
- `Ausgewählte Positionen beibehalten` verwendet eine bewusste Positionsauswahl nur für PLAN.
- Depotcheck IST/PLAN wird von der Bestandsdepot-Steuerung der Strukturplanung entkoppelt.
- Depotcheck-Säulendetail soll durch erneuten Klick auf dieselbe Säule geschlossen werden können.
- Neuer Fehler aufgenommen: Beim Wegfall eines Kapitaltopfs dürfen keine verwaisten Produktzuordnungen oder Umsetzungspläne weitergerechnet werden.
- Verwaiste Topfanteile werden nicht automatisch nach strategisch verschoben.

### 4B – Einstieg

- Jede Produktallokation ist standardmäßig **Komplett sofort**. Der Berater muss nicht aktiv einen Einstiegsplan anlegen.
- Umsetzungsstatus wird direkt an der konkreten Produktallokation angezeigt und über `Ändern` bearbeitet.
- Einstiegsplan gehört zu **Produktallokation × Kapitaltopf**.
- Gestaffelter Anteil kann alternativ in Prozent oder EUR gepflegt werden.
- Sofortbetrag und Rate werden automatisch berechnet.
- Prozentmodus skaliert bei Änderung des Zielbetrags, EUR-Modus bleibt grundsätzlich fix.
- Rhythmus: monatlich, vierteljährlich, halbjährlich, jährlich.
- Startdatum standardmäßig nächster 1. oder 15., bleibt frei änderbar.
- Der bisherige globale Bereich wird zur Umsetzungsübersicht, nicht zur zweiten Produktplanung.

### 4B – Sparplan / Sparziel

- Sparplan bleibt vom heutigen Einmalvolumen, Produktzuordnung und der Topfabdeckung getrennt.
- Produktpicker bietet Planprodukte zuerst und danach den vollständigen internen Produktkatalog.
- Freie externe WKN / Freitextprodukte vorerst nicht.
- Operativer Sparplan speichert Rate, Rhythmus, Start, Produkt, optionalen Hinweis und optionalen Zielbezug; keine Rendite-/Inflationsannahmen.
- Ein langfristiges Ziel eines Sparplans wird als **Sparziel** modelliert, nicht als neuer Kapitalbedarf.
- Ein neues Sparziel erzeugt **keinen Kapitaltopf**, reduziert kein strategisches Kapital und deckt keinen Topf ab.
- Ein Sparplan kann perspektivisch informativ mit einem bestehenden echten Kapitalbedarf verbunden werden, übernimmt aber niemals automatisch dessen heutige Topfabdeckung.
- Zinseszins-, Sparziel- und Cost-Average-Berechnungen bleiben spätere Vertiefungen und werden nicht in 4B vermischt.

### Vertiefungen / Steuern

- Sparplan-/Einstiegsvertiefungen sollen später konkrete Falldaten in Rechnern verwenden können.
- Zinseszinsdarstellung für konkrete Sparpläne als wichtige Vertiefungsidee aufgenommen.
- Steuervertiefungen sollen Teilfreistellungen berücksichtigen.
- Betriebliche Steuer-/Bilanzierungslogik wird nicht aus der Privatlogik abgeleitet, sondern separat fachlich konzipiert.

### Work-Ressourcen

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
