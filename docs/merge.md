<p align="center"><strong>Português</strong> · <a href="./merge.en.md">English</a></p>

# merge

## O que faz

O `reldor merge <sua-branch>` ajuda no merge da sua branch de desenvolvimento na **branch de merge** (a cópia da branch do ambiente de onde você vai abrir a PR) e resolve os conflitos com uma regra: **mantém o que já existe no destino e aplica só a sua mudança**.

**O Reldor não roda o merge nem commita.** Com a execução desligada (o padrão), ele confere antes (a branch existe, a pasta está limpa, você está na branch de merge) e mostra os comandos na ordem:

```bash
git merge --no-ff --no-commit <sua-branch>   # você roda: o commit de merge fica para ser revisado
reldor merge --resolve                       # o Reldor resolve os conflitos nos arquivos (pede confirmação)
reldor merge --check                         # confere se entrou só o seu
reldor merge --continue                      # mostra o commit de merge para você rodar
```

Resolver um conflito é mudar um arquivo, então o `--resolve` faz isso depois de pedir confirmação, e mostra o `git add` dos arquivos resolvidos para você rodar. Com `execute: on`, o `reldor merge <branch>` roda o merge e o stage por você, sempre pedindo confirmação.

1. O `git merge --no-ff --no-commit` deixa o commit de merge para ser revisado.
2. O `--resolve` resolve o que faz o Git parar:
   - mudanças vizinhas (a sua e a de outra pessoa) entram as duas;
   - você adicionou onde o destino também adicionou: fica a do destino e a sua vem depois;
   - você removeu algo: sai do destino;
   - profiles, permission sets, labels, sharing rules e traduções são juntados item a item. Quando o Git "gruda" as tags de dois blocos (por exemplo, o `<field>` de um campo dentro do bloco de outro), o Reldor separa: o bloco do destino fica inteiro e o seu entra inteiro, já ordenado como o Salesforce faz;
   - em qualquer outro XML ou HTML de LWC, ele confere se as tags ficaram válidas. Se juntar linha a linha quebraria as tags, o arquivo fica para revisão em vez de sair quebrado.
3. Deixa para revisão só o que os dois lados mudaram **nas mesmas linhas**, mostrando o que o destino tem e o que a sua branch tem. A IA pode resolver esses com a mesma regra e explicar cada um.
4. Confere **"entrou só o seu?"**: compara, linha a linha, o que mudou na branch de merge com o que a sua branch mudou. Aponta linhas que entraram e não são suas, linhas do destino que sumiram, linhas suas que faltaram, marcações de conflito esquecidas e commits de outras pessoas indo junto.

Nada é commitado pelo Reldor: o `reldor merge --continue` confere de novo e mostra o `git commit --no-edit`. O `reldor merge --check` só confere (também depois do commit). O `reldor merge --abort` mostra o `git merge --abort` para desfazer tudo.

## Quando usar

Na branch de merge, diga "faz o merge da minha branch". Nada de clicar em "accept current / incoming / both".

## Está funcionando se

- Merge que levava tempo resolvendo conflito na mão vira uma revisão rápida.
- A PR tem só a sua mudança.

## Perguntas comuns

**E se a IA resolver um conflito errado?**
A conferência pega: uma linha do destino que sumiu, ou algo que não é seu, aparece antes do commit.

**Precisa ligar a execução?**
Não. Com a execução desligada você roda o `git merge` e o commit, e o Reldor cuida dos conflitos e da conferência. Se preferir, commite pela sua ferramenta depois da conferência.

**E o `reldor merge install`?**
Liga o driver item a item também dentro do `git merge` normal (para merges feitos por outras ferramentas), mais o `rerere`, depois de pedir confirmação (muda só a configuração local do Git). Detalhes no [promote](./promote.md#merge-inteligente).

**O time já tem um merge driver para profiles.**
Grave `profile-merge: skip` no [`tools`](./tools.md): o `reldor merge install` passa a não ligar nada (a não ser com `--force`). O merge assistido (`reldor merge <branch>`) continua disponível.

## Onde se encaixa

Depois do [promote](./promote.md) mostrar que não falta dependência, antes da pull request.
