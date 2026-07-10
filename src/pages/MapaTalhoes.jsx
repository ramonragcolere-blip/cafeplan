import React, { useState, useRef, useCallback } from 'react';
import Map, { NavigationControl, ScaleControl, Source, Layer, Popup } from 'react-map-gl';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Map as MapIcon, ChevronDown, Pencil, Mountain, Satellite, Spline } from 'lucide-react';
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

function calcularCentroPoligono(geometria) {
  const coordenadas = geometria?.coordinates?.[0] || [];
  if (!coordenadas.length) return null;
  const validas = coordenadas.filter(ponto => Array.isArray(ponto) && ponto.length >= 2);
  if (!validas.length) return null;
  const soma = validas.reduce((acc, [lng, lat]) => ({ lng: acc.lng + Number(lng), lat: acc.lat + Number(lat) }), { lng: 0, lat: 0 });
  return { lng: soma.lng / validas.length, lat: soma.lat / validas.length };
}


export default function MapaTalhoes() {
  const mapRef = useRef(null);
  const drawRef = useRef(null);
  const produtorIdRef = useRef('');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [produtorId, setProdutorId] = useState('');
  produtorIdRef.current = produtorId;
  const [viewState, setViewState] = useState(INITIAL_VIEW);
  const [mapMode, setMapMode] = useState('satelite'); // 'satelite', 'curvas', 'declividade'
  const [desenhando, setDesenhando] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const [geojsonPendente, setGeojsonPendente] = useState(null);
  const [novoTalhao, setNovoTalhao] = useState({ nome: '', produtor_id: '' });
  const [salvando, setSalvando] = useState(false);
  const [popupInfo, setPopupInfo] = useState(null);

  // Define o estilo do mapa baseado no modo escolhido
  const currentStyle = mapMode === 'declividade' 
    ? 'mapbox://styles/mapbox/outdoors-v12' 
    : 'mapbox://styles/mapbox/satellite-streets-v12';

  // Exibe as curvas de nível apenas no modo 'curvas'
  const showContours = mapMode === 'curvas';
  // Aumenta o relevo 3D quando não está no modo satélite puro
  const terrainExaggeration = mapMode === 'satelite' ? 1.0 : 1.5;

  const { data: produtores = [] } = useQuery({
    queryKey: ['produtores', 'completo'],
    queryFn: () => base44.entities.Produtor.list(undefined, 5000),
  });

  const { data: talhoes = [] } = useQuery({
    queryKey: ['talhoes_mapa'],
    queryFn: () => base44.entities.Talhao.list(undefined, 5000),
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
    const codigo = produtores.find((p) => p.id === id)?.codigo;
    const talhaoComCentro = talhoes.find(t => (t.produtor_id === id || t.codigo_produtor === codigo) && t.centro_mapa);
    if (!talhaoComCentro?.centro_mapa) return;
    try {
      const centro = typeof talhaoComCentro.centro_mapa === 'string' ? JSON.parse(talhaoComCentro.centro_mapa) : talhaoComCentro.centro_mapa;
      if (Number.isFinite(Number(centro?.lng)) && Number.isFinite(Number(centro?.lat))) {
        setViewState((v) => ({ ...v, longitude: Number(centro.lng), latitude: Number(centro.lat), zoom: 13 }));
      }
    } catch {
      // Mantém a posição atual se o centro salvo estiver inválido.
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
        setNovoTalhao({ nome: '', produtor_id: produtorIdRef.current || '' });
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
    if (!novoTalhao.produtor_id) {
      toast({ title: 'Selecione o produtor', variant: 'destructive' });
      return;
    }
    const produtor = produtores.find((p) => p.id === novoTalhao.produtor_id);
    const centro = calcularCentroPoligono(geojsonPendente);
    setSalvando(true);
    try {
      await base44.entities.Talhao.create({
        nome: novoTalhao.nome.trim(),
        produtor_id: novoTalhao.produtor_id || undefined,
        codigo_produtor: produtor?.codigo || '',
        geojson_poligono: JSON.stringify(geojsonPendente),
        centro_mapa: centro ? JSON.stringify(centro) : undefined,
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

  const handleRemoverDesenho = async (id) => {
    if (!window.confirm('Remover apenas o desenho deste talhão do mapa? O cadastro e os planejamentos serão preservados.')) return;
    try {
      await base44.entities.Talhao.update(id, { geojson_poligono: null, centro_mapa: null });
      toast({ title: 'Desenho removido do mapa!' });
      setPopupInfo(null);
      queryClient.invalidateQueries({ queryKey: ['talhoes_mapa'] });
      queryClient.invalidateQueries({ queryKey: ['talhoes'] });
    } catch {
      toast({ title: 'Erro ao remover desenho', variant: 'destructive' });
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
      <div className="bg-card border-b border-border px-5 py-3 flex flex-wrap items-center gap-3 shrink-0 z-10">
        <div className="flex items-center gap-2">
          <MapIcon className="w-5 h-5 text-primary" />
          <h1 className="text-base font-bold text-foreground">Mapa de Talhões</h1>
        </div>

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

        {/* Seleção de 3 modos de visualização */}
        <div className="ml-auto flex items-center bg-muted rounded-lg p-0.5 gap-0.5">
          <button
            type="button"
            onClick={() => setMapMode('satelite')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${mapMode === 'satelite' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Satellite className="w-3.5 h-3.5" /> Satélite
          </button>
          <button
            type="button"
            onClick={() => setMapMode('curvas')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${mapMode === 'curvas' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Spline className="w-3.5 h-3.5" /> Curvas
          </button>
          <button
            type="button"
            onClick={() => setMapMode('declividade')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${mapMode === 'declividade' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Mountain className="w-3.5 h-3.5" /> Declividade
          </button>
        </div>

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

      {desenhando && (
        <div className="bg-amber-50 border-b border-amber-200 px-5 py-2 text-xs text-amber-800 shrink-0">
          Clique no mapa para adicionar pontos do polígono. Clique no primeiro ponto para fechar o polígono.
        </div>
      )}

      <div className="flex-1 relative">
        <Map
          ref={mapRef}
          {...viewState}
          onMove={(evt) => setViewState(evt.viewState)}
          mapStyle={currentStyle}
          mapboxAccessToken={MAPBOX_TOKEN}
          onLoad={onMapLoad}
          style={{ width: '100%', height: '100%' }}
          attributionControl={true}
          // Relevo 3D controlado pelo modo
          terrain={{ source: 'mapbox-dem', exaggeration: terrainExaggeration }}
          onClick={(e) => {
            const map = mapRef.current?.getMap();
            if (!map) return;
            const features = map.queryRenderedFeatures(e.point, { layers: ['talhoes-fill'] });
            if (features.length > 0) {
              const f = features[0];
              setPopupInfo({ id: f.properties.id, nome: f.properties.nome, longitude: e.lngLat.lng, latitude: e.lngLat.lat });
            } else {
              setPopupInfo(null);
            }
          }}
        >
          <NavigationControl position="top-right" visualizePitch={true} />
          <ScaleControl position="bottom-right" />

          {/* Fonte de dados do Terreno para o Relevo 3D */}
          <Source
            id="mapbox-dem"
            type="raster-dem"
            url="mapbox://mapbox.mapbox-terrain-dem-v1"
            tileSize={512}
            maxzoom={14}
          />

          {/* Curvas de Nível (Contorno) - Aparecem apenas no modo Curvas */}
          {showContours && (
            <Source id="terrain-contours" type="vector" url="mapbox://mapbox.mapbox-terrain-v2">
              <Layer
                id="contours-line"
                type="line"
                source-layer="contour"
                paint={{
                  'line-color': '#facc15', // Amarelo
                  'line-width': ['match', ['get', 'index'], 1, 1.5, 0.5],
                  'line-opacity': 0.8
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

          {popupInfo && (
            <Popup
              longitude={popupInfo.longitude}
              latitude={popupInfo.latitude}
              anchor="bottom"
              onClose={() => setPopupInfo(null)}
              closeButton={true}
            >
              <div className="p-1">
                <p className="text-sm font-semibold">{popupInfo.nome}</p>
                <button 
                  onClick={() => handleRemoverDesenho(popupInfo.id)}
                  className="mt-1 text-xs text-red-600 hover:text-red-800 font-medium"
                >
                  Remover desenho do mapa
                </button>
              </div>
            </Popup>
          )}
        </Map>

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
              <Label className="text-xs mb-1 block">Produtor *</Label>
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