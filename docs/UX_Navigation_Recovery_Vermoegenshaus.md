# UX-Korrekturen nach V0.18.4

Beschlossener Umfang vom 26.10.2026, Ausgangs-main
`ae798dfff80b6f805b013e0a1aa871120bdde1d1`, Tree
`c7aab3392c7f5d705b30f0aeef4462c891417973`.
Version 0.18.4 und Schema 11 bleiben unverändert. Kein Merge, Release oder Deployment.

## Bedienung und unveränderte Grenzen

- Der Fußbereich unter der Versionsinformation öffnet **Mehr & Einstellungen**.
  **Daten & Wiederherstellung** bündelt die lokale H5b-Prüfung, den Originaldownload
  und alle vorhandenen Originalsicherungen. Ohne auswählbaren lokalen Quellfall
  ist die lokale Prüfung deaktiviert; der separate Originaldatei-Pfad bleibt
  zugänglich. Downloads sind nur bei vorhandenen jeweiligen Originalbytes aktiv.
  Die mobile Navigation erhält einen erreichbaren Einstellungsbutton.
- Navigation verändert den aktiven Beratungsentwurf nicht. H5b übernimmt wie
  bisher erst nach erfolgreicher expliziter Kopienpersistenz den neuen Fall.
  Beim Öffnen der Einstellungen werden Originalbestand und Sicherungen frisch
  gelesen. Keine neue Hintergrundsynchronisation oder Cross-Tab-Garantie.
- `caseStoreNotice` unterdrückt standardmäßig ausschließlich optionale Diagnosen
  ohne geschützte Fälle. Der ausdrücklich geöffnete Datenbereich kann sie zeigen.
  Malformed, geschützte Originale, gemischte Fälle und tatsächliche Schreibfehler
  bleiben sichtbar. `recoveryNeeded`, `recoveryEntries`, Speicher-/Backup- und
  Bestätigungsprüfungen sind unverändert. Kein automatischer Schreibvorgang.
- Das Vermögenshaus passt sich seinem Container an. Ab 520 px bleiben fünf gleich
  breite Säulen unter einem gemeinsamen Dach mit Fundament sichtbar. Darunter
  werden die fünf Klassen vertikal in derselben Einheit dargestellt. Beträge,
  Anteile, Klassen, Hervorhebungen und Detailbuttons bleiben vorhanden.
  Kein horizontaler Scrollbereich und keine kaschierende Overflow-Sperre.
- Der permanente Navigationsbutton „Neue Beratung“ entfällt. Schnellstart mit
  drei Bereichsvorauswahlen und „Neuer Fall“ in der Fallverwaltung verwenden
  unverändert den bestehenden gemeinsamen Startpfad.

Die frühere Scrollvorgabe und der automatische optionale Statushinweis in
[PR40-Vertrag](Kapitalbedarfe_Recovery_Vermoegenshaus.md) werden ausschließlich
hinsichtlich ihrer Darstellung durch diesen späteren Beschluss ersetzt.
Zeitrechnung, P1, H5a/H5b und D1 bleiben unverändert maßgeblich.
Keine Änderungen an Domainberechnungen, CSV-Vertrag, Abhängigkeiten oder Workflows.

## Nachweise

Die bestehenden Recovery-Browsertests benutzen den neuen tatsächlichen Weg
über die Einstellungen. Die Geometrieprüfungen ersetzen die alte Scrollpflicht
mit vollständiger Sichtbarkeit, Text-/Containergrenzen, Dach-/Fundamentbezug,
gleichen Säulenbreiten und allen fünf Interaktionen in IST, PLAN, ZIELPLAN und
VERGLEICH: 1440, 1180, 1024, 768, 390 px sowie 680-px-Inhaltscontainer.
Die Fach-/XLSX-/Druckprüfungen bleiben bestehen. Zusätzliche Navigationstests
prüfen Tastatur, ungespeicherten Entwurf, leeren Bestand, beide Startwege,
Vorauswahlen, Backupfehler und bytegleichen Backupdownload samt Wiederverwendung.

`ux-visual-evidence.spec.ts` erzeugt synthetische Vorher-/Nachher-Screenshots.
Der Vorher-Build ersetzt ausschließlich die drei geänderten Produktdateien durch
die Originalbytes des festgelegten Ausgangscommits; andere Appquellen sind gleich.
Der Nachher-Stand ist der reguläre Produktionsbuild. Erfolgreiche Screenshots
werden mit SHA-256 und PNG-Bytes im Originaljoblog belegt; der bestehende
Workflow wird nicht geändert. Die Abnahmeunterlagen enthalten extrahierte PNGs.

Finale Push-/PR-CI, tatsächlicher Checkout, Heads/Parents/Trees, Originaljoblogs,
Prüfmatrix und SHA-256-Manifest werden erst nach Ausführung im identischen
externen Abnahmepaket dokumentiert. Diese Datei behauptet kein vorweggenommenes
Testergebnis. Eine lokale fehlende Chromiuminstallation ist kein Browsernachweis.
