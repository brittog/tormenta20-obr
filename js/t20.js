/**
 * Tormenta 20 OBR Plugin — t20.js
 * Funciona dentro do OBR (room metadata) OU como fallback em localStorage.
 */


const T20 = (() => {

  const NS  = 'com.tormenta20.ficha';
  const LSK = 't20_fichas'; // chave localStorage fallback

  // ── Detectar OBR ────────────────────────────────────────────
  function obrOk() {
    return typeof OBR !== 'undefined' && OBR.isAvailable;
  }

  // ── onReady: chama callback quando pronto ────────────────────
  function onReady(cb) {
    if (typeof OBR !== 'undefined') {
      OBR.onReady(cb);
    } else {
      // Fora do OBR: rodar direto
      setTimeout(cb, 0);
    }
  }

  // ── Fichas: leitura/escrita com fallback localStorage ────────
  async function getAllFichas() {
    if (obrOk()) {
      try {
        const meta = await OBR.room.getMetadata();
        return meta[`${NS}/fichas`] || {};
      } catch { /* fallthrough */ }
    }
    try {
      return JSON.parse(localStorage.getItem(LSK) || '{}');
    } catch { return {}; }
  }

  async function getFicha(id) {
    const all = await getAllFichas();
    return all[id] || null;
  }

  async function saveFicha(id, data) {
    const all = await getAllFichas();
    all[id] = { ...data, _id: id, _updated: Date.now() };

    // Tentar salvar no OBR primeiro
    if (obrOk()) {
      try {
        await OBR.room.setMetadata({ [`${NS}/fichas`]: all });
        // Também salvar em localStorage como backup
        try { localStorage.setItem(LSK, JSON.stringify(all)); } catch {}
        return true;
      } catch (e) {
        console.warn('[T20] OBR save falhou, usando localStorage:', e);
      }
    }
    // Fallback: localStorage
    try {
      localStorage.setItem(LSK, JSON.stringify(all));
      return true;
    } catch (e) {
      console.error('[T20] localStorage também falhou:', e);
      return false;
    }
  }

  async function deleteFicha(id) {
    const all = await getAllFichas();
    delete all[id];
    if (obrOk()) {
      try { await OBR.room.setMetadata({ [`${NS}/fichas`]: all }); } catch {}
    }
    try { localStorage.setItem(LSK, JSON.stringify(all)); } catch {}
    return true;
  }

  // ── onMetadataChange ────────────────────────────────────────
  function onMetadataChange(cb) {
    if (obrOk()) {
      try { return OBR.room.onMetadataChange(cb); } catch {}
    }
    return () => {};
  }

  // ── Dados ────────────────────────────────────────────────────
  function rolarDado(lados) {
    return Math.floor(Math.random() * lados) + 1;
  }

  function parseDiceExpr(expr) {
    const str = String(expr).trim().toLowerCase().replace(/\s/g,'');
    let total = 0;
    const partes = [];
    const tokens = str.match(/[+-]?[^+-]+/g) || [];
    for (const t of tokens) {
      const m = t.match(/^([+-]?)(\d*)d(\d+)$|^([+-]?\d+)$/);
      if (!m) continue;
      if (m[4] !== undefined) {
        total += parseInt(m[4]);
        partes.push(parseInt(m[4]));
      } else {
        const sign = m[1] === '-' ? -1 : 1;
        const qt   = parseInt(m[2]) || 1;
        const lados = parseInt(m[3]);
        const rolls = [];
        for (let i = 0; i < qt; i++) {
          const r = rolarDado(lados);
          rolls.push(r);
          total += sign * r;
        }
        partes.push(`${sign<0?'-':''}[${rolls.join('+')}]`);
      }
    }
    return { total, partes };
  }

  const ROLL_CHANNEL = `${NS}/rolls`;

  async function rolar({ label, valor, tipo = 'pericia', personagem = '' }) {
    const d20    = rolarDado(20);
    const total  = d20 + valor;
    const critico = d20 === 20;
    const fumble  = d20 === 1;
    const msg = { personagem, label, d20, modificador: valor, total, critico, fumble, tipo, ts: Date.now() };

    if (obrOk()) {
      try { await OBR.broadcast.sendMessage(ROLL_CHANNEL, msg, { destination: 'ALL' }); } catch {}
      try {
        const emoji = critico ? '🎯 CRÍTICO! ' : fumble ? '💀 FUMBLE! ' : '';
        await OBR.notification.show(
          `${emoji}${personagem ? personagem+' — ' : ''}${label}: d20(${d20}) ${sinal(valor)} = ${total}`,
          critico ? 'SUCCESS' : fumble ? 'ERROR' : 'INFO'
        );
      } catch {}
    }
    return { d20, modificador: valor, total, critico, fumble };
  }

  async function rolarDano({ label, expr, personagem = '' }) {
    const { total, partes } = parseDiceExpr(expr);
    const msg = { personagem, label, expr, partes, total, tipo: 'dano', ts: Date.now() };
    if (obrOk()) {
      try { await OBR.broadcast.sendMessage(ROLL_CHANNEL, msg, { destination: 'ALL' }); } catch {}
      try { await OBR.notification.show(`${personagem ? personagem+' — ' : ''}${label} dano: ${expr} = ${total}`); } catch {}
    }
    return { total, partes };
  }

  function onRoll(callback) {
    if (obrOk()) {
      try { return OBR.broadcast.onMessage(ROLL_CHANNEL, e => callback(e.data)); } catch {}
    }
    return () => {};
  }

  // ── Mecânica T20 JdA ─────────────────────────────────────────
  function bonusTreino(nivel) {
    const n = parseInt(nivel) || 1;
    if (n >= 15) return 6;
    if (n >= 7)  return 4;
    return 2;
  }

  function calcPericia({ nivel, attrValue, treinado, treino_extra = 0, outros = 0, penArm = 0 }) {
    const n      = parseInt(nivel) || 1;
    const metade = Math.floor(n / 2);
    const attr   = parseInt(attrValue) || 0;
    const treino = treinado ? bonusTreino(n) : 0;
    return metade + attr + treino + parseInt(treino_extra||0) + parseInt(outros||0) + parseInt(penArm||0);
  }

  function sinal(n) { return (n >= 0 ? '+' : '') + n; }

  function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  const PERICIAS = [
    { nome:'Acrobacia',    attr:'DES', treinado:false, armadura:true  },
    { nome:'Adestramento', attr:'CAR', treinado:true,  armadura:false },
    { nome:'Atletismo',    attr:'FOR', treinado:false, armadura:false },
    { nome:'Atuação',      attr:'CAR', treinado:true,  armadura:false },
    { nome:'Cavalgar',     attr:'DES', treinado:false, armadura:false },
    { nome:'Conhecimento', attr:'INT', treinado:true,  armadura:false },
    { nome:'Cura',         attr:'SAB', treinado:false, armadura:false },
    { nome:'Diplomacia',   attr:'CAR', treinado:false, armadura:false },
    { nome:'Enganação',    attr:'CAR', treinado:false, armadura:false },
    { nome:'Fortitude',    attr:'CON', treinado:false, armadura:false },
    { nome:'Furtividade',  attr:'DES', treinado:false, armadura:true  },
    { nome:'Guerra',       attr:'INT', treinado:true,  armadura:false },
    { nome:'Iniciativa',   attr:'DES', treinado:false, armadura:false },
    { nome:'Intimidação',  attr:'CAR', treinado:false, armadura:false },
    { nome:'Intuição',     attr:'SAB', treinado:false, armadura:false },
    { nome:'Investigação', attr:'INT', treinado:false, armadura:false },
    { nome:'Jogatina',     attr:'CAR', treinado:true,  armadura:false },
    { nome:'Ladinagem',    attr:'DES', treinado:true,  armadura:true  },
    { nome:'Luta',         attr:'FOR', treinado:false, armadura:false },
    { nome:'Misticismo',   attr:'INT', treinado:true,  armadura:false },
    { nome:'Nobreza',      attr:'INT', treinado:true,  armadura:false },
    { nome:'Ofício',       attr:'INT', treinado:true,  armadura:false, custom:true },
    { nome:'Percepção',    attr:'SAB', treinado:false, armadura:false },
    { nome:'Pilotagem',    attr:'DES', treinado:true,  armadura:false },
    { nome:'Pontaria',     attr:'DES', treinado:false, armadura:false },
    { nome:'Reflexos',     attr:'DES', treinado:false, armadura:false },
    { nome:'Religião',     attr:'SAB', treinado:true,  armadura:false },
    { nome:'Sobrevivência',attr:'SAB', treinado:false, armadura:false },
    { nome:'Vontade',      attr:'SAB', treinado:false, armadura:false },
  ];

  return {
    onReady, onMetadataChange,
    getAllFichas, getFicha, saveFicha, deleteFicha,
    rolar, rolarDano, onRoll,
    bonusTreino, calcPericia, sinal, uuid,
    PERICIAS,
  };
})();
