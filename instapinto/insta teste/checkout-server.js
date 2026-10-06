const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = __dirname;
const PORT = 8940;
const CONFIG_PATH = path.join(ROOT, '.checkout-pingupag.json');
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const API_BASE = 'https://app.pingupag.com';

function json(res, status, body) {
  const data = Buffer.from(JSON.stringify(body));
  res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Content-Length':data.length,'Cache-Control':'no-store'});
  res.end(data);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 100000) req.destroy();
    });
    req.on('end', () => {
      try { resolve(JSON.parse(raw || '{}')); } catch { reject(new Error('JSON invalido')); }
    });
    req.on('error', reject);
  });
}

function onlyDigits(value) { return String(value || '').replace(/\D/g, ''); }
function validEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '')); }
function sanitizeTracking(value) {
  const allowed = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','src','sck'];
  const out = {};
  if (!value || typeof value !== 'object') return out;
  for (const key of allowed) if (value[key]) out[key] = String(value[key]).slice(0, 300);
  return out;
}

function calculateOrder(body) {
  let amount = body.promo === true ? 990 : 1990;
  const bumps = Array.isArray(body.bumps) ? body.bumps : [];
  const names = [];
  if (bumps.includes('bump')) { amount += 1890; names.push('ZapClone'); }
  if (bumps.includes('bump3')) { amount += 1390; names.push('Mensagens Apagadas'); }
  return {amount, names};
}

function mockQrDataUrl() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="164" height="164"><rect width="164" height="164" fill="white"/><rect x="12" y="12" width="48" height="48" fill="#111"/><rect x="104" y="12" width="48" height="48" fill="#111"/><rect x="12" y="104" width="48" height="48" fill="#111"/><path d="M76 20h12v12H76zm0 28h20v20H76zm28 28h12v12h-12zM72 96h20v20H72zm28 20h16v16h-16zm28-44h20v20h-20z" fill="#111"/><text x="82" y="151" font-family="Arial" font-size="10" text-anchor="middle" fill="#111">PIX TESTE</text></svg>`;
  return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
}

async function createPayment(req, res) {
  let body;
  try { body = await readJson(req); } catch (error) { return json(res, 400, {error:error.message}); }
  const phone = onlyDigits(body.phone);
  const document = onlyDigits(body.document);
  if (!String(body.name || '').trim()) return json(res, 400, {error:'Informe o nome completo'});
  if (!validEmail(body.email)) return json(res, 400, {error:'E-mail invalido'});
  if (phone.length < 10) return json(res, 400, {error:'Telefone invalido'});
  if (document.length !== 11) return json(res, 400, {error:'CPF invalido'});

  const order = calculateOrder(body);
  const reference = `INSTA-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  if (config.mode !== 'live') {
    return json(res, 200, {
      success:true, mock:true, transaction_id:`MOCK-${Date.now()}`,
      qr_code:'PIX-DEMONSTRACAO-SEM-VALOR-REAL', copia_cola:'PIX-DEMONSTRACAO-SEM-VALOR-REAL',
      qr_code_base64:'', amount:order.amount, reference
    });
  }

  const payload = {
    amount: order.amount,
    description: 'STALKEA.AI - Acesso VIP' + (order.names.length ? ' + ' + order.names.join(' + ') : ''),
    reference,
    source: 'api_externa',
    customer: {name:String(body.name).trim(), email:String(body.email).trim(), phone, document},
    tracking: sanitizeTracking(body.tracking)
  };

  try {
    const upstream = await fetch(`${API_BASE}/gateway/v1/transaction`, {
      method:'POST',
      headers:{'X-API-Key':config.apiKey,'Content-Type':'application/json'},
      body:JSON.stringify(payload),
      signal:AbortSignal.timeout(20000)
    });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok || data.status === 'error' || data.success === false) {
      return json(res, upstream.status || 502, {error:data.message || data.error || 'Falha ao gerar PIX'});
    }
    const result = data.data || data.transaction || data;
    const pixCode = result.qr_code || result.pix_code || result.pix || result.copy_paste || result.copia_cola || '';
    const pixImage = result.qr_code_base64 || result.qrcode_base64 || result.pix_base64 || result.qr_image || '';
    return json(res, 200, {
      success:true, mock:false, transaction_id:result.transaction_id || result.id,
      qr_code:pixCode, copia_cola:pixCode,
      qr_code_base64:pixImage, amount:result.amount,
      expires_at:result.expires_at, reference
    });
  } catch (error) {
    return json(res, 502, {error:'Gateway indisponivel. Tente novamente.'});
  }
}

async function paymentStatus(url, res) {
  const id = url.searchParams.get('transaction_id');
  if (!id || config.mode !== 'live') return json(res, 200, {status:'pending', mock:true});
  try {
    const upstream = await fetch(`${API_BASE}/gateway/v1/query?action=get_transaction&id=${encodeURIComponent(id)}`, {
      headers:{'X-API-Key':config.apiKey}, signal:AbortSignal.timeout(15000)
    });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) return json(res, upstream.status || 502, {status:'error'});
    return json(res, 200, {status:data.status === 'approved' ? 'paid' : data.status || 'pending'});
  } catch { return json(res, 502, {status:'error'}); }
}

function serveStatic(url, res) {
  const pathname = decodeURIComponent(url.pathname);
  let file;
  if (pathname === '/' || pathname === '/checkout.html') file = path.join(ROOT, 'checkout.html');
  else if (pathname.startsWith('/checkout-assets/')) file = path.join(ROOT, pathname.replace(/^\//, ''));
  else return json(res, 404, {error:'Nao encontrado'});
  if (!file.startsWith(ROOT) || !fs.existsSync(file)) return json(res, 404, {error:'Nao encontrado'});
  const ext = path.extname(file).toLowerCase();
  const types = {'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp'};
  const data = fs.readFileSync(file);
  res.writeHead(200, {'Content-Type':types[ext] || 'application/octet-stream','Content-Length':data.length,'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'});
  res.end(data);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
  if (req.method === 'GET' && url.pathname === '/api/health') return json(res, 200, {ok:true, mode:config.mode, gateway:'Pingupag', storeId:config.storeId});
  if (req.method === 'POST' && url.pathname === '/api/payment/create') return createPayment(req, res);
  if (req.method === 'GET' && url.pathname === '/api/payment/status') return paymentStatus(url, res);
  if (req.method !== 'GET') return json(res, 405, {error:'Metodo nao permitido'});
  serveStatic(url, res);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Checkout local em http://127.0.0.1:${PORT}/checkout.html (${config.mode})`);
});
