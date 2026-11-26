"""Capture screenshots of the running app (backend serving frontend/dist on :8000).

    pip install playwright && python scripts/take_screenshots.py --theme light
"""
from __future__ import annotations

import argparse
import shutil
from pathlib import Path

from playwright.sync_api import sync_playwright

OUT = Path(__file__).resolve().parents[1] / "docs" / "screenshots"
BASE = "http://127.0.0.1:8000"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--chrome", default=shutil.which("google-chrome") or shutil.which("chromium"))
    ap.add_argument("--theme", default="light", choices=["dark", "light"])
    a = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    errors: list[str] = []
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=a.chrome, args=["--no-sandbox"])
        ctx = b.new_context(viewport={"width": 1440, "height": 900})
        ctx.add_init_script(f"localStorage.setItem('iv-theme', '{a.theme}')")
        page = ctx.new_page()
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda m: m.type == "error" and errors.append(m.text))

        def shot(name: str, full: bool = True):
            page.wait_for_timeout(900)
            page.screenshot(path=str(OUT / f"{name}_{a.theme}.png"), full_page=full)
            print("saved", name)

        page.goto(f"{BASE}/login")
        page.wait_for_selector("text=Sign in")
        shot("01_login", full=False)
        page.click("button[type=submit]")
        page.wait_for_selector("text=Voice of Customer dashboard")
        page.wait_for_selector("text=Highest negative sentiment rate")
        shot("02_dashboard")
        page.goto(f"{BASE}/analyze")
        page.fill("textarea", "The staff were lovely and helpful but the wifi kept dropping and the shower was cold.")
        page.click("text=Clause mode")
        page.click("button:has-text('Analyse review')")
        page.wait_for_selector("text=Detected aspects")
        shot("03_analyze")
        page.click("button[role=tab]:has-text('Speak')")
        shot("04_voice", full=False)
        page.goto(f"{BASE}/batch")
        page.wait_for_selector("text=Batch upload")
        shot("05_batch", full=False)
        page.goto(f"{BASE}/reviews")
        page.wait_for_selector("tbody tr")
        shot("06_reviews")
        page.click("tbody tr >> nth=3")
        page.wait_for_selector("text=Gold sentiment")
        shot("07_review_detail", full=False)
        page.keyboard.press("Escape")
        page.goto(f"{BASE}/research")
        page.wait_for_selector("text=Multi-label aspect identification")
        shot("08_research")
        b.close()
    print("errors:", errors or "none")


if __name__ == "__main__":
    main()
