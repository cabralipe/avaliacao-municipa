import sys
import types
from pathlib import Path

import pytest


class _Capture:
    def __init__(self):
        self.set_content_args = None
        self.pdf_kwargs = None
        self.browser_closed = False


class FakePage:
    def __init__(self, capture: _Capture):
        self._capture = capture

    def set_content(self, html: str, wait_until: str):
        self._capture.set_content_args = (html, wait_until)

    def pdf(self, **kwargs):
        self._capture.pdf_kwargs = kwargs
        output = Path(kwargs['path'])
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_bytes(b'%PDF-1.4 test pdf')


class FakeBrowser:
    def __init__(self, page: FakePage, capture: _Capture):
        self._page = page
        self._capture = capture

    def new_page(self) -> FakePage:
        return self._page

    def close(self) -> None:
        self._capture.browser_closed = True


class FakeChromium:
    def __init__(self, page: FakePage, capture: _Capture):
        self._page = page
        self._capture = capture

    def launch(self) -> FakeBrowser:
        return FakeBrowser(self._page, self._capture)


class FakePlaywright:
    def __init__(self, page: FakePage, capture: _Capture):
        self.chromium = FakeChromium(page, capture)


class FakeContext:
    def __init__(self, page: FakePage, capture: _Capture):
        self._page = page
        self._capture = capture

    def __enter__(self) -> FakePlaywright:
        return FakePlaywright(self._page, self._capture)

    def __exit__(self, exc_type, exc, tb) -> bool:
        return False


@pytest.mark.django_db
def test_render_prova_pdf_creates_file(monkeypatch, tmp_path):
    capture = _Capture()
    fake_page = FakePage(capture)

    def fake_sync_playwright():
        return FakeContext(fake_page, capture)

    sync_module = types.SimpleNamespace(sync_playwright=fake_sync_playwright)
    monkeypatch.setitem(sys.modules, 'playwright', types.SimpleNamespace(sync_api=sync_module))
    monkeypatch.setitem(sys.modules, 'playwright.sync_api', sync_module)

    from avaliacoes import pdf_service

    monkeypatch.setattr(pdf_service, 'sync_playwright', fake_sync_playwright)
    monkeypatch.setattr(pdf_service, '_qr_png_b64', lambda payload: 'fake-b64')

    output_path = tmp_path / 'pdfs' / 'prova.pdf'
    contexto = {
        'titulo': 'Prova de Matemática',
        'aluno_nome': 'Fulano',
        'turma_nome': '6º A',
        'escola_nome': 'Escola Municipal Central',
        'data_aplicacao': '2025-11-10',
        'questoes': [
            {
                'ordem': 1,
                'enunciado': 'Quanto é 2 + 2?',
                'alternativas': [
                    {'letra': 'A', 'texto': '1'},
                    {'letra': 'B', 'texto': '2'},
                    {'letra': 'C', 'texto': '3'},
                    {'letra': 'D', 'texto': '4'},
                    {'letra': 'E', 'texto': '5'},
                ],
            }
        ],
        'total_questoes': 1,
        'qr_payload': {'token': 'abc'},
    }

    generated_path = pdf_service.render_prova_pdf(contexto, output_path)

    assert Path(generated_path).exists()
    html, wait_until = capture.set_content_args
    assert 'Prova de Matemática' in html
    assert 'fake-b64' in html
    assert wait_until == 'load'
    assert capture.pdf_kwargs['path'] == str(output_path)
    assert capture.browser_closed is True
