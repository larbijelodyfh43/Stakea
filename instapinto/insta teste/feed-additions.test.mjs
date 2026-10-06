import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
test('adds 15 restricted posts without replacing the surrounding feed; likes toggle',async()=>{
  let click;
  const container={dataset:{},innerHTML:'',addEventListener:(type,handler)=>click=handler};
  const context=vm.createContext({window:{location:{}},document:{getElementById:id=>{assert.equal(id,'posts-container');return container;}}});
  vm.runInContext(await readFile(new URL('./js/feed-additions.js',import.meta.url),'utf8'),context);
  assert.equal((container.innerHTML.match(/class="added-post"/g)||[]).length,15);
  assert.equal((container.innerHTML.match(/há 1 dia/g)||[]).length,15);
  assert.doesNotMatch(container.innerHTML,/demonstração|Prévia fictícia/);
  let pressed='false';const count={textContent:'125 curtidas'};
  const button={hasAttribute:name=>name==='data-added-like',getAttribute:()=>pressed,setAttribute:(key,value)=>pressed=value,closest:()=>({querySelector:()=>count})};
  click({target:{closest:()=>button}});assert.equal(count.textContent,'126 curtidas');
  click({target:{closest:()=>button}});assert.equal(count.textContent,'125 curtidas');
  const original=container.innerHTML;context.window.renderLockedPosts();assert.equal(container.innerHTML,original);
});
