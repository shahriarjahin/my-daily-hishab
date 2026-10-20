"""Package the developer's original iPhone captures without changing the images."""
from pathlib import Path
import zipfile

repo = Path(__file__).resolve().parents[1]
root = repo / "docs/demo"
items = [('home.PNG','Home & cash flow'),('activity.PNG','Activity & filters'),
         ('insights.PNG','Spending insights'),('light_theme.PNG','Light theme'),
         ('glass_theme_BNG.PNG','Glass theme · বাংলা'),('wallets.PNG','Wallets'),
         ('budgets.PNG','Budgets'),('goals.PNG','Goals & savings'),
         ('add_entry.PNG','Quick entry'),('wallet_transfer.PNG','Wallet transfers'),
         ('loans.PNG','Loans & repayments'),('categories.PNG','Categories'),
         ('settings.PNG','Settings'),('data_export_import.PNG','Import & export'),
         ('sign_in.PNG','Sign in & passkeys'),('sign_up.PNG','Create an account')]
files = [repo / 'screenshots' / name for name, _ in items]
for p in files:
    if not p.is_file():
        raise FileNotFoundError(p)
cards = ''.join(f'<article><h2>{label}</h2><a href="../../screenshots/{name}" target="_blank" rel="noopener"><img src="../../screenshots/{name}" alt="Hishab — {label}" loading="lazy" width="1179" height="2556"></a></article>' for name,label in items)
html = '''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Hishab · iPhone showcase</title><style>*{box-sizing:border-box}body{margin:0;background:#e8e5de;color:#171613;font:16px system-ui;padding:48px 24px}
header{max-width:1280px;margin:0 auto 40px}h1{font-size:44px;letter-spacing:-2px;margin:0}header p{color:#67635a}
main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:36px;max-width:1280px;margin:auto}
article h2{font-size:14px;text-transform:uppercase;letter-spacing:2px;margin:0 0 14px}
article a{display:block;max-width:330px;margin:auto;border-radius:28px;overflow:hidden;box-shadow:0 18px 40px #0002}article img{display:block;width:100%;height:auto}
article a:focus-visible{outline:3px solid #b07a14;outline-offset:5px}
footer{text-align:center;margin-top:50px;color:#67635a;font-size:13px}</style><header><h1>Hishab. Everyday, in balance.</h1>
<p>Wallets, budgets, savings and everyday bookkeeping.</p><p>Original iPhone screenshots by Shahriar Morshed Jahin · Demo account<br>Select a screen for the full-resolution image.</p></header><main>''' + cards + '''</main>
<footer>16 original captures · English & বাংলা · Dark, light & glass themes</footer></html>'''
(root / "showcase.html").write_text(html, encoding="utf-8")
with zipfile.ZipFile(root / "hishab-showcase.zip", "w", zipfile.ZIP_DEFLATED) as z:
    for p in [root / "hishab-demo-18-months.json", root / "README.md", root / "showcase.html",
              repo / "README.md", repo / "screenshots/README.md", *files]:
        z.write(p, p.relative_to(repo))
print(f"Packaged {len(files)} original iPhone screenshots")
