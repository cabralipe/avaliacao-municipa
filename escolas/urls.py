from rest_framework.routers import DefaultRouter

from .views import AlunoViewSet, EscolaViewSet, TurmaViewSet

router = DefaultRouter()
router.register('escolas', EscolaViewSet)
router.register('turmas', TurmaViewSet)
router.register('alunos', AlunoViewSet)

urlpatterns = router.urls
