import pytest
from django.urls import reverse
from model_bakery import baker
from rest_framework.test import APIClient

from avaliacoes.models import Avaliacao
from escolas.models import Aluno, Escola, Turma
from itens.models import Questao


@pytest.mark.django_db
def test_dashboard_summary_returns_tenant_counts():
    secretaria = baker.make('core.Secretaria')
    other_secretaria = baker.make('core.Secretaria')

    baker.make('escolas.Escola', secretaria=secretaria, _quantity=3)
    baker.make('escolas.Escola', secretaria=other_secretaria, _quantity=2)

    baker.make('escolas.Turma', secretaria=secretaria, _quantity=4)
    baker.make('escolas.Turma', secretaria=other_secretaria, _quantity=1)

    baker.make('escolas.Aluno', secretaria=secretaria, _quantity=5)
    baker.make('escolas.Aluno', secretaria=other_secretaria, _quantity=7)

    baker.make('itens.Questao', secretaria=secretaria, _quantity=6)
    baker.make('itens.Questao', secretaria=other_secretaria, _quantity=8)

    baker.make('avaliacoes.Avaliacao', secretaria=secretaria, _quantity=2)
    baker.make('avaliacoes.Avaliacao', secretaria=other_secretaria, _quantity=1)

    user = baker.make('core.User', secretaria=secretaria, role='admin')

    client = APIClient()
    client.force_authenticate(user=user)

    response = client.get(reverse('dashboard-summary'))
    assert response.status_code == 200
    assert response.json() == {
        'escolas': 3,
        'turmas': 4,
        'alunos': 5,
        'questoes': 6,
        'avaliacoes': 2,
    }


@pytest.mark.django_db
def test_dashboard_summary_superadmin_sees_all():
    secretaria_a = baker.make('core.Secretaria')
    secretaria_b = baker.make('core.Secretaria')

    baker.make('escolas.Escola', secretaria=secretaria_a, _quantity=1)
    baker.make('escolas.Escola', secretaria=secretaria_b, _quantity=2)

    baker.make('escolas.Turma', secretaria=secretaria_a, _quantity=3)
    baker.make('escolas.Turma', secretaria=secretaria_b, _quantity=4)

    baker.make('escolas.Aluno', secretaria=secretaria_a, _quantity=5)
    baker.make('escolas.Aluno', secretaria=secretaria_b, _quantity=6)

    baker.make('itens.Questao', secretaria=secretaria_a, _quantity=1)
    baker.make('itens.Questao', secretaria=secretaria_b, _quantity=1)

    baker.make('avaliacoes.Avaliacao', secretaria=secretaria_a, _quantity=1)
    baker.make('avaliacoes.Avaliacao', secretaria=secretaria_b, _quantity=2)

    user = baker.make('core.User', role='superadmin', secretaria=None)

    client = APIClient()
    client.force_authenticate(user=user)

    response = client.get(reverse('dashboard-summary'))
    assert response.status_code == 200
    assert response.json() == {
        'escolas': Escola.objects.count(),
        'turmas': Turma.objects.count(),
        'alunos': Aluno.objects.count(),
        'questoes': Questao.objects.count(),
        'avaliacoes': Avaliacao.objects.count(),
    }
