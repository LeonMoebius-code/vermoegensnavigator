# Work-Paket Risiko V2 – Fachkonzept und technisches Preflight

> Finaler fachlicher und technischer Sollstand für die Neugestaltung der Risiko-Orientierung.
>
> Stand: 07.09.2026  
> Status: **BESCHLOSSEN / WORK-READY**  
> Ausgangsbasis der Analyse: aktueller `main` V0.14 plus Dokumentations-Preflights  
> Umsetzung erst gegen den dann aktuellen `main` nach 4A.1, 4B und Depotcheck 3B kurz gegenprüfen  
> Empfohlener Arbeitsbranch: `work/risiko-v2`

---

# 1. Ziel

Risiko V2 ersetzt die heutige vereinfachte Durchschnittslogik durch eine transparente, visuell unterstützte und fachlich getrennte Orientierung.

Der bestehende V0.14-Ansatz mittelt aktuell Verlustreaktion, akzeptierte temporäre Wertminderung, finanzielle Tragfähigkeit, Anlagehorizont und Kenntnisse/Erfahrung. Diese Vermischung wird beendet.

Risiko V2 trennt verbindlich:

1. **Risikowille**
2. **Verlusttragfähigkeit**
3. **Anlagehorizont**
4. **Kenntnisse & Erfahrung**
5. **final verwendete Risikostufe**

Nur Risikowille und Verlusttragfähigkeit bestimmen die orientierend ermittelte Risikostufe.

Anlagehorizont und Kenntnisse/Erfahrung bleiben eigenständige Prüfgrößen.

---

# 2. Fünf verbindliche Risikostufen

Die sichtbaren Bezeichnungen lauten künftig überall konsistent:

1. **Konservativ**
2. **Risikoscheu**
3. **Risikobereit**
4. **Spekulativ**
5. **Hoch spekulativ**

## 2.1 Konservativ

Kernaussagen:

- Substanzerhaltung, hohe Sicherheits- und Liquiditätsbedürfnisse mit nur geringer Renditeerwartung
- Stabilität und kontinuierliche Entwicklung der Anlage gewünscht
- Toleranz gegenüber geringen Kurs- und Wertschwankungen

## 2.2 Risikoscheu

Kernaussagen:

- Sicherheitsbedürfnisse überwiegen Liquiditätsbedarf und Renditeerwartung
- höhere Rendite als bei konservativer Risikobereitschaft gewünscht
- Toleranz gegenüber geringen bis mäßigen Kurs- und Wertschwankungen

## 2.3 Risikobereit

Kernaussagen:

- Sicherheit und Liquidität werden einer höheren Renditeerwartung untergeordnet
- langfristig rendite- und kursgewinnorientiert
- Toleranz gegenüber mäßigen bis teilweise starken Kurs- bzw. Wertschwankungen und gegebenenfalls Kapitalverlusten

## 2.4 Spekulativ

Kernaussagen:

- Streben nach hohen Renditechancen überwiegt Sicherheits- und Liquiditätsaspekte
- Inkaufnahme erheblicher Kurs- bzw. Wertschwankungen und Kapitalverluste

## 2.5 Hoch spekulativ

Kernaussagen:

- Nutzung höchster Renditechancen bei hohem Risiko
- sehr hohe Schwankungen und erhebliche Kapitalverluste werden in Kauf genommen
- bei entsprechenden spekulativen Produkten kann auch ein Totalverlust möglich sein

Die Formulierungen orientieren sich an den vom Nutzer bereitgestellten Referenz-Screenshots. Sie sind als verständliche Profilbeschreibung zu verwenden, nicht als Renditeversprechen.

---

# 3. Illustrative Plus-/Minus-Bandbreiten

## 3.1 Zweck

Jede der fünf Risikostufen erhält eine gut sichtbare horizontale Plus-/Minus-Visualisierung.

Sie dient ausschließlich der didaktischen Veranschaulichung unterschiedlicher Schwankungsniveaus.

Verbindlich:

- positive Beispielseite ist bei jeder Stufe größer als die negative Beispielseite
- keine Prognose
- keine Wahrscheinlichkeit
- kein erwarteter Jahresertrag
- keine Aussage über maximale Verluste
- klarer Hinweis auf illustrative Beispielwerte

## 3.2 Final festgelegte Beispielspannen

| Stufe | Negativ | Positiv | Beispiel bei 1.000 EUR |
|---|---:|---:|---|
| Konservativ | -3 % | +7 % | -30 EUR / +70 EUR |
| Risikoscheu | -7 % | +12 % | -70 EUR / +120 EUR |
| Risikobereit | -12 % | +20 % | -120 EUR / +200 EUR |
| Spekulativ | -18 % | +28 % | -180 EUR / +280 EUR |
| Hoch spekulativ | -35 % | +55 % | -350 EUR / +550 EUR |

Diese Werte sind bewusst illustrative didaktische Spannen. Sie sind keine aus Marktdaten abgeleiteten Volatilitäts- oder VaR-Werte.

Für **Hoch spekulativ** zusätzlich sichtbar:

> Die illustrative Schwankungsspanne zeigt keinen Maximalverlust. Bei einzelnen spekulativen Produkten kann ein Verlust bis hin zum Totalverlust möglich sein.

## 3.3 Darstellung

Bevorzugte Darstellung pro Stufe:

- Null-Linie in der Mitte
- roter Balken nach links
- grüner Balken nach rechts
- Prozentwert an beiden Enden
- optional zusätzlich EUR-Beispiel auf Basis von 1.000 EUR

Die Balkenlängen sollen proportional zur jeweiligen Beispielspanne sein. Keine optische Gleichsetzung von -3 % und +7 %.

---

# 4. Direkte Auswahl und Ermittlung stehen gleichberechtigt nebeneinander

Im Ausgangszustand des Risiko-Bereichs sind sofort sichtbar:

- fünf direkt anklickbare Risikostufen
- ein zusätzlicher Button **`Risikoorientierung ermitteln`**

Es gibt **keinen vorgeschalteten Button `Manuell festlegen`**.

## 4.1 Direkte Auswahl

Ein Klick auf eine der fünf Risikostufen:

- speichert die gewählte Stufe **sofort**
- benötigt keinen Zwischenklick auf `Weiter`, `Übernehmen` oder `Speichern`
- markiert die Stufe sichtbar
- setzt die Quelle der final verwendeten Risikostufe auf `manual`

## 4.2 Ermittlung

`Risikoorientierung ermitteln` öffnet die geführte V2-Strecke.

Die Ermittlung ist Orientierung und Plausibilisierung, kein Zwangssystem.

Wenn bereits eine direkte manuelle Auswahl existiert, überschreibt die Ermittlung diese nicht automatisch.

Wenn noch keine bewusste manuelle/Legacy-Auswahl besteht, darf das vollständig ermittelte Ergebnis als verwendete Risikostufe übernommen werden.

---

# 5. Geführte Ermittlung – Aufbau

Die geführte Strecke besteht aus vier fachlichen Abschnitten plus Ergebnis.

1. Magisches Dreieck
2. Szenarioauswahl
3. ergänzende Fragen zum Risikowillen
4. Verlusttragfähigkeit
5. transparentes Ergebnis

Die Strecke soll kompakt bleiben. Keine neunseitige Formularstrecke nachbauen. Desktop-Modal oder fokussierte Overlay-Strecke ist weiterhin geeignet.

---

# 6. Magisches Dreieck

## 6.1 Funktion

Das magische Dreieck ist:

- visueller Einstieg
- Gesprächsanker
- **echter Input in die Ermittlung des Risikowillens**

Ecken:

- **Sicherheit**
- **Liquidität / Verfügbarkeit**
- **Renditechance**

Die gesamte Dreiecksfläche ist anklickbar:

- Ecken
- Kanten
- Zwischenräume
- Mitte

Der gewählte Punkt wird sichtbar markiert.

## 6.2 Technische Auswertung

Die Klickposition wird als baryzentrische Gewichtung der drei Ecken interpretiert:

- `S` = Gewicht Sicherheit
- `L` = Gewicht Liquidität
- `R` = Gewicht Renditechance
- `S + L + R = 1`

Die drei Eckwerte erhalten folgende Risikotendenz:

- Sicherheit = 1
- Liquidität = 2
- Renditechance = 5

Kontinuierlicher Dreiecksscore:

`triangleScore = 1*S + 2*L + 5*R`

Score auf 1 bis 5 begrenzen.

Intern darf der Wert mit Dezimalstellen weiterverarbeitet werden. Sichtbar wird nur eine verständliche Tendenz angezeigt.

Beispiele:

- Sicherheitsecke = 1,0
- Liquiditätsecke = 2,0
- Renditeecke = 5,0
- geometrische Mitte = ca. 2,7 und damit Tendenz Risikobereit

Das Dreieck bestimmt den Risikowillen nicht allein.

---

# 7. Szenarioauswahl

## 7.1 Vier Szenarien

Die vom Nutzer bereitgestellten Referenzformulierungen bilden die Grundlage.

### Szenario A – Score 1

> Ich möchte nur geringe Verluste akzeptieren und nehme dafür auch eine eher geringe Rendite in Kauf.

### Szenario B – Score 2

> Ich bin bereit, mäßige Verluste zu akzeptieren, um mein Vermögen langfristig moderat, aber stetig wachsen zu lassen.

### Szenario C – Score 3

> Vermögenswachstum ist mir zum Aufbau meines Vermögens wichtig, daher nehme ich auch höhere Schwankungen und mögliche Kapitalverluste in Kauf.

### Szenario D – Score 4

> Meine Renditeziele stehen klar im Vordergrund meiner Anlage, daher nehme ich auch erhebliche Schwankungen und mögliche Kapitalverluste in Kauf.

Es gibt bewusst kein fünftes Szenario. Die Stufe **Hoch spekulativ** soll nur entstehen, wenn auch die weiteren Antworten sehr hohe Risikobereitschaft zeigen.

## 7.2 Visualisierung

Bei Auswahl eines Szenarios wird rechts bzw. im zugehörigen Visualisierungsbereich die passende illustrative Plus-/Minus-Darstellung gezeigt.

Die Darstellung bleibt fiktiv/illustrativ und wird entsprechend beschriftet.

---

# 8. Ergänzende Fragen zum Risikowillen

Drei Fragen. Jede Antwort ergibt einen Score 1 bis 5.

## 8.1 Verlustreaktion

**Wie würden Sie bei einem deutlichen zwischenzeitlichen Verlust reagieren?**

1. Sofort verkaufen
2. Risiko deutlich reduzieren
3. Zunächst abwarten
4. Strategie beibehalten
5. Nachkauf bewusst prüfen

## 8.2 Akzeptierte vorübergehende Wertminderung

**Welche vorübergehende Wertminderung erscheint Ihnen noch tragbar?**

1. bis etwa 5 %
2. bis etwa 10 %
3. bis etwa 20 %
4. bis etwa 35 %
5. mehr als 35 %; bei spekulativen Anlagen ist auch ein sehr hoher Verlust bewusst

Die Frage beschreibt subjektive Verlustbereitschaft und ist **nicht** die finanzielle Verlusttragfähigkeit.

## 8.3 Chance-/Risiko-Priorität

**Welche Aussage beschreibt Ihr Anlageziel am besten?**

1. Substanzerhaltung und möglichst geringe Schwankungen stehen klar im Vordergrund
2. höhere Rendite als bei konservativer Anlage ist erwünscht, Schwankungen sollen aber begrenzt bleiben
3. Renditechancen und Schwankungen stehen in einem ausgewogenen Verhältnis
4. höhere Renditechancen sind wichtiger als geringe Schwankungen
5. höchste Renditechancen stehen im Vordergrund; sehr hohe Schwankungen und erhebliche Verluste werden bewusst akzeptiert

## 8.4 Behavioral Score

`behaviorScore = Durchschnitt aus Verlustreaktion, Wertminderung und Chance-/Risiko-Priorität`

Intern mit Dezimalstellen weiterrechnen.

---

# 9. Finale Berechnung des Risikowillens

Die drei Blöcke werden bewusst nicht alle einzeln gleich gewichtet. Das visuelle Dreieck und das Szenario sollen relevant sein, aber nicht die drei direkten Risikofragen dominieren.

Verbindliche Gewichtung:

- Magisches Dreieck: **25 %**
- Szenarioauswahl: **25 %**
- Behavioral Score aus drei Fragen: **50 %**

Formel:

`riskWillingnessRaw = 0.25*triangleScore + 0.25*scenarioScore + 0.50*behaviorScore`

Dann:

`riskWillingness = round(riskWillingnessRaw)`

auf 1 bis 5 begrenzen.

Damit entsteht genau eine der fünf Risikostufen.

## 9.1 Konsistenzhinweis

Zusätzlich werden die drei Blockwerte betrachtet:

- Dreieck
- Szenario
- Behavioral Score

Wenn der höchste und niedrigste Blockwert um mindestens **2,0 Punkte** auseinanderliegen, wird ein neutraler Hinweis gezeigt:

> Ihre Angaben zur Risikobereitschaft sind nicht vollständig einheitlich. Das Ergebnis ist eine Orientierung; die Einzelangaben bleiben sichtbar.

Dieser Hinweis verändert den Score nicht.

---

# 10. Verlusttragfähigkeit

Verlusttragfähigkeit wird ausdrücklich **nicht** in denselben Durchschnitt wie der Risikowille gegeben.

Sie ist eine eigenständige finanzielle Begrenzung.

## 10.1 Frage A – Auswirkung auf Ziele

**Welche Auswirkungen hätte ein deutlicher Verlust auf geplante Ausgaben, finanzielle Ziele oder notwendige Investitionen?**

1. Ziele / notwendige Ausgaben wären unmittelbar gefährdet
2. deutliche Einschränkungen wären erforderlich
3. einzelne Ziele müssten angepasst werden
4. kaum Einschränkungen
5. keine wesentlichen Einschränkungen

## 10.2 Frage B – Abhängigkeit vom Anlagekapital

Privat sinngemäß:

**In welchem Umfang sind Sie auf dieses Kapital für laufende Lebensführung oder bereits absehbare Vorhaben angewiesen?**

Betrieblich sinngemäß:

**In welchem Umfang ist das Unternehmen auf dieses Kapital für laufende Liquidität, Investitionen oder den Geschäftsbetrieb angewiesen?**

Antworten:

1. sehr stark
2. deutlich
3. teilweise
4. gering
5. praktisch nicht

Die Skala wird technisch so gespeichert, dass 5 die höchste Tragfähigkeit bedeutet.

## 10.3 Frage C – Ausgleichsmöglichkeiten

Privat sinngemäß:

**Könnte ein vorübergehender deutlicher Verlust aus anderen verfügbaren Mitteln aufgefangen werden?**

Betrieblich sinngemäß:

**Könnte ein vorübergehender deutlicher Verlust aus anderer verfügbarer Liquidität oder finanziellen Reserven aufgefangen werden?**

Antworten:

1. nein
2. nur sehr eingeschränkt
3. teilweise
4. weitgehend
5. problemlos

## 10.4 Berechnung

Verbindliche konservative Weakest-Link-Logik:

`lossCapacity = min(goalImpact, capitalDependence, lossBuffer)`

Keine Mittelung.

Begründung:

Die Verlusttragfähigkeit soll nicht durch starke Antworten in anderen Teilbereichen künstlich hochgerechnet werden, wenn ein einzelner finanzieller Engpass die Tragbarkeit tatsächlich begrenzt.

Im Ergebnis wird der begrenzende Faktor sichtbar benannt.

---

# 11. Orientierend ermittelte Risikostufe

Verbindliche Formel:

`recommendedRisk = min(riskWillingness, lossCapacity)`

Die Verlusttragfähigkeit ist damit eine harte Obergrenze der **automatischen Orientierung**.

Es gibt keine Mittelung zwischen Risikowille und Verlusttragfähigkeit.

## 11.1 Konfliktanzeige

Wenn `riskWillingness <= lossCapacity`:

- kein Konflikt
- Verlusttragfähigkeit begrenzt den Risikowunsch nicht

Wenn `riskWillingness = lossCapacity + 1`:

- normaler sichtbarer Hinweis
- Text sinngemäß: `Die finanzielle Verlusttragfähigkeit begrenzt den ermittelten Risikowunsch.`

Wenn `riskWillingness >= lossCapacity + 2`:

- deutlicher Warnhinweis
- Text sinngemäß: `Risikowunsch und finanzielle Verlusttragfähigkeit weichen deutlich voneinander ab.`

---

# 12. Direkte Auswahl vs. ermittelte Orientierung

Das Ergebnis ist bewusst mehrteilig.

Anzuzeigen sind, soweit vorhanden:

- **Gewählte Risikoorientierung**
- **Risikowille**
- **Verlusttragfähigkeit**
- **Ermittelter Orientierungsrahmen**

## 12.1 Direkte Auswahl existiert bereits

Wenn der Nutzer vor oder nach der Ermittlung eine Risikostufe direkt gewählt hat:

- direkte Auswahl bleibt die für den Fall verwendete Risikostufe
- Ermittlung überschreibt sie nicht
- keine Begründungspflicht
- **kein Begründungsfeld**
- Abweichung wird nur transparent angezeigt

Beispiel:

> Gewählt: Spekulativ  
> Risikowille: Spekulativ  
> Verlusttragfähigkeit: Risikobereit  
> Ermittelter Orientierungsrahmen: Risikobereit

Hinweis:

> Die direkt gewählte Risikoorientierung liegt über der ermittelten Orientierung.

Wenn die direkt gewählte Stufe sogar über der Verlusttragfähigkeit liegt, soll der Hinweis dies ausdrücklich benennen.

## 12.2 Keine bewusste Auswahl vorhanden

Wenn ein neuer Fall noch keine bewusste manuelle Auswahl besitzt und die V2-Ermittlung vollständig abgeschlossen wird:

- `recommendedRisk` wird als verwendete Risikostufe gespeichert
- Quelle wird `assessment`

Der Nutzer kann danach jederzeit direkt eine andere der fünf Stufen anklicken. Diese Änderung gilt sofort und setzt die Quelle auf `manual`.

---

# 13. Anlagehorizont – ausdrücklich aus dem Risikoscore entfernen

Der allgemeine `horizon` bleibt als Kunden-/Fallinformation bestehen, wird aber **nicht mehr** in Risikowille, Verlusttragfähigkeit oder `recommendedRisk` eingerechnet.

Die fachliche Zeitprüfung erfolgt primär dort, wo sie hingehört:

> **Produkt × konkreter Kapitaltopf**

Beispiel:

- Kunde hat finale Risikostufe 4
- Produkt-RK passt
- Kapitaltopf 2029 hat aber zu kurzen Horizont für einen Aktienfonds

Ergebnis:

- Risiko kann passen
- Horizont ist trotzdem ein eigener Konflikt

Die Risikostufe des gesamten Kunden wird dadurch nicht künstlich abgesenkt.

---

# 14. Kenntnisse & Erfahrung – ausdrücklich aus dem Risikoscore entfernen

`experience` bleibt bestehen, wird aber nicht mehr in die Risikoorientierung eingerechnet.

Grundsatz:

- geringe Erfahrung bedeutet nicht automatisch geringe Risikobereitschaft
- hohe Erfahrung bedeutet nicht automatisch hohe Verlusttragfähigkeit

Kenntnisse & Erfahrung werden separat als Produkt-/Beratungsprüfung verwendet bzw. angezeigt.

Risiko V2 soll in diesem Paket keine umfangreiche neue regulatorische Produktkenntnis-Matrix erfinden.

---

# 15. Ziel-UX

## 15.1 Ausgangskarte

Direkt sichtbar:

- fünf Profilkarten nebeneinander
- aktuelle Auswahl klar markiert
- jede Karte zeigt Name + sehr kurzen Profiltext + kleine Plus-/Minus-Visualisierung
- Button `Risikoorientierung ermitteln`

Kein `Manuell festlegen`-Button.

## 15.2 Ermittlungsstrecke

Empfohlene Reihenfolge:

### Schritt 1 – Präferenz
Magisches Dreieck

### Schritt 2 – Zielbild
Vier Szenario-Karten mit unmittelbar wechselnder Plus-/Minus-Visualisierung

### Schritt 3 – Risikowille
Drei kompakte Fragen

### Schritt 4 – Verlusttragfähigkeit
Drei kompakte Fragen, private/betriebliche Formulierung je Scope

### Schritt 5 – Ergebnis
Mehrteilige Ergebnisdarstellung

Die Strecke darf einen Fortschrittsindikator verwenden.

## 15.3 Ergebnisdarstellung

Beispiel:

**Gewählte Risikoorientierung**  
Spekulativ · 4/5

**Risikowille**  
Spekulativ · 4/5

**Verlusttragfähigkeit**  
Risikobereit · 3/5

**Ermittelter Orientierungsrahmen**  
Risikobereit · 3/5

Darunter Hinweise zu Konflikten.

Separat:

**Anlagehorizont**  
Wird je Kapitaltopf geprüft

**Kenntnisse & Erfahrung**  
z. B. Erweiterte Kenntnisse

---

# 16. Datenmodell – technische Zielrichtung

## 16.1 Bestehender Stand

Aktuell enthält `AdvisoryData`:

- `risk: RiskLevel`
- `riskAssessment` mit `lossReaction`, `temporaryLoss`, `financialCapacity`
- `horizon`
- `experience`

Die heutige Funktion `riskOrientation(...)` in `app/page.tsx` mittelt diese Dimensionen.

## 16.2 Empfohlene neue V2-Struktur

Sinngemäß:

```ts
export type RiskSelectionSource = "default" | "manual" | "assessment" | "legacy";

export type RiskAssessmentV2 = {
  triangle?: {
    security: number;
    liquidity: number;
    returnChance: number;
    score: number;
  };
  scenario: "A" | "B" | "C" | "D" | null;
  willingness: {
    lossReaction: RiskLevel | null;
    temporaryLoss: RiskLevel | null;
    riskReturnPriority: RiskLevel | null;
  };
  capacity: {
    goalImpact: RiskLevel | null;
    capitalDependence: RiskLevel | null;
    lossBuffer: RiskLevel | null;
  };
  riskWillingness?: RiskLevel;
  lossCapacity?: RiskLevel;
  recommendedRisk?: RiskLevel;
  completedAt?: string;
};
```

Zusätzlich in `AdvisoryData` sinngemäß:

```ts
risk: RiskLevel;
riskSelectionSource: RiskSelectionSource;
riskAssessmentV2: RiskAssessmentV2;
```

Die genaue Feldbenennung kann Work technisch sauber wählen, sofern die Semantik exakt erhalten bleibt.

## 16.3 Alte `riskAssessment`-Struktur

Nicht blind löschen, solange Altfallmigration erforderlich ist.

Migration:

- bestehendes `lossReaction` kann in die entsprechende V2-Frage übernommen werden
- bestehendes `temporaryLoss` kann in die entsprechende V2-Frage übernommen werden
- bestehendes `financialCapacity` kann als Ausgangswert für `goalImpact` übernommen werden, weil die heutige Frage inhaltlich bereits die Auswirkung eines Verlusts auf geplante Ausgaben adressiert
- Triangle, Szenario, `capitalDependence`, `lossBuffer`, `riskReturnPriority` bleiben bei Altbeständen offen
- V2 gilt deshalb nach Migration nicht automatisch als vollständig
- bestehende `risk`-Stufe wird erhalten
- Quelle alter Fälle auf `legacy`

Keine alte gespeicherte Risikostufe durch Migration ungefragt ändern.

## 16.4 Schema-Version

Risiko V2 verändert das gespeicherte Fallmodell und benötigt daher einen Schema-Bump.

Da 4A.1 und 4B vorher umgesetzt werden können und ihrerseits das Schema verändern können, im späteren Work-Lauf **nicht heute hart auf eine Versionsnummer festlegen**.

Regel:

> Gegen aktuellen `main` die dann nächste Schema-Version verwenden.

---

# 17. Reine Berechnungshelper

Die Berechnung sollte aus `page.tsx` herausgezogen und testbar gemacht werden.

Bevorzugt z. B. neue Datei:

`app/risk-orientation.ts`

Mögliche reine Funktionen:

- `triangleRiskScore(...)`
- `behaviorRiskScore(...)`
- `riskWillingnessScore(...)`
- `lossCapacityScore(...)`
- `recommendedRiskScore(...)`
- `riskConflictLevel(...)`
- `riskLevelLabel(...)`
- `riskIllustrationBand(...)`

Keine Berechnungslogik ausschließlich in JSX verstecken.

---

# 18. Produktprüfung nach Risiko V2

Die finale **verwendete** Risikostufe bleibt `advisory.risk` bzw. deren Nachfolger und ist weiterhin Grundlage der sichtbaren Produkt-Risikoprüfung.

Prüfgrößen werden fachlich getrennt:

1. **Risiko** – Produkt-RK vs. finale verwendete Risikostufe
2. **Horizont** – Produkt-Mindesthorizont vs. konkreter Kapitaltopf
3. **Kenntnisse & Erfahrung** – separat
4. **Kapitaltopf-Zuordnung** – separat

Kein gemeinsamer undurchsichtiger `passt / passt nicht`-Gesamtscore.

---

# 19. Scope Privat / Betrieblich

Die Rechenlogik bleibt gleich.

Nur die Formulierung der Tragfähigkeitsfragen wird kontextgerecht angepasst.

Privat:

- Lebensführung
- private Ziele
- geplante Ausgaben
- andere verfügbare Mittel

Betrieblich:

- Geschäftsbetrieb
- operative Liquidität
- notwendige Investitionen
- andere Unternehmensliquidität / finanzielle Reserven

Bei `combined` darf die UI passend zum betrachteten Vermögenskontext formulieren. Wenn technisch noch kein eindeutiger Teilkontext vorliegt, neutrale Formulierung verwenden.

---

# 20. Validierung und unvollständige Ermittlung

Ein `recommendedRisk` darf nur erzeugt werden, wenn vollständig vorhanden sind:

- gültiger Dreieckspunkt
- ein Szenario
- alle drei Risikowille-Fragen
- alle drei Verlusttragfähigkeitsfragen

Bei unvollständiger Ermittlung:

- Einzelantworten dürfen gespeichert bleiben
- kein neuer automatischer Orientierungsrahmen behaupten
- bestehende direkte/Legacy-Risikostufe bleibt unverändert

---

# 21. Regressionstest-Matrix

## A. Direkte Auswahl

- neuen Fall öffnen
- `Spekulativ` anklicken

Erwartung:

- Risk-Level 4 sofort gespeichert
- sichtbare Auswahl sofort geändert
- kein zusätzlicher Speichern-/Weiter-Klick
- Quelle `manual`

## B. Dreieck – Sicherheitsecke

Erwartung:

- Dreiecksscore ca. 1

## C. Dreieck – Renditeecke

Erwartung:

- Dreiecksscore ca. 5

## D. Dreieck – Mitte

Erwartung:

- Score ca. 2,7
- keine harte Eckenzuordnung

## E. Risikowille mittlerer Fall

Beispiel:

- Dreieck 3
- Szenario C = 3
- Verhalten 3/3/3

Erwartung:

- Risikowille 3

## F. Risikowille sehr hoch

Beispiel:

- Dreieck 5
- Szenario D = 4
- Verhalten 5/5/5

Erwartung:

- Raw 4,75
- Risikowille 5

## G. Verlusttragfähigkeit Weakest Link

Beispiel:

- Zielwirkung 5
- Kapitalabhängigkeit 2
- Ausgleich 5

Erwartung:

- Verlusttragfähigkeit 2
- begrenzender Faktor sichtbar

## H. Automatischer Orientierungsrahmen

- Risikowille 5
- Verlusttragfähigkeit 2

Erwartung:

- Empfehlung 2
- deutlicher Konflikthinweis

## I. Geringe Abweichung

- Risikowille 4
- Tragfähigkeit 3

Erwartung:

- Empfehlung 3
- normaler Begrenzungshinweis

## J. Direkte Auswahl über Empfehlung

- manuell 4
- ermittelt 3

Erwartung:

- verwendete Stufe bleibt 4
- keine Begründungspflicht
- kein Begründungsfeld
- sichtbarer Hinweis

## K. Direkte Auswahl über Verlusttragfähigkeit

- manuell 5
- Verlusttragfähigkeit 2

Erwartung:

- verwendete Stufe bleibt 5
- deutliche Warnung, dass Auswahl über der Verlusttragfähigkeit liegt
- keine automatische Korrektur

## L. Assessment ohne bewusste Auswahl

- neuer Fall / Quelle `default`
- Ermittlung vollständig
- Empfehlung 3

Erwartung:

- verwendete Stufe wird 3
- Quelle `assessment`

## M. Altfall

- V0.14-Fall mit Risk 4 und altem `riskAssessment`

Erwartung:

- Risk 4 bleibt erhalten
- Quelle `legacy`
- übernehmbare Altantworten vorbefüllt
- V2 noch unvollständig

## N. Anlagehorizont

- allgemeinen Horizon ändern
- V2-Antworten unverändert

Erwartung:

- Risikowille, Tragfähigkeit und Empfehlung ändern sich nicht

## O. Kenntnisse & Erfahrung

- `experience` ändern

Erwartung:

- V2-Risikostufen ändern sich nicht

## P. Illustrative Bandbreiten

Für alle fünf Stufen prüfen:

- Pluswert größer als Minuswert im Betrag
- korrekte Prozentwerte
- korrekte 1.000-EUR-Beispiele
- Hoch spekulativ enthält zusätzlichen Totalverlust-Hinweis

## Q. Unvollständige Ermittlung

- eine Pflichtantwort offen lassen

Erwartung:

- kein neuer `recommendedRisk`
- vorhandene Antworten bleiben gespeichert
- bestehende Risikostufe unverändert

---

# 22. Work-Reihenfolge

## Checkpoint 1 – Datenmodell und Berechnungsengine

- neue V2-Typen
- Migration / Normalisierung
- reine Berechnungshelper
- Bandbreiten-Konfiguration
- Unit-/Funktionstests für A bis Q soweit ohne UI möglich
- Commit + Push

## Checkpoint 2 – UX

- fünf direkt auswählbare Stufen
- sofortiges Speichern
- Plus-/Minus-Balken
- magisches Dreieck
- Szenarien
- drei Risikowille-Fragen
- drei Tragfähigkeitsfragen
- Ergebnisdarstellung
- Konflikthinweise
- private/betriebliche Texte

Dann:

- TypeScript
- Produktionsbuild
- `git diff --check`
- fokussierte UI-/Regressionstests
- keine unnötige komplette App-E2E-Schleife
- final Commit + Push
- Merge/Pages erst bei vollständigem Paket

---

# 23. Ressourcenempfehlung

Empfohlen:

- **GPT-5.6 Sol**
- **Mittel**

Sol Hoch nur, wenn der nach 4A.1/4B/3B aktuelle `main` unerwartet einen größeren Schema-/State-Refactor erfordert.

---

# 24. Abnahmebedingungen

Risiko V2 ist fachlich und technisch abgenommen, wenn:

1. die fünf verbindlichen Stufen direkt anklickbar sind
2. direkte Auswahl sofort gespeichert wird
3. kein `Manuell festlegen`-Zwischenschritt existiert
4. die fünf illustrativen asymmetrischen Plus-/Minus-Bandbreiten korrekt dargestellt werden
5. das magische Dreieck vollständig anklickbar ist und in den Risikowillen einfließt
6. Szenario und drei Risikowille-Fragen korrekt einfließen
7. Risikowille gemäß 25/25/50-Regel berechnet wird
8. Verlusttragfähigkeit separat nach Weakest-Link-Minimum berechnet wird
9. Empfehlung = Minimum aus Wille und Tragfähigkeit ist
10. manuelle Auswahl nicht automatisch überschrieben wird
11. Abweichungen nur als Hinweis erscheinen, ohne Begründungsfeld
12. Anlagehorizont nicht mehr Teil des Risikoscores ist
13. Kenntnisse & Erfahrung nicht mehr Teil des Risikoscores sind
14. Altbestand ohne Datenverlust migriert wird
15. unvollständige Ermittlung keine Scheingenauigkeit erzeugt
16. private und betriebliche Tragfähigkeitsfragen passend formuliert sind
17. bestehende Produkt-/Kapitaltopf-Prüfungen nicht regressieren

---

# 25. Status

**Risiko V2 ist mit diesem Dokument fachlich abgeschlossen und WORK-READY.**

Es bestehen keine zentralen fachlichen Entscheidungen mehr, die vor einem späteren Work-Lauf erneut mit dem Nutzer geklärt werden müssen.

Vor Implementierungsstart ist lediglich der dann aktuelle GitHub-`main` kurz gegen die hier beschriebenen Feld-/Schemaannahmen abzugleichen.