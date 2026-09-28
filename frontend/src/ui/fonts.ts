/**
 * Локальные шрифты (без внешних запросов, требование CSP из public/_headers).
 *
 * Manrope — весь интерфейс, Exo 2 — заголовки панелей и приборов,
 * JetBrains Mono — цифры, единицы и идентификаторы. Прежние Playfair Display
 * и Inter не были подключены ни к одному правилу и удалены вместе с пакетами;
 * Rajdhani и Orbitron в токенах тоже не загружались — их в наборе больше нет.
 */
import '@fontsource/manrope/400.css';
import '@fontsource/manrope/500.css';
import '@fontsource/manrope/600.css';
import '@fontsource/manrope/700.css';
import '@fontsource/exo-2/500.css';
import '@fontsource/exo-2/600.css';
import '@fontsource/exo-2/700.css';
import '@fontsource/jetbrains-mono/500.css';
