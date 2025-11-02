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
        fields = [
            'id',
            'secretaria',
            'titulo',
            'data_aplicacao',
            'turmas',
            'liberada_para_professores',
            'habilitar_correcao_qr',
        ]
        read_only_fields = ['secretaria']


class ProvaAlunoSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProvaAluno
        fields = ['id', 'secretaria', 'avaliacao', 'aluno', 'caderno', 'qr_payload']
        read_only_fields = ['secretaria']

    def create(self, validated_data):
        instance = super().create(validated_data)
        instance.qr_payload = self._build_payload(instance=instance, validated_data=validated_data)
        instance.save(update_fields=['qr_payload'])
        return instance

    def update(self, instance, validated_data):
        instance = super().update(instance, validated_data)
        instance.qr_payload = self._build_payload(instance=instance, validated_data=validated_data)
        instance.save(update_fields=['qr_payload'])
        return instance

    def _build_payload(self, *, instance, validated_data):
        payload_source = validated_data.get('qr_payload')
        if payload_source is None:
            payload_source = getattr(instance, 'qr_payload', {})
        payload = payload_source or {}
        if not isinstance(payload, dict):
            payload = {}

        aluno = validated_data.get('aluno') or getattr(instance, 'aluno', None)
        avaliacao = validated_data.get('avaliacao') or getattr(instance, 'avaliacao', None)
        caderno = validated_data.get('caderno') or getattr(instance, 'caderno', None)

        if aluno is not None:
            payload['aluno_id'] = aluno.id
            payload['aluno_nome'] = getattr(aluno, 'nome', payload.get('aluno_nome'))
        if avaliacao is not None:
            payload['avaliacao_id'] = avaliacao.id
            payload['avaliacao_titulo'] = getattr(
                avaliacao, 'titulo', payload.get('avaliacao_titulo')
            )
        if caderno is not None:
            payload['caderno_id'] = caderno.id
        elif 'caderno_id' in payload and instance.caderno_id is None:
            payload.pop('caderno_id', None)

        if instance.id is not None:
            payload['prova_id'] = instance.id

        return payload
