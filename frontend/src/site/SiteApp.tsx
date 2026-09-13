import { Navigate, Route, Routes } from 'react-router-dom';
import { SiteLayout } from './layout/Layout';
import { pages } from './content/pages';
import { ContentPage, ResourceDetail, ResourcesCatalog, NotFound } from './pages/ContentPage';
import './styles/site.css';

export function SiteApp() {
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route index element={<Navigate to="home" replace />} />
        {pages.map(p => (
          <Route key={p.id} path={p.id} element={<ContentPage id={p.id} />} />
        ))}
        <Route path="resources" element={<ResourcesCatalog />} />
        <Route path="resources/:slug" element={<ResourceDetail />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
