import React, { useState, useRef, useCallback, useEffect } from 'react';
import Map, { NavigationControl, ScaleControl, Source, Layer, Popup } from 'react-map-gl';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Map as MapIcon, ChevronDown, Pencil, Mountain, Satellite } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || 'pk.eyJ1IjoicmFtb25yb2RyaWd1ZXNjYWZlcGxhbiIsImEiOiJjbXJjdG9ieWgwN2xzMnlxMW5rMnVtcTBhIn0.YjHp5YcBKhnVCVVFSqImAQ';

const INITIAL_VIEW = { longitude: -45.9, latitude: -21.5, zoom: 6, pitch: 0, bearing: 0 };

const MAP_STYLE = 'mapbox://styles/mapbox/satellite-streets-v12';

export default function MapaTalhoes() {
  const mapRef = useRef(null);
  const drawRef = useRef(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [produtorId, setProdutorId] = useState('');
  const [viewState, setViewState] = useState(INITIAL_VIEW);
  const [estilo, setEstilo] = useState('satelite');
  const [showSlope, setShowSlope] = useState(false);
  const [desenhando, setDesenhando] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const [geojsonPendente, setGeojsonPendente] = useState(null);
  const [novoTalhao, setNovoTalhao] = useState({ nome: '', produtor_id: '' });
  const [salvando, setSalvando] = useState(false);
  const [popupInfo, setPopupInfo] = useState(null); // { nome, longitude, latitude }

  const { data: produtores = [] } = useQuery({
    queryKey: ['produtores'],
    queryFn: () => base44.entities.Produtor.list(),
  });

  const { data: talhoes = [] } = useQuery({
    queryKey: ['talhoes_mapa'],
    queryFn: () => base44.entities.Talhao.list(),
  });

  const talhoesFiltrados = produtorId
    ? talhoes.filter((t) => t.produtor_id === produtorId || t.codigo_produtor === produtores.find(p => p.id === produtorId)?.codigo)
    : talhoes;

  const talhoesComPoligono = talhoesFiltrados.filter((t) => t.geojson_poligono);

  // GeoJSON combinado de todos os talhões com polígono
  const geojsonTalhoes = {
    type: 'FeatureCollection',
    features: talhoesComPoligono.map((t) => {
      try {
        const geom = typeof t.geojson_poligono === 'string' ? JSON.parse(t.geojson_poligono) : t.geojson_poligono;
        return { type: 'Feature', properties: { nome: t.nome, id: t.id }, geometry: geom };
      } catch {
        return null;
      }
    }).filter(Boolean),
  };

  const handleProdutorChange = (id) => {
    setProdutorId(id);
    const produtor = produtores.find((p) => p.id === id);
    if (produtor?.centro_mapa) {
      try {
        const centro = typeof produtor.centro_mapa === 'string' ? JSON.parse(produtor.centro_mapa) : produtor.centro_mapa;
        if (centro?.lng && centro?.lat) {
          setViewState((v) => ({ ...v, longitude: centro.lng, latitude: centro.lat, zoom: 13 }));
        }
      } catch (_) {}
    }
  };

  const setupTerrain = useCallback((map) => {
    if (!map.getSource('terrain-dem')) {
      map.addSource('terrain-dem', {
        type: 'raster-dem',
        url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
        tileSize: 512,
        maxzoom: 14,
      });
    }
    map.setTerrain({ source: 'terrain-dem', exaggeration: 1.5 });
  }, []);

  const onMapLoad = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    setupTerrain(map);

    // Inicializa o DrawControl
    const draw = new MapboxDraw({ displayControlsDefault: false });
    map.addControl(draw, 'top-left');
    drawRef.current = draw;

    map.on('draw.create', (e) => {
      const feature = e.features[0];
      if (!feature) return;
      setGeojsonPendente(feature.geometry);
      setNovoTalhao({ nome: '', produtor_id: '' });
      setModalAberto(true);
    });
  }, [setupTerrain]);

  // Re-adiciona terrain após mudança de estilo (mapa recria layers)
  const onStyleLoad = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    setupTerrain(map);
  }, [setupTerrain]);

  const toggleDesenho = () => {
    const draw = drawRef.current;
    if (!draw) return;
    if (desenhando) {
      draw.changeMode('simple_select');
      draw.deleteAll();
      setDesenhando(false);
    } else {
      draw.changeMode('draw_polygon');
      setDesenhando(true);
    }
  };

  const handleSalvarTalhao = async () => {
    if (!novoTalhao.nome.trim()) {
      toast({ title: 'Nome obrigatório', variant: 'destructive' });
      return;
    }
    const produtor = produtores.find((p) => p.id === novoTalhao.produtor_id);
    setSalvando(true);
    try {
      await base44.entities.Talhao.create({
        nome: novoTalhao.nome.trim(),
        produtor_id: novoTalhao.produtor_id || undefined,
        codigo_produtor: produtor?.codigo || '',
        geojson_poligono: JSON.stringify(geojsonPendente),
      });
      drawRef.current?.deleteAll();
      setDesenhando(false);
      setModalAberto(false);
      setGeojsonPendente(null);
      queryClient.invalidateQueries({ queryKey: ['talhoes_mapa'] });
      queryClient.invalidateQueries({ queryKey: ['talhoes'] });
      toast({ title: 'Talhão salvo!', description: `"${novoTalhao.nome}" adicionado ao mapa.` });
    } catch {
      toast({ title: 'Erro ao salvar', variant: 'destructive' });
    } finally {
      setSalvando(false);
    }
  };

  const handleModalClose = () => {
    drawRef.current?.deleteAll();
    setDesenhando(false);
    setModalAberto(false);
    setGeojsonPendente(null);
  };

  if (!MAPBOX_TOKEN) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <div className="bg-card border border-border rounded-xl p-8 max-w-md text-center space-y-3">
          <MapIcon className="w-10 h-10 text-muted-foreground mx-auto" />
          <h2 className="text-lg font-semibold">Token do Mapbox não configurado</h2>
          <p className="text-sm text-muted-foreground">
            Adicione <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">VITE_MAPBOX_TOKEN</code> nas variáveis de ambiente.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 0px)' }}>
      {/* Barra superior */}
      <div className="bg-card border-b border-border px-5 py-3 flex flex-wrap items-center gap-3 shrink-0 z-10">
        <div className="flex items-center gap-2">
          <MapIcon className="w-5 h-5 text-primary" />
          <h1 className="text-base font-bold text-foreground">Mapa de Talhões</h1>
        </div>

        {/* Seletor produtor */}
        <div className="relative">
          <select
            value={produtorId}
            onChange={(e) => handleProdutorChange(e.target.value)}
            className="h-9 pl-3 pr-8 text-sm border border-input rounded-lg bg-background appearance-none cursor-pointer min-w-[220px]"
          >
            <option value="">Todos os produtores</option>
            {produtores.map((p) => (
              <option key={p.id} value={p.id}>{p.nome || p.codigo || p.id}</option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 absolute right-2 top-2.5 text-muted-foreground pointer-events-none" />
        </div>

        <span className="text-xs text-muted-foreground">
          {talhoesFiltrados.length} talhão{talhoesFiltrados.length !== 1 ? 'es' : ''}
          {talhoesComPoligono.length > 0 && ` · ${talhoesComPoligono.length} mapeado${talhoesComPoligono.length !== 1 ? 's' : ''}`}
        </span>

        {/* Toggle Satélite / Declividade */}
        <div className="ml-auto flex items-center bg-muted rounded-lg p-0.5 gap-0.5">
          <button
            type="button"
            onClick={() => { setEstilo('satelite'); setShowSlope(false); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${estilo === 'satelite' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Satellite className="w-3.5 h-3.5" /> Satélite
          </button>
          <button
            type="button"
            onClick={() => { setEstilo('declividade'); setShowSlope(true); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${estilo === 'declividade' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Mountain className="w-3.5 h-3.5" /> Declividade
          </button>
        </div>

        {/* Botão desenhar */}
        <button
          type="button"
          onClick={toggleDesenho}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            desenhando
              ? 'bg-destructive text-destructive-foreground border-destructive'
              : 'bg-primary text-primary-foreground border-primary hover:bg-primary/90'
          }`}
        >
          <Pencil className="w-3.5 h-3.5" />
          {desenhando ? 'Cancelar Desenho' : 'Desenhar Talhão'}
        </button>
      </div>

      {/* Instrução de desenho */}
      {desenhando && (
        <div className="bg-amber-50 border-b border-amber-200 px-5 py-2 text-xs text-amber-800 shrink-0">
          Clique no mapa para adicionar pontos do polígono. Clique no primeiro ponto para fechar o polígono.
        </div>
      )}

      {/* Mapa */}
      <div className="flex-1 relative">
        <Map
          ref={mapRef}
          {...viewState}
          onMove={(evt) => setViewState(evt.viewState)}
          mapStyle={MAP_STYLE}
          mapboxAccessToken={MAPBOX_TOKEN}
          onLoad={onMapLoad}
          onStyleData={onStyleLoad}
          style={{ width: '100%', height: '100%' }}
          attributionControl={true}
          onClick={(e) => {
            // Verifica clique em polígono de talhão
            const map = mapRef.current?.getMap();
            if (!map) return;
            const features = map.queryRenderedFeatures(e.point, { layers: ['talhoes-fill'] });
            if (features.length > 0) {
              const f = features[0];
              setPopupInfo({ nome: f.properties.nome, longitude: e.lngLat.lng, latitude: e.lngLat.lat });
            } else {
              setPopupInfo(null);
            }
          }}
        >
          <NavigationControl position="top-right" visualizePitch={true} />
          <ScaleControl position="bottom-right" />

          {/* Camada slope heatmap — visível apenas no modo declividade */}
          {showSlope && (
            <Source id="slope-source" type="raster-dem" url="mapbox://mapbox.mapbox-terrain-dem-v1" tileSize={512} maxzoom={14}>
              <Layer
                id="slope-heatmap-layer"
                type="raster"
                source="slope-source"
                paint={{
                  'raster-color': [
                    'interpolate', ['linear'], ['slope'],
                    0,  '#22c55e',
                    5,  '#84cc16',
                    10, '#eab308',
                    15, '#f97316',
                    20, '#ef4444',
                    30, '#991b1b',
                  ],
                  'raster-color-mix': [0, 0, 0, 0],
                  'raster-color-range': [0, 90],
                  'raster-opacity': 0.65,
                }}
              />
            </Source>
          )}

          {/* Camadas de talhões mapeados */}
          {geojsonTalhoes.features.length > 0 && (
            <Source id="talhoes-source" type="geojson" data={geojsonTalhoes}>
              <Layer
                id="talhoes-fill"
                type="fill"
                paint={{ 'fill-color': '#22c55e', 'fill-opacity': 0.2 }}
              />
              <Layer
                id="talhoes-outline"
                type="line"
                paint={{ 'line-color': '#16a34a', 'line-width': 2 }}
              />
            </Source>
          )}

          {/* Popup ao clicar num talhão */}
          {popupInfo && (
            <Popup
              longitude={popupInfo.longitude}
              latitude={popupInfo.latitude}
              anchor="bottom"
              onClose={() => setPopupInfo(null)}
              closeButton={true}
            >
              <p className="text-sm font-semibold px-1 py-0.5">{popupInfo.nome}</p>
            </Popup>
          )}
        </Map>

        {/* Legenda talhões */}
        {talhoesComPoligono.length > 0 && (
          <div className="absolute bottom-10 left-4 bg-black/70 backdrop-blur-sm text-white rounded-xl px-4 py-3 text-xs max-w-[220px] space-y-1">
            <p className="font-semibold text-white/90 mb-1">Talhões Mapeados</p>
            {talhoesComPoligono.slice(0, 8).map((t) => (
              <div key={t.id} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-sm bg-green-400/60 border border-green-400 shrink-0" />
                <span className="truncate">{t.nome}</span>
                {t.area_ha && <span className="text-white/50 shrink-0">{t.area_ha}ha</span>}
              </div>
            ))}
            {talhoesComPoligono.length > 8 && (
              <p className="text-white/50">+{talhoesComPoligono.length - 8} mais…</p>
            )}
          </div>
        )}
      </div>

      {/* Modal salvar talhão desenhado */}
      <Dialog open={modalAberto} onOpenChange={(v) => { if (!v) handleModalClose(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Salvar Talhão Desenhado</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs mb-1 block">Nome do talhão *</Label>
              <Input
                value={novoTalhao.nome}
                onChange={(e) => setNovoTalhao((prev) => ({ ...prev, nome: e.target.value }))}
                placeholder="Ex: Talhão 1, Sede, etc."
                className="h-9"
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Produtor</Label>
              <select
                value={novoTalhao.produtor_id}
                onChange={(e) => setNovoTalhao((prev) => ({ ...prev, produtor_id: e.target.value }))}
                className="w-full h-9 pl-3 pr-3 text-sm border border-input rounded-lg bg-background"
              >
                <option value="">Selecione o produtor…</option>
                {produtores.map((p) => (
                  <option key={p.id} value={p.id}>{p.nome || p.codigo}</option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={handleModalClose}>Cancelar</Button>
            <Button size="sm" onClick={handleSalvarTalhao} disabled={salvando}>
              {salvando ? 'Salvando…' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}