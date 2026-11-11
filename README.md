## O que se trata a nossa aplicação
Nossa aplicação é ‘sugestão de respostas para chamados’. Ou seja, o sistema, ao receber o chamado, interpreta e traz uma sugestão de resposta de acordo com o contexto. Apesar de tudo, é preciso de uma revisão humana para dar o “aval”.

## Expansão
Pensamos em levar para o meio acadêmico, mais propriamente para os professores. Professores abrem chamados de falta (aquisição) de materiais, sujeira na sala de aula, acidente, aparelho danificado, informativo de falta, etc.
Portanto, iremos desenvolver uma plataforma no qual o professor faz a chamada, a IA traz uma sugestão, e algum funcionário revisa para então voltar ao professor.

## Multimodal
O professor pode anexar uma imagem, ou uma fotografia para exemplificar ainda mais o problema.

## Treinamento do modelo
O treinamento usa `Qwen/Qwen2.5-0.5B-Instruct` por padrão, uma opção menor adequada para treinamento em CPU e que não exige token do Hugging Face:

```bash
docker compose --profile training run --rm trainer python train.py
```

Para escolher um modelo restrito, configure `BASE_MODEL` e forneça um `HF_TOKEN` autorizado. Não compartilhe nem versione o token:

```bash
BASE_MODEL=meta-llama/Llama-3.2-1B-Instruct HF_TOKEN="seu-token" \
  docker compose --profile training run --rm trainer python train.py
```

## Delimitação de chamados
- Problema de saúde em sala, pessoal ou de aluno.
- Má conduta, desrespeito de aluno.
- Problema na estrutura, de qualquer seja a parte da escola.
- Necessidade de equipamento, como caneta, tinta, folha, etc.
- Falha em algum equipamento, como computador, ar condicionado, projetor, etc.
- Dificuldades ao navegar no sistema (sigeduc, suap, sigaa, etc).
- Informar falta.
