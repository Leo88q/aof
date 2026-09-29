import type { Language } from './translations';

type Copy = {
  dewar: string; working: string; onRack: string; depthTrace: string; depthZero: string;
  sonar: string; read: string; crossPanel: string; punched: string; remaining: string;
  loadChart: string; loadScale: readonly [string, string, string];
};

/** Defaults for reusable instruments. Explicit labels supplied by a page take precedence. */
export const forgeDeviceCopy: Record<Language, Copy> = {
  ru: {
    dewar: 'ЖИДК. N₂', working: 'в работе', onRack: 'в стойке',
    depthTrace: 'Лента глубины: добыча во времени', depthZero: '0 м', sonar: 'Круговой индикатор',
    read: 'Считать', crossPanel: 'Кросс-панель', punched: 'ПРОБИТО', remaining: 'ОСТАЛОСЬ',
    loadChart: 'Лента нагрузки сети', loadScale: ['ФРЕНЗИ', 'НОМИНАЛ', 'БЛЭКАУТ'],
  },
  en: {
    dewar: 'LIQUID N₂', working: 'working', onRack: 'on the rack',
    depthTrace: 'Depth trace: extraction over time', depthZero: '0 m', sonar: 'Circular sonar display',
    read: 'Read', crossPanel: 'Patch panel', punched: 'PUNCHED', remaining: 'REMAINING',
    loadChart: 'Network load trace', loadScale: ['FRENZY', 'NOMINAL', 'BLACKOUT'],
  },
  pt: {
    dewar: 'N₂ LÍQUIDO', working: 'em uso', onRack: 'na bancada',
    depthTrace: 'Registro de profundidade: extração ao longo do tempo', depthZero: '0 m', sonar: 'Visor circular do sonar',
    read: 'Consultar', crossPanel: 'Painel de conexões', punched: 'PERFURADOS', remaining: 'RESTANTES',
    loadChart: 'Registro da carga da rede', loadScale: ['FRENESI', 'NORMAL', 'APAGÃO'],
  },
  es: {
    dewar: 'N₂ LÍQUIDO', working: 'en uso', onRack: 'en el soporte',
    depthTrace: 'Registro de profundidad: extracción en el tiempo', depthZero: '0 m', sonar: 'Visor circular del sonar',
    read: 'Consultar', crossPanel: 'Panel de conexiones', punched: 'PERFORADOS', remaining: 'RESTANTES',
    loadChart: 'Registro de carga de la red', loadScale: ['FRENESÍ', 'NORMAL', 'APAGÓN'],
  },
  vi: {
    dewar: 'N₂ LỎNG', working: 'đang dùng', onRack: 'trên giá',
    depthTrace: 'Dải độ sâu: khai thác theo thời gian', depthZero: '0 m', sonar: 'Màn hình sonar hình tròn',
    read: 'Đọc dữ liệu', crossPanel: 'Bảng đấu nối', punched: 'ĐÃ ĐỤC', remaining: 'CÒN LẠI',
    loadChart: 'Dải ghi tải mạng', loadScale: ['CAO ĐIỂM', 'BÌNH THƯỜNG', 'MẤT MẠNG'],
  },
  id: {
    dewar: 'N₂ CAIR', working: 'beroperasi', onRack: 'di rak',
    depthTrace: 'Jejak kedalaman: ekstraksi dari waktu ke waktu', depthZero: '0 m', sonar: 'Tampilan sonar melingkar',
    read: 'Baca', crossPanel: 'Panel sambungan', punched: 'BERLUBANG', remaining: 'TERSISA',
    loadChart: 'Jejak beban jaringan', loadScale: ['PUNCAK', 'NORMAL', 'PADAM'],
  },
  fil: {
    dewar: 'LIKIDONG N₂', working: 'gumagana', onRack: 'nasa rack',
    depthTrace: 'Tala ng lalim: pagkuha sa paglipas ng panahon', depthZero: '0 m', sonar: 'Pabilog na sonar',
    read: 'Basahin', crossPanel: 'Panel ng koneksyon', punched: 'NABUTASAN', remaining: 'NATITIRA',
    loadChart: 'Tala ng pasan ng network', loadScale: ['RUKTOK', 'NORMAL', 'WALANG SUPLAY'],
  },
};
