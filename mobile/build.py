"""Build a signed Android APK. No server secrets or financial records enter the APK."""
import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import secrets
import shutil
import subprocess
import sys
from dotenv import dotenv_values

ROOT=Path(__file__).resolve().parent
REPO=ROOT.parent

def prepare():
    from scripts.prepare_offline_ai import prepare as prepare_ai
    ai_source = prepare_ai()
    from sqlmodel import Session,create_engine
    from backend.database import init_db
    from backend.workspace import export_workspace
    subprocess.run([sys.executable,str(REPO/'scripts/build_frontend.py')],cwd=REPO,check=True)
    npm=shutil.which('npm.cmd') or shutil.which('npm')
    subprocess.run([npm,'run','cap:sync'],cwd=REPO/'frontend',check=True)
    engine=create_engine('sqlite://');init_db(engine)
    with Session(engine) as session:empty=export_workspace(session)
    engine.dispose()
    env=dotenv_values(REPO/'.env')
    supplied=json.loads((ROOT/'mobile-config.json').read_text()) if (ROOT/'mobile-config.json').exists() else {}
    config={
        'supabase_url':os.environ.get('SUPABASE_URL') or supplied.get('supabase_url') or env.get('SUPABASE_URL') or env.get('VITE_SUPABASE_URL'),
        'supabase_anon_key':os.environ.get('SUPABASE_ANON_KEY') or supplied.get('supabase_anon_key') or env.get('SUPABASE_ANON_KEY') or env.get('VITE_SUPABASE_ANON_KEY'),
        'backend_url':os.environ.get('HISHAB_BACKEND_URL') or supplied.get('backend_url') or 'https://mydailyhishab.vercel.app',
    }
    if not config['supabase_url'] or not config['supabase_anon_key']:
        raise SystemExit('Set SUPABASE_URL and SUPABASE_ANON_KEY for the Android build.')
    try:
        payload=config['supabase_anon_key'].split('.')[1]
        claims=json.loads(base64.urlsafe_b64decode(payload+'='*(-len(payload)%4)))
        if claims.get('role')!='anon':raise ValueError()
    except Exception:
        if not config['supabase_anon_key'].startswith('sb_publishable_'):
            raise SystemExit('Only a Supabase anon or publishable key may be bundled.')
    assets=ROOT/'android/app/build/generated/hishabConfig'
    assets.mkdir(parents=True,exist_ok=True)
    (assets/'mobile-config.json').write_text(json.dumps(config),encoding='utf-8')
    (assets/'empty-workspace.json').write_text(json.dumps(empty),encoding='utf-8')
    shutil.copyfile(ROOT/'offline-ai.json',assets/'offline-ai.json')
    shutil.copyfile(ai_source/'LICENSE',assets/'llama-LICENSE.txt')
    shutil.copyfile(ROOT/'THIRD_PARTY_AI.md',assets/'THIRD_PARTY_AI.md')
    return assets

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--prepare-only',action='store_true');parser.add_argument('--ci',action='store_true');args=parser.parse_args()
    sys.path.insert(0,str(REPO));prepare()
    if args.prepare_only:return
    tools=ROOT/'.tools'
    java=Path(os.environ.get('JAVA_HOME',''))
    if not (java/'bin/java.exe').exists() and os.name=='nt':java=next((tools/'jdk21').glob('*'))
    sdk=Path(os.environ.get('ANDROID_HOME') or os.environ.get('ANDROID_SDK_ROOT') or tools/'sdk')
    env={**os.environ,'JAVA_HOME':str(java),'ANDROID_HOME':str(sdk),'GRADLE_USER_HOME':str(ROOT/'.gradle')}
    env['PATH']=str(java/'bin')+os.pathsep+env.get('PATH','')
    (ROOT/'android/local.properties').write_text('sdk.dir='+str(sdk).replace('\\','/')+'\n')
    keys=ROOT/'release-keys';keys.mkdir(exist_ok=True)
    if not (keys/'hishab-release.p12').exists():
        if args.ci:raise SystemExit('Release signing key must be restored from CI secrets.')
        password=secrets.token_urlsafe(36)
        env['HISHAB_KEY_PASSWORD']=password
        keytool=str(java/'bin'/('keytool.exe' if os.name=='nt' else 'keytool'))
        subprocess.run([keytool,'-genkeypair','-keystore',str(keys/'hishab-release.p12'),'-storetype','PKCS12','-alias','hishab','-keyalg','RSA','-keysize','3072','-validity','10000','-dname','CN=Shahriar Morshed Jahin, OU=DigitXBD, O=DigitXBD, C=BD','-storepass:env','HISHAB_KEY_PASSWORD','-keypass:env','HISHAB_KEY_PASSWORD'],env=env,check=True)
        (keys/'signing.properties').write_text('storePassword='+password+'\nkeyPassword='+password+'\nkeyAlias=hishab\n')
        print('Created a private release key. Back up mobile/release-keys securely; updates need this same key.',flush=True)
    gradle=next((tools/'gradle814').glob('gradle-*/bin/gradle.bat')) if os.name=='nt' else Path(shutil.which('gradle') or '')
    subprocess.run([str(gradle),'--no-daemon','assembleRelease','bundleRelease'],cwd=ROOT/'android',env=env,check=True)
    dist=ROOT/'dist';dist.mkdir(exist_ok=True)
    version=json.loads((ROOT/'version.json').read_text())['name']
    for source,target in [('apk/release/app-release.apk',f'hishab-{version}-release.apk'),('bundle/release/app-release.aab',f'hishab-{version}-release.aab')]:
        output=dist/target;shutil.copyfile(ROOT/'android/app/build/outputs'/source,output)
        (dist/(target+'.sha256')).write_text(hashlib.sha256(output.read_bytes()).hexdigest()+'  '+target+'\n')
        print('Built '+str(output),flush=True)

if __name__=='__main__':main()
