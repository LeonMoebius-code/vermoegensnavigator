# VermögensNavigator – Vertiefung Inflation & Kaufkraft

> Fachkonzept für die spätere Umsetzung im Vertiefungsframework. Dieses Dokument beschreibt Scope, UX, Berechnungslogik, Datenzugriffe, Integrationsregeln und Regressionen. Die Vertiefung ist ein Analyse- und Beratungsmodul. Sie darf vorhandene Falldaten lesen und simulieren, aber operative Planungsdaten nur nach ausdrücklicher Bestätigung verändern.

---

# 1. Ziel und fachlicher Zweck

Die Vertiefung **Inflation & Kaufkraft** beantwortet drei Kernfragen:

1. Was ist ein heutiger Betrag künftig noch wert?
2. Welcher zukünftige Betrag ist erforderlich, um dieselbe Kaufkraft zu erhalten?
3. Reicht die geplante Vermögens- und Kapitalstruktur unter der gewählten Inflationsannahme real betrachtet aus?

Die Vertiefung darf nicht als isolierter Taschenrechner umgesetzt werden. Ihr Mehrwert entsteht durch die Verbindung mit dem konkreten Beratungsfall, insbesondere mit zukünftigen Kapitalbedarfen, dem strategischen Kapital sowie vorhandenen Spar- und Auszahlplänen.

Die Vertiefung ist eine **Planungsrechnung** und keine Inflationsprognose.

---

# 2. Grundprinzip der Integration

Verbindlicher Architekturgrundsatz:

> Die Vertiefung darf viel lesen, aber nur nach ausdrücklicher Bestätigung zurückschreiben.

Sie darf aus dem Beratungsfall lesen:

- ZIELPLAN beziehungsweise ersatzweise aktiven Plan
- Kapitaltöpfe und zukünftige Bedarfe
- strategisches Kapital
- Sparpläne
- Auszahlpläne
- vorhandene Inflationsannahmen aus anderen Vertiefungen, insbesondere Ruhestandsplanung

Sie darf simulieren:

- Kaufkraftverlust
- zukünftigen Nominalbedarf
- Realrendite
- nominale und reale Vermögensentwicklung
- Kaufkraft von Sparleistungen
- Kaufkraft von Auszahlungen
- alternative Dynamiken

Sie darf niemals automatisch:

- Kapitaltöpfe umverteilen
- Allokationen verändern
- Produkte auswählen
- Sparraten verändern
- Auszahlungsbeträge verändern
- Dynamiken verändern
- Renditen aus Depotpositionen ableiten
- den ZIELPLAN wechseln

Operative Änderungen erfolgen ausschließlich über bewusste Übergaben in die bestehenden Editoren.

---

# 3. Datenbasis und Planungsstichtag

Jede Analyse besitzt einen festen **Planungsstichtag**.

Standard bei erstmaliger Anlage:

- heutiges Datum

Der Stichtag verändert sich später nicht automatisch durch bloßes Öffnen der Vertiefung.

Aktion:

**Auf heute aktualisieren**

oder sinngemäß:

**Mit aktuellen Falldaten aktualisieren**

Der aktuelle Zustand der zugrunde liegenden Falldaten muss nachvollziehbar sein.

Mögliche sichtbare Statuswerte:

- `Aktuell`
- `Falldaten geändert`

Wenn sich relevante Daten außerhalb der Vertiefung ändern, soll keine stille Neuberechnung mit veränderten Falldaten stattfinden.

---

# 4. Planbasis

Standardmäßig verwendet die Vertiefung den **ZIELPLAN**.

Falls kein ZIELPLAN vorhanden ist, wird ersatzweise der aktive Plan verwendet und deutlich gekennzeichnet:

> Kein ZIELPLAN festgelegt. Die Analyse verwendet den aktiven Plan.

Die Planbasis darf durch die Vertiefung nicht verändert werden.

---

# 5. Inflationsannahme

Zentrale sichtbare Planungsannahme:

**Inflation p. a.**

Empfohlene Vorbelegung:

- 2,0 % p. a.

Die Vorbelegung ist ausdrücklich nur eine Planungsannahme und keine Prognose.

Die Vertiefung muss rechnerisch funktionieren bei:

- positiver Inflation
- 0 % Inflation
- negativer Inflation / Deflation

Technische Untergrenze:

- Inflation > -100 %

Ungewöhnliche Annahmen dürfen neutral plausibilisiert werden, aber nicht willkürlich blockiert werden.

Eine aktuelle oder historische Inflationsrate darf niemals automatisch als langfristige Planungsannahme übernommen werden.

---

# 6. Zentraler Inflations- und Realrendite-Helper

Die Vertiefung darf keine isolierte zweite Formelwelt aufbauen.

Zentral wiederzuverwendende Berechnungen sollen mindestens umfassen:

## 6.1 Zukünftiger Nominalbetrag für gleiche Kaufkraft

Sinngemäß:

`futureNominal = todayAmount × (1 + inflation)^t`

## 6.2 Heutige Kaufkraft eines zukünftigen Nominalbetrags

Sinngemäß:

`todayPurchasingPower = futureNominal / (1 + inflation)^t`

## 6.3 Reale Rendite

Sinngemäß:

`realReturn = (1 + nominalReturn) / (1 + inflation) - 1`

Nicht einfach Nominalrendite minus Inflation verwenden.

## 6.4 Dynamisierung

Jährliche prozentuale Dynamiken müssen dieselbe zentrale Logik verwenden wie Spar- und Auszahlplan.

## 6.5 Zeitberechnung

Nicht pauschal nur Jahreszahlen subtrahieren.

Zwischen Planungsstichtag und Zieltermin ist mit einem konsistenten Zeitanteil beziehungsweise bevorzugt derselben periodischen Zeitlogik wie in anderen Projektionsmodulen zu rechnen.

Ruhestandsplanung und Inflation-&-Kaufkraft-Vertiefung müssen dieselben Inflationshelper nutzen, damit bei identischen Annahmen identische Ergebnisse entstehen.

---

# 7. Seitenstruktur / UX

Die sichtbare Vertiefung folgt einem klaren Beratungsablauf:

1. Kaufkraft verstehen
2. Kapitalbedarfe real prüfen
3. Strategisches Vermögen real betrachten
4. Sparpläne und Kaufkraft
5. Auszahlpläne und Kaufkraft
6. Kaufkraft-Check des Beratungsfalls
7. Mögliche bewusste Übernahmen

Sie soll nicht wie mehrere unabhängige Rechner untereinander wirken.

---

# 8. Kopfbereich

Sichtbar im Kopfbereich:

- Titel `Inflation & Kaufkraft`
- Planungsstichtag
- Planungsannahme Inflation
- verwendete Planbasis
- Datenstand

Bei veralteter Basis:

> Falldaten geändert. Analyse basiert nicht mehr vollständig auf dem aktuellen Beratungsstand.

Aktion:

**Mit aktuellen Daten aktualisieren**

---

# 9. Bereich A – Kaufkraft verstehen

Dieser Bereich ist ein allgemeiner, einfacher Einstieg ohne Abhängigkeit von konkreten Falldaten.

## 9.1 Eingaben

- Betrag
- Zeitraum als Jahre oder konkretes Datum
- Inflationsannahme

Zwei umschaltbare Perspektiven:

- `Was ist dieser Betrag künftig noch wert?`
- `Wie viel brauche ich künftig für dieselbe Kaufkraft?`

## 9.2 Ergebnisse

Mindestens sichtbar:

- zukünftige Kaufkraft eines festen Nominalbetrags
- Kaufkraftverlust in EUR
- künftig benötigter Nominalbetrag für gleiche Kaufkraft
- kumulierte Inflation über den Zeitraum

## 9.3 Grafik

Eine einfache Linie:

**Kaufkraft eines festen Nominalbetrags**

Zusätzlich sinnvolle Schnellhorizonte:

- 5 Jahre
- 10 Jahre
- 15 Jahre
- 20 Jahre

Keine unnötig komplexe Statistik.

---

# 10. Bereich B – Kapitalbedarfe real prüfen

Dies ist der wichtigste fachliche Anwendungsfall.

Die Vertiefung liest zukünftige Kapitalbedarfe beziehungsweise Kapitaltöpfe aus der Planbasis.

Je Bedarf muss die Bedeutung des Betrags unterschieden werden.

## 10.1 Zwei Bedeutungen eines Kapitalbedarfs

### A – Fester zukünftiger Nominalbetrag

Der Zielbetrag wird nicht inflationiert. Die Vertiefung darf ergänzend zeigen, welcher heutigen Kaufkraft dieser zukünftige Betrag entspricht.

### B – Betrag in heutiger Kaufkraft

Der künftig benötigte Nominalbetrag wird mit der Inflationsannahme hochgerechnet.

## 10.2 Bedeutung niemals erraten

Die Vertiefung darf nicht automatisch entscheiden, ob ein vorhandener Kapitalbedarf nominal oder real gemeint ist.

Diese Semantik wird innerhalb der Vertiefung je betrachteten Bedarf explizit festgelegt.

Für V1 soll die bestehende Kapitaltopfstruktur dafür nicht zwingend um ein globales Pflichtfeld erweitert werden.

Mögliche interne Semantik:

- `nominal`
- `todayPurchasingPower`

Eine spätere Überführung dieser Bedeutung in das zentrale Kapitaltopfmodell kann nach Praxistests separat entschieden werden.

---

# 11. Kapitalbedarfskarte

Je Bedarf sichtbar:

- Bezeichnung
- Termin
- geplanter Betrag
- Bedeutung des Betrags
- Inflationsannahme
- real beziehungsweise nominal erforderlicher Betrag
- Differenz

Mögliche Zustände:

- `real gedeckt`
- `Kaufkraftlücke`
- `Kaufkraftreserve`

Bei `nominal` keine Kaufkraftlücke ausweisen, wenn der Bedarf ausdrücklich nominal definiert ist.

---

# 12. Übersicht aller Kapitalbedarfe

Bei mehreren Bedarfen kompakte Tabelle:

| Kapitalbedarf | Termin | Bedeutung | geplant | real erforderlich | Differenz |
|---|---|---|---:|---:|---:|

Keine prominent aggregierte Gesamtsumme über unterschiedliche Zieltermine erzwingen.

Die einzelnen Differenzen beziehen sich auf unterschiedliche Zeitpunkte und sind deshalb primär je Bedarf zu interpretieren.

---

# 13. Kapitalbedarf bewusst anpassen

Bei einer Kaufkraftlücke kann die Aktion angeboten werden:

**Kapitalbedarf anpassen**

Diese Aktion verändert nicht unmittelbar den Kapitaltopf.

Vor Bestätigung sichtbar:

- bisheriger Kapitalbedarf
- inflationsbereinigter Zielbetrag
- Veränderung

Erst nach ausdrücklicher Bestätigung wird der operative Bedarf geändert.

Danach muss die bestehende zentrale Reconciliation / Konsistenzlogik der Strukturplanung laufen.

Mögliche Folgeeffekte wie geringeres strategisches Restkapital, Überdeckung einzelner Allokationen oder nicht mehr vollständig gedeckte Planung werden nicht automatisch durch Umverteilung gelöst.

Insbesondere niemals automatisch:

- strategische Allokationen proportional kürzen
- Modellportfolio neu skalieren
- Produkte austauschen

Stattdessen bestehende Konsistenzhinweise verwenden.

---

# 14. Bereich C – Strategisches Vermögen real betrachten

Standardbasis:

**Strategisches Kapital des ZIELPLANS beziehungsweise der verwendeten Planbasis**

Keine Analyse einzelner Wertpapierpositionen.

## 14.1 Eingaben

- strategisches Startkapital, automatisch übernommen
- Betrachtungshorizont
- Nominalrendite p. a., bewusst manuell
- Inflation p. a.

Sinnvolle Schnellhorizonte:

- 5 Jahre
- 10 Jahre
- 15 Jahre
- 20 Jahre

plus freie Eingabe.

## 14.2 Renditeannahme

Keine automatische Ableitung aus Risikoprofil, Depotpositionen oder Modellportfolio.

Optional darf eine vorhandene Renditeannahme aus einer anderen Vertiefung bewusst übernommen werden.

## 14.3 Ergebnisse

Mindestens:

- nominales Vermögen am Ende
- Vermögen am Ende in heutiger Kaufkraft
- nominaler Wertzuwachs
- realer Wertzuwachs
- reale Rendite p. a.

## 14.4 Grafik

Zwei Linien:

- nominales Vermögen
- Vermögen in heutiger Kaufkraft

Start beide beim selben Ausgangskapital.

Die Grafik soll insbesondere sichtbar machen, dass ein nominal wachsendes Vermögen real an Kaufkraft verlieren kann.

---

# 15. Reale Rendite sichtbar erklären

Kompakte Darstellung:

> Nominalrendite
>
> Inflation
>
> Reale Rendite

Kurzer Hilfetext:

> Die reale Rendite beschreibt den Wertzuwachs nach Berücksichtigung der angenommenen Inflation.

Die exakte Formel kann optional über einen Infohinweis erklärt werden.

---

# 16. Bereich D – Sparpläne und Kaufkraft

Vorhandene Sparpläne werden aus dem Fall gelesen.

Die Vertiefung soll hier nicht primär als zweiter Sparplan-Endwertrechner arbeiten.

Kernfrage:

> Wie entwickelt sich die Kaufkraft der laufenden Sparleistung?

Je Sparplan mindestens:

- aktueller Beitrag
- Rhythmus
- aktuelle jährliche Dynamik
- reale Kaufkraft der Sparleistung zu ausgewählten Zeitpunkten

---

# 17. Sparplandynamik simulieren

Neben der bestehenden Dynamik kann eine alternative jährliche Dynamik simuliert werden.

Die Simulation zeigt insbesondere:

- nominale Sparrate im Zeitverlauf
- reale Kaufkraft der Sparrate

Bei Dynamik ungefähr gleich Inflationsannahme bleibt die reale Sparleistung rechnerisch ungefähr stabil.

Keine automatische Wertung, dass Dynamik zwingend der Inflation entsprechen muss.

Aktion:

**Im Sparplan bearbeiten**

Der normale Sparplaneditor wird mit dem simulierten Wert vorbelegt.

Keine direkte Änderung aus der Vertiefung.

---

# 18. Bereich E – Auszahlpläne und Kaufkraft

Vorhandene Auszahlpläne werden aus dem Fall gelesen.

Je Auszahlplan mindestens sichtbar:

- anfänglicher Auszahlungsbetrag
- Rhythmus
- Start
- vorhandene jährliche Dynamik
- nominale Auszahlung im Zeitverlauf
- reale Kaufkraft im Zeitverlauf

---

# 19. Auszahlplandynamik simulieren

Alternative jährliche Dynamik simulieren.

Grafik:

- nominale Auszahlung
- reale Kaufkraft der Auszahlung

Typische Wirkung:

- ohne Dynamik: nominal konstant, real fallend
- Dynamik ungefähr gleich Inflation: nominal steigend, reale Kaufkraft ungefähr stabil

Aktion:

**Dynamik im Auszahlplan bearbeiten**

Der normale Auszahlplaneditor öffnet sich mit dem simulierten Wert als Vorschlag.

Keine direkte stille Änderung.

Bei mehreren Auszahlplänen wird jeder Plan separat analysiert. Keine künstliche gemeinsame Dynamik über mehrere Auszahlpläne bilden.

---

# 20. Bereich F – Kaufkraft-Check des gesamten Beratungsfalls

Am Ende entsteht eine kompakte zusammenfassende Fallanalyse.

Beispielhafte Aussagen:

- `Kapitalbedarf Immobilie 2036: Kaufkraftlücke`
- `Kapitalbedarf 2029: als fixer Nominalbetrag vollständig geplant`
- `Strategisches Kapital: positive oder negative reale Renditeannahme`
- `Sparplan Vermögensaufbau: reale Sparleistung sinkt bei aktueller Dynamik`
- `Auszahlplan Ruhestand: reale Auszahlung sinkt bei aktueller Dynamik`

Keine pauschale Ampellogik mit `gut` / `schlecht`.

Bevorzugte sachliche Zustände:

- real gedeckt
- Kaufkraftlücke
- Kaufkraftreserve
- reale Sparleistung sinkt
- Kaufkraft annähernd stabil
- positive reale Renditeannahme
- negative reale Renditeannahme

---

# 21. Bereich G – Mögliche Anpassungen

Ganz unten werden nur tatsächlich relevante mögliche Übergaben angeboten.

Beispiele:

- Kapitalbedarf inflationsbereinigt anpassen
- Dynamik im Sparplan prüfen
- Dynamik im Auszahlplan prüfen

Jeder Punkt führt in den jeweiligen bestehenden Editor beziehungsweise Bestätigungsprozess.

Keine globale Aktion wie `Alles optimieren` und keine Sammeländerung mehrerer Planungsobjekte.

---

# 22. Datenmodell / Persistenz

Die Vertiefung soll primär Annahmen und Referenzen persistieren, nicht abgeleitete Ergebniswerte.

Sinnvoll persistierbar:

- Planungsstichtag
- Inflationsannahme
- verwendete Planbasis-ID
- Auswahl beziehungsweise Semantik betrachteter Kapitalbedarfe
- manuelle Renditeannahme für strategisches Kapital
- Betrachtungshorizont
- simulierte Sparplandynamiken
- simulierte Auszahlplandynamiken
- Snapshot relevanter Falldaten zur Änderungsprüfung

Abgeleitete Werte werden zentral neu berechnet.

Mögliche Semantik je Bedarf:

- `nominal`
- `todayPurchasingPower`

Noch keine Verpflichtung, diese Semantik sofort global in das Kapitaltopfmodell zu migrieren.

---

# 23. Snapshot / Änderungserkennung

Zur Erkennung veralteter Analysen soll ein kompakter Snapshot gespeichert werden.

Mindestens relevante Informationen:

- Planungsstichtag
- verwendete Planbasis-ID
- verwendete Kapitaltopf-IDs und relevante Beträge / Termine
- verwendete Sparplan-IDs und relevante Parameter
- verwendete Auszahlplan-IDs und relevante Parameter

Ändern sich diese Grundlagen außerhalb der Vertiefung, Status:

**Falldaten geändert**

Aktion:

**Mit aktuellen Daten aktualisieren**

Keine automatische stille Übernahme.

---

# 24. Verbindung zur Ruhestandsplanung

Beide Vertiefungen müssen dieselben zentralen Inflations- und Dynamikhelper verwenden.

Hat die Ruhestandsplanung bereits eine Inflationsannahme, darf die Inflation-&-Kaufkraft-Vertiefung diese als vorhandene Annahme anzeigen und nach bewusstem Klick übernehmen.

Keine automatische Synchronisation.

Umgekehrt darf eine in der Kaufkraftvertiefung gewählte Inflation die Ruhestandsplanung ebenfalls nicht still verändern.

Später kann eine bewusste Aktion `In Ruhestandsplanung übernehmen` angeboten werden.

---

# 25. Verbindung zu Depotcheck und Wertpapieren

Die Vertiefung analysiert nicht einzelne Depotpositionen und weist ihnen keine erwartete Rendite zu.

Keine automatische Renditeannahme aus Aktien, Fonds, Anleihen oder Modellportfolios.

Dafür bleiben Depotcheck und andere Vertiefungen zuständig.

Strategisches Kapital wird als aggregierter Planungsbetrag mit manueller Szenariorendite betrachtet.

---

# 26. Liquiditätsreserve

Liquidität darf nicht pauschal negativ bewertet werden, nur weil sie real an Kaufkraft verlieren kann.

Geeigneter Hinweis:

> Die Liquiditätsreserve dient primär Verfügbarkeit und Sicherheit. Die Kaufkraftbetrachtung zeigt lediglich den realen Wert eines unveränderten Nominalbetrags unter der gewählten Inflationsannahme.

Keine automatische Empfehlung, Liquidität zu reduzieren oder zu investieren.

---

# 27. Ergebnis- und Exportintegration

Wenn die Vertiefung bearbeitet wurde, kann sie später kompakt in Ergebnis und Export aufgenommen werden.

Bevorzugte Inhalte:

- verwendete Inflationsannahme
- ausgewählte relevante Kapitalbedarfe mit realem / nominalem Bezug
- wesentliche Kaufkraftlücken oder Reserven
- reale Renditeannahme des strategischen Kapitals
- ggf. kurze Aussage zur Kaufkraftwirkung eines relevanten Spar- oder Auszahlplans

Keine vollständigen Rechentabellen im Hauptergebnis.

Eine spätere Detailausgabe kann separat konzipiert werden.

---

# 28. Nicht Teil von V1

Nicht in die erste Version hineinziehen:

- persönliche Inflationsrate über individuellen Warenkorb
- Gewichtung von Miete, Energie, Lebensmitteln usw.
- Inflationsprognosen nach Kalenderjahr
- automatische Übernahme aktueller Inflationsdaten als Langfristannahme
- Steuerberechnung
- automatische Anlageempfehlungen
- automatische Renditeprognosen einzelner Wertpapiere
- Monte-Carlo-Simulation
- komplexe Makroszenarien
- automatische globale Anpassung aller Kapitalbedarfe

Historische oder aktuelle Inflationsdaten können später rein informativ ergänzt werden, müssen aber klar von der Planungsannahme getrennt bleiben.

---

# 29. Zentrale Regressionstests

Mindestens folgende fachliche Tests sind vorzusehen:

1. Kaufkraft eines festen Nominalbetrags bei positiver Inflation korrekt.
2. Rückwärtsrichtung liefert korrekten zukünftigen Nominalbedarf für gleiche Kaufkraft.
3. 0 % Inflation verändert Kaufkraft nicht.
4. Negative Inflation wird korrekt verarbeitet.
5. Reale Rendite verwendet die exakte Formel und nicht einfache Subtraktion.
6. Positiv wachsendes Nominalvermögen kann real an Kaufkraft verlieren.
7. Kapitalbedarf `nominal` wird nicht inflationiert.
8. Kapitalbedarf `todayPurchasingPower` wird korrekt hochgerechnet.
9. Kaufkraftlücke wird nur bei real gemeintem Bedarf ausgewiesen.
10. Kaufkraftreserve wird korrekt berechnet.
11. Änderung der Inflationsannahme verändert nur Simulationen, nicht operative Falldaten.
12. `Kapitalbedarf anpassen` benötigt ausdrückliche Bestätigung.
13. Nach Übernahme eines höheren Kapitalbedarfs läuft die zentrale Struktur-Reconciliation.
14. Keine automatische proportionale Kürzung strategischer Allokationen.
15. Sparplan ohne Dynamik verliert bei positiver Inflation reale Sparleistung.
16. Sparplan mit Dynamik ungefähr gleich Inflation hält reale Sparleistung näherungsweise stabil.
17. Simulierte Sparplandynamik verändert den echten Sparplan nicht.
18. Auszahlplan ohne Dynamik verliert bei positiver Inflation reale Kaufkraft.
19. Auszahlplan mit Dynamik ungefähr gleich Inflation hält reale Kaufkraft näherungsweise stabil.
20. Simulierte Auszahlplandynamik verändert den echten Auszahlplan nicht.
21. Mehrere Auszahlpläne bleiben separat.
22. Änderung eines referenzierten Kapitaltopfs setzt Datenstatus auf `Falldaten geändert`.
23. Änderung eines referenzierten Sparplans setzt Datenstatus auf `Falldaten geändert`.
24. Änderung eines referenzierten Auszahlplans setzt Datenstatus auf `Falldaten geändert`.
25. Wechsel des ZIELPLANS wird erkannt.
26. Fehlt ein ZIELPLAN, wird sichtbar auf aktiven Plan zurückgefallen.
27. Strategisches Kapital wird nicht doppelt mit Depotbeständen addiert.
28. Inflation aus Ruhestandsplanung wird nur nach bewusstem Klick übernommen.
29. Änderung der Kaufkraft-Inflation verändert Ruhestandsplanung nicht automatisch.
30. Identische Inflationsannahmen in Ruhestandsplanung und Kaufkraftvertiefung liefern bei identischen Eingaben identische Inflationsfaktoren.
31. Zeitberechnung mit konkreten Daten funktioniert auch bei nicht ganzjährigen Zeiträumen.
32. Ergebnis- und Exportintegration greift nur auf tatsächlich bearbeitete Vertiefung zurück.

Zusätzlich alle bestehenden Regressionen des Gesamtprojekts ausführen.

---

# 30. Fachliche Leitlinie

Die Vertiefung soll keine Entscheidung für den Berater treffen.

Sie soll sichtbar machen:

- welche Wirkung Inflation auf bestehende Planungen hat
- wo nominale und reale Betrachtung auseinanderfallen
- wo möglicherweise Kaufkraftlücken entstehen
- welche Dynamikannahmen die reale Wirkung von Spar- und Auszahlplänen verändern

Der Berater entscheidet anschließend bewusst, ob und welche operative Änderung übernommen wird.

Kernbotschaft:

> Inflation & Kaufkraft ist kein separater Rechner neben dem VermögensNavigator, sondern ein realer Kaufkraft-Check der bestehenden Planung.
