// Arquivo: psi_dashboard.js (VERSÃO FINAL 2.1)

document.addEventListener('DOMContentLoaded', function() {
    console.log("--- SISTEMA Yelo V2.1 INICIADO ---");
    
    let psychologistData = null; 
    
    // Variável para guardar qual plano o usuário está tentando assinar no modal
    let currentPlanAttempt = '';

    // Variável global temporária para saber qual botão disparou a ação
    let btnReativacaoAtual = null;

    const mainContent = document.getElementById('main-content');
    const toastContainer = document.getElementById('toast-container');

    // --- LÓGICA DE UPLOAD NA SIDEBAR ---
    const sidebarTrigger = document.getElementById('sidebar-photo-trigger');
    const sidebarInput = document.getElementById('sidebar-photo-input');

    if (sidebarTrigger && sidebarInput) {
        sidebarTrigger.onclick = () => sidebarInput.click();

        sidebarInput.onchange = async (e) => {
            if (e.target.files[0]) {
                const fd = new FormData();
                fd.append('foto', e.target.files[0]);
                
                showToast('Atualizando foto...', 'info');

                try {
                    const res = await apiFetch(`${API_BASE_URL}/api/psychologists/me/foto`, { 
                        method: 'POST', body: fd 
                    });
                    if (res.ok) {
                        const d = await res.json();
                        if(psychologistData) psychologistData.fotoUrl = d.fotoUrl;
                        atualizarInterfaceLateral(); // Atualiza a imagem na hora
                        showToast('Foto atualizada!', 'success');
                    }
                } catch (err) {
                    console.error(err);
                    showToast('Erro ao enviar foto.', 'error');
                }
            }
        };
    }

    // --- LÓGICA DO BOTÃO SAIR (LOGOUT) ---
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.onclick = function() {
            // 1. Feedback visual (opcional, mas bom para mobile)
            this.textContent = "Saindo...";
            
            // 2. Remove o "crachá" de acesso (Token)
            localStorage.removeItem('Yelo_token');
            
            // 3. Redireciona imediatamente para o Login
            window.location.href = '../login.html';
        };
    }

    // BOTÃO X FECHAR MODAL (Lógica Global Segura)
    const btnCloseX = document.getElementById('btn-close-modal-x');
    const modalPagamento = document.getElementById('payment-modal');

    if (btnCloseX && modalPagamento) {
        btnCloseX.addEventListener('click', function(e) {
            e.preventDefault();
            modalPagamento.style.setProperty('display', 'none', 'important');
        });
    }
    
    // BOTÃO APLICAR CUPOM (Lógica dentro do Modal)
    const btnAplicarModal = document.getElementById('btn-aplicar-cupom-modal');
    if (btnAplicarModal) {
        btnAplicarModal.addEventListener('click', async (e) => {
            e.preventDefault();
            const cupomVal = document.getElementById('modal-cupom-input').value;
            if(!cupomVal || !currentPlanAttempt) return;

            // Feedback visual
            btnAplicarModal.textContent = "...";
            
            // Reinicia o pagamento com o cupom aplicado
            try {
                // Fechamos o modal visualmente por 1s ou apenas recarregamos o elemento
                await window.iniciarPagamento(currentPlanAttempt, { textContent: '' }, cupomVal);
                // Nota: iniciarPagamento já cuida de remontar o Stripe Element
            } catch (err) {
                console.error(err);
            } finally {
                btnAplicarModal.textContent = "Aplicar";
            }
        });
    }

    // --- CONFIGURAÇÃO STRIPE ---
    let stripe;
    let elements;
    try {
        stripe = Stripe('pk_test_51SWdGOR73Pott0IUw2asi2NZg0DpjAOdziPGvVr8SAmys1VASh2i3EAEpErccZLYHMEWfI9hIq68xL3piRCjsvIa00MkUDANOA');
    } catch (e) { console.error("Erro Stripe:", e); }

    // --- HELPERS E FETCH ---
    function showToast(message, type = 'success') {
        if (!toastContainer) return;
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toastContainer.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
    }

    function formatImageUrl(path) {
        if (!path) return 'https://placehold.co/70x70/1B4332/FFFFFF?text=Psi';
        if (path.startsWith('http')) return path; 
        let cleanPath = path.replace(/\\/g, '/');
        if (cleanPath.includes('uploads/')) cleanPath = cleanPath.substring(cleanPath.lastIndexOf('uploads/'));
        if (!cleanPath.startsWith('/')) cleanPath = '/' + cleanPath;
        return `${API_BASE_URL}${cleanPath}`;
    }

    async function apiFetch(url, options = {}) {
        const token = localStorage.getItem('Yelo_token');
        if (!token) throw new Error("Token não encontrado.");
        const headers = { 'Authorization': `Bearer ${token}`, ...options.headers };
        if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
        const response = await fetch(url, { ...options, headers });
        if (response.status === 401) {
            localStorage.removeItem('Yelo_token');
            window.location.href = '../login.html';
            throw new Error("Sessão expirada.");
        }
        return response;
    }

    async function fetchPsychologistData() {
        const token = localStorage.getItem('Yelo_token');
        if (!token) { window.location.href = '../login.html'; return false; }
        try {
            const response = await fetch(`${API_BASE_URL}/api/psychologists/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                psychologistData = await response.json();
                
                // --- MOCK ATUALIZADO: SIMULANDO PLANO ESSENCIAL ---
                psychologistData.plano = 'ESSENTIAL'; 
                // --------------------------------------------------

                atualizarInterfaceLateral(); 
                return true;
            }
            throw new Error("Token inválido");
        } catch (error) {
            localStorage.removeItem('Yelo_token');
            window.location.href = '../login.html';
            return false;
        }
    }

    function atualizarInterfaceLateral() {
        if (!psychologistData) return;
        const nameEl = document.getElementById('psi-sidebar-name');
        const imgEl = document.getElementById('psi-sidebar-photo');
        if(nameEl) nameEl.textContent = psychologistData.nome;
        if(imgEl) imgEl.src = formatImageUrl(psychologistData.fotoUrl);
        const btnLink = document.getElementById('btn-view-public-profile');
        if(btnLink && psychologistData.slug) btnLink.href = `/${psychologistData.slug}`;
    }

    function loadPage(url) {
        if (!url) return;
        mainContent.innerHTML = '<div style="padding:40px; text-align:center; color:#888;">Carregando...</div>';
        document.querySelectorAll('.sidebar-nav li').forEach(li => li.classList.remove('active'));
        const activeLink = document.querySelector(`.sidebar-nav a[data-page="${url}"]`);
        if (activeLink) activeLink.closest('li').classList.add('active');

        fetch(url).then(r => r.ok ? r.text() : Promise.reject(url))
            .then(html => {
                mainContent.innerHTML = html;
                if (url.includes('meu_perfil')) inicializarLogicaDoPerfil();
                else if (url.includes('visao_geral')) inicializarVisaoGeral();
                else if (url.includes('assinatura')) inicializarAssinatura();
                else if (url.includes('comunidade')) inicializarComunidade(); // Mantém o antigo Q&A
                else if (url.includes('caixa_de_entrada')) inicializarCaixaEntrada();
                else if (url.includes('psi_hub')) inicializarHubComunidade(); 
                else if (url.includes('psi_blog')) inicializarBlog();
            })
            .catch(e => mainContent.innerHTML = `<p>Erro ao carregar: ${e}</p>`);
    }

    // --- LÓGICA DE PAGAMENTO ---

    window.iniciarPagamento = async function(planType, btnElement, cupomForce = null) {
        // Guarda qual plano está sendo tentado para caso use o cupom
        currentPlanAttempt = planType;
        
        // Se btnElement não for um elemento DOM real (chamada via código), simulamos um obj
        const btn = btnElement.tagName ? btnElement : { textContent: '', disabled: false };
        
        const originalText = btn.textContent;
        if(btn.tagName) {
            btn.textContent = "Carregando...";
            btn.disabled = true;
        }

        try {
            // Pega cupom ou do modal ou nulo
            const cupomCodigo = cupomForce || '';

            const res = await apiFetch(`${API_BASE_URL}/api/payments/create-preference`, {
                method: 'POST', body: JSON.stringify({ planType, cupom: cupomCodigo })
            });
            const data = await res.json();

            // Se for cupom 100% que ativa direto (Backend decide)
            if (data.couponSuccess) {
                showToast(data.message, 'success');
                // Fecha modal se estiver aberto
                document.getElementById('payment-modal').style.setProperty('display', 'none', 'important');
                await fetchPsychologistData();
                loadPage('psi_assinatura.html'); // Recarrega para mostrar plano ativo
                return;
            }

            if (data.clientSecret) {
                abrirModalStripe(data.clientSecret);
                if(cupomForce) showToast('Cupom aplicado!', 'success');
            } else {
                throw new Error("Falha ao iniciar pagamento.");
            }
        } catch (error) {
            console.error(error);
            showToast('Erro: ' + error.message, 'error');
        } finally {
            if(btn.tagName) {
                btn.textContent = originalText;
                btn.disabled = false;
            }
        }
    };

    function abrirModalStripe(clientSecret) {
        const modal = document.getElementById('payment-modal');
        const container = document.getElementById('payment-element');
        const form = document.getElementById('payment-form');
        const btnSubmit = document.getElementById('btn-confirmar-stripe');

        if (!modal || !container) return;

        modal.style.display = 'flex';
        modal.style.opacity = 1;
        modal.style.visibility = 'visible';
        container.innerHTML = '';

        const appearance = { theme: 'stripe', labels: 'floating' };
        elements = stripe.elements({ appearance, clientSecret });

        const paymentElement = elements.create('payment', { layout: 'tabs' });
        paymentElement.mount('#payment-element');

        // Impede duplo submit
        form.onsubmit = async (e) => {
            e.preventDefault();
            btnSubmit.disabled = true;
            btnSubmit.textContent = "Processando...";

            const { error } = await stripe.confirmPayment({
                elements,
                confirmParams: {
                    return_url: window.location.href.split('?')[0] + '?status=approved',
                },
            });

            if (error) {
                const messageDiv = document.getElementById('payment-message');
                messageDiv.classList.remove('hidden');
                messageDiv.textContent = error.message;
                messageDiv.style.color = "red";
                btnSubmit.disabled = false;
                btnSubmit.textContent = "Pagar Agora";
            }
        };
    }

    function inicializarAssinatura() {
        const cardResumo = document.getElementById('card-resumo-assinatura');
        const areaCancelamento = document.getElementById('area-cancelamento');
        
        // Verifica se tem plano (agora suportando os novos nomes em maiúsculo vindo do banco)
        const temPlano = psychologistData && psychologistData.plano;
        
        // 1. ATUALIZAÇÃO: Mapeamento dos novos Planos e Preços
        // As chaves devem ser em minúsculo para garantir o match
        const precos = { 
            'essential': 'R$ 99,00', 
            'clinical': 'R$ 159,00', 
            'reference': 'R$ 259,00',
            // Mantendo compatibilidade legada temporária (caso tenha algum perdido no banco)
            'semente': 'R$ 99,00', 'luz': 'R$ 149,00', 'sol': 'R$ 199,00'
        };

        if (temPlano && cardResumo) {
            cardResumo.style.display = 'flex';
            
            // ATUALIZE ESTA LINHA PARA LER O CAMPO NOVO:
            const isCancelado = psychologistData.cancelAtPeriodEnd || psychologistData.cancel_at_period_end || psychologistData.status === 'canceled';

            if (areaCancelamento) {
                areaCancelamento.style.display = isCancelado ? 'none' : 'block';
            }

            // --- BANNER SUPERIOR ---
            // Tradução visual para o usuário (ESSENTIAL -> Essencial)
            const mapNomes = { 'ESSENTIAL': 'Essencial', 'CLINICAL': 'Clínico', 'REFERENCE': 'Referência' };
            const nomeExibicao = mapNomes[psychologistData.plano.toUpperCase()] || psychologistData.plano;

            const elNome = document.getElementById('banner-nome-plano');
            if(elNome) elNome.textContent = `Plano ${nomeExibicao}`;
            
            const planoKey = psychologistData.plano.toLowerCase();
            const elPreco = document.getElementById('banner-preco');
            if(elPreco) elPreco.textContent = `${precos[planoKey] || 'R$ --'} / mês`;

            const elData = document.getElementById('banner-renovacao');
            const elBadge = cardResumo.querySelector('.status-badge');

            let dataDisplay;
            if (psychologistData.planExpiresAt) { // Nova propriedade que criamos no Model
                dataDisplay = new Date(psychologistData.planExpiresAt);
            } else if (psychologistData.subscription_expires_at) { // Legado
                dataDisplay = new Date(psychologistData.subscription_expires_at);
            } else {
                const hoje = new Date();
                dataDisplay = new Date(hoje.setMonth(hoje.getMonth() + 1));
            }
            const dataFormatada = dataDisplay.toLocaleDateString('pt-BR');

            if (isCancelado) {
                if (elData) elData.textContent = `Acesso até: ${dataFormatada}`;
                if (elBadge) elBadge.innerHTML = `<span style="width: 8px; height: 8px; background: #FFC107; border-radius: 50%;"></span> Cancelado`;
            } else {
                if (elData) elData.textContent = `Renova em: ${dataFormatada}`;
                if (elBadge) elBadge.innerHTML = `<span style="width: 8px; height: 8px; background: #4ade80; border-radius: 50%;"></span> Ativo`;
            }

            // Lógica do Modal de Cancelamento (Mantida igual, apenas garantindo funcionamento)
            setupBotaoCancelamento(isCancelado);

        } else {
            if(cardResumo) cardResumo.style.display = 'none';
            if(areaCancelamento) areaCancelamento.style.display = 'none';
        }

        // --- CARDS E BOTÕES ---
        document.querySelectorAll('.plano-card').forEach(card => {
            const btn = card.querySelector('.btn-mudar-plano');
            if (!btn) return;
            
            // 2. ATUALIZAÇÃO: Lê estritamente o atributo novo do HTML (ESSENTIAL, CLINICAL...)
            const planoAlvo = btn.getAttribute('data-plano'); 
            if (!planoAlvo) return; // Se não tiver data-plano, ignora

            card.classList.remove('plano-card--ativo');
            btn.classList.remove('btn-reativar');
            
            const selo = card.querySelector('.selo-plano-atual');
            if(selo) selo.remove();

            // Compara ignorando maiúsculas/minúsculas
            const planoUsuario = temPlano ? psychologistData.plano.toUpperCase() : '';
            const isCurrent = planoUsuario === planoAlvo.toUpperCase();
            
            const isCancelado = psychologistData.cancel_at_period_end || psychologistData.status === 'canceled' || psychologistData.cancelado_localmente;

            if(isCurrent) {
                // É O PLANO ATUAL
                const novoSelo = document.createElement('div');
                novoSelo.className = 'selo-plano-atual';
                novoSelo.textContent = 'Seu Plano Atual';
                novoSelo.style.cssText = "background:#1B4332; color:#fff; padding:5px 10px; border-radius:4px; margin-bottom:10px; font-size:0.8rem; display:inline-block; font-weight:bold;";
                card.insertBefore(novoSelo, card.firstChild);
                card.classList.add('plano-card--ativo'); // Adiciona borda visual se quiser CSS específico

                if (isCancelado) {
                    btn.textContent = "Reativar Assinatura";
                    btn.disabled = false;
                    btn.classList.add('btn-reativar');
                    btn.onclick = (e) => { e.preventDefault(); reativarAssinatura(btn); };
                } else {
                    btn.textContent = "Plano Ativo";
                    btn.disabled = true;
                    btn.style.opacity = "0.7";
                }
            } else {
                // É UM OUTRO PLANO (Upgrade ou Downgrade)
                // Se o usuário não tem plano nenhum, mostramos "Testar Grátis"
                btn.textContent = temPlano ? "Mudar para este" : "Testar 30 Dias Grátis";
                btn.disabled = false;
                btn.onclick = (e) => {
                    e.preventDefault();
                    // Envia para a função global de pagamento
                    window.iniciarPagamento(planoAlvo, btn);
                };
            }
        });
    }

    // Função Auxiliar para isolar a lógica do cancelar (apenas organização)
    function setupBotaoCancelamento(isCancelado) {
        const btnCancelar = document.getElementById('btn-cancelar-assinatura');
        const modalCancel = document.getElementById('modal-cancelamento');
            
        if(btnCancelar && modalCancel && !isCancelado) {
            const novoBtn = btnCancelar.cloneNode(true);
            btnCancelar.parentNode.replaceChild(novoBtn, btnCancelar);
            
            novoBtn.onclick = (e) => { e.preventDefault(); modalCancel.style.display = 'flex'; };
            
            const btnFechar = document.getElementById('btn-fechar-modal-cancel');
            if(btnFechar) btnFechar.onclick = () => modalCancel.style.display = 'none';
            
            const btnConfirmar = document.getElementById('btn-confirmar-cancelamento');
            const novoConfirmar = btnConfirmar.cloneNode(true);
            btnConfirmar.parentNode.replaceChild(novoConfirmar, btnConfirmar);

            novoConfirmar.onclick = async function() {
                this.textContent = "Processando...";
                try {
                    await apiFetch(`${API_BASE_URL}/api/psychologists/me/cancel-subscription`, { method: 'POST' });
                    psychologistData.cancel_at_period_end = true; 
                    psychologistData.cancelado_localmente = true; 
                    modalCancel.style.display = 'none';
                    showToast('Renovação cancelada.', 'info');
                    inicializarAssinatura(); 
                } catch(e) {
                    showToast('Erro: ' + e.message, 'error');
                } finally {
                    this.textContent = "Sim, Cancelar";
                }
            };
        }
    }

    // Função Auxiliar para Reativar (Conectada ao Modal Visual)
    function reativarAssinatura(btnElement) {
        const modal = document.getElementById('modal-reativacao');
        const btnFechar = document.getElementById('btn-fechar-modal-reativacao');
        const btnConfirmar = document.getElementById('btn-confirmar-reativacao');
        
        btnReativacaoAtual = btnElement;

        if (modal) {
            modal.style.display = 'flex';
            
            btnFechar.onclick = () => {
                modal.style.display = 'none';
            };

            btnConfirmar.onclick = async function() {
                const textoOriginalModal = this.textContent;
                this.textContent = "Processando...";
                this.disabled = true;

                try {
                    const response = await apiFetch(`${API_BASE_URL}/api/psychologists/me/reactivate-subscription`, {
                        method: 'POST'
                    });

                    if (response.ok) {
                        showToast('Assinatura reativada com sucesso! 🌻', 'success');
                        psychologistData.cancel_at_period_end = false;
                        psychologistData.cancelado_localmente = false;
                        modal.style.display = 'none';
                        inicializarAssinatura();
                    } else {
                        throw new Error("Falha na comunicação com o servidor.");
                    }
                } catch (error) {
                    console.error(error);
                    modal.style.display = 'none'; 
                    showToast('Erro: Ainda não foi possível conectar ao servidor de pagamentos.', 'error');
                } finally {
                    this.textContent = textoOriginalModal;
                    this.disabled = false;
                }
            };
        }
    }
    // --- RESTANTE DAS FUNÇÕES (PERFIL, EXCLUIR CONTA, ETC) ---
    function inicializarVisaoGeral() {
        // 1. Saudação e Alerta de Perfil (Mantidos)
        if (document.getElementById('psi-welcome-name') && psychologistData) {
            document.getElementById('psi-welcome-name').textContent = `Olá, ${psychologistData.nome.split(' ')[0]}!`;
        }
        const isProfileIncomplete = !psychologistData.abordagens || psychologistData.abordagens.length === 0; 
        const alertBox = document.getElementById('alert-complete-profile');
        if (alertBox) alertBox.style.display = isProfileIncomplete ? 'flex' : 'none';

        // 2. Preenchimento de Métricas (Simulação MVP)
        document.getElementById('kpi-cliques-contato').textContent = "12";
        document.getElementById('kpi-recomendacoes').textContent = "84";
        
        // Elementos Premium (Preenchidos caso estejam desbloqueados)
        const elFavoritos = document.getElementById('kpi-favoritos');
        if(elFavoritos) elFavoritos.textContent = "5";

        // 3. LÓGICA DE FEATURE GATING (Atualizada conforme definição de Produto)
        const planoAtual = psychologistData.plano ? psychologistData.plano.toUpperCase() : 'ESSENTIAL';
        
        // IDs dos cards
        const cardFavoritos = 'card-favoritos';
        const cardDemandas = 'card-demandas'; // "Interesses do Público"
        const cardBench = 'card-benchmarking';

        if (planoAtual === 'ESSENTIAL') {
            // PLANO 1 (Arroz com Feijão): Só vê métricas básicas
            bloquearCard(cardFavoritos, 'Veja quem salvou seu perfil no Plano Clínico');
            bloquearCard(cardDemandas, 'Saiba quais queixas chegam até você no Plano Clínico');
            bloquearCard(cardBench, 'Comparativo de mercado exclusivo Plano Referência');
        } 
        else if (planoAtual === 'CLINICAL') {
            // PLANO 2 (Intermediário): Vê Favoritos e Demandas
            desbloquearCard(cardFavoritos);
            desbloquearCard(cardDemandas);
            
            // Mas o Benchmarking continua bloqueado (Gatilho para o Plano 3)
            bloquearCard(cardBench, 'Destrave o Comparativo de Mercado no Plano Referência');
        } 
        else if (planoAtual === 'REFERENCE') {
            // PLANO 3 (Topo): Tudo liberado
            desbloquearCard(cardFavoritos);
            desbloquearCard(cardDemandas);
            desbloquearCard(cardBench);
            
            // Destaque visual
            const benchCard = document.getElementById(cardBench);
            if(benchCard) {
                benchCard.style.border = "1px solid #FFC107";
                benchCard.style.background = "linear-gradient(to right, #fff, #fffae6)";
            }
        }
    }

    // --- FUNÇÕES AUXILIARES DE BLOQUEIO (FEATURE GATING) ---
    
    function bloquearCard(elementId, mensagem) {
        const card = document.getElementById(elementId);
        if (!card) return;
    
        // Se já estiver bloqueado, não faz nada (evita duplicar cadeados)
        if (card.querySelector('.premium-lock-overlay')) return;
    
        // Adiciona classe para referência
        card.classList.add('premium-feature-container');
    
        // Aplica o blur em todos os filhos atuais do card
        Array.from(card.children).forEach(child => {
            child.classList.add('premium-blur');
        });
    
        // Cria o Overlay do Cadeado
        const overlay = document.createElement('div');
        overlay.className = 'premium-lock-overlay';
        overlay.innerHTML = `
            <div class="lock-icon-circle">
                <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/>
                </svg>
            </div>
            <div class="premium-text">${mensagem}</div>
            <button class="btn-unlock-feature">Liberar Acesso</button>
        `;
    
        // Ação do Botão "Liberar" -> Leva para a página de Assinatura
        overlay.querySelector('button').onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            // Simula o clique no menu lateral para carregar a página de assinatura
            const linkAssinatura = document.querySelector('[data-page="psi_assinatura.html"]');
            if(linkAssinatura) linkAssinatura.click();
        };
    
        card.appendChild(overlay);
    }
    
    function desbloquearCard(elementId) {
        const card = document.getElementById(elementId);
        if (!card) return;
        
        card.classList.remove('premium-feature-container');
        
        // Remove blur dos filhos
        Array.from(card.children).forEach(child => {
            child.classList.remove('premium-blur');
        });
    
        // Remove overlay do cadeado se existir
        const overlay = card.querySelector('.premium-lock-overlay');
        if (overlay) overlay.remove();
    }
    // --- LÓGICA DO PERFIL (ATUALIZADA: Híbrido CPF/CNPJ) ---

    // Variável para guardar a instância da máscara do documento
    let documentMaskInstance = null;

    function inicializarLogicaDoPerfil() {
        const form = document.getElementById('perfil-form');
        if (!form) return;

        const inputDoc = document.getElementById('cpf');
        const inputRazao = document.getElementById('razao_social');
        const groupRazao = document.getElementById('group-razao-social');

        // Inicializa componentes
        setupMultiselects();
        setupDocumentMask();
        // 1. INICIALIZA O BUSCADOR DE CEP
        setupCepSearch();

        if (psychologistData) {
            // Preencher campos simples
            // 2. ATUALIZAR LISTA DE CAMPOS PARA PREENCHER
            ['nome', 'email', 'crp', 'telefone', 'bio', 'valor_sessao_numero', 'slug', 'cep', 'cidade', 'estado'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = psychologistData[id] || '';
            });

            // --- CORREÇÃO AQUI: LÓGICA DE PREENCHIMENTO DO DOCUMENTO ---
            if (inputDoc) {
                // 1. Tenta pegar de qualquer variavel possível que o backend retorne
                const docSalvo = psychologistData.cpf || psychologistData.cnpj || psychologistData.document_number || '';
                
                // 2. Joga o valor no input da máscara
                if (documentMaskInstance) {
                    documentMaskInstance.value = docSalvo; // O IMask se encarrega de formatar
                    
                    // 3. Verifica o tamanho REAL (sem pontos/traços) para decidir se mostra Razão Social
                    const unmasked = documentMaskInstance.unmaskedValue;
                    
                    if (unmasked.length > 11) {
                        // É CNPJ -> Mostra Razão Social
                        groupRazao.classList.remove('hidden');
                    } else {
                        // É CPF -> Esconde Razão Social
                        groupRazao.classList.add('hidden');
                    }
                } else {
                    // Fallback caso a máscara tenha falhado (apenas joga o valor)
                    inputDoc.value = docSalvo;
                }
            }
            // -----------------------------------------------------------

            if (inputRazao) inputRazao.value = psychologistData.razao_social || '';

            // Redes sociais
            ['linkedin_url', 'instagram_url', 'facebook_url', 'tiktok_url', 'x_url'].forEach(key => {
                const el = document.getElementById(key);
                if (el && psychologistData[key]) {
                    let val = psychologistData[key].replace(/https?:\/\/(www\.)?/, '').replace(/linkedin\.com\/in\//, '').replace(/instagram\.com\//, '');
                    el.value = val;
                }
            });

            // --- CARREGAR DADOS DOS MULTISELECTS ---
            updateMultiselect('temas_atuacao_multiselect', psychologistData.temas || []);
            updateMultiselect('abordagens_tecnicas_multiselect', psychologistData.abordagens || []);

            // --- CORREÇÃO DO "DADO ZUMBI" (Modalidade) ---
            let modData = psychologistData.modalidade || [];
            
            // Se vier como string única, transforma em array
            if (typeof modData === 'string') {
                // Remove caracteres indesejados se for JSON mal formatado
                try { modData = JSON.parse(modData); } catch(e) { modData = [modData]; }
            }

            // SE encontrar o texto antigo "Apenas Presencial", troca pelo novo "Presencial"
            if (Array.isArray(modData)) {
                modData = modData.map(item => item === 'Apenas Presencial' ? 'Presencial' : item);
            }
            
            updateMultiselect('modalidade_atendimento_multiselect', modData);
            // ----------------------------------------------

            updateMultiselect('genero_identidade_multiselect', psychologistData.genero ? [psychologistData.genero] : []);
            updateMultiselect('disponibilidade_periodo_multiselect', psychologistData.disponibilidade || []);

            // Controle de Edição (Habilitar/Desabilitar visualmente)
            const btnAlterar = document.getElementById('btn-alterar');
            const multiselects = document.querySelectorAll('.multiselect-tag');
            
            if(btnAlterar) {
                btnAlterar.onclick = (e) => {
                    e.preventDefault();
                    document.getElementById('form-fieldset').disabled = false;
                    // Habilita visualmente os multiselects
                    multiselects.forEach(m => m.classList.remove('disabled'));
                    
                    btnAlterar.classList.add('hidden');
                    document.getElementById('btn-salvar').classList.remove('hidden');
                };
            }

            form.onsubmit = async (e) => {
                e.preventDefault();
                const btnSalvar = document.getElementById('btn-salvar');
                const btnAlterar = document.getElementById('btn-alterar');
                const fieldset = document.getElementById('form-fieldset');
                btnSalvar.textContent = "Salvando...";
                
                const fd = new FormData(form);
                const data = Object.fromEntries(fd.entries());

                // --- PEGAR OS DADOS DAS TAGS ---
                data.temas = getMultiselectValues('temas_atuacao_multiselect');
                data.abordagens = getMultiselectValues('abordagens_tecnicas_multiselect');
                data.modalidade = getMultiselectValues('modalidade_atendimento_multiselect');

                // Pega o primeiro item do array para campos únicos
                // Pega o primeiro item do array para campos únicos
                const generoArr = getMultiselectValues('genero_identidade_multiselect');
                data.genero = generoArr.length > 0 ? generoArr[0] : '';
                data.disponibilidade = getMultiselectValues('disponibilidade_periodo_multiselect');
                // --------------------------------------------------

                // Limpeza de dados para envio
                if (data.cpf) data.cpf = data.cpf.replace(/\D/g, '');
                if (data.telefone) data.telefone = data.telefone.replace(/\D/g, '');

                // Se o usuário voltou para CPF (<=11 digitos), limpamos a razão social do payload
                if (data.cpf && data.cpf.length <= 11) {
                    data.razao_social = ''; 
                }

                try {
                    await apiFetch(`${API_BASE_URL}/api/psychologists/me`, { method: 'PUT', body: JSON.stringify(data) });
                    showToast('Perfil salvo com sucesso!', 'success');
                    psychologistData = { ...psychologistData, ...data };
                    atualizarInterfaceLateral();

                    // --- CORREÇÃO: RE-BLOQUEIO DOS CAMPOS ---
                    fieldset.disabled = true; // Bloqueia inputs nativos
                    
                    // Bloqueia novamente os multiselects personalizados
                    const multiselects = document.querySelectorAll('.multiselect-tag');
                    multiselects.forEach(m => m.classList.add('disabled'));
                    // ----------------------------------------

                    btnSalvar.classList.add('hidden');
                    btnAlterar.classList.remove('hidden');
                } catch (err) {
                    showToast(err.message, 'error');
                } finally {
                    btnSalvar.textContent = "Salvar Alterações";
                }
            };
        }

        // Upload de foto (Mantido)
        const uploadInput = document.getElementById('profile-photo-upload');
        if (uploadInput) {
            uploadInput.onchange = async (e) => {
                if (e.target.files[0]) {
                    const fd = new FormData(); fd.append('foto', e.target.files[0]);
                    try {
                        const res = await apiFetch(`${API_BASE_URL}/api/psychologists/me/foto`, { 
                            method: 'POST', body: fd 
                        });
                        if (res.ok) {
                            const d = await res.json();
                            psychologistData.fotoUrl = d.fotoUrl;
                            atualizarInterfaceLateral(); showToast('Foto atualizada!');
                        }
                    } catch (err) { showToast('Erro na foto', 'error'); }
                }
            };
        }
    }

    // Função de Máscara Híbrida (CPF ou CNPJ automático)
    function setupDocumentMask() {
        if (typeof IMask === 'undefined') return;

        const inputDoc = document.getElementById('cpf'); // ID mantido como 'cpf'
        const groupRazao = document.getElementById('group-razao-social');
        
        if (!inputDoc) return;

        // Destroi anterior se existir para evitar conflitos
        if (documentMaskInstance) {
            documentMaskInstance.destroy();
            documentMaskInstance = null;
        }

        const maskOptions = {
            mask: [
                { mask: '000.000.000-00' },
                { mask: '00.000.000/0000-00' }
            ]
        };

        documentMaskInstance = IMask(inputDoc, maskOptions);

        // Evento para mostrar/ocultar Razão Social dinamicamente
        documentMaskInstance.on('accept', () => {
            const currentVal = documentMaskInstance.unmaskedValue;
            // Se passar de 11 dígitos, assumimos que está digitando um CNPJ
            if (currentVal.length > 11) {
                if(groupRazao) groupRazao.classList.remove('hidden');
            } else {
                if(groupRazao) groupRazao.classList.add('hidden');
            }
        });
    }

    function setupMasks() {
        if (typeof IMask === 'undefined') return;

        // Máscaras estáticas (Telefone e CRP)
        const tel = document.getElementById('telefone');
        const crp = document.getElementById('crp');

        if (tel) IMask(tel, { mask: '(00) 00000-0000' });
        if (crp) IMask(crp, { mask: '00/000000' });

        // Chama a máscara do documento (agora híbrida por padrão)
        setupDocumentMask(); // A função antiga foi removida
    }

    // --- LÓGICA DA COMUNIDADE (Q&A) ---
    function inicializarComunidade() {
        const container = document.getElementById('qna-list-container');
        const modal = document.getElementById('qna-answer-modal');
        const form = document.getElementById('qna-answer-form');
        const textarea = document.getElementById('qna-answer-textarea');
        const charCounter = document.getElementById('qna-char-counter');
        const btnSubmit = document.getElementById('qna-submit-answer');
        let currentQuestionId = null;

        if (!container) return;

        // 1. Buscar Perguntas
        apiFetch(`${API_BASE_URL}/api/qna`) 
            .then(async (res) => {
                if (!res.ok) throw new Error('Erro ao carregar');
                const questions = await res.json();
                renderQuestions(questions);
            })
            .catch(err => {
                console.error(err);
                container.innerHTML = `<div style="text-align:center; padding:40px;">Erro ao carregar perguntas. Tente recarregar.</div>`;
            });

        function renderQuestions(allQuestions) {
            container.innerHTML = ''; 
            
            const pendingQuestions = allQuestions.filter(q => q.respondedByMe === false);
            
            if (!pendingQuestions || pendingQuestions.length === 0) {
                container.innerHTML = `
                    <div style="text-align:center; padding:60px 20px; color:#1B4332;">
                        <div style="font-size: 3rem; margin-bottom: 10px;">🎉</div>
                        <h3 style="font-family:'New Kansas', serif; margin-bottom: 10px;">Tudo limpo por aqui!</h3>
                        <p style="color:#666; max-width: 400px; margin: 0 auto;">
                            Você zerou as perguntas da comunidade.
                        </p>
                    </div>`;
                return;
            }

            const template = document.getElementById('qna-card-template-psi');
            
            pendingQuestions.forEach(q => {
                const clone = template.content.cloneNode(true);
                
                // --- CORREÇÃO INFALÍVEL ---
                // Em vez de procurar pelo nome '.qna-card', pegamos o primeiro elemento do template.
                // Isso funciona independente do nome da classe no seu HTML.
                const cardElement = clone.firstElementChild; 

                if(cardElement) {
                    // Necessário para o ícone ficar no canto certo
                    cardElement.style.position = 'relative';
                }

                clone.querySelector('.qna-question-title').textContent = q.titulo || 'Dúvida da Comunidade';
                clone.querySelector('.qna-question-content').textContent = q.conteudo;
                
                const dataEnvio = new Date(q.createdAt).toLocaleDateString('pt-BR');
                clone.querySelector('.qna-question-author').textContent = `Enviada em ${dataEnvio} • Paciente Anônimo`;

                const badge = clone.querySelector('.badge-respondido');
                if(badge) badge.style.display = 'none';

                // Botão Responder
                const btnResponder = clone.querySelector('.btn-responder');
                btnResponder.onclick = () => abrirModalResposta(q.id, q.titulo);

                // --- BOTÃO LIXEIRA (SVG) ---
                const btnIgnorar = document.createElement('button');
                
                // SVG Inline (O desenho da lixeira)
                btnIgnorar.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                `;
                
                btnIgnorar.title = "Ignorar esta pergunta";
                
                // CSS para posicionar e colorir
                btnIgnorar.style.cssText = `
                    position: absolute;
                    top: 15px;
                    right: 15px;
                    background: none;
                    border: none;
                    padding: 5px;
                    cursor: pointer;
                    color: #1B4332; /* Verde Yelo */
                    opacity: 0.4;
                    transition: all 0.3s ease;
                    z-index: 2;
                `;
                
                // Efeito Hover
                btnIgnorar.onmouseover = () => {
                    btnIgnorar.style.opacity = '1';
                    btnIgnorar.style.transform = 'scale(1.1)';
                };
                btnIgnorar.onmouseout = () => {
                    btnIgnorar.style.opacity = '0.4';
                    btnIgnorar.style.transform = 'scale(1)';
                };

                // Ação de Clique com Modal Personalizado
                btnIgnorar.onclick = () => {
                    abrirModalConfirmacaoPersonalizado(
                        'Ignorar Pergunta',
                        'Tem certeza que deseja ignorar esta dúvida? Ela sumirá da sua lista.',
                        async () => {
                            try {
                                if(cardElement) cardElement.style.opacity = '0.5'; 
                                
                                const res = await apiFetch(`${API_BASE_URL}/api/qna/${q.id}/ignore`, { method: 'POST' });
                                if(res.ok) {
                                    if(cardElement) cardElement.remove(); 
                                    showToast('Pergunta removida da sua lista.', 'info');
                                    // Verifica se a lista ficou vazia
                                    if(container.children.length === 0) inicializarComunidade();
                                }
                            } catch(e) {
                                console.error(e);
                                if(cardElement) cardElement.style.opacity = '1'; 
                                showToast('Erro ao ignorar pergunta.', 'error');
                            }
                        }
                    );
                };

                // Adiciona o botão diretamente no card (se o card foi encontrado)
                if (cardElement) {
                    cardElement.appendChild(btnIgnorar);
                }

                container.appendChild(clone);
            });
        }

        // 2. Lógica do Modal
        function abrirModalResposta(id, titulo) {
            currentQuestionId = id;
            modal.querySelector('.modal-title').textContent = `Respondendo: ${titulo}`;
            textarea.value = ''; // Limpa o campo
            checkCharCount();    // Reseta o contador visualmente
            
            // Força display flex com !important por causa do CSS global
            modal.style.setProperty('display', 'flex', 'important');
        }

        // Função auxiliar para contar caracteres (Reutilizável)
        function checkCharCount() {
            const len = textarea.value.length;
            charCounter.textContent = `${len}/50 caracteres`;
            if (len >= 50) {
                charCounter.style.color = "#1B4332"; // Verde Yelo
                charCounter.style.fontWeight = "bold";
                btnSubmit.disabled = false;
            } else {
                charCounter.style.color = "#666";
                btnSubmit.disabled = true;
            }
        }

        // Fechar Modal
        const fecharModal = () => modal.style.setProperty('display', 'none', 'important');
        if(modal.querySelector('.modal-close')) modal.querySelector('.modal-close').onclick = fecharModal;
        if(modal.querySelector('.modal-cancel')) modal.querySelector('.modal-cancel').onclick = fecharModal;

        // Validação de Caracteres ao digitar
        textarea.oninput = checkCharCount;

        // 3. Enviar Resposta
        form.onsubmit = async (e) => {
            e.preventDefault();
            btnSubmit.textContent = "Enviando...";
            btnSubmit.disabled = true; // Evita duplo clique
            
            try {
                const res = await apiFetch(`${API_BASE_URL}/api/qna/${currentQuestionId}/answer`, {
                    method: 'POST',
                    body: JSON.stringify({ conteudo: textarea.value })
                });

                if (res.ok) {
                    showToast('Resposta enviada com sucesso! 🌻', 'success');
                    fecharModal();
                    
                    // A MÁGICA ACONTECE AQUI:
                    // Recarregamos a lista. Como o backend agora vai dizer que essa pergunta
                    // tem "respondedByMe = true", o filtro acima vai escondê-la automaticamente.
                    inicializarComunidade(); 
                } else {
                    throw new Error('Falha no envio');
                }

            } catch (error) {
                console.error(error);
                showToast('Erro ao enviar resposta.', 'error');
            } finally {
                btnSubmit.textContent = "Enviar Resposta";
                // Mantém disabled até digitar novamente (se desse erro) ou fecha modal
                if(textarea.value.length < 50) btnSubmit.disabled = true;
            }
        };
    }

    // --- LÓGICA DA CAIXA DE ENTRADA (SUPORTE ADMIN) ---
    function inicializarCaixaEntrada() {
        const mainContainer = document.getElementById('inbox-container');
        const listContainer = document.getElementById('inbox-message-list');
        const contentContainer = document.getElementById('inbox-message-content');
        
        // AGORA APONTA PARA A ROTA CERTA DE SUPORTE
        const API_MESSAGING = `${API_BASE_URL}/api/support`; 
    
        if (!listContainer) return;
    
        // 1. Renderiza a lista lateral (Conversas)
        function renderInboxList(conversations) {
            listContainer.innerHTML = '';
            if (!conversations || conversations.length === 0) {
                listContainer.innerHTML = '<li style="padding:20px; text-align:center; color:#999;">Nenhuma mensagem.</li>';
                return;
            }
    
            conversations.forEach(conv => {
                const li = document.createElement('li');
                li.className = `message-item`;
                
                // Ícone Vermelho para Suporte (Visual Yelo)
                const avatarLetra = conv.type === 'support' ? 'S' : (conv.participant.nome[0] || '?');
                const bgAvatar = conv.type === 'support' ? '#E63946' : 'var(--verde-escuro)'; 
                
                li.innerHTML = `
                    <div class="sender-avatar" style="background-color: ${bgAvatar};">${avatarLetra}</div>
                    <div class="message-info">
                        <div class="message-top">
                            <span class="sender-name">${conv.participant.nome}</span>
                            <span class="message-time">Hoje</span>
                        </div>
                        <div class="message-subject" style="font-size:0.8rem; color:#666;">
                            ${conv.lastMessage || 'Clique para acessar'}
                        </div>
                    </div>
                `;
                
                li.onclick = () => {
                    document.querySelectorAll('.message-item').forEach(i => i.classList.remove('active'));
                    li.classList.add('active');
                    
                    // Lógica Mobile: Mostra a tela de chat
                    if(mainContainer) mainContainer.classList.add('chat-open');
                    
                    carregarChat(conv.id, conv.participant);
                };
                listContainer.appendChild(li);
            });
        }
    
        // 2. Carrega o Chat
        async function carregarChat(chatId, participant) {
            // Renderiza estrutura do chat com botão Voltar (Mobile)
            contentContainer.innerHTML = `
                <div class="email-wrapper" style="height:100%; display:flex; flex-direction:column; padding:0;">
                    
                    <div style="padding: 15px; background: #fff; border-bottom: 1px solid #eee; display:flex; align-items:center; gap:15px;">
                        <button id="btn-back-mobile" style="background:none; border:none; font-size:1.5rem; cursor:pointer; color:var(--verde-escuro); display:none;">
                            ←
                        </button>
                        <div style="flex:1;">
                            <h3 style="margin:0; font-size:1.1rem; color:var(--verde-escuro);">${participant.nome}</h3>
                            <span style="font-size:0.8rem; color:#666;">${participant.role || 'Suporte'}</span>
                        </div>
                        <button id="btn-refresh-chat" style="background:none; border:1px solid #ddd; padding:5px 10px; border-radius:4px; cursor:pointer;">↻</button>
                    </div>
    
                    <div id="chat-scroller" style="flex:1; overflow-y:auto; padding:20px; display:flex; flex-direction:column; gap:10px; background:#f8f9fa;">
                        <div style="text-align:center; color:#999; margin-top:20px;">Carregando...</div>
                    </div>
    
                    <div style="padding:15px; background:#fff; border-top:1px solid #eee;">
                        <form id="form-chat" style="display:flex; gap:10px;">
                            <input type="text" id="input-chat" placeholder="Digite sua mensagem..." autocomplete="off"
                                style="flex:1; padding:12px; border:1px solid #ccc; border-radius:25px; outline:none;">
                            <button type="submit" style="background:var(--verde-escuro); color:#fff; border:none; width:45px; height:45px; border-radius:50%; cursor:pointer;">
                                ➤
                            </button>
                        </form>
                    </div>
                </div>
            `;
    
            // Ativa botão voltar no mobile
            const btnBack = document.getElementById('btn-back-mobile');
            if(window.innerWidth <= 992 && btnBack) {
                btnBack.style.display = 'block';
                btnBack.onclick = () => {
                    mainContainer.classList.remove('chat-open');
                };
            }
    
            const scroller = document.getElementById('chat-scroller');
    
            // Busca mensagens reais do Backend
            try {
                const res = await apiFetch(`${API_MESSAGING}/conversations/${chatId}`); 
                if (res.ok) {
                    const messages = await res.json();
                    renderMessages(messages, scroller);
                } else {
                    throw new Error('Erro ao buscar mensagens');
                }
            } catch (error) {
                scroller.innerHTML = `<div style="padding:20px; color:red; text-align:center;">Erro: ${error.message}</div>`;
            }
    
            // Botão Atualizar
            document.getElementById('btn-refresh-chat').onclick = () => carregarChat(chatId, participant);
    
            // Enviar Mensagem
            const form = document.getElementById('form-chat');
            form.onsubmit = async (e) => {
                e.preventDefault();
                const input = document.getElementById('input-chat');
                const texto = input.value.trim();
                
                if(!texto) return;
    
                // Otimista: mostra na tela antes de confirmar
                addMessageToScreen({ content: texto, senderType: 'psychologist', createdAt: new Date() }, scroller);
                input.value = '';
    
                try {
                    await apiFetch(`${API_MESSAGING}/messages`, {
                        method: 'POST',
                        body: JSON.stringify({
                            conversationId: chatId, // (Opcional dependendo do seu backend)
                            content: texto
                        })
                    });
                    // Sucesso silencioso
                } catch (err) {
                    alert('Erro ao enviar: ' + err.message);
                }
            };
        }
    
        function renderMessages(messages, container) {
            container.innerHTML = '';
            if (messages.length === 0) {
                container.innerHTML = `<p style="text-align:center; color:#999; margin-top:20px;">Este é o início do seu canal direto com a administração.</p>`;
            } else {
                messages.forEach(msg => addMessageToScreen(msg, container));
            }
            container.scrollTop = container.scrollHeight;
        }
    
        function addMessageToScreen(msg, container) {
            const souEu = msg.senderType === 'psychologist';
            const styleBox = souEu 
                ? 'align-self: flex-end; background-color: #1B4332; color: #fff; border-bottom-right-radius: 2px;' 
                : 'align-self: flex-start; background-color: #ffffff; color: #333; border: 1px solid #ddd; border-bottom-left-radius: 2px;';
    
            const time = new Date(msg.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    
            const div = document.createElement('div');
            div.style.cssText = `max-width:75%; padding:10px 15px; border-radius:12px; ${styleBox} position:relative; box-shadow: 0 1px 2px rgba(0,0,0,0.1);`;
            
            div.innerHTML = `
                <p style="margin:0; font-size:0.95rem; line-height:1.5;">${msg.content}</p>
                <span style="font-size:0.7rem; display:block; text-align:right; margin-top:4px; opacity:0.8;">${time}</span>
            `;
            container.appendChild(div);
            container.scrollTop = container.scrollHeight;
        }
    
        // --- INICIALIZAÇÃO: Busca lista de conversas ---
        apiFetch(`${API_MESSAGING}/conversations`)
            .then(async (res) => {
                if (res.ok) {
                    const convs = await res.json();
                    renderInboxList(convs);
                } else {
                    // Fallback de segurança se der erro
                    throw new Error('Falha API');
                }
            })
            .catch(err => {
                console.warn("Usando Fallback Local:", err);
                // Renderiza um item falso para você não ficar com a tela branca
                renderInboxList([{
                    id: 'suporte_admin',
                    type: 'support',
                    participant: { nome: 'Suporte Yelo', role: 'Administração' },
                    lastMessage: 'Clique para conectar.'
                }]);
            });
    } // Fim da inicializarCaixaEntrada

    function inicializarHubComunidade() {
        const containerHub = document.getElementById('hub-content-to-lock');
        if (!containerHub) return;

        // 1. Verifica plano
        const planoAtual = psychologistData && psychologistData.plano ? psychologistData.plano.toUpperCase() : 'ESSENTIAL';

        // 2. BUSCA DADOS (Agora vai funcionar pois liberamos a rota no Backend!)
        apiFetch(`${API_BASE_URL}/api/admin/community-resources`)
            .then(async (res) => {
                if(res.ok) {
                    const links = await res.json();
                    const btnInter = document.getElementById('btn-link-intervisao');
                    const btnBiblio = document.getElementById('btn-link-biblioteca');
                    const btnCursos = document.getElementById('btn-link-cursos');

                    // Só atualiza se o botão existir e o link não for vazio ou "#"
                    if(btnInter && links.link_intervisao && links.link_intervisao.length > 5) btnInter.href = links.link_intervisao;
                    if(btnBiblio && links.link_biblioteca && links.link_biblioteca.length > 5) btnBiblio.href = links.link_biblioteca;
                    if(btnCursos && links.link_cursos && links.link_cursos.length > 5) btnCursos.href = links.link_cursos;
                }
            })
            .catch(err => console.error("Links:", err)); // Se der erro, mantém o href="#"

        // 3. Regra de Bloqueio
        if (planoAtual === 'ESSENTIAL') {
            bloquearCard('hub-content-to-lock', 'Workshops e Biblioteca são exclusivos dos planos Clínico e Referência.');
            
            const lockBtn = containerHub.querySelector('.btn-unlock-feature');
            if(lockBtn) {
                lockBtn.textContent = "Fazer Upgrade para Acessar";
                lockBtn.style.backgroundColor = "#1B4332";
                lockBtn.style.color = "#fff";
            }
        } else {
            desbloquearCard('hub-content-to-lock');
        }
    }

    // INIT
    fetchPsychologistData().then(ok => {
        if (ok) {
            document.getElementById('dashboard-container').style.display = 'flex';
            document.querySelectorAll('.sidebar-nav a').forEach(l => {
                l.onclick = (e) => { e.preventDefault(); loadPage(l.getAttribute('data-page')); };
            });
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.has('status')) {
                loadPage('psi_assinatura.html');
                if (urlParams.get('status') === 'approved') {
                    showToast('Pagamento Aprovado!', 'success');
                    window.history.replaceState({}, document.title, window.location.pathname);
                }
            } else {
                loadPage('psi_visao_geral.html');
            }
        }
    });
});

// --- FUNÇÕES DOS CAMPOS MULTISELECT (V3 - ESTILO BULLETS & TOGGLE) ---

function setupMultiselects() {
        document.querySelectorAll('.multiselect-tag').forEach(container => {
            const display = container.querySelector('.multiselect-display');
            const optionsContainer = container.querySelector('.multiselect-options');
            // Verifica se o HTML pede seleção única (agora inclui Abordagens)
            const isSingle = container.dataset.singleSelect === 'true';

            // 1. Toggle do Menu (Abrir/Fechar)
            display.onclick = (e) => {
                if (container.classList.contains('disabled')) return;
                // Fecha outros menus abertos
                document.querySelectorAll('.multiselect-options').forEach(opt => {
                    if (opt !== optionsContainer) opt.style.display = 'none';
                });
                optionsContainer.style.display = optionsContainer.style.display === 'block' ? 'none' : 'block';
                e.stopPropagation();
            };

            // 2. Lógica de Clique nas Opções (Toggle: Adiciona ou Remove)
            optionsContainer.querySelectorAll('.option').forEach(opt => {
                opt.onclick = (e) => {
                    e.stopPropagation();
                    if (container.classList.contains('disabled')) return;

                    const val = opt.dataset.value;
                    let currentSelected = getMultiselectValues(container.id);

                    if (isSingle) {
                        // Modo Único: Se clicar no que já tá, desmarca. Se for novo, substitui.
                        if (currentSelected.includes(val)) {
                            currentSelected = [];
                        } else {
                            currentSelected = [val];
                        }
                        updateMultiselect(container.id, currentSelected);
                        optionsContainer.style.display = 'none'; // Fecha após escolher
                    } else {
                        // Modo Múltiplo: Toggle (Adiciona se não tem, remove se já tem)
                        if (currentSelected.includes(val)) {
                            currentSelected = currentSelected.filter(v => v !== val); // Remove
                        } else {
                            currentSelected.push(val); // Adiciona
                        }
                        updateMultiselect(container.id, currentSelected);
                        // Mantém o menu aberto para continuar selecionando
                    }
                };
            });
        });

        // Fecha ao clicar fora em qualquer lugar da tela
        document.addEventListener('click', () => {
            document.querySelectorAll('.multiselect-options').forEach(opt => opt.style.display = 'none');
        });
    }

    // Atualiza o visual (Bullets) e marca as opções no menu (VERSÃO BLINDADA)
    function updateMultiselect(containerId, rawValues) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        // --- PROTEÇÃO DE DADOS (CRUCIAL) ---
        // Garante que valuesArray seja SEMPRE um array, não importa o que venha do banco
        let valuesArray = rawValues;

        if (!valuesArray) {
            valuesArray = [];
        } else if (typeof valuesArray === 'string') {
            // Se vier como texto JSON (ex: '["Online"]'), tenta converter
            try {
                valuesArray = JSON.parse(valuesArray);
            } catch (e) {
                // Se for texto comum, transforma em array (ex: "Online" vira ["Online"])
                valuesArray = [valuesArray]; 
            }
        }
        
        // Se depois de tudo não for array, força ser vazio para não quebrar o .forEach
        if (!Array.isArray(valuesArray)) {
            valuesArray = [];
        }
        // -----------------------------------

        const display = container.querySelector('.multiselect-display');
        const optionsContainer = container.querySelector('.multiselect-options');

        // Salva os dados no elemento para envio posterior
        container.dataset.value = JSON.stringify(valuesArray);

        // 1. Atualiza o Display (Estilo Lista com Bullets)
        display.innerHTML = ''; 
        if (valuesArray.length === 0) {
            display.innerHTML = '<span style="color:#999; font-size:0.9rem;">Selecione...</span>';
        } else {
            // Cria a lista não ordenada (ul)
            const ul = document.createElement('ul');
            ul.style.cssText = "margin: 8px 0 8px 25px; padding: 0; list-style-type: disc; color: #333;";
            
            valuesArray.forEach(val => {
                const li = document.createElement('li');
                li.textContent = val;
                li.style.marginBottom = '4px'; 
                ul.appendChild(li);
            });
            display.appendChild(ul);
        }

        // 2. Atualiza visualmente o Dropdown (Feedback do que está marcado)
        if (optionsContainer) {
            Array.from(optionsContainer.children).forEach(opt => {
                if (valuesArray.includes(opt.dataset.value)) {
                    opt.style.fontWeight = 'bold';
                    opt.style.color = '#1B4332';
                    opt.style.backgroundColor = '#E0F2F1';
                } else {
                    opt.style.fontWeight = 'normal';
                    opt.style.color = '#666';
                    opt.style.backgroundColor = 'transparent';
                }
            });
        }
    }

    // Lê os valores (Permanece igual)
    function getMultiselectValues(containerId) {
        const container = document.getElementById(containerId);
        if (!container || !container.dataset.value) return [];
        try {
            return JSON.parse(container.dataset.value);
        } catch (e) { return []; }
    }

// --- FUNÇÃO AUXILIAR: MODAL DE CONFIRMAÇÃO PERSONALIZADO (TEMA Yelo) ---
function abrirModalConfirmacaoPersonalizado(titulo, mensagem, onConfirm) {
    // 1. Cria o fundo escuro (overlay)
    const overlay = document.createElement('div');
    overlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:20px;";

    // 2. Cria a caixa do modal
    const modalBox = document.createElement('div');
    modalBox.style.cssText = "background:#fff; width:100%; max-width:500px; border-radius:12px; overflow:hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.2); animation: fadeIn 0.2s ease-out;";

    // 3. Cabeçalho Verde
    const header = document.createElement('div');
    header.style.cssText = "background: #1B4332; color: #fff; padding: 15px 20px; font-family: 'New Kansas', sans-serif; font-size: 1.2rem;";
    header.textContent = titulo;

    // 4. Corpo da Mensagem
    const body = document.createElement('div');
    body.style.cssText = "padding: 25px 20px; color: #333; font-size: 1rem; line-height: 1.5;";
    body.innerHTML = mensagem;

    // 5. Rodapé com Botões
    const footer = document.createElement('div');
    footer.style.cssText = "padding: 15px 20px; background: #f9f9f9; display:flex; justify-content:flex-end; gap:10px; border-top:1px solid #eee;";

    const btnCancelar = document.createElement('button');
    btnCancelar.textContent = "Cancelar";
    btnCancelar.style.cssText = "padding: 10px 20px; border: 1px solid #ccc; background:#fff; color:#666; border-radius:25px; cursor:pointer; font-weight:bold;";
    
    const btnConfirmar = document.createElement('button');
    btnConfirmar.textContent = "Confirmar";
    btnConfirmar.style.cssText = "padding: 10px 20px; border: none; background:#1B4332; color:#fff; border-radius:25px; cursor:pointer; font-weight:bold;";

    // Ações
    const fechar = () => document.body.removeChild(overlay);
    btnCancelar.onclick = fechar;
    overlay.onclick = (e) => { if(e.target === overlay) fechar(); };
    
    btnConfirmar.onclick = () => {
        fechar();
        onConfirm(); // Executa a ação real
    };

    // Montagem
    footer.appendChild(btnCancelar);
    footer.appendChild(btnConfirmar);
    modalBox.appendChild(header);
    modalBox.appendChild(body);
    modalBox.appendChild(footer);
    overlay.appendChild(modalBox);
    document.body.appendChild(overlay);
}

// --- INTEGRAÇÃO VIACEP ---
function setupCepSearch() {
    const elCep = document.getElementById('cep');
    const elCidade = document.getElementById('cidade');
    const elEstado = document.getElementById('estado');
    const elLoading = document.getElementById('cep-loading');

    if (!elCep) return;

    // Aplica máscara simples enquanto digita
    elCep.addEventListener('input', (e) => {
        let val = e.target.value.replace(/\D/g, '');
        if (val.length > 5) {
            val = val.substring(0, 5) + '-' + val.substring(5, 8);
        }
        e.target.value = val;
    });

    // Busca ao sair do campo (blur)
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
                } else {
                    showToast('CEP não encontrado.', 'error');
                    if(elCidade) elCidade.value = '';
                    if(elEstado) elEstado.value = '';
                }
            } catch (err) {
                console.error(err);
                showToast('Erro ao buscar CEP.', 'error');
            } finally {
                if(elLoading) elLoading.style.display = 'none';
                elCep.disabled = false;
            }
        }
    });
}

// --- LÓGICA DO BLOG (MEUS ARTIGOS) ---
function inicializarBlog() {
    const viewLista = document.getElementById('view-lista-artigos');
    const viewForm = document.getElementById('view-form-artigo');
    const containerLista = document.getElementById('lista-artigos-render');
    const form = document.getElementById('form-blog');
    
    if (!viewLista || !viewForm) return;

    // Navegação Interna (Lista <-> Form)
    const toggleView = (showForm) => {
        if (showForm) {
            viewLista.style.display = 'none';
            viewForm.style.display = 'block';
        } else {
            viewForm.style.display = 'none';
            viewLista.style.display = 'block';
            limparFormulario();
        }
    };

    const btnNovo = document.getElementById('btn-novo-artigo');
    if(btnNovo) btnNovo.onclick = () => {
        document.getElementById('form-titulo-acao').textContent = "Novo Artigo";
        toggleView(true);
    };
    
    const btnVoltar = document.getElementById('btn-voltar-lista');
    if(btnVoltar) btnVoltar.onclick = () => toggleView(false);

    const btnCancelar = document.getElementById('btn-cancelar-artigo');
    if(btnCancelar) btnCancelar.onclick = () => toggleView(false);

    function limparFormulario() {
        form.reset();
        document.getElementById('blog-id').value = '';
    }

    // 1. CARREGAR ARTIGOS
    async function carregarArtigos() {
        containerLista.innerHTML = '<div style="text-align:center; padding:20px;">Carregando...</div>';
        try {
            const res = await apiFetch(`${API_BASE_URL}/api/psychologists/me/posts`);
            if (res.ok) {
                const posts = await res.json();
                renderizarLista(posts);
            } else {
                // Se der 404 é porque a rota ainda não existe no backend, mostramos vazio
                renderizarLista([]); 
            }
        } catch (error) {
            console.warn("Backend do Blog ainda não respondeu:", error);
            // Mostra lista vazia se der erro de conexão
            renderizarLista([]);
        }
    }

    function renderizarLista(posts) {
        containerLista.innerHTML = '';
        if (!posts || posts.length === 0) {
            containerLista.innerHTML = `
                <div style="text-align:center; padding:40px; color:#666;">
                    <p style="font-size:3rem; margin-bottom:10px;">📝</p>
                    <p>Você ainda não escreveu nenhum artigo.</p>
                    <p>Clique em <strong>+ Escrever Novo</strong> para começar.</p>
                </div>`;
            return;
        }

        posts.forEach(post => {
            const div = document.createElement('div');
            div.className = 'artigo-item';
            
            const dataStr = post.created_at || post.createdAt || new Date();
            const dataF = new Date(dataStr).toLocaleDateString('pt-BR');

            div.innerHTML = `
                <div>
                    <strong style="font-size:1.1rem; color:#1B4332;">${post.titulo}</strong>
                    <div style="font-size:0.8rem; color:#666; margin-top:4px;">Publicado em: ${dataF}</div>
                </div>
                <div class="artigo-acoes" style="display:flex; gap:10px;">
                    <button class="btn-editar" style="background:none; border:1px solid #ddd; padding:5px 10px; border-radius:4px; cursor:pointer;">✏️ Editar</button>
                    <button class="btn-excluir" style="background:none; border:1px solid #ffcccc; color:red; padding:5px 10px; border-radius:4px; cursor:pointer;">🗑️</button>
                </div>
            `;

            // Ação Editar
            div.querySelector('.btn-editar').onclick = () => {
                carregarParaEdicao(post);
            };

            // Ação Excluir
            div.querySelector('.btn-excluir').onclick = () => {
                if(confirm('Tem certeza que deseja apagar este artigo?')) {
                    deletarArtigo(post.id);
                }
            };

            containerLista.appendChild(div);
        });
    }

    async function deletarArtigo(id) {
        try {
            await apiFetch(`${API_BASE_URL}/api/psychologists/me/posts/${id}`, { method: 'DELETE' });
            showToast('Artigo excluído.', 'success');
            carregarArtigos();
        } catch (e) {
            showToast('Erro ao excluir: ' + e.message, 'error');
        }
    }

    function carregarParaEdicao(post) {
        document.getElementById('form-titulo-acao').textContent = "Editar Artigo";
        document.getElementById('blog-id').value = post.id;
        document.getElementById('blog-titulo').value = post.titulo;
        document.getElementById('blog-conteudo').value = post.conteudo || '';
        document.getElementById('blog-imagem').value = post.imagem_url || '';
        toggleView(true);
    }

    // 2. SALVAR (CRIAR OU EDITAR)
    form.onsubmit = async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-salvar-artigo');
        const originalText = btn.textContent;
        btn.textContent = "Salvando...";
        btn.disabled = true;

        const id = document.getElementById('blog-id').value;
        const method = id ? 'PUT' : 'POST';
        const url = id 
            ? `${API_BASE_URL}/api/psychologists/me/posts/${id}`
            : `${API_BASE_URL}/api/psychologists/me/posts`;
        
        const payload = {
            titulo: document.getElementById('blog-titulo').value,
            conteudo: document.getElementById('blog-conteudo').value,
            imagem_url: document.getElementById('blog-imagem').value
        };

        try {
            const res = await apiFetch(url, {
                method: method,
                body: JSON.stringify(payload)
            });
            
            if(res.ok) {
                showToast('Artigo salvo com sucesso!', 'success');
                toggleView(false);
                carregarArtigos();
            } else {
                throw new Error("Erro ao salvar");
            }
        } catch (error) {
            console.error(error);
            showToast('Erro ao salvar. Verifique se o Backend foi atualizado.', 'error');
        } finally {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    };

    // Inicializa carregando a lista
    carregarArtigos();
}