from django.db import transaction
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from avaliacoes.models import CadernoQuestao, ProvaAluno
from core.tenancy import IsSameSecretaria, TenantScopedViewSet
from .models import Gabarito, Resposta
from .serializers import GabaritoSerializer, RespostaInSerializer, RespostaSerializer
from .services import corrigir_prova


class RespostaViewSet(TenantScopedViewSet):
    queryset = Resposta.objects.select_related('prova_aluno', 'caderno_questao')
    serializer_class = RespostaSerializer
    filterset_fields = ['prova_aluno_id']


class GabaritoViewSet(TenantScopedViewSet):
    queryset = Gabarito.objects.select_related('caderno_questao', 'caderno_questao__caderno')
    serializer_class = GabaritoSerializer
    filterset_fields = ['caderno_questao__caderno_id']


class ColetaRespostasView(APIView):
    permission_classes = [IsSameSecretaria]

    @transaction.atomic
    def post(self, request):
        serializer = RespostaInSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        prova_aluno = ProvaAluno.objects.select_related('avaliacao', 'caderno', 'aluno').get(
            id=serializer.validated_data['prova_aluno_id']
        )
        if request.user.role != 'superadmin' and request.user.secretaria_id != prova_aluno.secretaria_id:
            return Response(status=status.HTTP_403_FORBIDDEN)

        Resposta.objects.filter(prova_aluno=prova_aluno).delete()
        alternativas = serializer.validated_data['respostas']
        questoes = list(
            CadernoQuestao.objects.filter(caderno=prova_aluno.caderno).order_by('ordem')
        )
        for idx, alternativa in enumerate(alternativas):
            if idx >= len(questoes):
                break
            cq = questoes[idx]
            Resposta.objects.create(
                secretaria_id=prova_aluno.secretaria_id,
                prova_aluno=prova_aluno,
                caderno_questao=cq,
                alternativa=alternativa,
            )
        acertos = corrigir_prova(prova_aluno)
        return Response({'ok': True, 'acertos': acertos})
