from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
source_path = ROOT / "web" / "public" / "openasset-logo.png"
public_dir = ROOT / "web" / "public"
app_dir = ROOT / "web" / "src" / "app"

source = Image.open(source_path).convert("RGBA")

for size, filename in ((180, "apple-touch-icon.png"), (192, "openasset-icon-192.png"), (512, "openasset-icon-512.png")):
    source.resize((size, size), Image.Resampling.LANCZOS).save(public_dir / filename, optimize=True)

source.resize((512, 512), Image.Resampling.LANCZOS).save(app_dir / "icon.png", optimize=True)
source.resize((180, 180), Image.Resampling.LANCZOS).save(app_dir / "apple-icon.png", optimize=True)
source.save(app_dir / "favicon.ico", format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])
