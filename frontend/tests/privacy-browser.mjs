import assert from 'node:assert/strict';
// Optional local e2e tool; not shipped in the app. See docs/LEGAL_AND_PRIVACY_OPERATIONS.md.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const baseURL = process.env.PRIVACY_TEST_URL || 'http://127.0.0.1:3000';
(async () => {
 const browser = await chromium.launch({headless:true, executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined, args:['--no-sandbox', '--disable-dev-shm-usage']});
 try {
 const context = await browser.newContext({viewport:{width:390,height:844}});
 const page = await context.newPage(); page.setDefaultTimeout(15000); const requests=[]; const errors=[];
 page.on('request',r=>requests.push(r.url())); page.on('pageerror',e=>errors.push(e.message));
 await page.goto(baseURL+'/site/home');
 await page.getByRole('button',{name:'Отклонить необязательные'}).click();
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
 for(const [slug,title] of [['privacy','Политика конфиденциальности'],['terms','Условия использования'],['cookies','Cookie Policy и локальное хранение'],['risks','Раскрытие рисков'],['data-requests','Запросы о персональных данных'],['disclosure','Сообщить об уязвимости'],['contacts','Контакты и оператор']]) {
   await page.goto(baseURL+'/legal/'+slug);
   await page.getByRole('heading',{name:title,exact:true,level:1}).waitFor();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,slug+' horizontal overflow');
 }
 await page.goto(baseURL+'/legal/archive/2026-09-28.1/privacy');
 await page.getByText('Архивная редакция:',{exact:false}).waitFor();
 assert.equal(requests.some(u=>/fonts\.(googleapis|gstatic)\.com/.test(u)),false);
 assert.deepEqual(errors,[]);
 const gpc = await browser.newContext();
 await gpc.addInitScript(()=>Object.defineProperty(navigator,'globalPrivacyControl',{value:true}));
 const gp=await gpc.newPage(); await gp.goto(baseURL+'/legal/cookies');
 assert.equal(await gp.getByRole('button',{name:'Принять функциональные'}).isDisabled(),true);
 await gp.getByRole('button',{name:'Сохранить выбор'}).click();
 assert.equal(await gp.evaluate(()=>JSON.parse(localStorage.getItem('nf:privacy-choice:v1')).functional),false);
 console.log('PASS: 7 legal routes, archive, mobile width, deny/accept/revoke, GPC, no Google Fonts, no page errors.');
 } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exit(1);});
