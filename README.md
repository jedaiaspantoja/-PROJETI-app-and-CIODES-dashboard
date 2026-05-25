# PROJETI 2025.2

Aplicacao para registro, despacho e acompanhamento de ocorrencias de APH. O projeto esta dividido em tres frentes principais:

- App do solicitante: usado por uma pessoa leiga para abrir uma ocorrencia real, enviar localizacao, escolher tipo de ocorrencia/vitima e receber orientacoes enquanto aguarda atendimento.
- App do socorrista: usado por profissional com matricula, vinculado a uma viatura/guarnicao, para acompanhar ocorrencias empenhadas, visualizar local, vitima, sinais vitais e registrar relato.
- Dashboard CIODES: painel web para operacao e gestao, com fila de despacho, empenho de viaturas, acompanhamento de ocorrencias e cadastro/vinculo de viaturas e socorristas.

O banco atual e o Supabase, com autenticação via Supabase Auth e dados em Postgres.

## Tecnologias

- Expo SDK 54
- React Native
- TypeScript
- Supabase Auth
- Supabase Postgres
- Supabase Realtime
- Expo SQLite para suporte offline
- Dashboard CIODES em HTML/CSS/JavaScript estatico

## Estrutura de pastas

```text
PROJETI-2025.2/
├── App.tsx
├── app.json
├── package.json
├── tsconfig.json
├── backend/
├── frontend/
├── dashboard/
├── database/
└── .env
```

### `App.tsx`

Arquivo principal da navegacao do app Expo. Define as rotas principais:

- `Login`
- `Cadastro`
- `Home`
- `ListaCasos`
- `TipoVitima`
- `TutorialCaso`
- `RegistroCasos`
- `DetalheRegistro`
- `BombeiroDashboard`
- `BombeiroDetalhe`

Tambem inicializa o SQLite offline v2 e tenta sincronizar ocorrencias pendentes ao abrir o app.

### `frontend/`

Contem as telas do app mobile.

#### `frontend/login/`

Tela de login para dois perfis:

- Solicitante: entra com CPF e senha.
- Socorrista: entra com matricula e senha.

O login consulta o perfil em `usuarios` e autentica a senha pelo Supabase Auth.

#### `frontend/cadastro/`

Tela de cadastro de usuarios.

Para solicitante:

- nome completo;
- CPF;
- telefone opcional;
- email;
- senha.

Para socorrista:

- nome completo;
- matricula;
- guarnicao/viatura ativa;
- telefone opcional;
- email;
- senha.

Ao cadastrar socorrista, o app cria o usuario no Supabase Auth, cria/atualiza o perfil em `usuarios` e vincula o profissional na tabela `guarnicao_membros`.

#### `frontend/home/`

Tela inicial do solicitante. Permite:

- acessar modo treinamento;
- iniciar ocorrencia real;
- consultar historico de ocorrencias.

No modo emergencia, o app tenta obter conexao e localizacao. Se estiver offline, orienta ligação para o 193 e segue para os tutoriais.

#### `frontend/listaCasos/`

Lista os tipos de ocorrencia cadastrados no Supabase, como engasgo, convulsao, RCP, afogamento e trauma.

Tambem usa cache local SQLite quando nao consegue carregar dados online.

#### `frontend/tipoVitima/`

Permite escolher o tipo de vitima:

- adulto;
- crianca;
- recem-nascido.

Depois cria a ocorrencia no Supabase. Se estiver em fluxo offline, salva a ocorrencia pendente localmente para sincronizacao posterior.

#### `frontend/tutorialCaso/`

Mostra orientacoes/tutorial para o solicitante. Essa tela e voltada ao usuario leigo enquanto aguarda a equipe.

O app suporta passos vindos da tabela `tutorial_passos`, incluindo campo para midia/animação futura.

#### `frontend/registro/`

Historico das ocorrencias abertas pelo solicitante logado.

#### `frontend/detalheRegistro/`

Detalhes de uma ocorrencia do solicitante, incluindo status, tipo, vitima e localizacao quando disponivel.

#### `frontend/bombeiro/`

Fluxo do socorrista profissional.

`BombeiroDashboard.tsx` mostra as ocorrencias empenhadas para a viatura/guarnicao do socorrista. A tela prioriza:

- tipo da ocorrencia;
- tipo da vitima;
- status;
- localizacao;
- rota;
- tempo decorrido.

`BombeiroDetalhe.tsx` mostra a ficha operacional da ocorrencia:

- protocolo;
- status;
- localizacao e rota;
- tipo da ocorrencia;
- tipo da vitima;
- solicitante e telefone;
- ultima leitura de sinais vitais;
- alertas de sinais vitais;
- relato do atendimento;
- historico de relatos.

#### `frontend/shared/`

Utilitarios compartilhados do frontend, incluindo sessao local do usuario logado.

### `backend/`

Contem conectores e utilitarios de acesso a dados.

#### `backend/connectors/`

Conexao com Supabase e tipos auxiliares. O principal arquivo e `postgre.ts`, que cria o cliente Supabase usado pelo app.

#### `backend/offline/`

Implementacao offline v2 com Expo SQLite. Contem:

- criacao de tabelas locais;
- cache de dados de referencia;
- salvamento de ocorrencias pendentes;
- sincronizacao posterior com Supabase.

#### `backend/postgreOnline/`

Funcoes antigas/auxiliares para operacoes online no Postgres/Supabase.

#### `backend/sqlliteOffline/`

Implementacao offline legada. Ainda existe no projeto, mas o fluxo atual usa preferencialmente `backend/offline/offlineV2.ts`.

#### `backend/auth/`

Reservado para funcoes relacionadas a autenticacao.

### `dashboard/`

Painel CIODES em HTML, CSS e JavaScript puro.

Arquivos:

- `dashboard/index.html`: estrutura do painel.
- `dashboard/styles.css`: estilos da interface.
- `dashboard/app.js`: conexao com Supabase, consultas, realtime e acoes operacionais.

Funcoes principais da dashboard:

- fila de despacho;
- ocorrencias em andamento;
- historico de finalizadas;
- painel de viaturas/guarnicoes;
- marcar viatura como disponivel, indisponivel ou manutencao;
- empenhar viatura em ocorrencia;
- assumir ocorrencia no CIODES;
- avancar status;
- visualizar historico da ocorrencia;
- cadastrar viaturas;
- vincular socorristas a viaturas.

Importante: a dashboard e estatica na interface, mas os dados sao dinamicos. Ela conecta no Supabase diretamente pelo navegador e assina mudanças via Supabase Realtime.

### `database/`

Scripts SQL e documentacao do banco.

Arquivos principais:

- `projeti_schema_v2_initial.sql`: schema atual base do novo modelo.
- `projeti_schema_v2_fk_indexes.sql`: indices para chaves estrangeiras.
- `projeti_seed_dev.sql`: dados de desenvolvimento/demonstração.

O modelo atual contempla:

- usuarios;
- tipos de vitima;
- tipos de ocorrencia;
- tutoriais;
- passos de tutorial;
- guarnicoes/viaturas;
- membros da guarnicao;
- ocorrencias;
- historico de status;
- empenhos;
- relatos;
- midias;
- dispositivos de monitoramento;
- leituras de sinais vitais;
- alertas de sinais vitais;
- formularios de ocorrencia;
- sincronizacao offline.

## Configuracao do Supabase

O projeto usa variaveis publicas para conectar no Supabase:

```env
EXPO_PUBLIC_SUPABASE_URL=https://fcjettvlsmoxnzolqmkc.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_gcvNapfPrLZVI2x49C8stQ_wwXo3HDb
NEXT_PUBLIC_SUPABASE_URL=https://fcjettvlsmoxnzolqmkc.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_gcvNapfPrLZVI2x49C8stQ_wwXo3HDb
```

A publishable key do Supabase pode aparecer no frontend, pois ela foi feita para uso publico. Mesmo assim, a seguranca real deve ser feita com RLS/policies no banco.

Nao coloque no GitHub:

- senha do banco Postgres;
- `DATABASE_URL` com senha real;
- `DIRECT_URL` com senha real;
- service role key;
- tokens privados.

Se quiser manter exemplos, use `.env.example` com placeholders.

Exemplo:

```env
DATABASE_URL="postgresql://postgres.[PROJECT_REF]:[YOUR-PASSWORD]@aws-1-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[PROJECT_REF]:[YOUR-PASSWORD]@aws-1-us-east-1.pooler.supabase.com:5432/postgres"
```

## Como instalar

Requisitos:

- Node.js instalado;
- npm instalado;
- Python instalado, para servir a dashboard estatica;
- Expo Go no celular ou emulador Android/iOS;
- projeto Supabase configurado.

Instale dependencias:

```powershell
cd "C:\Users\Usuário\Desktop\PROJETI-2025.2"
npm install
```

## Como rodar o app mobile

Na pasta do projeto:

```powershell
npx expo start --lan --port 8085 --clear
```

Se a porta estiver ocupada:

```powershell
npx expo start --lan --port 8086 --clear
```

Depois:

- escaneie o QR Code com Expo Go;
- ou pressione `a` para Android;
- ou pressione `i` para iOS, se estiver em ambiente compativel.

## Como rodar o Dashboard CIODES

Em outro terminal:

```powershell
python -m http.server 8000
```

Abra no navegador:

```text
 
```

Se o navegador mostrar versao antiga, use:

```text
Ctrl + F5
```

## Como validar o projeto

Checar TypeScript:

```powershell
npx --no-install tsc --noEmit
```

Checar sintaxe da dashboard:

```powershell
node --check dashboard\app.js
```

Testar se a dashboard esta servindo:

```powershell
Invoke-WebRequest -UseBasicParsing "http://localhost:8000/dashboard/?v=20260506-1" | Select-Object -ExpandProperty StatusCode
```

Resposta esperada:

```text
200
```

## Fluxo do solicitante

1. Usuario faz cadastro como solicitante.
2. Login com CPF e senha.
3. Na Home, escolhe treinamento ou ocorrencia real.
4. Em ocorrencia real, o app tenta coletar localizacao.
5. Usuario escolhe tipo de ocorrencia.
6. Usuario escolhe tipo de vitima.
7. O app cria a ocorrencia no Supabase.
8. Usuario acompanha historico/status.
9. Usuario recebe tutorial de APH enquanto aguarda atendimento.

## Fluxo do socorrista

1. Usuario faz cadastro como socorrista.
2. Informa matricula.
3. Seleciona uma viatura/guarnicao ativa.
4. Login com matricula e senha.
5. O app busca ocorrencias empenhadas para a viatura do socorrista.
6. Socorrista abre detalhe da ocorrencia.
7. Visualiza local, rota, tipo de ocorrencia, vitima e sinais vitais.
8. Avanca status do atendimento.
9. Registra relato.
10. Finaliza ocorrencia.

## Fluxo CIODES

1. Operador abre dashboard.
2. Visualiza fila de despacho.
3. Assume ocorrencia.
4. Escolhe viatura disponivel.
5. Empenha viatura.
6. Acompanha ocorrencias em andamento.
7. Gerencia disponibilidade das viaturas.
8. Cadastra viaturas.
9. Vincula socorristas a viaturas.
10. Consulta historico da ocorrencia.

## Status de ocorrencia

Status usados hoje:

- `registrada`
- `recebida_ciodes`
- `guarnicao_empenhada`
- `em_deslocamento`
- `em_atendimento`
- `finalizada`
- `cancelada`

## Status operacional de viatura

Status usados em `guarnicoes.status_operacional`:

- `disponivel`
- `indisponivel`
- `manutencao`

Quando uma viatura disponivel esta empenhada em uma ocorrencia ativa, a dashboard mostra essa viatura como `Empenhada` de forma calculada.

## Tempo real

A dashboard usa Supabase Realtime para ouvir alteracoes em:

- `ocorrencias`
- `ocorrencia_empenhos`
- `guarnicoes`

Quando uma dessas tabelas muda, a dashboard recarrega os dados. Se o realtime falhar, o botao `Recarregar` faz a busca manual.

## Problemas comuns

### Expo Go diz que o projeto e incompativel

O projeto esta em Expo SDK 54. Garanta que o Expo Go esteja atualizado.

Se necessario, rode:

```powershell
npx expo start --lan --port 8085 --clear
```

### `npx tsc` tenta instalar `tsc@2.0.4`

Use:

```powershell
npx --no-install tsc --noEmit
```

### Dashboard fica carregando

Abra o console do navegador com `F12` e veja erros vermelhos.

Tente tambem:

```text
Ctrl + F5
```

E confirme que o servidor esta rodando:

```powershell
python -m http.server 8000
```

### `Email not confirmed`

O Supabase Auth esta exigindo confirmacao de email.

Para desenvolvimento, desative em:

```text
Supabase Dashboard -> Authentication -> Providers -> Email -> Confirm email/sign up
```

### `Signups not allowed for this instance`

O cadastro publico esta bloqueado no Supabase Auth.

Ative em:

```text
Supabase Dashboard -> Authentication -> Providers -> Email -> Allow sign ups
```

### `Invalid login credentials`

Possiveis causas:

- senha incorreta;
- usuario existe em `usuarios`, mas nao existe em `auth.users`;
- email ainda nao confirmado;
- cadastro antigo nao vinculado a `auth_user_id`.

## Seguranca atual

O projeto ja usa Supabase Auth para login real com senha hash gerenciada pelo Supabase.

Porem, ainda falta uma etapa importante antes de producao: ativar RLS nas tabelas publicas e criar policies por papel.

Papeis atuais esperados:

- `solicitante`
- `socorrista`
- `ciodes`
- `admin`

Sem RLS, a publishable key consegue acessar tabelas publicas conforme permissoes abertas do PostgREST. Para prototipo e desenvolvimento isso facilita testes, mas nao deve ser considerado seguro para producao.

## Melhorias futuras

Prioridade alta:

- Implementar login CIODES com Supabase Auth.
- Ativar RLS e policies por papel.
- Separar CIODES em app autenticado, em vez de HTML estatico publico.
- Criar tela de detalhe completa da ocorrencia no CIODES.
- Adicionar observacoes do operador CIODES.
- Proteger alteracoes de status e empenho.

Prioridade media:

- Melhorar controle de disponibilidade de viaturas.
- Criar auditoria de todas as acoes do CIODES.
- Exibir mapa no painel, nao apenas link.
- Adicionar busca avancada por periodo, status e viatura.
- Gerar formulario final da ocorrencia.
- Exportar PDF/CSV.

Prioridade para o Arduino/sensores:

- Criar endpoint seguro para receber leituras.
- Vincular dispositivo a ocorrencia.
- Exibir graficos de FC, SpO2 e temperatura.
- Criar alertas automaticos com base em parametros clinicos.
- Registrar instrucoes geradas para cada alerta.

Prioridade para UX:

- Adicionar loading states mais claros.
- Melhorar estados vazios.
- Melhorar acessibilidade visual.
- Substituir textos ASCII por acentuacao padronizada depois de garantir UTF-8 em todos os ambientes.
- Adicionar suporte a Lottie JSON nos tutoriais do solicitante.

## Observacao para GitHub

Antes de subir o projeto:

1. Verifique se nao ha senha real do banco em `.env`.
2. Verifique se nao ha service role key no codigo.
3. Considere remover logs locais, como `expo.log`, `expo.err`, `dashboard-server.log`.
4. Considere adicionar `.gitignore` para `node_modules`, `.expo`, logs e arquivos `.env` sensiveis.

A publishable key do Supabase pode ficar no frontend, mas a seguranca deve vir de RLS/policies.

## Colaboracao no GitHub

Repositorio remoto:

```text
https://github.com/jedaiaspantoja/-PROJETI-app-and-CIODES-dashboard.git
```

### Precisa mandar invite?

Depende da visibilidade do repositorio:

- Repositorio privado: sim, voce precisa convidar cada membro.
- Repositorio publico: eles conseguem clonar sem convite, mas precisam de permissao para enviar branches diretamente para o repositorio.

Para convidar membros no GitHub:

```text
Repositorio -> Settings -> Collaborators -> Add people
```

Depois digite o usuario ou email da pessoa e envie o convite.

### Como clonar o projeto

Cada integrante deve rodar:

```powershell
git clone https://github.com/jedaiaspantoja/-PROJETI-app-and-CIODES-dashboard.git
cd -PROJETI-app-and-CIODES-dashboard
npm install
```

Depois criar o arquivo `.env` local:

```powershell
copy .env.example .env
```

O arquivo `.env` real nao deve ser enviado ao GitHub.

### Como criar uma branch para trabalhar

Cada melhoria deve ser feita em uma branch separada:

```powershell
git checkout -b nome-da-branch
```

Exemplos:

```powershell
git checkout -b melhoria-dashboard-ciodes
git checkout -b cadastro-socorrista
git checkout -b sensores-arduino
```

### Como salvar alteracoes

Depois de alterar arquivos:

```powershell
git status
git add .
git commit -m "Descreve a alteracao feita"
```

### Como enviar a branch para o GitHub

```powershell
git push -u origin nome-da-branch
```

Exemplo:

```powershell
git push -u origin melhoria-dashboard-ciodes
```

Depois, no GitHub, abra um Pull Request da branch para `main`.

### Como atualizar a branch local

Antes de comecar a mexer, sempre atualizar a `main`:

```powershell
git checkout main
git pull origin main
```

Depois criar uma branch nova a partir da `main` atualizada.

### Regra recomendada para o grupo

- Nao trabalhar direto na `main`.
- Cada pessoa cria uma branch por tarefa.
- Antes de mexer, roda `git pull origin main`.
- Antes de enviar, roda `npx --no-install tsc --noEmit`.
- Mudancas maiores devem ir por Pull Request.
- Nao subir `.env`, senha do banco, service role key, logs ou `node_modules`.
