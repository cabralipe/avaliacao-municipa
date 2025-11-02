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

    def get_fields(self):
        fields = super().get_fields()
        request = self.context.get('request')
        user_role = getattr(getattr(request, 'user', None), 'role', '') if request else ''
        if user_role not in ('admin', 'superadmin') and 'status' in fields:
            fields['status'].read_only = True
        return fields

    def create(self, validated_data):
        request = self.context.get('request')
        user_role = getattr(getattr(request, 'user', None), 'role', '') if request else ''
        if user_role not in ('admin', 'superadmin'):
            validated_data['status'] = Questao.STATUS_PENDENTE
        return super().create(validated_data)

    def update(self, instance, validated_data):
        request = self.context.get('request')
        user_role = getattr(getattr(request, 'user', None), 'role', '') if request else ''
        if user_role not in ('admin', 'superadmin'):
            validated_data.pop('status', None)
        return super().update(instance, validated_data)
