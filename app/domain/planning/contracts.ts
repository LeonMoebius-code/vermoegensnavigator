import type { AdvisoryData } from "../advisory/contracts";

export type BucketId = "reserve" | "year1" | "year3" | "year5" | "year10" | "year10plus";

export type CapitalPotId = "reserve" | "strategic" | `year-${number}`;

export type CapitalPot = {
  id: CapitalPotId;
  kind: "reserve" | "year" | "strategic";
  label: string;
  range: string;
  total: number;
  year?: number;
  needs: AdvisoryData["needs"];
  earliestDueDate?: string;
  minMonths: number;
  legacyBucketId: BucketId;
};

export type PlannerAllocation = {
  id: string;
  productId: string;
  productName: string;
  bucketId: BucketId;
  amount: number;
  solutionId: string;
  source: "product" | "model" | "vv";
  modelId?: string;
  allocationMode?: "single" | "overflow" | "manual";
  bucketAmounts?: Partial<Record<BucketId, number>>;
  capitalPotId?: CapitalPotId;
  capitalPotAmounts?: Partial<Record<CapitalPotId, number>>;
  capitalPotReviewAmount?: number;
  capitalPotReviewNote?: string;
};

export type StructurePlan = {
  id: string;
  name: string;
  total: number;
  capitalMode: "linked" | "manual";
  allocations: PlannerAllocation[];
  investmentPlans: InvestmentPlan[];
  preferred: boolean;
  notes: string;
  modelId?: string;
  modelAmount?: number;
  depotMode: "none" | "compare" | "retain" | "afterSales";
  depotHoldingIds: string[];
  depotSelectionInitialized?: boolean;
  /** Tracks an explicit adviser choice so the first concrete depot can use the default afterSales. */
  depotModeSelectionInitialized?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type InvestmentFrequency =
  | "monthly"
  | "quarterly"
  | "semiannual"
  | "annual";

export type SavingsTargetRef =
  | { kind: "savingsGoal"; id: string }
  | { kind: "need"; id: AdvisoryData["needs"][number]["id"] };

export type PhasedEntryPlan = {
  id: string;
  type: "phased";
  allocationId: string;
  capitalPotId: CapitalPotId;
  stagedMode: "percent" | "amount";
  stagedValue: number;
  installments: number;
  frequency: InvestmentFrequency;
  startDate: string;
  note: string;
};

export type SavingsPlan = {
  id: string;
  type: "savings";
  name?: string;
  productId: string;
  productName: string;
  contributionAmount: number;
  frequency: InvestmentFrequency;
  startDate: string;
  targetRef?: SavingsTargetRef;
  note: string;
};

export type InvestmentPlan = PhasedEntryPlan | SavingsPlan;

export type SavingsGoal = {
  id: string;
  name: string;
  targetAmount: number;
  targetYear?: number;
  targetDate?: string;
  note?: string;
};
