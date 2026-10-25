// admin/admin_backlog_ajustes.js
(function() {
    let adjustmentsState = [];
    let currentView = 'grouped'; // 'grouped' | 'kanban' | 'list'
    let currentFilterPage = 'all';
    let currentFilterStatus = 'all'; // 'all' padrão para que itens concluídos e em andamento NÃO desapareçam!
    let currentFilterCategory = 'all';
    let currentFilterEnvironment = 'all';
    let currentFilterDevice = 'all';
    let searchQuery = '';
    let previewDebounce = null;

    // Estado do print anexado no Quick Capture
    let attachedImageFile = null;
    let attachedImageBase64 = null;

    // Estado selecionado dos pills manuais
    let selectedEnvironment = 'geral';
    let selectedDevice = 'todos';
    let userOverrodeEnvironment = false;
    let userOverrodeDevice = false;

    function getAuthHeaders() {
        const token = localStorage.getItem('Yelo_token') || localStorage.getItem('Yelo_token_admin');
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        return headers;
    }

    const API_BASE_URL = (typeof window.API_BASE_URL !== 'undefined') ? window.API_BASE_URL : '';

    window.initializePage = function() {
        setupEventListeners();
        loadAdjustments();
    };

    function setupEventListeners() {
        // 1. Submit de Ajuste Rápido & Textarea Auto-Resize
        const formQuick = document.getElementById('form-quick-adjustment');
        const textareaQuick = document.getElementById('input-adjustment-text');
        const fileInput = document.getElementById('input-adjustment-image');
        const btnTriggerPrint = document.getElementById('btn-trigger-print');
        const printPreviewStrip = document.getElementById('attached-print-preview');
        const printPreviewImg = document.getElementById('attached-print-img');
        const printFilename = document.getElementById('attached-print-filename');
        const btnRemovePrint = document.getElementById('btn-remove-print');
        const batchNotice = document.getElementById('batch-lines-notice');
        const batchCountSpan = document.getElementById('batch-lines-count');

        // Botão trigger file input
        if (btnTriggerPrint && fileInput) {
            btnTriggerPrint.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files[0]) {
                    handleImageFile(e.target.files[0]);
                }
            });
        }

        // Remover print anexado
        if (btnRemovePrint) {
            btnRemovePrint.addEventListener('click', () => {
                clearAttachedImage();
            });
        }

        // Suporte para colar print diretamente da área de transferência (Cmd+V / Ctrl+V)
        document.addEventListener('paste', (e) => {
            const editModal = document.getElementById('modal-edit-adjustment');
            if (editModal && editModal.style.display === 'flex') return;

            const items = (e.clipboardData || (e.originalEvent && e.originalEvent.clipboardData))?.items;
            if (!items) return;

            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    const blob = items[i].getAsFile();
                    handleImageFile(blob, 'screenshot-colado.png');
                    if (window.showToast) window.showToast('📸 Print capturado da área de transferência!', 'info');
                    break;
                }
            }
        });

        // Clique no thumbnail do print para ver no lightbox
        if (printPreviewImg) {
            printPreviewImg.addEventListener('click', () => {
                if (attachedImageBase64) {
                    openPrintLightbox(attachedImageBase64, 'Print Anexado');
                }
            });
        }

        // Textarea auto-resize e detecção de lote (múltiplas linhas)
        if (textareaQuick) {
            textareaQuick.addEventListener('keydown', (e) => {
                // Enter sem Shift envia o formulário
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (formQuick) formQuick.dispatchEvent(new Event('submit', { cancelable: true }));
                }
            });

            textareaQuick.addEventListener('input', () => {
                // Auto-resize de altura
                textareaQuick.style.height = 'auto';
                textareaQuick.style.height = Math.min(textareaQuick.scrollHeight, 140) + 'px';

                clearTimeout(previewDebounce);
                const val = textareaQuick.value;
                const lines = val.split(/\r?\n/).map(l => l.trim()).filter(l => l.length >= 3);

                // Se houver múltiplas linhas, mostra o aviso de lote
                if (lines.length > 1) {
                    if (batchNotice && batchCountSpan) {
                        batchCountSpan.textContent = `${lines.length} ajustes detectados em lote`;
                        batchNotice.style.display = 'inline-flex';
                    }
                } else {
                    if (batchNotice) batchNotice.style.display = 'none';
                }

                if (!val.trim()) {
                    const quickTargetSelect = document.getElementById('quick-target-page-select');
                    const quickTargetBadge = document.getElementById('quick-target-badge');
                    if (quickTargetSelect && quickTargetSelect.value === 'auto' && quickTargetBadge) {
                        quickTargetBadge.style.display = 'none';
                    }
                    return;
                }

                previewDebounce = setTimeout(() => {
                    fetchPreview(val.trim());
                }, 140);
            });
        }

        // Submit do formulário de captura
        if (formQuick) {
            formQuick.addEventListener('submit', async (e) => {
                e.preventDefault();
                const text = textareaQuick.value.trim();
                if (!text && !attachedImageFile && !attachedImageBase64) {
                    if (window.showToast) window.showToast('Digite pelo menos 1 ajuste ou anexe um print.', 'warning');
                    return;
                }

                const submitBtn = document.getElementById('btn-submit-adjustment');
                if (submitBtn) submitBtn.disabled = true;

                try {
                    let uploadedImageUrl = null;

                    // 1. Se tem imagem anexada, faz upload primeiro
                    if (attachedImageFile || attachedImageBase64) {
                        uploadedImageUrl = await uploadImageFile(attachedImageFile, attachedImageBase64);
                    }

                    const quickTargetSelect = document.getElementById('quick-target-page-select');
                    const explicitTargetPage = (quickTargetSelect && quickTargetSelect.value !== 'auto') ? quickTargetSelect.value : null;

                    // 2. Cria o ajuste (ou múltiplos se houver quebras de linha)
                    const payload = {
                        text: text || 'Ajuste baseado em print anexado',
                        target_page: explicitTargetPage,
                        environment: selectedEnvironment,
                        device: selectedDevice,
                        image_url: uploadedImageUrl
                    };

                    const res = await fetch(`${API_BASE_URL}/api/admin/adjustments`, {
                        method: 'POST',
                        headers: getAuthHeaders(),
                        body: JSON.stringify(payload)
                    });

                    if (!res.ok) throw new Error("Erro ao salvar ajuste.");
                    const data = await res.json();

                    textareaQuick.value = '';
                    textareaQuick.style.height = 'auto';
                    if (batchNotice) batchNotice.style.display = 'none';
                    clearAttachedImage();
                    resetPillsToDefault();

                    if (data.batch && data.count > 1) {
                        if (window.showToast) {
                            window.showToast(`✨ ${data.count} ajustes criados e categorizados em suas páginas!`, 'success');
                        }
                    } else {
                        const pageTarget = data.adjustment ? data.adjustment.target_page : 'Backlog';
                        if (window.showToast) {
                            window.showToast(`✨ Ajuste registrado em "${pageTarget}"!`, 'success');
                        }
                    }

                    loadAdjustments();
                } catch (err) {
                    if (window.showToast) window.showToast(err.message, 'error');
                } finally {
                    if (submitBtn) submitBtn.disabled = false;
                }
            });
        }

        // 2. Configuração do Seletor de Destino (Onde será o ajuste) e Pills
        const quickTargetSelect = document.getElementById('quick-target-page-select');
        const quickTargetBadge = document.getElementById('quick-target-badge');

        const PAGE_TO_ENV = {
            'Visão Geral (Psicólogo)': 'psicologo',
            'Fórum da Comunidade': 'psicologo',
            'Gestão de Pacientes & Prontuário': 'psicologo',
            'Financeiro & Honorários': 'psicologo',
            'Assinatura & Planos (Stripe/VIP)': 'psicologo',
            'Meu Perfil Psicólogo': 'psicologo',
            'Visão Geral (Admin)': 'admin',
            'CRM Psicólogos (Lista de Profissionais)': 'admin',
            'CRM Hub / Funil de Pacientes': 'admin',
            'CRM Pacientes (Admin)': 'admin',
            'Copilot WhatsApp AI': 'admin',
            'Histórico de Alterações': 'admin',
            'Configurações Globais Admin': 'admin',
            'Portal do Paciente': 'paciente',
            'Questionário de Match': 'publico',
            'Landing Page / Institucional': 'publico',
            'Perfil Público do Psicólogo': 'publico',
            'Blog & Gestão de Conteúdo': 'publico',
            'Geral': 'geral'
        };

        if (quickTargetSelect) {
            quickTargetSelect.addEventListener('change', () => {
                const val = quickTargetSelect.value;
                if (val && val !== 'auto') {
                    quickTargetSelect.classList.add('is-selected');
                    if (quickTargetBadge) {
                        quickTargetBadge.textContent = `📍 Fixado: ${val}`;
                        quickTargetBadge.style.display = 'inline-flex';
                    }
                    const matchedEnv = PAGE_TO_ENV[val];
                    if (matchedEnv && !userOverrodeEnvironment) {
                        selectedEnvironment = matchedEnv;
                        document.querySelectorAll('#pills-environment .env-pill').forEach(b => {
                            b.classList.toggle('active', b.getAttribute('data-env') === matchedEnv);
                        });
                    }
                } else {
                    quickTargetSelect.classList.remove('is-selected');
                    if (quickTargetBadge) {
                        quickTargetBadge.style.display = 'none';
                    }
                }
            });
        }

        // 2. Configuração dos Pills de Ambiente e Dispositivo
        document.querySelectorAll('#pills-environment .env-pill').forEach(btn => {
            btn.addEventListener('click', function() {
                document.querySelectorAll('#pills-environment .env-pill').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                selectedEnvironment = this.getAttribute('data-env');
                userOverrodeEnvironment = true;
            });
        });

        document.querySelectorAll('#pills-device .dev-pill').forEach(btn => {
            btn.addEventListener('click', function() {
                document.querySelectorAll('#pills-device .dev-pill').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                selectedDevice = this.getAttribute('data-dev');
                userOverrodeDevice = true;
            });
        });

        // 3. Abas de Modo de Visualização (Notion / Kanban / Lista)
        document.querySelectorAll('.view-tab-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.view-tab-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                currentView = this.getAttribute('data-view');
                renderCurrentView();
            });
        });

        // 4. Filtros
        const filterEnv = document.getElementById('filter-environment-select');
        if (filterEnv) {
            filterEnv.addEventListener('change', () => {
                currentFilterEnvironment = filterEnv.value;
                loadAdjustments();
            });
        }

        const filterDev = document.getElementById('filter-device-select');
        if (filterDev) {
            filterDev.addEventListener('change', () => {
                currentFilterDevice = filterDev.value;
                loadAdjustments();
            });
        }

        const filterPage = document.getElementById('filter-page-select');
        if (filterPage) {
            filterPage.addEventListener('change', () => {
                currentFilterPage = filterPage.value;
                loadAdjustments();
            });
        }

        const filterStatus = document.getElementById('filter-status-select');
        if (filterStatus) {
            filterStatus.addEventListener('change', () => {
                currentFilterStatus = filterStatus.value;
                loadAdjustments();
            });
        }

        const filterCat = document.getElementById('filter-category-select');
        if (filterCat) {
            filterCat.addEventListener('change', () => {
                currentFilterCategory = filterCat.value;
                loadAdjustments();
            });
        }

        const searchInput = document.getElementById('search-adjustments');
        if (searchInput) {
            let searchTimeout = null;
            searchInput.addEventListener('input', () => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    searchQuery = searchInput.value.trim();
                    loadAdjustments();
                }, 250);
            });
        }

        const btnRefresh = document.getElementById('btn-refresh-backlog');
        if (btnRefresh) {
            btnRefresh.addEventListener('click', () => {
                loadAdjustments();
                if (window.showToast) window.showToast('Dados atualizados!', 'info');
            });
        }

        // 5. Configuração do Lightbox Modal
        const lightboxModal = document.getElementById('modal-lightbox-print');
        const btnCloseLightbox = document.getElementById('btn-close-lightbox');
        if (btnCloseLightbox && lightboxModal) {
            btnCloseLightbox.addEventListener('click', () => {
                lightboxModal.style.display = 'none';
            });
            lightboxModal.addEventListener('click', (e) => {
                if (e.target === lightboxModal) lightboxModal.style.display = 'none';
            });
        }

        // 6. Configuração do Modal de Edição
        const editModal = document.getElementById('modal-edit-adjustment');
        const btnCloseEdit = document.getElementById('btn-close-edit-modal');
        const btnCancelEdit = document.getElementById('btn-cancel-edit');
        const formEdit = document.getElementById('form-edit-adjustment');

        const closeEdit = () => {
            if (editModal) editModal.style.display = 'none';
        };
        if (btnCloseEdit) btnCloseEdit.addEventListener('click', closeEdit);
        if (btnCancelEdit) btnCancelEdit.addEventListener('click', closeEdit);
        if (editModal) {
            editModal.addEventListener('click', (e) => {
                if (e.target === editModal) closeEdit();
            });
        }

        // 7. Configuração do Modal de Confirmação de Exclusão (Estilo Yelo)
        const deleteModal = document.getElementById('modal-confirm-delete-backlog');
        const btnCancelDelete = document.getElementById('btn-cancel-delete-backlog');
        const btnConfirmDelete = document.getElementById('btn-confirm-delete-backlog');

        const closeDeleteModal = () => {
            if (deleteModal) deleteModal.style.display = 'none';
            pendingDeleteId = null;
        };

        if (btnCancelDelete) btnCancelDelete.addEventListener('click', closeDeleteModal);
        if (btnConfirmDelete) {
            btnConfirmDelete.addEventListener('click', async () => {
                if (pendingDeleteId) {
                    const idToDelete = pendingDeleteId;
                    closeDeleteModal();
                    await executeDeleteItem(idToDelete);
                }
            });
        }
        if (deleteModal) {
            deleteModal.addEventListener('click', (e) => {
                if (e.target === deleteModal) closeDeleteModal();
            });
        }

        // Upload de print no modal de edição
        const btnEditUploadPrint = document.getElementById('btn-edit-upload-print');
        const editFileInput = document.getElementById('edit-adj-file-input');
        const btnEditRemovePrint = document.getElementById('btn-edit-remove-print');

        if (btnEditUploadPrint && editFileInput) {
            btnEditUploadPrint.addEventListener('click', () => editFileInput.click());
            editFileInput.addEventListener('change', async (e) => {
                if (e.target.files && e.target.files[0]) {
                    try {
                        const uploaded = await uploadImageFile(e.target.files[0]);
                        document.getElementById('edit-adj-image-url').value = uploaded;
                        const thumb = document.getElementById('edit-adj-print-thumb');
                        thumb.src = uploaded;
                        document.getElementById('edit-adj-print-container').style.display = 'flex';
                        if (window.showToast) window.showToast('Print anexado!', 'success');
                    } catch (err) {
                        if (window.showToast) window.showToast('Falha no upload do print: ' + err.message, 'error');
                    }
                }
            });
        }

        if (btnEditRemovePrint) {
            btnEditRemovePrint.addEventListener('click', () => {
                document.getElementById('edit-adj-image-url').value = '';
                document.getElementById('edit-adj-print-container').style.display = 'none';
            });
        }

        if (formEdit) {
            formEdit.addEventListener('submit', async (e) => {
                e.preventDefault();
                const id = document.getElementById('edit-adj-id').value;
                const payload = {
                    title: document.getElementById('edit-adj-title').value.trim(),
                    target_page: document.getElementById('edit-adj-page').value.trim(),
                    file_path: document.getElementById('edit-adj-file').value.trim() || null,
                    environment: document.getElementById('edit-adj-environment').value,
                    device: document.getElementById('edit-adj-device').value,
                    category: document.getElementById('edit-adj-category').value,
                    priority: document.getElementById('edit-adj-priority').value,
                    status: document.getElementById('edit-adj-status').value,
                    image_url: document.getElementById('edit-adj-image-url').value || null,
                    notes: document.getElementById('edit-adj-notes').value.trim() || null
                };

                try {
                    const res = await fetch(`${API_BASE_URL}/api/admin/adjustments/${id}`, {
                        method: 'PUT',
                        headers: getAuthHeaders(),
                        body: JSON.stringify(payload)
                    });
                    if (!res.ok) throw new Error("Erro ao salvar alterações.");
                    closeEdit();
                    if (window.showToast) window.showToast('Ajuste atualizado!', 'success');
                    loadAdjustments();
                } catch (err) {
                    if (window.showToast) window.showToast(err.message, 'error');
                }
            });
        }
    }

    // Gerenciamento de Imagem Anexada no Quick Capture
    function handleImageFile(file, customName) {
        if (!file) return;
        attachedImageFile = file;

        const reader = new FileReader();
        reader.onload = (e) => {
            attachedImageBase64 = e.target.result;
            const strip = document.getElementById('attached-print-preview');
            const img = document.getElementById('attached-print-img');
            const nameEl = document.getElementById('attached-print-filename');
            const label = document.getElementById('btn-print-label');
            const btn = document.getElementById('btn-trigger-print');

            if (img) img.src = attachedImageBase64;
            if (nameEl) nameEl.textContent = customName || file.name || 'print.png';
            if (strip) strip.style.display = 'flex';
            if (label) label.textContent = '1 Anexado';
            if (btn) btn.classList.add('has-file');
        };
        reader.readAsDataURL(file);
    }

    function clearAttachedImage() {
        attachedImageFile = null;
        attachedImageBase64 = null;
        const strip = document.getElementById('attached-print-preview');
        const img = document.getElementById('attached-print-img');
        const fileInput = document.getElementById('input-adjustment-image');
        const label = document.getElementById('btn-print-label');
        const btn = document.getElementById('btn-trigger-print');

        if (img) img.src = '';
        if (strip) strip.style.display = 'none';
        if (fileInput) fileInput.value = '';
        if (label) label.textContent = 'Print';
        if (btn) btn.classList.remove('has-file');
    }

    function resetPillsToDefault() {
        userOverrodeEnvironment = false;
        userOverrodeDevice = false;
        selectedEnvironment = 'geral';
        selectedDevice = 'todos';

        const quickTargetSelect = document.getElementById('quick-target-page-select');
        const quickTargetBadge = document.getElementById('quick-target-badge');
        if (quickTargetSelect) {
            quickTargetSelect.value = 'auto';
            quickTargetSelect.classList.remove('is-selected');
        }
        if (quickTargetBadge) {
            quickTargetBadge.style.display = 'none';
        }

        document.querySelectorAll('#pills-environment .env-pill').forEach(b => {
            b.classList.toggle('active', b.getAttribute('data-env') === 'geral');
        });
        document.querySelectorAll('#pills-device .dev-pill').forEach(b => {
            b.classList.toggle('active', b.getAttribute('data-dev') === 'todos');
        });
    }

    // Faz upload de imagem para o backend
    async function uploadImageFile(file, base64) {
        let formData = new FormData();
        if (file) {
            formData.append('screenshot', file);
        } else if (base64) {
            const token = localStorage.getItem('Yelo_token') || localStorage.getItem('Yelo_token_admin');
            const res = await fetch(`${API_BASE_URL}/api/admin/adjustments/upload-screenshot`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify({ imageBase64: base64 })
            });
            if (!res.ok) throw new Error("Erro no upload do print.");
            const data = await res.json();
            return data.url;
        }

        const token = localStorage.getItem('Yelo_token') || localStorage.getItem('Yelo_token_admin');
        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`${API_BASE_URL}/api/admin/adjustments/upload-screenshot`, {
            method: 'POST',
            headers: headers,
            body: formData
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || "Erro no upload do print.");
        }
        const data = await res.json();
        return data.url;
    }

    // Live preview durante a digitação
    async function fetchPreview(text) {
        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/adjustments/preview`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ text })
            });
            if (!res.ok) return;
            const data = await res.json();

            // Se for batch, pega a primeira linha como amostra
            const p = data.batch && data.items && data.items.length > 0 ? data.items[0] : data.parsed;
            if (!p) return;

            // Se o usuário não fixou uma página manualmente no seletor, exibe a sugestão detectada
            const quickTargetSelect = document.getElementById('quick-target-page-select');
            const quickTargetBadge = document.getElementById('quick-target-badge');
            if (p.target_page && quickTargetBadge && (!quickTargetSelect || quickTargetSelect.value === 'auto')) {
                quickTargetBadge.textContent = `✨ Sugerido: ${p.target_page}`;
                quickTargetBadge.style.display = 'inline-flex';
            }

            if (!userOverrodeEnvironment && p.environment) {
                selectedEnvironment = p.environment;
                document.querySelectorAll('#pills-environment .env-pill').forEach(b => {
                    b.classList.toggle('active', b.getAttribute('data-env') === p.environment);
                });
            }

            if (!userOverrodeDevice && p.device) {
                selectedDevice = p.device;
                document.querySelectorAll('#pills-device .dev-pill').forEach(b => {
                    b.classList.toggle('active', b.getAttribute('data-dev') === p.device);
                });
            }
        } catch (e) {
            // Ignora silenciosamente
        }
    }

    // Carregamento principal da API
    async function loadAdjustments() {
        try {
            const params = new URLSearchParams();
            if (currentFilterStatus && currentFilterStatus !== 'all') params.append('status', currentFilterStatus);
            if (currentFilterPage && currentFilterPage !== 'all') params.append('page', currentFilterPage);
            if (currentFilterCategory && currentFilterCategory !== 'all') params.append('category', currentFilterCategory);
            if (currentFilterEnvironment && currentFilterEnvironment !== 'all') params.append('environment', currentFilterEnvironment);
            if (currentFilterDevice && currentFilterDevice !== 'all') params.append('device', currentFilterDevice);
            if (searchQuery) params.append('search', searchQuery);

            const res = await fetch(`${API_BASE_URL}/api/admin/adjustments?${params.toString()}`, {
                headers: getAuthHeaders()
            });
            if (!res.ok) throw new Error("Erro ao carregar dados do backlog.");
            const data = await res.json();

            adjustmentsState = data.items || [];
            updateKpis(data.stats || {});
            populatePageSelect(data.pagesSummary || []);
            renderCurrentView(data.grouped || []);
        } catch (err) {
            console.error(err);
            const container = document.getElementById('view-grouped-container');
            if (container) {
                container.innerHTML = `<div style="text-align: center; padding: 40px; color: #ef4444;">Erro ao carregar ajustes: ${err.message}</div>`;
            }
        }
    }

    function updateKpis(stats) {
        setText('kpi-pending-count', stats.pending || 0);
        setText('kpi-pages-count', stats.pages_count || 0);
        setText('kpi-mobile-count', stats.count_mobile || 0);
        setText('kpi-high-count', stats.high_priority || 0);
        setText('kpi-completed-count', stats.completed || 0);
    }

    function setText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    }

    function populatePageSelect(pages) {
        const select = document.getElementById('filter-page-select');
        if (!select) return;

        const currentVal = select.value;
        select.innerHTML = '<option value="all">Todas as Páginas</option>';
        pages.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.target_page;
            opt.textContent = `${p.target_page} (${p.remaining} pendentes)`;
            select.appendChild(opt);
        });
        if (currentVal) select.value = currentVal;
    }

    function renderCurrentView(groupedData) {
        const groupedContainer = document.getElementById('view-grouped-container');
        const kanbanContainer = document.getElementById('view-kanban-container');
        const listContainer = document.getElementById('view-list-container');

        if (groupedContainer) groupedContainer.style.display = currentView === 'grouped' ? 'flex' : 'none';
        if (kanbanContainer) kanbanContainer.style.display = currentView === 'kanban' ? 'grid' : 'none';
        if (listContainer) listContainer.style.display = currentView === 'list' ? 'block' : 'none';

        if (currentView === 'grouped') {
            renderGroupedView(groupedData);
        } else if (currentView === 'kanban') {
            renderKanbanView();
        } else if (currentView === 'list') {
            renderListView();
        }
    }

    // Visualização 1: Agrupada por Página (Notion Flow / Ordem Lógica)
    function renderGroupedView(groupedData) {
        const container = document.getElementById('view-grouped-container');
        if (!container) return;

        // Se groupedData não veio passado, recalcula a partir do adjustmentsState local
        let groups = groupedData;
        if (!groups) {
            const groupedMap = {};
            adjustmentsState.forEach(item => {
                const p = item.target_page || 'Geral';
                if (!groupedMap[p]) {
                    groupedMap[p] = {
                        pageName: p,
                        filePath: item.file_path,
                        environment: item.environment || 'geral',
                        total: 0,
                        completed: 0,
                        remaining: 0,
                        items: []
                    };
                }
                groupedMap[p].items.push(item);
                groupedMap[p].total++;
                if (item.status === 'concluido') groupedMap[p].completed++;
                else groupedMap[p].remaining++;
            });
            groups = Object.values(groupedMap);
        }

        if (!groups || groups.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 60px 20px; background: #ffffff; border-radius: 18px; border: 2px dashed #e2e8f0;">
                    <div style="font-size: 2.4rem; margin-bottom: 10px;">🎉</div>
                    <h3 style="margin: 0 0 6px 0; color: #1e293b; font-weight: 800;">Nenhum ajuste nesta visualização!</h3>
                    <p style="margin: 0; color: #64748b; font-size: 0.9rem;">Todas as demandas foram resolvidas ou nenhum item corresponde aos filtros selecionados.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = groups.map(group => {
            const isAllDone = group.remaining === 0 && group.total > 0;
            const progressPercent = group.total > 0 ? Math.round((group.completed / group.total) * 100) : 0;

            const itemsHtml = group.items.map(item => renderItemRow(item)).join('');

            return `
                <div class="page-group-card" data-page-name="${escapeHtml(group.pageName)}">
                    <div class="page-group-header" onclick="toggleGroupCollapse(this)">
                        <div class="page-group-title-row">
                            <span class="page-chevron">▼</span>
                            <h3 class="page-name">${escapeHtml(group.pageName)}</h3>
                            ${group.filePath ? `<span class="page-file-badge">${escapeHtml(group.filePath)}</span>` : ''}
                            ${renderEnvironmentBadge(group.environment)}
                        </div>
                        
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span class="page-progress-pill ${isAllDone ? 'done' : ''}" id="group-pill-${escapeHtml(group.pageName).replace(/\s+/g, '-')}">
                                ${group.completed}/${group.total} Concluídos (${progressPercent}%)
                            </span>
                            <button type="button" class="btn-copy-ai-prompt" onclick="event.stopPropagation(); copyGroupAiPrompt('${escapeHtml(group.pageName)}')" title="Copiar tarefas formatadas para colar em agentes AI">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>
                                <span>Copiar Prompt AI</span>
                            </button>
                        </div>
                    </div>

                    <div class="page-items-list">
                        ${itemsHtml}
                    </div>
                </div>
            `;
        }).join('');
    }

    // Visualização 2: Quadro Kanban (A Fazer / Em Andamento / Concluído)
    function renderKanbanView() {
        const statuses = ['pendente', 'em_andamento', 'concluido'];
        statuses.forEach(st => {
            const cardsContainer = document.getElementById(`kanban-cards-${st}`);
            const badge = document.getElementById(`kanban-badge-${st}`);
            if (!cardsContainer) return;

            const items = adjustmentsState.filter(item => item.status === st);
            if (badge) badge.textContent = items.length;

            if (items.length === 0) {
                cardsContainer.innerHTML = '<div style="text-align: center; padding: 25px; color: #94a3b8; font-size: 0.84rem;">Nenhum item</div>';
                return;
            }

            cardsContainer.innerHTML = items.map(item => `
                <div class="kanban-card" id="kanban-card-${item.id}">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                        <span class="badge-target-page" title="Página alvo">
                            📁 ${escapeHtml(item.target_page)}
                        </span>
                        <div style="display: flex; gap: 4px;">
                            <button type="button" class="action-icon-btn" style="width: 26px; height: 26px;" onclick="openEditModal(${item.id})" title="Editar">✏️</button>
                            <button type="button" class="action-icon-btn btn-delete" style="width: 26px; height: 26px;" onclick="deleteAdjustmentItem(${item.id})" title="Excluir">🗑️</button>
                        </div>
                    </div>

                    <div style="display: flex; gap: 10px; align-items: flex-start;">
                        ${item.image_url ? `
                            <div class="item-print-thumb" onclick="openPrintLightbox('${item.image_url}', '${escapeHtml(item.title)}')" title="Ver print">
                                <img src="${item.image_url}" alt="Print" loading="lazy">
                                <span class="print-thumb-badge">PRINT</span>
                            </div>
                        ` : ''}
                        <div style="font-size: 0.9rem; font-weight: 600; color: #1e293b; line-height: 1.35; flex: 1;">
                            ${escapeHtml(item.title)}
                        </div>
                    </div>

                    <div class="item-badges">
                        ${renderEnvironmentBadge(item.environment)}
                        ${renderDeviceBadge(item.device)}
                        ${renderCategoryBadge(item.category)}
                        ${renderPriorityBadge(item.priority)}
                    </div>

                    <div class="kanban-card-footer">
                        <span class="kanban-footer-label">Status</span>
                        <select onchange="changeItemStatus(${item.id}, this.value)" class="kanban-status-select status-${item.status}">
                            <option value="pendente" ${item.status === 'pendente' ? 'selected' : ''}>⏳ A Fazer</option>
                            <option value="em_andamento" ${item.status === 'em_andamento' ? 'selected' : ''}>🚀 Em Andamento</option>
                            <option value="concluido" ${item.status === 'concluido' ? 'selected' : ''}>✅ Concluído</option>
                        </select>
                    </div>
                </div>
            `).join('');
        });
    }

    // Visualização 3: Lista Geral
    function renderListView() {
        const container = document.getElementById('flat-items-list');
        if (!container) return;

        if (adjustmentsState.length === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 40px; color: #94a3b8;">Nenhum ajuste encontrado com os filtros atuais.</div>';
            return;
        }

        container.innerHTML = adjustmentsState.map(item => renderItemRow(item, true)).join('');
    }

    // Renderiza a linha de um ajuste
    function renderItemRow(item, showPageBadge = false) {
        const isDone = item.status === 'concluido';

        return `
            <div class="adjustment-item-row ${isDone ? 'is-completed' : ''}" id="adj-row-${item.id}">
                <input type="checkbox" class="adj-checkbox" ${isDone ? 'checked' : ''} onchange="toggleItemStatus(${item.id}, this)" title="Marcar como concluído">

                ${item.image_url ? `
                    <div class="item-print-thumb" onclick="openPrintLightbox('${item.image_url}', '${escapeHtml(item.title)}')" title="Clique para ver print em alta resolução">
                        <img src="${item.image_url}" alt="Print" loading="lazy">
                        <span class="print-thumb-badge">PRINT</span>
                    </div>
                ` : ''}

                <div class="item-body">
                    <p class="item-title">${escapeHtml(item.title)}</p>
                    <div class="item-badges">
                        ${showPageBadge ? `<span class="badge-target-page">📁 ${escapeHtml(item.target_page)}</span>` : ''}
                        ${renderEnvironmentBadge(item.environment)}
                        ${renderDeviceBadge(item.device)}
                        ${renderCategoryBadge(item.category)}
                        ${renderPriorityBadge(item.priority)}
                        ${item.status === 'em_andamento' ? '<span class="badge-status-progress">🚀 Em Andamento</span>' : ''}
                    </div>
                </div>

                <div class="item-right-actions">
                    <select onchange="changeItemStatus(${item.id}, this.value)" class="kanban-status-select status-${item.status}" title="Alterar status deste ajuste">
                        <option value="pendente" ${item.status === 'pendente' ? 'selected' : ''}>⏳ A Fazer</option>
                        <option value="em_andamento" ${item.status === 'em_andamento' ? 'selected' : ''}>🚀 Em Andamento</option>
                        <option value="concluido" ${item.status === 'concluido' ? 'selected' : ''}>✅ Concluído</option>
                    </select>
                    <button type="button" class="action-icon-btn" onclick="openEditModal(${item.id})" title="Editar detalhes">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                    </button>
                    <button type="button" class="action-icon-btn btn-delete" onclick="deleteAdjustmentItem(${item.id})" title="Excluir ajuste">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </div>
            </div>
        `;
    }

    // Badges Auxiliares
    function renderEnvironmentBadge(env) {
        switch(env) {
            case 'admin':
                return '<span class="badge-env env-admin">🛡️ Admin</span>';
            case 'psicologo':
                return '<span class="badge-env env-psicologo">🧠 Psicólogo</span>';
            case 'paciente':
                return '<span class="badge-env env-paciente">👤 Paciente</span>';
            case 'publico':
                return '<span class="badge-env env-publico">🌐 Fora do Acesso</span>';
            default:
                return '<span class="badge-env env-geral">⚙️ Geral</span>';
        }
    }

    function renderDeviceBadge(dev) {
        switch(dev) {
            case 'mobile':
                return '<span class="badge-dev dev-mobile">📱 Mobile</span>';
            case 'desktop':
                return '<span class="badge-dev dev-desktop">💻 Desktop</span>';
            default:
                return '<span class="badge-dev dev-todos">🔄 Responsivo</span>';
        }
    }

    function renderCategoryBadge(cat) {
        let cls = 'cat-geral';
        if (cat.includes('Design')) cls = 'cat-design';
        else if (cat.includes('Funcionalidade')) cls = 'cat-func';
        else if (cat.includes('Bug')) cls = 'cat-bug';
        else if (cat.includes('Texto')) cls = 'cat-copy';
        else if (cat.includes('Performance') || cat.includes('Mobile')) cls = 'cat-mobile';

        return `<span class="badge-category ${cls}">${escapeHtml(cat)}</span>`;
    }

    function renderPriorityBadge(prio) {
        if (prio === 'alta') return '<span class="badge-priority prio-alta">⚡ Alta</span>';
        if (prio === 'baixa') return '<span class="badge-priority prio-baixa">🟢 Baixa</span>';
        return '<span class="badge-priority prio-media">🟡 Média</span>';
    }

    // Ações Globais na Janela (window)
    window.toggleGroupCollapse = function(headerEl) {
        const card = headerEl.closest('.page-group-card');
        if (card) card.classList.toggle('collapsed');
    };

    // Toggle de Status Otimista (NÃO some da tela!)
    window.toggleItemStatus = async function(id, checkboxEl) {
        const item = adjustmentsState.find(a => a.id === id);
        if (!item) return;

        const nextIsCompleted = item.status !== 'concluido';
        const newStatus = nextIsCompleted ? 'concluido' : 'pendente';
        
        // 1. Atualização Otimista Imediata no DOM
        item.status = newStatus;
        const row = document.getElementById(`adj-row-${id}`);
        if (row) {
            row.classList.toggle('is-completed', nextIsCompleted);
        }
        if (checkboxEl) {
            checkboxEl.checked = nextIsCompleted;
        }

        // Atualiza contadores locais
        recalculateLocalCounters();

        // 2. Chama a API em segundo plano
        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/adjustments/${id}/status`, {
                method: 'PATCH',
                headers: getAuthHeaders(),
                body: JSON.stringify({ status: newStatus })
            });
            if (!res.ok) throw new Error("Erro ao atualizar status no servidor.");
            
            if (window.showToast) {
                if (nextIsCompleted) window.showToast('✅ Ajuste marcado como concluído!', 'success');
                else window.showToast('⏳ Ajuste reaberto!', 'info');
            }
        } catch (err) {
            // Reverte em caso de erro
            item.status = nextIsCompleted ? 'pendente' : 'concluido';
            if (row) row.classList.toggle('is-completed', !nextIsCompleted);
            if (checkboxEl) checkboxEl.checked = !nextIsCompleted;
            recalculateLocalCounters();
            if (window.showToast) window.showToast(err.message, 'error');
        }
    };

    // Mudar Status (Move o cartão no Kanban ou atualiza linha no Grouped/List)
    window.changeItemStatus = async function(id, newStatus) {
        const item = adjustmentsState.find(a => a.id === id);
        if (!item) return;

        const oldStatus = item.status;
        item.status = newStatus;

        // Atualização otimista na view ativa
        if (currentView === 'kanban') {
            renderKanbanView();
        } else if (currentView === 'grouped') {
            renderGroupedView();
        } else if (currentView === 'list') {
            renderListView();
        }
        recalculateLocalCounters();

        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/adjustments/${id}/status`, {
                method: 'PATCH',
                headers: getAuthHeaders(),
                body: JSON.stringify({ status: newStatus })
            });
            if (!res.ok) throw new Error("Erro ao atualizar status.");
        } catch (err) {
            item.status = oldStatus;
            if (currentView === 'kanban') {
                renderKanbanView();
            } else if (currentView === 'grouped') {
                renderGroupedView();
            } else if (currentView === 'list') {
                renderListView();
            }
            recalculateLocalCounters();
            if (window.showToast) window.showToast(err.message, 'error');
        }
    };

    function recalculateLocalCounters() {
        const pending = adjustmentsState.filter(a => a.status === 'pendente').length;
        const completed = adjustmentsState.filter(a => a.status === 'concluido').length;
        setText('kpi-pending-count', pending);
        setText('kpi-completed-count', completed);

        // Atualiza os pills de progresso dos grupos visíveis
        const groupedMap = {};
        adjustmentsState.forEach(a => {
            const p = a.target_page || 'Geral';
            if (!groupedMap[p]) groupedMap[p] = { total: 0, completed: 0 };
            groupedMap[p].total++;
            if (a.status === 'concluido') groupedMap[p].completed++;
        });

        Object.keys(groupedMap).forEach(pageName => {
            const pillId = `group-pill-${escapeHtml(pageName).replace(/\s+/g, '-')}`;
            const pill = document.getElementById(pillId);
            if (pill) {
                const g = groupedMap[pageName];
                const pct = g.total > 0 ? Math.round((g.completed / g.total) * 100) : 0;
                pill.textContent = `${g.completed}/${g.total} Concluídos (${pct}%)`;
                pill.classList.toggle('done', g.completed === g.total && g.total > 0);
            }
        });
    }

    let pendingDeleteId = null;

    window.deleteAdjustmentItem = function(id) {
        const item = adjustmentsState.find(a => a.id === id);
        const itemTitle = item ? item.title : 'este ajuste';

        const deleteModal = document.getElementById('modal-confirm-delete-backlog');
        const previewEl = document.getElementById('delete-modal-item-preview');

        if (deleteModal) {
            pendingDeleteId = id;
            if (previewEl) {
                previewEl.textContent = itemTitle;
            }
            deleteModal.style.display = 'flex';
        } else if (typeof window.openConfirmationModal === 'function') {
            window.openConfirmationModal(
                'Excluir Ajuste',
                `Tem certeza que deseja excluir o ajuste <strong>"${escapeHtml(itemTitle)}"</strong>?<br><span style="color: #94a3b8; font-size: 0.84rem;">Esta ação não pode ser desfeita.</span>`,
                () => executeDeleteItem(id)
            );
        } else {
            executeDeleteItem(id);
        }
    };

    async function executeDeleteItem(id) {
        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/adjustments/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            if (!res.ok) throw new Error("Erro ao excluir ajuste.");
            if (window.showToast) window.showToast('✅ Ajuste excluído com sucesso!', 'success');
            loadAdjustments();
        } catch (err) {
            if (window.showToast) window.showToast(err.message, 'error');
        }
    }

    // Abre Lightbox com o Print em Alta Resolução
    window.openPrintLightbox = function(imageUrl, title) {
        const modal = document.getElementById('modal-lightbox-print');
        const img = document.getElementById('lightbox-img');
        const titleEl = document.getElementById('lightbox-title');
        const extLink = document.getElementById('lightbox-open-external');

        if (!modal || !img) return;

        img.src = imageUrl;
        if (titleEl) titleEl.textContent = title ? `Print: ${title}` : 'Print do Ajuste';
        if (extLink) extLink.href = imageUrl;

        modal.style.display = 'flex';
    };

    // Modal de Edição Avançada
    window.openEditModal = function(id) {
        const item = adjustmentsState.find(a => a.id === id);
        if (!item) return;

        const modal = document.getElementById('modal-edit-adjustment');
        if (!modal) return;

        document.getElementById('edit-adj-id').value = item.id;
        document.getElementById('edit-adj-title').value = item.title || '';
        document.getElementById('edit-adj-page').value = item.target_page || '';
        document.getElementById('edit-adj-file').value = item.file_path || '';
        document.getElementById('edit-adj-environment').value = item.environment || 'geral';
        document.getElementById('edit-adj-device').value = item.device || 'todos';
        document.getElementById('edit-adj-category').value = item.category || 'Melhoria';
        document.getElementById('edit-adj-priority').value = item.priority || 'media';
        document.getElementById('edit-adj-status').value = item.status || 'pendente';
        document.getElementById('edit-adj-notes').value = item.notes || '';
        document.getElementById('edit-adj-image-url').value = item.image_url || '';

        const printContainer = document.getElementById('edit-adj-print-container');
        const printThumb = document.getElementById('edit-adj-print-thumb');
        if (item.image_url) {
            printThumb.src = item.image_url;
            printContainer.style.display = 'flex';
            printThumb.onclick = () => openPrintLightbox(item.image_url, item.title);
        } else {
            printContainer.style.display = 'none';
        }

        modal.style.display = 'flex';
    };

    // "Copiar Prompt AI" com Ambiente, Dispositivo, Arquivo e Prints
    window.copyGroupAiPrompt = function(pageName) {
        const items = adjustmentsState.filter(a => a.target_page === pageName && a.status !== 'concluido');
        if (items.length === 0) {
            if (window.showToast) window.showToast(`Não há ajustes pendentes para ${pageName}.`, 'info');
            return;
        }

        const filePath = items[0].file_path || 'A definir';
        const envLabel = {
            'admin': 'Dashboard Admin',
            'psicologo': 'Dashboard do Psicólogo',
            'paciente': 'Portal do Paciente',
            'publico': 'Página Pública / Fora do Acesso',
            'geral': 'Geral / Sistema'
        }[items[0].environment] || 'Geral';

        const devLabel = {
            'mobile': 'Mobile (iPhone / Android)',
            'desktop': 'Desktop',
            'todos': 'Responsivo / Todos'
        }[items[0].device] || 'Responsivo';

        let prompt = `Por favor, faça os seguintes ajustes na página **${pageName}**:\n`;
        prompt += `- **Ambiente:** ${envLabel}\n`;
        prompt += `- **Dispositivo Alvo:** ${devLabel}\n`;
        prompt += `- **Arquivo Principal:** \`${filePath}\`\n\n`;
        prompt += `### Lista de Ajustes a Realizar:\n`;

        items.forEach((item, index) => {
            prompt += `${index + 1}. **${item.title}**\n`;
            prompt += `   - Categoria: ${item.category} | Prioridade: ${item.priority.toUpperCase()}\n`;
            if (item.environment && item.environment !== items[0].environment) {
                prompt += `   - Ambiente específico: ${item.environment}\n`;
            }
            if (item.device && item.device !== items[0].device) {
                prompt += `   - Dispositivo específico: ${item.device}\n`;
            }
            if (item.image_url) {
                prompt += `   - 📸 Print de Referência: ${window.location.origin}${item.image_url}\n`;
            }
            if (item.notes) {
                prompt += `   - Notas: ${item.notes}\n`;
            }
            prompt += `\n`;
        });

        prompt += `Execute as correções necessárias no código preservando o funcionamento existente.`;

        navigator.clipboard.writeText(prompt).then(() => {
            if (window.showToast) window.showToast(`📋 Prompt para AI com ${items.length} ajuste(s) copiado com sucesso!`, 'success');
        }).catch(() => {
            if (window.showToast) window.showToast('Falha ao copiar prompt.', 'error');
        });
    };

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
})();
