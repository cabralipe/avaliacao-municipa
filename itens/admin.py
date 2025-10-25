from django.contrib import admin

from .models import Competencia, Habilidade, Questao

admin.site.register(Competencia)
admin.site.register(Habilidade)
admin.site.register(Questao)
