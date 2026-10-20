'use strict';
let deviceStatus={},deviceStatusBusy=false;
const deviceText=(english,bangla)=>state.settings.language==='bn'?bangla:english;
const syncLabels={synced:['Synced','সিঙ্ক হয়েছে'],pending:['Pending sync','সিঙ্ক বাকি'],syncing:['Syncing','সিঙ্ক হচ্ছে'],offline:['On device','ফোনে সংরক্ষিত'],conflict:['Review sync','সিঙ্ক যাচাই করুন']};
function deviceDecorate(){
 const status=deviceStatus.sync_state||'offline',label=syncLabels[status]||syncLabels.offline;
 let button=document.getElementById('device-sync');if(!button){button=document.createElement('button');button.id='device-sync';button.type='button';button.className='icon-button';button.dataset.device='sync';button.setAttribute('aria-label','Sync');button.innerHTML=icon('down');document.querySelector('.topbar-actions').prepend(button);}
 button.title=deviceText(...label);button.classList.toggle('negative',status==='conflict');
 const footer=document.querySelector('.sidebar-footer');if(footer)footer.innerHTML=`<span class="status-dot"></span> ${esc(deviceText(...label))} ${icon('lock')}`;
 const note=document.querySelector('.auth-footnote');if(note)note.textContent=deviceText('Encrypted on this phone. Syncs with your account.','এই ফোনে এনক্রিপ্ট করা থাকে। আপনার অ্যাকাউন্টে সিঙ্ক হয়।');
 if(page==='settings'&&cloudState.signed_in&&!document.getElementById('device-settings')){
  const card=document.createElement('section');card.id='device-settings';card.className='panel finance-section';
  card.innerHTML=`<div class="section-heading"><h2>${deviceText('Sync & device','সিঙ্ক ও ডিভাইস')}</h2><span class="pill">${esc(deviceText(...label))}</span></div><p class="form-hint">${deviceText('Encrypted SQLite · Offline ready','এনক্রিপ্টেড SQLite · অফলাইনে প্রস্তুত')}</p><div class="form-actions"><button class="secondary-button" data-device="sync">${deviceText('Sync now','এখন সিঙ্ক করুন')}</button><button class="text-button" data-device="backup">${deviceText('Export backup','ব্যাকআপ নিন')}</button>${status==='conflict'?`<button class="secondary-button" data-device="conflict">${deviceText('Review conflict','দ্বন্দ্ব যাচাই করুন')}</button>`:''}<button class="text-button" data-device="recovery">${deviceText('Recovery copies','পুনরুদ্ধার কপি')}</button></div><details class="optional-details"><summary>${deviceText('AI server','এআই সার্ভার')}</summary><form id="device-server"><label class="form-field">${deviceText('Hishab website URL','হিসাব ওয়েবসাইটের URL')}<input name="backend_url" type="url" value="${esc(deviceStatus.backend_url||'')}" placeholder="https://your-app.vercel.app" required></label><p class="form-hint">${deviceText('Use your own Hishab deployment. Your sign-in token is sent to this server for AI features.','নিজের হিসাব সার্ভার ব্যবহার করুন। এআইয়ের জন্য আপনার সাইন-ইন টোকেন এই সার্ভারে পাঠানো হবে।')}</p><div class="form-actions"><button class="secondary-button">${deviceText('Save','সংরক্ষণ')}</button></div></form></details>`;
  main.append(card);
 }
}
const deviceRender=render;
render=function(){deviceRender();deviceDecorate();};
const deviceLogin=renderLogin;
renderLogin=function(message=''){deviceLogin(message);deviceDecorate();};
decorateCloud=function(){deviceDecorate();document.querySelector('.avatar').title=cloudState.email||'Your account';};
// Replace browser installation/import instructions with native backup controls.
window.addEventListener('DOMContentLoaded',()=>{const deviceSettingsSections=settingsSections;
settingsSections=function(){const sections=deviceSettingsSections();if(sections[2]){
 const panel=sections[2].querySelector('.panel');if(panel)panel.innerHTML=`<div class="settings-row"><div><h3>${deviceText('Device backup','ডিভাইস ব্যাকআপ')}</h3></div><button class="secondary-button" data-device="backup">${deviceText('Export','এক্সপোর্ট')}</button></div><div class="settings-row"><div><h3>${deviceText('Transaction history','লেনদেনের ইতিহাস')}</h3></div><a class="secondary-button" href="/api/export.csv">CSV</a></div><div class="settings-row"><div><h3>${deviceText('Recovery copies','পুনরুদ্ধার কপি')}</h3></div><button class="secondary-button" data-device="recovery">${deviceText('Export','এক্সপোর্ট')}</button></div>`;
 }return sections;};});
async function updateDeviceStatus(){if(deviceStatusBusy)return;deviceStatusBusy=true;try{deviceStatus=await AndroidTransport.call('status');if(deviceStatus.signed_in){const cached=await AndroidTransport.call('providers');if(JSON.stringify(cached)!==JSON.stringify(providerState)){providerState=cached;if(page==='connections'&&!busy&&!dialog.open)render();}}deviceDecorate();if(deviceStatus.signed_in&&deviceStatus.revision!==state.revision&&!busy&&!dialog.open&&!document.activeElement?.matches('input,textarea,select'))await refresh();}finally{deviceStatusBusy=false;}}
window.addEventListener('device-sync',()=>updateDeviceStatus().catch(()=>{}));
window.addEventListener('online',()=>AndroidTransport.call('sync').catch(()=>{}));
setInterval(()=>{if(cloudState.signed_in)AndroidTransport.call('sync').catch(()=>{});},60000);
function conflictDialog(){modal(deviceText('Choose a sync copy','সিঙ্ক কপি বেছে নিন'),`<p class="review-intro">${deviceText('This phone and the cloud both changed. Choose which complete workspace to continue with. Both versions are saved in Recovery copies first.','ফোন ও ক্লাউড দুটোতেই পরিবর্তন হয়েছে। যে সম্পূর্ণ কপিটি রাখতে চান বেছে নিন। আগে দুটো কপিই পুনরুদ্ধারের জন্য সংরক্ষিত হবে।')}</p><div id="form-error" class="form-error"></div><div class="form-actions"><button class="secondary-button" data-device="use-cloud">${deviceText('Use cloud copy','ক্লাউড কপি ব্যবহার')}</button><button class="primary-button" data-device="use-device">${deviceText('Keep this phone’s copy','এই ফোনের কপি রাখুন')}</button></div>`);}
async function deviceExport(workspace,name='hishab-backup.json'){await AndroidTransport.call('export',{name,mime:'application/json',content:JSON.stringify(workspace,null,2)});}
exportView=async function(){const safe=value=>{let v=String(value??'');if(/^\s*[=+@-]/.test(v))v="'"+v;return '"'+v.replaceAll('"','""')+'"';};const lines=[['Date','Description','Type','Category','Amount (BDT)','Wallet / From','To'],...filteredHistory().map(t=>[t.date||'',t.description,t.type,t.category,t.amount,walletName(t.from_wallet_id||t.wallet_id),t.to_wallet_id?walletName(t.to_wallet_id):''])];await AndroidTransport.call('export',{name:'hishab-history.csv',mime:'text/csv',content:'\ufeff'+lines.map(r=>r.map(safe).join(',')).join('\r\n')});};
document.addEventListener('click',async event=>{
 const control=event.target.closest('[data-device]'),exportLink=event.target.closest('a[href="/api/export.csv"]');if(!control&&!exportLink)return;event.preventDefault();
 try{
  if(exportLink){await exportView();return;}
  const action=control.dataset.device;
  if(action==='sync'){await AndroidTransport.call('sync');await updateDeviceStatus();if(deviceStatus.sync_state==='conflict')conflictDialog();else{await refresh();toast(deviceText('Synced','সিঙ্ক হয়েছে'));}}
  else if(action==='backup'){const local=await AndroidTransport.call('load');await deviceExport(local.workspace);}
  else if(action==='recovery'){const copies=await AndroidTransport.call('recoveries');if(!copies.length){toast(deviceText('No recovery copies','কোনো পুনরুদ্ধার কপি নেই'));return;}await deviceExport({recovery_copies:copies},'hishab-recovery-copies.json');}
  else if(action==='conflict')conflictDialog();
  else if(action==='use-cloud'||action==='use-device'){await AndroidTransport.call('resolve',{choice:action==='use-cloud'?'cloud':'device'});dialog.close();await updateDeviceStatus();await refresh();}
 }catch(error){toast(error.message);}
});
document.addEventListener('submit',async event=>{if(event.target.id!=='device-server')return;event.preventDefault();try{deviceStatus=await AndroidTransport.call('config',{backend_url:new FormData(event.target).get('backend_url')});toast(deviceText('Saved','সংরক্ষিত'));}catch(error){toast(error.message);}});
// Device copy must never imply that an offline write has already reached the cloud.
const deviceToast=toast;
toast=function(message){deviceToast(['Saved to your cloud account.','Updated in your cloud account.'].includes(message)?deviceText('Saved on device','ফোনে সংরক্ষিত'):message);};
AndroidTransport.call('status').then(value=>{deviceStatus=value;deviceDecorate();}).catch(()=>{});

// GitHub metadata requests are public; no login token is used by the updater.
let appUpdatePreferences={automatic:true,version:''};
function updateCard(){if(page!=='settings'||!cloudState.signed_in||document.getElementById('app-updates'))return;const card=document.createElement('section');card.id='app-updates';card.className='panel finance-section';card.innerHTML=`<div class="section-heading"><h2>${deviceText('App updates','অ্যাপ আপডেট')}</h2><span class="pill">${esc(appUpdatePreferences.version)}</span></div><div class="settings-row"><span>${deviceText('Check automatically','স্বয়ংক্রিয়ভাবে খুঁজুন')}</span><label class="switch"><input id="automatic-updates" type="checkbox" aria-label="Check automatically" ${appUpdatePreferences.automatic?'checked':''}><span></span></label></div><button type="button" class="secondary-button" id="check-app-update">${deviceText('Check for updates','আপডেট খুঁজুন')}</button><p class="form-hint">${deviceText('Downloads from GitHub. Android confirms installation.','GitHub থেকে ডাউনলোড। ইনস্টল করতে Android অনুমতি চাইবে।')}</p>`;main.append(card);}
const updateDeviceDecorate=deviceDecorate;
deviceDecorate=function(){updateDeviceDecorate();updateCard();};
document.addEventListener('click',e=>{if(e.target.closest('#check-app-update')){toast(deviceText('Checking GitHub…','GitHub খোঁজা হচ্ছে…'));AndroidTransport.call('updates',{check:true}).catch(e=>toast(e.message));}});
document.addEventListener('change',e=>{if(e.target.id==='automatic-updates')AndroidTransport.call('updates',{automatic:e.target.checked}).then(v=>{appUpdatePreferences=v;}).catch(e=>toast(e.message));});
AndroidTransport.call('updates').then(value=>{appUpdatePreferences=value;updateCard();}).catch(()=>{});
