// Arquivo: psi_perfil.js
// Módulo responsável pelo gerenciamento de Perfil e Configurações da Conta

(function() {
    let documentMaskInstance = null;

    window.inicializarLogicaDoPerfil = function() {
        const API_BASE_URL = (typeof window.API_BASE_URL !== 'undefined') ? window.API_BASE_URL : 'http://localhost:3001';
        const apiFetch = window.apiFetch;
        const formatImageUrl = window.formatImageUrl;
        const showToast = window.showToast;
        
        const psychologistData = window.getPsychologistData(); // Lê do dashboard pai
        
        const profileContainer = document.getElementById('profile-blocks-container');
        if (!profileContainer) return;
        
        // --- DETECÇÃO DE DISPOSITIVO ---
        const isMobile = window.innerWidth <= 992 || /Android|webOS|iPhone|iPad|iPod/i.test(navigator.userAgent);
        document.body.classList.toggle('is-mobile', isMobile);
        document.body.classList.toggle('is-desktop', !isMobile);

        let originalProfileData = { ...psychologistData };
        const dirtyBlocks = new Set();
        const debounceTimers = {};
        
        const stickyFooter = document.getElementById('sticky-actions');
        const dirtyCountSpan = document.getElementById('dirty-count');
        const saveAllButton = document.getElementById('btn-save-all');

        // --- LÓGICA DO MODELO DE COBRANÇA ---
        const tipoCobrancaRadios = document.querySelectorAll('input[name="tipo_cobranca"]');
        const valorDinamicoLabel = document.getElementById('valor_dinamico_label');
        const valorDinamicoInput = document.getElementById('valor_dinamico_input');

        function updateBillingFields(isInitialLoad = false) {
            if (window.PsiPerfilFormUI) window.PsiPerfilFormUI.updateBillingFields(isInitialLoad, originalProfileData);
        }

        if (tipoCobrancaRadios.length) {
            tipoCobrancaRadios.forEach(radio => {
                radio.addEventListener('change', () => { updateBillingFields(false); valorDinamicoInput.value = ''; const block = radio.closest('.profile-block'); if (block) checkForChanges(block); });
            });
        }

        // Inicializa componentes
        if (window.setupMasks) window.setupMasks();
        if (window.setupCepSearch) window.setupCepSearch();

        if (psychologistData) {
            if (window.PsiPerfilFormUI) window.PsiPerfilFormUI.populateBlockForm(psychologistData, documentMaskInstance);
            
            // Garante que os inputs inciem travados
            profileContainer.querySelectorAll('input, textarea, select').forEach(el => { el.disabled = true; });
            
            updateProfileInsights();
        }
        
        function populateBlockForm(data) {
            if (window.PsiPerfilFormUI) window.PsiPerfilFormUI.populateBlockForm(data, documentMaskInstance);
            updateProfileInsights();
        }
        
        function updateProfileInsights() {
            if (window.PsiPerfilFormUI) window.PsiPerfilFormUI.updateProfileInsights(originalProfileData);
        }
        
        async function fetchPerformanceData() {
            try {
                const res = await apiFetch(`${API_BASE_URL}/api/psychologists/me/stats?period=last30days`);
                if (res.ok) {
                    const stats = await res.json();
                    document.getElementById('perf-views').textContent = stats.profileViews || 0;
                    document.getElementById('perf-clicks').textContent = stats.whatsappClicks || 0;
                    document.getElementById('perf-favs').textContent = stats.favoritesCount || 0;
                }
            } catch(e) { }
        }

        profileContainer.addEventListener('click', (e) => {
            const btnEdit = e.target.closest('.btn-edit');
            const btnCancel = e.target.closest('.btn-cancel');
            const btnSave = e.target.closest('.btn-save');
            
            if (btnEdit) { e.preventDefault(); enterEditMode(btnEdit.closest('.profile-block')); }
            else if (btnCancel) { e.preventDefault(); cancelEditMode(btnCancel.closest('.profile-block')); }
            else if (btnSave) { e.preventDefault(); saveBlockData(btnSave.closest('.profile-block')); }
            else {
                const opt = e.target.closest('.option');
                if (opt) {
                    const block = opt.closest('.profile-block');
                    if (block && block.classList.contains('editing')) {
                        const blockId = block.dataset.blockId;
                        clearTimeout(debounceTimers[blockId]);
                        debounceTimers[blockId] = setTimeout(() => { checkForChanges(block); }, 600);
                    }
                }
            }
        });

        profileContainer.addEventListener('input', (e) => {
            const block = e.target.closest('.profile-block');
            if (block && block.classList.contains('editing')) {
                const blockId = block.dataset.blockId;
                clearTimeout(debounceTimers[blockId]);
                debounceTimers[blockId] = setTimeout(() => { checkForChanges(block); }, 600);
            }
        });
        
        function enterEditMode(block) {
            if (window.PsiPerfilFormUI) window.PsiPerfilFormUI.enterEditMode(block, originalProfileData);
        }

        function cancelEditMode(block) {
            if (window.PsiPerfilFormUI) window.PsiPerfilFormUI.cancelEditMode(block, originalProfileData, documentMaskInstance);
            checkForChanges(block); 
        }

        function exitEditMode(block) {
            if (window.PsiPerfilFormUI) window.PsiPerfilFormUI.exitEditMode(block);
        }

        function setBlockState(block, state, message = '') {
            if (window.PsiPerfilFormUI) window.PsiPerfilFormUI.setBlockState(block, state, message);
        }

        function getBlockData(block) {
            return window.PsiPerfilFormUI ? window.PsiPerfilFormUI.getBlockData(block) : {};
        }

        async function saveBlockData(block) {
            setBlockState(block, 'saving');
            const payload = getBlockData(block);

            if (payload.cpf && payload.cpf.length <= 11) payload.razao_social = '';

            try {
                const res = await apiFetch(`${API_BASE_URL}/api/psychologists/me`, {
                    method: 'PUT',
                    body: JSON.stringify(payload)
                });

                if (!res.ok) throw new Error((await res.json()).error || 'Falha ao salvar bloco.');

                Object.assign(originalProfileData, payload);
                
                const updatedData = { ...window.getPsychologistData(), ...payload };
                if (payload.slug) updatedData.slug = payload.slug;
                window.setPsychologistData(updatedData);

                if (payload.nome) {
                    localStorage.setItem('Yelo_user_name', payload.nome);
                    const primeiroNome = payload.nome.split(' ')[0];
                    const headerGreeting = document.querySelector('.user-greeting-text');
                    if (headerGreeting) headerGreeting.textContent = `Painel de ${primeiroNome}`;
                }

                setBlockState(block, 'success');
                dirtyBlocks.delete(block.dataset.blockId);
                updateStickyFooter();
                
                setTimeout(() => exitEditMode(block), 600);
                if (window.atualizarInterfaceLateral) window.atualizarInterfaceLateral();
                updateProfileInsights(); 

            } catch (err) {
                setBlockState(block, 'error', err.message);
            }
        }

        function checkForChanges(block) {
            const blockId = block.dataset.blockId;
            const currentData = getBlockData(block);
            let isDirty = false;

            for (const key in currentData) {
                let origVal = originalProfileData[key];
                let currVal = currentData[key];
                
                if (key === 'tipo_cobranca' && origVal === undefined) origVal = 'sessao';

                if (Array.isArray(currVal)) {
                    let origArr = origVal;
                    if (typeof origArr === 'string') { try { origArr = JSON.parse(origArr); } catch(e) { origArr = [origArr]; } }
                    if (!Array.isArray(origArr)) origArr = origArr ? [origArr] : [];

                    if (JSON.stringify([...origArr].sort()) !== JSON.stringify([...currVal].sort())) { isDirty = true; break; }
                } else {
                    if ((key === 'cpf' || key === 'telefone') && String(origVal || '').replace(/\D/g, '') !== String(currVal || '').replace(/\D/g, '')) { isDirty = true; break; }
                    else if (key !== 'cpf' && key !== 'telefone' && String(origVal || '') !== String(currVal || '')) { isDirty = true; break; }
                }
            }

            if (isDirty) dirtyBlocks.add(blockId); else dirtyBlocks.delete(blockId);
            updateStickyFooter();
        }

        function updateStickyFooter() {
            if (!stickyFooter || !dirtyCountSpan) return;
            if (dirtyBlocks.size > 0) {
                dirtyCountSpan.textContent = dirtyBlocks.size;
                stickyFooter.classList.remove('hidden');
            } else {
                stickyFooter.classList.add('hidden');
            }
        }

        if (saveAllButton) {
            // Remove listeners antigos
            const novoBtn = saveAllButton.cloneNode(true);
            saveAllButton.parentNode.replaceChild(novoBtn, saveAllButton);

            novoBtn.addEventListener('click', async () => {
                const btnText = novoBtn.querySelector('.btn-text') || novoBtn;
                const spinner = novoBtn.querySelector('.spinner');
                novoBtn.disabled = true;
                if (btnText) btnText.classList.add('hidden');
                if (spinner) spinner.classList.remove('hidden');

                const allDirtyData = {};
                dirtyBlocks.forEach(blockId => {
                    const block = profileContainer.querySelector(`[data-block-id="${blockId}"]`);
                    if (block) { Object.assign(allDirtyData, getBlockData(block)); setBlockState(block, 'saving'); }
                });
                
                if (allDirtyData.tipo_cobranca === undefined) {
                    allDirtyData.tipo_cobranca = originalProfileData.tipo_cobranca || 'sessao';
                    allDirtyData.valor_mensal_numero = originalProfileData.valor_mensal_numero || null;
                    allDirtyData.valor_sessao_numero = originalProfileData.valor_sessao_numero || null;
                }
                if (allDirtyData.cpf && allDirtyData.cpf.length <= 11) allDirtyData.razao_social = '';

                try {
                    const res = await apiFetch(`${API_BASE_URL}/api/psychologists/me`, { method: 'PUT', body: JSON.stringify(allDirtyData) });
                    if (!res.ok) throw new Error((await res.json()).error || 'Falha ao salvar tudo.');

                    Object.assign(originalProfileData, allDirtyData);
                    const updatedDataAll = { ...window.getPsychologistData(), ...allDirtyData };
                    if (allDirtyData.slug) updatedDataAll.slug = allDirtyData.slug;
                    window.setPsychologistData(updatedDataAll);

                    if (allDirtyData.nome) localStorage.setItem('Yelo_user_name', allDirtyData.nome);

                    dirtyBlocks.forEach(blockId => {
                        const block = profileContainer.querySelector(`[data-block-id="${blockId}"]`);
                        if (block) { setBlockState(block, 'success'); setTimeout(() => exitEditMode(block), 500); }
                    });
                    
                    dirtyBlocks.clear(); updateStickyFooter();
                    if (window.atualizarInterfaceLateral) window.atualizarInterfaceLateral();
                    updateProfileInsights();
                    showToast('Todas as alterações salvas!', 'success');
                } catch (err) {
                    showToast(err.message, 'error');
                    dirtyBlocks.forEach(blockId => { const block = profileContainer.querySelector(`[data-block-id="${blockId}"]`); if (block) setBlockState(block, 'error'); });
                } finally {
                    novoBtn.disabled = false;
                    if (btnText) btnText.classList.remove('hidden');
                    if (spinner) spinner.classList.add('hidden');
                }
            });
        }
        
        if (typeof TomSelect !== 'undefined') {
            if (!document.body.classList.contains('is-mobile')) {
                document.querySelectorAll('select.ts-select').forEach(el => {
                    if (!el.tomselect) {
                        const tsConfig = { create: false, maxOptions: null, placeholder: el.getAttribute('data-placeholder') || 'Selecione...' };
                        if (el.multiple) tsConfig.plugins = ['remove_button'];
                        new TomSelect(el, tsConfig);
                        if (el.disabled) el.tomselect.disable();
                    }
                });
            }
        }

        const uploadInput = document.getElementById('profile-photo-upload');
        if (uploadInput) {
            uploadInput.onchange = async (e) => {
                if (e.target.files[0]) {
                    const fd = new FormData(); fd.append('foto', e.target.files[0]);
                    try {
                        const res = await apiFetch(`${API_BASE_URL}/api/psychologists/me/foto`, { method: 'POST', body: fd });
                        if (res.ok) {
                            const d = await res.json();
                            const updatedData = window.getPsychologistData();
                            updatedData.fotoUrl = d.fotoUrl;
                            window.setPsychologistData(updatedData);
                            localStorage.setItem('Yelo_user_photo', d.fotoUrl);
                            if (window.atualizarInterfaceLateral) window.atualizarInterfaceLateral();
                            showToast('Foto atualizada!');
                        }
                    } catch (err) { showToast('Erro na foto', 'error'); }
                }
            };
        }
        
        const btnCopyLink = document.getElementById('btn-copy-profile-link');
        if (btnCopyLink) {
            btnCopyLink.addEventListener('click', () => {
                if (originalProfileData && originalProfileData.slug) {
                    const url = `${window.location.origin}/${originalProfileData.slug}`;
                    navigator.clipboard.writeText(url).then(() => showToast('Link copiado para a área de transferência!', 'success'));
                }
            });
        }
        
        fetchPerformanceData();
    };

    // --- FUNÇÕES GLOBAIS DE MÁSCARA ---
    function setupDocumentMask() {
        if (typeof IMask === 'undefined') return;
        const inputDoc = document.getElementById('cpf');
        const groupRazao = document.getElementById('group-razao-social');
        if (!inputDoc) return;
        if (documentMaskInstance) { documentMaskInstance.destroy(); documentMaskInstance = null; }
        documentMaskInstance = IMask(inputDoc, { mask: [ { mask: '000.000.000-00' }, { mask: '00.000.000/0000-00' } ] });
        documentMaskInstance.on('accept', () => {
            if (documentMaskInstance.unmaskedValue.length > 11) { if(groupRazao) groupRazao.classList.remove('hidden'); }
            else { if(groupRazao) groupRazao.classList.add('hidden'); }
        });
    }

    window.setupMasks = function() {
        if (typeof IMask === 'undefined') return;
        const tel = document.getElementById('telefone');
        const crp = document.getElementById('crp');
        if (tel) IMask(tel, { mask: '(00) 00000-0000' });
        if (crp) IMask(crp, { mask: '00/000000' });
        setupDocumentMask();
    };

    window.setupCepSearch = function() {
        const elCep = document.getElementById('cep');
        const elCidade = document.getElementById('cidade');
        const elEstado = document.getElementById('estado');
        const elLoading = document.getElementById('cep-loading');
        if (!elCep) return;
        elCep.addEventListener('input', (e) => {
            let val = e.target.value.replace(/\D/g, '');
            if (val.length > 5) val = val.substring(0, 5) + '-' + val.substring(5, 8);
            e.target.value = val;
        });
        elCep.addEventListener('blur', async (e) => {
            const rawCep = e.target.value.replace(/\D/g, '');
            if (rawCep.length === 8) {
                if(elLoading) elLoading.style.display = 'block';
                elCep.disabled = true;
                try {
                    const res = await fetch(`https://viacep.com.br/ws/${rawCep}/json/`);
                    const data = await res.json();
                    if (!data.erro) { 
                        if(elCidade) elCidade.value = data.localidade; 
                        if(elEstado) elEstado.value = data.uf; 
                        if(elCidade) elCidade.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                    else { 
                        if(window.showToast) window.showToast('CEP não encontrado.', 'error'); 
                        if(elCidade) elCidade.value = ''; 
                        if(elEstado) elEstado.value = ''; 
                    }
                } catch (err) { 
                    if(window.showToast) window.showToast('Erro ao buscar CEP.', 'error'); 
                }
                finally { 
                    if(elLoading) elLoading.style.display = 'none'; 
                    elCep.disabled = false; 
                }
            }
        });
    };
})();