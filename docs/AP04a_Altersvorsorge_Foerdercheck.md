# AP-04a – Flüchtiger Altersvorsorge-Fördercheck A1/A2

## Konzept vor Codeänderung – 28.10.2026

Basis: `27a896799d0c02eb8976dbe74700956dfd58d69d`, Tree
`2262ce9553afd8d0d5be38c28b8fbaeb81e1d3bf`, Version 0.18.4 / Schema 11.
Live-GitHub, saubere isolierte Kopie, offene PRs #43/#60 und fehlender AP-04a-Zweig
wurden geprüft. Der ältere PROJECT_STATUS-Checkpoint ist überholt; #59 und #61
sind integriert. #60 wird nicht als Featurebasis verwendet. Kein eigener Review.

Geplanter Minimaldiff:

- `app/page.tsx`: View `retirement`, Sidebar, eigenständiger Spezialbutton direkt
  neben „+ Neuer Fall“, Renderstelle und vorgeschalteter Navigationsverlustschutz.
  Der bestehende normale Neuer-Fall-Button behält seinen direkten Startpfad.
- `app/presentation/retirement/direct-grant-adapter.ts`: typisierter UI-Snapshot,
  exakter deutscher Centparser, Jahresbeitragsbildung aus Monatsanzahl und
  optionaler Einmalzahlung; alleiniger Aufruf des unveränderten AP-01a-Kerns.
- `app/presentation/retirement/retirement-entry.tsx`: A/B, A1/A2, ausschließlich
  React-State, synchrone Ergebnisinvalidierung, Beforeunload und Bestätigung.
- `app/globals.css`: ausschließlich gekapselte `.retirement-*`-Styles.
- Neue `tests/browser/ap04a-*.spec.ts`: Adaptermatrix und echte Browserregressionen.
  Automatisch im vorhandenen Browsergate und strikten Typecheck erfasst;
  keine Änderung von package.json, Lockdatei, Workflows oder alten Tests nötig.
- Diese Vertragsdatei: tatsächliches Verhalten, Grenzen und Testzuordnung.

Alle Nachweise initial unbestätigt. Ein Jahreswechsel entzieht person-/jahrbezogene
Bestätigungen einschließlich Kinderzuordnung und Beitragsbestätigung.
Unbekannte Kinder werden vor der Domain abgefangen; `children: []` wird nur bei
explizit bestätigter Kinderlosigkeit übergeben. Kinder erhalten flüchtige opake IDs.
Die Oberfläche ermittelt keine Berechtigung und keinen Bonus.

Monatsbeginn und Anzahl sind explizite Angaben innerhalb des Kalenderjahrs;
Oktober erlaubt höchstens drei Raten. Optionaler Einmalbetrag ist ausschließlich
förderfähiger Eigenbeitrag. Der Moduswechsel verlangt sichtbar neue Eingaben,
statt einen Jahresbetrag zu runden oder unbemerkt zu verändern.
Über 6.840 EUR wird nicht als bestätigter UI-Standard gerechnet; keine Kappung.

A1/A2/Auswahl bleiben in derselben Komponente. Allgemeine Navigation bestätigt
vor dem Unmount einen bearbeiteten Entwurf; Abbruch erhält ihn unverändert.
Neustart verwendet dieselbe ausdrückliche Verlustentscheidung. Reload/Tab-Schluss
haben nur den browserabhängigen Beforeunload-Hinweis, keine Wiederherstellung.

Keine Änderungen an AP-01a/AP-01b, AdvisoryCase/Store, D1, Import/Export/Druck,
Schema, Version, Produktdaten oder Veröffentlichungsprozessen.

## Umgesetzter Bedien- und Quellenvertrag

A/B sowie A1/A2 bewahren Eingaben innerhalb einer Komponente. Jede Datenänderung
entfernt das Ergebnis synchron, auch bei zunächst unvollständiger Betragseingabe.
Die bewusste Prüfung nutzt den aktuellen Snapshot. Fehler an A1-Bestätigungen
führen zu A1 zurück und setzen den Fokus auf das betroffene Feld; Statusmeldungen
sind mit diesem Feld verbunden. Der Browserhinweis beim Reload ist keine Sicherung.

Nur `calculated` zeigt Domainbeträge. Die Zuflusssumme addiert ausschließlich den
bestätigten eigenen Jahresbeitrag zur unveränderten Domain-Zulagensumme.
`openRounding` wird nicht als Betrag dargestellt. AP-01a-Metadaten sind unter
„Regelstand, Quellen und Modellgrenzen“ einsehbar. Geplant/gezahlt bleibt eine
explizite Kennzeichnung; Beitragsänderungen entziehen die Beitragsbestätigung.

Der deutsche Parser bleibt bewusst separat vom allgemeinen AmountInput:
Er liefert direkt sichere Ganzzahl-Cents, lehnt Leer/Minus/Exponenten/mehr als
zwei Nachkommastellen ab und verwendet BigInt statt Euro-Floats. Keine Veränderung
des H1-Parsers und keine Übernahme seiner Leerwert-zu-Null-Semantik.

Primärquellen sind die unveränderten jahresbezogenen AP-01a-Quellen.
Die BMF-FAQ bestätigt ergänzend die 6.840-EUR-Einzahlungsgrenze und die
1.800-EUR-Fördergrenze:
[Reform der geförderten privaten Altersvorsorge](https://www.bundesfinanzministerium.de/Content/DE/FAQ/reform-der-privaten-altersvorsorge.html).
Abrufkontrolle 28.10.2026; einzelne direkte DRV-Abrufe zeitweise HTTP 503.
Der feste fachliche AP-01a-Prüfstand wird dadurch nicht neu datiert oder erweitert.

## Maschinelle Prüfabdeckung

`tests/browser/ap04a-adapter.spec.ts` vergleicht 66 Jahres-/Beitrags-/Kindersnapshots
direkt mit AP-01a einschließlich 120,01/360,01-Rundungssperre; weitere Prüfungen
betreffen Centgrenzen, Monatsaddition, Status-/Scopegrenzen und Jahreswechsel.
`tests/browser/ap04a-retirement.spec.ts` prüft echte UI-Einstiege, Jahreswechsel,
Grenzbeiträge, Monatsstart, Kinder, Invalidierung, Tastatur/Mobil, Abbruch/Verwerfen,
Reload und bytegleichen allgemeinen Bestand mit JSON/XLSX/Druck-Gegenvergleich.
Beide neuen Dateien laufen im bestehenden Browsergate, ohne Zusatzflags oder Skips.
A04-01 bis A04-20 werden im identischen externen Abnahmepaket auf die tatsächlichen
finalen Laufbefunde abgebildet. Dieses Dokument behauptet kein vorweggenommenes CI-GO.

Speicherarchitektur AP-02b bleibt HOLD. Alt-Riester-UI, Bonusautomatik,
Steuern, Produkte, Kapitalprojektion, Export und Wertübernahme bleiben ausgeschlossen.
Kein Speichern, keine Domainveränderung, kein Deployment.

## Gezielte Korrekturen nach dem ersten CI-Lauf

Der erste Kandidat hatte 272/274 bestandene Browser-/Adaptertests. Zwei neue
Prüfungen deckten getrennte Ursachen auf: Der vorhandene breite Markenkopf
überlief bei 390 px auch in der neuen Spezialansicht. Ausschließlich dort wird
der sichtbare Appname im mobilen Kopf ausgeblendet; der Markenbutton behält
seinen vollständigen zugänglichen Namen. Logos, Navigation und alle allgemeinen
Ansichten bleiben erhalten; keine globale Overflow-Sperre.

Die neue synthetische Exportvergleichsfixture hatte für zwei ausgewählte Module
keinen expliziten Modulzustand. Der unveränderte Exporter erzeugt dann je Abruf
einen leeren Anzeigezustand mit frischem Zeitstempel. Die Fixture enthält nun
auch diese Zustände mit festen eigenen Zeitstempeln. Der vollständige Vergleich
aller Fall-/Excel-/Druckinhalte bleibt erhalten, ohne Zeitfelder herauszufiltern
oder eine Assertion abzuschwächen. Kein bestehender Produktfehler wird hier
behoben oder als Vorsorge-Datenmutation ausgegeben.
