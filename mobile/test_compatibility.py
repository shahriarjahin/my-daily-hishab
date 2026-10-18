"""Compare Android ledger output with the Python API's cloud schema and derived state."""
import json
from pathlib import Path
import subprocess
import unittest
from sqlmodel import create_engine,Session
from backend.database import init_db
from backend.workspace import import_workspace,validate_workspace
from backend.finance import finance_state,wallet_balance

ROOT=Path(__file__).resolve().parent

class AndroidCompatibility(unittest.TestCase):
    def test_android_records_roundtrip_and_calculate_like_web(self):
        program=r'''
const L=require('./mobile/web/ledger.js');
let w=require('./mobile/fixtures/empty-workspace.json');
const run=(p,m,b)=>{w=L.mutate(w,p,m,b).workspace;};
run('/wallets/1','PATCH',{opening_balance:2000});
run('/transactions','POST',{transactions:[{description:'Salary',category:'Salary',type:'income',amount:5000,wallet_id:1},{description:'Food',category:'Food',type:'expense',amount:250.25,wallet_id:1,quantity:2,unit:'meals'}]});
run('/transfers','POST',{amount:100.25,from_wallet_id:1,to_wallet_id:2});
run('/goals','POST',{name:'Reserve',target:2000});
run('/savings','POST',{amount:400,category:'Savings',wallet_id:1,goal_id:1});
run('/loans','POST',{party:'Test',direction:'borrowed',amount:1000,wallet_id:1});
run('/loans/1/repayments','POST',{amount:100,wallet_id:1});
run('/regulars','POST',{name:'Meals',category:'Food',daily_limit:150,unit:'meals'});
run('/plan','PUT',{monthly_budget:3000,planned_income:5000,savings_target:1000,allocations:[{category:'Food',amount:2000}]});
run('/settings','PATCH',{theme:'glass',language:'bn'});
console.log(JSON.stringify({workspace:w,state:L.state(w)}));
'''
        result=json.loads(subprocess.check_output(['node','-e',program],cwd=ROOT.parent,text=True,encoding='utf-8'))
        validate_workspace(result['workspace'])
        engine=create_engine('sqlite://');init_db(engine)
        with Session(engine) as session:
            import_workspace(session,result['workspace']);session.commit()
            expected=finance_state(session)
            for key,value in expected['planning'].items():
                self.assertEqual(result['state']['planning'][key],value,key)
            for wallet in result['state']['wallets']:
                self.assertEqual(wallet['balance'],wallet_balance(session,wallet['id']))
        engine.dispose()

if __name__=='__main__':unittest.main()
