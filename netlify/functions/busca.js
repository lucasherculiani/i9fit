// i9 Cifras — busca músicas no Banana Cifras.
// Uso: GET /.netlify/functions/busca?q=nome da musica
// O Cifra Club é buscado direto pelo navegador; o Banana não permite, por isso passa por aqui.

const HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=600', 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, OPTIONS' };
const reply = (statusCode, body) => ({ statusCode, headers: HEADERS, body: JSON.stringify(body) });
// Parâmetro "v" usado pelo próprio site do Banana na busca (nov/2026). Se a busca parar, atualize aqui.
const V = 'fd755dcdbd90c073505e1f713b8b92c6';

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: HEADERS, body: '' };
  const q = String((event.queryStringParameters || {}).q || '').trim().slice(0, 100);
  if (q.length < 2) return reply(400, { error: 'Digite pelo menos 2 letras' });
  try {
    const r = await fetch(`https://search.bananacifra.com/searchapi/song?v=${V}&BR=1&q=${encodeURIComponent(q)}`, {
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36',
        accept: 'application/json', referer: 'https://www.bananacifras.com/', origin: 'https://www.bananacifras.com',
      },
    });
    if (!r.ok) return reply(502, { error: `O Banana respondeu ${r.status}` });
    return reply(200, { items: toItems(await r.json()) });
  } catch (e) {
    return reply(502, { error: 'Não consegui buscar no Banana agora' });
  }
};

// Cada resultado vem como [id, slugMusica, titulo, slugArtista, nomeArtista, tipo]
function toItems(d) {
  return (Array.isArray(d) ? d : [])
    .filter((a) => Array.isArray(a) && a[1] && a[3])
    .slice(0, 15)
    .map((a) => {
      const art = String(a[3]);
      return { title: String(a[2] || ''), artist: String(a[4] || ''), url: `https://www.bananacifras.com/cifra/${art[0]}/${art}/${a[1]}` };
    });
}

module.exports.toItems = toItems;
