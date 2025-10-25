from django.contrib import admin

from .models import Aluno, Escola, Turma

admin.site.register(Escola)
admin.site.register(Turma)
admin.site.register(Aluno)
