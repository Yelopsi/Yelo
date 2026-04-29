document.addEventListener('DOMContentLoaded', () => {
    // Supondo que você já tenha uma função que carrega os dados do psicólogo.
    // Se não tiver, este é o modelo.
    carregarDadosDoDashboard();
});

async function carregarDadosDoDashboard() {
    const token = localStorage.getItem('Yelo_token');
    if (!token) {
        window.location.href = '/login';
        return;
    }

    try {
        const response = await fetch('/api/psychologists/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            // Tratar erro de autenticação, etc.
            return;
        }

        const profileData = await response.json();

        // --- LÓGICA DO AVISO DE PERFIL INCOMPLETO ---
        // Esta é a parte nova que você precisa adicionar
        if (profileData.profileWarning) {
            criarBannerDeAviso(profileData.profileWarning);
        }

        // ... resto do seu código que preenche o dashboard com os dados ...

    } catch (error) {
        console.error("Erro ao carregar dados do dashboard:", error);
    }
}

function criarBannerDeAviso(mensagem) {
    // Evita criar banners duplicados
    if (document.getElementById('profile-warning-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'profile-warning-banner';
    banner.className = 'warning-banner';
    banner.innerHTML = `<p>${mensagem} <a href="/psi/psi_meu_perfil.html"><strong>Completar meu perfil agora.</strong></a></p>`;

    // Insere o banner no topo do conteúdo principal
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
        mainContent.prepend(banner);
    }
}