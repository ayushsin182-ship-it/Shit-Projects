/* DOM adapters: deliberately independent of judge cookies or the local pairing token. */
(function(root){
  'use strict';
  const q=(s,d=document)=>d.querySelector(s);
  const qa=(s,d=document)=>Array.from(d.querySelectorAll(s));
  const text=e=>e?.textContent?.trim()||'';
  function identify(raw) {
    const u=new URL(raw);let m;
    if(u.protocol!=='https:')throw Error('Use an HTTPS problem page.');
    if(u.hostname==='codeforces.com') {
      m=u.pathname.match(/^\/(contest|gym)\/(\d+)\/problem\/([A-Za-z0-9]+)\/?$/);
      if(m)return {site:'codeforces',url:`https://codeforces.com/${m[1]}/${m[2]}/problem/${m[3]}`,contest:m[2],index:m[3],group:m[1]};
      m=u.pathname.match(/^\/problemset\/problem\/(\d+)\/([A-Za-z0-9]+)\/?$/);
      if(m)return {site:'codeforces',url:`https://codeforces.com/problemset/problem/${m[1]}/${m[2]}`,contest:m[1],index:m[2],group:'problemset'};
    }
    if(u.hostname==='atcoder.jp'&&(m=u.pathname.match(/^\/contests\/([\w-]+)\/tasks\/([\w-]+)\/?$/)))return {site:'atcoder',url:`https://atcoder.jp/contests/${m[1]}/tasks/${m[2]}`,contest:m[1],task:m[2]};
    if(u.hostname==='leetcode.com'&&(m=u.pathname.match(/^\/problems\/([\w-]+)(?:\/(?:description|submissions|solutions|editorial)(?:\/.*)?)?\/?$/)))return {site:'leetcode',url:`https://leetcode.com/problems/${m[1]}/`,slug:m[1]};
    throw Error('Open a Codeforces, AtCoder or LeetCode problem, then try again.');
  }
  function preText(el) {
    if(!el)return '';
    const clone=el.cloneNode(true);
    clone.querySelectorAll('br').forEach(e=>e.replaceWith('\n'));
    const lines=clone.querySelectorAll('.test-example-line');
    if(lines.length)return Array.from(lines).map(e=>e.textContent).join('\n')+'\n';
    return clone.textContent.replace(/\r\n/g,'\n').replace(/^\n/,'').replace(/\n?$/,'\n');
  }
  async function jsonFetch(url,options={}) {
    const r=await fetch(url,{credentials:'same-origin',...options,signal:AbortSignal.timeout(20000)});
    if(!r.ok)throw Error(`Judge returned HTTP ${r.status}. Log in, resolve any verification page, then try again.`);
    let data;try{data=await r.json();}catch{throw Error('The judge returned a login or verification page. Open the judge tab and check it.');}
    return data;
  }
  async function extract(language,doc=document,raw=location.href) {
    const p=identify(raw);
    if(p.site==='codeforces') {
      const el=q('.problem-statement',doc);if(!el)throw Error('Problem statement not loaded. Refresh after any verification challenge.');
      const ins=qa('.sample-test .input pre',el),outs=qa('.sample-test .output pre',el);
      return {...p,language,title:text(q('.title',el)),statement:text(el),samples:ins.map((e,i)=>({input:preText(e),output:preText(outs[i])})).filter((_,i)=>outs[i])};
    }
    if(p.site==='atcoder') {
      const el=q('#task-statement .lang-en',doc)||q('#task-statement .lang-ja',doc)||q('#task-statement',doc);
      if(!el)throw Error('Problem statement not loaded. Log in and refresh.');
      const inputs=new Map(),outputs=new Map();
      for(const h of qa('h3',el)) {
        const m=text(h).match(/(?:Sample\s+(Input|Output)\s*(\d+)|(?:入力例|出力例)\s*(\d+))/i);
        if(!m)continue;
        const pre=h.parentElement.querySelector('pre');if(!pre)continue;
        const input=m[1]?m[1].toLowerCase()==='input':text(h).includes('入力');
        (input?inputs:outputs).set(m[2]||m[3],preText(pre));
      }
      const samples=[...inputs].filter(([k])=>outputs.has(k)).map(([k,input])=>({input,output:outputs.get(k)}));
      return {...p,language,title:text(q('.h2',doc))||p.task,statement:text(el),samples};
    }
    const data=await jsonFetch('/graphql/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:'query CpLabQuestion($titleSlug: String!) { question(titleSlug: $titleSlug) { questionId title content sampleTestCase codeSnippets { langSlug code } } }',variables:{titleSlug:p.slug}})});
    const question=data.data?.question;if(!question?.content)throw Error('LeetCode problem unavailable. Log in and check access to this problem.');
    const langSlug={cpp:'cpp',python:'python3',java:'java'}[language];
    const snippet=question.codeSnippets?.find(s=>s.langSlug===langSlug)?.code;
    if(!snippet)throw Error(`No ${language} starter available for this LeetCode problem.`);
    const html=new DOMParser().parseFromString(question.content,'text/html');
    return {...p,language,title:question.title,statement:html.body.textContent,samples:[],questionId:question.questionId,testInput:question.sampleTestCase||'',snippet};
  }
  function nativeUrls(p) {
    if(p.site==='atcoder')return {submit:`https://atcoder.jp/contests/${p.contest}/submit?taskScreenName=${p.task}`,status:`https://atcoder.jp/contests/${p.contest}/submissions/me`};
    const prefix=p.group==='problemset'?'problemset':`${p.group}/${p.contest}`;
    return {submit:`https://codeforces.com/${prefix}/submit/${p.group==='problemset'?p.contest+'/':''}${p.index}`,status:p.group==='problemset'?'https://codeforces.com/problemset/status?my=on':`https://codeforces.com/${prefix}/my`};
  }
  function nativeRows(doc,p) {
    if(p.site==='codeforces') {
      if(!q('.status-frame-datatable, .status-frame-datatable-contest, table.status-frame-datatable',doc))throw Error('Cannot read Codeforces submissions. Log in or resolve verification in the browser.');
      return qa('tr[data-submission-id]',doc).map(row=>{
        const a=q('a[href*="/problem/"]',row);
        const href=a?.getAttribute('href')||'';
        const task=href.match(/\/(?:problemset\/problem|(?:contest|gym))\/(\d+)\/(?:problem\/)?([A-Za-z0-9]+)\/?$/);
        const verdict=text(q('.submissionVerdictWrapper',row))||text(q('[submissionverdict]',row))||'Pending';
        return {submissionId:row.getAttribute('data-submission-id'),matches:task?.[1]===p.contest&&task?.[2]===p.index,verdict,time:text(q('.time-consumed-cell',row))||null,memory:text(q('.memory-consumed-cell',row))||null};
      });
    }
    const table=q('#main-container table, #main-container .table-responsive table',doc);
    if(!table || q('input[name="username"]',doc))throw Error('Cannot read AtCoder submissions. Log in and open My Submissions.');
    return qa('tbody tr',table).map(row=>{
      const cells=qa('td',row),detail=q('a[href*="/submissions/"]',row),task=q('a[href*="/tasks/"]',row);
      const submissionId=detail?.getAttribute('href')?.match(/\/submissions\/(\d+)/)?.[1];
      const verdict=text(q('.submission-status',row))||text(q('td:nth-child(7) .label',row))||text(cells[6])||'Pending';
      const rawTime=text(cells[7]),rawMemory=text(cells[8]);
      return {submissionId,matches:task?.getAttribute('href')?.split('/').pop()===p.task,verdict,time:/ms|sec|s$/i.test(rawTime)?rawTime:null,memory:/KB|KiB|MB|MiB/i.test(rawMemory)?rawMemory:null};
    }).filter(r=>r.submissionId);
  }
  function isFinal(verdict) {
    return /^(?:Accepted|Wrong answer(?:.*)?|Time limit exceeded(?:.*)?|Memory limit exceeded(?:.*)?|Runtime error(?:.*)?|Compilation error(?:.*)?|Output limit exceeded(?:.*)?|Presentation error(?:.*)?|Idleness limit exceeded(?:.*)?|Skipped|Hacked|Rejected|Challenged|AC|WA|TLE|MLE|RE|CE|OLE|IE)$/i.test(verdict.trim());
  }
  function leetResult(data,kind) {
    const tests=Number(data.total_testcases),correct=Number(data.total_correct);
    const compared=typeof data.compare_result==='string'&&/^1+$/.test(data.compare_result);
    const passed=data.status_code===10 && (kind==='submit'||((tests>0&&correct===tests)||data.correct_answer===true||compared));
    const verdict=kind==='submit'?(data.status_msg||'Judge result'):passed?'All LeetCode examples passed':data.status_code===10?'LeetCode examples did not all pass':data.status_msg||'LeetCode run failed';
    return {passed,verdict,time:data.status_runtime||null,memory:data.status_memory||null,details:data.full_compile_error||data.compile_error||data.full_runtime_error||data.runtime_error||(tests>0?`${correct || 0}/${tests} test cases passed.`:'Judge did not expose a comparison count.'),codeAnswers:data.code_answer||[],expectedAnswers:data.expected_code_answer||[]};
  }
  const api={identify,preText,extract,nativeUrls,nativeRows,isFinal,leetResult,jsonFetch};
  root.CPLab=api;if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
