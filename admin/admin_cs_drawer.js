window.openCSDrawer = async function(idStr) {
    const API_BASE_URL = window.API_BASE_URL || '';
    const token = localStorage.getItem('Yelo_token');
    
    if (!token) {
        alert('Sessão expirada. Faça login novamente.');
        return;
    }

    try {
        let overlay = document.getElementById('drawer-cs-overlay');
        if (!overlay) {
            const htmlRes = await fetch('admin_cs_drawer.html');
            const htmlText = await htmlRes.text();
            document.body.insertAdjacentHTML('beforeend', htmlText);
            overlay = document.getElementById('drawer-cs-overlay');
            
            // Bind close event once
            const btnClose = document.getElementById('btn-close-cs-drawer');
            if(btnClose) {
                btnClose.addEventListener('click', () => overlay.classList.remove('active'));
            }
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) overlay.classList.remove('active');
            });
            
            // Swipe to close
            const drawerContent = overlay.querySelector('.drawer-content');
            let startY = 0, currentY = 0;
            if(drawerContent) {
                drawerContent.addEventListener('touchstart', e => { startY = e.touches[0].clientY; }, {passive: true});
                drawerContent.addEventListener('touchmove', e => {
                    if(window.innerWidth > 768) return;
                    currentY = e.touches[0].clientY;
                    const diffY = currentY - startY;
                    if(diffY > 0) drawerContent.style.transform = `translateY(${diffY}px)`;
                }, {passive: true});
                drawerContent.addEventListener('touchend', () => {
                    if(window.innerWidth > 768) return;
                    const diffY = currentY - startY;
                    if (diffY > 80) overlay.classList.remove('active');
                    drawerContent.style.removeProperty('transform');
                    startY = 0; currentY = 0;
                });
            }
        }

        // Reset Drawer fields temporarily
        document.getElementById('cs-name').innerHTML = '<span class="loading-spinner-sm" style="border-width:2px;"></span>';
        document.getElementById('cs-health-pct').textContent = '0%';
        document.getElementById('cs-health-bar').style.width = '0%';
        document.getElementById('cs-health-checks').innerHTML = '';
        document.getElementById('cs-actions-container').innerHTML = '';
        
        overlay.classList.add('active');

        // Fetch user data
        const res = await fetch(`${API_BASE_URL}/api/admin/psychologists/${idStr}/full-details`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) throw new Error('Falha ao buscar detalhes do psicólogo');
        const data = await res.json();
        
        // The endpoint returns either { psychologist, blogPosts, ... } or just the psychologist
        const psy = data.psychologist || data;
        
        // Copiar o array de lembretes pendentes da mesma forma que o original fazia
        let pendingReminders = [];
        try {
            pendingReminders = JSON.parse(localStorage.getItem('yelo_psi_pending_reminder') || '[]');
        } catch(e){}

        const imgAvatar = document.getElementById('cs-avatar');
        const fbAvatar = document.getElementById('cs-avatar-fallback');
        if (psy.fotoUrl) {
            imgAvatar.src = psy.fotoUrl; imgAvatar.style.display = 'block'; fbAvatar.style.display = 'none';
        } else {
            imgAvatar.style.display = 'none'; fbAvatar.style.display = 'flex'; fbAvatar.textContent = psy.nome ? psy.nome.charAt(0).toUpperCase() : '?';
        }

        let nameHtml = psy.nome || 'Sem Nome';
        if (psy.status === 'pending' && pendingReminders.includes(String(psy.id))) {
            nameHtml += ' <span class="badge-pending" title="Lembrete Enviado" style="margin-left: 5px; font-size: 0.8rem;">✉️</span>';
        }
        document.getElementById('cs-name').innerHTML = `<span id="name-psy-${psy.id}">${nameHtml}</span>`;

        document.getElementById('cs-email').textContent = psy.email;
        document.getElementById('cs-phone').textContent = `Tel: ${psy.telefone || 'N/A'}`;
        document.getElementById('cs-crp').textContent = `CRP: ${psy.crp || 'N/A'}`;
        document.getElementById('cs-date').textContent = `Desde: ${new Date(psy.createdAt).toLocaleDateString('pt-BR')}`;

        const isVip = psy.is_exempt;
        const planoName = psy.plano ? (psy.plano.charAt(0).toUpperCase() + psy.plano.slice(1).toLowerCase()) : 'Nenhum';
        document.getElementById('cs-plan').textContent = planoName;

        let expText = '-';
        if (isVip) {
            expText = 'Vitalício (VIP)';
            document.getElementById('cs-expire').style.color = '#d4af37';
        } else if (psy.planExpiresAt) {
            const expDate = new Date(psy.planExpiresAt);
            expText = expDate.toLocaleDateString('pt-BR');
            document.getElementById('cs-expire').style.color = expDate < new Date() ? '#ef4444' : '#1e293b';
        }
        document.getElementById('cs-expire').textContent = expText;

        const health = calculateProfileHealth(psy);
        document.getElementById('cs-health-pct').textContent = `${health.score}%`;
        const bar = document.getElementById('cs-health-bar');
        bar.style.width = `${health.score}%`;
        if (health.score >= 80) bar.style.background = '#10b981';
        else if (health.score >= 50) bar.style.background = '#f59e0b';
        else bar.style.background = '#ef4444';

        const checksUl = document.getElementById('cs-health-checks');
        checksUl.innerHTML = '';
        health.checks.forEach(c => {
            const li = document.createElement('li');
            li.style.display = 'flex'; li.style.justifyContent = 'space-between'; li.style.marginBottom = '5px';
            li.innerHTML = `<span>${c.text}</span> <strong style="color: ${c.ok ? '#10b981' : '#ef4444'};">${c.ok ? '✓' : '✗'}</strong>`;
            checksUl.appendChild(li);
        });

        // ACTIONS
        const actionsContainer = document.getElementById('cs-actions-container');
        actionsContainer.innerHTML = '';

        // 1. VIP
        const btnVip = document.createElement('button');
        btnVip.className = 'btn-tabela';
        btnVip.style.width = '100%'; btnVip.style.justifyContent = 'center'; btnVip.style.padding = '12px'; btnVip.style.borderRadius = '50px';
        btnVip.textContent = isVip ? 'Gerenciar Isenção VIP (Atual: VIP)' : 'Conceder Isenção VIP';
        btnVip.onclick = () => {
            if(window.openVipModal) window.openVipModal({ id: psy.id, nome: psy.nome, is_exempt: isVip, plano: psy.plano });
        };
        actionsContainer.appendChild(btnVip);

        // 1.5 Dossiê
        const btnDossie = document.createElement('button');
        btnDossie.className = 'btn-tabela';
        btnDossie.style.width = '100%'; btnDossie.style.justifyContent = 'center'; btnDossie.style.padding = '12px'; btnDossie.style.borderRadius = '50px';
        btnDossie.style.background = '#f8fafc'; btnDossie.style.color = '#334155'; btnDossie.style.border = '1px solid #cbd5e1';
        btnDossie.innerHTML = 'Ver Dossiê Completo 🗂️';
        btnDossie.onclick = () => {
            if (window.navigateToPage) {
                window.navigateToPage(`admin_detalhes_psicologo.html?id=${psy.id}`);
            } else {
                window.location.href = `admin.html#admin_detalhes_psicologo.html?id=${psy.id}`;
            }
        };
        actionsContainer.appendChild(btnDossie);

        // 2. Perfil
        if (psy.slug) {
            const btnProfile = document.createElement('button');
            btnProfile.className = 'btn-tabela';
            btnProfile.style.width = '100%'; btnProfile.style.justifyContent = 'center'; btnProfile.style.padding = '12px'; btnProfile.style.borderRadius = '50px';
            btnProfile.style.background = '#f0fdf4'; btnProfile.style.color = '#166534'; btnProfile.style.border = '1px solid #bbf7d0';
            btnProfile.innerHTML = 'Ver Perfil Público 🔗';
            btnProfile.onclick = () => window.open(`/${psy.slug}`, '_blank');
            actionsContainer.appendChild(btnProfile);
        }

        // 3. WhatsApp
        if (psy.telefone) {
            const btnZap = document.createElement('button');
            btnZap.className = 'btn-tabela';
            btnZap.style.width = '100%'; btnZap.style.justifyContent = 'center'; btnZap.style.padding = '12px'; btnZap.style.borderRadius = '50px';
            btnZap.style.background = '#e0f2fe'; btnZap.style.color = '#0369a1'; btnZap.style.border = '1px solid #bae6fd';
            btnZap.innerHTML = 'Chamar no WhatsApp 📱';
            btnZap.onclick = async () => {
                const tel = String(psy.telefone).replace(/\D/g, '');
                const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                
                let whatsappUrl = `https://wa.me/55${tel}`;
                
                if (psy.status === 'pending') {
                    const firstName = psy.nome ? psy.nome.split(' ')[0] : 'Psicólogo(a)';
                    const copyMsg = `Olá, ${firstName}! Tudo bem? Aqui é o Anderson, da Yelo. 🌿\n\nVi que você deu o primeiro passo e iniciou o seu cadastro na nossa plataforma, mas acabou não finalizando o preenchimento do seu perfil. Eu sei bem que a rotina de atendimentos acaba engolindo o nosso tempo, né? rs\n\nPassei só para te lembrar que os seus 14 dias de teste gratuito (sem precisar cadastrar cartão de crédito) só começam a contar *depois* que o seu perfil estiver completo e a sua página disponível para receber pacientes! \n\nÉ a oportunidade perfeita para você testar na prática como a plataforma te conecta com pacientes direto no seu WhatsApp, lembrando que a gente não cobra nenhuma taxa ou comissão pelas suas sessões.\n\nFalta bem pouco para o seu perfil ficar ativo nas buscas. Se precisar de uma mãozinha para preencher a sua bio ou tiver qualquer dúvida, é só me dar um toque respondendo esta mensagem. Sigo super à disposição por aqui!`;
                    
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
                        
                        let pReminders = JSON.parse(localStorage.getItem('yelo_psi_pending_reminder') || '[]');
                        if (!pReminders.includes(String(psy.id))) {
                            pReminders.push(String(psy.id));
                            localStorage.setItem('yelo_psi_pending_reminder', JSON.stringify(pReminders));
                        }
                        const nameEl = document.getElementById(`name-psy-${psy.id}`);
                        if (nameEl && !nameEl.innerHTML.includes('✉️')) {
                            nameEl.innerHTML += '<span class="badge-pending" title="Lembrete Enviado" style="margin-left: 5px; font-size: 0.8rem;">✉️</span>';
                        }
                        
                        if(window.showToast) window.showToast("Mensagem de perfil incompleto copiada!", "success");
                    } catch(e) {
                        console.log("Erro ao copiar", e);
                    }
                    
                    whatsappUrl += `?text=${encodeURIComponent(copyMsg)}`;
                }

                if (isMobile) window.location.href = whatsappUrl;
                else window.open(whatsappUrl, '_blank');
                
                try {
                    fetch(`${API_BASE_URL}/api/admin/psychologists/${psy.id}/analyzed`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
                    });
                } catch(e) {}
                
                // Em vez de remover a linha, apenas atualiza visualmente com o emoji de contatado
                const nameEl = document.getElementById(`name-psy-${psy.id}`);
                if (nameEl && !nameEl.innerHTML.includes('✉️') && !nameEl.innerHTML.includes('📱')) {
                    nameEl.innerHTML += '<span class="badge-pending" title="Contato Realizado" style="margin-left: 5px; font-size: 0.8rem;">📱</span>';
                }
            };
            actionsContainer.appendChild(btnZap);
        }

        // 4. Copiar para Análise (IA)
        const btnCopy = document.createElement('button');
        btnCopy.className = 'btn-tabela';
        btnCopy.id = `btn-analise-${psy.id}`;
        
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
        
        // --- CONSULTOR IA (PERFORMANCE) ---
        const btnGenAI = document.getElementById('btn-generate-ai');
        const btnSendAI = document.getElementById('btn-send-ai-whatsapp');
        const aiDiagnosisContainer = document.getElementById('ai-diagnosis-container');
        const aiDiagnosisText = document.getElementById('ai-diagnosis-text');
        const aiCopyText = document.getElementById('ai-copy-text');

        if (btnGenAI) {
            // Reset state
            btnGenAI.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon></svg> Gerar Diagnóstico`;
            btnGenAI.disabled = false;
            btnSendAI.style.display = 'none';
            aiDiagnosisContainer.style.display = 'none';
            aiCopyText.textContent = '';
            aiDiagnosisText.textContent = '';

            btnGenAI.onclick = async () => {
                btnGenAI.disabled = true;
                btnGenAI.innerHTML = '<span class="loading-spinner-sm" style="width:14px; height:14px; margin-right:5px; border-width:2px; display:inline-block;"></span> Gerando...';
                
                try {
                    const res = await fetch(`${API_BASE_URL}/api/admin/psychologists/${psy.id}/ai-diagnosis`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    const data = await res.json();
                    
                    if (!res.ok) throw new Error(data.error || 'Erro na IA');

                    aiDiagnosisContainer.style.display = 'block';
                    aiDiagnosisText.textContent = data.diagnosis;
                    aiCopyText.textContent = data.whatsappCopy;

                    btnGenAI.innerHTML = '✨ Diagnóstico Atualizado';
                    btnGenAI.disabled = false;
                    
                    btnSendAI.style.display = 'inline-flex';
                    btnSendAI.onclick = () => {
                        let phone = (psy.telefone || '').replace(/\D/g, '');
                        if (phone && phone.length === 11 && !phone.startsWith('55')) phone = '55' + phone;
                        
                        let whatsappUrl = '';
                        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                        if (isMobile) {
                            whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(data.whatsappCopy)}`;
                        } else {
                            whatsappUrl = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(data.whatsappCopy)}`;
                        }
                        window.open(whatsappUrl, '_blank');
                    };
                } catch (err) {
                    console.error(err);
                    alert('Erro ao gerar diagnóstico: ' + err.message);
                    btnGenAI.disabled = false;
                    btnGenAI.innerHTML = 'Tentar Novamente';
                }
            };
        }
        
    } catch (err) {
        console.error('Erro ao abrir CS Drawer:', err);
        alert('Erro ao carregar detalhes do usuário.');
    }
};

window.gerarAnaliseCS = async function(psiId) {
    const API_BASE_URL = window.API_BASE_URL || '';
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

            try {
                await fetch(`${API_BASE_URL}/api/admin/psychologists/${psiId}/analyzed`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ isProfileAnalyzed: true })
                });
            } catch (e) {
                console.warn("Falha ao salvar marcação", e);
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
