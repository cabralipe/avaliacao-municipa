import pytest
from model_bakery import baker
from rest_framework.test import APIClient
from django.urls import reverse


@pytest.mark.django_db
def test_prof_por_habilidade_requires_admin_role():
    secretaria = baker.make('core.Secretaria')
    user = baker.make('core.User', secretaria=secretaria, role='professor')

    client = APIClient()
    client.force_authenticate(user=user)

    url = reverse('relatorio-proficiencia-habilidade', kwargs={'secretaria_id': secretaria.id})
    response = client.get(url)

    assert response.status_code == 403


@pytest.mark.django_db
def test_prof_por_habilidade_returns_sorted_aggregated_data():
    secretaria = baker.make('core.Secretaria')
    user = baker.make('core.User', secretaria=secretaria, role='admin')

    avaliacao = baker.make('avaliacoes.Avaliacao', secretaria=secretaria)
    caderno = baker.make('avaliacoes.Caderno', secretaria=secretaria, avaliacao=avaliacao)

    hab1 = baker.make('itens.Habilidade', secretaria=secretaria, codigo='HB1')
    hab2 = baker.make('itens.Habilidade', secretaria=secretaria, codigo='HB2')

    questao_hab1 = baker.make('itens.Questao', secretaria=secretaria, habilidade=hab1)
    questao_hab2 = baker.make('itens.Questao', secretaria=secretaria, habilidade=hab2)

    cq_hab1 = baker.make('avaliacoes.CadernoQuestao', caderno=caderno, questao=questao_hab1, ordem=1)
    cq_hab2 = baker.make('avaliacoes.CadernoQuestao', caderno=caderno, questao=questao_hab2, ordem=2)

    turma = baker.make('escolas.Turma', secretaria=secretaria, escola__secretaria=secretaria)
    aluno1 = baker.make('escolas.Aluno', secretaria=secretaria, turma=turma)
    aluno2 = baker.make('escolas.Aluno', secretaria=secretaria, turma=turma)

    prova1 = baker.make(
        'avaliacoes.ProvaAluno',
        secretaria=secretaria,
        avaliacao=avaliacao,
        aluno=aluno1,
        caderno=caderno,
    )
    prova2 = baker.make(
        'avaliacoes.ProvaAluno',
        secretaria=secretaria,
        avaliacao=avaliacao,
        aluno=aluno2,
        caderno=caderno,
    )

    baker.make(
        'respostas.Resposta',
        secretaria=secretaria,
        prova_aluno=prova1,
        caderno_questao=cq_hab1,
        alternativa='A',
        correta=True,
    )
    baker.make(
        'respostas.Resposta',
        secretaria=secretaria,
        prova_aluno=prova2,
        caderno_questao=cq_hab1,
        alternativa='A',
        correta=True,
    )
    baker.make(
        'respostas.Resposta',
        secretaria=secretaria,
        prova_aluno=prova1,
        caderno_questao=cq_hab2,
        alternativa='B',
        correta=True,
    )
    baker.make(
        'respostas.Resposta',
        secretaria=secretaria,
        prova_aluno=prova2,
        caderno_questao=cq_hab2,
        alternativa='C',
        correta=False,
    )

    client = APIClient()
    client.force_authenticate(user=user)

    url = reverse('relatorio-proficiencia-habilidade', kwargs={'secretaria_id': secretaria.id})
    response = client.get(url)

    assert response.status_code == 200
    assert response.json() == [
        {'caderno_questao__questao__habilidade__codigo': 'HB1', 'acertos': 2},
        {'caderno_questao__questao__habilidade__codigo': 'HB2', 'acertos': 1},
    ]


@pytest.mark.django_db
def test_prof_por_habilidade_applies_filters():
    secretaria = baker.make('core.Secretaria')
    user = baker.make('core.User', secretaria=secretaria, role='admin')

    avaliacao_1 = baker.make('avaliacoes.Avaliacao', secretaria=secretaria, data_aplicacao='2024-01-10')
    avaliacao_2 = baker.make('avaliacoes.Avaliacao', secretaria=secretaria, data_aplicacao='2024-03-15')

    caderno_1 = baker.make('avaliacoes.Caderno', secretaria=secretaria, avaliacao=avaliacao_1)
    caderno_2 = baker.make('avaliacoes.Caderno', secretaria=secretaria, avaliacao=avaliacao_2)

    habilidade = baker.make('itens.Habilidade', secretaria=secretaria, codigo='HBX')
    questao = baker.make('itens.Questao', secretaria=secretaria, habilidade=habilidade)

    cq_1 = baker.make('avaliacoes.CadernoQuestao', caderno=caderno_1, questao=questao, ordem=1)
    cq_2 = baker.make('avaliacoes.CadernoQuestao', caderno=caderno_2, questao=questao, ordem=1)

    turma = baker.make('escolas.Turma', secretaria=secretaria, escola__secretaria=secretaria)
    aluno = baker.make('escolas.Aluno', secretaria=secretaria, turma=turma)

    prova_1 = baker.make(
        'avaliacoes.ProvaAluno',
        secretaria=secretaria,
        avaliacao=avaliacao_1,
        aluno=aluno,
        caderno=caderno_1,
    )
    prova_2 = baker.make(
        'avaliacoes.ProvaAluno',
        secretaria=secretaria,
        avaliacao=avaliacao_2,
        aluno=aluno,
        caderno=caderno_2,
    )

    baker.make(
        'respostas.Resposta',
        secretaria=secretaria,
        prova_aluno=prova_1,
        caderno_questao=cq_1,
        alternativa='A',
        correta=True,
    )
    baker.make(
        'respostas.Resposta',
        secretaria=secretaria,
        prova_aluno=prova_2,
        caderno_questao=cq_2,
        alternativa='A',
        correta=True,
    )

    client = APIClient()
    client.force_authenticate(user=user)

    url = reverse('relatorio-proficiencia-habilidade', kwargs={'secretaria_id': secretaria.id})
    response = client.get(
        url,
        {
          'avaliacao_id': str(avaliacao_1.id),
          'data_inicial': '2024-01-01',
          'data_final': '2024-01-31',
        },
    )

    assert response.status_code == 200
    assert response.json() == [
        {'caderno_questao__questao__habilidade__codigo': 'HBX', 'acertos': 1},
    ]
