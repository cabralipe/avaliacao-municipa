from django.db import models

from core.models import Secretaria


class Competencia(models.Model):
    secretaria = models.ForeignKey(Secretaria, on_delete=models.PROTECT, null=True, blank=True)
    codigo = models.CharField(max_length=50)
    descricao = models.TextField()

    def __str__(self) -> str:
        return self.codigo


class Habilidade(models.Model):
    secretaria = models.ForeignKey(Secretaria, on_delete=models.PROTECT, null=True, blank=True)
    codigo = models.CharField(max_length=50)
    descricao = models.TextField()

    def __str__(self) -> str:
        return self.codigo


class Questao(models.Model):
    STATUS_PENDENTE = 'pendente'
    STATUS_APROVADA = 'aprovada'
    STATUS_CHOICES = (
        (STATUS_PENDENTE, 'Pendente'),
        (STATUS_APROVADA, 'Aprovada'),
    )

    secretaria = models.ForeignKey(Secretaria, on_delete=models.PROTECT, null=True, blank=True)
    enunciado = models.TextField()
    alternativa_a = models.TextField()
    alternativa_b = models.TextField()
    alternativa_c = models.TextField()
    alternativa_d = models.TextField()
    alternativa_e = models.TextField()
    correta = models.CharField(max_length=1, choices=[(alt, alt) for alt in 'ABCDE'])
    competencia = models.ForeignKey(Competencia, on_delete=models.SET_NULL, null=True, blank=True)
    habilidade = models.ForeignKey(Habilidade, on_delete=models.SET_NULL, null=True, blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default=STATUS_PENDENTE)

    def __str__(self) -> str:
        return f"Questão {self.id}"
