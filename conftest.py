import os

import pytest

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'app.settings_test')
os.environ.setdefault('USE_SQLITE_FOR_TESTS', 'True')


@pytest.fixture(autouse=True)
def _override_media_root(tmp_path, settings):
    media_root = tmp_path / "media"
    media_root.mkdir(parents=True, exist_ok=True)
    settings.MEDIA_ROOT = media_root
    yield
