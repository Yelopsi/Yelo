/**
 * Arquivo: psi_perfil_form.js
 * Responsabilidade: Isolar a lógica de manipulação de DOM dos formulários de edição do perfil interno (UI).
 */
window.PsiPerfilFormUI = (function() {
    const getFormatImgUrl = () => window.formatImageUrl || (url => url);

    return {
        updateBillingFields: function(isInitialLoad, originalProfileData) {
            const valorDinamicoLabel = document.getElementById('valor_dinamico_label');
            const valorDinamicoInput = document.getElementById('valor_dinamico_input');
            if (!valorDinamicoLabel || !valorDinamicoInput) return;
            
            const tipoSelecionado = document.querySelector('input[name="tipo_cobranca"]:checked')?.value || 'sessao';

            if (tipoSelecionado === 'sessao') {
                valorDinamicoLabel.textContent = 'Valor da Sessão (R$)';
                valorDinamicoInput.name = 'valor_sessao_numero';
                valorDinamicoInput.placeholder = '120,00';
                if (isInitialLoad) valorDinamicoInput.value = originalProfileData.valor_sessao_numero || '';
            } else { // mensal
                valorDinamicoLabel.textContent = 'Valor Mensal (R$)';
                valorDinamicoInput.name = 'valor_mensal_numero';
                valorDinamicoInput.placeholder = '500,00';
                if (isInitialLoad) valorDinamicoInput.value = originalProfileData.valor_mensal_numero || '';
            }
        },

        populateBlockForm: function(data, documentMaskInstance) {
            const formatImageUrl = getFormatImgUrl();
            // Foto Mobile
            const mobileImgEl = document.getElementById('mobile-profile-photo-preview');
            if (mobileImgEl) {
                mobileImgEl.src = formatImageUrl(data.fotoUrl);
                mobileImgEl.onerror = function() { this.src = 'https://placehold.co/120x120/1B4332/FFFFFF?text=Psi'; };
            }

            // Campos Simples
            ['nome', 'email', 'crp', 'telefone', 'bio', 'slug', 'cep', 'cidade', 'estado', 'razao_social', 'formacao_desc', 'ano_inicio_experiencia'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = data[id] || '';
            });

            // Documento (CPF/CNPJ) Híbrido
            const inputDoc = document.getElementById('cpf');
            const groupRazao = document.getElementById('group-razao-social');
            if (inputDoc) {
                const docSalvo = data.cpf || data.cnpj || data.document_number || '';
                if (documentMaskInstance) {
                    documentMaskInstance.value = docSalvo; 
                    if (documentMaskInstance.unmaskedValue.length > 11 && groupRazao) {
                        groupRazao.classList.remove('hidden');
                    } else if (groupRazao) {
                        groupRazao.classList.add('hidden');
                    }
                } else {
                    inputDoc.value = docSalvo;
                }
            }

            // Modelo de Cobrança
            const tipoCobranca = data.tipo_cobranca || 'sessao';
            const radioSessao = document.getElementById('tipo_cobranca_sessao');
            if (radioSessao) radioSessao.checked = tipoCobranca === 'sessao';
            const radioMensal = document.getElementById('tipo_cobranca_mensal');
            if (radioMensal) radioMensal.checked = tipoCobranca === 'mensal';
            this.updateBillingFields(true, data);

            // Redes Sociais
            ['linkedin_url', 'instagram_url', 'facebook_url', 'tiktok_url', 'x_url'].forEach(key => {
                const el = document.getElementById(key);
                if (el && data[key]) {
                    el.value = data[key].replace(/https?:\/\/(www\.)?/, '').replace(/linkedin\.com\/in\//, '').replace(/instagram\.com\//, '');
                }
            });

            // Multiselects e Selects Nativos
            const multiSelectIds = ['temas_atuacao', 'publico_alvo', 'praticas_inclusivas', 'abordagens_tecnicas', 'genero_identidade', 'modalidade', 'disponibilidade_periodo', 'formacao_nivel'];
            multiSelectIds.forEach(id => {
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
        },

        updateProfileInsights: function(data) {
            const checks = [
                { key: 'fotoUrl', label: 'Foto Profissional' },
                { key: 'bio', label: 'Biografia' },
                { key: 'temas_atuacao', label: 'Temas de Atuação' },
                { key: 'abordagens_tecnicas', label: 'Abordagem Clínica' },
                { key: 'valor_sessao_numero', label: 'Valor da Sessão', condition: (v) => v !== null && v !== undefined },
                { key: 'disponibilidade_periodo', label: 'Disponibilidade' }
            ];
            
            let filledCount = 0;
            let checklistHtml = '';

            checks.forEach(check => {
                let isFilled = false;
                const val = data[check.key];
                
                if (check.condition) {
                    isFilled = check.condition(val);
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
            if (scoreBadge) scoreBadge.textContent = `${score}/100`;
            if (checklistEl) checklistEl.innerHTML = checklistHtml;
    
            const statusBadge = document.getElementById('ph-status-display');
            if (statusBadge) {
                if (score === 100) {
                    statusBadge.textContent = 'Perfil Otimizado';
                    statusBadge.style.background = '#dcfce7'; statusBadge.style.color = '#166534'; statusBadge.style.borderColor = '#bbf7d0';
                } else if (score > 50) {
                    statusBadge.textContent = 'Perfil Ativo';
                    statusBadge.style.background = '#fef3c7'; statusBadge.style.color = '#b45309'; statusBadge.style.borderColor = '#fde68a';
                } else {
                    statusBadge.textContent = 'Perfil Incompleto';
                    statusBadge.style.background = '#fee2e2'; statusBadge.style.color = '#b91c1c'; statusBadge.style.borderColor = '#fecaca';
                }
            }
        },

        enterEditMode: function(block, originalProfileData) {
            block.classList.add('editing');
            this.setBlockState(block, 'default');
            
            block.querySelectorAll('input, textarea, select').forEach(el => {
                if (el.id !== 'email' && el.id !== 'cidade' && el.id !== 'estado') {
                    if (el.id === 'cpf' && originalProfileData.cpf && originalProfileData.cpf.length >= 11) return;
                    el.disabled = false;
                    if (el.tomselect) el.tomselect.enable();
                }
            });

            block.querySelector('.btn-edit').classList.add('hidden');
            block.querySelector('.btn-cancel').classList.remove('hidden');
            block.querySelector('.btn-save').classList.remove('hidden');
        },

        cancelEditMode: function(block, originalProfileData, documentMaskInstance) {
            block.classList.remove('editing');
            this.populateBlockForm(originalProfileData, documentMaskInstance);

            block.querySelectorAll('input, textarea, select').forEach(el => { 
                el.disabled = true; 
                if (el.tomselect) el.tomselect.disable();
            });

            block.querySelector('.btn-edit').classList.remove('hidden');
            block.querySelector('.btn-cancel').classList.add('hidden');
            block.querySelector('.btn-save').classList.add('hidden');
        },

        exitEditMode: function(block) {
            block.classList.remove('editing');
            block.querySelectorAll('input, textarea, select').forEach(el => { 
                el.disabled = true; 
                if (el.tomselect) el.tomselect.disable();
            });
            block.querySelector('.btn-edit').classList.remove('hidden');
            block.querySelector('.btn-cancel').classList.add('hidden');
            block.querySelector('.btn-save').classList.add('hidden');
        },

        setBlockState: function(block, state, message = '') {
            const statusEl = block.querySelector('.block-status');
            const saveBtn = block.querySelector('.btn-save');
            const btnText = saveBtn ? saveBtn.querySelector('.btn-text') || saveBtn : null;
            let originalSaveHtml = 'Salvar';

            if (statusEl) statusEl.className = 'block-status';
            if (saveBtn) saveBtn.disabled = false;

            switch (state) {
                case 'saving':
                    if (saveBtn) saveBtn.disabled = true;
                    if (btnText) btnText.innerHTML = '<span class="spinner"></span> Salvando...';
                    break;
                case 'success':
                    if (statusEl) { statusEl.textContent = message || 'Salvo ✔'; statusEl.classList.add('visible', 'success'); setTimeout(() => statusEl.classList.remove('visible'), 2500); }
                    if (btnText) btnText.innerHTML = originalSaveHtml;
                    break;
                case 'error':
                    if (statusEl) { statusEl.textContent = message || 'Erro ao salvar.'; statusEl.classList.add('visible', 'error'); }
                    if (btnText) btnText.innerHTML = originalSaveHtml;
                    break;
                case 'default':
                    if (statusEl) statusEl.classList.remove('visible');
                    if (btnText) btnText.innerHTML = originalSaveHtml;
                    break;
            }
        },

        getBlockData: function(block) {
            const data = {};
            block.querySelectorAll('input, textarea, select').forEach(input => {
                if (input.name && input.type !== 'radio' && !input.classList.contains('native-select-mobile') && !input.classList.contains('ts-control') && !input.id.endsWith('-ts-control')) {
                    if (input.tagName === 'SELECT') {
                        if (input.tomselect) data[input.name] = input.tomselect.getValue();
                        else if (input.multiple) data[input.name] = Array.from(input.selectedOptions).map(opt => opt.value);
                        else data[input.name] = input.value;
                    } else if (input.type === 'number' || input.id === 'valor_dinamico_input') {
                        const valStr = input.value.toString().replace(',', '.').trim();
                        const parsed = parseFloat(valStr);
                        data[input.name] = !isNaN(parsed) ? parsed : null;
                    } else if (input.id === 'cpf' || input.id === 'telefone') {
                        data[input.name] = input.value.replace(/\D/g, '');
                    } else {
                        data[input.name] = input.value;
                    }
                }
            });
            
            const tipoCobrancaRadio = block.querySelector('input[name="tipo_cobranca"]:checked');
            if (tipoCobrancaRadio) {
                data.tipo_cobranca = tipoCobrancaRadio.value;
                if (data.tipo_cobranca === 'sessao') data.valor_mensal_numero = null;
                else data.valor_sessao_numero = null;
            }
            return data;
        }
    };
})();