import { useId, useState, type InputHTMLAttributes } from "react";

// Below 2^46 EUR every cent remains distinguishable in the existing number model.
// The integer-cent intermediate also stays below Number.MAX_SAFE_INTEGER.
export const MAX_AMOUNT_CENTS = BigInt(2 ** 46) * 100n - 1n;
export type AmountDraftResult =
  | { status: "valid"; value: number }
  | { status: "incomplete"; empty: boolean }
  | { status: "invalid"; message: string };

const formatError = "Bitte einen nichtnegativen deutschen Betrag mit höchstens zwei Nachkommastellen eingeben, z. B. 1.000,50.";
const integerPattern = /^(?:\d+|\d{1,3}(?:\.\d{3})+)$/;

export function parseAmountDraft(raw: string): AmountDraftResult {
  let text = raw.trim();
  if (!text) return { status: "incomplete", empty: true };
  // Only a single trailing currency marker is allowed; never strip arbitrary text.
  if (text.endsWith("€")) text = text.slice(0, -1).trimEnd();
  if (text.endsWith(",") && integerPattern.test(text.slice(0, -1)))
    return { status: "incomplete", empty: false };
  const parts = text.split(",");
  if (parts.length > 2 || !integerPattern.test(parts[0]) ||
      (parts.length === 2 && !/^\d{1,2}$/.test(parts[1])))
    return { status: "invalid", message: formatError };
  const euros = parts[0].replace(/\./g, "");
  const fraction = (parts[1] ?? "").padEnd(2, "0");
  const cents = BigInt(euros) * 100n + BigInt(fraction);
  if (cents > MAX_AMOUNT_CENTS)
    return { status: "invalid", message: "Der Betrag ist für eine sichere Centverarbeitung zu groß." };
  return { status: "valid", value: Number(cents) / 100 };
}

export function formatAmountInput(value: number): string {
  if (!value) return "";
  // Keep any pre-existing precision, including imported computed values. Formatting
  // must not round the stored value merely because the field is opened again.
  return value.toLocaleString("de-DE", { maximumFractionDigits: 20 });
}

type AmountInputProps = Omit<InputHTMLAttributes<HTMLInputElement>,
  "value" | "defaultValue" | "onChange" | "onBlur" | "onKeyDown" | "type" | "inputMode"> & {
  identity: string | number;
  value: number;
  onValueChange: (value: number) => void;
};

export function AmountInput({ identity, ...props }: AmountInputProps) {
  // Reset drafts synchronously even if two different objects have equal values.
  return <AmountInputEditor key={identity} {...props} />;
}

function AmountInputEditor({ value, onValueChange, readOnly, disabled,
  "aria-describedby": describedBy, ...props }: Omit<AmountInputProps, "identity">) {
  const errorId = useId();
  const [edit, setEdit] = useState({ value, readOnly, disabled, draft: null as string | null, error: "" });
  if (!Object.is(edit.value, value) || edit.readOnly !== readOnly || edit.disabled !== disabled) {
    setEdit({ value, readOnly, disabled, draft: null, error: "" });
  }
  const finish = () => {
    if (readOnly || disabled || edit.draft === null) return;
    const parsed = parseAmountDraft(edit.draft);
    if (parsed.status === "valid" || (parsed.status === "incomplete" && parsed.empty)) {
      setEdit({ ...edit, draft: null, error: "" });
      onValueChange(parsed.status === "valid" ? parsed.value : 0);
    } else {
      setEdit({ ...edit, error: parsed.status === "invalid" ? parsed.message :
        "Bitte den Betrag nach dem Komma vervollständigen. Der bisherige Wert bleibt erhalten." });
    }
  };
  return <>
    <input {...props} type="text" inputMode="decimal" readOnly={readOnly} disabled={disabled}
      value={edit.draft ?? formatAmountInput(value)}
      aria-invalid={Boolean(edit.error)}
      aria-describedby={[describedBy, edit.error ? errorId : undefined].filter(Boolean).join(" ") || undefined}
      onChange={(event) => {
        if (!readOnly && !disabled) setEdit({ ...edit, draft: event.target.value, error: "" });
      }}
      onBlur={finish}
      onKeyDown={(event) => {
        if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); }
        if (event.key === "Escape") setEdit({ ...edit, draft: null, error: "" });
      }}
    />
    {edit.error && <small id={errorId} className="amount-input-error" role="alert">{edit.error} Der bisherige Wert wurde nicht geändert.</small>}
  </>;
}
