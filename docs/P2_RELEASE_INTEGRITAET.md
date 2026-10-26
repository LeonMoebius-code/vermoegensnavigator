# P2 – Integritätskorrekturen vor der Versionsvorbereitung

Ausgangs-main `02e33028f6f3790a237f319064cea362e367117c`, Tree
`8c682d22abe6a0ff34fddf5d28c8d8498758e905`. Beschlossener Umfang vom
23.10.2026: F-008/F-013/F-016 sowie begrenzte Klarstellungen F-024/F-025.
Anwendung weiterhin **0.18.3 / Schema 11**. V0.18.4 ist die nächste geplante
Veröffentlichung; dieses Paket enthält weder Versionsumstellung noch Freigabe.

## F-008 – CSV und referenzerhaltendes Ersetzen

Unterstützte bestehende Formate bleiben semikolongetrennte Navigator-CSV
(`Name;Wert`) und Strukturübersicht (`Kurswert incl. Stückzinsen`). Die bisherige
UTF-8-Präferenz bleibt erhalten. Gültiges UTF-8 einschließlich BOM wird strikt
gelesen; bei ungültigem UTF-8 ohne BOM wird das schon bisher verwendete
Windows-1252 versucht. Eine UTF-8-BOM mit ungültigen Folgebytes, UTF-16,
Replacement-Zeichen und nicht lesbare Steuerzeichen werden kontrolliert abgelehnt.
Keine neue CSV-Formatfamilie und keine Namensähnlichkeitsheuristik.

Bytes allein können eine BOM-lose, in beiden Encodings gültige Zeichenfolge
nicht zweifelsfrei ihrem Ursprung zuweisen. Die bestehende UTF-8-Priorität ist
keine neue Behauptung einer Quellzertifizierung. Deshalb schützt ein eigener
CSV-Ersatzimport-Preflight zusätzlich die tatsächlich vorhandenen Referenzen:
Der gemeinsame eindeutige Identitätsabgleich muss für jede bisherige Position
mit geplantem Verkauf, Planselektion oder bewusstem Bondaggregat-Ausschluss
eine eindeutige Zuordnung finden. Andernfalls bleibt die Vorschau offen, der
Import wird vor der Zustandsübernahme abgebrochen und der Originalfall bleibt
unverändert. Beide tatsächlichen CSV-Wege (Ausgangslage und Depotcheck) verwenden
dieselbe Prüfung mit den aktuellen Plänen. Keine Referenz wird durch ein
unsicheres Ersatzmatching entfernt. Eine gezielte Depotlöschung bleibt ein
getrennter, ausdrücklich bestätigter Vorgang.

Das zugrunde liegende pure Depot-Lifecycle-Matching wird nicht umdefiniert;
gültige WKN-/Produkt-/ID-Zuordnungen, andere Depots und die bisherige Begrenzung
eines geplanten Verkaufs auf den aktualisierten Positionswert bleiben erhalten.
Der Schutz ist keine atomare Cross-Tab-Transaktion.

## F-013 – Gemeinsamer Warnkern, eindeutige Planquelle

Planung und Ergebnis verwenden beide `planningShortfall(advisory, plan.total)`.
Die Planung verwendet ihren aktiven Plan, das Ergebnis ausschließlich den
bevorzugten Plan gemäß [D1](D1_Ergebnis_Export_Sichtenvertrag.md). Bei identischem
Plan muss die Warnlage identisch sein. Verschiedene Pläne dürfen verschiedene
Warnlagen haben; ohne bevorzugten Plan wird keine aktive Variante als Ziel
eingesetzt. Beispiel: Plan 40.000, Reserve/Bedarfe 50.000, Liquidität 100.000
ergibt 10.000 Unterdeckung in beiden relevanten Ansichten. Kein neuer Grenzwert,
keine Kaufsperre, keine Änderung an Kapitaltöpfen oder Finanzberechnungen.

## F-016 – Vorhandene Null ist null

Eine vorhandene nichtleere Zuordnungsmap hat Vorrang, auch wenn sämtliche
Einträge null sind. Nur eine fehlende oder leere Map behält den vorhandenen
Single-Pot-/Bucket-Fallback. Positive Maps bleiben unverändert; Kaufbetrag und
Zuordnungssumme müssen nach [H2](H2_Finanzvalidierung.md) weiterhin nicht gleich
sein. Laufende Reconciliation behält gültige Nullschlüssel, statt daraus eine
positive Deckung oder eine leere Map zu erzeugen. Ein absichtlich entfernter
aktueller Kapitaltopf erzeugt keine verwaisten Nullreferenzen. Primärreferenzen
werden nicht allein wegen ihres Nullbetrags auf einen anderen Topf gewechselt.

Aktuelle gültige Nullmaps bleiben in Normalisierung, Speicherung, JSON,
historischem Snapshot, zulässigem Restore und XLSX erhalten. Historische
zweideutige Legacy-Maps bleiben unter H5a/H5b geschützt: keine neue Migration,
keine pauschale Validatorausnahme und keine automatische Reparatur. Ein aktueller
phased-Bezug auf einen Betrag null ist nach dem bestehenden Graphvertrag nicht
positiv gedeckt und wird nicht durch einen Fallback künstlich gültig gemacht.
F-012-Bestätigung, Abbruch und P1-Originalbackups bleiben verbindlich.

### Nachkorrektur F-016 × F-012 vom 26.10.2026

Entfällt bei einer Terminänderung ein ausdrücklich gespeicherter Nullschlüssel,
meldet die bestehende F-012-Vorschau auch eine sekundäre Bindung als eigene
Zuordnungsinformation mit **0 €; kein finanzieller Verlust**. Plan, Produkt und
wegfallender Kapitaltopf werden genannt. Erst die ausdrückliche Bestätigung
entfernt diese Information. Eine weiterhin gültige primäre Bindung wie
`Strategisch: 0 €` bleibt ausdrücklich erhalten; keine Umbuchung findet statt.
Die bisherige primäre Nullbindungswarnung wird ohne Doppelmeldung erhalten.
Fehlende/leere Maps erfinden keine sekundäre Nullbindung. Die atomare erneute
Prüfung, Abbruch, positive Verluste und H5-Originalschutz bleiben unverändert.

## Begrenzte Klarstellungen

- **F-024:** Planvarianten nennen den „Zuletzt angewendeten Modell“-Bezug.
  Mehrere Modellallokationen und ihre jeweiligen Modell-IDs bleiben erhalten.
  Keine Modellhistorienarchitektur.
- **F-025:** Ein Sparplan ohne Start bleibt ein unvollständiger Entwurf.
  Editor, gemeinsamer Kunden-/interner Druckabschnitt und XLSX kennzeichnen
  „Unvollständiger Entwurf – Startdatum fehlt“. Das Datumsfeld bleibt leer.
  Gültige Startdaten und deren Ausgaben bleiben erhalten; keine Rendite-/Termin-
  oder Kapitaldeckungsberechnung wird ergänzt.
- **F-018:** Kaufbetrag, Topfabdeckung und die vorhandene Anzeige „Aufgeteilt …
  von …“ beschreiben verschiedene Größen. Keine Gleichsetzung, Kappung oder
  neue Datenregel; der bestehende H2-Vertrag bleibt unverändert.

## F-019 – Festgestellte Quellen- und Entscheidungsgrenze

| Bestehende Quelle | Nachweis der Berichtswährung |
| --- | --- |
| Vollständiges unterstütztes agree21-Profil mit 29 eindeutigen Spalten, Version 2 | EUR als ausdrücklich bestätigte Formatkonvention, keine Herstellerzertifizierung |
| Generische Strukturübersicht, Version 1 | `reportingCurrency: null`, Profilannahme; keine automatische Hochstufung auf EUR |
| Navigator-CSV `Name;Wert` | Kein eigenes persistiertes Berichtswährungs-Quellprofil |

Das Feld `Währung` bezeichnet nicht automatisch die Währung des Marktwerts.
Der vorhandene Bondvertrag sperrt unbelegte EUR-Aggregate und erhält lokale
Einzelkennzahlen getrennt. Allgemeine Depot-/Vermögensanzeigen verwenden jedoch
weiterhin das bestehende EUR-Anwendungsformat. Dafür ist bei generischen Quellen
keine neue Herkunftsbestätigung nachgewiesen. Eine zuverlässige Herkunftssperre
über sämtliche allgemeinen Sichten erfordert eine gesonderte Quellenentscheidung;
sie wird hier weder durch eine fiktive EUR-Identität noch durch eine neue
Import-/Persistenzarchitektur ersetzt. **F-019 ist damit untersucht, nicht
pauschal behoben oder für beliebige CSV-Quellen freigegeben.** Der Projektleiter
muss diese konkrete Grenze vor Veröffentlichung einordnen. Keine FX-Umrechnung.


### Fortschreibung durch Beschluss vom 26.10.2026

Die vorstehende offene Quellenentscheidung ist historischer Erkenntnisstand.
[D-12](project/DECISIONS.md) klärt F-019 für den vorgesehenen regulären Import:
vollständiges unterstütztes agree21-Profil mit 29 Spalten; EUR-Berichtswährung
bereits am 21.09.2026 fachlich bestätigt und technisch berücksichtigt. Keine
zusätzliche Benutzerbestätigung oder erneute Implementierung. Die oben
beschriebenen Grenzen generischer Profile gelten unverändert und werden nicht
aufgehoben; keine pauschale Freigabe beliebiger CSV-Quellen. Dieser Beschluss
ist keine Release- oder Bankeinsatzfreigabe.

## Nachweisvertrag

Zusätzliche Domain-/Komponentenprüfungen laufen im regulären Verify vor dem
Typecheck; neue Browsertests prüfen echte Uploads, Ablehnung, Fall-/Nachbarerhalt,
Warnansichten, Speichern/Reload, XLSX und Druck. Bestehende Sicherheitsregressionen
werden nicht abgeschwächt. Maßgeblich sind die finalen originären Push- und
synthetischen PR-Merge-Läufe einschließlich R1 ohne Skips. Keine interne Bankdatei
oder realer Kundenfall als Fixture. PR #43 bleibt AUDIT ONLY – NEVER MERGE.
