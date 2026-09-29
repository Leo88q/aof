import assert from 'node:assert/strict';
// Optional local e2e tool; not shipped in the app. See docs/LEGAL_AND_PRIVACY_OPERATIONS.md.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const baseURL = process.env.PRIVACY_TEST_URL || 'http://127.0.0.1:3000';
(async () => {
 const browser = await chromium.launch({headless:true, executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined, args:['--no-sandbox', '--disable-dev-shm-usage']});
 try {
 const context = await browser.newContext({viewport:{width:390,height:844}, locale:'ru-RU'});
 const page = await context.newPage(); page.setDefaultTimeout(15000); const requests=[]; const errors=[];
 page.on('request',r=>requests.push(r.url())); page.on('pageerror',e=>errors.push(e.message));
 await page.goto(baseURL+'/site/home');
 await page.getByRole('button',{name:'Только необходимое'}).click();
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('nf:privacy-choice:v1')).functional),false);
 assert.equal(await page.evaluate(()=>localStorage.getItem('aof:site:journal:v1')),null);
 await page.getByRole('button',{name:'Настройки cookies'}).click();
 assert.equal(await page.getByRole('checkbox',{name:'Функциональные настройки и журнал'}).isChecked(),false);
 await page.getByRole('button',{name:'Принять функциональные'}).click();
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('nf:privacy-choice:v1')).functional),true);
 await page.evaluate(()=>localStorage.setItem('aof:site:journal:v1','{"visits":["home"],"badges":[]}'));
 await page.getByRole('button',{name:'Настройки cookies'}).click();
 await page.getByRole('button',{name:'Отклонить необязательные'}).click();
 assert.equal(await page.evaluate(()=>localStorage.getItem('aof:site:journal:v1')),null);
 for (const slug of ['privacy','terms','cookies','risks','data-requests','disclosure','contacts','status']) {
   await page.goto(baseURL+'/legal/'+slug);
   await page.getByRole('heading',{name:'Юридические документы не опубликованы',level:1}).waitFor();
   await page.getByRole('alert').getByText('Тексты юридических проектов и история редакций сняты с публикации',{exact:false}).waitFor();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,slug+' horizontal overflow');
 }
 await page.goto(baseURL+'/legal/archive/2026-09-28.1/privacy');
 await page.getByText('Архивные редакции больше не опубликованы.',{exact:false}).waitFor();
 assert.equal(requests.some(u=>/fonts\.(googleapis|gstatic)\.com/.test(u)),false);
 assert.deepEqual(errors,[]);
 const gpc = await browser.newContext({locale:'ru-RU'});
 await gpc.addInitScript(()=>Object.defineProperty(navigator,'globalPrivacyControl',{value:true}));
 const gp=await gpc.newPage(); await gp.goto(baseURL+'/legal/cookies');
 assert.equal(await gp.getByRole('button',{name:'Принять функциональные'}).isDisabled(),true);
 await gp.getByRole('button',{name:'Настройки cookies'}).click();
 await gp.getByRole('button',{name:'Сохранить выбор'}).click();
 assert.equal(await gp.evaluate(()=>JSON.parse(localStorage.getItem('nf:privacy-choice:v1')).functional),false);
 // The same unavailable status, not the withdrawn draft, follows the chosen locale.
 const english = await browser.newContext({locale:'en-US',viewport:{width:390,height:844}});
 const en = await english.newPage();
 await en.goto(baseURL+'/legal/cookies');
 await en.getByRole('heading',{name:'Legal documents are not published',level:1}).waitFor();
 await en.getByRole('alert').getByText('Draft legal texts and revision history have been withdrawn',{exact:false}).waitFor();
 await en.getByRole('heading',{name:'Local storage in this browser',level:2}).waitFor();
 await en.getByRole('button',{name:'Cookie settings'}).click();
 await en.getByRole('checkbox',{name:'Functional preferences and journal'}).waitFor();
 await en.getByRole('button',{name:'Decline optional storage'}).click();
 assert.equal(await en.evaluate(()=>JSON.parse(localStorage.getItem('nf:privacy-choice:v1')).functional),false);
 assert.equal(await en.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'English legal mobile overflow');
 await en.locator('.legal-top .locale-switcher summary').click();
 await en.locator('.legal-top .locale-switcher__menu button').filter({hasText:'Русский'}).click();
 await en.getByRole('heading',{name:'Юридические документы не опубликованы',level:1}).waitFor();
 await en.getByRole('status').getByText('Выбор сохранён.',{exact:false}).waitFor();
 await en.goto(baseURL+'/legal/archive/2026-09-28.1/privacy');
 await en.getByText('Архивные редакции больше не опубликованы.',{exact:false}).waitFor();
 await english.close();
 console.log('PASS: withdrawn legal routes, RU/EN storage controls, mobile width, deny/accept/revoke, GPC, no Google Fonts, no page errors.');
 } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exit(1);});
