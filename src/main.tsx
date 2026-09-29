import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./ErrorBoundary";
import { registerServiceWorker } from "./registerServiceWorker";
import "./index.css";

// On `load`, so the worker's precache never competes with the first paint, and
// after the render below has already been scheduled: registration is an
// enhancement and a failure in it is silent (src/registerServiceWorker.ts).
window.addEventListener("load", () => registerServiceWorker());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
