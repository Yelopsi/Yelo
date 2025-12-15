console.log("Script carregado!");

// --- FUNÇÃO DE INICIALIZAÇÃO DO MENU (Global) ---
function initMobileMenu() {
    const menuBtn = document.querySelector('.menu-hamburguer');
    const navContainer = document.querySelector('.container-navegacao');

    // Remove event listeners antigos para evitar duplicação (cloneNode limpa eventos)
    if (menuBtn) {
        const newMenuBtn = menuBtn.cloneNode(true);
        menuBtn.parentNode.replaceChild(newMenuBtn, menuBtn);
        
        newMenuBtn.addEventListener('click', (e) => {
            e.preventDefault();
            navContainer.classList.toggle('ativo');
        });
    }

    // Lógica do Header Rolagem
    const header = document.querySelector('header');
    if (header) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                header.classList.add('header-rolagem');
            } else {
                header.classList.remove('header-rolagem');
            }
        });
    }
}

// Expondo a função para outros scripts (como resultados.js)
window.initMobileMenu = initMobileMenu;

// Inicia automaticamente em páginas normais
document.addEventListener('DOMContentLoaded', () => {
    initMobileMenu();
    
    // Lógica do Acordeão (FAQ)
    const acordeoes = document.querySelectorAll('.acordeao-titulo');
    if (acordeoes.length > 0) {
        acordeoes.forEach(acc => {
            acc.addEventListener('click', function() {
                this.classList.toggle('ativo');
                const painel = this.nextElementSibling;
                if (painel.style.maxHeight) {
                    painel.style.maxHeight = null;
                } else {
                    painel.style.maxHeight = painel.scrollHeight + "px";
                }
            });
        });
    }
});