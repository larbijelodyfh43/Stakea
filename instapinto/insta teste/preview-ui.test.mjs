import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source = await readFile(new URL('./js/preview-ui.js', import.meta.url), 'utf8');
function render(page) {
  const app = {}, dialog = {querySelector:()=>({}),showModal(){this.open=true;},close(){this.open=false;}}, toast = {};
  let handler;
  const document = {body:{dataset:{page},append(){}},querySelector:selector=>selector==='#app'?app:toast,
    createElement:()=>dialog,addEventListener:(name,fn)=>{handler=fn;}};
  const context = vm.createContext({document,window:{demoEscape:value=>String(value)},localStorage:{getItem:()=>null},setTimeout,clearTimeout});
  vm.runInContext(source,context);
  const click = (attribute, extra={}) => {
    const button = {dataset:{},hasAttribute:name=>name===attribute,...extra};
    handler({target:{closest:()=>button}});
  };
  return {app,dialog,click};
}
test('feed has 15 posts; liking toggles the count without external requests',()=>{
  const ui=render('feed');
  assert.equal((ui.app.innerHTML.match(/class="post"/g)||[]).length,15);
  assert.equal((ui.app.innerHTML.match(/<time>há 1 dia<\/time>/g)||[]).length,15);
  const count={textContent:'125 curtidas'}; let pressed='false';
  const button={getAttribute:()=>pressed,setAttribute:(key,value)=>pressed=value,closest:()=>({querySelector:()=>count})};
  ui.click('data-like',button);
  assert.equal(pressed,'true'); assert.equal(count.textContent,'126 curtidas');
  ui.click('data-like',button);
  assert.equal(pressed,'false'); assert.equal(count.textContent,'125 curtidas');
});
test('Direct opens an explicitly fictitious conversation',()=>{
  const ui=render('direct');
  assert.equal((ui.app.innerHTML.match(/class="conversation"/g)||[]).length,10);
  ui.click('data-chat',{dataset:{chat:'0'}});
  assert.equal(ui.dialog.open,true); assert.match(ui.dialog.innerHTML,/Conversa fictícia/);
});
test('checkout completes as a simulation without network or personal information',()=>{
  const ui=render('cta');
  ui.click('data-checkout'); assert.match(ui.dialog.innerHTML,/Nenhum dado pessoal/);
  ui.click('data-generate'); assert.match(ui.dialog.innerHTML,/SEM QR PAGÁVEL/);
  ui.click('data-paid'); assert.match(ui.dialog.innerHTML,/Simulação concluída/);
  assert.match(ui.dialog.innerHTML,/Nenhum pagamento foi processado/);
});
