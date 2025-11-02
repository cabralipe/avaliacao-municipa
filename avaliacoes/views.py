from pathlib import Path

from django.utils.text import slugify
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

from core.tenancy import TenantScopedViewSet
from .models import Avaliacao, Caderno, CadernoQuestao, ProvaAluno
from .pdf_service import render_prova_pdf
from .serializers import (
    AvaliacaoSerializer,
    CadernoQuestaoSerializer,
    CadernoSerializer,
    ProvaAlunoSerializer,
)


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
            .select_related('aluno', 'aluno__turma', 'caderno')
            .prefetch_related('caderno__cadernoquestao_set__questao')
        )
        for prova in provas:
            questoes = [
                cq.questao
                for cq in prova.caderno.cadernoquestao_set.all().order_by('ordem')
            ]
            contexto = {
                'titulo': avaliacao.titulo,
                'aluno_nome': prova.aluno.nome,
                'turma_nome': prova.aluno.turma.nome,
                'questoes': questoes,
                'qr_payload': prova.qr_payload,
            }
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


class ProvaAlunoViewSet(TenantScopedViewSet):
    queryset = ProvaAluno.objects.select_related('avaliacao', 'aluno', 'caderno')
    serializer_class = ProvaAlunoSerializer
    filterset_fields = ['avaliacao_id', 'aluno_id']
    role_permissions = {
        'list': ['admin', 'professor'],
        'retrieve': ['admin', 'professor'],
        'create': ['admin'],
        'update': ['admin'],
        'partial_update': ['admin'],
        'destroy': ['admin'],
    }
