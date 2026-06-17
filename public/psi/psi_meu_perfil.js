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
                showToast('Erro ao buscar CEP. Verifique sua conexão.', 'error'); 
            }
            finally { if (loadingEl) loadingEl.style.display = 'none'; }
        });
    }

    // --- LÓGICA DE VINCULAR GOOGLE ---
    window.handleGoogleLinkResponse = async function(response) {
        try {
            const res = await apiFetch(`${API_BASE_URL}/api/psychologists/me/link-google`, {
                method: 'POST',
                body: JSON.stringify({ token: response.credential })
            });
            const data = await res.json();
            if (res.ok) {
                showToast('Conta do Google vinculada com sucesso!', 'success');
                document.getElementById('google-link-container').style.display = 'none';
                document.getElementById('google-linked-message').style.display = 'flex';
                if (psychologistData) psychologistData.googleId = data.googleId;
            } else {
                showToast(data.error || 'Erro ao vincular conta do Google.', 'error');
            }
        } catch (error) {
            showToast('Erro de conexão ao tentar vincular o Google.', 'error');
        }
    };

    // --- LÓGICA PRINCIPAL DO PERFIL ---
    window.inicializarLogicaDoPerfil = function() {
        const profileContainer = document.getElementById('profile-blocks-container');
        if (!profileContainer) return;
        
        // Sincroniza com os dados globais do Dashboard (evita delay de rede e o "Carregando...")
        if (typeof window.getPsychologistData === 'function') {
            const globalData = window.getPsychologistData();
            if (globalData) psychologistData = { ...psychologistData, ...globalData };
        }

        // --- DETECÇÃO DE DISPOSITIVO (Para CSS e JS Condicional) ---
        const isMobile = window.innerWidth <= 992 || /Android|webOS|iPhone|iPad|iPod/i.test(navigator.userAgent);
        document.body.classList.toggle('is-mobile', isMobile);
        document.body.classList.toggle('is-desktop', !isMobile);

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
            // --- ETAPA 1: Header Hero ---
            const avatarImg = document.getElementById('ph-avatar-img');
            if (avatarImg) {
                avatarImg.src = formatImageUrl(data.fotoUrl);
                avatarImg.onerror = function() { this.src = 'https://placehold.co/150x150/e8f5e9/1B4332?text=Psi'; };
            }
            
            const nameDisplay = document.getElementById('ph-nome-display');
            if (nameDisplay) nameDisplay.textContent = data.nome || 'Seu Nome';
            
            const slugPreview = document.getElementById('ph-slug-preview');
            if (slugPreview) slugPreview.textContent = data.slug || '...';
            
            const btnPublic = document.getElementById('btn-view-public-profile');
            if (btnPublic && data.slug) {
                btnPublic.href = `/${data.slug}`;
                btnPublic.style.opacity = 1;
                btnPublic.style.pointerEvents = 'auto';
            }

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
                
                const el = document.getElementById(id);
                if (el) {
                    if (el.tomselect) {
                        el.tomselect.setValue(values, true);
                    } else {
                        const valuesArray = Array.isArray(values) ? values : (values ? [values] : []);
                        Array.from(el.options).forEach(opt => {
                            opt.selected = valuesArray.includes(opt.value);
                        });
                    }
                }
            });
            
            updateProfileInsights();
        }

        function updateProfileInsights() {
            // Lê os dados ao vivo do formulário, mesclando com o que já existe (como fotoUrl)
            let liveData = { ...originalProfileData };
            const profileContainer = document.getElementById('profile-blocks-container');
            if (profileContainer) {
                profileContainer.querySelectorAll('.profile-block').forEach(block => {
                    Object.assign(liveData, getBlockData(block));
                });
            }
            
            const checks = [
                { key: 'fotoUrl', label: 'Foto de Perfil' },
                { key: 'nome', label: 'Nome de Exibição' },
                { key: 'crp', label: 'Número do CRP' },
                { key: 'telefone', label: 'WhatsApp' },
                { key: 'cpf', label: 'Documento (CPF/CNPJ)', condition: (v, data) => !!(data.cpf || data.cnpj || data.document_number) },
                { key: 'cep', label: 'Localização (CEP)' },
                { key: 'slug', label: 'Link Personalizado' },
                { key: 'bio', label: 'Biografia', condition: (v) => v && String(v).trim().length >= 10 },
                { key: 'ano_inicio_experiencia', label: 'Ano de Início' },
                { key: 'valor', label: 'Valor da Sessão', condition: (v, data) => (data.valor_sessao_numero !== null && !isNaN(data.valor_sessao_numero)) || (data.valor_mensal_numero !== null && !isNaN(data.valor_mensal_numero)) },
                { key: 'formacao_nivel', label: 'Formação Acadêmica' },
                { key: 'social', label: 'Redes Sociais', condition: (v, data) => !!(data.instagram_url || data.linkedin_url || data.tiktok_url || data.facebook_url || data.x_url) },
                { key: 'temas_atuacao', label: 'Temas de Atuação' },
                { key: 'publico_alvo', label: 'Público-Alvo' },
                { key: 'praticas_inclusivas', label: 'Identidade e Inclusão' },
                { key: 'genero_identidade', label: 'Gênero' },
                { key: 'abordagens_tecnicas', label: 'Abordagens e Técnicas' },
                { key: 'modalidade', label: 'Modalidade de Atendimento' },
                { key: 'disponibilidade_periodo', label: 'Disponibilidade' }
            ];
            
            let filledCount = 0;
            let checklistHtml = '';

            checks.forEach(check => {
                let isFilled = false;
                const val = liveData[check.key];
                
                if (check.condition) {
                    isFilled = check.condition(val, liveData);
                } else {
                    if (Array.isArray(val)) isFilled = val.length > 0;
                    else if (typeof val === 'string') isFilled = val.trim().length > 0 && !val.includes('placehold.co');
                    else isFilled = !!val;
                }

                if (isFilled) {
                    filledCount++;
                    checklistHtml += `<li class="done">✓ ${check.label}</li>`;
                } else {
                    checklistHtml += `<li class="pending">⚠ ${check.label}</li>`;
                }
            });
            
            const score = Math.round((filledCount / checks.length) * 100);
            
            const fillEl = document.getElementById('quality-progress-fill');
            const scoreBadge = document.getElementById('quality-score-badge');
            const checklistEl = document.getElementById('quality-checklist');
            
            if (fillEl) fillEl.style.width = `${score}%`;
            if (scoreBadge) scoreBadge.textContent = `${score}%`;
            if (checklistEl) checklistEl.innerHTML = checklistHtml;
            
            const statusBadge = document.getElementById('ph-status-display');
            if (statusBadge) {
                if (score === 100) {
                    statusBadge.textContent = 'Perfil 100% Otimizado';
                    statusBadge.style.background = '#dcfce7'; statusBadge.style.color = '#166534'; statusBadge.style.borderColor = '#bbf7d0';
                } else if (score >= 70) {
                    statusBadge.textContent = 'Perfil Forte';
                    statusBadge.style.background = '#fef3c7'; statusBadge.style.color = '#b45309'; statusBadge.style.borderColor = '#fde68a';
                } else {
                    statusBadge.textContent = 'Perfil Incompleto';
                    statusBadge.style.background = '#fee2e2'; statusBadge.style.color = '#b91c1c'; statusBadge.style.borderColor = '#fecaca';
                }
            }
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

        function getBlockData(block) {
            const data = {};
            block.querySelectorAll('input, textarea, select').forEach(input => {
                if (input.name && input.type !== 'radio' && !input.classList.contains('native-select-mobile') && !input.classList.contains('ts-control') && !input.id.endsWith('-ts-control')) {
                    if (input.tagName === 'SELECT') {
                        if (input.tomselect) {
                            data[input.name] = input.tomselect.getValue();
                        } else if (input.multiple) {
                            data[input.name] = Array.from(input.selectedOptions).map(opt => opt.value);
                        } else {
                            data[input.name] = input.value;
                        }
                    } else if (input.type === 'number' || input.id === 'valor_dinamico_input') {
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
                // Impede edição de dados sensíveis ou controlados por API
                if (el.id !== 'email' && el.id !== 'cidade' && el.id !== 'estado') {
                    // Bloqueia edição do CPF/CNPJ caso já esteja preenchido e seja válido (maior que 10 dígitos)
                    if (el.id === 'cpf' && originalProfileData.cpf && originalProfileData.cpf.length >= 11) {
                        return; // Sai deste loop e mantém o disabled no input de documento
                    }
                    el.disabled = false;
                    if (el.tomselect) el.tomselect.enable();
                }
            });
            block.querySelector('.btn-edit').classList.add('hidden');
            block.querySelector('.btn-cancel').classList.remove('hidden');
            block.querySelector('.btn-save').classList.remove('hidden');
            const btnOptimize = block.querySelector('#btn-optimize-bio');
            if (btnOptimize) btnOptimize.style.display = 'inline-flex';
        }

        function exitEditMode(block) {
            block.classList.remove('editing');
            block.querySelectorAll('input, textarea, select').forEach(el => { 
                el.disabled = true; 
                if (el.tomselect) el.tomselect.disable();
            });
            block.querySelector('.btn-edit').classList.remove('hidden');
            block.querySelector('.btn-cancel').classList.add('hidden');
            block.querySelector('.btn-save').classList.add('hidden');
            const btnOptimize = block.querySelector('#btn-optimize-bio');
            if (btnOptimize) btnOptimize.style.display = 'none';
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
                const resData = await res.json();
                
                if (!res.ok) throw new Error(resData.error || 'Falha ao salvar.');
                Object.assign(originalProfileData, payload, resData);
                psychologistData = { ...psychologistData, ...payload, ...resData };
                
                // --- ATUALIZA O ESTADO GLOBAL E ESCONDE O BANNER DE TRIAL IMEDIATAMENTE ---
                if (window.getPsychologistData && window.setPsychologistData) {
                    const globalData = window.getPsychologistData();
                    if (globalData) {
                        const newGlobalData = { ...globalData, ...payload, ...resData };
                        if (newGlobalData.cpf && String(newGlobalData.cpf).replace(/\D/g, '').length >= 11) {
                            newGlobalData.showTrialBanner = false;
                            const banner = document.getElementById('trial-premium-banner');
                            if (banner) banner.style.display = 'none';
                        }
                        window.setPsychologistData(newGlobalData);
                    }
                }
                
                setBlockState(block, 'success');
                dirtyBlocks.delete(block.dataset.blockId);
                updateStickyFooter();
                setTimeout(() => exitEditMode(block), 600);
                updateProfileInsights();
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
                debounceTimers[blockId] = setTimeout(() => { checkForChanges(block); updateProfileInsights(); }, 600);
            }
        });

        profileContainer.addEventListener('change', (e) => {
            const block = e.target.closest('.profile-block');
            if (block && block.classList.contains('editing')) {
                const blockId = block.dataset.blockId;
                clearTimeout(debounceTimers[blockId]);
                debounceTimers[blockId] = setTimeout(() => { 
                    checkForChanges(block); 
                    updateProfileInsights();
                }, 600);
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

                    const resData = await res.json();
                    
                    if (!res.ok) throw new Error(resData.error || 'Falha ao salvar tudo.');

                    Object.assign(originalProfileData, allDirtyData, resData);
                    psychologistData = { ...psychologistData, ...allDirtyData, ...resData };
                    
                    // --- ATUALIZA O ESTADO GLOBAL E ESCONDE O BANNER DE TRIAL IMEDIATAMENTE ---
                    if (window.getPsychologistData && window.setPsychologistData) {
                        const globalData = window.getPsychologistData();
                        if (globalData) {
                            const newGlobalData = { ...globalData, ...allDirtyData, ...resData };
                            if (newGlobalData.cpf && String(newGlobalData.cpf).replace(/\D/g, '').length >= 11) {
                                newGlobalData.showTrialBanner = false;
                                const banner = document.getElementById('trial-premium-banner');
                                if (banner) banner.style.display = 'none';
                            }
                            window.setPsychologistData(newGlobalData);
                        }
                    }
                    
                    dirtyBlocks.forEach(blockId => {
                        const block = profileContainer.querySelector(`[data-block-id="${blockId}"]`);
                        if (block) {
                            setBlockState(block, 'success');
                            setTimeout(() => exitEditMode(block), 500);
                        }
                    });
                    
                    dirtyBlocks.clear();
                    updateStickyFooter();
                    updateProfileInsights();
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
        
        if (typeof TomSelect !== 'undefined') {
            if (!document.body.classList.contains('is-mobile')) {
                document.querySelectorAll('select.ts-select').forEach(el => {
                    if (!el.tomselect) {
                        try {
                            const tsConfig = {
                                create: false,
                                maxOptions: null
                            };
                            if (el.multiple) {
                                tsConfig.plugins = ['remove_button'];
                            }
                            const ph = el.getAttribute('data-placeholder');
                            tsConfig.placeholder = ph ? ph : 'Selecione...';
                            
                            new TomSelect(el, tsConfig);
                            if (el.disabled) el.tomselect.disable();
                        } catch (error) {
                            console.error('Erro ao inicializar TomSelect em', el.id, error);
                        }
                    }
                });
            }
        } else {
            console.warn("TomSelect não está carregado no escopo global.");
        }


        if (psychologistData) {
            populateBlockForm(psychologistData);
            profileContainer.querySelectorAll('.profile-block').forEach(block => {
                if (!block.classList.contains('editing')) {
                    block.querySelectorAll('input, textarea, select').forEach(el => { el.disabled = true; });
                }
            });
            
            const googleLinkContainer = document.getElementById('google-link-container');
            const googleLinkedMessage = document.getElementById('google-linked-message');
            if (googleLinkContainer && googleLinkedMessage && psychologistData.googleId) {
                googleLinkContainer.style.display = 'none';
                googleLinkedMessage.style.display = 'flex';
            }
            
            // Aviso de senha para quem usa Google
            const passwordForm = document.getElementById('password-form');
            if (passwordForm && psychologistData.googleId && !document.getElementById('aviso-senha-google')) {
                const p = document.createElement('p');
                p.id = 'aviso-senha-google';
                p.style.cssText = "font-size: 0.85rem; color: #b45309; background: #fffbeb; padding: 10px; border-radius: 8px; margin-bottom: 15px;";
                p.innerHTML = `💡 <strong>Aviso:</strong> Como você vinculou o Google, pode não saber sua "Senha Atual" (ela foi gerada aleatoriamente na criação). Caso queira cadastrar uma senha manual, saia da conta e use a opção <strong>"Esqueci minha senha"</strong> na página de login.`;
                passwordForm.prepend(p);
            }
        }
        
        // Evento Copiar Link
        const btnCopyLink = document.getElementById('btn-copy-profile-link');
        if (btnCopyLink) {
            btnCopyLink.addEventListener('click', () => {
                if (originalProfileData && originalProfileData.slug) {
                    const url = `${window.location.origin}/${originalProfileData.slug}`;
                    navigator.clipboard.writeText(url).then(() => showToast('Link copiado para a área de transferência!', 'success'));
                }
            });
        }
        
        // Dispara a busca dos dados do Card de Desempenho
        fetchPerformanceData();
    }

    // --- LÓGICA DO BOTÃO DE OTIMIZAR BIO (Separada para clareza) ---
    function setupOptimizeBioButton() {
        const btnOptimizeBio = document.getElementById('btn-optimize-bio');
        if (!btnOptimizeBio) return;

        btnOptimizeBio.addEventListener('click', async () => {
            const bioTextarea = document.getElementById('bio');
            const currentBio = bioTextarea.value;

            if (currentBio.trim().length < 15) {
                showToast('Escreva pelo menos um rascunho para a IA otimizar.', 'error');
                return;
            }

            const btnText = btnOptimizeBio.querySelector('.btn-text');
            const spinner = btnOptimizeBio.querySelector('.spinner');

            btnOptimizeBio.disabled = true;
            if(btnText) btnText.textContent = 'Otimizando...';
            if(spinner) spinner.classList.remove('hidden');

            try {
                const temas = document.getElementById('temas_atuacao')?.tomselect?.getValue();
                const abordagens = document.getElementById('abordagens_tecnicas')?.tomselect?.getValue();

                const res = await apiFetch(`${API_BASE_URL}/api/psychologists/me/optimize-bio`, {
                    method: 'POST',
                    body: JSON.stringify({ bio: currentBio, temas_atuacao: temas, abordagens_tecnicas: abordagens })
                });

                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Falha ao otimizar a biografia.');

                if (data.optimizedBio) {
                    bioTextarea.value = data.optimizedBio;
                    bioTextarea.dispatchEvent(new Event('input', { bubbles: true }));
                    showToast('Biografia otimizada com sucesso!', 'success');
                }
            } catch (error) {
                showToast(error.message, 'error');
            } finally {
                btnOptimizeBio.disabled = false;
                if(btnText) btnText.textContent = '✨ Otimizar com IA';
                if(spinner) spinner.classList.add('hidden');
            }
        });
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
                if (window.inicializarLogicaDoPerfil) window.inicializarLogicaDoPerfil();
                setupOptimizeBioButton(); // Inicializa o botão da IA
            } else {
                throw new Error("Falha ao carregar dados do perfil.");
            }
        } catch (error) {
            console.error("Erro no carregamento do Perfil:", error);
            const mainContent = document.getElementById('main-content') || document.body;
            mainContent.innerHTML = `<div class="widget" style="text-align:center; color:red;"><p>Erro ao carregar seus dados. Tente recarregar a página.</p></div>`;
        }
    }

    initPage();
})();
