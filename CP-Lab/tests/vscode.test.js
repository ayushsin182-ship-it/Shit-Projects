'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs/promises');const path=require('node:path');const os=require('node:os');const Module=require('node:module');
test('VS Code commands: import, preserve files, checks, stale edit block, submit and verdict',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'cplab-vscode-')),commands=new Map(),secrets=new Map(),errors=[],views=[];
  const mock={
    Uri:{parse:s=>({scheme:s.split(':')[0],toString:()=>s})},ViewColumn:{One:1,Beside:2},StatusBarAlignment:{Left:1},ProgressLocation:{Notification:1},
    env:{clipboard:{writeText:async()=>{}},openExternal:async()=>{}},
    commands:{registerCommand:(name,fn)=>{commands.set(name,fn);return {dispose(){}};}},
    workspace:{getConfiguration:()=>({get:k=>k==='workspaceRoot'?root:undefined}),openTextDocument:async file=>{
      const doc={uri:{scheme:'file',fsPath:file},text:await fs.readFile(file,'utf8'),getText(){return this.text;},async save(){await fs.writeFile(file,this.text);return true;}};return doc;
    }},
    window:{activeTextEditor:null,createOutputChannel:()=>({appendLine(){},dispose(){}}),showErrorMessage:async e=>errors.push(e),showInformationMessage:async()=>{},showWarningMessage:async()=> 'Submit',
      showTextDocument:async doc=>{mock.window.activeTextEditor={document:doc};return mock.window.activeTextEditor;},withProgress:async(_o,fn)=>fn(),
      createStatusBarItem:()=>({show(){},dispose(){}}),registerUriHandler:()=>({dispose(){}}),
      createWebviewPanel:()=>{const view={webview:{html:''},onDidDispose(){},reveal(){}};views.push(view);return view;}
    }
  };
  const original=Module._load;Module._load=function(id,...args){if(id==='vscode')return mock;return original.call(this,id,...args);};
  const extension=require('../vscode/extension');Module._load=original;
  try {
    await extension.activate({secrets:{get:async k=>secrets.get(k),store:async(k,v)=>secrets.set(k,v)},subscriptions:[]});
    const call=(route,body)=>fetch('http://127.0.0.1:27182'+route,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${secrets.get('pairingToken')}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})}).then(r=>r.json());
    const p={url:'https://codeforces.com/problemset/problem/4/A',title:'Sum <script>alert(1)</script>',language:'python',samples:[{input:'2 3\n',output:'5\n'}]};
    await call('/import',p);const doc=mock.window.activeTextEditor.document;assert.match(doc.getText(),/TODO/);
    await commands.get('cplab.run')();assert.match(errors.pop(),/starter TODO/);
    doc.text='a,b=map(int,input().split());print(a+b)';await doc.save();
    await call('/import',p);assert.equal(mock.window.activeTextEditor.document.getText(),doc.text);
    await commands.get('cplab.run')();let state=await call('/state');assert.equal(state.history[0].passed,true);
    const active=mock.window.activeTextEditor.document;active.text+='\n# changed';await commands.get('cplab.submit')();assert.match(errors.pop(),/exact code/);assert.equal((await call('/state')).jobs.length,0);
    await commands.get('cplab.run')();await commands.get('cplab.submit')();state=await call('/state');assert.equal(state.jobs.length,1);assert.equal(state.jobs[0].kind,'submit');
    const {job}=await call('/jobs?url='+encodeURIComponent(p.url));assert.equal(job.code,active.text);assert.equal(job.language,'python');
    await call('/events',{jobId:job.id,result:{verdict:'Accepted',passed:true,time:'46 ms',memory:'1200 KB',submissionId:'123'}});
    state=await call('/state');assert.equal(state.history[0].verdict,'Accepted');assert.equal(state.jobs.length,0);
    assert.match(views[0].webview.html,/46 ms/);assert.match(views[0].webview.html,/&lt;script&gt;/);assert.ok(!views[0].webview.html.includes('<script>alert'));
    assert.equal(errors.length,0);
  } finally {await extension.deactivate();await fs.rm(root,{recursive:true,force:true});}
});
