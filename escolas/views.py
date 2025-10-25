from core.tenancy import TenantScopedViewSet

from .models import Aluno, Escola, Turma
from .serializers import AlunoSerializer, EscolaSerializer, TurmaSerializer


class EscolaViewSet(TenantScopedViewSet):
    queryset = Escola.objects.all()
    serializer_class = EscolaSerializer
    search_fields = ['nome', 'codigo_inep']


class TurmaViewSet(TenantScopedViewSet):
    queryset = Turma.objects.select_related('escola')
    serializer_class = TurmaSerializer
    filterset_fields = ['escola_id', 'ano']


class AlunoViewSet(TenantScopedViewSet):
    queryset = Aluno.objects.select_related('turma', 'turma__escola')
    serializer_class = AlunoSerializer
    filterset_fields = ['turma_id']
    search_fields = ['nome', 'cpf']
