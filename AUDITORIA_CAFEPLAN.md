# Auditoria ampliada e correções — CafePlan

**Data:** 10/07/2026  
**Projeto analisado:** `cafeplan-main.zip`

## Resposta direta sobre o escopo

A primeira revisão funcional ficou concentrada no **Adubação 2.0** e em **Aplicações Foliares**, porque esses foram os defeitos relatados. Compilação e lint dos demais arquivos não eram suficientes para afirmar que todos os módulos haviam sido auditados.

Esta versão contém uma **auditoria estática ampliada do código**, revisão de integridade de dados, correções nos módulos centrais, testes automatizados e compilação de produção. O módulo antigo **Adubação do Cafeeiro** permaneceu sem alterações, conforme solicitado.

## Módulos revisados nesta rodada

- Autenticação e roteamento
- Dashboard
- Calendário
- Planejamento geral
- Adubação 2.0
- Aplicações Foliares
- Produtores
- Talhões
- Mapa de Talhões
- Parâmetros e planejamento de colheita
- Safristas
- Lançamentos
- Notas Fiscais
- Base de Fertilizantes e Fontes Simples
- Importadores CSV/XML relacionados

## Correções críticas e altas

### 1. Planejamentos novos não alimentavam Dashboard, Calendário e custos — alta

O Adubação 2.0 grava em `PlanejamentoAdubacao2`, enquanto diversas telas ainda liam apenas `BasePlanejamentoAdubacao`. O planejamento foliar novo grava em `CronogramaFoliar`, mas partes do sistema liam somente `AplicacaoFoliar`.

**Correção:** criada uma camada de normalização que reúne formatos antigos e novos. Dashboard, Calendário, Planejamento Geral, custos e detalhes mensais agora reconhecem o Adubação 2.0 e o cronograma foliar novo, inclusive aplicações ligadas a vários talhões.

### 2. Código do produtor podia ser alterado e romper todos os vínculos — crítica

Talhões, safristas, lançamentos, equipamentos e planejamentos usam `codigo_produtor` como vínculo. A edição do código podia deixar os registros órfãos e fazê-los desaparecer das telas.

**Correção:** o código fica bloqueado após o cadastro, duplicidades são validadas e o próximo código é calculado pelo maior número existente, sem reutilizar inadvertidamente um código após exclusões.

### 3. Exclusão de produtor ou talhão podia apagar o cadastro principal e deixar históricos órfãos — crítica

**Correção:** exclusões agora verificam registros vinculados e são bloqueadas quando há histórico. A orientação exibida é inativar o cadastro. Talhões também não podem trocar de produtor depois de criados.

### 4. Mapa apagava o talhão inteiro ao remover somente o desenho — crítica

A ação apresentada no mapa podia excluir a entidade `Talhao`, levando junto a referência usada por análises e planejamentos.

**Correção:** “Remover desenho do mapa” limpa apenas `geojson_poligono` e `centro_mapa`, preservando o talhão e seu histórico. O centro geográfico do polígono passou a ser salvo e reutilizado no mapa.

### 5. Caixa de produtos podia receber lista incompleta por filtro rígido e consulta compartilhada — alta

Além da lista rígida de grupos, consultas sem limite explícito podiam depender do limite padrão do servidor. O React Query também compartilhava a mesma chave usada pelo módulo antigo.

**Correção:** Adubação 2.0, Aplicações Foliares e Base de Insumos usam catálogo completo isolado, limite explícito de até 5.000 registros e incluem formulados e fontes simples ativas. A busca considera nome, grupo, fornecedor e ingrediente ativo sem depender de acentos.

### 6. Nutriente com recomendação zero não abria produto no Adubação 2.0 — alta

**Correção:** quando o usuário marca um nutriente cuja metodologia recomenda dose zero, é criada uma linha manual com seletor de produto e dose.

### 7. Produtos manuais da Adubação 2.0 podiam desaparecer — alta

**Correção:** complementos manuais são restaurados, preservados em salvamentos posteriores e incluídos nos totais de quantidade e custo.

### 8. Salvamentos rápidos podiam duplicar planejamentos — alta

**Correção:** salvamentos do mesmo produtor, safra e talhão são serializados. Registros duplicados antigos não são apagados automaticamente; a interface utiliza o mais recente para evitar perda de informação.

### 9. Lançamentos e safristas dependem de nomes, que podiam ser alterados — alta

A entidade `Lancamento` guarda os nomes de safrista e talhão, não seus IDs. Renomear um safrista faria o histórico deixar de ser associado a ele.

**Correção:** produtor e nome do safrista ficam bloqueados após criação; exclusão é impedida quando há lançamentos vinculados. No talhão, produtor e nome são protegidos pelas validações de vínculo e duplicidade. A migração definitiva para IDs permanece como melhoria estrutural futura.

### 10. Lançamento em lote podia terminar parcialmente sem mensagem clara — alta

**Correção:** passou a utilizar `bulkCreate`, com tratamento de erro e mensagens de sucesso/falha. O lançamento individual valida campos obrigatórios e quantidade positiva. Exclusões exigem confirmação.

### 11. Data de lançamento podia aparecer no dia anterior — alta

Datas `YYYY-MM-DD` interpretadas como UTC podem recuar um dia no fuso do Brasil.

**Correção:** a exibição agora formata diretamente os componentes da data, sem conversão de fuso.

### 12. Importação de nota fiscal permitia duplicidade e registro incompleto — alta

**Correção:** XML inválido é rejeitado; produtor e número da nota são obrigatórios; duplicidade é verificada por produtor, número e CNPJ; se a criação dos itens falhar, a nota recém-criada é removida como compensação. O botão de simulação que criava registros reais de teste foi retirado.

### 13. Preço médio de produtos em notas estava aritmeticamente incorreto — alta

A média simples dos preços unitários ignora as quantidades compradas.

**Correção:** o preço médio passou a ser ponderado pela quantidade.

### 14. Aplicação sem sessão validada podia chegar ao roteamento — alta

**Correção:** as páginas não são renderizadas enquanto a autenticação não estiver confirmada. Falhas desconhecidas de validação agora fecham o acesso em vez de abrir os módulos. O redirecionamento para login foi movido para efeito controlado, evitando ação durante a renderização.

## Correções médias e operacionais

- Sequência de colheita repetida entre talhões do mesmo produtor é bloqueada.
- `% a colher = 0` deixa de ser convertido indevidamente para 100%.
- Cálculos zerados em Planejamento de Operações substituem valores antigos em vez de conservar números obsoletos.
- Salvamentos de operações usam payload explícito, sem ID e metadados internos.
- Equipamentos de pós-colheita exibem os campos reais de marca e modelo do lavador e secador.
- Produtos e fontes “excluídos” passam a ser inativados para preservar referências históricas.
- Seletores ignoram produtos inativos.
- Exclusão de aplicação foliar e lançamento exige confirmação e apresenta erro quando falha.
- Importador CSV teve a enumeração `Varriçãoo` corrigida para `Varrição`.
- Consultas principais receberam limites explícitos maiores e chaves de cache separadas do módulo legado, reduzindo listas silenciosamente incompletas.

## Validação executada

- `npm test`: **13 testes aprovados, 0 falhas**.
- Testes cobrem integração do Adubação 2.0, cronograma foliar multitalhão, custos, produtos com dose zero, produtos de grupos antes ocultos, fontes simples, PDF foliar, duplicidade de planejamento, geração de código e média ponderada de notas.
- `npm run build`: **compilação de produção aprovada**.
- ESLint dos módulos alterados: **sem erros**.
- Lint geral: restaram **10 imports sem uso**, todos no módulo antigo `Adubacao.jsx` e em `src/components/adubacao/`, que foram deliberadamente preservados.

## Limites honestos da auditoria

Esta foi uma auditoria de código, estrutura, integridade e testes locais. Não foi possível executar um teste ponta a ponta contra o banco real do Base44, porque o ZIP não contém uma sessão autenticada nem as regras de acesso configuradas na plataforma.

Também não foi possível confirmar pelo repositório:

1. permissões por usuário e regras de acesso a registros no painel do Base44;
2. comportamento com dados reais acima dos limites definidos, pois o SDK não fornece paginação automática no projeto;
3. restrições do token público do Mapbox — o token está no frontend e deve ser limitado aos domínios autorizados no painel do Mapbox;
4. qual consumo de diesel deve ser usado em “Controle químico de mato”: o código usa o consumo da trincha porque não existe campo específico para pulverização no modelo atual;
5. uma migração histórica de `safrista` e `talhao` de nomes para IDs, que exigiria atualização de schema e dos registros existentes.

## Arquivos estruturais adicionados

- `src/lib/integracaoPlanejamentos.js`
- `src/lib/notasFiscais.js`
- `src/lib/planejamentoAdubacao2.js`
- `src/lib/planejamentoFoliar.js`
- `src/lib/gruposFoliares.js`
- `tests/integracao.test.mjs`
- `tests/planejamento.test.mjs`

## Recomendação antes de publicar

Publicar primeiro em uma cópia do aplicativo e testar com dados reais de um único produtor:

1. abrir e salvar Adubação 2.0 com nutriente de dose zero;
2. fechar e reabrir para conferir produtos manuais;
3. criar cronograma foliar com produto formulado e fonte simples;
4. confirmar a aparição no Dashboard, Calendário, custos e PDF;
5. tentar alterar código do produtor, vínculo do talhão e excluir cadastros com histórico;
6. importar duas vezes o mesmo XML de nota fiscal;
7. criar e excluir um lançamento de teste;
8. remover apenas o desenho de um talhão no mapa.
