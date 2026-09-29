import type { Language } from './translations';

/** Neutral game metadata, not an earnings or feature-availability promise.
 * The static HTML defaults to Russian until the chosen locale is available. */
export const gameMetaCopy: Record<Language, string> = {
  ru: 'NeuroForge — лабораторная игра на Solana. Изучайте ресурсы, инструменты и устройство сети. Проверяйте доступность действий и условия в кошельке.',
  en: 'NeuroForge is a laboratory game on Solana. Explore resources, tools and network rules. Check availability and wallet terms before each action.',
  pt: 'NeuroForge é um jogo de laboratório na Solana. Conheça recursos, ferramentas e regras da rede. Confira a disponibilidade e as condições na carteira antes de agir.',
  es: 'NeuroForge es un juego de laboratorio en Solana. Explora recursos, herramientas y reglas de la red. Comprueba la disponibilidad y las condiciones en tu cartera antes de actuar.',
  vi: 'NeuroForge là trò chơi phòng thí nghiệm trên Solana. Tìm hiểu tài nguyên, công cụ và quy tắc mạng. Kiểm tra khả năng sử dụng và điều kiện trong ví trước khi hành động.',
  id: 'NeuroForge adalah gim laboratorium di Solana. Jelajahi sumber daya, peralatan, dan aturan jaringan. Periksa ketersediaan dan ketentuan di dompet sebelum bertindak.',
  fil: 'Ang NeuroForge ay larong laboratoryo sa Solana. Alamin ang mga yaman, kagamitan, at tuntunin ng network. Suriin ang pagiging available at mga kondisyon sa wallet bago kumilos.',
};
