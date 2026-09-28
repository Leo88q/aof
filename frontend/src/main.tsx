import React from "react";
import ReactDOM from "react-dom/client";
import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import { LegalPage, PrivacyControls } from "./legal/LegalCenter";
import { initializePrivacy } from "./legal/consent";
import "./theme/globals.css";
import "./theme/manor.css";
import "./theme/plates.css";
import "./theme/circuit.css";
import "./ui/fonts";
import "./ui/tokens.css";
import "./ui/base.css";
import "./ui/reduced-motion.css";
import { initManorFx } from "./lib/manorFx";

const SiteApp = lazy(() =>
  import("./site/SiteApp").then((m) => ({ default: m.SiteApp }))
);

initializePrivacy();
initManorFx();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/legal/:slug" element={<LegalPage />} />
        <Route path="/legal/archive/:version/:slug" element={<LegalPage />} />
        <Route
          path="/site/*"
          element={
            <Suspense
              fallback={
                <div style={{ padding: 40, fontFamily: "monospace" }}>
                  Открываем мастерскую…
                </div>
              }
            >
              <SiteApp />
            </Suspense>
          }
        />
        <Route path="*" element={<App />} />
      </Routes>
      <PrivacyControls />
    </BrowserRouter>
  </React.StrictMode>
);
