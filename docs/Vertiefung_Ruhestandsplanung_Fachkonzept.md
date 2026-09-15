# VermögensNavigator – Vertiefung Ruhestandsplanung – Fachkonzept

Status: fachlich beschlossen / Work-ready nach Umsetzung der vorausgehenden Kernbausteine

Repository: `LeonMoebius-code/vermoegensnavigator`

Diese Datei beschreibt das vollständige fachliche Zielbild der späteren Vertiefung **Ruhestandsplanung**. Sie ist kein isolierter Zinseszinsrechner, sondern ein übergreifendes Beratungsmodul, das vorhandene Falldaten liest, eine deterministische Ruhestandsprojektion berechnet und konkrete Umsetzungsbedarfe ableitet.

Die Ruhestandsplanung soll erst umgesetzt werden, wenn die dafür relevanten Kernbausteine wie Multi Depot, freier Planvergleich sowie operativer Auszahlplan und Dynamik stabil vorhanden sind.

---

# 1. Leitidee

Die Ruhestandsplanung verbindet:

**Heute → Vermögensaufbau → Ruhestandsbeginn → sonstige Ruhestandseinkünfte → gewünschter realer Lebensstandard → Versorgungslücke → notwendiges Ruhestandskapital → zusätzliche Sparrate → operative Umsetzung über Spar- und Auszahlplan.**

Ziel ist keine Prognose und keine Garantieaussage, sondern eine nachvollziehbare Planungsrechnung auf Basis frei veränderbarer Annahmen.

---

# 2. Integrationsprinzip

Verbindlicher Grundsatz:

> **Lesen darf die Ruhestandsplanung viel. Schreiben darf sie nur über ausdrücklich bestätigte Übergaben.**

Die Vertiefung darf vorhandene Daten aus dem Beratungsfall lesen, insbesondere:

- ZIELPLAN
- strategische Kapitalbasis
- bestehende Sparpläne
- bestehende Auszahlpläne
- Geburtsdatum, sofern im Fall vorhanden
- relevante Falldaten und Planreferenzen

Sie verändert niemals automatisch:

- Kapitaltöpfe
- Allokationen
- Depotpositionen
- Sparpläne
- Auszahlpläne
- Zielplanstatus
- aktive Planvariante

Erst über bewusste Aktionen wie **Als Sparplan übernehmen** oder **Als Auszahlplan übernehmen** wird eine operative Änderung angestoßen.

Die Ruhestandsplanung ist damit ein eigenes Planungsszenario, nicht automatisch die operative Realität des Falls.

---

# 3. Eine Ruhestandsplanung je Beratungsfall

Für die erste Version gibt es genau **eine Ruhestandsplanung je Beratungsfall**.

Keine zusätzlichen Ruhestands-Szenarien A/B/C.

Die bestehenden Planvarianten bleiben weiterhin die Szenarioebene für die Vermögensstruktur. Die Ruhestandsplanung arbeitet mit dem aktuell gewählten ZIELPLAN als Standardbasis.

---

# 4. Planungsstichtag

Jede Ruhestandsplanung besitzt einen festen **Planungsstichtag**.

Standard beim Anlegen:

- aktuelles Datum

Der Stichtag verändert sich später nicht automatisch nur durch erneutes Öffnen.

Optionaler bewusster Vorgang:

**Auf heute aktualisieren**

Dadurch bleibt nachvollziehbar, auf welchem Zeitpunkt eine bestehende Planung basiert.

---

# 5. Zeitraum und Grundannahmen

Mindestens folgende Eingaben bzw. abgeleitete Werte:

- Geburtsdatum
- Ruhestandsalter
- daraus abgeleiteter Ruhestandsbeginn
- Planungsende primär als Alter
- daraus abgeleitetes Enddatum
- Inflation p. a.
- Renditeannahme bis Ruhestand p. a.
- Renditeannahme im Ruhestand p. a.

Verbindliche Defaults:

- Planungsende: **95 Jahre**
- Inflation: **2 % p. a.** als klar sichtbare frei änderbare Planungsannahme
- Rendite bis Ruhestand: keine automatische Vorbelegung
- Rendite im Ruhestand: keine automatische Vorbelegung

Das Risikoprofil darf informativ daneben stehen, darf aber niemals automatisch eine Renditeannahme setzen.

---

# 6. Standard-Kapitalbasis

Verbindlicher Standard:

> **Strategisches Kapital des ZIELPLANS**

Dieses Kapital wird als anrechenbares Ruhestandskapital vorgeschlagen.

Sichtbar ausweisen:

**Automatisch übernommen aus ZIELPLAN**

Zusätzlich:

**Kapitalbasis anpassen**

Erlaubt bewusste manuelle Zu- oder Abschläge.

Beispiel:

- Strategisches Kapital ZIELPLAN: 500.000 €
- manuelle Ergänzung: +50.000 €
- anrechenbares Ruhestandskapital heute: 550.000 €

Andere Kapitaltöpfe oder vorhandene Depotbestände werden nicht blind zusätzlich eingerechnet, sofern dadurch eine Doppelzählung möglich wäre.

Wenn ein vorhandener Depotbestand außerhalb der strategischen Kapitalbasis sichtbar ist, kann er ergänzend angezeigt werden, aber nicht automatisch als zusätzliches Ruhestandskapital angesetzt werden.

---

# 7. Bestehende Sparpläne

Vorhandene Sparpläne können in der Ruhestandsplanung berücksichtigt werden.

Sie werden **nicht automatisch alle ausgewählt**.

Der Berater entscheidet bewusst, welche Sparpläne dem Ruhestandsvermögen dienen.

Je berücksichtigtem Sparplan werden vorhandene Parameter verwendet:

- Beitrag
- Rhythmus
- Startdatum
- jährliche Dynamik, sofern vorhanden

Für die Ruhestandsprojektion enden ausgewählte Sparbeiträge grundsätzlich mit dem Ruhestandsbeginn.

Sparpläne für andere Ziele dürfen dadurch nicht automatisch einbezogen werden.

---

# 8. Zusätzliche simulierte Sparrate

Separates Szenariofeld:

**Zusätzliche simulierte Sparrate**

Standard:

0 €

Zusätzlich optional:

**jährliche Dynamik der simulierten Sparrate**

Standard:

0 %

Die simulierte zusätzliche Sparrate ist kein echter Sparplan und verändert den Beratungsfall nicht.

Sie kann später bewusst als operativer Sparplan übernommen werden.

---

# 9. Ansparphase – Rechenlogik

Die Projektion arbeitet zentral auf Monatsbasis.

Aus einer Jahresrendite wird die effektive Monatsrendite berechnet:

`Monatsrendite = (1 + Jahresrendite)^(1/12) - 1`

Dasselbe Prinzip gilt für Inflation.

Je Monat der Ansparphase sinngemäß:

**Kapital Monatsanfang**

+ berücksichtigte Sparbeiträge

+ zusätzliche simulierte Sparrate

→ Rendite auf das resultierende Kapital

= **Kapital Monatsende**

Bereits vergangene Beiträge werden nicht erneut berücksichtigt, weil sie im heutigen Startkapital enthalten sind.

Die Berechnung ist eine Planungsrechnung, keine taggenaue Performance- oder Steuerrechnung.

---

# 10. Übergang in den Ruhestand

Im Ruhestandsmonat endet die Ansparphase.

Ab diesem Zeitpunkt:

- keine Ansparbeiträge mehr aus den für die Ansparphase berücksichtigten Sparplänen
- sonstige Ruhestandseinkünfte gemäß individuellem Startzeitpunkt berücksichtigen
- gewünschter realer Lebensstandard berücksichtigen
- Renditeannahme Ruhestand verwenden

Ein später startendes Einkommen, z. B. private Rente erst ab Alter 70, wird erst ab diesem Zeitpunkt berücksichtigt.

---

# 11. Gewünschter Lebensstandard

Der Berater erfasst:

**Gewünschter monatlicher Bedarf in heutiger Kaufkraft**

Es wird bewusst nur **ein konstanter realer Lebensstandard** modelliert.

Keine unterschiedlichen Lebensphasen für Reise-, Pflege- oder sonstige Phasen in V1.

Die nominal notwendige Ausgabe wächst über die gesamte Planung mit der Inflationsannahme.

Sinngemäß:

`Bedarf Monat t = heutiger Bedarf × Inflationsfaktor seit Planungsstichtag`

Dadurch bleibt der reale Lebensstandard konstant, während der nominale Eurobetrag steigt.

---

# 12. Ruhestandseinkünfte

Es können mehrere Einkommensquellen erfasst werden, zum Beispiel:

- gesetzliche Rente
- Betriebsrente
- private Rente
- Mieteinnahmen
- sonstige regelmäßige Einkünfte

Je Einkommensquelle mindestens:

- Bezeichnung
- verfügbarer Monatsbetrag zum Startzeitpunkt
- Startalter bzw. daraus abgeleiteter Startmonat
- optionale jährliche Dynamik

Standard Dynamik:

0 %

Der eingegebene Betrag ist der für die Planung tatsächlich verfügbare Betrag.

Keine automatische Steuer-, Sozialversicherungs- oder Nettorentenberechnung.

Dynamik greift jährlich zum jeweiligen Startjubiläum.

---

# 13. Versorgungslücke

Für jeden Ruhestandsmonat:

`Versorgungslücke = max(0, Bedarf - verfügbare sonstige Einkommen)`

Wenn Einkommen höher als Bedarf:

- Überschuss sichtbar ausweisen
- Überschuss nicht automatisch wieder anlegen

Die Versorgungslücke ist die erforderliche Vermögensentnahme dieses Monats.

---

# 14. Ruhestandsphase – Rechenlogik

Je Ruhestandsmonat sinngemäß:

**Kapital Monatsanfang**

− erforderliche Vermögensentnahme

→ Rendite auf das verbleibende Kapital

= **Kapital Monatsende**

Das sichtbare Kapital darf nicht negativ werden.

Wenn das Kapital rechnerisch aufgebraucht ist:

- sichtbares Kapital = 0 €
- Zeitpunkt der rechnerischen Aufzehrung anzeigen
- danach verbleibende ungedeckte Versorgungslücke ausweisen

Für interne numerische Lösungsverfahren darf ein virtueller Fehlbetrag verwendet werden.

---

# 15. Kapitalziele am Planungsende

Mindestens vier fachliche Modi:

## A – Kapital verbrauchen

Zielkapital am Planungsende:

0 €

## B – Kapital nominal erhalten

Endkapital entspricht nominal dem Kapital zu Ruhestandsbeginn.

Hinweis:

Nominaler Kapitalerhalt bedeutet nicht realen Kaufkrafterhalt.

## C – Kaufkraft des Kapitals erhalten

Endkapital soll dieselbe reale Kaufkraft besitzen wie das Kapital zu Ruhestandsbeginn.

Die Engine inflationiert den notwendigen nominalen Endwert entsprechend.

## D – Eigenes Restkapital

Der Berater erfasst ein gewünschtes Restkapital **in heutiger Kaufkraft**.

Die Engine inflationiert diesen Betrag bis zum Planungsende auf den benötigten nominalen Zielwert.

Standardmodus:

**Kapital bis Planungsende verbrauchen**

---

# 16. Benötigtes Kapital zum Ruhestandsbeginn

Die Ruhestandsplanung berechnet rückwärts den Kapitalbetrag zum Ruhestandsbeginn, der benötigt wird, um:

- sämtliche zukünftigen Versorgungslücken zu decken
- das gewählte Restkapitalziel am Planungsende zu erreichen

Keine vereinfachte Rentenformel verwenden.

Bevorzugt dieselbe monatliche Projektionsengine mit numerischer Lösung, z. B. monotone Bisektion.

Dadurch bleiben automatisch enthalten:

- unterschiedliche Einkommensstarttermine
- Inflation
- Einkommensdynamiken
- Rendite im Ruhestand
- individuelles Restkapitalziel

---

# 17. Unmögliche Kombinationen

Die Anwendung muss rechnerisch nicht tragfähige Zielkombinationen erkennen.

Beispiel:

- Rendite im Ruhestand 1 %
- Inflation 3 %
- laufende Entnahme
- zusätzlich realer Kapitalerhalt

Wenn ein Ziel unter den Annahmen nicht erreichbar ist, keine absurd hohe Scheinlösung anzeigen.

Stattdessen klare Aussage:

> Unter den gewählten Annahmen ist dieses Kapitalerhaltsziel bei gleichzeitiger Entnahme rechnerisch nicht erreichbar.

Dasselbe Prinzip gilt bei anderen mathematisch unlösbaren Kombinationen.

---

# 18. Entnahmekapazität

Zusätzlich zur konkreten Versorgungslücke wird aus dem tatsächlich erwarteten Ruhestandskapital die theoretisch mögliche anfängliche monatliche Entnahme berechnet.

Mindestens sichtbar:

- bei Kapitalverbrauch bis Planungsende
- bei nominalem Kapitalerhalt
- bei realem Kapitalerhalt

Die Entnahme wächst dabei entsprechend der Inflationsannahme, sofern reale Kaufkraft erhalten werden soll.

Die Entnahmekapazität ist eine Kapitalanalyse und wird nicht mit sonstigen Renteneinkünften doppelt vermischt.

Daneben sichtbar:

**Für gewünschten Lebensstandard erforderliche Vermögensentnahme**

Damit ist sofort erkennbar, ob die Kapitalbasis zum gewünschten Lebensstandard passt.

---

# 19. Eigene Entnahme testen

Zusätzliche Funktion:

**Eigene anfängliche monatliche Entnahme testen**

Der Berater kann einen Betrag vorgeben.

Die Entnahme wird innerhalb der Ruhestandsplanung standardmäßig inflationsdynamisiert, damit die reale Kaufkraft erhalten bleibt.

Ergebnis zum Beispiel:

- Kapital reicht mindestens bis Planungsende
- Restkapital am Planungsende
- oder rechnerischer Aufzehrungszeitpunkt

Keine Garantieaussage.

---

# 20. Erwartetes versus benötigtes Ruhestandskapital

Zentrale Ergebnislogik:

**Erwartetes Kapital zum Ruhestandsbeginn**

gegen

**Benötigtes Kapital zum Ruhestandsbeginn**

Ergebnis:

- Planungsreserve
- oder Kapitallücke

Beispiel:

- erwartet: 650.000 €
- benötigt: 810.000 €
- Kapitallücke: 160.000 €

---

# 21. Zusätzliche erforderliche Sparrate

Wenn eine Kapitallücke besteht, wird rückwärts die erforderliche zusätzliche anfängliche Sparrate bis Ruhestand berechnet.

Dabei verwenden:

- strategisches Startkapital
- ausgewählte bestehende Sparpläne
- deren Rhythmen und Dynamiken
- Rendite bis Ruhestand
- zusätzliche simulierte Sparrate
- optionale jährliche Dynamik dieser Zusatzrate

Ziel:

`erwartetes Ruhestandskapital = benötigtes Ruhestandskapital`

Keine vereinfachte Division der Kapitallücke durch Restmonate.

Die zusätzliche Sparrate soll mit derselben zentralen Ansparengine numerisch gelöst werden.

---

# 22. Übernahme als Sparplan

Wenn eine zusätzliche Sparrate berechnet wurde:

Aktion:

**Als Sparplan übernehmen**

Dabei wird der normale Sparplan-Editor geöffnet.

Vorbelegt werden dürfen:

- Betrag
- Rhythmus
- Startdatum
- ggf. vorgeschlagene jährliche Dynamik

Die Produktwahl muss bewusst erfolgen.

Nach erfolgreicher Übernahme muss eine Doppelzählung zwingend verhindert werden:

- neuer operativer Sparplan wird gespeichert
- dessen ID wird als berücksichtigter Sparplan in der Ruhestandsplanung übernommen
- simulierte zusätzliche Sparrate wird auf 0 gesetzt
- Berechnung wird aktualisiert

Verbindlicher Regressionstest.

---

# 23. Operativer Auszahlplan bleibt getrennt

Die Ruhestandsplanung berechnet den Entnahmebedarf.

Der operative Auszahlplan beschreibt die konkrete Umsetzung.

Aktion:

**Als Auszahlplan übernehmen**

Vorbelegt werden dürfen:

- Betrag
- Rhythmus
- Startdatum = Ruhestandsbeginn
- Inflation als vorgeschlagene jährliche Dynamik

Die Dynamik wird nicht automatisch festgeschrieben.

Die konkreten Entnahmequellen bleiben bewusst offen und werden erst im normalen Auszahlplan-Editor festgelegt.

Die Ruhestandsplanung entscheidet niemals selbst, welches Wertpapier verkauft oder belastet wird.

---

# 24. Vorhandene Auszahlpläne als Umsetzungsabgleich

Bereits vorhandene operative Auszahlpläne werden nicht zusätzlich als Entnahme in die Ruhestandsprojektion eingerechnet.

Sonst würde die Versorgungslücke doppelt belastet.

Stattdessen dienen sie ausschließlich als Umsetzungsabgleich.

Beispiel:

- erforderliche Vermögensentnahme: 2.430 €/Monat
- bereits operativ geplant: 1.800 €/Monat
- noch umzusetzen: 630 €/Monat

Die Projektion enthält weiterhin nur die vollständige Versorgungslücke von 2.430 €.

---

# 25. Basis-Snapshot und Änderungsstatus

Die Ruhestandsplanung soll erkennen können, wenn ihre Eingangsgrundlage später verändert wurde.

Dafür einen kleinen Basis-Snapshot speichern, mindestens sinngemäß:

- verwendete ZIELPLAN-ID
- strategische Kapitalbasis zum Berechnungszeitpunkt
- berücksichtigte Sparplan-IDs
- relevante damalige Parameter der berücksichtigten Sparpläne
- relevante vorhandene Auszahlplan-IDs für den Umsetzungsabgleich
- Planungsstichtag

Keine komplette Kopie des gesamten Beratungsfalls speichern.

Wenn sich relevante Grundlagen ändern:

Status:

**Datengrundlage geändert**

Aktion:

**Mit aktuellen Falldaten aktualisieren**

Keine stille Überschreibung bestehender Ruhestandsannahmen.

---

# 26. Read-heavy, write-light

Die Ruhestandsplanung ist bewusst:

**read-heavy, write-light**

Sie darf viel aus dem Fall lesen, aber fast nichts ungefragt zurückschreiben.

Dadurch sollen zirkuläre Effekte und versteckte Doppelzählungen vermieden werden.

---

# 27. Bereits im Ruhestand

Die erste Version soll auch funktionieren, wenn der Kunde bereits im Ruhestand ist.

Liegt der Ruhestandsbeginn vor dem Planungsstichtag:

- Ansparphase entfällt
- heutige Kapitalbasis wird als aktuelle Ruhestandskapitalbasis verwendet
- aktive Ruhestandseinkünfte werden ab heute berücksichtigt
- zusätzliche Sparraten-Rückwärtsrechnung wird nicht angeboten

Die Entnahme- und Kapitalbedarfslogik bleibt nutzbar.

---

# 28. Rechenparameter – Grenzfälle

Die Engine soll ausdrücklich funktionieren bei:

- 0 % Rendite
- negativer Rendite
- 0 % Inflation
- negativer Inflation / Deflation

Technische Mindestgrenze:

Rendite und Inflation jeweils größer als −100 %.

Ungewöhnliche Annahmen dürfen neutral gewarnt, aber nicht willkürlich blockiert werden.

---

# 29. Benutzeroberfläche – empfohlene Reihenfolge

Die Vertiefungsseite soll von oben nach unten logisch aufgebaut sein.

## Bereich A – Ruhestandsplanung / Datenstand

- Planungsstichtag
- ZIELPLAN-Bezug
- Status aktuell / Datengrundlage geändert

## Bereich B – Zeitraum und Annahmen

- Geburtsdatum
- Ruhestandsalter
- Ruhestandsbeginn
- Planungsende Alter
- Enddatum
- Inflation
- Rendite bis Ruhestand
- Rendite im Ruhestand

## Bereich C – Kapitalbasis

- strategisches Kapital aus ZIELPLAN
- manuelle Anpassung
- anrechenbares Kapital heute

## Bereich D – Bestehender Vermögensaufbau

- auswählbare bestehende Sparpläne
- zusätzliche simulierte Sparrate
- optionale Dynamik

## Bereich E – Ergebnis Ansparphase

- Startkapital
- Einzahlungen
- zusätzlicher Sparbeitrag
- Wertzuwachs
- erwartetes Kapital zum Ruhestand
- Verlauf heute bis Ruhestand

## Bereich F – Lebensstandard

- monatlicher Bedarf in heutiger Kaufkraft
- daraus nominaler Bedarf zum Ruhestandsbeginn

## Bereich G – Ruhestandseinkünfte

- mehrere Einkommensquellen
- Betrag
- Startalter
- Dynamik

## Bereich H – Versorgungslücke

- Bedarf
- sonstige Einkommen
- erforderliche Vermögensentnahme
- Entwicklung über die Zeit

## Bereich I – Kapitalziel / Tragfähigkeit

- Kapital verbrauchen
- nominal erhalten
- real erhalten
- eigenes Restkapital
- benötigtes Ruhestandskapital
- erwartetes Ruhestandskapital
- Reserve oder Kapitallücke

## Bereich J – Entnahmekapazität

- mögliche Entnahme bei Kapitalverbrauch
- mögliche Entnahme bei nominalem Erhalt
- mögliche Entnahme bei realem Erhalt
- Vergleich zur benötigten Vermögensentnahme

## Bereich K – Rückwärtsrechnung

- zusätzliche erforderliche Sparrate
- optional mit Dynamik simulieren
- als Sparplan übernehmen

## Bereich L – Operative Umsetzung

- bereits geplanter Auszahlplan
- noch umzusetzen
- als Auszahlplan übernehmen

---

# 30. Ergebnisdarstellung

Kompakte zentrale Kundenübersicht, beispielsweise:

**Ruhestand mit 67**

- Kapital zum Ruhestand
- monatlicher Bedarf zum Start
- weitere Einkommen
- erforderliche Vermögensentnahme
- benötigtes Kapital bis Planungsende
- Planungsreserve oder Kapitallücke
- zusätzliche Sparrate erforderlich

Mindestens zwei Visualisierungen:

1. Vermögensentwicklung heute → Ruhestand → Planungsende
2. monatlicher Ruhestands-Cashflow aus Bedarf, sonstigen Einkommen und erforderlicher Vermögensentnahme

Zusätzlich sinnvoll:

- Aufteilung Startkapital / Einzahlungen / Wertzuwachs
- Zielerreichung bzw. Kapitallücke

---

# 31. Keine doppelten Rechenlogiken

Die Umsetzung soll nach Möglichkeit zentrale Helper verwenden für:

- Monatsrendite
- Inflation
- Sparplanrhythmen
- Auszahlplanrhythmen
- jährliche Dynamik
- Datumsfortschreibung
- periodische Projektionsengine

Keine separate zweite Dynamik- oder Cashflowlogik ausschließlich innerhalb der Ruhestandsplanung bauen, wenn bereits zentrale Funktionen aus V0.20 vorhanden sind.

---

# 32. Nicht Teil der ersten Version

Nicht in V1 der Ruhestandsplanung aufnehmen:

- vollständige Steuerberechnung
- Kranken- und Pflegeversicherungsberechnung
- automatische gesetzliche Rentenhochrechnung
- Hinterbliebenenversorgung
- Monte-Carlo-Simulation
- Wahrscheinlichkeitswerte
- komplexe Renditeverteilungen
- mehrere Lebensstandardphasen
- mehrere parallele Ruhestandsszenarien
- automatische Wiederanlage von Einkommensüberschüssen
- automatische Produkt- oder Entnahmequellenwahl

Spätere Erweiterungen sind möglich.

---

# 33. Kritische Regressionen

Mindestens folgende fachliche Tests vorsehen:

1. Strategisches Kapital des ZIELPLANS wird als Standardkapitalbasis verwendet.
2. Manuelle Kapitalanpassung führt zu keiner Doppelzählung.
3. Nicht ausgewählte Sparpläne werden nicht berücksichtigt.
4. Ausgewählte Sparpläne werden mit Rhythmus, Start und Dynamik korrekt berücksichtigt.
5. Simulierte zusätzliche Sparrate verändert den Beratungsfall nicht.
6. Übernommener Sparplan ersetzt die simulierte Zusatzrate ohne Doppelzählung.
7. Lebensstandard bleibt real konstant und wächst nominal mit Inflation.
8. Später startende Einkommensquellen werden erst ab Startmonat berücksichtigt.
9. Einkommensdynamik greift jährlich zum Startjubiläum.
10. Einkommensüberschuss wird nicht automatisch reinvestiert.
11. Versorgungslücke wird monatlich korrekt berechnet.
12. Kapitalverbrauch bis Planungsende löst benötigtes Startkapital korrekt.
13. Nominaler Kapitalerhalt funktioniert.
14. Realer Kapitalerhalt funktioniert.
15. Eigenes Restkapital in heutiger Kaufkraft wird korrekt inflationiert.
16. Nicht erreichbare Kapitalerhaltsziele werden erkannt.
17. Zusätzliche Sparrate wird mit derselben Ansparengine rückwärts gelöst.
18. 0 % Rendite funktioniert.
19. Negative Rendite > −100 % funktioniert.
20. 0 % Inflation funktioniert.
21. Negative Inflation > −100 % funktioniert.
22. Kapital wird sichtbar niemals negativ dargestellt.
23. Aufzehrungszeitpunkt wird korrekt ausgewiesen.
24. Bereits vorhandene Auszahlpläne werden nur als Umsetzungsabgleich verwendet.
25. Auszahlplanübernahme verändert nicht zusätzlich die Ruhestandsprojektion.
26. Wechsel des ZIELPLANS markiert Datengrundlage als geändert.
27. Änderung eines berücksichtigten Sparplans markiert Datengrundlage als geändert.
28. Löschung eines berücksichtigten Sparplans erzeugt keine tote Referenz ohne Hinweis.
29. Änderung operativer Auszahlpläne aktualisiert den Umsetzungsabgleich, nicht die Bedarfsmathematik.
30. Multi-Depot-Änderungen verändern die Ruhestandsplanung nicht unkontrolliert, solange die verwendete strategische Kapitalbasis unverändert bleibt.
31. Planvariante duplizieren erzeugt keine unbeabsichtigte zweite Ruhestandsplanung.
32. Ältere Fälle ohne Ruhestandsdaten migrieren ohne erfundene Werte.
33. Bereits im Ruhestand: Ansparphase entfällt korrekt.
34. Planungsstichtag bleibt stabil, bis bewusst aktualisiert wird.

---

# 34. Zielarchitektur

Die Ruhestandsplanung soll fachlich wie technisch als übergreifende Vertiefung verstanden werden.

Sie liest den bestehenden Beratungsstand, berechnet daraus ein konsistentes deterministisches Ruhestandsszenario und zeigt anschließend konkrete Handlungslücken.

Operative Änderungen werden ausschließlich über bewusste Übergaben an bestehende Planobjekte vorgenommen.

Die Ruhestandsplanung ist damit kein konkurrierender Sparplan-, Auszahlplan- oder Strukturplan-Editor, sondern deren übergeordnete Beratungslogik.

---

# 35. Roadmap-Einordnung

Vorausgehende Kernbausteine:

1. Multi Depot
2. freier Planvergleich
3. operativer Auszahlplan + jährliche Dynamik
4. Vertiefungsframework

Danach eignet sich die Ruhestandsplanung als eine der ersten größeren fachlichen Vertiefungen.

Sie sollte aufgrund ihrer Integrationsbreite als eigenes Workpaket umgesetzt und intensiv regressionsgetestet werden.

Vor Implementierungsstart ist ein technisches Preflight auf dem dann aktuellen Repositorystand sinnvoll, insbesondere zu:

- tatsächlicher ZIELPLAN-Repräsentation
- strategischer Kapitalbasis
- Sparplanmodell
- Auszahlplanmodell
- zentralen Dynamik- und Datumshelpern
- Persistenzschema
- Vertiefungsframework

Keine erneute fachliche Grundsatzkonzeption durchführen, sofern dieses Dokument nicht durch spätere Entscheidungen ausdrücklich geändert wurde.
