import type { Language } from './translations';

export const labLabels: Record<Language, { overview: string; station: string; cultivation: string; separation: string; training: string; expedition: string; drum: string; lottery: string }> = {
  ru: { overview: 'Обзор', station: 'Сетевая станция', cultivation: 'Культивация', separation: 'Сепарация', training: 'Обучение', expedition: 'Экспедиция', drum: 'Барабан', lottery: 'Лотерея' },
  en: { overview: 'Overview', station: 'Network station', cultivation: 'Cultivation', separation: 'Separation', training: 'Training', expedition: 'Expedition', drum: 'Drum', lottery: 'Lottery' },
  pt: { overview: 'Visão geral', station: 'Estação de rede', cultivation: 'Cultivo', separation: 'Separação', training: 'Treinamento', expedition: 'Expedição', drum: 'Tambor', lottery: 'Loteria' },
  es: { overview: 'Resumen', station: 'Estación de red', cultivation: 'Cultivo', separation: 'Separación', training: 'Entrenamiento', expedition: 'Expedición', drum: 'Tambor', lottery: 'Lotería' },
  vi: { overview: 'Tổng quan', station: 'Trạm mạng', cultivation: 'Nuôi cấy', separation: 'Tách mẫu', training: 'Huấn luyện', expedition: 'Thám hiểm', drum: 'Vòng quay', lottery: 'Xổ số' },
  id: { overview: 'Ringkasan', station: 'Stasiun jaringan', cultivation: 'Kultivasi', separation: 'Pemisahan', training: 'Pelatihan', expedition: 'Ekspedisi', drum: 'Undian', lottery: 'Lotre' },
  fil: { overview: 'Pangkalahatan', station: 'Istasyon ng network', cultivation: 'Pagpapalago', separation: 'Paghihiwalay', training: 'Pagsasanay', expedition: 'Ekspedisyon', drum: 'Tambol', lottery: 'Loterya' },
};
