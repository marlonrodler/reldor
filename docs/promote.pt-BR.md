<p align="center"><a href="./promote.md">English</a> · <strong>Português</strong></p>

# promote

## O que faz

O `promote <ambiente>` é um **ensaio**: mostra o que acontece se a sua branch for juntada na branch daquele ambiente, antes de você criar a branch de merge e a pull request. Nada muda no seu repositório.

| Checagem | O que mostra |
|---|---|
| Commits que vão junto | Exatamente o que o merge leva para o ambiente |
| Ordem | Commits que ainda não passaram pelo ambiente anterior. A esteira bloqueia esses |
| Commits de outras pessoas | Commits de outra pessoa que iriam junto, normalmente porque a develop foi juntada (merge ou pull) na sua branch |
| Conflitos | Cada arquivo em conflito. Profiles, permission sets, labels e parecidos são testados item a item: a maioria não é conflito de verdade |
| Dependências faltando | Campos, objetos e classes que as suas mudanças usam e que não vão existir no ambiente depois do merge, e onde eles existem ("só na develop") |

No fim, mostra o próximo passo no fluxo do time: criar a branch de merge a partir do ambiente, fazer `git merge` da sua branch e abrir a PR.

Sem o nome do ambiente, ele escolhe o primeiro ambiente aonde a sua branch ainda não chegou. Os ambientes e a ordem vêm do `.reldor/reldor.config.yaml`.

## Merge inteligente

O `reldor merge install` liga, neste repositório e só na sua máquina, um driver de merge do Git para profiles, permission sets, muting permission sets, labels, traduções, sharing rules, value sets e `package.xml`. Ele roda dentro do `git merge` normal (inclusive pelo VS Code):

- itens mudados por um lado só são juntados;
- só existe conflito de verdade quando os dois lados mudaram **o mesmo item** de jeitos diferentes, e só esse item recebe as marcações de conflito;
- o resultado sai ordenado, como o Salesforce faz no retrieve.

Ele também liga o `git rerere`: o Git lembra como você resolveu um conflito e repete a resolução no próximo ambiente. Isso ajuda porque o conflito é resolvido na branch de merge de cada ambiente, então o mesmo conflito volta na UAT e na master.

Nada vai para o repositório compartilhado: as configurações ficam em `.git/info/attributes` e `.git/config`. O `reldor merge uninstall` remove tudo.

## Quando usar

Diga "quero subir para UAT". A IA roda o ensaio, explica cada problema e oferece o próximo passo.

## Está funcionando se

- A esteira para de falhar por ordem de commit ou por campo que só existe na develop.
- Conflito de profile para de tomar tempo.

## Perguntas comuns

**Precisa de Git recente?**
Com Git 2.38 ou mais novo, ele simula o merge em memória. Git mais antigo também funciona, usando uma worktree temporária fora da sua pasta.

**Aparece "commits de outras pessoas", mas trabalhamos em par.**
Então está tudo certo. A checagem compara o autor do commit com o seu `user.email`.

**Devo resolver o conflito na minha branch antes?**
Não. Conflito se resolve na branch de merge, como sempre: resolver na sua branch de desenvolvimento puxaria o trabalho de outras pessoas. O ensaio só avisa antes, para não ser surpresa.

**Substitui a esteira?**
Não. Ele faz o mesmo tipo de checagem antes, na sua máquina, para a esteira não falhar.

## Onde se encaixa

Depois do [commit](./commit.pt-BR.md) e do [test-radar](./test-radar.pt-BR.md), antes da pull request. Usa as mesmas regras de item do [organizador de XML](./xml.pt-BR.md).
