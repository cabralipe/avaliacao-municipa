from .models import Gabarito, Resposta


def corrigir_prova(prova_aluno):
    acertos = 0
    respostas = Resposta.objects.filter(prova_aluno=prova_aluno).select_related('caderno_questao')
    for resposta in respostas:
        gabarito = Gabarito.objects.get(caderno_questao=resposta.caderno_questao)
        resposta.correta = resposta.alternativa == gabarito.alternativa_correta
        if resposta.correta:
            acertos += 1
        resposta.save(update_fields=['correta'])
    return acertos
