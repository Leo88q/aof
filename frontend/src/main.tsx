import React from "react";
import ReactDOM from "react-dom/client";
import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import { LocaleProvider, useLocale } from "./i18n/LocaleProvider";
import { routeLoadingCopy } from "./i18n/routeLoadingCopy";
import { PrivacyControls } from "./legal/LegalCenter";
import { initializePrivacy } from "./legal/consent";
// Единственный слой представления: палитра, приборы, навигация, совместимость.
import "./theme/forge.css";
import "./ui/fonts";

const LegalPage = lazy(() => import("./legal/LegalPage").then(m => ({ default: m.LegalPage })));

const VisualGallery = lazy(() =>
  import("./gallery/VisualGallery").then((m) => ({ default: m.VisualGallery }))
);

const SiteApp = lazy(() =>
  import("./site/SiteApp").then((m) => ({ default: m.SiteApp }))
);

initializePrivacy();

function RouteLoading({ route }: { route: 'gallery' | 'site' }) {
  const { language } = useLocale();
  return <div className="fg-screen" lang={language} role="status" style={{ margin: 24, fontFamily: 'var(--fg-font-text)', overflowWrap: 'anywhere' }}>
    {routeLoadingCopy[language][route]}
  </div>;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <LocaleProvider>
      <BrowserRouter>
      <Routes>
        {/* Инструментальная палитра: витрина приборов на живом коде. */}
        <Route
          path="/visual"
          element={
            <Suspense fallback={<RouteLoading route="gallery" />}>
              <VisualGallery />
            </Suspense>
          }
        />
        <Route path="/legal/:slug" element={<Suspense fallback={<RouteLoading route="site" />}><LegalPage /></Suspense>} />
        <Route path="/legal/archive/:version/:slug" element={<Suspense fallback={<RouteLoading route="site" />}><LegalPage /></Suspense>} />
        <Route
          path="/site/*"
          element={
            <Suspense
              fallback={<RouteLoading route="site" />}
            >
              <SiteApp />
            </Suspense>
          }
        />
        <Route path="*" element={<App />} />
      </Routes>
      <PrivacyControls />
      </BrowserRouter>
    </LocaleProvider>
  </React.StrictMode>
);
