# teaH

## Sobre o projeto

O teaH é uma plataforma de apoio à comunicação escolar que gera sugestões de resposta para chamados enviados por alunos ou responsáveis. A aplicação é usada pelo professor como ferramenta de assistência: o texto recebido é analisado por uma IA, que produz um rascunho de resposta para revisão humana antes de qualquer envio.

O sistema também pode ser utilizado pelo professor em nome de um aluno que não consiga ou não queira acessar a plataforma. Nenhuma resposta é enviada automaticamente.

## Objetivo

Auxiliar professores em atendimentos relacionados a dúvidas operacionais, regras acadêmicas, avaliações, desempenho individual, materiais didáticos e adaptações escolares. O professor deve ler o rascunho, conferir os contextos utilizados e decidir entre aceitar, editar, rejeitar ou gerar uma nova sugestão.

## Como a aplicação deve funcionar

1. O professor ou aluno/responsável informa o chamado, e qual o remetente (informa o nome, e a série em que estuda), além de anexar opcionalmente uma imagem ou documento.
2. O sistema valida o texto e protege dados sensíveis.
3. A IA gera uma resposta curta, cordial e baseada no contexto informado.
4. O rascunho é apresentado ao professor para revisão.
5. O professor aceita ou edita ou rejeita (manda gerar novamente) o rascunho.
6. A resposta final pode ser copiada e enviada pelo canal original.

Atualmente, o backend já oferece sugestão de resposta por texto e anexos e integração com Ollama. A autenticação deve ser feita pelo Firebase Auth; o banco guarda o UID do Firebase associado ao perfil, sem armazenar senha. A autenticação e as demais funcionalidades ainda não estão conectadas ao backend ou ao banco.

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

O professor autentificado cola a mensagem recebida, informa o remetente e, opcionalmente, e um documento. O sistema valida o conteúdo, protege dados sensíveis, recupera contextos relevantes e solicita à IA um rascunho estruturado.

O resultado contém o texto sugerido e uma lista curta de informações adicionais, quando necessário. O rascunho não é utilizado se a saída estiver fora do formato esperado, fizer afirmações não autorizadas ou não tiver base suficiente.

### Revisar uma sugestão

O professor pode:

- aceitar a sugestão;
- editar o texto antes de confirmá-lo;
- rejeitar o rascunho e indicar um motivo;
- solicitar uma nova sugestão.

A sugestão original deve permanecer registrada, permitindo distinguir respostas aprovadas das editadas.

### Registrar uma resposta enviada

Após enviar o texto por WhatsApp, e-mail, SIGAA ou outro canal externo, o professor pode marcar o atendimento como respondido no sistema. Também pode registrar uma resposta manual, sem utilizar o rascunho.

## Estrutura do banco de dados

| Recurso | Responsabilidade |
| --- | --- |
| `usuarios` | Professores e alunos, com papel, nome, e-mail e UID do Firebase Auth |
| `documentos` | Conteúdo da base de conhecimento de cada usuário |
| `trechos_documento` | Pedaços de documentos e embeddings vetoriais para recuperação via RAG |
| `mensagens` | Chamados recebidos, conteúdo mascarado e estado do atendimento |
| `modelos_ia` | Nome e versão dos modelos usados para gerar respostas |
| `sugestoes` | Rascunhos gerados pela IA, modelo utilizado e métricas da geração |
| `sugestao_fontes` | Relação entre o rascunho e os trechos utilizados |
| `revisoes` | Decisão humana, texto final e justificativa, inclusive respostas manuais |

O esquema é criado pelo comando `npm run migration:run`, executado automaticamente na inicialização do serviço `backend` pelo Docker Compose. O banco usa PostgreSQL com pgvector. As migrações podem ser executadas manualmente na pasta `backend` após configurar `DATABASE_URL`.

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

O backend usa por padrão a URL `http://ollama:11434`, definida pelo Docker Compose. Ao executar fora do container, configure `OLLAMA_BASE_URL`, `OLLAMA_MODEL` e, opcionalmente, `OLLAMA_TIMEOUT_MS`.

## Principais endpoints

| Método | Endpoint | Descrição |
| --- | --- | --- |
| `POST` | `/chamados/sugerir-resposta` | Gera um rascunho a partir de texto ou arquivo |

## Testes

Dentro da pasta `backend`:

```bash
npm run test:backend
npm run test:e2e
npm run lint
```
