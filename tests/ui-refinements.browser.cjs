const {spawn}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const data=require('../assets/hsk_1_6_pdf_dataset_english.json');
const root=path.resolve(__dirname, '../tmp/ui-feedback');fs.mkdirSync(root,{recursive:true});
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'zou-ba-design-qa-'));
const child=spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',[
 '--headless=new','--remote-debugging-port=0','--no-first-run','--no-default-browser-check',
 '--disable-background-networking','--disable-extensions','--disable-sync',
 '--disable-component-update',`--user-data-dir=${profile}`,'about:blank'
],{windowsHide:true,stdio:['ignore','ignore','pipe']});
const pending=new Map();let sequence=0,socket;const exceptions=[];
const connected=new Promise((resolve,reject)=>{
 let logs='';const timer=setTimeout(()=>reject(Error('Browser connection failed: '+logs.slice(-2000))),15000);
 child.stderr.on('data',data=>{logs+=data.toString();const match=logs.match(/DevTools listening on (ws:\/\/\S+)/);if(match&&!socket){socket=new WebSocket(match[1]);socket.addEventListener('open',()=>{clearTimeout(timer);resolve();});socket.addEventListener('error',e=>{clearTimeout(timer);reject(Error(e.message||'Browser socket failed'));});socket.addEventListener('message',e=>receive(e.data));}});
 child.once('exit',code=>{if(!socket){clearTimeout(timer);reject(Error('Browser exited '+code+': '+logs));}});
});
child.on('error',e=>console.error('Browser launch:',e.message));
function receive(raw){
  const message=JSON.parse(raw);if(message.id&&pending.has(message.id)){const item=pending.get(message.id);pending.delete(message.id);clearTimeout(item.timer);message.error?item.reject(Error(JSON.stringify(message.error))):item.resolve(message.result);}
  if(message.method==='Runtime.exceptionThrown')exceptions.push(message.params.exceptionDetails.text+' '+(message.params.exceptionDetails.exception?.description||''));
}
function send(method,params={},sessionId){return new Promise((resolve,reject)=>{const id=++sequence;const timer=setTimeout(()=>{pending.delete(id);reject(Error('Timed out: '+method));},15000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});}
let sid;
const command=(method,params)=>send(method,params,sid);
async function evaluate(expression){const r=await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function waitFor(expression, timeout=90000) { const start=Date.now(); while(Date.now()-start<timeout){if(await evaluate(expression))return;await pause(250);}throw Error('Wait failed: '+expression+'\n'+(await evaluate('document.body.innerText')).slice(0,1500)); }
async function navigate(){await command('Page.navigate',{url:process.env.TEST_BASE_URL || 'http://localhost:8091'});await waitFor("!!document.querySelector('[aria-label=\"Practice settings\"]')");}
const visible="e=>e.getBoundingClientRect().width>0 && e.getBoundingClientRect().height>0";
async function clickLabel(label){await evaluate(`(()=>{const e=Array.from(document.querySelectorAll('[aria-label]')).filter(${visible}).find(e=>e.getAttribute('aria-label')===${JSON.stringify(label)});if(!e)throw Error('Missing label '+${JSON.stringify(label)});e.click()})()`);await pause(160);}
async function clickText(label){await evaluate(`(()=>{const e=Array.from(document.querySelectorAll('[role=button]')).filter(${visible}).find(e=>e.textContent.trim()===${JSON.stringify(label)});if(!e)throw Error('Missing button '+${JSON.stringify(label)});e.click()})()`);await pause(160);}
async function viewport(width,height){await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});}
async function shot(name){await pause(180);const r=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(root,name),Buffer.from(r.data,'base64'));}
function assert(value,message){if(!value)throw Error(message);}


// Run with Node 22+ against the local preview; Chrome uses an isolated test profile.
const storageKey='zou-ba:app-state:v1:guest';
const target=data.find(word=>word.hanzi==='上');
const longest=data.slice().sort((a,b)=>b.pinyin.length-a.pinyin.length).slice(0,5);
const cards=Object.fromEntries([[target.id,{box:2,lastResult:'correct',correctCount:2,wrongCount:0,unknownCount:0,consecutiveCorrect:2,lastReviewedAt:'2026-01-01T00:00:00.000Z',nextReviewAt:'2026-01-02T00:00:00.000Z'}]]);
const seed={version:1,settings:{vocabularyPool:'custom',customCardIds:[target.id,...longest.map(word=>word.id)],hskLevels:[1],inputMode:'hanzi',outputMode:'pinyin',newWordsPerDay:10,studyTimeZone:'Asia/Shanghai'},progress:{cards}};
const readProgress=()=>evaluate(`JSON.stringify(JSON.parse(localStorage.getItem('${storageKey}')).progress?.cards||{})`);
async function setState(state){await evaluate(`localStorage.setItem('${storageKey}',${JSON.stringify(JSON.stringify(state))})`);await command('Page.reload');await waitFor("!!document.querySelector('[aria-label=\"Practice settings\"]')");await pause(300);}
async function pinyinCheck(){
 const result=await evaluate(`Array.from(document.querySelectorAll('[data-testid=practice-choice] [role=button]')).map(button=>{const label=Array.from(button.querySelectorAll('*')).find(e=>e.childNodes.length===1&&e.firstChild.nodeType===3);const range=document.createRange();range.selectNodeContents(label);return {text:label.textContent,lines:range.getClientRects().length,clipped:range.getBoundingClientRect().width>label.getBoundingClientRect().width+1};})`);
 assert(result.length===6,'Six pinyin options');
 assert(result.every(x=>x.lines===1&&!x.clipped),'Pinyin must be fully visible on one line: '+JSON.stringify(result));
}
(async()=>{
 try{
  await connected;const {targetId}=await send('Target.createTarget',{url:'about:blank'});
  ({sessionId:sid}=await send('Target.attachToTarget',{targetId,flatten:true}));
  await command('Page.enable');await command('Runtime.enable');await viewport(1288,1159);
  await command('Page.addScriptToEvaluateOnNewDocument',{source:`if(!localStorage.getItem('${storageKey}'))localStorage.setItem('${storageKey}',${JSON.stringify(JSON.stringify(seed))});`});
  await navigate();await pause(600);
  await pinyinCheck();assert(!(await evaluate('document.body.innerText')).match(/HSK [1-6]/),'Practice must not show level hints');
  await shot('pinyin-skyline-light.png');
  await clickText(target.pinyin);await waitFor("!!document.querySelector('[data-testid=word-example-card]')");
  assert(await evaluate("!document.querySelector('[data-testid=word-example-pinyin]')&&!document.querySelector('[data-testid=word-example-english]')"),'Both reading aids start hidden');
  const underline=await evaluate("getComputedStyle(document.querySelector('[data-testid=word-example-highlight]')).textUnderlineOffset");
  assert(parseFloat(underline)>=5,'Underline must sit below glyph: '+underline);
  await shot('example-chinese-only.png');
  await clickLabel('Show example English');assert(await evaluate("!!document.querySelector('[data-testid=word-example-english]')"),'English reveal');
  await clickLabel('Show example pinyin');await clickLabel('Hide example English');assert(await evaluate("!!document.querySelector('[data-testid=word-example-pinyin]')&&!document.querySelector('[data-testid=word-example-english]')"),'Toggles are independent');
  if(await evaluate("!!document.querySelector('[aria-label=\"Another example\"]')"))await clickLabel('Another example');
  assert(await evaluate("!document.querySelector('[data-testid=word-example-pinyin]')&&!document.querySelector('[data-testid=word-example-english]')"),'New examples reset reading aids');
  await clickLabel('Settings');await clickLabel('Answer format: Self review');
  await waitFor(`JSON.parse(localStorage.getItem('${storageKey}')).settings.practiceAnswerStyle==='self-review'`);
  let prefs=await evaluate(`JSON.parse(localStorage.getItem('${storageKey}')).settings`);
  assert(prefs.outputMode==='pinyin','Preserve the choice/exam format');
  assert(await evaluate("!document.querySelector('[aria-label=\"Prompt format: Self review\"]')"),'Self review is output-only');
  await setState({settings:{...prefs,customCardIds:[target.id]},progress:{cards:{}}});
  await waitFor("Array.from(document.querySelectorAll('[role=button]')).some(e=>e.textContent==='Show answer')");
  const before=await readProgress();await shot('self-review-question.png');
  await clickText('Show answer');await waitFor("!!document.querySelector('[data-testid=self-review-answer]')");
  assert(await readProgress()===before,'Revealing must not record an answer');
  assert(await evaluate("!document.querySelector('[data-testid=practice-choice]')"),'Self review has no choice grid');
  const complete=await evaluate("document.querySelector('[data-testid=self-review-answer]').textContent");
  assert(complete.includes(target.hanzi)&&complete.includes(target.pinyin)&&complete.includes(target.detailedEnglishTranslation),'The full answer is visible');
  assert(!await evaluate("Array.from(document.querySelectorAll('[role=button]')).some(e=>e.textContent==='Next word →')"),'Cannot advance before rating');
  await shot('self-review-answer.png');
  await command('Page.reload');await waitFor("Array.from(document.querySelectorAll('[role=button]')).some(e=>e.textContent==='Show answer')");
  assert(await readProgress()===before,'Reloading an unrated card does not grade it');
  await clickText('Show answer');
  await evaluate("(()=>{const b=Array.from(document.querySelectorAll('[role=button]')).find(e=>e.textContent==='Remembered');b.click();b.click()})()");
  await waitFor(`JSON.parse(localStorage.getItem('${storageKey}')).progress.cards['${target.id}']?.correctCount===1`);
  let saved=await evaluate(`JSON.parse(localStorage.getItem('${storageKey}'))`);
  assert(saved.progress.cards[target.id].correctCount===1,'Double clicks count once');
  assert(saved.progress.cards[target.id].introducedAt,'New introduction is recorded on rating');
  await waitFor("document.body.innerText.includes('All words in this set introduced')");
  // Revisit the same word as a due review, then rate failed recall.
  saved.progress.cards[target.id].nextReviewAt='2026-01-01T00:00:00.000Z';
  await setState(saved);await clickText('Show answer');await clickText("Didn't remember");
  await waitFor(`JSON.parse(localStorage.getItem('${storageKey}')).progress.cards['${target.id}'].wrongCount===1`);
  saved=await evaluate(`JSON.parse(localStorage.getItem('${storageKey}'))`);
  const entry=saved.progress.cards[target.id];
  assert(entry.correctCount===1&&entry.unknownCount===0&&entry.box===0,'Failed recall is one incorrect review');
  assert(Date.parse(entry.nextReviewAt)-Date.parse(entry.lastReviewedAt)===120000,'Failed recall keeps the two-minute retry');
  await waitFor("document.body.innerText.includes('No reviews due')");
  // Either rating advances to a fresh, unrevealed card without a Next word click.
  for(const rating of ['Remembered', "Didn't remember"]){
   await setState({settings:{...prefs,customCardIds:[target.id,longest[0].id]},progress:{cards:{}}});
   const first=await evaluate("document.querySelector('[data-testid=practice-prompt]').textContent");
   await clickText('Show answer');await clickText(rating);
   await waitFor(`document.querySelector('[data-testid=practice-prompt]')?.textContent!==${JSON.stringify(first)} && !!document.querySelector('[data-testid=practice-prompt]')`);
   assert(await evaluate("!document.querySelector('[data-testid=self-review-answer]')&&!document.querySelector('[data-testid=recall-rating]')"),'Next card starts unrevealed');
   assert(await evaluate("Array.from(document.querySelectorAll('[role=button]')).some(e=>e.textContent==='Show answer')"),'Next card is ready to reveal');
  }
  await clickLabel('Settings');await clickLabel('Answer format: Pinyin');await waitFor(`JSON.parse(localStorage.getItem('${storageKey}')).settings.practiceAnswerStyle==='choice'`);
  for(const width of [320,390,1120]){
   await viewport(width,900);await setState(seed);await pinyinCheck();
   await clickText(target.pinyin);await waitFor("!!document.querySelector('[data-testid=word-example-card]')");await pause(400);
   await clickLabel('Show example English');await clickLabel('Show example pinyin');
   const overflow=await evaluate(`Array.from(document.querySelectorAll('[data-testid=word-example-card] [role=button]')).some(e=>e.getBoundingClientRect().right>innerWidth+1)`);
   assert(!overflow,'Example controls fit at '+width);await shot('example-'+width+'.png');
  }
  await viewport(1288,1159);await setState({...seed,settings:{...seed.settings,themeMode:'dark'}});await shot('pinyin-skyline-dark.png');
  await setState({settings:{...prefs,themeMode:'dark',customCardIds:[target.id]},progress:{cards:{}}});await clickText('Show answer');await shot('self-review-dark.png');
  await viewport(390,844);await setState({settings:{...prefs,customCardIds:[target.id]},progress:{cards:{}}});await clickText('Show answer');await pause(400);await shot('self-review-mobile.png');
  assert(exceptions.length===0,'Runtime errors: '+exceptions.join('\n'));
  console.log('PASS: English/pinyin toggles, reset per example, lowered underline, single-line pinyin including long answers at phone widths, no HSK hints, self-review settings/refresh, read-only reveal, one-word decks, remembered/forgotten ratings, duplicate guard, scheduling and mobile/dark layouts.');
 }catch(error){console.error('Browser exceptions:',exceptions);throw error;}finally{if(socket?.readyState===WebSocket.OPEN){try{await send('Browser.close');}catch{}}child.kill();}
})().catch(error=>{console.error(error);process.exitCode=1;});
