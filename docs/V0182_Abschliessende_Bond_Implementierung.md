# V0.18.2: abschließende Bond-Implementierung

Stand: 21.09.2026. Ausgangscommit `2094233c0d8eaa05e358ecd1c067fad0dc79d608`, bestehender Branch `work/v0182-bond-hardening`, PR #7. CP0 bis CP4 bleiben abgeschlossen. Die vier unmittelbar betroffenen Fachunterlagen wurden vor der Codeänderung gezielt angepasst.

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

Laufende Verzinsung, Restlaufzeit, Marktwerte und Fälligkeitsleiter behalten eigene Voraussetzungen. Die Leiter bleibt nach Nominalwährung getrennt, unabhängig von der Aggregatcheckbox. Durchschnittswerte verwenden nur gültige vergleichbare ausgewählte Werte. Coverage verwendet den gesamten direkten EUR-Berichtsmarktwert einschließlich unberechenbarer und ausgeschlossener Positionen. PLAN skaliert Nominal, absoluten Stückzins und DV01 proportional, Einzel-YTM und Duration bleiben unverändert. UI, Excel und Druck nutzen denselben zentralen Datenbuilder, einschließlich sichtbarer Jahresmodellannahme, Frequenzstatus, Alternativen und Fehlgründen.

## Gezielter Testnachweis

Neue obligatorische Suite `npm run test:bond-final`, neun Gruppen, vollständig künstliche Namen, Kennungen und Beträge:

1. Originalgetreue 29-Spalten-Signatur, positive AI bei EUR/FX leer, Profilabgrenzung und Evidenzvalidierung.
2. Eindeutige Jahres-, Halbjahres- und Quartalsmodelle. Unabhängige Python-Decimal70-Sollpreise für fünf Tage Restlaufzeit und 5 % Rendite: 105,92917767817603 / 102,93118208351067 / 101,43218428617799 bei Jahreskupon 6 %. Macaulay 5/365 und Modified 0,01304631441617743. DV01 separat durch Finite Difference geprüft.
3. Mehrdeutigkeit mit deutlich verschiedenen Renditen, kein Residualsieger, Ausschluss aus Aggregaten. Auch nur Halbjahr/Quartal kompatibel ohne zulässige Jahresannahme.
4. Kein passendes Modell, fehlende/ungültige AI, Nullkupon, fehlende und überschrittene Fälligkeit.
5. Fremdwährung, FX-Richtung, AI-Umrechnung, lokale und EUR-DV01, vollständiger EUR-Nenner trotz fehlendem Fremdwährungs-FX.
6. Monatsende, Schaltjahr, nichtmonatlicher Endtag ohne Drift, strikt zukünftige Zahlung, getrennte Tageszählung, Grundband und dokumentierte Quantisierungsanpassung.
7. Doppelwährungsanleihen und Fonds-Sondertypen, Erhalt bisheriger Klassifikationskorrekturen.
8. Marktwertgewichtung, Coverage, Szenarien, Ausschluss, IST/PLAN, Speicheradapter, JSON, Schema11-Snapshot und Replacement.
9. Tatsächliche Excel-Datei erzeugt und erneut eingelesen. Alle Bondblatt-Zellen gegen den gemeinsamen Datenbuilder geprüft. Tatsächliches Export-/Druck-React-HTML und UI enthalten Quellenhinweise, abgeleitete Frequenz, Annahmen und Alternativen.

Die bisherigen 22 Bond-V2-, neun CP3- und vier CP4-Gruppen bleiben erhalten. Fachlich geänderte Erwartungen sind explizit angepasst: Halbjahres-Kurzläufer wird jetzt gelöst statt pauschal verworfen. Unbekannte Rundungspräzision nutzt das vorläufige Grundband. Explizite AI=0 am gemeinsamen Kupontermin ist mehrdeutig. Die CP3-Referenz mit unveränderten unabhängigen Einjahres-Sollzahlen nutzt daher fehlende AI und die offengelegte Jahresannahme, nicht eine behauptete Frequenzbestätigung. Der neue Mehrdeutigkeitstest prüft den ehemaligen AI=0-Fall ausdrücklich.

Vollständiges lokales Release-Gate bestanden: `test:3b`, `test:4b`, `test:risk-v2`, `test:multi-depot`, `test:modelportfolio`, `test:cp1`, `test:bond-v2`, `test:cp3`, `test:cp4`, `test:bond-final`, Typecheck, Produktionsbuild und `git diff --check`. Das unabhängige vorhandene Decimal70-Referenzskript wurde ebenfalls ausgeführt. Neue Suite ist obligatorisch in CI und Typecheck aufgenommen.

## Offene Abnahmegrenzen

Der zusätzliche interaktive Test im lokalen Produktionsbuild wurde versucht. Der verwaltete Browser verweigerte die lokale HTTP-Adresse mit `net::ERR_BLOCKED_BY_CLIENT`. Daher **keine bestandene interaktive Browserabnahme** behauptet. Der Produktionsbuild selbst, gerenderte UI, Speicher-/Importpfade, tatsächliches XLSX und Druck-HTML wurden automatisiert geprüft. Native PDF-Paginierung, physischer Druck und Excel-Desktopdarstellung bleiben ungeprüft.

Frequenzpassung beweist weder Vertrag noch Kalender, Rückzahlung, Feiertagsregeln oder Bonität. Es gibt keine neue Behauptung über die endgültige Verteilung der 79 historischen Festzinspositionen. Die frühere 28/8/37/5/1-Aufteilung betrifft nur die damalige Jahr/Halbjahr-Diagnose. Drei rückgerechnete mögliche Zinsbeginne werden nicht verwendet. Keine Performance-CSV, keine zusätzlichen Pflichtdaten, keine Vertragseditoren.

Implementierung bereit zur abschließenden fachlichen Funktionsabnahme. Finale Commit-SHA sowie Push- und PR-CI werden nach Veröffentlichung des Commits in PR #7 dokumentiert. Diese Dokumentation ist keine automatische fachliche Releasefreigabe. **Kein Merge und kein Deployment.**
