from django.db import models

from core.models import Secretaria


class Escola(models.Model):
    secretaria = models.ForeignKey(Secretaria, on_delete=models.PROTECT)
    nome = models.CharField(max_length=255)
    codigo_inep = models.CharField(max_length=20, blank=True)

    def __str__(self) -> str:
        return self.nome


class Turma(models.Model):
    secretaria = models.ForeignKey(Secretaria, on_delete=models.PROTECT)
    escola = models.ForeignKey(Escola, on_delete=models.CASCADE)
    nome = models.CharField(max_length=100)
    ano = models.CharField(max_length=20)

    def __str__(self) -> str:
        return f"{self.nome} ({self.ano})"


class Aluno(models.Model):
    secretaria = models.ForeignKey(Secretaria, on_delete=models.PROTECT)
    turma = models.ForeignKey(Turma, on_delete=models.CASCADE)
    nome = models.CharField(max_length=255)
    cpf = models.CharField(max_length=14, blank=True)

    def __str__(self) -> str:
        return self.nome
