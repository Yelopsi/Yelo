/**
 * Utilitário central de sanitização e formatação para mensagens de WhatsApp.
 * 
 * Garante que textos vindos de IAs (Gemini) ou de templates administrativos
 * respeitem estritamente as regras do parser nativo do WhatsApp:
 * 
 * 1. Converte negrito duplo markdown (**texto**) para negrito WhatsApp (*texto*).
 * 2. Converte itálico duplo markdown (__texto__) para itálico WhatsApp (_texto_).
 * 3. Converte cabeçalhos (# Titulo, ## Subtitulo, ### Secao) para negrito (*Titulo*).
 * 4. Converte marcadores de lista markdown (* item ou - item) para bullets (• item),
 *    evitando que asteriscos soltos no início de linha se fundam com outros asteriscos,
 *    o que quebra a formatação do WhatsApp.
 * 5. Converte links markdown [Texto](URL) para "Texto: URL".
 * 6. Remove divisores markdown (--- ou ___).
 * 7. Corrige espaços colados aos asteriscos (* texto * -> *texto*), que desativam o negrito no WhatsApp.
 * 8. Corrige espaços colados aos underlines (_ texto _ -> _texto_).
 * 9. Remove blocos de código (```whatsapp ou ```) e aspas envolvendo o texto todo.
 * 10. Normaliza quebras de linha Windows/Mac (\r\n -> \n) e remove excesso de quebras em branco.
 */

function formatForWhatsApp(text, options = {}) {
    if (!text || typeof text !== 'string') return '';

    const preserveDashBullets = options && options.preserveDashBullets === true;

    let cleaned = text
        // Converte sequências literais "\n" se presentes sem quebras reais ou misturadas no JSON
        .replace(/\\r\\n/g, '\n')
        .replace(/\\n/g, '\n')
        // Normaliza quebras de linha para \n
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        // Remove blocos de código tipo ```whatsapp ... ``` ou ``` ... ```
        .replace(/^```[a-zA-Z]*\n?/gm, '')
        .replace(/```$/gm, '')
        // Remove aspas externas cercando todo o texto
        .replace(/^["'“”](.*)["'“”]$/s, '$1')
        // Remove linhas divisórias markdown (--- ou ___)
        .replace(/^[-*_]{3,}\s*$/gm, '')
        // Converte cabeçalhos markdown (# Titulo, ## Subtitulo) em negrito (*Titulo*)
        .replace(/^#{1,6}\s*(.+)$/gm, '*$1*')
        // Converte links markdown [Texto](URL) para "Texto: URL" (WhatsApp não suporta links markdown)
        .replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, '$1: $2')
        // Converte negrito duplo markdown **texto** em negrito WhatsApp *texto*
        .replace(/\*\*([^*\n]+?)\*\*/g, '*$1*')
        // Converte itálico duplo __texto__ em itálico WhatsApp _texto_
        .replace(/__([^_\n]+?)__/g, '_$1_');

    if (preserveDashBullets) {
        // Remove sublinhados malformados envolvendo marcadores de lista (ex.: "_- Item_" ou ":_- Item")
        cleaned = cleaned
            .replace(/([:.;!?])_+[ \t]*-[ \t]+/g, '$1\n- ')
            .replace(/^[ \t]*_+[ \t]*(-[ \t]+.+?)_+$/gm, '$1')
            .replace(/^[ \t]*_+[ \t]*(-[ \t]+)/gm, '$1')
            // Separa bullets colados na mesma linha após pontuação (sem quebrar faixas "R$ 51 - R$ 90")
            .replace(/([:.;!?])_*[ \t]+-[ \t]+(?=[A-Za-zÀ-ÿ0-9*])/g, '$1\n- ')
            // Converte bullets unicode (•, ▪) em "- " padrão WhatsApp
            .replace(/^[ \t]*[•▪][ \t]+/gm, '- ')
            // Na Copilot, preserva "- item" e converte marcadores soltos "* item" (sem fechar negrito) em "- item"
            .replace(/^\*\s+(?!\*)(.+)$/gm, (full, itemText) => {
                return itemText.includes('*') ? full : `- ${itemText}`;
            });

        // Separa eventuais múltiplos "- Item" remanescentes na mesma linha após ponto/itálico
        cleaned = cleaned.replace(/([.!?])(?:_+)?[ \t]+-[ \t]+(?=[A-Za-zÀ-ÿ0-9*])/g, '$1\n- ');

        // Remove itálico acidental envolvendo parágrafos longos inteiros (>= 140 chars ou múltiplos bullets)
        cleaned = cleaned.replace(/(^|\n)_([^_\n]{140,})_([ \t]*(?=\n|$))/g, '$1$2$3');
        cleaned = cleaned.replace(/(-[ \t]+[^\n]+?)_+(?=\n|$)/g, '$1');
    } else {
        // Mantém comportamento legado para demais callers
        cleaned = cleaned.replace(/^[-]\s+/gm, '* ');
    }

    cleaned = cleaned
        // Corrige espaços inválidos dentro de asteriscos do WhatsApp (* texto * -> *texto*)
        // Usa apenas espaços horizontais [ \t] para jamais colapsar quebras de linha
        .replace(/\*[ \t]+([^*\n]+?)[ \t]+\*/g, '*$1*')
        .replace(/\*[ \t]+([^*\n]+?)\*/g, '*$1*')
        .replace(/\*([^*\n]+?)[ \t]+\*/g, '*$1*')
        // Garante espaço após *negrito* quando colado a próxima palavra (preserva pontuação como , . :)
        .replace(/\*([^*\n]+?)\*(?=[A-Za-zÀ-ÿ0-9])/g, '*$1* ')
        // Corrige espaços inválidos dentro de itálicos do WhatsApp (_ texto _ -> _texto_)
        .replace(/_[ \t]+([^_\n]+?)[ \t]+_/g, '_$1_')
        .replace(/_[ \t]+([^_\n]+?)_/g, '_$1_')
        .replace(/_([^_\n]+?)[ \t]+_/g, '_$1_')
        // Remove espaços sobrando ao final de cada linha mantendo as quebras intactas
        .replace(/[ \t]+$/gm, '')
        // Limpa quebras de linha triplas ou maiores
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    return cleaned;
}

module.exports = { formatForWhatsApp };
