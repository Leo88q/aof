import type { Language } from './translations';

type Copy = { title: string; lead: string; home: string; catalog: string };

export const siteNotFound: Record<Language, Copy> = {
  ru: { title: 'Страница не найдена', lead: 'Проверь адрес или вернись на главную.', home: 'На главную', catalog: 'Открой каталог' },
  en: { title: 'Page not found', lead: 'Check the address or return to the home page.', home: 'Go home', catalog: 'Browse the catalog' },
  pt: { title: 'Página não encontrada', lead: 'Confere o endereço ou volta à página inicial.', home: 'Página inicial', catalog: 'Explorar o catálogo' },
  es: { title: 'Página no encontrada', lead: 'Comprueba la dirección o vuelve al inicio.', home: 'Ir al inicio', catalog: 'Explorar el catálogo' },
  vi: { title: 'Không tìm thấy trang', lead: 'Hãy kiểm tra địa chỉ hoặc quay về trang chủ.', home: 'Về trang chủ', catalog: 'Xem danh mục' },
  id: { title: 'Halaman tidak ditemukan', lead: 'Periksa alamatnya atau kembali ke beranda.', home: 'Ke beranda', catalog: 'Jelajahi katalog' },
  fil: { title: 'Hindi mahanap ang pahina', lead: 'Suriin ang address o bumalik sa unang pahina.', home: 'Sa unang pahina', catalog: 'Tingnan ang katalogo' },
};
