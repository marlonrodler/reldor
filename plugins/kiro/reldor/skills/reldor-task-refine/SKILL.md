---
name: reldor-task-refine
description: Refina uma task ou revisa uma spec Salesforce antes do desenvolvimento, com o impacto real à vista e o que já existe para reusar. Use quando alguém quiser criar, escrever, refinar, revisar ou estimar uma task, história, card ou spec, ou perguntar o que uma mudança envolveria.
---

# Conselheiro: refinador de task e spec

**Idioma e estilo:** responda no idioma da conversa (ou no `language` do `.reldor/reldor.config.yaml`). Didático e curto:
resumo primeiro, detalhes depois.

Objetivo: a task sai **no padrão**, sabendo o que toca, o que já existe e o que falta liberar. **Sem bate-volta:** você
escreve tudo de uma vez e a pessoa aprova no fim. Pergunte só na dúvida real (dois candidatos quase iguais, um valor
que não existe mas tem um parecido).

## Etapa 1. O que chegou
- Rode `reldor task --json`. Ele diz a tarefa atual (pela branch ou dita no chat), a spec dela em qualquer ferramenta
  (Kiro, Spec Kit, OpenSpec, outra pasta) e para onde a pessoa quer a task refinada (`task.output`).
- Se houver mais de uma spec da tarefa, pergunte qual vale. Se não houver nenhuma, use o card que a pessoa colou.
- Se a pessoa nunca escolheu a saída, pergunte uma vez: "a task refinada vai para a spec, para um .md na documentação,
  ou os dois?" e grave com `reldor task output <spec|md|ambos>`. Se for .md e `docsDir` estiver vazio, mostre as pastas
  de `docFolders` e pergunte qual é a documentação do time; grave com `reldor task set --docs-dir "<pasta>"`
  (`{time}` vira a subpasta do time da pessoa, de `reldor me`).

## Etapa 2. Deixar no padrão (só se ainda não estiver)
- Salve o texto (card ou spec) num arquivo com a sua ferramenta de arquivos, nunca pelo terminal:
  `<pasta da tarefa>/task.md` (a pasta vem em `task.folder`).
- Se o texto já tem o bloco `alvos:` e as seções do modelo, não reescreva: vá para a etapa 3.
- Se não tem, reescreva no modelo abaixo: objetivo, onde, o que muda (item a item, com o tipo),
  fora do escopo, critérios de aceite, dúvidas, e no topo o bloco `alvos` (objetos, campos, valores, `criar` para o que
  a task pede para criar, record types, perfis). Use os nomes como a task escreve; o Reldor acha o nome de API.
  Guarde o original: a versão no padrão vai no mesmo arquivo, o original logo abaixo, numa seção "Texto original".

## Etapa 3. Buscar (o script faz)
- Rode `reldor refine --file <pasta da tarefa>/task.md --json`. Com o bloco `alvos`, ele procura **só os alvos**:
  - `targets`: cada nome virou um nome de API (`certo`, `provável`, `dúvida`, `não achei`). Pergunte só as `dúvida`; nos
    `provável`, escreva o nome com "(achado pelo rótulo)" e siga.
  - `values`: para cada valor, rode o `check` (`reldor access ... --value ... --json`, com `--rt` da task) e use `gaps`.
  - `reuse`: para cada item de `criar`, o que já existe. Apresente as opções nesta ordem, sem decidir pela pessoa:
    1. **reusar** como está, com o nome que já tem;
    2. **criar genérico** compartilhado quando o que existe é de outro time ou tem automações de outro time: não mexa
       no deles; deixe pronta uma frase para oferecer o genérico ao outro time;
    3. **criar novo**, só se nada servir, dizendo por quê.
    Nunca sugira renomear o que existe. Lembre que nome parecido não garante o mesmo sentido.
  - `limits`: se aparecer, diga que o objeto está perto do limite e que reusar ajuda.
  - `similar`: se já existe uma regra parecida, talvez a task seja ajustá-la.
- Para um objeto que a task muda, `reldor explain <Objeto> --json` dá a ordem de execução.

## Etapa 4. Escrever a task (ou revisar a spec)
- Complete o arquivo no padrão com **só os fatos** do resultado: em "O que muda", o que criar ou reusar e o que liberar
  (record type, layout, acesso, path, tradução, com o arquivo); em "Impacto", automações, telas, cascata e testes; os
  critérios de aceite em dado/quando/então; os cenários de teste (caminho feliz, bloqueio, registro já existente).
- **Spec que já existe:** não crie outra. Aponte só as lacunas que existem (volume, registros já existentes, critérios
  mensuráveis, perfis e permissões, comportamento em erro, record types e picklists, conflito com automações) e, com o
  "sim", complete a própria spec.
- Mostre a task inteira de uma vez e peça a aprovação. Com o "sim", grave onde a pessoa escolheu (`task.output`):
  - `spec`: na spec da tarefa (ou numa nova no lugar que o projeto usa, ex.: `.kiro/specs/<id>-<nome>/requirements.md`);
  - `md`: em `docsDir`, com o número da tarefa no nome do arquivo;
  - `ambos`: nos dois.

## Sempre
- Se o objeto já tem trigger, a lógica entra no handler dela.
- Se o objeto tem mais de um record type, os critérios dizem para quais valem.
- Se a mudança cria campo, a task cita FLS e quem precisa de acesso.
- Pacotes gerenciados e mudanças feitas direto na org não aparecem no índice.

## Modelo da task
```markdown
---
reldor: task
id: "<número da tarefa>"
alvos:
  objetos: [Opportunity]
  campos: ["Status da aprovação"]
  valores:
    - campo: "Status da aprovação"
      valor: "Aprovado com ressalva"
  criar:
    - tipo: campo
      nome: "Data da aprovação"
      objeto: Opportunity
      tipo_campo: Date
      sentido: "quando a oportunidade foi aprovada"
  record_types: []
  perfis: []
---

# <título curto>

## Objetivo
<uma frase: o que muda e para quem>

## Onde
<objeto, record type, tela, time>

## O que muda
- <um item por linha, com o tipo: campo novo, valor de picklist, regra, tela, integração, acesso>

## Fora do escopo
- <o que não entra>

## Critérios de aceite
- Dado <situação>, quando <ação>, então <resultado>.

## Dúvidas
1. <só o que ainda não se sabe>
```
