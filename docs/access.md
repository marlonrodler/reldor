<p align="center"><strong>Português</strong> · <a href="./access.en.md">English</a></p>

# access

## O que faz

Muitas vezes a task pede para "criar" algo que **já existe, mas não está liberado**: o valor da picklist está lá, mas não no record type da task; o campo existe, mas não está no layout nem no permission set. O `reldor access` responde "já existe, mas está liberado?" e mostra **onde falta liberar**, com o arquivo, para ninguém precisar caçar.

Para um campo (`reldor access Objeto.Campo`), e opcionalmente um valor de picklist (`--value "Valor"`), ele confere:

- **o valor**: existe no campo ou no global value set? Está ativo? Se não existe, mostra os parecidos que já existem (erro de digitação, outro nome);
- **picklist dependente**: o valor está liberado para algum valor do campo controlador?
- **record types**: cada record type lista os valores um a um; ele diz em quais o valor falta (e, para `StageName`, nos business processes);
- **acesso ao campo (FLS)**: quais profiles e permission sets dão edição, só leitura ou nada;
- **layouts**: qual layout cada record type usa (por profile) e se o campo está nele; e as páginas (FlexiPage) onde ele aparece;
- **path, traduções** e **regras ou código que citam os outros valores** (uma validation rule com `ISPICKVAL` para cada etapa, um flow, um Apex, uma configuração de tela) mas não este: podem precisar do valor novo também.

Para um objeto (`reldor access Objeto`): permissões do objeto e visibilidade dos record types. Para uma classe Apex (`reldor access MinhaClasse`): em quais profiles e permission sets ela está liberada.

Lê os XMLs do projeto direto: é rápido e não precisa de org.

## Quando usar

Quando a task fala de um valor, um campo ou uma tela que "não aparece". A IA usa sozinha no refinamento: para cada valor citado na task, ela roda o `access` e põe na task o que precisa ser liberado. No terminal: `reldor access Opportunity.Status__c --value "Aprovado" --rt Varejo --perms Vendas`. Com `--rt` e `--perms`, ele confere só os record types e acessos da task.

## Está funcionando se

- Ninguém mais cria um valor que já existia.
- O "fiz deploy e não aparece" some: o que faltava liberar já estava na task.

## Perguntas comuns

**Ele diz que nenhum profile dá acesso, mas na org tem.**
Ele vê o que está no projeto. Se o retrieve não trouxe os profiles, permission sets ou record types da task, traga antes de concluir.

**Por que o record type precisa do valor?**
No Salesforce, cada record type escolhe quais valores de cada picklist aparecem. Um valor novo não entra sozinho nos record types que já existem.

## Onde se encaixa

No refinamento ([refine](./refine.md)) e antes do [deploy](./deploy.md): o que falta liberar vira parte da mudança.
