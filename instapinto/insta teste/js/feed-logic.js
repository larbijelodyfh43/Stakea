
document.addEventListener('DOMContentLoaded', async () => {
    // Configuration

    // ✅ PROXY: Corrigir carregamento de imagens
    function getProxiedImageUrl(url) {
        if (url && url.startsWith('/api/image/')) return url;
        if (!url || url.includes('perfil-sem-foto')) return 'images/perfil-sem-foto.svg';
        if (url.includes('wsrv.nl')) return url; // Já está com proxy
        return `https://wsrv.nl/?url=${encodeURIComponent(url)}`;
    }

    function getProfilePic(user) {
        const rawUrl = user.profile_pic_url_hd || user.profile_pic_url;
        if (!rawUrl) return 'images/perfil-sem-foto.svg';
        return getProxiedImageUrl(rawUrl);
    }

    function updateUI(user) {
        if (!user) return;

        console.log('[Stalkea] Atualizando UI Feed com:', user.username);

        const picUrl = getProfilePic(user);

        // 1. Atualizar Foto na Navbar (canto inferior direito)
        const navPic = document.getElementById('nav-profile-pic');
        if (navPic) {
            navPic.src = picUrl;
            navPic.onerror = () => {
                if (navPic.src !== 'images/perfil-sem-foto.svg') navPic.src = 'images/perfil-sem-foto.svg';
            };
        }

        // 2. Atualizar Stories (Estilo visual corrigido conforme print)
        const storiesContainer = document.getElementById('stories-container');
        if (storiesContainer) {
            storiesContainer.innerHTML = '';
            storiesContainer.style.padding = '10px 0 10px 15px'; // Ajuste de espaçamento

            // --- A) "Seu Story" (com badge de +) ---
            const myStoryHtml = `
                <div style="display: flex; flex-direction: column; align-items: center; margin-right: 14px; cursor: pointer;" id="my-story-item">
                    <div style="position: relative; width: 78px; height: 78px;">
                        <!-- Foto do usuário -->
                        <img src="${picUrl}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%; border: 1px solid #333;" 
                             onerror="this.src='images/perfil-sem-foto.svg'">
                        
                        <!-- Ícone de + azul -->
                        <div style="position: absolute; bottom: 2px; right: 2px; background: #0095f6; border: 3px solid #000; border-radius: 50%; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="3"><path d="M12 5V19M5 12H19"/></svg>
                        </div>
                    </div>
                    <span style="color: #F9F9F9; font-size: 12px; margin-top: 6px; font-weight: 400;">Seu story</span>
                </div>
            `;
            storiesContainer.insertAdjacentHTML('beforeend', myStoryHtml);

            // --- B) Mock Stories (Outras pessoas com nomes mascarados) ---
            // Baseado no feedback visual (san*****, dud******, lui*****)
            const mockStories = [
                { name: 'san*****', full: 'sandra.o', img: 'https://randomuser.me/api/portraits/women/65.jpg' },
                { name: 'dud*****', full: 'duda_m', img: 'https://randomuser.me/api/portraits/women/12.jpg' },
                { name: 'lui*****', full: 'luiza.fer', img: 'https://randomuser.me/api/portraits/women/44.jpg' },
                { name: 'mar*****', full: 'marcos_s', img: 'https://randomuser.me/api/portraits/men/32.jpg' },
                { name: 'ana*****', full: 'ana_clara', img: 'https://randomuser.me/api/portraits/women/68.jpg' },
                { name: 'ped*****', full: 'pedro_h', img: 'https://randomuser.me/api/portraits/men/11.jpg' }
            ];

            mockStories.forEach(story => {
                const storyHtml = `
                    <div style="display: flex; flex-direction: column; align-items: center; margin-right: 14px; cursor: pointer;" class="other-story-item">
                        <!-- Borda Gradiente -->
                        <div style="width: 78px; height: 78px; border-radius: 50%; padding: 3px; background: linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%); display: flex; align-items: center; justify-content: center;">
                            <!-- Imagem interna com borda preta -->
                            <div style="width: 100%; height: 100%; border-radius: 50%; background: #000; overflow: hidden; border: 3px solid #000;">
                                <img src="${story.img}" style="width: 100%; height: 100%; object-fit: cover;">
                            </div>
                        </div>
                        <span style="color: #F9F9F9; font-size: 12px; margin-top: 6px; font-weight: 400;">${story.name}</span>
                    </div>
                `;
                storiesContainer.insertAdjacentHTML('beforeend', storyHtml);
            });
        }
    }

    async function fetchUserInfo(username) {
        try { return await window.fetchPublicProfile(username); }
        catch (error) { console.warn(error.message); return null; }
    }

    // --- LÓGICA DE INICIALIZAÇÃO ---

    // 1. Tentar ler do localStorage (prioridade)
    let profileData = null;
    try {
        const storedProfile = localStorage.getItem('instagram_profile');
        if (storedProfile) {
            profileData = JSON.parse(storedProfile);
            // Validar se tem foto válida (ou se precisamos buscar de novo)
            if (!profileData.profile_pic_url || profileData.profile_pic_url.includes('perfil-sem-foto')) {
                // Se a foto salva estiver quebrada/ausente, forçamos null para buscar de novo
                profileData = null;
            }
        }
    } catch (e) { }

    const targetUsername = localStorage.getItem('espionado_username');
    if (!targetUsername) return;

    if (profileData) {
        updateUI(profileData);
    } else {
        // Se não tiver dados bons no cache, busca na API
        const user = await fetchUserInfo(targetUsername);
        if (user) {
            updateUI(user);

            // Salvar para próxima vez
            const minimalProfile = {
                username: user.username,
                full_name: user.full_name,
                // Garantir que salvamos a melhor URL
                ...user,
                profile_pic_url: user.profile_pic_url_hd || user.profile_pic_url,
                is_private: user.is_private,
                // ... outros campos ...
            };
            localStorage.setItem('instagram_profile', JSON.stringify(minimalProfile));
        }
    }
});
