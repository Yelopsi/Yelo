(function() {

    const API_BASE_URL = window.API_BASE_URL || 'http://localhost:3001';
    let psychologistData = null;
    let originalProfileData = {};
    const dirtyBlocks = new Set();
    const debounceTimers = {};
    let documentMaskInstance = null;

    // --- HELPERS ---
    function showToast(message, type = 'success') {
        let container = document.getElementById('pill-notification-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'pill-notification-container';
            document.body.appendChild(container);
        }
        const pill = document.createElement('div');
        pill.className = `pill-notification ${type}`;
        let iconHtml = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
        pill.innerHTML = `<span class="icon">${iconHtml}</span><span>${message}</span>`;
        container.appendChild(pill);
        setTimeout(() => pill.remove(), 4500);
    }

    async function apiFetch(url, options = {}) {
        const token = localStorage.getItem('Yelo_token');
        if (!token) { window.location.href = '/login'; throw new Error("Sessão expirada."); }
        const headers = { 'Authorization': `Bearer ${token}`, ...options.headers };
        if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
        const response = await fetch(url, { ...options, headers });
        if (response.status === 401) { localStorage.removeItem('Yelo_token'); window.location.href = '/'; throw new Error("Sessão expirada."); }
        return response;
    }

    function formatImageUrl(path) {
        if (!path) return 'https://placehold.co/70x70/1B4332/FFFFFF?text=Psi';
        if (path.startsWith('http')) return path;
        let cleanPath = path.replace(/\\/g, '/');
        if (cleanPath.includes('uploads/')) cleanPath = cleanPath.substring(cleanPath.lastIndexOf('uploads/'));
        if (!cleanPath.startsWith('/')) cleanPath = '/' + cleanPath;
        return `${API_BASE_URL}${cleanPath}`;
    }

    // --- COMPONENTES ---
    function setupMultiselects() {
        // Handler to close any open multiselect when clicking outside
        if (!window.multiselectBodyListener) {
            document.body.addEventListener('click', (e) => {
                document.querySelectorAll('.multiselect-tag.open').forEach(container => {
                    if (!container.contains(e.target)) {
                        container.classList.remove('open');
                    }
                });
            });
            window.multiselectBodyListener = true;
        }

        document.querySelectorAll('.multiselect-tag').forEach(container => {
            // Impede conflito caso dois scripts tentem inicializar o mesmo componente
            if (container.dataset.initialized === 'true') return;
            container.dataset.initialized = 'true';

            const display = container.querySelector('.multiselect-display');
            const optionsContainer = container.querySelector('.multiselect-options');
            const isSingleSelect = container.dataset.singleSelect === 'true';

            // Open/close the dropdown
            display.addEventListener('click', (e) => {
                e.stopPropagation();
                if (container.classList.contains('disabled')) return;
                
                if (e.target.classList.contains('remove-tag')) return; // Handle removal below
                
                // Close other open dropdowns
                document.querySelectorAll('.multiselect-tag.open').forEach(other => {
                    if (other !== container) other.classList.remove('open');
                });
                container.classList.toggle('open');
                
                // Scroll suave para garantir visibilidade no mobile
                if (container.classList.contains('open')) {
                    setTimeout(() => {
                        const rect = optionsContainer.getBoundingClientRect();
                        if (rect.bottom > window.innerHeight) {
                            optionsContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                        }
                    }, 50);
                }
            });
            
            // Trata a remoção de tags no clique
            display.addEventListener('click', e => {
                if (e.target.classList.contains('remove-tag')) {
                    e.stopPropagation();
                    if (container.classList.contains('disabled')) return;
                    const tagVal = e.target.parentElement.dataset.value;
                    let currentValues = getMultiselectValues(container.id);
                    currentValues = currentValues.filter(v => v !== tagVal);
                    updateMultiselect(container.id, currentValues);
                    const block = container.closest('.profile-block');
                    if (block && block.classList.contains('editing')) {
                        container.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                }
            });

            // Handle clicks on each custom option
            optionsContainer.querySelectorAll('.option').forEach(optionEl => {
                optionEl.addEventListener('click', e => {
                    e.stopPropagation();
                    if (container.classList.contains('disabled')) return;
                    
                    const value = optionEl.dataset.value;
                    let currentValues = getMultiselectValues(container.id);

                    if (isSingleSelect) {
                        currentValues = [value];
                        container.classList.remove('open');
                    } else {
                        if (currentValues.includes(value)) {
                            currentValues = currentValues.filter(v => v !== value);
                        } else {
                            currentValues.push(value);
                        }
                    }
                    updateMultiselect(container.id, currentValues);
                    
                    const block = container.closest('.profile-block');
                    if (block && block.classList.contains('editing')) {
                        container.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                });
            });
        });
    }

    function updateMultiselect(containerId, rawValues) {
        const container = document.getElementById(containerId);
        if (!container) return;
        const display = container.querySelector('.multiselect-display');
        const optionsContainer = container.querySelector('.multiselect-options');
        
        let values = rawValues;
        if (!values) values = [];
        else if (typeof values === 'string') { try { values = JSON.parse(values); } catch(e) { values = [values]; } }
        if (!Array.isArray(values)) values = [];
        
        container.dataset.value = JSON.stringify(values);
        const valueSet = new Set(values.map(String));

        display.innerHTML = ''; // Clear display
        if (valueSet.size === 0) {
            display.innerHTML = '<span class="multiselect-placeholder">Selecione...</span>';
        }
        
        if (optionsContainer) {
            optionsContainer.querySelectorAll('.option').forEach(opt => {
                const isSelected = valueSet.has(opt.dataset.value);
                opt.classList.toggle('selected', isSelected);
                if (isSelected) {
                    const tag = document.createElement('div');
                    tag.className = 'tag';
                    tag.dataset.value = opt.dataset.value;
                    tag.textContent = opt.textContent;
                    const removeBtn = document.createElement('button');
                    removeBtn.type = 'button';
                    removeBtn.className = 'remove-tag';
                    removeBtn.innerHTML = '&times;';
                    tag.appendChild(removeBtn);
                    display.appendChild(tag);
                }
            });
        }
    }

    function getMultiselectValues(containerId) {
        const container = document.getElementById(containerId);
        if (!container || !container.dataset.value) return [];
        try { return JSON.parse(container.dataset.value); } catch (e) { return []; }
    }
    function setupDocumentMask() {
        if (typeof IMask === 'undefined') return;
        const inputDoc = document.getElementById('cpf');
        const groupRazao = document.getElementById('group-razao-social');
        if (!inputDoc) return;
        if (documentMaskInstance) documentMaskInstance.destroy();
        documentMaskInstance = IMask(inputDoc, { mask: [{ mask: '000.000.000-00' }, { mask: '00.000.000/0000-00' }] });
        documentMaskInstance.on('accept', () => {
            if (groupRazao) groupRazao.classList.toggle('hidden', documentMaskInstance.unmaskedValue.length <= 11);
        });
    }
    function setupMasks() {
        if (typeof IMask === 'undefined') return;
        const tel = document.getElementById('telefone');
        const crp = document.getElementById('crp');
        if (tel) IMask(tel, { mask: '(00) 00000-0000' });
        if (crp) IMask(crp, { mask: '00/000000' });
        setupDocumentMask();
    }
    function setupCepSearch() {
        const elCep = document.getElementById('cep');
        if (!elCep) return;
        elCep.addEventListener('input', (e) => {
            let val = e.target.value.replace(/\D/g, '');
            if (val.length > 5) val = val.substring(0, 5) + '-' + val.substring(5, 8);
            e.target.value = val;
        });
        elCep.addEventListener('blur', async (e) => {
            const rawCep = e.target.value.replace(/\D/g, '');
            if (rawCep.length !== 8) return;
            const loadingEl = document.getElementById('cep-loading');
            if (loadingEl) loadingEl.style.display = 'block';
            try {
                const res = await fetch(`https://viacep.com.br/ws/${rawCep}/json/`);
                if (!res.ok) throw new Error('Erro na API ViaCEP');
                const data = await res.json();
                
                const inputCidade = document.getElementById('cidade');
                const inputEstado = document.getElementById('estado');
                
                if (data.erro) {
                    showToast('CEP não encontrado.', 'error');
                    if (inputCidade) inputCidade.value = '';
                    if (inputEstado) inputEstado.value = '';
                } else {
                    if (inputCidade) inputCidade.value = data.localidade || '';
                    if (inputEstado) inputEstado.value = data.uf || '';
                }
                
                // Dispara o evento de input para o form reconhecer a mudança e liberar o botão "Salvar"
                if (inputCidade) inputCidade.dispatchEvent(new Event('input', { bubbles: true }));
            } catch (err) { 
                console.error(err);
                showToast('Erro ao buscar CEP. Verifique sua conexão.', 'error'); 
            }
            finally { if (loadingEl) loadingEl.style.display = 'none'; }
        });
    }

    // --- LÓGICA PRINCIPAL DO PERFIL ---
    function inicializarLogicaDoPerfil() {
        const profileContainer = document.getElementById('profile-blocks-container');
        if (!profileContainer) return;

        originalProfileData = { ...psychologistData };
        const stickyFooter = document.getElementById('sticky-actions');
        const dirtyCountSpan = document.getElementById('dirty-count');
        const saveAllButton = document.getElementById('btn-save-all');

        // --- LÓGICA DO MODELO DE COBRANÇA (INTEGRADA) ---
        const tipoCobrancaRadios = document.querySelectorAll('input[name="tipo_cobranca"]');
        const valorDinamicoLabel = document.getElementById('valor_dinamico_label');
        const valorDinamicoInput = document.getElementById('valor_dinamico_input');

        function updateBillingFields(isInitialLoad = false) {
            if (!valorDinamicoLabel || !valorDinamicoInput) return;
            
            const tipoSelecionado = document.querySelector('input[name="tipo_cobranca"]:checked')?.value || 'sessao';

            if (tipoSelecionado === 'sessao') {
                valorDinamicoLabel.textContent = 'Valor da Sessão (R$)';
                valorDinamicoInput.name = 'valor_sessao_numero';
                valorDinamicoInput.placeholder = 'Deixe vazio para \'A combinar\'';
                if (isInitialLoad) {
                    const val = originalProfileData.valor_sessao_numero;
                    valorDinamicoInput.value = val ? val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
                }
            } else { // mensal
                valorDinamicoLabel.textContent = 'Valor Mensal (R$)';
                valorDinamicoInput.name = 'valor_mensal_numero';
                valorDinamicoInput.placeholder = 'Deixe vazio para \'A combinar\'';
                if (isInitialLoad) {
                    const val = originalProfileData.valor_mensal_numero;
                    valorDinamicoInput.value = val ? val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
                }
            }
        }

        if (tipoCobrancaRadios.length) {
            tipoCobrancaRadios.forEach(radio => {
                radio.addEventListener('change', () => {
                    updateBillingFields(false); // É uma mudança do usuário, não carrega valor antigo
                    valorDinamicoInput.value = ''; // Limpa o campo para evitar confusão
                    const block = radio.closest('.profile-block');
                    if (block) checkForChanges(block);
                });
            });
        }

        function populateBlockForm(data) {
            // Campos simples
            ['nome', 'email', 'crp', 'telefone', 'bio', 'slug', 'cep', 'cidade', 'estado', 'razao_social', 'formacao_desc', 'ano_inicio_experiencia'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = data[id] || '';
            });

            // Documento (CPF/CNPJ)
            const inputDoc = document.getElementById('cpf');
            if (inputDoc && documentMaskInstance) {
                documentMaskInstance.value = data.cpf || data.cnpj || data.document_number || '';
                const groupRazao = document.getElementById('group-razao-social');
                if (groupRazao) {
                    groupRazao.classList.toggle('hidden', documentMaskInstance.unmaskedValue.length <= 11);
                }
            } else if (inputDoc) { // Fallback if IMask is not loaded
                inputDoc.value = data.cpf || data.cnpj || data.document_number || '';
            }

            // Modelo de Cobrança
            const tipoCobranca = data.tipo_cobranca || 'sessao';
            const radioSessao = document.getElementById('tipo_cobranca_sessao');
            if (radioSessao) radioSessao.checked = tipoCobranca === 'sessao';
            const radioMensal = document.getElementById('tipo_cobranca_mensal');
            if (radioMensal) radioMensal.checked = tipoCobranca === 'mensal';
            updateBillingFields(true);

            // Redes Sociais
            ['linkedin_url', 'instagram_url', 'facebook_url', 'tiktok_url', 'x_url'].forEach(key => {
                const el = document.getElementById(key);
                if (el && data[key]) el.value = data[key].replace(/https?:\/\/(www\.)?/, '').replace(/linkedin\.com\/in\//, '').replace(/instagram\.com\//, '');
            });

            // Multiselects e Selects Nativos
            const multiSelectIds = ['temas_atuacao', 'publico_alvo', 'praticas_inclusivas', 'abordagens_tecnicas', 'genero_identidade', 'modalidade', 'disponibilidade_periodo', 'formacao_nivel'];
            multiSelectIds.forEach(id => {
                const desktopId = `${id}_multiselect`;
                const nativeId = `${id}_native`;
                const values = data[id] || [];

                if (document.getElementById(desktopId)) {
                    updateMultiselect(desktopId, values);
                }
                const nativeEl = document.getElementById(nativeId);
                if (nativeEl) {
                    const valuesArray = Array.isArray(values) ? values : (values ? [values] : []);
                    Array.from(nativeEl.options).forEach(opt => {
                        opt.selected = valuesArray.includes(opt.value);
                    });
                }
            });
        }

        function getBlockData(block) {
            const data = {};
            block.querySelectorAll('input, textarea, select').forEach(input => {
                if (input.name && input.type !== 'radio' && !input.classList.contains('native-select-mobile')) {
                    if (input.type === 'number' || input.id === 'valor_dinamico_input') {
                        const valStr = input.value.toString().replace(/\./g, '').replace(',', '.').trim();
                        const parsed = parseFloat(valStr);
                        data[input.name] = !isNaN(parsed) ? parsed : null;
                    } else if (input.id === 'cpf' || input.id === 'telefone') {
                        data[input.name] = input.value.replace(/\D/g, '');
                    } else {
                        data[input.name] = input.value;
                    }
                }
            });
            // Trata o radio de cobrança
            const tipoCobrancaRadio = block.querySelector('input[name="tipo_cobranca"]:checked');
            if (tipoCobrancaRadio) {
                data.tipo_cobranca = tipoCobrancaRadio.value;
                // Garante que o valor do outro modelo seja zerado no payload
                if (data.tipo_cobranca === 'sessao') {
                    data.valor_mensal_numero = null;
                } else {
                    data.valor_sessao_numero = null;
                }
            }

            // Multiselects
            const isMobile = window.innerWidth <= 992;
            block.querySelectorAll('.multiselect-tag').forEach(container => {
                const fieldName = container.id.replace('_multiselect', '');
                const nativeSelect = document.getElementById(fieldName + '_native');
                
                if (isMobile && nativeSelect) {
                    if (nativeSelect.multiple) {
                        data[fieldName] = Array.from(nativeSelect.selectedOptions).map(opt => opt.value);
                    } else {
                        data[fieldName] = nativeSelect.value;
                    }
                } else {
                    const values = getMultiselectValues(container.id);
                    if (container.dataset.singleSelect === 'true') {
                        data[fieldName] = values.length > 0 ? values[0] : '';
                    } else {
                        data[fieldName] = values;
                    }
                }
            });

            return data;
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
                    const sortedOriginal = [...(origVal || [])].sort();
                    const sortedCurrent = [...currVal].sort();
                    if (JSON.stringify(sortedOriginal) !== JSON.stringify(sortedCurrent)) {
                        isDirty = true; break;
                    }
                } else {
                    // Evita falsos positivos com strings numéricas
                    if ((key === 'cpf' || key === 'telefone') && String(origVal || '').replace(/\D/g, '') !== String(currVal || '').replace(/\D/g, '')) {
                         isDirty = true; break;
                    }
                    else if (key !== 'cpf' && key !== 'telefone' && String(origVal || '') !== String(currVal || '')) {
                        isDirty = true; break;
                    }
                }
            }

            if (isDirty) dirtyBlocks.add(blockId); else dirtyBlocks.delete(blockId);
            updateStickyFooter();
        }

        function updateStickyFooter() {
            if (!stickyFooter || !dirtyCountSpan) return;
            const count = dirtyBlocks.size;
            stickyFooter.classList.toggle('hidden', count === 0);
            if (count > 0) dirtyCountSpan.textContent = count;
        }

        function setBlockState(block, state, message = '') {
            const statusEl = block.querySelector('.block-status');
            if (!statusEl) return;
            statusEl.className = 'block-status';
            switch (state) {
                case 'saving': statusEl.textContent = 'Salvando...'; statusEl.classList.add('visible'); break;
                case 'success': statusEl.textContent = message || 'Salvo ✔'; statusEl.classList.add('visible', 'success'); setTimeout(() => statusEl.classList.remove('visible'), 2500); break;
                case 'error': statusEl.textContent = message || 'Erro.'; statusEl.classList.add('visible', 'error'); break;
                default: statusEl.classList.remove('visible'); break;
            }
        }

        function enterEditMode(block) {
            block.classList.add('editing');
            setBlockState(block, 'default');
            block.querySelectorAll('input, textarea, select').forEach(el => {
                if (el.id !== 'email' && el.id !== 'cidade' && el.id !== 'estado') el.disabled = false;
            });
            block.querySelectorAll('.multiselect-tag').forEach(el => el.classList.remove('disabled'));
            block.querySelector('.btn-edit').classList.add('hidden');
            block.querySelector('.btn-cancel').classList.remove('hidden');
            block.querySelector('.btn-save').classList.remove('hidden');
        }

        function exitEditMode(block) {
            block.classList.remove('editing');
            block.querySelectorAll('input, textarea, select').forEach(el => { el.disabled = true; });
            block.querySelectorAll('.multiselect-tag').forEach(el => el.classList.add('disabled'));
            block.querySelector('.btn-edit').classList.remove('hidden');
            block.querySelector('.btn-cancel').classList.add('hidden');
            block.querySelector('.btn-save').classList.add('hidden');
        }

        function cancelEditMode(block) {
            populateBlockForm(originalProfileData);
            exitEditMode(block);
            checkForChanges(block);
        }

        async function saveBlockData(block) {
            setBlockState(block, 'saving');
            const payload = getBlockData(block);
            try {
                const res = await apiFetch(`${API_BASE_URL}/api/psychologists/me`, { method: 'PUT', body: JSON.stringify(payload) });
                if (!res.ok) throw new Error((await res.json()).error || 'Falha ao salvar.');
                Object.assign(originalProfileData, payload);
                psychologistData = { ...psychologistData, ...payload };
                setBlockState(block, 'success');
                dirtyBlocks.delete(block.dataset.blockId);
                updateStickyFooter();
                setTimeout(() => exitEditMode(block), 600);
            } catch (err) {
                setBlockState(block, 'error', err.message);
            }
        }

        // --- Eventos de Edição (Delegação) ---
        profileContainer.addEventListener('click', (e) => {
            const btnEdit = e.target.closest('.btn-edit');
            const btnCancel = e.target.closest('.btn-cancel');
            const btnSave = e.target.closest('.btn-save');
            if (btnEdit) { e.preventDefault(); enterEditMode(btnEdit.closest('.profile-block')); }
            else if (btnCancel) { e.preventDefault(); cancelEditMode(btnCancel.closest('.profile-block')); }
            else if (btnSave) { e.preventDefault(); saveBlockData(btnSave.closest('.profile-block')); }
        });

        profileContainer.addEventListener('input', (e) => {
            const block = e.target.closest('.profile-block');
            if (block && block.classList.contains('editing')) {
                const blockId = block.dataset.blockId;
                clearTimeout(debounceTimers[blockId]);
                debounceTimers[blockId] = setTimeout(() => checkForChanges(block), 600);
            }
        });

        profileContainer.addEventListener('change', (e) => {
            const block = e.target.closest('.profile-block');
            if (block && block.classList.contains('editing')) {
                const blockId = block.dataset.blockId;
                clearTimeout(debounceTimers[blockId]);
                debounceTimers[blockId] = setTimeout(() => checkForChanges(block), 600);
            }
        });

        if (saveAllButton) {
            // Clona o botão para limpar eventos mortos
            const newBtn = saveAllButton.cloneNode(true);
            saveAllButton.parentNode.replaceChild(newBtn, saveAllButton);

            newBtn.addEventListener('click', async () => {
                const btnText = newBtn.querySelector('.btn-text') || newBtn;
                const spinner = newBtn.querySelector('.spinner');
                
                newBtn.disabled = true;
                if (btnText) btnText.classList.add('hidden');
                if (spinner) spinner.classList.remove('hidden');

                const allDirtyData = {};
                dirtyBlocks.forEach(blockId => {
                    const block = profileContainer.querySelector(`[data-block-id="${blockId}"]`);
                    if (block) {
                        Object.assign(allDirtyData, getBlockData(block));
                        setBlockState(block, 'saving');
                    }
                });

                // --- PREVENÇÃO DE BUG ---
                // O backend requer que os dados de cobrança sempre sejam enviados
                if (allDirtyData.tipo_cobranca === undefined) {
                    allDirtyData.tipo_cobranca = originalProfileData.tipo_cobranca || 'sessao';
                    allDirtyData.valor_mensal_numero = originalProfileData.valor_mensal_numero || null;
                    allDirtyData.valor_sessao_numero = originalProfileData.valor_sessao_numero || null;
                }

                if (allDirtyData.cpf && allDirtyData.cpf.length <= 11) allDirtyData.razao_social = '';

                try {
                    const res = await apiFetch(`${API_BASE_URL}/api/psychologists/me`, {
                        method: 'PUT',
                        body: JSON.stringify(allDirtyData)
                    });

                    if (!res.ok) throw new Error((await res.json()).error || 'Falha ao salvar tudo.');

                    Object.assign(originalProfileData, allDirtyData);
                    psychologistData = { ...psychologistData, ...allDirtyData };
                    
                    dirtyBlocks.forEach(blockId => {
                        const block = profileContainer.querySelector(`[data-block-id="${blockId}"]`);
                        if (block) {
                            setBlockState(block, 'success');
                            setTimeout(() => exitEditMode(block), 500);
                        }
                    });
                    
                    dirtyBlocks.clear();
                    updateStickyFooter();
                    showToast('Todas as alterações salvas!', 'success');

                } catch (err) {
                    showToast(err.message, 'error');
                    dirtyBlocks.forEach(blockId => {
                        const block = profileContainer.querySelector(`[data-block-id="${blockId}"]`);
                        if (block) setBlockState(block, 'error');
                    });
                } finally {
                    newBtn.disabled = false;
                    if (btnText) btnText.classList.remove('hidden');
                    if (spinner) spinner.classList.add('hidden');
                }
            });
        }

        // --- Inicialização ---
        setupMasks();
        setupCepSearch();
        setupMultiselects(); // Habilita os componentes de multiselect
        if (psychologistData) {
            populateBlockForm(psychologistData);
            profileContainer.querySelectorAll('.profile-block').forEach(block => {
                if (!block.classList.contains('editing')) {
                    block.querySelectorAll('input, textarea, select').forEach(el => { el.disabled = true; });
                }
            });
        }
    }

    // --- INICIALIZAÇÃO DA PÁGINA ---
    async function initPage() {
        const token = localStorage.getItem('Yelo_token');
        if (!token) { window.location.href = '/login'; return; }

        try {
            const response = await fetch(`${API_BASE_URL}/api/psychologists/me?t=${new Date().getTime()}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                psychologistData = await response.json();
                inicializarLogicaDoPerfil();
            } else {
                throw new Error("Falha ao carregar dados do perfil.");
            }
        } catch (error) {
            console.error(error);
            const mainContent = document.getElementById('main-content') || document.body;
            mainContent.innerHTML = `<div class="widget" style="text-align:center; color:red;"><p>Erro ao carregar seus dados. Tente recarregar a página.</p></div>`;
        }
    }

    initPage();
})();
