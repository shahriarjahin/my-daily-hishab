"""Generate iOS Safari and PWA non-transparent icons from the Taka logo asset."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent

def generate():
    # Source asset: Taka icon
    src_path = ROOT / "backend" / "static" / "hishab-icon-v2-512.png"
    src = Image.open(src_path).convert("RGBA")

    # Card color matching the logo's card color (solid, non-transparent)
    bg_color = (1, 124, 241) # #017cf1

    # Generate 512x512 non-transparent RGB PNG
    img_512 = Image.new("RGB", (512, 512), bg_color)
    img_512.paste(src, (0, 0), src)

    # Generate 180x180 non-transparent RGB PNG for apple-touch-icon
    src_180 = src.resize((180, 180), Image.Resampling.LANCZOS)
    img_180 = Image.new("RGB", (180, 180), bg_color)
    img_180.paste(src_180, (0, 0), src_180)

    # Output directories
    dirs = [
        ROOT / "public",
        ROOT / "frontend" / "public",
        ROOT / "backend" / "static",
        ROOT / "backend" / "static" / "react"
    ]

    for d in dirs:
        d.mkdir(parents=True, exist_ok=True)
        img_180.save(d / "apple-touch-icon.png", format="PNG", optimize=True)
        img_180.save(d / "apple-touch-icon-precomposed.png", format="PNG", optimize=True)
        img_512.save(d / "icon-512.png", format="PNG", optimize=True)
        print(f"Saved icons to {d}")

if __name__ == "__main__":
    generate()
