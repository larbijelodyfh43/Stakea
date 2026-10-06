import test from 'node:test';
import assert from 'node:assert/strict';
process.env.PORT = '8129';
process.env.ANYAPI_KEY = 'test-only';
const {server} = await import('./server.mjs');
const realFetch = globalThis.fetch;
let upstreamCalls = 0;
globalThis.fetch = async (url, options) => {
  if (String(url).startsWith('https://api.getanyapi.com/')) {
    upstreamCalls++;
    const {handle} = JSON.parse(options.body);
    if (handle === 'missing') return Response.json({output:{found:false,data:null}});
    if (handle === 'no_balance') return Response.json({}, {status:402});
    if (handle === 'rate_limit') return Response.json({}, {status:429});
    if (handle === 'bad_key') return Response.json({}, {status:401});
    if (handle === 'broken') return Response.json({output:{found:true}});
    assert.equal(options.headers.Authorization, 'Bearer test-only');
    return Response.json({output:{found:true,data:{handle,displayName:'Test',bio:'<b>untrusted</b>',followers:10,following:2,posts:3,private:true,verified:false,avatarUrl:'http://127.0.0.1/secret'}},costUsd:0});
  }
  return realFetch(url,options);
};
await new Promise(resolve => server.listen(8129,'127.0.0.1',resolve));
const base = 'http://127.0.0.1:8129';
const profile = username => realFetch(base+'/api/profile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username})});
test('profile adapter, cache, validation, errors and secret isolation', async () => {
  try {
    const first = await (await profile('@example')).json();
    assert.equal(first.profile.follower_count,10);
    assert.equal(first.profile.is_private,true);
    assert.equal(first.profile.profile_pic_url,'/images/perfil-sem-foto.svg');
    assert.equal((await (await profile('example')).json()).cached,true);
    assert.equal(upstreamCalls,1);
    assert.equal((await profile('invalid/name')).status,400);
    assert.equal(upstreamCalls,1);
    assert.equal((await profile('missing')).status,404);
    assert.equal((await profile('no_balance')).status,502);
    assert.equal((await profile('bad_key')).status,502);
    assert.equal((await profile('rate_limit')).status,429);
    assert.equal((await profile('broken')).status,502);
    for (const route of ['/.env','/server.mjs','/.gitignore','/js/../.env','/js/%2e%2e/.env','/update_demo.py']) {
      assert.equal((await realFetch(base+route)).status,404,route);
    }
    assert.equal((await realFetch(base+'/api/profile',{method:'POST',headers:{Origin:'https://example.com','Content-Type':'application/json'},body:'{}'})).status,403);
    const page = await realFetch(base+'/');
    for (const route of ['/cta','/pages/cta.html']) {
      const alias = await realFetch(base+route,{redirect:'manual'});
      assert.equal(alias.status,302);
      assert.equal(alias.headers.get('location'),'/paginafinal.html');
    }
    const cta = await (await realFetch(base+'/paginafinal.html')).text();
    assert.match(cta,/function irPagar\(\)\{ window.demoNotice\(\); \}/);
    assert.doesNotMatch(cta,/fetch\('\/api\/wp-analyze/);
    const direct = await (await realFetch(base+'/direct.html')).text();
    assert.match(direct,/data-go-to-cta[^>]*>Adquirir Acesso VIP<\/button>/);
    assert.match(direct,/querySelector\('\[data-go-to-cta\]'\)\.onclick = goToCTA/);
    assert.match(direct,/function goToCTA\(\)[\s\S]*paginafinal\.html/);
    assert.match(page.headers.get('content-security-policy'),/connect-src 'self'/);
    assert.doesNotMatch(await page.text(),/aa_live_/);
  } finally { globalThis.fetch = realFetch; await new Promise(resolve => server.close(resolve)); }
});
