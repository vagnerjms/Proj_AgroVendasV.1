# AgroVenda Broker - Arquitetura MVP

## 1. Visão Geral

AgroVenda Broker é um sistema mobile-first para registrar vendas de hortifrúti de produtores/fazendas para compradores em qualquer UF do Brasil. O comprovante gerado é operacional e não substitui NF-e/NFP-e. A nota fiscal deve ser vinculada depois por chave, XML, DANFE/PDF ou integração fiscal homologada.

Stack recomendada para o MVP:

- Banco principal: MongoDB 7.
- Backend: Node.js + NestJS + Mongoose.
- App mobile: React Native com Expo.
- Backoffice web: Next.js.
- Containers: Docker Compose com hot reload.
- PDF: módulo interno no NestJS no MVP; worker separado quando houver fila.
- Fila futura: BullMQ + Redis, sem bloquear o MVP.

## 2. Containers

```text
host
  docker-compose
    mongodb:27017
      volume mongodb_data
    mongo-express:8081
      acessa mongodb
    backend:3001
      NestJS, Mongoose, REST, auth, regras de cálculo, relatórios
      volume ./backend:/app
    frontend:3000
      Next.js backoffice
      volume ./frontend:/app
    mobile:8082 profile mobile
      Expo dev server
      volume ./mobile:/app
    pdf-worker profile workers
      geração assíncrona de comprovantes quando necessário
```

Arquivos criados:

- `docker-compose.yml`
- `backend/Dockerfile`
- `frontend/Dockerfile`
- `mobile/Dockerfile`
- `.env.example`

## 3. Estrutura de Pastas

```text
backend/
  src/
    main.ts
    app.module.ts
    common/
      decorators/
      filters/
      guards/
      interceptors/
      pipes/
    modules/
      auth/
      users/
      products/
      producers/
      farms/
      customers/
      sales-orders/
      payments/
      fiscal-documents/
      market-prices/
      reports/
      pdf-receipts/
      audit-logs/
    seeds/
    workers/
frontend/
  app/
  components/
  features/
  lib/
  styles/
mobile/
  app/
  components/
  features/
  lib/
  storage/
infra/
  mongo/
  backups/
docs/
```

## 4. Modelo MongoDB

Padrão comum para todas as collections:

- `_id: ObjectId`
- `createdAt: Date`
- `updatedAt: Date`
- `deletedAt?: Date`
- `isDeleted: boolean`
- `createdBy?: ObjectId`
- `updatedBy?: ObjectId`
- `tenantId?: ObjectId` para multiempresa futuro.

### users

Campos: `name string`, `email string`, `phone string`, `passwordHash string`, `roles string[]`, `status active|inactive`, `lastLoginAt Date`.

Índices: `email unique`, `phone`, `roles`, `isDeleted`.

Referências: usado em auditoria, pedidos, pagamentos e anexos.

### products

Campos: `name`, `variety`, `classification`, `category`, `unit kg|caixa|saca|tonelada|unidade`, `internalCode`, `status`, `defaultCalculation { funruralRate, brokerCommissionRate, freightMode }`, `marketPriceRefs ObjectId[] opcional`.

Índices: `internalCode unique`, `{ name, variety, classification }`, `status`.

Embedding vs referencing: configurações padrão embutidas; histórico de preço referenciado em `market_prices`.

### producers

Campos: `name`, `document { type cpf|cnpj, value }`, `stateRegistration`, `ruralProducerRegistration`, `address`, `city`, `uf`, `bankAccounts[]`, `pixKeys[]`, `taxRegime`, `funrural { enabled, rate, calculationBase }`, `accountant { name, phone, email }`, `status`.

Índices: `document.value unique`, `{ city, uf }`, `status`.

### farms

Campos: `producerId ObjectId`, `name`, `address`, `city`, `uf`, `loadingPlaces[]`, `status`.

Índices: `producerId`, `{ city, uf }`.

Estratégia: fazenda separada do produtor porque um produtor pode ter várias origens e pontos de carga.

### customers

Campos: `name`, `legalName`, `document`, `stateRegistration`, `deliveryAddress`, `city`, `uf`, `contacts[]`, `whatsapp`, `creditLimit number`, `financialStatus ok|watch|blocked`, `status`.

Índices: `document.value unique`, `{ city, uf }`, `financialStatus`, `status`.

### sales_orders

Campos principais:

- `orderNumber string unique`
- `soldAt Date`
- `productSnapshot { productId, name, variety, unit }`
- `producerSnapshot { producerId, farmId, name, document, city, uf }`
- `origin { loadingPlace, city, uf }`
- `customerSnapshot { customerId, name, document, city, uf }`
- `destination { address, city, uf }`
- `quantity number`
- `unitPrice number`
- `grossAmount number`
- `freightAmount number`
- `discountAmount number`
- `surchargeAmount number`
- `funrural { enabled, rate, amount }`
- `brokerCommission { type percent|fixed, rate, amount }`
- `producerNetAmount number`
- `brokerNetAmount number`
- `payment { method, termDays, dueDate, notes }`
- `status draft|confirmed|loaded|delivered|invoiced|received|cancelled`
- `financialStatus open|partial|paid|overdue|cancelled`
- `fiscalStatus pending|requested|issued|divergent|cancelled`
- `attachmentIds ObjectId[]`
- `receipt { pdfAttachmentId, qrCodePayload, generatedAt }`
- `notes string`

Índices: `orderNumber unique`, `soldAt`, `status`, `financialStatus`, `fiscalStatus`, `productSnapshot.productId`, `producerSnapshot.producerId`, `producerSnapshot.farmId`, `customerSnapshot.customerId`, `{ soldAt, status }`.

Estratégia: snapshots embutidos preservam o pedido como documento auditável mesmo se cadastros mudarem; IDs mantêm rastreabilidade.

### payments

Campos: `type receivable|payable|commission|retention`, `orderId`, `producerId`, `customerId`, `amount`, `paidAmount`, `dueDate`, `paidAt`, `method`, `status open|partial|paid|overdue|cancelled`, `dailySummaryDate`, `attachments[]`.

Índices: `orderId`, `producerId`, `customerId`, `dueDate`, `paidAt`, `status`, `{ dailySummaryDate, type }`.

### market_prices

Campos: `productId`, `productName`, `date`, `source ceagesp|ceasa|conab|private`, `marketPlace`, `city`, `uf`, `unit`, `minPrice`, `avgPrice`, `maxPrice`, `currency BRL`, `rawPayload`, `collectedAt`.

Índices: `{ productId, date, source, marketPlace } unique`, `{ date, source }`, `{ city, uf }`.

### fiscal_documents

Campos: `orderId`, `accessKey`, `number`, `series`, `issuedAt`, `issuer`, `recipient`, `amount`, `xmlAttachmentId`, `danfeAttachmentId`, `status pending|requested|issued|divergent|cancelled`, `divergence { amountDiff, reason, checkedAt }`.

Índices: `orderId`, `accessKey unique sparse`, `{ status, issuedAt }`.

### attachments

Campos: `ownerType`, `ownerId`, `kind photo|xml|danfe|receipt|document`, `fileName`, `mimeType`, `size`, `storageProvider local|s3|minio`, `storageKey`, `sha256`, `uploadedBy`.

Índices: `{ ownerType, ownerId }`, `kind`, `sha256`.

### audit_logs

Campos: `actorUserId`, `entityType`, `entityId`, `action create|update|delete|status_change|payment|fiscal_link`, `before`, `after`, `metadata { ip, userAgent }`, `createdAt`.

Índices: `{ entityType, entityId, createdAt }`, `actorUserId`, `action`, `createdAt`.

### daily_summaries

Campos: `date`, `grossAmount`, `freightAmount`, `discountAmount`, `surchargeAmount`, `funruralAmount`, `commissionAmount`, `producerNetAmount`, `brokerNetAmount`, `receivedAmount`, `payableAmount`, `ordersCount`, `status open|closed|recalculated`.

Índices: `date unique`, `status`.

## 5. Schemas Mongoose Base

Exemplo de padrão para os schemas:

```ts
@Schema({ timestamps: true })
export class SalesOrder {
  @Prop({ required: true, unique: true, index: true })
  orderNumber: string;

  @Prop({ required: true, index: true })
  soldAt: Date;

  @Prop({ type: Object, required: true })
  productSnapshot: ProductSnapshot;

  @Prop({ type: Object, required: true })
  producerSnapshot: ProducerSnapshot;

  @Prop({ type: Object, required: true })
  customerSnapshot: CustomerSnapshot;

  @Prop({ required: true, min: 0 })
  quantity: number;

  @Prop({ required: true, min: 0 })
  unitPrice: number;

  @Prop({ required: true, min: 0 })
  grossAmount: number;

  @Prop({ default: 0, min: 0 })
  freightAmount: number;

  @Prop({ default: 0, min: 0 })
  discountAmount: number;

  @Prop({ default: 0, min: 0 })
  surchargeAmount: number;

  @Prop({ type: Object, required: true })
  funrural: { enabled: boolean; rate: number; amount: number };

  @Prop({ type: Object, required: true })
  brokerCommission: { type: 'percent' | 'fixed'; rate: number; amount: number };

  @Prop({ required: true })
  producerNetAmount: number;

  @Prop({ required: true })
  brokerNetAmount: number;

  @Prop({ enum: ['draft', 'confirmed', 'loaded', 'delivered', 'invoiced', 'received', 'cancelled'], index: true })
  status: string;

  @Prop({ default: false, index: true })
  isDeleted: boolean;

  @Prop()
  deletedAt?: Date;
}
```

Criar schemas equivalentes para `User`, `Product`, `Producer`, `Farm`, `Customer`, `Payment`, `MarketPrice`, `FiscalDocument`, `Attachment`, `AuditLog` e `DailySummary`, sempre com índices declarados no schema e DTOs separados.

## 6. API REST

Rotas por módulo:

- `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`.
- `GET/POST /users`, `GET/PATCH/DELETE /users/:id`.
- `GET/POST /products`, `GET/PATCH/DELETE /products/:id`, `GET /products/:id/market-prices`.
- `GET/POST /producers`, `GET/PATCH/DELETE /producers/:id`.
- `GET/POST /farms`, `GET/PATCH/DELETE /farms/:id`, `GET /producers/:id/farms`.
- `GET/POST /customers`, `GET/PATCH/DELETE /customers/:id`.
- `GET/POST /sales-orders`, `GET /sales-orders/today`, `GET/PATCH /sales-orders/:id`, `POST /sales-orders/:id/confirm`, `POST /sales-orders/:id/cancel`, `POST /sales-orders/:id/attachments`.
- `POST /sales-orders/calculate` para prévia de cálculo antes de salvar.
- `GET/POST /payments`, `PATCH /payments/:id`, `POST /payments/:id/settle`.
- `GET/POST /fiscal-documents`, `PATCH /fiscal-documents/:id`, `POST /sales-orders/:id/fiscal-documents`, `POST /fiscal-documents/:id/check-divergence`.
- `GET/POST /market-prices`, `POST /market-prices/import`, `GET /market-prices/compare`.
- `GET /reports/daily`, `/weekly`, `/monthly`, `/by-producer`, `/by-customer`, `/by-product`, `/pending-fiscal`, `/divergent-fiscal`, `/receivables`, `/paid`.
- `POST /pdf-receipts/sales-orders/:id`, `GET /pdf-receipts/:id`.
- `GET /audit-logs`, `GET /audit-logs/:entityType/:entityId`.

Padrões de erro: `400 ValidationError`, `401 Unauthorized`, `403 Forbidden`, `404 NotFound`, `409 Conflict`, `422 BusinessRuleViolation`, `500 InternalError`.

## 7. Módulos Backend

Cada módulo deve conter:

- `*.module.ts`
- `*.controller.ts`
- `*.service.ts`
- `dto/create-*.dto.ts`
- `dto/update-*.dto.ts`
- `schemas/*.schema.ts`
- `*.service.spec.ts`

Validações:

- DTOs com `class-validator`.
- Normalização de CPF/CNPJ, UF e telefone.
- Valores monetários em centavos no domínio interno ou `Decimal128`; recomendação MVP: centavos como `number` inteiro para evitar erro de ponto flutuante.
- Guards por JWT e roles.
- Interceptor de auditoria em mutações.

## 8. Regras de Negócio

Fórmulas:

- `valorBruto = quantidade * valorUnitario`.
- `baseCalculo = valorBruto + acrescimo - desconto`.
- `retencaoFunrural = baseCalculo * aliquotaFunrural` quando aplicável.
- `comissao = tipoPercentual ? baseCalculo * taxaComissao : valorFixo`.
- `valorLiquidoProdutor = baseCalculo - retencaoFunrural - comissao`.
- `valorLiquidoCorretor = comissao`.
- `totalPedido = baseCalculo + frete`.

Regras:

- Pedido confirmado deve gerar contas a receber e valores a pagar ao produtor/corretor.
- Pedido cancelado não pode receber pagamento novo.
- NF emitida com diferença acima da tolerância configurada marca `fiscalStatus=divergent`.
- Comprovante operacional sempre inclui: `Comprovante operacional de venda. Não substitui documento fiscal.`
- Alteração em pedido confirmado deve registrar `audit_logs` com antes/depois.
- Cliente bloqueado financeiramente não confirma venda sem permissão de administrador.

## 9. Relatórios

Endpoints e telas:

- Vendas do dia: filtros por status, produtor, produto e cliente.
- Vendas por produtor, cliente e produto.
- Saldo do dia: bruto, frete, descontos, acréscimos, retenções, comissões, líquido produtor, líquido corretor.
- Retenções acumuladas.
- Comissões acumuladas.
- Pedidos pendentes de NF.
- Pedidos com NF divergente.
- Contas a receber.
- Contas pagas.

## 10. UX Mobile

Tela inicial com botões grandes:

- Nova venda
- Vendas de hoje
- A receber
- Produtores
- Clientes
- Cotações
- Relatórios

Fluxo de nova venda:

1. Escolher produto.
2. Escolher produtor/origem.
3. Escolher cliente/destino.
4. Informar quantidade e preço.
5. Conferir cálculo automático.
6. Confirmar venda.
7. Gerar comprovante.

Princípios:

- Pouco texto, botões grandes, busca rápida e confirmação visual.
- Usar máscaras para CPF/CNPJ, moeda, UF e telefone.
- Permitir rascunho local para futuro offline-first.

## 11. Backlog MVP por Fases

Fase 0 - Base:

- Docker Compose, MongoDB, NestJS, Next.js, Expo.
- Auth JWT, roles e seed inicial.

Fase 1 - Cadastros:

- Produtos, produtores, fazendas, clientes.
- Soft delete e auditoria básica.

Fase 2 - Pedido:

- Nova venda em etapas.
- Cálculo automático.
- Status e comprovante PDF.

Fase 3 - Financeiro:

- Contas a receber/pagar.
- Baixa de pagamentos.
- Resumo diário.

Fase 4 - Fiscal:

- Vincular NF-e/NFP-e.
- Upload XML/DANFE.
- Checagem de divergência.

Fase 5 - Cotações:

- Import manual/CSV/API.
- Histórico e alerta fora da média.

## 12. Critérios de Aceite

- `docker compose up --build` sobe MongoDB, Mongo Express, backend e frontend.
- Backend conecta no MongoDB por variável `MONGO_URI`.
- Criar produto, produtor, fazenda, cliente e pedido via API.
- Pedido calcula bruto, retenção, comissão e líquidos de forma reproduzível.
- Pedido confirmado aparece em vendas do dia e contas a receber.
- PDF do comprovante contém a frase fiscal obrigatória.
- NF vinculada com valor divergente altera status fiscal.
- Alterações críticas geram trilha em `audit_logs`.

## 13. Testes Locais

- Unitários: serviços de cálculo, validação fiscal, geração de número de pedido.
- Integração: controllers com MongoDB de teste ou Testcontainers.
- E2E API: criar fluxo completo produto -> produtor -> cliente -> pedido -> pagamento -> NF.
- Frontend/mobile: testes de componentes críticos e smoke test do fluxo de nova venda.

Comandos previstos:

```bash
docker compose up --build
docker compose exec backend npm test
docker compose exec backend npm run seed
docker compose exec frontend npm test
```

## 14. Seed Inicial

Dados mínimos:

- Usuário admin, corretor, financeiro e contador.
- Produtos: batata, cebola, alho, cenoura, abóbora cabotiá.
- Um produtor com fazenda e local de carga.
- Um cliente comprador.
- Configurações padrão de Funrural e comissão.
- Cotações fictícias para comparação.

## 15. Hot Reload

- Backend: `nest start --watch`, volume `./backend:/app`, node_modules em volume nomeado.
- Frontend: `next dev`, volume `./frontend:/app`, `.next` em volume nomeado.
- Mobile: `expo start`, profile `mobile`, volume `./mobile:/app`.
- MongoDB: volume persistente para dados.

## 16. Backup MongoDB

Desenvolvimento:

```bash
docker compose exec mongodb mongodump --authenticationDatabase admin -u agrovenda -p agrovenda_dev_password --db agrovenda --out /tmp/backup
```

Produção:

- Backup diário com `mongodump` para storage externo.
- Retenção: 7 diários, 4 semanais, 12 mensais.
- Teste mensal de restore.
- Criptografia em repouso no destino.
- Logs de backup auditáveis.

## 17. Integração Fiscal Futura

Camada `FiscalProvider`:

- `ManualFiscalProvider`: MVP, vínculo por chave/XML/PDF.
- `ApiFiscalProvider`: futura API homologada.
- `AccountantRequestProvider`: envia solicitação ao contador por e-mail/WhatsApp/API.

Fluxo:

1. Pedido confirmado.
2. Status fiscal `pending`.
3. Solicitar emissão ao contador.
4. Receber chave/XML/DANFE.
5. Validar emitente, destinatário e valor.
6. Marcar `issued` ou `divergent`.

## 18. Offline-First Futuro

- Mobile mantém rascunhos em SQLite/AsyncStorage.
- IDs locais temporários com sincronização posterior.
- Operações como fila: criar pedido, anexar foto, atualizar status.
- Resolução de conflito por versão (`updatedAt` + `version`).
- Backend expõe `/sync/pull` e `/sync/push`.
- Auditoria registra origem `mobile-offline`.

## 19. Prompt para Gerar Backend

```text
Crie um backend NestJS para AgroVenda Broker com MongoDB/Mongoose, JWT, roles, DTOs com class-validator, soft delete, timestamps e audit_logs. Implemente módulos auth, users, products, producers, farms, customers, sales-orders, payments, fiscal-documents, market-prices, reports e pdf-receipts. Use valores monetários em centavos. Implemente SalesOrderCalculationService com bruto, frete, desconto, acréscimo, Funrural, comissão, líquido produtor e líquido corretor. Gere controllers REST, services, schemas, testes unitários e seed inicial. Não implemente emissão fiscal; apenas vínculo posterior de NF-e/NFP-e por chave/XML/PDF.
```

## 20. Prompt para Gerar App Mobile

```text
Crie app React Native com Expo para AgroVenda Broker, mobile-first e simples para usuário não técnico. Tela inicial com botões grandes: Nova venda, Vendas de hoje, A receber, Produtores, Clientes, Cotações e Relatórios. Implemente fluxo de nova venda em 7 etapas: produto, produtor/origem, cliente/destino, quantidade/preço, conferência de cálculo, confirmação e comprovante. Use React Query, formulários validados, máscaras de moeda/CPF/CNPJ/telefone e armazenamento local de rascunhos para futura sincronização offline-first.
```

## 21. Prompt para Gerar Backoffice Web

```text
Crie backoffice Next.js para AgroVenda Broker com telas operacionais densas e simples: dashboard do dia, produtos, produtores/fazendas, clientes, pedidos, financeiro, fiscal, cotações e auditoria. Use tabelas filtráveis, formulários com validação, cards apenas para indicadores, layout responsivo e consumo da API REST. Priorize conferência financeira/fiscal, upload de XML/DANFE/PDF e relatórios por período, produtor, cliente e produto.
```

## 22. Prompt para Gerar Comprovante PDF

```text
Crie gerador de PDF para comprovante operacional de venda do AgroVenda Broker, inspirado em bloco físico de pedidos de hortifrúti. O PDF deve conter número do pedido, data, corretor, produtor/fazenda, cliente, origem, destino, produto, quantidade, unidade, valor unitário, total, frete, retenções, comissão, valor líquido, forma de pagamento, prazo, observações e QR Code para consulta interna. Incluir obrigatoriamente a frase: "Comprovante operacional de venda. Não substitui documento fiscal." O layout deve ser claro para WhatsApp e impressão.
```
