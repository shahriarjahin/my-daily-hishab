'use strict';
const walletBrands=[
 {id:'primenow',pattern:/prime\s*now|প্রাইম\s*নাও/iu,file:'primenow.png'},
 {id:'primebank',pattern:/prime\s*bank|প্রাইম\s*ব্যাংক/iu,file:'primebank.png'},
 {id:'bkash',pattern:/b\s*kash|বিকাশ/iu,file:'bkash.png'},
 {id:'city',pattern:/\bcity(?:\s*bank|\s*touch)?\b|সিটি\s*(ব্যাংক|টাচ)/iu,file:'city.png'},
 {id:'sonali',pattern:/sonali|সোনালী|সোনালি/iu,file:'sonali.png'},
 {id:'janata',pattern:/janata|জনতা/iu,file:'janata.png'},
 {id:'cash',pattern:/^cash$|^cash\s+wallet$|^নগদ টাকা$|^হাতে নগদ$/iu,file:null}
];
function walletBrand(name){return walletBrands.find(brand=>brand.pattern.test(String(name)))||{id:'generic',file:null};}
function walletBrandHTML(name){const brand=walletBrand(name);return `<span class="wallet-brand brand-${brand.id}" aria-hidden="true">${brand.file?`<img src="/static/wallet-logos/${brand.file}" alt="" loading="lazy" decoding="async">`:icon(brand.id==='cash'?'salary':'wallet')}</span>`;}
function setWalletBrand(target,name){if(!target)return;const key=walletBrand(name).id;if(target.dataset.walletBrand===key)return;target.dataset.walletBrand=key;target.innerHTML=walletBrandHTML(name);}
function decorateWalletLogos(){for(const row of document.querySelectorAll('.wallet-card,.wallet-directory-row')){const wallet=state.wallets.find(w=>w.id===Number(row.dataset.id));if(wallet)setWalletBrand(row.querySelector('.wallet-icon,.destination-icon'),wallet.name);}
 for(const select of document.querySelectorAll('select[name="wallet_id"],select[name$="-wallet_id"],select[name="from_wallet_id"],select[name="to_wallet_id"],#quick-wallet')){const wallet=state.wallets.find(w=>w.id===Number(select.value));if(!wallet)continue;let badge=select.parentElement.querySelector('.wallet-select-brand');if(!badge){badge=document.createElement('span');badge.className='wallet-select-brand';select.parentElement.prepend(badge);}setWalletBrand(badge,wallet.name);}}
document.addEventListener('change',event=>{if(event.target.tagName==='SELECT')decorateWalletLogos();});
document.addEventListener('error',event=>{const img=event.target;if(img.tagName==='IMG'&&img.closest('.wallet-brand'))img.parentElement.innerHTML=icon('wallet');},true);
