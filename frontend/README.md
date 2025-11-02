# Frontend em React – Avaliação Municipal

Este diretório contém a aplicação web que consome a API do sistema de avaliação municipal.

## Pré-requisitos

- Node.js 18 ou superior
- npm 9 ou superior

## Configuração

1. Dentro de `frontend/`, instale as dependências:

   ```sh
   npm install
   ```

2. Crie um arquivo `.env` na raiz do diretório com as variáveis necessárias (opcional):

   ```env
   VITE_API_BASE_URL=http://localhost:8000/api
   VITE_PORT=5173
   ```

   Caso não informe `VITE_API_BASE_URL`, o endereço acima será utilizado como padrão.

## Scripts disponíveis

- `npm run dev`: inicia o servidor de desenvolvimento com Vite.
- `npm run build`: gera a build de produção.
- `npm run preview`: pré-visualiza localmente a build gerada.

## Fluxo principal

1. Faça login com um usuário válido para que os tokens JWT sejam armazenados.
2. Utilize o menu lateral para navegar entre as seções:
   - **Escolas**: cadastros de escolas, turmas e alunos.
   - **Banco de Itens**: competências, habilidades e questões.
   - **Avaliações**: avaliações, cadernos e provas por aluno.
   - **Respostas**: coleta de respostas e gabaritos.
   - **Relatórios**: proficiência por habilidade.

As operações de criação, edição e exclusão atualizam automaticamente as listas em tela.

## Perfis e permissões

- **Superadmin**: acesso completo a todos os módulos; pode alternar entre secretarias.
- **Admin**: gerencia escolas, turmas, alunos, banco de itens, avaliações, provas, coletas e relatórios.
- **Professor**: consulta dashboards e o banco de itens; pode cadastrar/editar questões, mas elas ficam como _pendentes_ até aprovação de um administrador e não pode excluí-las.
