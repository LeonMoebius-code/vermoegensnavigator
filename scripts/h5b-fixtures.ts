import { h5aLegacyCase, h5aHealthyCase } from "./h5a-fixtures";
import type { AdvisoryCase } from "../app/case-model";
import type { RecoveryDecision } from "../app/domain/case/recovery-contract";
export function h5bCase(id="h5b-original",partial=false):AdvisoryCase {
  const c=h5aLegacyCase(id,partial);c.schemaVersion=11;c.advisory.caseName="Synthetischer H5b-Originalfall";return c;
}
export const h5bNeighbor=()=>h5aHealthyCase("h5b-neighbor");
export function h5bDecisions(partial=false):RecoveryDecision[] {
  void partial;
  return [
    {kind:"binding",planId:"h5a-plan",allocationId:"h5a-allocation",fromPotId:"year-2027",targets:[{potId:"year-2028",amount:partial?6000:10000}]},
    {kind:"primary",planId:"h5a-plan",allocationId:"h5a-allocation",targetPotId:"year-2028"},
    {kind:"legacy",planId:"h5a-plan",allocationId:"h5a-allocation"},
    {kind:"investment",planId:"h5a-plan",investmentId:"h5a-phased",targetPotId:"year-2028"},
  ];
}
export function h5bDeadline():AdvisoryCase {
  const c=h5bCase();
  c.advisory.needs=[{id:101,purpose:"Relativ früh",amount:10000,years:1.5},{id:102,purpose:"Explizit spät",amount:5000,years:2,dueDate:"2028-12-31"}];
  const a=c.plans[0].allocations[0];a.capitalPotId="year-2028";a.capitalPotAmounts={"year-2028":10000};
  const e=c.plans[0].investmentPlans[0];if(e.type==="phased")Object.assign(e,{capitalPotId:"year-2028",startDate:"2028-04-01",installments:6});
  return c;
}
