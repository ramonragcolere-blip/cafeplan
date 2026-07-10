# CafePlan QA

Use esta skill em qualquer correção, regressão, auditoria ou preparação de release do CafePlan.

## Fluxo obrigatório

1. Reproduzir.
2. Localizar causa raiz.
3. Criar teste.
4. Provar falha.
5. Implementar.
6. Testar.
7. Build.
8. Revisão adversarial.
9. Apresentar evidências.
10. Pedir autorização.

## Regras

- Toda correção começa com um teste que reproduz o erro.
- O teste deve falhar antes e passar depois.
- Execute `npm test` e `npm run build` antes de commit.
- Não substitua módulos inteiros quando uma correção localizada resolver.
- Preserve funcionalidades antigas.
- Compare com a versão anterior antes de remover ou reescrever código.
- Não esconda erros com `catch` vazio.
- Diferencie teste simulado, local e real no Base44.
- Em Adubação 2.0, teste 0-20, 20-40, um talhão e vários talhões.
- Não altere “Adubação do Cafeeiro” sem autorização.
- Não faça push ou merge sem autorização expressa.

## Evidências mínimas de saída

- Arquivos alterados.
- Teste que falhou antes da correção.
- Testes executados depois da correção.
- Resultado de build.
- Resumo da revisão adversarial.
- Limitações e pendências.
- Pedido explícito de autorização para commit, push, PR ou merge quando aplicável.
