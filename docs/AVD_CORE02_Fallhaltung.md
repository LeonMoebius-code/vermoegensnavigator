# AVD-CORE-02 / P2: Fallhaltung und Vergleichsrevisionen

P2 ergänzt die versionierten Verträge von P1. Die technische Grundlage arbeitet
mit dem bestehenden Katalog und prüft vollständige Vergleichskandidaten. Das
Anlegen eines AVD-Falls aktiviert keine bestehende oder neue Kapitalberechnung.

Fachlicher Bezugsstand ist das am 17.11.2026 festgestellte N2-K1-Konzept,
insbesondere §§ 1.3–1.5, 7.2a und 11.4, ergänzt durch V0.5.2 und die
konsolidierten P0-Entscheidungen A und D. Die Originale bleiben in der privaten
Projektakte. P1 stellt weiterhin die Regeln für Katalog, Modelle, Kosten und
Publikation bereit.

## Fallvertrag

- avd.case.v1 hat eine Fall-ID, eine fortlaufende Eingaberevision, den Hash des
  direkten Vorgängers und einen Hash über den gesamten eigenen Inhalt. Ein
  technischer Verweis auf den allgemeinen Vermögensfall verbindet weder
  Speicher noch Vermögen.
- Person, Parteirolle, Kind und Vertrag sind innerhalb der Fall-ID adressiert.
  Beiträge und Zahlungen besitzen eine eigene ID, Vertrags- und
  Personenbezug, einen Tag und eine explizite Einmal-/Monatsdeklaration.
  Förderereignisse beziehen sich auf Beitragsjahr, Regimeversion, personelle
  Zuordnung und eine gesonderte Evidenz-ID. Die Zahlbeträge sind Centbeträge.
- B/A/S/O klassifiziert Werte. O speichert null und einen Grund. Eine bewusst
  numerische Null benötigt eine Klasse mit Wert. Evidenz ist getrennt und
  trägt ihren Personen-, Vertrags-, Jahres- und Nachweisbezug. Eine als
  bestätigt gespeicherte Evidenz verlangt einen eigenen Nachweisverweis.
  P2 prüft die Zuordnung, nicht die rechtliche Richtigkeit des Nachweises.
  Der erste Stand nach A/B-Wechsel enthält nur offene oder entfernte
  Fördernachweise. Riester-Bestand, Strategie, Annahmen und Rentenangebote
  bleiben explizite Eingaben.
- Katalog, Quellen, Kosten, Parameter und Fonds werden ausschließlich über
  exakte Revisionen mit Hash referenziert. Produktpfade deklarieren Modell,
  Anspar- und Auszahlkosten. Ein Pfad ohne Auszahlannahmen bezeichnet die
  P1-Variante vor Auszahlkosten. Eigene Gewichte folgen der P1-Schrittregel.
  Tarifgebundene Portfolios übernehmen exakt ihre gebundenen Gewichte.
  Overrides verwenden P1 und die jeweilige AVD-Fallidentität.
- Kopie und Restore erhalten die Originalrevision. Die Kopie erhält eine
  eigene äußere ID. Die inneren IDs gelten in diesem neuen Fallnamensraum
  und Override-Fallverweise werden umgebunden. Restore schreibt die Daten
  der gewählten alten Revision als neuen aktuellen Arbeitsstand. Ein
  kopierter oder restaurierter alter Katalogstand kann als Arbeitsstand
  gelesen werden. Für einen neuen aktuellen Vergleich muss der Fall den
  aktiven Katalogstand verwenden.

## Vergleich und Herkunft

avd.comparison.v1 fixiert genau eine Fallrevision und einen Katalogstand.
Das erwartete Schlüsselfeld entsteht aus Pfad, Szenario und Fördervariante.
Ein Pfad identifiziert Produkt, Tarif, Modell, die beiden Kostenstufen,
Anlagegewichte und die betroffenen Personen, Kinder und Verträge.
Die vollständige Menge muss genau einmal vorhanden sein. Das zentrale
Fixture verarbeitet zwei Produkte, drei Szenarien und zwei Fördervarianten
in zwölf eindeutig gebundenen Teilergebnissen.

| Identität | Geltungsbereich |
| --- | --- |
| case_id, case_revision | Ein Eingabesnapshot im Fall |
| comparison_revision | Vollständiger Vergleich im selben Fall |
| subresult_id | Teilergebnis innerhalb dieser Vergleichsrevision |
| calculation_id | Unveränderliche Originalausführung im selben Fall |
| dependency_manifest | Fall- und Katalogidentität sowie berechnete Bindungen aller erwarteten Schlüssel |
| export_id | Typ für eine spätere tatsächliche Ausgabe. P2 legt keine Exportinstanzen an |

Die Abhängigkeitsfunktion projiziert die für den jeweiligen Schlüssel
deklarierten Fakten. Dazu gehören beteiligte Personen und Kinder, Verträge,
Beitrags- und Förderereignisse, Evidenz, Riesterwerte, Regime, Annahmen,
Rentenangebote, Szenario und Pfad. Regime und gemeinsame Quellen sind
konservativ fallweit wirksam. Die ausgewählte Fördervariante schließt
unbestätigte Zulagen aus oder nimmt deklarierte bedingte Szenariowerte hinzu.
Offene Ansprüche werden weiterhin durch Evidenz abgebildet.

Die Projektion sammelt P1-Abhängigkeiten aus Datenreferenzen und Zitaten bis
zum letzten aktiven Katalogdatensatz. Die gemeinsamen Katalogbilder und
Kind-Revisionen bleiben referenzierbar. Historische Vorgänger werden als
Historie aufbewahrt. Der Teilhash enthält nur die tatsächliche Projektion
einschließlich der exakten Referenzen, ohne die neue Fall- oder
Katalogrevisionsnummer pauschal einzumischen. Der vollständige Vergleich
bindet beide Nummern trotzdem zwingend. So kann bei ausschließlich
geänderter Produktkostenannahme ein anderer Pfad unverändert bleiben.

Eine Wiederverwendung verlangt denselben Teilhash, denselben Schlüssel und
den unveränderten Datensatz aus dem Berechnungsregister. Zusätzlich muss der
ursprüngliche Vergleich diesen Datensatz unter der ursprünglichen
Teilergebnis-ID enthalten. Der neue Vergleich erhält neue Teilergebnis-IDs.
Die ursprüngliche calculation_id, das ursprüngliche Datum und die Einordnung
im ursprünglichen Vergleich bleiben gespeichert.

Fachlich nicht berechenbare Ergebnisse tragen einen Grund und keine
Kapitalzahl. Technische Abbrüche sind keine Ergebnisvariante. Ausschließlich
explizite synthetische Fälle auf synthetischem Katalog dürfen synthetische
Zahlen enthalten. Arbeitsfälle können in P2 einen vollständigen Vergleich
fachlicher Sperrzustände speichern. Alte Ergebnisse sind als historisch
fixiert adressierbar. Ein veralteter aktueller Verweis gibt nur die Identität
zurück, keine Ergebnisse als Ersatz.

## IndexedDB und Atomarität

Datenbank vermoegensnavigator-avd, IndexedDB-Version 1. Die sechs Stores
haben explizite Schlüssel und gehören zu derselben Transaktionsdomäne.

| Store | Schlüssel | Schreibregel |
| --- | --- | --- |
| catalogs | [Katalog-ID, Revision] | Originalbild mit add |
| catalog_heads | Katalog-ID | Aktuelles Bild einer Linie, mit erwartetem Vorgänger |
| cases | [Fall-ID, Revision] | Originalbild mit add |
| case_heads | Fall-ID | Aktueller Fall und Vergleichsverweis |
| comparisons | [Fall-ID, Vergleichsrevision] | Originalbild und Teilergebnisse mit add |
| calculations | [Fall-ID, Berechnungs-ID] | Erstveröffentlichter Originaldatensatz mit add |

Ein Katalogwechsel verwendet P1 appendCatalogRevision. Seine Autorität wird
pro Kataloglinie in der Datenbank gespeichert, damit ein zweiter Tab die
Quelle auch während eines extern vorbereiteten Laufs aktualisieren kann.
Jeder Schreibvorgang überprüft die erwarteten Identitäten nach Beginn der
nativen readwrite-Transaktion. Ein Vorabtest mit checkCandidate ist nur
eine Lesevalidierung. publishComparison prüft im Schreibvorgang erneut
Fallrevision, aktives Katalogbild, Vergleichsvorgänger, Vollständigkeit und
Originalberechnungen. Erst dann speichert es neue Berechnungen, den Vergleich
und den Verweis. Die API meldet Erfolg nach dem vollständigen Commit und
wartet bei einem Fehler auf Abbruch. Schreibtransaktionen umfassen die Stores
gemeinsam. Dadurch sind sie auch zwischen zwei Tabs serialisiert. Diese
bewusst einfache Version serialisiert auch Schreiboperationen auf
verschiedenen Fällen. Rechenarbeit findet außerhalb der Transaktion statt.

checkExport nimmt den erwarteten Fall, den konkreten Vergleich und die
ausdrückliche Auskunft zu ungespeicherten Änderungen entgegen. Es prüft in
einer konsistenten Lesetransaktion Aktualität und Vollständigkeit, verbietet
Fixtures und verwendet die P1-Publikationsprüfung für export. Der spätere
Ausgabedienst muss die Grenze vor tatsächlicher Ausgabe erneut prüfen. P2
reserviert dabei keinen Export-ID-Wert und speichert keine Ausgabedatei.

## Nachweis und Grenzen

- Das reguläre Browser- und Typecheck-Gate erfasst avd-p2-domain.spec.ts und
  avd-p2-indexeddb.spec.ts. Die Browser-Suite benutzt native IndexedDB am
  isolierten Test-Ursprung, zweite Tabs, Reload, einen echten Abbruch,
  einen echten ConstraintError und eine blockierte native Öffnung.
  Wiederholung mit denselben IDs überprüft, dass keine Teilzeilen aus
  fehlgeschlagenen Transaktionen zurückbleiben.
- Der Vertrag prüft passive Daten mit Form-, Unicode-, Hash-, Größen- und
  Referenzgrenzen. Beim Lesen werden ausgewählte Originale, ihre direkten
  Vorgänger und verwendete Berechnungsoriginale erneut geprüft. Content-Hashes
  belegen weder Herkunft noch Zugriffsschutz. Bösartiger Code derselben
  Browser-Origin kann Browserdaten manipulieren. Lokaler Speicher kann
  blockiert, gelöscht oder durch Browserquoten begrenzt werden.
- Vollständige fachliche Zahlenmodelle, AP-01c, UI-Verdrahtung,
  Berechnungsplanung, tatsächliche Exporte, Quoten-/Backup-Produktkonzept und
  rechtliche oder bankseitige Freigaben liegen außerhalb von P2. Ein
  Browserarchiv ist keine externe unveränderliche Langzeitablage.
