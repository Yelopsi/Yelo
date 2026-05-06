document.addEventListener('DOMContentLoaded', () => {
    // 1. Tenta buscar o nome salvo no sessionStorage
    const nomeCompleto = sessionStorage.getItem('Yelo_user_name');
    const subtitleElement = document.getElementById('aviso-idade-texto');

    if (!subtitleElement) return;

    // 2. Se encontrar o nome, personaliza o título
    if (nomeCompleto) {
        const primeiroNome = nomeCompleto.split(' ')[0];
        const nomeFormatado = primeiroNome.charAt(0).toUpperCase() + primeiroNome.slice(1).toLowerCase();
        subtitleElement.textContent = `Olá, ${nomeFormatado}. Vimos que você tem menos de 18 anos.`;
    }

    // 3. Limpa o nome do sessionStorage para não vazar
    sessionStorage.removeItem('Yelo_user_name');
});