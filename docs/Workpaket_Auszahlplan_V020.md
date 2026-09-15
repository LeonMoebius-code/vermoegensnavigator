# Workpaket V0.20.0 – Auszahlplan & jährliche Dynamik

Repository: `LeonMoebius-code/vermoegensnavigator`

Status: 🟢 **BESCHLOSSEN / WORK-READY**

Zielversion nach V0.18 Multi Depot und V0.19 freiem Planvergleich: **V0.20.0**

Erwartetes Persistenzschema: **11**

Dieses Dokument beschreibt die fachlich verbindliche Zielkonzeption für den operativen Auszahlplan und die jährliche prozentuale Dynamik von Spar- und Auszahlplänen. Die spätere Ruhestandsplanung ist davon fachlich getrennt und darf keinen zweiten parallelen Auszahlplan speichern.

---

## 1. Grundprinzip

Ein Auszahlplan ist ein eigener operativer zukünftiger Cashflow und ausdrücklich **kein negativer Sparplan**.

Der Auszahlplan trennt zwei Fragen:

1. **Was soll ausgezahlt werden?**
2. **Aus welchen Wertpapierpositionen soll diese Auszahlung finanziert werden?**

Daraus folgt:

- der Auszahlplan besitzt einen Gesamtbetrag und einen Rhythmus
- die Entnahmequellen definieren nur die Finanzierung dieses Cashflows
- ein Auszahlplan kann eine oder mehrere Quellen besitzen
- das heutige PLAN-Vermögen wird durch zukünftige Auszahlungen nicht reduziert
- keine zukünftige Auszahlung wird als heutiger Verkauf oder heutiger Mittelabfluss gerechnet

---

## 2. Planvariantenspezifisch

Auszahlpläne gehören zu einer konkreten Strukturplan-Variante und nicht fallweit.

Grund:

- Plan A und Plan B können unterschiedliche spätere Entnahmestrategien besitzen
- geplante Neuanlagen sind über konkrete Allocation-IDs planvariantenspezifisch
- ein Wechsel des aktiven Plans verändert die anderen Planvarianten nicht
- im Ergebnis werden später die Auszahlpläne des ZIELPLANS gezeigt

Beim Duplizieren einer Planvariante:

- Auszahlpläne werden mit dupliziert
- Auszahlplan-IDs werden neu erzeugt
- Quellen-IDs werden neu erzeugt
- Holding-Referenzen auf physische Bestandspositionen bleiben bestehen
- Allocation-Referenzen werden auf die neuen Allocation-IDs der Kopie remappt

---

## 3. Mögliche Entnahmequellen

Ein Auszahlplan kann aus folgenden Quellen finanziert werden:

### 3.1 Bestehende physische Depotposition

Referenz auf die konkrete Holding-ID.

Nach Multi Depot bedeutet dies ausdrücklich:

- dieselbe WKN in Depot A und Depot B sind zwei verschiedene mögliche Entnahmequellen
- technische Identität immer über Holding-ID
- Depotname nur zur Anzeige

### 3.2 Geplante Neuanlage

Referenz auf die konkrete `allocationId` des betreffenden Strukturplans.

Nicht nur auf Produkt-ID oder Produktname verweisen.

Damit bleiben mehrfach vorkommende Produkte bzw. dasselbe Produkt in mehreren Kapitaltöpfen eindeutig.

---

## 4. Welche Bestandspositionen sind in einer Planvariante als Quelle zulässig?

Nur Bestandspositionen, die in dieser Planvariante im zukünftigen PLAN tatsächlich noch berücksichtigt werden.

| Depotmodus | Zulässige Bestandsquellen |
|---|---|
| Nicht berücksichtigen | keine |
| Nur im IST berücksichtigen | keine |
| Ausgewählte Positionen beibehalten | nur bewusst beibehaltene Positionen |
| Nach simulierten Verkäufen | alle Positionen mit Restwert > 0 |

Vollständig simuliert verkaufte Positionen dürfen nicht gleichzeitig als zukünftige Entnahmequelle derselben Planvariante verwendet werden.

Teilverkauf:

- Restbestand > 0 → Quelle bleibt grundsätzlich zulässig
- Restbestand = 0 → Quelle nicht mehr zulässig

---

## 5. Mehrere Quellen

Ein Auszahlplan darf aus mehreren Produkten bzw. Positionen bestehen.

V1 verwendet ausschließlich eine **prozentuale Quellenverteilung**.

Beispiel:

- Auszahlplan 2.000 €/Monat
- UniGlobal 50 %
- Rentenfonds 30 %
- Geldmarktfonds 20 %

Vorteile:

- funktioniert auch bei jährlicher Dynamik eindeutig
- keine zweite Dynamiklogik je Quelle notwendig
- ein Produkt ist einfach der Spezialfall 100 %

Keine festen EUR-Beträge je Quelle in V1.

Keine automatische Prioritäts-/Reihenfolgelogik in V1.

---

## 6. Quellenverteilung UX

Die Summe der aktiven Quellenanteile soll grundsätzlich 100 % ergeben.

### Neue Quelle

Wenn noch Restanteil offen ist, kann dieser als Vorbelegung verwendet werden.

Beispiel:

- Quelle A 60 %
- neue Quelle B → Vorbelegung 40 %

Sind bereits 100 % verteilt, wird beim Hinzufügen einer weiteren Quelle nichts automatisch umgewichtet.

Hinweis:

> Aktuell vollständig verteilt. Bitte bestehende Anteile anpassen.

Optionaler bewusster Komfortbutton:

**Gleichmäßig verteilen**

Nur nach aktivem Klick.

### Quelle entfernen

Wird eine Quelle entfernt, werden verbleibende Quellen **nicht automatisch** auf 100 % hochgerechnet.

Beispiel:

- A 60 %
- B 40 %
- B entfernt

Ergebnis:

- A 60 %
- noch 40 % zuzuordnen
- Status `Unvollständig`

Keine automatische neue Entnahmeentscheidung erfinden.

---

## 7. Kernfelder des Auszahlplans

Mindestens:

- ID
- Typ `withdrawal`
- Bezeichnung / Name
- Gesamtbetrag
- Rhythmus
- Startdatum
- Endlogik
- optional Enddatum
- optional Anzahl Auszahlungen
- optional jährliche prozentuale Dynamik
- Quellen
- optional Hinweis / Notiz

Rhythmen wie beim Sparplan:

- monatlich
- vierteljährlich
- halbjährlich
- jährlich

---

## 8. Endlogik

V1 unterstützt drei operative Endmodi:

### A – Fortlaufend

Kein Enddatum.

### B – Bis Enddatum

Beispiel: bis 31.12.2045.

### C – Anzahl Auszahlungen

Beispiel: 120 monatliche Zahlungen.

Nicht Teil des operativen Auszahlplans:

- `bis Kapital aufgebraucht`
- `wie lange reicht das Kapital?`

Diese Fragestellungen gehören in die spätere Ruhestandsplanung bzw. Projektionslogik mit Rendite- und Inflationsannahmen.

---

## 9. Jährliche Dynamik

Für Sparplan und Auszahlplan gilt dieselbe verbindliche Dynamik:

- optional
- standardmäßig AUS
- ausschließlich prozentual
- ausschließlich jährlich
- erste Erhöhung zwölf Monate nach Start
- danach jährlich
- keine feste EUR-Dynamik
- kein frei wählbarer Dynamikrhythmus

Beispiel:

- 1.000 €/Monat ab 01.07.2040
- 3 % Dynamik
- bis 30.06.2041: 1.000 €
- ab 01.07.2041: 1.030 €
- ab 01.07.2042: 1.060,90 €

Bei mehreren Quellen wirkt die Dynamik auf den Gesamtbetrag. Die Quellenanteile bleiben unverändert.

Beispiel bei 50/30/20:

Gesamtbetrag steigt von 2.000 € auf 2.040 €:

- 50 % → 1.020 €
- 30 % → 612 €
- 20 % → 408 €

---

## 10. Heutiges PLAN-Vermögen bleibt unverändert

Ein Auszahlplan ist ein zukünftiger Cashflow.

Beispiel:

- heutige Planallokation UniGlobal 100.000 €
- Auszahlplan 500 €/Monat ab 2035

Heutiges PLAN bleibt 100.000 €.

Zukünftige Entnahmen dürfen nicht vom heutigen Planungsvolumen, Vermögenshaus, Topfabdeckung oder strategischen Kapital abgezogen werden.

Dies entspricht der bestehenden Trennung des Sparplans vom heutigen Einmalvolumen.

---

## 11. Status des Auszahlplans

Der Status soll aus dem aktuellen Zustand abgeleitet und bevorzugt nicht redundant persistiert werden.

### Vollständig

- alle Quellenreferenzen gültig
- alle Quellen in der Planvariante verwendbar
- Summe Quellenanteile = 100 %

### Unvollständig

Beispiele:

- keine Quelle
- Quellenanteile < 100 %
- Quellenanteile > 100 %

### Anpassung erforderlich

Eine vormals gültige Quelle ist nicht mehr verfügbar oder in dieser Planvariante nicht mehr zulässig.

Beispiele:

- Holding aus Depot verschwunden
- Depot gelöscht
- Bestandsposition vollständig simuliert verkauft
- Allocation gelöscht
- strategische Allocation durch Modellportfolio-Ersetzen entfernt
- geplante Quelle am Starttermin noch nicht vorhanden

Der Auszahlplan selbst bleibt bestehen.

---

## 12. Wegfall einer Quelle

Wenn eine Quelle verschwindet:

- Auszahlplan nicht löschen
- verbleibende Quellen nicht automatisch umverteilen
- fehlenden Anteil nicht automatisch anderen Produkten zuweisen
- Auszahlplan auf `Anpassung erforderlich` setzen

Zur verständlichen Anzeige soll die Quelle einen kleinen Anzeigen-Snapshot behalten dürfen, z. B.:

- Produktname
- optional Depotname
- optional Kapitaltopf

Dieser Snapshot ist nur Anzeigehilfe.

Technische Identität bleibt ausschließlich Holding-ID bzw. Allocation-ID.

Beispiel:

Vorher:

- Allianz Altbestand 40 %
- UniGlobal 60 %

Allianz verschwindet.

Danach:

- `Allianz · Altbestand · nicht mehr verfügbar · 40 %`
- UniGlobal 60 %
- Status `Anpassung erforderlich`

---

## 13. CSV-Replacement / Multi-Depot-Reconciliation

Beim Ersetzen eines Depots muss die bestehende Multi-Depot-Reconciliation auch Auszahlplanquellen berücksichtigen.

Wenn Holding A im selben Depot eindeutig zu Holding C remappt wird:

- Auszahlplanquelle A → C

Niemals depotübergreifend auf eine Holding mit gleicher WKN remappen.

Beispiel:

- Depot 1 Allianz A
- Depot 2 Allianz B
- Depot 1 neu Allianz C

Ergebnis:

A → C

Niemals A → B.

Bei mehrdeutigem Match nicht raten.

---

## 14. Depot löschen

Wenn ein Depot gelöscht wird:

- physische Holdings werden wie in Multi Depot vorgesehen entfernt
- betroffene Auszahlplanquellen bleiben als nicht mehr verfügbare Quellen sichtbar
- Auszahlplan erhält `Anpassung erforderlich`
- keine automatische Verschiebung auf ein anderes Depot

Der Löschdialog soll perspektivisch vorab anzeigen können, ob Holdings dieses Depots in Auszahlplänen referenziert werden.

---

## 15. Simulierte Verkäufe

Wird eine bisher verwendete Holding später vollständig zum Verkauf markiert:

- Restwert = 0
- Quelle wird in dieser Planvariante unzulässig
- Auszahlplan → `Anpassung erforderlich`

Bei Restwert > 0 bleibt die Quelle grundsätzlich gültig.

Keine automatische Änderung des Quellenanteils.

---

## 16. Geplante Allokation wird verändert oder gelöscht

### Betrag geändert

Quelle bleibt gültig.

Plausibilitätsanzeigen aktualisieren sich.

### Allocation gelöscht

- Auszahlplan bleibt bestehen
- Quelle wird `nicht mehr verfügbar`
- Status `Anpassung erforderlich`

### Strategischer Plan wird durch Modellportfolio ersetzt

Wird eine referenzierte strategische Allocation entfernt:

- nicht automatisch auf ein neues Modellportfolio-Produkt umhängen
- Quelle wird ungültig
- Status `Anpassung erforderlich`

Keine heuristische Anlageentscheidung.

---

## 17. Gestaffelte Einstiege als Quelle

Eine geplante Allocation mit PhasedEntryPlan kann grundsätzlich Entnahmequelle sein.

Plausibilisierung:

- Auszahlplan startet vor Abschluss des Einstiegs → neutraler Hinweis
- Auszahlplan startet vor der ersten tatsächlich geplanten Investition und es existiert zu diesem Zeitpunkt kein sofort investierter Anteil → `Anpassung erforderlich`

Keine harte Sperre für lediglich teilweise noch laufende Staffelung.

Bestehende 4B-Helfer zu erster/letzter Rate und robusten Datumsberechnungen wiederverwenden.

---

## 18. Plausibilitätsanzeige ohne Renditeprojektion

Der operative Auszahlplan soll keine Scheingenauigkeit erzeugen.

Zulässig:

- aktueller bzw. geplanter Quellenwert
- anfängliche Jahresauszahlung
- anfängliche Belastung je Quelle
- Warnung, wenn die anfängliche Jahresauszahlung den heutigen bzw. geplanten Quellenwert stark übersteigt

Nicht zulässig im operativen Plan:

- `Kapital reicht X Jahre`
- Renditeprojektion
- Inflationsprojektion
- automatische Kapitalverzehrsprognose

Diese Berechnungen gehören in die spätere Ruhestandsplanung.

---

## 19. Endliche Auszahlpläne

Bei `Bis Enddatum` oder `Anzahl Auszahlungen` kann rein nominal die Summe der geplanten Zahlungen berechnet werden.

Diese Kennzahl ist keine Kapitalprojektion.

Sichtbar beispielsweise:

**Geplante nominale Auszahlungen über die Laufzeit: X €**

Bei fortlaufendem Auszahlplan keine künstliche Gesamtsumme anzeigen.

Stattdessen beispielsweise:

**Anfängliche Jahresauszahlung: X €**

---

## 20. Verbindung zur Ruhestandsplanung

Verbindliche Trennung:

- Ruhestandsplanung = fachliche Vertiefung / Rechenlogik
- Auszahlplan = operativer Plan

Die Ruhestandsplanung darf später berechnen:

- erforderliche Vermögensentnahme
- Startdatum
- Rhythmus
- optionale jährliche Dynamik

Aktion:

**Als Auszahlplan übernehmen**

Übernommen werden dürfen z. B.:

- Betrag
- Rhythmus
- Startdatum
- Dynamik

Nicht automatisch übernommen:

- Entnahmequellen

Nach Übernahme entscheidet der Berater bewusst, aus welchen Bestands- oder Planpositionen die Auszahlung finanziert wird.

---

## 21. Verbindung zum freien Planvergleich

Auszahlpläne verändern nicht die Vermögenshaus-Werte eines Planvergleichs.

Sie sind zukünftige Cashflows.

Eine spätere Vergleichserweiterung kann informativ zeigen:

- Plan A: X €/Monat Auszahlplan
- Plan B: Y €/Monat Auszahlplan

Dies ist nicht zwingender Bestandteil der ersten V0.20-Umsetzung.

---

## 22. Datenmodell – Zielrichtung

Sinngemäß:

```ts
type WithdrawalPlan = {
  id: string;
  type: "withdrawal";
  name?: string;
  amount: number;
  frequency: SavingsFrequency;
  startDate: string;
  endMode: "ongoing" | "endDate" | "paymentCount";
  endDate?: string;
  paymentCount?: number;
  annualDynamicsPercent?: number;
  sources: WithdrawalSource[];
  note?: string;
};
```

Quellen sinngemäß als Union:

```ts
type WithdrawalSource =
  | {
      id: string;
      kind: "holding";
      holdingId: string;
      sharePercent: number;
      displaySnapshot?: {...};
    }
  | {
      id: string;
      kind: "allocation";
      allocationId: string;
      sharePercent: number;
      displaySnapshot?: {...};
    };
```

Keine redundante `productId` als technische Identität speichern, wenn sie aus Holding bzw. Allocation ableitbar ist.

---

## 23. Schema / Migration

Erwartete Zielrichtung:

- V0.18 Multi Depot → Schema 10
- V0.19 Planvergleich → weiterhin Schema 10
- V0.20 Auszahlplan + Dynamik → Schema 11

Migration:

- bestehende Sparpläne erhalten keine Dynamik, wenn bisher keine vorhanden ist
- bestehende Pläne erhalten keine künstlichen Auszahlpläne
- keine alte fachliche Entscheidung erfinden
- historische Snapshots weiterhin erst bei Wiederherstellung normalisieren

---

## 24. Regressionstestfälle

Mindestens folgende Fälle absichern:

1. Ein Auszahlplan mit einer Quelle 100 %.
2. Mehrere Quellen summieren sich korrekt auf 100 %.
3. Entfernen einer Quelle führt nicht zur automatischen Umverteilung.
4. Unvollständige Quellenverteilung erzeugt Status `Unvollständig`.
5. Bestandsquelle nur zulässig, wenn sie im PLAN der Variante verbleibt.
6. Vollständig simuliert verkaufte Holding macht Quelle ungültig.
7. Teilverkauf mit Restwert > 0 lässt Quelle gültig.
8. Multi Depot: gleiche WKN in zwei Depots bleibt als zwei physische Quellen getrennt.
9. CSV-Replacement remappt Quelle nur innerhalb desselben Depots.
10. Depotlöschung lässt Auszahlplan bestehen und markiert Quelle ungültig.
11. Allocation-Quelle bleibt bei Betragsänderung gültig.
12. Gelöschte Allocation macht Quelle ungültig, löscht Auszahlplan aber nicht.
13. Modellportfolio-Ersetzen remappt nicht automatisch auf andere Produkte.
14. Plan duplizieren erzeugt neue Auszahlplan-/Quellen-IDs und remappt Allocation-IDs.
15. Aktiven Plan wechseln verändert andere Auszahlpläne nicht.
16. ZIELPLAN zeigt später die zugehörigen Auszahlpläne, ohne andere Planvarianten zu verändern.
17. Dynamik erste Erhöhung exakt zwölf Monate nach Start.
18. Dynamik funktioniert bei monatlich, vierteljährlich, halbjährlich und jährlich.
19. Prozentuale Quellenanteile bleiben bei Dynamik konstant.
20. Enddatum beendet Zahlungen korrekt.
21. Zahlungscount beendet Zahlungen korrekt.
22. Fortlaufend erzeugt keine künstliche Gesamtsumme.
23. Endlicher Plan berechnet nominale Gesamtauszahlungen korrekt.
24. Auszahlplan reduziert heutiges PLAN-Vermögen nicht.
25. Auszahlplan verändert Vermögenshaus, Topfabdeckung und strategisches Kapital nicht.
26. Sparplan-Dynamik folgt derselben jährlichen Prozentlogik.
27. PhasedEntry-Quelle vor erster tatsächlicher Investition erzeugt Anpassungsbedarf.
28. PhasedEntry-Quelle während laufender Staffelung erzeugt nur den vorgesehenen Plausibilitätshinweis.
29. Keine automatische Rendite-/Reichweitenberechnung im operativen Plan.
30. Bestehende 3B-, 4B-, Risk-V2-, Multi-Depot- und Planvergleich-Regressionen bleiben grün.

---

## 25. Nicht Teil von V0.20

Nicht in dieses Paket hineinziehen:

- vollständige Ruhestandsplanung
- Rendite- oder Inflationsprojektion des Auszahlplans
- Kapitalverzehrsrechner
- `bis Kapital aufgebraucht`
- Monte-Carlo-Simulation
- Steuerberechnung
- feste EUR-Quellenbeträge
- automatische Prioritäts-/Verkaufsreihenfolge
- automatische Rebalancing- oder Verkaufsempfehlungen
- Zieldepot / Orderrouting
- freie externe Depot-/Produktquellen außerhalb des bestehenden Fallmodells

---

## 26. Fachlicher Kernsatz

> Ein Auszahlplan beschreibt den gewünschten zukünftigen Cashflow. Die zugeordneten Wertpapierpositionen beschreiben ausschließlich dessen Finanzierung. Fällt eine Quelle weg, bleibt der Cashflow bestehen und muss bewusst neu zugeordnet werden.
