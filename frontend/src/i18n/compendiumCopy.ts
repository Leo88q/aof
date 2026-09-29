import type { Language } from './translations';

type Copy = {
  title: string; intro: string; progress: string; recorded: (found: string, total: string) => string;
  connect: string; loading: string; unavailable: string; milestone: string;
  found: (name: string, rarity: string) => string; notFound: (name: string, rarity: string) => string;
};
export const compendiumCopy: Record<Language, Copy> = {
  ru: {
    title: 'Каталог инструментов', intro: 'Записи каталога показывают отмеченные типы инструментов, но не подтверждают владение NFT в сети.',
    progress: 'Заполнено в каталоге', recorded: (n, total) => `Отмечено ${n} из ${total}`,
    connect: 'Подключите кошелёк для просмотра каталога.', loading: 'Читаем каталог…',
    unavailable: 'Не удалось прочитать каталог. Количество отмеченных ячеек неизвестно.',
    milestone: 'Награды за этапы пока не подтверждены: доступного способа их получить нет.',
    found: (name, rarity) => `Отмечено в каталоге: ${name}, ${rarity}`, notFound: (name, rarity) => `Не отмечено в каталоге: ${name}, ${rarity}`,
  },
  en: {
    title: 'Tool compendium', intro: 'This compendium tracks recorded tool types; it does not prove on-chain NFT ownership.',
    progress: 'Recorded in compendium', recorded: (n, total) => `${n} of ${total} recorded`,
    connect: 'Connect a wallet to view your compendium.', loading: 'Loading the compendium…',
    unavailable: 'Could not read the compendium. The number of recorded entries is unknown.',
    milestone: 'Milestone rewards are unverified; there is no available way to claim them.',
    found: (name, rarity) => `Recorded in compendium: ${name}, ${rarity}`, notFound: (name, rarity) => `Not recorded in compendium: ${name}, ${rarity}`,
  },
  pt: {
    title: 'Compêndio de ferramentas', intro: 'O compêndio registra tipos de ferramentas; não comprova a posse de NFTs na rede.',
    progress: 'Registrado no compêndio', recorded: (n, total) => `${n} de ${total} registrados`,
    connect: 'Conecte a carteira para ver seu compêndio.', loading: 'Consultando o compêndio…',
    unavailable: 'Não foi possível consultar o compêndio. A quantidade de registros é desconhecida.',
    milestone: 'As recompensas por marcos não foram confirmadas; não há como resgatá-las no momento.',
    found: (name, rarity) => `Registrado no compêndio: ${name}, ${rarity}`, notFound: (name, rarity) => `Não registrado no compêndio: ${name}, ${rarity}`,
  },
  es: {
    title: 'Compendio de herramientas', intro: 'El compendio registra tipos de herramientas; no demuestra la posesión de NFT en la cadena.',
    progress: 'Registrado en el compendio', recorded: (n, total) => `${n} de ${total} registrados`,
    connect: 'Conecta una cartera para ver tu compendio.', loading: 'Consultando el compendio…',
    unavailable: 'No se pudo consultar el compendio. Se desconoce cuántas casillas hay registradas.',
    milestone: 'Las recompensas por hitos no están verificadas y aún no se pueden reclamar.',
    found: (name, rarity) => `Registrado en el compendio: ${name}, ${rarity}`, notFound: (name, rarity) => `No registrado en el compendio: ${name}, ${rarity}`,
  },
  vi: {
    title: 'Danh mục công cụ', intro: 'Danh mục ghi lại các loại công cụ đã đánh dấu, không chứng minh bạn sở hữu NFT trên chuỗi.',
    progress: 'Đã ghi trong danh mục', recorded: (n, total) => `Đã ghi ${n} trong ${total}`,
    connect: 'Kết nối ví để xem danh mục.', loading: 'Đang tải danh mục…',
    unavailable: 'Không thể tải danh mục. Chưa rõ số ô đã ghi.',
    milestone: 'Chưa xác minh phần thưởng theo mốc; hiện không có cách nhận.',
    found: (name, rarity) => `Đã ghi trong danh mục: ${name}, ${rarity}`, notFound: (name, rarity) => `Chưa ghi trong danh mục: ${name}, ${rarity}`,
  },
  id: {
    title: 'Katalog peralatan', intro: 'Katalog mencatat jenis peralatan yang ditandai, bukan bukti kepemilikan NFT di blockchain.',
    progress: 'Tercatat di katalog', recorded: (n, total) => `${n} dari ${total} tercatat`,
    connect: 'Hubungkan dompet untuk melihat katalog.', loading: 'Memuat katalog…',
    unavailable: 'Katalog tidak dapat dibaca. Jumlah entri yang tercatat belum diketahui.',
    milestone: 'Hadiah pencapaian belum diverifikasi; saat ini belum ada cara untuk mengklaimnya.',
    found: (name, rarity) => `Tercatat di katalog: ${name}, ${rarity}`, notFound: (name, rarity) => `Belum tercatat di katalog: ${name}, ${rarity}`,
  },
  fil: {
    title: 'Talaan ng kagamitan', intro: 'Nakatala rito ang mga uri ng kagamitang namarkahan, hindi ang patunay na pag-aari mo ang NFT sa blockchain.',
    progress: 'Nakatala sa kompedyum', recorded: (n, total) => `${n} sa ${total} ang nakatala`,
    connect: 'Ikonekta ang wallet para makita ang talaan.', loading: 'Kinukuha ang talaan…',
    unavailable: 'Hindi mabasa ang talaan. Hindi pa tiyak ang bilang ng mga nakatalang entry.',
    milestone: 'Hindi pa beripikado ang mga gantimpala sa bawat yugto; wala pang paraan para kunin ang mga ito.',
    found: (name, rarity) => `Nakatala: ${name}, ${rarity}`, notFound: (name, rarity) => `Hindi nakatala: ${name}, ${rarity}`,
  },
};
