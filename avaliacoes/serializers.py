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
        read_only_fields = ['secretaria']


class AvaliacaoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Avaliacao
        fields = ['id', 'secretaria', 'titulo', 'data_aplicacao', 'turmas']
        read_only_fields = ['secretaria']


class ProvaAlunoSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProvaAluno
        fields = ['id', 'secretaria', 'avaliacao', 'aluno', 'caderno', 'qr_payload']
        read_only_fields = ['secretaria']

    def _build_payload(self, validated_data):
        payload_source = validated_data.get('qr_payload')
        if payload_source is None and self.instance is not None:
            payload_source = getattr(self.instance, 'qr_payload', {})
        payload = payload_source or {}
        if not isinstance(payload, dict):
            payload = {}

        aluno = validated_data.get('aluno') or getattr(self.instance, 'aluno', None)
        avaliacao = validated_data.get('avaliacao') or getattr(self.instance, 'avaliacao', None)
        caderno = validated_data.get('caderno') or getattr(self.instance, 'caderno', None)

        if aluno is not None:
            payload['aluno_id'] = aluno.id
            payload['aluno_nome'] = aluno.nome
        if avaliacao is not None:
            payload['avaliacao_id'] = avaliacao.id
            payload['avaliacao_titulo'] = avaliacao.titulo
        if caderno is not None:
            payload['caderno_id'] = caderno.id

        validated_data['qr_payload'] = payload

    def create(self, validated_data):
        self._build_payload(validated_data)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        self._build_payload(validated_data)
        return super().update(instance, validated_data)
