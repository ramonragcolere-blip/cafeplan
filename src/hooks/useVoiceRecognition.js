import { useState, useRef, useCallback } from 'react';

// Converte palavras numéricas em pt-BR para número
const UNIDADES = {
  zero: 0, um: 1, uma: 1, dois: 2, duas: 2, três: 3, tres: 3,
  quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9,
  dez: 10, onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14,
  quinze: 15, dezesseis: 16, dezessete: 17, dezoito: 18, dezenove: 19,
  vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60,
  setenta: 70, oitenta: 80, noventa: 90,
  cem: 100, cento: 100, duzentos: 200, duzentas: 200,
  trezentos: 300, trezentas: 300, quatrocentos: 400, quatrocentas: 400,
  quinhentos: 500, quinhentas: 500, seiscentos: 600, seiscentas: 600,
  setecentos: 700, setecentas: 700, oitocentos: 800, oitocentas: 800,
  novecentos: 900, novecentas: 900,
  mil: 1000,
};

function wordToNumber(text) {
  const normalized = text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s,./]/g, '')
    .replace(/\s+e\s+/g, ' ')
    .trim();

  // Se já é um número (pode ter vírgula/ponto decimal)
  const directNum = normalized.replace(',', '.');
  if (!isNaN(parseFloat(directNum)) && directNum !== '') {
    return String(parseFloat(directNum));
  }

  const words = normalized.split(/\s+/);
  let total = 0;
  let current = 0;

  for (const word of words) {
    const val = UNIDADES[word];
    if (val === undefined) continue;
    if (val === 1000) {
      current = current === 0 ? 1 : current;
      total += current * 1000;
      current = 0;
    } else if (val >= 100) {
      current += val;
    } else {
      current += val;
    }
  }
  total += current;

  return total > 0 ? String(total) : text;
}

const isSupported = typeof window !== 'undefined' &&
  ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

export function useVoiceRecognition({ isNumeric = false, onResult }) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);

  const start = useCallback(() => {
    if (!isSupported) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript.trim();
      const value = isNumeric ? wordToNumber(transcript) : transcript;
      onResult(value);
    };

    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }, [isNumeric, onResult]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const toggle = useCallback(() => {
    if (listening) stop(); else start();
  }, [listening, start, stop]);

  return { listening, toggle, isSupported };
}