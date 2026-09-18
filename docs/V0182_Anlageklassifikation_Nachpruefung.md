# V0.18.2 – gezielte Nachprüfung der wirtschaftlichen Anlageklassifikation

Stand: 18.09.2026. Ausgangspunkt: `fa7a0f0163194bd52936b2e06c3c9daf996dab46`,
Branch `work/v0182-bond-hardening`, PR #7. Gezielte Nachprüfung nach CP4,
keine erneute allgemeine Gesamtabnahme. Alle CSV-Positionen sind synthetisch.

## Befund und fachliche Trennung

**Ein materieller Fehler ist nachgewiesen.** Die CP4-Produktklassifikation
erkennt explizite Mischfonds und Aktienanleihen. `mapAssetClass` im Import
prüfte davon unabhängig zuerst auf `aktien` und setzte den Status `mapped`.
Dadurch wurde eine bloße Quellbezeichnung zur vollständigen wirtschaftlichen
Zuordnung. `depotAssetAmounts` übernahm diese Zuordnung bei Produkten ohne
bekannten Mix in die tatsächlich verwendeten Beträge.

- **Produktart:** `classifyDepotProduct` bestimmt z. B. Mischfonds / Multi-Asset
  oder strukturierte Produkte und deren Ausschluss aus der Standardbondrechnung.
- **agree21-Anlagesegment:** ursprüngliches Quellfeld, z. B. Aktien. Es bleibt
  unverändert erhalten und beweist bei diesen Produkten keine Aktienquote.
- **Wirtschaftliche Anlageklasse:** Beträge in den fünf Vermögenshausklassen.
  Ein vorhandener, per Produkt-ID verknüpfter Mix wird vollständig verwendet.
  Ohne belegten Mix bleiben die genannten Produkte wirtschaftlich ungeklärt.
  Weder Aktienanleihen noch sonstige Zertifikate erhalten erfundene Durchschauen.

**Teilverdacht widerlegt:** Ein bekannter Produktmix wurde in den aggregierten
IST-/PLAN-Beträgen bereits vor der Korrektur berücksichtigt. Das einzelne
Importfeld `assetClass` und die Excel-Depotspalte konnten dennoch irreführend
„Substanzwerte“ ausgeben. Ein repräsentatives Einzelfeld ist keine Fondsquote.

## Reproduktion und tatsächliche Endergebnisse

Ausführbare Fixture und Regression: `scripts/verify-asset-classification.tsx`,
obligatorisch über `test:cp4` eingebunden und dadurch auch im Typecheck enthalten.
Header:

```csv
Bezeichnung;WKN;Anlagesegment;Anlagemedium;Wertpapiertyp;Zertifikateklasse;Kurswert incl. Stückzinsen
Synthetic Mixed;SYN001;Aktien;Mischfonds;Fonds;;10000
Synthetic Multi;SYN002;Aktien;Multi-Asset;Fonds;;10000
Synthetic Reverse;SYN003;Aktien;;Aktienanleihe;;10000
Synthetic Reverse Medium;SYN004;Aktien;Aktienanleihen;Festverzinsliche;;10000
Synthetic Certificate;SYN005;Aktien;;Zertifikat;Aktienanleihe;10000
Synthetic Aktienanleihe;SYN006;Renten;;Festverzinsliche;;10000
Synthetic Known;A2DMWZ;Aktien;Mischfonds;Fonds;;10000
```

Die letzte künstliche Position verwendet ausschließlich zur Mix-Verknüpfung
die vorhandene Katalog-WKN von `urak-konservativ`: vorhandener Mix 65 % Geldwerte,
35 % Substanzwerte. Keine neue Quote, keine Aussage über aktuelle reale Fondsbestände.
Je Position ist ein Verkauf von 2.000 EUR geplant; zunächst keine Neuanlage.

| Ergebnis | Vorher IST | Korrigiert IST | Vorher PLAN | Korrigiert PLAN |
|---|---:|---:|---:|---:|
| Gesamtwert | 70.000 | 70.000 | 56.000 | 56.000 |
| Substanzwerte | 53.500 | 3.500 | 42.800 | 2.800 |
| Geldwerte | 16.500 | 6.500 | 13.200 | 5.200 |
| Nicht durchgeschaut | 0 | 60.000 | 0 | 48.000 |

Die neue Regression wurde zuerst gegen die unveränderte Importlogik ausgeführt:
Sie scheiterte mit `53500 !== 3500` an den tatsächlichen IST-Beträgen nach
CSV-Import und Anlage des Depots. Die Produktarten waren dabei bereits korrekt.
Nach der Korrektur bestehen die Summenprüfungen, echte React-Renderprüfungen
des IST- und PLAN-Vermögenshauses und Erzeugung/Einlesen einer XLSX-Datei über
den tatsächlichen Exportbutton. Für PLAN wird zusätzlich ein Kauf von 10.000 EUR
des bekannten Produkts geprüft: 66.000 Gesamtwert, 6.300 Substanzwerte,
11.700 Geldwerte und unverändert 48.000 ungeklärt.

## Betroffene Ansichten und begrenzte Korrektur

1. **Import:** `mapAssetClass` nutzt die vorhandene Produktklassifikation als
   Veto gegen pauschale Zuordnung expliziter Mischfonds/strukturierter Produkte.
   Ein Katalogmix hat Vorrang; Produkt-ID, Region, Risiko und Originalfelder bleiben
   erhalten. Ohne belegte Durchschau wird `classificationStatus=unresolved` gesetzt.
   Der typbedingt gespeicherte Fallback `assetClass=Geldwerte` ist dabei ausdrücklich
   keine wirtschaftliche Zuordnung; die Aggregation zählt ihn nicht als Geldwert.
2. **Vermögenshaus, IST, PLAN und Vergleiche:** Unbekannte Quoten fließen nicht mehr
   als Vollbetrag in die Substanzwerte. Verkäufe skalieren weiterhin nur den
   verbleibenden Betrag. Im Planer werden ungeklärte Bestände außerdem im Gesamtwert,
   Quotennenner und in der Zeile „Nicht durchgeschaut“ berücksichtigt. Die bisherige
   Planertabelle unterschlug dort ungeklärten fortbestehenden Bestand.
3. **Excel-Depotliste:** Ausgabe „Nicht durchgeschaut“ bei ungeklärten Positionen;
   bei bekannten Mischprodukten die vorhandenen Quoten statt einer einzelnen Klasse.
   Eindeutige Ein-Klassen-Produkte behalten ihre Klassenbezeichnung. Quellsegment,
   Wertpapiertyp, Anlagemedium und Zuordnungsstatus bleiben getrennte Spalten.
4. **Exportblatt Vermögensstruktur und entsprechender Druckabschnitt:** Diese
   enthalten bereits bisher ausschließlich die Neuanlagen der bevorzugten Planung,
   keine fortbestehenden Holdings. Deshalb keine CSV-bedingte Fehlzuordnung in diesen
   Summen. Mit einem bekannten Fondskauf sind 6.500 / 3.500 EUR im tatsächlichen
   Workbook und Druck-HTML geprüft. Der Exportumfang wurde nicht umgebaut.
5. **Produktartenanalyse/Bondanalyse:** CP4-Produktklassifikation unverändert;
   Testpositionen bleiben Mischfonds bzw. strukturierte Produkte und erzeugen kein
   Standardbond-Exportblatt. Preis-, FX- und Stückzinskonventionen sind unverändert.

## Absicherung und Grenzen

Die neue Regression prüft außerdem alle Katalogprodukte mit vorhandenem Mix,
zehn eindeutige bisherige Klassenfälle, explizite Navigator-Klassen, selektives
Beibehalten von Beständen, Marktwerterhaltung und JSON-Roundtrip. Bestehende
Portfoliozuordnungen und sämtliche älteren Assertions bleiben erhalten.

Vollständiges lokales Release-Gate: `test:3b`, `test:4b`, `test:risk-v2`,
`test:multi-depot`, `test:modelportfolio`, `test:cp1` einschließlich Reviewregression,
`test:bond-v2`, `test:cp3`, `test:cp4` einschließlich neuer Fachregression,
Typecheck und Produktionsbuild; zusätzlich Arbeits-/Staging-Diff und
`git diff --check origin/main...HEAD`. Finale Commit-SHA und Feature-CI werden
nach Push in PR #7 dokumentiert.

Keine automatische Neuinterpretation bereits gespeicherter oder manuell
zugeordneter Altpositionen: Sie können nicht sicher von bewussten Zuordnungen
unterschieden werden. Für solche Altimporte ist ein erneuter CSV-Import nötig.
Keine Behauptung vollständiger Erkennung aller realen Quellcodes oder bisher
nicht explizit bezeichneten Sonderstrukturen. Hier geprüft sind tatsächliche
gerenderte Komponenten und Dateiinhalte; keine erneute interaktive Gesamtabnahme
oder native PDF-Paginierungsprüfung. Keine Performance-CSV, kein Merge, kein Deployment.
