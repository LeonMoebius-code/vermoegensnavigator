# AP-04b-UX2 · Geführte Altersvorsorge

## Aufbau

| Ansicht | Unmittelbare Aufgabe | Vertiefung |
| --- | --- | --- |
| Einstieg | Neuanlage oder bestehende Riester-Rente wählen | Grundlagen zum Altersvorsorgedepot |
| A1 | Zeitraum und persönliche Situation erfassen | Situationsabhängige Fragen, offene Voraussetzungen, Zusammenfassung |
| A2 | Fünf Jahresziele oder eine eigene Rate wählen | Datierten Einmalbeitrag erfassen, Nachweise und Regelstand prüfen |
| A3 | Wünsche beantworten, Karten ansehen, zwei bis drei Produkte vergleichen | Quellen, Auszahlungsformen, Garantiebasis und Bankstatus |
| A4 | Modell wählen und die drei Szenarien lesen | Anpassbare Annahmen, zugängliche Zeitreihen, Beraterbeträge und Provenienz |

Die Seiten verwenden die vorhandenen Komponenten `RetirementQuestions`, `ContributionOptimizer`, `RetirementProducts` und `RetirementProjection`. Der gemeinsame Kopf und die Schrittnavigation bleiben beim Rücksprung konsistent. Der Sparplan erscheint auf breiten Ansichten neben dem Inhalt und auf kleineren Ansichten darunter. Die vorhandene Produktmatrix verwendet auf kleineren Bildschirmen beschriftete, gestapelte Merkmale.

## Gemeinsamer Zahlungsplan

`RetirementEntry` hält einen flüchtigen `CustomerPlan`. Das Beitragsjahr aus A1 entspricht dem ersten Kalenderjahr des Zahlungsplans in A2 und A4. Ein unvollständiges Jahr sperrt die Folgeschritte bis zur Korrektur. Bei einem Wechsel des gültigen Jahres bleibt der bereits gewählte Startmonat erhalten. Eine Startänderung in A2 oder A4 aktualisiert das Beitragsjahr in A1. Ein Jahresziel gilt für das erste Kalenderjahr. Der Adapter leitet Monatsrate und Centausgleich einmal ab, berücksichtigt eine Einmalzahlung im korrekten Monat und übergibt in A4 den gleichen Eigenzahlungsplan an AP-03a. Der Centausgleich ist ein datiertes eigenes Ereignis und läuft in Folgejahren nicht weiter.

Förderorientierung, bedingtes Standardbeispiel und gesondert geprüfte Angaben haben eigene Ausgaben. Kundenantworten ersetzen keine fachliche Prüfung. A4 übernimmt keinen Jahreszulagenbetrag aus A2. Das neutrale Modell akzeptiert separat eine ausdrückliche, einmalige Hypothese mit Förderjahr, Betrag und Buchungsmonat. Es verwendet die bestehenden AP-03a-Grenzen für Zeit und Ausgabe.

A-Schrittnavigation und unwirksame A3-Events behalten die Berechnung einschließlich Bestätigungen. Wirksame A3-Eingaben setzen entsprechend AP-03b alle vier neutralen Bestätigungen zurück. Reine A1-Orientierungsänderungen erhalten das unabhängige neutrale Ergebnis. Eine geänderte Jahresbindung oder Zahlungsannahme entwertet die davon abhängige Vorschau. Bei aktivierter Zulagenhypothese entwertet ein geänderter Personenkontext die Förderbestätigung und die davon abhängige Vorschau. Modell- und Referenzkosten behalten ihre jeweils separate Bestätigung, solange deren Grundlage gleich bleibt. Die Eingabeaktionen werden der Reihe nach auf den aktuellen Entwurf angewandt. Bei mehreren Änderungen desselben Feldes gilt die letzte wirksame Eingabe. Eine Bestätigung bleibt an die beim Auslösen sichtbare Grundlage gebunden. Die neutrale Markt-/Kostenbasis wechselt bei einer Produktwahl nicht. Die vorhandene Verlustabfrage schützt das Verlassen und den Neustart. Ein Wechsel in den Bestand erfragt den Verlust einer noch bestätigten A4-Vorschau und erhält die Eingabedaten beider Strecken in derselben Sitzung.

## Modell-, Kosten- und Quellenstatus

Die reale M1- und M2-Herstellerrechnung bleibt für alle sechs qualitativen Alternativen gesperrt. Eine reale Anzeige erfordert eine verifizierte P1-Anzeigefreigabe, geeignete Tarif- und Kostenbelege sowie für M2 ein belegtes Anlageprofil. Die Oberfläche akzeptiert keine reale Katalog- oder Kostenquelle vom Client. B1 und B2 verbleiben in der bestehenden Riester-Strecke.

Die getrennte Demonstration verwendet ausschließlich künstliche Produkt- und Tarif-IDs, einen synthetischen P1-Katalog, hypothetische Szenarien und S-Kostenparameter. `calculateM1` und `calculateM2` prüfen den Anzeigevertrag einschließlich Katalogreferenzen. Beide Anzeigen stellen Originalmonatswerte dar. M1 mindert die jährliche Bruttorendite um die Kostenpunkte. M2 wendet den monatlichen Kostenfaktor auf den Bestand an, führt den Crash vor den Ratezuflüssen aus und gleicht das Portfolio gegebenenfalls danach aus. Der Einmonatsfall mit 10.000 € Bestand, 10 % Brutto und 2 % synthetischen Jahreskosten liefert 10.064,34 € (M1) beziehungsweise 10.062,79 € (M2). Die Differenz erklärt sich aus den Kostenkonventionen.

Die P2-Speicher- und Exportfunktionen liegen außerhalb dieser Vorschau. Modellevidenz, Hashes und synthetische Katalogfreigabe sind keine Bankfreigabe. Der Bestand und die öffentlichen Quellenreferenzen aus A3 werden wiederverwendet. Die Tests benutzen ausschließlich künstliche Finanz- und Fallwerte.
