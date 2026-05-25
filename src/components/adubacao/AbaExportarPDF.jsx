import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { FileDown, Loader2, FileText, CheckCircle2, AlertTriangle } from 'lucide-react';
import jsPDF from 'jspdf';
import {
  calcN, classificarP, calcB, getDosesBase,
  calcKSomaCamadas, classificarZn, classificarCu, classificarMn, calcCalagem,
} from '@/lib/tabelasNutricionais';

// ── Helpers ─────────────────────────────────────────────────────────────────

function getMetros(talhao) {
  const esp = talhao?.espacamento;
  const partes = esp?.split(/[xX×]/).map(p => parseFloat(p?.replace(',', '.')));
  const linhaM = partes?.[0] || 0;
  if (talhao?.num_plantas && linhaM > 0) return talhao.num_plantas * linhaM;
  if (talhao?.area_ha && linhaM > 0) return Math.round((talhao.area_ha * 10000) / linhaM);
  return 0;
}

function getMesesFlat(meses) {
  if (!meses) return '';
  const flat = [];
  meses.forEach(m => {
    if (Array.isArray(m)) flat.push(...m);
    else if (m) flat.push(String(m));
  });
  return [...new Set(flat)].filter(Boolean).join(', ');
}

function getMesesPorParcela(meses) {
  if (!meses) return [];
  return meses.map(m => {
    if (!m) return '';
    if (Array.isArray(m)) return m.join(', ');
    return String(m);
  });
}

// Fallback de cálculo de dose do nutriente quando dose_rec_manual está vazio
function calcDoseNutriFallback(nutrienteKey, analise, planoLeg, analise2040) {
  if (!analise && !planoLeg) return null;
  const safrAnt = planoLeg?.safra_anterior_sc_ha;
  const safrEst = planoLeg?.safra_estimada_sc_ha;
  const media   = safrAnt && safrEst ? (Number(safrAnt) + Number(safrEst)) / 2 : null;
  const nCalc   = calcN(safrAnt, safrEst);
  const dosesBase = getDosesBase(media);

  if (nutrienteKey === 'n_pct')    return nCalc?.dose ?? null;
  if (nutrienteKey === 'p2o5_pct') {
    const c = analise?.fosforo != null ? classificarP(analise.fosforo) : null;
    return c ? (c.dispensar ? 0 : Math.round(dosesBase.P * c.fator)) : null;
  }
  if (nutrienteKey === 'k2o_pct') {
    const kDecisao = analise?.potassio != null
      ? calcKSomaCamadas(analise.potassio, analise2040?.potassio, media, 'bom')
      : null;
    if (!kDecisao) return null;
    const base = kDecisao.classK && dosesBase.K != null
      ? (kDecisao.classK.dispensar ? 0 : Math.round(dosesBase.K * kDecisao.classK.fator))
      : null;
    return kDecisao.dispensar ? 0 : base;
  }
  if (nutrienteKey === 'b_pct') {
    const c = analise?.boro != null ? calcB(analise.boro) : null;
    return c ? (c.dispensar ? 0 : c.dose) : null;
  }
  return null;
}

// Calcula métricas completas a partir de dose do produto (kg/ha)
function calcMetricas(doseProdHa, talhao) {
  const area       = talhao?.area_ha || 0;
  const numPlantas = talhao?.num_plantas || 0;
  const metros     = getMetros(talhao);
  if (!doseProdHa || !area) return null;
  const totalKg = doseProdHa * area;
  return {
    doseProdHa : Math.round(doseProdHa * 10) / 10,
    totalKg    : Math.round(totalKg),
    sc50       : (totalKg / 50).toFixed(1),
    sc60       : (totalKg / 60).toFixed(1),
    gPlanta    : numPlantas > 0 ? ((totalKg * 1000) / numPlantas).toFixed(1) : null,
    gMetro     : metros > 0     ? ((totalKg * 1000) / metros).toFixed(1)     : null,
  };
}

// Filtra registros válidos para o PDF
function filtrarValidos(plans) {
  return plans.filter(p => {
    if (!p.produto_id) return false;
    const nome = (p.produto_nome || '').trim().toLowerCase();
    if (nome === 'nenhum produto' || nome === 'não utilizar' || nome === '') return false;
    const dose = parseFloat(p.dose_rec_manual) || 0;
    if (dose <= 0 && p.nutriente_key !== 'calagem') return false;
    return true;
  });
}

// Constrói estrutura completa por talhão
function buildTalhaoDados(talhao, plans, todosProdutos, analises, analises2040, planosLeg) {
  const analise     = analises.find(a => a.talhao_id === talhao.id) || null;
  const analise2040 = analises2040.find(a => a.talhao_id === talhao.id) || null;
  const planoLeg    = planosLeg.find(p => p.talhao_id === talhao.id) || null;

  // Resumo nutricional para o topo
  const safrAnt   = planoLeg?.safra_anterior_sc_ha;
  const safrEst   = planoLeg?.safra_estimada_sc_ha;
  const media     = safrAnt && safrEst ? (Number(safrAnt) + Number(safrEst)) / 2 : null;
  const nCalc     = calcN(safrAnt, safrEst);
  const dosesBase = getDosesBase(media);
  const classP    = analise?.fosforo  != null ? classificarP(analise.fosforo)  : null;
  const kDecisao  = analise?.potassio != null ? calcKSomaCamadas(analise.potassio, analise2040?.potassio, media, 'bom') : null;
  const doseKBase = kDecisao?.classK && dosesBase.K != null ? (kDecisao.classK.dispensar ? 0 : Math.round(dosesBase.K * kDecisao.classK.fator)) : null;
  const calcBoro  = analise?.boro     != null ? calcB(analise.boro) : null;
  const classZn   = analise?.zinco    != null ? classificarZn(analise.zinco) : null;
  const classCu   = analise?.cobre    != null ? classificarCu(analise.cobre) : null;
  const classMn   = analise?.manganes != null ? classificarMn(analise.manganes) : null;
  const calagRes  = calcCalagem(analise?.ph, analise?.saturacao_bases, analise?.ctc);

  const resumoNutri = {
    N  : nCalc?.dose ?? null,
    P  : classP  ? (classP.dispensar  ? 0 : Math.round(dosesBase.P * classP.fator)) : null,
    K  : kDecisao?.dispensar ? 0 : doseKBase,
    B  : calcBoro ? (calcBoro.dispensar ? 0 : calcBoro.dose) : null,
    Zn : classZn?.acao || null,
    Cu : classCu?.acao || null,
    Mn : classMn?.acao || null,
    calagem: calagRes,
  };

  // Itens de planejamento válidos para este talhão — deduplica por produto
  const plansTalhao = filtrarValidos(plans.filter(p => p.talhao_id === talhao.id));

  // Agrupar por produto_id para evitar duplicatas
  const porProduto = new Map();
  plansTalhao.forEach(plan => {
    const pid = plan.produto_id;
    if (!porProduto.has(pid)) {
      porProduto.set(pid, { ...plan, nutrientes: [plan.nutriente_label || plan.nutriente_key] });
    } else {
      const ex = porProduto.get(pid);
      if (!ex.nutrientes.includes(plan.nutriente_label || plan.nutriente_key)) {
        ex.nutrientes.push(plan.nutriente_label || plan.nutriente_key);
      }
    }
  });

  const itens = [];
  porProduto.forEach((plan) => {
    const produto = todosProdutos.find(p => p.id === plan.produto_id) || null;
    const isCalagem = plan.nutriente_key === 'calagem';
    let doseProdHa;

    if (isCalagem) {
      doseProdHa = parseFloat(plan.dose_rec_manual) || 0;
    } else {
      let doseNutriHa = parseFloat(plan.dose_rec_manual);
      if (!doseNutriHa || isNaN(doseNutriHa)) {
        doseNutriHa = calcDoseNutriFallback(plan.nutriente_key, analise, planoLeg, analise2040) || 0;
      }
      const pct = produto ? (parseFloat(produto[plan.nutriente_key]) || 0) : 0;
      doseProdHa = pct > 0 ? Math.round((doseNutriHa / (pct / 100)) * 10) / 10 : 0;
    }

    if (!doseProdHa) return;

    const metricas  = calcMetricas(doseProdHa, talhao);
    const pcts      = plan.pcts || [100];
    const numAplic  = plan.num_aplic || 1;
    const mesesPP   = getMesesPorParcela(plan.meses || []);

    const parcelas = Array.from({ length: numAplic }, (_, i) => {
      const pct   = parseFloat(pcts[i]) || (100 / numAplic);
      const kgApl = metricas ? metricas.totalKg * (pct / 100) : null;
      const metros = getMetros(talhao);
      const plants = talhao?.num_plantas || 0;
      return {
        label   : `${i + 1}ª Aplic.`,
        pct,
        kg      : kgApl != null ? Math.round(kgApl) : null,
        kgHa    : kgApl != null && talhao?.area_ha ? (kgApl / talhao.area_ha).toFixed(1) : null,
        sc50    : kgApl != null ? (kgApl / 50).toFixed(1) : null,
        gPlanta : kgApl != null && plants > 0 ? ((kgApl * 1000) / plants).toFixed(1) : null,
        gMetro  : kgApl != null && metros  > 0 ? ((kgApl * 1000) / metros).toFixed(1) : null,
        meses   : mesesPP[i] || '',
      };
    });

    itens.push({
      plan,
      produto,
      isCalagem,
      metricas,
      doseProdHa,
      nutrientes : plan.nutrientes,
      numAplic,
      pcts,
      parcelas,
    });
  });

  // Calagem separada (registro com nutriente_key === 'calagem')
  const calagemPlan = plansTalhao.find(p => p.nutriente_key === 'calagem');
  const calagemItem = calagemPlan
    ? (() => {
        const prod     = todosProdutos.find(p => p.id === calagemPlan.produto_id) || null;
        const doseHa   = parseFloat(calagemPlan.dose_rec_manual) || 0;
        const metricas = calcMetricas(doseHa, talhao);
        return { plan: calagemPlan, produto: prod, doseHa, metricas };
      })()
    : null;

  return { talhao, resumoNutri, itens, calagemItem, analise };
}

// ── Geração do PDF ──────────────────────────────────────────────────────────

function gerarPDF(produtor, safra, dadosTalhoes, todosProdutos) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const PW  = 210, PH = 297, ML = 13, MR = 13;
  const CW  = PW - ML - MR;
  const hoje = new Date().toLocaleDateString('pt-BR');

  let y = 0, pagina = 1;

  // Paleta
  const V_ESC  = [22, 70, 35];
  const V_MED  = [46, 120, 62];
  const V_CLA  = [210, 240, 215];
  const V_BG   = [240, 250, 242];
  const CAL_BG = [245, 250, 235];
  const CAL_BD = [120, 170, 80];
  const GRY    = [230, 235, 232];
  const GRY2   = [248, 250, 248];

  const rgb = (...c) => doc.setTextColor(...c);
  const fill = (...c) => doc.setFillColor(...c);
  const draw = (...c) => doc.setDrawColor(...c);
  const lw   = (n)  => doc.setLineWidth(n);

  function rodape() {
    rgb(140, 140, 140);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    draw(200, 200, 200); lw(0.2);
    doc.line(ML, PH - 11, PW - MR, PH - 11);
    doc.text(`Página ${pagina}  ·  Emitido em ${hoje}  ·  ${produtor.nome} — Fazenda ${produtor.fazenda || '—'} — Safra ${safra}`, ML, PH - 7);
    rgb(0, 0, 0);
  }

  function novaPage() {
    doc.addPage(); pagina++; y = 14; rodape();
  }

  function checkY(h) { if (y + h > PH - 16) novaPage(); }

  // ── CAPA ──────────────────────────────────────────────────────────────────
  // Faixa verde topo
  fill(...V_ESC); doc.rect(0, 0, PW, 40, 'F');
  // Faixa decorativa linha fina
  fill(...V_MED); doc.rect(0, 40, PW, 1.2, 'F');

  rgb(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('Planejamento de Adubação', ML, 16);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('do Cafeeiro', ML, 24);
  doc.setFontSize(8.5);
  rgb(180, 240, 195);
  doc.text('Recomendação nutricional completa por talhão e safra', ML, 31);

  // Info produtor à direita do cabeçalho
  const cx = PW / 2 + 8;
  rgb(200, 240, 210);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  const linhas = [
    ['Produtor:',  produtor.nome],
    ['Fazenda:',   produtor.fazenda || '—'],
    ['Safra:',     safra],
    ['Eng.:',      produtor.eng_responsavel || '—'],
    ['Município:', `${produtor.municipio || '—'}${produtor.uf ? '/' + produtor.uf : ''}`],
    ['Emissão:',   hoje],
  ];
  linhas.forEach(([l, v], i) => {
    doc.setFont('helvetica', 'normal'); doc.text(l, cx, 8 + i * 5.4);
    doc.setFont('helvetica', 'bold');  doc.text(v.substring(0, 42), cx + 22, 8 + i * 5.4);
  });

  rgb(0, 0, 0);
  y = 48;
  rodape();

  // ── TOTAIS GERAIS DE COMPRA ───────────────────────────────────────────────
  const totalPorProduto = new Map();
  dadosTalhoes.forEach(({ itens, calagemItem }) => {
    [...itens, ...(calagemItem ? [{ ...calagemItem, nutrientes: ['Calagem'] }] : [])].forEach(item => {
      const pid  = item.plan?.produto_id;
      const nome = item.plan?.produto_nome || item.produto?.nome || '—';
      const kg   = item.metricas?.totalKg || 0;
      if (!pid || !kg) return;
      if (!totalPorProduto.has(pid)) totalPorProduto.set(pid, { nome, kg: 0 });
      totalPorProduto.get(pid).kg += kg;
    });
  });

  if (totalPorProduto.size > 0) {
    checkY(14 + totalPorProduto.size * 7 + 6);

    // Título seção
    fill(...V_ESC); doc.rect(ML, y, CW, 8, 'F');
    rgb(255, 255, 255);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text('Resumo Geral de Compra — Todos os Talhões', ML + 4, y + 5.5);
    y += 10;

    // Cabeçalho tabela
    fill(...GRY); draw(...GRY); lw(0.15);
    doc.rect(ML, y, CW, 6, 'FD');
    rgb(...V_ESC);
    doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    doc.text('Produto / Fertilizante', ML + 4, y + 4.2);
    doc.text('Total kg', ML + CW - 46, y + 4.2);
    doc.text('Sacos 50 kg', ML + CW - 30, y + 4.2);
    doc.text('Toneladas', ML + CW - 12, y + 4.2, { align: 'right' });
    y += 6;

    let idx = 0;
    totalPorProduto.forEach(({ nome, kg }) => {
      checkY(7);
      fill(...(idx % 2 === 0 ? [255, 255, 255] : GRY2));
      doc.rect(ML, y, CW, 6.5, 'F');
      draw(...GRY); lw(0.1);
      doc.rect(ML, y, CW, 6.5, 'S');

      rgb(30, 30, 30);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
      doc.text(nome.substring(0, 65), ML + 4, y + 4.5);

      doc.setFont('helvetica', 'bold');
      doc.text(`${kg.toLocaleString('pt-BR')} kg`, ML + CW - 46, y + 4.5);
      doc.text(`${(kg / 50).toFixed(1)} sc`, ML + CW - 30, y + 4.5);
      doc.text(`${(kg / 1000).toFixed(3)} t`, ML + CW - 12, y + 4.5, { align: 'right' });

      y += 6.5; idx++;
    });
    y += 5;
  }

  // ── POR TALHÃO ─────────────────────────────────────────────────────────────
  for (const { talhao, resumoNutri, itens, calagemItem, analise } of dadosTalhoes) {
    if (itens.length === 0 && !calagemItem) continue;

    const area      = talhao.area_ha || 0;
    const numPlantas = talhao.num_plantas || 0;
    const metros    = getMetros(talhao);

    checkY(30);

    // ── Cabeçalho talhão ──
    fill(...V_MED); doc.rect(ML, y, CW, 10, 'F');
    rgb(255, 255, 255);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
    doc.text(`Talhão: ${talhao.nome}`, ML + 4, y + 7);

    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    const infos = [
      area       ? `Área: ${area} ha`                           : '',
      numPlantas ? `Plantas: ${numPlantas.toLocaleString()}`     : '',
      metros     ? `Metros lin.: ${metros.toLocaleString()}`     : '',
      talhao.espacamento ? `Espaç.: ${talhao.espacamento}`       : '',
      talhao.cultivar    ? `Cultivar: ${talhao.cultivar}`        : '',
    ].filter(Boolean).join('   ');
    doc.text(infos, PW - MR - 2, y + 7, { align: 'right' });
    y += 12;

    // ── Resumo nutricional (box compacto) ──
    const temResumo = resumoNutri.N != null || resumoNutri.P != null || resumoNutri.K != null || resumoNutri.B != null;
    if (temResumo) {
      checkY(20);
      fill(...V_BG); draw(...V_CLA); lw(0.2);
      doc.rect(ML, y, CW, 14, 'FD');

      rgb(...V_ESC);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
      doc.text('RECOMENDAÇÃO NUTRICIONAL (kg/ha)', ML + 4, y + 4.5);

      const cols = [
        { l: 'N',    v: resumoNutri.N  != null ? `${resumoNutri.N} kg/ha`  : '—', x: ML + 4  },
        { l: 'P₂O₅', v: resumoNutri.P != null ? `${resumoNutri.P} kg/ha`  : '—', x: ML + 36 },
        { l: 'K₂O',  v: resumoNutri.K != null ? `${resumoNutri.K} kg/ha`  : '—', x: ML + 68 },
        { l: 'B',    v: resumoNutri.B  != null ? `${resumoNutri.B} kg/ha`  : '—', x: ML + 100 },
      ];
      cols.forEach(c => {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7); rgb(80, 100, 85);
        doc.text(c.l, c.x, y + 9);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9); rgb(...V_ESC);
        doc.text(c.v, c.x, y + 13.5);
      });

      // Micronutrientes à direita
      const micros = [
        resumoNutri.Zn && `Zn: ${resumoNutri.Zn}`,
        resumoNutri.Cu && `Cu: ${resumoNutri.Cu}`,
        resumoNutri.Mn && `Mn: ${resumoNutri.Mn}`,
      ].filter(Boolean);
      if (micros.length) {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); rgb(60, 100, 70);
        doc.text(micros.join('   '), PW - MR - 4, y + 10.5, { align: 'right' });
      }

      // Calagem da análise (diferente do produto de calagem)
      if (resumoNutri.calagem?.necessidade && resumoNutri.calagem.nc) {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); rgb(...CAL_BD);
        doc.text(`Calagem indicada: ${resumoNutri.calagem.nc} t/ha  (V%: ${resumoNutri.calagem.vAtual ?? '—'}% → 60%)`, PW - MR - 4, y + 4.5, { align: 'right' });
      }
      y += 16;
    }

    // ── Itens NPK/B ──
    itens.forEach((item, idx) => {
      const { metricas, produto, nutrientes, numAplic, parcelas, doseProdHa } = item;
      const nomeProd = item.plan.produto_nome || produto?.nome || '—';
      const fornec   = produto?.fornecedor || '';

      // Altura estimada: 22 base + 7 por parcela (quando > 1)
      const altItem = 22 + (numAplic > 1 ? numAplic * 8 + 4 : 0);
      checkY(altItem);

      // Card fundo
      fill(...(idx % 2 === 0 ? [255, 255, 255] : GRY2));
      doc.rect(ML, y, CW, altItem, 'F');

      // Borda colorida lateral
      fill(...V_MED); doc.rect(ML, y, 2.5, altItem, 'F');

      // Borda card
      draw(...GRY); lw(0.2);
      doc.rect(ML, y, CW, altItem, 'S');

      // Label nutriente(s)
      fill(...V_CLA); doc.rect(ML + 2.5, y + 2, 30, 5.5, 'F');
      rgb(...V_ESC);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
      doc.text(nutrientes.join(' + '), ML + 4, y + 6);

      // Nome produto
      rgb(20, 20, 20);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5);
      doc.text(nomeProd.substring(0, 65), ML + 35, y + 6);
      if (fornec) {
        doc.setFont('helvetica', 'italic'); doc.setFontSize(7.5); rgb(110, 110, 110);
        doc.text(fornec.substring(0, 45), ML + 35, y + 11);
      }

      // Métricas linha principal
      if (metricas) {
        const fields = [
          { l: 'Dose produto',  v: `${metricas.doseProdHa} kg/ha` },
          { l: 'Total talhão',  v: `${metricas.totalKg.toLocaleString('pt-BR')} kg` },
          { l: 'Sacos 50 kg',   v: `${metricas.sc50} sc` },
          metricas.gPlanta && { l: 'g / planta', v: `${metricas.gPlanta} g` },
          metricas.gMetro  && { l: 'g / metro',  v: `${metricas.gMetro} g`  },
        ].filter(Boolean);

        let mx = ML + 4;
        const my = y + 18;
        fields.forEach(f => {
          const tw = Math.max(doc.getTextWidth(f.v) + 4, doc.getTextWidth(f.l) + 4) + 4;
          fill(...V_CLA); doc.rect(mx, my - 5, tw, 8, 'F');
          draw(...V_CLA); doc.rect(mx, my - 5, tw, 8, 'S');
          rgb(80, 100, 85); doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5);
          doc.text(f.l, mx + tw / 2, my - 2, { align: 'center' });
          rgb(...V_ESC); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
          doc.text(f.v, mx + tw / 2, my + 2, { align: 'center' });
          mx += tw + 2;
        });

        // Nº aplicações à direita
        rgb(80, 80, 80); doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
        doc.text(`${numAplic}x aplic.`, PW - MR - 4, y + 6, { align: 'right' });
        const mesesFlat = getMesesFlat(item.plan.meses || []);
        if (mesesFlat) {
          doc.setFontSize(7.5); rgb(100, 100, 100);
          doc.text(`Meses: ${mesesFlat}`, PW - MR - 4, y + 11, { align: 'right' });
        }
      }

      // Parcelas (se > 1 aplicação)
      if (numAplic > 1 && metricas) {
        const py = y + 24;
        // Linha divisória sutil
        draw(...GRY); lw(0.1);
        doc.line(ML + 4, py - 2, ML + CW - 4, py - 2);

        doc.setFont('helvetica', 'bold'); doc.setFontSize(7); rgb(...V_ESC);
        doc.text('Parcelamento:', ML + 5, py + 1.5);

        parcelas.forEach((parc, pi) => {
          const px = ML + 5 + pi * 34;
          checkY(0);
          fill(248, 252, 248); draw(...GRY); lw(0.1);
          doc.rect(px, py + 4, 31, 15, 'FD');

          rgb(...V_ESC); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
          doc.text(`${parc.label} — ${parc.pct}%`, px + 2, py + 8.5);

          rgb(40, 40, 40); doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
          const ls = [
            parc.kg   != null ? `${parc.kg.toLocaleString('pt-BR')} kg (${parc.kgHa} kg/ha)` : null,
            parc.sc50 != null ? `${parc.sc50} sacos 50 kg`  : null,
            parc.gPlanta ? `${parc.gPlanta} g/planta` : null,
            parc.gMetro  ? `${parc.gMetro} g/metro`  : null,
            parc.meses   ? `Meses: ${parc.meses}`     : null,
          ].filter(Boolean);
          ls.forEach((l, li) => doc.text(l, px + 2, py + 13 + li * 3.5));
        });
      }

      if (item.plan.observacoes) {
        const obsY = y + altItem - 4;
        doc.setFont('helvetica', 'italic'); doc.setFontSize(7); rgb(120, 120, 120);
        doc.text(`Obs: ${item.plan.observacoes.substring(0, 90)}`, ML + 5, obsY);
      }

      y += altItem + 3;
    });

    // ── Item de calagem ──
    if (calagemItem) {
      const { plan, produto, doseHa, metricas } = calagemItem;
      const altCal = 22;
      checkY(altCal);

      fill(...CAL_BG); doc.rect(ML, y, CW, altCal, 'F');
      fill(...CAL_BD); doc.rect(ML, y, 2.5, altCal, 'F');
      draw(180, 210, 150); lw(0.2);
      doc.rect(ML, y, CW, altCal, 'S');

      // Badge calagem
      fill(180, 220, 140); doc.rect(ML + 2.5, y + 2, 28, 5.5, 'F');
      rgb(40, 90, 30); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
      doc.text('CALAGEM', ML + 4, y + 6);

      // Nome produto
      const nomeCal = plan.produto_nome || produto?.nome || '—';
      rgb(20, 20, 20); doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5);
      doc.text(nomeCal.substring(0, 65), ML + 33, y + 6);

      if (metricas) {
        const calFields = [
          { l: 'Dose',         v: `${metricas.doseProdHa} kg/ha` },
          { l: 'Total talhão', v: `${metricas.totalKg.toLocaleString('pt-BR')} kg` },
          { l: 'Sacos 50 kg',  v: `${metricas.sc50} sc` },
        ];
        let mx2 = ML + 4;
        const my2 = y + 18;
        calFields.forEach(f => {
          const tw = Math.max(doc.getTextWidth(f.v), doc.getTextWidth(f.l)) + 10;
          fill(220, 245, 200); doc.rect(mx2, my2 - 5, tw, 8, 'F');
          rgb(60, 100, 40); doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5);
          doc.text(f.l, mx2 + tw / 2, my2 - 2, { align: 'center' });
          doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
          doc.text(f.v, mx2 + tw / 2, my2 + 2, { align: 'center' });
          mx2 += tw + 2;
        });
      }

      y += altCal + 3;
    }

    y += 6;
  }

  doc.save(`Adubacao_${produtor.codigo}_Safra${safra.replace('/', '-')}.pdf`);
}

// ── Componente ───────────────────────────────────────────────────────────────

export default function AbaExportarPDF({ produtor, safra, talhoes }) {
  const [gerando, setGerando] = useState(false);
  const codigoProdutor = produtor?.codigo;

  const { data: planejamentos = [], isLoading: loadingPlan } = useQuery({
    queryKey: ['base_planejamento_pdf', codigoProdutor, safra],
    queryFn: () => codigoProdutor && safra
      ? base44.entities.BasePlanejamentoAdubacao.filter({ codigo_produtor: codigoProdutor, safra })
      : Promise.resolve([]),
    enabled: !!(codigoProdutor && safra),
  });

  const { data: fertilizantes = [] } = useQuery({ queryKey: ['fertilizantes'], queryFn: () => base44.entities.FertilizanteFormulado.list() });
  const { data: fontesSimples  = [] } = useQuery({ queryKey: ['fontes_simples'],  queryFn: () => base44.entities.FonteSimples.list() });

  const { data: analises = [] } = useQuery({
    queryKey: ['analises_pdf', codigoProdutor, safra],
    queryFn: () => codigoProdutor && safra
      ? base44.entities.AnaliseSolo.filter({ codigo_produtor: codigoProdutor, safra })
      : Promise.resolve([]),
    enabled: !!(codigoProdutor && safra),
  });
  const { data: analises2040 = [] } = useQuery({
    queryKey: ['analises2040_pdf', codigoProdutor, safra],
    queryFn: () => codigoProdutor && safra
      ? base44.entities.AnaliseSolo2040.filter({ codigo_produtor: codigoProdutor, safra })
      : Promise.resolve([]),
    enabled: !!(codigoProdutor && safra),
  });
  const { data: planosLeg = [] } = useQuery({
    queryKey: ['planos_leg_pdf', codigoProdutor, safra],
    queryFn: () => codigoProdutor && safra
      ? base44.entities.PlanoAdubacao.filter({ codigo_produtor: codigoProdutor, safra })
      : Promise.resolve([]),
    enabled: !!(codigoProdutor && safra),
  });

  const todosProdutos = useMemo(() => [
    ...fertilizantes.map(f => ({ ...f })),
    ...fontesSimples.map(f  => ({ ...f })),
  ], [fertilizantes, fontesSimples]);

  const talhoesProdutor = useMemo(() =>
    talhoes.filter(t => t.codigo_produtor === codigoProdutor),
    [talhoes, codigoProdutor]);

  const dadosTalhoes = useMemo(() =>
    talhoesProdutor.map(t => buildTalhaoDados(t, planejamentos, todosProdutos, analises, analises2040, planosLeg)),
    [talhoesProdutor, planejamentos, todosProdutos, analises, analises2040, planosLeg]);

  const totalItens = useMemo(() =>
    dadosTalhoes.reduce((s, d) => s + d.itens.length + (d.calagemItem ? 1 : 0), 0),
    [dadosTalhoes]);

  const isLoading = loadingPlan;

  const handleGerar = async () => {
    if (!produtor || !safra) return;
    setGerando(true);
    try {
      gerarPDF(produtor, safra, dadosTalhoes, todosProdutos);
    } finally {
      setGerando(false);
    }
  };

  if (!produtor || !safra) return (
    <div className="text-center py-16 text-muted-foreground">
      <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
      <p className="text-lg font-medium">Selecione produtor e safra para exportar.</p>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="bg-card border border-border rounded-2xl p-6 space-y-5">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <FileDown className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-base">Exportar Planejamento de Adubação</h3>
            <p className="text-xs text-muted-foreground">PDF profissional com recomendação, parcelas, doses e totais por talhão</p>
          </div>
        </div>

        {/* Resumo do contexto */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Produtor',  value: produtor.nome },
            { label: 'Fazenda',   value: produtor.fazenda || '—' },
            { label: 'Safra',     value: safra },
            { label: 'Talhões',   value: `${talhoesProdutor.length}` },
          ].map(c => (
            <div key={c.label} className="bg-muted/30 rounded-xl p-3">
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="font-semibold text-sm truncate">{c.value}</p>
            </div>
          ))}
        </div>

        {/* Status itens */}
        {isLoading ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando planejamentos...
          </p>
        ) : (
          <div className="rounded-xl border p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Conteúdo a exportar</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {dadosTalhoes.map(({ talhao, itens, calagemItem }) => {
                const n = itens.length + (calagemItem ? 1 : 0);
                return (
                  <div key={talhao.id} className={`flex items-center gap-2 p-2.5 rounded-lg border text-sm ${n > 0 ? 'bg-green-50 border-green-200' : 'bg-muted/30 border-border'}`}>
                    {n > 0
                      ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                      : <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                    }
                    <span className="font-medium truncate">{talhao.nome}</span>
                    <span className="ml-auto text-xs text-muted-foreground shrink-0">
                      {n > 0 ? `${n} produto(s)` : 'sem plan.'}
                    </span>
                  </div>
                );
              })}
            </div>
            {totalItens === 0 && (
              <p className="text-amber-700 text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Nenhum produto com dose encontrado. Salve o planejamento antes de exportar.
              </p>
            )}
          </div>
        )}

        {/* Botão */}
        <Button
          onClick={handleGerar}
          disabled={gerando || isLoading || totalItens === 0}
          className="gap-2 h-11 text-base"
          size="lg"
        >
          {gerando ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileDown className="w-5 h-5" />}
          {gerando ? 'Gerando PDF...' : 'Gerar PDF — Todos os Talhões'}
        </Button>

        {/* Legenda do conteúdo */}
        <div className="bg-muted/20 rounded-xl p-4 text-xs text-muted-foreground">
          <p className="font-semibold mb-2 text-foreground">O PDF inclui:</p>
          <ul className="list-disc list-inside space-y-0.5 columns-1 sm:columns-2">
            <li>Cabeçalho com produtor, fazenda, safra, engenheiro e data</li>
            <li>Resumo geral de compra por produto (kg, sacos, toneladas)</li>
            <li>Resumo nutricional por talhão (N, P₂O₅, K₂O, B, micronutrientes)</li>
            <li>Por produto: dose kg/ha, total kg, sacos 50 kg, g/planta, g/metro</li>
            <li>Parcelamento detalhado por aplicação (% + kg + meses)</li>
            <li>Calagem quando enviada ao planejamento</li>
            <li>Apenas produtos efetivamente selecionados com dose</li>
          </ul>
        </div>
      </div>
    </div>
  );
}