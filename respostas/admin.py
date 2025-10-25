from django.contrib import admin

from .models import Gabarito, Resposta

admin.site.register(Resposta)
admin.site.register(Gabarito)
