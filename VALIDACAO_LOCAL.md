# Validação local

Data: 10/07/2026

## Resultado

- Testes: `npm test` — 13 aprovados, 0 falhas.
- Build: `npm run build` — aprovado.
- ESLint dos módulos alterados — aprovado.
- ESLint geral — 10 erros preexistentes de imports sem uso, todos dentro do módulo antigo de adubação preservado por solicitação do usuário.

## Observação sobre `npm run typecheck`

O script atual usa `checkJs` sobre um projeto JavaScript com componentes de UI sem declarações de tipos e também percorre código JavaScript de dependências como `papaparse` e `@mapbox/mapbox-gl-draw`. Por isso, o typecheck geral produz muitos falsos positivos e não foi usado como critério de aprovação. A compilação Vite e os testes automatizados foram aprovados.

## Arquivos antigos com lint remanescente

- `src/pages/Adubacao.jsx`
- `src/components/adubacao/AbaPlanejamento.jsx`
- `src/components/adubacao/ComprasForm.jsx`
- `src/components/adubacao/FontesFormulados.jsx`
- `src/components/adubacao/PlanoAplicacoes.jsx`
- `src/components/adubacao/PlanoNutricionalForm.jsx`
- `src/components/adubacao/RecomendacaoNPK.jsx`

Esses arquivos não foram alterados.
