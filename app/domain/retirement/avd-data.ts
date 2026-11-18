/**
 * P2 accepts bounded passive JSON data. Reflection is not a sandbox for
 * executable Proxies. Copy before hashing or retaining external data.
 */
export class AvdError extends Error {
  constructor(readonly code: string, readonly at: string) {
    super(code + ": " + at);
    this.name = "AvdError";
  }
}

export function requireAvd(condition: unknown, code: string, at: string): asserts condition {
  if (!condition) throw new AvdError(code, at);
}

function validString(value: string, at: string) {
  requireAvd(value.length <= 8192 && !/[\uD800-\uDFFF]/u.test(value), "invalid_text", at);
}

export function copyAvd(input: unknown): unknown {
  let nodes = 0;
  let units = 0;
  const stack = new Set<object>();
  function visit(value: unknown, depth: number, at: string): unknown {
    requireAvd(++nodes <= 180000 && depth <= 40, "input_limit", at);
    if (typeof value === "string") {
      validString(value, at);
      units += value.length;
      requireAvd(units <= 4_000_000, "input_limit", at);
      return value;
    }
    if (value === null || typeof value === "boolean") return value;
    if (typeof value === "number") {
      requireAvd(Number.isFinite(value) && !Object.is(value, -0), "invalid_number", at);
      return value;
    }
    requireAvd(typeof value === "object" && value !== null && !stack.has(value), "invalid_data", at);
    const isArray = Array.isArray(value);
    const prototype = Object.getPrototypeOf(value);
    requireAvd(isArray ? prototype === Array.prototype : prototype === Object.prototype || prototype === null,
      "invalid_data", at);
    const keys = Reflect.ownKeys(value);
    requireAvd(keys.length <= 10001, "input_limit", at);
    if (isArray) {
      const length = Object.getOwnPropertyDescriptor(value, "length")?.value;
      requireAvd(Number.isSafeInteger(length) && length <= 10000 && keys.length === length + 1
        && keys.every((key, i) => i < length ? key === String(i) : key === "length"), "invalid_array", at);
    }
    stack.add(value);
    const entries: [string, unknown][] = [];
    for (const key of keys) {
      if (isArray && key === "length") continue;
      requireAvd(typeof key === "string" && !["__proto__", "prototype", "constructor"].includes(key), "invalid_key", at);
      validString(key, at);
      units += key.length;
      requireAvd(units <= 4_000_000, "input_limit", at);
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      requireAvd(descriptor?.enumerable && "value" in descriptor, "invalid_property", at);
      entries.push([key, visit(descriptor.value, depth + 1, at + "." + key)]);
    }
    stack.delete(value);
    return Object.freeze(isArray ? entries.map(([, item]) => item) : Object.fromEntries(entries));
  }
  return visit(input, 0, "$");
}

export type Rule<T> = (input: unknown, at: string) => T;
type Rules = Record<string, Rule<unknown>>;
export function shape<S extends Rules>(fields: S): Rule<{ readonly [K in keyof S]: ReturnType<S[K]> }> {
  return (input, at) => {
    requireAvd(input !== null && typeof input === "object" && !Array.isArray(input), "invalid_shape", at);
    const object = input as Record<string, unknown>;
    const keys = Object.keys(fields);
    requireAvd(Object.keys(object).length === keys.length && keys.every(key => Object.hasOwn(object, key)),
      "unknown_or_missing_field", at);
    for (const key of keys) fields[key](object[key], at + "." + key);
    return object as { readonly [K in keyof S]: ReturnType<S[K]> };
  };
}
export function oneOf<const T extends string>(...values: T[]): Rule<T> {
  return (input, at) => {
    requireAvd(typeof input === "string" && values.includes(input as T), "unknown_value", at);
    return input as T;
  };
}
export function list<T>(rule: Rule<T>, max: number, min = 0): Rule<readonly T[]> {
  return (input, at) => {
    requireAvd(Array.isArray(input) && input.length <= max && input.length >= min, "invalid_list", at);
    input.forEach((item, index) => rule(item, at + "." + index));
    return input;
  };
}
export function nullable<T>(rule: Rule<T>): Rule<T | null> {
  return (input, at) => input === null ? null : rule(input, at);
}
export function integer(min: number, max: number): Rule<number> {
  return (input, at) => {
    requireAvd(typeof input === "number" && Number.isSafeInteger(input) && input >= min && input <= max,
      "invalid_integer", at);
    return input;
  };
}
function pattern(regex: RegExp, code: string): Rule<string> {
  return (input, at) => {
    requireAvd(typeof input === "string" && regex.test(input), code, at);
    return input;
  };
}
export const id = pattern(/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,119}$/, "invalid_id");
export const digest = pattern(/^[a-f0-9]{64}$/, "invalid_hash");
export const description: Rule<string> = (input, at) => {
  requireAvd(typeof input === "string" && input.trim().length > 0 && input.length <= 1000, "invalid_text", at);
  return input;
};
export const revision = integer(1, Number.MAX_SAFE_INTEGER);
export const amountCents = integer(0, Number.MAX_SAFE_INTEGER);
export const day: Rule<string> = (input, at) => {
  const text = pattern(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/, "invalid_date")(input, at);
  const date = new Date(text + "T00:00:00.000Z");
  requireAvd(text >= "0100-01-01" && Number.isFinite(+date)
    && date.toISOString().slice(0, 10) === text, "invalid_date", at);
  return text;
};
export const stamp: Rule<string> = (input, at) => {
  const text = pattern(/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$/, "invalid_time")(input, at);
  day(text.slice(0, 10), at);
  const date = new Date(text);
  requireAvd(Number.isFinite(+date) && date.toISOString() === text, "invalid_time", at);
  return text;
};

export function unique<T>(values: readonly T[], at: string): void {
  requireAvd(new Set(values).size === values.length, "duplicate_identity", at);
}

export const kind = oneOf("source", "product", "tariff", "fund", "portfolio", "parameter", "cost");
export function avdRef<const K extends string>(type: K) {
  return shape({ kind: oneOf(type), id, revision, hash: digest });
}
