window.initializePage = function() {
    const params = new URLSearchParams(window.pageQueryString);
    const psyId = params.get('id');

    if (!psyId) {
        alert("ID do psicólogo não fornecido.");
        navigateToPage('admin_crm_psicologos.html');
        return;
    }

    loadPsychologistDetails(psyId);

    // Função global para troca de abas
    window.switchDetailTab = function(tabName) {
        document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
        document.querySelectorAll('.details-tabs .tab-btn').forEach(el => el.classList.remove('active'));
        
        document.getElementById(`tab-${tabName}`).style.display = 'block';
        // Encontra o botão que chamou a função (hack simples) ou usa seletor
        const btn = Array.from(document.querySelectorAll('.details-tabs .tab-btn'))
            .find(b => b.getAttribute('onclick').includes(tabName));
        if(btn) btn.classList.add('active');
    };
};

async function loadPsychologistDetails(id) {
    const loading = document.getElementById('psy-details-loading');
    const content = document.getElementById('psy-details-content');
    
    try {
        const token = localStorage.getItem('Yelo_token');
        // NOTA: Esta rota precisará ser criada no backend
        const response = await fetch(`${API_BASE_URL}/api/admin/psychologists/${id}/full-details`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Erro ao carregar detalhes.');

        const data = await response.json();
        renderDetails(data);

        loading.style.display = 'none';
        content.style.display = 'block';

    } catch (error) {
        console.error(error);
        loading.innerHTML = `<p style="color:red">Erro ao carregar dados: ${error.message}</p>`;
    }
}

function renderDetails(data) {
    const p = data.psychologist;
    const stats = data.stats || {};

    // 1. Header Info
    document.getElementById('detail-nome').textContent = p.nome;
    document.getElementById('detail-crp').textContent = `CRP: ${p.crp || 'N/A'}`;
    document.getElementById('detail-email').textContent = p.email;
    document.getElementById('detail-telefone').textContent = p.telefone || 'N/A';
    document.getElementById('detail-local').textContent = `${p.cidade || ''} - ${p.estado || ''}`;
    document.getElementById('detail-data').textContent = new Date(p.createdAt).toLocaleDateString('pt-BR');
    
    if(p.fotoUrl) document.getElementById('detail-foto').src = p.fotoUrl;

    // Status e Plano
    const statusEl = document.getElementById('detail-status');
    
    let detailStatusLabel = (p.status || 'inativo').toUpperCase();
    if (p.status === 'active') {
        if (p.is_exempt) {
            detailStatusLabel = 'VIP';
        } else if (!p.subscriptionId && p.planExpiresAt && new Date(p.planExpiresAt) > new Date()) {
            detailStatusLabel = 'TRIAL';
        } else {
            detailStatusLabel = 'ATIVO';
        }
    } else if (p.status === 'pending') {
        detailStatusLabel = 'INCOMPLETO';
    } else if (p.status === 'inactive') {
        detailStatusLabel = 'EXPIRADO';
    }
    
    statusEl.textContent = detailStatusLabel;
    statusEl.className = `status-badge status-${p.status || 'inactive'}`;

    const planEl = document.getElementById('detail-plano');
    planEl.textContent = p.plano || 'Sem Plano';
    if(p.is_exempt) planEl.textContent += ' (VIP)';

    // Vencimento da Assinatura
    const vencimentoEl = document.getElementById('detail-vencimento');
    if (vencimentoEl) {
        if (p.is_exempt) {
            vencimentoEl.innerHTML = '<span class="status-badge" style="background:#FFD700; color:#000;">Isento (VIP)</span>';
        } else if (p.planExpiresAt) {
            const vencimento = new Date(p.planExpiresAt);
            if (vencimento.getFullYear() < 2000) {
                vencimentoEl.innerHTML = `<span style="color:#d32f2f; font-weight:bold;">Expirado</span>`;
            } else {
                const dataFormatada = vencimento.toLocaleDateString('pt-BR');
                if (vencimento < new Date()) {
                    vencimentoEl.innerHTML = `<span style="color:#d32f2f; font-weight:bold;">${dataFormatada} (Vencida)</span>`;
                } else {
                    vencimentoEl.textContent = dataFormatada;
                }
            }
        } else {
            vencimentoEl.textContent = 'Sem assinatura';
        }
    }

    // Botão de Ver Perfil Público
    const btnVerPerfil = document.getElementById('btn-ver-perfil-publico');
    if (btnVerPerfil) {
        if (p.slug) {
            btnVerPerfil.style.display = 'inline-flex';
            btnVerPerfil.onclick = () => window.open(`/${p.slug}`, '_blank');
        } else {
            btnVerPerfil.style.display = 'none';
        }
    }

    // UTMs
    const utmSourceEl = document.getElementById('detail-utm-source');
    const utmMediumEl = document.getElementById('detail-utm-medium');
    const utmCampaignEl = document.getElementById('detail-utm-campaign');
    const utmContentEl = document.getElementById('detail-utm-content');
    
    if (utmSourceEl) utmSourceEl.textContent = p.utm_source || 'Orgânico / Desconhecido';
    if (utmMediumEl) utmMediumEl.textContent = p.utm_medium || '-';
    if (utmCampaignEl) utmCampaignEl.textContent = p.utm_campaign || '-';
    if (utmContentEl) utmContentEl.textContent = p.utm_content || '-';

    // 2. Stats
    const views = stats.profileViews || 0;
    const whatsappClicks = stats.whatsappClicks || 0;
    
    document.getElementById('stat-views').textContent = views;
    document.getElementById('stat-matches').textContent = stats.matches || 0;
    document.getElementById('stat-whatsapp').textContent = whatsappClicks;
    
    // PLG Conversions
    const logs = data.whatsappLogs || [];
    let agendados = 0;
    logs.forEach(l => {
        if (l.dealClosed === 'yes' || l.dealClosed === 'started') {
            agendados++;
        }
    });
    const conversaoPlgEl = document.getElementById('stat-conversao-plg');
    if (conversaoPlgEl) conversaoPlgEl.textContent = agendados;

    document.getElementById('stat-blog').textContent = data.blogPosts?.length || 0;
    document.getElementById('stat-forum').textContent = stats.forumActivities || ((data.forumPosts?.length || 0) + (data.forumComments?.length || 0));

    // 3. Timeline (Juntando tudo e ordenando)
    renderTimeline(data);

    // 4. Listas Específicas
    renderList('blog-list', data.blogPosts, renderBlogItem);
    renderList('forum-list', [...(data.forumPosts || []), ...(data.forumComments || [])], renderForumItem);
    renderList('reviews-list', data.reviews, renderReviewItem);
    renderList('whatsapp-list', data.whatsappLogs, renderWhatsappLogItem);
    renderPaymentsTab(data);
}

function renderTimeline(data) {
    const container = document.getElementById('timeline-list');
    const events = [];

    // Normaliza eventos
    if(data.blogPosts) data.blogPosts.forEach(x => events.push({ type: 'blog', date: x.createdAt || x.created_at, data: x }));
    if(data.forumPosts) data.forumPosts.forEach(x => events.push({ type: 'forum_post', date: x.createdAt, data: x }));
    if(data.forumComments) data.forumComments.forEach(x => events.push({ type: 'forum_comment', date: x.createdAt, data: x }));
    if(data.reviews) data.reviews.forEach(x => events.push({ type: 'review', date: x.createdAt, data: x }));
    if(data.matches) data.matches.forEach(x => events.push({ type: 'match', date: x.createdAt, data: x }));
    
    // Ordena decrescente (mais recentes primeiro)
    events.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Limita a linha do tempo às últimas 10 atividades
    const latestEvents = events.slice(0, 10);

    if(latestEvents.length === 0) {
        container.innerHTML = '<p class="empty-state">Nenhuma atividade recente.</p>';
        return;
    }

    container.innerHTML = latestEvents.map(e => {
        const dateStr = new Date(e.date).toLocaleString('pt-BR');
        let icon = '•';
        let title = '';
        let desc = '';
        let colorClass = '';

        switch(e.type) {
            case 'blog':
                icon = '📝'; title = 'Publicou um Artigo'; 
                desc = e.data.titulo; colorClass = 'evt-blog';
                break;
            case 'forum_post':
                icon = '💬'; title = 'Criou Tópico no Fórum'; 
                desc = e.data.title || 'Sem título'; colorClass = 'evt-forum';
                break;
            case 'forum_comment':
                icon = '↩️'; title = 'Respondeu no Fórum'; 
                desc = `Em: ${e.data.postTitle || 'tópico'}`; colorClass = 'evt-forum';
                break;
            case 'review':
                icon = '⭐'; title = 'Recebeu Avaliação'; 
                desc = `Nota: ${e.data.rating || e.data.nota}`; colorClass = 'evt-review';
                break;
            case 'match':
            {
                icon = '🎯'; title = 'Apareceu em Busca (Match)'; 
                let tags = 'N/A';
                if (e.data.matchTags) {
                    if (Array.isArray(e.data.matchTags)) tags = e.data.matchTags.join(', ');
                    else if (typeof e.data.matchTags === 'string') tags = e.data.matchTags;
                }
                desc = `Tags: ${tags}`; colorClass = 'evt-match';
                break;
            }
        }

        return `
            <div class="timeline-item ${colorClass}">
                <div class="tl-icon">${icon}</div>
                <div class="tl-content">
                    <span class="tl-date">${dateStr}</span>
                    <h4>${title}</h4>
                    <p>${desc}</p>
                </div>
            </div>
        `;
    }).join('');
    
    if (events.length > 10) {
        container.innerHTML += `<div style="text-align: center; margin-top: 15px; color: #94a3b8; font-size: 0.85rem;">Mostrando as 10 atividades mais recentes (de um total de ${events.length}).</div>`;
    }
}

function renderList(containerId, items, renderFn) {
    const container = document.getElementById(containerId);
    if (!items || items.length === 0) return; // Mantém empty state padrão
    container.innerHTML = items.map(renderFn).join('');
}

function renderBlogItem(post) {
    return `
        <div class="content-card">
            <h4>${post.titulo || post.title || 'Artigo'}</h4>
            <p>Publicado em: ${new Date(post.createdAt || post.created_at || new Date()).toLocaleDateString('pt-BR')}</p>
            <a href="/blog/post/${post.slug || post.id}" target="_blank">Ver Post</a>
        </div>
    `;
}

function formatDateTimeBR(dateInput) {
    if (!dateInput) return '-';
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatDateBR(dateInput) {
    if (!dateInput) return '-';
    if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
        const [y, m, d] = dateInput.split('-');
        return `${d}/${m}/${y}`;
    }
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

function getExpiryCountdown(dateInput) {
    if (!dateInput) return null;
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return null;

    if (d.getUTCFullYear() >= 2090) {
        return { isPerpetual: true, isExpired: false, days: 9999, text: 'Vitalício' };
    }

    const now = new Date();
    const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const expDate = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const diffMs = expDate.getTime() - today.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
        const absDays = Math.abs(diffDays);
        return {
            isPerpetual: false,
            isExpired: true,
            days: absDays,
            text: absDays === 1 ? 'Expirou ontem' : `Expirou há ${absDays} dias`
        };
    } else if (diffDays === 0) {
        return {
            isPerpetual: false,
            isExpired: false,
            days: 0,
            text: 'Vence hoje'
        };
    } else if (diffDays === 1) {
        return {
            isPerpetual: false,
            isExpired: false,
            days: 1,
            text: 'Vence amanhã'
        };
    } else {
        return {
            isPerpetual: false,
            isExpired: false,
            days: diffDays,
            text: `Vence em ${diffDays} dias`
        };
    }
}

function renderPaymentsTab(data) {
    const p = data.psychologist || {};
    const sub = data.subscription || {};
    const asaasSub = data.asaasSubscription || {};
    const payments = data.payments || [];

    const expiryInfo = getExpiryCountdown(p.planExpiresAt || asaasSub.nextDueDate);

    // 1. Banner de Status e Cancelamento
    renderPaymentStatusBanner(p, sub, asaasSub, expiryInfo);

    // 2. Banner de Falha no Gateway
    renderPaymentFailureBanner(data.asaasFailedReason, data.asaasFailedBillingType);

    // 3. Grid de KPIs
    renderPaymentKpis(p, sub, asaasSub, payments, expiryInfo);

    // 4. Contador de faturas
    const badgeEl = document.getElementById('payments-count-badge');
    if (badgeEl) {
        badgeEl.textContent = `${payments.length} ${payments.length === 1 ? 'fatura' : 'faturas'}`;
    }

    // 5. Lista de faturas
    renderList('payments-list', payments, renderPaymentItem);
}

function renderPaymentStatusBanner(p, sub, asaasSub, expiryInfo) {
    const bannerEl = document.getElementById('payment-status-banner');
    if (!bannerEl) return;

    const isCancelScheduled = p.cancelAtPeriodEnd === true || p.cancelAtPeriodEnd === 'true' || !!p.canceledAt;
    const dataVencimento = p.planExpiresAt ? formatDateBR(p.planExpiresAt) : (asaasSub.nextDueDate ? formatDateBR(asaasSub.nextDueDate) : 'Indeterminado');
    const dataCancelamento = p.canceledAt ? formatDateTimeBR(p.canceledAt) : 'Registrado no sistema';

    // Caso 1: Renovação Automática Cancelada
    if (isCancelScheduled) {
        const isExpired = expiryInfo && expiryInfo.isExpired;
        const tagHtml = isExpired
            ? `<span class="payment-tag payment-tag-danger">⚠️ Acesso Expirado (${expiryInfo.text})</span>`
            : `<span class="payment-tag payment-tag-warning">⏳ Restam ${expiryInfo.days} dias de acesso</span>`;

        const descHtml = isExpired
            ? `O psicólogo solicitou o cancelamento da renovação automática e o período de acesso pago foi encerrado em <strong>${dataVencimento}</strong>. Nenhuma nova cobrança será realizada pelo gateway e o perfil foi inativado na plataforma.`
            : `O psicólogo solicitou o cancelamento da renovação automática. Seu plano permanecerá <strong>ativo com todos os benefícios até ${dataVencimento}</strong>. Após esse vencimento, nenhuma nova cobrança será emitida e o perfil passará para inativo.`;

        bannerEl.innerHTML = `
            <div class="payment-banner payment-banner-danger">
                <div class="payment-banner-icon">🛑</div>
                <div class="payment-banner-body">
                    <div class="payment-banner-title">
                        <span>Renovação Automática Cancelada</span>
                        ${tagHtml}
                    </div>
                    <p class="payment-banner-desc">${descHtml}</p>
                    <div class="payment-banner-meta">
                        <span>📅 <strong>Data do Cancelamento:</strong> ${dataCancelamento}</span>
                        <span>⏳ <strong>Acesso Válido Até:</strong> ${dataVencimento}</span>
                        ${p.subscriptionId ? `<span>🆔 <strong>Assinatura Asaas:</strong> ${p.subscriptionId}</span>` : ''}
                    </div>
                </div>
            </div>
        `;
        return;
    }

    // Caso 2: Conta VIP / Isenta
    if (p.is_exempt) {
        bannerEl.innerHTML = `
            <div class="payment-banner payment-banner-gold">
                <div class="payment-banner-icon">⭐</div>
                <div class="payment-banner-body">
                    <div class="payment-banner-title">
                        <span>Conta Isenta (VIP)</span>
                        <span class="payment-tag payment-tag-warning">Acesso Permanente</span>
                    </div>
                    <p class="payment-banner-desc">
                        Este profissional possui isenção vitalícia de mensalidade autorizada pela administração da Yelo. Não são emitidas faturas recorrentes no gateway.
                    </p>
                </div>
            </div>
        `;
        return;
    }

    // Caso 3: Assinatura Recorrente Ativa (Renovação Automática Ligada)
    if ((p.subscriptionId || asaasSub.id) && p.status === 'active') {
        const valorPlano = asaasSub.value 
            ? `R$ ${parseFloat(asaasSub.value).toFixed(2).replace('.', ',')}` 
            : (p.valor_mensal_numero ? `R$ ${p.valor_mensal_numero},00` : '');
        
        let formaCobranca = 'Gateway Asaas';
        if (asaasSub.billingType === 'CREDIT_CARD' || (!asaasSub.billingType && p.subscriptionId)) {
            formaCobranca = 'Cartão de Crédito';
            if (asaasSub.creditCard?.creditCardBrand) {
                formaCobranca += ` (${asaasSub.creditCard.creditCardBrand} **** ${asaasSub.creditCard.creditCardNumber || ''})`;
            }
        } else if (asaasSub.billingType === 'PIX') {
            formaCobranca = 'PIX Recorrente';
        }

        bannerEl.innerHTML = `
            <div class="payment-banner payment-banner-success">
                <div class="payment-banner-icon">🔄</div>
                <div class="payment-banner-body">
                    <div class="payment-banner-title">
                        <span>Assinatura Recorrente Ativa</span>
                        <span class="payment-tag payment-tag-success">Renovação Automática Ligada</span>
                    </div>
                    <p class="payment-banner-desc">
                        A assinatura está ativa e as cobranças são processadas automaticamente a cada ciclo. A próxima renovação está programada para <strong>${dataVencimento}</strong> ${expiryInfo ? `(${expiryInfo.text})` : ''}.
                    </p>
                    <div class="payment-banner-meta">
                        <span>📅 <strong>Próximo Vencimento:</strong> ${dataVencimento}</span>
                        ${valorPlano ? `<span>💵 <strong>Valor:</strong> ${valorPlano}</span>` : ''}
                        <span>💳 <strong>Cobrança:</strong> ${formaCobranca}</span>
                        <span>🆔 <strong>Assinatura:</strong> ${p.subscriptionId || asaasSub.id}</span>
                    </div>
                </div>
            </div>
        `;
        return;
    }

    // Caso 4: Período de Testes (Trial)
    if (!p.subscriptionId && p.planExpiresAt && (!expiryInfo || !expiryInfo.isExpired)) {
        bannerEl.innerHTML = `
            <div class="payment-banner payment-banner-info">
                <div class="payment-banner-icon">⏳</div>
                <div class="payment-banner-body">
                    <div class="payment-banner-title">
                        <span>Período de Teste Gratuito (Trial)</span>
                        <span class="payment-tag payment-tag-info">${expiryInfo ? expiryInfo.text : 'Em andamento'}</span>
                    </div>
                    <p class="payment-banner-desc">
                        O psicólogo está testando a plataforma gratuitamente. O período promocional termina em <strong>${dataVencimento}</strong>. Ainda não possui cartão vinculado ou assinatura formalizada.
                    </p>
                    <div class="payment-banner-meta">
                        <span>📅 <strong>Vencimento do Teste:</strong> ${dataVencimento}</span>
                        <span>🎁 <strong>Modalidade:</strong> Degustação Gratuita</span>
                    </div>
                </div>
            </div>
        `;
        return;
    }

    // Caso 5: Expirado / Vencido
    if (expiryInfo && expiryInfo.isExpired) {
        bannerEl.innerHTML = `
            <div class="payment-banner payment-banner-warning">
                <div class="payment-banner-icon">⚠️</div>
                <div class="payment-banner-body">
                    <div class="payment-banner-title">
                        <span>Plano Vencido / Inadimplente</span>
                        <span class="payment-tag payment-tag-danger">${expiryInfo.text}</span>
                    </div>
                    <p class="payment-banner-desc">
                        O período de acesso pago do profissional expirou em <strong>${dataVencimento}</strong>. Sem renovação automática ativa, o perfil foi suspenso das buscas públicas.
                    </p>
                    <div class="payment-banner-meta">
                        <span>📅 <strong>Venceu em:</strong> ${dataVencimento}</span>
                        <span>🛑 <strong>Status Atual:</strong> ${p.status || 'inactive'}</span>
                    </div>
                </div>
            </div>
        `;
        return;
    }

    // Fallback: Sem assinatura
    bannerEl.innerHTML = `
        <div class="payment-banner payment-banner-info">
            <div class="payment-banner-icon">ℹ️</div>
            <div class="payment-banner-body">
                <div class="payment-banner-title">
                    <span>Sem Assinatura Ativa</span>
                    <span class="payment-tag payment-tag-neutral">Nenhum Plano</span>
                </div>
                <p class="payment-banner-desc">
                    O profissional não possui histórico de assinatura ou plano contratado na plataforma.
                </p>
            </div>
        </div>
    `;
}

function renderPaymentFailureBanner(reason, billingType) {
    const bannerEl = document.getElementById('payment-failure-banner');
    if (!bannerEl) return;

    if (!reason) {
        bannerEl.style.display = 'none';
        bannerEl.innerHTML = '';
        return;
    }

    bannerEl.style.display = 'block';
    bannerEl.innerHTML = `
        <div class="payment-banner payment-banner-danger">
            <div class="payment-banner-icon">⚠️</div>
            <div class="payment-banner-body">
                <div class="payment-banner-title">
                    <span>Alerta do Gateway: Última Tentativa de Cobrança Falhou</span>
                    <span class="payment-tag payment-tag-danger">${billingType === 'PIX' ? 'PIX' : 'Cartão de Crédito'}</span>
                </div>
                <p class="payment-banner-desc" style="font-weight: 600; color: #b91c1c;">
                    Motivo reportado pelo Asaas: "${reason}"
                </p>
                <div class="payment-banner-meta">
                    <span>💡 Ação sugerida: Enviar lembrete via WhatsApp no CRM para atualização dos dados de pagamento.</span>
                </div>
            </div>
        </div>
    `;
}

function renderPaymentKpis(p, sub, asaasSub, payments, expiryInfo) {
    const gridEl = document.getElementById('payment-kpi-grid');
    if (!gridEl) return;

    // 1. Plano e Valor
    const planoNome = p.plano || sub.plan || 'Sem Plano';
    let planoValor = '';
    if (p.is_exempt) {
        planoValor = 'Isento (VIP)';
    } else if (asaasSub.value) {
        planoValor = `R$ ${parseFloat(asaasSub.value).toFixed(2).replace('.', ',')} / mês`;
    } else if (p.valor_mensal_numero) {
        planoValor = `R$ ${p.valor_mensal_numero},00 / mês`;
    } else {
        planoValor = 'Sem valor mensal';
    }

    // 2. Vencimento
    const dataVenc = p.planExpiresAt ? formatDateBR(p.planExpiresAt) : (asaasSub.nextDueDate ? formatDateBR(asaasSub.nextDueDate) : '-');
    const vencSubtitle = expiryInfo ? expiryInfo.text : 'Sem data definida';

    // 3. Renovação Automática
    const isCancelScheduled = p.cancelAtPeriodEnd === true || p.cancelAtPeriodEnd === 'true' || !!p.canceledAt;
    let renovacaoValor = '';
    let renovacaoSub = '';
    if (isCancelScheduled) {
        renovacaoValor = '<span style="color: #dc2626;">Cancelada 🚫</span>';
        renovacaoSub = p.canceledAt ? `Cancelado em ${formatDateBR(p.canceledAt)}` : 'Cancelamento agendado';
    } else if (p.is_exempt) {
        renovacaoValor = '<span style="color: #ca8a04;">Isento ⭐</span>';
        renovacaoSub = 'Acesso cortesia';
    } else if (p.subscriptionId || asaasSub.id) {
        renovacaoValor = '<span style="color: #16a34a;">Ativa ✅</span>';
        renovacaoSub = `Próx. débito: ${dataVenc}`;
    } else if (p.planExpiresAt && (!expiryInfo || !expiryInfo.isExpired)) {
        renovacaoValor = '<span style="color: #2563eb;">Trial ⏳</span>';
        renovacaoSub = 'Degustação gratuita';
    } else {
        renovacaoValor = '<span style="color: #64748b;">Desativada</span>';
        renovacaoSub = 'Sem recorrência';
    }

    // 4. Gateway ID
    const gatewaySubId = p.subscriptionId || asaasSub.id || sub.id || 'N/A';
    const gatewayCustId = sub.asaasCustomerId || '-';

    // 5. Ciclos Pagos
    let faturasPagasCount = 0;
    let totalPagoSoma = 0;
    payments.forEach(pm => {
        if (pm.status === 'RECEIVED' || pm.status === 'CONFIRMED' || pm.status === 'paid') {
            faturasPagasCount++;
            totalPagoSoma += parseFloat(pm.value || 0);
        }
    });
    const ciclosCount = p.subscription_payments_count || faturasPagasCount;

    // 6. LTV
    const ltvFinal = p.lifetimeRevenue && p.lifetimeRevenue > 0 ? p.lifetimeRevenue : totalPagoSoma;
    const ltvFormatado = parseFloat(ltvFinal || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const dataPrimeiroPgto = p.firstPaidAt ? formatDateBR(p.firstPaidAt) : (p.subscribedAt ? formatDateBR(p.subscribedAt) : '-');

    gridEl.innerHTML = `
        <div class="payment-kpi-card">
            <div class="payment-kpi-header">
                <span class="payment-kpi-title">Plano Contratado</span>
                <span class="payment-kpi-icon">📦</span>
            </div>
            <div class="payment-kpi-value">${planoNome}</div>
            <div class="payment-kpi-subtitle">${planoValor}</div>
        </div>

        <div class="payment-kpi-card">
            <div class="payment-kpi-header">
                <span class="payment-kpi-title">Vencimento do Acesso</span>
                <span class="payment-kpi-icon">📅</span>
            </div>
            <div class="payment-kpi-value">${dataVenc}</div>
            <div class="payment-kpi-subtitle">
                <span style="font-weight: 600; color: ${expiryInfo?.isExpired ? '#dc2626' : '#166534'};">${vencSubtitle}</span>
            </div>
        </div>

        <div class="payment-kpi-card">
            <div class="payment-kpi-header">
                <span class="payment-kpi-title">Renovação Automática</span>
                <span class="payment-kpi-icon">🔄</span>
            </div>
            <div class="payment-kpi-value">${renovacaoValor}</div>
            <div class="payment-kpi-subtitle">${renovacaoSub}</div>
        </div>

        <div class="payment-kpi-card">
            <div class="payment-kpi-header">
                <span class="payment-kpi-title">ID Assinatura (Asaas)</span>
                <span class="payment-kpi-icon">💳</span>
            </div>
            <div class="payment-kpi-value" style="font-size: 1rem; font-family: monospace;">${gatewaySubId}</div>
            <div class="payment-kpi-subtitle">Cliente: <span style="font-family: monospace;">${gatewayCustId}</span></div>
        </div>

        <div class="payment-kpi-card">
            <div class="payment-kpi-header">
                <span class="payment-kpi-title">Mensalidades Pagas</span>
                <span class="payment-kpi-icon">📈</span>
            </div>
            <div class="payment-kpi-value">${ciclosCount} ${ciclosCount === 1 ? 'mês' : 'meses'}</div>
            <div class="payment-kpi-subtitle">Total de faturas: ${payments.length}</div>
        </div>

        <div class="payment-kpi-card">
            <div class="payment-kpi-header">
                <span class="payment-kpi-title">Receita Total (LTV)</span>
                <span class="payment-kpi-icon">💰</span>
            </div>
            <div class="payment-kpi-value" style="color: #166534;">${ltvFormatado}</div>
            <div class="payment-kpi-subtitle">1º Pagamento: ${dataPrimeiroPgto}</div>
        </div>
    `;
}

function renderPaymentItem(payment) {
    const dataVenc = payment.dueDate ? formatDateBR(payment.dueDate) : 'N/A';
    const dataPag = payment.paymentDate ? formatDateBR(payment.paymentDate) : 'Pendente';
    const valor = parseFloat(payment.value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    
    let badgeClass = 'status-pending';
    let badgeText = payment.status || 'PENDENTE';
    const stUpper = String(payment.status || '').toUpperCase();

    if (stUpper === 'RECEIVED' || stUpper === 'CONFIRMED' || stUpper === 'PAID') {
        badgeClass = 'status-active';
        badgeText = 'Pago';
    } else if (stUpper === 'OVERDUE' || stUpper === 'FAILED') {
        badgeClass = 'status-cancelada';
        badgeText = 'Atrasado / Falhou';
    } else if (stUpper === 'REFUNDED') {
        badgeClass = 'status-cancelada';
        badgeText = 'Estornado';
    } else if (stUpper === 'CANCELED') {
        badgeClass = 'status-cancelada';
        badgeText = 'Cancelada';
    }

    let tipoIcon = '💳';
    let tipoNome = 'Cartão de Crédito';
    const bType = String(payment.billingType || '').toUpperCase();
    if (bType === 'PIX') {
        tipoIcon = '💠';
        tipoNome = 'PIX';
    } else if (bType === 'BOLETO') {
        tipoIcon = '📄';
        tipoNome = 'Boleto Bancário';
    }

    const cardDetails = payment.creditCardBrand || payment.creditCardNumber
        ? `(${payment.creditCardBrand || ''} **** ${payment.creditCardNumber || ''})`
        : '';

    const linkAsaas = payment.invoiceUrl || payment.bankSlipUrl
        ? `<a href="${payment.invoiceUrl || payment.bankSlipUrl}" target="_blank" rel="noopener noreferrer" style="font-size: 0.75rem; color: #2563eb; text-decoration: none; font-weight: 600; padding: 4px 10px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px; margin-top: 6px;"><span>🔗</span> Ver no Gateway</a>`
        : '';

    return `
        <div class="payment-invoice-card">
            <div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 1.2rem;">${tipoIcon}</span>
                    <h4 style="margin: 0; color: #1e293b; font-size: 0.95rem;">
                        ${payment.description || `Fatura ${tipoNome}`} <span style="font-weight: 400; color: #64748b; font-size: 0.85rem;">${cardDetails}</span>
                    </h4>
                </div>
                <p style="margin: 6px 0 0 0; color: #64748b; font-size: 0.85rem;">
                    Vencimento: <strong>${dataVenc}</strong> | Pagamento: <strong>${dataPag}</strong> | <span style="font-family: monospace; font-size: 0.8rem; color: #94a3b8;">${payment.id}</span>
                </p>
                ${linkAsaas}
            </div>
            <div style="text-align: right; flex-shrink: 0;">
                <div style="font-size: 1.15rem; font-weight: 700; color: #0f172a;">${valor}</div>
                <span class="status ${badgeClass}" style="margin-top: 6px; display: inline-block;">${badgeText}</span>
            </div>
        </div>
    `;
}

function renderForumItem(item) {
    const isPost = Object.prototype.hasOwnProperty.call(item, 'title');
    const titulo = item.title || item.postTitle || 'Fórum';
    const conteudo = item.content || item.texto || '';
    const resumo = conteudo.length > 100 ? conteudo.substring(0, 100) + '...' : conteudo;
    return `
        <div class="content-card">
            <h4>${isPost ? 'Tópico: ' + titulo : 'Comentário em: ' + titulo}</h4>
            <p>${resumo}</p>
            <small>${new Date(item.createdAt).toLocaleDateString()}</small>
        </div>
    `;
}

function renderReviewItem(review) {
    const nota = review.rating || review.nota || 0;
    const comentario = review.comment || review.comentario || 'Sem comentário';
    const autor = review.patient?.nome || review.autor || 'Anônimo';
    return `
        <div class="content-card">
            <div class="review-stars">${'★'.repeat(nota)}${'☆'.repeat(5-nota)}</div>
            <p>"${comentario}"</p>
            <small>Por: ${autor} em ${new Date(review.createdAt).toLocaleDateString()}</small>
        </div>
    `;
}

function renderWhatsappLogItem(log) {
    const nome = log.guestName || 'Anônimo / Não informado';
    let badges = '';
    
    if (log.feedbackGiven) {
        if (['yes', 'started'].includes(log.dealClosed)) {
            badges += `<span style="background: #dcfce7; color: #166534; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem; font-weight: bold; margin-left: 5px;">✅ Agendou</span>`;
        } else if (log.dealClosed === 'talking') {
            badges += `<span style="background: #ffedd5; color: #c2410c; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem; font-weight: bold; margin-left: 5px;">⏳ Em negociação</span>`;
        } else if (['no', 'not_started', 'ghosted'].includes(log.dealClosed) || (log.dealClosed && log.contactReceived)) {
            badges += `<span style="background: #fef9c3; color: #854d0e; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem; font-weight: bold; margin-left: 5px;">💬 Não Agendou</span>`;
        } else {
            badges += `<span style="background: #fee2e2; color: #991b1b; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem; font-weight: bold; margin-left: 5px;">❌ Não Contatou</span>`;
        }
    } else {
        badges += `<span style="background: #f1f5f9; color: #475569; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem; font-weight: bold; margin-left: 5px;">⏳ Sem feedback</span>`;
    }

    return `
        <div class="content-card" style="display: flex; justify-content: space-between; align-items: center;">
            <div>
                <h4 style="margin: 0; font-size: 0.95rem; color: #0f172a;">${nome} ${badges}</h4>
                <p style="margin: 5px 0 0 0; font-size: 0.8rem; color: #64748b;">${new Date(log.createdAt).toLocaleString('pt-BR')}</p>
            </div>
            ${log.guestPhone ? `<a href="https://wa.me/${log.guestPhone.replace(/\D/g, '')}" target="_blank" style="color: #10b981; font-size: 0.8rem; text-decoration: none; font-weight: bold;">WhatsApp</a>` : ''}
        </div>
    `;
}