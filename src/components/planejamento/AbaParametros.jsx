import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Save, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const PARAMS_DEFAULT = [
  { chave: 'diesel', label: 'Diesel', valor: 6.5, unidade: 'R$/L' },
  { chave: 'tarifa_verde', label: 'Tarifa CEMIG Verde', valor: 0.85, unidade: 'R$/kWh' },
  { chave: 'tarifa_azul', label: 'Tarifa CEMIG Azul', valor: 0.60, unidade: 'R$/kWh' },
  { chave: 'diaria_mo', label: 'Diária Mão de Obra', valor: 150, unidade: 'R$/dia' },
  { chave: 'salario_turma', label: 'Salário mensal turma colheita', valor: 2500, unidade: 'R$/mês' },
];

export default function AbaParametros() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [params, setParams] = useState({});

  const { data: tratores = [], isLoading: loadTrat } = useQuery({
    queryKey: ['base_tratores'], queryFn: () => base44.entities.BaseTratores.list(undefined, 5000),
  });
  const { data: secadores = [], isLoading: loadSec } = useQuery({
    queryKey: ['base_secadores'], queryFn: () => base44.entities.BaseSecadores.list(undefined, 5000),
  });
  const { data: savedParams = [] } = useQuery({
    queryKey: ['params_plan'], queryFn: () => base44.entities.ParametrosPlanejamento.list(undefined, 5000),
  });

  useEffect(() => {
    const map = {};
    PARAMS_DEFAULT.forEach(p => { map[p.chave] = p.valor; });
    const list = Array.isArray(savedParams) ? savedParams : [];
    list.forEach(p => { map[p.chave] = p.valor; });
    setParams(map);
  }, [savedParams]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      for (const def of PARAMS_DEFAULT) {
        const list = Array.isArray(savedParams) ? savedParams : [];
        const existing = list.find(p => p.chave === def.chave);
        const data = { chave: def.chave, label: def.label, valor: Number(params[def.chave]) || 0, unidade: def.unidade };
        if (existing) await base44.entities.ParametrosPlanejamento.update(existing.id, data);
        else await base44.entities.ParametrosPlanejamento.create(data);
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['params_plan'] }); toast({ title: 'Parâmetros salvos!' }); },
    onError: err => toast({ title: 'Erro', description: String(err?.message), variant: 'destructive' }),
  });

  return (
    <div className="space-y-8 mt-4">
      {/* Preços de referência */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">💰 Preços de Referência</h3>
          <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="gap-1.5">
            {saveMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Salvar
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {PARAMS_DEFAULT.map(p => (
            <div key={p.chave}>
              <label className="text-xs text-muted-foreground block mb-1">{p.label} ({p.unidade})</label>
              <Input
                type="number"
                step="0.01"
                value={params[p.chave] ?? p.valor}
                onChange={e => setParams(prev => ({ ...prev, [p.chave]: e.target.value }))}
                className="h-8 text-sm"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Tratores */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="bg-muted/40 px-4 py-3 border-b border-border">
          <h3 className="font-semibold text-sm">🚜 Base de Tratores</h3>
        </div>
        {loadTrat ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Marca</TableHead>
                  <TableHead>Modelo</TableHead>
                  <TableHead className="text-right">cv</TableHead>
                  <TableHead className="text-center">Cafeiro</TableHead>
                  <TableHead className="text-right">Sem Impl. (L/h)</TableHead>
                  <TableHead className="text-right">Roçada (L/h)</TableHead>
                  <TableHead className="text-right">Trincha (L/h)</TableHead>
                  <TableHead className="text-right">Carreta (L/h)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tratores.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground text-sm">Nenhum trator cadastrado ainda</TableCell></TableRow>
                ) : tratores.map(t => (
                  <TableRow key={t.id}>
                    <TableCell>{t.marca}</TableCell>
                    <TableCell>{t.modelo}</TableCell>
                    <TableCell className="text-right">{t.cv}</TableCell>
                    <TableCell className="text-center">{t.cafeiro ? '✔' : '—'}</TableCell>
                    <TableCell className="text-right">{t.consumo_sem_implemento}</TableCell>
                    <TableCell className="text-right">{t.consumo_rocada}</TableCell>
                    <TableCell className="text-right">{t.consumo_trincha}</TableCell>
                    <TableCell className="text-right">{t.consumo_carreta_pesada}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Secadores */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="bg-muted/40 px-4 py-3 border-b border-border">
          <h3 className="font-semibold text-sm">🔥 Base de Secadores</h3>
        </div>
        {loadSec ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Marca/Modelo</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Cap. (sc)</TableHead>
                  <TableHead className="text-right">kW total</TableHead>
                  <TableHead className="text-right">kWh/bat</TableHead>
                  <TableHead className="text-right">kWh/saca</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {secadores.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-sm">Nenhum secador cadastrado ainda</TableCell></TableRow>
                ) : secadores.map(s => (
                  <TableRow key={s.id}>
                    <TableCell>{s.marca_modelo}</TableCell>
                    <TableCell>{s.tipo}</TableCell>
                    <TableCell className="text-right">{s.capacidade_sacas}</TableCell>
                    <TableCell className="text-right">{s.potencia_kw}</TableCell>
                    <TableCell className="text-right">{s.kwh_batelada}</TableCell>
                    <TableCell className="text-right">{s.kwh_saca}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}