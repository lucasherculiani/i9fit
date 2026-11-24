// i9 Cifras — importa uma cifra pelo link (Cifra Club ou Banana Cifras).
// Uso: GET /.netlify/functions/cifra?url=https://www.cifraclub.com.br/artista/musica/
// Só aceita esses dois sites, para não virar um proxy aberto.

const ALLOWED = /(^|\.)(cifraclub\.com\.br|bananacifras\.com)$/i;
const HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=3600', 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, OPTIONS' };
const reply = (statusCode, body) => ({ statusCode, headers: HEADERS, body: JSON.stringify(body) });

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: HEADERS, body: '' };
  const raw = (event.queryStringParameters || {}).url || '';
  let u;
  try { u = new URL(raw); } catch { return reply(400, { error: 'Link inválido' }); }
  if (!/^https?:$/.test(u.protocol) || !ALLOWED.test(u.hostname)) {
    return reply(400, { error: 'Só aceito links do Cifra Club ou do Banana Cifras' });
  }
  try {
    const r = await fetch(u.href, {
      redirect: 'follow',
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36',
        'accept': 'text/html,application/xhtml+xml', 'accept-language': 'pt-BR,pt;q=0.9',
      },
    });
    if (!r.ok) return reply(502, { error: `O site respondeu ${r.status}` });
    const out = extract(await r.text(), u);
    if (!out.text) return reply(422, { error: 'Não encontrei a cifra nessa página' });
    return reply(200, out);
  } catch (e) {
    return reply(502, { error: 'Não consegui acessar o site agora' });
  }
};

function extract(html, u) {
  // A cifra fica no maior bloco <pre> da página nos dois sites.
  const pres = [...html.matchAll(/<pre\b[^>]*>([\s\S]*?)<\/pre>/gi)].map((m) => m[1]);
  const best = pres.sort((a, b) => b.length - a.length)[0] || '';
  const text = clean(best);

  const pick = (re) => { const m = html.match(re); return m ? clean(m[1]) : ''; };
  let title = pick(/<h1[^>]*class="[^"]*\bt1\b[^"]*"[^>]*>([\s\S]*?)<\/h1>/i) || pick(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  let artist = pick(/<h2[^>]*class="[^"]*\bt3\b[^"]*"[^>]*>([\s\S]*?)<\/h2>/i);
  if (!title || !artist) {
    // og:title costuma vir como "Música - Artista - Site"
    const og = pick(/<meta[^>]+property="og:title"[^>]+content="([^"]*)"/i).split(/\s+[-–|]\s+/);
    if (!title && og[0]) title = og[0];
    if (!artist && og[1]) artist = og[1];
  }
  if (!artist) {
    const seg = u.pathname.split('/').filter(Boolean);
    if (seg.length >= 2) artist = pretty(seg[seg.length - 2]);
  }
  const key = pick(/id="cifra_tom"[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/i)
    || ((text.match(/^\s*tom\s*:?\s*([A-G][#b]?m?)(?![a-z])/im) || [])[1] || '');

  return { title: title.slice(0, 120), artist: artist.slice(0, 120), key: key.trim(), text, source: u.href };
}

function clean(s) {
  return decode(String(s).replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ''))
    .replace(/\r/g, '').replace(/ /g, ' ').replace(/\n{3,}/g, '\n\n').replace(/^\n+|\s+$/g, '');
}
function decode(s) {
  return s.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&amp;/g, '&');
}
function pretty(s) {
  return decodeURIComponent(s).replace(/\.html?$/, '').replace(/[-_]+/g, ' ').replace(/\b\p{L}/gu, (c) => c.toUpperCase());
}

module.exports.extract = extract;
