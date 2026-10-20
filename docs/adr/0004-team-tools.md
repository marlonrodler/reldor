<p align="center"><strong>Português</strong> · <a href="./0004-team-tools.en.md">English</a></p>

# 0004 · Ferramentas do time e execução única

Uma empresa que já trabalha com Salesforce costuma ter ferramentas que fazem parte do que o Reldor faz: um plugin que
ordena e tira duplicados de profiles, uma esteira que roda o Code Analyzer e os testes, um gancho de commit. Rodar a
mesma coisa duas vezes gasta tempo, e duas ferramentas reescrevendo o mesmo arquivo podem brigar.

Decisão:
- Cada módulo declara suas **capacidades**. O projeto escolhe, em `tools:` do `.reldor/reldor.config.yaml`, um modo para
  cada uma: `run` (o Reldor faz), `verify` (o Reldor só confere, sem refazer) ou `skip` (o Reldor fica de fora e diz quem
  cuida). Capacidades que agem fora dos arquivos (rodar testes, instalar gancho ou merge driver) aceitam só `run` ou
  `skip`.
- O módulo procura **sinais** dessas ferramentas no projeto e sugere. Nada é gravado sem a pessoa decidir, e o que é do
  cliente fica no repositório do cliente.
- Um **registro de execuções** guarda o resultado de cada checagem pela impressão digital do que ela lê (conteúdo dos
  arquivos, índice, commit base, opções e versão do Reldor). A mesma checagem sobre o mesmo conteúdo não roda duas vezes.
- Tudo isso é calculado por script (ADR 0002). A skill só lê o resultado e pergunta.

Consequências: `review`, gancho e comandos seguem os modos; o que fica de fora é sempre listado, nunca escondido.
Comandos que mudam algo só agem numa capacidade de outra ferramenta com `--force`.
