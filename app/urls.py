from django.contrib import admin
from django.urls import include, path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/accounts/', include('accounts.urls')),
    path('api/escolas/', include('escolas.urls')),
    path('api/itens/', include('itens.urls')),
    path('api/avaliacoes/', include('avaliacoes.urls')),
    path('api/respostas/', include('respostas.urls')),
    path('api/relatorios/', include('relatorios.urls')),
]
