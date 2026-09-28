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
        {/* «Каталог ресурсов» живёт в pages.ts ради заголовка в навигации, но
            страницей его рисует отдельный экран с поиском и фильтрами: раньше
            оба маршрута совпадали по пути, и каталог был недостижим. */}
        <Route path="resources" element={<ResourcesCatalog />} />
        <Route path="resources/:slug" element={<ResourceDetail />} />
        {pages
          .filter(p => p.id !== 'resources')
          .map(p => (
            <Route key={p.id} path={p.id} element={<ContentPage id={p.id} />} />
          ))}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
