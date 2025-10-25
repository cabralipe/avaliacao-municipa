from core.tenancy import TenantScopedViewSet

from .models import Competencia, Habilidade, Questao
from .serializers import CompetenciaSerializer, HabilidadeSerializer, QuestaoSerializer


class CompetenciaViewSet(TenantScopedViewSet):
    queryset = Competencia.objects.all()
    serializer_class = CompetenciaSerializer
    search_fields = ['codigo', 'descricao']


class HabilidadeViewSet(TenantScopedViewSet):
    queryset = Habilidade.objects.all()
    serializer_class = HabilidadeSerializer
    search_fields = ['codigo', 'descricao']


class QuestaoViewSet(TenantScopedViewSet):
    queryset = Questao.objects.select_related('competencia', 'habilidade')
    serializer_class = QuestaoSerializer
    search_fields = ['enunciado']
    filterset_fields = ['status', 'competencia_id', 'habilidade_id']
