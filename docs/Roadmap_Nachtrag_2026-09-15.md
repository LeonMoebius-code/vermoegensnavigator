# VermögensNavigator – Roadmap-Nachtrag 15.09.2026

> Fachlicher Nachtrag zur Master-Spezifikation. Dieser Nachtrag konkretisiert neue Entscheidungen aus der Sichtprüfung am 15.09.2026 und ist bei der nächsten Konsolidierung in `docs/VermoegensNavigator_Master-Spezifikation.md` zu übernehmen. Wo ältere Roadmap-Notizen zum Auszahlplan hiervon abweichen oder kürzer sind, gilt dieser Nachtrag.

---

# 1. Ruhestandsplanung als eigene Vertiefung

## Status

🟡 **IN KONZEPTION**, aber als eigener Roadmap-Block beschlossen.

Die Ruhestandsplanung soll nicht als kleiner Zinseszinsrechner und nicht als bloße Erweiterung eines Auszahlplans behandelt werden. Sie wird als eigene fachliche Vertiefung geplant, die Ansparphase, Versorgungssituation und Entnahmephase verbindet.

Zielbild:

> Heute → Vermögensaufbau bis Ruhestand → vorhandene Ruhestandseinkünfte → gewünschter Lebensstandard → Versorgungslücke / Überschuss → notwendiges Zielkapital → erforderliche Sparrate → späterer Auszahlplan.

## 1.1 Operativer Auszahlplan bleibt ein eigener Plan

Der spätere **Auszahlplan** bleibt ein eigenständiger operativer InvestmentPlan-Typ und wird nicht doppelt innerhalb der Ruhestandsplanung modelliert.

Verbindliche Trennung:

- **Ruhestandsplanung** = Vertiefung / Rechen- und Beratungslogik
- **Auszahlplan** = operativer Plan für regelmäßige zukünftige Entnahmen

Die Ruhestandsplanung darf einen passenden Auszahlplan berechnen bzw. vorschlagen und nach ausdrücklicher Bestätigung in den operativen Auszahlplan übernehmen.

Keine zweite parallele Auszahlplanlogik in der Vertiefung speichern.

Ebenso darf die Ruhestandsplanung eine erforderliche zusätzliche Sparrate berechnen und später nach ausdrücklicher Bestätigung in einen operativen Sparplan übernehmen.

## 1.2 Ansparphase bis zum Ruhestand

Mögliche Eingaben, möglichst mit Vorbelegung aus dem Beratungsfall:

- aktuelles anrechenbares Kapital
- monatliche Sparrate
- verbleibende Laufzeit bis Ruhestand bzw. Ruhestandsbeginn
- Renditeannahme bis Ruhestand
- Inflation

Mögliche Ausgaben:

- heutiges Startkapital
- Summe zukünftiger Einzahlungen
- angenommener Wertzuwachs
- nominales Kapital zum Ruhestandsbeginn
- optional kaufkraftbereinigter Wert
- Verlauf über die Zeit

Die Berechnung ist eine Planungsrechnung und keine Renditeprognose.

## 1.3 Weitere monatliche Einkünfte im Ruhestand

Es sollen mehrere zusätzliche Einkommensquellen erfassbar sein, z. B.:

- gesetzliche Rente
- betriebliche Rente
- private Rentenversicherung
- Mieteinnahmen
- sonstige regelmäßige Einkünfte

Mindestens sinnvoll je Eintrag:

- Bezeichnung
- monatlicher Betrag
- optionaler Startzeitpunkt

Für den ersten Prototyp sollen diese Werte als Planungsgrößen verstanden werden. Keine vollständige Steuer-, Sozialversicherungs- oder Nettorentenberechnung in dieses Modul hineinziehen.

## 1.4 Monatlicher Kapitalbedarf

Der gewünschte monatliche Bedarf im Ruhestand wird separat erfasst.

Die Ruhestandsplanung zeigt daraus:

- monatliche Ruhestandseinkünfte gesamt
- monatlichen Bedarf
- Versorgungslücke oder Überschuss
- erforderliche zusätzliche Entnahme aus dem Vermögen

Inflation muss sowohl bis zum Ruhestandsbeginn als auch während der Ruhestandsphase berücksichtigt werden können.

Beispielhafte Aussage:

> Ein heutiger Bedarf von 5.000 € entspricht bei 2 % Inflation in 15 Jahren einem deutlich höheren nominalen Monatsbedarf.

Die Anwendung soll nominale und reale Sicht verständlich trennen.

## 1.5 Entnahmephase

Für die Ruhestandsphase kann eine andere Renditeannahme verwendet werden als in der Ansparphase, da die Vermögensstruktur im Ruhestand häufig defensiver gewählt wird.

Mindestens folgende Berechnungsmodi sind fachlich vorgesehen:

### A – Entnahme vorgeben

Eingaben:

- Kapital zum Ruhestandsbeginn
- Renditeannahme Ruhestand
- anfängliche monatliche Entnahme
- Inflation / Entnahmedynamik

Ergebnis:

- erwarteter Kapitalverlauf
- rechnerischer Zeitpunkt, bis zu dem das Kapital reicht
- Restkapital zum gewählten Planungsende

### B – Kapital bis zu einem Zielalter / Enddatum verbrauchen

Eingaben:

- Kapital zum Ruhestandsbeginn
- Renditeannahme Ruhestand
- Ruhestandsbeginn
- Planungsende / Zielalter
- Inflation

Ergebnis:

- rechnerisch mögliche anfängliche monatliche Entnahme
- dynamisierte Entnahme über die Zeit
- Kapitalverlauf bis zum Planungsende

### C – Nominaler Kapitalerhalt

Ziel:

- Entnahme so bestimmen, dass das Kapital nominal grundsätzlich erhalten bleibt

Dabei ausdrücklich darauf hinweisen, dass nominaler Kapitalerhalt nicht automatisch realen Kaufkrafterhalt bedeutet.

### D – Realer Kapitalerhalt

Ziel:

- Entnahme so bestimmen, dass das Kapital unter Berücksichtigung der Inflationsannahme real möglichst erhalten bleibt

Keine Scheingenauigkeit und keine Garantieaussage.

## 1.6 Rückwärtsrechnung / erforderliche Sparrate

Besonders wichtiger Mehrwert:

Wenn die erwartete Versorgungslücke mit dem bis Ruhestand voraussichtlich vorhandenen Kapital nicht nachhaltig gedeckt werden kann, soll die Vertiefung rückwärts berechnen können:

- benötigtes Zielkapital zum Ruhestandsbeginn
- erwartetes Kapital zum Ruhestandsbeginn
- rechnerische Kapitallücke
- erforderliche zusätzliche monatliche Sparrate bis Ruhestand

Die Sparrate soll aus Startkapital, verbleibender Laufzeit und Renditeannahme berechnet werden.

Spätere optionale Aktion:

**Als Sparplan übernehmen**

Nur nach bewusster Bestätigung. Keine automatische Veränderung des heutigen Planungsvolumens.

## 1.7 Verbindung zum Auszahlplan

Wenn die Planung eine tragfähige Entnahme ergibt, kann daraus später ein operativer Auszahlplan vorgeschlagen werden, z. B.:

- Startdatum
- Betrag
- Rhythmus
- optionale jährliche prozentuale Dynamik

Spätere optionale Aktion:

**Als Auszahlplan übernehmen**

Nur nach bewusster Bestätigung.

## 1.8 Dynamik

Für Sparplan und Auszahlplan bleibt die bereits beschlossene spätere Dynamik bestehen:

- optional
- standardmäßig AUS
- ausschließlich prozentual
- ausschließlich jährlich
- erste Erhöhung zwölf Monate nach Start
- danach jährlich
- keine feste Euro-Dynamik
- kein frei wählbarer Dynamikrhythmus

In der Ruhestandsplanung kann die Inflationsannahme als sinnvolle Vorbelegung für eine Entnahmedynamik dienen, darf diese aber nicht automatisch im operativen Plan festschreiben.

## 1.9 Rechenengine

Die Ruhestandsplanung soll bevorzugt nicht nur mit einer einzelnen geschlossenen Zinseszinsformel arbeiten, sondern mit einer zentralen periodischen Projektionsengine, bevorzugt monatlich.

Je Periode sinngemäß:

`Kapital Anfang + Einzahlungen + Rendite - Entnahmen = Kapital Ende`

Dadurch bleiben spätere Erweiterungen möglich, z. B. unterschiedliche Startzeitpunkte von Renten, Sparplänen und Entnahmen.

## 1.10 Visualisierung

Sinnvolle Kernvisualisierungen:

- Zeitachse Heute → Ruhestandsbeginn → Planungsende
- Vermögensentwicklung in Anspar- und Entnahmephase
- Aufteilung Startkapital / Einzahlungen / Wertzuwachs
- monatlicher Ruhestands-Cashflow aus Bedarf, sonstigen Einkommen und notwendiger Vermögensentnahme
- Lücke bzw. Überschuss

## 1.11 Nicht Teil des ersten Ruhestandsplaners

Nicht in die erste Version hineinziehen:

- vollständige Steuerberechnung
- Kranken- und Pflegeversicherungsberechnung
- vollständige gesetzliche Rentenhochrechnung
- Hinterbliebenenversorgung
- Monte-Carlo-Simulation
- komplexe Wahrscheinlichkeitsszenarien

Diese Punkte können später separat konzipiert werden.

---

# 2. Bestandsdepot als Standard in der Gesamtplanung

## Beobachtung

Ein in der Ausgangslage oder im Depotcheck importiertes Depot erscheint im Ergebnis-Vermögenshaus nicht automatisch, solange die betreffende Strukturplan-Variante den Depotmodus `Nicht berücksichtigen` verwendet.

Der aktuelle Code legt neue Strukturpläne standardmäßig mit `depotMode: "none"` an. Die Ergebnisansicht verwendet den bevorzugten Plan als ZIELPLAN. Dadurch kann ein vorhandenes Depot im Ergebnis fehlen, obwohl es im Fall vorhanden und im Depotcheck sichtbar ist.

## Fachliche Entscheidung

Wenn erstmals ein konkretes Bestandsdepot vorhanden ist, soll der fachliche Standard für neue bzw. noch nicht bewusst anders gesetzte Planvarianten sein:

**Nach simulierten Verkäufen**

Damit gilt standardmäßig:

- IST enthält den vollständigen physischen Bestand
- PLAN / ZIELPLAN enthält den vollständigen Restbestand nach simulierten Verkäufen
- geplante Neukäufe kommen zusätzlich hinzu

Der Berater kann den Depotmodus weiterhin bewusst ändern auf:

- Nicht berücksichtigen
- Nur im IST berücksichtigen
- Ausgewählte Positionen beibehalten
- Nach simulierten Verkäufen

Eine bewusste spätere Auswahl darf nicht automatisch überschrieben werden.

Für einen Plan, der bereits existiert bevor das erste konkrete Depot importiert wird, soll beim ersten Depotimport der bisher unberührte Standard sinnvoll auf `afterSales` wechseln. Keine unnötige neue fachliche Entscheidung erfinden, wenn bereits eine bewusste Depotmodus-Auswahl dokumentiert ist.

Diese Regel ist fachlich eng mit Multi Depot verbunden und soll beim Multi-Depot-Umbau berücksichtigt werden.

---

# 3. Ergebnis-Vermögenshaus / ZIELPLAN

Die Ergebnisansicht verwendet aktuell den bevorzugten Plan und das kompakte Vermögenshaus startet in der Zielplan-Sicht.

Damit ist das Vermögenshaus im Ergebnis fachlich bereits **ZIELPLAN** und nicht die reine IST-Sicht.

Diese Semantik ist grundsätzlich sinnvoll, muss aber in der späteren Ergebnis-/Export-Konsolidierung eindeutig sichtbar bezeichnet werden, damit nicht der Eindruck entsteht, das dort gezeigte Vermögenshaus sei automatisch das heutige Gesamtvermögen.

Mit dem neuen Standard `Nach simulierten Verkäufen` enthält der ZIELPLAN das Bestandsdepot automatisch, sofern der Berater den Depotmodus nicht bewusst anders setzt.

---

# 4. Modellportfolio anwenden – Semantik der drei Aktionen

## Beobachtung

Beim Öffnen eines Modellportfolios wird der betroffene Betrag aktuell mit dem gesamten strategischen Kapital vorbelegt. `Aktuellen Plan ergänzen` hängt anschließend Modellallokationen in voller Höhe an die bereits vorhandenen Allokationen. `Aktuellen Plan ersetzen` ersetzt derzeit sämtliche Allokationen des Plans.

Das passt fachlich nicht zur Bedeutung der Aktionen.

## 4.1 Als neue Variante

Ziel:

- aus dem aktuellen Plan eine neue Variante erzeugen
- Allokationen außerhalb des strategischen Kapitaltopfs unverändert übernehmen
- strategischen Teil in der neuen Variante mit dem Modellportfolio gestalten
- bestehender Ursprungsplan bleibt unverändert

Die bereits vorhandene Logik, außerhalb des strategischen Topfs bestehende Allokationen zu erhalten, ist grundsätzlich richtig.

## 4.2 Aktuellen Plan ergänzen

`Ergänzen` bedeutet:

> vorhandene Planung beibehalten und nur noch nicht verplantes strategisches Kapital mit dem Modellportfolio ergänzen.

Dafür muss der Standardbetrag sein:

`verbleibendes strategisches Kapital = strategischer Topfbetrag - bereits dem strategischen Topf zugeordnete gültige Allokationen`

Mindestens auf 0 begrenzen.

Beispiel:

- strategischer Topf 360.000 €
- bereits strategisch verplant 210.000 €
- verbleibend 150.000 €

`Aktuellen Plan ergänzen` soll das Modellportfolio standardmäßig mit 150.000 € anwenden, nicht nochmals mit 360.000 €.

Der Betrag kann weiterhin sichtbar sein. Eine bewusste Überplanung darf nur transparent und nicht unbemerkt erfolgen.

## 4.3 Aktuellen Plan ersetzen

`Ersetzen` bedeutet in diesem Kontext nicht, sämtliche Kapitaltöpfe des Falls zu leeren.

Verbindlich:

- Allokationen des strategischen Kapitaltopfs entfernen
- Modellportfolio auf den vorgesehenen strategischen Betrag anwenden
- Reserve-Allokationen unverändert lassen
- Jahres-/Bedarfstopf-Allokationen unverändert lassen
- deren Umsetzungsbezüge ebenfalls unberührt lassen, sofern die zugrunde liegenden Allokationen bestehen bleiben

Damit wird ausschließlich die strategische Vermögensstruktur ersetzt.

---

# 5. Depotcheck – durchschnittliche Rendite im Bereich Zins & Laufzeiten

## Beobachtung

Der Depotcheck berechnet bereits je geeigneter Rentenposition unter anderem:

- laufende Verzinsung auf aktuellen Kurs
- modellierte Yield to Maturity
- Macaulay Duration
- Modified Duration
- DV01

Auf Portfolioebene werden Modified Duration und DV01 bereits aggregiert. Eine durchschnittliche Renditekennzahl fehlt jedoch.

## Fachliche Entscheidung

Eine durchschnittliche Renditekennzahl ist sinnvoll und fachlich möglich, aber nur für den jeweils belastbar berechenbaren Teilbestand.

### 5.1 Ø modellierte YTM

Für alle geeigneten direkten Festzinsanleihen mit belastbarer modellierter YTM soll eine **marktwertgewichtete durchschnittliche modellierte YTM** berechnet werden.

Sinngemäß:

`Ø YTM = Summe(Marktwert_i × YTM_i) / Summe(Marktwert_i)`

Wichtig:

- nicht als Rendite des gesamten Depots bezeichnen
- keine Rentenfonds, Floater oder Stufenzinsanleihen ohne belastbaren Cashflowpfad künstlich einbeziehen
- Coverage sichtbar ausweisen

Bevorzugte sichtbare Bezeichnung:

**Ø modellierte YTM**

Zusatz:

`auf X % der direkten Rentenwerte berechenbar`

### 5.2 Ø laufende Verzinsung

Zusätzlich kann eine marktwertgewichtete **Ø laufende Verzinsung** für direkte Rentenpositionen mit belastbarem Coupon/current-price-Datensatz angezeigt werden.

Auch hier eigene Coverage ausweisen.

Die laufende Verzinsung darf nicht mit YTM oder erwarteter Gesamtrendite gleichgesetzt werden.

### 5.3 Keine pauschale „Durchschnittsrendite aller Rentenpositionen“

Eine einzige Zahl über Festzinsanleihen, Floater, Stufenzinsanleihen und Rentenfonds wäre ohne passende Daten und Cashflowmodelle fachlich irreführend.

Daher getrennt darstellen:

- Ø laufende Verzinsung auf berechenbarem Teilbestand
- Ø modellierte YTM auf geeignetem Festzins-Teilbestand
- Modified Duration
- DV01
- jeweilige Coverage

---

# 6. Roadmap-Einordnung

Empfohlene Reihenfolge ab aktuellem Stand:

1. **V0.18.0 Multi Depot**
   - einschließlich sinnvoller Standardberücksichtigung des erstmals importierten Bestandsdepots über `Nach simulierten Verkäufen`
2. **kleiner Plan-/Depotcheck-Korrekturblock**
   - Modellportfolio `Ergänzen` verwendet verbleibendes strategisches Kapital
   - Modellportfolio `Ersetzen` ersetzt nur strategische Allokationen
   - Ø modellierte YTM und optional Ø laufende Verzinsung ergänzen
3. **freier Planvergleich**
4. **operativer Auszahlplan + jährliche prozentuale Dynamik für Spar- und Auszahlplan**
5. **Vertiefungsframework**
6. **fachliche Vertiefungen**
   - aktuelle Marktsituation
   - Inflation & Kaufkraft
   - Zinsen & Anleihen aktuell
   - Vermögensstruktur & Diversifikation
   - **Ruhestandsplanung** als eigener größerer Vertiefungsblock
7. Ergebnis & Export konsolidieren
8. finaler Gesamt-UX-/Regressionsblock

Der operative Auszahlplan unter Punkt 4 ist technische Voraussetzung bzw. nutzbares Zielobjekt der späteren Ruhestandsplanung. Er ist **kein zweiter konkurrierender Ruhestandsplaner**.

---

# 7. Nächste Konsolidierung in die Master-Spezifikation

Bei der nächsten Master-Aktualisierung:

- diesen Nachtrag inhaltlich in die Master-Spezifikation übernehmen
- ältere kurze Roadmap-Notizen zum Auszahlplan durch die hier definierte klare Trennung ersetzen
- Ruhestandsplanung als eigene Vertiefung aufnehmen
- Auszahlplan nur einmal als operativen Plan führen
- Bestandsdepot-Default `afterSales` dokumentieren
- Modellportfolio-Semantik für `new`, `supplement`, `replace` präzisieren
- durchschnittliche Rentenkennzahlen im Depotcheck ergänzen
- diesen Nachtrag anschließend nicht als zweite konkurrierende Source of Truth weiterführen
