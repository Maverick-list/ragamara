import subprocess
from pathlib import Path

screens = [
    ("large_desktop_1920x1080", 1920, 1080),
    ("standard_desktop_1280x800", 1280, 800),
    ("tablet_landscape_1024x768", 1024, 768),
    ("tablet_portrait_768x1024", 768, 1024),
    ("mobile_portrait_390x844", 390, 844),
    ("small_mobile_360x640", 360, 640)
]

for label, w, h in screens:
    # Test App
    out_app = f"/home/firza-ilmi/.gemini/antigravity/scratch/ragamara/screenshot_resp_app_{label}.png"
    cmd_app = [
        "google-chrome",
        "--headless",
        "--no-sandbox",
        "--disable-gpu",
        f"--window-size={w},{h}",
        "--virtual-time-budget=1000",
        f"--screenshot={out_app}",
        "file:///home/firza-ilmi/.gemini/antigravity/scratch/ragamara/app.html"
    ]
    subprocess.run(cmd_app, check=True)
    print(f"Captured App at {label} ({w}x{h})")

    # Test Landing
    out_land = f"/home/firza-ilmi/.gemini/antigravity/scratch/ragamara/screenshot_resp_landing_{label}.png"
    cmd_land = [
        "google-chrome",
        "--headless",
        "--no-sandbox",
        "--disable-gpu",
        f"--window-size={w},{h}",
        "--virtual-time-budget=1000",
        f"--screenshot={out_land}",
        "file:///home/firza-ilmi/.gemini/antigravity/scratch/ragamara/landing.html"
    ]
    subprocess.run(cmd_land, check=True)
    print(f"Captured Landing at {label} ({w}x{h})")

print("All responsive testing screenshots captured successfully!")
