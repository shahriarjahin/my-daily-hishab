const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const ledger=require('./web/ledger.js');
function harness(){
 const local={seq:0,workspace:structuredClone(require('./fixtures/empty-workspace.json'))};
 let context;const browser={fetch:async()=>{throw Error('Unexpected browser request');}};
 const bridge={postMessage(id,op,raw){queueMicrotask(()=>{let answer;try{const body=JSON.parse(raw);if(op==='load')answer=structuredClone(local);else if(op==='save'){assert.equal(body.seq,local.seq);local.workspace=body.workspace;local.seq++;answer=structuredClone(local);}else throw Error('Network unavailable');context.AndroidTransport.resolve(id,{ok:true,data:answer});}catch(error){context.AndroidTransport.resolve(id,{ok:false,error:error.message});}});}};
 context=vm.createContext({window:browser,HishabDevice:bridge,DeviceLedger:ledger,Response,Map,Promise,JSON,Error});
 vm.runInContext(fs.readFileSync(__dirname+'/web/transport.js','utf8'),context);
 context.AndroidTransport=browser.AndroidTransport;
 return {local,request:browser.fetch};
}
test('offline writes commit through the device bridge before responding',async()=>{
 const h=harness();const response=await h.request('/api/settings',{method:'PATCH',headers:{'X-Workspace-Revision':'0'},body:JSON.stringify({theme:'glass'})});
 assert.equal(response.status,200);assert.equal(response.headers.get('X-Workspace-Revision'),'1');assert.equal(h.local.workspace.settings.theme,'glass');
});
test('stale UI revisions cannot overwrite synced device records',async()=>{
 const h=harness();h.local.seq=3;const response=await h.request('/api/settings',{method:'PATCH',headers:{'X-Workspace-Revision':'2'},body:JSON.stringify({name:'Stale name'})});assert.equal(response.status,409);assert.equal(h.local.workspace.settings.name,'');
});
test('parallel saves with the same revision preserve the first change',async()=>{
 const h=harness();const result=await Promise.all(['First','Second'].map(name=>h.request('/api/settings',{method:'PATCH',headers:{'X-Workspace-Revision':'0'},body:JSON.stringify({name})})));assert.deepEqual(result.map(r=>r.status),[200,409]);assert.equal(h.local.workspace.settings.name,'First');
});
test('offline provider failure still allows loading the local ledger',async()=>{
 const h=harness();const providers=await h.request('/api/ai/providers');assert.deepEqual((await providers.json()).providers,[]);const response=await h.request('/api/state');assert.equal(response.status,200);assert.equal((await response.json()).wallets[0].name,'Cash');
});
