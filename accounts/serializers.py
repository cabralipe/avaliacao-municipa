from rest_framework import serializers

from core.models import Secretaria, User


class SecretariaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Secretaria
        fields = ['id', 'nome', 'cnpj', 'cidade']


class UserSerializer(serializers.ModelSerializer):
    secretaria = SecretariaSerializer(read_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'role', 'secretaria']
