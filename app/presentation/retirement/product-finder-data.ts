/** Reviewed public announcement snapshot for A3 display only. No P1 records or engine parameters. */
export const productFinderSourceDate = "2026-11-19";
export const comparisonLimit = 3;

const sources = {
  unionOverview: {
    label: "Union Investment · Produktübersicht",
    url: "https://www.union-investment.de/familien-und-altersvorsorge/fuers-alter-vorsorgen/altersvorsorgedepot",
  },
  unionFaq: {
    label: "Union Investment · Produktfragen (Oktober 2026)",
    url: "https://www.union-investment.de/familien-und-altersvorsorge/fuers-alter-vorsorgen/antworten/was-ist-fuer-das-altersvorsorgedepot-geplant",
  },
  unionPayout: {
    label: "Union Investment · Auszahlung aus dem Altersvorsorgedepot",
    url: "https://www.union-investment.de/familien-und-altersvorsorge/fuers-alter-vorsorgen/antworten/wie-funktioniert-die-auszahlung-aus-dem-altersvorsorgedepot",
  },
  ruvOverview: {
    label: "R+V · Produktübersicht",
    url: "https://www.ruv.de/altersvorsorge/private-rentenversicherung/altersvorsorgedepot",
  },
  ruvPress: {
    label: "R+V · Herstellerankündigung (23.10.2026)",
    url: "https://www.ruv.de/newsroom/pressemitteilungen/2026-10-23-altersvorsorge-testimonial",
  },
} as const;

export const productQuestions = [
  {
    key: "protection",
    title: "Welcher Schutz zum vereinbarten Vertragsablauf wird gewünscht?",
    options: [
      ["none", "Keine Beitragsgarantie gewünscht"],
      ["atLeast80", "Mindestens 80 % der Beiträge und Zulagen"],
      ["full", "100 % der Beiträge und Zulagen"],
      ["open", "Unklar / keine Präferenz"],
    ],
  },
  {
    key: "investment",
    title: "Vorgefertigtes Modell oder eigene ETF-Auswahl?",
    options: [
      ["model", "Vorgefertigtes Modell"],
      ["etf", "Eigene Auswahl aus dem ETF-Angebot des Tarifs"],
      ["open", "Unklar / keine Präferenz"],
    ],
  },
  {
    key: "payout",
    title: "Lebenslange Rente, Fondsauszahlplan oder beides prüfen?",
    options: [
      ["annuity", "Lebenslange Rente"],
      ["plan", "Fondsauszahlplan"],
      ["both", "Beide Auszahlungsarten prüfen"],
      ["open", "Unklar / keine Präferenz"],
    ],
  },
] as const;

type Question = typeof productQuestions[number];
export type ProductAnswers = { [Q in Question as Q["key"]]: Q["options"][number][0] | "" };
export const emptyProductAnswers: ProductAnswers = { protection: "", investment: "", payout: "" };

export const featureLabels = {
  supported: "Erfüllt",
  conditional: "Teilweise / tarifabhängig",
  absent: "Nicht vorgesehen",
  unknown: "Nicht belegt / noch zu prüfen",
} as const;
type FeatureStatus = keyof typeof featureLabels;
type Protection = { basis: string; date: string; commitment: string } & (
  | { kind: "none" | "target" | "open" }
  | { kind: "guarantee"; level: 80 | 100 }
);
type Payout = { status: "public" | "conditional" | "open" | "absent"; description: string };
export const payoutLabels = { public: "Öffentlich belegt", conditional: "Tarifabhängig", open: "Offen", absent: "Nicht vorgesehen" };

export type ProductId = "basis" | "pro" | "garantie" | "ruv-standard" | "ruv-individuell" | "ruv-garantie-80";
type Product = {
  id: ProductId;
  provider: "Union Investment" | "R+V";
  name: string;
  manufacturerStatus: "Öffentlich angekündigt";
  bankStatus: "Unbestätigt";
  investment: string;
  investmentDetails: string;
  model: FeatureStatus;
  etf: FeatureStatus;
  protection: Protection;
  annuity: Payout;
  plan: Payout & { kind: "fund" | "generic" };
  payoutSource: "unionPayout" | "ruvOverview";
  costs: { data: "internal_working_value" | "open"; publicDisplay: "not_released" };
  limits: string;
  benefit: string;
  risk: string;
  sources: readonly (keyof typeof sources)[];
};

const announcement = {
  manufacturerStatus: "Öffentlich angekündigt",
  bankStatus: "Unbestätigt",
  costs: { data: "internal_working_value", publicDisplay: "not_released" },
} as const;
const noGuarantee = {
  kind: "none",
  basis: "Beiträge und Zulagen",
  date: "Beginn der Auszahlphase",
  commitment: "Keine Beitragsgarantie angekündigt.",
} as const;
const unionPayout = {
  annuity: { status: "absent", description: "Union bietet in diesem Produkt keine lebenslange Rente an und auch keine Übertragung an einen Versicherer zum Beginn der Auszahlphase." },
  plan: { kind: "fund", status: "public", description: "Union beschreibt monatliche Auszahlungen aus dem Fondsvermögen." },
  payoutSource: "unionPayout",
} as const;
const ruvPayout = {
  annuity: { status: "public", description: "R+V kündigt eine lebenslange Rente an. Die individuelle Rentenhöhe ist offen." },
  plan: { kind: "generic", status: "public", description: "R+V nennt einen Auszahlplan als Wahloption zu Beginn der Auszahlphase. Die Fondsmechanik ist öffentlich nicht belegt." },
  payoutSource: "ruvOverview",
} as const;

const productEntries: Record<ProductId, Product> = {
  "basis": {
    ...announcement, ...unionPayout,
    id: "basis", provider: "Union Investment", name: "UniVorsorge Basis",
    investment: "Zwei vorgegebene aktive ETFs für globale Aktien und Anleihen im Lebenszyklusmodell.",
    investmentDetails: "Die Aufteilung ist im vorgesehenen Rahmen wählbar. Vor dem Auszahlungsbeginn soll die Aktienquote nach dem Lebenszyklusmodell sinken.",
    model: "supported", etf: "absent", protection: noGuarantee,
    limits: "Verbindliche Bedingungen für Aufteilung, Umschichtung und konkreten Tarifzugang sind offen.",
    benefit: "Aktien- und Anleihenbausteine in einem vorgegebenen Modell.",
    risk: "Beide Bausteine schwanken. Das Ablaufmanagement sichert keinen Mindestbetrag.",
    sources: ["unionOverview", "unionFaq"],
  },
  "pro": {
    ...announcement, ...unionPayout,
    id: "pro", provider: "Union Investment", name: "UniVorsorge Pro",
    investment: "Aktiv gemanagter globaler Aktienfonds mit Stabilisierungsphase.",
    investmentDetails: "Zum Ende der Ansparphase ist ein Ablaufmanagement vorgesehen. Dessen genaue Steuerung ist offen.",
    model: "supported", etf: "absent",
    protection: {
      kind: "target",
      basis: "80 % des Kapitals zu Beginn der Stabilisierungsphase",
      date: "Ziel für das Ende der Ansparphase",
      commitment: "80-%-Wertsicherungsziel ohne Beitragsgarantie. Der Zielwert kann unterschritten werden.",
    },
    limits: "Tarifzugang und genaue Regeln des Ablaufmanagements sind offen.",
    benefit: "Weltweite Aktienanlage mit vorgesehener Stabilisierung vor der Auszahlung.",
    risk: "Aktienverluste und eine Unterschreitung des Wertsicherungsziels sind möglich.",
    sources: ["unionFaq", "unionOverview"],
  },
  "garantie": {
    ...announcement, ...unionPayout,
    id: "garantie", provider: "Union Investment", name: "UniVorsorge Garantie",
    investment: "Angekündigtes weltweites Aktien- und Anleihenportfolio mit Sicherungsmechanismus.",
    investmentDetails: "Die Anlage verbindet Kapitalmarktbeteiligung mit einer angekündigten Beitragserhaltungszusage.",
    model: "supported", etf: "absent",
    protection: {
      kind: "guarantee", level: 100,
      basis: "100 % der eingezahlten Beiträge und Zulagen",
      date: "Beginn der Auszahlphase",
      commitment: "Beitragserhaltungszusage laut Ankündigung. Maßgeblich sind die endgültigen Vertragsbedingungen.",
    },
    limits: "Union nennt eine Fünfjahresfrist bis zur Auszahlphase. Geltung im konkreten Tarif und Abschlussfähigkeit sind zu prüfen.",
    benefit: "Angekündigter Beitragserhalt einschließlich Zulagen zum vereinbarten Stichtag.",
    risk: "Marktschwankungen vor dem Stichtag und begrenzter Spielraum für die Aktienanlage.",
    sources: ["unionOverview", "unionFaq"],
  },
  "ruv-standard": {
    ...announcement, ...ruvPayout,
    id: "ruv-standard", provider: "R+V", name: "R+V-AltersvorsorgeDepot standard",
    investment: "Standardlösung mit zwei vorgegebenen ETFs und anpassbarer Aufteilung.",
    investmentDetails: "Die öffentlich geprüfte Produktübersicht benennt die beiden ETFs nicht einzeln. Die konkrete Zuordnung der passiven ETF-Kategorien, ISINs und Startgewichte ist noch zu prüfen.",
    model: "supported", etf: "absent", protection: noGuarantee,
    limits: "Konkrete Fondsmerkmale, Tarifkennung und verbindlicher Tarifzugang sind offen.",
    benefit: "Zwei vorgegebene Bausteine mit anpassbarer Aufteilung.",
    risk: "Marktbedingte Verluste bleiben möglich. Die Fondsauswahl ist vorgegeben.",
    sources: ["ruvOverview", "ruvPress"],
  },
  "ruv-individuell": {
    ...announcement, ...ruvPayout,
    id: "ruv-individuell", provider: "R+V", name: "R+V-AltersvorsorgeDepot individuell",
    investment: "Eigene Auswahl aus elf angekündigten ETFs oder Nutzung eines ETF-Komfortportfolios.",
    investmentDetails: "R+V kündigt drei aktive und acht passive ETFs an. Die Produktseite nennt ETF-Komfortportfolios. Die fachliche Orientierung sieht zwei Komfortportfolios vor. Die vollständige aktuelle Liste, ISINs, TER und Gewichte bleiben offen.",
    model: "supported", etf: "supported", protection: noGuarantee,
    limits: "Verbindliche Auswahl- und Gewichtungsregeln, Tarifkennung und Tarifzugang sind offen.",
    benefit: "Individuelle ETF-Zusammenstellung oder ein vorgefertigtes ETF-Portfolio.",
    risk: "Marktverluste bleiben möglich. Die Anlage hängt von Auswahl und Aufteilung ab.",
    sources: ["ruvPress", "ruvOverview"],
  },
  "ruv-garantie-80": {
    ...announcement, ...ruvPayout,
    id: "ruv-garantie-80", provider: "R+V", name: "R+V-AltersvorsorgeGarantie 80",
    investment: "R+V-Sicherungsvermögen kombiniert mit einem chancenorientierten ETF-Teil.",
    investmentDetails: "Das Sicherungsvermögen dient der Absicherung. Der ETF-Teil ist dem Kapitalmarkt ausgesetzt und seine Aufteilung ist laut R+V anpassbar. Die konkrete Sicherungssteuerung ist offen.",
    model: "unknown", etf: "conditional",
    protection: {
      kind: "guarantee", level: 80,
      basis: "80 % der eingezahlten Beiträge und Zulagen",
      date: "Beginn der Auszahlphase",
      commitment: "Stichtagsgarantie laut Ankündigung. Der Vertragswert kann während der Laufzeit schwanken. Ein jederzeitiger 80-%-Depotboden ist nicht zugesagt.",
    },
    limits: "Endgültige Sicherungsregeln, zulässige ETF-Auswahl, Tarifkennung und Tarifzugang sind offen.",
    benefit: "Angekündigte Teilabsicherung zum Auszahlungsbeginn und ein ETF-Anteil.",
    risk: "Wertschwankungen bis zum Stichtag und begrenzter Spielraum im ETF-Teil.",
    sources: ["ruvPress", "ruvOverview"],
  },
};

const displayOrder: readonly ProductId[] = ["basis", "ruv-standard", "pro", "ruv-individuell", "garantie", "ruv-garantie-80"];
export const products = displayOrder.map(id => productEntries[id]);

export function productSources(product: Product) {
  return product.sources.map(key => sources[key]);
}

export function productPayoutSource(product: Product) {
  return sources[product.payoutSource];
}

export function costLabel(costs: Product["costs"]) {
  if (costs.data === "internal_working_value" && costs.publicDisplay === "not_released") {
    return "Arbeitswert vorhanden, für öffentliche Anzeige nicht freigegeben.";
  }
  return "Kosten offen.";
}

const payoutMatch: Record<Payout["status"], FeatureStatus> = {
  public: "supported",
  conditional: "conditional",
  open: "unknown",
  absent: "absent",
};

function ownData(value: unknown, key: PropertyKey): unknown {
  if (value === null || typeof value !== "object") return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && Object.hasOwn(descriptor, "value") ? descriptor.value : undefined;
}

function readAnswer<Q extends Question>(answers: unknown, question: Q): Q["options"][number][0] | "" | undefined {
  if (Array.isArray(answers)) return undefined;
  const value = ownData(answers, question.key);
  if (value === "") return "";
  return question.options.find(([option]) => value === option)?.[0];
}

export function nextProductAnswers(input: unknown, current: ProductAnswers): ProductAnswers | null {
  const protection = readAnswer(input, productQuestions[0]);
  const investment = readAnswer(input, productQuestions[1]);
  const payout = readAnswer(input, productQuestions[2]);
  if (protection === undefined || investment === undefined || payout === undefined) return null;
  if (current.protection === protection && current.investment === investment && current.payout === payout) return current;
  return { protection, investment, payout };
}

/** Reject a malformed selection as a whole. Keep valid selections in display order. */
export function nextProductSelection(input: unknown, current: readonly ProductId[]): readonly ProductId[] | null {
  if (!Array.isArray(input) || input.length > comparisonLimit) return null;
  const ids = new Set<ProductId>();
  for (let index = 0; index < input.length; index++) {
    const value = ownData(input, index);
    const id = displayOrder.find(candidate => candidate === value);
    if (id === undefined || ids.has(id)) return null;
    ids.add(id);
  }
  const next = displayOrder.filter(id => ids.has(id));
  return next.length === current.length && next.every(id => current.includes(id)) ? current : next;
}

export function preferenceMatches(product: Product, answers: unknown) {
  const investment = readAnswer(answers, productQuestions[1]);
  return {
    protection: protectionMatch(product.protection, readAnswer(answers, productQuestions[0])),
    investment: investment === "model" ? product.model : investment === "etf" ? product.etf
      : investment === undefined ? "unknown" as const : null,
    payout: payoutPreference(product, readAnswer(answers, productQuestions[2])),
  };
}

function protectionMatch(protection: Product["protection"], preference: ProductAnswers["protection"] | undefined): FeatureStatus | null {
  if (preference === "" || preference === "open" || preference === "none") return null;
  if (preference !== "atLeast80" && preference !== "full") return "unknown";
  if (protection.kind === "open") return "unknown";
  if (protection.kind !== "guarantee") return "absent";
  return preference === "atLeast80" || (preference === "full" && protection.level === 100) ? "supported" : "absent";
}

function payoutPreference(product: Product, preference: ProductAnswers["payout"] | undefined): FeatureStatus | null {
  if (preference === "" || preference === "open") return null;
  if (preference === undefined) return "unknown";
  const annuity = payoutMatch[product.annuity.status];
  if (preference === "annuity") return annuity;
  const fundPlan = product.plan.kind === "fund" ? payoutMatch[product.plan.status] : "unknown";
  if (preference === "plan") return fundPlan;
  if (preference !== "both") return "unknown";
  if (annuity === "absent" || fundPlan === "absent") return "absent";
  if (annuity === "unknown" || fundPlan === "unknown") return "unknown";
  return annuity === "conditional" || fundPlan === "conditional" ? "conditional" : "supported";
}
