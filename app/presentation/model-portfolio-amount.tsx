import { useState } from "react";
import type { ModelPortfolio } from "../domain/catalog/contracts";
import { modelPortfolioMinimumInvestments } from "../domain/planning/model-portfolio-operations";
import { AmountInput, parseAmountDraft } from "./amount-input";

const euro = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export function ModelPortfolioMinimumNotice({ model, amount }: { model: ModelPortfolio; amount: number }) {
  return <div aria-live="polite" aria-atomic="true">
    {modelPortfolioMinimumInvestments(model, amount).map((entry) => <div key={entry.productId}>
      <p>{entry.name}: {entry.weight} % von {euro.format(amount)} = {euro.format(entry.amount)} Einzelanlage.
        Mindestanlage: {euro.format(entry.minimum)}.</p>
      {entry.shortfall > 0
        ? <p className="vv-minimum-warning" role="status">Mindestanlage unterschritten: Es fehlen {euro.format(entry.shortfall)}.
          Die Umsetzung ist eingeschränkt; bitte fachlich prüfen, ob beispielsweise eine Aufstockung zulässig ist.
          Die Modellanwendung bleibt möglich.</p>
        : <p>Mindestanlage erfüllt.</p>}
    </div>)}
  </div>;
}

/** Preview valid typing immediately; commit remains the established blur/Enter contract. */
export function ModelPortfolioAmount({ model, amount, identity, onChange }: {
  model: ModelPortfolio; amount: number; identity: string; onChange: (amount: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const parsed = draft === null ? { status: "valid" as const, value: amount } : parseAmountDraft(draft);
  return <>
    <label className="field amount-field" onInputCapture={(event) => {
      if (event.target instanceof HTMLInputElement) setDraft(event.target.value);
    }} onBlurCapture={() => setDraft(null)}>
      <span>Betroffener Betrag</span>
      <div><AmountInput identity={identity} value={amount} placeholder="0" onValueChange={onChange} /><b>€</b></div>
    </label>
    {parsed.status === "valid" && <ModelPortfolioMinimumNotice model={model} amount={parsed.value} />}
  </>;
}
