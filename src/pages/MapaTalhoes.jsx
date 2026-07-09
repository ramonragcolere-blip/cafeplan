import React, { useState, useRef, useCallback } from 'react';
import Map, { NavigationControl, ScaleControl, Source, Layer, Popup } from 'react-map-gl';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Pencil, Mountain, Satellite } from 'lucide-react';
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

export default function MapaTalhoes() {
  const mapRef = useRef(null);
  const drawRef = useRef(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [produtorId, setProdutorId] = useState('');
  const [viewState, setViewState] = useState(INITIAL_VIEW);
  const [showSlope, setShowSlope] = useState(false);
  const [desenhando, setDesenhando] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const [geojsonPendente, setGeojsonPendente] = useState(null);
  const [novoTalhao, setNovoTalhao] = useState({ nome: '', produtor_id: '' });
  const [salvando, setSalvando] = useState(false);
  const [popupInfo, setPopupInfo] = useState(null);

  const currentStyle = showSlope
    ? 'mapbox://styles/mapbox/outdoors-v12'
    : 'mapbox://styles/mapbox/satellite-streets-v12';

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

  const onMapLoad = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    if (!drawRef.current) {
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
    }
  }, []);

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
        codigo_produtor: produtor?.codigo || undefined,
        geojson_poligono: JSON.stringify(geojsonPendente),
      });
      queryClient.invalidateQueries({ queryKey: ['talhoes_mapa'] });
      toast({ title: 'Talhão salvo com sucesso!' });
      handleModalClose();
    } catch (err) {
      toast({ title: 'Erro ao salvar talhão', description: err.message, variant: 'destructive' });
    } finally {
      setSalvando(false);
    }
  };

  const handleModalClose = () => {
    setModalAberto(false);
    setGeojsonPendente(null);
    setDesenhando(false);
    if (drawRef.current) {
      drawRef.current.deleteAll();
      drawRef.current.changeMode('simple_select');
    }
  };

  const handleMapClick = useCallback((e) => {
    const features = e.features || [];
    const talhaoFeature = features.find(f => f.layer?.id === 'talhoes-fill');
    if (talhaoFeature) {
      setPopupInfo({
        longitude: e.lngLat.lng,
        latitude: e.lngLat.lat,
        nome: talhaoFeature.properties.nome,
      });
    } else {
      setPopupInfo(null);
    }
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Barra de controles */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-border flex-wrap">
        <select
          value={produtorId}
          onChange={(e) => handleProdutorChange(e.target.value)}
          className="h-9 pl-3 pr-8 text-sm border border-input rounded-lg bg-background min-w-[200px]"
        >
          <option value="">Todos os produtores</option>
          {produtores.map((p) => (
            <option key={p.id} value={p.id}>{p.nome || p.codigo}</option>
          ))}
        </select>

        <Button
          variant={showSlope ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowSlope(prev => !prev)}
          className="gap-2"
        >
          <Mountain className="w-4 h-4" />
          {showSlope ? 'Topográfico' : 'Satélite'}
        </Button>

        <Button
          variant={desenhando ? 'destructive' : 'outline'}
          size="sm"
          onClick={toggleDesenho}
          className="gap-2"
        >
          <Pencil className="w-4 h-4" />
          {desenhando ? 'Cancelar desenho' : 'Desenhar talhão'}
        </Button>

        <span className="text-xs text-muted-foreground ml-auto">
          {talhoesComPoligono.length} talhão(ões) mapeado(s)
        </span>
      </div>

      {/* Mapa */}
      <div className="flex-1 relative">
        <Map
          ref={mapRef}
          {...viewState}
          onMove={(evt) => setViewState(evt.viewState)}
          mapStyle={currentStyle}
          mapboxAccessToken={MAPBOX_TOKEN}
          style={{ width: '100%', height: '100%' }}
          onLoad={onMapLoad}
          onClick={handleMapClick}
          interactiveLayerIds={['talhoes-fill']}
        >
          <NavigationControl position="top-right" />
          <ScaleControl position="bottom-right" />

          {/* Camada slope — visível apenas no modo declividade */}
          {showSlope && (
            <Source
              id="slope-dem-source"
              type="raster-dem"
              url="mapbox://mapbox.mapbox-terrain-dem-v1"
              tileSize={512}
              maxzoom={14}
            >
              <Layer
                id="slope-heatmap-layer"
                type="raster"
                source="slope-dem-source"
                paint={{
                  'raster-color': [
                    'interpolate', ['linear'], ['raster-dem', 'slope'],
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