from .models import Gabarito, Resposta


def corrigir_prova(prova_aluno):
    respostas = list(
        Resposta.objects.filter(prova_aluno=prova_aluno).select_related('caderno_questao')
    )
    if not respostas:
        return 0

    caderno_ids = {resposta.caderno_questao_id for resposta in respostas}
    gabaritos = {
        caderno_id: alternativa.upper()
        for caderno_id, alternativa in Gabarito.objects.filter(
            caderno_questao_id__in=caderno_ids
        ).values_list('caderno_questao_id', 'alternativa_correta')
    }

    acertos = 0
    for resposta in respostas:
        alternativa_correta = gabaritos.get(resposta.caderno_questao_id)
        if alternativa_correta is None:
            resposta.correta = None
            continue

        correta = (resposta.alternativa or '').strip().upper() == alternativa_correta
        resposta.correta = correta
        if correta:
            acertos += 1

    Resposta.objects.bulk_update(respostas, ['correta'])
    return acertos
