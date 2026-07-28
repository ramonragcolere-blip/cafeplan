## Checklist QA CafePlan

- [ ] Cada bug corrigido possui teste de regressão que falha antes e passa depois.
- [ ] Campos novos ou alterados possuem contrato Base44 atualizado.
- [ ] Fluxos de integração entre módulos afetados foram testados.
- [ ] Alterações em impressão/PDF possuem teste visual ou estrutural.
- [ ] `npm run lint` passou.
- [ ] `npm run typecheck` passou.
- [ ] `npm run test:unit` passou.
- [ ] `npm run test:component` passou.
- [ ] `npm run test:contracts` passou.
- [ ] `npm run test:e2e` passou quando aplicável.
- [ ] `npm run test:visual` passou quando impressão/PDF foi afetado.
- [ ] `npm run build` passou.
