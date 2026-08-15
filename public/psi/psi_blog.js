// Arquivo: psi_blog.js
// Módulo responsável pelo gerenciamento de Artigos (Blog) do Psicólogo

(function() {
    // Variáveis locais para gerenciar os eventos do formulário de forma limpa
    let blogTitleInputHandler = null;
    let blogCancelHandler = null;
    let blogSubmitHandler = null;
    let quill = null;

    window.inicializarBlog = function(preFetchedData = null) {
        const API_BASE_URL = (typeof window.API_BASE_URL !== 'undefined') ? window.API_BASE_URL : 'http://localhost:3001';
        let currentPage = 1;
        const ARTICLES_LIMIT = 3; // Limite de artigos por página
        const loadMoreBtn = document.getElementById('btn-load-more-articles');

        // Tenta achar os elementos cruciais
        const viewLista = document.getElementById('view-lista-artigos');
        const viewForm = document.getElementById('view-form-artigo');
        const containerLista = document.getElementById('lista-artigos-render');
        const form = document.getElementById('form-blog');
        const btnSalvar = document.getElementById('btn-salvar-artigo');
        
        // --- LIMITE DE CARACTERES DO TÍTULO (50) ---
        const inputTitulo = document.getElementById('blog-titulo');
        
        if (inputTitulo && !document.getElementById('contador-titulo-blog')) {
            inputTitulo.setAttribute('maxlength', '50');
            const contador = document.createElement('div');
            contador.id = 'contador-titulo-blog';
            contador.style.cssText = "font-size: 0.85rem; color: #666; text-align: right; margin-top: 4px;";
            contador.textContent = `${inputTitulo.value.length}/50 caracteres`;
            
            inputTitulo.parentNode.insertBefore(contador, inputTitulo.nextSibling);

            blogTitleInputHandler = function() {
                const atual = this.value.length;
                contador.textContent = `${atual}/50 caracteres`;
                if (atual >= 50) {
                    contador.style.color = "#e63946";
                    contador.style.fontWeight = "bold";
                } else {
                    contador.style.color = "#666";
                    contador.style.fontWeight = "normal";
                }
            };
            inputTitulo.addEventListener('input', blogTitleInputHandler);
        }

        // --- LÓGICA DE UPLOAD DE IMAGEM (BASE64 PREVIEW) ---
        const inputImagemUpload = document.getElementById('blog-imagem-upload');
        const imgText = document.getElementById('blog-imagem-text');
        const inputImagemHidden = document.getElementById('blog-imagem');
        const btnRemoveImagem = document.getElementById('btn-remove-imagem');

        if (inputImagemUpload) {
            inputImagemUpload.addEventListener('change', function(e) {
                const file = e.target.files[0];
                if (file) {
                    if (file.size > 5 * 1024 * 1024) {
                        window.showToast('A imagem deve ter no máximo 5MB.', 'error');
                        this.value = '';
                        if (btnRemoveImagem) btnRemoveImagem.style.display = 'none';
                        return;
                    }
                    if (imgText) imgText.innerHTML = `📎 <strong>${file.name}</strong>`;
                    if (btnRemoveImagem) btnRemoveImagem.style.display = 'block';
                } else {
                    if (imgText) imgText.innerHTML = '📎 Nenhuma imagem selecionada...';
                    if (btnRemoveImagem) btnRemoveImagem.style.display = 'none';
                }
            });
        }

        if (btnRemoveImagem) {
            btnRemoveImagem.addEventListener('click', function(e) {
                e.preventDefault(); // Impede que o clique abra a janela de seleção de arquivo
                e.stopPropagation();
                if (inputImagemUpload) inputImagemUpload.value = '';
                if (inputImagemHidden) inputImagemHidden.value = '';
                if (imgText) imgText.innerHTML = '📎 Nenhuma imagem selecionada...';
                this.style.display = 'none';
            });
        }

        if (!viewLista || !viewForm || !form || !btnSalvar) {
            window.showToast("Erro ao carregar componentes da página. Atualize (F5).", "error");
            return;
        }

        // --- CARREGAR SUGESTÕES DE TEMAS ---
        async function carregarSugestoes() {
            const container = document.getElementById('lista-sugestoes-temas');
            if (!container) return;

            try {
                const res = await window.apiFetch(`${API_BASE_URL}/api/psychologists/me/stats?period=last90days`);
                if (res.ok) {
                    const stats = await res.json();
                    if (stats.topDemands && stats.topDemands.length > 0) {
                        container.innerHTML = '';
                        stats.topDemands.forEach(tema => {
                            const div = document.createElement('div');
                            div.className = 'sugestao-item';
                            div.textContent = `✍️ ${tema.name}`;
                            div.title = `Clique para usar "${tema.name}" como título do seu novo artigo`;
                            
                            div.onclick = () => {
                                limparFormulario();
                                document.getElementById('blog-titulo').value = tema.name;
                                document.getElementById('form-titulo-acao').textContent = "Novo Artigo";
                                toggleView(true);
                            };
                            container.appendChild(div);
                        });
                    } else {
                        container.innerHTML = '<p style="font-size:0.9rem; color:#92400e; grid-column: 1 / -1; text-align: center;">Nenhuma tendência encontrada. Escreva sobre o que você domina!</p>';
                    }
                } else {
                    throw new Error("Falha ao buscar dados de tendências.");
                }
            } catch (error) {
                container.innerHTML = '<p style="font-size:0.9rem; color:#92400e; grid-column: 1 / -1; text-align: center;">Não foi possível carregar as sugestões.</p>';
            }
        }

        // --- Navegação ---
        const toggleView = (showForm) => {
            if (showForm) {
                viewForm.style.display = 'flex';
                setTimeout(() => document.getElementById('blog-titulo').focus(), 100);
            } else {
                viewForm.style.display = 'none';
            }
        };

        const setupBtn = (id, action) => {
            const btn = document.getElementById(id);
            if(btn) btn.onclick = action;
        };

        setupBtn('btn-novo-artigo', () => {
            const blogId = document.getElementById('blog-id').value;
            if (blogId) limparFormulario();
            const formTitle = document.getElementById('form-titulo-acao');
            if (formTitle) formTitle.textContent = "Novo Artigo";
            toggleView(true);
        });

        function limparFormulario() {
            const currentForm = document.getElementById('form-blog');
            if(currentForm) currentForm.reset(); 
            document.getElementById('blog-id').value = '';
            
            if (inputImagemHidden) inputImagemHidden.value = '';
            if (imgText) imgText.innerHTML = '📎 Nenhuma imagem selecionada...';
            if (inputImagemUpload) inputImagemUpload.value = '';
            const btnRemoveImagemLocal = document.getElementById('btn-remove-imagem');
            if (btnRemoveImagemLocal) btnRemoveImagemLocal.style.display = 'none';

            if (quill) quill.setText('');
            const contador = document.getElementById('contador-titulo-blog');
            if(contador) {
                contador.textContent = "0/50 caracteres";
                contador.style.color = "#666";
                contador.style.fontWeight = "normal";
            }
        }

        // --- CARREGAR ARTIGOS ---
        async function carregarArtigos(page = 1, append = false) {
            if (!append) containerLista.innerHTML = '<div style="text-align:center; padding:40px; color:#666;"><span style="font-size:2rem;">⏳</span><br>Carregando seus artigos...</div>';
            if (loadMoreBtn) { loadMoreBtn.textContent = 'Carregando...'; loadMoreBtn.disabled = true; }
            
            try {
                let posts;
                if (page === 1 && preFetchedData) {
                    posts = await preFetchedData;
                    preFetchedData = null;
                } else {
                    const res = await window.apiFetch(`${API_BASE_URL}/api/psychologists/me/posts?page=${page}&limit=${ARTICLES_LIMIT}`);
                    if (res.ok) posts = await res.json();
                    else throw new Error(`Erro no servidor: ${res.status}`);
                }

                if (!Array.isArray(posts)) posts = [];
                let hasMore = posts.length === ARTICLES_LIMIT;
                renderizarLista(posts, append);

                if (loadMoreBtn) {
                    if (hasMore) { loadMoreBtn.classList.remove('hidden'); loadMoreBtn.style.display = 'block'; } 
                    else loadMoreBtn.style.display = 'none';
                }
            } catch (error) {
                if (!append) containerLista.innerHTML = `<div style="text-align:center; padding:30px; color:#d32f2f; background:#fff0f0; border-radius:8px;"><p><strong>Não foi possível carregar seus artigos.</strong></p><p style="font-size:0.8rem;">Tente recarregar a página.</p></div>`;
            } finally {
                if (loadMoreBtn) { loadMoreBtn.textContent = 'Mostrar mais'; loadMoreBtn.disabled = false; }
            }
        }

        function renderizarLista(posts, append = false) {
            if (!append) containerLista.innerHTML = '';
            if ((!posts || posts.length === 0) && !append) {
                containerLista.innerHTML = `
                    <div style="text-align:center; padding:50px 20px; color:#666; background:#f9f9f9; border-radius:12px;">
                        <p style="font-size:3rem; margin-bottom:10px;">📝</p>
                        <h3 style="color:#1B4332;">Você ainda não tem artigos.</h3>
                        <p>Escrever é a melhor forma de demonstrar autoridade.</p>
                        <p>Clique em <strong>+ Escrever Novo</strong> acima para começar!</p>
                    </div>`;
                return;
            }
            if (!posts) return;

            posts.forEach(post => {
                const div = document.createElement('div');
                div.className = 'artigo-item';
                div.title = "Clique para ver o artigo público";
                
                const dataStr = post.created_at || post.createdAt || new Date();
                const dataF = new Date(dataStr).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

                div.innerHTML = `
                    <div style="flex: 1;">
                        <strong style="font-size:1.2rem; color:#1B4332; display:block; margin-bottom:8px;">${post.titulo}</strong>
                        <div style="display: flex; align-items: center; gap: 20px; font-size:0.85rem; color:#666;">
                            <span style="display: flex; align-items: center; gap: 5px;">📅 ${dataF}</span>
                            <span style="display: flex; align-items: center; gap: 5px; color: #e63946; font-weight: bold;" title="Total de leitores que curtiram">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M8 1.314C12.438-3.248 23.534 4.735 8 15-7.534 4.736 3.562-3.248 8 1.314z"/></svg>
                                ${post.curtidas || 0}
                            </span>
                        </div>
                    </div>
                    <div class="btn-acoes-grupo">
                        <button class="btn-acao btn-editar">✏️ Editar</button>
                        <button class="btn-acao btn-excluir">🗑️ Excluir</button>
                    </div>
                `;

                div.querySelector('.btn-editar').onclick = () => carregarParaEdicao(post);
                div.querySelector('.btn-excluir').onclick = () => {
                    window.abrirModalConfirmacaoPersonalizado(
                        'Excluir Artigo',
                        `Tem certeza que deseja apagar o artigo "<strong>${post.titulo}</strong>"?<br>Essa ação não pode ser desfeita.`,
                        () => deletarArtigo(post.id)
                    );
                };
                div.style.cursor = 'pointer';
                div.addEventListener('click', (e) => {
                    if (e.target.closest('.btn-acao')) return;
                    window.open(`/blog/post/${post.id}`, '_blank');
                });
                containerLista.appendChild(div);
            });
        }

        async function deletarArtigo(id) {
            try {
                const res = await window.apiFetch(`${API_BASE_URL}/api/psychologists/me/posts/${id}`, { method: 'DELETE' });
                if(res.ok) {
                    const data = await res.json();
                    if (data.pointsDeducted) window.showToast(`Artigo excluído. Você perdeu ${data.pointsDeducted} XP.`, 'info');
                    else window.showToast('Artigo excluído com sucesso.', 'success');
                    carregarArtigos();
                } else throw new Error("Falha ao excluir");
            } catch (e) { window.showToast('Erro ao excluir artigo.', 'error'); }
        }

        function carregarParaEdicao(post) {
            document.getElementById('form-titulo-acao').textContent = "Editar Artigo";
            document.getElementById('blog-id').value = post.id;
            document.getElementById('blog-titulo').value = post.titulo;
            if (quill && post.conteudo) quill.clipboard.dangerouslyPasteHTML(post.conteudo);
            
            if (inputImagemHidden) inputImagemHidden.value = post.imagem_url || '';
            const btnRemoveImagemLocal2 = document.getElementById('btn-remove-imagem');
            if (imgText) {
                if (post.imagem_url) {
                    imgText.innerHTML = '📎 Imagem atual carregada (clique para alterar)';
                    if (btnRemoveImagemLocal2) btnRemoveImagemLocal2.style.display = 'block';
                } else {
                    imgText.innerHTML = '📎 Nenhuma imagem selecionada...';
                    if (btnRemoveImagemLocal2) btnRemoveImagemLocal2.style.display = 'none';
                }
            }
            toggleView(true);
        }

        // --- INICIALIZAÇÃO DO QUILL ---
        if (document.getElementById('editor-container')) {
            document.getElementById('editor-container').innerHTML = '';
            quill = new Quill('#editor-container', {
                theme: 'snow',
                placeholder: 'Comece a escrever seu artigo aqui...',
                modules: { toolbar: [ [{ 'header': [2, 3, false] }], ['bold', 'italic', 'underline', 'strike'], [{ 'list': 'ordered'}, { 'list': 'bullet' }], ['link'], ['clean'] ] }
            });
        }

        // --- GERENCIAMENTO DE LISTENERS ---
        const btnCancelar = document.getElementById('btn-cancelar-artigo');
        const btnFecharModal = document.getElementById('btn-fechar-modal-artigo');

        blogCancelHandler = (e) => { e.preventDefault(); toggleView(false); };
        if (btnCancelar) btnCancelar.addEventListener('click', blogCancelHandler);
        if (btnFecharModal) btnFecharModal.addEventListener('click', blogCancelHandler);
        if (viewForm) viewForm.addEventListener('click', (e) => { if (e.target === viewForm) blogCancelHandler(e); });

        blogSubmitHandler = async function(e) {
            e.preventDefault();
            const btn = document.getElementById('btn-salvar-artigo');
            const originalText = btn.innerHTML;
            btn.innerHTML = "⏳ Salvando..."; btn.disabled = true;
            try {
                const id = document.getElementById('blog-id').value;
                const method = id ? 'PUT' : 'POST';
                const url = id ? `${API_BASE_URL}/api/psychologists/me/posts/${id}` : `${API_BASE_URL}/api/psychologists/me/posts`;
                
                const formData = new FormData();
                formData.append('titulo', document.getElementById('blog-titulo').value);
                formData.append('conteudo', quill ? quill.root.innerHTML : '');
                
                const imagemUpload = document.getElementById('blog-imagem-upload');
                if (imagemUpload && imagemUpload.files[0]) {
                    formData.append('imagem', imagemUpload.files[0]);
                } else {
                    formData.append('imagem_url', document.getElementById('blog-imagem').value);
                }
                
                const res = await window.apiFetch(url, { method: method, body: formData });
                if(res.ok) { window.showToast(id ? 'Artigo atualizado!' : 'Artigo publicado!', 'success'); limparFormulario(); toggleView(false); carregarArtigos(); }
                else throw new Error((await res.json()).error || "Erro ao salvar.");
            } catch (error) { window.showToast('Não foi possível salvar: ' + error.message, 'error'); } 
            finally { btn.innerHTML = originalText; btn.disabled = false; }
        };
        form.addEventListener('submit', blogSubmitHandler);

        window.cleanupBlog = () => {
            if (form) form.removeEventListener('submit', blogSubmitHandler);
            if (btnCancelar) btnCancelar.removeEventListener('click', blogCancelHandler);
            if (btnFecharModal) btnFecharModal.removeEventListener('click', blogCancelHandler);
            if (inputTitulo) inputTitulo.removeEventListener('input', blogTitleInputHandler);
        };

        carregarArtigos(1, false);
        carregarSugestoes();
        if (loadMoreBtn) loadMoreBtn.onclick = () => carregarArtigos(++currentPage, true);
    };
})();