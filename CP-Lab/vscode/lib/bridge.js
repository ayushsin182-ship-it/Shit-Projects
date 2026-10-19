'use strict';
const http=require('node:http');
const crypto=require('node:crypto');
const {normalizeProblem,identify}=require('./model');
const PORT=27182;
const MAX_BODY=1024*1024;
class Bridge {
  constructor({token,onImport,onEvent,onChange=()=>{},port=PORT}) {
    this.token=token; this.onImport=onImport; this.onEvent=onEvent; this.onChange=onChange;
    this.port=port; this.jobs=new Map(); this.history=[]; this.active=null;
  }
  addJob(data) {
    for(const j of this.jobs.values()) if(j.state!=='done' && j.expires>Date.now()) throw Error('A browser job is already pending. Keep its judge tab open or wait for it to expire.');
    const job={...data,id:crypto.randomUUID(),state:'queued',created:Date.now(),expires:Date.now()+240000};
    this.jobs.set(job.id,job); this.onChange(); return job;
  }
  publicJob(job) { return {id:job.id,kind:job.kind,url:job.url,site:job.site,language:job.language,code:job.code,questionId:job.questionId,testInput:job.testInput}; }
  snapshot() {
    return {active:this.active,history:this.history.slice(-15).reverse(),jobs:[...this.jobs.values()].filter(j=>j.state!=='done').map(j=>({id:j.id,kind:j.kind,url:j.url,state:j.expires<Date.now()?'expired':j.state}))};
  }
  async start() {
    this.server=http.createServer((req,res)=>this.handle(req,res));
    this.server.requestTimeout=10000;
    await new Promise((resolve,reject)=>{this.server.once('error',reject);this.server.listen(this.port,'127.0.0.1',resolve);});
    this.port=this.server.address().port;
    this.expiry=setInterval(()=>{
      for(const [id,j] of this.jobs) if(j.state!=='done' && j.expires<Date.now()) {
        j.state='done';
        const result={verdict:'Browser job expired',passed:false,details:'Keep the original problem tab open and logged in. For a submission, check the judge before trying again.'};
        this.record({jobId:id,kind:j.kind,url:j.url,...result});
        Promise.resolve(this.onEvent(j,result)).catch(()=>{});
      }
      for(const [id,j] of this.jobs) if(j.expires<Date.now()-300000) this.jobs.delete(id);
    },3000); this.expiry.unref();
  }
  record(event) { this.history.push({...event,at:new Date().toISOString()}); this.history=this.history.slice(-50); this.onChange(); }
  async handle(req,res) {
    const send=(status,data)=>{if(res.writableEnded)return;res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
    try {
      const origin=req.headers.origin;
      if(origin && !/^chrome-extension:\/\/[a-p]{32}$/.test(origin)) return send(403,{error:'Browser origin rejected.'});
      if(req.headers.host!==`127.0.0.1:${this.port}`) return send(403,{error:'Host rejected.'});
      if(origin) {res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
      if(req.method==='OPTIONS') {
        res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');
        res.writeHead(204);res.end();return;
      }
      const auth=req.headers.authorization||'';
      const expected=`Bearer ${this.token}`;
      if(auth.length!==expected.length || !crypto.timingSafeEqual(Buffer.from(auth),Buffer.from(expected))) return send(401,{error:'Pairing token is missing or incorrect.'});
      const url=new URL(req.url,`http://127.0.0.1:${this.port}`);
      if(req.method==='GET' && url.pathname==='/health') return send(200,{ok:true,version:'1.0.0'});
      if(req.method==='GET' && url.pathname==='/state') return send(200,this.snapshot());
      if(req.method==='GET' && url.pathname==='/jobs') {
        let target;try{target=identify(url.searchParams.get('url')).url;}catch{return send(200,{job:null});}
        const job=[...this.jobs.values()].find(j=>j.state==='queued' && j.url===target && j.expires>Date.now());
        if(job) {job.state='dispatched';this.onChange();}
        return send(200,{job:job?this.publicJob(job):null});
      }
      if(req.method!=='POST') return send(404,{error:'Unknown endpoint.'});
      const chunks=[];let bytes=0;
      for await(const chunk of req) {bytes+=chunk.length;if(bytes>MAX_BODY) {send(413,{error:'Payload too large.'});return;}chunks.push(chunk);}
      const data=JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');
      if(url.pathname==='/import') {
        const p=normalizeProblem(data);
        const result=await this.onImport(p); this.active={title:p.title,url:p.url,language:p.language};
        this.record({kind:'import',url:p.url,verdict:'Opened in VS Code'}); return send(200,{ok:true,...result});
      }
      if(url.pathname==='/events' || url.pathname==='/progress') {
        const job=this.jobs.get(data.jobId);
        if(!job || job.state==='done' || job.expires<Date.now()) return send(409,{error:'Job is no longer active. Check the judge directly.'});
        if(!data.result || typeof data.result.verdict!=='string') return send(400,{error:'Missing result.'});
        const result=data.result;
        if(url.pathname==='/progress') {
          job.state='judging'; this.record({jobId:job.id,kind:job.kind,url:job.url,...result}); return send(200,{ok:true});
        }
        job.state='done'; this.record({jobId:job.id,kind:job.kind,url:job.url,...result});
        await this.onEvent(job,result);return send(200,{ok:true});
      }
      send(404,{error:'Unknown endpoint.'});
    } catch(e) {send(400,{error:e.message});}
  }
  close() {clearInterval(this.expiry);return new Promise(resolve=>this.server?this.server.close(resolve):resolve());}
}
module.exports={Bridge,PORT};
