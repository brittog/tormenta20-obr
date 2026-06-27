/**
 * Tormenta 20 OBR Plugin — Shared Utilities
 * Mecânica conforme Tormenta 20 Jogo do Ano (livro básico)
 */

const T20 = (() => {

  const NS = 'com.tormenta20.ficha';

  // ── OBR ready ────────────────────────────────────────────────
  function onReady(cb) {
    if (typeof OBR !== 'undefined') {
      OBR.onReady(cb);
    } else {
      cb();
    }
  }

  // ── Room metadata ─────────────────────────────────────────────
  async function getRoomMeta() {
    try { return await OBR.room.getMetadata(); }
    catch { return {}; }
  }

  async function setRoomMeta(update) {
    try { await OBR.room.setMetadata(update); return true; }
    catch(e) { console.error('setRoomMeta:', e); return false; }
  }

  // ── Fichas (room metadata) ────────────────────────────────────
  async function getAllFichas() {
    const meta = await getRoomMeta();
    return meta[`${NS}/fichas`] || {};
  }

  async function getFicha(id) {
    const all = await getAllFichas();
    return all[id] || null;
  }

  async function saveFicha(id, data) {
    const all = await getAllFichas();
    all[id] = { ...data, _id: id, _updated: Date.now() };
    return setRoomMeta({ [`${NS}/fichas`]: all });
  }

  async function deleteFicha(id) {
    const all = await getAllFichas();
    delete all[id];
    return setRoomMeta({ [`${NS}/fichas`]: all });
  }

  // ── Helpers ───────────────────────────────────────────────────
  function getParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  // ── T20 JdA: atributo já É o modificador ─────────────────────
  // "Força 4" significa bônus +4 diretamente (não mais 18→+4)
  function attrVal(id) {
    return parseInt(document.getElementById(id)?.value) || 0;
  }

  // Bônus de treinamento por nível (JdA p.114)
  function bonusTreino(nivel) {
    const n = parseInt(nivel) || 1;
    if (n >= 15) return 6;
    if (n >= 7)  return 4;
    return 2;
  }

  // Valor de perícia = metade nível (arred. baixo) + atributo + treino (se treinado)
  function calcPericia({ nivel, attrValue, treinado, treino_extra = 0, outros = 0, penArm = 0 }) {
    const n = parseInt(nivel) || 1;
    const metade = Math.floor(n / 2);
    const attr   = parseInt(attrValue) || 0;
    const treino = treinado ? bonusTreino(n) : 0;
    return metade + attr + treino + parseInt(treino_extra || 0) + parseInt(outros || 0) + parseInt(penArm || 0);
  }

  // Defesa = 10 + DES + armadura + escudo (JdA p.106)
  function calcDefesa({ des, armadura = 0, escudo = 0, outros = 0 }) {
    return 10 + (parseInt(des) || 0) + (parseInt(armadura) || 0)
              + (parseInt(escudo) || 0) + (parseInt(outros) || 0);
  }

  function sinal(n) { return (n >= 0 ? '+' : '') + n; }

  // ── Dados ─────────────────────────────────────────────────────
  function rolarDado(lados) {
    return Math.floor(Math.random() * lados) + 1;
  }

  function parseDiceExpr(expr) {
    // Suporta: 2d6+3, d20, 1d20-1, 3d6, etc.
    const str = String(expr).trim().toLowerCase().replace(/\s/g,'');
    let total = 0;
    const partes = [];
    // Separa por + e - mantendo o sinal
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
        partes.push(`${sign < 0 ? '-' : ''}[${rolls.join('+')}]`);
      }
    }
    return { total, partes };
  }

  // ── Sistema de rolagem com broadcast ─────────────────────────
  const ROLL_CHANNEL = `${NS}/rolls`;

  async function rolar({ label, valor, tipo = 'pericia', personagem = '' }) {
    // Rola 1d20 + valor
    const d20 = rolarDado(20);
    const total = d20 + valor;
    const critico = d20 === 20;
    const fumble  = d20 === 1;

    const msg = {
      personagem,
      label,
      d20,
      modificador: valor,
      total,
      critico,
      fumble,
      tipo,
      ts: Date.now(),
    };

    // Broadcast para todos na sala (aparece no log de rolagens de extensões compatíveis)
    try {
      await OBR.broadcast.sendMessage(ROLL_CHANNEL, msg, { destination: 'ALL' });
    } catch {}

    // Notificação local visual
    const emoji = critico ? '🎯 CRÍTICO! ' : fumble ? '💀 FALHA CRÍTICA! ' : '';
    const notifMsg = `${emoji}${personagem ? personagem + ' — ' : ''}${label}: d20(${d20}) ${sinal(valor)} = ${total}`;
    try {
      await OBR.notification.show(notifMsg, critico ? 'SUCCESS' : fumble ? 'ERROR' : 'INFO');
    } catch {
      // fallback: console
      console.log('[T20 Rolagem]', notifMsg);
    }

    return { d20, modificador: valor, total, critico, fumble };
  }

  async function rolarDano({ label, expr, personagem = '' }) {
    const { total, partes } = parseDiceExpr(expr);
    const msg = {
      personagem,
      label,
      expr,
      partes,
      total,
      tipo: 'dano',
      ts: Date.now(),
    };
    try {
      await OBR.broadcast.sendMessage(ROLL_CHANNEL, msg, { destination: 'ALL' });
    } catch {}
    const notifMsg = `${personagem ? personagem + ' — ' : ''}${label} dano: ${expr} = ${total}`;
    try {
      await OBR.notification.show(notifMsg, 'DEFAULT');
    } catch {}
    return { total, partes };
  }

  // ── Escuta de rolagens (para log visual) ─────────────────────
  function onRoll(callback) {
    try {
      return OBR.broadcast.onMessage(ROLL_CHANNEL, (event) => callback(event.data));
    } catch { return () => {}; }
  }

  // ── Perícias T20 ──────────────────────────────────────────────
  const PERICIAS = [
    { nome: 'Acrobacia',     attr: 'DES', treinado: false, armadura: true  },
    { nome: 'Adestramento',  attr: 'CAR', treinado: true,  armadura: false },
    { nome: 'Atletismo',     attr: 'FOR', treinado: false, armadura: false },
    { nome: 'Atuação',       attr: 'CAR', treinado: true,  armadura: false },
    { nome: 'Cavalgar',      attr: 'DES', treinado: false, armadura: false },
    { nome: 'Conhecimento',  attr: 'INT', treinado: true,  armadura: false },
    { nome: 'Cura',          attr: 'SAB', treinado: false, armadura: false },
    { nome: 'Diplomacia',    attr: 'CAR', treinado: false, armadura: false },
    { nome: 'Enganação',     attr: 'CAR', treinado: false, armadura: false },
    { nome: 'Fortitude',     attr: 'CON', treinado: false, armadura: false },
    { nome: 'Furtividade',   attr: 'DES', treinado: false, armadura: true  },
    { nome: 'Guerra',        attr: 'INT', treinado: true,  armadura: false },
    { nome: 'Iniciativa',    attr: 'DES', treinado: false, armadura: false },
    { nome: 'Intimidação',   attr: 'CAR', treinado: false, armadura: false },
    { nome: 'Intuição',      attr: 'SAB', treinado: false, armadura: false },
    { nome: 'Investigação',  attr: 'INT', treinado: false, armadura: false },
    { nome: 'Jogatina',      attr: 'CAR', treinado: true,  armadura: false },
    { nome: 'Ladinagem',     attr: 'DES', treinado: true,  armadura: true  },
    { nome: 'Luta',          attr: 'FOR', treinado: false, armadura: false },
    { nome: 'Misticismo',    attr: 'INT', treinado: true,  armadura: false },
    { nome: 'Nobreza',       attr: 'INT', treinado: true,  armadura: false },
    { nome: 'Ofício',        attr: 'INT', treinado: true,  armadura: false, custom: true },
    { nome: 'Percepção',     attr: 'SAB', treinado: false, armadura: false },
    { nome: 'Pilotagem',     attr: 'DES', treinado: true,  armadura: false },
    { nome: 'Pontaria',      attr: 'DES', treinado: false, armadura: false },
    { nome: 'Reflexos',      attr: 'DES', treinado: false, armadura: false },
    { nome: 'Religião',      attr: 'SAB', treinado: true,  armadura: false },
    { nome: 'Sobrevivência', attr: 'SAB', treinado: false, armadura: false },
    { nome: 'Vontade',       attr: 'SAB', treinado: false, armadura: false },
  ];

  return {
    NS, onReady, getRoomMeta, setRoomMeta,
    getAllFichas, getFicha, saveFicha, deleteFicha,
    getParam, uuid, debounce, sinal,
    attrVal, bonusTreino, calcPericia, calcDefesa,
    rolar, rolarDano, parseDiceExpr, onRoll,
    PERICIAS,
  };
})();
