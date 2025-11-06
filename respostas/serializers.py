from rest_framework import serializers

from .models import Gabarito, Resposta


_ALT_VALIDAS = {'A', 'B', 'C', 'D', 'E'}


class RespostaSerializer(serializers.ModelSerializer):
    alternativa = serializers.CharField(max_length=1)

    def validate_alternativa(self, value: str) -> str:
        alternativa = (value or '').strip().upper()
        if alternativa not in _ALT_VALIDAS:
            raise serializers.ValidationError('Alternativa deve ser uma das letras A, B, C, D ou E.')
        return alternativa

    class Meta:
        model = Resposta
        fields = '__all__'
        read_only_fields = ['secretaria']


class GabaritoSerializer(serializers.ModelSerializer):
    alternativa_correta = serializers.CharField(max_length=1)

    def validate_alternativa_correta(self, value: str) -> str:
        alternativa = (value or '').strip().upper()
        if alternativa not in _ALT_VALIDAS:
            raise serializers.ValidationError('Alternativa correta deve ser uma das letras A, B, C, D ou E.')
        return alternativa

    class Meta:
        model = Gabarito
        fields = '__all__'
        read_only_fields = ['secretaria']


class RespostaInSerializer(serializers.Serializer):
    prova_aluno_id = serializers.IntegerField()
    respostas = serializers.ListField(child=serializers.CharField(max_length=1))

    def validate_respostas(self, values):
        normalizadas = []
        for alternativa in values:
            alt = (alternativa or '').strip().upper()
            if alt not in _ALT_VALIDAS:
                raise serializers.ValidationError('Cada resposta deve ser uma das letras A, B, C, D ou E.')
            normalizadas.append(alt)
        return normalizadas


class GabaritoAnalysisSerializer(serializers.Serializer):
    caderno_id = serializers.IntegerField()
    imagem = serializers.ImageField()
