import { useEffect, useRef, useState } from "react";
import { AvdError } from "../../domain/retirement/avd-data";
import { readFundingEvidence, type FundingEvidence } from "../../domain/retirement/premium-funding-input";
import { euro } from "./direct-grant-adapter";

export interface BoundFundingEvidence {
  readonly data: FundingEvidence;
  readonly basis: string;
  readonly holdingsBasis?: string;
  readonly opening: string;
}

export function FundingEvidencePanel({ value, isCurrent, bind }: { value: BoundFundingEvidence | null;
  isCurrent: boolean; bind: (data: FundingEvidence | null, source?: BoundFundingEvidence | null) => void }) {
  const [feedback, setFeedback] = useState("");
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; }, []);
  return <details className="retirement-help">
    <summary>Förderbelege und mehrere Verträge</summary>
    <p>Eine fachlich vorbereitete Förderakte wird in dieser Sitzung verarbeitet. Vorhandene Buchungsbelege bleiben mit ihrem Buchungsmonat erhalten. Eine offene Vertragsaufteilung erzeugt keinen Zahlungszufluss.</p>
    <label>Förderakte auswählen
      <input aria-label="Förderakte auswählen" type="file" accept=".json,application/json" onChange={async event => {
        const file = event.target.files?.[0];
        if (!file) return;
        event.target.value = "";
        const request = ++generation.current;
        bind(null, value);
        setFeedback("Förderakte wird geprüft.");
        try {
          if (file.size > 1_000_000) throw new AvdError("input_limit", "förderakte");
          const text = await file.text();
          if (generation.current !== request) return;
          const data = readFundingEvidence(JSON.parse(text), value?.data);
          bind(data, value);
          setFeedback("Förderakte übernommen.");
        } catch (error) {
          if (generation.current !== request) return;
          setFeedback("Förderakte konnte nicht übernommen werden. " + (error instanceof AvdError ? error.code : "Dateiformat prüfen."));
        }
      }} />
    </label>
    {feedback && <p role="status">{feedback}</p>}
    {value && <>
      {!isCurrent && <p>Förderprüfung veraltet. Belegte Buchungen bleiben erhalten. Für einen aktuellen Anspruch den fachlichen Stand erneut einlesen.</p>}
      {isCurrent && <table aria-label="Personenbezogene Förderansprüche">
        <thead><tr><th>Person</th><th>Förderjahr</th><th>Eigenbeiträge</th><th>Persönlicher Anspruch</th><th>Status der Aufteilung</th></tr></thead>
        <tbody>{value.data.people.map(person => <tr key={person.personId + ":" + person.year}>
          <td>{person.personId}</td><td>{person.year}</td><td>{euro(person.ownCents)}</td>
          <td>{person.totalCents === null ? "Offen" : euro(person.totalCents) + (person.status === "B" ? " · belegt" : " · bedingt")}</td>
          <td>{person.issues.length ? "Offen" : "Geprüft"}</td>
        </tr>)}</tbody>
      </table>}
      <table aria-label="Belegte Förderbuchungen">
        <thead><tr><th>Vertrag</th><th>Buchungsmonat</th><th>Belegbetrag</th></tr></thead>
        <tbody>{value.data.register.booked.map(row => <tr key={row.id}><td>{row.contractId ?? "Zuordnung offen"}</td><td>{row.month}</td><td>{euro(row.cents)}</td></tr>)}</tbody>
      </table>
    </>}
  </details>;
}
