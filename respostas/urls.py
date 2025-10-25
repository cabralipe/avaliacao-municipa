from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import ColetaRespostasView, GabaritoViewSet, RespostaViewSet

router = DefaultRouter()
router.register('respostas', RespostaViewSet)
router.register('gabaritos', GabaritoViewSet)

urlpatterns = router.urls + [
    path('coletar/', ColetaRespostasView.as_view(), name='coleta-respostas'),
]
