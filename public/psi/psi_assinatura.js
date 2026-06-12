// Arquivo: psi_assinatura.js
// Módulo responsável pelo gerenciamento de Assinaturas e Pagamentos (Asaas)

(function() {
    let currentPlanAttempt = '';
    let btnReativacaoAtual = null;
    const API_BASE_URL = (typeof window.API_BASE_URL !== 'undefined') ? window.API_BASE_URL : 'http://localhost:3001';

    // --- INICIALIZAÇÃO DOS LISTENERS GLOBAIS DO MODAL DE PAGAMENTO ---
    document.addEventListener('DOMContentLoaded', () => {
        const btnCloseX = document.getElementById('btn-close-modal-x');
        const modalPagamento = document.getElementById('payment-modal');

        if (btnCloseX && modalPagamento) {
            btnCloseX.addEventListener('click', function(e) {
                e.preventDefault();
                modalPagamento.style.setProperty('display', 'none', 'important');
            });
        }
        
        const btnAplicarModal = document.getElementById('btn-aplicar-cupom-modal');
        if (btnAplicarModal) {
            btnAplicarModal.addEventListener('click', async (e) => {
                e.preventDefault();
                const cupomVal = document.getElementById('modal-cupom-input')?.value;
                if(!cupomVal || !currentPlanAttempt) return;

                btnAplicarModal.textContent = "...";
                try {
                    await window.iniciarPagamento(currentPlanAttempt, { textContent: '', tagName: 'BUTTON' }, cupomVal);
                } catch (err) {
                } finally {
                    btnAplicarModal.textContent = "Aplicar";
                }
            });
        }
    });

    window.iniciarPagamento = async function(planType, btnElement, cupomForce = null) {
        const psychologistData = window.getPsychologistData();
        currentPlanAttempt = planType;
        
        const btn = btnElement.tagName ? btnElement : { textContent: '', disabled: false };
        const originalText = btn.textContent;
        
        if(btn.tagName) { btn.textContent = "Carregando..."; btn.disabled = true; }

        const proceedToPayment = () => {
            abrirModalAsaas(planType, cupomForce);
            if(btn.tagName) { btn.textContent = originalText; btn.disabled = false; }
        };

        const cancelPayment = () => {
            if(btn.tagName) { btn.textContent = originalText; btn.disabled = false; }
        };

        const hoje = new Date();
        const hasSubscription = psychologistData && (psychologistData.stripeSubscriptionId || psychologistData.subscriptionId);
        const planExpiresAt = psychologistData && psychologistData.planExpiresAt ? new Date(psychologistData.planExpiresAt) : null;
        const isInTrial = !hasSubscription && planExpiresAt && planExpiresAt > hoje;

        if (isInTrial) {
            if (typeof window.abrirModalConfirmacaoPersonalizado === 'function') {
                window.abrirModalConfirmacaoPersonalizado(
                    'Você está no período de teste! 🎁',
                    'Você ainda tem dias grátis para conhecer a plataforma e <strong>não precisa cadastrar um cartão de crédito agora.</strong><br><br>Mas se preferir deixar sua assinatura já configurada, <strong>você só será cobrado no 15º dia</strong>.',
                    () => { proceedToPayment(); }
                );
                cancelPayment();
            } else {
                const confirmou = confirm('Você está no período de teste grátis e não precisa cadastrar um cartão agora.\n\nSe quiser assinar mesmo assim, você só será cobrado no 15º dia. Deseja continuar?');
                if (confirmou) proceedToPayment(); else cancelPayment();
            }
        } else {
            proceedToPayment();
        }
    };

    function abrirModalAsaas(planType, cupomPreenchido) {
        const psychologistData = window.getPsychologistData();
        const modal = document.getElementById('payment-modal');
        const form = document.getElementById('payment-form');
        const btnSubmit = document.getElementById('btn-confirmar-stripe');
        const msgDiv = document.getElementById('payment-message');
        
        const stepMethod = document.getElementById('step-payment-method');
        const btnSelectCard = document.getElementById('btn-select-card');
        const btnSelectPix = document.getElementById('btn-select-pix');
        const btnBackMethod = document.getElementById('btn-back-method');
        
        const creditSection = document.getElementById('credit-card-section');
        const pixResult = document.getElementById('pix-result-container');
        const customerSection = document.getElementById('customer-data-section');
        const securityBadges = document.getElementById('security-badges');
        
        let currentMethod = 'CREDIT_CARD';
        if (!modal) return;

        modal.style.display = 'flex'; modal.style.opacity = 1; modal.style.visibility = 'visible';
        if(msgDiv) msgDiv.classList.add('hidden');
        stepMethod.style.display = 'block'; form.style.display = 'none'; pixResult.style.display = 'none';
        const loaderEl = document.getElementById('pix-direct-loader');
        if (loaderEl) loaderEl.style.display = 'none';
        
        const setTab = (method) => {
            currentMethod = method;
            stepMethod.style.display = 'none'; form.style.display = 'block'; customerSection.style.display = 'flex';
            
            const cepInput = document.getElementById('card-holder-cep');
            const numInput = document.getElementById('card-holder-number');
            const elCepRow = cepInput ? cepInput.closest('.payment-flex-row') : null;

            if (method === 'CREDIT_CARD') {
                creditSection.style.display = 'flex'; securityBadges.style.display = 'block';
                if (elCepRow) elCepRow.style.display = 'flex';
                btnSubmit.innerHTML = `Ativar Assinatura <span style="display:block;font-size:0.75rem;font-weight:normal;opacity:0.8;margin-top:2px;">Acesso Premium Ilimitado</span>`;
                document.getElementById('card-holder-name').placeholder = "Nome impresso no cartão";
                document.getElementById('card-number').required = true; document.getElementById('card-expiry').required = true; document.getElementById('card-ccv').required = true;
                if (cepInput) cepInput.required = true; if (numInput) numInput.required = true;
            } else {
                creditSection.style.display = 'none'; securityBadges.style.display = 'none';
                if (elCepRow) elCepRow.style.display = 'none';
                btnSubmit.textContent = "Gerar QR Code PIX";
                document.getElementById('card-holder-name').placeholder = "Nome completo";
                document.getElementById('card-number').required = false; document.getElementById('card-expiry').required = false; document.getElementById('card-ccv').required = false;
                if (cepInput) cepInput.required = false; if (numInput) numInput.required = false;
            }
        };
        
        btnSelectCard.onclick = () => setTab('CREDIT_CARD');
        btnSelectPix.onclick = async () => {
            currentMethod = 'PIX';
            const hasCpf = psychologistData && (psychologistData.cpf || psychologistData.cnpj);
            if (!hasCpf) {
                setTab('PIX');
                document.getElementById('card-holder-name').value = psychologistData ? psychologistData.nome : '';
                return;
            }
            stepMethod.style.display = 'none';
            if(msgDiv) msgDiv.classList.add('hidden');
            
            let loaderEl = document.getElementById('pix-direct-loader');
            if (!loaderEl) {
                loaderEl = document.createElement('div'); loaderEl.id = 'pix-direct-loader';
                loaderEl.innerHTML = '<div class="loader-spinner" style="margin: 0 auto;"></div><p style="text-align:center; color:#1B4332; margin-top:15px; font-weight:bold;">Gerando código PIX...</p>';
                stepMethod.parentNode.insertBefore(loaderEl, stepMethod.nextSibling);
            }
            loaderEl.style.display = 'block';

            try {
                const cupom = document.getElementById('modal-cupom-input')?.value || '';
                const res = await window.apiFetch(`${API_BASE_URL}/api/payments/create-preference`, {
                    method: 'POST', body: JSON.stringify({ planType, cupom, billingType: 'PIX', creditCard: {} })
                });
                const data = await res.json();
                if (res.ok && data.pix) {
                    loaderEl.style.display = 'none'; pixResult.style.display = 'block';
                    document.getElementById('pix-qr-image').src = `data:image/png;base64,${data.pix.encodedImage}`;
                    document.getElementById('pix-copy-paste').value = data.pix.payload;
                } else throw new Error(data.error || 'Erro ao gerar PIX.');
            } catch (error) {
                loaderEl.style.display = 'none'; stepMethod.style.display = 'block';
                if(msgDiv) { msgDiv.classList.remove('hidden'); msgDiv.textContent = error.message; msgDiv.style.color = "red"; }
            }
        };
        
        btnBackMethod.onclick = () => { form.style.display = 'none'; stepMethod.style.display = 'block'; if(msgDiv) msgDiv.classList.add('hidden'); };
        
        if(cupomPreenchido) { const cupomInput = document.getElementById('modal-cupom-input'); if (cupomInput) cupomInput.value = cupomPreenchido; }

        if (psychologistData) {
            const elCpf = document.getElementById('card-holder-cpf'); const elCep = document.getElementById('card-holder-cep'); const elPhone = document.getElementById('card-holder-phone');
            if (elCpf && psychologistData.cpf) elCpf.value = psychologistData.cpf;
            if (elCep && psychologistData.cep) elCep.value = psychologistData.cep;
            if (elPhone && psychologistData.telefone) elPhone.value = psychologistData.telefone;
        }

        setTimeout(() => {
            if (window.IMask) {
                const cardExpiry = document.getElementById('card-expiry'); const cardNumber = document.getElementById('card-number'); const cardCcv = document.getElementById('card-ccv');
                const cardCpf = document.getElementById('card-holder-cpf'); const cardCep = document.getElementById('card-holder-cep'); const cardPhone = document.getElementById('card-holder-phone');
                if (cardExpiry) IMask(cardExpiry, { mask: 'MM/YYYY', blocks: { MM: { mask: IMask.MaskedRange, from: 1, to: 12 }, YYYY: { mask: IMask.MaskedRange, from: 1900, to: 2999 } } });
                if (cardNumber) IMask(cardNumber, { mask: '0000 0000 0000 0000' });
                if (cardCcv) IMask(cardCcv, { mask: '0000' });
                if (cardCpf) IMask(cardCpf, { mask: [ { mask: '000.000.000-00' }, { mask: '00.000.000/0000-00' } ] });
                if (cardCep) IMask(cardCep, { mask: '00000-000' });
                if (cardPhone) IMask(cardPhone, { mask: '(00) 00000-0000' });
            }
        }, 100);

        const cepInput = document.getElementById('card-holder-cep');
        if (cepInput) {
            cepInput.addEventListener('blur', async (e) => {
                const cep = e.target.value.replace(/\D/g, '');
                if (cep.length === 8) {
                    try {
                        const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
                        const data = await res.json();
                        if (!data.erro) {
                            document.getElementById('card-holder-street').value = data.logradouro || '';
                            document.getElementById('card-holder-neighborhood').value = data.bairro || '';
                            document.getElementById('card-holder-city').value = data.localidade || '';
                            document.getElementById('card-holder-state').value = data.uf || '';
                            document.getElementById('card-holder-number').focus();
                        }
                    } catch (err) { }
                }
            });
        }

        form.onsubmit = async (e) => {
            e.preventDefault();
            if(msgDiv) msgDiv.classList.add('hidden');
            btnSubmit.disabled = true; btnSubmit.textContent = "Processando com Asaas...";

            const cardData = {
                holderName: document.getElementById('card-holder-name').value, holderCpf: document.getElementById('card-holder-cpf').value.replace(/\D/g, ''),
                holderPhone: document.getElementById('card-holder-phone').value.replace(/\D/g, ''), postalCode: document.getElementById('card-holder-cep').value.replace(/\D/g, ''),
                addressNumber: document.getElementById('card-holder-number').value, addressComplement: document.getElementById('card-holder-complement').value,
                addressStreet: document.getElementById('card-holder-street').value, addressNeighborhood: document.getElementById('card-holder-neighborhood').value
            };
            
            if (currentMethod === 'CREDIT_CARD') {
                cardData.number = document.getElementById('card-number').value.replace(/\D/g, '');
                cardData.expiry = document.getElementById('card-expiry').value;
                cardData.ccv = document.getElementById('card-ccv').value;
            }
            const cupom = document.getElementById('modal-cupom-input')?.value || '';

            try {
                const res = await window.apiFetch(`${API_BASE_URL}/api/payments/create-preference`, {
                    method: 'POST', body: JSON.stringify({ planType, cupom, billingType: currentMethod, creditCard: cardData })
                });

                let data;
                const contentType = res.headers.get("content-type");
                if (contentType && contentType.indexOf("application/json") !== -1) { data = await res.json(); } 
                else { const text = await res.text(); throw new Error(`Erro no servidor (${res.status}). Tente novamente mais tarde.`); }

                if (res.ok) {
                    if (currentMethod === 'PIX' && data.pix) {
                        customerSection.style.display = 'none'; creditSection.style.display = 'none'; securityBadges.style.display = 'none';
                        btnSubmit.style.display = 'none'; pixResult.style.display = 'block';
                        document.getElementById('pix-qr-image').src = `data:image/png;base64,${data.pix.encodedImage}`;
                        document.getElementById('pix-copy-paste').value = data.pix.payload;
                        document.getElementById('btn-copy-pix').onclick = () => { document.getElementById('pix-copy-paste').select(); document.execCommand("copy"); window.showToast('Código PIX copiado!', 'success'); };
                        document.getElementById('btn-pix-paid').onclick = () => window.location.reload();
                    } else {
                        window.showToast('Assinatura realizada com sucesso!', 'success');
                        modal.style.setProperty('display', 'none', 'important');
                        setTimeout(() => window.location.reload(), 1500); // Força um reload para garantir a busca dos dados atualizados
                    }
                } else throw new Error(data.error || 'Erro ao processar pagamento.');
            } catch (error) {
                if(msgDiv) { msgDiv.classList.remove('hidden'); msgDiv.textContent = error.message; msgDiv.style.color = "red"; }
            } finally {
                btnSubmit.disabled = false;
                btnSubmit.innerHTML = currentMethod === 'CREDIT_CARD' ? `Ativar Assinatura <span style="display:block;font-size:0.75rem;font-weight:normal;opacity:0.8;margin-top:2px;">Acesso Premium Ilimitado</span>` : "Gerar PIX";
            }
        };
    }

    window.inicializarAssinatura = function() {
        const psychologistData = window.getPsychologistData();
        const cardResumo = document.getElementById('card-resumo-assinatura');
        const areaCancelamento = document.getElementById('area-cancelamento');
        
        const temPlano = psychologistData && psychologistData.plano;
        const hasSubscription = psychologistData && (psychologistData.stripeSubscriptionId || psychologistData.subscriptionId);
        
        const precos = { 'essential': 'R$ 99,00', 'clinical': 'R$ 159,00', 'reference': 'R$ 259,00', 'essencial': 'R$ 99,00', 'clínico': 'R$ 149,00', 'sol': 'R$ 199,00' };

        if (temPlano && cardResumo) {
            cardResumo.style.display = 'flex';
            const isCancelado = psychologistData.cancelAtPeriodEnd || psychologistData.cancel_at_period_end || psychologistData.status === 'canceled';
            if (areaCancelamento) areaCancelamento.style.display = (isCancelado || !hasSubscription) ? 'none' : 'block';

            const mapNomes = { 'ESSENTIAL': 'Essencial', 'CLINICAL': 'Clínico', 'REFERENCE': 'Referência' };
            const nomeExibicao = mapNomes[psychologistData.plano.toUpperCase()] || psychologistData.plano;

            const elNome = document.getElementById('banner-nome-plano');
            if(elNome) elNome.textContent = `Plano ${nomeExibicao}`;
            
            const planoKey = psychologistData.plano.toLowerCase();
            const elPreco = document.getElementById('banner-preco');
            if(elPreco) elPreco.textContent = `${precos[planoKey] || 'R$ --'} / mês`;

            const elData = document.getElementById('banner-renovacao');
            const elBadge = cardResumo.querySelector('.status-badge');

            let dataDisplay = psychologistData.planExpiresAt ? new Date(psychologistData.planExpiresAt) : (psychologistData.subscription_expires_at ? new Date(psychologistData.subscription_expires_at) : new Date(new Date().setMonth(new Date().getMonth() + 1)));
            const dataFormatada = dataDisplay.toLocaleDateString('pt-BR');

            if (isCancelado) {
                if (elData) elData.textContent = `Acesso até: ${dataFormatada}`;
                if (elBadge) elBadge.innerHTML = `<span style="width: 8px; height: 8px; background: #FFC107; border-radius: 50%;"></span> Cancelado`;
            } else {
                if (elData) elData.textContent = `Renova em: ${dataFormatada}`;
                if (elBadge) elBadge.innerHTML = `<span style="width: 8px; height: 8px; background: #4ade80; border-radius: 50%;"></span> Ativo`;
            }

            setupBotaoCancelamento(isCancelado);
        } else {
            if(cardResumo) cardResumo.style.display = 'none';
            if(areaCancelamento) areaCancelamento.style.display = 'none';
        }

        document.querySelectorAll('.plano-card').forEach(card => {
            const btn = card.querySelector('.btn-mudar-plano');
            if (!btn) return;
            
            const planoAlvo = btn.getAttribute('data-plano'); 
            if (!planoAlvo) return;

            card.classList.remove('plano-card--ativo'); btn.classList.remove('btn-reativar');
            const selo = card.querySelector('.selo-plano-atual'); if(selo) selo.remove();

            const planoUsuario = temPlano ? psychologistData.plano.toUpperCase() : '';
            const isCurrent = planoUsuario === planoAlvo.toUpperCase();
            const isCancelado = psychologistData.cancel_at_period_end || psychologistData.status === 'canceled' || psychologistData.cancelado_localmente;

            if(isCurrent) {
                const novoSelo = document.createElement('div'); novoSelo.className = 'selo-plano-atual'; novoSelo.textContent = 'Seu Plano Atual'; novoSelo.style.cssText = "background:#1B4332; color:#fff; padding:5px 10px; border-radius:4px; margin-bottom:10px; font-size:0.8rem; display:inline-block; font-weight:bold;";
                card.insertBefore(novoSelo, card.firstChild); card.classList.add('plano-card--ativo');
                if (isCancelado) { btn.textContent = "Reativar Assinatura"; btn.disabled = false; btn.classList.add('btn-reativar'); btn.onclick = (e) => { e.preventDefault(); reativarAssinatura(btn); }; } 
                else { btn.textContent = "Plano Ativo"; btn.disabled = true; btn.style.opacity = "0.7"; }
            } else {
                if (!temPlano) { btn.innerHTML = "ASSINAR AGORA"; btn.classList.add('btn-upgrade', 'btn-pulse-effect'); } 
                else { btn.textContent = "Mudar para este"; btn.classList.remove('btn-upgrade', 'btn-pulse-effect'); }
                btn.disabled = false; btn.onclick = (e) => { e.preventDefault(); window.iniciarPagamento(planoAlvo, btn); };
            }
        });
    };

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
                    const res = await window.apiFetch(`${API_BASE_URL}/api/psychologists/me/cancel-subscription`, { method: 'POST' });
                    const data = await res.json();
                    if (data.message && (data.message.includes('estornado') || data.message.includes('Arrependimento') || data.message.includes('cancelada'))) {
                        window.showToast('Assinatura cancelada.', 'success'); window.location.reload();
                    } else {
                        window.getPsychologistData().cancel_at_period_end = true; 
                        modalCancel.style.display = 'none'; window.showToast(data.message || 'Renovação cancelada.', 'info'); window.inicializarAssinatura(); 
                    }
                } catch(e) { window.showToast('Erro: ' + e.message, 'error'); } 
                finally { this.textContent = "Sim, Cancelar"; }
            };
        }
    }

    function reativarAssinatura(btnElement) {
        const psychologistData = window.getPsychologistData();
        const modal = document.getElementById('modal-reativacao');
        const btnFechar = document.getElementById('btn-fechar-modal-reativacao');
        const btnConfirmar = document.getElementById('btn-confirmar-reativacao');
        
        btnReativacaoAtual = btnElement;

        if (modal) {
            modal.style.display = 'flex';
            btnFechar.onclick = () => { modal.style.display = 'none'; };
            btnConfirmar.onclick = async function() {
                modal.style.display = 'none';
                const planoAtual = psychologistData.plano || 'ESSENTIAL';
                window.iniciarPagamento(planoAtual, btnReativacaoAtual);
            };
        }
    }
})();