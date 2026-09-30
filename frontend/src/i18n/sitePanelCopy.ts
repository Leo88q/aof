import type { Language } from './translations';

/**
 * Подписи пульта стенда на сайте: тумблер фона, галетник слоя и фейдер
 * яркости. Это оформление страницы, а не игровые данные, поэтому здесь нет
 * ни чисел, ни обещаний — только имена положений прибора.
 */
export type SitePanelCopy = {
  deckLabel: string;
  switchLabel: string;
  modeLegend: string;
  modes: readonly [string, string, string];
  levelLabel: string;
  statusOn: string;
  statusOff: string;
  galleryLegend: string;
};

export const sitePanelCopy: Record<Language, SitePanelCopy> = {
  ru: {
    deckLabel: 'Пульт стенда',
    switchLabel: 'Фон стенда',
    modeLegend: 'Слой фона',
    modes: ['Сцена', 'Металл', 'Сетка'],
    levelLabel: 'Яркость фона',
    statusOn: 'Стенд освещён',
    statusOff: 'Фон отключён',
    galleryLegend: 'Экран стенда',
  },
  en: {
    deckLabel: 'Stand control',
    switchLabel: 'Stand background',
    modeLegend: 'Background layer',
    modes: ['Scene', 'Metal', 'Grid'],
    levelLabel: 'Background brightness',
    statusOn: 'Stand lit',
    statusOff: 'Background off',
    galleryLegend: 'Stand screen',
  },
  pt: {
    deckLabel: 'Painel da bancada',
    switchLabel: 'Fundo da bancada',
    modeLegend: 'Camada de fundo',
    modes: ['Cena', 'Metal', 'Grade'],
    levelLabel: 'Brilho do fundo',
    statusOn: 'Bancada iluminada',
    statusOff: 'Fundo desligado',
    galleryLegend: 'Tela da bancada',
  },
  es: {
    deckLabel: 'Panel del puesto',
    switchLabel: 'Fondo del puesto',
    modeLegend: 'Capa de fondo',
    modes: ['Escena', 'Metal', 'Rejilla'],
    levelLabel: 'Brillo del fondo',
    statusOn: 'Puesto iluminado',
    statusOff: 'Fondo apagado',
    galleryLegend: 'Pantalla del puesto',
  },
  vi: {
    deckLabel: 'Bảng điều khiển bàn',
    switchLabel: 'Nền của bàn',
    modeLegend: 'Lớp nền',
    modes: ['Cảnh', 'Kim loại', 'Lưới'],
    levelLabel: 'Độ sáng nền',
    statusOn: 'Bàn đã sáng',
    statusOff: 'Đã tắt nền',
    galleryLegend: 'Màn hình của bàn',
  },
  id: {
    deckLabel: 'Panel stan',
    switchLabel: 'Latar stan',
    modeLegend: 'Lapisan latar',
    modes: ['Adegan', 'Logam', 'Kisi'],
    levelLabel: 'Kecerahan latar',
    statusOn: 'Stan menyala',
    statusOff: 'Latar mati',
    galleryLegend: 'Layar stan',
  },
  fil: {
    deckLabel: 'Panel ng estante',
    switchLabel: 'Latar ng estante',
    modeLegend: 'Pantas ng latar',
    modes: ['Tanawin', 'Metal', 'Grid'],
    levelLabel: 'Liwanag ng latar',
    statusOn: 'Nakasindi ang estante',
    statusOff: 'Patay ang latar',
    galleryLegend: 'Iskrin ng estante',
  },
};
