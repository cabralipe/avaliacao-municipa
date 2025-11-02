import pytest
from model_bakery import baker

from respostas.serializers import (
    GabaritoSerializer,
    RespostaInSerializer,
    RespostaSerializer,
)


@pytest.mark.django_db
def test_resposta_serializer_normaliza_alternativa():
    resposta = baker.make('respostas.Resposta', alternativa='A')
    serializer = RespostaSerializer(instance=resposta, data={'alternativa': ' c '}, partial=True)
    assert serializer.is_valid(), serializer.errors
    assert serializer.validated_data['alternativa'] == 'C'


@pytest.mark.django_db
def test_resposta_serializer_rejeita_alternativa_invalida():
    resposta = baker.make('respostas.Resposta', alternativa='A')
    serializer = RespostaSerializer(instance=resposta, data={'alternativa': 'Z'}, partial=True)
    assert not serializer.is_valid()
    assert 'alternativa' in serializer.errors


@pytest.mark.django_db
def test_gabarito_serializer_normaliza_alternativa():
    gabarito = baker.make('respostas.Gabarito', alternativa_correta='A')
    serializer = GabaritoSerializer(instance=gabarito, data={'alternativa_correta': ' d '}, partial=True)
    assert serializer.is_valid(), serializer.errors
    assert serializer.validated_data['alternativa_correta'] == 'D'


@pytest.mark.django_db
def test_gabarito_serializer_rejeita_alternativa_invalida():
    gabarito = baker.make('respostas.Gabarito', alternativa_correta='A')
    serializer = GabaritoSerializer(instance=gabarito, data={'alternativa_correta': 'X'}, partial=True)
    assert not serializer.is_valid()
    assert 'alternativa_correta' in serializer.errors


def test_resposta_in_serializer_valida_lista():
    serializer = RespostaInSerializer(data={'prova_aluno_id': 1, 'respostas': ['a', 'B', ' c ']})
    assert serializer.is_valid(), serializer.errors
    assert serializer.validated_data['respostas'] == ['A', 'B', 'C']


def test_resposta_in_serializer_rejeita_valor_invalido():
    serializer = RespostaInSerializer(data={'prova_aluno_id': 1, 'respostas': ['A', 'Z']})
    assert not serializer.is_valid()
    assert 'respostas' in serializer.errors
