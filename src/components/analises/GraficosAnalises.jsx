import React, { useMemo } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell,
} from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CORES, fmtR, fmtNum } from '@/components/analises/helpers';
import {
  dadosGraficoTemporal, dadosDistribuicaoMensal, agregarPorProduto, agregarPorCategoria, agregarPorTalhao, MESES,
} from '@/lib/analisesEstoque';

const COR = (i) => CORES[i % CORES.length];

// ---- Tooltip temporal/distribuição (soma da stack + por série) ----
function TooltipTemporal({ active, payload, label, metrica }) {
  if (!active || !payload || !payload.length) return null;
  const total = payload.reduce((s, p) => s + (Number(p.value) || 0), 0);
  const fmtV = metrica === 'custo' ? fmtR : fmtNum;
  return (
    <div className="bg-card border border-border rounded-lg shadow-lg p-3 text-xs max-w-[260px]">
      <p className="font-semibold mb-1">{label}</p>
      <p className="mb-1 text-muted-foreground">Total: <span className="font-semibold text-foreground">{fmtV(Math.round(total * 100) / 100)}</span>{metrica === 'area' ? ' ha' : ''}</p>
      <div className="space-y-0.5">
        {payload.filter((p) => p.value > 0).map((p) => (
          <div key={p.dataKey} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 truncate">
              <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
              {p.dataKey}
            </span>
            <span className="tabular-nums font-medium">{fmtV(p.value)}{metrica === 'area' ? ' ha' : ''}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Tooltip do gráfico por produto ----
function TooltipProduto({ active, payload, metrica }) {
  if (!active || !payload || !payload.length) return null;
  const r = payload[0].payload;
  const fmtV = metrica === 'custo' ? fmtR : (metrica === 'area' ? (v) => `${fmtNum(v)} ha` : fmtNum);
  return (
    <div className="bg-card border border-border rounded-lg shadow-lg p-3 text-xs max-w-[260px]">
      <p className="font-semibold">{r.nome}</p>
      <p className="text-muted-foreground">{r.categoria}</p>
      <div className="mt-1 space-y-0.5">
        <p>Nº aplicações: <span className="font-semibold">{r.aplicacoes}</span></p>
        <p>Qtd. utilizada: <span className="font-semibold">{fmtNum(r.qtd_total)} {r.unidade_base}</span></p>
        <p>Área estimada: <span className="font-semibold">{r.area != null ? `${fmtNum(r.area)} ha` : '—'}</span></p>
        {metrica === 'custo' && <p>Custo total: <span className="font-semibold">{fmtR(r.custo)}</span></p>}
      </div>
    </div>
  );
}

function TooltipCategoria({ active, payload, metrica }) {
  if (!active || !payload || !payload.length) return null;
  const r = payload[0].payload;
  const fmtV = metrica === 'custo' ? fmtR : (metrica === 'area' ? (v) => `${fmtNum(v)} ha` : fmtNum);
  return (
    <div className="bg-card border border-border rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold">{r.categoria}</p>
      <div className="mt-1 space-y-0.5">
        <p>Nº aplicações: <span className="font-semibold">{r.aplicacoes}</span></p>
        <p>Área estimada: <span className="font-semibold">{r.area != null ? `${fmtNum(r.area)} ha` : '—'}</span></p>
        <p>Custo total: <span className="font-semibold">{fmtR(r.custo)}</span></p>
      </div>
      <p className="mt-1 text-muted-foreground">Clique para focar esta categoria</p>
    </div>
  );
}

function Vazio({ texto }) {
  return <div className="h-72 flex items-center justify-center text-sm text-muted-foreground">{texto}</div>;
}

function CabecalhoGrafico({ titulo, sub, children }) {
  return (
    <div className="px-5 py-3 border-b border-border flex items-center justify-between gap-2 flex-wrap">
      <div>
        <h3 className="font-semibold text-sm">{titulo}</h3>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

// ============ GRÁFICO TEMPORAL ============
export function GraficoTemporal({ aplicacoes, agruparPor, setAgruparPor, metrica, categoriaFoco, onDrillDown }) {
  const { data, series } = useMemo(
    () => dadosGraficoTemporal(aplicacoes, { agruparPor, metrica, categoriaFoco }),
    [aplicacoes, agruparPor, metrica, categoriaFoco],
  );
  const titulo = metrica === 'custo' ? 'Custo ao longo do tempo' : metrica === 'area' ? 'Área estimada ao longo do tempo' : 'Aplicações ao longo do tempo';
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <CabecalhoGrafico titulo={titulo} sub="Clique em uma barra para detalhar os registros">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Agrupar por:</span>
          <Select value={agruparPor} onValueChange={setAgruparPor}>
            <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="produto">Produto</SelectItem>
              <SelectItem value="categoria">Categoria</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CabecalhoGrafico>
      {!data.length ? <Vazio texto="Sem aplicações no período selecionado." /> : (
        <div className="p-4">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={data} margin={{ top: 10, right: 16, bottom: 5, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="mes" tick={{ fontSize: 12 }} angle={-0} dy={4} />
              <YAxis tick={{ fontSize: 12 }} width={48} tickFormatter={(v) => metrica === 'custo' ? fmtR(v) : fmtNum(v)} />
              <Tooltip content={<TooltipTemporal metrica={metrica} />} cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {series.map((s, i) => (
                <Bar key={s} dataKey={s} stackId="a" fill={COR(i)}
                  onClick={(payload, index) => {
                    const mes = data[index]?.mes;
                    onDrillDown({
                      titulo: `${titulo} — ${s}${mes ? ` · ${mes}` : ''}`,
                      filtro: {
                        ...(agruparPor === 'categoria' ? { categoria: s } : { produto: s }),
                        ...(mes ? { mes } : {}),
                      },
                    });
                  }}
                  cursor="pointer" radius={[2, 2, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ============ GRÁFICO POR PRODUTO (barras horizontais) ============
export function GraficoPorProduto({ aplicacoes, metrica, categoriaFoco, onDrillDown }) {
  const dados = useMemo(() => {
    const arr = agregarPorProduto(aplicacoes, categoriaFoco);
    const key = metrica === 'custo' ? 'custo' : metrica === 'area' ? 'area' : 'aplicacoes';
    return arr
      .map((r) => ({ ...r, valor: r[key] || 0 }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 15);
  }, [aplicacoes, metrica, categoriaFoco]);
  const titulo = metrica === 'custo' ? 'Custo por Produto' : metrica === 'area' ? 'Área estimada por Produto' : 'Aplicações por Produto';
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <CabecalhoGrafico titulo={titulo} sub="Top 15 — clique em uma barra para detalhar" />
      {!dados.length ? <Vazio texto="Sem produtos no período selecionado." /> : (
        <div className="p-4">
          <ResponsiveContainer width="100%" height={Math.max(260, dados.length * 34)}>
            <BarChart data={dados} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => metrica === 'custo' ? fmtR(v) : fmtNum(v)} />
              <YAxis type="category" dataKey="nome" tick={{ fontSize: 11 }} width={130} />
              <Tooltip content={<TooltipProduto metrica={metrica} />} cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
              <Bar dataKey="valor" radius={[0, 4, 4, 0]} cursor="pointer"
                onClick={(payload) => onDrillDown({
                  titulo: `${titulo} — ${payload.payload.nome}`,
                  filtro: { produto: payload.payload.nome },
                })}>
                {dados.map((d, i) => (
                  <Cell key={d.nome} fill={categoriaFoco && d.categoria !== categoriaFoco ? '#cbd5e1' : COR(i)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ============ GRÁFICO POR CATEGORIA (clicável -> foco) ============
export function GraficoPorCategoria({ aplicacoes, metrica, categoriaFoco, setCategoriaFoco }) {
  const dados = useMemo(() => {
    const arr = agregarPorCategoria(aplicacoes);
    const key = metrica === 'custo' ? 'custo' : metrica === 'area' ? 'area' : 'aplicacoes';
    return arr.map((r) => ({ ...r, valor: r[key] || 0 })).sort((a, b) => b.valor - a.valor);
  }, [aplicacoes, metrica]);
  const titulo = metrica === 'custo' ? 'Custo por Categoria' : metrica === 'area' ? 'Área por Categoria' : 'Aplicações por Categoria';
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <CabecalhoGrafico titulo={titulo} sub="Clique em uma categoria para focar os gráficos">
        {categoriaFoco && (
          <button
            className="text-xs text-primary hover:underline"
            onClick={() => setCategoriaFoco(null)}
          >Limpar seleção</button>
        )}
      </CabecalhoGrafico>
      {!dados.length ? <Vazio texto="Sem categorias no período selecionado." /> : (
        <div className="p-4">
          <ResponsiveContainer width="100%" height={Math.max(220, dados.length * 38)}>
            <BarChart data={dados} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => metrica === 'custo' ? fmtR(v) : fmtNum(v)} />
              <YAxis type="category" dataKey="categoria" tick={{ fontSize: 11 }} width={120} />
              <Tooltip content={<TooltipCategoria metrica={metrica} />} cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
              <Bar dataKey="valor" radius={[0, 4, 4, 0]} cursor="pointer"
                onClick={(payload) => {
                  const c = payload.payload.categoria;
                  setCategoriaFoco(categoriaFoco === c ? null : c);
                }}>
                {dados.map((d, i) => (
                  <Cell key={d.categoria} fill={categoriaFoco && d.categoria !== categoriaFoco ? '#cbd5e1' : COR(i)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ============ GRÁFICO POR TALHÃO (barras horizontais, clicável) ============
function TooltipTalhao({ active, payload, metrica }) {
  if (!active || !payload || !payload.length) return null;
  const r = payload[0].payload;
  const fmtV = metrica === 'custo' ? fmtR : (metrica === 'area' ? (v) => `${fmtNum(v)} ha` : fmtNum);
  return (
    <div className="bg-card border border-border rounded-lg shadow-lg p-3 text-xs max-w-[260px]">
      <p className="font-semibold">{r.nome}</p>
      <div className="mt-1 space-y-0.5">
        <p>Nº aplicações: <span className="font-semibold">{r.aplicacoes}</span></p>
        <p>Área aplicada: <span className="font-semibold">{r.area != null ? `${fmtNum(r.area)} ha` : '—'}</span></p>
        {metrica === 'custo' && <p>Custo total: <span className="font-semibold">{fmtR(r.custo)}</span></p>}
        {r.talhao_id == null && <p className="text-muted-foreground">Registros antigos sem talhão informado</p>}
        {r.talhao_id != null && <p className="text-muted-foreground mt-1">Clique para filtrar este talhão</p>}
      </div>
    </div>
  );
}

export function GraficoPorTalhao({ aplicacoes, metrica, onSelecionarTalhao }) {
  const dados = useMemo(() => {
    const arr = agregarPorTalhao(aplicacoes);
    const key = metrica === 'custo' ? 'custo' : metrica === 'area' ? 'area' : 'aplicacoes';
    return arr
      .map((r) => ({ ...r, valor: r[key] || 0 }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 15);
  }, [aplicacoes, metrica]);
  const titulo = metrica === 'custo' ? 'Custo por Talhão' : metrica === 'area' ? 'Área aplicada por Talhão' : 'Aplicações por Talhão';
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <CabecalhoGrafico titulo={titulo} sub="Top 15 — clique em um talhão para filtrar" />
      {!dados.length ? <Vazio texto="Sem talhões com aplicações no período." /> : (
        <div className="p-4">
          <ResponsiveContainer width="100%" height={Math.max(220, dados.length * 36)}>
            <BarChart data={dados} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => metrica === 'custo' ? fmtR(v) : fmtNum(v)} />
              <YAxis type="category" dataKey="nome" tick={{ fontSize: 11 }} width={140} />
              <Tooltip content={<TooltipTalhao metrica={metrica} />} cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
              <Bar dataKey="valor" radius={[0, 4, 4, 0]} cursor={dados.some((d) => d.talhao_id != null) ? 'pointer' : 'default'}
                onClick={(payload) => {
                  const id = payload.payload.talhao_id;
                  if (id != null) onSelecionarTalhao?.(id);
                }}>
                {dados.map((d, i) => (
                  <Cell key={d.nome || i} fill={d.talhao_id == null ? '#cbd5e1' : COR(i)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ============ DISTRIBUIÇÃO MENSAL POR CATEGORIA (empilhado) ============
export function DistribuicaoMensal({ aplicacoes, metrica, categoriaFoco, onDrillDown }) {
  const { data, series } = useMemo(
    () => dadosDistribuicaoMensal(aplicacoes, { metrica, categoriaFoco }),
    [aplicacoes, metrica, categoriaFoco],
  );
  const titulo = metrica === 'custo' ? 'Distribuição mensal dos custos' : 'Distribuição mensal das aplicações';
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <CabecalhoGrafico titulo={titulo} sub="Meses do ano (anos agregados) — clique para detalhar" />
      {!series.length ? <Vazio texto="Sem dados para a distribuição." /> : (
        <div className="p-4">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data} margin={{ top: 10, right: 16, bottom: 5, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} width={48} tickFormatter={(v) => metrica === 'custo' ? fmtR(v) : fmtNum(v)} />
              <Tooltip content={<TooltipTemporal metrica={metrica} />} cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {series.map((s, i) => (
                <Bar key={s} dataKey={s} stackId="a" fill={COR(i)}
                  onClick={(payload, index) => onDrillDown({
                    titulo: `${titulo} — ${s} (${MESES[index]})`,
                    filtro: { mesIndex: index, categoria: s },
                  })}
                  cursor="pointer" radius={[2, 2, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}