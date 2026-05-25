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

function getMeses(meses) {
  if (!meses) return '';
  const flat = [];
  meses.forEach(m => {
    if (Array.isArray(m)) flat.push(...m);
    else if (m) flat.push(m);
  });
  return flat.filter(Boolean).join(', ');
}

export default function AbaExportarPDF({ produtor, safra, talhoes }) {
  const [gerando, setGerando] = useState(false);

  const codigoProdutor = produtor?.codigo;

  // Busca todos os planejamentos salvos do produtor+safra
  const { data: planejamentos = [], isLoading } = useQuery({
    queryKey: ['base_planejamento_pdf', codigoProdutor, safra],
    queryFn: () => codigoProdutor && safra
      ? base44.entities.BasePlanejamentoAdubacao.filter({ codigo_produtor: codigoProdutor, safra })
      : Promise.resolve([]),
    enabled: !!(codigoProdutor && safra),
  });

  const talhoesProdutor = useMemo(() =>
    talhoes.filter(t => t.codigo_produtor === codigoProdutor),
    [talhoes, codigoProdutor]);

  const gerarPDF = async () => {
    if (!produtor || !safra) return;
    setGerando(true);

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const PW = 297;
    const ML = 10, MR = 10, MT = 12;
    const CW = PW - ML - MR;
    const dataEmissao = new Date().toLocaleDateString('pt-BR');
    let y = MT;
    let pagina = 1;

    const rodape = () => {
      doc.setFontSize(7);
      doc.setTextColor(150);
      doc.text(`Página ${pagina} — Emitido em ${dataEmissao}`, ML, 203);
      doc.setTextColor(0);
    };

    // Colunas
    const cols = [
      { h: 'Talhão',        x: ML,        w: 26 },
      { h: 'Área (ha)',     x: ML + 26,   w: 14 },
      { h: 'Nutriente',     x: ML + 40,   w: 22 },
      { h: 'Produto/Fonte', x: ML + 62,   w: 44 },
      { h: 'Dose kg/ha',    x: ML + 106,  w: 16 },
      { h: 'Total (kg)',    x: ML + 122,  w: 16 },
      { h: 'g/planta',      x: ML + 138,  w: 14 },
      { h: 'g/metro',       x: ML + 152,  w: 14 },
      { h: 'Nº Aplic.',     x: ML + 166,  w: 13 },
      { h: 'Parcelamento',  x: ML + 179,  w: 18 },
      { h: 'Meses',         x: ML + 197,  w: 28 },
      { h: 'Observações',   x: ML + 225,  w: CW - 225 },
    ];

    const cabecalhoTabela = () => {
      doc.setFillColor(220, 235, 220);
      doc.rect(ML, y, CW, 7, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      cols.forEach(c => doc.text(c.h, c.x + 1, y + 5));
      doc.setFont('helvetica', 'normal');
      y += 7;
    };

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

    // Cabeçalho principal
    doc.setFillColor(36, 90, 50);
    doc.rect(0, 0, PW, 24, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('Planejamento de Adubação do Cafeeiro', ML, 10);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.text(`Produtor: ${produtor.nome}   |   Fazenda: ${produtor.fazenda}   |   Safra: ${safra}   |   Emissão: ${dataEmissao}`, ML, 18);
    if (produtor.eng_responsavel) doc.text(`Engenheiro: ${produtor.eng_responsavel}`, ML + 160, 18);
    doc.setTextColor(0);
    y = 32;

    rodape();
    cabecalhoTabela();

    let rowCount = 0;

    for (const talhao of talhoesProdutor) {
      const metros = getMetros(talhao);
      const area = talhao.area_ha || 0;
      const numPlantas = talhao.num_plantas || 0;

      // Pega os planejamentos deste talhão, ordenando calagem por último
      const plansTalhao = planejamentos
        .filter(p => p.talhao_id === talhao.id)
        .sort((a, b) => {
          if (a.nutriente_key === 'calagem') return 1;
          if (b.nutriente_key === 'calagem') return -1;
          return 0;
        });

      if (plansTalhao.length === 0) {
        checkY(8);
        if (rowCount % 2 === 0) { doc.setFillColor(252, 252, 252); doc.rect(ML, y, CW, 7, 'F'); }
        doc.setFontSize(6.5);
        const row = [talhao.nome.substring(0, 18), area ? `${area}` : '—', '—', '(sem planejamento)', '—', '—', '—', '—', '—', '—', '—', '—'];
        cols.forEach((c, ci) => doc.text(row[ci] || '', c.x + 1, y + 5));
        doc.setDrawColor(230); doc.line(ML, y + 7, ML + CW, y + 7); doc.setDrawColor(0);
        y += 7; rowCount++;
        continue;
      }

      plansTalhao.forEach((plan, li) => {
        checkY(8);
        const doseHa = parseFloat(plan.dose_rec_manual) || 0;
        const totalKg = doseHa && area > 0 ? Math.round(doseHa * area) : null;
        const gPlanta = totalKg && numPlantas > 0 ? ((totalKg * 1000) / numPlantas).toFixed(1) : '—';
        const gMetro  = totalKg && metros > 0 ? ((totalKg * 1000) / metros).toFixed(1) : '—';
        const meses   = getMeses(plan.meses);
        const numAplic = plan.num_aplic || 1;

        // Parcelamento: ex "50%+50%" ou "100%"
        const pcts = plan.pcts || [100];
        const parcelamento = pcts.map(p => `${p}%`).join('+');

        if (rowCount % 2 === 0) {
          // Calagem tem fundo levemente diferente
          if (plan.nutriente_key === 'calagem') {
            doc.setFillColor(245, 255, 245);
          } else {
            doc.setFillColor(250, 252, 250);
          }
          doc.rect(ML, y, CW, 7, 'F');
        }

        doc.setFontSize(6.5);
        const nomeProd = (plan.produto_nome || '—').substring(0, 30);
        const obs = (plan.observacoes || '').substring(0, 28);
        const nutriLabel = (plan.nutriente_label || plan.nutriente_key || '—').substring(0, 18);

        const row = [
          li === 0 ? talhao.nome.substring(0, 18) : '',
          li === 0 ? (area ? `${area}` : '—') : '',
          nutriLabel,
          nomeProd,
          doseHa ? `${doseHa}` : '—',
          totalKg ? `${totalKg}` : '—',
          gPlanta,
          gMetro,
          `${numAplic}`,
          parcelamento,
          meses.substring(0, 22),
          obs,
        ];
        cols.forEach((c, ci) => doc.text(row[ci] || '', c.x + 1, y + 5));
        doc.setDrawColor(230); doc.line(ML, y + 7, ML + CW, y + 7); doc.setDrawColor(0);
        y += 7; rowCount++;
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

  const totalPlans = planejamentos.length;

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
          {isLoading
            ? <p className="text-xs">Carregando planejamentos...</p>
            : <p>Itens de planejamento encontrados: <strong>{totalPlans}</strong></p>
          }
        </div>

        <Button onClick={gerarPDF} disabled={gerando || isLoading} className="gap-2">
          {gerando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
          Gerar PDF — Todos os Talhões
        </Button>

        <div className="bg-muted/30 rounded-xl p-4 text-xs text-muted-foreground space-y-1">
          <p className="font-medium">Conteúdo do PDF (formato paisagem A4):</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Cabeçalho: Produtor, Fazenda, Safra, Engenheiro, Data de emissão</li>
            <li>Por talhão: todos os nutrientes planejados + calagem (quando enviada ao Planejamento)</li>
            <li>Colunas: Nutriente, Produto/Fonte, Dose kg/ha, Total kg, g/planta, g/metro, Nº aplicações, Parcelamento, Meses, Observações</li>
            <li>Rodapé com número de página e data</li>
          </ul>
        </div>
      </div>
    </div>
  );
}