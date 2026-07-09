import React, { useState, useRef, useCallback } from 'react';
import Map, { NavigationControl, ScaleControl } from 'react-map-gl';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Map as MapIcon, ChevronDown } from 'lucide-react';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

const INITIAL_VIEW = {
  longitude: -45.9,
  latitude: -21.5,
  zoom: 6,
  pitch: 0,
  bearing: 0,
};

export default function MapaTalhoes() {
  const mapRef = useRef(null);
  const [produtorId, setProdutorId] = useState('');
  const [viewState, setViewState] = useState(INITIAL_VIEW);
  const [terrenoAtivo, setTerrenoAtivo] = useState(false);

  const { data: produtores = [] } = useQuery({
    queryKey: ['produtores'],
    queryFn: () => base44.entities.Produtor.list(),
  });

  const { data: talhoes = [] } = useQuery({
    queryKey: ['talhoes', produtorId],
    queryFn: () =>
      produtorId
        ? base44.entities.Talhao.filter({ produtor_id: produtorId })
        : base44.entities.Talhao.list(),
    enabled: true,
  });

  const handleProdutorChange = (id) => {
    setProdutorId(id);
    // Se o produtor tiver coordenadas salvas, centraliza o mapa
    const produtor = produtores.find((p) => p.id === id);
    if (produtor?.centro_mapa) {
      try {
        const centro = typeof produtor.centro_mapa === 'string'
          ? JSON.parse(produtor.centro_mapa)
          : produtor.centro_mapa;
        if (centro?.lng && centro?.lat) {
          setViewState((v) => ({ ...v, longitude: centro.lng, latitude: centro.lat, zoom: 13 }));
        }
      } catch (_) {}
    }
  };

  const onMapLoad = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    // Adiciona source de terreno DEM
    if (!map.getSource('mapbox-dem')) {
      map.addSource('mapbox-dem', {
        type: 'raster-dem',
        url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
        tileSize: 512,
        maxzoom: 14,
      });
    }
  }, []);

  const toggleTerreno = () => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    if (!terrenoAtivo) {
      map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });
      setViewState((v) => ({ ...v, pitch: 45 }));
    } else {
      map.setTerrain(null);
      setViewState((v) => ({ ...v, pitch: 0 }));
    }
    setTerrenoAtivo((a) => !a);
  };

  const produtorSelecionado = produtores.find((p) => p.id === produtorId);
  const talhoesFiltrados = produtorId
    ? talhoes.filter((t) => t.produtor_id === produtorId || t.codigo_produtor === produtorSelecionado?.codigo)
    : talhoes;

  if (!MAPBOX_TOKEN) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <div className="bg-card border border-border rounded-xl p-8 max-w-md text-center space-y-3">
          <MapIcon className="w-10 h-10 text-muted-foreground mx-auto" />
          <h2 className="text-lg font-semibold">Token do Mapbox não configurado</h2>
          <p className="text-sm text-muted-foreground">
            Adicione a variável <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">VITE_MAPBOX_TOKEN</code> no arquivo <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">.env</code> da aplicação com seu token público do Mapbox.
          </p>
          <p className="text-xs text-muted-foreground">
            Obtenha o token em{' '}
            <a href="https://account.mapbox.com/access-tokens/" target="_blank" rel="noreferrer" className="text-primary underline">
              account.mapbox.com
            </a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" style={{ height: 'calc(100vh - 0px)' }}>
      {/* Barra superior */}
      <div className="bg-card border-b border-border px-5 py-3 flex flex-wrap items-center gap-3 shrink-0 z-10">
        <div className="flex items-center gap-2">
          <MapIcon className="w-5 h-5 text-primary" />
          <h1 className="text-base font-bold text-foreground">Mapa de Talhões</h1>
        </div>

        {/* Seletor de produtor */}
        <div className="relative">
          <select
            value={produtorId}
            onChange={(e) => handleProdutorChange(e.target.value)}
            className="h-9 pl-3 pr-8 text-sm border border-input rounded-lg bg-background appearance-none cursor-pointer min-w-[220px]"
          >
            <option value="">Todos os produtores</option>
            {produtores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome || p.codigo || p.id}
              </option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 absolute right-2 top-2.5 text-muted-foreground pointer-events-none" />
        </div>

        {/* Info talhões */}
        <span className="text-xs text-muted-foreground">
          {talhoesFiltrados.length} talhão{talhoesFiltrados.length !== 1 ? 'es' : ''} carregado{talhoesFiltrados.length !== 1 ? 's' : ''}
        </span>

        {/* Botão terreno 3D */}
        <button
          type="button"
          onClick={toggleTerreno}
          className={`ml-auto px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            terrenoAtivo
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background text-muted-foreground border-input hover:bg-muted/60'
          }`}
        >
          {terrenoAtivo ? '🏔️ Relevo 3D Ativo' : '🏔️ Ativar Relevo 3D'}
        </button>
      </div>

      {/* Mapa */}
      <div className="flex-1 relative">
        <Map
          ref={mapRef}
          {...viewState}
          onMove={(evt) => setViewState(evt.viewState)}
          mapStyle="mapbox://styles/mapbox/satellite-streets-v12"
          mapboxAccessToken={MAPBOX_TOKEN}
          onLoad={onMapLoad}
          style={{ width: '100%', height: '100%' }}
          attributionControl={true}
        >
          <NavigationControl position="top-right" visualizePitch={true} />
          <ScaleControl position="bottom-right" />
        </Map>

        {/* Legenda */}
        {talhoesFiltrados.length > 0 && (
          <div className="absolute bottom-10 left-4 bg-black/70 backdrop-blur-sm text-white rounded-xl px-4 py-3 text-xs max-w-[220px] space-y-1">
            <p className="font-semibold text-white/90 mb-1">Talhões</p>
            {talhoesFiltrados.slice(0, 8).map((t) => (
              <div key={t.id} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-green-400 shrink-0" />
                <span className="truncate">{t.nome}</span>
                {t.area_ha && <span className="text-white/50 shrink-0">{t.area_ha}ha</span>}
              </div>
            ))}
            {talhoesFiltrados.length > 8 && (
              <p className="text-white/50">+{talhoesFiltrados.length - 8} mais…</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}