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

export default function MapaTalhoes() {
  const mapRef = useRef(null);
  const drawRef = useRef(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [produtorId, setProdutorId] = useState('');
  const [viewState, setViewState] = useState(INITIAL_VIEW);
  const [showSlope, setShowSlope] = useState(false); // false = Satélite, true = Declividade
  const [desenhando, setDesenhando] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const [geojsonPendente, setGeojsonPendente] = useState(null);
  const [novoTalhao, setNovoTalhao] = useState({ nome: '', produtor_id: '' });
  const [salvando, setSalvando] = useState(false);
  const [popupInfo, setPopupInfo] = useState(null);

  // Estilo dinâmico: Satélite ou Outdoors (Topográfico com cores de declividade)
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
        produtor_id: novo
