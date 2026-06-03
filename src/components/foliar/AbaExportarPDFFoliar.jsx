import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileDown, Loader2 } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { FAIXAS, NUTRIENTES_KEYS, classificar, CLASS_LABEL } from './FoliarNutrienteUtils';

function gerarPDF(produtor, safra, talhoes, analises, aplicacoes, insumos) {

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const PW = 210; const PH = 297;
  const ML = 15; const MR = 15; const MT = 15;
  const CW = PW - ML - MR;
  let y = MT;

  const cor = { primary: [0, 100, 60], dark: [30, 30, 30], muted: [100, 100, 100], light: [240, 245, 240], white: [255, 255, 255], border: [200, 210, 200] };

  const checkNewPage = (h) => { if (y + h > PH - 15) { doc.addPage(); y = MT; } };

  const header = () => {
    doc.setFillColor(...cor.primary);
    doc.rect(0, 0, PW, 22, 'F');
    doc.setTextColor(...cor.white);
    doc.setFontSize(13); doc.setFont(undefined, 'bold');
    doc.text('Gestão Coffee — Aplicações Foliares', ML, 10);
    doc.setFontSize(9); doc.setFont(undefined, 'normal');
    doc.text(`Produtor: ${produtor.nome} (${produtor.codigo}) | Fazenda: ${produtor.fazenda} | Safra: ${safra}`, ML, 17);
    y = 28;
  };

  header();

  const talhoesProdutor = talhoes.filter(t => t.codigo_produtor === produtor.codigo);
  const insumoById = Object.fromEntries(insumos.map(p => [p.id, p]));

  talhoesProdutor.forEach((talhao, ti) => {
    const analise = analises.find(a => a.talhao_id === talhao.id && a.safra === safra);

    checkNewPage(20);
    doc.setFillColor(...cor.light);
    doc.roundedRect(ML, y, CW, 10, 2, 2, 'F');
    doc.setTextColor(...cor.primary);
    doc.setFontSize(11); doc.setFont(undefined, 'bold');
    doc.text(`Talhão: ${talhao.nome}${talhao.area_ha ? ` — ${talhao.area_ha} ha` : ''}`, ML + 3, y + 6.5);
    y += 13;

    // Análise foliar
    if (analise) {
      checkNewPage(8);
      doc.setTextColor(...cor.dark); doc.setFontSize(9); doc.setFont(undefined, 'bold');
      doc.text('Análise Foliar', ML, y); y += 5;

      const cols = NUTRIENTES_KEYS;
      const colW = CW / Math.min(cols.length, 6);
      const rowsOf6 = [cols.slice(0, 6), cols.slice(6)];
      rowsOf6.forEach(row => {
        if (!row.length) return;
        checkNewPage(14);
        row.forEach((k, ci) => {
          const x = ML + ci * colW;
          const cls = classificar(k, analise[k]);
          const f = FAIXAS[k];
          const bgMap = { deficiente: [254, 226, 226], limiar: [254, 249, 195], adequado: [220, 252, 231], excessivo: [237, 233, 254] };
          const bg = cls ? bgMap[cls] || cor.light : cor.light;
          doc.setFillColor(...bg);
          doc.roundedRect(x, y, colW - 1, 12, 1, 1, 'F');
          doc.setTextColor(...cor.dark); doc.setFontSize(7); doc.setFont(undefined, 'bold');
          doc.text(f.label, x + 2, y + 4);
          doc.setFont(undefined, 'normal');
          const val = analise[k] != null ? `${analise[k]} ${f.unidade}` : '—';
          doc.text(val, x + 2, y + 8.5);
          if (cls) {
            doc.setTextColor(...cor.muted);
            doc.setFontSize(6);
            doc.text(CLASS_LABEL[cls], x + 2, y + 11.5);
          }
        });
        y += 15;
      });
    } else {
      checkNewPage(8);
      doc.setTextColor(...cor.muted); doc.setFontSize(8); doc.setFont(undefined, 'italic');
      doc.text('Sem análise foliar registrada.', ML + 3, y); y += 8;
    }

    // Planejamento — lista de aplicações livres
    const aplicacoesTalhao = aplicacoes.filter(a => a.talhao_id === talhao.id && a.safra === safra);
    if (aplicacoesTalhao.length > 0) {
      checkNewPage(8);
      doc.setTextColor(...cor.dark); doc.setFontSize(9); doc.setFont(undefined, 'bold');
      doc.text('Planejamento de Aplicações', ML, y); y += 5;

      aplicacoesTalhao.forEach(aplic => {
        const prods = aplic.produtos || [];
        checkNewPage(12 + prods.length * 6);

        doc.setFillColor(...cor.light);
        doc.rect(ML, y, CW, 7, 'F');
        doc.setTextColor(...cor.primary); doc.setFontSize(8); doc.setFont(undefined, 'bold');
        const mesesStr = (aplic.meses || []).join(', ');
        doc.text(aplic.titulo || 'Aplicação', ML + 2, y + 4);
        if (mesesStr) { doc.setTextColor(...cor.muted); doc.setFontSize(7); doc.setFont(undefined, 'normal'); doc.text(mesesStr, ML + CW * 0.5, y + 4); }
        if (aplic.equipamento) { doc.setTextColor(...cor.muted); doc.setFontSize(7); doc.text(aplic.equipamento, ML + CW - 2, y + 4, { align: 'right' }); }
        y += 8;

        if (prods.length === 0) {
          doc.setTextColor(...cor.muted); doc.setFontSize(7); doc.setFont(undefined, 'italic');
          doc.text('Sem produtos', ML + 3, y); y += 6;
        } else {
          prods.forEach((p, pi) => {
            checkNewPage(6);
            if (pi % 2 === 0) { doc.setFillColor(248, 250, 248); doc.rect(ML, y, CW, 5.5, 'F'); }
            doc.setTextColor(...cor.dark); doc.setFontSize(7.5); doc.setFont(undefined, 'normal');
            doc.text(`${pi + 1}. ${p.produto_nome}`, ML + 3, y + 3.8);
            const doseStr = p.dose ? `${p.dose} ${p.unidade || ''}` : '';
            const formStr = p.tipo_formulacao || '';
            doc.setTextColor(...cor.muted); doc.setFontSize(7);
            doc.text([doseStr, formStr].filter(Boolean).join(' | '), ML + CW * 0.6, y + 3.8);
            y += 5.5;
          });
        }
        y += 3;
      });
    } else {
      checkNewPage(8);
      doc.setTextColor(...cor.muted); doc.setFontSize(8); doc.setFont(undefined, 'italic');
      doc.text('Sem planejamento de aplicações registrado.', ML + 3, y); y += 8;
    }

    if (ti < talhoesProdutor.length - 1) { y += 5; }
  });

  // Rodapé
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7); doc.setTextColor(...cor.muted);
    doc.text(`Página ${i} de ${pageCount} — Gestão Coffee`, ML, PH - 6);
    doc.text(new Date().toLocaleDateString('pt-BR'), PW - MR, PH - 6, { align: 'right' });
  }

  doc.save(`foliar_${produtor.codigo}_${safra.replace('/', '-')}.pdf`);
}

export default function AbaExportarPDFFoliar({ produtor, safra, talhoes, analises, aplicacoes, insumos }) {
  const [loading, setLoading] = useState(false);
  const talhoesProdutor = talhoes.filter(t => t.codigo_produtor === produtor?.codigo);

  const handleExport = () => {
    setLoading(true);
    setTimeout(() => {
      gerarPDF(produtor, safra, talhoes, analises, aplicacoes, insumos);
      setLoading(false);
    }, 50);
  };

  const comDados = talhoesProdutor.filter(t =>
    analises.some(a => a.talhao_id === t.id && a.safra === safra) ||
    aplicacoes.some(a => a.talhao_id === t.id && a.safra === safra)
  );

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold">Exportar Planejamento Foliar</p>
            <p className="text-sm text-muted-foreground">{comDados.length} de {talhoesProdutor.length} talhão(ões) com dados</p>
          </div>
          <Button onClick={handleExport} disabled={loading || comDados.length === 0} className="gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
            Exportar PDF
          </Button>
        </div>

        {comDados.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum dado de análise ou planejamento encontrado para exportar.</p>
        )}

        {comDados.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Talhões incluídos:</p>
            {comDados.map(t => {
              const temAnalise = analises.some(a => a.talhao_id === t.id && a.safra === safra);
              const temPlano = aplicacoes.some(a => a.talhao_id === t.id && a.safra === safra);
              return (
                <div key={t.id} className="flex items-center gap-2 text-sm">
                  <span className="font-medium">{t.nome}</span>
                  {temAnalise && <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">Análise</span>}
                  {temPlano && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Aplicações</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}