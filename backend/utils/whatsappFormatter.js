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

function formatForWhatsApp(text) {
    if (!text || typeof text !== 'string') return '';

    let cleaned = text
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
        .replace(/__([^_\n]+?)__/g, '_$1_')
        // Normaliza marcadores de lista com hífen (- item) para asterisco (* item)
        // preservando a sintaxe nativa de tópicos do WhatsApp (* item e * *negrito*)
        .replace(/^[-]\s+/gm, '* ')
        // Corrige espaços inválidos dentro de asteriscos do WhatsApp (* texto * -> *texto*)
        // Usa apenas espaços horizontais [ \t] para jamais colapsar quebras de linha
        .replace(/\*[ \t]+([^*\n]+?)[ \t]+\*/g, '*$1*')
        .replace(/\*[ \t]+([^*\n]+?)\*/g, '*$1*')
        .replace(/\*([^*\n]+?)[ \t]+\*/g, '*$1*')
        // Corrige espaços inválidos dentro de itálicos do WhatsApp (_ texto _ -> _texto_)
        .replace(/_[ \t]+([^_\n]+?)[ \t]+_/g, '_$1_')
        .replace(/_[ \t]+([^_\n]+?)_/g, '_$1_')
        .replace(/_([^_\n]+?)[ \t]+_/g, '_$1_')
        // Limpa quebras de linha triplas ou maiores
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    return cleaned;
}

module.exports = { formatForWhatsApp };
