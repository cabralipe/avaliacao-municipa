from rest_framework import serializers

from .models import Gabarito, Resposta


class RespostaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Resposta
        fields = '__all__'


class GabaritoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Gabarito
        fields = '__all__'


class RespostaInSerializer(serializers.Serializer):
    prova_aluno_id = serializers.IntegerField()
    respostas = serializers.ListField(child=serializers.CharField(max_length=1))
