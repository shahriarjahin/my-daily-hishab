"""Package actual browser captures with an illustrative, code-rendered phone gallery."""
from pathlib import Path
import zipfile

root = Path(__file__).resolve().parents[1] / "docs/demo"
files = sorted((root / "screenshots").glob("[0-9]*.jpg"))
labels = ["Home", "Wallets", "Budgets", "Goals & savings", "Insights", "Activity", "Loans",
          "Regular spending", "Add entry", "Transfer", "Categories", "Backup import"]
cards = "".join(f'<article><h2>{label}</h2><div class="phone"><div class="status"><span>9:41</span>'
                f'<i></i><span>▮▮▮ ▰</span></div><img src="screenshots/{p.name}" alt="{label}">'
                '<div class="home"></div></div></article>' for p, label in zip(files, labels))
html = '''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Hishab · App showcase</title><style>*{box-sizing:border-box}body{margin:0;background:#e8e5de;color:#171613;font:16px system-ui;padding:48px 24px}
header{max-width:1280px;margin:0 auto 40px}h1{font-size:44px;letter-spacing:-2px;margin:0}header p{color:#67635a}
main{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:36px;max-width:1280px;margin:auto}
article h2{font-size:14px;text-transform:uppercase;letter-spacing:2px;margin:0 0 14px}.phone{max-width:330px;margin:auto;background:#12110f;border:7px solid #292824;border-radius:48px;overflow:hidden;box-shadow:0 24px 45px #0002}
.status{height:43px;color:white;display:flex;justify-content:space-between;align-items:center;padding:0 21px;font-size:11px;font-weight:600;position:relative}
.status i{position:absolute;left:35%;width:30%;height:24px;top:5px;border-radius:20px;background:#000}.phone img{display:block;width:100%;height:auto}
.home{height:19px;position:relative}.home:after{content:"";display:block;width:36%;height:4px;border-radius:5px;background:#aaa;margin:5px auto}
footer{text-align:center;margin-top:50px;color:#67635a;font-size:13px}</style><header><h1>Hishab. Everyday, in balance.</h1>
<p>18 months · 3,467 transactions · 5 wallets · 4 goals</p><p>Real app captures from fictional demo records.</p></header><main>''' + cards + '''</main>
<footer>iPhone-sized web previews. Frames are illustrative; these are not physical-device captures.</footer></html>'''
(root / "showcase.html").write_text(html, encoding="utf-8")
with zipfile.ZipFile(root / "hishab-showcase.zip", "w", zipfile.ZIP_DEFLATED) as z:
    for p in [root / "hishab-demo-18-months.json", root / "README.md", root / "showcase.html",
              *sorted((root / "screenshots").glob("*.jpg"))]:
        z.write(p, p.relative_to(root))
print(f"Packaged {len(files)} showcase screens")
