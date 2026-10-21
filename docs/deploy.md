<p align="center"><strong>Português</strong> · <a href="./deploy.en.md">English</a></p>

# deploy

## O que faz

O `reldor deploy` **monta** os comandos para subir os seus arquivos para uma org. Ele **nunca executa**: quem roda é você (ou a esteira).

1. Pega os arquivos que a sua branch mudou (comparando com a base, ou os do `--files`), só dentro das pastas de pacote. Um LWC ou Aura vai como a pasta do componente.
2. Pergunta ao [radar de testes](./test-radar.md) quais testes a mudança pode quebrar e usa `RunSpecifiedTests` com eles. Sem testes afetados, usa `NoTestRun` (ou `RunLocalTests` em produção).
3. Mostra, prontos para copiar:
   - a **validação**: `sf project deploy start --dry-run --target-org <org> --source-dir ... --test-level ... --wait 60`, que confere e roda os testes sem salvar nada;
   - o **quick deploy**: `sf project deploy quick --job-id <Job ID da validação> --target-org <org>`, que sobe o que a validação aprovou sem rodar os testes de novo;
   - ou o **deploy direto**, sem validar antes.

**Produção:** só a validação. O deploy em produção segue pela esteira do time.

**Arquivos apagados** não sobem por um deploy de fonte: o Reldor lista quais são e lembra que apagar da org pede um `destructiveChanges.xml` (o [`rollback`](./rollback.md) mostra o formato).

**Qual org:** a do `--org`, a do ambiente (`reldor deploy uat`), a org de referência ou a padrão do `sf`. Se não houver nenhuma, o comando sai com `<alias-da-org>` no lugar, para você trocar.

## Quando usar

Diga "monta o deploy para a minha sandbox" ou "como eu subo isso para o UAT?". No terminal: `reldor deploy --org <alias>`, `reldor deploy <ambiente>`, `reldor deploy --files force-app/main/default/classes/MinhaClasse.cls`, `reldor deploy --base develop`. Com `--json`, devolve os arquivos, os testes e os comandos.

Antes, vale rodar o [`review`](./review.md): segurança, queries e testes num resumo só.

## Está funcionando se

- Você não monta mais o comando de deploy na mão, nem esquece um teste.
- O deploy de validação passa de primeira com mais frequência.

## Perguntas comuns

**Por que o Reldor não roda o deploy?**
Porque subir para uma org é decisão de quem desenvolve (ou da esteira). O Reldor confere e monta; você roda e vê o resultado.

**O quick deploy deu erro de Job ID.**
O quick deploy só funciona com o ID de uma validação que passou, e por um tempo limitado. Rode a validação de novo e use o ID novo.

**Quero rodar todos os testes locais.**
Troque `--test-level RunSpecifiedTests --tests ...` por `--test-level RunLocalTests` no comando.

## Onde se encaixa

Depois do [commit](./commit.md) e do [test-radar](./test-radar.md), quando você quer ver a mudança numa sandbox. Para ambientes com esteira, o caminho continua sendo a pull request ([promote](./promote.md)).
