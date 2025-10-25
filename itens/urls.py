from rest_framework.routers import DefaultRouter

from .views import CompetenciaViewSet, HabilidadeViewSet, QuestaoViewSet

router = DefaultRouter()
router.register('competencias', CompetenciaViewSet)
router.register('habilidades', HabilidadeViewSet)
router.register('questoes', QuestaoViewSet)

urlpatterns = router.urls
