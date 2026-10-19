'use strict';
const vscode=require('vscode');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const crypto=require('node:crypto');
const {Bridge}=require('./lib/bridge');
const {LANGUAGES,normalizeProblem,fingerprint,sourceHash,template}=require('./lib/model');
const {runSamples}=require('./lib/runner');
let bridge,output,panel,root,busy=false;
const checks=new Map();
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function render() {
  if(!panel || !bridge)return;
  const data=bridge.snapshot();
  panel.webview.html=`<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><style>
  body{font:14px -apple-system,BlinkMacSystemFont,sans-serif;padding:28px;max-width:1050px;color:var(--vscode-editor-foreground);background:var(--vscode-editor-background)}h1{font-size:30px;margin:0 0 8px}.muted{opacity:.65}article{border:1px solid var(--vscode-panel-border);padding:20px;margin:18px 0;border-radius:12px}h2{font-size:18px;margin:0 0 12px}.tag{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#60cdb4}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:var(--vscode-textCodeBlock-background);padding:12px;border-radius:6px}table{border-collapse:collapse;width:100%}td,th{text-align:left;padding:10px;border-bottom:1px solid var(--vscode-panel-border)}.pass{color:#60cdb4}.fail{color:#ffb482}code{font-size:12px}summary{cursor:pointer}
  </style></head><body><p class="tag">CP LAB · LOCAL WORKSPACE</p><h1>Your solution. Your editor.</h1><p class="muted">Save your file → Run Samples → Submit to Judge. Commands are available in the Command Palette.</p>
  <article><h2>${escape(data.active?.title||'Open a problem from the browser extension')}</h2><p class="muted">${escape(data.active?.url||'Codeforces · AtCoder · LeetCode')}</p>${data.jobs.map(j=>`<p>${escape(j.kind)}: <strong>${escape(j.state)}</strong> — keep the problem tab open.</p>`).join('')}</article>
  ${data.history.map(e=>`<article><p class="tag">${escape(e.kind)} · ${escape(new Date(e.at).toLocaleTimeString())}</p><h2>${escape(e.verdict)}</h2><p>${escape(e.details||'')}</p><table><tr><th>Execution time</th><th>Memory</th><th>Submission</th></tr><tr><td>${escape(e.time??(e.timeMs!=null?`${e.timeMs} ms (local wall time)`:'Unavailable'))}</td><td>${escape(e.memory??'Unavailable')}</td><td>${escape(e.submissionId??'—')}</td></tr></table>${e.tests?.map(t=>`<details><summary class="${t.passed?'pass':'fail'}">Sample ${t.index}: ${escape(t.verdict)} · ${escape(t.timeMs)} ms</summary><p>Input</p><pre>${escape(t.input)}</pre><p>Expected</p><pre>${escape(t.expected)}</pre><p>Actual</p><pre>${escape(t.actual)}</pre>${t.stderr?`<pre>${escape(t.stderr)}</pre>`:''}</details>`).join('')||''}${e.codeAnswers?`<p>Judge output</p><pre>${escape(JSON.stringify(e.codeAnswers,null,2))}</pre><p>Expected output</p><pre>${escape(JSON.stringify(e.expectedAnswers,null,2))}</pre>`:''}</article>`).join('')}
  <p class="muted">Sample success covers these examples only. Judge metrics appear only when exposed by the platform. Local comparisons ignore whitespace and do not implement special checkers.</p></body></html>`;
}
function results() {if(!panel) {panel=vscode.window.createWebviewPanel('cplab.results','CP Lab Results',vscode.ViewColumn.Beside,{enableScripts:false});panel.onDidDispose(()=>panel=null);}else panel.reveal(vscode.ViewColumn.Beside);render();}
async function current() {
  const editor=vscode.window.activeTextEditor;
  if(!editor || editor.document.uri.scheme!=='file')throw Error('Open an imported main.cpp, main.py or Main.java file first.');
  const file=editor.document.uri.fsPath;
  const lang=Object.keys(LANGUAGES).find(l=>LANGUAGES[l]===path.basename(file));
  if(!lang)throw Error('Select an imported main.cpp, main.py or Main.java file.');
  const dir=path.dirname(file);
  if(!path.resolve(dir).startsWith(path.resolve(root)+path.sep))throw Error('This file is outside your CP Lab problem folder.');
  const raw=JSON.parse(await fs.readFile(path.join(dir,'problem.json'),'utf8'));
  const p=normalizeProblem({...raw,language:lang});
  return {editor,file,dir,p};
}
async function importProblem(p) {
  const dir=path.join(root,p.site,p.key);
  await fs.mkdir(dir,{recursive:true});
  const file=path.join(dir,LANGUAGES[p.language]);
  try{await fs.writeFile(file,p.snippet||template(p.language,p.site),{flag:'wx'});}catch(e){if(e.code!=='EEXIST')throw e;}
  // Keep user-added tests and input when revisiting a problem.
  try{await fs.writeFile(path.join(dir,'problem.json'),JSON.stringify(p,null,2)+'\n',{flag:'wx'});}catch(e){if(e.code!=='EEXIST')throw e;}
  await fs.writeFile(path.join(dir,'statement.md'),`# ${p.title}\n\n${p.url}\n\n${p.statement}\n\n## Sample cases\n\n${p.samples.map((s,i)=>`### Sample ${i+1}\n\nInput:\n\n\`\`\`text\n${s.input}\n\`\`\`\n\nOutput:\n\n\`\`\`text\n${s.output}\n\`\`\``).join('\n\n')}\n`);
  await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(file),vscode.ViewColumn.One);
  vscode.window.showInformationMessage(`CP Lab: ${p.title} opened. Save your code, then run CP Lab: Run Samples.`);
  return {file};
}
async function onEvent(job,result) {
  if(job.kind==='test')checks.set(job.file,{fingerprint:job.fingerprint,passed:result.passed===true});
  output.appendLine(`[${job.kind}] ${result.verdict}\n${JSON.stringify(result,null,2)}`);
  results();
  vscode.window.showInformationMessage(`CP Lab: ${result.verdict}`);
}
async function run() {
  if(busy)throw Error('A local check is already running.');
  const {editor,file,p}=await current();
  if(!await editor.document.save())throw Error('Save the file before checking.');
  const code=editor.document.getText();
  if(!code.trim())throw Error('Your solution is empty.');
  if(code.includes('TODO: write your solution'))throw Error('Replace the starter TODO with your solution first.');
  const fp=fingerprint(p,code);
  checks.delete(file);
  if(p.site==='leetcode') {
    if(!p.testInput.trim())throw Error('Add LeetCode testInput in problem.json. Use the platform format, one argument per line.');
    bridge.addJob({kind:'test',url:p.url,site:p.site,language:p.language,questionId:p.questionId,testInput:p.testInput,code,file,fingerprint:fp});
    bridge.record({kind:'test',url:p.url,verdict:'Queued for LeetCode Run Code',details:'Keep the original problem tab open and logged in. Local checks run on Codeforces and AtCoder; LeetCode uses its function harness.'});results();return;
  }
  busy=true;
  try {
    const result=await vscode.window.withProgress({location:vscode.ProgressLocation.Notification,title:'CP Lab: compiling and running samples'},()=>runSamples(p,code,vscode.workspace.getConfiguration('cplab')));
    checks.set(file,{fingerprint:fp,passed:result.passed});
    bridge.record({kind:'local samples',url:p.url,...result});output.appendLine(JSON.stringify(result,null,2));results();
  } finally {busy=false;}
}
async function submit() {
  const {editor,file,p}=await current();
  if(!await editor.document.save())throw Error('Save the file before submitting.');
  const code=editor.document.getText(),check=checks.get(file);
  if(!check?.passed || check.fingerprint!==fingerprint(p,code))throw Error('Run samples successfully on this exact code and test set before submitting.');
  if(code.length>100000)throw Error('Source exceeds the 100 KB project limit.');
  const answer=await vscode.window.showWarningMessage(`Submit ${p.title} (${p.language}) to ${p.site}?`,{modal:true,detail:'This sends your saved solution using the logged-in browser tab. Passing samples does not guarantee acceptance. Only submit during contests where your rules allow this tool.'},'Submit');
  if(answer!=='Submit')return;
  bridge.addJob({kind:'submit',url:p.url,site:p.site,language:p.language,questionId:p.questionId,testInput:p.testInput,code,file,fingerprint:check.fingerprint,sourceHash:sourceHash(code)});
  bridge.record({kind:'submit',url:p.url,verdict:'Submission queued',details:'Keep the original problem tab open. Do not submit again while this job is pending.'});results();
}
async function activate(context) {
  output=vscode.window.createOutputChannel('CP Lab');context.subscriptions.push(output);
  const config=vscode.workspace.getConfiguration('cplab');
  root=config.get('workspaceRoot')||path.join(os.homedir(),'Documents','CP-Lab');
  let token=await context.secrets.get('pairingToken');
  if(!token){token=crypto.randomBytes(32).toString('hex');await context.secrets.store('pairingToken',token);}
  const guarded=fn=>async()=>{try{await fn();}catch(e){vscode.window.showErrorMessage(`CP Lab: ${e.message}`);}};
  bridge=new Bridge({token,onImport:importProblem,onEvent,onChange:render});
  try{await bridge.start();}catch(e){vscode.window.showErrorMessage(`CP Lab bridge could not start on 127.0.0.1:27182: ${e.message}. Close other VS Code windows running CP Lab and reload this window.`);}
  context.subscriptions.push({dispose:()=>bridge.close()});
  const commands={pair:async()=>{await vscode.env.clipboard.writeText(token);vscode.window.showInformationMessage('Pairing token copied. Paste it in the CP Lab browser popup.');},run,submit,results,tests:async()=>{const {dir}=await current();await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(path.join(dir,'problem.json')));},judge:async()=>{const {p}=await current();await vscode.env.openExternal(vscode.Uri.parse(p.url));}};
  for(const [name,fn] of Object.entries(commands))context.subscriptions.push(vscode.commands.registerCommand(`cplab.${name}`,guarded(fn)));
  context.subscriptions.push(vscode.window.registerUriHandler({handleUri:guarded(async()=>vscode.window.showInformationMessage('CP Lab is ready. Return to the browser popup to import your problem.'))}));
  for(const [text,command,priority] of [['$(beaker) CP: Run','cplab.run',3],['$(cloud-upload) CP: Submit','cplab.submit',2],['$(list-unordered) CP: Results','cplab.results',1]]) {
    const item=vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left,priority);item.text=text;item.command=command;item.tooltip=command;item.show();context.subscriptions.push(item);
  }
  output.appendLine('CP Lab ready on 127.0.0.1:27182. Only use one CP Lab VS Code window.');
}
module.exports={activate,deactivate:()=>bridge?.close()};
