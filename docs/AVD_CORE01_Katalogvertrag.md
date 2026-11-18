# AVD-CORE-01: Versionierter Katalogvertrag

P1 implementiert eigenständige Domänenverträge und Laufzeitvalidierung für einen
Vorsorgekatalog. Es liefert keine Produktberatung, keinen Kapitalrechner und
keine Speicherung. Bestehende AP-01a/AP-01b/AP-03a/AP-04a/AP-04b/AP-05a-Pfade,
allgemeines Fallschema 11, UI, Exporte und CI bleiben unverändert.

## Daten und Veröffentlichung

Der öffentliche Stand enthält ausschließlich künstliche Testprodukte, Tarife,
Fonds, Quellen und Zahlen. Die sechs fachlich beschlossenen Produktalternativen,
elf Fondsoptionen und Komfortportfolios können über die Verträge repräsentiert
werden. Tatsächliche Arbeitskosten, Fondslisten, ISINs und interne Herstellerquoten
sind ohne konkrete Ausgabefreigabe nicht enthalten. Synthetische Werte sind keine
Ersatz-Produktkosten und kein realer Herstellerkostennachweis.

Fachliche Parameterfreigabe, interne Verfügbarkeit und öffentliche Freigabe sind
getrennt. `Publication` verlangt einen benannten Freigabevermerk mit Datum und
expliziten Kanälen `source`, `asset`, `display`, `export`.
`publicCatalog` gibt nur einen vollständig freigegebenen Katalog einschließlich
historischer Datensätze zurück. Ein interner Datensatz sperrt den gesamten
Vorgang. Bloßes Ausblenden in einer Oberfläche bietet keinen Publikationsschutz.
Das Prüfmodul importiert keine realen Daten und ist derzeit nicht im App-Bundle.

Diese Metadaten sind keine Authentifizierung. Eine vertrauenswürdige zuständige
Stelle muss die Freigaben vor Einspielung prüfen. P1 entscheidet keine
Nutzungsrechte und bietet keine Zugriffskontrolle für geheime Daten.

## Identität und Revision

`Ref` besteht aus `kind`, stabiler `id`, positiver ganzzahliger `revision`
und SHA-256-`hash`. Produkt, Tarif, Fonds, Portfolio, Parameter, Quelle und
Kostenvertrag haben getrennte Identitätsräume. Parameter besitzen einen expliziten
Verwendungszweck `general` oder `annuity_factor`. Kostenparameter tragen selbst
zusätzlich eine eindeutige Phase. Eine Ansparannahme kann nicht als
Auszahlparameter wiederverwendet werden. Ein Tarif referenziert genau
eine Produktrevision. Parameter-Eigentümer sind stabile Produkt-/Tarif-IDs.
Diese Rückverweise vermeiden zyklische Inhalts-Hashes. Nutzende Kosten-/Produkt-
und Tarifstände referenzieren Parameter dagegen immer mit vollständiger Ref.

`avd.catalog.v1` enthält alle erhaltenen Datensätze und ein explizites
`current`-Manifest für `asOf`. Es gibt keinen Latest-Fallback. Aktuelle
Datensätze dürfen nur aktuelle, an diesem Tag gültige Abhängigkeiten verwenden.
Historische Datensätze dürfen historische Referenzen behalten. Die Gültigkeits-
grenzen sind einschließlich. Kalenderdaten werden als echte Tage 0100–9999
geprüft. Source-Ausgabe, Prüfung, Änderung und Gültigkeit bleiben getrennte Felder.

Revision 1 hat keinen Vorgänger. Jede weitere Datensatzrevision verweist auf
ihren unveränderten direkten Vorgänger derselben Identität. Der Katalognachfolger
muss über `appendCatalogRevision` gegen den alten Katalog geprüft werden.
Dabei bleiben sämtliche alten Datensätze byteinhaltlich erhalten. Ein isoliert
eingelesener Katalog beweist seine lokale Konsistenz, jedoch keine extern
vertrauenswürdige Historie. Das Speichern und der konkurrierende Schreibschutz
gehören zu P2.

Die Inhaltsbindung verwendet die vorhandenen SHA-256-/Canonical-JSON-Helfer aus
H5b unverändert. Der Hash umfasst alle eigenen Daten außer `hash`, mit
sortierten Objektschlüsseln und unveränderter Arrayreihenfolge. Dokument-Hashes
sind deklarierte Quellenidentitäten. Das tatsächliche Dokument muss vorgelagert
gegen diese Identität geprüft werden. Ein Hash allein belegt weder Herkunft
noch fachliche Richtigkeit.

`parseCatalog` kopiert einfache Daten vor der Prüfung und friert das Ergebnis
rekursiv ein. Unbekannte Felder, Accessoren, Symbolfelder, nicht aufzählbare
Eigenschaften, fremde Prototypen, Löcher in Arrays, Zyklen, NaN/Infinity und
Minusnull werden abgelehnt. Technische Grenzen: 40 Ebenen, 100.000 Datenknoten,
10.000 Elemente je Array. Diese Grenzen betreffen die Katalogeingabe, keine
finanzielle Laufzeit. Ungepaarte Unicode-Surrogate in Schlüsseln und Werten
werden abgelehnt, gültige Unicode-Paare bleiben erhalten.

Die Eingabegrenze gilt für passive JSON-Daten, etwa aus `JSON.parse`, und ist
keine Sandbox für ausführbare JavaScript-Objekte. Die Reflection eines Proxy
kann JavaScript-Traps ausführen. Eine nebenwirkungsfreie Prüfung beliebiger
Proxies wird ausdrücklich nicht zugesichert. Eigene Daten-Accessoren passiver
Objekte werden weiterhin ohne ihren Aufruf zurückgewiesen. `reference`, `refKey`
und `revisionHash` sind interne Helfer für bereits vertrauenswürdige passive
Daten, keine externen Eingangsvalidatoren. Sie dürfen die Laufzeitprüfung nicht
ersetzen. Alle externen Funktionen liefern `Checked<T>` mit einem
eindeutigen Fehlercode und Pfad statt Teilwerten.

## Status, Quellen und Modelle

B/A/S/O klassifiziert Parameter. O hat zwingend `value:null` und einen Grund.
B verlangt einen konkreten Quellenbeleg und ist nicht überschreibbar.
A bezeichnet einen ausdrücklich genehmigten Arbeitsparameter. S ist eine
Szenarioannahme. Eine Quelle führt Dokumentversion, Dokument-Hash, Datum,
Verbindlichkeitsgrad und Verwendungszweck. Widersprüchliche Hashes derselben
Quellen-ID und Dokumentversion sind unzulässig.

Personen-/Vertrags-/Rechtsevidenz und Ergebniszustände besitzen getrennte
Typen. P1 erzeugt daraus keine personenbezogenen Feststellungen, keine Ergebnisse
und keine Vergleichsrevision. Hersteller- und Bankverfügbarkeit bleiben getrennt.

M1/M2/M3 haben ausdrückliche Katalog-Versionskennungen. Die Kennungen bezeichnen
hier den Fähigkeitsvertrag und implementieren keinen Vorwärtskern. Unbekannte
Kennungen werden abgelehnt. M3 bleibt ohne vollständige finale Herstellerbelege
zu Anlage, Kosten, Garantie, Auszahlung und numerischen Referenzfällen gesperrt.
Die Inhalte und Orakel dieser Belege sind später unabhängig fachlich abzunehmen.

Garantie und Wertsicherungsziel sind eigene Varianten. Ein datiertes
Wertsicherungsziel ist keine Beitragsgarantie. Der Garantiezustand gilt nur
zum Vertragsablauf. Es gibt keinen Auffüllmechanismus und keinen laufenden
Kapitalboden. Fehlender Rentenfaktor bleibt offen, die Rentenoption bleibt
darstellbar. Eine Faktorref muss genau dem Produkt und Tarif zugeordnet sein,
die Phase `payout`, die Einheit EUR und `purpose:annuity_factor` tragen.
Ein numerischer Faktor verlangt Klasse B, `approval:approved`, verbotene
Szenario-Overrides sowie einen finalen Herstellerbeleg mit dem Zweck
`annuity_factor`. Eine gewöhnliche EUR-Verwaltungsgebühr reicht nicht aus.
Ein offener Faktor bleibt O/null mit `approval:open`, ohne nutzbaren Zahlenwert.
Diese Referenz ist keine automatisch berechnete Rentenzusage.

## Fonds und Portfolios

Fonds haben eigene Identitäten, Anlageklassen, optionale belegte ISIN und eine
getrennte informative TER. Eine angegebene ISIN benötigt gültiges Format,
Prüfziffer und Herstellerbeleg. Nicht bekannte ISIN bleibt null.
Eine informative TER löst niemals automatisch einen Kostenabzug aus.

Gewichte sind ganzzahlige Basispunkte: 10.000 entsprechen 100 Prozent.
Komfortportfolios dürfen ihre unveränderten dokumentierten Gewichte behalten.
Nur individuelle Antragsgewichtungen verlangen Schritte von 1.000 Basispunkten.
Negative, doppelte, unvollständige oder nicht auf 10.000 summierende Positionen
werden abgewiesen. Tarife dürfen nur Portfolios mit ihren freigegebenen Fonds-
referenzen verwenden. Fonds- und Produktrevisionen sind unabhängig.

## Kosten

`CostData` trennt Produkt, Tarif und Phase ausdrücklich.

| Variante | Vertrag und Sperrgrenze |
| --- | --- |
| K1 Ansparen | Freigegebener A-Arbeitsparameter, Jahresquote als Dezimalzahl, Effektivkosten-Renditeminderung, kein individuelles Angebot. M1-additiv und M2-Bestandsfaktor haben getrennte Versionskonventionen. |
| K2 | Explizite Komponenten, Quellenbeleg des Tarifstands, Bemessungsgrundlagen, Phasen und Zeitpunkte. Unvollständige Daten dürfen nur als gesperrt erfasst werden. Verifizierte Aktivierung verlangt vollständige Deckung, nachgewiesene B-Gebühren und einen finalen Tarifkostenbeleg. |
| Auszahlung offen | Separater offener Kostenstand. Nicht als Kostenfreiheit verwendbar. |
| Auszahlung vor Kosten | Ausdrücklich benanntes Vor-Kosten-Szenario, keine tarifliche Nullkostenbehauptung. |
| Auszahlung monatlich fix | EUR-Parameter, höchstens zwei Dezimalstellen, verpflichtende Konvention zur Deckelung auf den verfügbaren Bestand. |
| Auszahlung jährliche Bestandsquote | Separater Jahresparameter und eigene Konventionskennung. |

`validateCostSelection` verlangt für einen Produkt-/Tarifpfad explizit je
eine Anspar- und Auszahlvariante. Zwei Modi in derselben Phase werden auch bei
abweichenden Komponenten abgelehnt. Bereits in Renditen enthaltene Komponenten
sind phasenbezogen zu registrieren. Identische Kosten dürfen nicht erneut in
K1/K2 oder einem Proxy belastet werden. K2-Komponenten dürfen sich zeitlich nicht
überlappen. Unterschiedliche Gebühren derselben Komponente müssen vorab zu einem
belegten nicht überlappenden Komponentenvertrag aufbereitet werden.

Die Deklaration eines K2- oder Proxy-Kostenvertrags aktiviert ihn noch nicht
für ein Modell. `validateCostSelection` prüft für jede tatsächlich verwendete
K1-/K2-/Monatsfix-/Jahresquoten-Parameterref zusätzlich das ausgewählte Modell
und dessen exakte Version. Eine leere Modellliste ist kein Platzhalter für
alle Modelle. Die synthetischen K2-/Fixkostenbeispiele deklarieren M1/M2
ausdrücklich. Katalogparsing darf einen nur für M3 vorgesehenen Parameter
darstellen, seine Verwendung in M1 oder M2 bleibt gesperrt.

**R83-N2: beidseitige Zweckbindung.** Die zentrale Parameterprüfung verlangt
den erwarteten Zweck ausdrücklich. K1, verifizierte K2-Komponenten sowie fixe
und jährliche Auszahlkosten verwenden ausschließlich `purpose:general`.
Das gilt bereits bei der Katalogsemantik und erneut bei der konkreten
Kostenauswahl. Ein als `annuity_factor` deklarierter Parameter wird nicht durch
passende Einheit, Eigentümer, Phase, Freigabe oder Modellversion zum zulässigen
Kostenparameter. Der Rentenfaktor-Kontext verlangt umgekehrt weiterhin
ausdrücklich `annuity_factor`.

Gesperrte unvollständige K2-Deklarationen bleiben als nicht aktive Daten
darstellbar. Ihre Erfassung ist keine Bestätigung der Kostenverwendbarkeit.
Eine Auswahl bleibt bis zur fachlichen Korrektur gesperrt. Offene Kosten und
O/null-Faktoren erhalten ihre bisherigen Zustände. Es entsteht keine neue
Zweckklasse oder Parametertaxonomie.

Kein mathematischer Abzug wird ausgeführt. Die tatsächliche M1-/M2-Wirkung,
Reihenfolge von Marktrendite und Kosten sowie Fixkostendeckelung sind spätere
Integrationspflichten. Die sechs echten Arbeitswerte werden nicht verändert.

## Fallbezogener Override

`applyCaseOverride` verlangt eine aktuelle exakte Basisreferenz, Fall-ID,
Grund, Stichtag und ausdrücklich Klasse S. Nur mit `overridePolicy:scenario`
freigegebene Parameter können überschrieben werden. B bleibt geschützt.
Der Rückgabewert enthält Originalreferenz und effektiven Override getrennt.
Es wird kein zentraler Datensatz geändert, gespeichert oder neu berechnet.

## Abnahme und Folgepflichten

Die Tests in `tests/browser/avd-catalog-contract.spec.ts` laufen automatisch
im bestehenden Playwright-Vollgate und damit in der vollständigen PR-CI.
Sie enthalten Domänenfälle und eine echte Browserprüfung des gebündelten
Validators gegen unveränderte UI-/Storage-Zustände. Typecheck erfasst sie
über den bestehenden Include-Pfad. Keine neue Dependency und kein CI-Eingriff.

| Fachfall | P1-Nachweis | Noch offen |
| --- | --- | --- |
| F09 | Sechs synthetische Produkt-/Kostenidentitäten und M1/M2-Konventionen | Öffentliche Echtdatenfreigabe, echte Kostenbindung, numerische M1-Reproduzierbarkeit in A4 |
| F10 | Komponentenregister und Ablehnung erneuter TER-Belastung | Tatsächlicher Kostenabzug in A4/A5 |
| F11 | Komfortgewichte ohne individuelle Zehn-Prozent-Regel | Freigegebene reale Portfoliodaten und numerischer A4-Pfad |
| F12 | Individuelle Schrittregel und 100-Prozent-Summe | Antrags-/A3-Integration |
| F13/F14 | Getrennte Garantie-/Wertsicherungsvarianten, Stichtagsbindung | Tatsächliche Produktdaten und Kapitalpfade |
| F17 | Offene Rentenfaktoren und eigenständige Rentenoption | Angebotswertintegration und Auszahlung in A5 |
| F19 | Unveränderliche Parameter-/Kostenrevisionen und isolierte Overrides | P2-Invalidierung, Neuberechnung und historische Exporte |

Keine Aussage, dass F09–F14, F17 oder F19 insgesamt bestanden sind.
Reale Produkt-/Fonds-/Tarifdaten werden erst nach belegter Freigabe eingespielt.
Original-V0.1-Golden-Quellen und AP-07c werden durch P1 weder ersetzt noch geschlossen.
Vor Integration bleiben vollständige finale CI, zwei unabhängige GO desselben
Stands und Leons gesonderte Integrationserlaubnis erforderlich.
