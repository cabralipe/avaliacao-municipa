from .settings import *  # noqa: F401,F403

DATABASES['default'] = {  # type: ignore[name-defined]
    'ENGINE': 'django.db.backends.sqlite3',
    'NAME': BASE_DIR / 'db.sqlite3',
}

PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.MD5PasswordHasher',
]

MIDDLEWARE = [mw for mw in MIDDLEWARE if mw != 'whitenoise.middleware.WhiteNoiseMiddleware']  # type: ignore[name-defined]
