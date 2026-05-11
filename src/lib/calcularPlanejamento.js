import { addDays, format } from 'date-fns';

/**
 * Avança uma data pulando os dias não trabalhados (considera dias por semana).
 * diasPorSemana: 5 = seg-sex, 6 = seg-sab, 7 = todos
 */
function adicionarDiasUteis(dataInicio, diasNecessarios, diasPorSemana) {
  if (!dataInicio || !diasNecessarios || diasNecessarios <= 0) return dataInicio;

  const diasSemana = Math.min(diasPorSemana || 6, 7);
  // Dias de trabalho: começando pela segunda (1) até (diasSemana)
  // diasPorSemana=6 → seg a sáb (1-6), =5 → seg a sex (1-5), =7 → todos (0-6)
  let diasRestantes = diasNecessarios;
  let data = new Date(dataInicio);

  while (diasRestantes > 0) {
    const dow = data.getDay(); // 0=dom, 1=seg ... 6=sab
    const trabalhado = isDiaUtil(dow, diasSemana);
    if (trabalhado) {
      diasRestantes -= 1;
    }
    if (diasRestantes > 0) {
      data = addDays(data, 1);
    }
  }
  return data;
}

function isDiaUtil(dow, diasPorSemana) {
  // diasPorSemana=6: trabalha seg(1) a sab(6)
  // diasPorSemana=5: trabalha seg(1) a sex(5)
  // diasPorSemana=7: trabalha todos
  if (diasPorSemana >= 7) return true;
  if (diasPorSemana >= 6) return dow !== 0; // não dom
  if (diasPorSemana >= 5) return dow !== 0 && dow !== 6; // não dom nem sab
  // genérico: trabalha os primeiros diasPorSemana dias da semana (seg em diante)
  return dow >= 1 && dow <= diasPorSemana;
}

function proximoDiaUtil(data, diasPorSemana) {
  let d = addDays(data, 1);
  let tentativas = 0;
  while (!isDiaUtil(d.getDay(), diasPorSemana) && tentativas < 10) {
    d = addDays(d, 1);
    tentativas++;
  }
  return d;
}

export function calcularPlanejamento(produtor, talhoes) {
  const {
    ref_medida_litros = 60,
    num_safristas = 4,
    medidas_por_safrista_dia = 15,
    preco_por_medida = 30,
    dias_por_semana = 6,
    mes_inicio,
    dia_inicio,
    ano_agricola,
  } = produtor;

  // Data de início do produtor
  const anoBase = ano_agricola ? parseInt(ano_agricola.split('/')[1] || ano_agricola) : new Date().getFullYear();
  const dataInicioProdutor = mes_inicio && dia_inicio
    ? new Date(anoBase, mes_inicio - 1, dia_inicio)
    : new Date();

  // Capacidade diária total
  const medidaDia = (num_safristas || 1) * (medidas_por_safrista_dia || 1);

  // Ordenar talhões por sequência de colheita
  const talhoesOrdenados = [...talhoes].sort((a, b) => {
    const seqA = a.seq_colheita ?? 9999;
    const seqB = b.seq_colheita ?? 9999;
    return seqA - seqB;
  });

  // Calcular para cada talhão
  let dataCorrente = new Date(dataInicioProdutor);
  const resultado = talhoesOrdenados.map((t) => {
    const litrosPe = t.litros_por_pe || 0;
    const plantas = t.num_plantas || 0;
    const pct = t.pct_colher ?? 1;
    const refMedida = ref_medida_litros || 60;

    const litrosTotais = plantas * litrosPe * pct;
    const medidasPrevistas = refMedida > 0 ? litrosTotais / refMedida : 0;
    const diasNecessarios = medidaDia > 0 ? medidasPrevistas / medidaDia : 0;
    const sacasEstimadas = litrosTotais / 480; // 1 saca = 480L café cereja
    const custoTalhao = medidasPrevistas * (t.preco_por_medida || preco_por_medida || 0);
    const semanas = dias_por_semana > 0 ? diasNecessarios / dias_por_semana : 0;

    let dataInicio = null;
    let dataFim = null;

    if (t.seq_colheita && diasNecessarios > 0) {
      dataInicio = new Date(dataCorrente);
      dataFim = adicionarDiasUteis(dataInicio, Math.ceil(diasNecessarios), dias_por_semana);
      // Próxima sequência começa no dia seguinte útil ao fim deste
      dataCorrente = proximoDiaUtil(dataFim, dias_por_semana);
    }

    return {
      ...t,
      litrosTotais,
      medidasPrevistas,
      diasNecessarios,
      sacasEstimadas,
      custoTalhao,
      semanas,
      dataInicio,
      dataFim,
    };
  });

  // Totais
  const totalLitros = resultado.reduce((s, t) => s + t.litrosTotais, 0);
  const totalMedidas = resultado.reduce((s, t) => s + t.medidasPrevistas, 0);
  const totalDias = medidaDia > 0 ? totalMedidas / medidaDia : 0;
  const totalSemanas = dias_por_semana > 0 ? totalDias / dias_por_semana : 0;
  const totalSacas = totalLitros / 480;
  const totalCusto = resultado.reduce((s, t) => s + t.custoTalhao, 0);

  // Data fim geral: talhão com maior seq que tenha dataFim
  const comDatas = resultado.filter(t => t.dataFim);
  const dataFimGeral = comDatas.length > 0
    ? comDatas.reduce((max, t) => (t.dataFim > max ? t.dataFim : max), comDatas[0].dataFim)
    : null;

  return {
    talhoes: resultado,
    totalLitros,
    totalMedidas,
    totalDias,
    totalSemanas,
    totalSacas,
    totalCusto,
    dataInicioProdutor,
    dataFimGeral,
    medidaDia,
  };
}