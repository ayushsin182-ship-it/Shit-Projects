'use strict';
// Real Chromium DOM/navigation + real extension scripts with Chrome API stubs. All judge traffic is intercepted; managed Chromium forbids installing unpacked extensions here.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {spawn}=require('node:child_process');
const vm=require('node:vm');
const http=require('node:http');
const {Bridge}=require('../vscode/lib/bridge');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
class CDP {
  constructor(socket){this.socket=socket;this.n=0;this.pending=new Map();this.listeners=new Map();socket.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=this.pending.get(m.id);this.pending.delete(m.id);if(m.error)p?.reject(Error(m.error.message));else p?.resolve(m.result);}else for(const fn of this.listeners.get(m.method)||[])Promise.resolve(fn(m.params)).catch(e=>{this.error=e;});});}
  static async connect(url){const ws=new WebSocket(url);await new Promise((r,j)=>{ws.addEventListener('open',r,{once:true});ws.addEventListener('error',j,{once:true});});return new CDP(ws);}
  send(method,params={}){return new Promise((resolve,reject)=>{const id=++this.n;this.pending.set(id,{resolve,reject});this.socket.send(JSON.stringify({id,method,params}));});}
  on(name,fn){const list=this.listeners.get(name)||[];list.push(fn);this.listeners.set(name,list);}
  async evaluate(expression){const r=await this.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
  close(){this.socket.close();}
}
async function until(fn,ms=18000){const start=Date.now();while(Date.now()-start<ms){const v=await fn();if(v)return v;await sleep(150);}throw Error('Timed out waiting for browser flow');}
const cfProblem='<html><head><title>A. Sum - Codeforces</title></head><body><div class="problem-statement"><div class="title">A. Sum</div><p>Add a and b.</p><div class="sample-test"><div class="input"><pre><div class="test-example-line">2 3</div></pre></div><div class="output"><pre>5<br></pre></div></div></div></body></html>';
function cfStatus(id=100){return `<html><body><table class="status-frame-datatable"><tr data-submission-id="${id}"><td><a href="/problemset/problem/4/A">A</a></td><td><span class="submissionVerdictWrapper">Accepted</span></td><td class="time-consumed-cell">31 ms</td><td class="memory-consumed-cell">100 KB</td></tr></table></body></html>`;}
const cfForm='<html><body><form method="post" action="/problemset/submit"><input name="contestId" value="4"><select name="submittedProblemIndex"><option>A</option></select><select name="programTypeId"><option value="54">GNU G++17 7.3</option><option value="31">Python 3</option><option value="87">Java 21</option></select><textarea name="source"></textarea><input type="hidden" name="csrf_token" value="fixture-token"><button type="submit">Submit</button></form></body></html>';
const acProblem='<html><head><title>A - Sum</title></head><body><span class="h2">A - Sum</span><div id="task-statement"><div class="lang-en"><section><h3>Sample Input 1</h3><pre>2 3\n</pre></section><section><h3>Sample Output 1</h3><pre>5\n</pre></section></div><div class="lang-ja"><section><h3>入力例 1</h3><pre>2 3</pre></section><section><h3>出力例 1</h3><pre>5</pre></section></div></div></body></html>';
function acStatus(id=200){return `<html><body><div id="main-container"><table><tbody><tr><td>2026</td><td><a href="/contests/abc100/tasks/abc100_a">A</a></td><td>me</td><td>C++ 17</td><td>100</td><td>50B</td><td><span class="label submission-status">AC</span></td><td>12 ms</td><td>2048 KB</td><td><a href="/contests/abc100/submissions/${id}">Detail</a></td></tr></tbody></table></div></body></html>`;}
const acForm='<html><body><form method="post" action="/contests/abc100/submit"><select name="data.TaskScreenName"><option value="abc100_a">A</option></select><select name="data.LanguageId"><option value="5001">C++ 20 (gcc)</option><option value="5078">Python 3.11</option><option value="5005">Java 17</option></select><textarea id="sourceCode" name="sourceCode"></textarea><input type="hidden" name="csrf_token" value="fixture-token"><button type="submit">Submit</button></form></body></html>';
test('Chromium fixture flow: import, native forms, fresh verdicts, LeetCode harness and popup (Chrome API stubs)', {timeout:90000},async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'cplab-browser-'));
  const extension=path.resolve(__dirname,'../browser'),token='b'.repeat(64),imports=[],events=[];
  const bridge=new Bridge({token,onImport:async p=>{imports.push(p);return {file:'/fixture/main.cpp'};},onEvent:async(j,r)=>events.push({job:j,result:r})});
  await bridge.start();
  const fixture=http.createServer(async(req,res)=>{const file=req.url.split('?')[0].slice(1);if(!['popup.html','popup.css','popup.js'].includes(file)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',file.endsWith('.css')?'text/css':file.endsWith('.js')?'application/javascript':'text/html');res.end(await fs.readFile(path.join(extension,file)));});
  await new Promise(resolve=>fixture.listen(0,'127.0.0.1',resolve));
  const chrome=spawn(process.env.CHROMIUM||'/usr/lib/chromium/chromium',['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-background-networking','--remote-debugging-port=0',`--user-data-dir=${dir}`,'--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1','about:blank'],{stdio:['ignore','ignore','pipe'],env:{...process.env,XDG_CACHE_HOME:dir,XDG_CONFIG_HOME:dir}});
  let stderr='';chrome.stderr.on('data',d=>stderr+=d.toString());const clients=[];
  try {
    const wsURL=await until(()=>stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/)?.[1],10000);
    const address=new URL(wsURL),base=`http://${address.host}`;
    const browser=await CDP.connect(wsURL);clients.push(browser);
    const targets=()=>fetch(base+'/json/list').then(r=>r.json());
    const create=async()=>{const {targetId}=await browser.send('Target.createTarget',{url:'about:blank'});const target=await until(async()=>(await targets()).find(t=>t.id===targetId));const c=await CDP.connect(target.webSocketDebuggerUrl);clients.push(c);await c.send('Page.enable');await c.send('Runtime.enable');return {c,targetId};};
    let cfSubmitted=false,acSubmitted=false,leetSubmitted=false;const posted=[];
    const {c:page}=await create();
    const store={token};let backgroundHandler;
    const api={
      storage:{local:{get:async key=>typeof key==='string'?{[key]:store[key]}:store,set:async data=>Object.assign(store,data),remove:async key=>{delete store[key];},setAccessLevel:async()=>{}}},
      runtime:{onMessage:{addListener:fn=>backgroundHandler=fn}},
      tabs:{onRemoved:{addListener:()=>{}}},
      scripting:{executeScript:async options=>[{result:await page.evaluate(`(${options.func.toString()})(${JSON.stringify(options.args[0])})`)}]}
    };
    vm.runInNewContext(await fs.readFile(path.join(extension,'background.js'),'utf8'),{chrome:api,fetch,URL,AbortSignal,console});
    const toBackground=(msg,sender)=>new Promise(resolve=>backgroundHandler(msg,sender,resolve));
    async function bind(client,popup=false) {
      await client.send('Runtime.addBinding',{name:'cplabTransport'});
      client.on('Runtime.bindingCalled',async e=>{
        if(e.name!=='cplabTransport')return;
        const {id,msg,url}=JSON.parse(e.payload);
        const response=await toBackground(msg,popup?{}:{tab:{id:1,url},url});
        try {
          const resolved=await client.send('Runtime.evaluate',{expression:`window.__answers?.get(${JSON.stringify(id)})?.(${JSON.stringify(response)});window.__answers?.delete(${JSON.stringify(id)});`,contextId:e.executionContextId});
          if(resolved.exceptionDetails)throw Error(resolved.exceptionDetails.text);
        } catch(error) { if(!/Cannot find context|Execution context was destroyed|Inspected target navigated/.test(error.message))throw error; }
      });
    }
    const mockChrome=`window.__answers=new Map();window.__seq=0;window.chrome={runtime:{sendMessage:msg=>new Promise(resolve=>{const id=String(performance.timeOrigin)+':'+(++window.__seq);window.__answers.set(id,resolve);window.cplabTransport(JSON.stringify({id,msg,url:location.href}));}),onMessage:{addListener:fn=>window.__contentListener=fn}}};`;
    await bind(page);
    const content=await fs.readFile(path.join(extension,'content.js'),'utf8'),common=await fs.readFile(path.join(extension,'common.js'),'utf8');
    await page.send('Page.addScriptToEvaluateOnNewDocument',{source:mockChrome+';document.addEventListener("DOMContentLoaded",()=>{'+common+';'+content+'});'});

    await page.send('Fetch.enable',{patterns:[{urlPattern:'https://codeforces.com/*'},{urlPattern:'https://atcoder.jp/*'},{urlPattern:'https://leetcode.com/*'}]});
    page.on('Fetch.requestPaused',async({requestId,request})=>{
      const u=new URL(request.url);let body='',type='text/html';const headers=[];
      if(u.hostname==='codeforces.com') {
        if(u.pathname==='/problemset/problem/4/A')body=cfProblem;
        else if(u.pathname==='/problemset/status')body=cfStatus(cfSubmitted?101:100);
        else if(request.method==='POST') {cfSubmitted=true;posted.push({site:'codeforces',body:request.postData});body=cfStatus(101);}
        else body=cfForm;
      } else if(u.hostname==='atcoder.jp') {
        if(u.pathname.includes('/tasks/'))body=acProblem;
        else if(u.pathname.endsWith('/submissions/me'))body=acStatus(acSubmitted?201:200);
        else if(request.method==='POST'){acSubmitted=true;posted.push({site:'atcoder',body:request.postData});body=acStatus(201);}
        else body=acForm;
      } else {
        if(u.pathname==='/graphql/') {type='application/json';body=JSON.stringify({data:{question:{questionId:'1',title:'Two Sum',content:'<p>Find two indices.</p>',sampleTestCase:'[2,7,11,15]\n9',codeSnippets:[{langSlug:'python3',code:'class Solution:\n    def twoSum(self, nums, target):\n        pass'}]}}});}
        else if(u.pathname.endsWith('/interpret_solution/')){type='application/json';posted.push({site:'leetcode-test',body:request.postData});body=JSON.stringify({interpret_id:'run-123'});}
        else if(u.pathname.endsWith('/submit/')){type='application/json';posted.push({site:'leetcode-submit',body:request.postData});leetSubmitted=true;body=JSON.stringify({submission_id:301});}
        else if(u.pathname.includes('/check/')){type='application/json';body=JSON.stringify({state:'SUCCESS',status_code:10,status_msg:'Accepted',total_testcases:1,total_correct:1,code_answer:['[0,1]'],expected_code_answer:['[0,1]'],status_runtime:'45 ms',status_memory:'16.4 MB'});}
        else {headers.push({name:'Set-Cookie',value:'csrftoken=fixture-csrf; Path=/; Secure; SameSite=Lax'});body='<html><head><title>Two Sum - LeetCode</title></head><body>Two Sum</body></html>';}
      }
      await page.send('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:type},...headers],body:Buffer.from(body).toString('base64')});
    });
    const goto=async url=>{await page.send('Page.navigate',{url});await until(()=>page.evaluate('document.readyState === "complete"'));await sleep(500);};
    const extract=async language=>{
      const response=await page.evaluate(`new Promise(resolve=>window.__contentListener({type:'extract',language:${JSON.stringify(language)}},{},resolve))`);
      if(!response.ok)throw Error(response.error);
      const result=await toBackground({type:'import',problem:response.problem},{});if(!result.ok)throw Error(result.error);return response.problem;
    };
    await goto('https://codeforces.com/problemset/problem/4/A');
    const cp=await extract('cpp');assert.equal(cp.samples[0].input,'2 3\n');assert.equal(cp.samples[0].output,'5\n');assert.equal(imports.length,1);
    const cpp='#include <iostream>\nint main(){std::cout<<5;}';
    const cfJob=bridge.addJob({kind:'submit',url:cp.url,site:cp.site,language:'cpp',code:cpp});
    const cfEvent=await until(()=>events.find(e=>e.job.id===cfJob.id),18000);
    assert.equal(cfEvent.result.verdict,'Accepted',JSON.stringify(cfEvent.result));assert.equal(cfEvent.result.submissionId,'101');assert.equal(cfEvent.result.time,'31 ms');assert.equal(cfEvent.result.memory,'100 KB');
    assert.equal(new URLSearchParams(posted[0].body).get('source')?.replace(/\r\n/g,'\n'),cpp);assert.equal(new URLSearchParams(posted[0].body).get('programTypeId'),'54');
    await goto('https://atcoder.jp/contests/abc100/tasks/abc100_a');
    const ap=await extract('java');assert.equal(ap.samples.length,1);assert.equal(ap.samples[0].output,'5\n');
    const java='public class Main { public static void main(String[] args){System.out.println(5);} }';
    const acJob=bridge.addJob({kind:'submit',url:ap.url,site:ap.site,language:'java',code:java});
    const acEvent=await until(()=>events.find(e=>e.job.id===acJob.id),18000);
    assert.equal(acEvent.result.verdict,'AC',JSON.stringify(acEvent.result));assert.equal(acEvent.result.submissionId,'201');assert.equal(acEvent.result.memory,'2048 KB');
    const acBody=new URLSearchParams(posted.find(p=>p.site==='atcoder').body);assert.equal(acBody.get('sourceCode'),java);assert.equal(acBody.get('data.LanguageId'),'5005');
    await goto('https://leetcode.com/problems/two-sum/');
    const lp=await extract('python');assert.equal(lp.questionId,'1');assert.match(lp.snippet,/class Solution/);
    const python='class Solution:\n    def twoSum(self, nums, target): return [0,1]';
    const testJob=bridge.addJob({...lp,kind:'test',code:python});
    const testEvent=await until(()=>events.find(e=>e.job.id===testJob.id),18000);assert.equal(testEvent.result.passed,true,JSON.stringify(testEvent.result));
    const submitJob=bridge.addJob({...lp,kind:'submit',code:python});
    const lcEvent=await until(()=>events.find(e=>e.job.id===submitJob.id),18000);assert.equal(lcEvent.result.verdict,'Accepted');assert.equal(lcEvent.result.time,'45 ms');assert.equal(leetSubmitted,true);
    const lcBody=JSON.parse(posted.find(p=>p.site==='leetcode-submit').body);assert.equal(lcBody.lang,'python3');assert.equal(lcBody.typed_code,python);
    // Real popup markup/scripts; stub Chrome APIs, keep the real authenticated bridge.
    const {c:popup}=await create();
    await bind(popup,true);
    await popup.send('Page.addScriptToEvaluateOnNewDocument',{source:mockChrome+`;chrome.tabs={query:async()=>[{id:1,url:'https://leetcode.com/problems/two-sum/',title:'Two Sum - LeetCode'}]};chrome.storage={local:{get:async()=>({language:'python'}),set:async()=>{}}};`});
    await popup.send('Page.navigate',{url:`http://127.0.0.1:${fixture.address().port}/popup.html`});
    const popupErrors=[];popup.on('Runtime.exceptionThrown',e=>popupErrors.push(e));
    await until(()=>popup.evaluate('document.getElementById("connection")?.textContent.includes("Connected")')).catch(async e=>{throw Error(e.message+' popup='+await popup.evaluate('document.body.innerText.slice(0,2000)')+' api='+await popup.evaluate('typeof chrome.runtime.sendMessage')+' errors='+JSON.stringify(popupErrors)+' transport='+popup.error);});
    assert.equal(await popup.evaluate('document.getElementById("verdict").textContent'),'Accepted');
    await popup.send('Emulation.setDeviceMetricsOverride',{width:388,height:850,deviceScaleFactor:2,mobile:false});
    const screenshot=await popup.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
    const preview=process.env.CPLAB_PREVIEW;if(preview)await fs.writeFile(preview,Buffer.from(screenshot.data,'base64'));
    assert.equal(page.error,undefined);assert.equal(imports.length,3);
  } finally {
    for(const c of clients)c.close();chrome.kill('SIGKILL');await new Promise(resolve=>fixture.close(resolve));await bridge.close();await fs.rm(dir,{recursive:true,force:true,maxRetries:4,retryDelay:100});
  }
});
