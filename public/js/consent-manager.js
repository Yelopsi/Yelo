/**
 * Yelo Consent Manager (LGPD / Privacy by Design)
 * 
 * Gerencia cookies essenciais, de analytics e de marketing de forma modular.
 * Retém disparo de trackers (Meta, Google Analytics) até autorização explícita.
 * Possibilita revogação e exclusão de cookies de terceiros autorizados (ex: _ga).
 */

const ConsentManager = (function() {
    const STATE_KEY = 'Yelo_Privacy_State';
    const CONSENT_VERSION = '1.0';

    const defaultState = {
        essential: true,
        analytics: false,
        marketing: false,
        version: CONSENT_VERSION,
        timestamp: null
    };

    let currentState = null;

    // Callbacks que registram scripts que devem rodar quando a categoria for aceita.
    const pendingLoaders = {
        analytics: [],
        marketing: []
    };

    function loadState() {
        try {
            const stored = localStorage.getItem(STATE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed.version === CONSENT_VERSION) {
                    currentState = parsed;
                    return;
                }
            }
        } catch (e) {
            console.error('ConsentManager erro ao carregar state:', e);
        }
        currentState = { ...defaultState };
    }

    function saveState(stateUpdate) {
        currentState = { ...currentState, ...stateUpdate, timestamp: new Date().toISOString() };
        localStorage.setItem(STATE_KEY, JSON.stringify(currentState));
        
        applyConsent(currentState);
    }

    function removeCookie(name) {
        // Tenta remover cookie em vários domínios base
        const domain = window.location.hostname;
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${domain};`;
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
        
        // Remove domínios pontudos (ex: .yelopsi.com.br)
        const parts = domain.split('.');
        if (parts.length >= 2) {
            const baseDomain = `.${parts.slice(-2).join('.')}`;
            document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${baseDomain};`;
        }
    }

    function revokeTrackers() {
        // --- 1. DESTRÓI COOKIES ---
        // Google Analytics / GTAG
        removeCookie('_ga');
        removeCookie('_gid');
        removeCookie('_gat');
        // Meta Pixel
        removeCookie('_fbp');
        removeCookie('_fbc');

        // --- 2. DESTRÓI LOCAL STORAGE ---
        localStorage.removeItem('_fbp');
        localStorage.removeItem('_fbc');
        localStorage.removeItem('_ga');
        localStorage.removeItem('_gid');

        // --- 3. DESTRÓI OBJETOS EM MEMÓRIA (PARALISAÇÃO IMEDIATA) ---
        if (window.fbq) delete window.fbq;
        if (window._fbq) delete window._fbq;
        if (window.gtag) delete window.gtag;
        if (window.dataLayer) delete window.dataLayer;

        // Force reload opcional se for muito crítico, mas o delete in-memory e localStorage
        // já paralisa a execução ativa até o próximo load limpo.
        console.log('🛑 Rastreadores revogados e instâncias destruídas.');
    }

    function applyConsent(state) {
        // --- GOOGLE ANALYTICS (GTAG) ---
        if (state.analytics || state.marketing) {
            if (typeof gtag === 'function') {
                gtag('consent', 'update', {
                    'analytics_storage': state.analytics ? 'granted' : 'denied',
                    'ad_storage': state.marketing ? 'granted' : 'denied',
                    'ad_user_data': state.marketing ? 'granted' : 'denied',
                    'ad_personalization': state.marketing ? 'granted' : 'denied'
                });
            }
        }

        if (!state.analytics && !state.marketing) {
            revokeTrackers();
        }

        // Executar callbacks pendentes das categorias ativadas
        if (state.analytics) {
            while (pendingLoaders.analytics.length > 0) {
                const loader = pendingLoaders.analytics.shift();
                loader();
            }
        }
        
        if (state.marketing) {
            while (pendingLoaders.marketing.length > 0) {
                const loader = pendingLoaders.marketing.shift();
                loader();
            }
        }
    }

    // Inicializa o state local no boot
    loadState();

    return {
        hasInteracted: function() {
            return currentState.timestamp !== null;
        },
        getState: function() {
            return { ...currentState };
        },
        acceptAll: function() {
            saveState({ analytics: true, marketing: true });
            document.dispatchEvent(new CustomEvent('YeloConsentUpdated'));
        },
        rejectAll: function() {
            saveState({ analytics: false, marketing: false });
            document.dispatchEvent(new CustomEvent('YeloConsentUpdated'));
        },
        savePreferences: function(prefs) {
            saveState(prefs);
            document.dispatchEvent(new CustomEvent('YeloConsentUpdated'));
        },
        onAnalyticsConsent: function(loaderFn) {
            if (currentState.analytics) {
                loaderFn();
            } else {
                pendingLoaders.analytics.push(loaderFn);
            }
        },
        onMarketingConsent: function(loaderFn) {
            if (currentState.marketing) {
                loaderFn();
            } else {
                pendingLoaders.marketing.push(loaderFn);
            }
        },
        
        injectGTAG: function(tagIds, userId = null) {
            this.onAnalyticsConsent(() => {
                if (document.getElementById('yelo-gtag-script')) return; 
                
                const script = document.createElement('script');
                script.id = 'yelo-gtag-script';
                script.async = true;
                script.src = `https://www.googletagmanager.com/gtag/js?id=${tagIds[0]}`;
                document.head.appendChild(script);

                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                window.gtag = window.gtag || gtag;
                
                gtag('js', new Date());

                gtag('consent', 'default', {
                    'analytics_storage': 'granted',
                    'ad_storage': this.getState().marketing ? 'granted' : 'denied',
                    'ad_user_data': this.getState().marketing ? 'granted' : 'denied',
                    'ad_personalization': this.getState().marketing ? 'granted' : 'denied'
                });

                tagIds.forEach(id => {
                    const config = {};
                    if (userId) config.user_id = userId;
                    gtag('config', id, config);
                });
            });
        },

        injectMetaPixel: function(pixelIds) {
            this.onMarketingConsent(() => {
                if (document.getElementById('yelo-meta-pixel-script')) return; 

                !function(f,b,e,v,n,t,s)
                {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                n.callMethod.apply(n,arguments):n.queue.push(arguments)};
                if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
                n.queue=[];t=b.createElement(e);t.id='yelo-meta-pixel-script';t.async=!0;
                t.src=v;s=b.getElementsByTagName(e)[0];
                s.parentNode.insertBefore(t,s)}(window, document,'script',
                'https://connect.facebook.net/en_US/fbevents.js');

                pixelIds.forEach(id => {
                    // Previne que a Meta faça web scraping automático de botões e metadados (LGPD / Health Data)
                    fbq('set', 'autoConfig', false, id);
                    fbq('init', id);
                });
                fbq('track', 'PageView');
            });
        }
    };
})();

window.ConsentManager = ConsentManager;
