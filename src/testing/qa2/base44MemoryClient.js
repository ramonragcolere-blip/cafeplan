import { criarCafePlanQa2Fixtures } from './fixtures/cafeplanQa2Fixtures.js';

const DEFAULT_LIMIT = 5000;

function clonar(valor) {
  return valor == null ? valor : JSON.parse(JSON.stringify(valor));
}

function compararFiltro(registro, filtro) {
  return Object.entries(filtro || {}).every(([campo, esperado]) => {
    const atual = registro?.[campo];
    if (Array.isArray(esperado)) return esperado.includes(atual);
    return atual === esperado;
  });
}

function ordenar(lista, orderBy) {
  if (!orderBy || typeof orderBy !== 'string') return lista;
  const desc = orderBy.startsWith('-');
  const campo = desc ? orderBy.slice(1) : orderBy;
  return [...lista].sort((a, b) => {
    const av = a?.[campo] ?? '';
    const bv = b?.[campo] ?? '';
    if (av === bv) return 0;
    return (av > bv ? 1 : -1) * (desc ? -1 : 1);
  });
}

function criarId(nomeEntidade, sequencia) {
  return `${nomeEntidade.toLowerCase()}-${sequencia}`;
}

export class Base44MemoryDatabase {
  constructor(seed = criarCafePlanQa2Fixtures(), options = {}) {
    this.persistKey = options.persistKey || null;
    this.storage = options.storage || globalThis.localStorage || null;
    this.tables = {};
    this.sequences = {};
    if (this.persistKey && this.storage?.getItem(this.persistKey)) {
      this.restore();
    } else {
      this.reset(seed);
    }
  }

  reset(seed = criarCafePlanQa2Fixtures()) {
    this.tables = Object.fromEntries(
      Object.entries(seed).map(([nome, registros]) => [nome, clonar(registros || [])])
    );
    this.sequences = Object.fromEntries(
      Object.entries(this.tables).map(([nome, registros]) => [nome, registros.length + 1])
    );
    this.persist();
  }

  restore() {
    if (!this.persistKey || !this.storage) return;
    const raw = this.storage.getItem(this.persistKey);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.tables) {
        this.tables = parsed.tables;
        this.sequences = parsed.sequences || this.sequences;
      }
    } catch {
      this.storage.removeItem(this.persistKey);
    }
  }

  persist() {
    if (!this.persistKey || !this.storage) return;
    this.storage.setItem(this.persistKey, JSON.stringify({
      tables: this.tables,
      sequences: this.sequences,
    }));
  }

  ensureTable(nomeEntidade) {
    if (!this.tables[nomeEntidade]) this.tables[nomeEntidade] = [];
    if (!this.sequences[nomeEntidade]) this.sequences[nomeEntidade] = this.tables[nomeEntidade].length + 1;
    return this.tables[nomeEntidade];
  }

  entity(nomeEntidade) {
    return {
      list: async (orderBy, limit = DEFAULT_LIMIT) => {
        const lista = ordenar(this.ensureTable(nomeEntidade), orderBy).slice(0, limit || DEFAULT_LIMIT);
        return clonar(lista);
      },
      filter: async (filtro = {}, orderBy, limit = DEFAULT_LIMIT) => {
        const lista = ordenar(this.ensureTable(nomeEntidade).filter(registro => compararFiltro(registro, filtro)), orderBy)
          .slice(0, limit || DEFAULT_LIMIT);
        return clonar(lista);
      },
      create: async (payload = {}) => {
        const table = this.ensureTable(nomeEntidade);
        const now = new Date().toISOString();
        const registro = {
          ...clonar(payload),
          id: payload.id || criarId(nomeEntidade, this.sequences[nomeEntidade]++),
          created_date: payload.created_date || now,
          updated_date: payload.updated_date || now,
        };
        table.push(registro);
        this.persist();
        return clonar(registro);
      },
      update: async (id, payload = {}) => {
        const table = this.ensureTable(nomeEntidade);
        const indice = table.findIndex(registro => registro.id === id);
        if (indice < 0) {
          const error = new Error(`Registro não encontrado em ${nomeEntidade}: ${id}`);
          error.status = 404;
          throw error;
        }
        table[indice] = {
          ...table[indice],
          ...clonar(payload),
          id,
          updated_date: payload.updated_date || new Date().toISOString(),
        };
        this.persist();
        return clonar(table[indice]);
      },
      delete: async (id) => {
        const table = this.ensureTable(nomeEntidade);
        const indice = table.findIndex(registro => registro.id === id);
        if (indice >= 0) table.splice(indice, 1);
        this.persist();
        return { id, deleted: indice >= 0 };
      },
    };
  }
}

export function createBase44MemoryClient(options = {}) {
  const database = new Base44MemoryDatabase(options.seed, options);
  const entities = new Proxy({}, {
    get(_target, nomeEntidade) {
      if (typeof nomeEntidade !== 'string') return undefined;
      return database.entity(nomeEntidade);
    },
  });

  return {
    database,
    entities,
    auth: {
      me: async () => ({ id: 'qa-user', email: 'qa2@cafeplan.local', full_name: 'QA 2.0' }),
      logout: () => undefined,
      redirectToLogin: () => undefined,
    },
  };
}

export function isBase44MockEnabled() {
  const meta = import.meta.env || {};
  return meta.VITE_E2E_MOCK === 'true' && meta.PROD !== true;
}
