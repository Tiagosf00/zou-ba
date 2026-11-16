const {spawn}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const data=require('../assets/hsk_1_6_pdf_dataset_english.json');
const root=path.resolve(__dirname, '../tmp/ui-review');fs.mkdirSync(root,{recursive:true});
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

(async()=>{
 try {
  await connected;
  const {targetId}=await send('Target.createTarget',{url:'about:blank'});
  ({sessionId:sid}=await send('Target.attachToTarget',{targetId,flatten:true}));
  await command('Page.enable'); await command('Runtime.enable'); await viewport(1440,1000);
  const seed={version:1,updatedAt:new Date().toISOString(),settings:{hskLevels:[1],inputMode:'hanzi',outputMode:'eng',newWordsPerDay:10,studyTimeZone:'Asia/Shanghai'},progress:{cards:Object.fromEntries(data.slice(0,4).map(w=>[w.id,{box:2,lastResult:'correct',correctCount:2,wrongCount:0,unknownCount:0,consecutiveCorrect:2,lastReviewedAt:'2026-01-01T00:00:00.000Z',nextReviewAt:'2026-01-04T00:00:00.000Z'}]))}};
  await command('Page.addScriptToEvaluateOnNewDocument',{source:`if(!localStorage.getItem('zou-ba:app-state:v1:guest'))localStorage.setItem('zou-ba:app-state:v1:guest',${JSON.stringify(JSON.stringify(seed))});`});
  await command('Page.addScriptToEvaluateOnNewDocument',{source:`const NativeAudio=window.Audio;window.testAudios=[];window.Audio=function(...args){const audio=new NativeAudio(...args);window.testAudios.push(audio);return audio;};`});
  await navigate(); await pause(1000);
  console.log('Loaded', (await evaluate('document.body.innerText')).slice(0,700));
  await shot('practice-light.png');
  if(process.argv.includes('--inspect')){console.log('Backdrop',await evaluate("Array.from(document.querySelectorAll('[data-testid^=skyline]')).map(e=>({html:e.outerHTML.slice(0,1100),rect:e.getBoundingClientRect().toJSON()}))"));console.log('Images',await evaluate("Array.from(document.images).map(e=>({src:e.src.slice(0,85),complete:e.complete,w:e.naturalWidth,rect:e.parentElement.getBoundingClientRect().toJSON()}))"));return;}
  if(process.argv.includes('--responsive')){
   for(const w of [320,390,900,1120]){
    await viewport(w,900);
    for(const route of ['Practice','Listen','Books','Progress','Exam','Ranking','Settings']){
     if(w<900 && ['Exam','Ranking','Settings'].includes(route))await clickLabel('More');
     await clickLabel(route);await pause(250);
     const clipped=await evaluate(`Array.from(document.querySelectorAll('[role=button],input,textarea')).filter(e=>e.checkVisibility({checkVisibilityCSS:true})&&e.getBoundingClientRect().width>0).filter(e=>{const r=e.getBoundingClientRect();if(r.right<=innerWidth+2&&r.left>=-2)return false;for(let p=e.parentElement;p;p=p.parentElement){if(['auto','scroll'].includes(getComputedStyle(p).overflowX))return false;}return true;}).map(e=>({text:(e.textContent||e.getAttribute('aria-label')||'input').slice(0,70),right:e.getBoundingClientRect().right}))`);
     assert(!clipped.length,route+' '+w+' clipped controls '+JSON.stringify(clipped));
     if(w===900||w===390)await shot(route.toLowerCase()+'-'+w+'.png');
    }
   }
   assert(exceptions.length===0,'Runtime errors: '+exceptions.join('\n'));
   console.log('PASS: all seven screens at 320, 390, 900, 1120px; no clipped controls or runtime errors.');return;
  }
  const prompt=await evaluate("document.querySelector('[data-testid=practice-prompt]').textContent");
  const word=data.find(w=>w.hanzi===prompt);
  assert(word,'Recognized prompt');
  assert(await evaluate("!document.querySelector('[data-testid=word-example-card]')"),'No example leaks before answering');
  await clickText(word.translations.eng.join(''));
  await waitFor("!!document.querySelector('[data-testid=word-example-card]')");
  assert(await evaluate("document.querySelector('[data-testid=practice-feedback]').textContent.includes('Correct')"),'Correct answer');
  await shot('practice-correct.png');
  await clickLabel('Show example pinyin'); await clickLabel('Hide example pinyin');
  await clickText('Next word →');
  const nextPrompt=await evaluate("document.querySelector('[data-testid=practice-prompt]').textContent");
  const nextWord=data.find(w=>w.hanzi===nextPrompt);
  await evaluate(`Array.from(document.querySelectorAll('[data-testid=practice-choice] [role=button]')).filter(${visible}).find(e=>e.textContent.trim()!==${JSON.stringify(nextWord.translations.eng.join(''))}).click()`);
  await waitFor("document.querySelector('[data-testid=practice-feedback]')?.textContent.includes('Not quite')");
  await shot('practice-incorrect.png');
  await clickLabel('Switch to dark mode'); await shot('practice-dark.png');
  await clickLabel('New words');await clickText("I don't know");
  await waitFor("document.querySelector('[data-testid=practice-feedback]')?.textContent.includes('Answer revealed')");
  let saved=await evaluate("JSON.parse(localStorage.getItem('zou-ba:app-state:v1:guest'))");
  assert(Object.values(saved.progress.cards).some(c=>c.unknownCount===1),'Reveal is saved separately');
  await shot('practice-revealed-dark.png');
  await clickLabel('Progress');await waitFor("document.body.innerText.includes('Upcoming reviews')");await shot('progress-dark.png');
  for(const route of ['Listen','Books','Exam','Ranking','Settings']){await clickLabel(route);await pause(300);assert(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),route+' desktop overflow');await shot(route.toLowerCase()+'-desktop.png');}
  await clickLabel('Practice');await clickLabel('Switch to light mode');
  for(const w of [390,320,900,1120]){
   await viewport(w,900); await pause(300); assert(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),'Overflow '+w);
   if(w===390){await shot('practice-mobile.png');await clickText("I don't know");await shot('practice-mobile-feedback.png');await clickText('Next word →');await clickLabel('More');await clickLabel('Settings');await shot('settings-mobile.png');await clickLabel('Practice');}
  }
  await viewport(1440,1000);
  for(const [inputMode,outputMode] of [['hanzi','pinyin'],['pinyin','eng'],['eng','hanzi'],['audio','eng'],['hanzi','audio']]){
   await evaluate(`(()=>{const key='zou-ba:app-state:v1:guest',state=JSON.parse(localStorage.getItem(key));state.settings={...state.settings,inputMode:${JSON.stringify(inputMode)},outputMode:${JSON.stringify(outputMode)}};localStorage.setItem(key,JSON.stringify(state));})()`);
   await command('Page.reload');await waitFor("document.querySelectorAll('[data-testid=practice-choice]').length===6");
   assert(await evaluate("document.querySelectorAll('[data-testid=practice-choice]').length===6"),'Six choices '+inputMode+'/'+outputMode);
   if(inputMode==='audio'){
    await clickLabel('Play audio prompt');
    await waitFor("window.testAudios.some(a=>!a.paused && a.currentTime>0)",15000);
   }
   if(outputMode==='audio'){
    await clickLabel('Play Audio A audio');
    await waitFor("window.testAudios.some(a=>!a.paused && a.currentTime>0)",15000);
    await shot('practice-audio.png');
   }
   await clickText("I don't know");await waitFor("!!document.querySelector('[data-testid=word-example-card]')");
   if(await evaluate("!!document.querySelector('[aria-label=\"Play example sentence\"]')")){
    await clickLabel('Play example sentence');await waitFor("window.testAudios.some(a=>!a.paused && a.currentTime>0)",15000);
    if(await evaluate("!!document.querySelector('[aria-label=\"Another example\"]')")){
     await clickLabel('Another example');assert(await evaluate('window.testAudios.every(a=>a.paused)'),'Cycling stops audio');
    }
   }
   await clickText('Next word →');assert(await evaluate('window.testAudios.every(a=>a.paused)'),'Next stops audio');
  }
  // Fresh learner with a zero daily target can explicitly add an allowance.
  await evaluate(`localStorage.setItem('zou-ba:app-state:v1:guest',JSON.stringify({settings:{hskLevels:[1],newWordsPerDay:0}}))`);
  await command('Page.reload');await waitFor(`document.body.innerText.includes("Today's new-word allowance is complete.")`);
  await clickText('Learn 5 more today');await waitFor("document.querySelectorAll('[data-testid=practice-choice]').length===6");
  await clickText("I don't know");await waitFor("document.body.innerText.includes('New today: 1 / 5')");
  await clickLabel('Review');await waitFor("document.body.innerText.includes('No reviews due')");
  await shot('practice-empty-reviews.png');
  await clickLabel('Exam');await clickText('Start HSK 1 exam');await clickText("I don't know");
  await clickLabel('Meaning and examples');await clickLabel('Play example sentence');
  await waitFor("window.testAudios.some(a=>!a.paused && a.currentTime>0)",15000);
  await clickLabel('Practice');assert(await evaluate('window.testAudios.every(a=>a.paused)'),'Tab switch stops exam audio');
  assert(exceptions.length===0,'Runtime errors: '+exceptions.join('\n'));
  console.log('PASS: correct/wrong/reveal, pinyin toggle, persisted progress, queues, light/dark, all routes, responsive widths, all study formats, actual audio playback/cleanup and daily allowance.');
 } finally { if(socket?.readyState===WebSocket.OPEN){try{await send('Browser.close');}catch{}}child.kill(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
