import React from "react";
import ReactDOM from "react-dom/client";
import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import { LegalPage, PrivacyControls } from "./legal/LegalCenter";
import { initializePrivacy } from "./legal/consent";
// Единственный слой представления: палитра, приборы, навигация, совместимость.
import "./theme/forge.css";
import "./ui/fonts";

const VisualGallery = lazy(() =>
  import("./gallery/VisualGallery").then((m) => ({ default: m.VisualGallery }))
);

const SiteApp = lazy(() =>
  import("./site/SiteApp").then((m) => ({ default: m.SiteApp }))
);

initializePrivacy();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        {/* Инструментальная палитра: витрина приборов на живом коде. */}
        <Route
          path="/visual"
          element={
            <Suspense fallback={<div className="fg-screen" style={{ margin: 24 }}>Собираем приборы…</div>}>
              <VisualGallery />
            </Suspense>
          }
        />
        <Route path="/legal/:slug" element={<LegalPage />} />
        <Route path="/legal/archive/:version/:slug" element={<LegalPage />} />
        <Route
          path="/site/*"
          element={
            <Suspense
              fallback={
                <div className="fg-screen" style={{ margin: 24, fontFamily: "var(--fg-font-text)" }}>
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
