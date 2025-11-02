from rest_framework import permissions, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from avaliacoes.models import Avaliacao
from escolas.models import Escola, Turma, Aluno
from itens.models import Questao

from .models import Secretaria
from .serializers import SecretariaSerializer


class DashboardSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        secretaria_id = getattr(user, 'secretaria_id', None)
        is_superadmin = getattr(user, 'role', '') == 'superadmin'

        filters = {}
        if not is_superadmin and secretaria_id:
            filters['secretaria_id'] = secretaria_id

        summary = {
            'escolas': Escola.objects.filter(**filters).count(),
            'turmas': Turma.objects.filter(**filters).count(),
            'alunos': Aluno.objects.filter(**filters).count(),
            'questoes': Questao.objects.filter(**filters).count(),
            'avaliacoes': Avaliacao.objects.filter(**filters).count(),
        }

        return Response(summary)


class IsSuperAdmin(permissions.BasePermission):
    """Allow access only to users flagged as superadmin."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and getattr(request.user, 'role', None) == 'superadmin'
        )


class SecretariaViewSet(viewsets.ModelViewSet):
    queryset = Secretaria.objects.all().order_by('id')
    serializer_class = SecretariaSerializer
    permission_classes = [IsAuthenticated, IsSuperAdmin]
