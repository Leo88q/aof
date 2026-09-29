import type { Language } from './translations';

// Only labels used by the document-status page and factual local-storage table.
const keys = ["site", "app", "tableRegion", "tableCaption", "name", "provider", "purpose", "period", "category"] as const;
type Key = typeof keys[number];
const copy = (values: readonly string[]): Record<Key, string> => {
  if (values.length !== keys.length || values.some(value => !value)) throw new Error('Incomplete legal status translation');
  return Object.fromEntries(keys.map((key, i) => [key, values[i]])) as Record<Key, string>;
};
export const legalPageCopy: Record<Language, Record<Key, string>> = {
  ru: copy(["Сайт NeuroForge", "Открыть приложение", "Таблица хранения, прокручивается горизонтально", "Дополнительные cookies хостинга требуют live-проверки", "Имя", "Провайдер", "Назначение", "Срок", "Категория"]),
  en: copy(["NeuroForge site", "Open the app", "Storage table; scroll horizontally", "Additional hosting cookies need a live check", "Name", "Provider", "Purpose", "Period", "Category"]),
  pt: copy(["Site NeuroForge", "Abrir o aplicativo", "Tabela de armazenamento; role horizontalmente", "Cookies adicionais da hospedagem exigem verificação ao vivo", "Nome", "Provedor", "Finalidade", "Prazo", "Categoria"]),
  es: copy(["Sitio de NeuroForge", "Abrir la aplicación", "Tabla de almacenamiento; desplázate horizontalmente", "Las cookies adicionales del alojamiento requieren una comprobación en vivo", "Nombre", "Proveedor", "Finalidad", "Plazo", "Categoría"]),
  vi: copy(["Trang NeuroForge", "Mở ứng dụng", "Bảng dữ liệu lưu trữ; cuộn theo chiều ngang", "Cookie bổ sung từ dịch vụ lưu trữ cần được kiểm tra thực tế", "Tên", "Nhà cung cấp", "Mục đích", "Thời hạn", "Loại"]),
  id: copy(["Situs NeuroForge", "Buka aplikasi", "Tabel penyimpanan; gulir secara horizontal", "Cookie tambahan dari penyedia hosting memerlukan pemeriksaan langsung", "Nama", "Penyedia", "Tujuan", "Masa", "Kategori"]),
  fil: copy(["Site ng NeuroForge", "Buksan ang app", "Talaan ng imbakan; mag-scroll pahalang", "Kailangang suriin nang live ang dagdag na cookies ng hosting", "Pangalan", "Tagapagbigay", "Layunin", "Tagal", "Kategorya"]),
};
