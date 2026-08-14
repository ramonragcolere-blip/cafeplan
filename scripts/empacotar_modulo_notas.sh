#!/usr/bin/env bash
# Empacota todos os arquivos do módulo Notas Fiscais em um .zip para download.
# Uso:  bash scripts/empacotar_modulo_notas.sh
# Rodar a partir da raiz do projeto.

set -euo pipefail

ARQUIVOS=(
  "src/pages/NotasFiscais.jsx"

  "src/lib/importacaoNotaFiscal.js"
  "src/lib/notasFiscais.js"
  "src/lib/notasFiscaisCategorias.js"
  "src/lib/analisePrecosNotas.js"
  "src/lib/estoqueInsumos.js"
  "src/lib/analisesEstoque.js"
  "src/lib/talhoesAplicacao.js"

  "src/components/notas/ImportarNotaFiscal.jsx"
  "src/components/notas/ImportarLoteNotasFiscal.jsx"
  "src/components/notas/RevisaoNotaFiscal.jsx"
  "src/components/notas/DetalhesNotaFiscal.jsx"
  "src/components/notas/BadgeComparacaoPreco.jsx"
  "src/components/notas/TabelaBancoPrecos.jsx"
  "src/components/notas/PainelFiltrosNotas.jsx"
  "src/components/notas/CardValorEstoque.jsx"
  "src/components/notas/CardValorUtilizado.jsx"

  "src/components/estoque/AbaEstoque.jsx"
  "src/components/estoque/TabelaEstoque.jsx"
  "src/components/estoque/FiltrosEstoque.jsx"
  "src/components/estoque/CardsEstoque.jsx"
  "src/components/estoque/AlertasEstoque.jsx"
  "src/components/estoque/ModalRegistrarUso.jsx"
  "src/components/estoque/ModalEditarMovimento.jsx"
  "src/components/estoque/ModalEditarDose.jsx"
  "src/components/estoque/ModalDetalheEstoque.jsx"
  "src/components/estoque/ModalCadastrarInsumo.jsx"
  "src/components/estoque/ConfirmaExcluirMovimento.jsx"
  "src/components/estoque/SeletorTalhoesUso.jsx"

  "src/components/analises/AbaAnalises.jsx"
  "src/components/analises/GraficosAnalises.jsx"
  "src/components/analises/CardsAnalises.jsx"
  "src/components/analises/FiltrosAnalises.jsx"
  "src/components/analises/ModalDrillDown.jsx"
  "src/components/analises/ResumoCategoriaTabela.jsx"
  "src/components/analises/helpers.jsx"

  "base44/entities/BaseNotasFiscais.jsonc"
  "base44/entities/BaseItensNotaFiscal.jsonc"
  "base44/entities/MovimentoEstoqueInsumo.jsonc"
  "base44/entities/ConfiguracaoEstoqueProduto.jsonc"
  "base44/entities/FertilizanteFormulado.jsonc"
  "base44/entities/FonteSimples.jsonc"

  "src/App.jsx"
)

SAIDA="modulo_notas_fiscais.zip"
rm -f "$SAIDA"

faltando=0
for arq in "${ARQUIVOS[@]}"; do
  if [ ! -f "$arq" ]; then
    echo "AVISO: arquivo não encontrado: $arq"
    faltanto=1
  fi
done

# zip preserva a estrutura de pastas; ignora arquivos ausentes (-x não é necessário)
zip -q "$SAIDA" "${ARQUIVOS[@]}" 2>/dev/null || true

echo "Pronto: $(pwd)/$SAIDA ($(du -h "$SAIDA" | cut -f1))"