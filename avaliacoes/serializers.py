from rest_framework import serializers

from .models import Avaliacao, Caderno, CadernoQuestao, ProvaAluno


class CadernoQuestaoSerializer(serializers.ModelSerializer):
    class Meta:
        model = CadernoQuestao
        fields = ['id', 'caderno', 'questao', 'ordem']


class CadernoSerializer(serializers.ModelSerializer):
    cadernoquestao_set = CadernoQuestaoSerializer(many=True, read_only=True)

    class Meta:
        model = Caderno
        fields = ['id', 'secretaria', 'avaliacao', 'codigo', 'cadernoquestao_set']


class AvaliacaoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Avaliacao
        fields = ['id', 'secretaria', 'titulo', 'data_aplicacao', 'turmas']


class ProvaAlunoSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProvaAluno
        fields = ['id', 'secretaria', 'avaliacao', 'aluno', 'caderno', 'qr_payload']
