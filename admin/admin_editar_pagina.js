// admin/admin_editar_pagina.js

window.initializePage = function() {
    const editor = document.getElementById('rich-text-editor');
    const pageTitleEl = document.getElementById('editor-page-title');
    const saveBtn = document.getElementById('save-content-btn');
    const toolbar = document.querySelector('.editor-toolbar');

    // Pega o nome da página a ser editada da URL (ex: ?page=/sobre-nos)
    const params = new URLSearchParams(window.location.search);
    const pageKey = params.get('page');

    if (!pageKey) {
        editor.innerHTML = '<p>Erro: Nenhuma página especificada para edição.</p>';
        return;
    }

    pageTitleEl.textContent = `Editando Página: ${pageKey}`;

    // --- Lógica do Editor ---

    // Carrega o conteúdo salvo (se houver)
    const savedContent = localStorage.getItem(`page-content-${pageKey}`);
    if (savedContent) {
        editor.innerHTML = savedContent;
    } else {
        editor.innerHTML = `<p>Comece a editar o conteúdo para a página <strong>${pageKey}</strong> aqui.</p>`;
    }

    // Adiciona funcionalidade aos botões da toolbar
    toolbar.addEventListener('click', (e) => {
        const button = e.target.closest('.editor-btn');
        if (button) {
            const command = button.dataset.command;
            if (command === 'createLink') {
                const url = prompt('Digite a URL do link:');
                if (url) {
                    document.execCommand(command, false, url);
                }
            } else {
                document.execCommand(command, false, null);
            }
            editor.focus();
        }
    });

    // Salva o conteúdo no localStorage
    saveBtn.addEventListener('click', () => {
        const content = editor.innerHTML;
        localStorage.setItem(`page-content-${pageKey}`, content);
        alert('Conteúdo salvo com sucesso!'); // Em um app real, usaria um toast

        // Opcional: redireciona de volta para a gestão de conteúdo
        // Para isso, precisaríamos de uma função global de navegação.
        // Por enquanto, o botão "Voltar" já faz isso.
    });
};