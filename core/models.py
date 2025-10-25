from django.contrib.auth.models import AbstractUser
from django.db import models


class Secretaria(models.Model):
    nome = models.CharField(max_length=255)
    cnpj = models.CharField(max_length=18, blank=True)
    cidade = models.CharField(max_length=120, blank=True)

    def __str__(self) -> str:
        return self.nome


class User(AbstractUser):
    ROLE_SUPERADMIN = 'superadmin'
    ROLE_ADMIN = 'admin'
    ROLE_PROFESSOR = 'professor'

    ROLE_CHOICES = (
        (ROLE_SUPERADMIN, 'Super Admin'),
        (ROLE_ADMIN, 'Admin'),
        (ROLE_PROFESSOR, 'Professor'),
    )

    secretaria = models.ForeignKey(Secretaria, on_delete=models.PROTECT, null=True, blank=True)
    role = models.CharField(max_length=30, choices=ROLE_CHOICES, default=ROLE_PROFESSOR)

    def is_superadmin(self) -> bool:
        return self.role == self.ROLE_SUPERADMIN
