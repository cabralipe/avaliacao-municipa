from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Any

from django.utils.text import slugify
from django.http import HttpResponse
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

from core.tenancy import TenantScopedViewSet
from respostas.models import Gabarito
from .models import Avaliacao, Caderno, CadernoQuestao, ProvaAluno
from .pdf_service import render_prova_pdf
from .serializers import (
    AvaliacaoSerializer,
    CadernoQuestaoSerializer,
    CadernoSerializer,
    ProvaAlunoSerializer,
)


def build_prova_pdf_context(prova: ProvaAluno) -> dict[str, Any]:
    avaliacao = prova.avaliacao
    aluno = prova.aluno
    turma = getattr(aluno, 'turma', None)
    escola = getattr(turma, 'escola', None)

    questoes_info: list[dict[str, Any]] = []
    if prova.caderno:
        caderno_questoes = (
            prova.caderno.cadernoquestao_set.select_related('questao').all().order_by('ordem')
        )
        for cq in caderno_questoes:
            questao = cq.questao
            alternativas = [
                {'letra': 'A', 'texto': questao.alternativa_a},
                {'letra': 'B', 'texto': questao.alternativa_b},
                {'letra': 'C', 'texto': questao.alternativa_c},
                {'letra': 'D', 'texto': questao.alternativa_d},
                {'letra': 'E', 'texto': questao.alternativa_e},
            ]
            questoes_info.append(
                {
                    'ordem': cq.ordem,
                    'enunciado': questao.enunciado,
                    'alternativas': alternativas,
                }
            )

    return {
        'titulo': avaliacao.titulo,
        'data_aplicacao': getattr(avaliacao, 'data_aplicacao', None),
        'aluno_nome': getattr(aluno, 'nome', ''),
        'turma_nome': getattr(turma, 'nome', ''),
        'escola_nome': getattr(escola, 'nome', ''),
        'qr_payload': prova.qr_payload,
        'questoes': questoes_info,
        'total_questoes': len(questoes_info),
        'gabarito_layout': {
            'columns': ['questao', 'A', 'B', 'C', 'D', 'E'],
            'column_width_mm': [20, 16, 16, 16, 16, 16],
            'row_height_mm': 12,
            'grid_padding_mm': {'top': 18, 'bottom': 18, 'left': 22, 'right': 22},
            'marker_size_mm': 14,
            'marker_offset_mm': 12,
            'marker_positions': [
                {'id': 'M1', 'placement': 'top_left'},
                {'id': 'M2', 'placement': 'top_right'},
                {'id': 'M3', 'placement': 'bottom_left'},
                {'id': 'M4', 'placement': 'bottom_right'},
            ],
        },
    }


class AvaliacaoViewSet(TenantScopedViewSet):
    queryset = Avaliacao.objects.prefetch_related('turmas')
    serializer_class = AvaliacaoSerializer
    filterset_fields = ['data_aplicacao']
    search_fields = ['titulo']
    role_permissions = {
        'list': ['admin', 'professor'],
        'retrieve': ['admin', 'professor'],
        'create': ['admin'],
        'update': ['admin'],
        'partial_update': ['admin'],
        'destroy': ['admin'],
        'gerar_lote_impressao': ['admin'],
    }

    @action(detail=True, methods=['post'])
    def gerar_lote_impressao(self, request, pk=None):
        if getattr(request.user, 'role', None) not in {'admin', 'superadmin'}:
            return Response(status=status.HTTP_403_FORBIDDEN)
        avaliacao = self.get_object()
        saida_dir = Path('media/pdfs') / f'avaliacao_{avaliacao.id}'
        saida_dir.mkdir(parents=True, exist_ok=True)
        gerados = []
        provas = (
            ProvaAluno.objects.filter(avaliacao=avaliacao)
            .select_related('aluno', 'aluno__turma', 'aluno__turma__escola', 'caderno')
            .prefetch_related('caderno__cadernoquestao_set__questao')
        )
        for prova in provas:
            contexto = build_prova_pdf_context(prova)
            aluno_slug = slugify(prova.aluno.nome) or f'aluno-{prova.aluno_id}'
            pdf_path = saida_dir / f'prova_{aluno_slug}.pdf'
            render_prova_pdf(contexto, pdf_path)
            gerados.append(str(pdf_path))
        return Response({'arquivos': gerados}, status=status.HTTP_201_CREATED)


class CadernoViewSet(TenantScopedViewSet):
    queryset = Caderno.objects.select_related('avaliacao')
    serializer_class = CadernoSerializer
    filterset_fields = ['avaliacao_id']
    role_permissions = {
        'list': ['admin', 'professor'],
        'retrieve': ['admin', 'professor'],
        'create': ['admin'],
        'update': ['admin'],
        'partial_update': ['admin'],
        'destroy': ['admin'],
    }


class CadernoQuestaoViewSet(TenantScopedViewSet):
    queryset = CadernoQuestao.objects.select_related('caderno', 'questao')
    serializer_class = CadernoQuestaoSerializer
    filterset_fields = ['caderno_id']
    role_permissions = {
        'list': ['admin', 'professor'],
        'retrieve': ['admin', 'professor'],
        'create': ['admin'],
        'update': ['admin'],
        'partial_update': ['admin'],
        'destroy': ['admin'],
    }

    def get_queryset(self):
        queryset = CadernoQuestao.objects.select_related(
            'caderno', 'caderno__secretaria', 'questao'
        )
        user = self.request.user
        if getattr(user, 'role', '') == 'superadmin':
            return queryset
        user_sec = getattr(user, 'secretaria_id', None)
        if user_sec is None:
            return queryset.none()
        return queryset.filter(caderno__secretaria_id=user_sec)

    def perform_create(self, serializer):
        serializer.save()

    def perform_update(self, serializer):
        serializer.save()


class ProvaAlunoViewSet(TenantScopedViewSet):
    queryset = ProvaAluno.objects.select_related(
        'avaliacao', 'aluno', 'aluno__turma', 'aluno__turma__escola', 'caderno'
    )
    serializer_class = ProvaAlunoSerializer
    filterset_fields = ['avaliacao_id', 'aluno_id']
    role_permissions = {
        'list': ['admin', 'professor'],
        'retrieve': ['admin', 'professor'],
        'create': ['admin'],
        'update': ['admin'],
        'partial_update': ['admin'],
        'destroy': ['admin'],
        'download': ['admin', 'professor'],
        'gabarito': ['admin', 'professor'],
    }

    def _has_professor_permission(self, request, prova: ProvaAluno, *, for_qr: bool) -> bool:
        role = getattr(request.user, 'role', None)
        if role in {'admin', 'superadmin'}:
            return True
        if role != 'professor':
            return False
        avaliacao = prova.avaliacao
        if for_qr:
            return avaliacao.habilitar_correcao_qr
        return avaliacao.liberada_para_professores

    @action(detail=True, methods=['get'], url_path='download')
    def download(self, request, pk=None):
        prova = self.get_object()
        if prova.caderno is None:
            return Response(
                {'detail': 'Prova sem caderno associado não pode ser exportada.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not self._has_professor_permission(request, prova, for_qr=False):
            return Response(status=status.HTTP_403_FORBIDDEN)

        contexto = build_prova_pdf_context(prova)
        with NamedTemporaryFile(suffix='.pdf', delete=False) as temp_file:
            temp_path = Path(temp_file.name)

        pdf_path = Path(render_prova_pdf(contexto, temp_path))
        try:
            content = pdf_path.read_bytes()
        finally:
            pdf_path.unlink(missing_ok=True)

        aluno_slug = slugify(prova.aluno.nome) or f'aluno-{prova.aluno_id}'
        filename = f'prova_{aluno_slug}.pdf'
        response = HttpResponse(content, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response

    @action(detail=True, methods=['get'], url_path='gabarito')
    def gabarito(self, request, pk=None):
        prova = self.get_object()
        if prova.caderno is None:
            return Response(
                {'detail': 'Prova sem caderno associado não possui gabarito.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not self._has_professor_permission(request, prova, for_qr=True):
            return Response(status=status.HTTP_403_FORBIDDEN)

        questoes = list(
            CadernoQuestao.objects.filter(caderno=prova.caderno)
            .select_related('questao')
            .order_by('ordem')
        )
        gabaritos = {
            item.caderno_questao_id: item.alternativa_correta
            for item in Gabarito.objects.filter(caderno_questao_id__in=[cq.id for cq in questoes])
        }

        gabarito_data = [
            {
                'ordem': cq.ordem,
                'caderno_questao': cq.id,
                'questao': cq.questao_id,
                'alternativa_correta': gabaritos.get(cq.id),
            }
            for cq in questoes
        ]

        payload = prova.qr_payload or {}
        response_data = {
            'prova': {
                'id': prova.id,
                'aluno_id': prova.aluno_id,
                'aluno_nome': payload.get('aluno_nome') or getattr(prova.aluno, 'nome', ''),
                'avaliacao_id': prova.avaliacao_id,
                'avaliacao_titulo': payload.get('avaliacao_titulo') or prova.avaliacao.titulo,
                'caderno_id': prova.caderno_id,
                'caderno_codigo': getattr(prova.caderno, 'codigo', None),
            },
            'gabarito': gabarito_data,
            'layout': {
                'rows': len(questoes),
                'columns': 5,
                'marker_size_mm': 14,
                'marker_margin_mm': 12,
                'grid_padding_mm': 18,
                'notes': 'Marcadores posicionados nos quatro cantos do gabarito, com offset aproximado de 12mm e tamanho 14mm.'
            },
        }
        return Response(response_data)
