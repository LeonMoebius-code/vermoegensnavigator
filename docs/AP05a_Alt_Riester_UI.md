# AP-05a – Flüchtige Bestandsaufnahme und bedingter Fördervergleich B1/B2

## Technischer Vertrag vor Implementierung – 28.10.2026

Frisch bestätigte Basis: `d2ef1d5b59b729ccdecc04f8d45095bb18bcb56f`,
Tree `c02b4c983cde76d8115172c13c154336a47fdb4e`, Version 0.18.4 / Schema 11.
PR #63 integriert; offene #43 und #60 sowie fremde Originale bleiben unberührt.
Sauberer isolierter Clone; kein vorhandener AP-05a-Branch/PR. GitHub-App-Pushrecht
lesend bestätigt; authentifizierter API-Transport nach D-05 vorgesehen.
AGENTS, Operating Model, Status/Decisions, AP-01a/b und AP-04a sind maßgeblich.
Der Statuscheckpoint ist historisch. Der konkrete AP-05a-Auftrag begrenzt V0.4.

### Entscheidung zur Szenariobestätigung

B2 beschreibt zwei alternative Zustände derselben Person im selben Beitragsjahr.
Der Altzustand wird niemals durch neue Szenarioangaben verändert. Die neue Seite
beginnt unabhängig unbestätigt. Nur eine ausdrücklich **vorgelagert fachlich geprüfte
hypothetische Standardkonstellation** darf bestätigt werden: neue unmittelbare
Berechtigung, neues Jahresregime, ein förderfähiger Vertrag einschließlich
geklärter Übergangsannahme, vollständige eigene Kinderzuordnung und derselbe
förderfähige Jahres-Eigenbeitrag. Die Prüfung muss die Voraussetzungen **innerhalb
dieser alternativen Konstellation** bestätigen, einschließlich des dort als wirksam
angenommenen Übergangs; ein bloß gewünschtes „Was wäre wenn“ reicht nicht.

`new_confirmed` bezeichnet ausschließlich diesen bestätigten Eingabesnapshot an
AP-01a, keine Tatsache über den realen Altbestand. Dies nutzt den ausdrücklich
beauftragten bedingten Modellvergleich; der reine Kern ermittelt keine Historie
und bestätigt selbst keine Belege. Ohne tragfähige vorgelagerte Prüfung bleibt die
neue Seite `review_required`. Es gibt keinen automatischen Ersatz, keine behauptete
Wechselmöglichkeit und keine tatsächliche Wechselhandlung. Einzelne reale Fälle
können deshalb keinen zweiseitigen Vergleich erhalten. AP-01a/b bleiben bytegleich.

### Geplanter erlaubter Diff

- `retirement-entry.tsx`: B1/B2 sowie getrennte A/B-States im vorhandenen Lebenszyklus.
- Neues `old-riester-adapter.ts`: sichere UI-Datenkopie, explizite Statuszuordnung,
  vorhandener AP04a-Centparser/Beitragsbildung, Aufruf beider unveränderter Kerne.
- `globals.css`: ausschließlich `.retirement-*`-Ergänzungen.
- Neue `tests/browser/ap05a-*.spec.ts`: Adapter/Domain-Matrix und echte Browserpfade.
- Diese Datei als öffentlicher Bedien-/Grenzvertrag.
- Unvermeidlich: **nur** die überholte B-gesperrt-Erwartung im ersten AP04a-Test
  auf den jetzt beauftragten aktiven B-Einstieg umstellen. Die Prüfung bleibt
  verpflichtend, alle anderen AP04a-Assertions bleiben erhalten. Das ist eine
  Solländerung durch B-Aktivierung, keine Abschwächung einer Schutzprüfung.

Keine Änderung an `app/page.tsx`, Domain, Fixtures/Runnern AP01a/b, allgemeinem
Fall/Store, Import/Export/XLSX/Druck, Version/Schema, package/Lock, Build oder CI.

### Zustands- und Verlustschutz

Alle rechtlichen Bestätigungen beginnen unbestätigt. Jahrwechsel entzieht alle
zeitbezogenen Alt-/Neu-/Kinder-/Beitrags-/Bonusbestätigungen. Betrag, Qualität,
Monatsmodus und Kinderänderungen entziehen abhängige Bestätigungen. Jede B-Änderung
entfernt beide Vorschauen und die Differenz synchron. A/B-Wechsel erhält getrennte
Entwürfe, entfernt Ergebnisse; keine Übertragung von Bestätigungen. Vor Verlassen
oder Neustart gilt der gemeinsame AP04a-Verlustdialog; Abbruch erhält beide Entwürfe.
Unmount/Reload verwerfen alles, ohne Wiederherstellung oder Speicherung.

Nur `calculated` zeigt Domainbeträge. Offene/ungültige/ausgeschlossene Fälle zeigen
Gründe ohne M, Quote oder Zulage. `unsupported` ist keine Feststellung fehlenden
gesetzlichen Anspruchs. Die Differenz Neu minus Alt in Ganzzahl-Cents erscheint
nur für zwei berechnete Seiten und bestätigte identische Vergleichsbasis. Bonus,
Steuern, Kosten, Rendite, Vertrags-/Übertragungswerte und Garantien sind ausgeschlossen.
2026 hat keine neue Seite; über 6.840 EUR sperrt ausschließlich die neue Seite.

## Nachweise

Die ausführbaren Tests und finalen Original-CI-/Identitätsnachweise werden im
identischen externen Abnahmepaket B05-01 bis B05-32 zugeordnet. Kein eigenes GO;
kein Merge, Release oder Deployment. AP-02b und alle weiteren Teilpakete bleiben HOLD.

## Erneuter amtlicher Quellenabgleich

Abrufkontrolle am 28.10.2026: BGBl. 2026 I Nr. 156 und BMF 05.10.2023
wurden vollständig direkt heruntergeladen. Originalbytes sind identisch zum
AP00-/AP01b-Stand (576.530 bzw. 1.053.086 Bytes; SHA-256
`88e8bedbc87566c0943433e767a1f2b42d3089adade3235e38f2acf153dc04ce` bzw.
`1e4a497736773c4ec9a4f9751daf3a72bd32cc72d1739a0e6804b7eb87fba62b`).
Einzelne Recherchezugriffe lieferten 403/503; die erfolgreichen Direktabrufe
ersetzen diese Zugriffslücke für die beiden Originaldateien. DRV-Jahresfassungen
und BMF-FAQ wurden ergänzend abgeglichen. Gezielte amtliche Suche ergab keinen
belegten Ersatz der einschlägigen BMF-Randnummern; keine Vollständigkeitsgarantie
oder automatische Rechtsfortschreibung. Fester Domainprüfstand bleibt erhalten.

Die Browserregressionen prüfen beide gesetzlichen Jahreszuordnungen als
vorgelagerte Bestätigung; die Oberfläche ermittelt diese nicht aus Rohhistorien.
Insbesondere bleibt 2028 Alt: erster Kindergeldzeitraum plus aktuelle
Elternzuordnung; Neu: letzter Zeitraum plus aktuelle Elternzuordnung.

## Test- und Umsetzungsgrenzen

Die Adaptertests bilden alle G01–G17 / N01–N29 und zusätzlichen Rekonstruktionen
der unveränderten AP01b-Fixture auf den UI-Eingabevertrag ab. Negative/Subcent-
Werte werden bereits durch den exakten UI-Parser gesperrt; zulässige Fälle werden
vollständig gegen Original-Domainausgaben verglichen. Zusätzlich 252 generierte
Einkommens-/Beitrags-/Kinder-/Jahressnapshots einschließlich Rundungssperren,
getrennte Neurechtsgates sowie Daten-Deskriptor-/Array-/Proxy-Gegenproben.

Echte Browserpfade prüfen B05-01..32, alle sechs Vergleichszeilen, Navigation,
Jahreswechsel, Verlustschutz, Reload, Fokus, aria und 390/1440 px. Exakt vollständige
JSON-Fallinhalte, sämtliche XLSX-Blattinhalte und Drucktext werden vor/nach B2
verglichen; feste synthetische Modulzeitstempel vermeiden zufällige Exportdefaults.
Keine Zeitfelder werden ausgefiltert. Bestehende Import-/Restore-Regressionen
laufen unverändert im regulären Gate. Originale Fach-, Browser-, CI- und Gitbelege
stehen im externen identischen Abnahmepaket, keine Vorwegnahme einer Abnahme.

Lokale Chromiuminstallation scheitert am beschädigten Downloadarchiv. Lokales
Gesamt-Verify ist deshalb nicht als bestanden auszuweisen. Autoritative volle
Browser-/R1-/Diffnachweise müssen aus beiden finalen regulären GitHub-Gates stammen.
