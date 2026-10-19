'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const {spawn} = require('node:child_process');
const {equalOutput, LANGUAGES} = require('./model');
const OUTPUT_LIMIT=256*1024;
function execute(command,args,{cwd,input='',timeout=3000}={}) {
  return new Promise(resolve=>{
    let child, stdout='', stderr='', killed=null, done=false;
    const start=performance.now();
    const stop=reason=>{
      if (!killed) killed=reason;
      try { if (child.pid && process.platform!=='win32') process.kill(-child.pid,'SIGKILL'); else child.kill('SIGKILL'); } catch {}
    };
    try { child=spawn(command,args,{cwd,detached:process.platform!=='win32',shell:false,stdio:['pipe','pipe','pipe']}); }
    catch (e) { resolve({exitCode:null,stdout,stderr:e.message,error:e.message,timeMs:0}); return; }
    const timer=setTimeout(()=>stop('Time limit exceeded'),timeout);
    function finish(code,error) {
      if(done) return; done=true; clearTimeout(timer);
      // Clean up descendants even if the direct process has already exited.
      try { if (child.pid && process.platform!=='win32') process.kill(-child.pid,'SIGKILL'); } catch {}
      resolve({exitCode:code,stdout,stderr,error:error||killed,timeMs:Math.round(performance.now()-start)});
    }
    const append=(kind,chunk)=>{
      const text=chunk.toString();
      if(kind==='out') stdout=(stdout+text).slice(0,OUTPUT_LIMIT); else stderr=(stderr+text).slice(0,OUTPUT_LIMIT);
      if(stdout.length+stderr.length>=OUTPUT_LIMIT) stop('Output limit exceeded');
    };
    child.stdout.on('data',d=>append('out',d)); child.stderr.on('data',d=>append('err',d));
    child.on('error',e=>finish(null,`${command}: ${e.message}. Check the compiler path in CP Lab settings.`));
    child.on('exit',(code)=>{ try { if(child.pid && process.platform!=='win32') process.kill(-child.pid,'SIGKILL'); } catch {} });
    child.on('close',code=>finish(code));
    child.stdin.on('error',()=>{}); child.stdin.end(input);
  });
}
async function runSamples(p,code,settings={}) {
  if (!code.trim()) return {passed:false,verdict:'Empty source',tests:[]};
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'cp-lab-'));
  try {
    const file=path.join(dir,LANGUAGES[p.language]); await fs.writeFile(file,code);
    let compile, command, args;
    if(p.language==='cpp') {
      compile=await execute(settings.cppCompiler||'g++',['-std=c++17','-O2','-Wall','-Wextra',file,'-o',path.join(dir,'solution')],{cwd:dir,timeout:30000});
      command=path.join(dir,'solution'); args=[];
    } else if(p.language==='java') {
      compile=await execute(settings.javac||'javac',['-encoding','UTF-8','-d',dir,file],{cwd:dir,timeout:30000});
      command=settings.java||'java'; args=['-Xmx256m','-cp',dir,'Main'];
    } else {
      command=settings.python||'python3'; args=[file];
      compile=await execute(command,['-m','py_compile',file],{cwd:dir,timeout:10000});
    }
    if(compile.error || compile.exitCode!==0) return {passed:false,verdict:'Compile / syntax error',details:compile.stderr||compile.error,tests:[]};
    if(!p.samples.length) return {passed:false,verdict:'No test cases',details:'Compilation passed. Add input/output cases in problem.json, then run checks again.',tests:[]};
    const tests=[];
    for(let i=0;i<p.samples.length;i++) {
      const sample=p.samples[i];
      const r=await execute(command,args,{cwd:dir,input:sample.input,timeout:settings.sampleTimeoutMs||3000});
      const verdict=r.error || (r.exitCode!==0 ? `Runtime error (exit ${r.exitCode})` : equalOutput(r.stdout,sample.output) ? 'Passed' : 'Wrong answer');
      tests.push({index:i+1,verdict,passed:verdict==='Passed',input:sample.input,expected:sample.output,actual:r.stdout,stderr:r.stderr,timeMs:r.timeMs});
    }
    const passed=tests.every(t=>t.passed);
    return {passed,verdict:passed?'All samples passed':'Sample checks failed',tests,details:compile.stderr||'',timeMs:tests.reduce((a,t)=>a+t.timeMs,0),memory:null};
  } finally { await fs.rm(dir,{recursive:true,force:true}); }
}
module.exports={execute,runSamples};
