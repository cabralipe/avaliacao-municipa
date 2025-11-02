from core.tenancy import TenantScopedViewSet

from .models import Competencia, Habilidade, Questao
from .serializers import CompetenciaSerializer, HabilidadeSerializer, QuestaoSerializer


class CompetenciaViewSet(TenantScopedViewSet):
    queryset = Competencia.objects.all()
    serializer_class = CompetenciaSerializer
    search_fields = ['codigo', 'descricao']
    role_permissions = {
        'list': ['admin', 'professor'],
        'retrieve': ['admin', 'professor'],
        'create': ['admin'],
        'update': ['admin'],
        'partial_update': ['admin'],
        'destroy': ['admin'],
    }


class HabilidadeViewSet(TenantScopedViewSet):
    queryset = Habilidade.objects.all()
    serializer_class = HabilidadeSerializer
    search_fields = ['codigo', 'descricao']
    role_permissions = {
        'list': ['admin', 'professor'],
        'retrieve': ['admin', 'professor'],
        'create': ['admin'],
        'update': ['admin'],
        'partial_update': ['admin'],
        'destroy': ['admin'],
    }


class QuestaoViewSet(TenantScopedViewSet):
    queryset = Questao.objects.select_related('competencia', 'habilidade')
    serializer_class = QuestaoSerializer
    search_fields = ['enunciado']
    filterset_fields = ['status', 'competencia_id', 'habilidade_id']
    role_permissions = {
        'list': ['admin', 'professor'],
        'retrieve': ['admin', 'professor'],
        'create': ['admin', 'professor'],
        'update': ['admin', 'professor'],
        'partial_update': ['admin', 'professor'],
        'destroy': ['admin'],
    }
