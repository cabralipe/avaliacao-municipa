from __future__ import annotations

from typing import Any, Dict, Tuple, Type

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from core.models import Secretaria


class Command(BaseCommand):
    help = 'Cria usuários de exemplo (superadmin, admin e professor) para testes rápidos.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--secretaria-nome',
            default='Secretaria Municipal de Testes',
            help='Nome da secretaria que será vinculada aos usuários não superadmin.',
        )
        parser.add_argument(
            '--password-prefix',
            default='teste',
            help='Prefixo usado para montar as senhas (ex.: teste_superadmin).',
        )
        parser.add_argument(
            '--overwrite',
            action='store_true',
            help='Sobrescreve senha/atributos caso os usuários já existam.',
        )

    @transaction.atomic
    def handle(self, *args, **options):
        User = get_user_model()
        password_prefix = options['password_prefix'].strip() or 'teste'
        secretaria_nome = options['secretaria_nome'].strip() or 'Secretaria Municipal de Testes'
        overwrite = options['overwrite']

        secretaria, _ = Secretaria.objects.get_or_create(nome=secretaria_nome)

        created: Dict[str, bool] = {}

        superadmin_defaults = {
            'email': 'superadmin@test.local',
            'role': User.ROLE_SUPERADMIN,
            'is_staff': True,
            'is_superuser': True,
        }
        superadmin, created['superadmin'] = self._ensure_user(
            User,
            username='test_superadmin',
            defaults=superadmin_defaults,
            password=f'{password_prefix}_superadmin',
            overwrite=overwrite,
        )

        admin_defaults = {
            'email': 'admin@test.local',
            'role': User.ROLE_ADMIN,
            'secretaria': secretaria,
            'is_staff': True,
        }
        admin, created['admin'] = self._ensure_user(
            User,
            username='test_admin',
            defaults=admin_defaults,
            password=f'{password_prefix}_admin',
            overwrite=overwrite,
        )

        professor_defaults = {
            'email': 'professor@test.local',
            'role': User.ROLE_PROFESSOR,
            'secretaria': secretaria,
        }
        professor, created['professor'] = self._ensure_user(
            User,
            username='test_professor',
            defaults=professor_defaults,
            password=f'{password_prefix}_professor',
            overwrite=overwrite,
        )

        self.stdout.write(self.style.SUCCESS('Usuários de teste prontos:'))
        for label, user in (
            ('superadmin', superadmin),
            ('admin', admin),
            ('professor', professor),
        ):
            status = 'criado' if created[label] else 'atualizado' if overwrite else 'já existia'
            password = f"{password_prefix}_{label}"
            self.stdout.write(f"  - {label}: {user.username} / senha: {password} ({status})")

    def _ensure_user(
        self,
        UserModel: Type[Any],
        username: str,
        defaults: Dict[str, Any],
        password: str,
        overwrite: bool = False,
    ) -> Tuple[Any, bool]:
        user, created = UserModel.objects.get_or_create(username=username, defaults=defaults)
        if created or overwrite:
            for key, value in defaults.items():
                setattr(user, key, value)
            user.set_password(password)
            user.save()
        return user, created
