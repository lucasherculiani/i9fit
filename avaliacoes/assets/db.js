// Banco de dados das avaliações InoveAvalia (Firebase do i9Treino).
// Coleção própria "inoveavalia" — não mistura com a coleção "avaliacoes" da plataforma.
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, deleteDoc, getCountFromServer
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

const novoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

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
  const registro = {
    ...av,
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

/** Alunos cadastrados na plataforma i9Treino (para vincular a avaliação). */
export async function listarAlunosI9() {
  try {
    const snap = await getDocs(collection(db, "alunos"));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(a => a && (a.nick || a.nome));
  } catch (e) {
    return [];
  }
}

export async function contar(nomeColecao) {
  try {
    const snap = await getCountFromServer(collection(db, nomeColecao));
    return snap.data().count;
  } catch (e) {
    return null;
  }
}
