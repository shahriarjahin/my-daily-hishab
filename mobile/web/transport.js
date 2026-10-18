'use strict';
window.AndroidTransport={
 pending:new Map(),sequence:0,
 call(op,body={}){return new Promise((resolve,reject)=>{const id=String(++this.sequence);this.pending.set(id,{resolve,reject});HishabDevice.postMessage(id,op,JSON.stringify(body));});},
 resolve(id,envelope){const promise=this.pending.get(id);if(!promise)return;this.pending.delete(id);if(envelope.ok)promise.resolve(envelope.data);else promise.reject(new Error(envelope.error||'Device action failed.'));}
};
const nativeFetch=window.fetch.bind(window);
let deviceRequests=Promise.resolve();
async function deviceRequest(path,method,body,expected){
 if(path==='/cloud/status')return AndroidTransport.call('status');
 if(path.startsWith('/auth/'))return AndroidTransport.call(path.split('/').pop(),body);
 if(path==='/ai/providers'&&method==='GET'){try{return await AndroidTransport.call('providers');}catch{return {providers:[],automatic_failover:true};}}
 if(path.startsWith('/ai/')||path==='/extract'||path==='/plan/preview'||path==='/advisor'&&method==='POST')return AndroidTransport.call('remote',{path,method,body:method==='GET'?null:body});
 const local=await AndroidTransport.call('load');
 if(path==='/state')return {...DeviceLedger.state(local.workspace),revision:local.seq};
 if(expected!=null&&Number(expected)!==local.seq){const error=new Error('Device records changed. Reload before saving.');error.status=409;throw error;}
 const change=DeviceLedger.mutate(local.workspace,path,method,body);
 const saved=await AndroidTransport.call('save',{workspace:change.workspace,seq:local.seq});
 return {result:change.result,deviceRevision:saved.seq};
}
window.fetch=async function(input,options={}){
 const url=typeof input==='string'?input:input.url;
 if(!url.startsWith('/api/'))return nativeFetch(input,options);
 const path=url.slice(4),method=options.method||'GET';
 try{
  const body=options.body?JSON.parse(options.body):{};
  // Serialize read-modify-write operations; remote AI uses its own native network queue.
  const remote=path.startsWith('/ai/')||path==='/extract'||path==='/plan/preview'||path==='/advisor'&&method==='POST';
  let value;
  const expected=options.headers?.['X-Workspace-Revision'];
  if(remote)value=await deviceRequest(path,method,body,expected);
  else{const task=deviceRequests.then(()=>deviceRequest(path,method,body,expected));deviceRequests=task.catch(()=>{});value=await task;}
  const revision=value?.deviceRevision;
  return new Response(JSON.stringify(revision!=null?value.result:value),{status:200,headers:{'Content-Type':'application/json',...(revision!=null?{'X-Workspace-Revision':String(revision)}:{})}});
 }catch(error){return new Response(JSON.stringify({detail:error.message}),{status:error.status||400,headers:{'Content-Type':'application/json'}});}
};
