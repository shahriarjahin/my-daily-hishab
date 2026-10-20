"""Build the React UI and publish only public, credential-free assets for FastAPI."""
from pathlib import Path
import hashlib
import shutil
import subprocess

ROOT = Path(__file__).resolve().parent.parent

def build():
    frontend = ROOT / 'frontend'
    static = frontend / 'public' / 'static'
    static.mkdir(parents=True, exist_ok=True)
    for name in ('hishab-logo-v2.png', 'hishab-icon-v2-192.png', 'hishab-icon-v2-512.png',
                 'NotoSansBengali-400.ttf', 'NotoSansBengali-600.ttf', 'NotoSansBengali-OFL.txt'):
        shutil.copyfile(ROOT / 'backend/static' / name, static / name)
    shutil.copytree(ROOT / 'backend/static/wallet-logos', static / 'wallet-logos', dirs_exist_ok=True)
    npm = shutil.which('npm.cmd') or shutil.which('npm')
    subprocess.run([npm, 'run', 'build'], cwd=frontend, check=True)
    published = ROOT / 'backend/static/react'
    assert published.resolve().is_relative_to(ROOT / 'backend/static')
    if published.exists():
        shutil.rmtree(published)
    shutil.copytree(frontend / 'dist', published)
    assets=['/assets/'+p.name for p in (published/'assets').iterdir()]
    cache="hishab-react-"+hashlib.sha256((published/"index.html").read_bytes()).hexdigest()[:12]
    worker="const CACHE="+repr(cache)+";const ASSETS="+repr(assets)+";self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));self.skipWaiting();});self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('hishab-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin||!ASSETS.includes(u.pathname))return;e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));});"
    (ROOT/'backend/static/sw.js').write_text(worker,encoding='utf-8')
    print('React production assets published to backend/static/react', flush=True)

if __name__ == '__main__':
    build()
