const {spawn}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const data=require('../assets/hsk_1_6_pdf_dataset_english.json');
const root=path.resolve(__dirname, '../tmp/example-layout');fs.mkdirSync(root,{recursive:true});
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


const key='zou-ba:app-state:v1:guest';
const word=data.find(w=>w.hanzi==='它');
const seed={settings:{vocabularyPool:'custom',customCardIds:[word.id,...data.slice(0,5).map(w=>w.id)],inputMode:'hanzi',outputMode:'pinyin',themeMode:'dark'},progress:{cards:{[word.id]:{box:2,lastResult:'correct',correctCount:2,wrongCount:0,unknownCount:0,consecutiveCorrect:2,lastReviewedAt:'2026-01-01T00:00:00.000Z',nextReviewAt:'2026-01-02T00:00:00.000Z'}}}};
(async()=>{
 try{
  await connected;const {targetId}=await send('Target.createTarget',{url:'about:blank'});
  ({sessionId:sid}=await send('Target.attachToTarget',{targetId,flatten:true}));await command('Page.enable');await command('Runtime.enable');await viewport(1324,1159);
  await command('Page.addScriptToEvaluateOnNewDocument',{source:`if(!localStorage.getItem('${key}'))localStorage.setItem('${key}',${JSON.stringify(JSON.stringify(seed))});const NativeAudio=window.Audio;window.testAudios=[];window.Audio=function(...args){const audio=new NativeAudio(...args);window.testAudios.push(audio);return audio;};`});
  await navigate();await pause(500);await clickText(word.pinyin);await waitFor("!!document.querySelector('[data-testid=word-example-card]')");
  const layout=await evaluate(`(()=>{const sentence=document.querySelector('[data-testid=word-example-chinese]'),controls=document.querySelector('[data-testid=example-controls]'),source=document.querySelector('[data-testid=example-source]'),panel=document.querySelector('#practice-panel'),detail=Array.from(document.querySelectorAll('[role=button]')).find(e=>e.textContent.includes('Detailed meaning'));return {font:parseFloat(getComputedStyle(sentence).fontSize),sentence:sentence.getBoundingClientRect().toJSON(),controls:controls.getBoundingClientRect().toJSON(),source:source.getBoundingClientRect().toJSON(),panel:panel.getBoundingClientRect().toJSON(),detail:detail.getBoundingClientRect().toJSON(),sourceOutside:!source.closest('#practice-panel')};})()`);
  assert(layout.font>=40,'The Chinese example must lead the typography');
  assert(layout.controls.top>=layout.sentence.bottom,'Controls below the sentence');
  assert(layout.detail.top>=layout.sentence.bottom,'Detailed meaning below the example');
  assert(layout.sourceOutside && layout.source.top>=layout.panel.bottom,'Source credit belongs outside the example/card');
  assert(await evaluate("!document.querySelector('[data-testid=word-example-english]')&&!document.querySelector('[data-testid=word-example-pinyin]')"),'Hints hidden initially');
  await shot('example-focus-dark.png');
  await clickLabel('Show example English');await clickLabel('Show example pinyin');
  await clickLabel('Play example sentence');await waitFor('window.testAudios.some(a=>!a.paused&&a.currentTime>0)',15000);
  await clickLabel('Another example');assert(await evaluate('window.testAudios.every(a=>a.paused)'),'Changing examples stops playback');
  assert(await evaluate("!document.querySelector('[data-testid=word-example-english]')&&!document.querySelector('[data-testid=word-example-pinyin]')"),'Changing examples hides hints');
  await evaluate("Array.from(document.querySelectorAll('[role=button]')).find(e=>e.textContent.includes('Detailed meaning')).click()");
  assert((await evaluate('document.body.innerText')).includes(word.detailedEnglishTranslation),'Meaning remains available');
  await evaluate("Array.from(document.querySelectorAll('[role=button]')).find(e=>e.textContent.includes('Detailed meaning')).click()");
  let originalSize;
  for(const width of [1324,2323,320,390]){
   await viewport(width,1159);await pause(350);
   const skyline=await evaluate("document.querySelector('[data-testid=skyline-image]').getBoundingClientRect().toJSON()");
   if(width===1324)originalSize=skyline;
   if(width===2323){assert(Math.abs(skyline.width-originalSize.width)<1&&Math.abs(skyline.height-originalSize.height)<1,'Landmarks must not grow on fullscreen');assert(skyline.height<220,'Keep skyline small');}
   assert(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),'No horizontal overflow '+width);
   const clipped=await evaluate("Array.from(document.querySelectorAll('[data-testid=example-controls] [role=button]')).some(e=>e.getBoundingClientRect().right>innerWidth+1)");
   assert(!clipped,'Controls fit '+width);await shot('layout-'+width+'.png');
  }
  await viewport(1324,1159);await clickLabel('Switch to light mode');await shot('example-focus-light.png');
  assert(exceptions.length===0,'Runtime errors: '+exceptions.join('\n'));
  console.log('PASS: large example-first layout, quiet controls below, footer attribution outside the card, translation/pinyin/audio/cycling/details preserved, fixed skyline dimensions at 1324/2323px and responsive phone layouts.');
 }catch(error){console.error('Browser exceptions:',exceptions);throw error;}finally{if(socket?.readyState===WebSocket.OPEN){try{await send('Browser.close');}catch{}}child.kill();}
})().catch(error=>{console.error(error);process.exitCode=1;});
