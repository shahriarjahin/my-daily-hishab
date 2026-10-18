'use strict';
const pageParents={goals:'budgets',regulars:'budgets',loans:'wallets',categories:'settings',connections:'settings',data:'settings',parser:'history',wallets:'more',hub:'more',settings:'more',more:'home',history:'home',budgets:'home',insights:'home'};
const appTrail=[];
let returningInApp=false;
function backControls(){const bar=document.querySelector('.topbar');if(!bar)return;let leading=bar.querySelector('.topbar-leading');if(!leading){leading=document.createElement('div');leading.className='topbar-leading';bar.prepend(leading);leading.append(document.querySelector('.breadcrumb'));}
 let button=document.getElementById('app-back');if(!button){button=document.createElement('button');button.id='app-back';button.className='icon-button app-back';button.dataset.action='app-back';button.setAttribute('aria-label','Back');button.innerHTML=icon('arrow');leading.prepend(button);}button.disabled=page==='home'&&!appTrail.length;
 const header=document.querySelector('.dialog-header');if(header&&!header.querySelector('.dialog-back')){const back=document.createElement('button');back.className='icon-button app-back dialog-back';back.type='button';back.dataset.action='app-back';back.setAttribute('aria-label','Back');back.innerHTML=icon('arrow');header.prepend(back);}}
function goBack(){if(dialog.open){dialog.close();return;}const target=appTrail.pop()||pageParents[page];if(!target)return;returningInApp=true;location.hash=target;}
window.addEventListener('hashchange',event=>{if(returningInApp)returningInApp=false;else{const previous=new URL(event.oldURL).hash.replace(/^#/,'')||'home';if(Object.hasOwn(routeInfo,previous)&&previous!==page)appTrail.push(previous);}backControls();});
const backAction=handleAction;
handleAction=async function(el){if(el.dataset.action==='app-back'){goBack();return;}return backAction(el);};
backControls();
