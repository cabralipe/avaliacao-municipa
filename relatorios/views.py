from django.db.models import Count
from rest_framework.response import Response
from rest_framework.views import APIView

from core.tenancy import IsSameSecretaria
from respostas.models import Resposta


class ProfPorHabilidadeView(APIView):
    permission_classes = [IsSameSecretaria]

    def get(self, request, secretaria_id: int):
        if getattr(request.user, 'role', None) not in {'admin', 'superadmin'}:
            return Response(status=403)
        queryset = (
            Resposta.objects.filter(secretaria_id=secretaria_id, correta=True)
            .values('caderno_questao__questao__habilidade__codigo')
            .annotate(acertos=Count('id'))
            .order_by('caderno_questao__questao__habilidade__codigo')
        )
        return Response(list(queryset))
