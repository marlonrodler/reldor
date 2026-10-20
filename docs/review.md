<p align="center"><strong>Português</strong> · <a href="./review.en.md">English</a></p>

# review

## O que faz

O `review` é tudo que vale conferir antes de um commit, numa rodada só e num resumo só, para os arquivos que a sua branch mudou:

| Parte | O que procura |
|---|---|
| [Segurança](./security.md) | SOQL injection, CRUD/FLS, sharing, dado sensível em log, segredos, XSS, flows, acesso de convidado |
| [Qualidade](./quality.md) | Blocos copiados, queries repetidas, query fora do Selector, método que já existe, PMD |
| [Queries](./check.md) | Campo lido mas que falta na SOQL ou no Selector (erro em produção) |
| [Testes](./test-radar.md) | As classes de teste que a sua mudança pode quebrar |
| [XML](./xml.md) | Profiles, permission sets e labels fora de ordem ou com duplicado em conflito |
| [Arquivos da org](./clean.md) | Mudanças que vieram da org num retrieve e não são suas |

O resumo tem dois grupos: 🔴 **corrija antes do commit** e 🟡 **atenção**, cada item com o arquivo, a linha e como corrigir. Depois, os testes para rodar. O Salesforce Code Analyzer roda uma vez só para segurança e qualidade, quando instalado; o `--no-analyzer` pula.

## Quando usar

Diga "posso commitar?". A IA roda e passa primeiro pelos itens 🔴.

## Está funcionando se

- Você para de rodar quatro checagens na mão, ou de esquecer uma.

## Perguntas comuns

**Os comandos separados continuam existindo?**
Sim (`security`, `quality`, `check`, `test-radar`, `xml`), para quando você quer só uma parte. O `review` é o do dia a dia.

**Outra ferramenta do time já faz parte dessas checagens.**
O `review` segue o [`tools`](./tools.md): uma parte que outra ferramenta faz é só conferida (`verify`) ou fica de fora (`skip`), e o resumo lista as duas com o nome da ferramenta, para nada sumir em silêncio. Com o mesmo conteúdo, nenhuma checagem roda duas vezes: rodar o `review` de novo, ou o gancho logo depois, reaproveita o resultado (♻️). `--fresh` refaz tudo.

## Onde se encaixa

Logo antes do [clean](./clean.md) e do commit.
