'use strict';
const BASE='http://127.0.0.1:27182';
async function local(endpoint,body) {
  const {token}=await chrome.storage.local.get('token');
  if(!token)throw Error('Pair first: in VS Code run “CP Lab: Copy Browser Pairing Token”, then paste it here.');
  const r=await fetch(BASE+endpoint,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});
  const data=await r.json();if(!r.ok)throw Error(data.error||`Local bridge: HTTP ${r.status}`);return data;
}
// The function runs in the page's MAIN world to keep Ace/CodeMirror in sync.
function fillNativeForm(payload) {
  const {site,language,code,index,contest,task}=payload;
  const select=document.querySelector(site==='codeforces'?'select[name="programTypeId"]':'select[name="data.LanguageId"]');
  if(!select)throw Error('Language selector not found. Log in, or complete verification.');
  const patterns={cpp:[/(?:GNU\s*)?(?:G\+\+|C\+\+)\s*(?:17|20|23)/i,/C\+\+/i],python:[/Python.*CPython.*\b3/i,/Python\s*3/i,/PyPy\s*3/i,/Python.*\b3/i],java:[/Java\s*(?:17|21|23|24|25)/i,/Java\s*(?:8|11|[1-9]\d)/i,/^Java\b/i]}[language];
  let option;
  for(const pattern of patterns) {option=Array.from(select.options).find(o=>!o.disabled&&pattern.test(o.textContent));if(option)break;}
  if(!option)throw Error(`No supported ${language} compiler is offered for this problem.`);
  select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));
  if(site==='codeforces') {
    const ci=document.querySelector('[name="contestId"]');if(ci) {ci.value=contest;ci.dispatchEvent(new Event('change',{bubbles:true}));}
    const problem=document.querySelector('[name="submittedProblemIndex"]');
    if(problem) {problem.value=index;problem.dispatchEvent(new Event('change',{bubbles:true}));if(problem.value!==index)throw Error('Could not select the Codeforces problem.');}
  } else {
    const problem=document.querySelector('[name="data.TaskScreenName"]');
    if(!problem)throw Error('AtCoder task selector is missing.');
    problem.value=task;problem.dispatchEvent(new Event('change',{bubbles:true}));if(problem.value!==task)throw Error('Could not select the AtCoder task.');
  }
  const area=document.querySelector(site==='codeforces'?'textarea[name="source"]':'textarea[name="sourceCode"], textarea#sourceCode');
  if(!area)throw Error('Source editor unavailable. Try the site’s plain text editor.');
  const setter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set;
  setter.call(area,code);area.dispatchEvent(new Event('input',{bubbles:true}));area.dispatchEvent(new Event('change',{bubbles:true}));
  for(const el of document.querySelectorAll('.ace_editor'))if(window.ace)window.ace.edit(el).setValue(code,-1);
  for(const el of document.querySelectorAll('.CodeMirror'))if(el.CodeMirror)el.CodeMirror.setValue(code);
  const form=area.closest('form');if(!form)throw Error('Submission form unavailable.');
  // Give the page's language-change handler a moment to update editor state.
  const button=form.querySelector('input[type="submit"],button[type="submit"],button:not([type])');
  if(!button)throw Error('Submit button missing.');
  if(button.disabled)throw Error('Submit is disabled. Check contest registration or login.');
  form.requestSubmit(button);
  return {language:option.textContent.trim()};
}
chrome.runtime.onMessage.addListener((msg,sender,respond)=>{
  (async()=>{
    const fromPopup=!sender.tab;
    if(msg.type==='pair'&&fromPopup) {
      if(!/^[a-f0-9]{64}$/.test(msg.token))throw Error('Paste the 64-character token copied from VS Code.');
      await chrome.storage.local.set({token:msg.token});return await local('/health');
    }
    if(msg.type==='health'&&fromPopup)return await local('/health');
    if(msg.type==='state'&&fromPopup)return await local('/state');
    if(msg.type==='import'&&fromPopup)return await local('/import',msg.problem);
    if(!sender.tab)throw Error('Unsupported action.');
    const u=new URL(sender.url||sender.tab.url);
    if(u.protocol!=='https:'||!['codeforces.com','leetcode.com','atcoder.jp'].includes(u.hostname))throw Error('Judge tab required.');
    const key=`pending-${sender.tab.id}`;
    if(msg.type==='poll')return await local('/jobs?url='+encodeURIComponent(msg.url));
    if(msg.type==='pending')return (await chrome.storage.local.get(key))[key]||null;
    if(msg.type==='setPending'){await chrome.storage.local.set({[key]:msg.pending});return {ok:true};}
    if(msg.type==='progress')return await local('/progress',{jobId:msg.jobId,result:msg.result});
    if(msg.type==='event') {
      try { const result=await local('/events',{jobId:msg.jobId,result:msg.result}); await chrome.storage.local.remove(key); return result; }
      catch(e) { if(e.message.includes('no longer active'))await chrome.storage.local.remove(key); throw e; }
    }
    if(msg.type==='fillNative') {
      const pending=(await chrome.storage.local.get(key))[key];
      if(!pending||pending.phase!=='watch'||pending.job.id!==msg.jobId)throw Error('No matching submission request.');
      const results=await chrome.scripting.executeScript({target:{tabId:sender.tab.id},world:'MAIN',func:fillNativeForm,args:[{...pending.problem,language:pending.job.language,code:pending.job.code}]});
      if(results[0]?.error)throw Error(results[0].error.message);
      return results[0]?.result||{ok:true};
    }
    throw Error('Unknown action.');
  })().then(data=>respond({ok:true,data}),e=>respond({ok:false,error:e.message}));
  return true;
});
chrome.tabs.onRemoved.addListener(id=>chrome.storage.local.remove(`pending-${id}`));
chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'}).catch(()=>{});
