from __future__ import annotations

from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from avaliacoes.models import Avaliacao, Caderno, CadernoQuestao, ProvaAluno
from core.models import Secretaria
from escolas.models import Aluno, Escola, Turma
from itens.models import Competencia, Habilidade, Questao
from respostas.models import Gabarito, Resposta


class Command(BaseCommand):
    help = "Popula o banco com dados de demonstração para testes manuais."

    def add_arguments(self, parser):
        parser.add_argument(
            '--fresh',
            action='store_true',
            help='Remove registros existentes antes de popular (cuidado: dados serão perdidos).',
        )

    @transaction.atomic
    def handle(self, *args, **options):
        fresh = options['fresh']
        if fresh:
            self.stdout.write(self.style.WARNING('Removendo dados existentes...'))
            self._purge_data()

        secretaria = self._ensure_secretaria()
        usuarios = self._ensure_usuarios(secretaria)
        escolas = self._ensure_escolas(secretaria)
        turmas = self._ensure_turmas(secretaria, escolas)
        alunos = self._ensure_alunos(secretaria, turmas)
        competencias = self._ensure_competencias(secretaria)
        habilidades = self._ensure_habilidades(secretaria)
        questoes = self._ensure_questoes(secretaria, competencias, habilidades)
        avaliacoes = self._ensure_avaliacoes(secretaria, turmas)
        cadernos = self._ensure_cadernos(secretaria, avaliacoes, questoes)
        self._ensure_gabaritos(secretaria, cadernos)
        self._ensure_respostas(secretaria, cadernos, alunos)

        self.stdout.write(self.style.SUCCESS('Base populada com dados de exemplo.'))
        self.stdout.write(self.style.SUCCESS('Usuários criados:'))
        for label, user in usuarios.items():
            senha = {
                'superadmin': 'teste_superadmin',
                'admin': 'teste_admin',
                'prof': 'teste_professor',
            }.get(label, 'teste123')
            self.stdout.write(f"  - {label}: {user.username} / senha: {senha}")

    def _purge_data(self):
        Resposta.objects.all().delete()
        Gabarito.objects.all().delete()
        ProvaAluno.objects.all().delete()
        CadernoQuestao.objects.all().delete()
        Caderno.objects.all().delete()
        Avaliacao.objects.all().delete()
        Questao.objects.all().delete()
        Competencia.objects.all().delete()
        Habilidade.objects.all().delete()
        Aluno.objects.all().delete()
        Turma.objects.all().delete()
        Escola.objects.all().delete()
        Secretaria.objects.all().delete()
        User = get_user_model()
        User.objects.exclude(is_superuser=True).delete()

    def _ensure_secretaria(self) -> Secretaria:
        secretaria, _ = Secretaria.objects.get_or_create(
            nome='Secretaria Municipal de Educação',
            defaults={'cnpj': '12.345.678/0001-00', 'cidade': 'Maceió'},
        )
        return secretaria

    def _ensure_usuarios(self, secretaria: Secretaria):
        User = get_user_model()
        usuarios = {}

        configs = {
            'superadmin': {
                'username': 'test_superadmin',
                'defaults': {
                    'email': 'superadmin@test.local',
                    'role': User.ROLE_SUPERADMIN,
                    'is_staff': True,
                    'is_superuser': True,
                },
                'password': 'teste_superadmin',
            },
            'admin': {
                'username': 'test_admin',
                'defaults': {
                    'email': 'admin@test.local',
                    'role': User.ROLE_ADMIN,
                    'secretaria': secretaria,
                    'is_staff': True,
                },
                'password': 'teste_admin',
            },
            'prof': {
                'username': 'test_professor',
                'defaults': {
                    'email': 'professor@test.local',
                    'role': User.ROLE_PROFESSOR,
                    'secretaria': secretaria,
                },
                'password': 'teste_professor',
            },
        }

        for label, cfg in configs.items():
            user, created = User.objects.get_or_create(
                username=cfg['username'],
                defaults={k: v for k, v in cfg['defaults'].items() if k not in {'is_staff', 'is_superuser'}}
            )

            updated = False
            for attr, value in cfg['defaults'].items():
                if attr in {'secretaria'}:
                    current_id = getattr(user, f'{attr}_id', None)
                    if (value and current_id != value.id) or (value is None and getattr(user, attr) is not None):
                        setattr(user, attr, value)
                        updated = True
                else:
                    if getattr(user, attr, None) != value:
                        setattr(user, attr, value)
                        updated = True

            if created or not user.has_usable_password():
                user.set_password(cfg['password'])
                updated = True

            if updated:
                user.save()

            usuarios[label] = user

        return usuarios

    def _ensure_escolas(self, secretaria: Secretaria):
        escolas = []
        dados = [
            ('Escola Municipal Sol Nascente', '24012345'),
            ('Escola Municipal Horizonte Azul', '24067890'),
        ]
        for nome, inep in dados:
            escola, _ = Escola.objects.get_or_create(
                secretaria=secretaria,
                nome=nome,
                defaults={'codigo_inep': inep},
            )
            escolas.append(escola)
        return escolas

    def _ensure_turmas(self, secretaria: Secretaria, escolas):
        turmas = []
        defs = [
            (escolas[0], '5º Ano A', '5º Ano'),
            (escolas[0], '5º Ano B', '5º Ano'),
            (escolas[1], '6º Ano A', '6º Ano'),
        ]
        for escola, nome, ano in defs:
            turma, _ = Turma.objects.get_or_create(
                secretaria=secretaria,
                escola=escola,
                nome=nome,
                defaults={'ano': ano},
            )
            if turma.ano != ano:
                turma.ano = ano
                turma.save(update_fields=['ano'])
            turmas.append(turma)
        return turmas

    def _ensure_alunos(self, secretaria: Secretaria, turmas):
        alunos = []
        nomes_por_turma = {
            turmas[0]: ['Ana Lima', 'Bruno Souza', 'Carla Mendes'],
            turmas[1]: ['Daniel Rocha', 'Eduarda Alves'],
            turmas[2]: ['Fábio Costa', 'Gabriela Melo', 'Hugo Barbosa'],
        }
        for turma, nomes in nomes_por_turma.items():
            for idx, nome in enumerate(nomes, start=1):
                aluno, _ = Aluno.objects.get_or_create(
                    secretaria=secretaria,
                    turma=turma,
                    nome=nome,
                    defaults={'cpf': f'000.000.000-{idx:02d}'},
                )
                alunos.append(aluno)
        return alunos

    def _ensure_competencias(self, secretaria: Secretaria):
        competencias = []
        dados = [
            ('COMP-MAT-01', 'Resolver problemas com números naturais.'),
            ('COMP-LEIT-02', 'Interpretar textos informativos.'),
        ]
        for codigo, descricao in dados:
            competencia, _ = Competencia.objects.get_or_create(
                secretaria=secretaria,
                codigo=codigo,
                defaults={'descricao': descricao},
            )
            competencias.append(competencia)
        return competencias

    def _ensure_habilidades(self, secretaria: Secretaria):
        habilidades = []
        dados = [
            ('HAB-MAT-05', 'Calcular resultado de operações básicas.'),
            ('HAB-LEIT-04', 'Identificar ideia principal em texto curto.'),
        ]
        for codigo, descricao in dados:
            habilidade, _ = Habilidade.objects.get_or_create(
                secretaria=secretaria,
                codigo=codigo,
                defaults={'descricao': descricao},
            )
            habilidades.append(habilidade)
        return habilidades

    def _ensure_questoes(self, secretaria: Secretaria, competencias, habilidades):
        questoes = []
        dados = [
            {
                'enunciado': 'Quanto é 48 + 27?',
                'alternativas': ['65', '70', '75', '76', '80'],
                'correta': 'C',
                'competencia': competencias[0],
                'habilidade': habilidades[0],
            },
            {
                'enunciado': 'Qual é o número que completa a sequência: 5, 10, 15, __?',
                'alternativas': ['18', '20', '22', '25', '30'],
                'correta': 'B',
                'competencia': competencias[0],
                'habilidade': habilidades[0],
            },
            {
                'enunciado': 'Segundo o texto, qual foi a principal causa da enchente?',
                'alternativas': [
                    'Forte chuva na madrugada',
                    'Transbordamento do rio',
                    'Falha no sistema de drenagem',
                    'Acúmulo de lixo nas ruas',
                    'Construção irregular',
                ],
                'correta': 'D',
                'competencia': competencias[1],
                'habilidade': habilidades[1],
            },
        ]
        for idx, dado in enumerate(dados, start=1):
            questao, _ = Questao.objects.get_or_create(
                secretaria=secretaria,
                enunciado=dado['enunciado'],
                defaults={
                    'alternativa_a': dado['alternativas'][0],
                    'alternativa_b': dado['alternativas'][1],
                    'alternativa_c': dado['alternativas'][2],
                    'alternativa_d': dado['alternativas'][3],
                    'alternativa_e': dado['alternativas'][4],
                    'correta': dado['correta'],
                    'competencia': dado['competencia'],
                    'habilidade': dado['habilidade'],
                    'status': Questao.STATUS_APROVADA,
                },
            )
            questoes.append(questao)
        return questoes

    def _ensure_avaliacoes(self, secretaria: Secretaria, turmas):
        avaliacoes = []
        datas = [date.today() + timedelta(days=7), date.today() + timedelta(days=30)]
        titulos = ['Avaliação Diagnóstica 2024', 'Avaliação Bimestral 1']
        for titulo, data_aplicacao in zip(titulos, datas):
            avaliacao, created = Avaliacao.objects.get_or_create(
                secretaria=secretaria,
                titulo=titulo,
                defaults={'data_aplicacao': data_aplicacao},
            )
            if created:
                avaliacao.turmas.set(turmas)
            avaliacoes.append(avaliacao)
        return avaliacoes

    def _ensure_cadernos(self, secretaria: Secretaria, avaliacoes, questoes):
        cadernos = []
        for avaliacao in avaliacoes:
            for codigo in ['A', 'B']:
                caderno, _ = Caderno.objects.get_or_create(
                    secretaria=secretaria,
                    avaliacao=avaliacao,
                    codigo=codigo,
                )
                cadernos.append(caderno)
                for ordem, questao in enumerate(questoes, start=1):
                    CadernoQuestao.objects.get_or_create(
                        caderno=caderno,
                        questao=questao,
                        defaults={'ordem': ordem},
                    )
        return cadernos

    def _ensure_gabaritos(self, secretaria: Secretaria, cadernos):
        for caderno in cadernos:
            for cq in caderno.cadernoquestao_set.all():
                Gabarito.objects.get_or_create(
                    secretaria=secretaria,
                    caderno_questao=cq,
                    defaults={'alternativa_correta': cq.questao.correta},
                )

    def _ensure_respostas(self, secretaria: Secretaria, cadernos, alunos):
        if not alunos:
            return
        principal_caderno = cadernos[0]
        for aluno in alunos:
            prova, _ = ProvaAluno.objects.get_or_create(
                secretaria=secretaria,
                avaliacao=principal_caderno.avaliacao,
                aluno=aluno,
                defaults={
                    'caderno': principal_caderno,
                    'qr_payload': {
                        'prova_id': f'PRV-{principal_caderno.avaliacao_id}-{aluno.id}',
                        'aluno': aluno.nome,
                        'turma': aluno.turma.nome,
                    },
                },
            )
            for idx, cq in enumerate(principal_caderno.cadernoquestao_set.all(), start=1):
                Resposta.objects.get_or_create(
                    secretaria=secretaria,
                    prova_aluno=prova,
                    caderno_questao=cq,
                    defaults={
                        'alternativa': cq.questao.correta if idx % 2 == 0 else 'A',
                        'correta': None,
                    },
                )
