(() => {
  const icon = name => {
    const shapes = {
      lock:'M6 10V7a6 6 0 0 1 12 0v3M4 10h16v12H4V10Zm8 5v3',
      heart:'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',
      comment:'M21 11a9 9 0 0 1-13 8L3 21l2-5A9 9 0 1 1 21 11Z',
      repeat:'m17 2 4 4-4 4M3 11V8a2 2 0 0 1 2-2h16M7 22l-4-4 4-4m14-1v3a2 2 0 0 1-2 2H3',
      share:'m22 2-7 20-4-9-9-4 20-7ZM22 2 11 13',
      save:'M5 3h14v19l-7-5-7 5V3Z'
    };
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${shapes[name]}"/></svg>`;
  };
  const names=['fer*****','lim*****','ric*****','ana*****','sm.*****','vit*****','jp0*****','cel*****','who*****','tiq*****','mar*****','bia*****','leo*****','gui*****','isa*****'];
  const places=['São Paulo, Brasil','Rio de Janeiro, Brasil','Belo Horizonte, Brasil','Curitiba, Brasil','Florianópolis, Brasil'];
  window.renderLockedPosts = () => {
    const container = document.getElementById('posts-container');
    if (!container || container.dataset.lockedPosts === 'ready') return;
    container.dataset.lockedPosts = 'ready';
    container.innerHTML = names.map((name,i)=>`<article class="added-post"><header><div class="added-avatar"><img src="images/demo-contact-${i%2+1}.jpg" alt="">${icon('lock')}</div><div><strong>${name}</strong><small>${places[i%places.length]}</small></div><button aria-label="Mais opções" data-post-cta>•••</button></header><a class="added-content" href="paginafinal.html" style="--hue:${i*23}deg"><span class="added-backdrop"></span><span class="added-lock">${icon('lock')}<strong>Conteúdo restrito</strong></span></a><div class="added-actions"><button data-added-like aria-label="Curtir" aria-pressed="false">${icon('heart')}</button><button data-post-cta aria-label="Comentar">${icon('comment')}</button><button data-post-cta aria-label="Republicar">${icon('repeat')}</button><button data-post-cta aria-label="Compartilhar">${icon('share')}</button><button data-post-cta class="added-save" aria-label="Salvar">${icon('save')}</button></div><p><strong class="added-count">${125+i*37} curtidas</strong></p><p><strong>${name}</strong> ✨</p><time>há 1 dia</time></article>`).join('');
    container.addEventListener('click',event=>{
      const button=event.target.closest('button'); if (!button) return;
      if (button.hasAttribute('data-post-cta')) { window.location.href='paginafinal.html'; return; }
      if (button.hasAttribute('data-added-like')) {
        const active=button.getAttribute('aria-pressed')!=='true';
        button.setAttribute('aria-pressed',String(active));
        const count=button.closest('.added-post').querySelector('.added-count');
        count.textContent=`${parseInt(count.textContent)+(active?1:-1)} curtidas`;
      }
    });
  };
  window.renderLockedPosts();
})();
