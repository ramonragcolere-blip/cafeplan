import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { FileDown, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';

const NUTRIENTES_CHAVE = [
  { key: 'n_pct',    label: 'N'    },
  { key: 'p2o5_pct', label: 'P2O5' },
  { key: 'k2o_pct',  label: 'K2O'  },
  { key: 'b_pct',    label: 'B'    },
];

function getMetros(talhao) {
  const esp = talhao?.espacamento;
  const partes = esp?.split(/[xX×]/).map(p => parseFloat(p?.replace(',', '.')));
  const linhaM = partes?.[0] || 0;
  if (talhao?.num_plantas && linhaM > 0) return talhao.num_plantas * linhaM;
  if (talhao?.area_ha && linhaM > 0) return Math.round((talhao.area_ha * 10000) / linhaM);
  return 0;
}

function getMeses(meses) {
  if (!meses) return '';
  const flat = [];
  meses.forEach(m => {
    if (Array.isArray(m)) flat.push(...m);
    else if (m) flat.push(m);
  });
  return flat.filter(Boolean).join(', ');
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

  const gerarPDF = async () => {
    if (!produtor || !safra) return;
    setGerando(true);

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const PW = 297; // landscape
    const ML = 12, MR = 12, MT = 12;
    const CW = PW - ML - MR;
    const dataEmissao = new Date().toLocaleDateString('pt-BR');
    let y = MT;
    let pagina = 1;

    const addPage = () => {
      doc.addPage();
      pagina++;
      y = MT;
      rodape();
      cabecalhoTabela();
    };

    const checkY = (needed = 8) => {
      if (y + needed > 195) addPage();
    };

    const rodape = () => {
      doc.setFontSize(7);
      doc.setTextColor(150);
      doc.text(`Página ${pagina} — Emitido em ${dataEmissao}`, ML, 203);
      doc.setTextColor(0);
    };

    // Colunas da tabela principal
    const cols = [
      { h: 'Talhão',      x: ML,        w: 28 },
      { h: 'Área (ha)',   x: ML + 28,   w: 16 },
      { h: 'Elemento',    x: ML + 44,   w: 14 },
      { h: 'Produto',     x: ML + 58,   w: 46 },
      { h: 'Dose kg/ha',  x: ML + 104,  w: 18 },
      { h: 'Total (kg)',  x: ML + 122,  w: 18 },
      { h: 'g/planta',    x: ML + 140,  w: 16 },
      { h: 'g/metro',     x: ML + 156,  w: 16 },
      { h: 'Meses',       x: ML + 172,  w: 30 },
      { h: 'Observações', x: ML + 202,  w: CW - 202 },
    ];

    const cabecalhoTabela = () => {
      doc.setFillColor(220, 235, 220);
      doc.rect(ML, y, CW, 7, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      cols.forEach(c => doc.text(c.h, c.x + 1, y + 5));
      doc.setFont('helvetica', 'normal');
      y += 7;
    };

    // ── Cabeçalho principal
    doc.setFillColor(36, 90, 50);
    doc.rect(0, 0, PW, 24, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('Planejamento de Adubação do Cafeeiro', ML, 10);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.text(`Produtor: ${produtor.nome}   |   Fazenda: ${produtor.fazenda}   |   Safra: ${safra}   |   Emissão: ${dataEmissao}`, ML, 18);
    if (produtor.eng_responsavel) {
      doc.text(`Engenheiro: ${produtor.eng_responsavel}`, ML + 160, 18);
    }
    doc.setTextColor(0);
    y = 32;

    rodape();
    cabecalhoTabela();

    let rowCount = 0;

    for (const talhao of talhoesProdutor) {
      const plano = planos.find(p => p.talhao_id === talhao.id && p.safra === safra);
      const planoNut = plano?.planejamento_nutrientes || {};
      const metros = getMetros(talhao);
      const area = talhao.area_ha || 0;

      const linhas = NUTRIENTES_CHAVE
        .map(n => ({ ...n, linha: planoNut[n.key] }))
        .filter(n => n.linha && (n.linha.produtoId || n.linha.doseRecManual !== ''));

      if (linhas.length === 0) {
        checkY(8);
        if (rowCount % 2 === 0) {
          doc.setFillColor(252, 252, 252);
          doc.rect(ML, y, CW, 7, 'F');
        }
        doc.setFontSize(7);
        const row = [
          talhao.nome.substring(0, 18),
          area ? `${area}` : '—',
          '—', '(sem planejamento)', '—', '—', '—', '—', '—', '—',
        ];
        cols.forEach((c, ci) => doc.text(row[ci], c.x + 1, y + 5));
        doc.setDrawColor(230); doc.line(ML, y + 7, ML + CW, y + 7); doc.setDrawColor(0);
        y += 7;
        rowCount++;
        continue;
      }

      linhas.forEach((nutItem, li) => {
        checkY(8);
        const { label, key, linha } = nutItem;
        const prod = todosProdutos.find(p => p.id === linha.produtoId);
        const nomeProd = linha.produtoId === null ? 'Nenhum produto' : (prod?.nome || '—');

        // Dose produto/ha
        const doseRec = linha.doseRecManual !== '' ? parseFloat(linha.doseRecManual) : null;
        const pctNut = prod ? parseFloat(prod[key]) || 0 : 0;
        const doseProdHa = prod && doseRec && pctNut > 0
          ? Math.round((doseRec / (pctNut / 100)) * 10) / 10
          : doseRec;

        const totalKg = doseProdHa && area > 0 ? Math.round(doseProdHa * area) : null;
        const gPlanta = totalKg && talhao.num_plantas > 0 ? ((totalKg * 1000) / talhao.num_plantas).toFixed(1) : '—';
        const gMetro  = totalKg && metros > 0 ? ((totalKg * 1000) / metros).toFixed(1) : '—';
        const meses   = getMeses(linha.meses);

        if (rowCount % 2 === 0) {
          doc.setFillColor(250, 252, 250);
          doc.rect(ML, y, CW, 7, 'F');
        }

        doc.setFontSize(7);
        const row = [
          li === 0 ? talhao.nome.substring(0, 18) : '',
          li === 0 ? (area ? `${area}` : '—') : '',
          label,
          nomeProd.substring(0, 32),
          doseProdHa ? `${doseProdHa}` : '—',
          totalKg ? `${totalKg}` : '—',
          gPlanta,
          gMetro,
          meses.substring(0, 20),
          (linha.observacoes || '').substring(0, 22),
        ];
        cols.forEach((c, ci) => doc.text(row[ci], c.x + 1, y + 5));
        doc.setDrawColor(230); doc.line(ML, y + 7, ML + CW, y + 7); doc.setDrawColor(0);
        y += 7;
        rowCount++;
      });

      // Linha separadora entre talhões
      doc.setDrawColor(36, 90, 50);
      doc.line(ML, y, ML + CW, y);
      doc.setDrawColor(0);
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

        <Button onClick={gerarPDF} disabled={gerando} className="gap-2">
          {gerando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
          Gerar PDF — Todos os Talhões
        </Button>

        <div className="bg-muted/30 rounded-xl p-4 text-xs text-muted-foreground space-y-1">
          <p className="font-medium">Conteúdo do PDF (formato paisagem A4):</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Cabeçalho: Produtor, Fazenda, Safra, Engenheiro, Data de emissão</li>
            <li>Por talhão e elemento: Produto, Dose (kg/ha), Total (kg), g/planta, g/metro, Meses, Observações</li>
            <li>Rodapé com número de página e data</li>
          </ul>
        </div>
      </div>
    </div>
  );
}