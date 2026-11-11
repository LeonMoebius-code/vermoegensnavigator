import { test, expect } from "@playwright/test";
import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { emptyCustomerPlan, customerGrant, type CustomerPlan } from "../../app/presentation/retirement/customer-plan-adapter";

type Node = { type?: unknown; props?: Record<string, unknown> };
let directory: string, component: (props: { plan: CustomerPlan; change: (p: CustomerPlan) => void; back: () => void }) => Node;
test.beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "ux1-evidence-"));
  const output = join(directory, "component.mjs");
  await build({ stdin: { contents: `export { RetirementCustomer } from ${JSON.stringify(resolve("app/presentation/retirement/retirement-customer.tsx"))};`, resolveDir: process.cwd(), loader: "tsx" },
    bundle: true, platform: "node", format: "esm", jsx: "automatic", outfile: output,
    plugins: [{ name: "synthetic-hooks", setup(b) {
      b.onResolve({ filter: /^react(?:\/jsx-runtime)?$/ }, a => ({ path: a.path, namespace: "hooks" }));
      b.onLoad({ filter: /.*/, namespace: "hooks" }, a => ({ loader: "js", contents: a.path === "react"
        ? 'export const useId=()=>"ux1-evidence";export const useRef=()=>({current:null});export const useState=()=>[null,()=>{}];'
        : 'export const Fragment=Symbol("fragment");export const jsx=(type,props)=>({type,props});export const jsxs=jsx;' }));
    } }] });
  component = (await import(pathToFileURL(output).href)).RetirementCustomer;
});
test.afterAll(async () => { if (directory) await rm(directory, { recursive: true, force: true }); });
function fixture() {
  const p = emptyCustomerPlan(); p.funding = "checked"; p.children = "yes";
  p.evidence = { ...p.evidence, entitlement: "direct_confirmed", regime: "new_confirmed", contract: "single_eligible_confirmed", contributionConfirmed: true,
    childrenStatus: "assigned_confirmed", children: [{ id: "synthetic-child", status: "eligible_assigned_confirmed" }] };
  p.capital = { ...p.capital, costConfirmed: true, referenceCostConfirmed: true, grantConfirmed: true };
  expect(customerGrant(p).status).toBe("calculated"); return p;
}
function select(p: CustomerPlan, key: string, value: string): CustomerPlan | null {
  let changed: CustomerPlan | null = null;
  const root = component({ plan: p, change: n => { changed = n; }, back: () => {} });
  function find(v: unknown): Node | null {
    if (Array.isArray(v)) { for (const item of v) { const result = find(item); if (result) return result; } return null; }
    if (!v || typeof v !== "object") return null;
    const n = v as Node; return n.type === "select" && n.props?.id === `ux1-evidence-evidence-${key}` ? n : find(n.props?.children);
  }
  const field = find(root); expect(field).not.toBeNull();
  (field!.props!.onChange as (e: { target: { value: string } }) => void)({ target: { value } });
  return changed;
}
for (const [key, value] of [["entitlement", "unconfirmed"], ["regime", "old"], ["contract", "multiple"]]) test(`UX1 real advisor handler ${key}: revoke dependent personal proof, retain independent hypotheses`, () => {
  const p = fixture(), original = JSON.stringify(p), next = select(p, key, value)!;
  expect(next).not.toBeNull(); expect(next.evidence.contributionConfirmed).toBe(false);
  expect(customerGrant(next).status).not.toBe("calculated"); expect(next.capital).toEqual(p.capital);
  if (key === "entitlement") expect(next.evidence.children).toEqual(p.evidence.children);
  else { expect(next.evidence.childrenStatus).toBe("unconfirmed"); expect(next.evidence.children[0].status).toBe("assignment_unconfirmed"); }
  expect(JSON.stringify(p)).toBe(original);
});
test("UX1 real advisor handler: changing regime back cannot resurrect old contribution or child evidence", () => {
  const old = select(fixture(), "regime", "old")!, back = select(old, "regime", "new_confirmed")!;
  expect(back.evidence.regime).toBe("new_confirmed"); expect(back.evidence.contract).toBe("single_eligible_confirmed");
  expect(back.evidence.contributionConfirmed).toBe(false); expect(back.evidence.childrenStatus).toBe("unconfirmed");
  expect(customerGrant(back).status).toBe("review_required");
});
test("UX1 real advisor handler: unchanged selection preserves evidence without emitting an edit", () => {
  expect(select(fixture(), "regime", "new_confirmed")).toBeNull();
});
