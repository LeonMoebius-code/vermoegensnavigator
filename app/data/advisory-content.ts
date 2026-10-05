import type { AdvisoryData, Scope, CustomerChecklistCategory } from "../domain/advisory/contracts";
import type { RiskAssessmentV2 } from "../domain/risk/contracts";
import { emptyAdvisory } from "../domain/advisory/defaults";

export const modules = [
  { id: "maturity", title: "Laufzeitenstruktur", text: "Kapitalbedarfe in zeitlich passende Anlagebausteine übersetzen.", scopes: ["private", "business", "combined"] },
  { id: "market", title: "Kapitalmarkt & Zinsen", text: "Zinsumfeld, Inflation und Risikoprämien verständlich einordnen.", scopes: ["private", "business", "combined"] },
  { id: "tax", title: "Steuern & Bilanzierung", text: "Rechtsform, Bilanzpositionen, Ertragsarten und Teilfreistellungen prüfen.", scopes: ["business", "combined"] },
  { id: "depot", title: "Vorhandenes Depot", text: "Struktur, Klumpenrisiken, Laufzeiten, Kosten und steuerliche Altbestände sichten.", scopes: ["private", "business", "combined"] },
  { id: "pension", title: "Private Vorsorge", text: "Rürup, fondsgebundene Rentenversicherung und flexible Lösungen gegenüberstellen.", scopes: ["private", "combined"] },
  { id: "succession", title: "Vermögensnachfolge", text: "Verfügbarkeit, Begünstigung und geplante Übertragungen früh mitdenken.", scopes: ["private", "combined"] },
];

export const scenarios: Array<{ id: string; tag: string; title: string; subtitle: string; scope: Scope; data: AdvisoryData }> = [
  {
    id: "private-new", tag: "PRIVAT", title: "Neukunde ohne Depot", subtitle: "200.000 € freie Liquidität", scope: "private",
    data: { ...emptyAdvisory, caseName: "Privatkunde ohne Depot", scope: "private", liquidAssets: 200000, reserve: 30000, needs: [{ id: 1, purpose: "Fahrzeug", amount: 35000, years: 2 }], goal: "Vermögensaufbau", horizon: 12, risk: 3, modules: ["maturity", "market", "pension"] },
  },
  {
    id: "private-depot", tag: "PRIVAT", title: "Bestehendes Wertpapierdepot", subtitle: "Depot überprüfen und strukturieren", scope: "private",
    data: { ...emptyAdvisory, caseName: "Privatkunde mit Depot", scope: "private", liquidAssets: 90000, depotValue: 430000, otherAssets: 310000, reserve: 35000, hasDepot: true, needs: [{ id: 1, purpose: "Modernisierung", amount: 80000, years: 4 }], goal: "Struktur optimieren", horizon: 10, risk: 4, experience: "Umfangreiche Kenntnisse", priorities: ["Rendite", "Diversifikation"], modules: ["maturity", "market", "depot", "succession"] },
  },
  {
    id: "gmbh", tag: "FIRMA", title: "GmbH mit Überschussliquidität", subtitle: "750.000 € schrittweise anlegen", scope: "business",
    data: { ...emptyAdvisory, caseName: "Muster GmbH", scope: "business", legalForm: "GmbH", liquidAssets: 750000, reserve: 180000, needs: [{ id: 1, purpose: "Maschineninvestition", amount: 140000, years: 2 }, { id: 2, purpose: "Standorterweiterung", amount: 170000, years: 5 }], goal: "Liquidität rentierlich strukturieren", horizon: 7, risk: 2, experience: "Grundkenntnisse", priorities: ["Kapitalerhalt", "Planbarkeit"], modules: ["maturity", "market", "tax"] },
  },
  {
    id: "entrepreneur", tag: "KOMBINIERT", title: "Unternehmerfamilie", subtitle: "Betriebs- und Privatvermögen verbinden", scope: "combined",
    data: { ...emptyAdvisory, caseName: "Unternehmerfamilie", scope: "combined", legalForm: "GmbH", liquidAssets: 1100000, depotValue: 620000, otherAssets: 1400000, reserve: 240000, hasDepot: true, needs: [{ id: 1, purpose: "Immobilienerwerb privat", amount: 300000, years: 3 }, { id: 2, purpose: "Unternehmensnachfolge", amount: 200000, years: 8 }], goal: "Vermögen ganzheitlich ordnen", horizon: 15, risk: 3, experience: "Erweiterte Kenntnisse", priorities: ["Flexibilität", "Nachfolge", "Diversifikation"], modules: ["maturity", "market", "tax", "depot", "pension", "succession"] },
  },
  {
    id: "maturities", tag: "PRIVAT", title: "Mehrere Kapitalbedarfe", subtitle: "Liquidität über 12 Jahre staffeln", scope: "private",
    data: { ...emptyAdvisory, caseName: "Privatkunde mit Laufzeitenbedarf", scope: "private", liquidAssets: 480000, depotValue: 150000, reserve: 45000, hasDepot: true, needs: [{ id: 1, purpose: "Fahrzeug", amount: 40000, years: 1 }, { id: 2, purpose: "Modernisierung", amount: 90000, years: 4 }, { id: 3, purpose: "Ausbildungsfinanzierung", amount: 70000, years: 8 }, { id: 4, purpose: "Ruhestandsreserve", amount: 100000, years: 12 }], goal: "Vermögen erhalten", horizon: 12, risk: 3, experience: "Erweiterte Kenntnisse", priorities: ["Planbarkeit", "Flexibilität", "Werterhalt"], modules: ["maturity", "market", "depot"] },
  },
  {
    id: "pension-succession", tag: "PRIVAT", title: "Vorsorge & Nachfolge", subtitle: "Ruhestand und Übertragung verbinden", scope: "private",
    data: { ...emptyAdvisory, caseName: "Vorsorge- und Nachfolgefall", scope: "private", liquidAssets: 320000, depotValue: 540000, otherAssets: 850000, reserve: 50000, hasDepot: true, needs: [{ id: 1, purpose: "Ruhestandsbeginn", amount: 120000, years: 9 }, { id: 2, purpose: "Übertragung an Kinder", amount: 150000, years: 12 }], goal: "Vermögen ganzheitlich ordnen", horizon: 15, risk: 3, experience: "Grundkenntnisse", priorities: ["Nachfolge", "Flexibilität", "Laufender Ertrag"], modules: ["maturity", "market", "depot", "pension", "succession"] },
  },
];

export const priorityOptions = ["Kapitalerhalt", "Werterhalt", "Planbarkeit", "Flexibilität", "Laufender Ertrag", "Rendite", "Diversifikation", "Nachfolge", "Nachhaltigkeit"];

export const customerChecklistCategories = [
  "Unterlage mitbringen",
  "Antrag oder Formular",
  "Externe Klärung",
  "Sonstiger nächster Schritt",
] as const;

type ModuleSlide = {
  eyebrow: string;
  title: string;
  text: string;
  points: string[];
  checks: Array<{ id: string; label: string }>;
};

export const steps = [
  ["Vermögensart", "Privat, betrieblich oder beides"],
  ["Ausgangslage", "Vermögen und Liquidität"],
  ["Kapitalbedarfe", "Beträge und konkrete Termine"],
  ["Ziele & Risiko", "Horizont und Schwankungen"],
  ["Fachmodule", "Gezielte Vertiefungen"],
  ["Ergebnis", "Struktur und nächste Schritte"],
] as const;

export const goalOptions = [
  "Liquidität rentierlich strukturieren",
  "Vermögensaufbau",
  "Vermögen erhalten",
  "Laufende Erträge erzielen",
  "Struktur optimieren",
  "Vermögen ganzheitlich ordnen",
];

export const moduleDetails: Record<string, string[]> = {
  maturity: [
    "Konkrete Bedarfe werden automatisch einem einheitlichen Laufzeitband zugeordnet.",
    "Produkte müssen zum tatsächlichen Bedarfstermin passen.",
    "Nur dauerhaft verfügbares Kapital wird strategisch strukturiert.",
  ],
  market: [
    "Zinsen, Inflation und Risikoprämien werden getrennt eingeordnet.",
    "Laufende Verzinsung, Rendite bis Fälligkeit und Gesamtrendite sind nicht gleichzusetzen.",
    "Aktienchancen erfordern ausreichende Zeit und Verlusttragfähigkeit.",
  ],
  tax: [
    "Rechtsform, Ertragsart und bilanzielle Zuordnung sind vor Produktauswahl zu klären.",
    "Teilfreistellung, § 8b KStG, Streubesitz und Gewerbesteuer sind fachlich zu würdigen.",
    "Die Anwendung dokumentiert Prüfpunkte, ersetzt aber keine Steuerberatung.",
  ],
  depot: [
    "Bestand wird auf die fünf Anlageklassen durchgeschaut.",
    "Einstandskurse, Altbestände, Kosten und Kundenwünsche können Abweichungen begründen.",
    "Transaktionen werden nur simuliert und nicht automatisch empfohlen.",
  ],
  pension: [
    "Rürup, fondsgebundene Rentenversicherung und freie Anlage werden hinsichtlich Steuern, Kosten und Verfügbarkeit verglichen.",
    "Eine Steuererstattung ist kein garantierter Finanzierungsbeitrag.",
    "Verrentung und Kapitaloption müssen getrennt betrachtet werden.",
  ],
  succession: [
    "Zeitpunkt, Empfänger und eigene Verfügbarkeit werden dokumentiert.",
    "Depot-, Versicherungs- und gesellschaftsrechtliche Lösungen sind fachübergreifend zu prüfen.",
    "Steuerliche und rechtliche Beurteilung bleibt qualifizierten Beratern vorbehalten.",
  ],
};

export const moduleSlides: Record<string, ModuleSlide[]> = {
  maturity: [
    { eyebrow: "ANLASS", title: "Welche Mittel werden wann benötigt?", text: "Die zeitliche Verfügbarkeit ist die erste Planungsgrenze.", points: ["Reserve und konkrete Bedarfe getrennt erfassen", "Bedarfstermine vor Produktauswahl festlegen"], checks: [{ id: "all-needs", label: "Alle bekannten Kapitalbedarfe sind erfasst" }] },
    { eyebrow: "DATEN", title: "Laufzeiten belastbar erfassen", text: "Betrag, Zweck und Termin bestimmen den Kapitaltopf.", points: ["Unklare Termine als offenen Prüfpunkt kennzeichnen", "Puffer für vorgezogene Bedarfe berücksichtigen"], checks: [{ id: "dates", label: "Termine und Beträge wurden mit dem Kunden plausibilisiert" }] },
    { eyebrow: "EINORDNUNG", title: "Kapitaltöpfe bilden", text: "Reserve, konkrete Bedarfsjahre und strategisches Kapital bilden die sichtbare Zeitstruktur.", points: ["Bedarfe desselben Zieljahres zusammenfassen", "Einzeltermine und Zwecke im Jahrestopf nachvollziehbar halten"], checks: [{ id: "buckets", label: "Die Kapitaltöpfe sind zeitlich widerspruchsfrei" }] },
    { eyebrow: "LÖSUNGSWEGE", title: "Produkte passend zuordnen", text: "Mindesthorizont und Verfügbarkeit müssen zum Topf passen.", points: ["Überschüsse dürfen mehrere kurzfristige Töpfe abdecken", "Konflikte werden gewarnt, nicht verdeckt"], checks: [{ id: "products", label: "Produktlaufzeiten wurden gegen Bedarfe geprüft" }] },
    { eyebrow: "ERGEBNIS", title: "Laufzeitenstruktur abschließen", text: "Offene Beträge, Überplanungen und Konflikte bleiben sichtbar.", points: ["Strukturplanung öffnen und Kapitaltöpfe befüllen", "Offene Prüfpunkte dokumentieren"], checks: [{ id: "result", label: "Die Laufzeitenstruktur kann in die Planung übernommen werden" }] },
  ],
  market: [
    { eyebrow: "ANLASS", title: "Kapitalmarktumfeld einordnen", text: "Zins, Inflation und Risikoprämien werden getrennt betrachtet.", points: ["Nominale Rendite ist nicht reale Rendite", "Markterwartungen sind keine Garantie"], checks: [{ id: "purpose", label: "Der Einordnungszweck ist geklärt" }] },
    { eyebrow: "DATEN", title: "Aktuelle Annahmen dokumentieren", text: "Renditebandbreiten benötigen immer einen Datenstand.", points: ["Geldmarkt etwa 2,10 bis 2,80 Prozent", "Bandbreiten aus der Orientierung vom 07.05.2026"], checks: [{ id: "date", label: "Der Datenstand wurde geprüft" }] },
    { eyebrow: "EINORDNUNG", title: "Renditequellen unterscheiden", text: "Laufende Verzinsung, Rendite bis Fälligkeit und Gesamtrendite sind nicht identisch.", points: ["Bonitäts- und Durationsrisiko berücksichtigen", "Aktienprämie benötigt ausreichende Zeit"], checks: [{ id: "risks", label: "Die wesentlichen Rendite- und Risikotreiber sind besprochen" }] },
    { eyebrow: "LÖSUNGSWEGE", title: "Horizont und Lösung verbinden", text: "Die Orientierung ordnet Lösungsarten nach Mindestanlagehorizonten.", points: ["Geldmarkt ab etwa 12 Monaten", "Weltweite Aktienfonds ab etwa 72 Monaten"], checks: [{ id: "horizon", label: "Der Anlagehorizont passt zu den betrachteten Lösungsarten" }] },
    { eyebrow: "ERGEBNIS", title: "Markteinordnung festhalten", text: "Die Einordnung unterstützt das Gespräch, ersetzt keine Produktempfehlung.", points: ["Annahmen und Abweichungen dokumentieren", "Vor Umsetzung Aktualität erneut prüfen"], checks: [{ id: "result", label: "Die Einordnung ist nachvollziehbar dokumentiert" }] },
  ],
  tax: [
    { eyebrow: "ANLASS", title: "Steuerlichen Prüfbedarf abgrenzen", text: "Die Anwendung dokumentiert Prüfbedarf und rechnet keine Steuerwirkung vor.", points: ["Privat- und Betriebsvermögen trennen", "Rechtsform und Bilanzposition beachten"], checks: [{ id: "scope", label: "Vermögenssphäre und Rechtsform sind geklärt" }] },
    { eyebrow: "DATEN", title: "Ertragsarten erfassen", text: "Zinsen, Dividenden, Veräußerungsgewinne und Ausschüttungen können unterschiedlich wirken.", points: ["Teilfreistellungen prüfen", "Beteiligungsquoten nicht pauschal behandeln"], checks: [{ id: "income", label: "Relevante Ertragsarten sind identifiziert" }] },
    { eyebrow: "EINORDNUNG", title: "Bilanzielle Behandlung prüfen", text: "Produktbezeichnung und wirtschaftliche Einordnung reichen für die Bilanzierung nicht aus.", points: ["Bewertung und Ausweis separat prüfen", "Steuerberater bei offenen Punkten einbinden"], checks: [{ id: "accounting", label: "Bilanzielle Prüfpunkte sind dokumentiert" }] },
    { eyebrow: "LÖSUNGSWEGE", title: "Prüfpfad festlegen", text: "Offene Fragen werden konkret formuliert und für das weitere Kundengespräch festgehalten.", points: ["Steuerberatung bei steuerlichen Fragen", "Rechtsberatung bei rechtlichen Fragen"], checks: [{ id: "owner", label: "Offene Fragen sind konkret und verständlich formuliert" }] },
    { eyebrow: "ERGEBNIS", title: "Keine Scheingenauigkeit", text: "Ohne fachliche Freigabe bleibt die Darstellung bei dokumentierten Prüfpunkten.", points: ["Keine Nettoertragsprognose", "Keine pauschale Steuerempfehlung"], checks: [{ id: "result", label: "Grenzen und offene Prüfungen sind festgehalten" }] },
  ],
  depot: [
    { eyebrow: "ANLASS", title: "Bestandsdepot einbeziehen", text: "Der Bestand wird als eigene Ebene und nicht als neuer Kauf behandelt.", points: ["Ist-Struktur erfassen", "Neue Liquidität getrennt planen"], checks: [{ id: "captured", label: "Der relevante Depotbestand ist vollständig erfasst" }] },
    { eyebrow: "DATEN", title: "Positionen klassifizieren", text: "Jede Position benötigt mindestens Wert und Anlageklasse.", points: ["Produktzuordnung und Durchschau ergänzen", "Ungeklärte Positionen sichtbar lassen"], checks: [{ id: "classified", label: "Alle Positionen sind klassifiziert oder als ungeklärt markiert" }] },
    { eyebrow: "EINORDNUNG", title: "Ist und Soll vergleichen", text: "Abweichungen sind Hinweise und keine automatischen Verkaufssignale.", points: ["Klumpenrisiken", "Laufzeiten, Kosten und steuerliche Altbestände"], checks: [{ id: "reviewed", label: "Wesentliche Abweichungen wurden fachlich gewürdigt" }] },
    { eyebrow: "LÖSUNGSWEGE", title: "Bestand in der Planung berücksichtigen", text: "Der Plan kann den Bestand nur vergleichend, vollständig oder nach Verkäufen einbeziehen.", points: ["Positionen selektiv auswählen", "Simulierte Verkäufe separat ausweisen"], checks: [{ id: "mode", label: "Der passende Berücksichtigungsmodus ist gewählt" }] },
    { eyebrow: "ERGEBNIS", title: "Gesamtvermögen konsistent darstellen", text: "Bestand, neue Anlage und kombinierte Zielstruktur müssen rechnerisch übereinstimmen.", points: ["Depotcheck öffnen", "Vermögensstruktur gegenprüfen"], checks: [{ id: "result", label: "Depot und Strukturplanung sind konsistent verbunden" }] },
  ],
  pension: [
    { eyebrow: "ANLASS", title: "Vorsorgeziel konkretisieren", text: "Versorgungslücke, Flexibilität und gewünschter Leistungsbeginn werden getrennt erfasst.", points: ["Laufende Rente oder Kapital", "Planbarkeit oder Flexibilität"], checks: [{ id: "goal", label: "Das Vorsorgeziel ist konkret beschrieben" }] },
    { eyebrow: "DATEN", title: "Rahmendaten erfassen", text: "Laufzeit, Beitrag, Steuerstatus und vorhandene Verträge bestimmen den Vergleich.", points: ["Bestehende Ansprüche", "Liquiditätsbedarf bis zum Ruhestand"], checks: [{ id: "data", label: "Vorhandene Vorsorge und Laufzeit sind erfasst" }] },
    { eyebrow: "EINORDNUNG", title: "Verfügbarkeit und Bindung vergleichen", text: "Steuervorteile dürfen nicht isoliert von Kosten und Verfügbarkeit betrachtet werden.", points: ["Rürup", "Fondsgebundene Rentenversicherung", "Freie Anlage"], checks: [{ id: "tradeoffs", label: "Bindung, Kosten und Verfügbarkeit wurden gegenübergestellt" }] },
    { eyebrow: "LÖSUNGSWEGE", title: "Leistungsphase mitdenken", text: "Verrentung und Kapitaloption sind eigenständige Entscheidungen.", points: ["Auszahlungsform", "Hinterbliebenenschutz"], checks: [{ id: "benefits", label: "Die gewünschte Leistungsphase ist geklärt" }] },
    { eyebrow: "ERGEBNIS", title: "Vergleich dokumentieren", text: "Die Vertiefung hält Entscheidungsfaktoren fest und ersetzt keine individuelle Vorsorgeberatung.", points: ["Offene Angebote", "Benötigte Unterlagen und nächste Schritte"], checks: [{ id: "result", label: "Die nächsten Schritte sind dokumentiert" }] },
  ],
  succession: [
    { eyebrow: "ANLASS", title: "Übertragungsziel klären", text: "Zeitpunkt, Empfänger und eigene Absicherung stehen am Anfang.", points: ["Schenkung zu Lebzeiten", "Nachfolge von Todes wegen"], checks: [{ id: "goal", label: "Ziel und gewünschter Zeitpunkt sind geklärt" }] },
    { eyebrow: "DATEN", title: "Vermögensbestandteile erfassen", text: "Liquidität, Depot, Versicherungen und Gesellschaftsanteile können unterschiedliche Wege erfordern.", points: ["Begünstigte Personen", "Verfügungs- und Rückforderungsrechte"], checks: [{ id: "assets", label: "Relevante Vermögensbestandteile und Empfänger sind erfasst" }] },
    { eyebrow: "EINORDNUNG", title: "Eigene Verfügbarkeit sichern", text: "Eine Übertragung darf den künftigen Liquiditätsbedarf nicht ausblenden.", points: ["Reserve", "Pflege- und Versorgungsszenarien"], checks: [{ id: "liquidity", label: "Die eigene langfristige Liquidität ist berücksichtigt" }] },
    { eyebrow: "LÖSUNGSWEGE", title: "Instrumente fachübergreifend prüfen", text: "Depot-, Versicherungs- und gesellschaftsrechtliche Lösungen benötigen getrennte Würdigung.", points: ["Nießbrauch und Vollmachten", "Begünstigungen und Vertragsgestaltung"], checks: [{ id: "experts", label: "Erforderliche Fachstellen sind identifiziert" }] },
    { eyebrow: "ERGEBNIS", title: "Offene Schritte festhalten", text: "Der Navigator strukturiert den Anlass und ersetzt keine Rechts- oder Steuerberatung.", points: ["Benötigte Dokumente", "Offene Fragen und Folgetermin"], checks: [{ id: "result", label: "Offene Schritte sind für den Kunden dokumentiert" }] },
  ],
};

export const riskScenarios = [
  { id: "A" as const, title: "Geringe Verluste", text: "Ich möchte nur geringe Verluste akzeptieren und nehme dafür auch eine eher geringe Rendite in Kauf." },
  { id: "B" as const, title: "Moderates Wachstum", text: "Ich bin bereit, mäßige Verluste zu akzeptieren, um mein Vermögen langfristig moderat, aber stetig wachsen zu lassen." },
  { id: "C" as const, title: "Vermögenswachstum", text: "Vermögenswachstum ist mir wichtig, daher nehme ich auch höhere Schwankungen und mögliche Kapitalverluste in Kauf." },
  { id: "D" as const, title: "Rendite im Vordergrund", text: "Meine Renditeziele stehen klar im Vordergrund, daher nehme ich auch erhebliche Schwankungen und mögliche Kapitalverluste in Kauf." },
];

export const willingnessQuestions: Array<{
  key: keyof RiskAssessmentV2["willingness"];
  title: string;
  options: string[];
}> = [
  { key: "lossReaction", title: "Wie würden Sie bei einem deutlichen zwischenzeitlichen Verlust reagieren?", options: ["Sofort verkaufen", "Risiko deutlich reduzieren", "Zunächst abwarten", "Strategie beibehalten", "Nachkauf bewusst prüfen"] },
  { key: "temporaryLoss", title: "Welche vorübergehende Wertminderung erscheint Ihnen noch tragbar?", options: ["Bis etwa 5 %", "Bis etwa 10 %", "Bis etwa 20 %", "Bis etwa 35 %", "Mehr als 35 %, sehr hohe Verluste sind bewusst"] },
  { key: "riskReturnPriority", title: "Welche Aussage beschreibt Ihr Anlageziel am besten?", options: ["Substanzerhaltung und geringe Schwankungen", "Mehr Rendite bei begrenzten Schwankungen", "Renditechancen und Schwankungen ausgewogen", "Höhere Renditechancen sind wichtiger", "Höchste Chancen trotz erheblicher Verluste"] },
];

export const scopeOptions: Array<[Scope, string, string]> = [
    [
      "private",
      "Privatvermögen",
      "Liquidität, Wertpapiere, Vorsorge, Versicherungen und Nachfolge.",
    ],
    [
      "business",
      "Betriebsvermögen",
      "Überschüssige Firmenliquidität, Rechtsform, Bilanzierung und Steuern.",
    ],
    [
      "combined",
      "Betriebs- und Privatvermögen",
      "Beide Sphären mit getrennten Bedarfen und Zielen.",
    ],
  ];

export const riskHeadings = ["Präferenz im magischen Dreieck", "Welches Zielbild passt?", "Risikowille", "Finanzielle Verlusttragfähigkeit", "Ergebnis der Orientierung"];

export const capacityLabels: Record<keyof RiskAssessmentV2["capacity"], string> = {
    goalImpact: "Auswirkung auf Ziele",
    capitalDependence: "Abhängigkeit vom Anlagekapital",
    lossBuffer: "Ausgleichsmöglichkeiten",
  };

export function capacityQuestionsForScope(scope: Scope | null) {
  const capacityQuestions = [
    { key: "goalImpact", title: "Welche Auswirkungen hätte ein deutlicher Verlust auf geplante Ausgaben, finanzielle Ziele oder notwendige Investitionen?", options: ["Unmittelbar gefährdet", "Deutliche Einschränkungen", "Einzelne Ziele anpassen", "Kaum Einschränkungen", "Keine wesentlichen Einschränkungen"] },
    {
      key: "capitalDependence",
      title: scope === "business"
        ? "In welchem Umfang ist das Unternehmen auf dieses Kapital für laufende Liquidität, Investitionen oder den Geschäftsbetrieb angewiesen?"
        : scope === "private"
          ? "In welchem Umfang sind Sie auf dieses Kapital für laufende Lebensführung oder absehbare Vorhaben angewiesen?"
          : "In welchem Umfang wird dieses Kapital für laufende Liquidität oder absehbare Vorhaben benötigt?",
      options: ["Sehr stark", "Deutlich", "Teilweise", "Gering", "Praktisch nicht"],
    },
    {
      key: "lossBuffer",
      title: scope === "business"
        ? "Könnte ein deutlicher Verlust aus anderer Unternehmensliquidität oder finanziellen Reserven aufgefangen werden?"
        : scope === "private"
          ? "Könnte ein deutlicher Verlust aus anderen verfügbaren Mitteln aufgefangen werden?"
          : "Könnte ein deutlicher Verlust aus anderen verfügbaren Mitteln oder Reserven aufgefangen werden?",
      options: ["Nein", "Nur sehr eingeschränkt", "Teilweise", "Weitgehend", "Problemlos"],
    },
  ];
  return capacityQuestions;
}

// Contract and runtime literals must describe the same set in both directions.
type SameUnion<A, B> =
  [Exclude<A, B>, Exclude<B, A>] extends [never, never] ? true : false;
type Assert<T extends true> = T;
type _CustomerChecklistCategoryContractMatchesRuntime =
  Assert<SameUnion<CustomerChecklistCategory, (typeof customerChecklistCategories)[number]>>;
