// admin/admin_copilot_wpp.js
(function () {
    let currentPsychologistId = null;
    let currentEntityType = null;
    let currentEntityId = null;
    let currentThreadId = null;
    let currentConversationId = null;
    let currentStructuredOutput = null;
    let currentOriginalAiReply = '';
    let showingAlternativeReply = false;
    let currentDossierPhone = null;
    let currentSelectionSource = 'auto'; // 'auto' | 'manual'
    let currentTone = 'natural';
    let currentMode = 'resposta';
    let isWppPreviewVisible = true;
    let identifyTimeout = null;
    let identifyController = null;
    let identifyRequestSeq = 0;
    let generateController = null;
    let generateRequestSeq = 0;
    let isGenerating = false;

    function abortOngoingGeneration() {
        generateRequestSeq++;
        if (generateController) {
            generateController.abort();
            generateController = null;
        }
        isGenerating = false;
    }

    function restoreButtonChildren(btn, savedNodes) {
        if (!btn || !Array.isArray(savedNodes)) return;
        clearEl(btn);
        savedNodes.forEach(n => btn.appendChild(n));
    }

    function notify(msg, type = 'info') {
        if (typeof window.showToast === 'function') {
            window.showToast(msg, type);
        } else {
            console.log(`[Copilot][${type}]`, msg);
        }
    }

    function clearEl(el) {
        if (!el) return;
        while (el.firstChild) el.removeChild(el.firstChild);
    }

    function normalizeWhatsAppCopyText(raw) {
        if (!raw || typeof raw !== 'string') return '';
        return raw
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')
            .replace(/[ \t]+$/gm, '')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }

    function appendFormattedInlineSegment(parent, line) {
        // Renderiza *negrito*, _itálico_ e ~tachado~ com nós DOM puros (zero innerHTML)
        const tokenRe = /(\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~)/g;
        let lastIdx = 0;
        let match;
        while ((match = tokenRe.exec(line)) !== null) {
            if (match.index > lastIdx) {
                parent.appendChild(document.createTextNode(line.slice(lastIdx, match.index)));
            }
            const tok = match[0];
            const inner = tok.slice(1, -1);
            let el;
            if (tok.startsWith('*')) {
                el = document.createElement('strong');
            } else if (tok.startsWith('_')) {
                el = document.createElement('em');
            } else {
                el = document.createElement('s');
            }
            el.textContent = inner;
            parent.appendChild(el);
            lastIdx = tokenRe.lastIndex;
        }
        if (lastIdx < line.length) {
            parent.appendChild(document.createTextNode(line.slice(lastIdx)));
        }
    }

    function renderWhatsAppPreview(rawText) {
        const previewBox = document.getElementById('whatsapp-preview-box');
        const previewWrap = document.getElementById('whatsapp-preview-wrapper');
        if (!previewBox) return;

        const safe = normalizeWhatsAppCopyText(String(rawText || ''));
        if (previewWrap) {
            previewWrap.style.display = safe ? 'block' : 'none';
        }
        previewBox.style.display = (safe && isWppPreviewVisible) ? 'block' : 'none';
        clearEl(previewBox);
        if (!safe) return;

        const lines = safe.split('\n');
        lines.forEach((line, idx) => {
            if (idx > 0) previewBox.appendChild(document.createElement('br'));
            if (/^-\s+/.test(line)) {
                const bulletSpan = document.createElement('span');
                bulletSpan.textContent = '• ';
                bulletSpan.style.fontWeight = '700';
                previewBox.appendChild(bulletSpan);
                appendFormattedInlineSegment(previewBox, line.replace(/^-\s+/, ''));
            } else {
                appendFormattedInlineSegment(previewBox, line);
            }
        });
    }

    function setReplyText(val) {
        const boxTexto = document.getElementById('box-resposta-texto');
        if (!boxTexto) return;
        const safe = String(val || '');
        if ('value' in boxTexto) boxTexto.value = safe;
        boxTexto.textContent = safe;
        if (boxTexto.style && boxTexto.scrollHeight) {
            boxTexto.style.height = 'auto';
            boxTexto.style.height = Math.min(Math.max(boxTexto.scrollHeight || 160, 160), 420) + 'px';
        }
        renderWhatsAppPreview(safe);
        const countEl = document.getElementById('reply-char-count');
        if (countEl) {
            countEl.textContent = safe ? `${safe.length} caracteres • Formatação WhatsApp preservada` : 'Formatação WhatsApp preservada.';
        }
    }

    function getReplyText() {
        const boxTexto = document.getElementById('box-resposta-texto');
        if (!boxTexto) return '';
        return ('value' in boxTexto && boxTexto.value !== undefined) ? boxTexto.value : (boxTexto.textContent || '');
    }

    function setBannerRichText(el, prefix, boldText, suffix) {
        if (!el) return;
        clearEl(el);
        if (prefix) el.appendChild(document.createTextNode(prefix));
        if (boldText) {
            const strong = document.createElement('strong');
            strong.textContent = boldText;
            el.appendChild(strong);
        }
        if (suffix) el.appendChild(document.createTextNode(suffix));
    }

    function formatValorSessao(valor, mensal, tipo) {
        if (valor !== null && valor !== undefined && Number(valor) > 0) {
            return `R$ ${valor}`;
        }
        if (tipo === 'mensal' && mensal !== null && mensal !== undefined && Number(mensal) > 0) {
            return `R$ ${mensal}/mês`;
        }
        return 'A combinar';
    }

    function formatDateBRT(rawDate) {
        if (!rawDate) return 'Sem data';
        const d = new Date(rawDate);
        if (Number.isNaN(d.getTime()) || d.getFullYear() < 2000) return 'Sem data';
        return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    }

    function getStatusBadge(dossier) {
        if (dossier?.entityType === 'lead' || dossier?.entityType === 'waiting_list' || dossier?.entityType === 'unregistered') {
            return { text: dossier?.subscriptionSummary?.badgeLabel || 'Interessado (Pré-cadastro)', bg: '#fef3c7', color: '#92400e' };
        }
        if (dossier?.subscriptionSummary) {
            const s = dossier.subscriptionSummary;
            if (s.isVip) return { text: s.badgeLabel || 'VIP (Isento)', bg: '#fef3c7', color: '#92400e' };
            if (s.isExpired) return { text: s.badgeLabel || 'Expirado', bg: '#fee2e2', color: '#991b1b' };
            if (s.isTrial) return { text: s.badgeLabel || 'Em Trial', bg: '#dbeafe', color: '#1d4ed8' };
            if (s.cancelAtPeriodEnd) return { text: s.badgeLabel || 'Cancelamento Agendado', bg: '#ffedd5', color: '#c2410c' };
            if (dossier.profile?.status === 'active') return { text: s.badgeLabel || 'Pagante Ativo', bg: '#dcfce7', color: '#166534' };
            return { text: s.badgeLabel || 'Inativo / Pausado', bg: '#fee2e2', color: '#991b1b' };
        }
        const p = dossier?.profile || {};
        if (p.is_exempt === true) return { text: 'VIP (Isento)', bg: '#fef3c7', color: '#92400e' };
        if (p.status === 'active') {
            if (p.subscriptionId || (p.subscription_payments_count && p.subscription_payments_count > 0)) {
                return p.cancelAtPeriodEnd
                    ? { text: 'Cancelamento Agendado', bg: '#ffedd5', color: '#c2410c' }
                    : { text: 'Pagante Ativo', bg: '#dcfce7', color: '#166534' };
            }
            const exp = p.planExpiresAt ? new Date(p.planExpiresAt) : null;
            if (exp && !Number.isNaN(exp.getTime()) && exp <= new Date()) {
                return { text: 'Trial Expirado', bg: '#fee2e2', color: '#991b1b' };
            }
            return { text: 'Em Trial', bg: '#dbeafe', color: '#1d4ed8' };
        }
        return { text: 'Inativo / Pausado', bg: '#fee2e2', color: '#991b1b' };
    }

    function getAuthHeaders() {
        const token = localStorage.getItem('Yelo_token') || localStorage.getItem('Yelo_token_admin');
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        return headers;
    }

    function resetDossierCards() {
        const emptyState = document.getElementById('dossie-empty-state');
        const content = document.getElementById('dossie-content');
        const statusPill = document.getElementById('dossie-status-pill');
        const miniBanner = document.getElementById('mini-profile-banner');
        const mobileDossierPill = document.getElementById('mobile-dossier-pill');
        const candBox = document.getElementById('copilot-candidates-box');

        if (emptyState) emptyState.style.display = 'block';
        if (content) content.style.display = 'none';
        if (statusPill) statusPill.style.display = 'none';
        if (miniBanner) miniBanner.classList.remove('visible');
        if (mobileDossierPill) mobileDossierPill.style.display = 'none';
        if (candBox) {
            candBox.style.display = 'none';
            clearEl(candBox);
        }
    }

    function resetIdentityState() {
        const hadPrevPsi = currentPsychologistId !== null || currentEntityType !== null;
        currentPsychologistId = null;
        currentEntityType = null;
        currentEntityId = null;
        currentThreadId = null;
        currentConversationId = null;
        currentStructuredOutput = null;
        currentOriginalAiReply = '';
        showingAlternativeReply = false;
        currentDossierPhone = null;
        currentSelectionSource = 'auto';
        abortOngoingGeneration();
        if (hadPrevPsi) {
            const cardResposta = document.getElementById('card-resposta-gerada');
            setReplyText('');
            if (cardResposta) cardResposta.style.display = 'none';
            const briefingCard = document.getElementById('card-briefing-estrategico');
            if (briefingCard) briefingCard.style.display = 'none';
        }
        const diagBox = document.getElementById('dossie-diagnostico-box');
        if (diagBox) diagBox.style.display = 'none';
        resetDossierCards();
    }

    function renderCandidatesBox(candidates, titleText) {
        const candBox = document.getElementById('copilot-candidates-box');
        if (!candBox) return;
        clearEl(candBox);

        if (!Array.isArray(candidates) || candidates.length === 0) {
            candBox.style.display = 'none';
            return;
        }

        const header = document.createElement('div');
        header.style.fontSize = '0.78rem';
        header.style.fontWeight = '700';
        header.style.color = '#92400e';
        header.style.marginBottom = '8px';
        header.textContent = titleText || 'Mais de um profissional compatível encontrado. Confirme qual é o correto:';
        candBox.appendChild(header);

        const listWrap = document.createElement('div');
        listWrap.style.display = 'flex';
        listWrap.style.flexDirection = 'column';
        listWrap.style.gap = '6px';

        candidates.forEach((cand) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.style.display = 'flex';
            btn.style.justifyContent = 'space-between';
            btn.style.alignItems = 'center';
            btn.style.width = '100%';
            btn.style.textAlign = 'left';
            btn.style.padding = '8px 10px';
            btn.style.borderRadius = '8px';
            btn.style.border = '1px solid #fcd34d';
            btn.style.background = '#ffffff';
            btn.style.cursor = 'pointer';

            const info = document.createElement('div');
            const title = document.createElement('div');
            title.style.fontSize = '0.82rem';
            title.style.fontWeight = '700';
            title.style.color = '#0f172a';
            title.textContent = cand.nome || `Profissional #${cand.id}`;

            const sub = document.createElement('div');
            sub.style.fontSize = '0.72rem';
            sub.style.color = '#64748b';
            sub.textContent = `${cand.crp ? 'CRP ' + cand.crp + ' • ' : ''}${cand.cidade || 'Online'}${cand.estado ? '-' + cand.estado : ''} • ${cand.statusLabel || cand.status || ''}`;

            info.appendChild(title);
            info.appendChild(sub);

            const cta = document.createElement('span');
            cta.style.background = '#1B4332';
            cta.style.color = '#FFEE8C';
            cta.style.padding = '4px 9px';
            cta.style.borderRadius = '6px';
            cta.style.fontSize = '0.72rem';
            cta.style.fontWeight = '700';
            cta.textContent = 'Confirmar';

            btn.appendChild(info);
            btn.appendChild(cta);

            btn.addEventListener('click', () => {
                selectConfirmedPsychologist(cand.id, cand.entityType || 'psychologist');
            });

            listWrap.appendChild(btn);
        });

        candBox.appendChild(listWrap);
        candBox.style.display = 'block';
    }

    async function selectConfirmedPsychologist(id, entityType = 'psychologist') {
        const parsedId = parseInt(id, 10);
        if (Number.isNaN(parsedId)) return;

        const targetType = ['psychologist', 'lead', 'waiting_list'].includes(entityType) ? entityType : 'psychologist';
        const switchedProfessional = currentEntityId !== parsedId || currentEntityType !== targetType;
        abortOngoingGeneration();
        if (switchedProfessional) {
            const cardResposta = document.getElementById('card-resposta-gerada');
            const boxTexto = document.getElementById('box-resposta-texto');
            if (boxTexto) boxTexto.textContent = '';
            if (cardResposta) cardResposta.style.display = 'none';
        }

        currentEntityType = targetType;
        currentEntityId = parsedId;
        currentPsychologistId = targetType === 'psychologist' ? parsedId : null;
        currentThreadId = null;
        currentSelectionSource = 'manual';
        const searchBox = document.getElementById('manual-search-box');
        if (searchBox) searchBox.style.display = 'none';
        const candBox = document.getElementById('copilot-candidates-box');
        if (candBox) candBox.style.display = 'none';

        try {
            const identifyRes = await fetch('/api/admin/copilot/identify', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ psychologistId: targetType === 'psychologist' ? parsedId : undefined, entityType: targetType, entityId: parsedId })
            });
            const identifyData = identifyRes.ok ? await identifyRes.json().catch(() => null) : null;
            if (identifyData?.dossier?.profile) {
                renderDossier(identifyData.dossier);
                const prof = identifyData.dossier.profile;
                const valStr = formatValorSessao(prof.valor_sessao_numero, prof.valor_mensal_numero, prof.tipo_cobranca);
                const bannerTexto = document.getElementById('identificacao-texto');
                const bannerSubtexto = document.getElementById('identificacao-subtexto');
                const bannerIcone = document.getElementById('identificacao-icone');
                const btnTrocar = document.getElementById('btn-trocar-psi-manual');

                if (bannerIcone) bannerIcone.textContent = '🟢';
                setBannerRichText(bannerTexto, 'Selecionado: ', prof.nome, ` (${targetType === 'psychologist' ? 'ID ' + prof.id : targetType})`);
                if (bannerSubtexto) {
                    const badge = identifyData.dossier.subscriptionSummary?.badgeLabel || prof.plano || 'Essencial';
                    bannerSubtexto.textContent = targetType === 'psychologist'
                        ? `${badge} • Sessão: ${valStr} • ${prof.whatsapp_clicks || 0} cliques Wpp`
                        : `${badge} • Contato em pré-cadastro`;
                }
                if (btnTrocar) btnTrocar.style.display = 'inline-block';
            } else {
                notify('Não foi possível carregar os dados do profissional selecionado.', 'error');
            }
        } catch (err) {
            notify('Erro de rede ao carregar o profissional selecionado.', 'error');
        }
    }

    window.initializePage = function () {
        setupEventListeners();
        loadHistory();
        if (window.YeloDevRoleSwitcher && typeof window.YeloDevRoleSwitcher.initCopilotButton === 'function') {
            window.YeloDevRoleSwitcher.initCopilotButton();
        }
        const devBtn = document.getElementById('btn-dev-switch-psi');
        const actionsWrap = devBtn?.parentElement;
        if (devBtn && actionsWrap && actionsWrap.classList.contains('copilot-header-actions')) {
            actionsWrap.style.display = devBtn.style.display === 'none' ? 'none' : 'flex';
        }
    };

    function setupEventListeners() {
        const chatInput = document.getElementById('copilot-input-chat');
        const statsEl = document.getElementById('chat-input-stats');
        const btnGerar = document.getElementById('btn-gerar-resposta');
        const btnCopiar = document.getElementById('btn-copiar-resposta');
        const btnLimpar = document.getElementById('btn-limpar-tudo');
        const btnTrocar = document.getElementById('btn-trocar-psi-manual');
        const btnManualSearch = document.getElementById('btn-manual-search-exec');
        const manualQuery = document.getElementById('manual-psi-query');
        const btnRegenerar = document.getElementById('btn-regenerar-variacao');
        const btnMiniVerDossie = document.getElementById('btn-mini-ver-dossie');
        const btnAlternativa = document.getElementById('btn-usar-alternativa');
        const btnRejeitar = document.getElementById('btn-rejeitar-resposta');
        const btnAbrirWpp = document.getElementById('btn-abrir-whatsapp');
        const btnCsDrawer = document.getElementById('btn-abrir-cs-drawer');
        const btnDiagnostico = document.getElementById('btn-diagnostico-cs');
        const btnBacklog = document.getElementById('btn-criar-backlog');
        const btnInsights = document.getElementById('btn-insights-coletivos');
        const boxTexto = document.getElementById('box-resposta-texto');

        const btnColar = document.getElementById('btn-colar-clipboard');
        const btnColarMais = document.getElementById('btn-colar-mais');
        const btnLimparInput = document.getElementById('btn-limpar-input');
        const btnColarFloating = document.getElementById('btn-colar-floating');

        function updateInputView() {
            if (!chatInput) return;
            chatInput.style.height = 'auto';
            const scrollH = chatInput.scrollHeight;
            const newHeight = Math.min(Math.max(scrollH, 140), 380);
            chatInput.style.height = newHeight + 'px';
            chatInput.style.overflowY = 'auto';

            const val = chatInput.value || '';
            const hasText = val.trim().length > 0;
            const hasAnyChar = val.length > 0;

            if (btnColarMais) {
                btnColarMais.style.display = hasText ? 'inline-flex' : 'none';
            }
            if (btnLimparInput) {
                btnLimparInput.disabled = !hasAnyChar;
                btnLimparInput.style.opacity = hasAnyChar ? '1' : '0.5';
                btnLimparInput.style.cursor = hasAnyChar ? 'pointer' : 'not-allowed';
            }
            if (btnColarFloating) {
                btnColarFloating.style.display = !hasText ? 'inline-flex' : 'none';
            }

            if (statsEl) {
                if (!hasText) {
                    statsEl.textContent = 'Cole o texto do chat';
                } else {
                    const lines = val.split('\n').filter(l => l.trim().length > 0).length;
                    statsEl.textContent = `${lines} ${lines === 1 ? 'mensagem' : 'mensagens'} • ${val.length} caracteres`;
                }
            }
        }

        function scheduleAutoIdentify(delayMs = 350, options = {}) {
            clearTimeout(identifyTimeout);
            if (!options.preserveManualLock) {
                // Invalida seleção automática anterior imediatamente ao trocar conversa
                if (currentSelectionSource !== 'manual') {
                    currentPsychologistId = null;
                }
            }
            if (delayMs <= 0) {
                handleAutoIdentify(options);
            } else {
                identifyTimeout = setTimeout(() => {
                    handleAutoIdentify(options);
                }, delayMs);
            }
        }

        function htmlToPlainText(html) {
            if (!html) return '';
            const formatted = html
                .replace(/<br\s*[\/]?>/gi, '\n')
                .replace(/<\/p>/gi, '\n\n')
                .replace(/<\/div>/gi, '\n')
                .replace(/<\/tr>/gi, '\n')
                .replace(/<\/li>/gi, '\n');
            if (typeof DOMParser !== 'undefined') {
                try {
                    const doc = new DOMParser().parseFromString(formatted, 'text/html');
                    return (doc.body?.textContent || '').trim();
                } catch (_) { }
            }
            return formatted.replace(/<[^>]*>/g, '').trim();
        }

        async function readAllClipboardContent() {
            let combinedText = '';

            if (navigator.clipboard && typeof navigator.clipboard.read === 'function') {
                try {
                    const clipboardItems = await navigator.clipboard.read();
                    if (clipboardItems && clipboardItems.length > 0) {
                        const parts = [];
                        for (const item of clipboardItems) {
                            if (item.types.includes('text/plain')) {
                                const blob = await item.getType('text/plain');
                                const text = await blob.text();
                                if (text && text.trim()) parts.push(text.trim());
                            } else if (item.types.includes('text/html')) {
                                const blob = await item.getType('text/html');
                                const html = await blob.text();
                                const text = htmlToPlainText(html);
                                if (text && text.trim()) parts.push(text.trim());
                            }
                        }
                        if (parts.length > 0) {
                            combinedText = parts.join('\n\n');
                        }
                    }
                } catch (readErr) {
                    console.log('navigator.clipboard.read não disponível ou requer foco nativo:', readErr.message);
                }
            }

            if (!combinedText && navigator.clipboard && typeof navigator.clipboard.readText === 'function') {
                try {
                    const txt = await navigator.clipboard.readText();
                    if (txt && txt.trim()) combinedText = txt.trim();
                } catch (readTextErr) {
                    console.log('navigator.clipboard.readText restrito:', readTextErr.message);
                }
            }

            if (!combinedText) return '';
            return combinedText.replace(/[\u200e\u200f\u202a-\u202e\ufeff]/g, '');
        }

        async function handlePasteAction(isAppend = false) {
            if (chatInput) chatInput.focus();

            let text = '';
            try {
                text = await readAllClipboardContent();
            } catch (err) {
                console.log('Clipboard API não autorizada via script:', err);
            }

            if (text && text.trim()) {
                if (chatInput) {
                    if (isAppend && chatInput.value.trim().length > 0) {
                        chatInput.value = chatInput.value.trim() + '\n\n' + text;
                    } else {
                        // Substituição completa de conversa: sempre zera vínculo anterior
                        resetIdentityState();
                        chatInput.value = text;
                    }
                    chatInput.scrollTop = 0;
                    updateInputView();
                    scheduleAutoIdentify(0, { preserveManualLock: isAppend });
                }

                const targetBtn = isAppend ? btnColarMais : (btnColar || btnColarFloating);
                if (targetBtn) {
                    const savedNodes = Array.from(targetBtn.childNodes).map(n => n.cloneNode(true));
                    clearEl(targetBtn);
                    const span = document.createElement('span');
                    span.textContent = `✓ ${isAppend ? 'Adicionado!' : 'Colado!'}`;
                    targetBtn.appendChild(span);
                    setTimeout(() => {
                        restoreButtonChildren(targetBtn, savedNodes);
                    }, 1800);
                }

                notify(isAppend ? 'Mensagens adicionadas com sucesso!' : 'Conversa colada com sucesso!', 'success');
                return;
            }

            try {
                if (document.execCommand('paste')) {
                    if (!isAppend) resetIdentityState();
                    scheduleAutoIdentify(50, { preserveManualLock: isAppend });
                    setTimeout(updateInputView, 50);
                    return;
                }
            } catch (_) { }

            if (chatInput) {
                const len = chatInput.value.length;
                chatInput.focus();
                chatInput.setSelectionRange(len, len);
            }

            notify('📋 Toque no campo e selecione "Colar".', 'info');
        }

        if (btnColar) btnColar.addEventListener('click', () => handlePasteAction(false));
        if (btnColarMais) btnColarMais.addEventListener('click', () => handlePasteAction(true));
        if (btnColarFloating) btnColarFloating.addEventListener('click', () => handlePasteAction(false));

        const fileImport = document.getElementById('file-chat-import');
        if (fileImport) {
            fileImport.addEventListener('change', (e) => {
                const file = e.target.files && e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = function (evt) {
                    const content = evt.target.result || '';
                    const clean = content.replace(/[\u200e\u200f\u202a-\u202e\ufeff]/g, '');
                    if (chatInput) {
                        resetIdentityState();
                        chatInput.value = clean;
                        chatInput.scrollTop = 0;
                        updateInputView();
                        scheduleAutoIdentify(0);
                    }
                    fileImport.value = '';
                };
                reader.readAsText(file);
            });
        }

        document.querySelectorAll('.copilot-tab-btn').forEach(btn => {
            btn.addEventListener('click', function () {
                const target = this.getAttribute('data-tab-target');
                if (target) switchMobileTab(target);
            });
        });

        if (btnMiniVerDossie) {
            btnMiniVerDossie.addEventListener('click', () => switchMobileTab('tab-dossie'));
        }

        if (chatInput) {
            chatInput.addEventListener('input', () => {
                updateInputView();
                const val = chatInput.value.trim();
                if (!val || val.length < 10) {
                    clearInputAndIdentity(false);
                    return;
                }
                scheduleAutoIdentify(350);
            });

            chatInput.addEventListener('paste', async (e) => {
                let extracted = '';
                try {
                    if (e.clipboardData) {
                        const plain = e.clipboardData.getData('text/plain') || '';
                        const html = e.clipboardData.getData('text/html') || '';

                        if (html && (html.includes('<br') || html.includes('</div>') || html.includes('</p>'))) {
                            const fromHtml = htmlToPlainText(html);
                            if (fromHtml && (fromHtml.length > plain.length + 10 || (fromHtml.includes('[') && !plain.includes('[')))) {
                                extracted = fromHtml;
                            }
                        }

                        if (!extracted && e.clipboardData.items && e.clipboardData.items.length > 1) {
                            const parts = [];
                            for (let i = 0; i < e.clipboardData.items.length; i++) {
                                const item = e.clipboardData.items[i];
                                if (item.kind === 'string' && item.type === 'text/plain') {
                                    await new Promise(resolve => {
                                        item.getAsString(str => {
                                            if (str && str.trim()) parts.push(str.trim());
                                            resolve();
                                        });
                                    });
                                }
                            }
                            if (parts.length > 1) {
                                extracted = parts.join('\n\n');
                            }
                        }

                        if (extracted && extracted !== plain) {
                            e.preventDefault();
                            const cur = chatInput.value || '';
                            const start = chatInput.selectionStart || 0;
                            const end = chatInput.selectionEnd || 0;
                            const isFullReplace = start === 0 && end === cur.length;
                            if (isFullReplace || !cur.trim()) resetIdentityState();
                            const clean = extracted.replace(/[\u200e\u200f\u202a-\u202e\ufeff]/g, '');
                            chatInput.value = cur.substring(0, start) + clean + cur.substring(end);
                            chatInput.scrollTop = 0;
                            updateInputView();
                            scheduleAutoIdentify(0);
                            return;
                        }
                    }
                } catch (pasteErr) {
                    console.warn('Erro ao processar paste nativo:', pasteErr);
                }

                // Aguarda evento nativo preencher textarea antes de identificar (evita disparo duplo)
                const curLen = (chatInput.value || '').length;
                const selAll = chatInput.selectionStart === 0 && chatInput.selectionEnd === curLen;
                if (selAll || curLen === 0) resetIdentityState();

                clearTimeout(identifyTimeout);
                identifyTimeout = setTimeout(() => {
                    if (chatInput.value) {
                        chatInput.value = chatInput.value.replace(/[\u200e\u200f\u202a-\u202e\ufeff]/g, '');
                    }
                    chatInput.scrollTop = 0;
                    updateInputView();
                    handleAutoIdentify();
                }, 50);
            });
        }

        document.querySelectorAll('.tone-btn').forEach(btn => {
            btn.addEventListener('click', function () {
                document.querySelectorAll('.tone-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                currentTone = this.getAttribute('data-tone') || 'natural';
                currentMode = this.getAttribute('data-mode') || 'resposta';
            });
        });

        const quickSelect = document.getElementById('copilot-quick-question-select');
        if (quickSelect) {
            const QUICK_PROMPTS = {
                'db:pacientes_mes': 'Quantos pacientes em média cada profissional recebe por mês na Yelo? Traga os números reais do banco (buscas, cliques no WhatsApp, contatos, fechamentos e diferenças por faixa de valor).',
                'db:demanda_plataforma': 'Como está a demanda de buscas de pacientes neste mês e nos últimos 30 dias no banco? Quais temas, abordagens e faixas de preço têm mais procura?',
                'hint:diagnostico_funil': 'Analise o funil completo deste profissional no banco (Match, visitas no perfil, cliques e fechamentos) e destaque os pontos fortes e gargalos.',
                'hint:roi_sessao': 'Apresente o cálculo transparente de ROI comparando a assinatura com o valor real da sessão deste profissional e os números médios do banco.',
                'hint:otimizar_perfil': 'Indique os ajustes mais práticos no perfil (bio, avaliações, Google Meu Negócio, artigos e Q&A) com base no que está faltando no cadastro dele.',
                'hint:retencao_dados': 'Responda com empatia genuína, usando os números reais de demanda e fluxo do banco, e finalize com uma pergunta estratégica.'
            };
            quickSelect.addEventListener('change', function () {
                const key = this.value;
                const promptText = QUICK_PROMPTS[key];
                this.value = '';
                if (!promptText) return;

                const instrInput = document.getElementById('copilot-admin-instruction');
                const hasExistingChat = Boolean(chatInput && chatInput.value && chatInput.value.trim().length > 0);
                if (key.startsWith('db:') || !hasExistingChat) {
                    if (chatInput) {
                        resetIdentityState();
                        chatInput.value = promptText;
                        updateInputView();
                        chatInput.focus();
                    }
                } else if (instrInput) {
                    instrInput.value = promptText;
                    instrInput.focus();
                }
                notify('Pergunta preenchida! Clique em "Gerar Resposta" para consultar o banco.', 'info');
            });
        }

        const btnTogglePreview = document.getElementById('btn-toggle-wpp-preview');
        if (btnTogglePreview) {
            btnTogglePreview.addEventListener('click', () => {
                isWppPreviewVisible = !isWppPreviewVisible;
                btnTogglePreview.textContent = isWppPreviewVisible
                    ? '👁️ Ocultar pré-visualização WhatsApp'
                    : '👁️ Ver como fica no WhatsApp';
                renderWhatsAppPreview(getReplyText());
            });
        }

        if (btnGerar) {
            btnGerar.addEventListener('click', () => handleGenerateResponse(false));
        }

        if (btnRegenerar) {
            btnRegenerar.addEventListener('click', () => handleGenerateResponse(true));
        }

        if (btnCopiar) {
            btnCopiar.addEventListener('click', handleCopyResponse);
        }

        if (boxTexto) {
            boxTexto.addEventListener('input', () => {
                const val = getReplyText();
                boxTexto.textContent = val;
                renderWhatsAppPreview(val);
                const countEl = document.getElementById('reply-char-count');
                if (countEl) {
                    countEl.textContent = val ? `${val.length} caracteres • Editado manualmente` : 'Formatação WhatsApp preservada.';
                }
            });
        }

        if (btnAlternativa) {
            btnAlternativa.addEventListener('click', () => {
                const alt = currentStructuredOutput?.alternativeReply;
                if (!alt) return;
                showingAlternativeReply = !showingAlternativeReply;
                setReplyText(showingAlternativeReply ? alt : currentOriginalAiReply);
                btnAlternativa.textContent = showingAlternativeReply ? 'Voltar para principal' : 'Ver alternativa';
            });
        }

        if (btnRejeitar) {
            btnRejeitar.addEventListener('click', handleRejectResponse);
        }

        if (btnAbrirWpp) {
            btnAbrirWpp.addEventListener('click', () => {
                if (!currentDossierPhone) return;
                if (currentStructuredOutput?.status === 'identity_review') {
                    notify('Confirme o destinatário antes de abrir o WhatsApp.', 'error');
                    return;
                }
                const digits = String(currentDossierPhone).replace(/\D/g, '');
                if (digits.length < 8) {
                    notify('Telefone inválido para abrir no WhatsApp.', 'error');
                    return;
                }
                const fullPhone = digits.startsWith('55') ? digits : `55${digits}`;
                const msg = encodeURIComponent(getReplyText());
                window.open(`https://wa.me/${fullPhone}?text=${msg}`, '_blank', 'noopener,noreferrer');
            });
        }

        if (btnCsDrawer) {
            btnCsDrawer.addEventListener('click', () => {
                if (currentPsychologistId && typeof window.openCSDrawer === 'function') {
                    window.openCSDrawer(currentPsychologistId);
                } else {
                    notify('Selecione um psicólogo cadastrado para abrir o CS 360º.', 'info');
                }
            });
        }

        if (btnDiagnostico) {
            btnDiagnostico.addEventListener('click', handleOnDemandDiagnosis);
        }

        if (btnBacklog) {
            btnBacklog.addEventListener('click', handleCreateBacklogDraft);
        }

        if (btnInsights) {
            btnInsights.addEventListener('click', handleToggleCollectiveInsights);
        }

        if (!window.__copilotKeyShortcutBound) {
            window.__copilotKeyShortcutBound = true;
            document.addEventListener('keydown', (e) => {
                if ((e.metaKey || e.ctrlKey) && e.shiftKey && String(e.key).toLowerCase() === 'c') {
                    const card = document.getElementById('card-resposta-gerada');
                    if (card && card.style.display !== 'none') {
                        e.preventDefault();
                        handleCopyResponse();
                    }
                }
            });
        }

        if (btnLimpar) {
            btnLimpar.addEventListener('click', handleClearAll);
        }

        if (btnLimparInput) {
            btnLimparInput.addEventListener('click', () => {
                clearInputAndIdentity(true);
                updateInputView();
                if (chatInput) chatInput.focus();
            });
        }

        if (btnTrocar) {
            btnTrocar.addEventListener('click', () => {
                const searchBox = document.getElementById('manual-search-box');
                if (searchBox) {
                    searchBox.style.display = searchBox.style.display === 'none' ? 'block' : 'none';
                    if (searchBox.style.display === 'block') document.getElementById('manual-psi-query')?.focus();
                }
            });
        }

        if (btnManualSearch && manualQuery) {
            btnManualSearch.addEventListener('click', handleManualSearch);
            manualQuery.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') handleManualSearch();
            });
        }
    }

    function switchMobileTab(targetId) {
        document.querySelectorAll('.copilot-tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-tab-target') === targetId);
        });

        const viewChat = document.getElementById('view-tab-chat');
        const viewDossie = document.getElementById('card-dossie');
        const viewHistorico = document.getElementById('view-tab-historico');

        if (viewChat) viewChat.classList.toggle('active-tab', targetId === 'tab-chat');
        if (viewDossie) viewDossie.classList.toggle('active-tab', targetId === 'tab-dossie');
        if (viewHistorico) viewHistorico.classList.toggle('active-tab', targetId === 'tab-historico');

        if (typeof window.scrollTo === 'function') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

    async function handleAutoIdentify(options = {}) {
        const text = document.getElementById('copilot-input-chat')?.value.trim();
        if (!text || text.length < 10) return;

        // Se o usuário já confirmou manualmente para esta conversa e explicitamente pediu preservação (Append), respeita
        if (options.preserveManualLock && currentSelectionSource === 'manual' && currentPsychologistId) {
            return;
        }

        const mySeq = ++identifyRequestSeq;
        if (identifyController) {
            identifyController.abort();
        }
        identifyController = typeof AbortController !== 'undefined' ? new AbortController() : null;

        const bannerTexto = document.getElementById('identificacao-texto');
        const bannerSubtexto = document.getElementById('identificacao-subtexto');
        const bannerIcone = document.getElementById('identificacao-icone');
        const btnTrocar = document.getElementById('btn-trocar-psi-manual');

        if (bannerIcone) bannerIcone.textContent = '⏳';
        if (bannerTexto) bannerTexto.textContent = 'Buscando profissional no banco do Render...';

        try {
            const fetchOpts = {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ pastedChat: text })
            };
            if (identifyController) fetchOpts.signal = identifyController.signal;

            const res = await fetch('/api/admin/copilot/identify', fetchOpts);
            if (mySeq !== identifyRequestSeq) return;

            if (!res.ok) throw new Error('Falha na identificação');
            const data = await res.json();
            if (mySeq !== identifyRequestSeq) return;

            if (data.ambiguous && Array.isArray(data.candidates) && data.candidates.length > 0) {
                resetIdentityState();
                if (bannerIcone) bannerIcone.textContent = '⚠️';
                setBannerRichText(
                    bannerTexto,
                    'Mais de um perfil compatível para ',
                    data.cleanName || 'esta conversa',
                    '. Selecione abaixo:'
                );
                if (bannerSubtexto) bannerSubtexto.textContent = 'Por segurança, nenhum dossiê foi carregado automaticamente.';
                if (btnTrocar) btnTrocar.style.display = 'inline-block';
                renderCandidatesBox(data.candidates);
                return;
            }

            if (data.dossier && data.dossier.profile) {
                const eType = data.dossier.entityType || data.entityType || 'psychologist';
                currentEntityType = eType;
                currentEntityId = data.dossier.profile.id || data.entityId || null;
                currentPsychologistId = eType === 'psychologist' ? data.dossier.profile.id : null;
                currentSelectionSource = 'auto';
                const candBox = document.getElementById('copilot-candidates-box');
                if (candBox) candBox.style.display = 'none';
                renderDossier(data.dossier);

                if (bannerIcone) bannerIcone.textContent = eType === 'psychologist' ? '🟢' : '🟡';
                const idLabel = eType === 'psychologist'
                    ? ` (ID ${data.dossier.profile.id})`
                    : (eType === 'lead' ? ' (Lead)' : eType === 'waiting_list' ? ' (Lista de Espera)' : ' (Não Cadastrado)');
                setBannerRichText(bannerTexto, 'Identificado: ', data.dossier.profile.nome, idLabel);
                const valStr = formatValorSessao(
                    data.dossier.profile.valor_sessao_numero,
                    data.dossier.profile.valor_mensal_numero,
                    data.dossier.profile.tipo_cobranca
                );
                const badge = data.dossier.subscriptionSummary?.badgeLabel || data.dossier.profile.plano || 'Essencial';
                if (bannerSubtexto) {
                    bannerSubtexto.textContent = eType === 'psychologist'
                        ? `${badge} • Sessão: ${valStr} • ${data.dossier.profile.whatsapp_clicks || 0} cliques Wpp`
                        : `${badge}${data.dossier.memory?.rollingSummary ? ' • Memória prévia ativa' : ' • Pré-cadastro sem assinatura'}`;
                }
                if (btnTrocar) btnTrocar.style.display = 'inline-block';
            } else if (data.cleanName) {
                resetIdentityState();
                if (bannerIcone) bannerIcone.textContent = '⚠️';
                setBannerRichText(bannerTexto, 'Detectado nome ', `"${data.cleanName}"`, ', mas não consta na base.');
                if (bannerSubtexto) bannerSubtexto.textContent = 'A IA responderá considerando o contexto geral da Yelo ou busque em "Alterar".';
                if (btnTrocar) btnTrocar.style.display = 'inline-block';
            } else {
                resetIdentityState();
                if (bannerIcone) bannerIcone.textContent = 'ℹ️';
                if (bannerTexto) bannerTexto.textContent = 'Nenhum nome de psicólogo detectado no cabeçalho.';
                if (bannerSubtexto) bannerSubtexto.textContent = 'Você pode buscar manualmente pelo botão "Alterar" se desejar.';
                if (btnTrocar) btnTrocar.style.display = 'inline-block';
            }
        } catch (err) {
            if (err && err.name === 'AbortError') return;
            if (mySeq !== identifyRequestSeq) return;
            console.error('Erro na auto-identificação:', err);
            if (bannerIcone) bannerIcone.textContent = '⚠️';
            if (bannerTexto) bannerTexto.textContent = 'Não foi possível consultar o profissional agora.';
            if (bannerSubtexto) bannerSubtexto.textContent = 'Seu texto foi preservado. Tente novamente ou use "Alterar".';
            if (btnTrocar) btnTrocar.style.display = 'inline-block';
        }
    }

    async function handleGenerateResponse(isRegenerate = false) {
        if (isGenerating) return;
        const text = document.getElementById('copilot-input-chat')?.value.trim();
        if (!text) {
            notify('Por favor, cole a conversa do WhatsApp primeiro.', 'error');
            return;
        }

        const btnGerar = document.getElementById('btn-gerar-resposta');
        const btnRegenerar = document.getElementById('btn-regenerar-variacao');
        const cardResposta = document.getElementById('card-resposta-gerada');
        const boxTexto = document.getElementById('box-resposta-texto');

        const myGenSeq = ++generateRequestSeq;
        if (generateController) generateController.abort();
        generateController = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const expectedPsiId = currentPsychologistId;

        isGenerating = true;
        const savedBtnNodes = btnGerar ? Array.from(btnGerar.childNodes).map(n => n.cloneNode(true)) : [];
        if (btnGerar) {
            btnGerar.disabled = true;
            clearEl(btnGerar);
            const span = document.createElement('span');
            span.textContent = '⏳ Consultando Dossiê e IA...';
            btnGerar.appendChild(span);
        }
        if (btnRegenerar) btnRegenerar.disabled = true;

        try {
            const modeVal = document.getElementById('copilot-mode-select')?.value || currentMode || 'resposta';
            const extVal = document.getElementById('copilot-extension-select')?.value || 'padrao';
            const instrVal = document.getElementById('copilot-admin-instruction')?.value?.trim() || '';

            const fetchOpts = {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    pastedChat: text,
                    manualPsiId: currentPsychologistId,
                    entityType: currentEntityType,
                    entityId: currentEntityId,
                    threadId: currentThreadId,
                    selectionSource: currentSelectionSource,
                    tone: currentTone,
                    mode: modeVal,
                    extension: extVal,
                    adminInstruction: instrVal,
                    regenerate: Boolean(isRegenerate)
                })
            };
            if (generateController) fetchOpts.signal = generateController.signal;

            const res = await fetch('/api/admin/copilot/respond', fetchOpts);
            if (myGenSeq !== generateRequestSeq) return;

            const data = await res.json().catch(() => ({}));
            if (myGenSeq !== generateRequestSeq) return;

            if (res.status === 409 && Array.isArray(data.candidates)) {
                resetIdentityState();
                const btnTrocar = document.getElementById('btn-trocar-psi-manual');
                if (btnTrocar) btnTrocar.style.display = 'inline-block';
                renderCandidatesBox(data.candidates, data.error || 'Confirme o profissional antes de gerar:');
                notify(data.error || 'Confirme o profissional antes de gerar a resposta.', 'info');
                return;
            }

            if (!res.ok) {
                throw new Error(data.error || 'Erro ao gerar resposta');
            }

            // Garante que uma troca manual durante o voo não receba resposta do profissional antigo
            const returnedPsiId = data.detectedPsychologist?.profile?.id || null;
            if (expectedPsiId !== currentPsychologistId && currentPsychologistId && returnedPsiId !== currentPsychologistId) {
                return;
            }

            if (data.threadId) {
                currentThreadId = data.threadId;
            }
            if (data.conversationId) {
                currentConversationId = data.conversationId;
            }

            renderGeneratedPayload({
                aiResponse: data.aiResponse,
                structuredOutput: data.structuredOutput,
                conversationId: data.conversationId
            });

            if (data.detectedPsychologist && data.detectedPsychologist.profile) {
                const retType = data.detectedPsychologist.entityType || data.entityType || 'psychologist';
                currentEntityType = retType;
                currentEntityId = data.detectedPsychologist.profile.id || data.entityId || null;
                if (retType === 'psychologist') {
                    currentPsychologistId = data.detectedPsychologist.profile.id;
                }
                renderDossier(data.detectedPsychologist);
            }

            if (data.persistenceWarning) {
                notify('Resposta gerada, mas não foi possível gravar no histórico agora.', 'info');
            } else {
                loadHistory();
            }
        } catch (err) {
            if (err && err.name === 'AbortError') return;
            if (myGenSeq !== generateRequestSeq) return;
            notify('Erro ao gerar resposta: ' + err.message, 'error');
        } finally {
            if (myGenSeq === generateRequestSeq) {
                isGenerating = false;
                generateController = null;
                if (btnGerar) {
                    btnGerar.disabled = false;
                    restoreButtonChildren(btnGerar, savedBtnNodes);
                }
                if (btnRegenerar) btnRegenerar.disabled = false;
            }
        }
    }

    function renderDossier(dossier) {
        if (!dossier || !dossier.profile) return;
        const p = dossier.profile;
        const s = dossier.stats || {};
        const posts = dossier.posts || {};

        const emptyState = document.getElementById('dossie-empty-state');
        const content = document.getElementById('dossie-content');
        const statusPill = document.getElementById('dossie-status-pill');

        if (emptyState) emptyState.style.display = 'none';
        if (content) content.style.display = 'block';

        const nomeEl = document.getElementById('dossie-nome');
        const crpEl = document.getElementById('dossie-crp-local');
        const fotoEl = document.getElementById('dossie-foto');
        const linkPerfil = document.getElementById('dossie-link-perfil');

        const eType = dossier.entityType || 'psychologist';
        if (nomeEl) nomeEl.textContent = p.nome;
        if (crpEl) {
            crpEl.textContent = eType === 'psychologist'
                ? `CRP: ${p.crp || 'Ativo'} • ${p.cidade || 'Online'}${p.estado ? ' - ' + p.estado : ''}`
                : `${badge.text}${p.crp ? ' • CRP: ' + p.crp : ''}`;
        }
        if (fotoEl && p.fotoUrl) fotoEl.src = p.fotoUrl;
        if (linkPerfil) {
            linkPerfil.href = p.slug ? `https://www.yelopsi.com.br/${p.slug}` : '#';
            linkPerfil.style.display = eType === 'psychologist' ? '' : 'none';
        }

        const badge = getStatusBadge(dossier);
        if (statusPill) {
            statusPill.style.display = 'inline-block';
            statusPill.style.background = badge.bg;
            statusPill.style.color = badge.color;
            statusPill.textContent = badge.text;
        }

        const aparicoesEl = document.getElementById('dossie-aparicoes');
        const cliquesEl = document.getElementById('dossie-cliques');
        const fechamentosEl = document.getElementById('dossie-fechamentos');
        if (aparicoesEl) aparicoesEl.textContent = dossier.funnel?.total?.matches ?? (p.profile_appearances || 0);
        if (cliquesEl) cliquesEl.textContent = dossier.funnel?.total?.whatsappClicks ?? (p.whatsapp_clicks || s.total_clicks || 0);
        if (fechamentosEl) fechamentosEl.textContent = dossier.funnel?.total?.dealsClosed ?? (s.deals_closed || 0);

        const valStr = eType === 'psychologist'
            ? formatValorSessao(p.valor_sessao_numero, p.valor_mensal_numero, p.tipo_cobranca)
            : (p.valor_sessao_faixa || 'Pré-cadastro');
        const valorEl = document.getElementById('dossie-valor');
        if (valorEl) {
            valorEl.textContent = valStr;
            valorEl.style.fontSize = valStr === 'A combinar' ? '0.95rem' : '1.15rem';
        }

        const valData = dossier.planExpiresAtFormatted || dossier.subscriptionSummary?.expireText || formatDateBRT(p.planExpiresAt);
        const planoValEl = document.getElementById('dossie-plano-validade');
        if (planoValEl) {
            planoValEl.textContent = `${dossier.subscriptionSummary?.planText || p.plano || 'Essencial'} (${valData})`;
        }

        const abordagens = Array.isArray(p.abordagens_tecnicas) ? p.abordagens_tecnicas.join(', ') : (p.abordagens_tecnicas || 'Clínica Geral');
        const abordEl = document.getElementById('dossie-abordagem');
        if (abordEl) abordEl.textContent = abordagens;

        const artigosStr = posts.total > 0 ? `${posts.total} publicados (${posts.top?.[0]?.curtidas || 0} curtidas no top)` : 'Nenhum artigo publicado';
        const artigosEl = document.getElementById('dossie-artigos-info');
        if (artigosEl) artigosEl.textContent = artigosStr;

        const bioBox = document.getElementById('dossie-bio-box');
        if (bioBox) {
            if (dossier.memory?.rollingSummary) {
                bioBox.textContent = `Memória Copilot: ${dossier.memory.rollingSummary}`;
            } else {
                bioBox.textContent = p.bio ? `"${String(p.bio).replace(/<[^>]*>?/gm, '').substring(0, 180)}..."` : 'Sem bio cadastrada.';
            }
        }

        const miniBanner = document.getElementById('mini-profile-banner');
        const miniNome = document.getElementById('mini-dossie-nome');
        const miniChips = document.getElementById('mini-dossie-chips');
        const miniFoto = document.getElementById('mini-dossie-foto');
        const mobileDossierPill = document.getElementById('mobile-dossier-pill');

        if (miniBanner) miniBanner.classList.add('visible');
        if (miniNome) miniNome.textContent = p.nome;
        if (miniFoto && p.fotoUrl) miniFoto.src = p.fotoUrl;
        if (miniChips) {
            miniChips.textContent = `${badge.text} • ${p.whatsapp_clicks || s.total_clicks || 0} cliques • ${valStr}`;
        }
        if (mobileDossierPill) mobileDossierPill.style.display = 'inline-block';

        currentDossierPhone = p.telefone || null;
        const btnAbrirWpp = document.getElementById('btn-abrir-whatsapp');
        if (btnAbrirWpp) btnAbrirWpp.style.display = currentDossierPhone ? 'inline-flex' : 'none';
        const isRegisteredPsi = (dossier.entityType || 'psychologist') === 'psychologist';
        const btnCsDrawer = document.getElementById('btn-abrir-cs-drawer');
        const btnDiagnostico = document.getElementById('btn-diagnostico-cs');
        if (btnCsDrawer) btnCsDrawer.style.display = isRegisteredPsi ? '' : 'none';
        if (btnDiagnostico) btnDiagnostico.style.display = isRegisteredPsi ? '' : 'none';
    }

    async function handleManualSearch() {
        const query = document.getElementById('manual-psi-query')?.value.trim();
        if (!query) return;

        const resultsContainer = document.getElementById('manual-search-results');
        if (!resultsContainer) return;

        clearEl(resultsContainer);
        const loadingMsg = document.createElement('div');
        loadingMsg.style.fontSize = '0.8rem';
        loadingMsg.style.color = '#64748b';
        loadingMsg.style.padding = '8px';
        loadingMsg.textContent = 'Buscando...';
        resultsContainer.appendChild(loadingMsg);

        try {
            const res = await fetch(`/api/admin/copilot/search-psychologists?q=${encodeURIComponent(query)}`, {
                headers: getAuthHeaders()
            });
            const data = await res.json();
            const list = data.psychologists || [];

            clearEl(resultsContainer);
            if (list.length === 0) {
                const emptyMsg = document.createElement('div');
                emptyMsg.style.fontSize = '0.8rem';
                emptyMsg.style.color = '#ef4444';
                emptyMsg.style.padding = '8px';
                emptyMsg.textContent = 'Nenhum psicólogo ativo encontrado com esse termo.';
                resultsContainer.appendChild(emptyMsg);
                return;
            }

            list.forEach((psi) => {
                const row = document.createElement('div');
                row.className = 'manual-result-item';
                row.style.cssText = 'padding: 8px 10px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; font-size: 0.85rem; border-bottom: 1px solid #f1f5f9; transition: background 0.15s;';

                const left = document.createElement('div');
                const titleLine = document.createElement('div');
                const strongName = document.createElement('strong');
                strongName.textContent = psi.nome || '';
                titleLine.appendChild(strongName);
                titleLine.appendChild(document.createTextNode(` (ID ${psi.id})`));

                const subLine = document.createElement('div');
                subLine.style.fontSize = '0.75rem';
                subLine.style.color = '#64748b';
                subLine.textContent = `${psi.email || ''} • ${psi.statusLabel || psi.plano || 'Essencial'}`;

                left.appendChild(titleLine);
                left.appendChild(subLine);

                const btnSel = document.createElement('button');
                btnSel.type = 'button';
                btnSel.style.cssText = 'background: #1B4332; color: #FFEE8C; border: none; padding: 4px 10px; border-radius: 4px; font-size: 0.75rem; font-weight: 700; cursor: pointer;';
                btnSel.textContent = 'Selecionar';

                row.appendChild(left);
                row.appendChild(btnSel);
                row.addEventListener('click', () => selectConfirmedPsychologist(psi.id));
                resultsContainer.appendChild(row);
            });
        } catch (err) {
            clearEl(resultsContainer);
            const errMsg = document.createElement('div');
            errMsg.style.fontSize = '0.8rem';
            errMsg.style.color = '#ef4444';
            errMsg.style.padding = '8px';
            errMsg.textContent = 'Erro na busca.';
            resultsContainer.appendChild(errMsg);
        }
    }

    function renderGeneratedPayload({ aiResponse, structuredOutput, conversationId }) {
        const s = structuredOutput || null;
        currentStructuredOutput = s;
        if (conversationId) currentConversationId = conversationId;
        showingAlternativeReply = false;

        const replyText = (s && s.whatsappReply !== undefined && s.whatsappReply !== null) ? s.whatsappReply : (aiResponse || '');
        currentOriginalAiReply = replyText;
        setReplyText(replyText);

        const cardResposta = document.getElementById('card-resposta-gerada');
        if (cardResposta) {
            cardResposta.style.display = 'block';
            if (typeof cardResposta.scrollIntoView === 'function') {
                cardResposta.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }

        const statusPill = document.getElementById('reply-status-pill');
        if (statusPill) {
            const st = s?.status || 'ready';
            if (st === 'requires_review') {
                statusPill.textContent = '⚠️ Requer Revisão';
                statusPill.style.background = '#f59e0b';
            } else if (st === 'needs_information') {
                statusPill.textContent = 'ℹ️ Precisa de Dados';
                statusPill.style.background = '#3b82f6';
            } else if (st === 'identity_review') {
                statusPill.textContent = '🔎 Confirmar Destinatário';
                statusPill.style.background = '#ef4444';
            } else {
                statusPill.textContent = 'Pronta para Envio';
                statusPill.style.background = '#25d366';
            }
        }

        const catPill = document.getElementById('reply-category-pill');
        if (catPill) {
            if (s?.interactionCategory && s.interactionCategory !== 'outros') {
                catPill.style.display = 'inline-block';
                catPill.textContent = s.interactionCategory.replace(/_/g, ' ');
            } else {
                catPill.style.display = 'none';
            }
        }

        const btnAlt = document.getElementById('btn-usar-alternativa');
        if (btnAlt) {
            btnAlt.style.display = s?.alternativeReply ? 'inline-block' : 'none';
            btnAlt.textContent = 'Ver alternativa';
        }

        const btnRej = document.getElementById('btn-rejeitar-resposta');
        if (btnRej) btnRej.style.display = currentConversationId ? 'inline-block' : 'none';

        const btnWpp = document.getElementById('btn-abrir-whatsapp');
        if (btnWpp) {
            btnWpp.style.display = (currentDossierPhone && s?.status !== 'identity_review') ? 'inline-flex' : 'none';
        }

        // Briefing Estratégico estritamente condicional (evita poluição visual)
        const briefingCard = document.getElementById('card-briefing-estrategico');
        const briefingList = document.getElementById('briefing-content-list');
        if (briefingCard && briefingList) {
            clearEl(briefingList);
            const items = [];
            if (s?.churnRisk?.level && s.churnRisk.level !== 'low') {
                items.push({ label: `Risco (${s.churnRisk.level.toUpperCase()}):`, text: s.churnRisk.reason });
            }
            (s?.strategicAlerts || []).forEach(a => items.push({ label: 'Alerta:', text: a }));
            if (s?.nextBestAction) items.push({ label: 'Próxima ação:', text: s.nextBestAction });
            (s?.evidences || []).slice(0, 2).forEach(e => items.push({ label: 'Evidência:', text: e }));
            (s?.missingInformation || []).forEach(m => items.push({ label: 'Falta dado:', text: m }));

            if (items.length > 0) {
                items.forEach(it => {
                    const line = document.createElement('div');
                    const strong = document.createElement('strong');
                    strong.textContent = it.label + ' ';
                    line.appendChild(strong);
                    line.appendChild(document.createTextNode(it.text));
                    briefingList.appendChild(line);
                });
                briefingCard.style.display = 'block';
            } else {
                briefingCard.style.display = 'none';
            }
        }
    }

    async function sendFeedbackStatus(feedbackStatus, extra = {}) {
        if (!currentConversationId) return;
        try {
            await fetch('/api/admin/copilot/feedback', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    conversationId: currentConversationId,
                    feedbackStatus,
                    ...extra
                })
            });
        } catch (_) {}
    }

    async function handleRejectResponse() {
        if (!currentConversationId) return;
        const reason = currentStructuredOutput?.strategicAlerts?.[0]
            ? 'Alerta estratégico / revisão necessária'
            : 'Ajuste de estilo / contexto';
        await sendFeedbackStatus('rejected', { rejectionReason: reason });
        notify('Feedback de rejeição registrado para melhoria do prompt.', 'info');
    }

    async function handleOnDemandDiagnosis() {
        if (!currentPsychologistId) {
            notify('Identifique um psicólogo cadastrado antes de gerar diagnóstico.', 'info');
            return;
        }
        const diagBox = document.getElementById('dossie-diagnostico-box');
        if (!diagBox) return;
        diagBox.style.display = 'block';
        diagBox.textContent = '⏳ Analisando funil 7d/30d e histórico...';

        try {
            const res = await fetch('/api/admin/copilot/diagnose', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ psychologistId: currentPsychologistId })
            });
            const data = await res.json();
            if (!res.ok || !data.diagnosis) throw new Error(data.error || 'Falha no diagnóstico');
            const d = data.diagnosis;

            clearEl(diagBox);
            const header = document.createElement('div');
            header.style.fontWeight = '700';
            header.textContent = `Risco: ${d.riskLevel.toUpperCase()} • Match 7d: ${d.psychologist7d.matches} (média plat.: ${d.benchmark7d.avgMatches7d}) • Cliques 7d: ${d.psychologist7d.whatsappClicks}`;
            diagBox.appendChild(header);

            [...(d.issues || []), ...(d.signals || [])].slice(0, 4).forEach(msg => {
                const row = document.createElement('div');
                row.style.marginTop = '4px';
                row.textContent = `• ${msg}`;
                diagBox.appendChild(row);
            });

            if (d.previousRecommendations && d.previousRecommendations.length > 0) {
                const recEl = document.createElement('div');
                recEl.style.marginTop = '6px';
                recEl.style.fontWeight = '600';
                recEl.textContent = d.profileUpdatedAfterRecommendation
                    ? '✅ Perfil foi atualizado após última recomendação.'
                    : '⏳ Perfil ainda não alterado desde última recomendação.';
                diagBox.appendChild(recEl);
            }
        } catch (err) {
            diagBox.textContent = 'Erro ao gerar diagnóstico: ' + err.message;
        }
    }

    async function handleCreateBacklogDraft() {
        const chatVal = document.getElementById('copilot-input-chat')?.value?.trim() || '';
        const suggested = currentStructuredOutput?.nextBestAction || chatVal.slice(0, 120);
        if (!suggested) {
            notify('Gere uma análise ou cole um relato antes de registrar no Backlog.', 'info');
            return;
        }
        const btn = document.getElementById('btn-criar-backlog');
        if (btn) btn.disabled = true;
        try {
            const res = await fetch('/api/admin/copilot/backlog-draft', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    title: `[Copilot] ${suggested}`.slice(0, 200),
                    category: currentStructuredOutput?.interactionCategory === 'reclamacao_bugs' ? 'Bug' : 'Melhoria',
                    notes: chatVal.slice(0, 800),
                    psychologistId: currentPsychologistId
                })
            });
            if (!res.ok) throw new Error('Falha ao salvar no Backlog');
            notify('Sugestão/bug registrado como rascunho no Backlog Admin!', 'success');
        } catch (err) {
            notify('Não foi possível criar item no Backlog: ' + err.message, 'error');
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    async function handleToggleCollectiveInsights() {
        const box = document.getElementById('copilot-insights-box');
        if (!box) return;
        if (box.style.display === 'block') {
            box.style.display = 'none';
            return;
        }
        box.style.display = 'block';
        box.textContent = '⏳ Carregando métricas agregadas...';
        try {
            const res = await fetch('/api/admin/copilot/collective-insights', { headers: getAuthHeaders() });
            const data = await res.json();
            if (!res.ok || !data.insights) throw new Error('Erro');
            const ins = data.insights;
            clearEl(box);

            const title = document.createElement('div');
            title.style.fontWeight = '700';
            title.textContent = `Amostra: ${ins.sampleSize} atendimentos • Taxa aprovação: ${ins.approvalRate !== null ? ins.approvalRate + '%' : 'N/A'}`;
            box.appendChild(title);

            if (ins.topCategories && ins.topCategories.length > 0) {
                const cats = document.createElement('div');
                cats.style.marginTop = '4px';
                cats.textContent = 'Temas top: ' + ins.topCategories.slice(0, 3).map(c => `${c.category} (${c.count})`).join(', ');
                box.appendChild(cats);
            }
            if (ins.topExitSurveyReasons && ins.topExitSurveyReasons.length > 0) {
                const exits = document.createElement('div');
                exits.style.marginTop = '4px';
                exits.textContent = 'ExitSurveys: ' + ins.topExitSurveyReasons.slice(0, 2).map(e => `${e.motivo} (${e.count})`).join(', ');
                box.appendChild(exits);
            }
        } catch (err) {
            box.textContent = 'Não foi possível carregar insights coletivos agora.';
        }
    }

    async function handleCopyResponse() {
        if (currentStructuredOutput?.status === 'identity_review') {
            notify('Confirme o destinatário correto antes de copiar a resposta.', 'error');
            return;
        }
        const rawText = getReplyText();
        const text = normalizeWhatsAppCopyText(rawText);
        if (!text) return;

        let copiedOk = false;
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            try {
                await navigator.clipboard.writeText(text);
                copiedOk = true;
            } catch (_) {
                copiedOk = false;
            }
        }

        if (!copiedOk && typeof document !== 'undefined') {
            try {
                const tmp = document.createElement('textarea');
                tmp.value = text;
                tmp.setAttribute('readonly', '');
                tmp.style.position = 'fixed';
                tmp.style.top = '-9999px';
                tmp.style.left = '-9999px';
                document.body.appendChild(tmp);
                tmp.select();
                tmp.setSelectionRange(0, text.length);
                copiedOk = Boolean(document.execCommand && document.execCommand('copy'));
                document.body.removeChild(tmp);
            } catch (_) {
                copiedOk = false;
            }
        }

        if (copiedOk) {
            const btnCopiar = document.getElementById('btn-copiar-resposta');
            const textCopiar = document.getElementById('text-copiar-btn');

            if (btnCopiar) btnCopiar.style.background = '#15803d';
            if (textCopiar) textCopiar.textContent = '✅ Copiado com Formatação WPP!';

            const wasEdited = Boolean(currentOriginalAiReply && text.trim() !== currentOriginalAiReply.trim());
            sendFeedbackStatus(wasEdited ? 'edited' : 'approved', {
                finalReply: text,
                isLibraryExample: true
            });

            notify('Mensagem copiada mantendo quebras de linha, negrito e listas do WhatsApp!', 'success');

            setTimeout(() => {
                if (btnCopiar) btnCopiar.style.background = '#25d366';
                if (textCopiar) textCopiar.textContent = 'Copiar e Aprovar (⌘⇧C)';
            }, 2500);
        } else {
            notify('Não foi possível copiar automaticamente. Selecione o texto e copie manualmente.', 'error');
        }
    }

    function clearInputAndIdentity(clearTextarea = true) {
        clearTimeout(identifyTimeout);
        if (identifyController) identifyController.abort();
        identifyRequestSeq++;

        if (clearTextarea) {
            const chatInput = document.getElementById('copilot-input-chat');
            if (chatInput) {
                chatInput.value = '';
                chatInput.style.height = '140px';
            }
            const statsEl = document.getElementById('chat-input-stats');
            if (statsEl) statsEl.textContent = 'Cole o texto do chat';

            const btnColarMais = document.getElementById('btn-colar-mais');
            const btnLimparInput = document.getElementById('btn-limpar-input');
            const btnColarFloating = document.getElementById('btn-colar-floating');
            if (btnColarMais) btnColarMais.style.display = 'none';
            if (btnLimparInput) {
                btnLimparInput.disabled = true;
                btnLimparInput.style.opacity = '0.5';
                btnLimparInput.style.cursor = 'not-allowed';
            }
            if (btnColarFloating) btnColarFloating.style.display = 'inline-flex';
        }

        resetIdentityState();

        const bannerTexto = document.getElementById('identificacao-texto');
        const bannerSubtexto = document.getElementById('identificacao-subtexto');
        const bannerIcone = document.getElementById('identificacao-icone');
        const btnTrocar = document.getElementById('btn-trocar-psi-manual');

        if (bannerIcone) bannerIcone.textContent = '🔍';
        if (bannerTexto) bannerTexto.textContent = 'Cole a conversa para identificar o psicólogo';
        if (bannerSubtexto) bannerSubtexto.textContent = 'Detecta o cabeçalho e busca no Render em tempo real';
        if (btnTrocar) btnTrocar.style.display = 'none';
    }

    function handleClearAll() {
        abortOngoingGeneration();
        clearInputAndIdentity(true);

        const cardResposta = document.getElementById('card-resposta-gerada');
        if (cardResposta) cardResposta.style.display = 'none';

        switchMobileTab('tab-chat');
    }

    async function loadHistory() {
        const listEl = document.getElementById('copilot-history-list');
        const countEl = document.getElementById('history-count');
        const mobileBadge = document.getElementById('mobile-history-badge');
        if (!listEl) return;

        try {
            const res = await fetch('/api/admin/copilot/history', {
                headers: getAuthHeaders()
            });
            if (!res.ok) throw new Error('Erro');
            const data = await res.json();
            const items = data.conversations || [];

            if (countEl) countEl.textContent = `${items.length} registros`;
            if (mobileBadge) mobileBadge.textContent = items.length;

            clearEl(listEl);
            if (items.length === 0) {
                const empty = document.createElement('div');
                empty.style.cssText = 'text-align: center; color: #94a3b8; font-size: 0.8rem; padding: 20px;';
                empty.textContent = 'Nenhum atendimento salvo ainda.';
                listEl.appendChild(empty);
                return;
            }

            items.forEach((c) => {
                const dateStr = new Date(c.createdAt).toLocaleDateString('pt-BR', {
                    timeZone: 'America/Sao_Paulo',
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                });

                const card = document.createElement('div');
                card.style.cssText = 'background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 12px; cursor: pointer; transition: all 0.15s;';

                const topRow = document.createElement('div');
                topRow.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;';

                const nameStrong = document.createElement('strong');
                nameStrong.style.cssText = 'font-size: 0.84rem; color: #0f172a;';
                nameStrong.textContent = c.psi_nome || c.detectedName || 'Atendimento';

                const dateSpan = document.createElement('span');
                dateSpan.style.cssText = 'font-size: 0.7rem; color: #94a3b8;';
                dateSpan.textContent = dateStr;

                topRow.appendChild(nameStrong);
                topRow.appendChild(dateSpan);

                const snippetDiv = document.createElement('div');
                snippetDiv.style.cssText = 'font-size: 0.76rem; color: #64748b; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;';
                const rawResp = c.aiResponse || '';
                snippetDiv.textContent = rawResp.length > 140 ? rawResp.substring(0, 140) + '...' : rawResp;

                card.appendChild(topRow);
                card.appendChild(snippetDiv);

                card.addEventListener('click', async () => {
                    try {
                        const detRes = await fetch(`/api/admin/copilot/conversations/${c.id}`, {
                            headers: getAuthHeaders()
                        });
                        if (detRes.ok) {
                            const detData = await detRes.json();
                            const conv = detData.conversation;
                            if (conv) {
                                const chatEl = document.getElementById('copilot-input-chat');
                                if (chatEl && conv.rawPastedChat) {
                                    chatEl.value = conv.rawPastedChat;
                                    chatEl.style.height = Math.min(Math.max(chatEl.scrollHeight || 140, 140), 380) + 'px';
                                    const btnLimparIn = document.getElementById('btn-limpar-input');
                                    const btnFloat = document.getElementById('btn-colar-floating');
                                    if (btnLimparIn) {
                                        btnLimparIn.disabled = false;
                                        btnLimparIn.style.opacity = '1';
                                        btnLimparIn.style.cursor = 'pointer';
                                    }
                                    if (btnFloat) btnFloat.style.display = 'none';
                                }
                                if (conv.threadId) currentThreadId = conv.threadId;
                                currentConversationId = conv.id;
                                if (detData.dossier?.profile) {
                                    currentEntityType = detData.dossier.entityType || 'psychologist';
                                    currentEntityId = detData.dossier.profile.id || null;
                                    if (currentEntityType === 'psychologist') {
                                        currentPsychologistId = detData.dossier.profile.id;
                                    }
                                    renderDossier(detData.dossier);
                                }
                                renderGeneratedPayload({
                                    aiResponse: conv.finalReply || conv.aiResponse || rawResp,
                                    structuredOutput: conv.structuredOutput || null,
                                    conversationId: conv.id
                                });
                                switchMobileTab('tab-chat');
                                return;
                            }
                        }
                    } catch (_) {}

                    renderGeneratedPayload({
                        aiResponse: rawResp,
                        structuredOutput: null,
                        conversationId: c.id
                    });
                    switchMobileTab('tab-chat');
                });

                listEl.appendChild(card);
            });
        } catch (e) {
            clearEl(listEl);
            const errEl = document.createElement('div');
            errEl.style.cssText = 'text-align: center; color: #ef4444; font-size: 0.8rem; padding: 10px;';
            errEl.textContent = 'Não foi possível carregar o histórico.';
            listEl.appendChild(errEl);
        }
    }
})();
