<p align="center"><a href="./merge.md">English</a> · <strong>Português</strong></p>

# merge

## O que faz

O `reldor merge <sua-branch>` faz o `git merge` da sua branch de desenvolvimento na **branch de merge** (a cópia da branch do ambiente de onde você vai abrir a PR) e resolve os conflitos com uma regra: **mantém o que já existe no destino e aplica só a sua mudança**.

1. Roda `git merge --no-ff --no-commit`, para o commit de merge ficar e ser revisado.
2. Resolve sozinho o que faz o Git parar:
   - mudanças vizinhas (a sua e a de outra pessoa) entram as duas;
   - você adicionou onde o destino também adicionou: fica a do destino e a sua vem depois;
   - você removeu algo: sai do destino;
   - profiles, permission sets, labels, sharing rules e traduções são juntados item a item.
3. Deixa para revisão só o que os dois lados mudaram **nas mesmas linhas**, mostrando o que o destino tem e o que a sua branch tem. A IA pode resolver esses com a mesma regra e explicar cada um.
4. Confere **"entrou só o seu?"**: compara, linha a linha, o que mudou na branch de merge com o que a sua branch mudou. Aponta linhas que entraram e não são suas, linhas do destino que sumiram, linhas suas que faltaram, marcações de conflito esquecidas e commits de outras pessoas indo junto.

Nada é commitado até você mandar: o `reldor merge --continue` confere de novo e faz o commit de merge. O `reldor merge --check` só confere (também depois do commit). O `reldor merge --abort` desfaz tudo.

## Quando usar

Na branch de merge, diga "faz o merge da minha branch". Nada de clicar em "accept current / incoming / both".

## Está funcionando se

- Merge que levava tempo resolvendo conflito na mão vira uma revisão rápida.
- A PR tem só a sua mudança.

## Perguntas comuns

**E se a IA resolver um conflito errado?**
A conferência pega: uma linha do destino que sumiu, ou algo que não é seu, aparece antes do commit.

**Precisa das ações de Git ligadas?**
Não. Ele só roda quando você pede e pergunta antes de commitar. Se preferir, commite pela sua ferramenta depois da conferência.

**E o `reldor merge install`?**
Liga o driver item a item também dentro do `git merge` normal (para merges feitos por outras ferramentas), mais o `rerere`. Detalhes no [promote](./promote.pt-BR.md#merge-inteligente).

## Onde se encaixa

Depois do [promote](./promote.pt-BR.md) mostrar que não falta dependência, antes da pull request.
