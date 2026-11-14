import subprocess
import time
from pathlib import Path

# Create a test HTML that automatically opens MiniGameEngine.openArena('A')
app_path = Path("/home/firza-ilmi/.gemini/antigravity/scratch/ragamara/app.html")
html = app_path.read_text(encoding="utf-8")

for game_type in ["A", "B", "C", "D"]:
    test_html = html.replace(
        "window.addEventListener('DOMContentLoaded', () => {",
        f"window.addEventListener('DOMContentLoaded', () => {{\n      setTimeout(() => MiniGameEngine.openArena('{game_type}'), 400);"
    )
    test_file = Path(f"/home/firza-ilmi/.gemini/antigravity/scratch/ragamara/test_minigame_{game_type}.html")
    test_file.write_text(test_html, encoding="utf-8")

    out_img = f"/home/firza-ilmi/.gemini/antigravity/scratch/ragamara/screenshot_minigame_{game_type}.png"
    cmd = [
        "google-chrome",
        "--headless",
        "--no-sandbox",
        "--disable-gpu",
        "--window-size=1280,900",
        f"--screenshot={out_img}",
        f"file://{test_file}"
    ]
    subprocess.run(cmd, check=True)
    print(f"Captured screenshot for Mini-Game {game_type} -> {out_img}")
    test_file.unlink()
