"use client";

import {
  ChangeEvent,
  CSSProperties,
  Dispatch,
  ReactNode,
  SetStateAction,
  useEffect,
  useRef,
  useState,
} from "react";
import * as XLSX from "xlsx";
import {
  AdvisoryData,
  emptyAdvisory,
  euro,
  modules,
  percent,
  priorityOptions,
  RiskAssessment,
  RiskLevel,
  scenarios,
  Scope,
} from "./navigator-config";
import {
  assetClasses,
  AssetClass,
  dataSources,
  houseProducts,
  managedPortfolios,
  modelPortfolios,
  solutionTypes,
} from "./investment-data";
import {
  AdvisoryCase,
  AdvisorId,
  allocationAmountInCapitalPot,
  allocationCapitalCoverageTotal,
  allocationCapitalPotAmounts,
  bucketForMonths,
  CapitalPotId,
  CapitalPot,
  capitalPots,
  caseSnapshot,
  customerChecklistCategories,
  CustomerChecklistCategory,
  createCase,
  createPlan,
  depotAssetAmounts,
  depotPlanAssetAmounts,
  DepotHolding,
  defaultAdvisorId,
  maturityBuckets,
  monthsUntilNeed,
  ModuleState,
  normalizeImportedCase,
  planAssetAmounts,
  productAssetMix,
  PlannerAllocation,
  InvestmentPlan,
  legacyBucketAmountsForCapitalPots,
  planningShortfall,
  strategicAmount,
  StructurePlan,
  VvFilters,
  advisors,
} from "./case-model";
import { DepotCsvResult, parseDepotCsv } from "./depot-csv";
import { depotCountryName } from "./depot-country-codes";

type View = "home" | "cases" | "wizard" | "planner" | "depot" | "export";

const germanDate = (value?: string) =>
  value
    ? new Intl.DateTimeFormat("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(new Date(`${value}T12:00:00`))
    : "";

const steps = [
  ["Vermögensart", "Privat, betrieblich oder beides"],
  ["Ausgangslage", "Vermögen und Liquidität"],
  ["Kapitalbedarfe", "Beträge und konkrete Termine"],
  ["Ziele & Risiko", "Horizont und Schwankungen"],
  ["Fachmodule", "Gezielte Vertiefungen"],
  ["Ergebnis", "Struktur und nächste Schritte"],
] as const;

const riskText: Record<RiskLevel, { title: string; text: string }> = {
  1: {
    title: "Sehr defensiv",
    text: "Kapitalerhalt hat Vorrang; Schwankungen sollen sehr gering bleiben.",
  },
  2: {
    title: "Defensiv",
    text: "Begrenzte Schwankungen werden für einen moderaten Ertrag akzeptiert.",
  },
  3: {
    title: "Ausgewogen",
    text: "Ertrag und Stabilität werden gleichgewichtet.",
  },
  4: {
    title: "Wachstumsorientiert",
    text: "Deutliche zwischenzeitliche Verluste werden für höhere Chancen akzeptiert.",
  },
  5: {
    title: "Offensiv",
    text: "Langfristiges Wachstum steht trotz hoher Schwankungen im Vordergrund.",
  },
};

const riskQuestions: Array<{
  key: keyof RiskAssessment;
  title: string;
  options: string[];
}> = [
  {
    key: "lossReaction",
    title: "Wie würden Sie bei einem deutlichen zwischenzeitlichen Verlust reagieren?",
    options: [
      "Sofort verkaufen",
      "Risiko deutlich reduzieren",
      "Zunächst abwarten",
      "Strategie beibehalten",
      "Nachkauf bewusst prüfen",
    ],
  },
  {
    key: "temporaryLoss",
    title: "Welche vorübergehende Wertminderung erscheint noch tragbar?",
    options: ["Bis 5 %", "Bis 10 %", "Bis 15 %", "Bis 25 %", "Mehr als 25 %"],
  },
  {
    key: "financialCapacity",
    title: "Welche Auswirkung hätte ein Verlust auf geplante Ausgaben?",
    options: [
      "Ziele wären gefährdet",
      "Deutliche Einschränkungen",
      "Teilweise Anpassungen",
      "Kaum Einschränkungen",
      "Keine Einschränkungen",
    ],
  },
];

function riskOrientation(data: AdvisoryData, assessment = data.riskAssessment) {
  const answers = Object.values(assessment);
  if (answers.some((value) => value === null)) return null;
  const horizon =
    data.horizon <= 2 ? 1 : data.horizon <= 4 ? 2 : data.horizon <= 7 ? 3 : data.horizon <= 12 ? 4 : 5;
  const experience = data.experience.startsWith("Keine")
    ? 1
    : data.experience === "Grundkenntnisse"
      ? 2
      : data.experience === "Erweiterte Kenntnisse"
        ? 3
        : 4;
  const raw = Math.round(
    (Number(assessment.lossReaction) +
      Number(assessment.temporaryLoss) +
      Number(assessment.financialCapacity) +
      horizon +
      experience) /
      5,
  );
  return Math.max(1, Math.min(5, raw)) as RiskLevel;
}

const goalOptions = [
  "Liquidität rentierlich strukturieren",
  "Vermögensaufbau",
  "Vermögen erhalten",
  "Laufende Erträge erzielen",
  "Struktur optimieren",
  "Vermögen ganzheitlich ordnen",
];

const investmentFrequencies: Array<{
  value: InvestmentPlan["frequency"];
  label: string;
}> = [
  { value: "monthly", label: "monatlich" },
  { value: "quarterly", label: "vierteljährlich" },
  { value: "semiannual", label: "halbjährlich" },
  { value: "annual", label: "jährlich" },
];

const investmentPlanTotal = (entry: InvestmentPlan) =>
  entry.installments > 0 ? entry.installmentAmount * entry.installments : 0;
const moduleDetails: Record<string, string[]> = {
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

type ModuleSlide = {
  eyebrow: string;
  title: string;
  text: string;
  points: string[];
  checks: Array<{ id: string; label: string }>;
};

const moduleSlides: Record<string, ModuleSlide[]> = {
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

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const nowLabel = () =>
  new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date());
const dateLabel = (value?: string) =>
  value
    ? new Intl.DateTimeFormat("de-DE", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "–";
const parseAmount = (value: string) =>
  Number(value.replace(/[^0-9]/g, "")) || 0;
const safeFileName = (value: string) =>
  (value || "vermoegensnavigator")
    .trim()
    .replace(/[^a-zA-Z0-9äöüÄÖÜß_-]+/g, "-")
    .replace(/-+/g, "-");
const uid = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const blankModuleState = (): ModuleState => ({
  status: "not_started",
  currentSlide: 0,
  checklist: {},
  notes: "",
  updatedAt: new Date().toISOString(),
});
const advisorFor = (advisorId: AdvisorId) =>
  advisors.find((advisor) => advisor.id === advisorId) ?? advisors[0];
const moduleStatusLabel = (status: ModuleState["status"]) =>
  status === "complete"
    ? "Vollständig"
    : status === "in_progress"
      ? "In Bearbeitung"
      : "Nicht begonnen";

function scopeLabel(scope: Scope | null) {
  return scope === "private"
    ? "Privatvermögen"
    : scope === "business"
      ? "Betriebsvermögen"
      : scope === "combined"
        ? "Betriebs- und Privatvermögen"
        : "Noch nicht gewählt";
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function AmountField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  hint?: string;
}) {
  return (
    <label className="field amount-field">
      <span>{label}</span>
      <div>
        <input
          inputMode="numeric"
          value={value ? value.toLocaleString("de-DE") : ""}
          placeholder="0"
          onChange={(event) => onChange(parseAmount(event.target.value))}
        />
        <b>€</b>
      </div>
      {hint && <small>{hint}</small>}
    </label>
  );
}

function SectionIntro({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="section-intro">
      <span>{number}</span>
      <div>
        <h2>{title}</h2>
        <p>{children}</p>
      </div>
    </div>
  );
}

function CustomerChecklistEditor({
  item,
  setItem,
  title = "Kunden-Checkliste",
}: {
  item: AdvisoryCase;
  setItem: Dispatch<SetStateAction<AdvisoryCase>>;
  title?: string;
}) {
  const [text, setText] = useState("");
  const [category, setCategory] = useState<CustomerChecklistCategory>(
    customerChecklistCategories[0],
  );
  const addItem = () => {
    const nextText = text.trim();
    if (!nextText) return;
    setItem((current) => ({
      ...current,
      customerChecklist: [
        ...current.customerChecklist,
        {
          id: uid("kundenpunkt"),
          text: nextText,
          category,
          done: false,
          source: "general",
          createdAt: new Date().toISOString(),
        },
      ],
    }));
    setText("");
  };
  const updateItem = (id: string, done: boolean) =>
    setItem((current) => ({
      ...current,
      customerChecklist: current.customerChecklist.map((entry) =>
        entry.id === id ? { ...entry, done } : entry,
      ),
    }));
  const removeItem = (id: string) =>
    setItem((current) => ({
      ...current,
      customerChecklist: current.customerChecklist.filter(
        (entry) => entry.id !== id,
      ),
    }));
  return (
    <section className="customer-checklist no-print">
      <div className="customer-checklist-head">
        <div>
          <p className="eyebrow">FÜR DEN KUNDEN</p>
          <h3>{title}</h3>
          <p>
            Unterlagen, Unterschriften und externe Klärungen dieses Falls. Alle
            Einträge erscheinen im Kundenexport.
          </p>
        </div>
        <span>
          {item.customerChecklist.filter((entry) => !entry.done).length} offen
        </span>
      </div>
      <div className="customer-checklist-add">
        <select
          aria-label="Art des nächsten Schritts"
          value={category}
          onChange={(event) =>
            setCategory(event.target.value as CustomerChecklistCategory)
          }
        >
          {customerChecklistCategories.map((entry) => (
            <option key={entry}>{entry}</option>
          ))}
        </select>
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") addItem();
          }}
          placeholder="z. B. Versicherungsordner zum Folgetermin mitbringen"
        />
        <button className="primary" onClick={addItem} disabled={!text.trim()}>
          Hinzufügen
        </button>
      </div>
      {item.customerChecklist.length === 0 ? (
        <p className="customer-checklist-empty">
          Noch keine nächsten Schritte für den Kunden erfasst.
        </p>
      ) : (
        <div className="customer-checklist-list">
          {item.customerChecklist.map((entry) => {
            const sourceModule = entry.moduleId
              ? modules.find((module) => module.id === entry.moduleId)
              : null;
            return (
              <label key={entry.id} className={entry.done ? "done" : ""}>
                <input
                  type="checkbox"
                  checked={entry.done}
                  onChange={(event) =>
                    updateItem(entry.id, event.target.checked)
                  }
                />
                <span>
                  <strong>{entry.text}</strong>
                  <small>
                    {entry.category}
                    {sourceModule ? ` · aus ${sourceModule.title}` : ""}
                  </small>
                </span>
                <button
                  type="button"
                  aria-label="Eintrag löschen"
                  onClick={(event) => {
                    event.preventDefault();
                    removeItem(entry.id);
                  }}
                >
                  ×
                </button>
              </label>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default function Home() {
  const [view, setView] = useState<View>("home");
  const [activeCase, setActiveCase] = useState<AdvisoryCase>(() =>
    createCase(),
  );
  const [newCaseAdvisorId, setNewCaseAdvisorId] =
    useState<AdvisorId>(defaultAdvisorId);
  const [savedCases, setSavedCases] = useState<AdvisoryCase[]>([]);
  const [profileOpen, setProfileOpen] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const storedAdvisor = window.localStorage.getItem(
          "vermoegensnavigator-advisor",
        ) as AdvisorId | null;
        if (storedAdvisor && advisors.some((entry) => entry.id === storedAdvisor)) {
          setNewCaseAdvisorId(storedAdvisor);
          setActiveCase((current) => ({
            ...current,
            advisorId: storedAdvisor,
          }));
        }
        const stored = window.localStorage.getItem(
          "vermoegensnavigator-cases-v2",
        );
        if (stored) {
          const parsed = JSON.parse(stored) as AdvisoryCase[];
          if (Array.isArray(parsed))
            setSavedCases(
              parsed
                .map((entry) => normalizeImportedCase(entry, false))
                .filter((entry): entry is AdvisoryCase => Boolean(entry)),
            );
        } else {
          const old = window.localStorage.getItem("vermoegensnavigator-draft");
          if (old) {
            const legacy = JSON.parse(old) as { data?: AdvisoryData };
            if (legacy.data) {
              const migrated = createCase(legacy.data);
              setActiveCase(migrated);
              setSavedCases([migrated]);
            }
          }
        }
      } catch {
        window.localStorage.removeItem("vermoegensnavigator-cases-v2");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const persist = (items: AdvisoryCase[]) => {
    setSavedCases(items);
    window.localStorage.setItem(
      "vermoegensnavigator-cases-v2",
      JSON.stringify(items),
    );
  };

  const saveCase = (withVersion = false) => {
    const updated: AdvisoryCase = {
      ...clone(activeCase),
      updatedAt: new Date().toISOString(),
    };
    if (withVersion) {
      updated.versions = [
        ...updated.versions,
        {
          id: uid("version"),
          label: `Version ${updated.versions.length + 1} – ${nowLabel()}`,
          createdAt: new Date().toISOString(),
          snapshot: caseSnapshot(updated),
        },
      ];
    }
    const exists = savedCases.some((item) => item.id === updated.id);
    persist(
      exists
        ? savedCases.map((item) => (item.id === updated.id ? updated : item))
        : [updated, ...savedCases],
    );
    setActiveCase(updated);
  };

  const start = (scope?: Scope, scenarioId?: string) => {
    const scenario = scenarios.find((item) => item.id === scenarioId);
    const next = createCase(
      scenario
        ? scenario.data
        : { ...clone(emptyAdvisory), scope: scope ?? null },
      newCaseAdvisorId,
    );
    setActiveCase(next);
    setView("wizard");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openSavedCase = (item: AdvisoryCase) => {
    setActiveCase(clone(item));
    setNewCaseAdvisorId(item.advisorId);
    window.localStorage.setItem("vermoegensnavigator-advisor", item.advisorId);
    setView("wizard");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const removeSavedCase = (id: string) => {
    if (window.confirm("Diesen lokal gespeicherten Testfall wirklich löschen?"))
      persist(savedCases.filter((item) => item.id !== id));
  };

  const exportJson = () =>
    download(
      new Blob(
        [
          JSON.stringify(
            {
              exportedAt: new Date().toISOString(),
              case: activeCase,
              dataSources,
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
      `${safeFileName(activeCase.advisory.caseName)}.json`,
    );
  const importJson = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const imported = normalizeImportedCase(JSON.parse(await file.text()));
      if (!imported) throw new Error("invalid");
      setActiveCase(imported);
      setNewCaseAdvisorId(imported.advisorId);
      window.localStorage.setItem(
        "vermoegensnavigator-advisor",
        imported.advisorId,
      );
      persist([imported, ...savedCases]);
      setView("wizard");
    } catch {
      window.alert(
        "Die Datei enthält keinen vollständigen VermögensNavigator-Fall.",
      );
    }
    event.target.value = "";
  };

  const activePlan =
    activeCase.plans.find((plan) => plan.id === activeCase.activePlanId) ??
    activeCase.plans[0];
  const preferredPlan =
    activeCase.plans.find((plan) => plan.preferred) ?? activePlan;
  const activeAdvisor = advisorFor(activeCase.advisorId);
  const selectAdvisor = (advisorId: AdvisorId) => {
    setNewCaseAdvisorId(advisorId);
    setActiveCase((current) => ({ ...current, advisorId }));
    window.localStorage.setItem("vermoegensnavigator-advisor", advisorId);
    setProfileOpen(false);
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setView("home")}>
          <span className="brand-logos" aria-label="Volksbank pur Private Banking">
            <img src="branding/volksbank-pur-logo.png" alt="Volksbank pur" />
            <i aria-hidden="true" />
            <span className="private-banking-mark">
              <img src="branding/private-banking-logo.png" alt="Private Banking" />
            </span>
          </span>
          <strong>VermögensNavigator</strong>
        </button>
        <div className="topbar-actions">
          <div className="profile-selector">
            <button
              className="profile-button"
              onClick={() => setProfileOpen((open) => !open)}
              aria-expanded={profileOpen}
              aria-haspopup="listbox"
            >
              <span>{activeAdvisor.initials}</span>
              <span>
                {activeAdvisor.name}<small>{activeAdvisor.title}</small>
              </span>
              <i aria-hidden="true">⌄</i>
            </button>
            {profileOpen && (
              <div className="profile-menu" role="listbox" aria-label="Verantwortliche Person">
                <p>Verantwortlich für diesen Fall</p>
                {advisors.map((advisor) => (
                  <button
                    key={advisor.id}
                    role="option"
                    aria-selected={advisor.id === activeCase.advisorId}
                    className={advisor.id === activeCase.advisorId ? "active" : ""}
                    onClick={() => selectAdvisor(advisor.id)}
                  >
                    <span>{advisor.initials}</span>
                    <span>
                      <strong>{advisor.name}</strong>
                      <small>{advisor.title}</small>
                    </span>
                    <i>{advisor.id === activeCase.advisorId ? "✓" : ""}</i>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>
      <aside className="sidebar">
        <nav>
          <button
            className={view === "home" ? "active" : ""}
            onClick={() => setView("home")}
          >
            <span>⌂</span>Übersicht
          </button>
          <button
            className={view === "cases" ? "active" : ""}
            onClick={() => setView("cases")}
          >
            <span>▤</span>Beratungsfälle{" "}
            <em className="nav-count">{savedCases.length}</em>
          </button>
          <button onClick={() => start()}>
            <span>＋</span>Neue Beratung
          </button>
          <button
            className={view === "planner" ? "active" : ""}
            onClick={() => setView("planner")}
          >
            <span>▦</span>Strukturplanung
          </button>
          <button
            className={view === "depot" ? "active" : ""}
            onClick={() => setView("depot")}
          >
            <span>◫</span>Depotcheck
          </button>
          <button
            className={view === "export" ? "active" : ""}
            onClick={() => setView("export")}
          >
            <span>⇩</span>Ergebnis & Export
          </button>
        </nav>
        <div className="sidebar-foot">
          <p>
            <strong>Prototyp V0.14</strong>
            <br />
            Browser-lokal, keine revisionssichere Speicherung.
          </p>
        </div>
      </aside>
      <section className="workspace">
        {view === "home" && (
          <HomeView
            start={start}
          />
        )}
        {view === "cases" && (
          <CasesView
            cases={savedCases}
            openCase={openSavedCase}
            removeCase={removeSavedCase}
            start={() => start()}
            importCase={() => importRef.current?.click()}
          />
        )}
        {view === "wizard" && (
          <WizardView
            item={activeCase}
            setItem={setActiveCase}
            saveCase={saveCase}
            setView={setView}
            exportJson={exportJson}
          />
        )}
        {view === "planner" && (
          <PlannerView
            item={activeCase}
            setItem={setActiveCase}
            saveCase={saveCase}
            setView={setView}
          />
        )}
        {view === "depot" && (
          <DepotOptimizer
            item={activeCase}
            setItem={setActiveCase}
            plan={activePlan}
            saveCase={saveCase}
            setView={setView}
          />
        )}
        {view === "export" && (
          <ExportCenter
            item={activeCase}
            setItem={setActiveCase}
            preferredPlan={preferredPlan}
            saveCase={saveCase}
            exportJson={exportJson}
            importJson={() => importRef.current?.click()}
          />
        )}
      </section>
      <input
        ref={importRef}
        className="visually-hidden"
        type="file"
        accept="application/json,.json"
        onChange={importJson}
      />
    </main>
  );
}

function HomeView({
  start,
}: {
  start: (scope?: Scope, scenarioId?: string) => void;
}) {
  return (
    <div className="home-view">
      <div className="welcome-row">
        <div>
          <p className="eyebrow">MODULARER BERATUNGSNAVIGATOR</p>
          <h1>Ein Fall. Mehrere Planungen. Eine konsistente Struktur.</h1>
        </div>
      </div>
      <section className="panel quick-start">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">SCHNELLSTART</p>
            <h2>Welcher Vermögensbereich steht im Fokus?</h2>
          </div>
          <span className="step-chip">Schritt 1 von 6</span>
        </div>
        <div className="scope-grid">
          <button onClick={() => start("private")}>
            <span className="scope-symbol">P</span>
            <strong>Privatvermögen</strong>
            <small>Liquidität, Depot, Vorsorge und Nachfolge</small>
            <i>→</i>
          </button>
          <button onClick={() => start("business")}>
            <span className="scope-symbol business">F</span>
            <strong>Betriebsvermögen</strong>
            <small>Firmenliquidität, Bilanzierung und Steuern</small>
            <i>→</i>
          </button>
          <button onClick={() => start("combined")}>
            <span className="scope-symbol combined">K</span>
            <strong>Beides verbinden</strong>
            <small>Unternehmerisches und privates Vermögen</small>
            <i>→</i>
          </button>
        </div>
        <div className="process-strip">
          {steps.map(([title], index) => (
            <span key={title} className={index === 0 ? "done" : ""}>
              <b>{index + 1}</b>
              {title}
            </span>
          ))}
        </div>
      </section>
      <section className="panel scenarios-panel" id="musterfaelle">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">FESTE TESTSZENARIEN</p>
            <h2>Komplette Falllogik prüfen</h2>
          </div>
          <p>Jeder Musterfall wird als unabhängiger neuer Fall geöffnet.</p>
        </div>
        <div className="scenario-grid">
          {scenarios.map((item) => (
            <button key={item.id} onClick={() => start(item.scope, item.id)}>
              <span className={`tag ${item.scope}`}>{item.tag}</span>
              <strong>{item.title}</strong>
              <small>{item.subtitle}</small>
              <span className="scenario-foot">
                Musterfall öffnen <b>→</b>
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function CasesView({
  cases,
  openCase,
  removeCase,
  start,
  importCase,
}: {
  cases: AdvisoryCase[];
  openCase: (item: AdvisoryCase) => void;
  removeCase: (id: string) => void;
  start: () => void;
  importCase: () => void;
}) {
  return (
    <div className="tool-view">
      <div className="tool-head">
        <div>
          <p className="eyebrow">FALLVERWALTUNG</p>
          <h1>Beratungsfälle</h1>
          <p>
            Jeder Eintrag enthält Beratungsdaten, Strukturvarianten,
            VV-Selektion, Depot, Versionen und Datenstände.
          </p>
        </div>
        <div className="tool-head-actions">
          <button className="secondary" onClick={importCase}>
            JSON importieren
          </button>
          <button className="primary" onClick={start}>
            ＋ Neuer Fall
          </button>
        </div>
      </div>
      {cases.length === 0 ? (
        <button className="empty-state" onClick={start}>
          <span>＋</span>
          <strong>Ersten Beratungsfall anlegen</strong>
          <small>oder einen vollständigen JSON-Fall importieren</small>
        </button>
      ) : (
        <div className="case-table">
          <div className="case-table-head">
            <span>Fall</span>
            <span>Bereich</span>
            <span>Planungen</span>
            <span>Versionen</span>
            <span>Stand</span>
            <span></span>
          </div>
          {cases.map((item) => (
            <div key={item.id}>
              <button className="case-main" onClick={() => openCase(item)}>
                <strong>
                  {item.advisory.caseName || "Unbenannter Testfall"}
                  <small>
                    {item.status} · {advisorFor(item.advisorId).name}
                  </small>
                </strong>
                <span>{scopeLabel(item.advisory.scope)}</span>
                <span>{item.plans.length}</span>
                <span>{item.versions.length}</span>
                <span>{dateLabel(item.updatedAt)}</span>
              </button>
              <button
                className="delete-button"
                onClick={() => removeCase(item.id)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WizardView({
  item,
  setItem,
  saveCase,
  setView,
  exportJson,
}: {
  item: AdvisoryCase;
  setItem: Dispatch<SetStateAction<AdvisoryCase>>;
  saveCase: (version?: boolean) => void;
  setView: (view: View) => void;
  exportJson: () => void;
}) {
  const [openModuleId, setOpenModuleId] = useState<string | null>(null);
  const data = item.advisory;
  const step = item.currentStep;
  const updateData = <K extends keyof AdvisoryData>(
    key: K,
    value: AdvisoryData[K],
  ) =>
    setItem((current) => {
      const nextAdvisory = { ...current.advisory, [key]: value };
      if (key !== "liquidAssets")
        return { ...current, advisory: nextAdvisory };
      const liquidAssets = Number(value) || 0;
      return {
        ...current,
        advisory: nextAdvisory,
        plans: current.plans.map((plan) =>
          plan.capitalMode === "linked"
            ? { ...plan, total: liquidAssets, updatedAt: new Date().toISOString() }
            : plan,
        ),
        vvFilters: {
          ...current.vvFilters,
          amount:
            current.vvFilters.amount === current.advisory.liquidAssets
              ? liquidAssets
              : current.vvFilters.amount,
        },
      };
    });
  const go = (next: number) => {
    setItem({ ...item, currentStep: Math.max(1, Math.min(6, next)) });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const addNeed = () =>
    updateData("needs", [
      ...data.needs,
      { id: Date.now(), purpose: "", amount: 0, years: 1, dueDate: "" },
    ]);
  const updateNeed = (
    id: number,
    changes: Partial<AdvisoryData["needs"][number]>,
  ) =>
    updateData(
      "needs",
      data.needs.map((need) =>
        need.id === id ? { ...need, ...changes } : need,
      ),
    );
  const togglePriority = (value: string) =>
    updateData(
      "priorities",
      data.priorities.includes(value)
        ? data.priorities.filter((entry) => entry !== value)
        : [...data.priorities, value],
    );
  const toggleModule = (value: string) =>
    updateData(
      "modules",
      data.modules.includes(value)
        ? data.modules.filter((entry) => entry !== value)
        : [...data.modules, value],
    );

  return (
    <div className="wizard-view">
      <div className="wizard-head">
        <button className="back-link" onClick={() => setView("home")}>
          ← Übersicht
        </button>
        <div>
          <p className="eyebrow">{data.caseName || "NEUE BERATUNG"}</p>
          <h1>{steps[step - 1][0]}</h1>
          <p>{steps[step - 1][1]}</p>
        </div>
        <div className="wizard-head-actions">
          <span>Schritt {step} von 6</span>
          <button onClick={() => saveCase(false)}>Fall speichern</button>
        </div>
      </div>
      <div className="wizard-layout">
        <ol className="wizard-steps">
          {steps.map(([title, subtitle], index) => (
            <li
              key={title}
              className={
                step === index + 1
                  ? "current"
                  : step > index + 1
                    ? "complete-step"
                    : ""
              }
            >
              <button onClick={() => data.scope && go(index + 1)}>
                <span>{step > index + 1 ? "✓" : index + 1}</span>
                <div>
                  <strong>{title}</strong>
                  <small>{subtitle}</small>
                </div>
              </button>
            </li>
          ))}
        </ol>
        <section className="wizard-card">
          {step === 1 && <ScopeStep data={data} update={updateData} />}
          {step === 2 && (
            <SituationStep
              data={data}
              update={updateData}
              depot={item.depot}
              setDepot={(depot) =>
                setItem({
                  ...item,
                  advisory: {
                    ...data,
                    depotValue: depot.reduce(
                      (sum, entry) => sum + entry.value,
                      0,
                    ),
                    hasDepot: depot.length > 0 || data.hasDepot,
                  },
                  depot,
                })
              }
              setView={setView}
            />
          )}
          {step === 3 && (
            <NeedsStep
              data={data}
              referenceDate={item.createdAt}
              update={updateData}
              addNeed={addNeed}
              updateNeed={updateNeed}
            />
          )}
          {step === 4 && (
            <GoalsStep
              data={data}
              update={updateData}
              togglePriority={togglePriority}
            />
          )}
          {step === 5 && (
            <ModulesStep
              data={data}
              moduleStates={item.moduleStates}
              toggleModule={toggleModule}
              openModule={setOpenModuleId}
            />
          )}
          {step === 6 && (
            <ResultStep
              item={item}
              setItem={setItem}
              setView={setView}
              exportJson={exportJson}
              openModule={setOpenModuleId}
            />
          )}
          <div className="wizard-actions no-print">
            <button
              className="secondary"
              onClick={() => (step === 1 ? setView("home") : go(step - 1))}
            >
              {step === 1 ? "Abbrechen" : "← Zurück"}
            </button>
            <div>
              <button className="text-button" onClick={() => saveCase(false)}>
                Fall speichern
              </button>
              {step < 6 ? (
                <button
                  className="primary"
                  disabled={step === 1 && !data.scope}
                  onClick={() => go(step + 1)}
                >
                  Weiter →
                </button>
              ) : (
                <button className="primary" onClick={() => setView("planner")}>
                  Struktur planen →
                </button>
              )}
            </div>
          </div>
        </section>
      </div>
      {openModuleId && (
        <ModuleWorkspace
          moduleId={openModuleId}
          item={item}
          setItem={setItem}
          close={() => setOpenModuleId(null)}
          setView={setView}
        />
      )}
    </div>
  );
}

function ScopeStep({
  data,
  update,
}: {
  data: AdvisoryData;
  update: <K extends keyof AdvisoryData>(
    key: K,
    value: AdvisoryData[K],
  ) => void;
}) {
  const options: Array<[Scope, string, string]> = [
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
  return (
    <>
      <SectionIntro
        number="01"
        title="Welche Vermögensbereiche sollen betrachtet werden?"
      >
        Die Auswahl steuert Fragen, Prüfpunkte und Fachmodule.
      </SectionIntro>
      <div className="large-options">
        {options.map(([value, title, text]) => (
          <button
            key={value}
            className={data.scope === value ? "selected" : ""}
            onClick={() => update("scope", value)}
          >
            <span>
              {value === "private" ? "P" : value === "business" ? "F" : "K"}
            </span>
            <div>
              <strong>{title}</strong>
              <small>{text}</small>
            </div>
            <i>{data.scope === value ? "✓" : ""}</i>
          </button>
        ))}
      </div>
    </>
  );
}

function useDepotCsvImport(
  depot: DepotHolding[],
  setDepot: (next: DepotHolding[]) => void,
) {
  const csvRef = useRef<HTMLInputElement>(null);
  const [csvPreview, setCsvPreview] = useState<{
    fileName: string;
    result: DepotCsvResult;
  } | null>(null);
  const [csvError, setCsvError] = useState("");
  const importCsv = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const result = parseDepotCsv(await file.arrayBuffer());
      setCsvPreview({ fileName: file.name, result });
      setCsvError("");
    } catch (error) {
      setCsvPreview(null);
      setCsvError(
        error instanceof Error ? error.message : "Die CSV konnte nicht gelesen werden.",
      );
    }
    event.target.value = "";
  };
  const applyCsv = (mode: "replace" | "append") => {
    if (!csvPreview) return;
    setDepot(
      mode === "replace"
        ? csvPreview.result.rows
        : [...depot, ...csvPreview.result.rows],
    );
    setCsvPreview(null);
  };
  return {
    open: () => csvRef.current?.click(),
    input: (
      <input
        ref={csvRef}
        type="file"
        className="visually-hidden"
        accept=".csv,text/csv"
        onChange={importCsv}
      />
    ),
    preview: (
      <>
        {csvError && <div className="csv-error">{csvError}</div>}
        {csvPreview && (
          <div className="csv-preview">
            <div>
              <p className="eyebrow">IMPORTVORSCHAU</p>
              <h3>{csvPreview.fileName}</h3>
              <p>
                {csvPreview.result.format === "structure-overview"
                  ? "Strukturübersicht erkannt"
                  : "Navigator-Vorlage erkannt"}
              </p>
            </div>
            <div className="csv-preview-metrics">
              <span>
                <b>{csvPreview.result.rows.length}</b>
                Positionen
              </span>
              <span>
                <b>
                  {euro.format(
                    csvPreview.result.rows.reduce((sum, row) => sum + row.value, 0),
                  )}
                </b>
                Gesamtwert
              </span>
              <span className={csvPreview.result.unresolved > 0 ? "warning" : ""}>
                <b>{csvPreview.result.unresolved}</b>
                Zuordnungen offen
              </span>
            </div>
            {csvPreview.result.ignoredPersonalColumns && (
              <p className="csv-privacy-note">
                Depotnummer und Depotinhaber wurden erkannt, werden aber bewusst
                nicht übernommen. Der öffentliche Prototyp verarbeitet nur die
                Positionsdaten im Browser.
              </p>
            )}
            <div className="csv-preview-actions">
              <button className="primary" onClick={() => applyCsv("replace")}>
                Bestehendes Depot ersetzen
              </button>
              {depot.length > 0 && (
                <button className="secondary" onClick={() => applyCsv("append")}>
                  Positionen ergänzen
                </button>
              )}
              <button className="text-button" onClick={() => setCsvPreview(null)}>
                Abbrechen
              </button>
            </div>
          </div>
        )}
      </>
    ),
  };
}

function SituationStep({
  data,
  update,
  depot,
  setDepot,
  setView,
}: {
  data: AdvisoryData;
  update: <K extends keyof AdvisoryData>(
    key: K,
    value: AdvisoryData[K],
  ) => void;
  depot: DepotHolding[];
  setDepot: (depot: DepotHolding[]) => void;
  setView: (view: View) => void;
}) {
  const business = data.scope === "business" || data.scope === "combined";
  const csvImport = useDepotCsvImport(depot, setDepot);
  const addHolding = () =>
    setDepot([
      ...depot,
      {
        id: uid("holding"),
        name: "",
        value: 0,
        assetClass: "Geldwerte",
        region: "Weltweit",
        risk: 2,
        plannedSale: 0,
        note: "",
      },
    ]);
  const updateHolding = (id: string, changes: Partial<DepotHolding>) =>
    setDepot(
      depot.map((entry) =>
        entry.id === id ? { ...entry, ...changes } : entry,
      ),
    );
  return (
    <>
      <SectionIntro number="02" title="Wie sieht die heutige Ausgangslage aus?">
        Erfasst wird nur, was für die Strukturentscheidung benötigt wird.
      </SectionIntro>
      <div className="form-grid">
        <label className="field full">
          <span>Bezeichnung des Testfalls</span>
          <input
            value={data.caseName}
            onChange={(event) => update("caseName", event.target.value)}
            placeholder="z. B. Muster GmbH – Liquiditätsanlage"
          />
          <small>Keine echten Namen oder Kundendaten verwenden.</small>
        </label>
        <label className="field">
          <span>Vermögensperspektive</span>
          <input value={scopeLabel(data.scope)} disabled />
        </label>
        {business && (
          <label className="field">
            <span>Rechtsform</span>
            <select
              value={data.legalForm}
              onChange={(event) => update("legalForm", event.target.value)}
            >
              <option>GmbH</option>
              <option>GmbH &amp; Co. KG</option>
              <option>AG</option>
              <option>Personengesellschaft</option>
              <option>Einzelunternehmen</option>
              <option>Stiftung</option>
              <option>Sonstige</option>
            </select>
          </label>
        )}
        <AmountField
          label={
            business ? "Verfügbare Liquidität gesamt" : "Liquide Mittel gesamt"
          }
          value={data.liquidAssets}
          onChange={(value) => update("liquidAssets", value)}
        />
        <AmountField
          label={
            business ? "Betriebs- / Sicherheitsreserve" : "Sicherheitsreserve"
          }
          value={data.reserve}
          onChange={(value) => update("reserve", value)}
        />
        <AmountField
          label="Wertpapierdepot"
          value={data.depotValue}
          onChange={(value) => {
            update("depotValue", value);
            update("hasDepot", value > 0);
          }}
          hint={
            depot.length
              ? "Wird aus den unten erfassten Positionen berechnet."
              : "Gesamtwert kann direkt oder über einzelne Positionen erfasst werden."
          }
        />
        <AmountField
          label="Weitere Vermögenswerte"
          value={data.otherAssets}
          onChange={(value) => update("otherAssets", value)}
        />
        <label className="check-row full">
          <input
            type="checkbox"
            checked={data.hasDepot}
            onChange={(event) => update("hasDepot", event.target.checked)}
          />
          <span>
            <strong>Vorhandenes Depot einbeziehen</strong>
            <small>
              Aktuelle Struktur, Risiken, Kosten und steuerliche Aspekte werden
              im Depotmodul geprüft.
            </small>
          </span>
        </label>
        {(data.hasDepot || data.depotValue > 0 || depot.length > 0) && (
          <section className="situation-depot full">
            <div className="situation-depot-head">
              <div>
                <strong>Depotpositionen</strong>
                <small>
                  Optional bereits hier erfassen; dieselben Positionen
                  erscheinen im Depotcheck.
                </small>
              </div>
              <div>
                <button className="secondary" onClick={csvImport.open}>
                  Depot-CSV importieren
                </button>
                <button className="secondary" onClick={() => setView("depot")}>
                  Depotcheck öffnen
                </button>
                <button className="secondary" onClick={addHolding}>
                  ＋ Position
                </button>
              </div>
            </div>
            {csvImport.input}
            {csvImport.preview}
            {depot.length === 0 ? (
              <button className="mini-empty" onClick={addHolding}>
                Erste Depotposition erfassen
              </button>
            ) : (
              <div className="situation-holdings">
                {depot.map((holding) => (
                  <div key={holding.id}>
                    <input
                      aria-label="Produktbezeichnung"
                      value={holding.name}
                      onChange={(event) =>
                        updateHolding(holding.id, { name: event.target.value })
                      }
                      placeholder="Produktbezeichnung"
                    />
                    <div className="inline-amount">
                      <input
                        aria-label="Aktueller Wert"
                        inputMode="numeric"
                        value={
                          holding.value
                            ? holding.value.toLocaleString("de-DE")
                            : ""
                        }
                        onChange={(event) =>
                          updateHolding(holding.id, {
                            value: parseAmount(event.target.value),
                          })
                        }
                        placeholder="0"
                      />
                      <b>€</b>
                    </div>
                    <select
                      aria-label="Anlageklasse"
                      value={holding.assetClass}
                      onChange={(event) =>
                        updateHolding(holding.id, {
                          assetClass: event.target.value as AssetClass,
                        })
                      }
                    >
                      {assetClasses.map((name) => (
                        <option key={name}>{name}</option>
                      ))}
                    </select>
                    <button
                      aria-label="Position löschen"
                      onClick={() =>
                        setDepot(
                          depot.filter((entry) => entry.id !== holding.id),
                        )
                      }
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
        {business && (
          <div className="info-box full">
            <strong>Firmenkunden-Prüfpunkte</strong>
            <p>
              Ausschüttungen, Steuerzahlungen, Covenants, Bilanzierungsziel und
              organisatorische Anlagegrenzen dokumentieren.
            </p>
          </div>
        )}
      </div>
    </>
  );
}

function NeedsStep({
  data,
  referenceDate,
  update,
  addNeed,
  updateNeed,
}: {
  data: AdvisoryData;
  referenceDate: string;
  update: <K extends keyof AdvisoryData>(
    key: K,
    value: AdvisoryData[K],
  ) => void;
  addNeed: () => void;
  updateNeed: (
    id: number,
    changes: Partial<AdvisoryData["needs"][number]>,
  ) => void;
}) {
  const pots = capitalPots(data, data.liquidAssets, referenceDate);
  const total = data.needs.reduce((sum, need) => sum + need.amount, 0);
  return (
    <>
      <SectionIntro number="03" title="Welche Beträge werden wann benötigt?">
        Das konkrete Datum ist führend. Die Laufzeitansicht wird daraus
        automatisch abgeleitet.
      </SectionIntro>
      <div className="needs-head">
        <div>
          <span>Erfasste Bedarfe</span>
          <strong>{euro.format(total)}</strong>
        </div>
        <button className="secondary" onClick={addNeed}>
          ＋ Bedarf ergänzen
        </button>
      </div>
      {data.needs.length === 0 ? (
        <button className="empty-state" onClick={addNeed}>
          <span>＋</span>
          <strong>Ersten Kapitalbedarf erfassen</strong>
          <small>
            z. B. Investition, Immobilie, Steuerzahlung oder Ruhestand
          </small>
        </button>
      ) : (
        <div className="needs-list">
          {data.needs.map((need, index) => (
            <div className="need-row need-row-v2" key={need.id}>
              <span className="need-index">{index + 1}</span>
              <label>
                <span>Verwendungszweck</span>
                <input
                  value={need.purpose}
                  onChange={(event) =>
                    updateNeed(need.id, { purpose: event.target.value })
                  }
                  placeholder="z. B. Maschine"
                />
              </label>
              <label>
                <span>Betrag</span>
                <div className="inline-amount">
                  <input
                    inputMode="numeric"
                    value={
                      need.amount ? need.amount.toLocaleString("de-DE") : ""
                    }
                    onChange={(event) =>
                      updateNeed(need.id, {
                        amount: parseAmount(event.target.value),
                      })
                    }
                  />
                  <b>€</b>
                </div>
              </label>
              <label>
                <span>Konkreter Termin</span>
                <input
                  type="date"
                  value={need.dueDate || ""}
                  onChange={(event) =>
                    updateNeed(need.id, { dueDate: event.target.value })
                  }
                />
              </label>
              <label>
                <span>Alternativ in Jahren</span>
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={need.years}
                  onChange={(event) =>
                    updateNeed(need.id, {
                      years: Math.max(0, Number(event.target.value)),
                      dueDate: "",
                    })
                  }
                />
              </label>
              <span className="derived-bucket">
                {need.dueDate
                  ? `Bedarfsjahr ${need.dueDate.slice(0, 4)}`
                  : `Zieljahr ${pots.find((pot) =>
                      pot.needs.some((entry) => entry.id === need.id),
                    )?.year}`}
              </span>
              <button
                className="delete-button"
                onClick={() =>
                  update(
                    "needs",
                    data.needs.filter((entry) => entry.id !== need.id),
                  )
                }
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="bucket-preview dynamic-pots">
        {pots.map((pot) => (
          <article key={pot.id}>
            <span>{pot.label}</span>
            <strong>{euro.format(pot.total)}</strong>
            <small>{pot.range}</small>
          </article>
        ))}
      </div>
    </>
  );
}

function RiskOrientationDialog({
  data,
  update,
  onClose,
}: {
  data: AdvisoryData;
  update: <K extends keyof AdvisoryData>(
    key: K,
    value: AdvisoryData[K],
  ) => void;
  onClose: () => void;
}) {
  const firstUnanswered = riskQuestions.findIndex(
    (question) => data.riskAssessment[question.key] === null,
  );
  const [questionIndex, setQuestionIndex] = useState(
    firstUnanswered === -1 ? riskQuestions.length - 1 : firstUnanswered,
  );
  const [showResult, setShowResult] = useState(false);
  const question = riskQuestions[questionIndex];
  const orientation = riskOrientation(data);
  const selected = data.riskAssessment[question.key];
  const answer = (value: RiskLevel) =>
    update("riskAssessment", { ...data.riskAssessment, [question.key]: value });

  return (
    <div className="modal-backdrop risk-dialog-backdrop" role="presentation">
      <section
        className="risk-orientation-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Risiko-Orientierung ermitteln"
      >
        <header>
          <div>
            <p className="eyebrow">KURZE RISIKO-ORIENTIERUNG</p>
            <h2>{showResult ? "Orientierungswert" : `Frage ${questionIndex + 1} von ${riskQuestions.length}`}</h2>
          </div>
          <button
            className="risk-dialog-close"
            aria-label="Risiko-Orientierung schließen"
            onClick={onClose}
          >
            <span>Schließen</span>
            <b aria-hidden="true">×</b>
          </button>
        </header>
        {showResult ? (
          <div className="risk-orientation-result">
            <span>{orientation ? `${orientation}/5` : "–"}</span>
            <div>
              <strong>{orientation ? riskText[orientation].title : "Noch nicht vollständig"}</strong>
              <p>
                {orientation
                  ? riskText[orientation].text
                  : "Bitte beantworten Sie alle drei Fragen, bevor der Orientierungswert übernommen wird."}
              </p>
            </div>
          </div>
        ) : (
          <div className="risk-dialog-question">
            <p>{question.title}</p>
            <div>
              {question.options.map((option, index) => {
                const value = (index + 1) as RiskLevel;
                return (
                  <button
                    key={option}
                    className={selected === value ? "selected" : ""}
                    onClick={() => answer(value)}
                  >
                    <span>{value}</span>
                    {option}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <footer>
          {showResult ? (
            <>
              <button className="secondary" onClick={() => setShowResult(false)}>
                ← Antworten prüfen
              </button>
              <button
                className="primary"
                disabled={!orientation}
                onClick={() => {
                  if (!orientation) return;
                  update("risk", orientation);
                  onClose();
                }}
              >
                Orientierungswert übernehmen
              </button>
            </>
          ) : (
            <>
              <button
                className="secondary"
                onClick={() =>
                  questionIndex === 0
                    ? onClose()
                    : setQuestionIndex(questionIndex - 1)
                }
              >
                {questionIndex === 0 ? "Schließen" : "← Zurück"}
              </button>
              <button
                className="primary"
                disabled={!selected}
                onClick={() =>
                  questionIndex === riskQuestions.length - 1
                    ? setShowResult(true)
                    : setQuestionIndex(questionIndex + 1)
                }
              >
                {questionIndex === riskQuestions.length - 1
                  ? "Ergebnis anzeigen"
                  : "Weiter →"}
              </button>
            </>
          )}
        </footer>
      </section>
    </div>
  );
}

function GoalsStep({
  data,
  update,
  togglePriority,
}: {
  data: AdvisoryData;
  update: <K extends keyof AdvisoryData>(
    key: K,
    value: AdvisoryData[K],
  ) => void;
  togglePriority: (value: string) => void;
}) {
  const orientation = riskOrientation(data);
  const [riskDialogOpen, setRiskDialogOpen] = useState(false);
  const [manualRiskOpen, setManualRiskOpen] = useState(false);
  const answeredQuestions = riskQuestions.filter(
    (question) => data.riskAssessment[question.key] !== null,
  ).length;
  return (
    <>
      <SectionIntro
        number="04"
        title="Welche Ziele, Laufzeiten und Risiken sind angemessen?"
      >
        Risikowunsch, Verlusttragfähigkeit, Kenntnisse und Kapitalbindung müssen
        zusammenpassen.
      </SectionIntro>
      <div className="form-grid">
        <label className="field">
          <span>Hauptziel</span>
          <select
            value={data.goal}
            onChange={(event) => update("goal", event.target.value)}
          >
            {goalOptions.map((goal) => (
              <option key={goal}>{goal}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Überwiegender Anlagehorizont</span>
          <div className="range-value">
            <input
              type="range"
              min="1"
              max="25"
              value={data.horizon}
              onChange={(event) =>
                update("horizon", Number(event.target.value))
              }
            />
            <strong>{data.horizon} Jahre</strong>
          </div>
        </label>
        <label className="field">
          <span>Kenntnisse und Erfahrungen</span>
          <select
            value={data.experience}
            onChange={(event) => update("experience", event.target.value)}
          >
            <option>Keine / geringe Kenntnisse</option>
            <option>Grundkenntnisse</option>
            <option>Erweiterte Kenntnisse</option>
            <option>Umfangreiche Kenntnisse</option>
          </select>
        </label>
        <div className="field full risk-orientation-card">
          <div className="risk-orientation-card-head">
            <div>
              <span>Kurze Risiko-Orientierung</span>
              <small>
                Drei Klickfragen werden mit Horizont und Kenntnissen verbunden.
              </small>
            </div>
            <strong className={orientation ? "complete" : ""}>
              {orientation
                ? `${orientation}/5 · ${riskText[orientation].title}`
                : answeredQuestions > 0
                  ? `${answeredQuestions}/3 beantwortet`
                  : "Noch nicht ermittelt"}
            </strong>
          </div>
          <div className="risk-orientation-actions">
            <button className="primary" onClick={() => setRiskDialogOpen(true)}>
              Orientierung ermitteln
            </button>
            <button
              className="secondary"
              onClick={() => setManualRiskOpen((open) => !open)}
            >
              Manuell festlegen
            </button>
          </div>
          <p className="risk-orientation-note">
            Die Auswertung ist eine Gesprächsorientierung. Sie ersetzt weder die
            regulatorische Geeignetheitsprüfung noch die Verlusttragfähigkeitsprüfung.
          </p>
          {manualRiskOpen && (
            <div className="risk-manual-selection">
              <span>Strategische Risikoeinordnung direkt festlegen</span>
              <div className="risk-scale">
                {([1, 2, 3, 4, 5] as RiskLevel[]).map((risk) => (
                  <button
                    key={risk}
                    className={data.risk === risk ? "selected" : ""}
                    onClick={() => update("risk", risk)}
                  >
                    <b>{risk}</b>
                    <span>{riskText[risk].title}</span>
                  </button>
                ))}
              </div>
              <div className="risk-explainer">
                <strong>{riskText[data.risk].title}</strong>
                <p>
                  {riskText[data.risk].text} Keine regulatorische
                  Geeignetheitsprüfung.
                </p>
              </div>
            </div>
          )}
        </div>
        <div className="field full">
          <span>Was ist besonders wichtig?</span>
          <div className="chip-grid">
            {priorityOptions.map((value) => (
              <button
                key={value}
                className={data.priorities.includes(value) ? "selected" : ""}
                onClick={() => togglePriority(value)}
              >
                {data.priorities.includes(value) ? "✓ " : "+ "}
                {value}
              </button>
            ))}
          </div>
        </div>
      </div>
      {riskDialogOpen && (
        <RiskOrientationDialog
          data={data}
          update={update}
          onClose={() => setRiskDialogOpen(false)}
        />
      )}
    </>
  );
}

function ModulesStep({
  data,
  moduleStates,
  toggleModule,
  openModule,
}: {
  data: AdvisoryData;
  moduleStates: AdvisoryCase["moduleStates"];
  toggleModule: (value: string) => void;
  openModule: (value: string) => void;
}) {
  const available = modules.filter(
    (module) => !data.scope || module.scopes.includes(data.scope),
  );
  const recommended = new Set([
    "maturity",
    "market",
    ...(data.scope === "business" || data.scope === "combined" ? ["tax"] : []),
    ...(data.hasDepot ? ["depot"] : []),
  ]);
  return (
    <>
      <SectionIntro number="05" title="Welche Vertiefungen werden benötigt?">
        Die Kernstrecke bleibt schlank; Fachmodule werden gezielt zugeschaltet.
      </SectionIntro>
      <div className="module-grid">
        {available.map((module) => {
          const state = moduleStates[module.id] || blankModuleState();
          const active = data.modules.includes(module.id);
          return (
            <article key={module.id} className={active ? "selected" : ""}>
              <button
                className="module-select"
                onClick={() => toggleModule(module.id)}
                aria-pressed={active}
              >
                <span>{module.title.slice(0, 1)}</span>
                <div>
                  <strong>{module.title}</strong>
                  <small>{module.text}</small>
                  {recommended.has(module.id) && (
                    <em>für diesen Fall empfohlen</em>
                  )}
                </div>
                <i>{active ? "✓" : "+"}</i>
              </button>
              <footer>
                <span className={`module-status ${state.status}`}>
                  {state.status === "complete"
                    ? "Vollständig"
                    : state.status === "in_progress"
                      ? "In Bearbeitung"
                      : "Nicht begonnen"}
                </span>
                <button className="module-open" onClick={() => openModule(module.id)}>
                  Vertiefung öffnen →
                </button>
              </footer>
            </article>
          );
        })}
      </div>
    </>
  );
}

function ModuleWorkspace({
  moduleId,
  item,
  setItem,
  close,
  setView,
}: {
  moduleId: string;
  item: AdvisoryCase;
  setItem: Dispatch<SetStateAction<AdvisoryCase>>;
  close: () => void;
  setView: (view: View) => void;
}) {
  const moduleConfig = modules.find((entry) => entry.id === moduleId);
  const slides = moduleSlides[moduleId] || [];
  const state = item.moduleStates[moduleId] || blankModuleState();
  const current = Math.min(state.currentSlide, Math.max(0, slides.length - 1));
  const slide = slides[current];
  const [customerText, setCustomerText] = useState("");
  const [customerCategory, setCustomerCategory] =
    useState<CustomerChecklistCategory>(customerChecklistCategories[2]);
  if (!moduleConfig || !slide) return null;
  const updateState = (changes: Partial<ModuleState>) =>
    setItem((currentItem) => ({
      ...currentItem,
      advisory: {
        ...currentItem.advisory,
        modules: currentItem.advisory.modules.includes(moduleId)
          ? currentItem.advisory.modules
          : [...currentItem.advisory.modules, moduleId],
      },
      moduleStates: {
        ...currentItem.moduleStates,
        [moduleId]: {
          ...(currentItem.moduleStates[moduleId] || blankModuleState()),
          ...changes,
          updatedAt: new Date().toISOString(),
        },
      },
    }));
  const setSlide = (index: number) =>
    updateState({
      currentSlide: Math.max(0, Math.min(slides.length - 1, index)),
      status: state.status === "complete" ? "complete" : "in_progress",
    });
  const finish = () => {
    updateState({ status: "complete", currentSlide: slides.length - 1 });
    close();
  };
  const addCustomerItem = () => {
    const text = customerText.trim();
    if (!text) return;
    setItem((currentItem) => ({
      ...currentItem,
      customerChecklist: [
        ...currentItem.customerChecklist,
        {
          id: uid("kundenpunkt"),
          text,
          category: customerCategory,
          done: false,
          source: "module",
          moduleId,
          slideIndex: current,
          createdAt: new Date().toISOString(),
        },
      ],
    }));
    setCustomerText("");
  };
  const moduleCustomerItems = item.customerChecklist.filter(
    (entry) => entry.moduleId === moduleId && entry.slideIndex === current,
  );
  return (
    <div className="module-workspace-backdrop" role="presentation">
      <section
        className="module-workspace"
        role="dialog"
        aria-modal="true"
        aria-label={`${moduleConfig.title} Vertiefung`}
      >
        <header>
          <div className="brand-placeholder" aria-label="Logoplatzhalter">
            Logo
          </div>
          <div>
            <p className="eyebrow">FACHMODUL</p>
            <h2>{moduleConfig.title}</h2>
          </div>
          <span>
            {current + 1} / {slides.length}
          </span>
          <button
            className="module-return"
            onClick={close}
            aria-label="Vertiefung schließen und zur Beratung zurückkehren"
          >
            <span>Zur Beratung</span>
            <b aria-hidden="true">×</b>
          </button>
        </header>
        <div className="module-workspace-body">
          <nav aria-label="Vertiefungsschritte">
            {slides.map((entry, index) => (
              <button
                key={entry.title}
                className={index === current ? "active" : index < current ? "done" : ""}
                onClick={() => setSlide(index)}
              >
                <span>{index < current ? "✓" : index + 1}</span>
                <div>
                  <small>{entry.eyebrow}</small>
                  <strong>{entry.title}</strong>
                </div>
              </button>
            ))}
          </nav>
          <article className="module-slide">
            <div className="module-slide-title">
              <p>{slide.eyebrow}</p>
              <h3>{slide.title}</h3>
              <span>{moduleConfig.title}</span>
            </div>
            <p className="module-lead">{slide.text}</p>
            <ul>
              {slide.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
            <div className="module-checks">
              {slide.checks.map((check) => (
                <label key={check.id}>
                  <input
                    type="checkbox"
                    checked={Boolean(state.checklist[check.id])}
                    onChange={(event) =>
                      updateState({
                        status: "in_progress",
                        checklist: {
                          ...state.checklist,
                          [check.id]: event.target.checked,
                        },
                      })
                    }
                  />
                  <span>{check.label}</span>
                </label>
              ))}
            </div>
            <label className="module-note">
              <span>Notiz zur Vertiefung</span>
              <textarea
                value={state.notes}
                onChange={(event) =>
                  updateState({ status: "in_progress", notes: event.target.value })
                }
                placeholder="Gesprächsergebnis oder fachlichen Hinweis festhalten"
              />
            </label>
            <section className="module-customer-item">
              <div>
                <span>Für den Kunden festhalten</span>
                <small>
                  Dieser Punkt wird in die Kunden-Checkliste und den Export
                  übernommen.
                </small>
              </div>
              <div className="module-customer-add">
                <select
                  aria-label="Art des nächsten Schritts"
                  value={customerCategory}
                  onChange={(event) =>
                    setCustomerCategory(
                      event.target.value as CustomerChecklistCategory,
                    )
                  }
                >
                  {customerChecklistCategories.map((entry) => (
                    <option key={entry}>{entry}</option>
                  ))}
                </select>
                <input
                  value={customerText}
                  onChange={(event) => setCustomerText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") addCustomerItem();
                  }}
                  placeholder="z. B. Steuerberater zur Bilanzierung des Produkts fragen"
                />
                <button
                  className="secondary"
                  onClick={addCustomerItem}
                  disabled={!customerText.trim()}
                >
                  Übernehmen
                </button>
              </div>
              {moduleCustomerItems.length > 0 && (
                <ul>
                  {moduleCustomerItems.map((entry) => (
                    <li key={entry.id}>
                      <span>✓</span>
                      <div>
                        <strong>{entry.text}</strong>
                        <small>{entry.category}</small>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            {current === slides.length - 1 && (
              <div className="module-deep-links">
                {moduleId === "maturity" && (
                  <button onClick={() => { close(); setView("planner"); }}>
                    Strukturplanung öffnen
                  </button>
                )}
                {moduleId === "depot" && (
                  <button onClick={() => { close(); setView("depot"); }}>
                    Depotcheck öffnen
                  </button>
                )}
              </div>
            )}
          </article>
        </div>
        <footer>
          <button className="secondary" onClick={() => setSlide(current - 1)} disabled={current === 0}>
            ← Zurück
          </button>
          <span className={`module-status ${state.status}`}>
            {state.status === "complete" ? "Vollständig" : "In Bearbeitung"}
          </span>
          {current < slides.length - 1 ? (
            <button className="primary" onClick={() => setSlide(current + 1)}>
              Weiter →
            </button>
          ) : (
            <button className="primary" onClick={finish}>
              Vertiefung abschließen
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}

function ResultStep({
  item,
  setItem,
  setView,
  exportJson,
  openModule,
}: {
  item: AdvisoryCase;
  setItem: Dispatch<SetStateAction<AdvisoryCase>>;
  setView: (view: View) => void;
  exportJson: () => void;
  openModule: (value: string) => void;
}) {
  const data = item.advisory;
  const plan = item.plans.find((entry) => entry.preferred) ?? item.plans[0];
  const resultPots = capitalPots(
    data,
    plan?.total ?? data.liquidAssets,
    item.createdAt,
  );
  const totalFixed =
    data.reserve + data.needs.reduce((sum, need) => sum + need.amount, 0);
  const warning = totalFixed > data.liquidAssets;
  const advisor = advisorFor(item.advisorId);
  return (
    <div className="result-page">
      <div className="result-title">
        <div>
          <p className="eyebrow">ORIENTIERUNGSERGEBNIS</p>
          <h2>{data.caseName || "Unbenannte Musterberatung"}</h2>
          <p>
            {scopeLabel(data.scope)} · Risiko {data.risk}/5 ·{" "}
            {item.plans.length} Planvarianten · {advisor.name}
          </p>
        </div>
        <span className="result-status">Fall zusammengeführt</span>
      </div>
      <div className="result-metrics">
        <article>
          <span>Erfasste Liquidität</span>
          <strong>{euro.format(data.liquidAssets)}</strong>
        </article>
        <article className="highlight">
          <span>Strategisch frei</span>
          <strong>
            {euro.format(
              strategicAmount(data, plan?.total ?? data.liquidAssets),
            )}
          </strong>
          <small>nach Reserve und allen bekannten Bedarfen</small>
        </article>
        <article>
          <span>Vorhandenes Depot</span>
          <strong>{euro.format(data.depotValue)}</strong>
        </article>
      </div>
      {warning && (
        <div className="warning-panel">
          <strong>Fehler</strong>
          <p>
            Reserve und Bedarfe übersteigen die erfasste Liquidität um{" "}
            {euro.format(totalFixed - data.liquidAssets)}.
          </p>
        </div>
      )}
      <section className="result-section result-house-section">
        <div className="result-section-head">
          <div>
            <span>01</span>
            <h3>Vermögenshaus</h3>
          </div>
          <small>fünf wirtschaftliche Anlageklassen</small>
        </div>
        <WealthHouse plan={plan} plans={item.plans} depot={item.depot} currentLiquidity={item.advisory.liquidAssets} compact />
        <div className="result-cta-row">
          <div>
            <strong>Struktur im Detail prüfen</strong>
            <p>Produkte, Bestand und Durchschau werden in der Strukturplanung erläutert.</p>
          </div>
          <button className="primary" onClick={() => setView("planner")}>
            Strukturplanung öffnen →
          </button>
        </div>
      </section>
      <section className="result-section">
        <div className="result-section-head">
          <div>
            <span>02</span>
            <h3>Zeitstruktur der Kapitalbedarfe</h3>
          </div>
          <small>identisch in Planung und Export</small>
        </div>
        <div className="maturity-summary dynamic-pots">
          {resultPots.map((pot) => (
            <article key={pot.id}>
              <span>{pot.label}</span>
              <strong>{euro.format(pot.total)}</strong>
              <small>{pot.range}</small>
            </article>
          ))}
        </div>
      </section>
      <section className="result-section">
        <div className="result-section-head">
          <div>
            <span>03</span>
            <h3>Fachmodule</h3>
          </div>
          <small>{data.modules.length} Vertiefungen</small>
        </div>
        <div className="module-results">
          {modules
            .filter((module) => data.modules.includes(module.id))
            .map((module) => {
              const state = item.moduleStates[module.id] || blankModuleState();
              return (
              <article key={module.id} className="clickable-module">
                <div>
                  <span>{module.title.slice(0, 1)}</span>
                  <h4>{module.title}</h4>
                </div>
                <ul>
                  {moduleDetails[module.id].map((detail) => (
                    <li key={detail}>{detail}</li>
                  ))}
                </ul>
                <footer>
                  <span className={`module-status ${state.status}`}>
                    {state.status === "complete"
                      ? "Vollständig"
                      : state.status === "in_progress"
                        ? "In Bearbeitung"
                        : "Nicht begonnen"}
                  </span>
                  <button onClick={() => openModule(module.id)}>
                    Vertiefung öffnen →
                  </button>
                </footer>
              </article>
              );
            })}
        </div>
      </section>
      <CustomerChecklistEditor item={item} setItem={setItem} />
      <div className="result-actions no-print">
        <button className="secondary" onClick={exportJson}>
          Vollständigen Fall als JSON
        </button>
        <button className="secondary" onClick={() => setView("export")}>
          PDF- und Excel-Export
        </button>
      </div>
      <div className="legal-note">
        <strong>Wichtiger Hinweis</strong>
        <p>
          Der Prototyp strukturiert ein Gespräch und erzeugt keine
          Anlageempfehlung. Für einen produktiven Einsatz sind bankfachliche
          Freigabe, Datenschutz, Informationssicherheit, Berechtigungen und
          revisionssichere Dokumentation zwingend.
        </p>
      </div>
    </div>
  );
}

function PlannerView({
  item,
  setItem,
  saveCase,
  setView,
}: {
  item: AdvisoryCase;
  setItem: Dispatch<SetStateAction<AdvisoryCase>>;
  saveCase: (version?: boolean) => void;
  setView: (view: View) => void;
}) {
  const [mode, setMode] = useState<
    "structure" | "house" | "models" | "vv" | "compare"
  >("structure");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Alle");
  const [catalogSource, setCatalogSource] = useState<
    "all" | "products" | "vv" | "models"
  >("all");
  const [maxRisk, setMaxRisk] = useState(Math.max(2, item.advisory.risk));
  const [quickBucket, setQuickBucket] = useState<CapitalPotId>("strategic");
  const [selectedCapitalPot, setSelectedCapitalPot] =
    useState<CapitalPotId>("strategic");
  const [showDepotPanel, setShowDepotPanel] = useState(false);
  const [modelDialog, setModelDialog] = useState<{
    id: "rb2" | "rb3" | "rb4";
    amount: number;
  } | null>(null);
  const plan =
    item.plans.find((entry) => entry.id === item.activePlanId) ?? item.plans[0];
  const visibleCapitalPots = capitalPots(
    item.advisory,
    plan.total,
    item.createdAt,
  );
  const capitalPotTargets = Object.fromEntries(
    visibleCapitalPots.map((pot) => [pot.id, pot.total]),
  ) as Partial<Record<CapitalPotId, number>>;
  const shortfall = planningShortfall(item.advisory, plan.total);
  const fallbackCapitalPot =
    visibleCapitalPots.find((pot) => pot.id === "strategic") ||
    visibleCapitalPots[0];
  const selectedPot =
    visibleCapitalPots.find((pot) => pot.id === selectedCapitalPot) ||
    fallbackCapitalPot;
  useEffect(() => {
    if (!fallbackCapitalPot) return;
    if (!visibleCapitalPots.some((pot) => pot.id === quickBucket))
      setQuickBucket(fallbackCapitalPot.id);
    if (!visibleCapitalPots.some((pot) => pot.id === selectedCapitalPot))
      setSelectedCapitalPot(fallbackCapitalPot.id);
  }, [
    fallbackCapitalPot?.id,
    quickBucket,
    selectedCapitalPot,
    visibleCapitalPots,
  ]);
  const assigned = plan.allocations.reduce(
    (sum, allocation) => sum + allocation.amount,
    0,
  );
  const covered = plan.allocations.reduce(
    (sum, allocation) => sum + allocationCapitalCoverageTotal(allocation),
    0,
  );
  const unassignedCoverage = plan.allocations.reduce(
    (sum, allocation) =>
      sum +
      Math.max(0, allocation.amount - allocationCapitalCoverageTotal(allocation)),
    0,
  );
  const selectedDepotIds = new Set(
    plan.depotHoldingIds.length > 0
      ? plan.depotHoldingIds
      : item.depot.map((holding) => holding.id),
  );
  const selectedDepot = item.depot.filter((holding) =>
    selectedDepotIds.has(holding.id),
  );
  const includedDepotTotal = selectedDepot.reduce(
    (sum, holding) =>
      sum +
      (plan.depotMode === "afterSales"
        ? Math.max(0, holding.value - holding.plannedSale)
        : holding.value),
    0,
  );
  const consideredTotal =
    plan.total +
    (plan.depotMode === "retain" || plan.depotMode === "afterSales"
      ? includedDepotTotal
      : 0);
  const depotStatus =
    plan.depotMode === "none"
      ? "Nicht berücksichtigt"
      : plan.depotMode === "compare"
        ? `Nur vergleichend · ${euro.format(includedDepotTotal)}`
        : plan.depotMode === "retain"
          ? `${selectedDepot.length} ${selectedDepot.length === 1 ? "Position" : "Positionen"} ausgewählt · ${euro.format(includedDepotTotal)}`
          : `Nach simulierten Verkäufen · ${euro.format(includedDepotTotal)}`;

  const updatePlan = (changes: Partial<StructurePlan>) =>
    setItem({
      ...item,
      plans: item.plans.map((entry) =>
        entry.id === plan.id
          ? { ...entry, ...changes, updatedAt: new Date().toISOString() }
          : entry,
      ),
    });
  const coverageWithout = (excludedId?: string) =>
    Object.fromEntries(
      visibleCapitalPots.map((pot) => [
        pot.id,
        plan.allocations
          .filter((allocation) => allocation.id !== excludedId)
          .reduce(
            (sum, allocation) =>
              sum + allocationAmountInCapitalPot(allocation, pot.id),
            0,
          ),
      ]),
    ) as Partial<Record<CapitalPotId, number>>;
  const overflowCoverage = (
    amount: number,
    startBucket: CapitalPotId,
    excludedId?: string,
  ) => {
    const result: Partial<Record<CapitalPotId, number>> = {};
    const used = coverageWithout(excludedId);
    let remaining = amount;
    const start = visibleCapitalPots.findIndex(
      (pot) => pot.id === startBucket,
    );
    for (const pot of visibleCapitalPots.slice(Math.max(0, start))) {
      const open = Math.max(
        0,
        pot.total - (Number(used[pot.id]) || 0),
      );
      const share = Math.min(remaining, open);
      if (share > 0) result[pot.id] = share;
      remaining -= share;
      if (remaining <= 0) break;
    }
    return result;
  };
  const updateAllocation = (id: string, changes: Partial<PlannerAllocation>) =>
    updatePlan({
      allocations: plan.allocations.map((entry) =>
        entry.id === id ? { ...entry, ...changes } : entry,
      ),
    });
  const allocationPotChanges = (
    capitalPotAmounts: Partial<Record<CapitalPotId, number>>,
  ): Partial<PlannerAllocation> => ({
    capitalPotAmounts,
    bucketAmounts: legacyBucketAmountsForCapitalPots(
      visibleCapitalPots,
      capitalPotAmounts,
    ),
    capitalPotReviewAmount: undefined,
    capitalPotReviewNote: undefined,
  });
  const updateAllocationAmount = (
    allocation: PlannerAllocation,
    amount: number,
  ) => {
    const capitalPotAmounts =
        allocation.allocationMode === "overflow"
          ? overflowCoverage(
              amount,
              allocation.capitalPotId || fallbackCapitalPot?.id || "strategic",
              allocation.id,
            )
          : allocation.allocationMode === "manual"
            ? allocationCapitalPotAmounts(allocation)
            : {
                [allocation.capitalPotId || fallbackCapitalPot?.id || "strategic"]:
                  amount,
              };
    updateAllocation(allocation.id, {
      amount,
      ...allocationPotChanges(capitalPotAmounts),
    });
  };
  const updateAllocationMode = (
    allocation: PlannerAllocation,
    allocationMode: "single" | "overflow" | "manual",
  ) => {
    const capitalPotAmounts =
        allocationMode === "overflow"
          ? overflowCoverage(
              allocation.amount,
              allocation.capitalPotId || fallbackCapitalPot?.id || "strategic",
              allocation.id,
            )
          : allocationMode === "single"
            ? {
                [allocation.capitalPotId || fallbackCapitalPot?.id || "strategic"]:
                  allocation.amount,
              }
            : allocationCapitalPotAmounts(allocation);
    updateAllocation(allocation.id, {
      allocationMode,
      ...allocationPotChanges(capitalPotAmounts),
    });
  };
  const updateManualBucket = (
    allocation: PlannerAllocation,
    capitalPotId: CapitalPotId,
    amount: number,
  ) => {
    const capitalPotAmounts = {
      ...allocationCapitalPotAmounts(allocation),
      [capitalPotId]: amount,
    };
    updateAllocation(allocation.id, {
      allocationMode: "manual",
      ...allocationPotChanges(capitalPotAmounts),
    });
  };
  const resolveMigrationAllocation = (
    allocation: PlannerAllocation,
    capitalPotId: CapitalPotId,
  ) => {
    const reviewAmount = Number(allocation.capitalPotReviewAmount) || 0;
    if (reviewAmount <= 0) return;
    const pot = visibleCapitalPots.find((entry) => entry.id === capitalPotId);
    if (!pot) return;
    const capitalPotAmounts = {
      ...allocationCapitalPotAmounts(allocation),
      [capitalPotId]:
        allocationAmountInCapitalPot(allocation, capitalPotId) + reviewAmount,
    };
    updateAllocation(allocation.id, {
      capitalPotId,
      allocationMode:
        Object.values(capitalPotAmounts).filter((amount) => Number(amount) > 0)
          .length > 1
          ? "manual"
          : "single",
      ...allocationPotChanges(capitalPotAmounts),
    });
  };
  const addProduct = (
    productId: string,
    capitalPotId: CapitalPotId = quickBucket,
    source?: PlannerAllocation["source"],
    amount = 0,
  ): "added" | "updated" | "ignored" => {
    const product = houseProducts.find((entry) => entry.id === productId);
    const vv = managedPortfolios.find((entry) => entry.id === productId);
    if (!product && !vv) return "ignored";
    const pot =
      visibleCapitalPots.find((entry) => entry.id === capitalPotId) ||
      fallbackCapitalPot;
    if (!pot) return "ignored";
    const existingVv =
      source === "vv"
        ? plan.allocations.find(
            (allocation) =>
              allocation.source === "vv" && allocation.productId === productId,
          )
        : undefined;
    if (existingVv) {
      const capitalPotAmounts = { [pot.id]: amount };
      updatePlan({
        allocations: plan.allocations.map((allocation) =>
          allocation.id === existingVv.id
            ? {
                ...allocation,
                amount,
                bucketId: pot.legacyBucketId,
                capitalPotId: pot.id,
                allocationMode: "single",
                ...allocationPotChanges(capitalPotAmounts),
              }
            : allocation,
        ),
      });
      return "updated";
    }
    updatePlan({
      allocations: [
        ...plan.allocations,
        {
          id: uid("allocation"),
          productId,
          productName: product?.name || vv!.name,
          bucketId: pot.legacyBucketId,
          capitalPotId: pot.id,
          amount,
          solutionId: product?.solutionId || "mixed",
          source: source ?? (vv ? "vv" : "product"),
          allocationMode: "single",
          bucketAmounts: { [pot.legacyBucketId]: amount },
          capitalPotAmounts: { [pot.id]: amount },
        },
      ],
    });
    return "added";
  };
  const createNewPlan = () => {
    const next = createPlan(
      `Plan ${String.fromCharCode(65 + item.plans.length)} – neue Variante`,
      plan.total,
    );
    next.capitalMode = plan.capitalMode;
    next.depotMode = plan.depotMode;
    next.depotHoldingIds = [...plan.depotHoldingIds];
    next.preferred = false;
    setItem({ ...item, plans: [...item.plans, next], activePlanId: next.id });
  };
  const duplicatePlan = () => {
    const next = clone(plan);
    next.id = uid("plan");
    next.name = `${plan.name} – Kopie`;
    next.preferred = false;
    next.createdAt = new Date().toISOString();
    next.updatedAt = next.createdAt;
    next.allocations = next.allocations.map((allocation) => ({
      ...allocation,
      id: uid("allocation"),
    }));
    setItem({ ...item, plans: [...item.plans, next], activePlanId: next.id });
  };
  const setPreferred = () =>
    setItem({
      ...item,
      plans: item.plans.map((entry) => ({
        ...entry,
        preferred: entry.id === plan.id,
      })),
    });
  const deletePlan = () => {
    if (item.plans.length === 1) return;
    const remaining = item.plans.filter((entry) => entry.id !== plan.id);
    setItem({ ...item, plans: remaining, activePlanId: remaining[0].id });
  };
  const addInvestmentPlan = (type: InvestmentPlan["type"] = "phased") => {
    const allocation = plan.allocations[0];
    const capitalPotId =
      allocation?.capitalPotId || fallbackCapitalPot?.id || "strategic";
    const investmentPot = visibleCapitalPots.find(
      (pot) => pot.id === capitalPotId,
    );
    const next: InvestmentPlan = {
      id: uid("investment"),
      name: type === "savings" ? "Neuer Sparplan" : "Gestaffelte Investition",
      type,
      productId: allocation?.productId || "",
      productName: allocation?.productName || "",
      bucketId: investmentPot?.legacyBucketId || allocation?.bucketId || "year10plus",
      capitalPotId,
      installmentAmount: 0,
      installments: type === "savings" ? 12 : 3,
      frequency: "monthly",
      startDate: new Date().toISOString().slice(0, 10),
      note: "",
    };
    updatePlan({ investmentPlans: [...(plan.investmentPlans || []), next] });
  };
  const updateInvestmentPlan = (
    id: string,
    changes: Partial<InvestmentPlan>,
  ) =>
    updatePlan({
      investmentPlans: (plan.investmentPlans || []).map((entry) =>
        entry.id === id ? { ...entry, ...changes } : entry,
      ),
    });
  const removeInvestmentPlan = (id: string) =>
    updatePlan({
      investmentPlans: (plan.investmentPlans || []).filter(
        (entry) => entry.id !== id,
      ),
    });

  const applyModel = (action: "new" | "supplement" | "replace") => {
    if (!modelDialog) return;
    const model = modelPortfolios.find((entry) => entry.id === modelDialog.id);
    if (!model) return;
    const modelPot =
      visibleCapitalPots.find((pot) => pot.id === "strategic") ||
      fallbackCapitalPot;
    if (!modelPot) return;
    const modelAllocations: PlannerAllocation[] = model.holdings.map(
      (holding) => {
        const amount = Math.round((modelDialog.amount * holding.weight) / 100);
        return {
          id: uid("allocation"),
          productId: holding.productId,
          productName: holding.name,
          bucketId: modelPot.legacyBucketId,
          capitalPotId: modelPot.id,
          amount,
          solutionId:
            houseProducts.find((entry) => entry.id === holding.productId)
              ?.solutionId || "mixed",
          source: "model",
          modelId: model.id,
          allocationMode: "single",
          bucketAmounts: { [modelPot.legacyBucketId]: amount },
          capitalPotAmounts: { [modelPot.id]: amount },
        };
      },
    );
    if (action === "new") {
      const next = clone(plan);
      next.id = uid("plan");
      next.name = `${model.name} – strategische Variante`;
      next.allocations = [
        ...next.allocations.filter((entry) => entry.capitalPotId !== modelPot.id),
        ...modelAllocations,
      ];
      next.modelId = model.id;
      next.modelAmount = modelDialog.amount;
      next.preferred = false;
      next.createdAt = new Date().toISOString();
      next.updatedAt = next.createdAt;
      setItem({ ...item, plans: [...item.plans, next], activePlanId: next.id });
    }
    if (action === "supplement")
      updatePlan({
        allocations: [...plan.allocations, ...modelAllocations],
        modelId: model.id,
        modelAmount: modelDialog.amount,
      });
    if (action === "replace")
      updatePlan({
        allocations: modelAllocations,
        modelId: model.id,
        modelAmount: modelDialog.amount,
      });
    setModelDialog(null);
    setMode("structure");
  };

  const modelProductIds = new Set(
    modelPortfolios.flatMap((model) =>
      model.holdings.map((holding) => holding.productId),
    ),
  );
  const catalogItems = [
    ...houseProducts.map((product) => ({
      id: product.id,
      name: product.name,
      category: product.category,
      risk: product.risk,
      meta: `WKN ${product.wkn} · ${product.region} · ${product.role}`,
      kind: modelProductIds.has(product.id)
        ? ("models" as const)
        : ("products" as const),
      sourceLabel: modelProductIds.has(product.id)
        ? "Hausmeinung · auch Modellportfolio-Baustein"
        : "Hausmeinung",
    })),
    ...managedPortfolios.map((vv) => ({
      id: vv.id,
      name: vv.name,
      category: "Vermögensverwaltung",
      risk: vv.risk,
      meta: `${euro.format(vv.minimum)} Mindestanlage · ${vv.horizon} · ${vv.currency}`,
      kind: vv.sourceLabel?.includes("Modellportfolio")
        ? ("models" as const)
        : ("vv" as const),
      sourceLabel: vv.sourceLabel || "VV-Selektionsmatrix",
    })),
  ];
  const categories = [
    "Alle",
    ...Array.from(new Set(catalogItems.map((entry) => entry.category))),
  ];
  const products = catalogItems.filter((product) => {
    const query = search.trim().toLowerCase();
    const sourceMatch =
      catalogSource === "all" ||
      product.kind === catalogSource ||
      (catalogSource === "products" &&
        product.kind === "models" &&
        houseProducts.some((entry) => entry.id === product.id));
    return (
      sourceMatch &&
      (!query ||
        `${product.name} ${product.meta} ${product.sourceLabel}`
          .toLowerCase()
          .includes(query)) &&
      (category === "Alle" || product.category === category) &&
      product.risk <= maxRisk
    );
  });
  const solution = (allocation: PlannerAllocation) =>
    solutionTypes.find((entry) => entry.id === allocation.solutionId);
  const unresolved = plan.allocations.filter(
    (allocation) =>
      !houseProducts.find((product) => product.id === allocation.productId)
        ?.assetMix &&
      !managedPortfolios.find((vv) => vv.id === allocation.productId)?.assetMix,
  );
  const coverageByCapitalPot = Object.fromEntries(
    visibleCapitalPots.map((pot) => [
      pot.id,
      plan.allocations.reduce(
        (sum, allocation) =>
          sum + allocationAmountInCapitalPot(allocation, pot.id),
        0,
      ),
    ]),
  ) as Partial<Record<CapitalPotId, number>>;
  const allocationsForSelectedPot = selectedPot
    ? plan.allocations.filter(
        (allocation) =>
          allocation.capitalPotId === selectedPot.id ||
          allocationAmountInCapitalPot(allocation, selectedPot.id) > 0,
      )
    : [];
  const selectedPotCoverage = selectedPot
    ? Number(coverageByCapitalPot[selectedPot.id]) || 0
    : 0;
  const migrationReviewAmount = plan.allocations.reduce(
    (sum, allocation) => sum + (Number(allocation.capitalPotReviewAmount) || 0),
    0,
  );

  return (
    <div className="tool-view planner-view">
      <div className="tool-head">
        <div>
          <button className="back-link" onClick={() => setView("wizard")}>
            ← Zurück zur Beratung
          </button>
          <p className="eyebrow">DURCHGÄNGIGE PLANUNG</p>
          <h1>Strukturplanung</h1>
          <p>
            Reserve, konkrete Bedarfsjahre und strategisch verfügbares Kapital
            bilden die Zeitstruktur. Modellportfolios und Vermögensverwaltungen
            befüllen die gewählte Planvariante.
          </p>
        </div>
        <div className="tool-head-actions">
          <button className="secondary" onClick={() => saveCase(true)}>
            Version speichern
          </button>
          <button className="primary" onClick={() => saveCase(false)}>
            Fall speichern
          </button>
        </div>
      </div>
      <div className="planning-context-strip">
        <article>
          <span>Erfasste Liquidität</span>
          <strong>{euro.format(item.advisory.liquidAssets)}</strong>
        </article>
        <article>
          <span>Reserve und Bedarfe</span>
          <strong>
            {euro.format(
              item.advisory.reserve +
                item.advisory.needs.reduce((sum, need) => sum + need.amount, 0),
            )}
          </strong>
        </article>
        <article>
          <span>Bestandsdepot</span>
          <strong>{euro.format(item.advisory.depotValue)}</strong>
        </article>
        <article className="primary-context">
          <span>Planungsbetrag</span>
          <strong>{euro.format(plan.total)}</strong>
          <small>
            {plan.capitalMode === "linked" ? "verknüpft" : "abweichend"}
          </small>
        </article>
        <article>
          <span>Gesamtbetrachtung</span>
          <strong>{euro.format(consideredTotal)}</strong>
          <small>
            {plan.depotMode === "retain" || plan.depotMode === "afterSales"
              ? "inklusive ausgewähltem Depot"
              : "nur neue Planung"}
          </small>
        </article>
      </div>
      <div className="plan-toolbar">
        <label>
          <span>Aktive Planung</span>
          <select
            value={plan.id}
            onChange={(event) =>
              setItem({ ...item, activePlanId: event.target.value })
            }
          >
            {item.plans.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.preferred ? "★ " : ""}
                {entry.name}
              </option>
            ))}
          </select>
        </label>
        <label className="plan-name">
          <span>Bezeichnung</span>
          <input
            value={plan.name}
            onChange={(event) => updatePlan({ name: event.target.value })}
          />
        </label>
        <button className="secondary" onClick={createNewPlan}>
          ＋ Neu
        </button>
        <button className="secondary" onClick={duplicatePlan}>
          Duplizieren
        </button>
        <button
          className={
            plan.preferred ? "preferred-button active" : "preferred-button"
          }
          onClick={setPreferred}
        >
          ★ Bevorzugt
        </button>
        <div className={plan.depotMode !== "none" ? "depot-plan-status active" : "depot-plan-status"}>
          <span>Bestandsdepot im Plan</span>
          <strong>{depotStatus}</strong>
          <button onClick={() => setShowDepotPanel((current) => !current)}>
            {showDepotPanel ? "Schließen" : "Ändern"}
          </button>
        </div>
        <button
          className="text-button danger"
          disabled={item.plans.length === 1}
          onClick={deletePlan}
        >
          Löschen
        </button>
      </div>
      {showDepotPanel && (
        <section className="depot-planning-panel">
          <div className="depot-planning-head">
            <div>
              <p className="eyebrow">BESTANDSDEPOT BERÜCKSICHTIGEN</p>
              <h2>Bestand bleibt von neuer Produktanlage getrennt</h2>
              <p>
                Die 500.000 Euro neue Liquidität werden nicht um bestehende
                Positionen erhöht. Der Bestand wird als zusätzliche Ebene in
                Vergleich und Gesamtstruktur geführt.
              </p>
            </div>
            <label>
              <span>Berücksichtigung</span>
              <select
                value={plan.depotMode}
                onChange={(event) => {
                  const depotMode = event.target.value as StructurePlan["depotMode"];
                  updatePlan({
                    depotMode,
                    depotHoldingIds:
                      plan.depotHoldingIds.length > 0
                        ? plan.depotHoldingIds
                        : item.depot.map((holding) => holding.id),
                  });
                }}
              >
                <option value="none">Nicht berücksichtigen</option>
                <option value="compare">Nur vergleichend anzeigen</option>
                <option value="retain">Ausgewählte Positionen beibehalten</option>
                <option value="afterSales">Nach simulierten Verkäufen</option>
              </select>
            </label>
          </div>
          {item.depot.length === 0 ? (
            <button className="empty-depot-link" onClick={() => setView("depot")}>
              Noch keine Depotpositionen erfasst. Depotcheck öffnen →
            </button>
          ) : (
            <div className="depot-planning-grid">
              <div className="depot-position-selection">
                {item.depot.map((holding) => (
                  <label key={holding.id}>
                    <input
                      type="checkbox"
                      checked={selectedDepotIds.has(holding.id)}
                      disabled={plan.depotMode === "none"}
                      onChange={(event) =>
                        updatePlan({
                          depotHoldingIds: event.target.checked
                            ? [...selectedDepotIds, holding.id]
                            : [...selectedDepotIds].filter((id) => id !== holding.id),
                        })
                      }
                    />
                    <span>
                      <strong>{holding.name || "Unbenannte Position"}</strong>
                      <small>
                        {holding.assetClass}
                        {plan.depotMode === "afterSales" && holding.plannedSale > 0
                          ? ` · nach Verkauf ${euro.format(Math.max(0, holding.value - holding.plannedSale))}`
                          : ""}
                      </small>
                    </span>
                    <b>{euro.format(holding.value)}</b>
                  </label>
                ))}
              </div>
              <div className="depot-planning-metrics">
                <article>
                  <span>Neue Liquidität</span>
                  <strong>{euro.format(plan.total)}</strong>
                </article>
                <article>
                  <span>Ausgewählter Bestand</span>
                  <strong>{euro.format(includedDepotTotal)}</strong>
                </article>
                <article>
                  <span>Gesamtbetrachtung</span>
                  <strong>{euro.format(consideredTotal)}</strong>
                  <small>
                    {plan.depotMode === "compare"
                      ? "Bestand wird nur gegenübergestellt"
                      : "Bestand plus neue Planung"}
                  </small>
                </article>
              </div>
            </div>
          )}
        </section>
      )}
      <div className="tool-tabs">
        <button
          className={mode === "structure" ? "active" : ""}
          onClick={() => setMode("structure")}
        >
          Laufzeiten & Produkte
        </button>
        <button
          className={mode === "house" ? "active" : ""}
          onClick={() => setMode("house")}
        >
          Vermögensstruktur
        </button>
        <button
          className={mode === "models" ? "active" : ""}
          onClick={() => setMode("models")}
        >
          Modellvorlagen
        </button>
        <button
          className={mode === "vv" ? "active" : ""}
          onClick={() => setMode("vv")}
        >
          VV-Selektion
        </button>
        <button
          className={mode === "compare" ? "active" : ""}
          onClick={() => setMode("compare")}
        >
          Szenarien
        </button>
      </div>
      {mode === "structure" && (
        <>
          <div className="planner-summary">
            <div className="capital-basis-card">
              <label>
                <span>Zu strukturierendes Kapital</span>
                <div>
                  <input
                    inputMode="numeric"
                    disabled={plan.capitalMode === "linked"}
                    value={plan.total ? plan.total.toLocaleString("de-DE") : ""}
                    placeholder="0"
                    onChange={(event) =>
                      updatePlan({
                        total: parseAmount(event.target.value),
                        capitalMode: "manual",
                      })
                    }
                  />
                  <b>€</b>
                </div>
              </label>
              <small>
                {plan.capitalMode === "linked"
                  ? "automatisch mit der erfassten Liquidität verknüpft"
                  : "abweichender Planungsbetrag"}
              </small>
              {plan.capitalMode === "linked" ? (
                <button onClick={() => updatePlan({ capitalMode: "manual" })}>
                  Abweichenden Betrag verwenden
                </button>
              ) : (
                <button
                  onClick={() =>
                    updatePlan({
                      capitalMode: "linked",
                      total: item.advisory.liquidAssets,
                    })
                  }
                >
                  Erfasste Liquidität übernehmen
                </button>
              )}
            </div>
            <article>
              <span>Kapitaltöpfe</span>
              <strong>
                {euro.format(
                  Object.values(capitalPotTargets).reduce<number>(
                    (sum, value) => sum + (Number(value) || 0),
                    0,
                  ),
                )}
              </strong>
              <small>Reserve, Bedarfsjahre und strategisches Kapital</small>
            </article>
            <article className={assigned > plan.total ? "negative" : ""}>
              <span>Produkten zugeordnet</span>
              <strong>{euro.format(assigned)}</strong>
              <small>
                {assigned > plan.total
                  ? `Überplanung ${euro.format(assigned - plan.total)}`
                  : `noch offen ${euro.format(plan.total - assigned)}`}
              </small>
            </article>
            <article>
              <span>Topfabdeckung</span>
              <strong>{euro.format(covered)}</strong>
              <small>
                {unassignedCoverage > 0
                  ? `${euro.format(unassignedCoverage)} Produktbetrag noch ohne Topf`
                  : `${unresolved.length} Bausteine ohne vollständige Durchschau`}
              </small>
            </article>
          </div>
          <div className="planner-grid">
            <aside className="catalog-panel">
              <div className="catalog-head">
                <div>
                  <span>Lösungsbausteine</span>
                  <strong>{products.length} Treffer</strong>
                </div>
                <small>Stand 01.07.2026</small>
              </div>
              <input
                className="catalog-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Produkt oder WKN suchen"
              />
              <div className="catalog-filters">
                <select
                  aria-label="Quelle"
                  value={catalogSource}
                  onChange={(event) =>
                    setCatalogSource(event.target.value as typeof catalogSource)
                  }
                >
                  <option value="all">Alle Lösungsbausteine</option>
                  <option value="products">Hausmeinungsprodukte</option>
                  <option value="vv">Vermögensverwaltungen</option>
                  <option value="models">Modellportfolio-Bausteine</option>
                </select>
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                >
                  {categories.map((entry) => (
                    <option key={entry}>{entry}</option>
                  ))}
                </select>
                <select
                  value={maxRisk}
                  onChange={(event) => setMaxRisk(Number(event.target.value))}
                >
                  {[1, 2, 3, 4].map((risk) => (
                    <option key={risk} value={risk}>
                      RK bis {risk}
                    </option>
                  ))}
                </select>
              </div>
              <label className="quick-bucket">
                <span>Zuordnung</span>
                <select
                  value={quickBucket}
                  onChange={(event) =>
                    setQuickBucket(event.target.value as CapitalPotId)
                  }
                >
                  {visibleCapitalPots.map((pot) => (
                    <option key={pot.id} value={pot.id}>
                      {pot.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="product-list">
                {products.map((product) => (
                  <article
                    key={product.id}
                    draggable
                    onDragStart={(event) =>
                      event.dataTransfer.setData("text/product-id", product.id)
                    }
                  >
                    <div>
                      <span>
                        {product.category} · RK {product.risk}
                      </span>
                      <strong>{product.name}</strong>
                      <small>{product.meta}</small>
                      <em>{product.sourceLabel}</em>
                    </div>
                    <button onClick={() => addProduct(product.id)}>＋</button>
                  </article>
                ))}
              </div>
            </aside>
            <section className="capital-pot-workspace">
              <div className="capital-timeline" aria-label="Zeitstruktur der Kapitaltöpfe">
                {visibleCapitalPots.map((pot, index) => {
                  const potCoverage = Number(coverageByCapitalPot[pot.id]) || 0;
                  const gap = pot.total - potCoverage;
                  return (
                    <button
                      key={pot.id}
                      className={selectedPot?.id === pot.id ? "active" : ""}
                      onClick={() => {
                        setSelectedCapitalPot(pot.id);
                        setQuickBucket(pot.id);
                      }}
                    >
                      <span>{pot.kind === "year" ? pot.label : pot.kind === "reserve" ? "RESERVE" : "STRATEGISCH"}</span>
                      <strong>{euro.format(pot.total)}</strong>
                      <small>
                        {gap > 0
                          ? `${euro.format(gap)} offen`
                          : gap < 0
                            ? `${euro.format(Math.abs(gap))} überdeckt`
                            : "vollständig abgedeckt"}
                      </small>
                      {index < visibleCapitalPots.length - 1 && <i aria-hidden="true">→</i>}
                    </button>
                  );
                })}
              </div>
              {shortfall > 0 && (
                <div className="planner-alert capital-shortfall">
                  <strong>Planungskonflikt</strong>
                  <span>
                    Reserve und konkrete Kapitalbedarfe übersteigen den Planungsbetrag um {euro.format(shortfall)}. Es wird kein negativer strategischer Topf erzeugt.
                  </span>
                </div>
              )}
              {migrationReviewAmount > 0 && (
                <div className="planner-alert capital-review-alert">
                  <strong>Zuordnung prüfen</strong>
                  <span>
                    {euro.format(migrationReviewAmount)} aus früheren Laufzeitband-Zuordnungen konnten keinem Jahres-Kapitaltopf eindeutig zugeordnet werden. Die Produktbeträge bleiben erhalten.
                  </span>
                  <div className="capital-review-items">
                    {plan.allocations
                      .filter(
                        (allocation) =>
                          (Number(allocation.capitalPotReviewAmount) || 0) > 0,
                      )
                      .map((allocation) => (
                        <div key={allocation.id}>
                          <span>
                            <b>{allocation.productName}</b>
                            <small>{allocation.capitalPotReviewNote}</small>
                          </span>
                          <strong>
                            {euro.format(
                              Number(allocation.capitalPotReviewAmount) || 0,
                            )}
                          </strong>
                          <button
                            disabled={!selectedPot}
                            onClick={() =>
                              selectedPot &&
                              resolveMigrationAllocation(
                                allocation,
                                selectedPot.id,
                              )
                            }
                          >
                            {selectedPot
                              ? `Dem Topf „${selectedPot.label}“ zuordnen`
                              : "Kapitaltopf auswählen"}
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              )}
              {selectedPot && (
                <article
                  className="capital-pot-detail"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    const id = event.dataTransfer.getData("text/product-id");
                    if (id) addProduct(id, selectedPot.id);
                  }}
                >
                  <header>
                    <div>
                      <span>{selectedPot.range}</span>
                      <h2>{selectedPot.label}</h2>
                      {selectedPot.earliestDueDate && (
                        <small>Frühester konkreter Bedarf {germanDate(selectedPot.earliestDueDate)}</small>
                      )}
                    </div>
                    <div>
                      <strong>{euro.format(selectedPot.total)}</strong>
                      <small>{euro.format(selectedPotCoverage)} abgedeckt</small>
                    </div>
                  </header>
                  <div className={`bucket-gap ${selectedPotCoverage > selectedPot.total ? "over" : selectedPotCoverage === selectedPot.total ? "covered" : ""}`}>
                    {selectedPotCoverage === selectedPot.total
                      ? "Kapitaltopf vollständig abgedeckt"
                      : selectedPotCoverage < selectedPot.total
                        ? `${euro.format(selectedPot.total - selectedPotCoverage)} noch nicht zugeordnet`
                        : `${euro.format(selectedPotCoverage - selectedPot.total)} über Zieltopf`}
                  </div>
                  {selectedPot.needs.length > 0 && (
                    <div className="capital-need-list">
                      {selectedPot.needs.map((need) => (
                        <div key={need.id}>
                          <span>
                            <strong>{need.purpose || "Kapitalbedarf"}</strong>
                            <small>
                              {need.dueDate
                                ? germanDate(need.dueDate)
                                : `in ca. ${need.years} ${need.years === 1 ? "Jahr" : "Jahren"}`}
                            </small>
                          </span>
                          <b>{euro.format(need.amount)}</b>
                        </div>
                      ))}
                    </div>
                  )}
                  {allocationsForSelectedPot.length === 0 ? (
                    <div className="bucket-empty">
                      Produkt hierher ziehen
                      <br />
                      <small>oder links über ＋ zuordnen</small>
                    </div>
                  ) : (
                    <div className="bucket-items">
                      {allocationsForSelectedPot.map((allocation) => {
                        const itemSolution = solution(allocation);
                        const conflict =
                          itemSolution &&
                          itemSolution.minMonths > selectedPot.minMonths;
                        return (
                          <div className={conflict ? "conflict" : ""} key={allocation.id}>
                            <span>
                              {allocation.productName}
                              <small>
                                {allocation.source === "model"
                                  ? "Modellportfolio"
                                  : allocation.source === "vv"
                                    ? "Vermögensverwaltung"
                                    : itemSolution?.name}
                                {conflict ? " · Mindesthorizont bis zum frühesten Bedarf prüfen" : ""}
                              </small>
                              <small className="coverage-summary">
                                {visibleCapitalPots
                                  .filter((pot) => allocationAmountInCapitalPot(allocation, pot.id) > 0)
                                  .map((pot) => `${pot.label}: ${euro.format(allocationAmountInCapitalPot(allocation, pot.id))}`)
                                  .join(" · ") || "noch keinem Topf zugeordnet"}
                              </small>
                              {allocation.capitalPotReviewNote && (
                                <small className="migration-review">{allocation.capitalPotReviewNote}</small>
                              )}
                              {allocation.allocationMode === "overflow" &&
                                allocation.amount - allocationCapitalCoverageTotal(allocation) > 0 && (
                                  <small className="allocation-overflow-warning">
                                    {euro.format(allocation.amount - allocationCapitalCoverageTotal(allocation))} können keinem Kapitaltopf zugeordnet werden. Alle verfügbaren Kapitaltöpfe sind bereits vollständig abgedeckt.
                                  </small>
                                )}
                            </span>
                            <div>
                              <input
                                inputMode="numeric"
                                value={allocation.amount ? allocation.amount.toLocaleString("de-DE") : ""}
                                onChange={(event) => updateAllocationAmount(allocation, parseAmount(event.target.value))}
                              />
                              <b>€</b>
                              <button
                                onClick={() => updatePlan({
                                  allocations: plan.allocations.filter((entry) => entry.id !== allocation.id),
                                })}
                              >
                                ×
                              </button>
                            </div>
                            <label className="allocation-mode">
                              <span>Topfabdeckung</span>
                              <select
                                value={allocation.allocationMode || "single"}
                                onChange={(event) => updateAllocationMode(
                                  allocation,
                                  event.target.value as "single" | "overflow" | "manual",
                                )}
                              >
                                <option value="single">Nur dieser Kapitaltopf</option>
                                <option value="overflow">Überschuss automatisch weiterverteilen</option>
                                <option value="manual">Aufteilung manuell festlegen</option>
                              </select>
                            </label>
                            {allocation.allocationMode === "manual" && (
                              <div className="manual-buckets">
                                {visibleCapitalPots.map((pot) => (
                                  <label key={pot.id}>
                                    <span>{pot.label}</span>
                                    <div className="inline-amount">
                                      <input
                                        inputMode="numeric"
                                        value={allocationAmountInCapitalPot(allocation, pot.id)
                                          ? allocationAmountInCapitalPot(allocation, pot.id).toLocaleString("de-DE")
                                          : ""}
                                        onChange={(event) => updateManualBucket(
                                          allocation,
                                          pot.id,
                                          parseAmount(event.target.value),
                                        )}
                                      />
                                      <b>€</b>
                                    </div>
                                  </label>
                                ))}
                                <small className={allocationCapitalCoverageTotal(allocation) !== allocation.amount ? "split-warning" : ""}>
                                  Aufgeteilt: {euro.format(allocationCapitalCoverageTotal(allocation))} von {euro.format(allocation.amount)}
                                </small>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <CapitalPotStructure
                    pot={selectedPot}
                    allocations={allocationsForSelectedPot}
                  />
                </article>
              )}
            </section>
          </div>
          <section className="investment-plan-panel panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">UMSETZUNGSWEG</p>
                <h2>Spar- und Investitionspläne</h2>
                <p>
                  Einmal geplante Produktbeträge können zeitlich gestaffelt
                  umgesetzt werden. Die Raten werden nicht zusätzlich zum
                  Planungsbetrag gezählt.
                </p>
              </div>
              <div className="investment-plan-actions">
                <button className="secondary" onClick={() => addInvestmentPlan("savings")}>
                  ＋ Sparplan
                </button>
                <button className="secondary" onClick={() => addInvestmentPlan("phased")}>
                  ＋ Gestaffelte Anlage
                </button>
              </div>
            </div>
            {(plan.investmentPlans || []).length === 0 ? (
              <div className="investment-plan-empty">
                Noch kein Spar- oder Investitionsplan erfasst.
              </div>
            ) : (
              <div className="investment-plan-list">
                {(plan.investmentPlans || []).map((entry) => (
                  <article key={entry.id}>
                    <header>
                      <span>{entry.type === "savings" ? "Sparplan" : "Gestaffelte Anlage"}</span>
                      <strong>
                        {entry.installments > 0
                          ? euro.format(investmentPlanTotal(entry))
                          : "fortlaufend"}
                      </strong>
                      <button onClick={() => removeInvestmentPlan(entry.id)}>×</button>
                    </header>
                    <div className="investment-plan-fields">
                      <label>
                        <span>Bezeichnung</span>
                        <input
                          value={entry.name}
                          onChange={(event) =>
                            updateInvestmentPlan(entry.id, { name: event.target.value })
                          }
                        />
                      </label>
                      <label>
                        <span>Produkt</span>
                        <select
                          value={entry.productId}
                          onChange={(event) => {
                            const allocation = plan.allocations.find(
                              (item) => item.productId === event.target.value,
                            );
                            updateInvestmentPlan(entry.id, {
                              productId: event.target.value,
                              productName: allocation?.productName || "",
                              bucketId: allocation?.bucketId || entry.bucketId,
                              capitalPotId:
                                allocation?.capitalPotId || entry.capitalPotId,
                            });
                          }}
                        >
                          <option value="">Noch nicht festgelegt</option>
                          {Array.from(
                            new Map(
                              plan.allocations.map((item) => [item.productId, item]),
                            ).values(),
                          ).map((item) => (
                            <option key={item.productId} value={item.productId}>
                              {item.productName}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>Rate</span>
                        <div className="inline-amount">
                          <input
                            inputMode="numeric"
                            value={
                              entry.installmentAmount
                                ? entry.installmentAmount.toLocaleString("de-DE")
                                : ""
                            }
                            onChange={(event) =>
                              updateInvestmentPlan(entry.id, {
                                installmentAmount: parseAmount(event.target.value),
                              })
                            }
                          />
                          <b>€</b>
                        </div>
                      </label>
                      <label>
                        <span>Anzahl Raten</span>
                        <input
                          type="number"
                          min="0"
                          value={entry.installments}
                          onChange={(event) =>
                            updateInvestmentPlan(entry.id, {
                              installments: Math.max(0, Number(event.target.value)),
                            })
                          }
                        />
                        <small>0 bedeutet fortlaufend</small>
                      </label>
                      <label>
                        <span>Rhythmus</span>
                        <select
                          value={entry.frequency}
                          onChange={(event) =>
                            updateInvestmentPlan(entry.id, {
                              frequency: event.target.value as InvestmentPlan["frequency"],
                            })
                          }
                        >
                          {investmentFrequencies.map((frequency) => (
                            <option key={frequency.value} value={frequency.value}>
                              {frequency.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>Start</span>
                        <input
                          type="date"
                          value={entry.startDate}
                          onChange={(event) =>
                            updateInvestmentPlan(entry.id, { startDate: event.target.value })
                          }
                        />
                      </label>
                      <label>
                        <span>Kapitaltopf</span>
                        <select
                          value={entry.capitalPotId || fallbackCapitalPot?.id || ""}
                          onChange={(event) => {
                            const capitalPotId = event.target.value as CapitalPotId;
                            const pot = visibleCapitalPots.find(
                              (item) => item.id === capitalPotId,
                            );
                            updateInvestmentPlan(entry.id, {
                              capitalPotId,
                              bucketId: pot?.legacyBucketId || entry.bucketId,
                            });
                          }}
                        >
                          {visibleCapitalPots.map((pot) => (
                            <option key={pot.id} value={pot.id}>
                              {pot.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="investment-note">
                        <span>Hinweis</span>
                        <input
                          value={entry.note}
                          placeholder="z. B. nach Freigabe starten"
                          onChange={(event) =>
                            updateInvestmentPlan(entry.id, { note: event.target.value })
                          }
                        />
                      </label>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
          <p className="tool-legal">
            Kapitaltopf und Produktzuordnung sind getrennt: Ein Zieltopf zeigt
            den Bedarf, eine Produktposition dessen geplante Umsetzung. Dadurch
            bleiben Lücken und Überplanungen sichtbar.
          </p>
        </>
      )}
      {mode === "house" && <WealthHouse plan={plan} plans={item.plans} depot={item.depot} currentLiquidity={item.advisory.liquidAssets} />}
      {mode === "models" && (
        <div className="models-view">
          <div className="section-copy">
            <p className="eyebrow">STRATEGISCHE STARTVORLAGEN</p>
            <h2>Modellportfolio nur auf den gewählten Kapitaltopf anwenden</h2>
            <p>
              Bestehende Laufzeiten werden nicht mehr ungefragt überschrieben.
              Standardbetrag: strategisch freies Kapital{" "}
              {euro.format(strategicAmount(item.advisory, plan.total))}.
            </p>
          </div>
          <div className="model-grid">
            {modelPortfolios.map((model) => (
              <article key={model.id}>
                <div className="model-title">
                  <span>RB {model.risk}</span>
                  <div>
                    <strong>{model.name}</strong>
                    <small>Stand 01.07.2026</small>
                  </div>
                </div>
                <div className="mix-bars">
                  {Object.entries(model.mix).map(([name, value]) => (
                    <div key={name}>
                      <span>
                        {name}
                        <b>{value} %</b>
                      </span>
                      <i>
                        <em style={{ width: `${value}%` }} />
                      </i>
                    </div>
                  ))}
                </div>
                <details>
                  <summary>{model.holdings.length} Bausteine anzeigen</summary>
                  <ul>
                    {model.holdings.map((holding) => (
                      <li key={holding.name}>
                        <span>{holding.name}</span>
                        <b>{holding.weight} %</b>
                      </li>
                    ))}
                  </ul>
                </details>
                <button
                  className="primary"
                  onClick={() =>
                    setModelDialog({
                      id: model.id,
                      amount: strategicAmount(item.advisory, plan.total),
                    })
                  }
                >
                  Anwendung konfigurieren
                </button>
              </article>
            ))}
          </div>
          <div className="naming-warning">
            <strong>Beide Bezeichnungssysteme enthalten</strong>
            <p>
              Die Modellportfolio-Unterlage verwendet „Private Select
              Defensiv/Ausgewogen/Offensiv“, die VV-Matrix dagegen
              „Sicherheit/Ertrag/Wachstum/Chance“. Alle sieben Bezeichnungen
              stehen im Produktkatalog mit sichtbarem Quellenhinweis zur
              Verfügung und werden nicht automatisch gleichgesetzt.
            </p>
          </div>
        </div>
      )}
      {mode === "vv" && (
        <VvSelection
          item={item}
          setItem={setItem}
          plan={plan}
          addToPlan={(id, amount) =>
            addProduct(
              id,
              visibleCapitalPots.find((pot) => pot.id === "strategic")?.id ||
                fallbackCapitalPot?.id ||
                "strategic",
              "vv",
              amount,
            )
          }
        />
      )}
      {mode === "compare" && (
        <PlanComparison
          plans={item.plans}
          activePlanId={item.activePlanId}
          setActive={(id) => setItem({ ...item, activePlanId: id })}
        />
      )}
      <section className="source-strip">
        <strong>Eingebundene Datenstände</strong>
        {dataSources.map((source) => (
          <span key={source.title}>
            {source.title}
            <b>{source.date}</b>
          </span>
        ))}
      </section>
      {modelDialog && (
        <div className="modal-backdrop">
          <section className="model-dialog">
            <button
              className="modal-close"
              onClick={() => setModelDialog(null)}
            >
              ×
            </button>
            <p className="eyebrow">MODELLPORTFOLIO ANWENDEN</p>
            <h2>
              {
                modelPortfolios.find((entry) => entry.id === modelDialog.id)
                  ?.name
              }
            </h2>
            <AmountField
              label="Betroffener Betrag"
              value={modelDialog.amount}
              onChange={(amount) => setModelDialog({ ...modelDialog, amount })}
            />
            <div className="apply-options">
              <button className="recommended" onClick={() => applyModel("new")}>
                <strong>Als neue Variante</strong>
                <small>
                  Aktuellen Plan kopieren und nur das strategische Laufzeitband
                  ersetzen.
                </small>
              </button>
              <button onClick={() => applyModel("supplement")}>
                <strong>Aktuellen Plan ergänzen</strong>
                <small>
                  Positionen zusätzlich einfügen; Überplanung wird sichtbar.
                </small>
              </button>
              <button onClick={() => applyModel("replace")}>
                <strong>Aktuellen Plan ersetzen</strong>
                <small>Alle bisherigen Produktzuordnungen entfernen.</small>
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function CapitalPotStructure({
  pot,
  allocations,
}: {
  pot: CapitalPot;
  allocations: PlannerAllocation[];
}) {
  const [selectedAsset, setSelectedAsset] = useState<AssetClass | null>(null);
  const contributors = assetClasses.map((asset) => ({
    asset,
    entries: allocations.flatMap((allocation) => {
      const amount = allocationAmountInCapitalPot(allocation, pot.id);
      const mix = productAssetMix(allocation.productId)?.[asset] || 0;
      return amount > 0 && mix > 0
        ? [{
            id: allocation.id,
            name: allocation.productName,
            amount: (amount * mix) / 100,
            mix,
          }]
        : [];
    }),
  }));
  const rows = contributors
    .map((entry) => ({
      ...entry,
      amount: entry.entries.reduce((sum, product) => sum + product.amount, 0),
    }))
    .filter((entry) => entry.amount > 0);
  const knownTotal = rows.reduce((sum, entry) => sum + entry.amount, 0);
  const assignedTotal = allocations.reduce(
    (sum, allocation) =>
      sum + allocationAmountInCapitalPot(allocation, pot.id),
    0,
  );
  const unresolved = Math.max(0, assignedTotal - knownTotal);
  const heading =
    pot.kind === "reserve"
      ? "Struktur der Liquiditätsreserve"
      : pot.kind === "strategic"
        ? "Struktur des strategisch verfügbaren Kapitals"
        : `Struktur des Kapitaltopfs ${pot.label}`;

  return (
    <section className="capital-pot-structure">
      <p className="eyebrow">STRUKTUR DES KAPITALTOPFS</p>
      <h3>{heading}</h3>
      {rows.length ? (
        <div className="capital-pot-asset-bars">
          {rows.map((row) => {
            const share = assignedTotal ? (row.amount / assignedTotal) * 100 : 0;
            return (
              <button
                key={row.asset}
                className={selectedAsset === row.asset ? "active" : ""}
                onClick={() =>
                  setSelectedAsset(selectedAsset === row.asset ? null : row.asset)
                }
              >
                <span>
                  <strong>{row.asset}</strong>
                  <b>{percent.format(share)} % · {euro.format(row.amount)}</b>
                </span>
                <i style={{ width: `${Math.min(100, share)}%` }} />
              </button>
            );
          })}
        </div>
      ) : (
        <p className="capital-pot-structure-empty">
          Noch keine wirtschaftlich durchgeschauten Produkte zugeordnet.
        </p>
      )}
      {unresolved > 0 && (
        <p className="capital-pot-unresolved">
          {euro.format(unresolved)} ohne freigegebene Durchschau
        </p>
      )}
      {selectedAsset && (
        <div className="capital-pot-asset-detail">
          <strong>Beiträge zu {selectedAsset}</strong>
          {contributors
            .find((entry) => entry.asset === selectedAsset)
            ?.entries.map((entry) => (
              <p key={entry.id}>
                <span>{entry.name}<small>Anteil am Produkt {percent.format(entry.mix)} %</small></span>
                <b>{euro.format(entry.amount)}</b>
              </p>
            ))}
        </div>
      )}
    </section>
  );
}

function WealthHouse({
  plan,
  plans = [plan],
  depot,
  currentLiquidity = 0,
  compact = false,
  context = "planner",
}: {
  plan: StructurePlan;
  plans?: StructurePlan[];
  depot: DepotHolding[];
  currentLiquidity?: number;
  compact?: boolean;
  context?: "planner" | "depot";
}) {
  const [mode, setMode] = useState<"ist" | "plan" | "target" | "compare">(
    context === "depot" ? "ist" : compact ? "target" : "plan",
  );
  const [compareWith, setCompareWith] = useState<"plan" | "target">("target");
  const [selectedAsset, setSelectedAsset] = useState<AssetClass | null>(null);
  const targetPlan = plans.find((entry) => entry.preferred) || plan;
  const breakdown = planAssetAmounts(plan);
  const selectedIds = new Set(
    plan.depotHoldingIds.length > 0
      ? plan.depotHoldingIds
      : depot.map((entry) => entry.id),
  );
  const relevantDepot =
    plan.depotMode === "none"
      ? []
      : depot.filter((entry) => selectedIds.has(entry.id));
  const depotBreakdown = depotAssetAmounts(
    relevantDepot,
    (entry) =>
      plan.depotMode === "afterSales"
        ? Math.max(0, entry.value - entry.plannedSale)
        : entry.value,
  );
  const depotAmounts = depotBreakdown.amounts;
  const includeInTotal =
    plan.depotMode === "retain" || plan.depotMode === "afterSales";
  const unallocatedPlan = Math.max(0, plan.total - breakdown.total);
  const plannedAmounts = Object.fromEntries(
    assetClasses.map((name) => [
      name,
      breakdown.amounts[name] + (name === "Liquidität" ? unallocatedPlan : 0),
    ]),
  ) as Record<AssetClass, number>;
  const combinedAmounts = Object.fromEntries(
    assetClasses.map((name) => [
      name,
      plannedAmounts[name] + (includeInTotal ? depotAmounts[name] : 0),
    ]),
  ) as Record<AssetClass, number>;
  const combinedKnown = Object.values(combinedAmounts).reduce(
    (sum, value) => sum + value,
    0,
  );
  const colors: Record<AssetClass, string> = {
    Liquidität: "#96bee6",
    Geldwerte: "#327dc8",
    Substanzwerte: "#0066b3",
    "Alternative Anlagen": "#ff6600",
    Sachwerte: "#006e73",
  };
  const examples: Record<AssetClass, string> = {
    Liquidität: "Tagesgeld, Kontoguthaben, Reserve",
    Geldwerte: "Anleihen, Renten- und Geldmarktfonds",
    Substanzwerte: "Aktien, Aktienfonds, Aktienanteile",
    "Alternative Anlagen": "Rohstoffe und alternative Strategien",
    Sachwerte: "Immobilien und offene Immobilienfonds",
  };
  const entireDepotBreakdown = depotAssetAmounts(depot);
  const entireDepotAmounts = {
    ...entireDepotBreakdown.amounts,
    Liquidität:
      entireDepotBreakdown.amounts.Liquidität + currentLiquidity,
  };
  const snapshotFor = (selectedPlan: StructurePlan) => {
    const selectedBreakdown = planAssetAmounts(selectedPlan);
    const selectedIds = new Set(
      selectedPlan.depotHoldingIds.length
        ? selectedPlan.depotHoldingIds
        : depot.map((entry) => entry.id),
    );
    const includeDepot =
      selectedPlan.depotMode === "retain" ||
      selectedPlan.depotMode === "afterSales";
    const retainedBreakdown = depotAssetAmounts(
      includeDepot
        ? depot.filter((entry) => selectedIds.has(entry.id))
        : [],
      (entry) =>
        selectedPlan.depotMode === "afterSales"
          ? Math.max(0, entry.value - entry.plannedSale)
          : entry.value,
    );
    const amounts = Object.fromEntries(
      assetClasses.map((name) => {
        const retained = retainedBreakdown.amounts[name];
        const unallocated =
          name === "Liquidität"
            ? Math.max(0, selectedPlan.total - selectedBreakdown.total)
            : 0;
        return [name, selectedBreakdown.amounts[name] + retained + unallocated];
      }),
    ) as Record<AssetClass, number>;
    return {
      amounts,
      unresolved: selectedBreakdown.unresolved + retainedBreakdown.unresolved,
    };
  };
  const istSnapshot = {
    amounts: entireDepotAmounts,
    unresolved: entireDepotBreakdown.unresolved,
  };
  const depotPlanBreakdown = depotPlanAssetAmounts(depot, plan);
  const planSnapshot =
    context === "depot"
      ? {
          amounts: depotPlanBreakdown.amounts,
          unresolved: depotPlanBreakdown.unresolved,
        }
      : snapshotFor(plan);
  const targetSnapshot = snapshotFor(targetPlan);
  const shown =
    mode === "ist"
      ? istSnapshot
      : mode === "target"
        ? targetSnapshot
        : planSnapshot;
  const comparison =
    context === "depot" || compareWith === "plan"
      ? planSnapshot
      : targetSnapshot;
  const shownKnown = Object.values(shown.amounts).reduce(
    (sum, value) => sum + value,
    0,
  );
  const istKnown = Object.values(istSnapshot.amounts).reduce(
    (sum, value) => sum + value,
    0,
  );
  const comparisonKnown = Object.values(comparison.amounts).reduce(
    (sum, value) => sum + value,
    0,
  );
  const shownTotal =
    shownKnown + (context === "depot" ? shown.unresolved : 0);
  const istTotal =
    istKnown + (context === "depot" ? istSnapshot.unresolved : 0);
  const comparisonTotal =
    comparisonKnown + (context === "depot" ? comparison.unresolved : 0);
  const holdingContributors = (
    holdings: DepotHolding[],
    asset: AssetClass,
    source: string,
    valueFor: (holding: DepotHolding) => number,
  ) =>
    holdings.flatMap((entry) => {
      const mix = entry.productId
        ? productAssetMix(entry.productId)?.[asset] || 0
        : entry.classificationStatus !== "unresolved" &&
            entry.assetClass === asset
          ? 100
          : 0;
      const value = Math.max(0, valueFor(entry));
      return mix > 0 && value > 0
        ? [{
            id: entry.id,
            name: entry.name,
            amount: (value * mix) / 100,
            mix,
            source,
          }]
        : [];
    });
  const contributors = (
    asset: AssetClass,
    source: "ist" | "plan" | "target",
  ) => {
    if (source === "ist")
      return [
        ...(asset === "Liquidität" && currentLiquidity > 0
          ? [{
              id: "current-liquidity",
              name: "Erfasste Liquidität",
              amount: currentLiquidity,
              mix: 100,
              source: "Ausgangslage",
            }]
          : []),
        ...holdingContributors(
          depot,
          asset,
          "Bestandsdepot",
          (entry) => entry.value,
        ),
      ];
    const selectedPlan = source === "target" ? targetPlan : plan;
    const planEntries = selectedPlan.allocations.flatMap((allocation) => {
      const product = houseProducts.find(
        (entry) => entry.id === allocation.productId,
      );
      const vv = managedPortfolios.find(
        (entry) => entry.id === allocation.productId,
      );
      const mix = product?.assetMix?.[asset] || vv?.assetMix?.[asset] || 0;
      return mix
        ? [
            {
              id: allocation.id,
              name: allocation.productName,
              amount: (allocation.amount * mix) / 100,
              mix,
              source:
                allocation.source === "vv"
                  ? "VV-Matrix"
                  : allocation.source === "model"
                    ? "Modellportfolio"
                    : "Hausmeinung",
            },
          ]
        : [];
    });
    if (asset === "Liquidität") {
      const unallocated = Math.max(
        0,
        selectedPlan.total - planAssetAmounts(selectedPlan).total,
      );
      if (unallocated > 0)
        planEntries.push({
          id: `unallocated-${selectedPlan.id}`,
          name: "Noch nicht zugeordnetes Planungskapital",
          amount: unallocated,
          mix: 100,
          source: "Planungsrest",
        });
    }
    if (context === "depot")
      return [
        ...holdingContributors(
          depot,
          asset,
          "Bestand nach Verkäufen",
          (entry) => Math.max(0, entry.value - entry.plannedSale),
        ),
        ...planEntries,
      ];
    const includeDepot =
      selectedPlan.depotMode === "retain" ||
      selectedPlan.depotMode === "afterSales";
    if (!includeDepot) return planEntries;
    const ids = new Set(
      selectedPlan.depotHoldingIds.length
        ? selectedPlan.depotHoldingIds
        : depot.map((entry) => entry.id),
    );
    return [
      ...planEntries,
      ...holdingContributors(
        depot.filter((entry) => ids.has(entry.id)),
        asset,
        "Fortbestehender Bestand",
        (entry) =>
          selectedPlan.depotMode === "afterSales"
            ? Math.max(0, entry.value - entry.plannedSale)
            : entry.value,
      ).map((entry) => ({ ...entry, id: `depot-${entry.id}` })),
    ];
  };
  return (
    <div className="house-view">
      {!compact && <div className="section-copy">
        <p className="eyebrow">VERMÖGENSHAUS</p>
        <h2>
          {context === "depot"
            ? "Bestehende Depotstruktur"
            : "Geplante Vermögensstruktur"}
        </h2>
        <p>
          Mischfonds und Vermögensverwaltungen werden anhand der Quoten aus den
          Unterlagen aufgeteilt. Ungeklärte Produkte bleiben separat sichtbar.
        </p>
      </div>}
      {!compact && (
        <div className="house-mode-tabs" role="tablist" aria-label="Ansicht der Vermögensstruktur">
          {(context === "depot"
            ? (["ist", "plan", "compare"] as const)
            : (["ist", "plan", "target", "compare"] as const)
          ).map((entry) => (
            <button
              key={entry}
              className={mode === entry ? "active" : ""}
              onClick={() => {
                setMode(entry);
                setSelectedAsset(null);
              }}
              role="tab"
              aria-selected={mode === entry}
            >
              {entry === "target"
                ? "ZIELPLAN"
                : entry === "compare"
                  ? "VERGLEICH"
                  : entry.toUpperCase()}
            </button>
          ))}
          {mode === "compare" && context !== "depot" && (
            <select
              aria-label="Vergleichsziel"
              value={compareWith}
              onChange={(event) =>
                setCompareWith(event.target.value as "plan" | "target")
              }
            >
              <option value="plan">IST mit aktiver Planung</option>
              <option value="target">IST mit Zielplan</option>
            </select>
          )}
        </div>
      )}
      <div className="house-layout">
        <div className="wealth-house">
          <div className="house-roof">
            <span>
              {mode === "ist"
                ? context === "depot"
                  ? "IST · Bestehende Depotstruktur"
                  : "IST-Struktur"
                : mode === "target"
                  ? `ZIELPLAN · ${targetPlan.name}`
                  : mode === "compare"
                    ? context === "depot"
                      ? "IST-PLAN-Vergleich"
                      : compareWith === "target"
                      ? "IST-ZIELPLAN-Vergleich"
                      : "IST-PLAN-Vergleich"
                    : context === "depot"
                      ? `PLAN · nach Transaktionen · ${plan.name}`
                      : `PLAN · ${plan.name}`}
            </span>
            <strong>
              {mode === "compare" && context === "depot"
                ? `${euro.format(istTotal)} → ${euro.format(comparisonTotal)}`
                : euro.format(mode === "compare" ? comparisonTotal : shownTotal)}
            </strong>
          </div>
          <div className="house-pillars">
            {assetClasses.map((name) => {
              const value = shown.amounts[name];
              const share = shownTotal ? (value / shownTotal) * 100 : 0;
              const istShare = istTotal
                ? (istSnapshot.amounts[name] / istTotal) * 100
                : 0;
              const targetShare = comparisonTotal
                ? (comparison.amounts[name] / comparisonTotal) * 100
                : 0;
              const displayValue =
                mode === "compare" ? comparison.amounts[name] : value;
              const displayShare = mode === "compare" ? targetShare : share;
              const fill = displayValue
                ? Math.max(5, Math.min(100, displayShare))
                : 0;
              return (
                <button
                  key={name}
                  className={selectedAsset === name ? "active" : ""}
                  onClick={() => setSelectedAsset(name)}
                  aria-label={`${name} öffnen`}
                  style={
                    {
                      "--pillar-color": colors[name],
                      "--pillar-fill": `${fill}%`,
                    } as CSSProperties
                  }
                >
                  <div className="pillar-fill" />
                  <header>
                    <span>{name}</span>
                    <strong>{percent.format(displayShare)} %</strong>
                  </header>
                  <p>{examples[name]}</p>
                  <footer>{euro.format(displayValue)}</footer>
                  {mode === "compare" && (
                    <div className="pillar-delta">
                      <span>IST {percent.format(istShare)} %</span>
                      <b>
                        {targetShare - istShare >= 0 ? "+" : ""}
                        {percent.format(targetShare - istShare)} %-Pkt.
                      </b>
                      <small>
                        {euro.format(
                          comparison.amounts[name] - istSnapshot.amounts[name],
                        )}
                      </small>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          <div className="house-foundation">
            <span>
              Wirtschaftliche Durchschau der gewählten Ansicht
            </span>
            <b>
              {shown.unresolved > 0
                ? `${euro.format(shown.unresolved)} noch ungeklärt`
                : "vollständig durchgeschaut"}
            </b>
          </div>
        </div>
        {!compact && context === "planner" && mode === "plan" && <section className="panel house-table">
          <div className="comparison-table">
            <div className="comparison-head">
              <span>Anlageklasse</span>
              <span>Bestandsdepot</span>
              <span>Neue Planung</span>
              <span>Gesamtquote</span>
            </div>
            {assetClasses.map((name) => (
              <div key={name}>
                <strong>{name}</strong>
                <span>{euro.format(depotAmounts[name])}</span>
                <span>{euro.format(plannedAmounts[name])}</span>
                <b>
                  {percent.format(
                    combinedKnown
                      ? (combinedAmounts[name] / combinedKnown) * 100
                      : 0,
                  )}{" "}
                  %
                </b>
              </div>
            ))}
            <div className="unresolved-row">
              <strong>Nicht durchgeschaut</strong>
              <span>–</span>
              <span>{euro.format(breakdown.unresolved)}</span>
              <b>
                {percent.format(
                  breakdown.total
                    ? (breakdown.unresolved / breakdown.total) * 100
                    : 0,
                )}{" "}
                %
              </b>
            </div>
          </div>
        </section>}
      </div>
      {selectedAsset && (
        <section className="house-detail panel">
          <header>
            <div>
              <p className="eyebrow">DETAILANSICHT</p>
              <h3>{selectedAsset}</h3>
            </div>
            <button onClick={() => setSelectedAsset(null)}>Schließen ×</button>
          </header>
          {mode === "compare" ? (
            <div className="house-detail-compare">
              <section>
                <h4>IST</h4>
                {contributors(selectedAsset, "ist").length ? contributors(selectedAsset, "ist").map((entry) => (
                  <p key={`ist-${entry.id}`}><span>{entry.name}<small>{entry.source}</small></span><b>{euro.format(entry.amount)}</b></p>
                )) : <small>Keine wirtschaftlich zugeordnete Position.</small>}
              </section>
              <section>
                <h4>{context === "depot" || compareWith === "plan" ? "PLAN" : "ZIELPLAN"}</h4>
                {contributors(selectedAsset, context === "depot" ? "plan" : compareWith).length ? contributors(selectedAsset, context === "depot" ? "plan" : compareWith).map((entry) => (
                  <p key={`compare-${entry.id}`}><span>{entry.name}<small>{entry.source} · Anteil {percent.format(entry.mix)} %</small></span><b>{euro.format(entry.amount)}</b></p>
                )) : <small>Keine wirtschaftlich zugeordnete Position.</small>}
              </section>
            </div>
          ) : (
            <div className="house-detail-list">
              {contributors(selectedAsset, mode === "target" ? "target" : mode === "ist" ? "ist" : "plan").length ? contributors(selectedAsset, mode === "target" ? "target" : mode === "ist" ? "ist" : "plan").map((entry) => (
                <p key={entry.id}><span>{entry.name}<small>{entry.source} · Anteil {percent.format(entry.mix)} %</small></span><b>{euro.format(entry.amount)}</b></p>
              )) : <small>Keine wirtschaftlich zugeordnete Position.</small>}
            </div>
          )}
        </section>
      )}
      {!compact && context === "planner" && mode === "plan" && <div className="house-context">
        <strong>Depotmodus</strong>
        <span>
          {plan.depotMode === "none"
            ? "Bestandsdepot nicht berücksichtigt"
            : plan.depotMode === "compare"
              ? "Bestandsdepot wird nur vergleichend angezeigt"
              : plan.depotMode === "afterSales"
                ? "Ausgewählte Positionen nach simulierten Verkäufen einbezogen"
                : "Ausgewählte Positionen als fortbestehender Bestand einbezogen"}
        </span>
      </div>}
      {!compact && mode !== "ist" && shown.unresolved > 0 && (
        <div className="planner-alert">
          <strong>Datenproblem</strong>
          <span>
            {euro.format(shown.unresolved)} entfallen auf Bausteine ohne
            freigegebene Durchschau.
            {context === "planner"
              ? " Dazu zählen insbesondere Modellbezeichnungen sowie ZinsFix Index und MEA Einzelwert."
              : " Diese Positionen bleiben bewusst außerhalb der fünf Säulen sichtbar."}
          </span>
        </div>
      )}
      {!compact && mode === "plan" && <section className="panel lookthrough">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">DURCHSCHAU</p>
            <h2>Beiträge der Produkte</h2>
          </div>
        </div>
        <div className="lookthrough-grid">
          {plan.allocations.map((allocation) => {
            const product = houseProducts.find(
              (entry) => entry.id === allocation.productId,
            );
            const vv = managedPortfolios.find(
              (entry) => entry.id === allocation.productId,
            );
            const mix = product?.assetMix || vv?.assetMix;
            return (
              <article key={allocation.id}>
                <strong>{allocation.productName}</strong>
                <small>{euro.format(allocation.amount)}</small>
                {mix ? (
                  <div>
                    {assetClasses
                      .filter((name) => mix[name] > 0)
                      .map((name) => (
                        <span key={name}>
                          {name} <b>{mix[name]} %</b>
                        </span>
                      ))}
                  </div>
                ) : (
                  <em>Durchschau ungeklärt</em>
                )}
              </article>
            );
          })}
        </div>
      </section>}
    </div>
  );
}

function VvSelection({
  item,
  setItem,
  plan,
  addToPlan,
}: {
  item: AdvisoryCase;
  setItem: (item: AdvisoryCase) => void;
  plan: StructurePlan;
  addToPlan: (id: string, amount: number) => "added" | "updated" | "ignored";
}) {
  const filters = item.vvFilters;
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [feedback, setFeedback] = useState<{ id: string; text: string } | null>(null);
  const setFilter = <K extends keyof VvFilters>(key: K, value: VvFilters[K]) =>
    setItem({ ...item, vvFilters: { ...filters, [key]: value } });
  const matchBool = (filter: string, value: boolean) =>
    filter === "Keine Präferenz" || value === (filter === "Ja");
  const matches = managedPortfolios.filter(
    (entry) =>
      entry.onHouseView &&
      entry.minimum <= filters.amount &&
      entry.risk <= filters.maxRisk &&
      matchBool(filters.sustainable, entry.sustainable) &&
      (filters.currency === "Keine Präferenz" ||
        entry.currency === filters.currency) &&
      (filters.region === "Keine Präferenz" ||
        entry.region === filters.region) &&
      (filters.metals === "Keine Präferenz" ||
        entry.metals === filters.metals) &&
      matchBool(filters.targetFunds, entry.targetFunds) &&
      (filters.equityBand === "Keine Präferenz" ||
        entry.equityBand === filters.equityBand) &&
      matchBool(filters.individual, entry.individual) &&
      (filters.billingCountry === "Keine Präferenz" ||
        entry.billingCountry === filters.billingCountry) &&
      (filters.custody === "Keine Präferenz" ||
        entry.custody === filters.custody),
  );
  const toggleCompare = (id: string) => {
    const selected = item.selectedVvIds.includes(id);
    if (!selected && item.selectedVvIds.length >= 3) return;
    setItem({
      ...item,
      selectedVvIds: selected
        ? item.selectedVvIds.filter((entry) => entry !== id)
        : [...item.selectedVvIds, id],
    });
  };
  const selected = managedPortfolios.filter((entry) =>
    item.selectedVvIds.includes(entry.id),
  );
  return (
    <div className="vv-view">
      <div className="section-copy">
        <p className="eyebrow">VOLLSTÄNDIGE SELEKTIONSLOGIK</p>
        <h2>Zehn Kriterien aus der Excel plus Risikoklasse</h2>
        <p>
          „Keine Präferenz“ lässt das jeweilige Kriterium offen. Informative,
          nicht auf der Hausmeinung befindliche Strategien werden nicht als
          Treffer ausgegeben.
        </p>
      </div>
      <div className="vv-filter-layout">
        <aside className="vv-filter-panel">
          <AmountField
            label="Einstiegsgröße"
            value={filters.amount}
            onChange={(value) => setFilter("amount", value)}
          />
          {[
            [
              "Nachhaltigkeit",
              "sustainable",
              ["Keine Präferenz", "Ja"],
            ],
            ["Währung", "currency", ["Keine Präferenz", "EUR", "CHF"]],
            [
              "Regionale Präferenz",
              "region",
              ["Keine Präferenz", "Weltweit", "Schweiz"],
            ],
            [
              "Edelmetalle",
              "metals",
              ["Keine Präferenz", "Ja", "Nein", "Individuell"],
            ],
            [
              "Möglichkeit von Zielfonds",
              "targetFunds",
              ["Keine Präferenz", "Ja", "Nein"],
            ],
            [
              "Aktienquote",
              "equityBand",
              ["Keine Präferenz", "Unter 50%", "Über 50%", "Individuell"],
            ],
            [
              "Individuelle Strategie",
              "individual",
              ["Keine Präferenz", "Ja", "Nein"],
            ],
            [
              "Abrechnungsland",
              "billingCountry",
              ["Keine Präferenz", "Deutschland", "Schweiz"],
            ],
            [
              "Depotstelle",
              "custody",
              [
                "Keine Präferenz",
                "VoBa pur",
                "DZ Privatbank",
                "Union Investment",
              ],
            ],
          ].map(([label, key, options]) => (
            <label className="field" key={key as string}>
              <span>{label as string}</span>
              <select
                value={String(filters[key as keyof VvFilters])}
                onChange={(event) =>
                  setFilter(key as keyof VvFilters, event.target.value as never)
                }
              >
                {(options as string[]).map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>
          ))}
          <label className="field">
            <span>Risikoklasse bis</span>
            <select
              value={filters.maxRisk}
              onChange={(event) =>
                setFilter("maxRisk", Number(event.target.value))
              }
            >
              {[2, 3, 4].map((risk) => (
                <option key={risk}>{risk}</option>
              ))}
            </select>
          </label>
        </aside>
        <div>
          <div className="vv-results-head">
            <strong>{matches.length} passende Lösungen</strong>
            <span>
              von{" "}
              {managedPortfolios.filter((entry) => entry.onHouseView).length}{" "}
              Strategien auf Hausmeinung
            </span>
          </div>
          <div className="vv-result-grid">
            {matches.map((entry) => (
              <article key={entry.id} className={feedback?.id === entry.id ? "vv-added" : ""}>
                <header>
                  <span>RK {entry.risk}</span>
                  <strong>{entry.name}</strong>
                </header>
                <p>{entry.mix}</p>
                <dl>
                  <div>
                    <dt>Mindestanlage</dt>
                    <dd>{euro.format(entry.minimum)}</dd>
                  </div>
                  <div>
                    <dt>Region / Währung</dt>
                    <dd>
                      {entry.region} / {entry.currency}
                    </dd>
                  </div>
                  <div>
                    <dt>Abrechnung / Depot</dt>
                    <dd>
                      {entry.billingCountry} / {entry.custody}
                    </dd>
                  </div>
                  <div>
                    <dt>Kosten laut Matrix</dt>
                    <dd>{entry.costs}</dd>
                  </div>
                </dl>
                <div className="vv-tags">
                  <span>
                    {entry.sustainable ? "nachhaltig" : "nicht nachhaltig"}
                  </span>
                  <span>Edelmetalle: {entry.metals}</span>
                  <span>{entry.equityBand}</span>
                  {entry.targetFunds && <span>Zielfonds</span>}
                  {entry.individual && <span>individualisierbar</span>}
                </div>
                <label className="vv-investment-amount">
                  <span>Anlagebetrag</span>
                  <div className="inline-amount">
                    <input
                      inputMode="numeric"
                      value={(amounts[entry.id] ?? filters.amount)
                        ? (amounts[entry.id] ?? filters.amount).toLocaleString("de-DE")
                        : ""}
                      onChange={(event) =>
                        setAmounts((current) => ({
                          ...current,
                          [entry.id]: parseAmount(event.target.value),
                        }))
                      }
                    />
                    <b>€</b>
                  </div>
                </label>
                {(amounts[entry.id] ?? filters.amount) < entry.minimum && (
                  <p className="vv-minimum-warning">
                    Der Anlagebetrag liegt unter der ausgewiesenen Mindestanlage von {euro.format(entry.minimum)}. Bei einer Aufstockung kann dies zulässig sein. Bitte fachlich prüfen.
                  </p>
                )}
                {feedback?.id === entry.id && (
                  <p className="vv-transfer-feedback" role="status">{feedback.text}</p>
                )}
                <div className="vv-card-actions">
                  <button
                    className={
                      item.selectedVvIds.includes(entry.id)
                        ? "secondary active"
                        : "secondary"
                    }
                    onClick={() => toggleCompare(entry.id)}
                  >
                    {item.selectedVvIds.includes(entry.id)
                      ? "✓ Vergleich"
                      : "Vergleichen"}
                  </button>
                  <button
                    className="primary"
                    onClick={() => {
                      const amount = amounts[entry.id] ?? filters.amount;
                      const result = addToPlan(entry.id, amount);
                      if (result !== "ignored")
                        setFeedback({
                          id: entry.id,
                          text: `${entry.name} mit ${euro.format(amount)} ${result === "updated" ? "im Plan aktualisiert" : "in Plan übernommen"}.`,
                        });
                    }}
                  >
                    {plan.allocations.some(
                      (allocation) =>
                        allocation.source === "vv" && allocation.productId === entry.id,
                    )
                      ? `Im Plan · ${euro.format(
                          plan.allocations.find(
                            (allocation) =>
                              allocation.source === "vv" &&
                              allocation.productId === entry.id,
                          )?.amount || 0,
                        )}`
                      : "In Plan übernehmen"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
      {selected.length > 0 && (
        <section className="panel vv-comparison">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">DIREKTVERGLEICH</p>
              <h2>{selected.length} Vermögensverwaltungen</h2>
            </div>
          </div>
          <div className="vv-compare-table">
            <div>
              <strong>Kriterium</strong>
              {selected.map((entry) => (
                <strong key={entry.id}>{entry.name}</strong>
              ))}
            </div>
            {[
              [
                "Mindestanlage",
                (entry: (typeof selected)[number]) =>
                  euro.format(entry.minimum),
              ],
              [
                "Risikoklasse",
                (entry: (typeof selected)[number]) => String(entry.risk),
              ],
              ["Struktur", (entry: (typeof selected)[number]) => entry.mix],
              [
                "Zielfonds",
                (entry: (typeof selected)[number]) =>
                  entry.targetFunds ? "Ja" : "Nein",
              ],
              [
                "Edelmetalle",
                (entry: (typeof selected)[number]) => entry.metals,
              ],
              [
                "Depotstelle",
                (entry: (typeof selected)[number]) => entry.custody,
              ],
              ["Kosten", (entry: (typeof selected)[number]) => entry.costs],
            ].map(([label, format]) => (
              <div key={label as string}>
                <span>{label as string}</span>
                {selected.map((entry) => (
                  <span key={entry.id}>
                    {(format as (entry: (typeof selected)[number]) => string)(
                      entry,
                    )}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}
      <p className="tool-legal">
        Die Filter normalisieren die in der Excel uneinheitlich verwendeten
        Werte „Individuell“, Ja/Nein und unterschiedliche Aktienquotenformate.
        Das Ergebnis ist eine Vorauswahl ohne Rangfolge.
      </p>
    </div>
  );
}

function PlanComparison({
  plans,
  activePlanId,
  setActive,
}: {
  plans: StructurePlan[];
  activePlanId: string;
  setActive: (id: string) => void;
}) {
  return (
    <div className="compare-view">
      <div className="section-copy">
        <p className="eyebrow">SZENARIOVERGLEICH</p>
        <h2>Planvarianten im Vergleich</h2>
        <p>
          Planvolumen, Laufzeiten, Anlageklassen, Modellbezug und offene
          Durchschau werden aus denselben Positionen berechnet.
        </p>
      </div>
      <div className="scenario-comparison">
        {plans.map((plan) => {
          const breakdown = planAssetAmounts(plan);
          return (
            <article
              key={plan.id}
              className={plan.id === activePlanId ? "active" : ""}
            >
              <header>
                <div>
                  <span>{plan.preferred ? "★ BEVORZUGT" : "VARIANTE"}</span>
                  <strong>{plan.name}</strong>
                </div>
                <button onClick={() => setActive(plan.id)}>Öffnen</button>
              </header>
              <dl>
                <div>
                  <dt>Planvolumen</dt>
                  <dd>{euro.format(plan.total)}</dd>
                </div>
                <div>
                  <dt>Produktzuordnung</dt>
                  <dd>{euro.format(breakdown.total)}</dd>
                </div>
                <div>
                  <dt>Modellbezug</dt>
                  <dd>
                    {modelPortfolios.find((entry) => entry.id === plan.modelId)
                      ?.name || "individuell"}
                  </dd>
                </div>
                <div>
                  <dt>Ungeklärt</dt>
                  <dd>{euro.format(breakdown.unresolved)}</dd>
                </div>
              </dl>
              <div className="mix-bars">
                {assetClasses.map((name) => (
                  <div key={name}>
                    <span>
                      {name}
                      <b>
                        {percent.format(
                          breakdown.total
                            ? (breakdown.amounts[name] / breakdown.total) * 100
                            : 0,
                        )}{" "}
                        %
                      </b>
                    </span>
                    <i>
                      <em
                        style={{
                          width: `${breakdown.total ? (breakdown.amounts[name] / breakdown.total) * 100 : 0}%`,
                        }}
                      />
                    </i>
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

const depotDecimal = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 4,
});

const formatDepotDate = (value?: string) => {
  if (!value) return "";
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? germanDate(value) : value;
};

function DepotDetailGroup({
  title,
  entries,
}: {
  title: string;
  entries: Array<{ label: string; value: ReactNode; present: boolean }>;
}) {
  const visible = entries.filter((entry) => entry.present);
  if (!visible.length) return null;
  return (
    <section>
      <h4>{title}</h4>
      <dl>
        {visible.map((entry, index) => (
          <div key={`${entry.label}-${index}`}>
            <dt>{entry.label}</dt>
            <dd>{entry.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function DepotHoldingDetails({ holding }: { holding: DepotHolding }) {
  const present = (value: unknown) =>
    value !== undefined && value !== null && value !== "";
  const hasImportedDetails = [
    holding.wkn,
    holding.segment,
    holding.investmentMedium,
    holding.securityType,
    holding.sourceType,
    holding.rawCountry,
    holding.currency,
    holding.industry,
    holding.certificateClass,
    holding.coupon,
    holding.maturity,
    holding.nominalOrUnits,
    holding.lastPurchaseDate,
    holding.averageEntryPrice,
    holding.purchaseCosts,
    holding.currentPrice,
    holding.gainLossPercent,
    holding.gainLossAmount,
    holding.accruedInterest,
    holding.sourceDepotShare,
    holding.averageEntryFx,
    holding.fxRate,
    holding.valuationStart,
    holding.valuationEnd,
    holding.holdingAtValuationStart,
    holding.holdingAtValuationEnd,
  ].some(present);
  if (!hasImportedDetails)
    return (
      <div className="holding-details holding-details-empty">
        Für diese manuell erfasste Position liegen keine zusätzlichen
        Importdetails vor.
      </div>
    );
  const price = (value?: number) =>
    present(value)
      ? `${depotDecimal.format(value || 0)}${holding.currency ? ` ${holding.currency}` : ""}`
      : "";
  const country = holding.rawCountry
    ? `${depotCountryName(holding.rawCountry)} (${holding.rawCountry})`
    : "";
  const productType = [
    holding.securityType,
    holding.sourceType,
    holding.investmentMedium,
    holding.segment,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const isBond = /(anleihe|rente|bond|schuldverschreibung|festverzins)/.test(
    productType,
  );
  const isEquity = /(aktie|equity)/.test(productType) && !isBond;
  return (
    <div className="holding-details">
      <DepotDetailGroup
        title="Allgemein"
        entries={[
          { label: "WKN", value: holding.wkn, present: present(holding.wkn) },
          { label: "Anlagesegment", value: holding.segment, present: present(holding.segment) },
          { label: "Anlagemedium", value: holding.investmentMedium, present: present(holding.investmentMedium) },
          { label: "Wertpapiertyp", value: holding.securityType || holding.sourceType, present: present(holding.securityType || holding.sourceType) },
          { label: "Produkt- oder Domizilland", value: country, present: present(country) },
          { label: "Währung", value: holding.currency, present: present(holding.currency) },
          { label: "Branche", value: holding.industry, present: present(holding.industry) },
          { label: "Zertifikateklasse", value: holding.certificateClass, present: present(holding.certificateClass) },
        ]}
      />
      <DepotDetailGroup
        title="Kauf und Kurs"
        entries={[
          { label: "Letztes Kaufdatum", value: formatDepotDate(holding.lastPurchaseDate), present: present(holding.lastPurchaseDate) },
          { label: "Durchschnittlicher Einstandskurs", value: price(holding.averageEntryPrice), present: present(holding.averageEntryPrice) },
          { label: "Kaufkosten", value: present(holding.purchaseCosts) ? euro.format(holding.purchaseCosts || 0) : "", present: present(holding.purchaseCosts) },
          { label: "Aktueller Kurs", value: price(holding.currentPrice), present: present(holding.currentPrice) },
          { label: "Einstandsdevisenkurs", value: present(holding.averageEntryFx) ? depotDecimal.format(holding.averageEntryFx || 0) : "", present: present(holding.averageEntryFx) },
          { label: "Devisenkurs", value: present(holding.fxRate) ? depotDecimal.format(holding.fxRate || 0) : "", present: present(holding.fxRate) },
        ]}
      />
      {isEquity && (
        <DepotDetailGroup
          title="Bestand"
          entries={[
            { label: "Stück", value: present(holding.nominalOrUnits) ? depotDecimal.format(holding.nominalOrUnits || 0) : "", present: present(holding.nominalOrUnits) },
          ]}
        />
      )}
      {isBond && (
        <DepotDetailGroup
          title="Rentenposition"
          entries={[
            { label: "Nominal", value: present(holding.nominalOrUnits) ? depotDecimal.format(holding.nominalOrUnits || 0) : "", present: present(holding.nominalOrUnits) },
            { label: "Zinssatz", value: present(holding.coupon) ? `${depotDecimal.format(holding.coupon || 0)} %` : "", present: present(holding.coupon) },
            { label: "Endfälligkeit", value: formatDepotDate(holding.maturity), present: present(holding.maturity) },
            { label: "Stückzinsen", value: present(holding.accruedInterest) ? euro.format(holding.accruedInterest || 0) : "", present: present(holding.accruedInterest) },
          ]}
        />
      )}
      <DepotDetailGroup
        title="Ergebnis"
        entries={[
          { label: "Kursgewinn / -verlust in EUR", value: present(holding.gainLossAmount) ? euro.format(holding.gainLossAmount || 0) : "", present: present(holding.gainLossAmount) },
          { label: "Kursgewinn / -verlust in %", value: present(holding.gainLossPercent) ? `${depotDecimal.format(holding.gainLossPercent || 0)} %` : "", present: present(holding.gainLossPercent) },
        ]}
      />
      <DepotDetailGroup
        title="Quelldaten zur Bewertung"
        entries={[
          { label: "Bewertungsanfang", value: formatDepotDate(holding.valuationStart), present: present(holding.valuationStart) },
          { label: "Bewertungsende", value: formatDepotDate(holding.valuationEnd), present: present(holding.valuationEnd) },
          { label: "Bestand am Bewertungsanfang", value: present(holding.holdingAtValuationStart) ? euro.format(holding.holdingAtValuationStart || 0) : "", present: present(holding.holdingAtValuationStart) },
          { label: "Bestand am Bewertungsende", value: present(holding.holdingAtValuationEnd) ? euro.format(holding.holdingAtValuationEnd || 0) : "", present: present(holding.holdingAtValuationEnd) },
          { label: "Depotanteil laut Import", value: present(holding.sourceDepotShare) ? `${depotDecimal.format(holding.sourceDepotShare || 0)} %` : "", present: present(holding.sourceDepotShare) },
        ]}
      />
    </div>
  );
}

function DepotOptimizer({
  item,
  setItem,
  plan,
  saveCase,
  setView,
}: {
  item: AdvisoryCase;
  setItem: (item: AdvisoryCase) => void;
  plan: StructurePlan;
  saveCase: (version?: boolean) => void;
  setView: (view: View) => void;
}) {
  const [section, setSection] = useState<"positions" | "house">("positions");
  const [expandedHoldingId, setExpandedHoldingId] = useState<string | null>(null);
  const depot = item.depot;
  const total = depot.reduce((sum, entry) => sum + entry.value, 0);
  const afterSales = depot.reduce(
    (sum, entry) => sum + Math.max(0, entry.value - entry.plannedSale),
    0,
  );
  const buys = plan.allocations.reduce((sum, entry) => sum + entry.amount, 0);
  const planTotal = depotPlanAssetAmounts(depot, plan).total;
  const setDepotPositions = (next: DepotHolding[]) =>
    setItem({
      ...item,
      advisory: {
        ...item.advisory,
        depotValue: next.reduce((sum, entry) => sum + entry.value, 0),
        hasDepot: next.length > 0 || item.advisory.hasDepot,
      },
      depot: next,
    });
  const csvImport = useDepotCsvImport(depot, setDepotPositions);
  const addHolding = () =>
    setDepotPositions([
      ...depot,
      {
        id: uid("holding"),
        name: "",
        value: 0,
        assetClass: "Geldwerte",
        region: "Nicht zugeordnet",
        risk: 2,
        plannedSale: 0,
        note: "",
      },
    ]);
  const updateHolding = (id: string, changes: Partial<DepotHolding>) =>
    setDepotPositions(
      depot.map((entry) =>
        entry.id === id ? { ...entry, ...changes } : entry,
      ),
    );
  const loadSample = () => {
    const value = item.advisory.depotValue || 420000;
    setDepotPositions([
      {
        id: uid("holding"),
        name: "Globaler Aktienfonds",
        value: Math.round(value * 0.46),
        assetClass: "Substanzwerte",
        region: "Weltweit",
        risk: 3,
        plannedSale: 0,
        note: "",
      },
      {
        id: uid("holding"),
        name: "Technologie-Aktienfonds",
        value: Math.round(value * 0.24),
        assetClass: "Substanzwerte",
        region: "USA",
        risk: 4,
        plannedSale: 0,
        note: "",
      },
      {
        id: uid("holding"),
        name: "Unternehmensanleihen",
        value: Math.round(value * 0.2),
        assetClass: "Geldwerte",
        region: "Europa",
        risk: 2,
        plannedSale: 0,
        note: "",
      },
      {
        id: uid("holding"),
        name: "Gold",
        value: Math.round(value * 0.1),
        assetClass: "Alternative Anlagen",
        region: "Weltweit",
        risk: 3,
        plannedSale: 0,
        note: "",
      },
    ]);
  };
  return (
    <div className="tool-view depot-view">
      <div className="tool-head">
        <div>
          <button className="back-link" onClick={() => setView("wizard")}>
            ← Zurück zur Beratung
          </button>
          <p className="eyebrow">BESTANDSDEPOT IM BERATUNGSFALL</p>
          <h1>Depotcheck und Transaktionssimulation</h1>
          <p>
            Bestand und simulierte Transaktionen werden mit dem aktuell aktiven
            Strukturplan {plan.name} verbunden.
          </p>
        </div>
        <div className="tool-head-actions">
          <button className="secondary" onClick={loadSample}>
            Musterdepot
          </button>
          <button className="primary" onClick={() => saveCase(false)}>
            Fall speichern
          </button>
        </div>
      </div>
      {depot.length > 0 && <div className="depot-top depot-top-v3">
        <article>
          <span>Ist-Depot</span>
          <strong>{euro.format(total)}</strong>
          <small>{depot.length} Positionen</small>
        </article>
        <article>
          <span>Plan-Depot</span>
          <strong>{euro.format(planTotal)}</strong>
          <small>Verkäufe und Käufe berücksichtigt</small>
        </article>
        <article>
          <span>Geplante Käufe</span>
          <strong>{euro.format(buys)}</strong>
          <small>aus {plan.name}</small>
        </article>
        <article>
          <span>Simulierte Verkäufe</span>
          <strong>{euro.format(total - afterSales)}</strong>
          <small>begrenzt auf den aktuellen Positionswert</small>
        </article>
      </div>}
      {depot.length > 0 && (
        <div className="depot-section-tabs" role="tablist" aria-label="Depotcheck-Bereiche">
          <button className={section === "positions" ? "active" : ""} onClick={() => setSection("positions")} role="tab" aria-selected={section === "positions"}>
            Bestand &amp; Transaktionen
          </button>
          <button className={section === "house" ? "active" : ""} onClick={() => setSection("house")} role="tab" aria-selected={section === "house"}>
            Vermögenshaus
          </button>
        </div>
      )}
      {(depot.length === 0 || section === "positions") && <section className="depot-entry panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">IST-BESTAND</p>
            <h2>Positionen erfassen oder importieren</h2>
          </div>
          <div>
            <button
              className="secondary"
              onClick={csvImport.open}
            >
              CSV importieren
            </button>
            <button className="secondary" onClick={addHolding}>
              ＋ Position
            </button>
          </div>
        </div>
        {csvImport.input}
        {csvImport.preview}
        {depot.length === 0 ? (
          <div className="depot-empty-state">
            <span>◫</span>
            <h3>Noch kein Depot importiert</h3>
            <p>
              Importieren Sie eine Navigator-CSV oder eine exportierte
              Strukturübersicht. Erst danach werden Bestand und Vermögenshaus
              dargestellt.
            </p>
            <div>
              <button className="primary" onClick={csvImport.open}>Depot-CSV importieren</button>
              <button className="secondary" onClick={loadSample}>Musterdepot laden</button>
            </div>
          </div>
        ) : (
          <div className="holding-list">
            <div className="holding-head holding-head-v2">
              <span>Position</span>
              <span>Aktueller Wert</span>
              <span>Depotanteil</span>
              <span>Anlageklasse</span>
              <span>Region</span>
              <span>Geplanter Verkauf</span>
              <span></span>
            </div>
            {depot.map((holding) => (
              <div className="holding-card" key={holding.id}>
              <div className="holding-row holding-row-v2">
                <div className="holding-name-field">
                  <input
                    value={holding.name}
                    onChange={(event) =>
                      updateHolding(holding.id, { name: event.target.value })
                    }
                  />
                  {(holding.wkn || holding.securityType || holding.sourceType) && (
                    <small>
                      {[holding.wkn ? `WKN ${holding.wkn}` : "", holding.securityType || holding.sourceType]
                        .filter(Boolean)
                        .join(" · ")}
                    </small>
                  )}
                  {holding.classificationStatus === "unresolved" && <small className="classification-open">Durchschau ungeklärt</small>}
                </div>
                <div className="inline-amount">
                  <input
                    inputMode="numeric"
                    value={
                      holding.value ? holding.value.toLocaleString("de-DE") : ""
                    }
                    onChange={(event) =>
                      updateHolding(holding.id, {
                        value: parseAmount(event.target.value),
                      })
                    }
                  />
                  <b>€</b>
                </div>
                <strong className="holding-share">
                  {total ? `${percent.format((holding.value / total) * 100)} %` : "–"}
                </strong>
                <select
                  value={holding.assetClass}
                  onChange={(event) =>
                    updateHolding(holding.id, {
                      assetClass: event.target.value as AssetClass,
                      classificationStatus: "mapped",
                    })
                  }
                >
                  {assetClasses.map((name) => (
                    <option key={name}>{name}</option>
                  ))}
                </select>
                <select
                  value={holding.region}
                  onChange={(event) =>
                    updateHolding(holding.id, { region: event.target.value })
                  }
                >
                  <option>Weltweit</option>
                  <option>Europa</option>
                  <option>USA</option>
                  <option>Deutschland</option>
                  <option>Asien</option>
                  <option>Schweiz</option>
                  <option>Sonstige</option>
                  <option>Nicht zugeordnet</option>
                </select>
                <div className="inline-amount sale">
                  <input
                    inputMode="numeric"
                    value={
                      holding.plannedSale
                        ? holding.plannedSale.toLocaleString("de-DE")
                        : ""
                    }
                    onChange={(event) =>
                      updateHolding(holding.id, {
                        plannedSale: Math.min(
                          holding.value,
                          parseAmount(event.target.value),
                        ),
                      })
                    }
                  />
                  <b>€</b>
                </div>
                <div className="holding-actions">
                  <button className="holding-detail-button" onClick={() => setExpandedHoldingId(expandedHoldingId === holding.id ? null : holding.id)} aria-expanded={expandedHoldingId === holding.id}>
                    {expandedHoldingId === holding.id ? "Weniger" : "Details"}
                  </button>
                  <button className="holding-remove-button" aria-label={`${holding.name || "Position"} entfernen`} onClick={() => setDepotPositions(depot.filter((entry) => entry.id !== holding.id))}>×</button>
                </div>
              </div>
              {expandedHoldingId === holding.id && <DepotHoldingDetails holding={holding} />}
              </div>
            ))}
          </div>
        )}
      </section>}
      {depot.length > 0 && section === "positions" && <section className="panel transaction-plan">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">TRANSAKTIONSPLAN</p>
            <h2>Verkäufe und geplante Käufe</h2>
          </div>
        </div>
        <div className="transaction-columns">
          <div>
            <strong>Verkäufe</strong>
            {depot
              .filter((entry) => entry.plannedSale > 0)
              .map((entry) => (
                <span key={entry.id}>
                  {entry.name}
                  <b>– {euro.format(entry.plannedSale)}</b>
                </span>
              ))}
            {!depot.some((entry) => entry.plannedSale > 0) && (
              <em>keine Verkäufe erfasst</em>
            )}
          </div>
          <div>
            <strong>Käufe aus Strukturplan</strong>
            {plan.allocations
              .filter((entry) => entry.amount > 0)
              .map((entry) => (
                <span key={entry.id}>
                  {entry.productName}
                  <b>+ {euro.format(entry.amount)}</b>
                </span>
              ))}
            {plan.allocations.length === 0 && <em>keine Käufe geplant</em>}
          </div>
        </div>
      </section>}
      {depot.length > 0 && section === "house" && (
        <section className="depot-house-panel panel">
          <WealthHouse plan={plan} plans={[plan]} depot={depot} context="depot" />
        </section>
      )}
      <p className="tool-legal">
        Die Simulation ermittelt ausschließlich rechnerische Auswirkungen. Sie
        berücksichtigt weder Kurse noch Steuern, Spreads, Kosten, Stückelungen,
        Fristen oder regulatorische Eignung.
      </p>
    </div>
  );
}

function ExportCenter({
  item,
  setItem,
  preferredPlan,
  saveCase,
  exportJson,
  importJson,
}: {
  item: AdvisoryCase;
  setItem: Dispatch<SetStateAction<AdvisoryCase>>;
  preferredPlan: StructurePlan;
  saveCase: (version?: boolean) => void;
  exportJson: () => void;
  importJson: () => void;
}) {
  const breakdown = planAssetAmounts(preferredPlan);
  const exportPots = capitalPots(
    item.advisory,
    preferredPlan.total,
    item.createdAt,
  );
  const advisor = advisorFor(item.advisorId);
  const print = (mode: "customer" | "internal") => {
    document.body.dataset.printMode = mode;
    window.setTimeout(() => {
      window.print();
      window.setTimeout(() => delete document.body.dataset.printMode, 300);
    }, 60);
  };
  const exportExcel = () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ["VermögensNavigator – Beratungsfall"],
        ["Fall", item.advisory.caseName],
        ["Bereich", scopeLabel(item.advisory.scope)],
        ["Status", item.status],
        ["Verantwortlich", advisor.name],
        ["Funktion", advisor.title],
        ["Risiko", item.advisory.risk],
        ["Risiko-Orientierung Verlustreaktion", item.advisory.riskAssessment.lossReaction || "offen"],
        ["Risiko-Orientierung Wertminderung", item.advisory.riskAssessment.temporaryLoss || "offen"],
        ["Risiko-Orientierung Tragfähigkeit", item.advisory.riskAssessment.financialCapacity || "offen"],
        ["Ziel", item.advisory.goal],
        ["Erstellt", item.createdAt],
        ["Aktualisiert", item.updatedAt],
        ["Bevorzugter Plan", preferredPlan.name],
        ["Planungsbetrag", preferredPlan.total],
        [
          "Planungsbasis",
          preferredPlan.capitalMode === "linked"
            ? "Erfasste Liquidität"
            : "Abweichender Planungsbetrag",
        ],
        ["Depotmodus", preferredPlan.depotMode],
      ]),
      "Fall",
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(
        item.advisory.needs.map((need) => ({
          Zweck: need.purpose,
          Betrag: need.amount,
          Termin: need.dueDate || "",
          Relative_Angabe: need.dueDate ? "" : `in ca. ${need.years} Jahren`,
          Monate: monthsUntilNeed(need, item.createdAt),
          Zieljahr: exportPots.find((pot) =>
            pot.needs.some((entry) => entry.id === need.id),
          )?.year,
          Laufzeitband: maturityBuckets.find(
            (bucket) =>
              bucket.id ===
              bucketForMonths(monthsUntilNeed(need, item.createdAt)),
          )?.label,
        })),
      ),
      "Kapitalbedarfe",
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(
        exportPots.map((pot) => ({
          Kapitaltopf: pot.label,
          Zeitraum: pot.range,
          Zielbetrag: pot.total,
          Zugeordnet: preferredPlan.allocations.reduce(
            (sum, entry) =>
              sum + allocationAmountInCapitalPot(entry, pot.id),
            0,
          ),
        })),
      ),
      "Kapitaltöpfe",
    );
    for (const plan of item.plans) {
      const planPots = capitalPots(
        item.advisory,
        plan.total,
        item.createdAt,
      );
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(
          plan.allocations.map((entry) => ({
            Produkt: entry.productName,
            Produkt_ID: entry.productId,
            Laufzeitband: maturityBuckets.find(
              (bucket) => bucket.id === entry.bucketId,
            )?.label,
            Topfabdeckung: planPots
              .filter((pot) => allocationAmountInCapitalPot(entry, pot.id) > 0)
              .map(
                (pot) =>
                  `${pot.label}: ${allocationAmountInCapitalPot(entry, pot.id)}`,
              )
              .join(" | ") || entry.capitalPotReviewNote || "nicht zugeordnet",
            Betrag: entry.amount,
            Quelle: entry.source,
            Modell: entry.modelId || "",
          })),
        ),
        safeFileName(plan.name).slice(0, 31) || "Plan",
      );
    }
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(
        item.plans.flatMap((plan) =>
          (plan.investmentPlans || []).map((entry) => ({
            Plan: plan.name,
            Art: entry.type === "savings" ? "Sparplan" : "Gestaffelte Anlage",
            Bezeichnung: entry.name,
            Produkt: entry.productName || "Noch nicht festgelegt",
            Kapitaltopf:
              capitalPots(item.advisory, plan.total, item.createdAt).find(
                (pot) => pot.id === entry.capitalPotId,
              )?.label ||
              maturityBuckets.find((bucket) => bucket.id === entry.bucketId)?.label ||
              "",
            Rate: entry.installmentAmount,
            Anzahl_Raten: entry.installments || "fortlaufend",
            Rhythmus:
              investmentFrequencies.find((frequency) => frequency.value === entry.frequency)
                ?.label || entry.frequency,
            Start: entry.startDate,
            Gesamtbetrag: investmentPlanTotal(entry),
            Hinweis: entry.note,
          })),
        ),
      ),
      "Investitionspläne",
    );
    const structureRows: Array<{
      Anlageklasse: string;
      Betrag: number;
      Anteil: number;
    }> = assetClasses.map((name) => ({
      Anlageklasse: name,
      Betrag: breakdown.amounts[name],
      Anteil: breakdown.total ? breakdown.amounts[name] / breakdown.total : 0,
    }));
    structureRows.push({
      Anlageklasse: "Nicht durchgeschaut",
      Betrag: breakdown.unresolved,
      Anteil: breakdown.total ? breakdown.unresolved / breakdown.total : 0,
    });
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(structureRows),
      "Vermögensstruktur",
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(
        item.depot.map((entry) => ({
          Position: entry.name,
          Wert: entry.value,
          Dynamischer_Depotanteil: item.depot.reduce((sum, holding) => sum + holding.value, 0)
            ? entry.value / item.depot.reduce((sum, holding) => sum + holding.value, 0)
            : 0,
          Anlageklasse: entry.assetClass,
          Region: entry.region,
          Verkauf: entry.plannedSale,
          WKN: entry.wkn || "",
          Anlagesegment: entry.segment || "",
          Anlagemedium: entry.investmentMedium || "",
          Wertpapiertyp: entry.securityType || entry.sourceType || "",
          Landcode: entry.rawCountry || "",
          Währung: entry.currency || "",
          Branche: entry.industry || "",
          Zertifikateklasse: entry.certificateClass || "",
          Zinssatz: entry.coupon ?? "",
          Fälligkeit: entry.maturity || "",
          Stück_Nominal: entry.nominalOrUnits ?? "",
          Letztes_Kaufdatum: entry.lastPurchaseDate || "",
          Durchschnittlicher_Einstandskurs: entry.averageEntryPrice ?? "",
          Kaufkosten: entry.purchaseCosts ?? "",
          Aktueller_Kurs: entry.currentPrice ?? "",
          Kursgewinn_Verlust_Prozent: entry.gainLossPercent ?? "",
          Kursgewinn_Verlust_EUR: entry.gainLossAmount ?? "",
          Stückzinsen: entry.accruedInterest ?? "",
          Depotanteil_laut_Import: entry.sourceDepotShare ?? "",
          Durchschnittlicher_Einstandsdevisenkurs: entry.averageEntryFx ?? "",
          Devisenkurs: entry.fxRate ?? "",
          Bewertungsanfang: entry.valuationStart || "",
          Bewertungsende: entry.valuationEnd || "",
          Bestand_Bewertungsanfang: entry.holdingAtValuationStart ?? "",
          Bestand_Bewertungsende: entry.holdingAtValuationEnd ?? "",
          Zuordnungsstatus: entry.classificationStatus || "",
          Notiz: entry.note,
        })),
      ),
      "Depot",
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(
        managedPortfolios
          .filter((entry) => item.selectedVvIds.includes(entry.id))
          .map((entry) => ({
            Name: entry.name,
            Mindestanlage: entry.minimum,
            RK: entry.risk,
            Währung: entry.currency,
            Region: entry.region,
            Depotstelle: entry.custody,
            Kosten: entry.costs,
          })),
      ),
      "VV-Auswahl",
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(dataSources),
      "Datenstände",
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(
        item.advisory.modules.map((moduleId) => {
          const moduleConfig = modules.find((entry) => entry.id === moduleId);
          const state = item.moduleStates[moduleId] || blankModuleState();
          return {
            Fachmodul: moduleConfig?.title || moduleId,
            Status:
              state.status === "complete"
                ? "Vollständig"
                : state.status === "in_progress"
                  ? "In Bearbeitung"
                  : "Nicht begonnen",
            Bearbeitete_Prüfpunkte: Object.values(state.checklist).filter(Boolean)
              .length,
            Prüfpunkte_gesamt: Object.keys(state.checklist).length,
            Notizen: state.notes,
            Aktualisiert: state.updatedAt,
          };
        }),
      ),
      "Fachmodule",
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(
        item.customerChecklist.map((entry) => ({
          Status: entry.done ? "Erledigt" : "Offen",
          Kategorie: entry.category,
          Nächster_Schritt: entry.text,
          Quelle:
            entry.source === "module"
              ? modules.find((module) => module.id === entry.moduleId)?.title ||
                "Fachmodul"
              : "Allgemein",
          Erfasst_am: entry.createdAt,
        })),
      ),
      "Kunden-Checkliste",
    );
    XLSX.writeFile(workbook, `${safeFileName(item.advisory.caseName)}.xlsx`);
  };
  const restoreVersion = (versionId: string) => {
    const version = item.versions.find((entry) => entry.id === versionId);
    if (!version) return;
    if (
      !window.confirm(
        `${version.label} als aktuellen Arbeitsstand wiederherstellen?`,
      )
    )
      return;
    const restored = normalizeImportedCase(version.snapshot, false);
    if (!restored) return;
    setItem({
      ...restored,
      versions: item.versions,
      updatedAt: new Date().toISOString(),
    });
  };
  return (
    <div className="tool-view export-view">
      <div className="tool-head no-print">
        <div>
          <p className="eyebrow">ERGEBNIS UND DOKUMENTATION</p>
          <h1>Speichern, versionieren und exportieren</h1>
          <p>
            Alle Ausgaben werden aus demselben Beratungsfall und derselben
            bevorzugten Strukturplanung erzeugt.
          </p>
        </div>
        <div className="tool-head-actions">
          <label className="status-field">
            <span>Bearbeitungsstand</span>
            <select
              value={item.status}
              onChange={(event) =>
                setItem({
                  ...item,
                  status: event.target.value as AdvisoryCase["status"],
                })
              }
            >
              <option>Entwurf</option>
              <option>In Prüfung</option>
              <option>Abgeschlossen</option>
            </select>
          </label>
          <button className="primary" onClick={() => saveCase(true)}>
            Version speichern
          </button>
        </div>
      </div>
      <div className="export-actions no-print">
        <button onClick={() => print("customer")}>
          <span>PDF</span>
          <strong>Kundenübersicht</strong>
          <small>
            Ausgangslage, Ziele, Strukturen, Lösungsbausteine und nächste Schritte
          </small>
        </button>
        <button onClick={() => print("internal")}>
          <span>PDF+</span>
          <strong>Interne Arbeitsunterlage</strong>
          <small>
            zusätzlich Datenstände, Warnungen, Produkte und Prüfpunkte
          </small>
        </button>
        <button onClick={exportExcel}>
          <span>XLSX</span>
          <strong>Excel-Arbeitsmappe</strong>
          <small>
            separate Blätter für Bedarfe, Pläne, Anlageklassen, Depot und VV
          </small>
        </button>
        <button onClick={exportJson}>
          <span>JSON</span>
          <strong>Vollständige Sicherung</strong>
          <small>kann anschließend wieder importiert werden</small>
        </button>
        <button onClick={importJson}>
          <span>↥</span>
          <strong>JSON importieren</strong>
          <small>legt einen eigenständigen neuen Testfall an</small>
        </button>
      </div>
      <CustomerChecklistEditor
        item={item}
        setItem={setItem}
        title="Kunden-Checkliste für den Abschluss"
      />
      {item.versions.length > 0 && (
        <section className="panel version-history no-print">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">VERSIONEN</p>
              <h2>Unveränderliche Zwischenstände</h2>
            </div>
            <span>{item.versions.length} gespeichert</span>
          </div>
          <div>
            {[...item.versions].reverse().map((version) => (
              <article key={version.id}>
                <div>
                  <strong>{version.label}</strong>
                  <small>
                    {version.snapshot.plans.length} Planungen · bevorzugt:{" "}
                    {version.snapshot.plans.find((plan) => plan.preferred)
                      ?.name || "–"}
                  </small>
                </div>
                <button
                  className="secondary"
                  onClick={() => restoreVersion(version.id)}
                >
                  Wiederherstellen
                </button>
              </article>
            ))}
          </div>
        </section>
      )}
      <article className="print-document">
        <header>
          <div>
            <span className="brand-placeholder" aria-label="Logoplatzhalter">
              Logo
            </span>
            <div>
              <strong>VermögensNavigator</strong>
              <small>
                Strukturübersicht ·{" "}
                {new Intl.DateTimeFormat("de-DE").format(new Date())}
              </small>
            </div>
          </div>
          <em>{item.status}</em>
        </header>
        <section className="print-title">
          <p className="eyebrow">BERATUNGSFALL</p>
          <h1>{item.advisory.caseName || "Unbenannter Testfall"}</h1>
          <p>
            {scopeLabel(item.advisory.scope)} · Ziel: {item.advisory.goal} ·
            Risikostufe {item.advisory.risk}/5
          </p>
          <p className="print-advisor">
            Verantwortlich: {advisor.name}, {advisor.title}
          </p>
        </section>
        <div className="print-metrics">
          <div>
            <span>Liquidität</span>
            <strong>{euro.format(item.advisory.liquidAssets)}</strong>
          </div>
          <div>
            <span>Reserve</span>
            <strong>{euro.format(item.advisory.reserve)}</strong>
          </div>
          <div>
            <span>Depot</span>
            <strong>{euro.format(item.advisory.depotValue)}</strong>
          </div>
          <div>
            <span>Plan</span>
            <strong>{preferredPlan.name}</strong>
          </div>
        </div>
        <section className="print-overview">
          <h2>Ziele und Gesprächsrahmen</h2>
          <div>
            <p>
              <span>Hauptziel</span>
              <strong>{item.advisory.goal}</strong>
            </p>
            <p>
              <span>Anlagehorizont</span>
              <strong>{item.advisory.horizon} Jahre</strong>
            </p>
            <p>
              <span>Kenntnisse</span>
              <strong>{item.advisory.experience}</strong>
            </p>
            <p>
              <span>Prioritäten</span>
              <strong>
                {item.advisory.priorities.join(", ") || "Nicht festgehalten"}
              </strong>
            </p>
          </div>
        </section>
        <section className="print-risk-orientation">
          <h2>Risiko-Orientierung</h2>
          <div className="print-overview">
            <div>
              <p>
                <span>Strategische Einordnung</span>
                <strong>{item.advisory.risk}/5 · {riskText[item.advisory.risk].title}</strong>
              </p>
              <p>
                <span>Klickstrecke</span>
                <strong>
                  {riskOrientation(item.advisory)
                    ? "vollständig durchgeführt"
                    : "nicht vollständig durchgeführt"}
                </strong>
              </p>
            </div>
          </div>
        </section>
        {item.advisory.needs.length > 0 && (
          <section>
            <h2>Konkrete Kapitalbedarfe</h2>
            <div className="print-table print-needs">
              <div>
                <strong>Zweck</strong>
                <strong>Termin</strong>
                <strong>Betrag</strong>
              </div>
              {item.advisory.needs.map((need) => (
                <div key={need.id}>
                  <span>{need.purpose || "Nicht bezeichnet"}</span>
                  <span>
                    {need.dueDate
                      ? new Intl.DateTimeFormat("de-DE").format(
                          new Date(`${need.dueDate}T12:00:00`),
                        )
                      : `in ${need.years} Jahren`}
                  </span>
                  <b>{euro.format(need.amount)}</b>
                </div>
              ))}
            </div>
          </section>
        )}
        <section>
          <h2>Kapitalbedarfe und Zeitstruktur</h2>
          <div className="print-table">
            <div>
              <strong>Kapitaltopf</strong>
              <strong>Zeitraum</strong>
              <strong>Betrag</strong>
            </div>
            {exportPots.map((pot) => (
              <div key={pot.id}>
                <span>{pot.label}</span>
                <span>{pot.range}</span>
                <b>{euro.format(pot.total)}</b>
              </div>
            ))}
          </div>
        </section>
        <section>
          <h2>Vermögensstruktur der bevorzugten Planung</h2>
          <div className="print-house-pillars">
            {assetClasses.map((name) => (
              <article key={name}>
                <span>{name}</span>
                <strong>
                  {percent.format(
                    breakdown.total
                      ? (breakdown.amounts[name] / breakdown.total) * 100
                      : 0,
                  )} %
                </strong>
                <b>{euro.format(breakdown.amounts[name])}</b>
              </article>
            ))}
          </div>
          <div className="print-table">
            <div>
              <strong>Anlageklasse</strong>
              <strong>Betrag</strong>
              <strong>Anteil</strong>
            </div>
            {assetClasses.map((name) => (
              <div key={name}>
                <span>{name}</span>
                <span>{euro.format(breakdown.amounts[name])}</span>
                <b>
                  {percent.format(
                    breakdown.total
                      ? (breakdown.amounts[name] / breakdown.total) * 100
                      : 0,
                  )}{" "}
                  %
                </b>
              </div>
            ))}
            <div>
              <span>Nicht durchgeschaut</span>
              <span>{euro.format(breakdown.unresolved)}</span>
              <b>
                {percent.format(
                  breakdown.total
                    ? (breakdown.unresolved / breakdown.total) * 100
                    : 0,
                )}{" "}
                %
              </b>
            </div>
          </div>
        </section>
        {(preferredPlan.investmentPlans || []).length > 0 && (
          <section>
            <h2>Spar- und Investitionspläne</h2>
            <div className="print-table product-print">
              <div>
                <strong>Umsetzungsweg</strong>
                <strong>Rhythmus und Start</strong>
                <strong>Rate / Gesamt</strong>
              </div>
              {preferredPlan.investmentPlans.map((entry) => (
                <div key={entry.id}>
                  <span>
                    {entry.name}
                    {entry.productName ? ` · ${entry.productName}` : ""}
                  </span>
                  <span>
                    {investmentFrequencies.find(
                      (frequency) => frequency.value === entry.frequency,
                    )?.label || entry.frequency}
                    {entry.startDate ? ` ab ${entry.startDate}` : ""}
                  </span>
                  <b>
                    {euro.format(entry.installmentAmount)} / {entry.installments > 0
                      ? euro.format(investmentPlanTotal(entry))
                      : "fortlaufend"}
                  </b>
                </div>
              ))}
            </div>
          </section>
        )}
        <section>
          <h2>Lösungsbausteine der bevorzugten Planung</h2>
          <div className="print-table product-print">
            <div>
              <strong>Produkt</strong>
              <strong>Kapitaltopf</strong>
              <strong>Betrag</strong>
            </div>
            {preferredPlan.allocations.map((entry) => (
              <div key={entry.id}>
                <span>{entry.productName}</span>
                <span>
                  {exportPots
                    .filter(
                      (pot) => allocationAmountInCapitalPot(entry, pot.id) > 0,
                    )
                    .map((pot) => pot.label)
                    .join(" / ") || entry.capitalPotReviewNote || "nicht zugeordnet"}
                </span>
                <b>{euro.format(entry.amount)}</b>
              </div>
            ))}
          </div>
        </section>
        {item.advisory.modules.length > 0 && (
          <section>
            <h2>Besprochene Vertiefungen</h2>
            <div className="print-module-list">
              {item.advisory.modules.map((moduleId) => {
                const moduleConfig = modules.find(
                  (entry) => entry.id === moduleId,
                );
                const state =
                  item.moduleStates[moduleId] || blankModuleState();
                return (
                  <span key={moduleId}>
                    <strong>{moduleConfig?.title || moduleId}</strong>
                    <small>{moduleStatusLabel(state.status)}</small>
                  </span>
                );
              })}
            </div>
          </section>
        )}
        <section className="print-customer-checklist">
          <h2>Nächste Schritte für den Kunden</h2>
          {item.customerChecklist.length === 0 ? (
            <p>Es wurden keine offenen nächsten Schritte festgehalten.</p>
          ) : (
            <div>
              {item.customerChecklist.map((entry) => (
                <p key={entry.id} className={entry.done ? "done" : ""}>
                  <span aria-hidden="true">{entry.done ? "☑" : "☐"}</span>
                  <span>
                    <strong>{entry.text}</strong>
                    <small>
                      {entry.category}
                      {entry.moduleId
                        ? ` · ${
                            modules.find(
                              (module) => module.id === entry.moduleId,
                            )?.title || "Fachmodul"
                          }`
                        : ""}
                    </small>
                  </span>
                </p>
              ))}
            </div>
          )}
        </section>
        <section className="internal-only">
          <h2>Datenstände</h2>
          <div className="data-state-list">
            {dataSources.map((source) => (
              <span key={source.title}>
                {source.title}
                <b>{source.date}</b>
              </span>
            ))}
          </div>
        </section>
        <section className="internal-only">
          <h2>Fachmodule</h2>
          <div className="print-table">
            <div>
              <strong>Vertiefung</strong>
              <strong>Status</strong>
              <strong>Notiz</strong>
            </div>
            {item.advisory.modules.map((moduleId) => {
              const moduleConfig = modules.find((entry) => entry.id === moduleId);
              const state = item.moduleStates[moduleId] || blankModuleState();
              return (
                <div key={moduleId}>
                  <span>{moduleConfig?.title || moduleId}</span>
                  <span>
                    {state.status === "complete"
                      ? "Vollständig"
                      : state.status === "in_progress"
                        ? "In Bearbeitung"
                        : "Nicht begonnen"}
                  </span>
                  <b>{state.notes || "–"}</b>
                </div>
              );
            })}
          </div>
        </section>
        <footer>
          <p>
            Orientierungs- und Arbeitsunterlage. Keine Anlage-, Rechts- oder
            Steuerberatung. Produktdetails, Eignung, Kosten, Steuern und
            aktuelle Freigaben sind vor einer Umsetzung vollständig zu prüfen.
          </p>
        </footer>
      </article>
    </div>
  );
}
