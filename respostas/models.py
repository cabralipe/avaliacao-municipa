from django.db import models

from avaliacoes.models import CadernoQuestao, ProvaAluno
from core.models import Secretaria


class Resposta(models.Model):
    secretaria = models.ForeignKey(Secretaria, on_delete=models.PROTECT)
    prova_aluno = models.ForeignKey(ProvaAluno, on_delete=models.CASCADE)
    caderno_questao = models.ForeignKey(CadernoQuestao, on_delete=models.CASCADE)
    alternativa = models.CharField(max_length=1, choices=[(alt, alt) for alt in 'ABCDE'])
    correta = models.BooleanField(null=True)

    class Meta:
        unique_together = ('prova_aluno', 'caderno_questao')

    def __str__(self) -> str:
        return f"Resp {self.prova_aluno_id}-{self.caderno_questao_id}"


class Gabarito(models.Model):
    secretaria = models.ForeignKey(Secretaria, on_delete=models.PROTECT)
    caderno_questao = models.OneToOneField(CadernoQuestao, on_delete=models.CASCADE)
    alternativa_correta = models.CharField(max_length=1)

    def __str__(self) -> str:
        return f"Gabarito {self.caderno_questao_id}"
