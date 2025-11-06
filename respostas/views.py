import time

from django.db import transaction
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.parsers import FormParser, MultiPartParser

from avaliacoes.models import Caderno, CadernoQuestao, ProvaAluno
from core.tenancy import IsSameSecretaria, TenantScopedViewSet
from .models import Gabarito, Resposta
from .serializers import (
    GabaritoAnalysisSerializer,
    GabaritoSerializer,
    RespostaInSerializer,
    RespostaSerializer,
)
from .services import corrigir_prova
from .omr import analyze_omr_image, OmrProcessingError

_CADERNO_CACHE: dict[int, tuple[float, list[tuple[int, int]]]] = {}
_CACHE_TTL_SECONDS = 300


def _get_caderno_questoes(caderno_id: int) -> list[tuple[int, int]]:
    now = time.time()
    cached = _CADERNO_CACHE.get(caderno_id)
    if cached:
        cached_at, data = cached
        if now - cached_at <= _CACHE_TTL_SECONDS:
            return data

    questoes = list(
        CadernoQuestao.objects.filter(caderno_id=caderno_id)
        .order_by('ordem')
        .values_list('ordem', 'id')
    )
    _CADERNO_CACHE[caderno_id] = (now, questoes)
    return questoes


class RespostaViewSet(TenantScopedViewSet):
    queryset = Resposta.objects.select_related('prova_aluno', 'caderno_questao')
    serializer_class = RespostaSerializer
    filterset_fields = ['prova_aluno_id']
    role_permissions = {
        'list': ['admin'],
        'retrieve': ['admin'],
        'create': ['admin'],
        'update': ['admin'],
        'partial_update': ['admin'],
        'destroy': ['admin'],
    }


class GabaritoViewSet(TenantScopedViewSet):
    queryset = Gabarito.objects.select_related('caderno_questao', 'caderno_questao__caderno')
    serializer_class = GabaritoSerializer
    filterset_fields = ['caderno_questao__caderno_id']
    role_permissions = {
        'list': ['admin'],
        'retrieve': ['admin'],
        'create': ['admin'],
        'update': ['admin'],
        'partial_update': ['admin'],
        'destroy': ['admin'],
    }


class ColetaRespostasView(APIView):
    permission_classes = [IsSameSecretaria]

    @transaction.atomic
    def post(self, request):
        if getattr(request.user, 'role', None) not in {'admin', 'superadmin'}:
            return Response(status=status.HTTP_403_FORBIDDEN)
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


class AnaliseGabaritoView(APIView):
    permission_classes = [IsSameSecretaria]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        role = getattr(request.user, 'role', None)
        if role not in {'admin', 'superadmin', 'professor'}:
            return Response(status=status.HTTP_403_FORBIDDEN)

        serializer = GabaritoAnalysisSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        caderno_id = serializer.validated_data['caderno_id']
        imagem = serializer.validated_data['imagem']

        try:
            caderno = Caderno.objects.select_related('avaliacao').get(id=caderno_id)
        except Caderno.DoesNotExist:
            return Response(
                {'detail': 'Caderno informado não foi encontrado.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if role != 'superadmin' and request.user.secretaria_id != caderno.secretaria_id:
            return Response(status=status.HTTP_403_FORBIDDEN)

        if role == 'professor' and not caderno.avaliacao.habilitar_correcao_qr:
            return Response(
                {'detail': 'Correção via QR Code não está habilitada para esta avaliação.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        questoes = _get_caderno_questoes(caderno.id)
        if not questoes:
            return Response(
                {'detail': 'Nenhuma questão cadastrada para este caderno.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        image_bytes = imagem.read()
        try:
            analysis = analyze_omr_image(image_bytes, questoes)
        except OmrProcessingError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

        payload = {
            'results': [
                {
                    'ordem': result.ordem,
                    'caderno_questao': result.caderno_questao_id,
                    'detected': result.detected,
                    'scores': [
                        {'letter': score.letter, 'percent': score.percent} for score in result.scores
                    ],
                }
                for result in analysis.results
            ],
            'stats': {
                'mean': analysis.stats.mean,
                'stddev': analysis.stats.stddev,
                'threshold': analysis.stats.threshold,
                'samples': analysis.stats.samples,
            },
            'detected_count': analysis.detected_count,
        }
        return Response(payload, status=status.HTTP_200_OK)
