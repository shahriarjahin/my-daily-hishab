'use strict';
// Read-only cross-device refresh. Never replace an open form or an in-flight save.
(()=>{
 if(typeof HishabDevice!=='undefined')return;
 let checking=false;
 const safe=()=>cloudState.signed_in&&!busy&&!dialog.open&&document.visibilityState==='visible'&&!document.activeElement?.matches('input,textarea,select,[contenteditable="true"]');
 async function check(){
  if(checking||!safe())return;
  checking=true;
  const previous=state,generation=refreshGeneration;
  try{
   const latest=await api('/state',{cache:'no-store'});
   if(!safe()||state!==previous||refreshGeneration!==generation)return;
   if(latest.revision!==previous.revision){state=latest;applyTheme();render();decorateCloud();}
  }catch{/* Keep the last successful ledger; never write it back over the cloud. */}
  finally{checking=false;}
 }
 window.addEventListener('focus',check);
 window.addEventListener('online',check);
 window.addEventListener('hashchange',check);
 document.addEventListener('visibilitychange',check);
 setInterval(check,30000);
})();
