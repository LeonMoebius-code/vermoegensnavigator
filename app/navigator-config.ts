export type Scope = "private" | "business" | "combined";
export type RiskLevel = 1 | 2 | 3 | 4 | 5;

export type Need = {
  id: number;
  purpose: string;
  amount: number;
  years: number;
  dueDate?: string;
};

export type RiskAssessment = {
  lossReaction: RiskLevel | null;
  temporaryLoss: RiskLevel | null;
  financialCapacity: RiskLevel | null;
};

export type AdvisoryData = {
  caseName: string;
  scope: Scope | null;
  legalForm: string;
  liquidAssets: number;
  depotValue: number;
  otherAssets: number;
  reserve: number;
  hasDepot: boolean;
  needs: Need[];
  goal: string;
  horizon: number;
  risk: RiskLevel;
  riskAssessment: RiskAssessment;
  experience: string;
  priorities: string[];
  modules: string[];
  notes: string;
};

export const emptyAdvisory: AdvisoryData = {
  caseName: "",
  scope: null,
  legalForm: "GmbH",
  liquidAssets: 0,
  depotValue: 0,
  otherAssets: 0,
  reserve: 0,
  hasDepot: false,
  needs: [],
  goal: "Ausgewogenes Verhältnis",
  horizon: 8,
  risk: 3,
  riskAssessment: {
    lossReaction: null,
    temporaryLoss: null,
    financialCapacity: null,
  },
  experience: "Grundkenntnisse",
  priorities: ["Werterhalt", "Flexibilität"],
  modules: ["maturity", "market"],
  notes: "",
};

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

export const euro = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export const percent = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
