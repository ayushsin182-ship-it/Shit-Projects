'use strict';
const C=CPLab;
let busy=false;
function message(data) {return chrome.runtime.sendMessage(data).then(r=>{if(!r?.ok)throw Error(r?.error||'Extension unavailable.');return r.data;});}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function finish(job,result) {await message({type:'event',jobId:job.id,result});}
async function loadRows(p) {
  const url=C.nativeUrls(p).status;
  const r=await fetch(url,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!r.ok)throw Error(`Cannot read submissions: HTTP ${r.status}. Open your judge submissions page.`);
  return C.nativeRows(new DOMParser().parseFromString(await r.text(),'text/html'),p);
}
async function nativeStart(job) {
  const problem=C.identify(job.url),urls=C.nativeUrls(problem);
  const rows=await loadRows(problem);
  const baseline=rows.reduce((max,row)=>BigInt(row.submissionId)>BigInt(max)?row.submissionId:max,'0');
  await message({type:'setPending',pending:{job,problem,phase:'fill',baseline,started:Date.now()}});
  location.assign(urls.submit);
}
async function nativeResume(pending) {
  const {job,problem}=pending;
  if(Date.now()-pending.started>180000) {
    await finish(job,{passed:false,verdict:'Result not available yet',details:'The judge did not expose a final result within three minutes. Check My Submissions before retrying.',time:null,memory:null});return;
  }
  if(pending.phase==='fill') {
    if(!location.pathname.includes('/submit'))throw Error('Submission page unavailable. Log in and check contest registration, then retry.');
    // Persist before submitting, so a full page navigation cannot send the code twice.
    await message({type:'setPending',pending:{...pending,phase:'watch'}});
    await message({type:'fillNative',jobId:job.id});return;
  }
  const formError=location.pathname.includes('/submit')?document.querySelector('.alert-danger, .error'):null;
  if(formError?.textContent.trim())throw Error(formError.textContent.trim());
  const rows=await loadRows(problem);
  const row=rows.filter(r=>r.matches && BigInt(r.submissionId)>BigInt(pending.baseline)).sort((a,b)=>BigInt(a.submissionId)<BigInt(b.submissionId)?-1:1)[0];
  if(!row)return;
  if(!C.isFinal(row.verdict) && pending.lastVerdict!==row.verdict) {
    await message({type:'progress',jobId:job.id,result:{...row,details:'The judge is processing your submission.'}});
    await message({type:'setPending',pending:{...pending,lastVerdict:row.verdict}});
  }
  if(C.isFinal(row.verdict))await finish(job,{...row,passed:/^(Accepted|AC)$/i.test(row.verdict),details:'Final result read from your judge submissions page.'});
}
function csrfToken() {
  const cookie=document.cookie.split(';').map(s=>s.trim()).find(s=>s.startsWith('csrftoken='));
  if(!cookie)throw Error('LeetCode CSRF token unavailable. Log in on the problem page, refresh, and try again.');
  return decodeURIComponent(cookie.slice('csrftoken='.length));
}
async function leetStart(job) {
  const p=C.identify(job.url);
  await message({type:'setPending',pending:{job,phase:'sending',started:Date.now()}});
  const body={lang:{cpp:'cpp',python:'python3',java:'java'}[job.language],question_id:job.questionId,typed_code:job.code};
  if(job.kind==='test')body.data_input=job.testInput;
  const data=await C.jsonFetch(`/problems/${p.slug}/${job.kind==='test'?'interpret_solution':'submit'}/`,{method:'POST',headers:{'Content-Type':'application/json','X-CSRFToken':csrfToken()},body:JSON.stringify(body)});
  const id=data.submission_id??data.interpret_id;
  if(!id || !/^[\w-]+$/.test(String(id)))throw Error(data.error||data.detail||'LeetCode did not return a submission ID. Check login and rate limits.');
  await message({type:'setPending',pending:{job,phase:'leetPoll',id:String(id),started:Date.now()}});
}
async function leetResume(pending) {
  const {job}=pending;
  if(pending.phase==='sending')throw Error('The page reloaded while sending code. Check LeetCode submissions before retrying.');
  if(Date.now()-pending.started>180000) {
    await finish(job,{passed:false,verdict:'LeetCode result still pending',submissionId:pending.id,details:'Check the judge before retrying.',time:null,memory:null});return;
  }
  const data=await C.jsonFetch(`/submissions/detail/${pending.id}/check/`);
  if(data.state!=='SUCCESS') {
    const verdict='LeetCode: '+(data.state||'Pending');
    if(pending.lastVerdict!==verdict) {
      await message({type:'progress',jobId:job.id,result:{verdict,submissionId:pending.id,details:'Waiting for the judge.'}});
      await message({type:'setPending',pending:{...pending,lastVerdict:verdict}});
    }
    return;
  }
  await finish(job,{...C.leetResult(data,job.kind),submissionId:pending.id});
}
async function tick() {
  if(busy)return;busy=true;
  let active;
  try {
    active=await message({type:'pending'});
    if(active) {
      if(active.job.site==='leetcode')await leetResume(active);else await nativeResume(active);
      return;
    }
    let p;try{p=C.identify(location.href);}catch{return;}
    const {job}=await message({type:'poll',url:p.url});
    if(!job)return;active={job};
    if(job.site==='leetcode')await leetStart(job);else await nativeStart(job);
  } catch(e) {
    if(active?.job)try{await finish(active.job,{passed:false,verdict:'Browser action needs attention',details:e.message,time:null,memory:null});}catch{}
  } finally {busy=false;}
}
chrome.runtime.onMessage.addListener((msg,_sender,respond)=>{
  if(msg.type!=='extract')return;
  C.extract(msg.language).then(p=>respond({ok:true,problem:p}),e=>respond({ok:false,error:e.message}));return true;
});
// Keep polling while hidden; the browser may throttle background tabs. No job is resent on navigation.
setInterval(tick,2500);tick();
