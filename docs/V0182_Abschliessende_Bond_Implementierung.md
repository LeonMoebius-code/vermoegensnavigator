# V0.18.2: abschließende Bond-Implementierung

Stand: 21.09.2026. Ausgangspunkt dieses Abschlussnachtrags: `ce9e5d666271b95cebd88c468f8f88dbf9878a33`, bestehender Branch `work/v0182-bond-hardening`, PR #7. CP0 bis CP4 bleiben abgeschlossen.

## Implementierter Umfang

- `structure-overview` Profilversion 2 wird nur bei vollständiger, eindeutiger 29-Spalten-Signatur erkannt. Die Kopfzeile wurde lokal gegen die vorhandene Original-Kopfzeile abgeglichen. Nur Spaltennamen wurden geprüft, keine Kundendaten in Fixtures oder Repository übernommen. Reihenfolge darf variieren, Schreibweise und Whitespace werden normalisiert. Die beiden persönlichen Spalten werden nicht übernommen.
- Berichtswährung EUR: fachlich vom Nutzer bestätigte Formatkonvention dieses Exportwegs. Prozentnotierung geeigneter direkter Renten, Nominal in Wertpapierwährung, Dirty-Marktwert und absolute Stückzinsen in EUR, FX als Wertpapierwährung je EUR: empirisch durch CSV, Screenshot und Gegenrechnungen gestützt und im Auftrag vorgegeben. Keine Herstellerbestätigung. Exportidentität allein beweist keine EUR-Konfiguration außerhalb dieses ausdrücklich unterstützten Exportwegs.
- EUR mit leerem FX und positivem Stückzins funktioniert. Fremdwährungswerte werden durch den Quell-FX dividiert, Reporting-Stückzins wird für die Modellprüfung zurück in die Bondwährung umgerechnet. Fehlender erforderlicher FX sperrt nur die betroffene Dirty-/Modellrechnung. Der in EUR ausgewiesene Marktwert bleibt im vollständigen Coverage-Nenner.
- Profilversion 1 und verkürzte/unbekannte Formate werden nicht rückwirkend zu bestätigten EUR-Quellen aufgewertet. Schema 11 bleibt bestehen. Profilversion, Einheitensemantik, Evidenz und Feldvalidität bleiben über Speichern, JSON und Restore erhalten. Berechnete Modelle/Kennzahlen werden nicht zusätzlich persistiert.
- Genau drei Kuponkandidaten: jährlich, halbjährlich, vierteljährlich. Kalender rückwärts vom unveränderten Fälligkeitsanker in 12/6/3 Monaten, Monatsendregel und Schaltjahre, keine bereits vergangenen oder t=0-Zahlungen. Jahreskupon wird durch die Frequenz geteilt. Keine aus AI rückgerechneten Zinsbeginne, keine zusätzlichen Frequenzen oder erfundenen Sonderperioden.
- ACT/ACT coupon-period, ACT/365F und reguläres 30E/360 werden getrennt geprüft. Vorläufiges diagnostisches Grundband 0,05 Preispunkte je 100. Nur nachgewiesene größere Quantisierungsunsicherheit erweitert auf zweimal diese Unsicherheit. Unbekannte Herstellerpräzision bleibt unbekannt. Altes Kursdatum erweitert dieses Band nicht.
- Doppelwährungsanleihen werden als Sonderstruktur erkannt und erhalten keine normale Festzins-YTM. Lebenszyklus-/Hybridfonds und wertgesicherte Fonds bleiben wirtschaftlich ohne belegten Mix ungeklärt. Rohstofffonds sind indirekte Fonds. Vorherige Aktienanleihe-, Mischfonds- und Katalogmix-Korrekturen bleiben erhalten.

## Modellauswahl und Kennzahlen

| Befund | Einzelanzeige | Aggregate |
| --- | --- | --- |
| Genau ein Kandidat kompatibel | Frequenz **rechnerisch abgeleitet**, nicht vertraglich bestätigt. Indikative YTM und sämtliche Folgekennzahlen aus demselben Plan. | Bei gültigem vergleichbarem Marktwert und Einbeziehung zulässig. |
| Mehrere Kandidaten kompatibel | Alle passenden Modellalternativen separat. Wenn Jahr kompatibel ist, zusätzlich ausdrücklich bezeichnete Jahresmodellannahme. Ohne passenden Jahreskandidaten keine einzelne YTM. | Alle mehrdeutigen couponabhängigen Kennzahlen konservativ ausgeschlossen. Kein frei gewählter Wesentlichkeitsschwellenwert. |
| Kein Kandidat kompatibel | Keine Standard-YTM, Duration, DV01 oder Zinsszenarien. | Keine Einbeziehung dieser Kennzahlen. |
| Stückzins fehlt | Bei eindeutiger Dirty-Basis Jahresmodellannahme, Prüfung nicht durchführbar. Fehlend ist nicht numerisch null. | Wie fachlich zugelassen indikativ verwendbar, Annahmestatus gesondert sichtbar. |
| Stückzins ungültig/negativ | Keine Freigabe als bloß fehlender Wert. Konkreter Fehlergrund. | Keine couponabhängigen Aggregate. |
| Expliziter Nullkupon | Bei konsistenten Eingaben identischer positiver Rückzahlungsplan für alle Frequenzen. | Frequenzunabhängig verwendbar. |

Laufende Verzinsung, Restlaufzeit, Marktwerte und Fälligkeitsleiter behalten eigene Voraussetzungen. Die Leiter bleibt nach Nominalwährung getrennt, unabhängig von der Aggregatcheckbox. Durchschnittswerte verwenden nur gültige vergleichbare ausgewählte Werte. Coverage verwendet den gesamten direkten EUR-Berichtsmarktwert einschließlich unberechenbarer und ausgeschlossener Positionen. PLAN skaliert Nominal, absoluten Stückzins und DV01 proportional, Einzel-YTM und Duration bleiben unverändert. UI, Excel und Druck nutzen denselben zentralen Datenbuilder. Die Darstellung ist dabei bewusst gestuft: Kundenausgaben enthalten Ergebnisse und wesentliche Einschränkungen, während Frequenzstatus, Alternativen und vollständige Fehlgründe im technischen Nachweis verbleiben.

## Kundenfähiger Abschlussnachtrag

- Die Standardansicht zeigt als Hauptkennzahlen nur die indikative Rendite bis Fälligkeit und die laufende Verzinsung. Anzahl und wertbezogene Coverage stehen unmittelbar an der jeweiligen Kennzahl. Modified Duration, DV01, Szenarien, vollständige Coverage-Zerlegung und die Auswahlcheckbox liegen im standardmäßig geschlossenen Bereich `Fachliche Details und Datenprüfung`.
- Wesentliche Einschränkungen werden einmalig und kompakt zusammengefasst. Die Kundentabelle enthält Depot, Wertpapier, Marktwert, Fälligkeit, indikative Rendite und einen verständlichen Status. Vollständige Modellalternativen, Stückzinsbänder, Quellenprofil und Einzelvoraussetzungen bleiben im Detailbereich erhalten; die Berechnungsquelle wurde nicht dupliziert.
- Excel enthält ein kompaktes Hauptblatt `Zins & Laufzeiten` mit Überblick, Hinweisen, Fälligkeitsübersicht und Positionen. Das neue Blatt `Technische Nachweise` enthält die ausführlichen Diagnoseinformationen. Beide Blätter werden aus demselben IST-Builder erzeugt und als echte XLSX-Datei wieder eingelesen. Bestehender Schutz vor ausführbaren Formeln aus importiertem Text bleibt geprüft.
- Der normale Druckbericht enthält nur den kompakten Überblick, wesentliche Hinweise, Fälligkeits- und Positionsübersicht. Redundante Coverage-Blöcke, Modellalternativen und technische Rohdiagnosen sind nicht Bestandteil der Kundenausgabe.
- UI und Export weisen ausdrücklich darauf hin, dass Excel und Druck stets den IST-Bestand enthalten, auch wenn interaktiv PLAN gewählt ist. Die vorhandene IST-/PLAN-Fachlogik und sämtliche Berechnungsergebnisse blieben unverändert.
- Stückzinsen werden beim validierten agree21-Profil v2 als `EUR-Berichtswährung` bezeichnet, auch bei USD-Nominal. Für Profilversion 1 oder gemischte/ungeklärte Konventionen lautet die Beschriftung profilabhängig und die Einzelzeile weist `Währungskonvention ungeklärt` aus. Es erfolgt keine Profilaufwertung und keine Betragsänderung.

## Gezielter Testnachweis

Neue obligatorische Suite `npm run test:bond-final`, zwölf Gruppen, vollständig künstliche Namen, Kennungen und Beträge:

1. Originalgetreue 29-Spalten-Signatur, positive AI bei EUR/FX leer, Profilabgrenzung und Evidenzvalidierung.
2. Eindeutige Jahres-, Halbjahres- und Quartalsmodelle. Unabhängige Python-Decimal70-Sollpreise für fünf Tage Restlaufzeit und 5 % Rendite: 105,92917767817603 / 102,93118208351067 / 101,43218428617799 bei Jahreskupon 6 %. Macaulay 5/365 und Modified 0,01304631441617743. DV01 separat durch Finite Difference geprüft.
3. Mehrdeutigkeit mit deutlich verschiedenen Renditen, kein Residualsieger, Ausschluss aus Aggregaten. Auch nur Halbjahr/Quartal kompatibel ohne zulässige Jahresannahme.
4. Kein passendes Modell, fehlende/ungültige AI, Nullkupon, fehlende und überschrittene Fälligkeit.
5. Fremdwährung, FX-Richtung, AI-Umrechnung, lokale und EUR-DV01, vollständiger EUR-Nenner trotz fehlendem Fremdwährungs-FX.
6. Monatsende, Schaltjahr, nichtmonatlicher Endtag ohne Drift, strikt zukünftige Zahlung, getrennte Tageszählung, Grundband und dokumentierte Quantisierungsanpassung.
7. Doppelwährungsanleihen und Fonds-Sondertypen, Erhalt bisheriger Klassifikationskorrekturen.
8. Marktwertgewichtung, Coverage, Szenarien, Ausschluss, IST/PLAN, Speicheradapter, JSON, Schema11-Snapshot und Replacement.
9. Kundenfähige Standardansicht getrennt von weiterhin zugänglichen technischen Diagnosen und der funktionsfähigen Auswahlcheckbox.
10. Profilabhängige Stückzins-Währungskennzeichnung für USD-Nominal im bestätigten EUR-Profil sowie ungeklärte Altkonvention ohne EUR-Aufwertung.
11. Leerer, vollständig berechenbarer, teilweise berechenbarer, vollständig nicht berechenbarer und großer Bestand mit ehrlichen Präsentationszuständen.
12. Tatsächliche Excel-Datei erzeugt und erneut eingelesen: kompaktes Hauptblatt und separates technisches Nachweisblatt. Tatsächliches Export-/Druck-React-HTML ist kundenfähig und enthält keine technischen Rohdiagnosen; technische Nachvollziehbarkeit und Formel-Injection-Schutz bleiben geprüft.

Die bisherigen 22 Bond-V2-, neun CP3- und vier CP4-Gruppen bleiben erhalten. Fachlich geänderte Erwartungen sind explizit angepasst: Halbjahres-Kurzläufer wird jetzt gelöst statt pauschal verworfen. Unbekannte Rundungspräzision nutzt das vorläufige Grundband. Explizite AI=0 am gemeinsamen Kupontermin ist mehrdeutig. Die CP3-Referenz mit unveränderten unabhängigen Einjahres-Sollzahlen nutzt daher fehlende AI und die offengelegte Jahresannahme, nicht eine behauptete Frequenzbestätigung. Der neue Mehrdeutigkeitstest prüft den ehemaligen AI=0-Fall ausdrücklich.

Vollständiges lokales Release-Gate bestanden: `test:3b`, `test:4b`, `test:risk-v2`, `test:multi-depot`, `test:modelportfolio`, `test:cp1`, `test:bond-v2`, `test:cp3`, `test:cp4`, `test:bond-final`, Typecheck, Produktionsbuild und `git diff --check`. Das unabhängige vorhandene Decimal70-Referenzskript wurde ebenfalls ausgeführt. Neue Suite ist obligatorisch in CI und Typecheck aufgenommen.

## Offene Abnahmegrenzen

Der statische Produktionsbuild wurde im verwalteten Browser mit einer synthetischen agree21-Profil-v2-CSV interaktiv geprüft. Import, Kundenansicht, IST/PLAN-Umschaltung, geschlossener und geöffneter Technikbereich, EUR-Stückzinskennzeichnung sowie der stets sichtbare IST-Exporthinweis wurden bestätigt; die Browserkonsole blieb ohne Warnungen oder Fehler. Der Aufruf der nativen Druckvorschau erzeugte im In-App-Browser kein zugängliches Vorschaufenster. Gedrucktes React-HTML wurde automatisiert geprüft. Native PDF-Paginierung, physischer Druck und Excel-Desktopdarstellung bleiben ungeprüft.

Die bekannten npm-Sicherheitsbefunde bleiben offene Release-Voraussetzung: `esbuild 0.28.0` (LOW, Windows-Entwicklungsserver) und `xlsx 0.18.5` (HIGH, Prototype Pollution/ReDoS). Es erfolgte kein Dependency-Update, kein `npm audit fix --force` und keine Sicherheitsfreigabe.

Frequenzpassung beweist weder Vertrag noch Kalender, Rückzahlung, Feiertagsregeln oder Bonität. Es gibt keine neue Behauptung über die endgültige Verteilung der 79 historischen Festzinspositionen. Die frühere 28/8/37/5/1-Aufteilung betrifft nur die damalige Jahr/Halbjahr-Diagnose. Drei rückgerechnete mögliche Zinsbeginne werden nicht verwendet. Keine Performance-CSV, keine zusätzlichen Pflichtdaten, keine Vertragseditoren.

Implementierung bereit zur abschließenden fachlichen Funktionsabnahme. Finale Commit-SHA sowie Push- und PR-CI werden nach Veröffentlichung des Commits in PR #7 dokumentiert. Diese Dokumentation ist keine automatische fachliche Releasefreigabe. **Kein Merge und kein Deployment.**
