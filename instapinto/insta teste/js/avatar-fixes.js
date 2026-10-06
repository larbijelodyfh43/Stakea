(() => {
  const lock = '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M6 10V7a6 6 0 0 1 12 0v3M4 10h16v12H4V10Zm8 5v3"/></svg>';
  function update() {
    document.querySelectorAll('#storiesContainer .story-item:not(:first-child) .story-avatar').forEach((avatar,i) => {
      if (avatar.dataset.avatarFixed) return;
      avatar.dataset.avatarFixed = 'true';
      avatar.classList.add('contact-story-locked');
      avatar.innerHTML = `<img src="images/demo-contact-${i%2+1}.jpg" alt=""><span>${lock}</span>`;
    });
    document.querySelectorAll('.chat-avatar-container').forEach((container,i) => {
      const wrapper = container.querySelector('.chat-avatar-wrapper');
      if (!wrapper || container.dataset.avatarFixed) return;
      container.dataset.avatarFixed = 'true';
      container.classList.add('contact-avatar-locked');
      let img = wrapper.querySelector('img');
      if (!img) { img = document.createElement('img'); img.className='chat-photo'; wrapper.append(img); }
      img.src = `images/demo-contact-${i%2+1}.jpg`;
      img.alt = '';
      let badge = container.querySelector('.chat-lock-icon');
      if (!badge) { badge = document.createElement('span'); badge.className = 'chat-lock-icon'; container.append(badge); }
      badge.innerHTML = lock;
    });
  }
  update();
  const list = document.getElementById('messagesList');
  if(list) new MutationObserver(update).observe(list,{childList:true,subtree:true});
  const stories=document.getElementById('storiesContainer');
  if(stories) new MutationObserver(update).observe(stories,{childList:true,subtree:true});
})();
