# QA 2.0 do CafePlan

## Arquitetura

A infraestrutura QA 2.0 combina quatro camadas:

- Testes unitarios existentes com `node --test`, preservados em `tests/*.test.mjs`.
- Testes de componentes com Vitest, jsdom e Testing Library em `tests/component`.
- Testes de contrato Base44 em `tests/contracts`, lendo `base44/entities/*.jsonc` com `jsonc-parser`.
- Testes E2E e visuais com Playwright em `tests/e2e`.

O cliente Base44 falso fica em `src/testing/qa2/base44MemoryClient.js` e usa fixtures deterministicas de `src/testing/qa2/fixtures/cafeplanQa2Fixtures.js`. Ele so deve ser ativado em testes ou com `VITE_E2E_MOCK=true`; em producao, `isBase44MockEnabled()` exige ambiente nao produtivo.

## Comandos Locais

```bash
npm test
npm run test:unit
npm run test:component
npm run test:contracts
npm run test:e2e
npm run test:visual
npm run test:visual:update
npm run lint
npm run typecheck
npm run build
npm run qa:ci
```

`npm run test:visual:update` e o unico comando permitido para atualizar snapshots visuais aprovados.

## Como Adicionar Fixture

1. Edite `src/testing/qa2/fixtures/cafeplanQa2Fixtures.js`.
2. Inclua dados no mesmo formato das entidades reais.
3. Use produtor, safra e `talhao_id` explicitos para evitar mistura entre contextos.
4. Cubra formatos legado e novo quando o bug depender de compatibilidade.
5. Nao inclua dados privados reais.

## Teste Para Bug Corrigido

1. Crie primeiro um teste que reproduza o erro.
2. Prefira renderizar o componente real quando o bug aconteceu na interface.
3. Use o Base44 em memoria para persistir, recarregar e reabrir dados.
4. Valide ausencia de tela branca, `ReferenceError`, `TypeError` e dados misturados.
5. Corrija o codigo de producao sem esconder erro com `catch` vazio.

## Snapshot Visual

1. Rode `npm run test:visual` para confirmar a falha.
2. Inspecione screenshot, HTML e trace em `test-results`.
3. Atualize somente quando a mudanca visual for desejada:

```bash
npm run test:visual:update
```

4. Revise o snapshot antes do commit.

## Investigando Falha No GitHub

1. Abra o job que falhou no workflow QA.
2. Baixe os artifacts do job correspondente.
3. Para Playwright, abra `playwright-report/index.html`.
4. Verifique `test-results` para screenshot, trace, video e HTML salvo.
5. Confirme se o SHA do QA e o mesmo SHA da branch antes do merge.

## Limitacoes Do Base44 Falso

- Nao executa permissoes, rede, autenticacao real ou latencia do Base44.
- Nao simula todos os operadores de consulta possiveis, apenas os usados nos fluxos QA.
- Nao substitui validacao real no Base44 antes de publicar.
- Deve ser usado apenas em Vitest, Playwright ou desenvolvimento local controlado com `VITE_E2E_MOCK=true`.

## Validacao Real Minima No Base44

1. Abrir Adubacao 2.0.
2. Selecionar produtor, safra e talhao.
3. Navegar por Analises, Graficos, Calagem, Gessagem, Planejamento, Compras e Resumo Geral.
4. Salvar uma alteracao de planejamento e reabrir.
5. Confirmar ausencia de tela branca.
6. Confirmar que Calagem, Gessagem, fertilizantes e graficos aparecem no Resumo Geral.
7. Abrir impressao/PDF e validar layout A4 sem corte horizontal.

## Checklist De PR

- Teste de regressao criado para cada bug.
- Contrato Base44 atualizado quando houver campo novo.
- Fluxo de integracao afetado testado.
- PDF/impressao testado quando alterado.
- Lint, typecheck, testes unitarios, componentes, contratos, E2E, visual e build executados.
