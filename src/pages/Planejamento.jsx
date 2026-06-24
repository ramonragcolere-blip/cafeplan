import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AbaVisaoGeral from '@/components/planejamento/AbaVisaoGeral';
import AbaOperacoes from '@/components/planejamento/AbaOperacoes';
import AbaPosColheita from '@/components/planejamento/AbaPosColheita';
import AbaParametros from '@/components/planejamento/AbaParametros';

const SAFRAS = ['2024/2025', '2025/2026', '2026/2027', '2027/2028'];

export default function Planejamento() {
  const [produtorSel, setProdutorSel] = useState('');
  const [safraSel, setSafraSel] = useState('2025/2026');

  const { data: produtores = [] } = useQuery({
    queryKey: ['produtores'],
    queryFn: () => base44.entities.Produtor.list(),
  });

  const { data: talhoes = [] } = useQuery({
    queryKey: ['talhoes', produtorSel],
    queryFn: () => base44.entities.Talhao.filter({ codigo_produtor: produtorSel }),
    enabled: !!produtorSel,
  });

  const { data: equipamentos = [] } = useQuery({
    queryKey: ['equipamentos', produtorSel],
    queryFn: () => base44.entities.EquipamentosProdutor.filter({ codigo_produtor: produtorSel }),
    enabled: !!produtorSel,
  });

  const { data: planejamentosAdubacao = [] } = useQuery({
    queryKey: ['planejamentosAdubacao2', produtorSel, safraSel],
    queryFn: () => base44.entities.BasePlanejamentoAdubacao.filter({ codigo_produtor: produtorSel, safra: safraSel }),
    enabled: !!produtorSel && !!safraSel,
  });

  const produtor = produtores.find(p => p.codigo === produtorSel) || null;
  const equip = equipamentos[0] || null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Planejamento</h1>
          <p className="text-muted-foreground mt-1">Custos e operações por safra</p>
        </div>
      </div>

      {/* Seletores */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 max-w-xs">
          <Select value={produtorSel} onValueChange={setProdutorSel}>
            <SelectTrigger><SelectValue placeholder="Selecionar produtor..." /></SelectTrigger>
            <SelectContent>
              {produtores.map(p => (
                <SelectItem key={p.id} value={p.codigo}>{p.codigo} — {p.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-48">
          <Select value={safraSel} onValueChange={setSafraSel}>
            <SelectTrigger><SelectValue placeholder="Safra" /></SelectTrigger>
            <SelectContent>
              {SAFRAS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!produtorSel ? (
        <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
          Selecione um produtor para continuar
        </div>
      ) : (
        <Tabs defaultValue="visao_geral">
          <TabsList className="grid grid-cols-4 w-full max-w-xl">
            <TabsTrigger value="visao_geral">Visão Geral</TabsTrigger>
            <TabsTrigger value="operacoes">Operações</TabsTrigger>
            <TabsTrigger value="pos_colheita">Pós-Colheita</TabsTrigger>
            <TabsTrigger value="parametros">Parâmetros</TabsTrigger>
          </TabsList>

          <TabsContent value="visao_geral">
            <AbaVisaoGeral
              talhoes={talhoes}
              produtor={produtor}
              safra={safraSel}
              planejamentosAdubacao={planejamentosAdubacao}
            />
          </TabsContent>

          <TabsContent value="operacoes">
            <AbaOperacoes
              talhoes={talhoes}
              produtor={produtor}
              equip={equip}
              safra={safraSel}
              codigoProdutor={produtorSel}
            />
          </TabsContent>

          <TabsContent value="pos_colheita">
            <AbaPosColheita
              talhoes={talhoes}
              produtor={produtor}
              equip={equip}
              safra={safraSel}
              codigoProdutor={produtorSel}
            />
          </TabsContent>

          <TabsContent value="parametros">
            <AbaParametros />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}