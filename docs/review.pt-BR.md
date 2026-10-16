<p align="center"><a href="./review.md">English</a> · <strong>Português</strong></p>

# review

## O que faz

O `review` é tudo que vale conferir antes de um commit, numa rodada só e num resumo só, para os arquivos que a sua branch mudou:

| Parte | O que procura |
|---|---|
| [Segurança](./security.pt-BR.md) | SOQL injection, CRUD/FLS, sharing, dado sensível em log, segredos, XSS, flows, acesso de convidado |
| [Qualidade](./quality.pt-BR.md) | Blocos copiados, queries repetidas, query fora do Selector, método que já existe, PMD |
| [Queries](./check.pt-BR.md) | Campo lido mas que falta na SOQL ou no Selector (erro em produção) |
| [Testes](./test-radar.pt-BR.md) | As classes de teste que a sua mudança pode quebrar |
| [XML](./xml.pt-BR.md) | Profiles, permission sets e labels fora de ordem ou com duplicado em conflito |
| [Arquivos da org](./clean.pt-BR.md) | Mudanças que vieram da org num retrieve e não são suas |

O resumo tem dois grupos: 🔴 **corrija antes do commit** e 🟡 **atenção**, cada item com o arquivo, a linha e como corrigir. Depois, os testes para rodar. O Salesforce Code Analyzer roda uma vez só para segurança e qualidade, quando instalado; o `--no-analyzer` pula.

## Quando usar

Diga "posso commitar?". A IA roda e passa primeiro pelos itens 🔴.

## Está funcionando se

- Você para de rodar quatro checagens na mão, ou de esquecer uma.

## Perguntas comuns

**Os comandos separados continuam existindo?**
Sim (`security`, `quality`, `check`, `test-radar`, `xml`), para quando você quer só uma parte. O `review` é o do dia a dia.

## Onde se encaixa

Logo antes do [clean](./clean.pt-BR.md) e do commit.
