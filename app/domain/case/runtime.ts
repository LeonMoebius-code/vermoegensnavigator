export const uid = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
export const iso = () => new Date().toISOString();

export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
