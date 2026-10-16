<p align="center"><a href="./quality.md">English</a> · <strong>Português</strong></p>

# quality

## O que faz

O `quality` revisa as classes Apex que a sua feature mudou e aponta **a repetição que a sua mudança cria**, junto com as regras de qualidade do **Salesforce Code Analyzer** oficial, quando ele está instalado (`sf plugins install code-analyzer`).

| Apontamento | O que significa |
|---|---|
| Bloco copiado | Linhas que você adicionou são iguais a linhas de outro lugar do projeto (textos e números ignorados, como o CPD do PMD) |
| Query repetida | A mesma SOQL já existe em outra classe (binds, textos e espaços ignorados) |
| Query fora do Selector | Num projeto fflib, query de um objeto que tem Selector, escrita fora dele |
| Método que já existe | Mesmo nome, mesmos parâmetros e corpo parecido em outra classe |
| Método parecido | Nome diferente, mas 80% ou mais do corpo é igual |
| Texto repetido | A mesma mensagem em três ou mais classes: candidata a Custom Label |
| Code Analyzer | Regras `Recommended` do PMD (complexidade, nomes, boas práticas, desempenho) e o CPD |

Só entra o que **a sua mudança** toca. Repetição antiga em arquivos que você não mexeu, ou em partes do arquivo que você não editou, fica de fora, para a lista caber numa pull request. O `--all` revisa o projeto inteiro como se fosse novo, para uma limpeza pontual.

Classes que seguem o mesmo contrato ficam de fora de "método que já existe": dois Selectors com `selectById`, duas classes que implementam a mesma interface. Isso é o padrão, não cópia.

## Quando usar

A IA roda antes de commitar Apex, junto com o [security](./security.pt-BR.md). Diga "repeti algum código?" ou rode `reldor quality`. Use `--no-analyzer` para pular o Code Analyzer (mais rápido) e `--fail-on média` para devolver erro em scripts.

## Está funcionando se

- Uma classe nova reaproveita o Service ou o Selector que já existe em vez de copiar.
- As mensagens viram Custom Labels antes de se espalhar.

## Perguntas comuns

**Substitui o PMD?**
Não, ele roda o PMD. As checagens do próprio Reldor acham o que o PMD não acha: uma query que já mora num Selector, um método que já existe com o mesmo nome.

**Dá para ajustar os tamanhos?**
Sim, em `.reldor/reldor.config.yaml`, na seção `quality`: `min_tokens` (padrão 60), `min_lines` (6), `min_literal_files` (3).

## Onde se encaixa

Antes do [commit](./commit.pt-BR.md), junto com [security](./security.pt-BR.md) e [test-radar](./test-radar.pt-BR.md). Usa o mesmo índice do [explain](./explain.pt-BR.md) para saber quais classes são Selectors.
