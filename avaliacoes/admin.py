from django.contrib import admin

from .models import Avaliacao, Caderno, CadernoQuestao, ProvaAluno

admin.site.register(Avaliacao)
admin.site.register(Caderno)
admin.site.register(CadernoQuestao)
admin.site.register(ProvaAluno)
