'use strict';
// Cloud account and integration controls extend the core finance screens.
let cloudState={signed_in:false,configured:false,cloud_mode:true},providerState={providers:[],automatic_failover:true};
let authMode='login',walletReview=[],walletReviewMeta=null,pendingTransactions=[],installPrompt=null;
const originalApi=api,originalHome=home,originalAdd=showAdd,originalAction=handleAction;

api=async function(path,options={}){
  const headers={...(options.headers||{})};
  if(state.revision!=null)headers['X-Workspace-Revision']=String(state.revision);
  try{return await originalApi(path,{...options,headers});}
  catch(error){if(error.status===409&&cloudState.signed_in){try{state=await originalApi('/state');}catch{}}if(error.status===401&&!path.startsWith('/auth/')){cloudState.signed_in=false;renderLogin();}throw error;}
};

let refreshGeneration=0;
refresh=async function(){
  const generation=++refreshGeneration;
  const nextCloud=await originalApi('/cloud/status');
  if(generation!==refreshGeneration)return;
  cloudState=nextCloud;
  if(!cloudState.signed_in){renderLogin();return;}
  if(cloudState.setup_required){renderSetup();return;}
  const nextState=await api('/state');
  if(generation!==refreshGeneration)return;
  state=nextState;
  document.querySelector('.app-shell').classList.remove('auth-screen');
  document.querySelector('.mobile-nav').classList.remove('auth-hidden');
  applyTheme();render();decorateCloud();
  if(location.hash==='#add')showAdd();
  // AI metadata is optional; its outage must not hide a freshly saved ledger.
  api('/ai/providers').then(providers=>{if(generation!==refreshGeneration||!cloudState.signed_in)return;providerState=providers;if(page==='connections'&&!busy&&!dialog.open)render();}).catch(()=>{});
};

function decorateCloud(){
  const footer=document.querySelector('.sidebar-footer');
  footer.innerHTML=`<span class="status-dot"></span> Synced to your account ${icon('lock')}`;
  document.querySelector('.page-footer').innerHTML='<span>Your finances, with you everywhere.</span><span>Encrypted connection · Private account</span>';
  document.querySelector('.avatar').title=cloudState.email||'Your account';
}

function renderLogin(message=''){
  document.querySelector('.app-shell').classList.add('auth-screen');
  document.querySelector('.mobile-nav').classList.add('auth-hidden');
  document.querySelector('.breadcrumb').innerHTML='<span class="login-wordmark">৳ hishab.</span>';
  document.querySelector('.avatar').textContent='H';
  main.innerHTML=`<div class="auth-layout"><section class="auth-intro"><span class="eyebrow">A LITTLE CLARITY, EVERY DAY</span><h1>Your money.<br>Your space.<br><span>Everywhere.</span></h1><p>One private home for your wallets, everyday spending, and bigger plans. Pick up right where you left off, on any device.</p><div class="auth-benefits"><span>${icon('wallet')} Every wallet, in one place</span><span>${icon('spark')} English, বাংলা, or Banglish</span><span>${icon('lock')} Private to your account</span></div></section><section class="panel auth-card"><div class="brand auth-brand"><img class="brand-logo" src="/static/hishab-logo-v2.png" alt="Hishab"><span>hishab<span class="brand-dot">.</span></span></div><h2>${authMode==='signup'?'A fresh start.':'Welcome back.'}</h2><p class="muted">${authMode==='signup'?'Create your account and make room for clarity.':'Sign in to your personal finance workspace.'}</p><div class="segmented auth-tabs"><button class="${authMode==='login'?'active':''}" data-action="auth-mode" data-value="login">Sign in</button><button class="${authMode==='signup'?'active':''}" data-action="auth-mode" data-value="signup">Create account</button></div><form id="auth-form" data-extension="true"><label class="form-field">Email address<input type="email" name="email" autocomplete="email" required placeholder="you@example.com" maxlength="254"></label><label class="form-field" style="margin-top:17px">Password<input type="password" name="password" autocomplete="${authMode==='signup'?'new-password':'current-password'}" minlength="6" maxlength="1024" required placeholder="Your password"></label><p class="form-error" id="auth-error" role="alert">${esc(message)}</p><button class="primary-button auth-submit">${authMode==='signup'?'Create account':'Sign in'} ${icon('arrow')}</button></form><p class="auth-footnote">Your records are saved in your cloud account. No financial data is stored in this browser.</p></section></div>`;
  document.querySelector('.page-footer').innerHTML='<span>A little clarity, every day.</span><span>Supabase Auth · Secure account sync</span>';
}

function renderSetup(){
  document.querySelector('.app-shell').classList.add('auth-screen');
  document.querySelector('.mobile-nav').classList.add('auth-hidden');
  main.innerHTML=`<section class="panel setup-card"><span class="eyebrow">ONE-TIME PROJECT SETUP</span><h1>Your account is connected.</h1><p class="muted">${esc(cloudState.message||'The cloud database needs its workspace tables and access policies.')}</p><p class="form-hint">Run the supplied setup SQL in your Supabase project’s SQL Editor, then check again.</p><div class="form-actions"><a class="secondary-button" href="/api/cloud/setup.sql">${icon('download')} Setup SQL</a><button class="primary-button" data-action="refresh-cloud">Check again</button><button class="text-button" data-action="logout">Sign out</button></div></section>`;
}

const baseRender=render;
render=function(){
  if(!cloudState.signed_in){renderLogin();return;}
  document.querySelector('.breadcrumb').innerHTML=`My workspace <span>/</span><strong id="breadcrumb">${navs.find(n=>n[0]===page)?.[1]||'Overview'}</strong>`;
  baseRender();decorateCloud();
};

function walletChooser(selected){return `<div class="smart-wallet-row"><label for="quick-wallet">Wallet</label><select id="quick-wallet" name="wallet_id" aria-label="Transaction wallet">${walletOptions(selected||state.wallets[0]?.id)}</select></div>`;}
home=function(){
  let html=originalHome();
  html=html.replace('</form><div class="smart-footer">',`${walletChooser()}</form><div class="smart-footer">`);
  html=html.replace('Powered by Gemini','');
  html=html.replace('<button class="add-wallet"', '<button class="add-wallet" data-extra="manual"');
  html=html.replace('<section class="wallet-section"><div class="section-title"><h2>My wallets</h2>', '<section class="wallet-section"><div class="section-title"><h2>My wallets</h2>');
  html=html.replace('+ Add a wallet</button>','+ Add a wallet</button><button class="add-wallet ai-wallet-button" data-action="wallet-ai">'+icon('spark')+' Set wallet balances with AI</button>');
  return html;
};

showAdd=function(tab='smart'){
  if(tab==='wallets'){showWalletAI();return;}
  originalAdd(tab);

  const form=document.getElementById('smart-entry');
  if(form){
    form.querySelector('.form-field').insertAdjacentHTML('afterend',`<label class="form-field" style="margin-top:16px">Wallet<select name="wallet_id" aria-label="Transaction wallet">${walletOptions(state.wallets[0]?.id)}</select></label>`);
    form.querySelector('.form-hint').textContent='Choose a wallet. Named wallets in your entry take priority.';
  }
};

function showWalletAI(){
  modal('Your wallets, in your words.',`<form id="wallet-ai-form" data-extension="true"><label class="form-field">Tell us how much is in each wallet<textarea name="text" required maxlength="10000" placeholder="cash e 2000 tk, bKash e 5000 tk, bank e 15000 tk ache"></textarea></label><p class="form-hint">Enter current balances, not income. Review before applying.</p><div id="form-error" class="form-error" role="alert"></div><div class="form-actions"><button class="primary-button">${icon('spark')} Find wallet balances</button></div></form>`);
}

function showBalanceReview(){
  modal('Check your wallet balances.',`<p class="review-intro">Found ${walletReview.length} wallets using ${esc(walletReviewMeta?.provider||'AI')}. These are current balances, not income. Existing transactions are preserved.</p><form id="balance-review-form" data-extension="true">${walletReview.map((w,i)=>`<div class="review-entry"><div class="review-title"><strong>${w.existing?'Update existing wallet':'Create wallet'}</strong><span class="muted">${w.existing?'Currently '+taka(w.expected_balance):'New'}</span></div><div class="form-grid"><label class="form-field">Wallet name<input name="${i}-name" value="${esc(w.name)}" maxlength="40" required ${w.existing?'readonly':''}></label><label class="form-field">Current balance (৳)<input type="number" step="0.01" min="-1000000000000" max="1000000000000" name="${i}-balance" value="${w.balance}" required></label></div></div>`).join('')}<div id="form-error" class="form-error" role="alert"></div><div class="form-actions"><button type="button" class="secondary-button" data-action="close-dialog">Cancel</button><button class="primary-button">Apply ${walletReview.length} balances ${icon('check')}</button></div></form>`);
}

extract=async function(text,button,mode='auto',walletId=null){
  if(busy)return;busy=true;
  document.getElementById('quick-entry-error')?.remove();
  const form=button?.closest('form');
  const selected=walletId||Number(form?.querySelector('[name=wallet_id]')?.value)||state.wallets[0]?.id;
  const old=button?.innerHTML;if(button){button.disabled=true;button.innerHTML='<span class="loading-dot"></span>';}
  try{
    const result=await request('/extract','POST',{text,mode,wallet_id:selected});
    if(!result.transactions.length&&!result.wallets.length){toast('No transactions or wallet balances found. Try including an amount.');return;}
    if(result.wallets.length){
      walletReview=result.wallets;walletReviewMeta=result;pendingTransactions=result.transactions;showBalanceReview();
    }else{
      reviewRows=result.transactions;
      if(state.settings.review_before_saving){showReview();document.querySelector('.review-intro').insertAdjacentHTML('beforeend',`<br><span class="positive">${esc(result.provider)}${result.fallback_used?' · backup provider used':''}</span>`);}
      else{await request('/transactions','POST',{transactions:reviewRows});dialog.close();await refresh();toast(`${reviewRows.length} entries saved using ${result.provider}.`);}
    }
  }catch(error){const target=dialog.open&&document.getElementById('form-error');if(target)target.textContent=error.message;else if(form?.id==='quick-entry'){const message=document.createElement('p');message.id='quick-entry-error';message.className='form-error';message.setAttribute('role','alert');message.textContent=error.message;form.after(message);}else toast(error.message);}
  finally{busy=false;if(button?.isConnected){button.disabled=false;button.innerHTML=old;}}
};

function providerCard(p){return `<div class="provider-row"><div><h3>${esc(p.name)}</h3><p>${esc(p.model||'Choose a model when connecting')}</p><span class="provider-status ${p.configured&&p.enabled?'positive':'muted'}">${p.configured?(p.enabled?'Connected':'Paused'):'Not connected'}${p.cooldown_seconds?' · cooling down '+p.cooldown_seconds+'s':''}${p.last_error?' · '+esc(p.last_error.replaceAll('_',' ')):''}</span></div><button class="secondary-button" data-action="provider" data-id="${p.id}">${p.configured?'Configure':'Connect'}</button></div>`;}

settings=function(){return heading('Make yourself at home.','Your cloud account, AI connections, and everyday preferences.',false)+`<div class="settings-layout"><section class="settings-block"><span class="eyebrow">YOUR ACCOUNT</span><div class="panel"><div class="settings-row"><div><h3>${esc(cloudState.email)}</h3><p>Signed in</p></div><button class="secondary-button" data-action="logout">Sign out</button></div><div class="settings-row"><div><h3>Name</h3><p></p></div><form id="name-form" class="settings-form"><input class="settings-input" name="name" aria-label="Your name" maxlength="60" placeholder="Your name" value="${esc(state.settings.name)}"><button class="secondary-button">Save</button></form></div><div class="settings-row"><div><h3>Appearance</h3><p></p></div><select class="settings-input" id="theme-select" aria-label="Appearance">${['dark','light','glass','system'].map(v=>`<option value="${v}" ${state.settings.theme===v?'selected':''}>${v==='glass'?'Liquid Glass':v[0].toUpperCase()+v.slice(1)}</option>`).join('')}</select></div><div class="settings-row"><div><h3>Review before saving</h3><p>Check AI entries before saving.</p></div><label class="switch"><input type="checkbox" id="review-toggle" aria-label="Review before saving" ${state.settings.review_before_saving?'checked':''}><span></span></label></div></div></section><section class="settings-block"><span class="eyebrow">AI CONNECTIONS · AUTOMATIC FAILOVER</span><div class="panel"><div class="failover-explainer">${icon('spark')}<div><h3>Automatic fallback</h3><p>If one provider fails, the next connected provider is used.</p><p>Requests may reach multiple connected providers.</p></div></div>${providerState.providers.map(providerCard).join('')}<div class="settings-row"><div><h3>Last successful provider</h3><p>${esc(providerState.last_used||'No request in this server session yet.')}</p></div><button class="text-button" data-action="retry-ai">Retry all providers</button></div><p class="form-hint">Keys are encrypted. Each backup needs available credit.</p></div></section><section class="settings-block"><span class="eyebrow">YOUR DATA</span><div class="panel"><div class="settings-row"><div><h3>Synced across devices</h3><p>Saved to your cloud account.</p></div>${icon('check')}</div><div class="settings-row"><div><h3>Export transactions</h3><p></p></div><a class="secondary-button" href="/api/export.csv">${icon('download')} Export</a></div><div class="settings-row"><div><h3>Import previous Hishab records</h3><p>For empty accounts only.</p></div><button class="secondary-button" data-action="import-records">Import</button></div><div class="settings-row"><div><h3>Add Hishab to your home screen</h3><p>On iPhone, use Safari’s Share → Add to Home Screen. On Android, use your browser’s Install app option.</p></div>${installPrompt?'<button class="secondary-button" data-action="install">Install</button>':icon('phone')}</div><div class="settings-row"><div><h3>Currency</h3><p>Bangladeshi taka · ৳ BDT</p></div><span class="pill">BDT</span></div></div></section></div>`;};

function showProvider(id){const p=providerState.providers.find(p=>p.id===id);if(!p)return;modal('Connect '+p.name,`<form id="provider-form" data-extension="true" data-id="${id}"><div class="form-grid"><label class="form-field wide">API key<input type="password" name="api_key" autocomplete="off" maxlength="10000" placeholder="${p.configured?'Leave blank to keep the saved key':'Paste your provider API key'}"></label><label class="form-field wide">Model ID<input name="model" required maxlength="160" value="${esc(p.model)}" placeholder="Exact model ID from your provider"></label>${id==='custom'?`<label class="form-field wide">Compatible API base URL<input name="base_url" type="url" required value="${esc(p.base_url)}" placeholder="https://your-provider.example/v1"></label>`:''}<label class="form-field">Fallback priority<input name="priority" type="number" required min="1" max="99" value="${p.priority}"></label><label class="form-field">Use in failover<select name="enabled"><option value="true" ${p.enabled?'selected':''}>Enabled</option><option value="false" ${p.enabled?'':'selected'}>Paused</option></select></label></div><p class="form-hint">Lower priority numbers are tried first. This is an automatic fallback order, not a provider picker. A blank key keeps your current connection. Model access depends on your provider account.</p><div id="form-error" class="form-error" role="alert"></div><div class="form-actions"><button class="primary-button">Save connection</button></div></form>`);}

handleAction=async function(el){
  const action=el.dataset.action;
  if(action==='auth-mode'){authMode=el.dataset.value;renderLogin();}
  else if(action==='logout'){await request('/auth/logout','POST',{});state={transactions:[],wallets:[],budgets:[],categories:[],settings:{theme:'dark'}};providerState={providers:[]};cloudState.signed_in=false;dialog.close();renderLogin();}
  else if(action==='refresh-cloud'){await refresh();}
  else if(action==='wallet-ai'){showWalletAI();}
  else if(action==='provider'){showProvider(el.dataset.id);}
  else if(action==='retry-ai'){providerState=await request('/ai/retry','POST',{});render();toast('Providers will be tried again on the next AI entry.');}
  else if(action==='install'&&installPrompt){await installPrompt.prompt();installPrompt=null;}
  else if(action==='theme'&&!cloudState.signed_in){document.documentElement.dataset.theme=document.documentElement.dataset.theme==='dark'?'light':'dark';}
  else if(action==='import-records'){modal('Bring your previous records.',`<form id="import-form" data-extension="true"><p class="review-intro">Choose your hishab-migration.json file. Import is allowed only while your account has no transactions, budgets, or opening balances.</p><label class="form-field">Migration JSON<input type="file" accept=".json,application/json" name="file" required></label><div id="form-error" class="form-error" role="alert"></div><div class="form-actions"><button class="primary-button">Import into this account</button></div></form>`);}
  else await originalAction(el);
};

document.addEventListener('submit',async event=>{
  const form=event.target;if(!form.dataset.extension||form.dataset.finance)return;event.preventDefault();
  const data=new FormData(form),button=event.submitter;
  if(form.id==='wallet-ai-form'){await extract(data.get('text'),button,'wallets');return;}
  if(busy)return;busy=true;const label=button?.innerHTML;if(button){button.disabled=true;button.innerHTML='<span class="loading-dot"></span>';}
  try{
    if(form.id==='auth-form'){
      const result=await request('/auth/'+authMode,'POST',{email:data.get('email'),password:data.get('password')});
      if(result.signed_in){await refresh();toast('You’re signed in.');}else{authMode='login';renderLogin(result.message);}
    }else if(form.id==='provider-form'){
      const body={model:data.get('model'),priority:Number(data.get('priority')),enabled:data.get('enabled')==='true',base_url:data.get('base_url')||''};
      if(data.get('api_key'))body.api_key=data.get('api_key');
      providerState=await request('/ai/providers/'+form.dataset.id,'PUT',body);dialog.close();await refresh();toast('AI connection saved. Automatic failover is ready.');
    }else if(form.id==='balance-review-form'){
      const wallets=walletReview.map((w,i)=>({name:data.get(`${i}-name`),balance:Number(data.get(`${i}-balance`)),expected_balance:w.expected_balance}));
      await request('/wallets/balances','POST',{wallets});await refresh();
      if(pendingTransactions.length){reviewRows=pendingTransactions;pendingTransactions=[];showReview();toast('Wallet balances saved. Review the remaining transactions.');}
      else{dialog.close();toast(`${wallets.length} wallet balances saved to your account.`);}
    }else if(form.id==='import-form'){
      const file=data.get('file');if(!file||file.size>8000000)throw new Error('Choose a JSON file under 8 MB.');
      let content;try{content=JSON.parse(await file.text());}catch{throw new Error('Choose a valid Hishab migration JSON file.');}
      await request('/cloud/import','POST',{data:content,expected_revision:state.revision});dialog.close();await refresh();toast('Your previous records are now in your cloud account.');
    }
  }catch(error){const target=document.getElementById(form.id==='auth-form'?'auth-error':'form-error');if(target)target.textContent=error.message;else toast(error.message);}
  finally{busy=false;if(button?.isConnected){button.disabled=false;button.innerHTML=label;}}
});

window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;if(page==='settings'&&cloudState.signed_in)render();});
if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
