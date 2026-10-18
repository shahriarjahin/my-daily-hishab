'use strict';
const pageParents={goals:'budgets',regulars:'budgets',loans:'wallets',categories:'settings',connections:'settings',data:'settings',parser:'history',wallets:'more',hub:'more',settings:'more',more:'home',history:'home',budgets:'home',insights:'home'};
const appTrail=[];
let returningInApp=false;
// Navigation history remains available for the native Android Back gesture.
function backControls(){}
function goBack(){if(dialog.open){dialog.close();return;}const target=appTrail.pop()||pageParents[page];if(!target)return;returningInApp=true;location.hash=target;}
window.addEventListener('hashchange',event=>{if(returningInApp)returningInApp=false;else{const previous=new URL(event.oldURL).hash.replace(/^#/,'')||'home';if(Object.hasOwn(routeInfo,previous)&&previous!==page)appTrail.push(previous);}backControls();});
const backAction=handleAction;
handleAction=async function(el){if(el.dataset.action==='app-back'){goBack();return;}return backAction(el);};
backControls();
