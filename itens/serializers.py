from rest_framework import serializers

from .models import Competencia, Habilidade, Questao


class CompetenciaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Competencia
        fields = '__all__'
        read_only_fields = ['secretaria']


class HabilidadeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Habilidade
        fields = '__all__'
        read_only_fields = ['secretaria']


class QuestaoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Questao
        fields = '__all__'
        read_only_fields = ['secretaria']
