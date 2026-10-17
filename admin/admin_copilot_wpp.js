// admin/admin_copilot_wpp.js
(function() {
    let currentPsychologistId = null;
    let currentTone = 'natural';
    let identifyTimeout = null;

    function getAuthHeaders() {
        const token = localStorage.getItem('Yelo_token') || localStorage.getItem('Yelo_token_admin');
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        return headers;
    }

    window.initializePage = function() {
        setupEventListeners();
        loadHistory();
    };

    function setupEventListeners() {
        const chatInput = document.getElementById('copilot-input-chat');
        const btnGerar = document.getElementById('btn-gerar-resposta');
        const btnCopiar = document.getElementById('btn-copiar-resposta');
        const btnLimpar = document.getElementById('btn-limpar-tudo');
        const btnTrocar = document.getElementById('btn-trocar-psi-manual');
        const btnManualSearch = document.getElementById('btn-manual-search-exec');
        const manualQuery = document.getElementById('manual-psi-query');
        const btnRegenerar = document.getElementById('btn-regenerar-variacao');

        // Detecção automática em tempo real ao colar ou digitar
        if (chatInput) {
            chatInput.addEventListener('input', () => {
                clearTimeout(identifyTimeout);
                identifyTimeout = setTimeout(() => {
                    handleAutoIdentify();
                }, 400);
            });

            chatInput.addEventListener('paste', () => {
                setTimeout(handleAutoIdentify, 100);
            });
        }

        // Seletor de tom
        document.querySelectorAll('.tone-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.tone-btn').forEach(b => {
                    b.classList.remove('active');
                    b.style.background = '#f8fafc';
                    b.style.color = '#475569';
                    b.style.borderColor = '#cbd5e1';
                });
                this.classList.add('active');
                this.style.background = '#1B4332';
                this.style.color = '#FFEE8C';
                this.style.borderColor = '#1B4332';
                currentTone = this.getAttribute('data-tone') || 'natural';
            });
        });

        // Botão de Gerar Resposta
        if (btnGerar) {
            btnGerar.addEventListener('click', handleGenerateResponse);
        }

        // Botão de Regenerar Variação
        if (btnRegenerar) {
            btnRegenerar.addEventListener('click', handleGenerateResponse);
        }

        // Botão de Copiar Resposta
        if (btnCopiar) {
            btnCopiar.addEventListener('click', handleCopyResponse);
        }

        // Botão Limpar
        if (btnLimpar) {
            btnLimpar.addEventListener('click', handleClearAll);
        }

        // Botão Trocar Manualmente
        if (btnTrocar) {
            btnTrocar.addEventListener('click', () => {
                const searchBox = document.getElementById('manual-search-box');
                if (searchBox) {
                    searchBox.style.display = searchBox.style.display === 'none' ? 'block' : 'none';
                    if (searchBox.style.display === 'block') document.getElementById('manual-psi-query')?.focus();
                }
            });
        }

        // Busca manual
        if (btnManualSearch && manualQuery) {
            btnManualSearch.addEventListener('click', handleManualSearch);
            manualQuery.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') handleManualSearch();
            });
        }
    }

    async function handleAutoIdentify() {
        const text = document.getElementById('copilot-input-chat')?.value.trim();
        if (!text || text.length < 10) return;

        const bannerTexto = document.getElementById('identificacao-texto');
        const bannerSubtexto = document.getElementById('identificacao-subtexto');
        const bannerIcone = document.getElementById('identificacao-icone');
        const btnTrocar = document.getElementById('btn-trocar-psi-manual');

        if (bannerTexto) bannerTexto.textContent = "Buscando profissional no banco do Render...";

        try {
            const res = await fetch('/api/admin/copilot/identify', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ pastedChat: text })
            });

            if (!res.ok) throw new Error("Falha na identificação");
            const data = await res.json();

            if (data.dossier && data.dossier.profile) {
                currentPsychologistId = data.dossier.profile.id;
                renderDossier(data.dossier);

                if (bannerIcone) bannerIcone.textContent = "🟢";
                if (bannerTexto) bannerTexto.innerHTML = `Identificado: <strong>${data.dossier.profile.nome}</strong> (ID ${data.dossier.profile.id})`;
                if (bannerSubtexto) bannerSubtexto.textContent = `Plano ${data.dossier.profile.plano || 'Essencial'} • Sessão R$ ${data.dossier.profile.valor_sessao_numero || '0'} • ${data.dossier.profile.whatsapp_clicks || 0} cliques Wpp`;
                if (btnTrocar) btnTrocar.style.display = "inline-block";
            } else if (data.cleanName) {
                if (bannerIcone) bannerIcone.textContent = "⚠️";
                if (bannerTexto) bannerTexto.innerHTML = `Detectado nome <strong>"${data.cleanName}"</strong>, mas não consta na base de psicólogos.`;
                if (bannerSubtexto) bannerSubtexto.textContent = "A IA responderá considerando o contexto geral da Yelo.";
                if (btnTrocar) btnTrocar.style.display = "inline-block";
            } else {
                if (bannerIcone) bannerIcone.textContent = "ℹ️";
                if (bannerTexto) bannerTexto.textContent = "Nenhum nome de psicólogo detectado no cabeçalho do WhatsApp.";
                if (bannerSubtexto) bannerSubtexto.textContent = "Você pode buscar manualmente pelo botão 'Alterar Profissional' se desejar.";
                if (btnTrocar) btnTrocar.style.display = "inline-block";
            }
        } catch (err) {
            console.error("Erro na auto-identificação:", err);
        }
    }

    async function handleGenerateResponse() {
        const text = document.getElementById('copilot-input-chat')?.value.trim();
        if (!text) {
            alert("Por favor, cole a conversa do WhatsApp primeiro.");
            return;
        }

        const btnGerar = document.getElementById('btn-gerar-resposta');
        const cardResposta = document.getElementById('card-resposta-gerada');
        const boxTexto = document.getElementById('box-resposta-texto');

        const originalBtnHtml = btnGerar.innerHTML;
        btnGerar.disabled = true;
        btnGerar.innerHTML = `<span>⏳ Consultando Dossiê e IA...</span>`;

        try {
            const res = await fetch('/api/admin/copilot/respond', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    pastedChat: text,
                    manualPsiId: currentPsychologistId,
                    tone: currentTone
                })
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || "Erro ao gerar resposta");
            }

            const data = await res.json();

            if (boxTexto) boxTexto.textContent = data.aiResponse;
            if (cardResposta) {
                cardResposta.style.display = 'block';
                cardResposta.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }

            if (data.detectedPsychologist && !currentPsychologistId) {
                currentPsychologistId = data.detectedPsychologist.profile.id;
                renderDossier(data.detectedPsychologist);
            }

            // Atualiza histórico
            loadHistory();

        } catch (err) {
            alert("Erro ao gerar resposta: " + err.message);
        } finally {
            btnGerar.disabled = false;
            btnGerar.innerHTML = originalBtnHtml;
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

        // Cabeçalho
        const nomeEl = document.getElementById('dossie-nome');
        const crpEl = document.getElementById('dossie-crp-local');
        const fotoEl = document.getElementById('dossie-foto');
        const linkPerfil = document.getElementById('dossie-link-perfil');

        if (nomeEl) nomeEl.textContent = p.nome;
        if (crpEl) crpEl.textContent = `CRP: ${p.crp || 'Ativo'} • ${p.cidade || 'Online'}${p.estado ? ' - ' + p.estado : ''}`;
        if (fotoEl && p.fotoUrl) fotoEl.src = p.fotoUrl;
        if (linkPerfil) linkPerfil.href = `https://www.yelopsi.com.br/${p.slug || ''}`;

        // Status Pill
        if (statusPill) {
            statusPill.style.display = 'inline-block';
            if (p.status === 'active') {
                if (p.subscriptionId || p.subscription_payments_count > 0) {
                    statusPill.style.background = '#dcfce7';
                    statusPill.style.color = '#166534';
                    statusPill.textContent = 'Pagante Ativo';
                } else {
                    statusPill.style.background = '#fef3c7';
                    statusPill.style.color = '#b45309';
                    statusPill.textContent = 'Em Trial 7d';
                }
            } else {
                statusPill.style.background = '#fee2e2';
                statusPill.style.color = '#991b1b';
                statusPill.textContent = 'Inativo / Pausado';
            }
        }

        // Mini Cards
        document.getElementById('dossie-aparicoes').textContent = p.profile_appearances || 0;
        document.getElementById('dossie-cliques').textContent = p.whatsapp_clicks || s.total_clicks || 0;
        document.getElementById('dossie-fechamentos').textContent = s.deals_closed || 0;
        document.getElementById('dossie-valor').textContent = `R$ ${p.valor_sessao_numero || 0}`;

        // Detalhes
        const valData = p.planExpiresAt ? new Date(p.planExpiresAt).toLocaleDateString('pt-BR') : 'Sem data';
        document.getElementById('dossie-plano-validade').textContent = `${p.plano || 'Essencial'} (Até ${valData})`;

        const abordagens = Array.isArray(p.abordagens_tecnicas) ? p.abordagens_tecnicas.join(', ') : (p.abordagens_tecnicas || 'Clínica Geral');
        document.getElementById('dossie-abordagem').textContent = abordagens;

        const artigosStr = posts.total > 0 ? `${posts.total} publicados (${posts.top[0]?.curtidas || 0} curtidas no top)` : 'Nenhum artigo publicado';
        document.getElementById('dossie-artigos-info').textContent = artigosStr;

        const bioBox = document.getElementById('dossie-bio-box');
        if (bioBox) {
            bioBox.textContent = p.bio ? `"${p.bio.replace(/<[^>]*>?/gm, '').substring(0, 180)}..."` : 'Sem bio cadastrada.';
        }
    }

    async function handleManualSearch() {
        const query = document.getElementById('manual-psi-query')?.value.trim();
        if (!query) return;

        const resultsContainer = document.getElementById('manual-search-results');
        if (resultsContainer) resultsContainer.innerHTML = '<div style="font-size:0.8rem; color:#64748b; padding:8px;">Buscando...</div>';

        try {
            const res = await fetch(`/api/admin/copilot/search-psychologists?q=${encodeURIComponent(query)}`, {
                headers: getAuthHeaders()
            });
            const data = await res.json();
            const list = data.psychologists || [];

            if (list.length === 0) {
                resultsContainer.innerHTML = '<div style="font-size:0.8rem; color:#ef4444; padding:8px;">Nenhum psicólogo encontrado com esse termo.</div>';
                return;
            }

            resultsContainer.innerHTML = list.map(psi => `
                <div class="manual-result-item" data-id="${psi.id}" style="padding: 8px 10px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; font-size: 0.85rem; border-bottom: 1px solid #f1f5f9; transition: background 0.15s;">
                    <div>
                        <strong>${psi.nome}</strong> (ID ${psi.id})
                        <div style="font-size: 0.75rem; color: #64748b;">${psi.email} • ${psi.plano || 'Essencial'}</div>
                    </div>
                    <button style="background: #1B4332; color: #FFEE8C; border: none; padding: 4px 10px; border-radius: 4px; font-size: 0.75rem; font-weight: 700; cursor: pointer;">Selecionar</button>
                </div>
            `).join('');

            resultsContainer.querySelectorAll('.manual-result-item').forEach(item => {
                item.addEventListener('click', async () => {
                    const id = item.getAttribute('data-id');
                    currentPsychologistId = parseInt(id, 10);
                    document.getElementById('manual-search-box').style.display = 'none';
                    
                    // Busca dossiê completo deste selecionado
                    const identifyRes = await fetch(`/api/admin/copilot/identify`, {
                        method: 'POST',
                        headers: getAuthHeaders(),
                        body: JSON.stringify({ psychologistId: currentPsychologistId })
                    }).catch(() => null);

                    const identifyData = identifyRes ? await identifyRes.json().catch(() => null) : null;
                    if (identifyData?.dossier) {
                        renderDossier(identifyData.dossier);
                        const bannerTexto = document.getElementById('identificacao-texto');
                        const bannerSubtexto = document.getElementById('identificacao-subtexto');
                        const bannerIcone = document.getElementById('identificacao-icone');
                        if (bannerIcone) bannerIcone.textContent = "🟢";
                        if (bannerTexto) bannerTexto.innerHTML = `Selecionado: <strong>${identifyData.dossier.profile.nome}</strong> (ID ${identifyData.dossier.profile.id})`;
                        if (bannerSubtexto) bannerSubtexto.textContent = `Plano ${identifyData.dossier.profile.plano || 'Essencial'} • Sessão R$ ${identifyData.dossier.profile.valor_sessao_numero || '0'} • ${identifyData.dossier.profile.whatsapp_clicks || 0} cliques Wpp`;
                    }
                });
            });

        } catch (err) {
            resultsContainer.innerHTML = '<div style="font-size:0.8rem; color:#ef4444; padding:8px;">Erro na busca.</div>';
        }
    }

    async function handleCopyResponse() {
        const text = document.getElementById('box-resposta-texto')?.textContent || '';
        if (!text) return;

        try {
            await navigator.clipboard.writeText(text);
            const btnCopiar = document.getElementById('btn-copiar-resposta');
            const textCopiar = document.getElementById('text-copiar-btn');
            
            if (btnCopiar) btnCopiar.style.background = '#15803d';
            if (textCopiar) textCopiar.textContent = "✅ Copiado! Cole no WhatsApp (Ctrl+V)";

            setTimeout(() => {
                if (btnCopiar) btnCopiar.style.background = '#25d366';
                if (textCopiar) textCopiar.textContent = "Copiar Resposta";
            }, 2500);
        } catch (e) {
            alert("Não foi possível copiar automaticamente. Por favor, selecione e copie o texto manualmente.");
        }
    }

    function handleClearAll() {
        const chatInput = document.getElementById('copilot-input-chat');
        if (chatInput) chatInput.value = '';
        currentPsychologistId = null;

        const cardResposta = document.getElementById('card-resposta-gerada');
        if (cardResposta) cardResposta.style.display = 'none';

        const emptyState = document.getElementById('dossie-empty-state');
        const content = document.getElementById('dossie-content');
        const statusPill = document.getElementById('dossie-status-pill');

        if (emptyState) emptyState.style.display = 'block';
        if (content) content.style.display = 'none';
        if (statusPill) statusPill.style.display = 'none';

        const bannerTexto = document.getElementById('identificacao-texto');
        const bannerSubtexto = document.getElementById('identificacao-subtexto');
        const bannerIcone = document.getElementById('identificacao-icone');
        const btnTrocar = document.getElementById('btn-trocar-psi-manual');

        if (bannerIcone) bannerIcone.textContent = "🔍";
        if (bannerTexto) bannerTexto.textContent = "Cole uma conversa para identificar o psicólogo automaticamente";
        if (bannerSubtexto) bannerSubtexto.textContent = "O sistema analisa o cabeçalho do WhatsApp e busca no banco do Render";
        if (btnTrocar) btnTrocar.style.display = "none";
    }

    async function loadHistory() {
        const listEl = document.getElementById('copilot-history-list');
        const countEl = document.getElementById('history-count');
        if (!listEl) return;

        try {
            const res = await fetch('/api/admin/copilot/history', {
                headers: getAuthHeaders()
            });
            if (!res.ok) throw new Error("Erro");
            const data = await res.json();
            const items = data.conversations || [];

            if (countEl) countEl.textContent = `${items.length} registros`;

            if (items.length === 0) {
                listEl.innerHTML = `<div style="text-align: center; color: #94a3b8; font-size: 0.82rem; padding: 20px;">Nenhum atendimento salvo ainda.</div>`;
                return;
            }

            listEl.innerHTML = items.map(c => {
                const dateStr = new Date(c.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
                return `
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; cursor: pointer; transition: all 0.15s;" onclick="window.previewPastCopilot('${encodeURIComponent(c.aiResponse || '')}')">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                            <strong style="font-size: 0.85rem; color: #0f172a;">${c.psi_nome || c.detectedName || 'Atendimento'}</strong>
                            <span style="font-size: 0.7rem; color: #94a3b8;">${dateStr}</span>
                        </div>
                        <div style="font-size: 0.78rem; color: #64748b; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">
                            ${c.aiResponse ? c.aiResponse.substring(0, 140) + '...' : ''}
                        </div>
                    </div>
                `;
            }).join('');

            window.previewPastCopilot = function(encodedText) {
                const text = decodeURIComponent(encodedText);
                const cardResposta = document.getElementById('card-resposta-gerada');
                const boxTexto = document.getElementById('box-resposta-texto');
                if (boxTexto) boxTexto.textContent = text;
                if (cardResposta) {
                    cardResposta.style.display = 'block';
                    cardResposta.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            };

        } catch (e) {
            listEl.innerHTML = `<div style="text-align: center; color: #ef4444; font-size: 0.8rem; padding: 10px;">Não foi possível carregar o histórico.</div>`;
        }
    }

})();
