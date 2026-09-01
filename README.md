# VermögensNavigator

Der VermögensNavigator ist ein browserbasierter Prototyp für eine strukturierte
Vermögensberatung. GitHub ist die einzige gepflegte Codebasis. Die öffentliche
Version wird über GitHub Pages bereitgestellt.

## Öffentliche Version

https://leonmoebius-code.github.io/vermoegensnavigator/

## Entwicklung

Voraussetzung ist Node.js ab Version 20.

```bash
npm ci
npm test
```

Der Build liegt anschließend in `.pages-dist`.

## Automatische Veröffentlichung

Bei Änderungen auf `main` prüft die GitHub Action den TypeScript-Quellstand,
erzeugt die statischen GitHub-Pages-Dateien und aktualisiert die veröffentlichten
Dateien im Wurzelverzeichnis. Die bestehende GitHub-Pages-Konfiguration für
`main` bleibt dadurch verwendbar.

## Speicherung

Beratungsfälle werden ausschließlich im lokalen Browser gespeichert. Für eine
Sicherung und Übertragung stehen JSON-Export und JSON-Import zur Verfügung.

## Wichtiger Hinweis

Der Prototyp erzeugt keine Anlageempfehlung. Für einen produktiven Einsatz sind
insbesondere bankfachliche Freigabe, Datenschutz, Informationssicherheit und
revisionssichere Dokumentation gesondert umzusetzen.
