import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
async function fixture(t, respond, overrides={}) {
 const dir=await mkdtemp(path.join(os.tmpdir(),'yqz-proxy-'));
 const token=path.join(dir,'token.json');
 await writeFile(token,JSON.stringify({access_token:'fake-access',refresh_token:'fake-refresh',expires_at:Date.now()+3600000}));
 let count=0;
 const server=http.createServer((req,res)=>respond(req,res,++count));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const child=spawn(process.execPath,['connector/yqz-mcp-proxy.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,YQZ_TOKEN_FILE:token,YQZ_MCP_URL:`http://127.0.0.1:${server.address().port}`,YQZ_ATTEMPT_TIMEOUT_MS:'80',YQZ_TOTAL_TIMEOUT_MS:'1500',...overrides},stdio:['pipe','pipe','pipe']});
 child.stderr.resume();
 t.after(async()=>{child.kill();server.closeAllConnections();await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});});
 const result=new Promise((resolve,reject)=>{let buffer='';const timeout=setTimeout(()=>reject(new Error('No proxy response')),5000);child.stdout.on('data',chunk=>{buffer+=chunk;const line=buffer.split('\n')[0];try{const v=JSON.parse(line);clearTimeout(timeout);resolve(v);}catch{}});child.on('exit',code=>{if(code!==null&&code!==0){clearTimeout(timeout);reject(new Error(`proxy exited ${code}`));}});});
 child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'list_projects',arguments:{pageSize:5}}})+'\n');
 return {result,count:()=>count};
}
test('a transport failure is retried once and successful result preserved',async t=>{
 const f=await fixture(t,(req,res,n)=>{if(n===1)req.socket.destroy();else res.writeHead(200,{'content-type':'application/json'}).end(JSON.stringify({jsonrpc:'2.0',id:1,result:{content:[{type:'text',text:'five projects'}]}}));});
 assert.equal((await f.result).result.content[0].text,'five projects');assert.equal(f.count(),2);
});
test('persistent network failure stops after two attempts and signals exhausted budget',async t=>{
 const f=await fixture(t,req=>req.socket.destroy());const r=await f.result;
 assert.equal(f.count(),2);assert.deepEqual(r.error.data,{retryable:false,retryExhausted:true});
});
test('small total budget prevents another retry after a slow request',async t=>{
 const start=Date.now();const f=await fixture(t,()=>{}, {YQZ_ATTEMPT_TIMEOUT_MS:'100',YQZ_TOTAL_TIMEOUT_MS:'150'});
 const r=await f.result;assert.equal(f.count(),1);assert.equal(r.error.data.retryExhausted,true);assert.ok(Date.now()-start<1000);
});
