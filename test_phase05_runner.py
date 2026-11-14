import subprocess
from pathlib import Path

app_path = Path("/home/firza-ilmi/.gemini/antigravity/scratch/ragamara/app.html")
html = app_path.read_text(encoding="utf-8")

tests = [
    {
        "name": "screenshot_koleksi_culturepedia.png",
        "size": "1280,900",
        "inject": "<script>window.addEventListener('DOMContentLoaded', () => { switchView('koleksi'); switchKoleksiTab('culturepedia'); });</script>"
    },
    {
        "name": "screenshot_koleksi_maskot.png",
        "size": "1280,900",
        "inject": "<script>window.addEventListener('DOMContentLoaded', () => { switchView('koleksi'); switchKoleksiTab('maskot'); RagamaraEcosystem.MascotCollection.setExpression('celebrating'); });</script>"
    },
    {
        "name": "screenshot_koleksi_prestasi.png",
        "size": "1280,900",
        "inject": "<script>window.addEventListener('DOMContentLoaded', () => { switchView('koleksi'); switchKoleksiTab('prestasi'); });</script>"
    },
    {
        "name": "screenshot_view_profil.png",
        "size": "1280,900",
        "inject": "<script>window.addEventListener('DOMContentLoaded', () => { switchView('profil'); RagamaraEcosystem.Profile.equipFrame('frame_gold_minang'); });</script>"
    },
    {
        "name": "screenshot_culturepedia_modal.png",
        "size": "1280,900",
        "inject": "<script>window.addEventListener('DOMContentLoaded', () => { switchView('koleksi'); RagamaraEcosystem.Culturepedia.openDetail('id_dapobud_f31f397c-0647-4667-bbfb-6aa1397ca224'); });</script>"
    },
    {
        "name": "screenshot_regional_dossier.png",
        "size": "1280,900",
        "inject": "<script>window.addEventListener('DOMContentLoaded', () => { RagamaraEcosystem.RegionalDossier.open('sumatra'); });</script>"
    },
    {
        "name": "screenshot_leaderboard_modal.png",
        "size": "1280,900",
        "inject": "<script>window.addEventListener('DOMContentLoaded', () => { openLeaderboardModal(); });</script>"
    },
    {
        "name": "screenshot_daily_missions_modal.png",
        "size": "1280,900",
        "inject": "<script>window.addEventListener('DOMContentLoaded', () => { openDailyMissionsModal(); });</script>"
    },
    {
        "name": "screenshot_mobile_culturepedia.png",
        "size": "390,844",
        "inject": "<script>window.addEventListener('DOMContentLoaded', () => { switchView('koleksi'); switchKoleksiTab('culturepedia'); });</script>"
    }
]

for t in tests:
    test_html = html.replace("</body>", f"{t['inject']}</body>")
    test_file = Path(f"/home/firza-ilmi/.gemini/antigravity/scratch/ragamara/temp_test_{t['name']}.html")
    test_file.write_text(test_html, encoding="utf-8")
    
    out_img = f"/home/firza-ilmi/.gemini/antigravity/scratch/ragamara/{t['name']}"
    cmd = [
        "google-chrome",
        "--headless",
        "--no-sandbox",
        "--disable-gpu",
        f"--window-size={t['size']}",
        "--virtual-time-budget=1500",
        f"--screenshot={out_img}",
        f"file://{test_file.resolve()}"
    ]
    subprocess.run(cmd, check=True)
    print(f"Captured {t['name']} successfully!")
    test_file.unlink()

print("All Phase 05 screenshots generated!")
