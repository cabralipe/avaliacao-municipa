from django.db import models

from core.models import Secretaria
from escolas.models import Aluno, Turma
from itens.models import Questao


class Avaliacao(models.Model):
    secretaria = models.ForeignKey(Secretaria, on_delete=models.PROTECT)
    titulo = models.CharField(max_length=255)
    data_aplicacao = models.DateField()
    turmas = models.ManyToManyField(Turma, blank=True)
    liberada_para_professores = models.BooleanField(default=False)
    habilitar_correcao_qr = models.BooleanField(default=False)

    def __str__(self) -> str:
        return self.titulo


class Caderno(models.Model):
    secretaria = models.ForeignKey(Secretaria, on_delete=models.PROTECT)
    avaliacao = models.ForeignKey(Avaliacao, on_delete=models.CASCADE)
    codigo = models.CharField(max_length=20)
    questoes = models.ManyToManyField(Questao, through='CadernoQuestao')

    def __str__(self) -> str:
        return f"{self.avaliacao_id}-{self.codigo}"


class CadernoQuestao(models.Model):
    caderno = models.ForeignKey(Caderno, on_delete=models.CASCADE)
    questao = models.ForeignKey(Questao, on_delete=models.CASCADE)
    ordem = models.PositiveIntegerField()

    class Meta:
        ordering = ['ordem']
        unique_together = ('caderno', 'questao')

    def __str__(self) -> str:
        return f"{self.caderno_id}-{self.questao_id}"


class ProvaAluno(models.Model):
    secretaria = models.ForeignKey(Secretaria, on_delete=models.PROTECT)
    avaliacao = models.ForeignKey(Avaliacao, on_delete=models.CASCADE)
    aluno = models.ForeignKey(Aluno, on_delete=models.CASCADE)
    caderno = models.ForeignKey(Caderno, on_delete=models.SET_NULL, null=True)
    qr_payload = models.JSONField(default=dict)

    def __str__(self) -> str:
        return f"ProvaAluno {self.id}"
