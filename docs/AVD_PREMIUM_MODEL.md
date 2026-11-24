# AVD-PREMIUM-MODEL

Wirtschaftsmodell für A1 bis A4. Regelstand `FE-01-D4/2026-11-24`, Modell `avd.premium-model.v1`. Die geprüfte Fachnorm trägt SHA-256 `20466d427898fdd64336c3830c898cdf7a717fe2a673d67aa7c5971489c0aaed`. Die Fortschreibung vom 24.11.2026 ergänzt die Modell- und Integrationsanforderungen. N2-K1 und V0.5.2 gelten für die fortbestehenden Konventionen. E1-D4 behält seinen eigenen Geltungsbereich.

## Einstieg für A3 und A4

- `premium-session.ts` nimmt den versionierten Fallentwurf entgegen. `edit` invalidiert den aktuellen Vergleich vor der Validierung. `reserve` bindet den nicht wiederverwendbaren Entwurf, die neue Vergleichsrevision, Zeitpunkt und Preisbasis. `commit` vergleicht den reservierten Stand und schreibt den Vergleich in einer synchronen Sitzungstransaktion.
- `SavingsInputs.profiles` enthält für eine Produkt-/Tarif-Identität höchstens eine aktuelle Konfiguration. Modellkurven referenzieren nur Produkt und Tarif. Eine zweite aktuelle Konfiguration sperrt die betroffenen M2-Kurven. A3 und A4 können dieselbe `AllocationProfile` übergeben. Die Ergebniszeilen enthalten Zielgewichte, Zuflussgewichte, modellierte Ist-Gewichte und die wirksame Monatsendaktion.
- `buildPremiumDraft` verbindet den vorhandenen A2-Einzahlungsplan, den getrennten Modellzeitraum und den ausgewählten Förderplan mit A4. Die explizite Buchungsannahme bleibt beim Wechsel von A2 nach A4 erhalten. Die Kursannahmen für das neutrale Gesamtmodell stammen aus einer gemeinsamen Eingabe und drei Szenarioabständen. Die frühere Detailanalyse bleibt über ihren bestehenden Einstieg verfügbar.
- `createPremiumSession` und `calculateCurve` unterstützen einen explizit übergebenen Katalog. Geschützte Arbeitseingaben dürfen nur in einer hierfür berechtigten internen Umgebung geladen werden. Der öffentliche Seiteneinstieg lädt keinen Arbeitskatalog. Öffentliche Demos verwenden ihre eigene synthetische Datenbasis.

## Rechen- und Versionsvertrag

| Grundlage | Implementierung und Ergebnis |
| --- | --- |
| D4-01 | `premium-series.ts` verwendet effektive Gesamtrendite für Neutral/M1. `model-decimal.ts` liefert die gemeinsame Dezimal36-Arithmetik. M1/K1 zieht den Effektivkostenansatz einmal von der Jahresrendite ab. M2/K1 wendet seinen Monatsfaktor einmal vor den Zuflüssen an. Kostenbenchmarks zeigen eine Endwertdifferenz. Belegte K2-Monatsbelastungen erfordern einen vollständigen zum Tarif passenden Plan und eine eindeutige Bausteinzuordnung. |
| D4-02 | `premium-calendar.ts` und `premium-timeline.ts` trennen Beitragsende, Bewertungszeitraum, Förderjahr und modellierten Auszahltermin. Die direkte Endannahme bleibt an ihre Ausgangsdaten gebunden. Bei Konflikt bleiben beide Monate sichtbar, bis eine ausdrückliche Entscheidung den Folgestand festlegt. |
| D4-03, D4-03a/b | `premium-funding.ts` führt Anspruch, Stände, Allokation, B-Beleg und S-Ereignis getrennt. Aktive Perspektiven verwenden disjunkte Ereignisse. Der Öffnungsbestand hat eine eigene Identität. Ein offener Elternausgleich sperrt die vollständige Kinderförderzahl. `premium-portfolio.ts` verlangt bei mehreren relevanten Zu-/Abgängen eine vollständige Reihenfolge und prüft die Deckung bei jedem Abgang. `specifiedEnd` enthält gegebenenfalls ein separat identifizierbares Teilmodell. `end` trägt bei unvollständiger Förderung den offenen Status. |
| D4-04, D4-04a | `premium-portfolio.ts` modelliert Startaktion, Monatsrendite, Stress, Kosten, Cashflows und Rebalancing. T−60/T−24 beziehen sich auf den ausgewählten Auszahlbeginn. Exposure wird auf den Bestand nach normaler Rendite angewandt. Bei mehreren Endaufträgen bindet die Auflösung die Hashes der ursprünglichen Aufträge. Monatliche Renditeinputs je Anlageklasse können die Konstanten deterministisch ersetzen. |
| D4-05, D4-05a | `premium-session.ts` bindet Ergebnisse, Fixierung und Ausgabe an dieselbe aktive Vergleichsrevision. Auswirkungen eines Kalenderwechsels betreffen automatisch bepreiste Realpfade. Wiederverwendete Teilresultate tragen Originalidentität und einen neuen Vergleichsbezug. Druck, PDF, CSV und JSON besitzen eigene Ausgaberechte. |
| D4-06 | `premium-price.ts` reserviert die Preisbasis mit Projektkalender oder direkter Auswahl. `premium-series.ts` deflationiert Zahlungen ereignisweise. Der Startbestand und signierte kumulierte Zahlungen bleiben getrennte Größen. |
| D4-07/08 | `premium-evidence.ts` verbindet fachliche Statusdaten für Kinderkarten und harte Präferenzen. Die Komponentenidentität bindet Person, Jahr, Vertrag und Eingaberevision. Tarifmerkmal, Kundenwunsch und Bankweg bleiben eigenständige Aussagen. |
| D4-09 | `premium-products.ts` verwendet exakte Katalogreferenzen und getrennte Kanalrechte. ETF-Bruttoreferenz und neutrales A4-Modell verwenden dieselben eigenen Zahlungen. Der Vergleich prüft Laufzeit, Rendite-, Kosten- und Preisbasis. Eine einseitige Wiederanlage führt zum offenen Vergleich. |

## Datenhaltung und Ausgabe

Session-Zustand lebt im Browser-RAM. Ein Reload beendet den Entwurf. Die bestehenden Fall- und IndexedDB-Schemata wurden nicht migriert. Geänderte oder unvollständige Eingaben sperren den aktuellen kombinierten Vergleich. Eine Fixierung dokumentiert den aktuellen Modellstand mit seinen S-Evidenzen. Der öffentliche Browserdruck blendet die A4-Vorschau aus. Die vier Ausgabekanäle sind im öffentlichen Sitzungseinstieg gesperrt.

ORG-O01 bleibt offen. Öffentliche Quellen, Build, Vorschau und Tests enthalten nur synthetische Kostenreferenzen. Der interne Katalogpfad kann die berechenbare Modellfähigkeit ohne Freigabe für einen öffentlichen Ausgabekanal ermitteln. Die separate Arbeitsdatenquelle und ihre Rechteprüfung gehören in die dafür berechtigte Umgebung.

## Ausführbare Beispiele

`npm run test:avd-premium` führt fachliche und technische Gruppen aus. Die zugehörigen Grunddaten stehen in `tests/fixtures/avd-premium-model.synthetic.json`. `tests/browser/avd-premium-model.spec.ts` prüft den sichtbaren A2/A4-Förderübergang, Renditepräzision, den ungültigen Entwurf, das Fokusziel nach einem Einmalzahlungsfehler und den Browserdruck. Die bestehenden Berechnungs- und UI-Tests bleiben Teil des Vollgates.

Die Folgeschnittstelle für die Premium-UX umfasst `TimelineDraft`, `SavingsInputs`, `AllocationProfile`, `CurveRequest`, `Snapshot` und die `Subresult`-Identitäten. Der vollständige nachfolgende Interaktions-, Desktop-, Zoom- und menschliche Screenreader-Nachweis gehört zum gesonderten UX-Auftrag. Fachliche Sollfallnummern verweisen auf den Originalkatalog mit seiner normativen Version und auf tatsächlich ausgeführte technische Fixtures.

## Fachliche Fortsetzung R88-F01 bis F05

### Förderakte in A2

`avd.funding-evidence.v1` ist ein sitzungsgebundener Import für eine vorbereitete fachliche Förderakte. Die Datei wird lokal gelesen, strukturell geprüft und an den A2-Stand gebunden. Die Anwendung erzeugt aus den enthaltenen Referenzen keine eigene Echtheitsbestätigung.

| Feld | Inhalt |
| --- | --- |
| `personYears` | Eine Zeile je Person und Förderjahr. Geprüftes oder ausdrücklich angenommenes Regime, förderfähige Beiträge je eindeutigem Vertrag, jahrbezogene Kinderzuordnung, Partnerprüfung, Nachweis zur Altersgrenze und zum Bonusvorbezug. `oldRiester` nimmt nur bei diesem Pfad Eingaben des bestehenden Alt-Riester-Rechenkerns an. |
| `allocations` in `personYears` | Beträge je Grund-, Kind- oder Bonuskomponente und Vertrag. Unmittelbare Zuordnung bis zu zwei Verträgen, mittelbare Zuordnung höchstens zu einem Vertrag. Bei fehlender Aufteilung bleibt der personenbezogene Referenzbetrag getrennt sichtbar. Vertragsscharfe Zuflüsse entstehen erst mit einer wirksamen Aufteilung und einem Ereignis. |
| `historicClaims` und `bookings` | Ursprüngliche Anspruchsversionen und B-Ereignisse mit externer Buchungs-ID, tatsächlichem Monat, Vorzeichen, Belegquelle und konkretem Anspruchs-/Vertragsteil. Ein negatives Ereignis verweist auf die ursprüngliche Buchung. Optional kann eine belegte Bausteinaufteilung mitgegeben werden. |
| `chosenSchedule` | Optional ausdrücklich gewählte S-Ereignisse. Jedes Ereignis bindet Person, Jahr, Komponente, Vertrag, Betrag, Buchungsmonat und die bereits berücksichtigten Buchungs-IDs. Ein Import ohne gewählten Plan aktiviert keinen S-Zufluss. |
| `opening` und `settlements` | Explizite Zuordnung bereits enthaltener Buchungen zum Startbestand sowie konkrete B-Ausgleichsnachweise für Altbuchungen bei Kinderumzuordnung. |
| `ownPayments` | Getrennte datierte Eigenzahlungen je Vertrag. Bei vorhandenen Kalendern wird der jeweilige Jahresbeitrag abgeglichen. Fehlende Kalender bei mehreren Verträgen lassen den kombinierten Pfad offen. |

`calculatePersonalFunding` verwendet die gemeinsame direkte Standardformel einmal auf den förderfähigen Personenjahresbeitrag. Zwei Verträge mit je 1.200 Euro ergeben im Originalfall D2-T25 insgesamt 540 Euro Grundzulage und 300 Euro Kinderzulage. Eine alte Buchung bleibt im ursprünglichen Monat erhalten. Änderungen an A2-Eingaben entwerten die betroffene S-Planung. A4 übernimmt die drei Förderperspektiven automatisch und erfragt keine zweite Förderauswahl. Kindergeld, Kindeszuordnung und Berufseinsteigerbonus behalten ihren Jahres- beziehungsweise Lebenszeitbezug.

### Gemeinsame A3/A4-Konfiguration

`RetirementEntry` hält die Konfiguration je Fall und exakter Produkt-/Tarifreferenz. A3 und A4 bearbeiten denselben Stand. Ein vertrauenswürdiger Host kann einen `PremiumWorkspace` mit validiertem Katalog, zugeordneten M1-/M2-Kosten, Monatsrenditepfaden, erlaubten Profiloptionen und Kanalrechten übergeben. Die öffentliche statische Anwendung übergibt keinen Arbeitskatalog und keine erweiterten Kanalrechte. Die in Playwright verwendete Host-Instanz wird ausschließlich für Tests synthetisch gebaut.

Profilwechsel, Anfangsbestand, Zuflussgewichte, datierte Änderungen, modellierter Auszahlbeginn und Endrebalancing durchlaufen den bestehenden Profil- und Portfoliokern. M2 und M2 mit Stress verwenden dieselbe effektive Profilidentität. Der modellierte Auszahlbeginn ist beim Lifecycle Bestandteil dieser Identität. Ein geänderter Stressinput wirkt auf seine eigene Kurve. M1 und Neutral können ihre unveränderten Teilresultate in einer neuen Vergleichsrevision nachweisen.

Weiche Garantie- und Auszahlwünsche beschreiben Orientierung. Der explizit bestätigte Tarifmerkmalabgleich bindet Tarifversion, Stichtag, Bezugsgröße und einschlägige Merkmalsquelle. Bankweg und Förderberechtigung bleiben eigenständige Aussagen.

### Erzeugte Berichte

`reserveOperation` und `commitDocument` begrenzen PDF und CSV auf den vollständigen fixierten Vergleich. Das Format erhält ausschließlich den reservierten Snapshot. Vergleichsrevision und Kanalrecht werden vor und nach der Dateierzeugung verglichen. Veraltete Ergebnisse gelangen weder ins Archiv noch in den Download. Ältere Dokumente enthalten ihren Zeit- und Revisionsbezug und sind als historisch gekennzeichnet. Ein erneuter Abruf verwendet die archivierten Bytes. Die Sitzungsablage endet mit dem Vorsorgeentwurf beziehungsweise einem vollständigen Neuladen der Anwendung. Heruntergeladene Dateien verbleiben beim Nutzer.

Die Browserdrucksperre der Live-Vorschau bleibt aktiv. ORG-O01 bleibt offen. Geschützte Arbeitswerte und ihre abgeleiteten Ergebnisse werden vom öffentlichen Einstieg ferngehalten. Die organisatorische Zulassung eines internen Hosts und seiner Ausgabekanäle ist Voraussetzung für die Verwendung der dortigen Arbeitsdaten.

### Nachprüfbare Gegenfälle

`scripts/verify-avd-premium-continuation.ts` enthält fachliche Gegenrechnungen und Sperrfälle. `tests/browser/avd-r88-continuation.spec.ts` führt die integrierten A1/A2/A4-Übergänge, die zentrale A3/A4-Konfiguration und echte PDF-/CSV-Downloads aus. Die synthetische Fixture in `tests/browser/avd-r88-fixtures.ts` ermöglicht eine Reproduktion ohne Hersteller- oder Kundendaten.
