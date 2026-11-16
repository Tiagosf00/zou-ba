const {spawn}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const data=require('../assets/hsk_1_6_pdf_dataset_english.json');
const root=path.resolve(__dirname, '../tmp/manual-review');fs.mkdirSync(root,{recursive:true});
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
async function clickText(label){await evaluate(`(()=>{const e=Array.from(document.querySelectorAll('[role=button]')).filter(${visible}).find(e=>e.textContent.trim().includes(${JSON.stringify(label)}));if(!e)throw Error('Missing button '+${JSON.stringify(label)});e.click()})()`);await pause(160);}
async function viewport(width,height){await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});}
async function shot(name){await pause(180);const r=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(root,name),Buffer.from(r.data,'base64'));}
function assert(value,message){if(!value)throw Error(message);}


const storageKey='zou-ba:app-state:v1:guest';
const [target, existing, third]=data.filter(w=>w.level===4&&w.hanzi.length===2).slice(0,3);
const existingEntry={box:3,lastResult:'correct',correctCount:7,wrongCount:2,unknownCount:0,consecutiveCorrect:3,lastReviewedAt:'2026-11-01T00:00:00.000Z',nextReviewAt:'2099-01-01T00:00:00.000Z'};
const seed={settings:{hskLevels:[1],inputMode:'hanzi',outputMode:'pinyin',newWordsPerDay:0,themeMode:'dark'},progress:{cards:{[existing.id]:existingEntry}}};
const state=()=>evaluate(`JSON.parse(localStorage.getItem('${storageKey}'))`);
async function input(label,value){await evaluate(`(()=>{const e=document.querySelector('[aria-label="${label}"]');const proto=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);await pause(180);}
async function restore(value){await evaluate(`localStorage.setItem('${storageKey}',${JSON.stringify(JSON.stringify(value))})`);await command('Page.reload');await waitFor("!!document.querySelector('[aria-label=\"Practice settings\"]')");await pause(400);}
const search=value=>input('Search words to add to review',value);
(async()=>{
 try{
  await connected;const {targetId}=await send('Target.createTarget',{url:'about:blank'});
  ({sessionId:sid}=await send('Target.attachToTarget',{targetId,flatten:true}));await command('Page.enable');await command('Runtime.enable');await viewport(1142,1085);
  await command('Page.addScriptToEvaluateOnNewDocument',{source:`if(!localStorage.getItem('${storageKey}'))localStorage.setItem('${storageKey}',${JSON.stringify(JSON.stringify(seed))});const NativeAudio=window.Audio;window.testAudios=[];window.Audio=function(...args){const a=new NativeAudio(...args);window.testAudios.push(a);return a;};`});
  await navigate();await pause(400);
  assert(await evaluate("!!document.querySelector('[aria-label=\"Search words to add to review\"]')"),'Search available with zero daily allowance');
  for(const query of [target.hanzi,target.pinyin,target.pinyin.normalize('NFD').replace(/[\u0300-\u036f\s]/g,''),target.translations.eng[0]]){
   await search(query);await waitFor(`!!document.querySelector('[data-testid="word-search-result-${target.id}"]')`);
  }
  await search(target.hanzi);
  await evaluate(`(()=>{const b=document.querySelector('[data-testid="word-search-result-${target.id}"] [role=button]');b.click();b.click();})()`);
  await waitFor(`JSON.parse(localStorage.getItem('${storageKey}')).settings.reviewCardIds.includes(${target.id})`);
  let saved=await state();assert(saved.settings.reviewCardIds.length===1,'No duplicate additions');assert(!saved.progress.cards[target.id],'Adding does not fake an answer');
  assert(await evaluate(`document.querySelector('[data-testid="word-search-result-${target.id}"] [role=button]').getAttribute('aria-disabled')==='true'`),'Already enrolled result is disabled');
  await shot('search-dark.png');
  await command('Page.reload');await waitFor(`document.querySelector('[data-testid=practice-prompt]')?.textContent===${JSON.stringify(target.hanzi)}`);
  assert(await evaluate("document.querySelectorAll('[data-testid=practice-choice]').length===6"),'Six options on first manual review');
  await clickText(target.pinyin);await waitFor(`JSON.parse(localStorage.getItem('${storageKey}')).progress.cards['${target.id}']?.correctCount===1`);
  await clickText('Next word →');await waitFor("document.body.innerText.includes('No reviews due')");
  await clickLabel('New words');await search(existing.hanzi);await clickLabel(`Add to review: ${existing.hanzi}, ${existing.pinyin}`);
  await waitFor(`JSON.parse(localStorage.getItem('${storageKey}')).settings.reviewCardIds.includes(${existing.id})`);
  saved=await state();assert(JSON.stringify(saved.progress.cards[existing.id])===JSON.stringify(existingEntry),'Existing counts/schedule preserved');
  await search('zzzznotaword');assert((await evaluate('document.body.innerText')).includes('No matching words.'),'Empty results');
  await clickLabel('Clear word search');assert(!await evaluate("document.querySelector('[data-testid=word-search-results]')!==null"),'Clearing hides results');
  await search('你好');
  for(const width of [390,320]){await viewport(width,1085);await pause(250);assert(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),'No overflow at '+width);await shot('search-'+width+'.png');}
  await viewport(1142,1085);await clickLabel('Switch to light mode');await shot('search-light.png');
  // A single added word is reviewable even with an empty custom set.
  saved.settings={...saved.settings,vocabularyPool:'custom',customCardIds:[],reviewCardIds:[third.id]};saved.progress.cards={};
  await restore(saved);await waitFor(`document.querySelector('[data-testid=practice-prompt]')?.textContent===${JSON.stringify(third.hanzi)}`);
  assert(await evaluate("document.querySelectorAll('[data-testid=practice-choice]').length===6"),'One-word deck borrows distractors');
  saved.settings.practiceAnswerStyle='self-review';await restore(saved);await clickText('Show answer');
  assert(!(await state()).progress.cards[third.id],'Reveal is read-only');await clickText('Remembered');await waitFor(`JSON.parse(localStorage.getItem('${storageKey}')).progress.cards['${third.id}']?.correctCount===1`);
  await clickLabel('Listen');await pause(300);
  const listen=await evaluate('document.body.innerText');for(const text of ['Dictation','Play the recording as often','The sentence stays hidden','What did you hear?','Listening card'])assert(!listen.includes(text),'Removed copy: '+text);
  await shot('listen-light.png');await clickLabel('Play sentence at normal');await waitFor('window.testAudios.some(a=>!a.paused&&a.currentTime>0)',15000);
  await input('Chinese sentence answer','测试');await clickText('Check answer');await waitFor("document.body.innerText.includes('Next sentence')");await clickText('Next sentence');await clickText('Reveal');await waitFor("document.body.innerText.includes('Next sentence')");
  await clickLabel('Books');await pause(300);assert(!(await evaluate('document.body.innerText')).includes('Choose a track to start listening'),'No empty-player instructions');await shot('books-light.png');
  await evaluate("(()=>{if(!document.querySelector('[aria-label^=\"Play Track\"]'))Array.from(document.querySelectorAll('[role=button]')).find(e=>e.textContent.includes('Lesson 1')&&e.textContent.includes('tracks')).click();})()");await pause(200);
  await evaluate("Array.from(document.querySelectorAll('[aria-label]')).find(e=>e.getBoundingClientRect().width>0&&e.getAttribute('aria-label').startsWith('Play Track')).click()");await pause(500);
  assert(await evaluate("!!document.querySelector('[aria-label=\"Next textbook track\"]')"),'Selected track opens player');
  assert(await evaluate("Array.from(document.querySelectorAll('textarea')).some(e=>e.getAttribute('aria-label')?.startsWith('Private transcript'))"),'Transcript editor retained');
  for(const width of [1142,390]){await viewport(width,1085);await pause(200);assert(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),'Books fits '+width);}
  assert(exceptions.length===0,'Browser errors: '+exceptions.join('\n'));
  console.log('PASS: search, duplicate prevention, out-of-level reviews, saved state, daily-limit bypass, existing schedules, single-word choice/self review, phone layouts, Listen audio/check/reveal, Books player and transcript.');
 }catch(error){console.error('Browser exceptions:',exceptions);throw error;}finally{if(socket?.readyState===WebSocket.OPEN){try{await send('Browser.close');}catch{}}child.kill();}
})().catch(error=>{console.error(error);process.exitCode=1;});
