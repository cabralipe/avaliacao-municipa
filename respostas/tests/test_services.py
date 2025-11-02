import pytest
from model_bakery import baker

from respostas.services import corrigir_prova
from respostas.models import Resposta


@pytest.mark.django_db
def test_corrigir_prova_marks_answers_and_counts_hits():
    secretaria = baker.make('core.Secretaria')
    avaliacao = baker.make('avaliacoes.Avaliacao', secretaria=secretaria)
    caderno = baker.make('avaliacoes.Caderno', secretaria=secretaria, avaliacao=avaliacao)

    hab = baker.make('itens.Habilidade', secretaria=secretaria)
    questao_certa = baker.make(
        'itens.Questao',
        secretaria=secretaria,
        habilidade=hab,
        correta='A',
    )
    questao_errada = baker.make(
        'itens.Questao',
        secretaria=secretaria,
        habilidade=hab,
        correta='B',
    )

    cq_certa = baker.make('avaliacoes.CadernoQuestao', caderno=caderno, questao=questao_certa, ordem=1)
    cq_errada = baker.make('avaliacoes.CadernoQuestao', caderno=caderno, questao=questao_errada, ordem=2)

    baker.make('respostas.Gabarito', secretaria=secretaria, caderno_questao=cq_certa, alternativa_correta='A')
    baker.make('respostas.Gabarito', secretaria=secretaria, caderno_questao=cq_errada, alternativa_correta='B')

    turma = baker.make('escolas.Turma', secretaria=secretaria, escola__secretaria=secretaria)
    aluno = baker.make('escolas.Aluno', secretaria=secretaria, turma=turma)
    prova = baker.make(
        'avaliacoes.ProvaAluno',
        secretaria=secretaria,
        avaliacao=avaliacao,
        aluno=aluno,
        caderno=caderno,
    )

    resposta_certa = baker.make(
        'respostas.Resposta',
        secretaria=secretaria,
        prova_aluno=prova,
        caderno_questao=cq_certa,
        alternativa='A',
        correta=None,
    )
    resposta_errada = baker.make(
        'respostas.Resposta',
        secretaria=secretaria,
        prova_aluno=prova,
        caderno_questao=cq_errada,
        alternativa='A',
        correta=None,
    )

    acertos = corrigir_prova(prova)

    assert acertos == 1

    resposta_certa.refresh_from_db()
    resposta_errada.refresh_from_db()
    assert resposta_certa.correta is True
    assert resposta_errada.correta is False
    assert Resposta.objects.filter(prova_aluno=prova, correta=True).count() == 1


@pytest.mark.django_db
def test_corrigir_prova_handles_missing_gabarito():
    secretaria = baker.make('core.Secretaria')
    avaliacao = baker.make('avaliacoes.Avaliacao', secretaria=secretaria)
    caderno = baker.make('avaliacoes.Caderno', secretaria=secretaria, avaliacao=avaliacao)

    questao_sem_gabarito = baker.make('itens.Questao', secretaria=secretaria)
    cq_sem_gabarito = baker.make(
        'avaliacoes.CadernoQuestao', caderno=caderno, questao=questao_sem_gabarito, ordem=1
    )

    turma = baker.make('escolas.Turma', secretaria=secretaria, escola__secretaria=secretaria)
    aluno = baker.make('escolas.Aluno', secretaria=secretaria, turma=turma)
    prova = baker.make(
        'avaliacoes.ProvaAluno',
        secretaria=secretaria,
        avaliacao=avaliacao,
        aluno=aluno,
        caderno=caderno,
    )

    resposta = baker.make(
        'respostas.Resposta',
        secretaria=secretaria,
        prova_aluno=prova,
        caderno_questao=cq_sem_gabarito,
        alternativa='A',
        correta=None,
    )

    acertos = corrigir_prova(prova)

    assert acertos == 0
    resposta.refresh_from_db()
    assert resposta.correta is None
