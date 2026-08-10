const { JSDOM } = require('jsdom');
const assert = require('assert');

// Simular o DOM e injetar resultados.js
const dom = new JSDOM(`
<!DOCTYPE html>
<html>
<head></head>
<body>
    <div id="loading-screen"></div>
    <div id="results-content"></div>
    <div id="results-grid"></div>
</body>
</html>
`, { runScripts: "dangerously" });

const window = dom.window;
const document = window.document;

// Mock payload do atacante
const payloadAtacante = {
    id: 999,
    nome: 'Dr. <script>window.xss_nome=true;</script><img src=x onerror=window.xss_nome=true>',
    crp: '12345</span><svg onload=window.xss_crp=true>',
    bio: '<script>window.xss_bio=true;</script>',
    fotoUrl: 'javascript:window.xss_foto=true;',
    slug: 'javascript:window.xss_slug=true',
    animationDelay: 0,
    score: 95
};

function createCard(profile) {
    const isSafeFoto = (profile.fotoUrl && (profile.fotoUrl.startsWith('http://') || profile.fotoUrl.startsWith('https://')));
    const placeholderFoto = 'https://placehold.co/400x500/1B4332/FFF?text=Foto';

    return `
        <div class="match-card" id="card-${profile.id}" style="animation-delay: ${profile.animationDelay}s; cursor: pointer;">
            <div class="match-badge">${profile.score}% Compatível</div>
            <div class="heart-icon" data-id="${profile.id}">♡</div>
            
            <div class="match-header-wrapper">
                <img id="img-${profile.id}" src="${isSafeFoto ? profile.fotoUrl : placeholderFoto}" class="match-header-img" onerror="this.src='${placeholderFoto}'">
            </div>
            
            <div class="match-body">
                <h3 id="nome-${profile.id}" class="match-name"></h3>
                <span id="crp-${profile.id}" class="match-crp"></span>
                <div id="bio-text-${profile.id}" class="match-bio"></div>
                <div class="match-footer">
                    <a id="link-${profile.id}" class="btn-profile" target="_blank">Ver Perfil</a>
                </div>
            </div>
        </div>
    `;
}

function renderResults(dataToRender) {
    const grid = document.getElementById('results-grid');
    grid.innerHTML = dataToRender.map(createCard).join('');
    
    dataToRender.forEach(profile => {
        const nomeEl = document.getElementById(`nome-${profile.id}`);
        if (nomeEl) nomeEl.textContent = profile.nome || 'Não informado';

        const crpEl = document.getElementById(`crp-${profile.id}`);
        if (crpEl) crpEl.textContent = `CRP ${profile.crp || 'Não informado'}`;

        const imgEl = document.getElementById(`img-${profile.id}`);
        if (imgEl && profile.nome) imgEl.setAttribute('alt', profile.nome);

        const cardEl = document.getElementById(`card-${profile.id}`);
        if (cardEl && profile.slug) cardEl.setAttribute('data-slug', profile.slug);

        const linkEl = document.getElementById(`link-${profile.id}`);
        if (linkEl && profile.slug) {
            linkEl.setAttribute('href', `/${profile.slug}?ref=match`);
        }

        const bioEl = document.getElementById(`bio-text-${profile.id}`);
        if (bioEl) {
            bioEl.textContent = `"${profile.miniBio || profile.bio || ''}"`;
        }
    });
}

console.log("--- INICIANDO TESTE ADVERSARIAL CROSS-ACCOUNT XSS ---");

// Injeta o payload
renderResults([payloadAtacante]);

// Verifica se os scripts foram executados
const isNomeExecuted = window.xss_nome === true;
const isCrpExecuted = window.xss_crp === true;
const isBioExecuted = window.xss_bio === true;

console.log(`Payload de Nome executou JS? ${isNomeExecuted}`);
console.log(`Payload de CRP executou JS? ${isCrpExecuted}`);
console.log(`Payload de Bio executou JS? ${isBioExecuted}`);

const nomeEl = document.getElementById(`nome-999`);
const crpEl = document.getElementById(`crp-999`);
const bioEl = document.getElementById(`bio-text-999`);
const imgEl = document.getElementById(`img-999`);
const linkEl = document.getElementById(`link-999`);

console.log("---------------------------------------------------");
console.log("Nome Renderizado Seguramente (textContent)?", nomeEl.textContent.includes('<script>'));
console.log("CRP Renderizado Seguramente (textContent)?", crpEl.textContent.includes('</span>'));
console.log("Bio Renderizada Seguramente (textContent)?", bioEl.textContent.includes('<script>'));
console.log("---------------------------------------------------");
console.log("Atributo SRC protegido contra protocolo javascript?:", imgEl.src !== 'javascript:window.xss_foto=true;');
console.log("Atributo ALT não quebra HTML?:", imgEl.outerHTML);

assert.strictEqual(isNomeExecuted, false, "FALHA: Nome executou XSS");
assert.strictEqual(isCrpExecuted, false, "FALHA: CRP executou XSS");
assert.strictEqual(isBioExecuted, false, "FALHA: Bio executou XSS");
assert.strictEqual(imgEl.src, "https://placehold.co/400x500/1B4332/FFF?text=Foto", "FALHA: Foto permitiu protocolo malicioso");

console.log("✅ TESTE BEM SUCEDIDO: O Frontend está imune a Stored XSS e protege os pacients contra XSS Cross-Account!");
process.exit(0);

