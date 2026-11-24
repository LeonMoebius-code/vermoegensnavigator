import { useId, useState } from "react";
import { jsonHash } from "../../domain/case/recovery-hash";
import type { ModelCatalog } from "../../domain/retirement/model-catalog";
import { assessPreference, type Preference } from "../../domain/retirement/premium-evidence";
import { productPathKey, selectProductOption, tariffFeature, type Configurations, type PremiumProductPath, type ProductConfiguration } from "./premium-product-configuration";

type Change = (key: string, next: ProductConfiguration | null) => void;

function Weights({ label, values, positions, locked, change }: { label: string; values: readonly string[]; positions: readonly string[];
  locked: boolean; change: (next: readonly string[]) => void }) {
  return <fieldset><legend>{label} in Prozent</legend>{positions.map((name, index) =>
    <label key={name}>{name}
      <input aria-label={label + " " + name} inputMode="decimal" value={values[index] ?? ""}
        readOnly={locked} onChange={event => change(values.map((value, i) => i === index ? event.target.value : value))} />
    </label>)}</fieldset>;
}

export function PremiumProductPanel({ paths, catalog, values, change, payoutMonth, setPayoutMonth, showPreference = false }: {
  paths: readonly PremiumProductPath[]; catalog: ModelCatalog; values: Configurations; change: Change;
  payoutMonth: string; setPayoutMonth: (month: string) => void; showPreference?: boolean;
}) {
  const prefix = useId();
  return <section className="panel" aria-label="Gemeinsame Anlagekonfiguration">
    <h2>Gemeinsame Anlagekonfiguration</h2>
    <label>Modellierter Auszahlbeginn
      <input aria-label="Auszahlbeginn der Anlagekonfiguration" type="month" value={payoutMonth} onChange={e => setPayoutMonth(e.target.value)} />
    </label>
    {paths.map(path => {
      const key = productPathKey(path);
      const product = catalog.get(path.product.product, "product configuration");
      const tariff = catalog.get(path.product.tariff, "product configuration");
      const value = values[key];
      const template = value && path.options[value.option]?.profile;
      const positions = template?.positions.map(p => p.fund ? catalog.get(p.fund, "profile fund").data.name : p.id) ?? [];
      const update = (edit: Partial<ProductConfiguration>) => { if (value) change(key, { ...value, ...edit }); };
      const comfort = template?.option === "comfort";
      const title = product.data.name + " · " + tariff.data.name;
      const selectId = prefix + key;
      return <details key={key}><summary>{title}</summary>
        <label htmlFor={selectId}>Modellprofil</label>
        <select id={selectId} value={value ? String(value.option) : ""} onChange={event =>
          change(key, event.target.value === "" ? null : selectProductOption(path, Number(event.target.value)))}>
          <option value="">Offen</option>{path.options.map((option, index) => <option key={option.label} value={index}>{option.label}</option>)}
        </select>
        {value && template && <>
          <p data-testid="premium-profile-revision">Profilrevision {value.version}</p>
          <Weights label="Anfangsbestand" values={value.opening} positions={positions} locked={comfort} change={opening => update({ opening })} />
          <Weights label="Zielgewicht" values={value.target} positions={positions} locked={comfort} change={target => update({ target })} />
          <Weights label="Neue Zuflüsse" values={value.inflows} positions={positions} locked={comfort || template.option === "inflow_proxy"}
            change={inflows => update({ inflows })} />
          {value.changes.map((row, index) => {
            const replace = (edit: Partial<typeof row>) => update({ changes: value.changes.map((old, i) => i === index ? { ...old, ...edit } : old) });
            return <fieldset key={index}><legend>Datierte Änderung {index + 1}</legend>
              <label>Monat<input aria-label={"Monat der Änderung " + (index + 1)} type="month" value={row.month}
                onChange={event => replace({ month: event.target.value })} /></label>
              <label>Aktion<select value={row.action} onChange={event => replace({ action: event.target.value as typeof row.action })}>
                <option value="CASHFLOW_ONLY">Nur neue Zuflüsse</option>
                {template.option !== "inflow_proxy" && <>
                  <option value="HOLDINGS_SWITCH">Bestandsumschichtung am Monatsanfang</option>
                  <option value="END_REBALANCE_ONLY">Rebalancing am Monatsende</option>
                </>}
              </select></label>
              <Weights label={"Gewichte Änderung " + (index + 1)} values={row.weights} positions={positions} locked={template.option === "inflow_proxy"}
                change={weights => replace({ weights })} />
              <button type="button" onClick={() => update({ changes: value.changes.filter((_, i) => i !== index) })}>Änderung entfernen</button>
            </fieldset>;
          })}
          {template.option !== "basis_lifecycle" && template.option !== "inflow_proxy" && <button type="button"
            onClick={() => update({ changes: [...value.changes, { month: "", action: "CASHFLOW_ONLY", weights: value.inflows }] })}>Datierte Modelländerung hinzufügen</button>}
          <label>Aktienverlust im Stressmonat<input aria-label="Aktienverlust im Stressmonat" inputMode="decimal"
            value={value.stressLoss} onChange={event => update({ stressLoss: event.target.value })} /></label>
          <label>Stressmonat<input aria-label="Stressmonat" type="month" value={value.stressMonth}
            onChange={event => update({ stressMonth: event.target.value })} /></label>
        </>}
      </details>;
    })}
    {showPreference && <TariffPreference paths={paths} catalog={catalog} />}
  </section>;
}

function TariffPreference({ catalog, paths }: { catalog: ModelCatalog; paths: readonly PremiumProductPath[] }) {
  const [request, setRequest] = useState({ criterion: "" as "" | "exclude_guarantee" | "minimum_guarantee" | "both_payouts_same_tariff", date: "", confirmed: false });
  const id = useId();
  const basis = request.criterion === "both_payouts_same_tariff" ? "fund_plan_and_life_annuity" : "own_and_grants";
  const preference: Preference | null = request.criterion ? { id, criterion: request.criterion,
    answer: "explicit_requirement", hardness: request.confirmed ? "explicit_hard" : "soft",
    revision: jsonHash(request), stichtag: request.date, requirementBasis: basis,
    requiredScope: request.criterion === "both_payouts_same_tariff" ? "same_tariff" : "contribution_guarantee" } : null;
  return <fieldset><legend>Tarifmerkmal verbindlich prüfen</legend>
    <label>Gewünschte Prüfung<select value={request.criterion} onChange={event =>
      setRequest({ ...request, criterion: event.target.value as typeof request.criterion, confirmed: false })}>
      <option value="">Nur Orientierung</option>
      <option value="exclude_guarantee">Beitragsgarantie ausdrücklich ausschließen</option>
      <option value="minimum_guarantee">Mindestens 80 % Beiträge und Zulagen garantiert</option>
      <option value="both_payouts_same_tariff">Lebenslange Rente und Fondsauszahlplan im selben Tarif</option>
    </select></label>
    {preference && <>
      <label>Stichtag für Tarifmerkmal<input type="date" value={request.date} onChange={event =>
        setRequest({ ...request, date: event.target.value, confirmed: false })} /></label>
      <label><input type="checkbox" checked={request.confirmed} disabled={!request.date}
        onChange={event => setRequest({ ...request, confirmed: event.target.checked })} /> Diese Anforderung ausdrücklich bestätigen</label>
      <ul>{paths.map(path => {
        const tariff = catalog.get(path.product.tariff, "preference tariff");
        const result = assessPreference(preference, { preferenceId: id, preferenceRevision: preference.revision, tariffId: tariff.id,
          productId: path.product.product.id, tariffVersion: tariff.hash, comparisonRevision: preference.revision,
          stichtag: preference.stichtag, requirementBasis: basis, requiredScope: preference.requiredScope,
          feature: tariffFeature(path, catalog, preference), bankChannel: tariff.data.bank.state }, path.product.tariff.hash);
        const label = result.status === "B_MATCH" ? "Belegt erfüllt" : result.status === "B_MISMATCH" ? "Belegt nicht erfüllt"
          : result.status === "O" ? "Tarifmerkmal offen" : "Vergleichsinteresse";
        return <li key={productPathKey(path)}>{tariff.data.name} · {label} · Bankweg {result.bankChannel === "open" ? "offen" : result.bankChannel}</li>;
      })}</ul>
    </>}
  </fieldset>;
}
