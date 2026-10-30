// InoveAvalia — formulário e relatório das avaliações (identidade i9Treino).
// O catálogo (perguntas, testes, tabelas de referência e cálculos) vem de catalogo.js.
import * as C from "./catalogo.js";
import { salvarAvaliacao, obterAvaliacao, listarAlunosI9 } from "./db.js";

const {
  sectionsForType, protocolReferences, testResultGroupsFor, checklistSpans,
  numberSections, testIllustrations, isFieldVisible, SIDES, ageFromBirthDate,
  isIsoDate, formatDateBR, parseMeasure, zoneFor, anamnesisValues,
  buildInitialProfessionalAnalysis
} = C;

export const TIPOS = {
  multifuncional: {
    nome: "InoveAvalia",
    sub: "Avaliação Multifuncional",
    publico: "Para pessoas com menos de 60 anos",
    resumo: "Anamnese completa, medidas corporais, habilidade motora funcional, CORE, mobilidade, equilíbrio e força.",
    rota: "/avaliacoes/inoveavalia/"
  },
  longev: {
    nome: "InoveAvalia Plus",
    sub: "Avaliação Longev 60+",
    publico: "Para pessoas com 60 anos ou mais",
    resumo: "Anamnese completa, medidas corporais, SPPB, Senior Fitness Test, preensão manual e equilíbrio unipodal.",
    rota: "/avaliacoes/inoveavaliaplus/"
  }
};

/* ───────────────────────────── utilidades ───────────────────────────── */

export const esc = s => String(s ?? "").replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const txt = v => (Array.isArray(v) ? v.join(", ") : v ?? "");
const temValor = v => (Array.isArray(v) ? v.length > 0 : v !== undefined && v !== null && String(v).trim() !== "");
export const hoje = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
const limparTitulo = t => t.replace(/^(?:\d+\.\s*|Parte\s+\d+\s+—\s*)/i, "");
const isYesNo = f => f.type === "radio" && f.options?.length === 2 && f.options[0] === "Sim" && f.options[1] === "Não";
const sexoDe = v => (typeof v.multiSexo === "string" ? v.multiSexo : typeof v.sexo === "string" ? v.sexo : undefined);
const normSexo = s => (/fem/i.test(s || "") ? "Feminino" : /masc/i.test(s || "") ? "Masculino" : undefined);
export const dataBR = d => formatDateBR(d) || "—";
const PARTES = { anamnese: "Parte 1 — Anamnese", testes: "Parte 2 — Testes" };
const TONS = { poor: "#e5533d", low: "#f0913a", mid: "#e8c13c", good: "#a8d932", best: "#5cc46a" };

function ageInLabel(label, age) {
  if (age === undefined || age === null || Number.isNaN(age)) return false;
  const r = String(label).match(/(\d+)\s*[–-]\s*(\d+)/);
  if (r) return age >= Number(r[1]) && age <= Number(r[2]);
  const p = String(label).match(/(\d+)\s*\+/);
  return p ? age >= Number(p[1]) : false;
}

/* Registro de tabelas e seções renderizadas (para atualizar partes dinâmicas). */
let REG = { tabelas: new Map(), secoes: new Map(), gauges: new Map(), n: 0 };
const registrar = (mapa, obj) => { const id = "r" + (++REG.n); REG[mapa].set(id, obj); return id; };

/* ───────────────────────────── campos ───────────────────────────── */

function campo(f, key, value, compacto) {
  const k = esc(key);
  const v = typeof value === "string" ? value : "";
  const cls = compacto ? "inp inp-sm" : "inp";
  if (f.type === "textarea")
    return `<textarea class="${cls}" data-k="${k}" data-t="text" rows="${compacto ? 2 : 3}" placeholder="${esc(f.placeholder || "")}">${esc(v)}</textarea>`;
  if (f.type === "select")
    return `<select class="${cls}" data-k="${k}" data-t="text"><option value="">${compacto ? "—" : "Selecione..."}</option>${(f.options || []).map(o => `<option${v === o ? " selected" : ""}>${esc(o)}</option>`).join("")}</select>`;
  if (f.type === "radio")
    return `<div class="pills${isYesNo(f) ? " pills-yn" : ""}${compacto ? " pills-sm" : ""}" role="radiogroup">${(f.options || []).map(o =>
      `<label class="pill"><input type="radio" name="${k}" value="${esc(o)}" data-k="${k}" data-t="radio"${v === o ? " checked" : ""}><span>${esc(o)}</span></label>`).join("")}</div>`;
  if (f.type === "check") {
    const sel = Array.isArray(value) ? value : [];
    return `<div class="checks">${(f.options || []).map(o =>
      `<label class="chk"><input type="checkbox" value="${esc(o)}" data-k="${k}" data-t="multi"${sel.includes(o) ? " checked" : ""}><span>${esc(o)}</span></label>`).join("")}</div>`;
  }
  return `<input class="${cls}" data-k="${k}" data-t="text"${f.type === "number" ? ' inputmode="decimal"' : ""} placeholder="${esc(f.placeholder || "")}" value="${esc(v)}">`;
}

function grade(fields, ctx) {
  const vis = fields.filter(f => !f.hidden);
  const html = vis.map(f => {
    if (f.computed)
      return `<div class="fbox fbox-comp"><label>${esc(f.label)}</label><output data-comp="${esc(f.id)}">${esc(txt(ctx.values[f.id]) || "—")}</output></div>`;
    const yn = isYesNo(f);
    const cls = ["fbox", f.full || yn || f.type === "textarea" || f.type === "check" ? "full" : "", yn ? "yn" : "", f.showWhen ? "reveal" : ""].filter(Boolean).join(" ");
    const sw = f.showWhen ? ` data-sw="${esc(f.showWhen.field)}" data-sweq="${esc(f.showWhen.equals)}"` : "";
    const oculto = f.showWhen && !isFieldVisible(f, ctx.values) ? " hidden" : "";
    return `<div class="${cls}"${sw}${oculto}><label>${esc(f.label)}</label>${campo(f, f.id, ctx.values[f.id])}</div>`;
  }).join("");
  const dica = vis.some(f => f.computed) ? `<p class="dica full">Pontuação e interpretação calculadas automaticamente a partir das marcações nas tabelas.</p>` : "";
  return `<div class="grid-campos">${html}${dica}</div>`;
}

/* ───────────────────────── tabelas de referência ───────────────────────── */

function tabelaRefInner(table, ctx, editavel) {
  const sexo = normSexo(ctx.sexo);
  if (table.sex && sexo !== table.sex) {
    if (!sexo && table.sex === "Feminino")
      return `<p class="aviso-sexo">Marque o <b>sexo</b> na identificação para ver a tabela de referência correspondente.</p>`;
    return "";
  }
  const pick = editavel ? table.pick : undefined;
  const labelOf = table.pick?.labelOf || (row => row[0]);
  const oculta = table.sexColumns && sexo ? table.sexColumns[sexo === "Feminino" ? "Masculino" : "Feminino"] : undefined;
  const cols = table.headers.map((_, i) => i).filter(i => i !== oculta);
  const ageCol = table.groupFirstColumn ? -1 : table.headers.findIndex((h, i) => i > 0 && ageInLabel(h, ctx.idade));
  const auto = table.autoRow?.(ctx.values);
  const sel = id => linhaSelecionada(table, ctx, id);
  const p = table.pick;
  const single = p && !p.sides ? sel(p.fieldId) : -1;
  const right = p?.sides ? sel(p.sides.right) : -1;
  const left = p?.sides ? sel(p.sides.left) : -1;
  const spans = table.rows.map((row, i) => {
    if (!table.groupFirstColumn) return 1;
    if (i > 0 && table.rows[i - 1][0] === row[0]) return 0;
    let n = 1; while (table.rows[i + n]?.[0] === row[0]) n++; return n;
  });
  let head = "";
  if (pick) {
    head = pick.sides
      ? `<div class="pick-legenda"><span class="pick-instr">Toque primeiro na linha do <b>${esc(pick.sides.rightLabel.toLowerCase())}</b> e depois na do <b>${esc(pick.sides.leftLabel.toLowerCase())}</b>.</span>
         <span class="chip chip-d">1º ${esc(pick.sides.rightLabel)}: ${right >= 0 ? esc(labelOf(table.rows[right])) : "—"}</span>
         <span class="chip chip-e">2º ${esc(pick.sides.leftLabel)}: ${left >= 0 ? esc(labelOf(table.rows[left])) : "—"}</span>
         ${right >= 0 || left >= 0 ? `<button type="button" class="link-btn" data-limpar>Limpar</button>` : ""}</div>`
      : `<span class="pick-instr">Toque na linha que corresponde ao resultado.</span>`;
  } else if (table.instruction) head = `<span class="pick-instr">${esc(table.instruction)}</span>`;
  const th = cols.map(i => {
    const band = table.headerChips?.[i];
    const conteudo = band ? `<span class="band band-${band}">${esc(table.headers[i])}</span>` : esc(table.headers[i]);
    return `<th${i === ageCol ? ' class="col-idade"' : ""}>${conteudo}${i === ageCol ? "<small>idade da pessoa</small>" : ""}</th>`;
  }).join("");
  const linhas = table.rows.map((row, ri) => {
    const isR = ri === right, isL = ri === left;
    const cls = [ri === single ? "picked" : "", isR && isL ? "both" : isR ? "is-d" : isL ? "is-e" : "", ri === auto ? "auto" : "",
      table.groupFirstColumn && ageInLabel(row[0], ctx.idade) ? "faixa" : ""].filter(Boolean).join(" ");
    const tds = cols.map(i => {
      if (i === 0 && table.groupFirstColumn) {
        if (!spans[ri]) return "";
        return `<th scope="rowgroup" rowspan="${spans[ri]}" class="grupo">${esc(row[0])}</th>`;
      }
      const marca = i === (table.groupFirstColumn ? 1 : 0) && (isR || isL)
        ? `<span class="marcas">${isR ? '<i class="m-d">D</i>' : ""}${isL ? '<i class="m-e">E</i>' : ""}</span>` : "";
      const c = i === 0 && table.chips ? `<span class="band band-${table.chips[ri] || "mid"}">${esc(row[0])}</span>` : esc(row[i]);
      return `<td${i === ageCol ? ' class="col-idade"' : ""}>${marca}${c}</td>`;
    }).join("");
    return `<tr${cls ? ` class="${cls}"` : ""}${pick ? ` data-row="${ri}" tabindex="0" role="button"` : ""}>${tds}</tr>`;
  }).join("");
  return `<div class="ptable-head"><strong>${esc(table.title)}</strong>${head}</div>
    <div class="scroll-x"><table class="ref${pick ? " pickable" : ""}"><thead><tr>${th}</tr></thead><tbody>${linhas}</tbody></table></div>
    ${table.note ? `<p class="nota">${esc(table.note)}</p>` : ""}`;
}

function linhaSelecionada(table, ctx, fieldId) {
  const labelOf = table.pick?.labelOf || (row => row[0]);
  const v = ctx.values[fieldId];
  if (typeof v !== "string" || !v) return -1;
  const salvo = Number(ctx.values[`${fieldId}__linha`]);
  if (Number.isInteger(salvo) && table.rows[salvo] && labelOf(table.rows[salvo]) === v) return salvo;
  return table.rows.findIndex((row, i) => labelOf(row) === v &&
    (!table.groupFirstColumn || ctx.idade === undefined || ageInLabel(table.rows[i][0], ctx.idade)));
}

function tabelaRef(table, ctx, editavel) {
  const id = registrar("tabelas", { table, editavel });
  return `<div class="ptable" data-ptable="${id}">${tabelaRefInner(table, ctx, editavel)}</div>`;
}

/* ───────────────────────── tabelas por seção (testes) ───────────────────────── */

const planoClasse = p => {
  const k = String(p).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return k.startsWith("frontal") ? "pl-frontal" : k.startsWith("sagital") ? "pl-sagital" : k.startsWith("transvers") ? "pl-transverso" : "pl-corpo";
};

function tabelaChecklist(sec, ctx, ro) {
  const { rows, sides, hidePlane } = sec.checklist;
  const linhasVisiveis = ro ? rows.filter(r => temValor(ctx.values[r.id])) : rows;
  if (ro && !linhasVisiveis.length) return `<p class="vazio">Nenhuma compensação marcada.</p>`;
  const spans = checklistSpans(linhasVisiveis);
  const cel = row => {
    const v = ctx.values[row.id];
    const sel = Array.isArray(v) ? v : v ? [v] : [];
    if (sides) return SIDES.map(s => `<td class="mk">${ro ? (sel.includes(s) ? '<span class="ok">✓</span>' : "") :
      `<input type="checkbox" data-k="${esc(row.id)}" data-t="side" value="${s}"${sel.includes(s) ? " checked" : ""} aria-label="${esc(row.movement)} ${s === "D" ? "direito" : "esquerdo"}">`}</td>`).join("");
    if (row.choices?.length) return `<td class="mk escolhas">${ro ? `<span class="ok">${esc(sel.join(" / "))}</span>` :
      row.choices.map(c => `<label><input type="checkbox" data-k="${esc(row.id)}" data-t="multi" value="${esc(c)}"${sel.includes(c) ? " checked" : ""}><span>${esc(c)}</span></label>`).join("")}</td>`;
    return `<td class="mk">${ro ? (v === "Sim" ? '<span class="ok">Sim</span>' : "") :
      `<input type="checkbox" data-k="${esc(row.id)}" data-t="sim"${v === "Sim" ? " checked" : ""} aria-label="${esc(row.movement)}">`}</td>`;
  };
  const corpo = linhasVisiveis.map((row, i) => `<tr class="${hidePlane ? "" : planoClasse(row.plane)}">
      ${!hidePlane && spans[i].planeSpan ? `<th rowspan="${spans[i].planeSpan}" class="c-plano">${esc(row.plane)}</th>` : ""}
      ${spans[i].chainSpan ? `<th rowspan="${spans[i].chainSpan}" class="c-cadeia">${esc(row.chain)}${row.chainDetail ? `<small>${esc(row.chainDetail)}</small>` : ""}</th>` : ""}
      <td class="c-mov">${esc(row.movement)}</td>${cel(row)}</tr>`).join("");
  return `<div class="scroll-x"><table class="tab checklist"><thead><tr>
      ${!hidePlane ? "<th>Observação</th>" : ""}<th>Cadeia cinética</th><th>Movimentos observados</th>
      ${sides ? "<th class='mk'>D</th><th class='mk'>E</th>" : "<th class='mk'>Sim</th>"}</tr></thead><tbody>${corpo}</tbody></table></div>`;
}

function tabelaLateral(sec, ctx, ro) {
  const { sideLabel, columns } = sec.lateral;
  const sid = registrar("secoes", sec);
  const corpo = SIDES.map(side => `<tr><th class="lado">${side}</th>${columns.map(col => {
    const key = `${col.id}${side}`;
    if (col.computed) {
      const r = col.computed(c => ctx.values[`${c}${side}`]);
      return `<td class="comp" data-lcomp="${sid}|${esc(col.id)}|${side}">${esc(r || "—")}</td>`;
    }
    if (ro) return `<td>${esc(txt(ctx.values[key]) || "—")}</td>`;
    return `<td>${campo({ type: col.type || "number", options: col.options, placeholder: col.placeholder }, key, ctx.values[key], true)}</td>`;
  }).join("")}</tr>`).join("");
  return `<div class="scroll-x"><table class="tab lateral"><thead><tr><th class="lado">${esc(sideLabel)}</th>${columns.map(c => `<th>${esc(c.label)}</th>`).join("")}</tr></thead><tbody>${corpo}</tbody></table></div>`;
}

function tabelaCampos(sec, ctx, ro, legenda) {
  const regulares = sec.fields.filter(f => f.type !== "textarea");
  const notas = sec.fields.filter(f => f.type === "textarea");
  const calc = sec.computedRows || [];
  const sid = registrar("secoes", sec);
  const linha = f => {
    if (ro && !temValor(ctx.values[f.id])) return "";
    return `<tr><th>${esc(f.label)}</th><td>${ro ? esc(txt(ctx.values[f.id])) : campo(f, f.id, ctx.values[f.id], true)}</td></tr>`;
  };
  const linhasCalc = calc.map((c, i) => {
    const v = c.value(ctx.values, 0);
    if (ro && !v) return "";
    return `<tr class="calc"><th>${esc(c.label)}<small>calculado automaticamente</small></th><td data-crow="${sid}|${i}">${esc(v || "—")}</td></tr>`;
  }).join("");
  const corpo = regulares.map(linha).join("") + linhasCalc + notas.map(linha).join("");
  if (!corpo.trim()) return "";
  return `<div class="scroll-x"><table class="tab campos"><thead><tr><th>${esc(legenda)}</th><th>${ro ? "Resultado" : "Valor"}</th></tr></thead><tbody>${corpo}</tbody></table></div>`;
}

/* Diagrama de ângulos (porta do AngleGauge). */
export function gaugeSVG(g, values, single) {
  const sides = single ? [""] : [...SIDES];
  const keyOf = s => (s ? `${g.columnId}${s}` : g.columnId);
  const cx = 230, cy = 210, r = 150;
  const pt = (deg, rad = r) => { const a = deg * Math.PI / 180; return [cx + rad * Math.cos(a), cy - rad * Math.sin(a)]; };
  const arc = (from, to) => { const [x1, y1] = pt(from), [x2, y2] = pt(Math.min(to, g.max)); return `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 0 0 ${x2.toFixed(1)} ${y2.toFixed(1)}`; };
  const ticks = Array.from(new Set(g.zones.map(z => Math.round(z.from)).concat(g.max))).filter(t => t <= g.max);
  const pernas = sides.map(s => ({ s, a: parseMeasure(values[keyOf(s)]) })).filter(l => l.a !== null);
  const arcos = g.zones.filter(z => z.from < g.max).map(z => `<path d="${arc(z.from, z.to)}" fill="none" stroke="${TONS[z.tone]}" stroke-width="9"/>`).join("");
  const marcas = ticks.map(t => { const [x, y] = pt(t), [lx, ly] = pt(t, r + 20); return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" class="g-guia"/><text x="${lx}" y="${ly}" class="g-tick" text-anchor="middle">${t}°</text>`; }).join("");
  const linhas = pernas.map(l => {
    const [x, y] = pt(Math.min(l.a, g.max), l.s === "E" ? r - 42 : r - 12);
    const z = zoneFor(g.zones, String(l.a));
    return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="${z ? TONS[z.tone] : "#c8f542"}" stroke-width="10" stroke-linecap="round"/><circle cx="${x}" cy="${y}" r="13" class="g-pe"/><text x="${x}" y="${y + 4}" text-anchor="middle" class="g-pe-txt">${l.s || Math.round(l.a)}</text>`;
  }).join("");
  const esq = g.higherIsBetter ? g.bestLabel : g.worstLabel, dir = g.higherIsBetter ? g.worstLabel : g.bestLabel;
  return `<figure class="gauge"><figcaption>${esc(g.title)}</figcaption>
    <svg viewBox="0 0 460 270" role="img" aria-label="${esc(g.title)}">${arcos}${marcas}
    <line x1="40" y1="${cy}" x2="420" y2="${cy}" class="g-chao"/><rect x="70" y="${cy - 11}" width="${cx - 70}" height="18" rx="9" class="g-corpo"/><circle cx="74" cy="${cy - 2}" r="15" class="g-corpo"/>
    ${linhas}<circle cx="${cx}" cy="${cy}" r="7" class="g-pivo"/>
    <text x="40" y="252" class="g-fim">${esc(esq)}</text><text x="420" y="252" text-anchor="end" class="g-fim">${esc(dir)}</text></svg>
    <p>${esc(g.caption)}${pernas.length ? " · " + pernas.map(l => `${l.s ? l.s + " " : ""}${l.a}°`).join(", ") : ""}</p></figure>`;
}

function gauge(sec, ctx, single) {
  const id = registrar("gauges", { g: sec.gauge, single });
  return `<div data-gauge="${id}">${gaugeSVG(sec.gauge, ctx.values, single)}</div>`;
}

function tabelasDaSecao(sec, ctx, ro) {
  let h = "";
  if (sec.checklist) h += tabelaChecklist(sec, ctx, ro);
  if (sec.lateral) {
    const lat = tabelaLateral(sec, ctx, ro);
    h += sec.gauge ? `<div class="com-gauge">${lat}${gauge(sec, ctx, false)}</div>` : lat;
  }
  if (sec.footnote && !ro) h += `<p class="nota">${esc(sec.footnote)}</p>`;
  const campos = tabelaCampos(sec, ctx, ro, sec.checklist || sec.lateral ? "Registro complementar" : "Registro");
  h += sec.gauge && !sec.lateral ? `<div class="com-gauge">${campos}${gauge(sec, ctx, true)}</div>` : campos;
  return h;
}

function guia(ref) {
  const blocos = (ref.guide || []).map(b => `<section><h4>${esc(b.title)}</h4><ul>${b.items.map(i => `<li>${esc(i)}</li>`).join("")}</ul></section>`).join("");
  const refs = ref.references?.length ? `<section class="refs"><h4>Referências</h4><ol>${ref.references.map(i => `<li>${esc(i)}</li>`).join("")}</ol></section>` : "";
  return blocos || refs ? `<details class="guia"><summary>Protocolo, pontos de corte e referências</summary><div class="guia-grid">${blocos}${refs}</div></details>` : "";
}

function ilustracoes(id) {
  const lista = testIllustrations[id];
  if (!lista?.length) return "";
  return `<details class="ilus"><summary>Ver ilustração do teste</summary><div class="ilus-grid">${lista.map(i =>
    `<figure><img src="${esc(i.src)}" alt="${esc(i.caption)}" loading="lazy"><figcaption>${esc(i.caption)}</figcaption></figure>`).join("")}</div></details>`;
}

/* ───────────────────────────── seção do formulário ───────────────────────────── */

function secaoForm(sec, numero, ctx) {
  const titulo = limparTitulo(sec.title);
  const ref = protocolReferences[sec.id];
  const grupos = sec.perRound ? [] : testResultGroupsFor(sec);
  let corpo = "";
  if (sec.perRound) {
    const tabs = ref?.tables?.length ? `<div class="ptables">${ref.tables.map(t => tabelaRef(t, ctx, true)).join("")}</div>` : "";
    corpo = `<div class="teste">
      ${sec.subtitle ? `<p class="teste-sub">${esc(sec.subtitle)}</p>` : ""}
      ${ilustracoes(sec.id)}
      ${ref?.application?.length ? `<p class="howto"><b>Como aplicar:</b> ${esc(ref.application.join(" "))}</p>` : ""}
      ${sec.referencesFirst ? tabs : ""}${tabelasDaSecao(sec, ctx, false)}${sec.referencesFirst ? "" : tabs}
      ${ref ? guia(ref) : ""}</div>`;
  } else if (grupos.length) {
    corpo = grupos.map(g => `<div class="grupo-teste"><h4>${esc(g.title)}</h4>
      ${g.reference.application?.length ? `<div class="passo"><span class="passo-n">1</span><div><b>Como aplicar</b><ul>${g.reference.application.map(a => `<li>${esc(a)}</li>`).join("")}</ul></div></div>` : ""}
      ${g.reference.tables?.length ? `<div class="passo"><span class="passo-n">2</span><div class="passo-full"><b>Índices de classificação</b><div class="ptables">${g.reference.tables.map(t => tabelaRef(t, ctx, true)).join("")}</div></div></div>` : ""}
      <div class="passo"><span class="passo-n">${g.reference.tables?.length ? 3 : 2}</span><div class="passo-full"><b>Resultado</b>${grade(g.fields.map(id => sec.fields.find(f => f.id === id)).filter(Boolean), ctx)}</div></div>
    </div>`).join("");
  } else {
    corpo = (sec.id === "parecer-profissional"
      ? `<div class="parecer-auto"><p>Gere um parecer inicial a partir dos resultados marcados e ajuste o texto como quiser.</p><button type="button" class="btn btn-ghost btn-sm" data-acao="parecer">Gerar parecer automático</button></div>` : "")
      + grade(sec.fields, ctx);
  }
  return `<section class="card secao" id="s-${esc(sec.id)}">
    <div class="secao-head"><span class="num">${esc(numero || "•")}</span><div><h3>${esc(titulo)}</h3>${sec.description ? `<p>${esc(sec.description)}</p>` : ""}</div></div>
    ${corpo}</section>`;
}

/* ───────────────────────────── formulário ───────────────────────────── */

export async function montarFormulario(root, tipo) {
  const T = TIPOS[tipo];
  const todas = sectionsForType(tipo);
  const ident = todas.find(s => s.placement === "identification");
  const medidas = todas.find(s => s.placement === "measures");
  const secoes = todas.filter(s => !s.placement);
  const numeros = numberSections(secoes);
  const params = new URLSearchParams(location.search);
  const CHAVE_RASC = `inoveavalia-rascunho-${tipo}`;

  const st = {
    id: null, criadoEm: null,
    meta: { nome: "", nasc: "", data: hoje(), avaliador: "", aluno: "" },
    values: {}
  };
  let aviso = "";

  try {
    if (params.get("editar")) {
      const av = await obterAvaliacao(params.get("editar"));
      if (av) {
        const fd = { ...(av.formData || {}) };
        st.id = av.id; st.criadoEm = av.criadoEm;
        st.meta = { nome: av.patientName || "", nasc: fd.dataNascimento || "", data: av.assessmentDate || hoje(), avaliador: av.avaliador || "", aluno: av.alunoI9 || "" };
        delete fd.dataNascimento; delete fd.avaliacoesDatas;
        st.values = fd;
        aviso = `Editando a avaliação de <b>${esc(av.patientName)}</b> de ${dataBR(av.assessmentDate)}.`;
      }
    } else if (params.get("reavaliar")) {
      const av = await obterAvaliacao(params.get("reavaliar"));
      if (av) {
        const fd = anamnesisValues(tipo, av.formData || {});
        st.meta = { nome: av.patientName || "", nasc: (av.formData || {}).dataNascimento || "", data: hoje(), avaliador: av.avaliador || "", aluno: av.alunoI9 || "" };
        delete fd.dataNascimento;
        st.values = fd;
        aviso = `Nova avaliação de <b>${esc(av.patientName)}</b>: identificação e anamnese foram trazidas da avaliação de ${dataBR(av.assessmentDate)}. Medidas e testes começam em branco.`;
      }
    } else {
      const r = JSON.parse(localStorage.getItem(CHAVE_RASC) || "null");
      if (r && r.values) {
        st.meta = { ...st.meta, ...r.meta }; st.values = r.values;
        aviso = `Rascunho recuperado (${new Date(r.ts).toLocaleString("pt-BR")}). <button type="button" class="link-btn" data-acao="descartar">Descartar e começar do zero</button>`;
      }
    }
  } catch (e) { console.warn(e); }

  const idade = () => (isIsoDate(st.meta.nasc) ? ageFromBirthDate(st.meta.nasc, st.meta.data) : null);
  const ctx = () => ({ values: st.values, idade: idade() ?? undefined, sexo: sexoDe(st.values) });
  REG = { tabelas: new Map(), secoes: new Map(), gauges: new Map(), n: 0 };
  const c = ctx();

  let html = `
  <section class="hero-av">
    <a class="voltar" href="/avaliacoes/">← Avaliações</a>
    <p class="eyebrow">${esc(T.nome)}</p>
    <h1>${esc(T.sub)}</h1>
    <p class="lead">${esc(T.publico)}. ${esc(T.resumo)}</p>
  </section>
  ${aviso ? `<div class="banner" data-banner>${aviso}</div>` : ""}
  <nav class="secnav" aria-label="Seções">
    <a href="#s-aplicacao">Aplicação</a><a href="#s-pessoa">Pessoa</a><a href="#s-medidas">Medidas</a>
    ${secoes.map((s, i) => `<a href="#s-${esc(s.id)}">${esc(numeros[i] ? numeros[i] + ". " : "")}${esc(limparTitulo(s.title).split(" — ")[0].split(" (")[0])}</a>`).join("")}
  </nav>

  <section class="card" id="s-aplicacao">
    <div class="card-head"><span class="eyebrow">Aplicação</span><h2>Avaliador e data</h2></div>
    <div class="grid-campos">
      <div class="fbox"><label>Avaliador(a)</label><input class="inp" data-meta="avaliador" list="lista-avaliadores" value="${esc(st.meta.avaliador)}" placeholder="Nome do profissional"></div>
      <div class="fbox"><label>Data da avaliação</label><input class="inp" type="date" data-meta="data" value="${esc(st.meta.data)}"></div>
      <div class="fbox full"><label>Aluno(a) do i9Treino <small>(opcional — vincula a avaliação ao cadastro da plataforma)</small></label>
        <input class="inp" data-meta="aluno" list="lista-alunos" value="${esc(st.meta.aluno)}" placeholder="Digite o nome ou o nick do aluno"></div>
    </div>
    <datalist id="lista-avaliadores"></datalist><datalist id="lista-alunos"></datalist>
  </section>

  <section class="card" id="s-pessoa">
    <div class="card-head"><span class="eyebrow">Pessoa avaliada</span><h2>Identificação</h2></div>
    <div class="pessoa">
      <div class="fbox nome"><label>Nome completo</label><input class="inp" data-meta="nome" value="${esc(st.meta.nome)}" autocomplete="off"></div>
      <div class="fbox"><label>Data de nascimento</label><input class="inp" type="date" data-meta="nasc" max="${hoje()}" value="${esc(st.meta.nasc)}"></div>
      <div class="idade" data-idade></div>
    </div>
    <p class="alerta-idade" data-alerta-idade hidden></p>
    ${ident ? grade(ident.fields, c) : ""}
  </section>

  <section class="card" id="s-medidas">
    <div class="card-head"><span class="eyebrow">Medidas corporais</span><h2>Peso, altura, circunferências, pressão e frequência cardíaca</h2></div>
    ${medidas ? tabelasDaSecao(medidas, c, false) : ""}
    ${medidas && protocolReferences[medidas.id] ? `<details class="guia"><summary>Como medir e índices de classificação</summary>
      ${protocolReferences[medidas.id].application?.length ? `<ul class="lista">${protocolReferences[medidas.id].application.map(a => `<li>${esc(a)}</li>`).join("")}</ul>` : ""}
      <div class="ptables">${(protocolReferences[medidas.id].tables || []).map(t => tabelaRef(t, c, false)).join("")}</div></details>` : ""}
  </section>`;

  secoes.forEach((s, i) => {
    if (s.part && s.part !== secoes[i - 1]?.part) html += `<h2 class="parte">${PARTES[s.part]}</h2>`;
    html += secaoForm(s, numeros[i], c);
  });

  html += `
  <div class="rodape-form">
    <p class="erro" data-erro role="alert"></p>
    <div class="acoes">
      <span class="status" data-status>Rascunho salvo automaticamente neste aparelho.</span>
      <button type="button" class="btn btn-primary" data-acao="salvar">Salvar avaliação</button>
    </div>
  </div>`;
  root.innerHTML = html;

  // Listas auxiliares
  listarAlunosI9().then(alunos => {
    const dl = root.querySelector("#lista-alunos");
    if (dl) dl.innerHTML = alunos.map(a => `<option value="${esc(a.nome || a.nick)}${a.nick && a.nome ? " (@" + esc(a.nick) + ")" : ""}">`).join("");
  });
  try {
    const avs = JSON.parse(localStorage.getItem("inoveavalia-avaliadores") || "[]");
    root.querySelector("#lista-avaliadores").innerHTML = avs.map(a => `<option value="${esc(a)}">`).join("");
  } catch (e) { /* sem storage */ }

  /* ── atualização das partes dinâmicas ── */
  function atualizar() {
    const cx = ctx();
    const id = cx.idade;
    const boxIdade = root.querySelector("[data-idade]");
    boxIdade.innerHTML = `<span>Idade</span>${id !== undefined ? `<strong>${id} <small>anos</small></strong>` : st.meta.nasc ? "<em>Data inválida</em>" : "<em>Informe o nascimento</em>"}`;
    const al = root.querySelector("[data-alerta-idade]");
    const foraLongev = tipo === "longev" && id !== undefined && id < 60;
    const foraMulti = tipo === "multifuncional" && id !== undefined && id >= 60;
    al.hidden = !(foraLongev || foraMulti);
    if (foraLongev) al.innerHTML = `Esta pessoa tem ${id} anos. O InoveAvalia Plus foi feito para 60 anos ou mais — para menos de 60, use o <a href="/avaliacoes/inoveavalia/">InoveAvalia</a>.`;
    if (foraMulti) al.innerHTML = `Esta pessoa tem ${id} anos. Para 60 anos ou mais, o protocolo indicado é o <a href="/avaliacoes/inoveavaliaplus/">InoveAvalia Plus</a>.`;
    root.querySelectorAll("[data-sw]").forEach(el => { el.hidden = st.values[el.dataset.sw] !== el.dataset.sweq; });
    root.querySelectorAll("[data-comp]").forEach(el => { el.textContent = txt(st.values[el.dataset.comp]) || "—"; });
    root.querySelectorAll("[data-crow]").forEach(el => {
      const [sid, i] = el.dataset.crow.split("|"); const sec = REG.secoes.get(sid);
      el.textContent = sec?.computedRows?.[i]?.value(st.values, 0) || "—";
    });
    root.querySelectorAll("[data-lcomp]").forEach(el => {
      const [sid, col, side] = el.dataset.lcomp.split("|"); const sec = REG.secoes.get(sid);
      const def = sec?.lateral?.columns.find(cc => cc.id === col);
      el.textContent = def?.computed?.(cc => st.values[`${cc}${side}`]) || "—";
    });
    root.querySelectorAll("[data-gauge]").forEach(el => { const g = REG.gauges.get(el.dataset.gauge); el.innerHTML = gaugeSVG(g.g, st.values, g.single); });
    root.querySelectorAll("[data-ptable]").forEach(el => { const t = REG.tabelas.get(el.dataset.ptable); el.innerHTML = tabelaRefInner(t.table, cx, t.editavel); });
  }

  function sincronizarCampos() {
    const ativo = document.activeElement;
    root.querySelectorAll("[data-k]").forEach(el => {
      if (el === ativo) return;
      const v = st.values[el.dataset.k];
      const t = el.dataset.t;
      if (t === "radio") el.checked = v === el.value;
      else if (t === "multi" || t === "side") el.checked = Array.isArray(v) ? v.includes(el.value) : v === el.value;
      else if (t === "sim") el.checked = v === "Sim";
      else if (el.value !== (typeof v === "string" ? v : "")) el.value = typeof v === "string" ? v : "";
    });
  }

  let timerRasc;
  function salvarRascunho() {
    if (st.id) return;
    clearTimeout(timerRasc);
    timerRasc = setTimeout(() => {
      try { localStorage.setItem(CHAVE_RASC, JSON.stringify({ meta: st.meta, values: st.values, ts: Date.now() })); } catch (e) { /* sem storage */ }
    }, 500);
  }

  function setValue(k, v) {
    st.values[k] = v;
    for (const s of todas) if (s.derive) Object.assign(st.values, s.derive(st.values));
    atualizar();
    salvarRascunho();
  }

  function lerValor(el) {
    const k = el.dataset.k;
    const grupo = () => [...root.querySelectorAll(`[data-k="${CSS.escape(k)}"]`)];
    switch (el.dataset.t) {
      case "radio": return el.value;
      case "multi": return grupo().filter(x => x.checked).map(x => x.value);
      case "side": return grupo().filter(x => x.checked).map(x => x.value).sort();
      case "sim": return el.checked ? "Sim" : "";
      default: return el.value;
    }
  }

  const aoMudar = e => {
    const el = e.target;
    if (el.dataset.meta) {
      st.meta[el.dataset.meta] = el.value;
      if (el.dataset.meta === "nasc" || el.dataset.meta === "data") atualizar();
      salvarRascunho();
      return;
    }
    if (el.dataset.k) setValue(el.dataset.k, lerValor(el));
  };
  root.addEventListener("input", aoMudar);
  root.addEventListener("change", aoMudar);

  /* Seleção nas tabelas de referência */
  function escolher(tId, ri, limpar) {
    const { table } = REG.tabelas.get(tId);
    const pick = table.pick; if (!pick) return;
    const labelOf = pick.labelOf || (row => row[0]);
    const cx = ctx();
    const atribuir = (fid, i) => {
      st.values[fid] = i < 0 ? "" : labelOf(table.rows[i]);
      st.values[`${fid}__linha`] = i < 0 ? "" : String(i);
    };
    if (limpar && pick.sides) { atribuir(pick.sides.right, -1); atribuir(pick.sides.left, -1); }
    else if (!pick.sides) atribuir(pick.fieldId, linhaSelecionada(table, cx, pick.fieldId) === ri ? -1 : ri);
    else {
      const r = linhaSelecionada(table, cx, pick.sides.right), l = linhaSelecionada(table, cx, pick.sides.left);
      if (r < 0) atribuir(pick.sides.right, ri);
      else if (l < 0) atribuir(pick.sides.left, ri);
      else { atribuir(pick.sides.right, ri); atribuir(pick.sides.left, -1); }
    }
    for (const s of todas) if (s.derive) Object.assign(st.values, s.derive(st.values));
    atualizar(); sincronizarCampos(); salvarRascunho();
  }

  root.addEventListener("click", e => {
    const limpar = e.target.closest("[data-limpar]");
    const tr = e.target.closest("tr[data-row]");
    const box = e.target.closest("[data-ptable]");
    if (box && (limpar || tr)) { escolher(box.dataset.ptable, tr ? Number(tr.dataset.row) : -1, !!limpar); return; }
    const acao = e.target.closest("[data-acao]")?.dataset.acao;
    if (acao === "parecer") gerarParecer();
    if (acao === "salvar") salvar();
    if (acao === "descartar") {
      try { localStorage.removeItem(CHAVE_RASC); } catch (er) { /* sem storage */ }
      location.href = location.pathname;
    }
  });
  root.addEventListener("keydown", e => {
    const tr = e.target.closest?.("tr[data-row]");
    if (tr && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); escolher(tr.closest("[data-ptable]").dataset.ptable, Number(tr.dataset.row)); }
  });

  function gerarParecer() {
    const ja = ["resumoProfissional", "pontosAtencaoProfissional", "avaliacaoFinalProfissional"].some(k => temValor(st.values[k]));
    if (ja && !confirm("Substituir o texto do parecer pelo parecer automático?")) return;
    const p = buildInitialProfessionalAnalysis({
      type: tipo, patientName: st.meta.nome || "Aluno", formData: { ...st.values, dataNascimento: st.meta.nasc },
      patientAge: idade() ?? undefined, assessmentDate: st.meta.data
    });
    Object.assign(st.values, p);
    sincronizarCampos(); salvarRascunho();
  }

  async function salvar() {
    const erro = root.querySelector("[data-erro]");
    const btn = root.querySelector('[data-acao="salvar"]');
    const id = idade();
    if (!st.meta.nome.trim()) { erro.textContent = "Preencha o nome da pessoa avaliada."; root.querySelector('[data-meta="nome"]').focus(); return; }
    if (!isIsoDate(st.meta.nasc) || id === null) { erro.textContent = "Informe uma data de nascimento válida."; root.querySelector('[data-meta="nasc"]').focus(); return; }
    erro.textContent = "";
    btn.disabled = true; btn.textContent = "Salvando...";
    try {
      const formData = { ...st.values, dataNascimento: st.meta.nasc, avaliacoesDatas: [st.meta.data] };
      const registro = await salvarAvaliacao({
        id: st.id || undefined, criadoEm: st.criadoEm || undefined, type: tipo,
        patientName: st.meta.nome.trim(), patientAge: id, assessmentDate: st.meta.data,
        avaliador: st.meta.avaliador.trim(), alunoI9: st.meta.aluno.trim(), formData
      });
      try {
        localStorage.removeItem(CHAVE_RASC);
        if (st.meta.avaliador.trim()) {
          const avs = new Set(JSON.parse(localStorage.getItem("inoveavalia-avaliadores") || "[]"));
          avs.add(st.meta.avaliador.trim());
          localStorage.setItem("inoveavalia-avaliadores", JSON.stringify([...avs].slice(-20)));
        }
      } catch (e) { /* sem storage */ }
      mostrarConcluido(root, registro);
    } catch (e) {
      console.error(e);
      erro.textContent = "Não foi possível salvar. Verifique a internet e tente de novo — seus dados continuam nesta tela.";
      btn.disabled = false; btn.textContent = "Salvar avaliação";
    }
  }

  atualizar();
}

function mostrarConcluido(root, av) {
  const T = TIPOS[av.type];
  root.innerHTML = `
    <section class="hero-av concluido no-print">
      <p class="eyebrow">Avaliação salva</p>
      <h1>${esc(av.patientName)}</h1>
      <p class="lead">${esc(T.nome)} · ${dataBR(av.assessmentDate)}. O resultado já aparece no painel de administração.</p>
      <div class="acoes-linha">
        <button class="btn btn-primary" onclick="window.print()">Imprimir / salvar PDF</button>
        <a class="btn btn-ghost" href="${T.rota}">Nova avaliação</a>
        <a class="btn btn-ghost" href="/admin/#avaliacoes">Ir para o painel</a>
      </div>
    </section>
    ${relatorioHTML(av)}`;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ───────────────────────────── relatório ───────────────────────────── */

export function relatorioHTML(av) {
  const tipo = av.type === "longev" ? "longev" : "multifuncional";
  const T = TIPOS[tipo];
  const fd = av.formData || {};
  const todas = sectionsForType(tipo);
  const ident = todas.find(s => s.placement === "identification");
  const medidas = todas.find(s => s.placement === "measures");
  const secoes = todas.filter(s => !s.placement);
  const numeros = numberSections(secoes);
  const idade = isIsoDate(fd.dataNascimento) ? ageFromBirthDate(fd.dataNascimento, av.assessmentDate) : av.patientAge;
  const ctx = { values: fd, idade: idade ?? undefined, sexo: sexoDe(fd) };
  REG = { tabelas: new Map(), secoes: new Map(), gauges: new Map(), n: 0 };

  const dl = fields => fields.filter(f => !f.hidden && temValor(fd[f.id]))
    .map(f => `<div class="dl-i"><dt>${esc(f.label)}</dt><dd>${esc(txt(fd[f.id]))}</dd></div>`).join("");

  const parecer = ["resumoProfissional", "notaGeral", "pontosAtencaoProfissional", "avaliacaoFinalProfissional"].some(k => temValor(fd[k]));
  const multiline = s => esc(s).replace(/\n/g, "<br>");

  let anamnese = "", testes = "";
  secoes.forEach((s, i) => {
    if (s.id === "parecer-profissional") return;
    const titulo = `${numeros[i] ? numeros[i] + ". " : ""}${esc(limparTitulo(s.title))}`;
    if (s.part === "anamnese") {
      const itens = dl(s.fields);
      if (itens) anamnese += `<div class="rel-bloco"><h4>${titulo}</h4><dl class="dl">${itens}</dl></div>`;
      return;
    }
    if (s.perRound) {
      const preenchido = s.fields.some(f => temValor(fd[f.id])) || (s.checklist?.rows || []).some(r => temValor(fd[r.id])) ||
        (s.lateral?.columns || []).some(c => SIDES.some(sd => temValor(fd[`${c.id}${sd}`])));
      if (!preenchido) return;
      testes += `<div class="rel-bloco"><h4>${titulo}</h4>${tabelasDaSecao(s, ctx, true)}</div>`;
      return;
    }
    const grupos = testResultGroupsFor(s);
    const blocos = (grupos.length ? grupos : [{ title: "", fields: s.fields.map(f => f.id) }]).map(g => {
      const itens = dl(g.fields.map(id => s.fields.find(f => f.id === id)).filter(Boolean).map(f => ({ ...f, hidden: false })));
      return itens ? `${g.title ? `<h5>${esc(g.title)}</h5>` : ""}<dl class="dl">${itens}</dl>` : "";
    }).join("");
    if (blocos) testes += `<div class="rel-bloco"><h4>${titulo}</h4>${blocos}</div>`;
  });

  return `<article class="relatorio">
    <header class="rel-head">
      <div><span class="logo">i9<span>Treino</span></span><strong>${esc(T.nome)}</strong><small>${esc(T.sub)}</small></div>
      <div class="rel-data">Relatório de avaliação<br><b>${dataBR(av.assessmentDate)}</b></div>
    </header>
    <section class="rel-pessoa">
      <div><small>Nome</small><b>${esc(av.patientName)}</b></div>
      <div><small>Idade</small><b>${idade ?? "—"} anos</b></div>
      <div><small>Sexo</small><b>${esc(sexoDe(fd) || "—")}</b></div>
      <div><small>Nascimento</small><b>${dataBR(fd.dataNascimento)}</b></div>
      <div><small>Avaliador(a)</small><b>${esc(av.avaliador || "—")}</b></div>
      ${av.alunoI9 ? `<div><small>Aluno i9Treino</small><b>${esc(av.alunoI9)}</b></div>` : ""}
    </section>
    ${parecer ? `<section class="rel-sec rel-parecer"><h3>Parecer profissional</h3>
      <div class="parecer-grid">
        ${temValor(fd.notaGeral) ? `<div class="nota-geral"><small>Nota geral</small><b>${esc(fd.notaGeral)}</b><span>/10</span></div>` : ""}
        <div>
          ${temValor(fd.resumoProfissional) ? `<h5>Resumo</h5><p>${multiline(fd.resumoProfissional)}</p>` : ""}
          ${temValor(fd.pontosAtencaoProfissional) ? `<h5>Pontos de atenção</h5><p>${multiline(fd.pontosAtencaoProfissional)}</p>` : ""}
          ${temValor(fd.avaliacaoFinalProfissional) ? `<h5>Avaliação final e recomendações</h5><p>${multiline(fd.avaliacaoFinalProfissional)}</p>` : ""}
        </div>
      </div></section>` : ""}
    ${medidas ? `<section class="rel-sec"><h3>Medidas corporais</h3>${tabelaCampos(medidas, ctx, true, "Medida") || '<p class="vazio">Sem medidas registradas.</p>'}</section>` : ""}
    ${testes ? `<section class="rel-sec"><h3>Testes</h3>${testes}</section>` : ""}
    ${(ident && dl(ident.fields)) || anamnese ? `<section class="rel-sec"><h3>Identificação e anamnese</h3>
      ${ident && dl(ident.fields) ? `<div class="rel-bloco"><h4>Identificação</h4><dl class="dl">${dl(ident.fields)}</dl></div>` : ""}${anamnese}</section>` : ""}
    <footer class="rel-foot">i9Treino · ${esc(T.nome)} · gerado em ${new Date().toLocaleDateString("pt-BR")}</footer>
  </article>`;
}
