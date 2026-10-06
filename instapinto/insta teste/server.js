import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';

const root = path.dirname(fileURLToPath(import.meta.url));
try { process.loadEnvFile(path.join(root, '.env')); } catch {}
const key = process.env.ANYAPI_KEY;
const port = Number(process.env.PORT || 8000);
const profiles = new Map(), pending = new Map(), images = new Map();
const ttl = 15 * 60 * 1000;
const allowedHost = host => host === 'cdninstagram.com' || host.endsWith('.cdninstagram.com') || host === 'fbcdn.net' || host.endsWith('.fbcdn.net');
const json = (res, status, data) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(data)); };
const fail = (status, message) => Object.assign(new Error(message), {status});
function imagePath(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.port || !allowedHost(parsed.hostname)) return '/images/perfil-sem-foto.svg';
    const id = createHash('sha256').update(url).digest('hex');
    images.set(id, {url});
    return `/api/image/${id}`;
  } catch { return '/images/perfil-sem-foto.svg'; }
}
async function loadProfile(username) {
  if (!key) throw fail(503, 'Configure ANYAPI_KEY no arquivo .env do servidor.');
  const cached = profiles.get(username);
  if (cached && Date.now() - cached.at < ttl) return {...cached.data, cached: true};
  if (pending.has(username)) return pending.get(username);
  const task = (async () => {
    const response = await fetch('https://api.getanyapi.com/v1/run/instagram.profile', {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({handle: username}), signal: AbortSignal.timeout(60000)
    });
    if (!response.ok) {
      const messages = {401: 'A chave AnyAPI foi recusada.', 403: 'A chave não tem permissão para esta consulta.', 402: 'Saldo insuficiente na AnyAPI.', 429: 'Limite da AnyAPI atingido. Tente novamente mais tarde.'};
      throw fail(response.status === 429 ? 429 : 502, messages[response.status] || `AnyAPI indisponível (HTTP ${response.status}).`);
    }
    const data = await response.json();
    const output = data.output;
    if (output?.found === false) throw fail(404, 'Usuário não encontrado.');
    const user = output?.data;
    if (!user?.handle) throw fail(502, 'A AnyAPI retornou um perfil incompleto.');
    const profile = {
      username: user.handle, full_name: user.displayName || '', biography: user.bio || '',
      profile_pic_url: imagePath(user.avatarUrl), follower_count: user.followers ?? 0,
      followers_count: user.followers ?? 0, following_count: user.following ?? 0,
      media_count: user.posts ?? 0, is_private: !!user.private, is_verified: !!user.verified,
      pk: user.userId || '', _following: [], source: 'AnyAPI — perfil público', timestamp: Date.now()
    };
    const result = {profile, cached: false, costUsd: data.costUsd};
    profiles.set(username, {at: Date.now(), data: result});
    return result;
  })();
  pending.set(username, task);
  try { return await task; } finally { pending.delete(username); }
}
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.jpg':'image/jpeg','.jpeg':'image/jpeg','.woff2':'font/woff2'};
export const server = http.createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; font-src 'self' data:; connect-src 'self'; media-src 'self' blob:; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'none'");
  try {
    const proto = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers.host || `127.0.0.1:${port}`;
    const url = new URL(req.url, `${proto}://${host}`);
    const pageAliases = {'/feed':'/feed.html','/direct':'/direct.html','/cta':'/paginafinal.html','/pages/cta.html':'/paginafinal.html','/pages/feed.html':'/feed.html','/pages/direct.html':'/direct.html'};
    if (pageAliases[url.pathname] && (req.method === 'GET' || req.method === 'HEAD')) {
      res.writeHead(302, {Location:pageAliases[url.pathname] + url.search}); return res.end();
    }
    if (req.method === 'POST' && url.pathname === '/api/profile') {
      if (req.headers.origin) {
        let originHost;
        try { originHost = new URL(req.headers.origin).host; }
        catch { return json(res, 403, {error:'Origem não autorizada.'}); }
        if (originHost !== host) return json(res, 403, {error:'Origem não autorizada.'});
      }
      if (!req.headers['content-type']?.startsWith('application/json')) return json(res,415,{error:'Envie JSON.'});
      let raw = '';
      for await (const chunk of req) { raw += chunk; if (raw.length > 1024) throw fail(413,'Requisição muito grande.'); }
      let input; try { input = JSON.parse(raw); } catch { throw fail(400,'JSON inválido.'); }
      const username = String(input.username || '').trim().replace(/^@+/, '').toLowerCase();
      if (!/^[a-z0-9_.]{1,30}$/.test(username)) return json(res,400,{error:'Informe um @ válido (até 30 caracteres).'});
      return json(res,200,await loadProfile(username));
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return json(res,405,{error:'Método não permitido.'});
    if (url.pathname === '/api/health') return json(res,200,{ok:true,configured:!!key,simulation:true});
    if (url.pathname.startsWith('/api/image/')) {
      const entry = images.get(url.pathname.split('/').pop());
      if (!entry) {res.writeHead(302,{Location:'/images/perfil-sem-foto.svg'}); return res.end();}
      if (!entry.bytes) {
        const upstream = await fetch(entry.url,{redirect:'error',signal:AbortSignal.timeout(20000)});
        if (!upstream.ok || !/^image\/(jpeg|png|webp)/.test(upstream.headers.get('content-type') || '')) throw fail(502,'Foto indisponível.');
        entry.type = upstream.headers.get('content-type');
        entry.bytes = Buffer.from(await upstream.arrayBuffer());
      }
      res.writeHead(200,{'Content-Type':entry.type}); return res.end(entry.bytes);
    }
    const name = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname).slice(1);
    const publicPage = ['index.html','feed.html','direct.html','paginafinal.html'].includes(name);
    const publicAsset = /^(images|css|js|fonts)\/[a-zA-Z0-9_./-]+$/.test(name) && !!mime[path.extname(name)];
    if ((!publicPage && !publicAsset) || name.split('/').some(part => part.startsWith('.'))) return json(res,404,{error:'Arquivo não encontrado.'});
    const full = path.resolve(root,name);
    if (!full.startsWith(root + path.sep)) return json(res,404,{error:'Arquivo não encontrado.'});
    const bytes = await readFile(full);
    res.writeHead(200,{'Content-Type':mime[path.extname(name)]}); res.end(req.method === 'HEAD' ? undefined : bytes);
  } catch (error) {
    const status = error.status || (error.code === 'ENOENT' ? 404 : 502);
    const message = error.status ? error.message : error.name === 'TimeoutError' ? 'A consulta demorou demais. Tente novamente.' : status === 404 ? 'Arquivo não encontrado.' : 'Falha de conexão com o serviço. Tente novamente.';
    json(res,status,{error:message});
  }
});
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  server.listen(port,'127.0.0.1',() => console.log(`Simulação local: http://127.0.0.1:${port}`));
}
