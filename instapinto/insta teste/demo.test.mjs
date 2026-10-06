import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const script = await readFile(new URL('./js/demo.js', import.meta.url), 'utf8');
const page = await readFile(new URL('./index.html', import.meta.url), 'utf8');
const search = page.slice(page.indexOf('async function searchAndShowModal(username)'), page.indexOf('// Função getApiUrl está'));

test('page search opens profile modal and displays API errors without crashing', async () => {
  let calls = 0, modal, errorText, fail = false;
  const input = {style: {}, disabled: false}, button = {disabled: false};
  const context = vm.createContext({
    URL, AbortSignal, console: {log() {}, warn() {}, error() {}},
    location: {href: 'http://127.0.0.1:8000/', origin: 'http://127.0.0.1:8000'},
    document: {addEventListener() {}, getElementById(id) {
      return id === 'usernameInput' ? input : id === 'confirmInputBtn' ? button : {};
    }},
    localStorage: {setItem() {}},
    hideUsernameError() {errorText = undefined;},
    showUsernameError(message) {errorText = message;},
    showConfirmModal(username, data) {modal = {username, data};},
    fetch: async (url, options) => {
      calls++;
      assert.equal(url, '/api/profile');
      assert.equal(options.method, 'POST');
      assert.equal(JSON.parse(options.body).username, 'example');
      return fail ? Response.json({error: 'Saldo insuficiente na AnyAPI.'}, {status: 502})
        : Response.json({profile: {username: 'example', full_name: '<b>Example</b>', biography: 'Demo', follower_count: 10, profile_pic_url: '/images/perfil-sem-foto.svg'}});
    }
  });
  vm.runInContext('window = globalThis', context);
  vm.runInContext(script, context);
  vm.runInContext('window.fetchInstagramProfile = window.fetchPublicProfile;', context);
  vm.runInContext(search, context);
  await vm.runInContext("searchAndShowModal('example')", context);
  assert.equal(modal.data.fullName, '&lt;b&gt;Example&lt;/b&gt;');
  assert.equal(modal.data.followersCount, 10);
  assert.equal(errorText, undefined);
  fail = true;
  await vm.runInContext("searchAndShowModal('example')", context);
  assert.equal(errorText, 'Saldo insuficiente na AnyAPI.');
  assert.equal(input.disabled, false);
  assert.equal(button.disabled, false);
  await assert.rejects(vm.runInContext("fetchPublicProfile('invalid/name')", context), /válido/);
  assert.equal(calls, 2);
});
