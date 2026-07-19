import React, { useMemo } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { prepararModalAnalisesAdubacao2 } from '@/lib/analisesAdubacao2';

function ListaCamposAnalise({ aba }) {
  if (!aba.campos.length) {
    return (
      <div className="rounded-md border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
        Análise não disponível para esta profundidade.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {aba.campos.map(campo => (
        <div key={campo.key} className="rounded-md border border-border bg-muted/10 px-3 py-2">
          <p className="text-[11px] font-medium text-muted-foreground">{campo.label}</p>
          <p className="mt-0.5 text-sm font-semibold text-foreground break-words">
            {campo.valor}
            {campo.unidade ? <span className="ml-1 text-xs font-normal text-muted-foreground">{campo.unidade}</span> : null}
          </p>
        </div>
      ))}
    </div>
  );
}

export default function ModalVerAnalisesTalhao({
  open,
  onClose,
  produtor,
  talhao,
  safra,
  analises,
  analises2040PorTalhao,
}) {
  const dados = useMemo(() => prepararModalAnalisesAdubacao2({
    produtor,
    talhao,
    safra,
    analises,
    analises2040PorTalhao,
  }), [produtor, talhao, safra, analises, analises2040PorTalhao]);

  return (
    <Dialog open={open} onOpenChange={aberto => { if (!aberto) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto [&>button.absolute]:hidden">
        <DialogHeader>
          <DialogTitle className="text-base">Análises do talhão</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
          <div>
            <p className="text-[11px] font-medium text-muted-foreground">Produtor</p>
            <p className="font-semibold text-foreground">{dados.produtorNome}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium text-muted-foreground">Talhão</p>
            <p className="font-semibold text-foreground">{dados.talhaoNome}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium text-muted-foreground">Safra</p>
            <p className="font-semibold text-foreground">{dados.safra}</p>
          </div>
        </div>

        <Tabs defaultValue="0-20" className="mt-2">
          <TabsList className="grid w-full grid-cols-2">
            {dados.abas.map(aba => (
              <TabsTrigger key={aba.id} value={aba.id}>{aba.label}</TabsTrigger>
            ))}
          </TabsList>
          {dados.abas.map(aba => (
            <TabsContent key={aba.id} value={aba.id} className="space-y-3">
              <div className="text-xs font-semibold text-muted-foreground">
                Profundidade: {aba.profundidade}
              </div>
              <ListaCamposAnalise aba={aba} />
            </TabsContent>
          ))}
        </Tabs>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
