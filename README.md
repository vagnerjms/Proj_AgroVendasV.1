# AgroVendas

AgroVendas e uma plataforma mobile-first para digitalizar pedidos, vendas e operacoes comerciais de hortifruti. O projeto substitui controles manuais por um fluxo integrado para cadastro de produtos, produtores, clientes, pedidos, calculo de venda, autenticacao e backoffice web.

## Visao Geral

O MVP foi desenhado para atender operacoes de broker/distribuicao agricola com foco em:

- cadastro de produtos, produtores e clientes;
- criacao e calculo de pedidos de venda;
- autenticacao JWT e controle de perfis;
- backoffice web para gestao operacional;
- base preparada para modulo mobile, financeiro, fiscal, PDF e integracoes futuras.

## Stack

- Frontend: Next.js, React, TypeScript, TanStack Query
- Backend: NestJS, TypeScript, MongoDB, Mongoose, JWT
- Mobile: Expo, React Native, TypeScript
- Banco de dados: MongoDB
- Infraestrutura local: Docker Compose
- Testes: Vitest

## Estrutura do Projeto

```text
.
├── backend/            # API NestJS, dominio, modulos, seeds e testes
├── frontend/           # Backoffice web Next.js
├── mobile/             # Aplicativo Expo/React Native
├── docs/               # Documentacao tecnica e arquitetura
├── infra/              # Arquivos de infraestrutura local
├── docker-compose.yml  # Stack local com MongoDB, backend, frontend e servicos opcionais
├── .env.example        # Exemplo de variaveis de ambiente
└── README.md
```

## Requisitos

- Git
- Docker Desktop com Docker Compose v2
- Node.js 20+ para execucao local fora dos containers
- npm

Para desenvolvimento padrao, o Docker Compose ja sobe banco, backend e frontend.

## Configuracao Inicial

Clone o repositorio e entre na pasta do projeto:

```bash
git clone <url-do-repositorio>
cd AgroVendas
```

Crie o arquivo de ambiente local:

```bash
cp .env.example .env
```

No Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Revise os valores do `.env` antes de iniciar. Nao versione `.env` real.

## Rodando com Docker

Suba a stack principal:

```bash
docker compose up --build
```

Acesse:

- Frontend: http://localhost:3000
- Backend: http://localhost:3001
- Health check: http://localhost:3001/health
- Mongo Express: http://localhost:8081

Servicos principais:

- `mongodb`: banco de dados local;
- `mongo-express`: interface administrativa do MongoDB;
- `backend`: API NestJS com hot reload;
- `frontend`: Next.js com hot reload.

Servicos opcionais:

```bash
docker compose --profile mobile up --build mobile
docker compose --profile workers up --build pdf-worker
```

## Seeds

Com os containers ativos, rode os dados iniciais:

```bash
docker compose exec backend npm run seed
docker compose exec backend npm run seed:admin
```

Credenciais iniciais de desenvolvimento:

- E-mail: `admin@agrovenda.local`
- Senha: `Admin123!`
- Perfil: `admin`

Altere essas credenciais antes de qualquer uso fora do ambiente local.

## Desenvolvimento Local sem Docker

Instale as dependencias de cada aplicacao:

```bash
cd backend
npm install

cd ../frontend
npm install

cd ../mobile
npm install
```

Execute cada servico em terminais separados:

```bash
cd backend
npm run start:dev
```

```bash
cd frontend
npm run dev
```

```bash
cd mobile
npm run start
```

Para esse modo, garanta que o MongoDB esteja disponivel e que as URLs do `.env` apontem para o ambiente correto.

## Scripts Uteis

Backend:

```bash
cd backend
npm run start:dev
npm run build
npm test
npm run seed
npm run seed:admin
```

Frontend:

```bash
cd frontend
npm run dev
npm run build
npm test
```

Mobile:

```bash
cd mobile
npm run start
npm run android
npm run ios
npm run web
npm test
```

## Variaveis de Ambiente

Use `.env.example` como referencia. Principais variaveis:

- `APP_NAME`
- `NODE_ENV`
- `MONGODB_URI`
- `MONGO_URI`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `BACKEND_PORT`
- `FRONTEND_PORT`
- `MONGO_EXPRESS_PORT`
- `MOBILE_EXPO_PORT`
- `PDF_SERVICE_URL`
- `WHATSAPP_PROVIDER`
- `FISCAL_PROVIDER`

Boas praticas:

- nunca commitar `.env`;
- usar segredos fortes fora do desenvolvimento;
- manter variaveis publicas do frontend com prefixo adequado, como `NEXT_PUBLIC_*`;
- documentar novas variaveis em `.env.example`.

## Qualidade e Boas Praticas

Antes de abrir pull request ou fazer release:

```bash
cd backend
npm test
npm run build
```

```bash
cd frontend
npm test
npm run build
```

Checklist recomendado:

- codigo sem segredos versionados;
- `.env.example` atualizado;
- testes relevantes passando;
- build do backend e frontend funcionando;
- nomes de commits claros e objetivos;
- alteracoes pequenas, revisaveis e focadas.

## Git e Primeiro Commit

Depois de revisar os arquivos:

```bash
git status
git add README.md .gitignore .env.example docker-compose.yml backend frontend mobile docs infra
git commit -m "chore: initial project setup"
```

Se o repositorio remoto ainda nao estiver configurado:

```bash
git remote add origin <url-do-repositorio>
git branch -M main
git push -u origin main
```

## Documentacao

A documentacao tecnica fica em:

- [docs/architecture.md](docs/architecture.md)

Atualize a documentacao sempre que houver mudanca relevante de arquitetura, rotas, infraestrutura, variaveis ou fluxo de negocio.
