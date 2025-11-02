from django.db.models import Count
from django.utils.dateparse import parse_date
from rest_framework.response import Response
from rest_framework.views import APIView

from core.tenancy import IsSameSecretaria
from respostas.models import Resposta


class ProfPorHabilidadeView(APIView):
    permission_classes = [IsSameSecretaria]

    def get(self, request, secretaria_id: int):
        if getattr(request.user, 'role', None) not in {'admin', 'superadmin'}:
            return Response(status=403)
        queryset = Resposta.objects.filter(secretaria_id=secretaria_id, correta=True)

        avaliacao_ids = request.query_params.get('avaliacao_id')
        if avaliacao_ids:
            ids = [int(value) for value in avaliacao_ids.split(',') if value.strip().isdigit()]
            if ids:
                queryset = queryset.filter(prova_aluno__avaliacao_id__in=ids)

        data_inicial = request.query_params.get('data_inicial')
        if data_inicial:
            parsed = parse_date(data_inicial)
            if parsed:
                queryset = queryset.filter(prova_aluno__avaliacao__data_aplicacao__gte=parsed)

        data_final = request.query_params.get('data_final')
        if data_final:
            parsed = parse_date(data_final)
            if parsed:
                queryset = queryset.filter(prova_aluno__avaliacao__data_aplicacao__lte=parsed)

        queryset = (
            queryset.values('caderno_questao__questao__habilidade__codigo')
            .annotate(acertos=Count('id'))
            .order_by('caderno_questao__questao__habilidade__codigo')
        )
        return Response(list(queryset))
