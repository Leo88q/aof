import { useState } from 'react';
import { Link } from 'react-router-dom';

export function WalletSafetyNotice({ onContinue, onCancel }: { onContinue: () => void; onCancel: () => void }) {
  const [understood, setUnderstood] = useState(false);
  return <section className="legal-area wallet-safety" aria-label="Перед подключением кошелька">
    <h2>Перед подключением кошелька</h2>
    <p>Не вводите seed-фразу или приватный ключ. Подключение раскрывает приложению публичный адрес; последующие запросы могут передать его серверу и RPC.</p>
    <p>Подключение не разрешает произвольные списания. Перед каждой подписью проверьте сеть, сумму, получателя, комиссии и разрешения. Непонятный запрос отклоните.</p>
    <p><Link to="/legal/terms">Условия</Link> · <Link to="/legal/privacy">Конфиденциальность</Link> · <Link to="/legal/risks">Риски</Link></p>
    <label><input type="checkbox" checked={understood} onChange={e => setUnderstood(e.target.checked)} />Я понимаю предупреждение и хочу запросить подключение кошелька.</label>
    <p>Это не согласие на маркетинг и не подпись транзакции. Окончательные договорные условия должны быть утверждены оператором до production-запуска.</p>
    <div className="legal-actions"><button type="button" disabled={!understood} onClick={onContinue}>Продолжить в кошельке</button><button type="button" onClick={onCancel}>Отмена</button></div>
  </section>;
}
