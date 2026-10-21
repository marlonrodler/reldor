<p align="center"><strong>Português</strong> · <a href="./tools.en.md">English</a></p>

# tools

## O que faz

O `tools` diz **quem cuida de cada coisa** que o Reldor sabe fazer, para ele não repetir o trabalho de uma ferramenta que o time já usa. Cada coisa é uma **capacidade**:

| Capacidade | O que é | Onde o Reldor faz | Modos |
|---|---|---|---|
| `xml-duplicates` | XML sem entradas duplicadas | `xml`, `review`, gancho pre-commit | run, verify, skip |
| `xml-order` | XML em ordem | `xml`, `review` | run, verify, skip |
| `org-files` | Arquivos que só vieram da org fora do commit | `review`, `clean`, gancho pre-commit | run, verify, skip |
| `security` | Regras de segurança do Reldor | `security`, `review` | run, verify, skip |
| `quality` | Código repetido (regras do Reldor) | `quality`, `review` | run, verify, skip |
| `code-analyzer` | Salesforce Code Analyzer (PMD, CPD, segurança) | `security`, `quality`, `review` | run, skip |
| `queries` | Campo lido fora da query | `check`, `test-radar`, `review` | run, verify, skip |
| `affected-tests` | Lista de testes que a mudança pode quebrar | `test-radar`, `review` | run, verify, skip |
| `run-tests` | Rodar os testes na sandbox | `test-radar --run` | run, skip |
| `pre-commit` | Gancho pre-commit do Reldor | `hook install` | run, skip |
| `profile-merge` | Merge de profile item a item | `merge install` | run, skip |

Para cada uma, o projeto escolhe um modo, gravado em `tools:` no `.reldor/reldor.config.yaml`:

- **`run`** (o padrão): o Reldor faz.
- **`verify`**: outra ferramenta faz; o Reldor **não faz de novo**, só confere o resultado. Se não estiver certo, ele avisa qual ferramenta rodar. Exemplo: o time tem um plugin que tira duplicados dos profiles. Com `xml-duplicates: verify`, o `reldor xml` não reescreve o arquivo, mas o `review` e o gancho continuam garantindo que nenhum duplicado chegue ao commit.
- **`skip`**: outra ferramenta cuida; o Reldor fica de fora (não faz nem confere) e diz quem cuida.

Ele também **procura sinais** dessas ferramentas no projeto e sugere: ganchos de Git (`.husky`, `core.hooksPath`, um `pre-commit` que já existia), a esteira (`.github/workflows`, `azure-pipelines.yml` e outras), instruções de IA guardadas no projeto (`.kiro`, `.claude`, `AGENTS.md`) e os scripts do `package.json`. Ele mostra a linha onde achou cada sinal. **Nada é gravado sozinho**: você confere e decide.

**Nada roda duas vezes.** O Reldor guarda o resultado de cada checagem pelo conteúdo dos arquivos que ela lê. Se o gancho, o `review` e a IA pedirem a mesma checagem sobre o mesmo conteúdo, só a primeira roda; as outras reaproveitam (aparece ♻️). Mudou um arquivo, a checagem roda de novo. Para refazer mesmo assim, qualquer comando aceita `--fresh`.

## Quando usar

Logo depois do `init` (ele já mostra os sinais que encontrou), ou quando alguém disser "a gente já tem uma ferramenta que faz isso". A IA roda por você e pergunta antes de gravar. No terminal:

```bash
reldor tools                                                   # a lista e as sugestões
reldor tools set xml-duplicates verify --owner "plugin do time"
reldor tools set code-analyzer skip --owner "esteira"
reldor tools set xml-order run                                 # "não, o Reldor faz": a sugestão não volta
```

Quando você pede um comando pelo nome, ele respeita o modo assim: o que **só lê** (`security`, `quality`, `check`, `test-radar`) roda e avisa quem mais cuida daquilo; o que **muda algo** (`xml` organizando, `clean`, `hook install`, `merge install`, `test-radar --run`) não age numa capacidade de outra ferramenta, a não ser com `--force`.

## Está funcionando se

- O Reldor nunca reescreve um arquivo que a ferramenta do time também reescreve.
- O `review` diz o que ficou de fora e quem cuida, em vez de esconder.
- Rodar o `review` duas vezes sem mudar nada mostra ♻️ e responde na hora.

## Perguntas comuns

**O sinal que ele achou não faz o mesmo trabalho.**
Grave `run` para aquela capacidade (`reldor tools set <capacidade> run`). Isso registra a decisão e a sugestão não volta.

**Onde fica o registro das execuções?**
Em `.reldor/cache/runs.json`, fora do Git. Apagar o arquivo só faz as checagens rodarem de novo.

**E o commit, o merge e a PR?**
O Reldor nunca faz isso: ele só monta os comandos de Git e de org, e quem roda é você ou a sua ferramenta.

## Onde se encaixa

Depois do [`init`](./init.md). O [`status`](./status.md) e o [`doctor`](./doctor.md) avisam quando há sinais ainda não decididos, e o [`review`](./review.md) e o gancho do [`commit`](./commit.md) seguem o que foi decidido.
