from rest_framework.routers import DefaultRouter

from .views import (
    AvaliacaoViewSet,
    CadernoQuestaoViewSet,
    CadernoViewSet,
    ProvaAlunoViewSet,
)

router = DefaultRouter()
router.register('avaliacoes', AvaliacaoViewSet)
router.register('cadernos', CadernoViewSet)
router.register('cadernos-questoes', CadernoQuestaoViewSet)
router.register('provas', ProvaAlunoViewSet)

urlpatterns = router.urls
