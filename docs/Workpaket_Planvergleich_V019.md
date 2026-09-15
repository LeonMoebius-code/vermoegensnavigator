# Workpaket V0.19.0 – Freier Planvergleich

Repository: `LeonMoebius-code/vermoegensnavigator`

Status: 🟢 **BESCHLOSSEN / WORK-READY**

Dieses Dokument definiert den fachlichen Sollstand für **V0.19.0 Freier Planvergleich**. Die Umsetzung erfolgt erst nach V0.18.0 Multi Depot und arbeitet dann auf dem zu diesem Zeitpunkt aktuellen `main`.

Zielversion: **0.19.0**

Erwartetes Persistenzschema nach V0.18: **10**

Für V0.19 ist **keine weitere Schemaerhöhung vorgesehen**, sofern die technische Umsetzung keinen unerwarteten zwingenden Grund offenlegt. Die Vergleichsauswahl ist UI-Zustand und keine fachliche Persistenz.

---

# 1. Ziel

Der VermögensNavigator soll nicht nur IST mit dem aktiven Plan bzw. PLAN mit ZIELPLAN vergleichen können. Der Berater soll im Vermögenshaus der Gesamtplanung zwei konkrete Vergleichsobjekte frei wählen können.

Beispiele:

- IST ↔ Plan A
- Plan A ↔ Plan C
- Plan B ↔ Plan A
- Plan C ↔ Plan C

Der Vergleich ist ausschließlich ein Analyse- und Darstellungswerkzeug. Er verändert keine fachliche Planentscheidung.

---

# 2. Bestehende Rollen bleiben unverändert

Die vorhandene Semantik bleibt bestehen:

- **PLAN** = aktuell aktive Planvariante über `activePlanId`
- **ZIELPLAN** = bevorzugte Planvariante über `preferred`
- **IST** = heutige tatsächliche Ausgangslage des Beratungsfalls
- **VERGLEICH** = frei wählbare Gegenüberstellung

PLAN und ZIELPLAN werden nicht durch den freien Vergleich ersetzt.

---

# 3. IST im freien Vergleich

Im freien Vergleich bedeutet **IST** verbindlich:

> tatsächliche heutige Ausgangslage des Beratungsfalls

Nach Multi Depot umfasst IST insbesondere:

- die heutige relevante Liquidität gemäß bestehender Vermögenshauslogik
- den vollständigen physischen Bestand aller konkreten Depots

IST darf im freien Vergleich **nicht von einer ausgewählten Planvariante oder deren Depotmodus abhängen**.

Der Depotmodus gehört zur jeweiligen Planvariante und beeinflusst deren PLAN-/ZIELPLAN-Wert, nicht die Definition des heutigen IST.

Beispiel:

- Plan A: `afterSales`
- Plan B: `retain`
- Plan C: `none`

IST bleibt in allen drei Vergleichen derselbe tatsächliche Ausgangszustand.

---

# 4. Vergleichsauswahl

Im Reiter **VERGLEICH** gibt es zwei Selektoren:

- **Basis**
- **Vergleich**

Standard beim erstmaligen Öffnen:

- Basis = **IST**
- Vergleich = **aktive Planvariante**

Als auswählbare Planobjekte dienen die **konkreten Planvarianten**.

Keine redundanten zusätzlichen Einträge `PLAN` und `ZIELPLAN`, wenn dadurch dieselbe Planvariante mehrfach auftauchen würde.

Bevorzugte Darstellung der Planvarianten im Picker:

- `Plan A · Aktiv`
- `Plan B · Zielplan`
- `Plan C`

Ist eine Variante gleichzeitig aktiv und bevorzugt:

- `Plan B · Aktiv · Zielplan`

Zusätzlich:

- `IST · heutige Ausgangslage`

---

# 5. Vergleich verändert keine fachlichen Zustände

Das Ändern von Basis oder Vergleich darf ausdrücklich **nicht** verändern:

- `activePlanId`
- `preferred`
- Allokationen
- Kapitaltöpfe
- Depotmodus
- `depotHoldingIds`
- simulierte Verkäufe
- InvestmentPlans
- Sparpläne
- Sparziele
- Risikoorientierung
- sonstige fachliche Fallzustände

Kein implizites `Als aktiven Plan übernehmen` und kein implizites `Als Zielplan übernehmen` innerhalb des Vergleichs.

---

# 6. Persistenz

Die beiden gewählten Vergleichsobjekte sind reiner UI-Zustand.

Keine neuen Persistenzfelder wie:

- `comparisonPlanAId`
- `comparisonPlanBId`

Keine Schemaerhöhung allein für V0.19.

Beim erneuten Öffnen der Vergleichsansicht darf standardmäßig wieder gelten:

- IST
- aktuell aktive Planvariante

Während einer laufenden Vergleichsansicht soll eine bewusst gesetzte Kombination aber stabil bleiben und nicht durch jede Änderung von `activePlanId` sofort überschrieben werden.

---

# 7. Grunddarstellung

Ganz oben kompakt darstellen:

- Gesamtvolumen Basis
- Gesamtvolumen Vergleich
- absolute Differenz

Beispiel:

- Plan A: 1.420.000 €
- Plan C: 1.500.000 €
- Differenz: +80.000 €

Wenn die Gesamtvolumina voneinander abweichen, neutral hinweisen:

> Die Varianten weisen unterschiedliche Gesamtvolumina auf. Betrags- und Strukturveränderungen werden deshalb getrennt dargestellt.

Keine positive oder negative Bewertung allein aufgrund eines höheren oder niedrigeren Volumens.

---

# 8. Vermögenshaus-Vergleich

Für alle fünf wirtschaftlichen Anlageklassen werden beide Vergleichsobjekte direkt gegenübergestellt:

1. Liquidität
2. Geldwerte
3. Substanzwerte
4. Alternative Anlagen
5. Sachwerte

Je Anlageklasse mindestens anzeigen:

- Betrag Basis
- Gewicht Basis
- Betrag Vergleich
- Gewicht Vergleich
- Differenz in EUR
- Differenz in Prozentpunkten

Beispiel:

| Anlageklasse | Plan A | Plan C | Δ Betrag | Δ Anteil |
|---|---:|---:|---:|---:|
| Liquidität | 100.000 € · 7,0 % | 80.000 € · 5,3 % | -20.000 € | -1,7 PP |
| Geldwerte | 320.000 € · 22,5 % | 250.000 € · 16,7 % | -70.000 € | -5,8 PP |
| Substanzwerte | 700.000 € · 49,3 % | 850.000 € · 56,7 % | +150.000 € | +7,4 PP |

Wichtig:

- bei Gewichtsveränderungen **Prozentpunkte**, nicht Prozent, verwenden
- EUR und Gewichtung gemeinsam zeigen
- keine rote/grüne Wertung, die eine Anlageklasse automatisch als besser oder schlechter interpretiert
- bestehende Corporate-Design-Farblogik neutral für Basis und Vergleich verwenden

---

# 9. Unterschiedliche Gesamtvolumina

Betragsveränderung und Strukturveränderung sind fachlich getrennte Aussagen.

Beispiel:

- Plan A Substanzwerte 500.000 € von 1.000.000 € = 50 %
- Plan B Substanzwerte 550.000 € von 1.200.000 € = 45,8 %

Ergebnis:

- Betrag +50.000 €
- Gewichtung -4,2 PP

Die UI muss beide Informationen sichtbar machen und darf aus dem höheren Betrag keine höhere strategische Gewichtung ableiten.

---

# 10. Ungeklärte Beträge

Bestehende Logik zu wirtschaftlich ungeklärten Beträgen bleibt erhalten.

Wenn ein Vergleichsobjekt einen ungeklärten Betrag besitzt, muss dieser sichtbar bleiben.

Mindestens:

- ungeklärter Betrag
- optional Anteil am Gesamtvolumen

Keine scheinbar vollständige Strukturverteilung erzeugen, wenn relevante Beträge fachlich nicht durchgeschaut sind.

---

# 11. Zustandekommen der Planvarianten

Unterhalb des Vermögenshauses kompakt zeigen, wie das jeweilige Planvolumen entsteht.

Je Planvariante mindestens sinnvoll:

- berücksichtigter Bestand
- Neuanlage
- Gesamtplan
- Bestandsdepot-Modus

Beispiel:

**Plan A**

- Berücksichtigter Bestand 420.000 €
- Neuanlage 1.000.000 €
- Gesamtplan 1.420.000 €
- Bestandsdepot: Nach simulierten Verkäufen

**Plan C**

- Berücksichtigter Bestand 250.000 €
- Neuanlage 1.250.000 €
- Gesamtplan 1.500.000 €
- Bestandsdepot: Ausgewählte Positionen beibehalten

Für IST stattdessen eine passende heutige Ausgangszusammenfassung anzeigen.

Nach Multi Depot darf bei Bedarf zusätzlich die Gesamtzahl der Depots sichtbar sein, ohne den freien Planvergleich in eine depotweise Einzelanalyse umzubauen.

---

# 12. Größte Veränderungen

Optional, aber bevorzugt als kompakte Zusammenfassung:

- maximal drei größte Veränderungen der wirtschaftlichen Anlageklassen
- sortiert nach absoluter Veränderung der Gewichtung in Prozentpunkten oder einer technisch gleichwertig nachvollziehbaren Regel

Beispiel:

> Größte Strukturveränderungen gegenüber Plan A: Substanzwerte +7,4 PP, Geldwerte -5,8 PP, Liquidität -1,7 PP.

Keine automatische qualitative Aussage wie:

- besser diversifiziert
- defensiver
- attraktiver
- geeigneter

sofern dies nicht separat fachlich begründet wird.

---

# 13. Gleicher Plan gegen gleichen Plan

Nicht künstlich blockieren.

Wenn Basis und Vergleich identisch sind:

- Differenz Gesamtvolumen = 0
- alle EUR-Differenzen = 0
- alle PP-Differenzen = 0
- optional neutraler Hinweis: `Keine Unterschiede zwischen den gewählten Varianten.`

Keine komplizierte Dropdown-Sperrlogik erforderlich.

---

# 14. Gelöschte oder veränderte Planvarianten

Wird eine aktuell ausgewählte Vergleichsvariante gelöscht:

- keine Exception
- keine tote Planreferenz im UI-Zustand
- sinnvoller Fallback auf IST bzw. aktive Planvariante

Wird eine Planvariante umbenannt oder fachlich verändert:

- Vergleich aktualisiert sich live auf den aktuellen Planstand

---

# 15. Multi Depot

V0.19 wird auf dem nach V0.18 bestehenden Multi-Depot-Modell aufgebaut.

Für den freien Vergleich gilt:

- IST = gesamter physischer Bestand aller Depots
- jede Planvariante verwendet ihren eigenen planweiten Depotmodus
- `retain` kann weiterhin konkrete physische Holdings berücksichtigen
- `afterSales` berücksichtigt den Restbestand nach simulierten Verkäufen
- `none` berücksichtigt keinen Bestandsbestand in dieser Planvariante
- `compare` berücksichtigt den Bestand nur in der bisherigen planbezogenen IST-Logik, nicht im Planwert
- geplante Neukäufe bleiben planbezogen und depotunabhängig

Keine zusätzliche depotbezogene Vergleichsebene in V0.19.

---

# 16. Depotcheck bleibt fachlich getrennt

Der Depotcheck beantwortet weiterhin eine andere Frage:

> Wie sieht das tatsächlich vorhandene Depot heute und nach simulierten Verkäufen plus geplanten Käufen aus?

Deshalb bleibt der Depotcheck-Vergleich bei:

- IST Depotcheck
- PLAN Depotcheck

Kein freier Plan-A-gegen-Plan-C-Vergleich im Depotcheck für V0.19.

Der freie Planvergleich gehört zum Vermögenshaus der Gesamtplanung.

---

# 17. Ergebnisansicht

Die Ergebnisansicht bleibt fachlich auf den **ZIELPLAN** ausgerichtet.

Der freie Vergleich darf dort als Analysewerkzeug erreichbar sein, z. B. über:

**Planvarianten vergleichen**

Dadurch kann der Berater auch aus der Ergebnisansicht z. B.:

- IST ↔ Zielplan
- Plan A ↔ Plan C

betrachten.

Die Vergleichsauswahl verändert aber weder Zielplan noch aktive Variante.

Ergebnis = gewähltes Zielbild.

Vergleich = Analysewerkzeug.

---

# 18. Export

V0.19 soll die finale Exportlogik nicht unnötig erweitern.

Die temporäre freie Vergleichsauswahl wird nicht automatisch in den Kundenexport übernommen.

Grund:

- UI-Vergleich ist keine persistierte fachliche Entscheidung
- finale Exportkonsolidierung erfolgt später separat

Später kann geprüft werden, ob ein Berater einen konkreten Planvergleich bewusst in eine Kundenunterlage übernehmen kann.

---

# 19. Technische Leitplanken

Bevorzugt bestehende Vermögenshaus- und Asset-Breakdown-Helper wiederverwenden.

Keine zweite parallele Berechnungsengine für die fünf Anlageklassen bauen.

Vergleichsobjekt intern sinngemäß als klarer Union-/View-Typ abbilden, z. B.:

- IST
- konkrete `planId`

Keine Fachzustände nur aus sichtbaren Labels rekonstruieren.

Keine neue Dependency nur für dieses Paket.

---

# 20. Verbindliche Regressionstests

Mindestens folgende Fälle absichern:

1. Standard beim Öffnen = IST ↔ aktiver Plan.
2. Plan A ↔ Plan C funktioniert unabhängig von Aktiv-/Zielstatus.
3. Vergleich verändert `activePlanId` nicht.
4. Vergleich verändert `preferred` nicht.
5. Aktiv-Badge wird korrekt angezeigt.
6. Zielplan-Badge wird korrekt angezeigt.
7. Ein Plan kann gleichzeitig aktiv und Zielplan sein.
8. Unterschiedliche Gesamtvolumina werden korrekt dargestellt.
9. EUR-Differenzen je Anlageklasse sind korrekt.
10. Prozentpunkt-Differenzen je Anlageklasse sind korrekt.
11. Ungeklärte Beträge bleiben sichtbar.
12. Unterschiedliche Depotmodi zweier Varianten werden korrekt berücksichtigt.
13. Multi-Depot-Bestand aus V0.18 wird im IST aggregiert korrekt berücksichtigt.
14. Gelöschter ausgewählter Vergleichsplan erzeugt keinen Fehler und erhält einen sicheren Fallback.
15. Gleicher Plan gegen gleichen Plan ergibt exakt null Differenz.
16. Depotcheck-Vergleich bleibt fachlich unverändert.
17. Vergleichsauswahl wird nicht als fachlicher Zustand persistiert.
18. Persistenzschema bleibt gegenüber V0.18 unverändert.
19. Bestehende Multi-Depot-, 3B-, 4B- und Risk-V2-Regressionen bleiben grün.
20. Typecheck, Produktionsbuild und `git diff --check` bleiben grün.

---

# 21. Scope-Ausschlüsse

Nicht Teil von V0.19:

- Auszahlplan
- Dynamik für Spar- oder Auszahlpläne
- Ruhestandsplanung
- Vertiefungsframework
- neue Markt-/Zinsdaten
- neue Renditeannahmen
- Modellportfolio-Korrekturblock
- Depotcheck Ø YTM / Ø laufende Verzinsung
- Ergebnis-/Export-Endkonsolidierung
- neue Backend-/Datenbanklogik
- neue Depotfilter je Verwahrstelle
- Änderungen an Risiko V2
- Änderungen an Kapitaltopf-Fachlogik

---

# 22. Definition of Done

V0.19 ist fachlich erfüllt, wenn:

- beliebige konkrete Planvarianten frei miteinander verglichen werden können
- IST als eindeutige tatsächliche heutige Ausgangslage auswählbar ist
- EUR- und Gewichtungsunterschiede transparent nebeneinander stehen
- unterschiedliche Gesamtvolumina nicht zu irreführenden Aussagen führen
- Bestandsdepot-Modi je Plan korrekt im Vergleich wirken
- Multi Depot aus V0.18 ohne Sondermodell funktioniert
- keine Vergleichsauswahl den Beratungsfall verändert
- Depotcheck fachlich unverändert bleibt
- keine unnötige Persistenz / Schemaerhöhung eingeführt wird
- alle relevanten Regressionen grün sind

---

# 23. Einordnung

Geplante Reihenfolge:

1. V0.18.0 Multi Depot
2. kleiner Modellportfolio-/Depotcheck-Korrekturblock
3. **V0.19.0 Freier Planvergleich**
4. operativer Auszahlplan + jährliche prozentuale Dynamik
5. Vertiefungsframework
6. fachliche Vertiefungen inklusive Ruhestandsplanung
7. Ergebnis & Export konsolidieren
8. finaler Gesamt-UX-/Regressionsblock

V0.19 ist mit diesem Dokument fachlich **WORK-READY**. Vor der späteren Codex-Umsetzung muss lediglich der dann tatsächlich veröffentlichte V0.18-/Korrekturblock-Code technisch als Ausgangsstand geprüft werden. Es ist keine erneute Grundsatzkonzeption des freien Planvergleichs erforderlich.
