window.initializePage = function() {
    const API_BASE_URL = window.API_BASE_URL || '';
    const token = localStorage.getItem('Yelo_token');
    
    const tableBody = document.getElementById('crm-psis-body');
    const searchInput = document.getElementById('crm-search-psi');
    const statusInput = document.getElementById('crm-status-psi');
    
    const drawerOverlay = document.getElementById('drawer-cs-overlay');
    const btnCloseDrawer = document.getElementById('btn-close-cs-drawer');
    
    let searchTimeout;
    let psisDataCache = [];
    let isVipFilterActive = false;
    let isNotAnalyzedFilterActive = false;

    const drawerContent = drawerOverlay ? drawerOverlay.querySelector('.drawer-content') : null;
    const drawerHeader = drawerOverlay ? drawerOverlay.querySelector('.drawer-header-mobile') : null;

    // --- CONTROLES DO DRAWER ---
    function closeDrawer() { 
        drawerOverlay.classList.remove('active'); 
        if (drawerContent) {
            setTimeout(() => {
                drawerContent.style.removeProperty('transform');
                drawerContent.style.removeProperty('transition');
            }, 300);
        }
    }

    if (btnCloseDrawer) btnCloseDrawer.addEventListener('click', closeDrawer);
    if (drawerOverlay) drawerOverlay.addEventListener('click', (e) => { if (e.target === drawerOverlay) closeDrawer(); });

    document.querySelectorAll('.crm-pill').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.crm-pill').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            const filterVal = e.target.dataset.filter;
            
            isVipFilterActive = false;
            isNotAnalyzedFilterActive = false;
            statusInput.value = '';

            if (filterVal === 'vip') {
                isVipFilterActive = true;
            } else if (filterVal === 'not_analyzed') {
                isNotAnalyzedFilterActive = true;
            } else {
                statusInput.value = filterVal;
            }
            fetchAndRenderPsis(1);
        });
    });

    // Lógica de Swipe Down APENAS NO CABEÇALHO (Para não travar o scroll do conteúdo)
    let startY = 0;
    let currentY = 0;
    
    if (drawerHeader && drawerContent) {
        drawerHeader.addEventListener('touchstart', (e) => {
            if (window.innerWidth > 768) return;
            startY = e.touches[0].clientY;
            currentY = startY;
            drawerContent.style.setProperty('transition', 'none', 'important');
        }, { passive: true });
        drawerHeader.addEventListener('touchmove', (e) => {
            if (window.innerWidth > 768 || startY === 0) return;
            currentY = e.touches[0].clientY;
            const diffY = currentY - startY;
            if (diffY > 0) { 
                drawerContent.style.setProperty('transform', `translateY(${diffY}px)`, 'important'); 
                e.preventDefault(); 
            }
        }, { passive: false });
        drawerHeader.addEventListener('touchend', (e) => {
            if (window.innerWidth > 768 || startY === 0) return;
            const diffY = currentY - startY;
            drawerContent.style.setProperty('transition', 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)', 'important');
            if (diffY > 80) { closeDrawer(); setTimeout(() => { drawerContent.style.removeProperty('transform'); drawerContent.style.removeProperty('transition'); }, 300); }
            else { drawerContent.style.setProperty('transform', 'translateY(0)', 'important'); setTimeout(() => { drawerContent.style.removeProperty('transform'); drawerContent.style.removeProperty('transition'); }, 300); }
            startY = 0; currentY = 0;
        });
    }

    searchInput.addEventListener('keyup', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => fetchAndRenderPsis(1), 500);
    });

    async function fetchAndRenderPsis(page = 1) {
        if (!tableBody) return;
        tableBody.innerHTML = `<tr><td colspan="6" class="loading-row" style="text-align: center; padding: 40px; color: var(--cinza-texto);"><span class="loading-spinner-sm"></span> Carregando CRM...</td></tr>`;

        const searchTerm = searchInput.value;
        const status = statusInput.value;

        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/psychologists?page=${page}&search=${searchTerm}&status=${status}&isVip=${isVipFilterActive}&notAnalyzed=${isNotAnalyzedFilterActive}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Falha ao buscar dados.');

            const { data, totalPages, currentPage, kpis } = await response.json();
            psisDataCache = data;
            
            renderTable(data);
            renderPagination(totalPages, currentPage);

            if (kpis) {
                const setText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value || 0; };
                setText('kpi-total-psis', kpis.total);
                setText('kpi-ativos-psis', (parseInt(kpis.active_paying) || 0) + (parseInt(kpis.active_trial) || 0));
                setText('kpi-pendentes-psis', kpis.pending);
                setText('kpi-inativos-psis', kpis.inactive);
                setText('kpi-vip-psis', kpis.vip);
                setText('kpi-fila-cs', kpis.fila_cs);
            }
        } catch (error) {
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 40px; color: var(--coral-quente);">Erro ao carregar dados.</td></tr>`;
        }
    }

    function calculateProfileHealth(psy) {
        const checks = [
            { text: 'Foto de Perfil', ok: !!psy.fotoUrl },
            { text: 'Nome de Exibição', ok: !!psy.nome },
            { text: 'Número do CRP', ok: !!(psy.crp && String(psy.crp).length > 3) },
            { text: 'WhatsApp', ok: !!(psy.telefone && String(psy.telefone).length > 8) },
            { text: 'Documento (CPF/CNPJ)', ok: !!(psy.cpf || psy.cnpj || psy.document_number) },
            { text: 'Localização (CEP)', ok: !!psy.cep },
            { text: 'Link Personalizado', ok: !!psy.slug },
            { text: 'Biografia', ok: !!(psy.bio && psy.bio.trim().length >= 10) },
            { text: 'Ano de Início', ok: !!psy.ano_inicio_experiencia },
            { text: 'Valor da Consulta', ok: (psy.valor_sessao_numero !== null && psy.valor_sessao_numero !== undefined) || (psy.valor_mensal_numero !== null && psy.valor_mensal_numero !== undefined) },
            { text: 'Formação Acadêmica', ok: !!psy.formacao_nivel },
            { text: 'Redes Sociais', ok: !!(psy.instagram_url || psy.linkedin_url || psy.tiktok_url || psy.facebook_url || psy.x_url) },
            { text: 'Temas de Atuação', ok: Array.isArray(psy.temas_atuacao) ? psy.temas_atuacao.length > 0 : !!psy.temas_atuacao },
            { text: 'Público-Alvo', ok: Array.isArray(psy.publico_alvo) ? psy.publico_alvo.length > 0 : !!psy.publico_alvo },
            { text: 'Identidade e Inclusão', ok: Array.isArray(psy.praticas_inclusivas) ? psy.praticas_inclusivas.length > 0 : !!psy.praticas_inclusivas },
            { text: 'Gênero', ok: !!psy.genero_identidade },
            { text: 'Abordagens e Técnicas', ok: Array.isArray(psy.abordagens_tecnicas) ? psy.abordagens_tecnicas.length > 0 : !!psy.abordagens_tecnicas },
            { text: 'Modalidade de Atendimento', ok: Array.isArray(psy.modalidade) ? psy.modalidade.length > 0 : !!psy.modalidade },
            { text: 'Turnos Disponíveis', ok: Array.isArray(psy.disponibilidade_periodo) ? psy.disponibilidade_periodo.length > 0 : !!psy.disponibilidade_periodo }
        ];

        const okCount = checks.filter(c => c.ok).length;
        const score = Math.round((okCount / checks.length) * 100);
        return { score, checks };
    }

    function renderTable(psis) {
        tableBody.innerHTML = '';
        if (psis.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 40px; color: var(--cinza-texto);">Nenhum profissional encontrado.</td></tr>`;
            return;
        }

        let copiedList = JSON.parse(localStorage.getItem('yelo_psi_copied_analysis') || '[]');

        psis.forEach(psy => {
            const isVip = psy.is_exempt === true;
            const isDeleted = psy.deletedAt !== null && psy.deletedAt !== undefined;
            
            // 🧠 Sincronização Híbrida: Lê do Banco de Dados (isProfileAnalyzed) ou do cache local do navegador
            const isCopied = psy.isProfileAnalyzed === true || copiedList.includes(String(psy.id));
            const copyBadge = isCopied ? '<span class="badge-copied" title="Análise Copiada" style="margin-left: 5px; font-size: 0.8rem;">✅</span>' : '';
            const dataInscricao = new Date(psy.createdAt).toLocaleDateString('pt-BR');

            let statusLabel = psy.status || 'inativo';
            let statusClass = `status-${psy.status || 'inactive'}`;

            if (isDeleted) {
                statusLabel = 'excluído';
                statusClass = 'status-cancelada';
            } else if (psy.status === 'active') {
                if (isVip) statusLabel = 'VIP';
                else if (!psy.stripeSubscriptionId && psy.planExpiresAt && new Date(psy.planExpiresAt) > new Date()) {
                    statusLabel = 'Trial';
                    statusClass = 'status-pending';
                } else statusLabel = 'Ativo';
            } else if (psy.status === 'pending') statusLabel = 'Incompleto';
            else if (psy.status === 'inactive') statusLabel = 'Expirado';

            const planoName = psy.plano ? (psy.plano.charAt(0).toUpperCase() + psy.plano.slice(1).toLowerCase()) : 'Nenhum';
            const { score } = calculateProfileHealth(psy);

            let scoreColor = '#ef4444';
            if (score >= 75) scoreColor = '#10b981';
            else if (score >= 50) scoreColor = '#f59e0b';

            // Gamificação Level
            const levelMap = { 'nivel_iniciante': 'Iniciante', 'nivel_verificado': 'Verificado', 'nivel_ativo': 'Ativo', 'nivel_especialista': 'Especialista', 'nivel_mentor': 'Mentor' };
            const xpStr = psy.xp ? `${psy.xp} XP` : '0 XP';
            const levelStr = levelMap[psy.authority_level] || 'Iniciante';

            const row = document.createElement('tr');
            row.innerHTML = `
                <td data-label="Profissional">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        ${psy.fotoUrl ? `<img src="${psy.fotoUrl}" style="width:32px; height:32px; border-radius:50%; object-fit:cover;">` : `<div style="width: 32px; height: 32px; border-radius: 50%; background-color: #f5f3ff; color: #8b5cf6; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.85rem;">${psy.nome.charAt(0).toUpperCase()}</div>`}
                        <div style="display: flex; flex-direction: column;">
                            <strong style="color: var(--verde-escuro); cursor: pointer;" onclick="window.openCSDrawer('${psy.id}')" id="name-psy-${psy.id}">${psy.nome}${copyBadge}</strong>
                            <span style="font-size: 0.75rem; color: #666;">${psy.email}</span>
                        </div>
                    </div>
                </td>
                <td data-label="Status / Plano">
                    <span class="status ${statusClass}" style="margin-bottom: 4px;">${statusLabel}</span><br>
                    <span style="font-size: 0.8rem; font-weight: 600; color: #475569;">${planoName}</span>
                </td>
                <td data-label="Força do Perfil">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div style="width: 50px; height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden;">
                            <div style="width: ${score}%; height: 100%; background: ${scoreColor};"></div>
                        </div>
                        <span style="font-size: 0.85rem; font-weight: 600; color: ${scoreColor};">${score}%</span>
                    </div>
                </td>
                <td data-label="Data de Inscrição">
                    <span style="color: #64748b; font-size: 0.9rem; font-weight: 500;">${dataInscricao}</span>
                </td>
                <td data-label="Gamificação">
                    <div style="display: flex; flex-direction: column;">
                        <strong style="color: #3b82f6; font-size: 0.9rem;">${levelStr}</strong>
                        <span style="font-size: 0.75rem; color: #64748b;">${xpStr}</span>
                    </div>
                </td>
                <td data-label="Ações CS" style="white-space: nowrap; text-align: right;">
                    <button class="btn-tabela" onclick="window.openCSDrawer('${psy.id}')" style="display: inline-flex; align-items: center; gap: 5px; padding: 6px 12px; border-radius: 50px; font-weight: 600;">
                        Visão 360
                    </button>
                    ${isDeleted ? '' : `<button class="btn-tabela btn-tabela-perigo" onclick="window.forceDeletePsy('${psy.id}', '${psy.nome}')" style="margin-left: 5px; display: inline-flex; align-items: center; gap: 5px; padding: 6px 12px; border-radius: 50px; font-weight: 600;" title="Excluir"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg> Excluir</button>`}
                </td>
            `;
            tableBody.appendChild(row);
        });
    }

    window.openCSDrawer = function(idStr) {
        const psy = psisDataCache.find(p => String(p.id) === String(idStr));
        if (!psy) return;

        const imgAvatar = document.getElementById('cs-avatar');
        const fbAvatar = document.getElementById('cs-avatar-fallback');
        if (psy.fotoUrl) {
            imgAvatar.src = psy.fotoUrl; imgAvatar.style.display = 'block'; fbAvatar.style.display = 'none';
        } else {
            imgAvatar.style.display = 'none'; fbAvatar.style.display = 'flex'; fbAvatar.textContent = psy.nome.charAt(0).toUpperCase();
        }

        document.getElementById('cs-name').textContent = psy.nome;
        document.getElementById('cs-email').textContent = psy.email;
        document.getElementById('cs-phone').textContent = `Tel: ${psy.telefone || 'N/A'}`;
        document.getElementById('cs-crp').textContent = `CRP: ${psy.crp || 'N/A'}`;
        document.getElementById('cs-date').textContent = `Desde: ${new Date(psy.createdAt).toLocaleDateString('pt-BR')}`;

        // Health Score
        const { score, checks } = calculateProfileHealth(psy);
        document.getElementById('cs-health-pct').textContent = `${score}%`;
        const healthBar = document.getElementById('cs-health-bar');
        healthBar.style.width = `${score}%`;
        healthBar.style.background = score >= 75 ? '#10b981' : (score >= 50 ? '#f59e0b' : '#ef4444');
        
        document.getElementById('cs-health-checks').innerHTML = checks.map(c => 
            `<li style="display:flex; align-items:center; gap:8px;">${c.ok ? '<span style="color:#10b981;">✓</span>' : '<span style="color:#ef4444;">✗</span>'} ${c.text}</li>`
        ).join('');

        // Subscription
        const isVip = psy.is_exempt;
        const planoName = psy.plano ? (psy.plano.charAt(0).toUpperCase() + psy.plano.slice(1).toLowerCase()) : 'Nenhum';
        document.getElementById('cs-plan').textContent = isVip ? `${planoName} (VIP)` : planoName;
        
        let expText = '-';
        if (isVip) expText = 'Isento';
        else if (psy.planExpiresAt) {
            const expDate = new Date(psy.planExpiresAt);
            if (expDate.getFullYear() < 2000) {
                expText = 'Expirado';
            } else {
                expText = expDate.toLocaleDateString('pt-BR');
                if (expDate < new Date()) expText += ' (Vencido)';
            }
        }
        document.getElementById('cs-expire').textContent = expText;

        // Actions
        const actionsContainer = document.getElementById('cs-actions-container');
        actionsContainer.innerHTML = '';

        // 1. Conceder VIP (Abre Modal Global)
        const btnVip = document.createElement('button');
        btnVip.className = 'btn-tabela';
        btnVip.style.width = '100%'; btnVip.style.justifyContent = 'center'; btnVip.style.padding = '12px'; btnVip.style.borderRadius = '50px';
        btnVip.textContent = isVip ? 'Gerenciar Isenção VIP (Atual: VIP)' : 'Conceder Isenção VIP';
        btnVip.onclick = () => {
            if(window.openVipModal) window.openVipModal({ id: psy.id, nome: psy.nome, is_exempt: isVip, plano: psy.plano });
        };
        actionsContainer.appendChild(btnVip);

        // 1.5. Ver Dossiê Completo
        const btnDossie = document.createElement('button');
        btnDossie.className = 'btn-tabela';
        btnDossie.style.width = '100%'; btnDossie.style.justifyContent = 'center'; btnDossie.style.padding = '12px'; btnDossie.style.borderRadius = '50px';
        btnDossie.style.background = '#f8fafc'; btnDossie.style.color = '#334155'; btnDossie.style.border = '1px solid #cbd5e1';
        btnDossie.innerHTML = 'Ver Dossiê Completo 🗂️';
        btnDossie.onclick = () => {
            if (window.navigateToPage) {
                window.navigateToPage(`admin_detalhes_psicologo.html?id=${psy.id}`);
            } else {
                window.location.href = `admin.html#admin_detalhes_psicologo.html?id=${psy.id}`; // Fallback, assume main admin router
            }
        };
        actionsContainer.appendChild(btnDossie);

        // 2. Ver Perfil Público
        if (psy.slug) {
            const btnProfile = document.createElement('button');
            btnProfile.className = 'btn-tabela';
            btnProfile.style.width = '100%'; btnProfile.style.justifyContent = 'center'; btnProfile.style.padding = '12px'; btnProfile.style.borderRadius = '50px';
            btnProfile.style.background = '#f0fdf4'; btnProfile.style.color = '#166534'; btnProfile.style.border = '1px solid #bbf7d0';
            btnProfile.innerHTML = 'Ver Perfil Público 🔗';
            btnProfile.onclick = () => window.open(`/${psy.slug}`, '_blank');
            actionsContainer.appendChild(btnProfile);
        }

        // 3. Enviar WhatsApp (Abre API)
        if (psy.telefone) {
            const btnZap = document.createElement('button');
            btnZap.className = 'btn-tabela';
            btnZap.style.width = '100%'; btnZap.style.justifyContent = 'center'; btnZap.style.padding = '12px'; btnZap.style.borderRadius = '50px';
            btnZap.style.background = '#e0f2fe'; btnZap.style.color = '#0369a1'; btnZap.style.border = '1px solid #bae6fd';
            btnZap.innerHTML = 'Chamar no WhatsApp 📱';
            btnZap.onclick = async () => {
                const tel = psy.telefone.replace(/\D/g, '');
                const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                
                let whatsappUrl = `https://wa.me/55${tel}`;
                
                if (psy.status === 'pending') {
                    const copyMsg = `Olá, ${psy.nome}! Tudo bem? Aqui é o Anderson, da Yelo. 🌿\n\nVi que você deu o primeiro passo e iniciou o seu cadastro, mas acabou não finalizando o preenchimento do seu perfil. Como também sou da clínica, sei bem que a rotina de atendimentos acaba engolindo o nosso tempo, né? rs\n\nPassei só para te lembrar que os seus 14 dias de teste gratuito (sem precisar cadastrar cartão de crédito) só começam a contar *depois* que a sua página for para o ar! \n\nÉ a oportunidade perfeita para você testar na prática como a plataforma te conecta com pacientes direto no seu WhatsApp, lembrando que a gente não cobra nenhuma taxa ou comissão pelas suas sessões.\n\nFalta bem pouco para o seu perfil ficar ativo nas buscas. Se precisar de uma mãozinha para preencher a sua bio ou tiver qualquer dúvida, é só me dar um toque respondendo esta mensagem. Sigo super à disposição por aqui!`;
                    
                    const copyToClipboardFallback = (text) => {
                        if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
                        return new Promise((resolve, reject) => {
                            const textArea = document.createElement("textarea");
                            textArea.value = text;
                            textArea.style.position = "fixed"; textArea.style.left = "-999999px";
                            document.body.appendChild(textArea);
                            textArea.focus(); textArea.select();
                            document.execCommand('copy') ? resolve() : reject();
                            textArea.remove();
                        });
                    };

                    try {
                        await copyToClipboardFallback(copyMsg);
                        if(window.showToast) window.showToast("Mensagem de perfil incompleto copiada!", "success");
                    } catch(e) {
                        console.log("Erro ao copiar", e);
                    }
                    
                    whatsappUrl += `?text=${encodeURIComponent(copyMsg)}`;
                }

                if (isMobile) {
                    window.location.href = whatsappUrl; // Evita aba fantasma about:blank
                } else {
                    window.open(whatsappUrl, '_blank');
                }
                
                // --- NOVO: Remove da Fila CS se clicou em WhatsApp ---
                if (isNotAnalyzedFilterActive) {
                    try {
                        fetch(`${API_BASE_URL}/api/admin/psychologists/${psy.id}/analyzed`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
                        });
                    } catch(e) {}
                    
                    const tr = document.getElementById(`name-psy-${psy.id}`)?.closest('tr');
                    if (tr) {
                        tr.style.transition = 'all 0.4s ease';
                        tr.style.opacity = '0';
                        setTimeout(() => tr.remove(), 400);
                    }
                    if (window.showToast) window.showToast("Contato iniciado! Removido da fila.", "success");
                    
                    // Fecha a gaveta (Visão 360) para não ficar vazia em cima
                    const btnClose = document.getElementById('btn-close-cs-drawer');
                    if(btnClose) btnClose.click();
                }
            };
            actionsContainer.appendChild(btnZap);
        }

        // 4. Copiar para Análise (Liberado para todos os profissionais)
        const btnCopy = document.createElement('button');
        btnCopy.className = 'btn-tabela';
        btnCopy.id = `btn-analise-${psy.id}`;
        
        // Verifica se já foi copiado (Sincronização Híbrida)
        let copiedList = JSON.parse(localStorage.getItem('yelo_psi_copied_analysis') || '[]');
        const isCopied = psy.isProfileAnalyzed === true || copiedList.includes(String(psy.id));

        btnCopy.style.width = '100%'; btnCopy.style.justifyContent = 'center'; btnCopy.style.padding = '12px'; btnCopy.style.borderRadius = '50px';
        
        if (isCopied) {
            btnCopy.style.background = '#dcfce7'; btnCopy.style.color = '#166534'; btnCopy.style.border = '1px solid #bbf7d0';
            btnCopy.innerHTML = '✨ Análise Copiada ✅';
        } else {
            btnCopy.style.background = '#fef08a'; btnCopy.style.color = '#b45309'; btnCopy.style.border = '1px solid #fde047';
            btnCopy.innerHTML = '✨ Análise de Perfil (IA)';
        }

        btnCopy.onclick = () => window.gerarAnaliseCS(psy.id);
        actionsContainer.appendChild(btnCopy);

        drawerOverlay.classList.add('active');
    };

    window.gerarAnaliseCS = async function(psiId) {
        const btn = document.getElementById(`btn-analise-${psiId}`);
        const originalBg = btn ? btn.style.background : '';
        if(btn) { 
            btn.disabled = true; 
            btn.innerHTML = '<span class="loading-spinner-sm" style="width:14px; height:14px; margin-right:5px; border-width:2px; display:inline-block;"></span> Gerando...'; 
        }
        
        try {
            const token = localStorage.getItem('Yelo_token_admin') === 'cookie_auth_active' ? 'cookie_auth_active' : localStorage.getItem('Yelo_token');
            const res = await fetch(`${API_BASE_URL}/api/admin/psychologists/${psiId}/analyze`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if(data.message) {
                const copyToClipboardFallback = (text) => {
                    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
                    return new Promise((resolve, reject) => {
                        const textArea = document.createElement("textarea");
                        textArea.value = text;
                        textArea.style.position = "fixed"; textArea.style.left = "-999999px";
                        document.body.appendChild(textArea);
                        textArea.focus(); textArea.select();
                        document.execCommand('copy') ? resolve() : reject();
                        textArea.remove();
                    });
                };
                
                await copyToClipboardFallback(data.message);

                let currentList = JSON.parse(localStorage.getItem('yelo_psi_copied_analysis') || '[]');
                if (!currentList.includes(String(psiId))) {
                    currentList.push(String(psiId));
                    localStorage.setItem('yelo_psi_copied_analysis', JSON.stringify(currentList));
                }

                // ☁️ Salva a marcação na nuvem (Banco de Dados) para persistir entre celular e PC
                try {
                    await fetch(`${API_BASE_URL}/api/admin/psychologists/${psiId}/analyzed`, {
                        method: 'PUT',
                        headers: { 
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}` 
                        },
                        body: JSON.stringify({ isProfileAnalyzed: true })
                    });
                    
                    // Atualiza o cache de dados local para não precisar recarregar a página
                    const psyIndex = psisDataCache.findIndex(p => String(p.id) === String(psiId));
                    if (psyIndex !== -1) {
                        psisDataCache[psyIndex].isProfileAnalyzed = true;
                    }
                } catch (e) {
                    console.warn("Backend ainda não suporta salvamento na nuvem da análise ou ocorreu um erro na rede", e);
                }

                const nameEl = document.getElementById(`name-psy-${psiId}`);
                if (nameEl && !nameEl.innerHTML.includes('✅')) {
                    nameEl.innerHTML += '<span class="badge-copied" title="Análise Copiada" style="margin-left: 5px; font-size: 0.8rem;">✅</span>';
                }

                if(window.showToast) window.showToast("Análise gerada e copiada com sucesso!", "success");
                else alert("Análise copiada!");

                if(btn) { 
                    btn.style.background = '#dcfce7'; 
                    btn.style.color = '#166534'; 
                    btn.style.border = '1px solid #bbf7d0';
                    btn.innerHTML = '✨ Análise Copiada ✅'; 
                }
            } else {
                throw new Error(data.error || "Erro na resposta");
            }
        } catch(e) {
            if(window.showToast) window.showToast(e.message || "Erro ao gerar análise", "error");
            else alert(e.message || "Erro ao gerar análise");
            if(btn) { 
                btn.disabled = false; 
                btn.innerHTML = '✨ Análise de Perfil (IA)'; 
                btn.style.background = originalBg;
            }
        } finally {
            if(btn) btn.disabled = false;
        }
    };

    window.forceDeletePsy = function(id, name) {
        if(window.openConfirmationModal) {
            window.openConfirmationModal('Excluir Profissional', `Tem certeza que deseja excluir o psicólogo <strong>${name}</strong> permanentemente?`, async () => {
                try {
                    const res = await fetch(`${API_BASE_URL}/api/admin/psychologists/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
                    if(res.ok) { window.showToast('Excluído com sucesso.', 'success'); fetchAndRenderPsis(1); }
                    else throw new Error('Erro ao excluir');
                } catch(e) { window.showToast(e.message, 'error'); }
            });
        }
    };

    function renderPagination(totalPages, currentPage) {
        const container = document.getElementById('crm-pagination-psis');
        if (!container || totalPages <= 1) { if(container) container.innerHTML = ''; return; }
        
        let html = `<button class="pagination-btn" onclick="window.loadCrmPsisPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>&laquo;</button>`;
        for (let i = 1; i <= totalPages; i++) html += `<button class="pagination-btn ${i === currentPage ? 'active' : ''}" onclick="window.loadCrmPsisPage(${i})">${i}</button>`;
        html += `<button class="pagination-btn" onclick="window.loadCrmPsisPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>&raquo;</button>`;
        container.innerHTML = html;
    }
    window.loadCrmPsisPage = function(p) { fetchAndRenderPsis(p); };

    // Ouvinte para quando um VIP for atualizado pelo modal global
    window.addEventListener('vipStatusUpdated', () => { fetchAndRenderPsis(1); closeDrawer(); });

    window.cleanupPage = function() {
        window.removeEventListener('vipStatusUpdated', fetchAndRenderPsis);
    };

    fetchAndRenderPsis(1);
};