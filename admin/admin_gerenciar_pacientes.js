window.initializePage = function() {
    const tableBody = document.getElementById('patients-table-body');
    const rowTemplate = document.getElementById('patient-row-template');
    const token = localStorage.getItem('girassol_token');

    if (!tableBody || !rowTemplate || !token) {
        console.error("Elementos essenciais ou token não encontrados.");
        if (tableBody) tableBody.innerHTML = '<tr><td colspan="5" class="error-row">Erro ao carregar a página.</td></tr>';
        return;
    }

    async function fetchPatients() {
        try {
            const response = await fetch('http://localhost:3001/api/admin/patients', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                throw new Error('Falha ao buscar dados dos pacientes.');
            }

            const patients = await response.json();
            renderTable(patients);

        } catch (error) {
            console.error(error);
            tableBody.innerHTML = `<tr><td colspan="5" class="error-row">${error.message}</td></tr>`;
        }
    }

    function renderTable(patients) {
        tableBody.innerHTML = '';

        if (patients.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" class="empty-row">Nenhum paciente encontrado.</td></tr>';
            return;
        }

        patients.forEach(patient => {
            const row = rowTemplate.content.cloneNode(true).querySelector('tr');

            row.querySelector('[data-label="Nome"]').textContent = patient.nome;
            row.querySelector('[data-label="E-mail"]').textContent = patient.email;
            row.querySelector('[data-label="Data de Cadastro"]').textContent = new Date(patient.createdAt).toLocaleDateString('pt-BR');

            const statusCell = row.querySelector('[data-label="Status"] .status');
            // Simulação de status, já que o modelo não tem um campo 'status'
            const status = 'ativo'; 
            statusCell.textContent = status;
            statusCell.className = `status status-${status}`;

            const actionsCell = row.querySelector('[data-label="Ações"]');
            actionsCell.innerHTML = `
                <button class="btn-tabela">Ver Detalhes</button>
                <button class="btn-tabela">Suspender</button>
            `;

            tableBody.appendChild(row);
        });
    }

    fetchPatients();
};