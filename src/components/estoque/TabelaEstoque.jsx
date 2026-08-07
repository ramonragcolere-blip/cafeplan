import React from 'react';
import { Eye, PencilLine, Pencil } from 'lucide-react';
import { fmtQtd, fmtData } from '@/lib/estoqueInsumos';

const SITUACAO_CLS = {
  'Normal': 'bg-green-100 text-green-700 border-green-200',
  'Atenção': 'bg-amber-100 text-amber-700 border-amber-200',
  'Estoque baixo': 'bg-red-100 text-red-700 border-red-200',
  'Sem estoque': 'bg-muted text-muted-foreground border-border',
};

function DoseCell({ row, onEditarDose }) {
  if (!row.dose) {
    return (
      <button type="button" onClick={() => onEditarDose(row)}
        title="Definir dose/ha"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary border border-transparent hover:border-primary/30 rounded px-1.5 py-0.5">
        <Pencil className="w-3 h-3" /> Definir
      </button>
    );
  }
  const u = row.dose.unit === 'l' ? 'L' : row.dose.unit === 'kg' ? 'kg' : row.dose.unit;
  return (
    <button type="button" onClick={() => onEditarDose(row)}
      title="Editar dose/ha"
      className="inline-flex items-center gap-1 tabular-nums hover:text-primary group">
      {fmtQtd(row.dose.valor)} {u}/ha
      <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-100 text-primary" />
    </button>
  );
}

export default function TabelaEstoque({ rows, showProdutor, onRegistrarUso, onVerDetalhe, onEditarDose }) {
  const cols = [
    ...(showProdutor ? ['Produtor'] : []),
    'Produto', 'Categoria', 'Última entrada', 'Entrada', 'Usado', 'Saldo', 'Unidade', 'Dose/ha', 'Ha possíveis', 'Situação', '',
  ];
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/10">
              {cols.map(h => (
                <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={cols.length} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  Nenhum produto em estoque para o filtro selecionado.
                </td>
              </tr>
            ) : rows.map((r, i) => {
              const semEstoque = r.situacao === 'Sem estoque';
              const baixo = r.situacao === 'Estoque baixo';
              return (
                <tr key={r.key} className={`border-b border-border/50 last:border-0 hover:bg-muted/10 ${baixo ? 'bg-red-50/60' : ''} ${i % 2 === 1 ? 'bg-muted/5' : ''}`}>
                  {showProdutor && (
                    <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{r.produtor_id}</td>
                  )}
                  <td className="px-3 py-2.5 font-medium max-w-[220px] truncate">{r.produto_nome}</td>
                  <td className="px-3 py-2.5"><span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded">{r.categoria}</span></td>
                  <td className="px-3 py-2.5 tabular-nums whitespace-nowrap">{fmtData(r.ultima_entrada)}</td>
                  <td className="px-3 py-2.5 tabular-nums">{fmtQtd(r.total_entrada)}</td>
                  <td className="px-3 py-2.5 tabular-nums">{fmtQtd(r.total_saida)}</td>
                  <td className={`px-3 py-2.5 tabular-nums font-semibold ${semEstoque ? 'text-muted-foreground' : baixo ? 'text-destructive' : 'text-foreground'}`}>{fmtQtd(r.saldo)}</td>
                  <td className="px-3 py-2.5"><span className="text-xs font-mono text-muted-foreground">{r.unidade || '—'}</span></td>
                  <td className="px-3 py-2.5"><DoseCell row={r} onEditarDose={onEditarDose} /></td>
                  <td className="px-3 py-2.5 tabular-nums">
                    {r.ha_possiveis != null ? `${fmtQtd(r.ha_possiveis)} ha` : (
                      <span className="text-muted-foreground" title="Defina a dose/ha ou a unidade do saldo não é compatível.">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded border ${SITUACAO_CLS[r.situacao] || SITUACAO_CLS['Normal']}`}>
                      {r.situacao}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        title="Registrar uso"
                        onClick={() => onRegistrarUso(r)}
                        disabled={semEstoque}
                        className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded border ${semEstoque ? 'opacity-40 cursor-not-allowed border-border text-muted-foreground' : 'border-primary/30 text-primary hover:bg-primary/5'}`}
                      >
                        <PencilLine className="w-3.5 h-3.5" /> Registrar uso
                      </button>
                      <button
                        type="button"
                        title="Ver detalhes"
                        onClick={() => onVerDetalhe(r)}
                        className="inline-flex items-center justify-center w-7 h-7 rounded border border-border hover:bg-muted/10"
                      >
                        <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}