from django.urls import path

from .views import ProfPorHabilidadeView

urlpatterns = [
    path('rede/<int:secretaria_id>/proficiencia-por-habilidade/', ProfPorHabilidadeView.as_view(), name='relatorio-proficiencia-habilidade'),
]
