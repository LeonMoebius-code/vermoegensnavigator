# Modellportfolio: Produktdurchschau und Mindestanlage

Fachliche Freigabe vom 15.10.2026; Modellportfolio-Stand 01.07.2026.

| Produkt-ID | Liquidität | Geldwerte | Substanzwerte | Alternative Anlagen | Sachwerte |
|---|---:|---:|---:|---:|---:|
| ps-defensiv | 0 % | 75 % | 25 % | 0 % | 0 % |
| ps-ausgewogen | 0 % | 55 % | 45 % | 0 % | 0 % |
| ps-offensiv | 0 % | 35 % | 65 % | 0 % | 0 % |
| zinsfix | 0 % | 0 % | 100 % | 0 % | 0 % |
| mea | 0 % | 0 % | 100 % | 0 % | 0 % |

Die drei Private-Select-Mixe sind modellimplizite Zielquoten: Sie wurden aus
Gesamtallokation und übrigen Einzelbausteinen der Modellportfolio-Unterlage
vom 01.07.2026 zurückgerechnet. Jede Strategie hat dort 50 % Gewicht.
Beispiel RB 3: Geldwerte (45 - 17,5) / 0,5 = 55 %;
Substanzwerte (40 - 17,5) / 0,5 = 45 %. Eine aktuelle tatsächliche
Depotzusammensetzung ist damit nicht nachgewiesen. Die unterschiedlichen
Private-Select-Bezeichnungen der VV-Matrix werden weiterhin nicht gleichgesetzt.

ZinsFix Index und MEA Einzelwert sind aufgrund ausdrücklicher
Projektleiterentscheidung mit 100 % Substanzwerten klassifiziert. Dies ist
keine Behauptung einer vollständigen wirtschaftlichen Zertifikatedurchschau.
Andere Produkte oder unbekannte Depotpositionen erhalten keine neue Zuordnung.

## Rechnerischer Nachweis

| Modell | Geldwerte | Substanzwerte | Alternative Anlagen |
|---|---:|---:|---:|
| RB 2 | 50 % × 75 % + 32,5 % = 70 % | 50 % × 25 % + 7,5 % = 20 % | 10 % |
| RB 3 | 50 % × 55 % + 17,5 % = 45 % | 50 % × 45 % + 17,5 % = 40 % | 15 % |
| RB 4 | 50 % × 35 % + 2,5 % = 20 % | 50 % × 65 % + 27,5 % = 60 % | 20 % |

Liquidität und Sachwerte sind jeweils 0 %. Bei 160.000 EUR in RB 3 entstehen
72.000 EUR Geldwerte, 64.000 EUR Substanzwerte und 24.000 EUR alternative
Anlagen. Die bisherigen ungeklärten 80.000 EUR Private Select, 8.000 EUR
ZinsFix und 4.000 EUR MEA sind damit vollständig berücksichtigt.

## Nicht blockierender Mindestanlagehinweis

Der Modellanwendungsdialog verwendet für die drei Private-Select-Strategien
die bestehende Katalog-Mindestanlage von jeweils 125.000 EUR. Aus tatsächlichem
Modellbetrag und Bausteingewicht wird die Einzelanlage mit derselben bestehenden
Ganz-Euro-Rundung wie bei der Anwendung berechnet. Es gibt keine neue Rundungs-
oder Normalisierungssystematik. Beispiel: 249.999,99 EUR × 50 % wird wie bisher
als Einzelanlage auf 125.000 EUR gerundet und erfüllt daher die Mindestanlage.

Bei 160.000 EUR und 50 % Gewicht: 80.000 EUR Einzelanlage, 45.000 EUR Fehlbetrag.
Bei 250.000 EUR: 125.000 EUR Einzelanlage, kein Unterschreitungshinweis.
Gültige Eingaben aktualisieren den Hinweis bereits während der Erfassung.
Die bestehende Betragsübernahme bei Blur/Enter bleibt erhalten. Ungültige oder
unvollständige Entwürfe zeigen keine neue Mindestanlagevorschau; der gespeicherte
Betrag bleibt gemäß bestehendem Eingabevertrag unverändert.

Alle drei Aktionen verwenden denselben Hinweis. Ein Aktionswechsel aktualisiert
ihn auf den tatsächlich vorbelegten Betrag, beim Ergänzen auf den strategischen
Restbetrag. Die Unterschreitung blockiert die Anwendung nicht. Der direkte
VV-Selektionshinweis und dessen Katalog-Mindestanlagen bleiben unverändert.

## Verträge und Prüfungen

Die gemeinsame Projektion, IST-/PLAN-/ZIELPLAN-Semantik, Fallschema 11,
JSON-/Migrationsverträge, Persistenz, Historien, CSV-Verarbeitung und Bondengine
bleiben unverändert. Ungeklärte Werte bleiben separat im vollständigen Nenner.

Die bestehenden kanonischen Modellportfolio- und D1-Prüfungen enthalten die
neuen Fach-, Render-, XLSX-, JSON- und Persistenzregressionen. Der bisherige
CSV-Mixtest erhält seine vorhandenen Prüfungen; die zwei neu durchgeschauten
Zertifikate besitzen keine individuelle WKN und werden über ihre expliziten
Produkt-IDs geprüft, nicht aus dem Platzhalter `-` abgeleitet.
Die zusätzliche Browserdatei prüft RB 2/3/4 jeweils mit allen drei Aktionen,
Live-Hinweisen, Schwellen, vollständigen Hausmodi, Beitragsdetails, tatsächlichen
Downloads und gespeichertem Reload. Die drei bisherigen CP0B-Lebenszyklen bleiben erhalten.

In der Work-Cloud ist die reguläre Chromium-Installation durch ein ungültiges
Downloadarchiv blockiert. Daher wird hier kein lokal bestandenes vollständiges
Verify behauptet. Nach ausdrücklicher Anweisung vom 15.10.2026 laufen das
unveränderte vollständige Verify und die Browserprüfungen über die bestehende
GitHub Feature CI auf Feature-Commit und synthetischem PR-Merge. Der
Abschlussbericht dokumentiert die tatsächlichen lokalen und CI-Ergebnisse getrennt.
