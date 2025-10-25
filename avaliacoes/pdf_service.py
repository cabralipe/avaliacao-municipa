import base64
import io
from pathlib import Path
from typing import Dict

import qrcode
from jinja2 import Environment, FileSystemLoader
from playwright.sync_api import sync_playwright
from django.conf import settings


TEMPLATES_DIR = Path(settings.BASE_DIR) / 'avaliacoes' / 'templates'
TEMPLATES_DIR.mkdir(parents=True, exist_ok=True)

_env = Environment(loader=FileSystemLoader(str(TEMPLATES_DIR)))


def _qr_png_b64(payload: Dict) -> str:
    image = qrcode.make(payload)
    buffer = io.BytesIO()
    image.save(buffer, format='PNG')
    return base64.b64encode(buffer.getvalue()).decode('utf-8')


def render_prova_pdf(context: Dict, out_path: Path) -> str:
    template = _env.get_template('prova.html')
    html = template.render({**context, 'qr_png_b64': _qr_png_b64(context['qr_payload'])})
    output_path = Path(out_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        page = browser.new_page()
        page.set_content(html, wait_until='load')
        page.pdf(
            path=str(output_path),
            format='A4',
            print_background=True,
            margin={'top': '20mm', 'bottom': '20mm', 'left': '15mm', 'right': '15mm'},
        )
        browser.close()
    return str(output_path)
