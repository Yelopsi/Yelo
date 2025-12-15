document.addEventListener('DOMContentLoaded', () => {
    // 1. Tenta buscar o nome salvo no sessionStorage
    const nome = sessionStorage.getItem('Yelo_user_name');
    const titleElement = document.getElementById('welcome-title');

    if (!titleElement) return;

    // 2. Se encontrar o nome, personaliza o título
    if (nome) {
        titleElement.textContent = `Olá ${nome}, temos um recado importante!`;
    } else {
        // Fallback: Se o nome não for encontrado
        titleElement.textContent = 'Temos um recado importante!';
    }

    // 3. Limpa o nome do sessionStorage para não vazar
    sessionStorage.removeItem('Yelo_user_name');
});