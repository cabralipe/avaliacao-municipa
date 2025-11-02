import re

from rest_framework import serializers

from .models import Aluno, Escola, Turma


class EscolaSerializer(serializers.ModelSerializer):
    def validate_codigo_inep(self, value: str) -> str:
        """Valida o formato do código INEP (8 dígitos numéricos)."""
        if value and not re.fullmatch(r"\d{8}", value):
            raise serializers.ValidationError('Informe um código INEP com 8 dígitos numéricos.')
        return value

    class Meta:
        model = Escola
        fields = '__all__'
        read_only_fields = ['secretaria']


class TurmaSerializer(serializers.ModelSerializer):
    def validate_ano(self, value: str) -> str:
        """Rejeita valores vazios ou apenas espaços para o ano/turma."""
        if not value or not value.strip():
            raise serializers.ValidationError('O ano da turma não pode ser vazio.')
        return value.strip()

    class Meta:
        model = Turma
        fields = '__all__'
        read_only_fields = ['secretaria']


class AlunoSerializer(serializers.ModelSerializer):
    def validate_cpf(self, value: str) -> str:
        """Aceita CPF vazio, 11 dígitos ou no formato 000.000.000-00."""
        if not value:
            return value
        cpf = value.strip()
        if not re.fullmatch(r"(\d{11}|\d{3}\.\d{3}\.\d{3}-\d{2})", cpf):
            raise serializers.ValidationError('Informe um CPF com 11 dígitos (com ou sem pontuação).')
        return cpf

    class Meta:
        model = Aluno
        fields = '__all__'
        read_only_fields = ['secretaria']
