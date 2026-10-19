'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {normalizeProblem,identify,fingerprint,equalOutput,template}=require('../vscode/lib/model');
const {runSamples,execute}=require('../vscode/lib/runner');
const {Bridge}=require('../vscode/lib/bridge');
const C=require('../browser/common');
const sample={url:'https://codeforces.com/problemset/problem/4/A',language:'cpp',title:'A. Add numbers',statement:'Read a and b; print their sum.',samples:[{input:'2 3\n',output:'5\n'},{input:'-2 9\n',output:'7\n'}]};
test('URL allowlist and canonical problem IDs match between extensions',()=>{
  for(const url of [sample.url,'https://codeforces.com/contest/2000/problem/A','https://codeforces.com/gym/100000/problem/B','https://atcoder.jp/contests/abc100/tasks/abc100_a','https://leetcode.com/problems/two-sum/description/?x=1']) {
    assert.equal(identify(url).url,C.identify(url).url);
    const p=normalizeProblem({...sample,url,...(url.includes('leetcode')?{questionId:'1',testInput:'[2,7]\n9'}:{})});assert.ok(p.key);
  }
  for(const url of ['http://codeforces.com/problemset/problem/4/A','https://evil.example/problem','https://codeforces.com.evil.example/problemset/problem/4/A','file:///tmp/main.py'])assert.throws(()=>normalizeProblem({...sample,url}));
  assert.throws(()=>normalizeProblem({...sample,language:'ruby'}));
});
test('checks are bound to exact code, language and tests',()=>{
  const p=normalizeProblem(sample);const fp=fingerprint(p,'code');
  assert.notEqual(fp,fingerprint(p,'code changed'));assert.notEqual(fp,fingerprint({...p,language:'java'},'code'));
  assert.notEqual(fp,fingerprint({...p,samples:[{input:'0',output:'0'}]},'code'));
  assert.equal(equalOutput('1  2\n','1\n2'),true);assert.equal(equalOutput('1.0','1'),false);
});
test('C++ samples compile and show pass, wrong answer and compile errors',async()=>{
  const p=normalizeProblem(sample);
  const correct='#include <iostream>\nint main(){long a,b;std::cin>>a>>b;std::cout<<a+b<<"\\n";}';
  const r=await runSamples(p,correct);assert.equal(r.passed,true);assert.equal(r.tests.length,2);assert.ok(r.tests.every(t=>t.timeMs>=0));assert.equal(r.memory,null);
  assert.equal((await runSamples(p,'#include <iostream>\nint main(){std::cout<<0;}')).passed,false);
  assert.equal((await runSamples(p,'this does not compile')).verdict,'Compile / syntax error');
  assert.equal((await runSamples({...p,samples:[]},correct)).verdict,'No test cases');
});
test('Python checks syntax, output, timeout and bounded output',async()=>{
  const p=normalizeProblem({...sample,language:'python'});
  assert.equal((await runSamples(p,'a,b=map(int,input().split());print(a+b)')).passed,true);
  assert.equal((await runSamples(p,'def broken(')).verdict,'Compile / syntax error');
  const timed=await runSamples({...p,samples:[p.samples[0]]},'while True: pass',{sampleTimeoutMs:250});assert.equal(timed.tests[0].verdict,'Time limit exceeded');
  const overflow=await execute('python3',['-c','while True: print("x"*10000)']);assert.equal(overflow.error,'Output limit exceeded');assert.ok(overflow.stdout.length<=256*1024);
  const missing=await execute('cp-lab-missing-compiler',[]);assert.match(missing.error,/compiler path/);
});
test('Java Main solution compiles and runs',async t=>{
  let compiler=process.env.CPLAB_TEST_JAVAC||'javac',runtime=process.env.CPLAB_TEST_JAVA||'java';
  const probe=await execute(compiler,['-version']);
  if(probe.error){t.skip('JDK compiler not on PATH; set CPLAB_TEST_JAVAC and CPLAB_TEST_JAVA.');return;}
  const p=normalizeProblem({...sample,language:'java'});
  const code='import java.util.*; public class Main { public static void main(String[] args){ Scanner s=new Scanner(System.in); System.out.println(s.nextInt()+s.nextInt()); }}';
  const r=await runSamples(p,code,{javac:compiler,java:runtime});assert.equal(r.passed,true,JSON.stringify(r));
  assert.equal((await runSamples(p,'public class Main { broken }',{javac:compiler,java:runtime})).passed,false);
});
test('LeetCode execution alone never counts as passing samples',()=>{
  assert.equal(C.leetResult({status_code:10,run_success:true},'test').passed,false);
  assert.equal(C.leetResult({status_code:10,total_testcases:2,total_correct:1},'test').passed,false);
  assert.equal(C.leetResult({status_code:10,total_testcases:2,total_correct:2},'test').passed,true);
  assert.equal(C.leetResult({status_code:10,compare_result:'111'},'test').passed,true);
  assert.equal(C.leetResult({status_code:11,correct_answer:true},'test').passed,false);
  assert.equal(C.leetResult({status_code:10,status_msg:'Accepted'},'submit').passed,true);
  assert.equal(C.leetResult({status_code:15,status_msg:'Runtime Error'},'submit').passed,false);
  assert.equal(C.isFinal('Running on test 2'),false);assert.equal(C.isFinal('Wrong answer on test 4'),true);assert.equal(C.isFinal('AC'),true);assert.equal(C.isFinal('WJ'),false);
});
test('authenticated loopback bridge imports, claims once and records a result',async()=>{
  const token='a'.repeat(64),events=[];
  const b=new Bridge({token,port:0,onImport:async p=>({file:'/test/'+p.key}),onEvent:async(j,r)=>events.push([j,r])});await b.start();
  try {
    const base=`http://127.0.0.1:${b.port}`;
    const request=(route,body,headers={})=>fetch(base+route,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/json'}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});
    assert.equal((await fetch(base+'/health')).status,401);
    assert.equal((await request('/health',null,{Origin:'https://evil.example'})).status,403);
    assert.equal((await request('/health',null,{Origin:'chrome-extension://'+'a'.repeat(32)})).status,200);
    assert.equal((await request('/import',sample)).status,200);
    assert.equal((await request('/import',{...sample,url:'https://evil.example'})).status,400);
    const j=b.addJob({kind:'submit',url:identify(sample.url).url,code:'saved code',site:'codeforces',language:'cpp'});
    assert.throws(()=>b.addJob({kind:'submit',url:sample.url}),/pending/);
    assert.equal((await (await request('/jobs?url='+encodeURIComponent('https://leetcode.com/problems/two-sum/'))).json()).job,null);
    assert.equal((await (await request('/jobs?url='+encodeURIComponent(sample.url))).json()).job.id,j.id);
    assert.equal((await (await request('/jobs?url='+encodeURIComponent(sample.url))).json()).job,null);
    assert.equal((await request('/progress',{jobId:j.id,result:{verdict:'Running on test 1',submissionId:'123'}})).status,200);
    assert.equal(events.length,0);assert.equal(b.snapshot().jobs[0].state,'judging');
    assert.equal((await request('/events',{jobId:j.id,result:{verdict:'Accepted',passed:true,time:'31 ms',memory:'100 KB'}})).status,200);
    assert.equal(events.length,1);assert.equal(b.history.at(-1).time,'31 ms');
    assert.equal((await request('/events',{jobId:j.id,result:{verdict:'Accepted'}})).status,409);
  }finally{await b.close();}
});
