import React from "react";
import { createRoot } from "react-dom/client";
import { RetirementEntry } from "../../app/presentation/retirement/retirement-entry";
import { syntheticPremiumWorkspace } from "./avd-r88-fixtures";

// This component is bundled only in Playwright. The production entry receives
// neither the fixture nor its explicit internal channel permissions.
createRoot(document.getElementById("root")!).render(<RetirementEntry workspace={syntheticPremiumWorkspace()} />);
