import subprocess
from pathlib import Path

app_path = Path("/home/firza-ilmi/.gemini/antigravity/scratch/ragamara/app.html")
landing_path = Path("/home/firza-ilmi/.gemini/antigravity/scratch/ragamara/landing.html")

app_html = app_path.read_text(encoding="utf-8")
landing_html = landing_path.read_text(encoding="utf-8")

scenarios = [
    # 1. Landing Page (Desktop)
    {
        "file": "screenshot_final_landing.png",
        "size": "1280,900",
        "base": landing_html,
        "inject": ""
    },
    # 2. Landing Page (Mobile)
    {
        "file": "screenshot_final_landing_mobile.png",
        "size": "390,844",
        "base": landing_html,
        "inject": ""
    },
    # 3. Game Dashboard (Player Headquarters)
    {
        "file": "screenshot_final_dashboard.png",
        "size": "1280,900",
        "base": app_html,
        "inject": "<script>window.addEventListener('DOMContentLoaded', () => switchView('beranda'));</script>"
    },
    # 4. Adventure Map (Indonesian Cultural World)
    {
        "file": "screenshot_final_adventure_map.png",
        "size": "1280,900",
        "base": app_html,
        "inject": "<script>window.addEventListener('DOMContentLoaded', () => switchView('petualangan'));</script>"
    },
    # 5. Learning Journey (Minangkabau Chapters)
    {
        "file": "screenshot_final_learning_journey.png",
        "size": "1280,900",
        "base": app_html,
        "inject": "<script>window.addEventListener('DOMContentLoaded', () => switchView('belajar'));</script>"
    },
    # 6. Mini-Game Active (Mini-Game A Multiple Choice)
    {
        "file": "screenshot_final_minigame_A.png",
        "size": "1280,900",
        "base": app_html,
        "inject": "<script>window.addEventListener('DOMContentLoaded', () => { switchView('belajar'); MiniGameEngine.openArena('A'); });</script>"
    },
    # 7. Lesson Completion / Celebration with Confetti Canvas
    {
        "file": "screenshot_final_celebration.png",
        "size": "1280,900",
        "base": app_html,
        "inject": "<script>window.addEventListener('DOMContentLoaded', () => { switchView('belajar'); MiniGameEngine.openArena('A'); MiniGameEngine.checkAnswer(1); });</script>"
    },
    # 8. Culturepedia (10 OPK & 7 Regions)
    {
        "file": "screenshot_final_culturepedia.png",
        "size": "1280,900",
        "base": app_html,
        "inject": "<script>window.addEventListener('DOMContentLoaded', () => { switchView('koleksi'); switchKoleksiTab('culturepedia'); });</script>"
    },
    # 9. Mascot Collection & Interactive Studio
    {
        "file": "screenshot_final_mascot_collection.png",
        "size": "1280,900",
        "base": app_html,
        "inject": "<script>window.addEventListener('DOMContentLoaded', () => { switchView('koleksi'); switchKoleksiTab('maskot'); RagamaraEcosystem.MascotCollection.setExpression('happy'); });</script>"
    },
    # 10. Competitive Leaderboard (Podium & Division)
    {
        "file": "screenshot_final_leaderboard.png",
        "size": "1280,900",
        "base": app_html,
        "inject": "<script>window.addEventListener('DOMContentLoaded', () => openLeaderboardModal());</script>"
    },
    # 11. Player Profile (RPG Identity & Frame)
    {
        "file": "screenshot_final_player_profile.png",
        "size": "1280,900",
        "base": app_html,
        "inject": "<script>window.addEventListener('DOMContentLoaded', () => switchView('profil'));</script>"
    },
    # 12. Mobile Dashboard (390x844)
    {
        "file": "screenshot_final_mobile_dashboard.png",
        "size": "390,844",
        "base": app_html,
        "inject": "<script>window.addEventListener('DOMContentLoaded', () => switchView('beranda'));</script>"
    }
]

for s in scenarios:
    t_html = s["base"].replace("</body>", f"{s['inject']}</body>")
    t_file = Path(f"/home/firza-ilmi/.gemini/antigravity/scratch/ragamara/temp_{s['file']}.html")
    t_file.write_text(t_html, encoding="utf-8")
    
    out_img = f"/home/firza-ilmi/.gemini/antigravity/scratch/ragamara/{s['file']}"
    cmd = [
        "google-chrome",
        "--headless",
        "--no-sandbox",
        "--disable-gpu",
        f"--window-size={s['size']}",
        "--virtual-time-budget=1500",
        f"--screenshot={out_img}",
        f"file://{t_file.resolve()}"
    ]
    subprocess.run(cmd, check=True)
    print(f"Captured {s['file']}")
    t_file.unlink()

print("All final QA screenshots captured successfully!")
