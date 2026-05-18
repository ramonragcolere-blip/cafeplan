import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { FileDown, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';

function getMetros(talhao) {
  const esp = talhao?.espacamento;
  const partes = esp?.split(/[xX×]/).map(p => parseFloat(p?.replace(',', '.')));
  const linhaM = partes?.[0] || 0;
  if (talhao?.num_plantas && linhaM > 0) return talhao.num_plantas * linhaM;
  if (talhao?.area_ha && linhaM > 0) return Math.round((talhao.area_ha * 10000) / linhaM);
  return 0;
}

export default function AbaExportarPDF({ produtor, safra, talhoes, planos, analises }) {
  const [gerando, setGerando] = useState(false);

  const { data: fertilizantes = [] } = useQuery({ queryKey: ['fertilizantes'], queryFn: () => base44.entities.FertilizanteFormulado.list() });
  const { data: fontesSimples = [] } = useQuery({ queryKey: ['fontes_simples'], queryFn: () => base44.entities.FonteSimples.list() });

  const todosProdutos = useMemo(() => [
    ...fertilizantes.map(f => ({ ...f, _tipo: 'formulado' })),
    ...fontesSimples.map(f => ({ ...f, _tipo: 'fonte' })),
  ], [fertilizantes, fontesSimples]);

  const talhoesProdutor = useMemo(() =>
    talhoes.filter(t => t.codigo_produtor === produtor?.codigo),
    [talhoes, produtor]);

  const gerarPDF = async (apenasAtual, talhaoAtual) => {
    if (!produtor || !safra) return;
    setGerando(true);

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const PW = 210;
    const ML = 15, MR = 15, MT = 15;
    const CW = PW - ML - MR;
    const dataEmissao = new Date().toLocaleDateString('pt-BR');

    const alvos = apenasAtual && talhaoAtual ? [talhaoAtual] : talhoesProdutor;

    let y = MT;
    let pagina = 1;

    const addPage = () => {
      doc.addPage();
      pagina++;
      y = MT;
      rodape();
    };

    const checkY = (needed = 10) => {
      if (y + needed > 275) addPage();
    };

    const rodape = () => {
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Página ${pagina} — Emitido em ${dataEmissao}`, ML, 290);
      doc.setTextColor(0);
    };

    // ── Cabeçalho principal
    doc.setFillColor(36, 90, 50);
    doc.rect(0, 0, 210, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Planejamento de Adubação do Cafeeiro', ML, 11);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Produtor: ${produtor.nome}   |   Fazenda: ${produtor.fazenda}   |   Safra: ${safra}   |   Emissão: ${dataEmissao}`, ML, 20);
    doc.setTextColor(0);
    y = 36;

    rodape();

    // ── Um bloco por talhão
    for (let ti = 0; ti < alvos.length; ti++) {
      const talhao = alvos[ti];
      const plano = planos.find(p => p.talhao_id === talhao.id && p.safra === safra);
      const linhasPlano = plano?.plano_aplicacoes || [];
      const metros = getMetros(talhao);

      if (ti > 0) {
        checkY(15);
        doc.setDrawColor(200);
        doc.line(ML, y, ML + CW, y);
        y += 6;
      }

      checkY(20);

      // Cabeçalho do talhão
      doc.setFillColor(240, 245, 235);
      doc.rect(ML, y, CW, 10, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(36, 90, 50);
      doc.text(`Talhão: ${talhao.nome}`, ML + 3, y + 7);
      doc.setTextColor(0);
      y += 13;

      // Dados do talhão
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      const dadosTalhao = [
        talhao.area_ha ? `Área: ${talhao.area_ha} ha` : null,
        talhao.num_plantas ? `Plantas: ${talhao.num_plantas.toLocaleString()}` : null,
        talhao.espacamento ? `Espaçamento: ${talhao.espacamento}` : null,
        metros > 0 ? `Metros lineares: ${metros.toLocaleString()}` : null,
        talhao.cultivar ? `Cultivar: ${talhao.cultivar}` : null,
      ].filter(Boolean).join('   |   ');
      doc.text(dadosTalhao, ML, y);
      y += 7;

      // Recomendação NPK (se houver plano)
      if (plano?.nutrientes) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.text('Recomendação Nutricional:', ML, y);
        doc.setFont('helvetica', 'normal');
        const n = plano.nutrientes;
        const recTexto = Object.entries(n).map(([k, v]) => `${k}: ${v}`).join('   ');
        doc.text(recTexto, ML + 45, y);
        y += 7;
      }

      // Tabela de produtos
      if (linhasPlano.length === 0) {
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text('Nenhum produto planejado para este talhão.', ML, y);
        doc.setTextColor(0);
        y += 7;
        continue;
      }

      checkY(14);

      // Cabeçalho da tabela
      const cols = [
        { h: 'Produto', x: ML, w: 52 },
        { h: 'Aplic.', x: ML + 52, w: 16 },
        { h: 'Dose kg/ha', x: ML + 68, w: 22 },
        { h: 'Total kg', x: ML + 90, w: 20 },
        { h: 'g/pé', x: ML + 110, w: 18 },
        { h: 'g/metro', x: ML + 128, w: 18 },
        { h: 'Época prevista', x: ML + 146, w: 30 },
        { h: 'Obs', x: ML + 176, w: CW - 161 },
      ];

      doc.setFillColor(220, 235, 220);
      doc.rect(ML, y, CW, 7, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      cols.forEach(c => doc.text(c.h, c.x + 1, y + 5));
      doc.setFont('helvetica', 'normal');
      y += 7;

      linhasPlano.forEach((l, li) => {
        checkY(8);
        const prod = todosProdutos.find(p => p.id === l.produto_id);
        const nomeProd = prod?.nome || '?';
        const area = talhao.area_ha || 0;

        // dose kg/ha — tenta calcular da quantidade planejada ou usa dose_ajust
        const doseHa = parseFloat(l.dose_ajust_kgha) ||
          (l.qtd_planejado && area > 0 ? (parseFloat(l.qtd_planejado) / area) : null);
        const qtdTotal = l.qtd_planejado ? Math.round(parseFloat(l.qtd_planejado)) :
          (doseHa && area > 0 ? Math.round(doseHa * area) : null);
        const gPe = qtdTotal && talhao.num_plantas > 0 ? ((qtdTotal * 1000) / talhao.num_plantas).toFixed(1) : '—';
        const gMt = qtdTotal && metros > 0 ? ((qtdTotal * 1000) / metros).toFixed(1) : '—';

        if (li % 2 === 0) {
          doc.setFillColor(250, 252, 250);
          doc.rect(ML, y, CW, 7, 'F');
        }
        doc.setFontSize(7.5);
        const row = [
          nomeProd.substring(0, 30),
          l.aplicacao || '—',
          doseHa ? doseHa.toFixed(1) : '—',
          qtdTotal ? `${qtdTotal}` : '—',
          gPe,
          gMt,
          (l.epoca_prevista || '').substring(0, 18),
          (l.observacoes || '').substring(0, 15),
        ];
        cols.forEach((c, ci) => doc.text(row[ci], c.x + 1, y + 5));

        // linha separadora leve
        doc.setDrawColor(220);
        doc.line(ML, y + 7, ML + CW, y + 7);
        doc.setDrawColor(0);
        y += 7;
      });

      y += 4;
    }

    doc.save(`Adubacao_${produtor.codigo}_Safra${safra.replace('/', '-')}.pdf`);
    setGerando(false);
  };

  if (!produtor || !safra) return (
    <div className="text-center py-12 text-muted-foreground">Selecione produtor e safra para exportar.</div>
  );

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <FileDown className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Exportar Planejamento de Adubação</h3>
        </div>

        <div className="text-sm text-muted-foreground space-y-1">
          <p>Produtor: <strong>{produtor.nome}</strong> — {produtor.fazenda}</p>
          <p>Safra: <strong>{safra}</strong></p>
          <p>Talhões disponíveis: <strong>{talhoesProdutor.length}</strong></p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <div className="border border-border rounded-xl p-4 space-y-3">
            <p className="font-medium text-sm">PDF com todos os talhões</p>
            <p className="text-xs text-muted-foreground">Gera um documento completo com todos os {talhoesProdutor.length} talhões do produtor, incluindo produtos, doses, g/pé, g/metro e época.</p>
            <Button onClick={() => gerarPDF(false)} disabled={gerando} className="w-full gap-2">
              {gerando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
              Gerar PDF — Todos os Talhões
            </Button>
          </div>
        </div>

        <div className="bg-muted/30 rounded-xl p-4 text-xs text-muted-foreground space-y-1">
          <p className="font-medium">Conteúdo do PDF:</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Cabeçalho: Produtor, Fazenda, Safra, Data de emissão</li>
            <li>Por talhão: Área, Nº plantas, Espaçamento, Metros lineares</li>
            <li>Tabela de produtos: Produto, Aplicação, Dose (kg/ha), Total (kg), g/pé, g/metro, Época prevista</li>
            <li>Rodapé com número de página e data</li>
          </ul>
        </div>
      </div>
    </div>
  );
}