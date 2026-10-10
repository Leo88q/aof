import type { Language } from './translations';
import { siteTrust, trustMedallionIds } from './siteTrust';
import { toolsCopy } from './toolsCopy';

export const glossaryIds = [
  'neuroforge', 'commit', 'reveal', 'commitReveal', 'hash', 'sha', 'secret', 'salt', 'solana',
  'wallet', 'signature', 'transaction', 'instruction', 'program', 'account', 'mint', 'sol', 'gas',
  'gasTank', 'sessionKey', 'delegation', 'revocation', 'trust', 'tier', 'stranger', 'neighbour',
  'partner', 'guildsman', 'elder', 'rarity', 'base', 'enhanced', 'quantum', 'singularity',
  'transcendent', 'durability', 'repair', 'crafting', 'forging', 'reroll', 'energy', 'vial',
  'buff', 'recipe', 'source', 'sink', 'burn', 'marketplace', 'listing', 'orderbook',
  'limitOrder', 'matching', 'auction', 'liquidity', 'lpShare', 'slippage', 'seasonPass', 'xp',
  'rebirth', 'crank', 'siteMark', 'mind',
] as const;
export type GlossaryId = typeof glossaryIds[number];
export type GlossaryEntry = { id: GlossaryId; term: string; definition: string };
type Copy = {
  lead: string; paragraphs: readonly [string, string]; heading: string; search: string;
  found: string; empty: string; note: string; entries: readonly GlossaryEntry[];
};

const rarityIds = ['base', 'enhanced', 'quantum', 'singularity', 'transcendent'] as const;

/** Rank and rarity terms were left in English even in otherwise localized
 * definitions. Reuse their reviewed display catalogs; historical source terms
 * are still searchable via the English glossary, without changing stable IDs. */
function entries(text: string, language: Language): readonly GlossaryEntry[] {
  const rows = text.trim().split('\n');
  if (rows.length !== glossaryIds.length) throw new Error(`Glossary has ${rows.length} of ${glossaryIds.length} terms`);
  return rows.map((row, index) => {
    const parts = row.trim().split('|');
    if (parts.length !== 2 || !parts[0].trim() || !parts[1].trim()) throw new Error(`Invalid glossary entry ${index}`);
    const id = glossaryIds[index];
    const rankIndex = trustMedallionIds.findIndex(rank => rank === id);
    const rarityIndex = rarityIds.findIndex(rarity => rarity === id);
    const term = language === 'en' ? parts[0].trim()
      : rankIndex >= 0 ? siteTrust[language].medallions[rankIndex].name
      : rarityIndex >= 0 ? toolsCopy[language].collectionPage.rarities[rarityIndex]
      : parts[0].trim();
    return { id, term, definition: parts[1].trim() };
  });
}

export const siteGlossary: Record<Language, Copy> = {
  ru: {
    lead: 'Слова лаборатории, сети и рынка — без обещания, что каждое действие доступно.',
    paragraphs: ['Здесь сохранены и технические названия, и слова из старых описаний. Определение помогает понять текст, но не подтверждает работающую функцию, награду или цену.', 'Ищи по термину или смыслу на выбранном языке. Текущий статус, комиссии, адреса и результат всегда проверяй в игре, сети и кошельке.'],
    heading: 'Словарь мастерской', search: 'Искать термин', found: 'Найдено', empty: 'Такого термина нет.',
    note: 'Это редакционные определения, а не финансовый совет, аудит программы или инструкция к подписанию транзакции.',
    entries: entries(`NeuroForge|Лабораторная игра на Solana; описание мира не подтверждает состояние сети.
Commit|Фиксация обязательства до раскрытия; условия конкретной операции проверяй отдельно.
Reveal|Раскрытие данных для проверки ранее зафиксированного обязательства.
Commit/reveal|Два отдельных этапа; подтверждённый первый этап не гарантирует результат второго.
Хеш|Криптографический отпечаток данных; его нужно сверять с исходными данными.
SHA-256|Алгоритм хеширования; на сайте есть локальная демонстрация, не транзакция.
Секрет|Данные, скрытые до раскрытия; не путай с секретной фразой кошелька.
Соль|Дополнительные данные, затрудняющие угадывание скрытого значения.
Solana|Сеть, в которой хранятся аккаунты и исполняются программы.
Кошелёк|Инструмент для управления ключами и просмотра запросов подписи; не сообщай фразу восстановления.
Подпись|Разрешение, которое пользователь даёт конкретной операции через кошелёк.
Транзакция|Отправленный в сеть набор инструкций; отправка ещё не означает подтверждения.
Инструкция|Действие программы в транзакции; кнопка может вызывать несколько инструкций.
Программа|Код в сети Solana; исходный код сайта не доказывает адрес развёрнутой версии.
Аккаунт|Запись состояния в сети; это не обязательно человеческий профиль.
Mint|Адрес выпуска конкретного токена; название и картинка не доказывают его подлинность.
SOL|Актив сети Solana, которым обычно оплачивают сетевую комиссию.
Газ|Разговорное название комиссии; перед подписью проверь её фактический размер.
Gas tank|Игровой учёт SOL для комиссий; проверь состояние в сети, прежде чем тратить.
Сессионный ключ|Ключ для ограниченного делегированного доступа; текущая доступность не подтверждена.
Делегирование|Выдача ограниченных прав другому ключу; не передавай ему свою секретную фразу.
Отзыв|Отмена ранее выданных прав, если она предусмотрена действующими правилами.
Trust|Название системы доверия; история и привилегии игрока пока не подтверждены индексом.
Тир|Ступень в описании прогресса; рисунок ступени не доказывает статус аккаунта.
Stranger|Литературное название первой ступени доверия, не подтверждённый ранг игрока.
Neighbour|Литературное название второй ступени доверия, не подтверждённая награда.
Partner|Литературное название третьей ступени доверия, не право на сделки.
Guildsman|Литературное название четвёртой ступени, не подтверждённый доступ в гильдию.
Elder|Литературное название пятой ступени, не подтверждённая привилегия.
Редкость|Категория инструмента; рисунок не доказывает владение NFT или его свойства.
Base|Название базовой редкости инструмента; проверяй запись конкретного предмета.
Enhanced|Название следующей редкости; не обещание улучшенных доходов.
Quantum|Название редкости инструмента; не измерение его рыночной цены.
Singularity|Название редкости инструмента; не подтверждение доступности сборки.
Transcendent|Название редкости инструмента; не гарантия особых свойств.
Прочность|Состояние инструмента; для ремонта нужна актуальная сетевая запись и смета.
Ремонт|Действие восстановления инструмента с расходами, которые нужно сверить перед подписью.
Создание|Получение ресурса или инструмента по конкретному рецепту; затраты зависят от действия.
Ковка|Этап работы с инструментом; исход, цена и доступность требуют проверки.
Реролл|Повторное определение параметра по правилам действия; не обещание лучшего результата.
Энергия|Ресурс действий; доступный остаток и расход узнавай из текущего состояния игры.
Флюид|Ресурс из книги рецептов; сгорает в печати лаборатории. Живая сеть может ещё быть на прежней программе.
Бафф|Ограниченный по времени эффект, если он есть; не предполагай действие по значку.
Рецепт|Перечень входов и выхода; точные количества смотри в актуальной таблице игры.
Источник|Возможный способ поступления ресурса; наличие карточки не доказывает активную добычу.
Расход|Возможный способ использования ресурса; перед подписью сверяй реальную стоимость.
Burn|Уничтожение единиц токена по инструкции сети; может быть необратимым.
Маркетплейс|Формат объявлений с фиксированной ценой; каждый листинг проверяется отдельно.
Листинг|Объявление о продаже; цена, владелец и доступность зависят от сетевой записи.
Книга заявок|Список ценовых заявок; создание и сведение новых заявок сейчас приостановлены.
Лимитная заявка|Заявка с пределом цены; новые заявки здесь приостановлены из-за ошибки единиц.
Сведение заявок|Сопоставление ценовых заявок; новые операции сведения приостановлены.
Аукцион|Формат последовательных ставок; возврат, расчёт и доступность проверяй отдельно.
Ликвидность|Возможность обмена без сильного изменения цены; её нельзя вывести из картинки.
LP-доля|Учёт участия в пуле, если пул существует; здесь нет обещаний комиссий или дохода.
Проскальзывание|Разница между ожидаемой и фактической ценой исполнения.
Пропуск эпохи|Отдельная возможность сезона; стоимость и преимущества узнавай из текущих данных.
XP|Единицы прогресса в конкретной системе; не путай с наградой, готовой к получению.
Перерождение|Сброс прогресса сезона и сжигание излишков одной транзакцией; за каждый даёт постоянный бонус.
Crank|Инструкция продвижения процесса; наличие имени не доказывает, что функция запущена.
Локальная отметка|Запись о чтении сайта в браузере при согласии на хранение; не игровая награда.
MIND|Название ресурса в исходном коде; подлинность mint и расход проверяй перед действием.`, 'ru'),
  },
  en: {
    lead: 'The language of the laboratory, network and market, without promises of availability.',
    paragraphs: ['Technical names and older editorial terms both appear here. A definition helps you read, but does not confirm a live feature, reward or price.', 'Search by word or meaning in your chosen language. Check current status, fees, addresses and outcomes in the game, network and wallet.'],
    heading: 'Workshop glossary', search: 'Find a term', found: 'Found', empty: 'No matching term.',
    note: 'These are editorial definitions, not financial advice, a program audit or instructions to sign a transaction.',
    entries: entries(`NeuroForge|A laboratory game on Solana; its story is not evidence of network state.
Commit|Recording a commitment before disclosure; check the terms of each action.
Reveal|Disclosing data to verify an earlier commitment.
Commit/reveal|Two separate stages; completing the first does not guarantee the second.
Hash|A cryptographic fingerprint of data; compare it with the original data.
SHA-256|A hash algorithm used in the site’s local demonstration, not a transaction.
Secret|Data hidden until reveal; not the same as your wallet recovery phrase.
Salt|Extra data that makes a hidden value harder to guess.
Solana|A network that stores accounts and executes programs.
Wallet|A tool for keys and signature requests; never share your recovery phrase.
Signature|Authorization for a particular operation given through your wallet.
Transaction|A set of instructions sent to the network; submission is not confirmation.
Instruction|A program action within a transaction; one button may invoke several.
Program|Code on Solana; website source alone cannot identify the deployed version.
Account|A record of network state, not necessarily a person’s profile.
Mint|The address of a specific token’s issuance; a name or image proves nothing.
SOL|Solana’s native asset, commonly used to pay network fees.
Gas|A colloquial name for network fees; check the actual fee before signing.
Gas tank|An in-game SOL fee balance; verify its network state before spending.
Session key|A key for limited delegated access; availability is not confirmed here.
Delegation|Granting limited rights to another key without sharing a recovery phrase.
Revocation|Removing previous permissions where current rules permit it.
Trust|The name of a trust system; player history and perks lack a verified index.
Tier|A described stage of progress; its illustration is not proof of account status.
Stranger|A literary name for the first trust tier, not a confirmed player rank.
Neighbour|A literary name for the second trust tier, not a confirmed reward.
Partner|A literary name for the third trust tier, not trading permission.
Guildsman|A literary name for the fourth tier, not verified guild access.
Elder|A literary name for the fifth tier, not a confirmed privilege.
Rarity|A tool category; an image does not prove NFT ownership or properties.
Base|A tool rarity name; verify the specific item’s record.
Enhanced|A tool rarity name, not a promise of higher returns.
Quantum|A tool rarity name, not a measure of its market price.
Singularity|A tool rarity name, not proof that crafting is available.
Transcendent|A tool rarity name, not a guarantee of special properties.
Durability|A tool’s condition; repair needs a current network reading and quote.
Repair|Restoring a tool at a cost that must be checked before signing.
Crafting|Making a resource or tool from a specific recipe; costs depend on the action.
Forging|A stage of tool work; outcome, price and availability need verification.
Reroll|Recalculating a property under an action’s rules, not a promise of improvement.
Energy|An action resource; read the current balance and cost in the game.
Vial|A recipe resource burned when the laboratory is sealed. The live network may still be on the previous program.
Buff|A time-limited effect if available; an icon alone does not establish one.
Recipe|A list of inputs and outputs; check exact amounts in the current game table.
Source|A possible way to obtain a resource; a card does not prove live mining.
Sink|A possible use of a resource; check the actual debit before signing.
Burn|Destroying tokens via a network instruction; this may be irreversible.
Marketplace|A fixed-price listing format; verify each particular listing.
Listing|A sale notice; price, owner and availability depend on network records.
Order book|A list of price orders; new placement and matching are paused.
Limit order|An order with a price limit; new placement is paused due to a unit mismatch.
Matching|Pairing compatible orders; new matching is paused.
Auction|Successive bidding; refunds, settlement and availability need separate checks.
Liquidity|The ability to exchange without large price impact; art cannot establish it.
LP share|A record of pool participation if a pool exists; no fees or returns are promised.
Slippage|The difference between expected and execution prices.
Season pass|A seasonal option; check its current cost and benefits in network data.
XP|Progress units in a specific system, not a reward ready to claim.
Rebirth|A season-progress reset that burns the surplus in one transaction and grants a permanent bonus.
Crank|An instruction that advances a process; the name does not prove it is live.
Local mark|A site-reading record kept in your browser with storage consent, not a game reward.
MIND|A resource name in source code; verify its mint and costs before acting.`, 'en'),
  },
  pt: {
    lead: 'Palavras do laboratório, da rede e do mercado, sem prometer disponibilidade.',
    paragraphs: ['Este índice conserva nomes técnicos e termos de textos antigos. Uma definição ajuda a ler, mas não confirma uma função, prémio ou preço atual.', 'Pesquisa pela palavra ou pelo sentido no idioma escolhido. Confere estado, taxas, endereços e resultados no jogo, na rede e na carteira.'],
    heading: 'Glossário da oficina', search: 'Procurar termo', found: 'Encontrados', empty: 'Nenhum termo encontrado.',
    note: 'Estas definições editoriais não são conselho financeiro, auditoria de programa ou instrução para assinar uma transação.',
    entries: entries(`NeuroForge|Jogo de laboratório na Solana; a história não comprova o estado da rede.
Commit|Registo de um compromisso antes de revelar; confere as condições da ação.
Reveal|Revelação dos dados para verificar um compromisso anterior.
Commit/reveal|Duas etapas distintas; concluir a primeira não garante a segunda.
Hash|Impressão criptográfica dos dados; compara-a com o material original.
SHA-256|Algoritmo de hash usado na demonstração local do site, não numa transação.
Segredo|Dados ocultos até à revelação, diferentes da frase de recuperação da carteira.
Sal|Dados adicionais que dificultam adivinhar um valor oculto.
Solana|Rede que guarda contas e executa programas.
Carteira|Ferramenta para chaves e pedidos de assinatura; nunca reveles a frase de recuperação.
Assinatura|Autorização para uma operação específica através da carteira.
Transação|Conjunto de instruções enviado à rede; enviar não confirma o resultado.
Instrução|Ação de um programa numa transação; um botão pode chamar várias.
Programa|Código na Solana; o código do site não identifica a versão publicada.
Conta|Registo de estado na rede; não é necessariamente o perfil de uma pessoa.
Mint|Endereço de emissão de um token específico; nome ou imagem não provam autenticidade.
SOL|Ativo nativo da Solana, normalmente usado para pagar taxas de rede.
Gás|Nome informal das taxas de rede; confere o valor real antes de assinar.
Reserva de gás|Saldo de SOL do jogo para taxas; confirma o estado na rede antes de gastar.
Chave de sessão|Chave de acesso delegado limitado; a disponibilidade aqui não foi confirmada.
Delegação|Concessão de direitos limitados a outra chave sem revelar a frase de recuperação.
Revogação|Remoção de permissões anteriores, se as regras atuais o permitirem.
Confiança|Nome de um sistema; histórico e benefícios não têm índice verificado.
Nível|Etapa descrita de progresso; uma imagem não prova o estado da conta.
Stranger|Nome literário da primeira etapa de confiança, não classificação comprovada.
Neighbour|Nome literário da segunda etapa, não prémio comprovado.
Partner|Nome literário da terceira etapa, não licença para negociar.
Guildsman|Nome literário da quarta etapa, não acesso confirmado a um grupo.
Elder|Nome literário da quinta etapa, não privilégio confirmado.
Raridade|Categoria de ferramentas; a imagem não prova posse de NFT ou atributos.
Base|Nome de raridade de ferramenta; confirma o registo do objeto.
Enhanced|Nome de raridade, não promessa de maior rendimento.
Quantum|Nome de raridade, não medida de preço de mercado.
Singularity|Nome de raridade, não prova de que a criação está disponível.
Transcendent|Nome de raridade, não garantia de propriedades especiais.
Durabilidade|Condição da ferramenta; reparar exige leitura da rede e orçamento recente.
Reparo|Recuperação de ferramenta com custo a confirmar antes de assinar.
Criação|Produção de recurso ou ferramenta segundo receita; custo depende da ação.
Forja|Etapa de trabalho da ferramenta; resultado, preço e disponibilidade precisam de verificação.
Nova rolagem|Novo cálculo de um atributo segundo as regras, sem promessa de melhoria.
Energia|Recurso para ações; consulta o saldo e custo atuais no jogo.
Frasco|Recurso de receita queimado ao selar o laboratório. A rede ativa pode ainda estar no programa anterior.
Bônus|Efeito temporário, quando disponível; o ícone por si só não o comprova.
Receita|Lista de entradas e saídas; vê as quantidades exatas na tabela atual do jogo.
Origem|Possível forma de obter recurso; uma ficha não comprova extração ativa.
Consumo|Possível uso de um recurso; confere o débito real antes de assinar.
Burn|Destruição de tokens por instrução de rede; pode ser irreversível.
Mercado|Formato de anúncios de preço fixo; confirma cada oferta separadamente.
Anúncio|Oferta de venda; preço, dono e disponibilidade dependem do registo na rede.
Livro de ofertas|Lista de ordens com preços; novas ordens e cruzamentos estão suspensos.
Ordem limitada|Ordem com preço-limite; novas ordens suspensas por divergência de unidade.
Cruzamento|Encontro de ordens compatíveis; novos cruzamentos estão suspensos.
Leilão|Lances sucessivos; verifica à parte reembolso, liquidação e disponibilidade.
Liquidez|Capacidade de trocar sem grande impacto no preço; uma imagem não a comprova.
Cota do pool|Registo de participação num pool, se existir; sem promessa de taxas ou ganhos.
Deslizamento|Diferença entre o preço esperado e o preço de execução.
Passe de época|Opção sazonal; confere preço e vantagens atuais nos dados da rede.
XP|Unidades de progresso num sistema específico, não prémio pronto a receber.
Renascimento|Reinício do progresso da temporada que queima o excedente numa transação e dá bônus permanente.
Crank|Instrução que avança um processo; o nome não prova que esteja disponível.
Marca local|Registo de leitura do site no navegador, com consentimento; não é prémio do jogo.
MIND|Nome de recurso no código; confirma o mint e o custo antes de agir.`, 'pt'),
  },
  es: {
    lead: 'Palabras del laboratorio, la red y el mercado, sin prometer disponibilidad.',
    paragraphs: ['Aquí se conservan nombres técnicos y términos de textos antiguos. Una definición ayuda a leer, pero no confirma una función, recompensa o precio actual.', 'Busca palabras o significados en el idioma elegido. Comprueba estado, comisiones, direcciones y resultados en el juego, la red y tu cartera.'],
    heading: 'Glosario del taller', search: 'Buscar término', found: 'Encontrados', empty: 'No se encontró el término.',
    note: 'Estas definiciones editoriales no son consejo financiero, auditoría de programas ni instrucciones para firmar transacciones.',
    entries: entries(`NeuroForge|Juego de laboratorio en Solana; su relato no acredita el estado de la red.
Commit|Registro de un compromiso antes de revelar; comprueba los términos de cada acción.
Reveal|Revelación de datos para verificar un compromiso anterior.
Commit/reveal|Dos etapas distintas; completar la primera no garantiza la segunda.
Hash|Huella criptográfica de los datos; compárala con los originales.
SHA-256|Algoritmo hash usado en la demostración local del sitio, no en una transacción.
Secreto|Datos ocultos hasta la revelación; no son la frase de recuperación de tu cartera.
Sal|Datos adicionales que dificultan adivinar un valor oculto.
Solana|Red que almacena cuentas y ejecuta programas.
Cartera|Herramienta para claves y solicitudes de firma; nunca compartas tu frase de recuperación.
Firma|Autorización para una operación concreta mediante tu cartera.
Transacción|Conjunto de instrucciones enviado a la red; enviar no confirma el resultado.
Instrucción|Acción de un programa en una transacción; un botón puede activar varias.
Programa|Código en Solana; el código web no identifica la versión desplegada.
Cuenta|Registro de estado en la red; no necesariamente el perfil de una persona.
Mint|Dirección de emisión de un token; su nombre o imagen no prueban autenticidad.
SOL|Activo nativo de Solana, normalmente usado para pagar comisiones de red.
Gas|Nombre coloquial de las comisiones; comprueba la cifra antes de firmar.
Reserva de gas|Saldo SOL del juego para comisiones; verifica su estado en la red antes de gastar.
Clave de sesión|Clave de acceso delegado limitado; su disponibilidad no está confirmada aquí.
Delegación|Concesión de derechos limitados a otra clave sin compartir tu frase secreta.
Revocación|Eliminación de permisos anteriores, si las reglas actuales lo permiten.
Confianza|Nombre de un sistema; historial y ventajas carecen de índice verificado.
Nivel|Etapa descrita de progreso; una imagen no demuestra el estado de la cuenta.
Stranger|Nombre literario del primer nivel de confianza, no rango comprobado.
Neighbour|Nombre literario del segundo nivel, no recompensa comprobada.
Partner|Nombre literario del tercer nivel, no permiso para comerciar.
Guildsman|Nombre literario del cuarto nivel, no acceso confirmado a un gremio.
Elder|Nombre literario del quinto nivel, no privilegio confirmado.
Rareza|Categoría de herramientas; la imagen no acredita posesión ni atributos del NFT.
Base|Nombre de rareza; comprueba el registro del objeto concreto.
Enhanced|Nombre de rareza, no promesa de mayor rendimiento.
Quantum|Nombre de rareza, no valoración de mercado.
Singularity|Nombre de rareza, no prueba de que se pueda fabricar.
Transcendent|Nombre de rareza, no garantía de atributos especiales.
Durabilidad|Estado de herramienta; repararla exige datos de red y presupuesto recientes.
Reparación|Restauración de herramienta con coste que debe comprobarse antes de firmar.
Fabricación|Creación de recurso o herramienta según receta; el coste depende de la acción.
Forja|Etapa de trabajo de herramienta; comprueba resultado, precio y disponibilidad.
Repetición de atributos|Nuevo cálculo de un atributo según las reglas, sin prometer mejora.
Energía|Recurso para acciones; consulta saldo y coste actuales en el juego.
Frasco|Recurso de recetas que se quema al sellar el laboratorio. La red activa puede seguir en el programa anterior.
Bonificación|Efecto temporal, si está disponible; el icono no lo demuestra.
Receta|Lista de entradas y resultados; consulta las cantidades en la tabla actual.
Origen|Posible vía de obtener recurso; una ficha no prueba que la extracción funcione.
Consumo|Posible uso de recurso; comprueba el gasto real antes de firmar.
Burn|Destrucción de tokens mediante una instrucción de red; puede ser irreversible.
Mercado|Formato de anuncios de precio fijo; comprueba cada anuncio.
Anuncio|Oferta de venta; precio, dueño y disponibilidad dependen del registro de red.
Libro de órdenes|Lista de órdenes por precio; las nuevas órdenes y cruces están suspendidos.
Orden limitada|Orden con límite de precio; creación suspendida por un fallo de unidades.
Cruce de órdenes|Emparejamiento de órdenes compatibles; los nuevos cruces están suspendidos.
Subasta|Pujas sucesivas; verifica por separado devolución, liquidación y disponibilidad.
Liquidez|Capacidad de intercambiar sin gran impacto en el precio; la imagen no la acredita.
Parte de un pool|Registro de participación si existe el pool; no se prometen comisiones ni ganancias.
Deslizamiento|Diferencia entre el precio previsto y el de ejecución.
Pase de temporada|Opción estacional; consulta costes y ventajas actuales en la red.
XP|Unidades de progreso de un sistema concreto, no recompensa lista para cobrar.
Renacimiento|Reinicio del progreso de la temporada que quema el excedente en una transacción y otorga un bono permanente.
Crank|Instrucción que avanza un proceso; el nombre no demuestra que funcione.
Marca local|Registro de lectura en el navegador con consentimiento; no es premio del juego.
MIND|Nombre de recurso en el código; verifica mint y costes antes de actuar.`, 'es'),
  },
  vi: {
    lead: 'Từ ngữ của phòng thí nghiệm, mạng và chợ, không hứa tính năng khả dụng.',
    paragraphs: ['Có cả tên kỹ thuật lẫn từ trong các bài viết cũ. Định nghĩa giúp bạn đọc hiểu, không xác nhận tính năng, phần thưởng hay giá đang có hiệu lực.', 'Tìm theo từ hoặc ý nghĩa bằng ngôn ngữ đã chọn. Kiểm tra trạng thái, phí, địa chỉ và kết quả trong trò chơi, mạng và ví.'],
    heading: 'Thuật ngữ trong xưởng', search: 'Tìm thuật ngữ', found: 'Tìm thấy', empty: 'Không tìm thấy thuật ngữ.',
    note: 'Đây là giải thích biên tập, không phải lời khuyên tài chính, kiểm toán chương trình hay hướng dẫn ký giao dịch.',
    entries: entries(`NeuroForge|Trò chơi phòng thí nghiệm trên Solana; câu chuyện không chứng minh trạng thái mạng.
Commit|Ghi lại cam kết trước khi tiết lộ; hãy kiểm tra điều kiện từng hành động.
Reveal|Tiết lộ dữ liệu để kiểm tra một cam kết trước đó.
Commit/reveal|Hai giai đoạn riêng; hoàn tất bước đầu không bảo đảm kết quả bước sau.
Hàm băm|Dấu vân tay mật mã của dữ liệu; cần đối chiếu với dữ liệu gốc.
SHA-256|Thuật toán băm dùng trong minh họa cục bộ trên trang, không gửi giao dịch.
Bí mật|Dữ liệu ẩn cho tới lúc tiết lộ; không phải cụm từ khôi phục của ví.
Muối|Dữ liệu thêm vào để khó đoán giá trị đang bị ẩn.
Solana|Mạng lưu tài khoản và thực thi chương trình.
Ví|Công cụ quản lý khóa và yêu cầu ký; không bao giờ đưa cụm từ khôi phục.
Chữ ký|Sự cho phép đối với một hành động cụ thể thông qua ví.
Giao dịch|Nhóm lệnh gửi lên mạng; đã gửi chưa có nghĩa đã xác nhận.
Lệnh|Hành động của chương trình trong giao dịch; một nút có thể gọi nhiều lệnh.
Chương trình|Mã trên Solana; mã trang web không xác định bản đã triển khai.
Tài khoản|Bản ghi trạng thái mạng, không nhất thiết là hồ sơ của một người.
Mint|Địa chỉ phát hành token cụ thể; tên và hình ảnh không chứng minh tính thật.
SOL|Tài sản gốc của Solana, thường dùng để trả phí mạng.
Phí mạng|Khoản trả cho mạng; kiểm tra số phí thực tế trước khi ký.
Bình phí|Số dư SOL trong trò chơi dành cho phí; kiểm tra dữ liệu mạng trước khi dùng.
Khóa phiên|Khóa truy cập được ủy quyền có giới hạn; chưa xác nhận tính khả dụng ở đây.
Ủy quyền|Cấp quyền hạn chế cho khóa khác mà không đưa cụm từ khôi phục.
Thu hồi quyền|Hủy quyền đã cấp nếu quy tắc hiện hành cho phép.
Niềm tin|Tên một hệ thống; lịch sử và quyền lợi chưa có chỉ mục xác minh.
Bậc|Giai đoạn tiến trình được mô tả; hình ảnh không chứng minh trạng thái tài khoản.
Stranger|Tên văn học của bậc tin cậy đầu tiên, không phải cấp bậc đã xác minh.
Neighbour|Tên văn học của bậc thứ hai, không phải phần thưởng đã xác minh.
Partner|Tên văn học của bậc thứ ba, không phải quyền giao dịch.
Guildsman|Tên văn học của bậc thứ tư, không chứng minh tư cách bang hội.
Elder|Tên văn học của bậc thứ năm, không phải đặc quyền đã xác minh.
Độ hiếm|Phân loại công cụ; hình ảnh không chứng minh quyền sở hữu NFT hay thuộc tính.
Base|Tên độ hiếm công cụ; hãy xác minh bản ghi của từng vật phẩm.
Enhanced|Tên độ hiếm, không hứa mang lại lợi nhuận cao hơn.
Quantum|Tên độ hiếm, không cho biết giá trên thị trường.
Singularity|Tên độ hiếm, không chứng minh tính năng chế tạo đang mở.
Transcendent|Tên độ hiếm, không bảo đảm thuộc tính đặc biệt.
Độ bền|Tình trạng công cụ; sửa chữa cần dữ liệu mạng và báo giá mới.
Sửa chữa|Khôi phục công cụ với chi phí cần kiểm tra trước khi ký.
Chế tạo|Tạo tài nguyên hay công cụ theo công thức cụ thể; chi phí tùy hành động.
Rèn|Một giai đoạn làm công cụ; cần kiểm tra kết quả, giá và tính khả dụng.
Tạo lại thuộc tính|Tính lại thuộc tính theo quy tắc, không hứa sẽ tốt hơn.
Năng lượng|Tài nguyên cho hành động; kiểm tra số dư và chi phí hiện tại trong trò chơi.
Dung dịch|Tài nguyên theo công thức, bị đốt khi niêm phong phòng thí nghiệm. Mạng đang chạy có thể vẫn ở chương trình cũ.
Hiệu ứng tăng cường|Hiệu ứng có thời hạn nếu có; biểu tượng không tự chứng minh hiệu quả.
Công thức|Danh sách nguyên liệu và kết quả; xem số lượng chính xác trong bảng mới.
Nguồn|Cách có thể nhận tài nguyên; thẻ danh mục không chứng minh khai thác đang bật.
Tiêu hao|Cách có thể dùng tài nguyên; kiểm tra mức chi thực trước khi ký.
Burn|Tiêu hủy token qua lệnh mạng; có thể không đảo ngược được.
Chợ|Hình thức rao bán giá cố định; kiểm tra từng tin rao cụ thể.
Tin rao|Đề nghị bán; giá, chủ và tính khả dụng phụ thuộc bản ghi mạng.
Sổ lệnh|Danh sách lệnh theo giá; lệnh mới và khớp lệnh đang tạm dừng.
Lệnh giới hạn|Lệnh có mức giá trần hoặc sàn; việc tạo lệnh mới tạm dừng do sai đơn vị.
Khớp lệnh|Ghép các lệnh tương thích; khớp lệnh mới đang tạm dừng.
Đấu giá|Trả giá liên tiếp; kiểm tra riêng hoàn tiền, quyết toán và tính khả dụng.
Thanh khoản|Khả năng trao đổi mà không làm giá biến động mạnh; hình ảnh không chứng minh được.
Phần góp vào quỹ|Ghi nhận tham gia quỹ nếu có; không hứa phí hay lợi nhuận.
Trượt giá|Chênh lệch giữa giá dự kiến và giá thực hiện.
Thẻ mùa giải|Lựa chọn theo mùa; xem phí và quyền lợi hiện tại trên mạng.
XP|Đơn vị tiến trình trong từng hệ thống, không phải thưởng sẵn để nhận.
Tái sinh|Đặt lại tiến trình mùa và đốt phần dư trong một giao dịch; mỗi lần cho một thưởng vĩnh viễn.
Crank|Lệnh đẩy tiến trình; tên lệnh không chứng minh tính năng đang chạy.
Dấu đọc cục bộ|Ghi nhận việc đọc trang trong trình duyệt khi đồng ý lưu trữ; không phải thưởng game.
MIND|Tên tài nguyên trong mã nguồn; kiểm tra mint và chi phí trước khi hành động.`, 'vi'),
  },
  id: {
    lead: 'Istilah laboratorium, jaringan, dan pasar tanpa menjanjikan ketersediaan.',
    paragraphs: ['Nama teknis dan istilah editorial lama tetap tercantum. Definisi membantu membaca, tetapi tidak membuktikan fitur, hadiah, atau harga yang aktif.', 'Cari istilah atau artinya dalam bahasa pilihanmu. Periksa status, biaya, alamat, dan hasil di permainan, jaringan, serta dompet.'],
    heading: 'Glosarium bengkel', search: 'Cari istilah', found: 'Ditemukan', empty: 'Istilah tidak ditemukan.',
    note: 'Ini definisi editorial, bukan nasihat keuangan, audit program, atau panduan menandatangani transaksi.',
    entries: entries(`NeuroForge|Permainan laboratorium di Solana; ceritanya bukan bukti kondisi jaringan.
Commit|Mencatat komitmen sebelum membuka data; periksa ketentuan setiap tindakan.
Reveal|Membuka data untuk memeriksa komitmen sebelumnya.
Commit/reveal|Dua tahap berbeda; menyelesaikan yang pertama tidak menjamin hasil kedua.
Hash|Sidik jari kriptografis data; cocokkan dengan data aslinya.
SHA-256|Algoritme hash dalam demonstrasi lokal situs, bukan transaksi.
Rahasia|Data tersembunyi sampai dibuka; bukan frasa pemulihan dompetmu.
Salt|Data tambahan yang membuat nilai tersembunyi lebih sulit ditebak.
Solana|Jaringan yang menyimpan akun dan menjalankan program.
Dompet|Alat pengelola kunci dan permintaan tanda tangan; jangan bagikan frasa pemulihan.
Tanda tangan|Izin untuk tindakan tertentu yang diberikan lewat dompet.
Transaksi|Sekumpulan instruksi yang dikirim ke jaringan; pengiriman belum berarti konfirmasi.
Instruksi|Tindakan program dalam transaksi; satu tombol bisa memanggil beberapa.
Program|Kode di Solana; kode situs tidak membuktikan versi yang diterapkan.
Akun|Catatan keadaan jaringan, bukan selalu profil seseorang.
Mint|Alamat penerbitan token tertentu; nama atau gambar bukan bukti keaslian.
SOL|Aset asli Solana, lazim dipakai membayar biaya jaringan.
Gas|Istilah umum biaya jaringan; periksa biaya sebenarnya sebelum tanda tangan.
Tangki gas|Saldo SOL permainan untuk biaya; periksa kondisinya di jaringan sebelum memakai.
Kunci sesi|Kunci akses delegasi terbatas; ketersediaannya belum dipastikan di sini.
Delegasi|Memberikan hak terbatas kepada kunci lain tanpa berbagi frasa pemulihan.
Pencabutan|Membatalkan izin terdahulu apabila aturan sekarang mengizinkan.
Kepercayaan|Nama suatu sistem; riwayat dan manfaat belum memiliki indeks terverifikasi.
Tingkat|Tahap kemajuan yang digambarkan; gambar tidak membuktikan status akun.
Stranger|Nama fiksi untuk tingkat kepercayaan pertama, bukan pangkat terkonfirmasi.
Neighbour|Nama fiksi untuk tingkat kedua, bukan hadiah terkonfirmasi.
Partner|Nama fiksi untuk tingkat ketiga, bukan izin berdagang.
Guildsman|Nama fiksi untuk tingkat keempat, bukan bukti akses serikat.
Elder|Nama fiksi untuk tingkat kelima, bukan hak istimewa terkonfirmasi.
Kelangkaan|Kategori peralatan; gambar tidak membuktikan kepemilikan NFT atau sifatnya.
Base|Nama kelangkaan peralatan; periksa catatan barang tertentu.
Enhanced|Nama kelangkaan, bukan janji penghasilan lebih tinggi.
Quantum|Nama kelangkaan, bukan penilaian harga pasar.
Singularity|Nama kelangkaan, bukan bukti perakitan dapat dilakukan.
Transcendent|Nama kelangkaan, bukan jaminan sifat istimewa.
Daya tahan|Keadaan alat; perbaikan memerlukan data jaringan dan harga terbaru.
Perbaikan|Pemulihan alat dengan biaya yang harus diperiksa sebelum tanda tangan.
Perakitan|Membuat sumber daya atau alat berdasarkan resep; biaya tergantung tindakan.
Penempaan|Tahap pengerjaan alat; hasil, harga, dan ketersediaan perlu pemeriksaan.
Pengacakan ulang|Menghitung ulang sifat menurut aturan, tanpa janji hasil lebih baik.
Energi|Sumber daya tindakan; periksa saldo dan biaya saat ini di permainan.
Cairan|Sumber daya hasil resep yang dibakar saat laboratorium disegel. Jaringan aktif mungkin masih memakai program sebelumnya.
Penguat|Efek berbatas waktu jika ada; ikon bukan bukti bahwa efek tersedia.
Resep|Daftar bahan dan hasil; periksa jumlah pasti di tabel permainan sekarang.
Sumber|Cara yang mungkin menghasilkan sumber daya; kartu bukan bukti tambang aktif.
Pemakaian|Kemungkinan penggunaan sumber daya; periksa biaya nyata sebelum tanda tangan.
Burn|Pemusnahan token melalui instruksi jaringan; bisa tidak dapat dibatalkan.
Pasar|Format lapak harga tetap; periksa masing-masing lapak.
Lapak|Penawaran jual; harga, pemilik, dan ketersediaan bergantung pada catatan jaringan.
Buku pesanan|Daftar pesanan berdasarkan harga; pesanan baru dan pencocokan ditunda.
Pesanan terbatas|Pesanan dengan batas harga; pembuatan baru ditunda akibat kesalahan satuan.
Pencocokan|Memasangkan pesanan yang sesuai; pencocokan baru ditunda.
Lelang|Tawaran bertahap; periksa pengembalian, penyelesaian, dan ketersediaan sendiri.
Likuiditas|Kemampuan bertukar tanpa pengaruh harga besar; gambar tidak membuktikannya.
Porsi kumpulan|Catatan bagian dalam pool jika ada; tidak ada janji biaya atau keuntungan.
Slippage|Selisih antara harga perkiraan dan harga eksekusi.
Pas musim|Pilihan musiman; periksa biaya dan manfaat terbaru pada data jaringan.
XP|Unit kemajuan dalam sistem tertentu, bukan hadiah siap diklaim.
Kelahiran kembali|Reset kemajuan musim yang membakar kelebihan dalam satu transaksi dan memberi bonus permanen.
Crank|Instruksi pemrosesan; namanya tidak membuktikan fitur telah aktif.
Tanda lokal|Catatan membaca situs di browser dengan izin penyimpanan; bukan hadiah game.
MIND|Nama sumber daya di kode; periksa mint dan biaya sebelum bertindak.`, 'id'),
  },
  fil: {
    lead: 'Mga salita ng laboratoryo, network, at pamilihan na walang pangakong available ang lahat.',
    paragraphs: ['Nananatili rito ang mga teknikal na pangalan at mga katawagan mula sa lumang kuwento. Gabay sa pagbasa ang paliwanag, hindi patunay ng aktibong feature, gantimpala, o presyo.', 'Maghanap ayon sa salita o kahulugan sa pinili mong wika. Suriin ang status, bayarin, address, at resulta sa laro, network, at wallet.'],
    heading: 'Talasalitaan ng pagawaan', search: 'Maghanap ng salita', found: 'Nahanap', empty: 'Walang tumugmang salita.',
    note: 'Mga paliwanag na pang-impormasyon ito, hindi payong pampinansyal, audit ng programa, o gabay sa paglagda ng transaksyon.',
    entries: entries(`NeuroForge|Larong laboratoryo sa Solana; hindi patunay ng estado ng network ang kuwento nito.
Commit|Pagtatala ng pangako bago ilahad ang datos; suriin ang kondisyon ng bawat hakbang.
Reveal|Paglalahad ng datos upang masuri ang naunang pangako.
Commit/reveal|Dalawang magkahiwalay na yugto; hindi ginagarantiya ng una ang ikalawa.
Hash|Kriptograpikong bakas ng datos; ihambing ito sa orihinal.
SHA-256|Algoritmo ng hash sa lokal na demo ng site, hindi transaksyon.
Lihim|Datos na nakatago bago ilahad; hindi ito recovery phrase ng wallet mo.
Salt|Dagdag na datos na nagpapahirap sa paghula ng nakatagong halaga.
Solana|Network na nagtatago ng mga account at nagpapatakbo ng mga programa.
Wallet|Kasangkapan sa susi at hiling na lumagda; huwag ibigay ang recovery phrase.
Lagda|Pahintulot sa isang tiyak na gawain na ibinibigay sa wallet.
Transaksyon|Hanay ng mga instruksyong ipinadala sa network; hindi pa kumpirmasyon ang pagpapadala.
Instruksyon|Gawain ng programa sa transaksyon; puwedeng maraming instruksyon sa isang pindot.
Programa|Code sa Solana; hindi patunay ng na-deploy na bersyon ang code ng site.
Account|Talaan ng kalagayan sa network, hindi palaging profile ng tao.
Mint|Address ng paglabas ng isang token; hindi patunay ng pagiging tunay ang pangalan o larawan.
SOL|Katutubong asset ng Solana, karaniwang pambayad sa network fee.
Gas|Impormal na tawag sa network fee; suriin ang totoong halaga bago lumagda.
Lalagyan ng gas|Balanse ng SOL sa laro para sa bayarin; suriin muna ang tala sa network.
Susi ng sesyon|Susi para sa limitadong ipinagkatiwalang access; hindi pa kumpirmadong available dito.
Pagtatalaga|Pagbibigay ng limitadong karapatan sa ibang susi nang hindi ibinibigay ang recovery phrase.
Pagbawi ng pahintulot|Pagkansela ng dating karapatan kung pinapayagan ng kasalukuyang patakaran.
Tiwala|Pangalan ng isang sistema; walang beripikadong talaan ng kasaysayan at benepisyo.
Antas|Yugto ng pag-unlad sa kuwento; hindi patunay ng status ng account ang larawan.
Stranger|Pangkuwentong pangalan ng unang antas ng tiwala, hindi kumpirmadong ranggo.
Neighbour|Pangkuwentong pangalan ng ikalawang antas, hindi kumpirmadong gantimpala.
Partner|Pangkuwentong pangalan ng ikatlong antas, hindi pahintulot sa kalakalan.
Guildsman|Pangkuwentong pangalan ng ikaapat na antas, hindi patunay ng pagiging kasapi.
Elder|Pangkuwentong pangalan ng ikalimang antas, hindi kumpirmadong pribilehiyo.
Pambihira|Kategorya ng kagamitan; hindi patunay ng NFT o katangian ang larawan.
Base|Pangalan ng antas ng kagamitan; suriin ang tala ng mismong item.
Enhanced|Pangalan ng antas, hindi pangakong mas mataas na kita.
Quantum|Pangalan ng antas, hindi sukatan ng presyo sa pamilihan.
Singularity|Pangalan ng antas, hindi patunay na maaari itong gawin.
Transcendent|Pangalan ng antas, hindi garantiya ng natatanging katangian.
Tibay|Kondisyon ng kagamitan; kailangan ng bagong tala at presyo bago kumpunihin.
Pagkukumpuni|Pag-aayos ng kagamitan na may gastos na dapat suriin bago lumagda.
Paggawa|Paglikha ng yaman o kagamitan ayon sa resipe; depende sa gawain ang gastos.
Pandayan|Yugto ng paggawa ng kagamitan; kailangang suriin ang resulta, presyo, at availability.
Muling pagpili ng katangian|Pagkuha ng bagong katangian ayon sa patakaran, hindi pangakong mas maganda.
Enerhiya|Yaman para sa gawain; suriin ang kasalukuyang balanse at gastos sa laro.
Bote ng fluid|Yamang galing sa resipe na nasusunog kapag tinatakan ang laboratoryo. Maaaring nasa dating programa pa ang live na network.
Pansamantalang epekto|Epektong may hangganan kung available; hindi patunay ang icon.
Resipe|Listahan ng sangkap at resulta; tingnan ang eksaktong dami sa bagong talaan.
Pinagmumulan|Posibleng paraan ng pagkuha ng yaman; hindi patunay ng aktibong pagmimina ang card.
Paggamit|Posibleng paraan ng paggastos ng yaman; suriin ang totoong kaltas bago lumagda.
Burn|Pagsira ng token sa pamamagitan ng instruksyon sa network; maaaring hindi na mabawi.
Pamilihan|Anyo ng listahang may nakatakdang presyo; suriin ang bawat listahan.
Listahan|Alok na ibenta; nakabatay sa tala ng network ang presyo, may-ari, at availability.
Talaan ng order|Listahan ng mga presyo; nakatigil ang bagong order at pagtutugma.
Order na may limitasyon|Order na may hangganang presyo; nakatigil ang bago dahil sa maling yunit.
Pagtutugma|Paghahanap ng magkatugmang order; nakatigil ang bagong pagtutugma.
Subasta|Sunod-sunod na tawad; suriin nang hiwalay ang refund, pagsasaayos, at availability.
Likididad|Kakayahang makipagpalitan nang walang malaking pagbabago ng presyo; hindi patunay ang larawan.
Bahagi sa pool|Talaan ng paglahok sa pool kung mayroon; walang pangakong bayarin o kita.
Pagdulas ng presyo|Agwat ng inaasahang presyo at presyong naipatupad.
Pase sa panahon|Pana-panahong pagpipilian; tingnan sa network ang bagong gastos at benepisyo.
XP|Yunit ng pag-unlad sa isang sistema, hindi gantimpalang maaari nang kunin.
Muling pagsilang|Reset ng progreso ng panahon na nagsusunog ng sobra sa isang transaksyon at nagbibigay ng permanenteng bonus.
Crank|Instruksyong nagpapatuloy ng proseso; hindi patunay ng aktibong feature ang pangalan.
Lokal na marka|Tala ng pagbabasa sa browser kapag pinayagan ang imbakan; hindi gantimpala sa laro.
MIND|Pangalan ng yaman sa code; suriin ang mint at gastos bago kumilos.`, 'fil'),
  },
};
