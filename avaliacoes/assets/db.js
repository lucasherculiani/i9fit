// Banco de dados das avaliações InoveAvalia (Firebase do i9Treino).
// Coleção própria "inoveavalia" — não mistura com a coleção "avaliacoes" da plataforma.
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, deleteDoc, getCountFromServer, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC6xUfFJ59fXT1_eR1HDD7UPiQ8aakSkHY",
  authDomain: "i9fit-4b643.firebaseapp.com",
  projectId: "i9fit-4b643",
  storageBucket: "i9fit-4b643.firebasestorage.app",
  messagingSenderId: "60375557935",
  appId: "1:60375557935:web:b761c243672d50c7c263da",
  measurementId: "G-9ZX1089GT7"
};

const app = getApps()[0] || initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const COLECAO = "inoveavalia";

// Id difícil de adivinhar: também é o "código" do link enviado ao aluno.
const novoId = () => {
  const b = new Uint8Array(12);
  crypto.getRandomValues(b);
  return Date.now().toString(36) + Array.from(b, x => x.toString(36).padStart(2, "0")).join("").slice(0, 18);
};

/** Remove valores vazios para manter o documento enxuto. */
function limpar(formData) {
  const out = {};
  for (const [k, v] of Object.entries(formData || {})) {
    if (v === undefined || v === null) continue;
    if (typeof v === "string" && v === "") continue;
    if (Array.isArray(v) && !v.length) continue;
    out[k] = v;
  }
  return out;
}

export async function salvarAvaliacao(av) {
  const id = av.id || novoId();
  const agora = new Date().toISOString();
  // Cadastro único: toda avaliação fica ligada a um aluno da plataforma (coleção "alunos").
  let alunoId = av.alunoId || "";
  try {
    const aluno = await vincularAluno({
      alunoId, nome: av.patientName, telefone: av.telefone, dataNascimento: (av.formData || {}).dataNascimento
    });
    if (aluno) alunoId = aluno.id;
  } catch (e) { console.warn("Não foi possível vincular ao cadastro do aluno:", e); }
  const registro = {
    ...av,
    alunoId,
    id,
    formData: limpar(av.formData),
    criadoEm: av.criadoEm || agora,
    atualizadoEm: agora
  };
  await setDoc(doc(db, COLECAO, id), JSON.parse(JSON.stringify(registro)));
  return registro;
}

export async function obterAvaliacao(id) {
  const snap = await getDoc(doc(db, COLECAO, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function listarAvaliacoes() {
  const snap = await getDocs(collection(db, COLECAO));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function excluirAvaliacao(id) {
  await deleteDoc(doc(db, COLECAO, id));
}

/* ===== Cadastro único de alunos =====
 * A coleção "alunos" (a mesma do app de treino) é o cadastro de todas as pessoas.
 * Avaliações guardam alunoId. Ninguém é cadastrado duas vezes: antes de criar,
 * procura pelo telefone (últimos 8 dígitos), pelo nome e pelo nick.
 */
export const normNome = t => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
export const fimTel = t => { const d = String(t || "").replace(/\D/g, ""); return d.length >= 8 ? d.slice(-8) : ""; };
const nickBase = t => normNome(t).replace(/[^a-z0-9 ]/g, "").split(" ").filter(Boolean);
let CACHE_ALUNOS = null;

/** Alunos cadastrados na plataforma i9Treino. */
export async function listarAlunosI9(forcar = false) {
  if (CACHE_ALUNOS && !forcar) return CACHE_ALUNOS;
  try {
    const snap = await getDocs(collection(db, "alunos"));
    CACHE_ALUNOS = snap.docs.map(d => {
      const a = { ...d.data() };
      delete a.updatedAt;
      if (!a.id) a.id = decodeURIComponent(d.id);
      return a;
    }).filter(a => a && (a.nick || a.nome));
    return CACHE_ALUNOS;
  } catch (e) {
    console.warn(e);
    return CACHE_ALUNOS || [];
  }
}

/** Procura um aluno já cadastrado com o mesmo telefone, nome ou nick. */
export function acharAluno(alunos, { nome, telefone, ignorarId } = {}) {
  const tel = fimTel(telefone), n = normNome(nome), compacto = n.replace(/[^a-z0-9]/g, "");
  const lista = alunos.filter(a => a.id !== ignorarId);
  // Telefone igual só conta como a mesma pessoa se o primeiro nome também bater
  // (mãe e filha podem usar o mesmo número).
  const primeiro = n.split(" ")[0];
  if (tel) {
    const porTel = lista.find(a => fimTel(a.telefone) === tel && (!primeiro || !normNome(a.nome || a.nick) || normNome(a.nome || a.nick).split(" ")[0] === primeiro));
    if (porTel) return porTel;
  }
  if (n) {
    const porNome = lista.find(a => normNome(a.nome) === n || (compacto && a.nick === compacto));
    if (porNome) return porNome;
  }
  return null;
}

function nickUnico(alunos, nome) {
  const partes = nickBase(nome);
  const usados = new Set(alunos.map(a => a.nick));
  const tentativas = [partes[0], partes[0] && partes[partes.length - 1] && partes.length > 1 ? partes[0] + partes[partes.length - 1] : "", partes.join("")].filter(Boolean);
  for (const t of tentativas) if (!usados.has(t)) return t;
  const base = tentativas[0] || "aluno";
  for (let i = 2; ; i++) if (!usados.has(base + i)) return base + i;
}
const idAluno = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/**
 * Liga uma avaliação ao cadastro do aluno: usa o alunoId informado, ou acha o aluno
 * pelo telefone/nome, ou cria o cadastro. Completa telefone e nascimento que faltarem.
 */
export async function vincularAluno({ alunoId, nome, telefone, dataNascimento }) {
  nome = String(nome || "").trim(); telefone = String(telefone || "").trim();
  const alunos = await listarAlunosI9(true);
  let aluno = alunoId ? alunos.find(a => a.id === alunoId) : null;
  if (!aluno) aluno = acharAluno(alunos, { nome, telefone });
  if (!aluno) {
    if (!nome || nome === "Aluno") return null;
    aluno = { id: idAluno(), nick: nickUnico(alunos, nome), nome, protocoloId: "", protocolosIds: [], origem: "avaliacao" };
    if (telefone) aluno.telefone = telefone;
    if (dataNascimento) aluno.dataNascimento = dataNascimento;
    await setDoc(doc(db, "alunos", encodeURIComponent(aluno.id)), { ...aluno, updatedAt: serverTimestamp() });
    CACHE_ALUNOS = [...alunos, aluno];
    return aluno;
  }
  const extra = {};
  if (telefone && !aluno.telefone) extra.telefone = telefone;
  if (dataNascimento && !aluno.dataNascimento) extra.dataNascimento = dataNascimento;
  if (Object.keys(extra).length) {
    await setDoc(doc(db, "alunos", encodeURIComponent(aluno.id)), { ...extra, updatedAt: serverTimestamp() }, { merge: true });
    Object.assign(aluno, extra);
  }
  return aluno;
}

/** Protocolos de treino do app (para mostrar o treino de cada aluno no painel). */
export async function listarProtocolosI9() {
  try {
    const snap = await getDocs(collection(db, "protocolos"));
    return snap.docs.map(d => { const p = d.data() || {}; return { id: p.id || decodeURIComponent(d.id), nome: p.nome || "" }; });
  } catch (e) { console.warn(e); return []; }
}

export async function contar(nomeColecao) {
  try {
    const snap = await getCountFromServer(collection(db, nomeColecao));
    return snap.data().count;
  } catch (e) {
    return null;
  }
}
