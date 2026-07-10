# Regras permanentes de QA do CafePlan

- Toda correção começa com teste que reproduz o erro.
- O teste deve falhar antes e passar depois.
- Executar `npm test` e `npm run build` antes de commit.
- Não substituir módulos inteiros quando uma correção localizada resolver.
- Preservar funcionalidades antigas.
- Comparar com a versão anterior antes de remover ou reescrever código.
- Não esconder erros com `catch` vazio.
- Diferenciar teste simulado, local e real no Base44.
- Alterações no Adubação 2.0 devem testar 0-20, 20-40, um talhão e vários talhões.
- Não alterar “Adubação do Cafeeiro” sem autorização.
- Não fazer push ou merge sem autorização expressa.
