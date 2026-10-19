const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function watcher(){
 const events={},docEvents={};let renders=0,calls=0;
 const context=vm.createContext({cloudState:{signed_in:true},busy:false,dialog:{open:false},state:{revision:1,wallets:[{balance:1000}]},refreshGeneration:1,
  document:{visibilityState:'visible',activeElement:{matches:()=>false},addEventListener:(name,fn)=>docEvents[name]=fn},
  window:{addEventListener:(name,fn)=>events[name]=fn},setInterval:fn=>events.tick=fn,
  api:async()=>{calls++;return {revision:2,wallets:[{balance:900}]};},applyTheme:()=>{},render:()=>renders++,decorateCloud:()=>{}});
 vm.runInContext(fs.readFileSync(__dirname+'/static/web-sync.js','utf8'),context);
 return {context,events,renders:()=>renders,calls:()=>calls};
}
test('web wallet balances pick up another device revision',async()=>{const h=watcher();await h.events.focus();assert.equal(h.context.state.wallets[0].balance,900);assert.equal(h.renders(),1);});
test('background updates do not overwrite an open form',async()=>{const h=watcher();h.context.dialog.open=true;await h.events.tick();assert.equal(h.calls(),0);assert.equal(h.context.state.wallets[0].balance,1000);});
test('a late background read cannot overwrite a newer save',async()=>{const h=watcher();let resolve;h.context.api=()=>new Promise(done=>resolve=done);const pending=h.events.tick();h.context.state={revision:3,wallets:[{balance:800}]};resolve({revision:2,wallets:[{balance:900}]});await pending;assert.equal(h.context.state.wallets[0].balance,800);});
test('AI provider failure does not block fresh financial data',async()=>{
 let rendered=0;
 const context=vm.createContext({state:{revision:0},api:async path=>{if(path==='/cloud/status')return {signed_in:true};if(path==='/state')return {revision:2,wallets:[{balance:900}]};throw Error('AI unavailable');},
  home:()=>{},showAdd:()=>{},handleAction:()=>{},refresh:()=>{},page:'home',busy:false,dialog:{open:false},location:{hash:'#home'},
  document:{querySelector:()=>({classList:{remove:()=>{}}})},applyTheme:()=>{},render:()=>rendered++,decorateCloud:()=>{},renderLogin:()=>{},renderSetup:()=>{}});
 const source=fs.readFileSync(__dirname+'/static/extensions.js','utf8');vm.runInContext(source.slice(0,source.indexOf('function decorateCloud')),context);
 await context.refresh();await flush();assert.equal(context.state.wallets[0].balance,900);assert.equal(rendered,1);
});
