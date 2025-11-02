import pytest
from model_bakery import baker

from escolas.serializers import EscolaSerializer, TurmaSerializer, AlunoSerializer


@pytest.mark.django_db
@pytest.mark.parametrize('codigo_inep', ['12345678', ''])
def test_escola_serializer_accepts_codigo_inep_validos(codigo_inep):
    serializer = EscolaSerializer(data={'nome': 'Escola Municipal', 'codigo_inep': codigo_inep})
    assert serializer.is_valid(), serializer.errors


@pytest.mark.django_db
def test_escola_serializer_rejeita_codigo_inep_invalido():
    serializer = EscolaSerializer(data={'nome': 'Escola', 'codigo_inep': 'ABC123'})
    assert not serializer.is_valid()
    assert 'codigo_inep' in serializer.errors


@pytest.mark.django_db
def test_turma_serializer_normaliza_ano():
    turma = baker.make('escolas.Turma', ano='6º Ano')
    serializer = TurmaSerializer(instance=turma, data={'ano': ' 7º A '}, partial=True)
    assert serializer.is_valid(), serializer.errors
    assert serializer.validated_data['ano'] == '7º A'


@pytest.mark.django_db
def test_turma_serializer_rejeita_ano_vazio():
    turma = baker.make('escolas.Turma', ano='6º Ano')
    serializer = TurmaSerializer(instance=turma, data={'ano': '   '}, partial=True)
    assert not serializer.is_valid()
    assert 'ano' in serializer.errors


@pytest.mark.django_db
@pytest.mark.parametrize('cpf', ['12345678901', '123.456.789-01', ''])
def test_aluno_serializer_aceita_cpf_valido(cpf):
    aluno = baker.make('escolas.Aluno', cpf='')
    serializer = AlunoSerializer(instance=aluno, data={'cpf': cpf}, partial=True)
    assert serializer.is_valid(), serializer.errors


@pytest.mark.django_db
def test_aluno_serializer_rejeita_cpf_invalido():
    aluno = baker.make('escolas.Aluno', cpf='')
    serializer = AlunoSerializer(instance=aluno, data={'cpf': '1234'}, partial=True)
    assert not serializer.is_valid()
    assert 'cpf' in serializer.errors
