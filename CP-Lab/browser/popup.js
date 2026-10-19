'use strict';
const $=id=>document.getElementById(id);
let tab;
async function message(data){const r=await chrome.runtime.sendMessage(data);if(!r?.ok)throw Error(r?.error||'Extension unavailable.');return r.data;}
function notice(text,error=false){$('notice').textContent=text;$('notice').className=error?'error':'';}
function connection(ready){$('connection').textContent=ready?'● Connected':'Not connected';$('connection').className=ready?'badge ready':'badge';$('pairing').open=!ready;}
async function refresh(){
  try{await message({type:'health'});connection(true);const state=await message({type:'state'});const last=state.history[0];if(last){$('result').hidden=false;$('verdict').textContent=last.verdict;$('time').textContent=last.time??(last.timeMs!=null?last.timeMs+' ms local':'—');$('memory').textContent=last.memory??'—';}}
  catch{connection(false);}
}
async function init(){
  [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  const {language}=await chrome.storage.local.get('language');if(language&&['cpp','python','java'].includes(language))document.querySelector(`input[value="${language}"]`).checked=true;
  try{const u=new URL(tab.url);const names={'codeforces.com':'CODEFORCES','leetcode.com':'LEETCODE','atcoder.jp':'ATCODER'};if(names[u.hostname]){$('site').textContent=names[u.hostname];$('title').textContent=tab.title?.replace(/ - (Codeforces|AtCoder|LeetCode).*$/,'')||'Problem ready';$('subtitle').textContent=u.pathname;}}
  catch{}
  await refresh();
}
$('pair').addEventListener('click',async()=>{
  try{await message({type:'pair',token:$('token').value.trim()});$('token').value='';connection(true);notice('Paired. Your local workspace is ready.');}
  catch(e){notice(e.message,true);}
});
$('open').addEventListener('click',async()=>{
  $('open').disabled=true;notice('Reading the problem…');
  try{
    const language=document.querySelector('input[name="language"]:checked').value;await chrome.storage.local.set({language});
    if(!tab?.id)throw Error('Open a problem in the active tab.');
    let extracted;try{extracted=await chrome.tabs.sendMessage(tab.id,{type:'extract',language});}catch{throw Error('Open a supported problem page, then refresh it once after installing the extension.');}
    if(!extracted?.ok)throw Error(extracted?.error||'Problem unavailable.');
    try{await message({type:'health'});}catch(e){
      const {token}=await chrome.storage.local.get('token');if(!token)throw Error('Open VS Code, copy the CP Lab pairing token, and pair below first.');
      notice('Opening VS Code… Keep this popup open.');
      await chrome.tabs.create({url:'vscode://cplab.cp-lab/open',active:false});
      let ready=false;for(let i=0;i<16;i++){await new Promise(r=>setTimeout(r,750));try{await message({type:'health'});ready=true;break;}catch{}}
      if(!ready)throw Error('Start VS Code with CP Lab installed, then try again. Keep one CP Lab VS Code window open.');
    }
    await message({type:'import',problem:extracted.problem});connection(true);notice('Opened in VS Code. Save your solution, then click CP: Run.');
  }catch(e){notice(e.message,true);}finally{$('open').disabled=false;}
});
init();
setInterval(refresh,3000);
