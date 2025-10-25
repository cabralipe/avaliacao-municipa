import csv

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from escolas.models import Aluno, Turma

User = get_user_model()


class Command(BaseCommand):
    help = 'Importa alunos de um CSV com colunas: turma_id;nome;cpf'

    def add_arguments(self, parser):
        parser.add_argument('csv_path')
        parser.add_argument('--username', required=True, help='Usuário cujo secretaria_id será usado')

    def handle(self, *args, **options):
        user = User.objects.get(username=options['username'])
        secretaria = user.secretaria
        with open(options['csv_path'], newline='') as csvfile:
            reader = csv.DictReader(csvfile, delimiter=';')
            for row in reader:
                turma = Turma.objects.get(id=row['turma_id'])
                Aluno.objects.create(
                    secretaria=secretaria,
                    turma=turma,
                    nome=row['nome'],
                    cpf=row.get('cpf', ''),
                )
        self.stdout.write(self.style.SUCCESS('Importação concluída'))
