<p align="center"><a href="./roadmap.md">English</a> · <strong>Português</strong></p>

# Roadmap

Cada fase só começa quando a anterior passa no critério.

| Fase | Entrega | Passa quando | |
|---|---|---|---|
| **0 · Fundação** | `init`, `status`, `log`, skills e plugins do Kiro e do Claude Code | A IA explica sua situação atual sem erro | ✅ |
| **1 · Conhecimento e conselheiros (MVP 1)** ✅ no código | Índice ✅, engenharia reversa (`explain`) ✅, onde é usado (`usages`) ✅, conselheiros ✅, radar de testes ✅, checagem de queries ✅, refinador de task ✅ | A cadeia de 3 processos reais é validada por um dev sênior | 🚧 |
| **2 · Desenvolvimento e Git (MVP 2)** | Checagem de queries ✅, revisão de segurança ✅, revisão de qualidade ✅, org confirmada ✅, commit limpo ✅, organizador de XML ✅, gancho pre-commit ✅, merge inteligente ✅, `rerere` ✅, ensaio de promoção ✅, contexto para a IA, plano de rollback, radar de colisão | 2 semanas sem nenhum merge ou commit errado | |
| **3 · Piloto e medição** | Uso real com um desenvolvedor, com autorização do cliente | Ganho medido e o dev quer continuar | |
| **4 · Ampliação e expansão** | Massa de teste, rollback executado, análise de erro, checklist de deploy, Quick Deploy, drift, documentação automática, conectores, índice compartilhado, outros clientes | | |

## Ganho rápido (já)
Ligue o `git rerere` para reaplicar conflitos repetidos entre ambientes:

```bash
git config --global rerere.enabled true
```
