# teaH

## Sobre o projeto

O teaH é uma plataforma de apoio à comunicação escolar que gera sugestões de resposta para chamados enviados por alunos ou responsáveis. A aplicação é usada pelo professor como ferramenta de assistência: o texto recebido é analisado por uma IA, que produz um rascunho de resposta para revisão humana antes de qualquer envio.

O sistema também pode ser utilizado pelo professor em nome de um aluno que não consiga ou não queira acessar a plataforma. Nenhuma resposta é enviada automaticamente.

## Objetivo

Auxiliar professores em atendimentos relacionados a dúvidas operacionais, regras acadêmicas, avaliações, desempenho individual, materiais didáticos e adaptações escolares. O professor deve ler o rascunho, conferir os contextos utilizados e decidir entre aceitar, editar, rejeitar ou gerar uma nova sugestão.

## Como a aplicação deve funcionar

1. O aluno cria uma conta, escolhe obrigatoriamente um professor na lista e envia o chamado com imagem ou documento opcional.
2. O sistema valida o texto e protege dados sensíveis.
3. A IA gera uma resposta curta, cordial e baseada no contexto informado.
4. O rascunho é apresentado ao professor para revisão.
5. O professor aceita ou edita ou rejeita (manda gerar novamente) o rascunho.
6. A resposta final pode ser copiada e enviada pelo canal original.

Atualmente, o backend oferece sugestão de resposta por texto e anexos, integração com Ollama, autenticação de professores pelo Firebase e persistência de mensagens, sugestões e revisões no PostgreSQL. O RAG e a persistência de documentos continuam planejados.

## Funcionalidades previstas

### Geração de respostas

- Sugestões em português do Brasil.
- Suporte a texto, imagens PNG, JPEG e WebP e documentos TXT ou PDF.
- Proteção de dados sensíveis.
- Solicitação de informações adicionais quando o chamado estiver incompleto.
- Bloqueio de decisões, promessas, prazos, aprovações e credenciais.
- Revisão humana obrigatória antes do envio.

### Uso de contexto por RAG

A versão futura pode consultar uma base de conhecimento própria do professor por meio de RAG:

- **Regras e prazos:** planos de ensino, ementas, cronogramas, editais e regimento escolar.
- **Avaliações:** rubricas, espelhos de prova, gabaritos comentados e orientações de atividades.
- **Acompanhamento do aluno:** diário de classe, frequência, entregas e observações pedagógicas.
- **Material didático:** apostilas, slides, exercícios, bibliografia e planos de aula.
- **Inclusão:** diretrizes institucionais, Plano Educacional Individualizado e orientações da coordenação.

Essa abordagem permitirá ancorar as respostas em fontes verificáveis e reduzir respostas baseadas em informações não fornecidas pelo contexto.

## Tipos de chamados atendidos

- Questionamento sobre nota de atividade.
- Questionamento sobre data de avaliação.
- Marcar horário para tirar dúvidas.
- Dificuldade de saber onde enviar atividades.
- Denúncia de bullying.
- Dificuldade para acessar o sistema.
- Pedir alteração de nota e falta.

## Casos de uso principais

### Obter sugestão de resposta

O aluno pode se cadastrar e entrar no sistema. Após consultar os professores ativos, envia o chamado autenticado e informa obrigatoriamente o ID do professor selecionado. O sistema valida esse ID contra o Firebase, associa o aluno remetente e o professor responsável, protege dados sensíveis e solicita à IA um rascunho estruturado imediatamente. O rascunho fica visível apenas ao professor autenticado responsável, que pode então revisá-lo.

O resultado contém o texto sugerido e uma lista curta de informações adicionais, quando necessário. O rascunho não é utilizado se a saída estiver fora do formato esperado, fizer afirmações não autorizadas ou não tiver base suficiente.

### Revisar uma sugestão

O professor autenticado pode:

- aceitar a sugestão;
- editar o texto antes de confirmá-lo;
- rejeitar o rascunho e indicar um motivo;
- solicitar uma nova sugestão.

A sugestão original deve permanecer registrada, permitindo distinguir respostas aprovadas das editadas.

O professor autenticado consulta os chamados recebidos em `GET
/chamados/pendentes`, incluindo nome e série informados no perfil do aluno.
Para solicitar outra sugestão, envia o `mensagemId` à rota autenticada de
geração. Rejeitar mantém o atendimento aberto; aceitar, editar ou registrar uma
resposta manual marca-o como respondido. Depois de respondido, novas gerações
e revisões desse atendimento são recusadas.

### Registrar uma resposta enviada

Após enviar o texto por WhatsApp, e-mail, SIGAA ou outro canal externo, o professor pode marcar o atendimento como respondido no sistema. Também pode registrar uma resposta manual, sem utilizar o rascunho.

## Arquitetura planejada

| Recurso             | Responsabilidade                                               |
| ------------------- | -------------------------------------------------------------- |
| `usuarios`          | Professores e alunos com papéis e permissões diferentes        |
| `documentos`        | Base de conhecimento de cada professor                         |
| `trechos_documento` | Pedaços de documentos e embeddings para recuperação via RAG    |
| `mensagens`         | Chamados recebidos, conteúdo mascarado e estado do atendimento |
| `sugestoes`         | Rascunhos gerados pela IA e modelo utilizado                   |
| `sugestao_fontes`   | Relação entre o rascunho e os trechos utilizados               |
| `revisoes`          | Decisão humana, texto final e justificativa                    |

O backend persiste mensagens, sugestões e revisões no PostgreSQL. Em `mensagens`,
`usuario_id` identifica o remetente e `professor_id` o docente responsável. O ID
público selecionado pelo aluno é um Firebase UID; o servidor valida que pertence
a um professor ativo e o associa ao ID interno do usuário no banco. Consultas,
novas sugestões e revisões verificam esse vínculo, de modo que outro professor
não pode acessar o chamado. O Firebase Auth continua responsável pelas
credenciais e pelos tokens. O armazenamento de documentos e o RAG ainda não
estão implementados.

## Tecnologias

- NestJS e TypeScript
- Node.js
- Ollama
- Docker e Docker Compose
- Jest para testes
- PDF e TXT como documentos de contexto
- Imagens PNG, JPEG e WebP

## Estrutura do projeto

```text
teah/
├── backend/
│   ├── src/
│   │   ├── chamados/
│   │   ├── ia/
│   │   └── app.module.ts
│   ├── docs/
│   ├── materias-de-apoio/
│   └── test/
└── docker-compose.yml
```

## Executar o projeto

É necessário ter Docker e Docker Compose instalados.

```bash
docker compose up -d ollama backend
```

O Compose também inicia o PostgreSQL com pgvector. Antes de iniciar o backend,
ele aplica automaticamente as migrations numeradas em `backend/migrations`.
Crie o `.env` da raiz a partir de `.env.example` e defina uma senha para
`POSTGRES_PASSWORD`. Para aplicar as migrations sem iniciar o restante da
aplicação:

```bash
docker compose up -d db
docker compose run --rm --no-deps backend sh -c "npm ci && npm run migration:run"
```

Na primeira inicialização, o modelo configurado no backend precisa estar disponível no Ollama:

```bash
docker exec -it ollama ollama pull llama3.2:3b
```

O backend ficará disponível em `http://localhost:3001`, usando a porta do container publicada pelo Docker Compose. O Ollama ficará disponível na porta `11435` do computador.

### Execução local sem Docker

Na pasta `backend`, instale as dependências e execute o projeto:

```bash
npm ci
npm run start:dev
```

O backend usa por padrão a URL `http://ollama:11434`, definida pelo Docker Compose. Ao executar fora do container, configure `OLLAMA_BASE_URL`, `OLLAMA_MODEL` e, opcionalmente, `OLLAMA_TIMEOUT_MS`. Configure também `DATABASE_URL` para um PostgreSQL ativo com as migrations aplicadas.

## Principais endpoints

| Método | Endpoint                         | Descrição                                            |
| ------ | -------------------------------- | ---------------------------------------------------- |
| `GET`  | `/professores`                   | Lista professores ativos para seleção                |
| `POST` | `/chamados/enviar`               | Envia chamado autenticado para professor selecionado |
| `POST` | `/auth/register`                 | Cadastra um aluno no Firebase Auth                   |
| `POST` | `/auth/login`                    | Autentica e retorna os tokens do Firebase            |
| `POST` | `/auth/logout`                   | Revoga os tokens de atualização da sessão            |
| `POST` | `/auth/admin/promover-professor` | Promove um aluno a professor (administrador)         |
| `GET`  | `/chamados/pendentes`            | Lista chamados abertos do professor autenticado      |
| `POST` | `/chamados/sugerir-resposta`     | Gera um rascunho a partir de texto ou arquivo        |
| `POST` | `/chamados/revisar-sugestao`     | Registra a decisão do professor sobre um rascunho    |

### Cadastro e autenticação

O cadastro público único recebe `displayName` (nome), `email` e `password`.
`serie` é opcional. Toda conta nova começa com o papel `ALUNO`; o cliente não
pode escolher o próprio papel:

```json
{
  "displayName": "Nome do aluno",
  "email": "aluno@exemplo.edu",
  "password": "senha-com-no-minimo-6-caracteres",
  "serie": "7º ano"
}
```

O backend atribui `papel=ALUNO` e, quando informado, a série como custom claims
do Firebase. Use `POST /auth/login` para obter o ID token. Para logout, envie
`Authorization: Bearer <idToken>` para `POST /auth/logout`.

Configure `FIREBASE_API_KEY` e `FIREBASE_SERVICE_ACCOUNT_PATH` no ambiente do
backend. A conta de serviço precisa das permissões necessárias para criar
usuários, definir custom claims, consultar contas e revogar tokens no Firebase
Auth. Configure também `DATABASE_URL` para conectar ao PostgreSQL; o Docker
Compose define essa variável para o backend.

### Administrador e promoção de professor

O administrador é configurado fora do cadastro público pelo UID Firebase em
`ADMIN_UIDS` (permite vários UIDs separados por vírgula). Para iniciar, cadastre
a conta normalmente como aluno, copie o `uid` retornado e configure-o em
`ADMIN_UIDS`; reinicie o backend. A conta autorizada pode promover usuários por
`POST /auth/admin/promover-professor`:

```http
Authorization: Bearer <idTokenDoAdministrador>
```

```json
{
  "uid": "firebase-uid-da-conta-a-promover"
}
```

Após a promoção, o usuário deve entrar novamente para receber um ID token com
`papel=PROFESSOR`. A lista `GET /professores` passa a incluí-lo.

Depois do cadastro, o aluno usa `/auth/login` para obter o ID token. O papel
`ALUNO` e a série são custom claims definidos pelo backend e verificados nas
rotas de envio. O aluno autenticado carrega `GET /professores`, que lista nome e
`id` (Firebase UID), e envia o ID selecionado:

```json
{
  "professorId": "firebase-uid-retornado-pela-lista",
  "texto": "Não consigo acessar o portal da escola."
}
```

`POST /chamados/enviar` exige `Authorization: Bearer <idTokenDoAluno>`, gera a
sugestão de IA imediatamente e retorna `mensagemId`, `sugestaoId` e
`status: "AGUARDANDO_REVISAO"`; não retorna o rascunho ao remetente. O professor
selecionado consulta o texto e o rascunho em `GET /chamados/pendentes` com seu
ID token. Para anexos, envie `professorId`, `texto` opcional e `arquivo` como
`multipart/form-data`. O servidor confere no Firebase que o ID é de um professor
ativo; não confie apenas na lista exibida no navegador.
O campo `serie` é opcional; se omitido, o professor verá o chamado sem essa
informação.

As rotas de chamados pendentes e de revisão exigem
`Authorization: Bearer <idTokenDoProfessor>`. O token é validado pelo Firebase
Admin, incluindo revogação, e o custom claim `papel=PROFESSOR` é obrigatório. A
revisão confere que o chamado pertence ao professor autenticado.

O cadastro de aluno é um fluxo demonstrativo: nome e série são autodeclarados,
e autenticar uma conta Firebase não comprova a identidade escolar. Não use esses
dados para revelar notas ou outras informações privadas. Em produção, valide a
identidade e o vínculo escolar por integração com o sistema acadêmico, como
SUAP, ou por outro processo institucional confiável.

O corpo de revisão usa estes campos:

```json
{
  "mensagemId": "51",
  "sugestaoId": "72",
  "decisao": "editada",
  "textoFinal": "Resposta revisada pelo professor."
}
```

Para registrar uma resposta manual, use `decisao: "manual"` e `textoFinal`;
`sugestaoId` é opcional. Para rejeitar, informe `decisao: "rejeitada"` e uma
`justificativa`. Um aceite armazena como texto final a sugestão original.

## Testes

Dentro da pasta `backend`:

```bash
npm run test:backend
npm run test:e2e
npm run lint
```
