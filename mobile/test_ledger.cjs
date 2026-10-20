const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ledger=require('./web/ledger.js');
const seed=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/empty-workspace.json'),'utf8'));
const fresh=()=>structuredClone(seed);
const change=(w,p,m,b)=>ledger.mutate(w,p,m,b).workspace;
const entry=(amount=70,type='income',wallet_id=1)=>({description:'Test',amount,type,wallet_id,category:type==='income'?'Salary':'Food',date:'2026-10-19T06:00:00+06:00'});

test('income and expenses update the chosen wallet using exact cents',()=>{
 let w=change(fresh(),'/transactions','POST',{transactions:[entry(70),entry(0.1),entry(0.2),entry(12.35,'expense')]});
 assert.equal(ledger.balance(w,1),57.95);assert.equal(ledger.balance(w,2),0);
});
test('failed batch is atomic and does not mutate its source',()=>{
 const w=fresh();assert.throws(()=>change(w,'/transactions','POST',{transactions:[entry(),entry(-2)]}));assert.equal(w.transactions.length,0);
});
test('finite positive amounts and two-decimal precision are enforced',()=>{
 for(const amount of [NaN,Infinity,0,-1,1.001,1.00001,1e13])assert.throws(()=>ledger.money(amount));
 assert.equal(ledger.money(0.29),0.29);
});
test('wallet uniqueness and missing references are checked',()=>{
 assert.throws(()=>change(fresh(),'/wallets','POST',{name:'cash'}));assert.throws(()=>change(fresh(),'/transactions','POST',{transactions:[entry(10,'income',999)]}));
});
test('transfers preserve total and never count as income',()=>{
 let w=change(fresh(),'/transactions','POST',{transactions:[entry(1000)]});
 w=change(w,'/transfers','POST',{amount:125,from_wallet_id:1,to_wallet_id:2});
 assert.equal(ledger.balance(w,1),875);assert.equal(ledger.balance(w,2),125);
 assert.equal(ledger.state(w,new Date('2026-10-19')).planning.income,1000);
 assert.throws(()=>change(w,'/transfers','POST',{amount:900,from_wallet_id:1,to_wallet_id:2}));
});
test('savings reserve funds without removing cash and release restores availability',()=>{
 let w=change(fresh(),'/wallets/1','PATCH',{opening_balance:1000});
 w=change(w,'/savings','POST',{amount:600,category:'Savings',wallet_id:1});
 assert.equal(ledger.balance(w,1),1000);assert.equal(ledger.available(w,1),400);
 assert.throws(()=>change(w,'/transfers','POST',{amount:500,from_wallet_id:1,to_wallet_id:2}));
 w=change(w,'/savings/1','DELETE');assert.equal(ledger.available(w,1),1000);
});
test('loans and repayments affect cash, not income; correction ordering is protected',()=>{
 let w=change(fresh(),'/loans','POST',{party:'Test person',direction:'borrowed',amount:1000,wallet_id:1});
 assert.equal(ledger.state(w).planning.income,0);assert.equal(ledger.balance(w,1),1000);
 w=change(w,'/loans/1/repayments','POST',{amount:250,wallet_id:1});
 assert.equal(w.loans[0].repaid,250);assert.equal(ledger.balance(w,1),750);
 assert.throws(()=>change(w,'/loans/1/repayments','POST',{amount:751,wallet_id:1}));
 assert.throws(()=>change(w,'/movements/1','DELETE'));
 w=change(w,'/movements/2','DELETE');w=change(w,'/movements/1','DELETE');assert.equal(w.loans.length,0);assert.equal(ledger.balance(w,1),0);
});
test('a past loan tracks only outstanding debt without adding cash',()=>{
 let w=change(fresh(),'/wallets/1','PATCH',{opening_balance:1000});
 w=change(w,'/loans','POST',{party:'Old loan',direction:'borrowed',amount:5000,affect_wallet:false,date:'2026-09-10T12:00:00+06:00'});
 assert.equal(ledger.balance(w,1),1000);assert.equal(w.movements.length,0);assert.equal(ledger.state(w).planning.owed,5000);
 w=change(w,'/loans/1/repayments','POST',{amount:200,wallet_id:1});assert.equal(ledger.balance(w,1),800);assert.equal(w.loans[0].repaid,200);
});
test('category rename propagates through entries and budgets',()=>{
 let w=change(fresh(),'/transactions','POST',{transactions:[entry(10,'expense')]});w=change(w,'/budgets','PUT',{category:'Food',amount:200});
 w=change(w,'/categories/1','PUT',{name:'Groceries',kind:'expense',bucket:'needs',color:'#aa33ff',icon:'food',archived:false});
 assert.equal(w.transactions[0].category,'Groceries');assert.equal(w.budgets[0].category,'Groceries');
});
test('plan allocations and split cannot exceed their limits',()=>{
 assert.throws(()=>change(fresh(),'/plan','PUT',{monthly_budget:900,planned_income:1000,savings_target:200}));
 assert.throws(()=>change(fresh(),'/plan','PUT',{monthly_budget:100,allocations:[{category:'Food',amount:101}]}));
 assert.throws(()=>change(fresh(),'/plan','PUT',{needs_percent:80,wants_percent:30,savings_percent:20}));
});
test('wallet AI balance application requires the fresh preview and preserves income history',()=>{
 let w=change(fresh(),'/transactions','POST',{transactions:[entry(70)]});
 assert.throws(()=>change(w,'/wallets/balances','POST',{wallets:[{name:'Cash',balance:1500,expected_balance:0}]}));
 w=change(w,'/wallets/balances','POST',{wallets:[{name:'Cash',balance:1500,expected_balance:70}]});
 assert.equal(ledger.balance(w,1),1500);assert.equal(w.wallets[0].opening_balance,1430);assert.equal(w.transactions.length,1);
});
test('settings persist language and all four themes; invalid options fail',()=>{
 let w=change(fresh(),'/settings','PATCH',{language:'bn',theme:'glass'});assert.equal(w.settings.language,'bn');assert.equal(w.settings.theme,'glass');
 assert.throws(()=>change(w,'/settings','PATCH',{theme:'invalid'}));assert.throws(()=>change(w,'/settings','PATCH',{language:'xx'}));
});
test('Dhaka month boundaries are used for state calculations',()=>{
 let w=change(fresh(),'/transactions','POST',{transactions:[{...entry(30),date:'2026-09-30T21:00:00Z'}]});
 assert.equal(ledger.state(w,new Date('2026-10-01T06:00:00Z')).planning.income,30);
});
test('goal deletion releases the link, preserving reserved money',()=>{
 let w=change(fresh(),'/wallets/1','PATCH',{opening_balance:500});w=change(w,'/goals','POST',{name:'Test',target:1000});w=change(w,'/savings','POST',{amount:100,category:'Savings',wallet_id:1,goal_id:1});w=change(w,'/goals/1','DELETE');assert.equal(w.savings[0].goal_id,null);assert.equal(ledger.available(w,1),400);
});
test('daily pacing does not lose a poisha to floating point rounding',()=>{
 const w=change(fresh(),'/plan','PUT',{monthly_budget:0.29});
 assert.equal(ledger.state(w,new Date('2026-10-31T06:00:00Z')).planning.daily_limit,0.29);
});
test('regular trackers enforce one tracker per expense category',()=>{
 let w=change(fresh(),'/regulars','POST',{name:'Meals',category:'Food',daily_limit:200,unit:'meals'});
 assert.throws(()=>change(w,'/regulars','POST',{name:'Duplicate',category:'Food',daily_limit:50,unit:'meals'}));
 assert.throws(()=>change(w,'/regulars','POST',{name:'Salary',category:'Salary',daily_limit:50,unit:'pcs'}));
});

test('optional AI, currency and navigation preferences validate and persist',()=>{
 let w=fresh();assert.equal(ledger.state(w).settings.ai_enabled,false);w=change(w,'/settings','PATCH',{ai_enabled:true,currency:'USD',bottom_nav:'goals'});assert.equal(w.settings.currency,'USD');assert.equal(w.settings.bottom_nav,'goals');assert.throws(()=>change(w,'/settings','PATCH',{currency:'INVALID'}));assert.throws(()=>change(w,'/settings','PATCH',{bottom_nav:'INVALID'}));
});
test('editing savings preserves cash and category deletion protects history',()=>{
 let w=change(fresh(),'/wallets/1','PATCH',{opening_balance:500});w=change(w,'/savings','POST',{amount:300,category:'Savings',wallet_id:1});w=change(w,'/savings/1','PUT',{amount:400,category:'Savings',wallet_id:1});assert.equal(ledger.balance(w,1),500);assert.equal(ledger.available(w,1),100);assert.throws(()=>change(w,'/savings/1','PUT',{amount:501,category:'Savings',wallet_id:1}));const used=w.category_details.find(c=>c.name==='Savings');assert.throws(()=>change(w,'/categories/'+used.id,'DELETE'));const unused=w.category_details.find(c=>c.name==='Food');w=change(w,'/categories/'+unused.id,'DELETE');assert.ok(!w.category_details.some(c=>c.name==='Food'));
});
