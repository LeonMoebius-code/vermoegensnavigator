# P2: Excel-Blattnamen und F-026 – begrenztes Arbeitspaket

Stand: 23.10.2026, Work; keine unabhängige Abnahme, kein Merge/Release/Deployment.
Ausgangs-main `a87be76dcd5e303f626de6bcebb7239939b02cb1`, Tree
`0e6d43e490461430e00805ca5192eae8da48858e`. Ausschließlich synthetische Fälle.

## Deep-Audit-08/F-007: Excel

Der tatsächliche `ExportCenter`-Buttonhandler bricht vor dem Fix bei Planname
`Fall` mit `Worksheet with name |Fall| already exists!` ab. Der Download fehlt;
keine Behauptung eines nachgewiesenen Kunden- oder Speicherverlusts.

Die zentrale Namensvergabe reserviert sämtliche festen Exportblätter, auch spätere
und bedingte. In unveränderter Planreihenfolge bleibt der bisherige bereinigte,
auf 31 Zeichen gekürzte Name bei Konfliktfreiheit erhalten. Bei einem Konflikt
(unabhängig von Groß-/Kleinschreibung) wird `_2`, `_3`, … ergänzt, wobei der Stamm
für das Suffix gekürzt und jeder Kandidat erneut geprüft wird. Auch bereits als
Planname vorhandene Suffixe werden berücksichtigt. Der Namensraum beginnt bei
jedem Export neu. Weder Überschreiben noch Auslassen eines Planblatts ist erlaubt.

Die Zuordnung folgt eindeutig der Reihenfolge `item.plans`: genau ein dynamisches
Blatt pro Plan, einschließlich leerer Pläne; bei gleichen Namen entscheidet die
bestehende Reihenfolge. Die Testnachweise protokollieren zusätzlich Plan-ID,
Originalname und tatsächlichen Blattnamen. Kein neues Fallfeld oder Metadatenblatt.
Bestehende feste Blattnamen, Blattreihenfolge, Zellinhalte und Standardnamen
bleiben erhalten; ausschließlich kollidierende dynamische Blattnamen ändern sich.

`tests/browser/f007-xlsx-sheet-integrity.spec.ts` prüft reale Buttondownloads und
erneutes XLSX-Einlesen: Fall, alle festen Namen, gleiche Namen, Groß-/Kleinschreibung,
Bereinigung, 31-Zeichen-Kollisionen, belegte Suffixe, leere Bereinigung, zweistellige
Suffixe, wiederholte Exporte sowie Standardexport mit beiden Bondblättern.
Exakte vollständige Zeilenvergleiche mit unterschiedlichen Positionen je Plan
sichern die Inhalte; JSON- und Rohstorevergleiche sichern den unveränderten Fall.
Finale Laufidentitäten und Originalprotokolle liegen im separaten Abnahmepaket.

## Nachführung 23.10.2026

PR #52 ist auf main `0ec08f7a6f3132af3ff51d8eed0a921fc35aa1a9` integriert,
kein Release/Deployment. Die folgende Analyse bleibt der historische READ-ONLY-
Stand. Der spätere Beschluss [D-11](project/DECISIONS.md) entscheidet die technische
Domäne; [das separate F-026-Paket](F026_KALENDERDOMAENE.md) setzt sie um.

## F-026: ausschließlich lesende Folgenabschätzung

Unveränderte Quellen: `calendar.ts`, `capital-pots.ts`, `financial-validation.ts`,
Normalisierung/P1, F-021-Vertrag und dessen bestehende Regressionen. Ausgeführte
Domain-/Komponenten-/Speicherproben; kein neuer F-026-Browser-E2E behauptet.
Referenzdatum **15.10.2026**, Zeitzone Europe/Berlin, positiver Bedarf 10.000 EUR,
Plan ohne Jahresbindung. Monatsrundung bleibt `Math.round(years * 12)`.

| Laufzeit / Monate | Tatsächliche Folge |
| --- | --- |
| 0; 1; 30; 50; 100; 200 Jahre | Korrekte geprüfte Termine/Jahre/Töpfe, Formatierung, Normalisierung, P1-Save/Read und Ergebnis-/Exportkomponente. Keine entsprechende Fehlwirkung für diese plausiblen Horizonte festgestellt. |
| 95.678 Monate (7.973,1667 Jahre) | 15.12.9999; Zieljahr 9999; geprüfte Pfade funktionieren. |
| 95.679 Monate (7.973,25 Jahre) | `10000-01-15`, aber Zieljahr **1000**. Reparse erkennt den Termin nicht; `germanDate` und Ergebnis-/Exportkomponente werfen `RangeError: Invalid time value`. |
| 7.974 und 7.975 Jahre gemeinsam | Termine 10000/10001; beide im falschen Topf **year-1000**, zusammen 20.000 EUR. Horizontmonate bleiben lang; Topf-ID und Kalendersemantik widersprechen sich. |
| 3.284.807 Monate (273.733,9167 Jahre) | `275760-09-NaN`: Monatsende liegt außerhalb des JS-Date-Bereichs. |
| 3.284.808 Monate; 1.000.000 Jahre | `NaN-NaN-NaN`, numerisches Zieljahr NaN, Topf `year-NaN`. |
| `1e308` Jahre | `years * 12` wird Infinity; Terminberechnung wirft. Normalisierung und Speichern brechen ab; Rohstore-Lesen schützt den Eintrag. |
| Gültiger expliziter Termin 15.10.2030 plus `years = 1e308` | Expliziter Termin führt weiterhin; geprüft gültig. Kein Anlass, F-021 zu ändern. |

Der erste Übergang hängt vom Fallreferenzdatum und der Monatsrundung ab: hier
zwischen `years = 7973.2083333` und `7973.2083334`. **Keine universelle magische
Laufzeitgrenze** daraus ableiten. Bei heute üblichen Fallreferenzdaten sind die
beobachteten Auslöser unrealistische Extremwerte. Bei künstlich weit zukünftigen
Referenzdaten verschiebt sich die Grenze; die technische Domäne betrifft deshalb
Referenz- und Zieltermin gemeinsam.

Der Finanzguard prüft bewusst Zahltyp, Endlichkeit und Nichtnegativität, bislang
keine Kalenderdomäne. Fünfstellige Zieljahre werden durch `slice(0, 4)` gekürzt;
`addLocalMonthsClamped` prüft die resultierenden Date-Objekte nicht erneut. Bis
vor dem Multiplikationsüberlauf akzeptieren Normalisierung und P1-Save/Read die
geprüften Extremfälle ohne Jahresallokationen. Falsche Töpfe werden dabei abgeleitet,
die Rohdaten der Laufzeit bleiben gespeichert. Bestehende Jahresbindungen können
zusätzlich an P3 scheitern; kein allgemeiner Erhalt solcher Bindungen behauptet.

Die Anzeige scheitert bereits beim Rendern der Bedarfs-/Topf- und Ergebnisansicht;
bei den betroffenen Proben wird die Excel-Bedienung dadurch unzugänglich. Der
unveränderte Exporthandler bezieht Termin/Zieljahr aus denselben fehlerhaften
Funktionen. Daraus folgt kein nachgewiesener erfolgreicher Browserdownload falscher
Zellen. Reguläre synthetische XLSX-Downloads plausibler Laufzeiten sind bereits im
F-021-Gate abgedeckt. Keine stille Reparatur gespeicherter Extremfälle vornehmen.

## Entscheidungsvorschlag und verbleibendes Risiko

1. **Empfehlung: technische Kalenderdomäne beschließen**, die durchgängig vom
   existierenden vierstelligen Format unterstützt wird: gültige Referenz-/Zieltermine
   mit Jahr 0100–9999 und endlicher, sicher darstellbarer gerundeter Monatszahl.
   Das ist eine Option, keine bereits geltende neue Obergrenze. Akzeptierte relative
   Maximaldauer hängt dann vom festen Fallreferenzdatum ab. Explizite gültige Termine
   behalten ihre Priorität. Resultierende Termine vor Berechnung/Graph/Speicherung
   prüfen; UI-Entwurf mit klarer Fehlermeldung zurückweisen, Originale erhalten.
2. Falls zusätzlich eine **fachliche maximale Bedarfslaufzeit** gewünscht ist,
   muss Leon deren konkreten Wert (z. B. 100 oder 120 Jahre), Geltung für explizite
   Termine, Referenzdatum und Umgang mit bestehenden Überschreitungen entscheiden.
   Keine dieser Zahlen ist aus dem heutigen F-021-Vertrag ableitbar. Eine reine
   `years`-Grenze ohne resultierende Kalenderprüfung wäre unzureichend.
3. Erweiterte mehrstellige Kalenderjahre würden Parser, Formatierung, Topf-IDs und
   Folgepfade ändern; für diese P2-Wirkung unverhältnismäßig. Nicht empfohlen.

Bis zu einem gesonderten Beschluss und Folgeauftrag bleibt **F-026 offen**:
manipulierte/importierte Extremlaufzeiten können gespeichert werden, falsche
Jahrestöpfe ableiten und Ansichten/Export blockieren. Kein pauschaler Releaseblocker
oder akzeptiertes Restrisiko beschlossen; vor Readiness explizit entscheiden.
F-024/F-025 und sonstige P2-Findings sind unverändert außerhalb dieses Auftrags.

D1, CP0A2/CP0B, F-021, F-012, H1–H5, P1–P4, Risikomodell, Kataloge,
Schema 11, Migrationen, Dependencies und Workflows bleiben unverändert.
PR #43 bleibt **AUDIT ONLY – NEVER MERGE**, ohne Änderung durch dieses Paket.
