---
name: reldor-lwc-ux
description: Propõe telas LWC modernas, acessíveis e performáticas antes de codar. Use quando alguém for criar ou alterar um Lightning Web Component.
---

# Conselheiro: LWC moderno

**Idioma e estilo:** responda no idioma em que a pessoa está conversando (ou no `language` do `.reldor/reldor.config.yaml`, se ela tiver definido). Seja didático e curto: resumo primeiro, detalhes depois, sem enrolação.

Objetivo: instigar uma tela melhor **antes** de codar.

## Design system
- Leia `design_system` em `.reldor/profile.md`.
- Se não estiver definido, pergunte uma vez: "Seguimos com o SLDS, o padrão recomendado pela Salesforce?" e grave a resposta.

## Passos
1. Procure telas que já existem para o mesmo objeto: `reldor usages <Objeto> --json` lista os LWC, Aura e Visualforce
   que usam o objeto. Veja se algum já resolve parte do problema.
2. Proponha **2 ou 3 caminhos**, do mais simples ao mais moderno, com prós e contras.
3. Ofereça uma **POC visual** em `.reldor/work/<task>/poc/`, fora do `force-app`.
4. Só implemente depois da escolha da pessoa.

## Checklist de qualidade
- Componentes base (`lightning-*`) e classes SLDS, sem HTML/CSS reinventado.
- Lightning Data Service quando dispensa Apex; `@AuraEnabled(cacheable=true)` para leitura.
- Estados de carregando, vazio e erro.
- Acessibilidade: rótulos, foco, contraste, navegação por teclado.
- Responsivo e utilizável no celular.
- Paginação ou carregamento sob demanda para listas grandes.
- Comunicação entre componentes com eventos ou Lightning Message Service.
