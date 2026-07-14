const fs = require('fs');
let content = fs.readFileSync('views/profissionais.ejs', 'utf-8');

const oldCssStart = content.indexOf('.plans-section {');
const oldCssEndMarker = '.plan-card .btn-cta-principal:hover';
const oldCssEndIdx = content.indexOf(oldCssEndMarker, oldCssStart);
const oldCssEnd = content.indexOf('}', oldCssEndIdx) + 1;

if (oldCssStart !== -1 && oldCssEnd !== -1) {
    let beforeCss = content.substring(0, oldCssStart);
    let afterCss = content.substring(oldCssEnd);

    // CSS replacement string
    const newCss = `/* APP-LIKE PRICING SECTION */
        .app-pricing-section {
            background-color: #1B4332;
            padding: 60px 0 80px 0;
            color: #fff;
            position: relative;
            text-align: center;
        }
        
        .app-pricing-slider {
            display: flex;
            overflow-x: auto;
            scroll-snap-type: x mandatory;
            gap: 20px;
            padding: 20px;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
            align-items: stretch;
        }
        .app-pricing-slider::-webkit-scrollbar { display: none; }

        .app-pricing-card {
            flex: 0 0 85%;
            scroll-snap-align: center;
            background: rgba(255, 255, 255, 0.98);
            border-radius: 24px;
            padding: 30px 24px;
            display: flex;
            flex-direction: column;
            color: #333;
            box-shadow: 0 8px 30px rgba(0,0,0,0.1);
            position: relative;
            min-width: 280px;
            text-decoration: none;
        }

        .app-pricing-card.featured {
            border: 3px solid var(--cor-Yelo);
            background: #fff;
            z-index: 2;
        }

        .app-pricing-tag {
            background: var(--cor-Yelo);
            color: #1B4332;
            font-size: 0.8rem;
            font-weight: 800;
            text-transform: uppercase;
            padding: 6px 14px;
            border-radius: 50px;
            position: absolute;
            top: -15px;
            left: 50%;
            transform: translateX(-50%);
            white-space: nowrap;
            box-shadow: 0 4px 10px rgba(0,0,0,0.1);
        }

        .app-pricing-title {
            font-family: var(--font-titulos);
            font-size: 1.4rem;
            margin-bottom: 5px;
            color: #1B4332;
        }
        
        .app-pricing-subtitle {
            font-size: 0.9rem;
            color: #666;
            margin-bottom: 25px;
            font-weight: 400;
        }

        .app-pricing-features {
            list-style: none;
            padding: 0;
            margin: 0 0 30px 0;
            text-align: left;
            flex-grow: 1;
        }
        .app-pricing-features li {
            padding: 12px 0;
            border-bottom: 1px solid rgba(0,0,0,0.05);
            font-size: 0.95rem;
            color: #555;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .app-pricing-features li:last-child {
            border-bottom: none;
        }

        .app-pricing-btn {
            margin-top: auto;
            border-radius: 50px;
            padding: 14px 20px;
            font-weight: 700;
            font-size: 1.05rem;
            text-align: center;
            transition: all 0.3s ease;
        }
        .app-pricing-btn-outline {
            color: #1B4332;
            border: 2px solid #1B4332;
            background: transparent;
        }
        .app-pricing-card.featured .app-pricing-btn {
            background: #1B4332;
            color: #fff;
            border: none;
        }

        /* Dots Indicator */
        .app-pricing-dots {
            display: flex;
            justify-content: center;
            gap: 8px;
            margin-top: 15px;
        }
        .app-pricing-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: rgba(255,255,255,0.3);
        }
        .app-pricing-dot.active {
            background: var(--cor-Yelo);
            width: 24px;
            border-radius: 4px;
        }

        @media (min-width: 992px) {
            .app-pricing-section { padding: 100px 0 120px 0; }
            .app-pricing-slider {
                max-width: 1100px;
                margin: 40px auto 0;
                grid-template-columns: repeat(3, 1fr);
                display: grid;
                overflow: visible;
                padding: 0 20px;
            }
            .app-pricing-card {
                flex: auto;
                padding: 40px 30px;
            }
            .app-pricing-card.featured {
                transform: scale(1.05);
            }
            .app-pricing-card:hover {
                transform: translateY(-8px);
                box-shadow: 0 12px 40px rgba(0,0,0,0.2);
            }
            .app-pricing-card.featured:hover {
                transform: scale(1.05) translateY(-8px);
            }
            .app-pricing-dots { display: none; }
        }`;

    content = beforeCss + newCss + afterCss;
}

// 2. Remove mobile CSS old logic inside media queries
content = content.replace(/, \.plans-grid/g, '');
content = content.replace(/\.benefits-grid::-webkit-scrollbar, \.diferenciais-grid::-webkit-scrollbar, \.depoimentos-grid::-webkit-scrollbar/g, '.benefits-grid::-webkit-scrollbar, .diferenciais-grid::-webkit-scrollbar, .depoimentos-grid::-webkit-scrollbar');
content = content.replace(/, \.plan-card/g, '');

// also remove the manual plan-card lines in mobile
const manualLinesStart = content.indexOf('.plans-section { padding: 50px 20px 60px 20px; }');
if (manualLinesStart !== -1) {
    const manualLinesEnd = content.indexOf('.plan-features li { padding: 8px 0; font-size: 0.95rem; }', manualLinesStart) + '.plan-features li { padding: 8px 0; font-size: 0.95rem; }'.length;
    content = content.substring(0, manualLinesStart) + content.substring(manualLinesEnd);
}

// 3. Replace HTML
const htmlStart = content.indexOf('<!-- PLANOS -->');
const htmlEndMarker = '<!-- CTA FINAL -->';
const htmlEndIdx = content.indexOf(htmlEndMarker, htmlStart);

if (htmlStart !== -1 && htmlEndIdx !== -1) {
    let beforeHtml = content.substring(0, htmlStart);
    let afterHtml = content.substring(htmlEndIdx);

    const newHtml = `<!-- PLANOS (App-Like Mobile First) -->
        <section class="app-pricing-section">
            <div class="wave-divider wave-bottom" style="z-index: 1;">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 320" preserveAspectRatio="none">
                    <path fill="#fdfaf6" fill-opacity="1" d="M0,96L48,112C96,128,192,160,288,160C384,160,480,128,576,112C672,96,768,96,864,112C960,128,1056,160,1152,165.3C1248,171,1344,149,1392,138.7L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
                </svg>
            </div>
            
            <div class="container" style="position: relative; z-index: 2;">
                <h2 class="titulo-secao" style="color: #fff;">Planos transparentes</h2>
                <p class="subtitulo-secao" style="color: rgba(255,255,255,0.9);">Sem fidelidade, cancele quando quiser.</p>

                <div class="app-pricing-slider" id="pricingSlider">
                    <!-- Plano Essencial -->
                    <a href="/psi_questionario" class="app-pricing-card">
                        <h3 class="app-pricing-title">Essencial</h3>
                        <div class="app-pricing-subtitle">Iniciando na plataforma</div>
                        <ul class="app-pricing-features">
                            <li>
                                <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"></path></svg>
                                Perfil verificado
                            </li>
                            <li>
                                <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"></path></svg>
                                Match Inteligente
                            </li>
                            <li>
                                <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"></path></svg>
                                Página Pública
                            </li>
                        </ul>
                        <div class="app-pricing-btn app-pricing-btn-outline">Começar na Yelo</div>
                    </a>

                    <!-- Plano Clínico (Destaque) -->
                    <a href="/psi_questionario" class="app-pricing-card featured">
                        <div class="app-pricing-tag">Mais Popular</div>
                        <h3 class="app-pricing-title">Clínico</h3>
                        <div class="app-pricing-subtitle">Alavanque seus atendimentos</div>
                        <ul class="app-pricing-features">
                            <li>
                                <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"></path></svg>
                                Perfil destacado
                            </li>
                            <li>
                                <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"></path></svg>
                                Intervisão e Workshops
                            </li>
                            <li>
                                <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"></path></svg>
                                Indicadores de Conversão
                            </li>
                        </ul>
                        <div class="app-pricing-btn">Começar na Yelo</div>
                    </a>

                    <!-- Plano Referência -->
                    <a href="/psi_questionario" class="app-pricing-card">
                        <h3 class="app-pricing-title">Referência</h3>
                        <div class="app-pricing-subtitle">Para profissionais estabelecidos</div>
                        <ul class="app-pricing-features">
                            <li>
                                <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"></path></svg>
                                Máxima visibilidade
                            </li>
                            <li>
                                <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"></path></svg>
                                Supervisão Clínica
                            </li>
                            <li>
                                <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"></path></svg>
                                Destaque em Buscas
                            </li>
                        </ul>
                        <div class="app-pricing-btn app-pricing-btn-outline">Começar na Yelo</div>
                    </a>
                </div>

                <div class="app-pricing-dots" id="pricingDots">
                    <div class="app-pricing-dot"></div>
                    <div class="app-pricing-dot active"></div>
                    <div class="app-pricing-dot"></div>
                </div>
                
                <script>
                    document.addEventListener("DOMContentLoaded", function() {
                        const slider = document.getElementById('pricingSlider');
                        const dots = document.querySelectorAll('#pricingDots .app-pricing-dot');
                        if(slider && dots.length > 0) {
                            // Inicialmente tenta centralizar no Clínico se for mobile
                            if (window.innerWidth < 992) {
                                setTimeout(() => {
                                    const cardWidth = slider.children[1].offsetWidth;
                                    slider.scrollTo({ left: cardWidth - 20, behavior: 'smooth' });
                                }, 300);
                            }

                            slider.addEventListener('scroll', () => {
                                const scrollPos = slider.scrollLeft;
                                const cardWidth = slider.offsetWidth;
                                let index = Math.round(scrollPos / cardWidth);
                                if(index < 0) index = 0;
                                if(index > 2) index = 2;
                                dots.forEach((d, i) => {
                                    if(i === index) d.classList.add('active');
                                    else d.classList.remove('active');
                                });
                            });
                        }
                    });
                </script>
            </div>
        </section>

        `;
    
    content = beforeHtml + newHtml + afterHtml;
}

fs.writeFileSync('views/profissionais.ejs', content);
console.log('Done!');
