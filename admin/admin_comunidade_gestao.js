window.initializePage = async function() {
    const BASE_URL = typeof window.API_BASE_URL !== 'undefined' ? window.API_BASE_URL : 'http://localhost:3001';
    const token = localStorage.getItem('Yelo_token');

    // --- CARREGAR DADOS ---
    async function loadData() {
        try {
            // Banner
            const resBanner = await fetch(`${BASE_URL}/api/admin/community-event`, { headers: { 'Authorization': `Bearer ${token}` } });
            if(resBanner.ok) {
                const data = await resBanner.json();
                if (data) {
                    document.getElementById('evt-titulo').value = data.titulo || '';
                    document.getElementById('evt-subtitulo').value = data.subtitulo || '';
                    document.getElementById('evt-data').value = data.data_hora || '';
                    document.getElementById('evt-tipo').value = data.tipo || 'Online';
                    document.getElementById('evt-link').value = data.link_acao || '';
                    document.getElementById('evt-btn-text').value = data.texto_botao || '';
                    document.getElementById('evt-ativo').checked = data.ativo;
                }
            }
            // Links
            const resLinks = await fetch(`${BASE_URL}/api/admin/community-resources`, { headers: { 'Authorization': `Bearer ${token}` } });
            if(resLinks.ok) {
                const links = await resLinks.json();
                if (links) {
                    document.getElementById('link-intervisao').value = links.link_intervisao || '';
                    document.getElementById('link-biblioteca').value = links.link_biblioteca || '';
                    document.getElementById('link-cursos').value = links.link_cursos || '';
                }
            }
        } catch (err) { console.error("Erro dados:", err); }
    }
    await loadData();

    // --- LOGICA BANNER ---
    const btnBanner = document.getElementById('btn-toggle-banner');
    const fieldsetBanner = document.getElementById('fieldset-banner');
    let editBanner = false;

    btnBanner.onclick = async (e) => {
        e.preventDefault();
        if (!editBanner) {
            fieldsetBanner.removeAttribute('disabled');
            btnBanner.textContent = "Salvar Banner";
            btnBanner.style.backgroundColor = "#E63946";
            editBanner = true;
        } else {
            btnBanner.textContent = "Salvando...";
            btnBanner.disabled = true;
            const payload = {
                titulo: document.getElementById('evt-titulo').value,
                subtitulo: document.getElementById('evt-subtitulo').value,
                data_hora: document.getElementById('evt-data').value,
                tipo: document.getElementById('evt-tipo').value,
                link_acao: document.getElementById('evt-link').value,
                texto_botao: document.getElementById('evt-btn-text').value,
                ativo: document.getElementById('evt-ativo').checked
            };
            try {
                await fetch(`${BASE_URL}/api/admin/community-event`, {
                    method: 'PUT',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            if(window.showToast) window.showToast('Banner atualizado!', 'success');
                fieldsetBanner.setAttribute('disabled', 'true');
                btnBanner.textContent = "Editar Banner";
                btnBanner.style.backgroundColor = "#1B4332";
                editBanner = false;
        } catch (err) { if(window.showToast) window.showToast('Erro ao salvar', 'error'); } 
            finally { btnBanner.disabled = false; }
        }
    };

    // --- LOGICA LINKS ---
    const btnLinks = document.getElementById('btn-toggle-links');
    const fieldsetLinks = document.getElementById('fieldset-links');
    let editLinks = false;

    btnLinks.onclick = async (e) => {
        e.preventDefault();
        if (!editLinks) {
            fieldsetLinks.removeAttribute('disabled');
            btnLinks.textContent = "Salvar Links";
            btnLinks.style.backgroundColor = "#E63946";
            editLinks = true;
        } else {
            btnLinks.textContent = "Salvando...";
            btnLinks.disabled = true;
            const payload = {
                link_intervisao: document.getElementById('link-intervisao').value,
                link_biblioteca: document.getElementById('link-biblioteca').value,
                link_cursos: document.getElementById('link-cursos').value
            };
            try {
                await fetch(`${BASE_URL}/api/admin/community-resources`, {
                    method: 'PUT',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            if(window.showToast) window.showToast('Links atualizados!', 'success');
                fieldsetLinks.setAttribute('disabled', 'true');
                btnLinks.textContent = "Editar Links";
                btnLinks.style.backgroundColor = "#1B4332";
                editLinks = false;
        } catch (err) { if(window.showToast) window.showToast('Erro ao salvar', 'error'); }
            finally { btnLinks.disabled = false; }
        }
    };
};