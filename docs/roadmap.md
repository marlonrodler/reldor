# Roadmap

Cada fase só começa quando a anterior passa no critério.

| Fase | Entrega | Passa quando |
|---|---|---|
| **0 · Fundação** | `init`, `status`, skill + guia, cascas Kiro e Claude, histórico | A IA explica sua situação atual sem erro |
| **1 · Conhecimento e conselheiros (MVP 1)** | Índice da org, engenharia reversa, refinador de task, radar de testes, conselheiros (revisão de spec, desenho de automação, LWC moderno) | A cadeia de 3 processos reais é validada por um dev sênior |
| **2 · Desenvolvimento e Git (MVP 2)** | Contexto para a IA, checagem de queries, exclusão segura, plano de rollback, org confirmada, commit limpo, organizador de XML, merge inteligente, `rerere`, radar de colisão, ensaio de promoção | 2 semanas sem nenhum merge ou commit errado |
| **3 · Piloto e medição** | Uso real com um desenvolvedor, com autorização do cliente | Ganho medido e o dev quer continuar |
| **4 · Ampliação e expansão** | Massa de teste, rollback executado, análise de erro, checklist de deploy, Quick Deploy, drift, documentação automática, conectores, índice compartilhado, outros clientes | — |

## Ganho rápido (já)
Ligue o `git rerere` para reaplicar conflitos repetidos entre ambientes:

```bash
git config --global rerere.enabled true
```
