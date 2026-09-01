import React from "react";
import { createRoot } from "react-dom/client";
import Home from "./app/page";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element not found");
}

createRoot(root).render(
  <React.StrictMode>
    <Home />
  </React.StrictMode>,
);
