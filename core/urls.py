from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import DashboardSummaryView, SecretariaViewSet

router = DefaultRouter()
router.register('secretarias', SecretariaViewSet, basename='secretaria')

urlpatterns = [
    path('dashboard/summary/', DashboardSummaryView.as_view(), name='dashboard-summary'),
]

urlpatterns += router.urls
