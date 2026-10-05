import type { Scope, ModuleState } from "../domain/advisory/contracts";

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

export const germanDate = (value?: string) =>
  value
    ? new Intl.DateTimeFormat("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(new Date(`${value}T12:00:00`))
    : "";

export const nowLabel = () =>
  new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date());

export const dateLabel = (value?: string) =>
  value
    ? new Intl.DateTimeFormat("de-DE", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "–";

export function scopeLabel(scope: Scope | null) {
  return scope === "private"
    ? "Privatvermögen"
    : scope === "business"
      ? "Betriebsvermögen"
      : scope === "combined"
        ? "Betriebs- und Privatvermögen"
        : "Noch nicht gewählt";
}

export const moduleStatusLabel = (status: ModuleState["status"]) =>
  status === "complete"
    ? "Vollständig"
    : status === "in_progress"
      ? "In Bearbeitung"
      : "Nicht begonnen";
