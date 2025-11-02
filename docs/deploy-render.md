# Deploy no Render.com

Este guia descreve como publicar a API Django e o frontend React da aplicação no Render usando o arquivo `render.yaml` incluído no repositório.

## 1. Pré-requisitos

- Repositório hospedado no GitHub ou GitLab com acesso do Render.
- Banco PostgreSQL provisionado (o Render pode criar um serviço de banco gerenciado automaticamente ao aplicar o blueprint).
- Variáveis de ambiente sensíveis (ex.: `SECRET_KEY`, credenciais do banco) já mapeadas para coleta.

## 2. Estrutura do `render.yaml`

O blueprint cria dois serviços:

1. **`avaliacao-backend`** (`type: web`, ambiente Python)
   - Build: instala dependências Python e executa `python manage.py collectstatic --noinput`.
   - Start: `gunicorn app.wsgi --log-file -`.
   - Usa WhiteNoise para servir arquivos estáticos (configuração já presente em `app/settings.py`).
   - Variáveis de ambiente esperadas:
     - `SECRET_KEY`: chave secreta Django.
     - `ALLOWED_HOSTS`: domínio(s) que apontam para o serviço (por ex.: `avaliacao-backend.onrender.com`).
     - `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`: apontando para o Postgres.
     - `DEBUG`: mantenha `False` em produção.
     - Outras variáveis opcionais já utilizadas no projeto (`CORS_ALLOW_ALL_ORIGINS`, etc.).

2. **`avaliacao-frontend`** (`type: static`)
   - Build: executa `npm install` e `npm run build` dentro de `frontend/`.
   - Publica o diretório `frontend/dist`.
   - Variáveis:
     - `VITE_API_BASE_URL`: URL completa da API (ex.: `https://avaliacao-backend.onrender.com/api`).

## 3. Aplicando o blueprint

1. Faça login no painel do Render e vá em **Blueprints → New Blueprint**.
2. Aponte para o repositório e escolha a branch desejada.
3. Revise os serviços que serão criados com base no `render.yaml`.
4. Defina/importe as variáveis de ambiente marcadas com `sync: false`.
5. (Opcional) configure um serviço de Postgres no Render; copie as credenciais geradas para as variáveis do backend.
6. Clique em **Apply** para provisionar os serviços.

## 4. Pós-deploy

- Acesse os logs do serviço backend para garantir que `collectstatic` e as migrações executaram corretamente (execute `python manage.py migrate` via shell web quando necessário).
- Verifique se o frontend está consumindo a API pela URL configurada em `VITE_API_BASE_URL`.
- Se o domínio customizado for utilizado, atualize `ALLOWED_HOSTS` e, opcionalmente, `CSRF_TRUSTED_ORIGINS`.
- Lembre-se de executar `playwright install chromium` no ambiente se precisar gerar PDFs; pode ser feito via shell do serviço backend.

## 5. Deploy manual (sem blueprint)

Caso prefira criar os serviços manualmente no painel:

1. **Backend**
   - Crie um serviço *Web Service → Python*.
   - Build Command: `pip install --upgrade pip && pip install -r requirements.txt && python manage.py collectstatic --noinput`.
   - Start Command: `gunicorn app.wsgi --log-file -`.
   - Configure as mesmas variáveis de ambiente listadas acima.
2. **Frontend**
   - Crie um serviço *Static Site*.
   - Build Command: `cd frontend && npm install && npm run build`.
   - Publish Directory: `frontend/dist`.
   - Configure `VITE_API_BASE_URL` apontando para o backend.

Com isso o projeto fica pronto para ser publicado no Render.
