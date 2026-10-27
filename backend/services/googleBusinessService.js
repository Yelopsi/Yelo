const axios = require('axios');

const NON_BUSINESS_TYPES = new Set([
    'route', 'street_address', 'street_number', 'premise', 'subpremise',
    'locality', 'sublocality', 'sublocality_level_1', 'sublocality_level_2',
    'administrative_area_level_1', 'administrative_area_level_2',
    'postal_code', 'political', 'country', 'geocode', 'intersection',
    'colloquial_area', 'natural_feature', 'neighborhood', 'plus_code'
]);

const INCOMPATIBLE_PRIMARY_TYPES = new Set([
    'restaurant', 'food', 'cafe', 'bar', 'night_club', 'bakery',
    'supermarket', 'grocery_store', 'convenience_store',
    'car_dealer', 'car_repair', 'gas_station', 'parking',
    'lodging', 'hotel', 'motel', 'movie_theater',
    'transit_station', 'subway_station', 'bus_station', 'train_station', 'airport',
    'bank', 'atm', 'real_estate_agency', 'lawyer', 'accounting',
    'veterinary_care', 'pet_store', 'car_wash', 'laundry'
]);

const HEALTH_KEYWORDS = [
    'psicolog', 'psicoterap', 'terap', 'terapeut', 'clinic', 'consultor',
    'saude', 'neuro', 'psico', 'atendimento', 'espaco', 'instituto',
    'desenvolvimento', 'mente', 'bem estar', 'cuidar', 'acolher',
    'integrar', 'equilibrio', 'saude mental', 'comportamento'
];

const HEALTH_ESTABLISHMENT_TYPES = new Set([
    'health', 'doctor', 'medical_clinic', 'physiotherapist',
    'hospital', 'spa', 'wellness_center', 'counselor', 'mental_health_clinic'
]);

const STOP_WORDS = new Set([
    'de', 'da', 'do', 'dos', 'das', 'e', 'em', 'dr', 'dra', 'psi', 'psicologa', 'psicologo'
]);

class GoogleBusinessService {
    /**
     * Normaliza strings para comparação fonética/textual (sem acentos e pontuação)
     */
    static normalizeForComparison(str) {
        if (!str || typeof str !== 'string') return '';
        return str
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Resolve URLs curtas do Google Maps (maps.app.goo.gl, g.page, etc.)
     */
    static async resolveMapsUrl(rawUrl) {
        if (!rawUrl || typeof rawUrl !== 'string') return null;
        let url = rawUrl.trim();
        if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

        try {
            if (url.includes('maps.app.goo.gl') || url.includes('goo.gl/maps') || url.includes('g.page')) {
                let currentUrl = url;
                for (let i = 0; i < 6; i++) {
                    const response = await axios.get(currentUrl, {
                        maxRedirects: 0,
                        timeout: 8000,
                        validateStatus: (status) => status >= 200 && status < 400,
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                        }
                    });

                    const location = response.headers?.location;
                    if (location) {
                        currentUrl = new URL(location, currentUrl).href;
                        if (/[?&]place_?id=/i.test(currentUrl)) return currentUrl;
                    } else {
                        break;
                    }
                }
                return currentUrl;
            }
        } catch (err) {
            console.warn(`[GoogleBusinessService] Erro ao resolver URL curta: ${err.message}`);
        }
        return url;
    }

    /**
     * Converte identificadores hexadecimais do Google Maps (0x...:0x...) em Place ID oficial (ChIJ...)
     */
    static hexPairToPlaceId(hex1, hex2) {
        try {
            const b1 = BigInt(hex1.startsWith('0x') ? hex1 : '0x' + hex1);
            const b2 = BigInt(hex2.startsWith('0x') ? hex2 : '0x' + hex2);

            const buf = Buffer.alloc(20);
            buf[0] = 0x0a;
            buf[1] = 0x12;
            buf[2] = 0x09;
            buf.writeBigUInt64LE(b1, 3);
            buf[11] = 0x11;
            buf.writeBigUInt64LE(b2, 12);

            return buf.toString('base64')
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/, '');
        } catch {
            return null;
        }
    }

    /**
     * Extrai o Place ID oficial (ChIJ...) a partir de links ou entradas de texto
     */
    static extractPlaceId(input) {
        if (!input || typeof input !== 'string') return null;
        const trimmed = input.trim();

        // 1. Place ID direto (ChIJ...)
        if (/^ChIJ[a-zA-Z0-9_-]{20,}$/.test(trimmed)) return trimmed;

        // 2. Parâmetro query (?place_id= ou ?placeid=)
        const queryMatch = trimmed.match(/[?&]place_?id=([a-zA-Z0-9_-]+)/i);
        if (queryMatch && queryMatch[1].startsWith('ChIJ')) return queryMatch[1];

        // 3. Rota /place/.../ChIJ...
        const placeMatch = trimmed.match(/\/place\/[^/]+\/([a-zA-Z0-9_-]+)/);
        if (placeMatch && placeMatch[1].startsWith('ChIJ')) return placeMatch[1];

        // 4. Feature ID Hexadecimal (!1s0x...:0x...)
        const hexMatch = trimmed.match(/!1s(0x[0-9a-fA-F]+):(0x[0-9a-fA-F]+)/);
        if (hexMatch) {
            const converted = this.hexPairToPlaceId(hexMatch[1], hexMatch[2]);
            if (converted && converted.startsWith('ChIJ')) return converted;
        }

        return null;
    }

    /**
     * Valida se o estabelecimento encontrado pelo Google corresponde ao psicólogo ou a uma clínica de saúde
     */
    static validatePlaceMatch(place, psychologistName, psychologistRazaoSocial) {
        const placeName = place.displayName?.text || '';
        const normPlace = this.normalizeForComparison(placeName);
        const placeTypes = Array.isArray(place.types) ? place.types : [];
        const primaryType = place.primaryType || '';

        // 1. Rejeita se todos os tipos forem geográficos/endereço ou se o tipo primário for geográfico
        const isAllGeographic = placeTypes.length > 0 && placeTypes.every(t => NON_BUSINESS_TYPES.has(t));
        const isPrimaryGeographic = NON_BUSINESS_TYPES.has(primaryType);
        if (isAllGeographic || isPrimaryGeographic) {
            return {
                valid: false,
                error: `O link informado aponta para uma rua, bairro ou região geográfica ("${placeName || 'Local genérico'}"), e não para um perfil comercial do Google Meu Negócio. Para exibir avaliações na Yelo, é necessário ter um perfil de empresa cadastrado no Google Meu Negócio.`
            };
        }

        // 2. Rejeita se o estabelecimento for de categoria sabidamente incompatível
        if (INCOMPATIBLE_PRIMARY_TYPES.has(primaryType)) {
            return {
                valid: false,
                error: `O local identificado no Google Maps ("${placeName}") pertence à categoria "${primaryType}", que não corresponde a serviços de saúde ou psicologia.`
            };
        }

        // 3. Verifica correspondência com o nome do psicólogo ou razão social
        const combinedPsiName = `${psychologistName || ''} ${psychologistRazaoSocial || ''}`;
        const normPsi = this.normalizeForComparison(combinedPsiName);
        const psiTokens = normPsi.split(' ').filter(t => t.length >= 3 && !STOP_WORDS.has(t));

        const hasNameMatch = psiTokens.some(token => normPlace.includes(token));
        if (hasNameMatch) {
            return { valid: true };
        }

        // 4. Se o nome não coincidir diretamente com o nome profissional nem com a razão social:
        // Rejeita para garantir que nunca sejam puxadas avaliações de outros profissionais ou clínicas vizinhas no mesmo endereço
        return {
            valid: false,
            error: `O local encontrado no Google Maps ("${placeName}") não possui correspondência com o seu nome profissional ("${psychologistName}"). Para garantir que apenas as suas próprias avaliações sejam exibidas, certifique-se de usar o link do seu próprio perfil comercial no Google Meu Negócio.`
        };
    }

    /**
     * Função principal de sincronização com o Google Places
     */
    static async syncReviews({ googleUrl, placeId, psychologistName, psychologistCity, psychologistRazaoSocial }) {
        const apiKey = process.env.GOOGLE_PLACES_API_KEY;
        if (!apiKey) {
            return {
                success: false,
                error: 'A chave da Google Places API não está configurada no servidor.'
            };
        }

        let resolvedUrl = googleUrl;
        if (googleUrl) {
            resolvedUrl = await this.resolveMapsUrl(googleUrl);
        }

        let detectedPlaceId = placeId ? placeId.trim() : null;
        if (!detectedPlaceId && resolvedUrl) {
            detectedPlaceId = this.extractPlaceId(resolvedUrl);
        }

        // Validação: aceita link oficial de pedir avaliações (g.page/r/...), links Maps, ou Place ID direto (ChIJ...)
        const isOfficialReviewUrl = googleUrl && (
            googleUrl.includes('g.page/r/') || 
            googleUrl.includes('placeid=ChIJ') || 
            googleUrl.includes('place_id=ChIJ') ||
            googleUrl.includes('maps.app.goo.gl') ||
            googleUrl.includes('goo.gl/maps') ||
            googleUrl.includes('google.com/maps') ||
            googleUrl.includes('g.page')
        );
        const isDirectPlaceId = (placeId && placeId.trim().startsWith('ChIJ')) || 
                               (googleUrl && googleUrl.trim().startsWith('ChIJ')) ||
                               (detectedPlaceId && detectedPlaceId.startsWith('ChIJ'));

        if (!isOfficialReviewUrl && !isDirectPlaceId) {
            return {
                success: false,
                error: 'Utilize o link oficial de Pedir Avaliações (https://g.page/r/...), link do Google Maps ou o Place ID oficial (começa com ChIJ).'
            };
        }

        if (!detectedPlaceId || !detectedPlaceId.startsWith('ChIJ')) {
            return {
                success: false,
                error: 'Não foi possível identificar o Place ID oficial a partir do link informado. Certifique-se de que o link aponta diretamente para o seu consultório cadastrado no Google Meu Negócio.'
            };
        }

        // --- CHAMADA COM CHAVE DE API (Google Places API v1 / New) ---
        try {
            const newDetailsUrl = `https://places.googleapis.com/v1/places/${encodeURIComponent(detectedPlaceId)}`;
            const response = await axios.get(newDetailsUrl, {
                headers: {
                    'X-Goog-Api-Key': apiKey,
                    'X-Goog-FieldMask': 'id,displayName,types,primaryType,businessStatus,rating,userRatingCount,reviews,googleMapsUri,formattedAddress',
                    'X-Goog-LanguageCode': 'pt-BR'
                },
                timeout: 8000
            });

            if (!response.data || !response.data.id) {
                return {
                    success: false,
                    error: 'Perfil não encontrado no Google Maps com o link ou Place ID informado.'
                };
            }

            const place = response.data;

            // Validação de status operacional
            if (place.businessStatus === 'CLOSED_PERMANENTLY') {
                return {
                    success: false,
                    error: 'Este local no Google Maps consta como permanentemente fechado.'
                };
            }

            // Validação de correspondência com o psicólogo / estabelecimento de saúde
            const matchValidation = this.validatePlaceMatch(place, psychologistName, psychologistRazaoSocial);
            if (!matchValidation.valid) {
                return {
                    success: false,
                    error: matchValidation.error
                };
            }

            const reviews = (place.reviews || []).map(r => ({
                author_name: r.authorAttribution?.displayName || 'Paciente Verificado',
                rating: r.rating || 5,
                text: r.text?.text || r.originalText?.text || (typeof r.text === 'string' ? r.text : ''),
                relative_time_description: r.relativePublishTimeDescription || 'recentemente',
                profile_photo_url: r.authorAttribution?.photoUri || null,
                time: r.publishTime ? Math.floor(new Date(r.publishTime).getTime() / 1000) : Math.floor(Date.now() / 1000)
            }));

            return {
                success: true,
                is_live: true,
                is_simulated: false,
                place_id: place.id,
                place_name: place.displayName?.text || null,
                place_url: place.googleMapsUri || resolvedUrl || googleUrl,
                rating: place.rating ? parseFloat(Number(place.rating).toFixed(1)) : 5.0,
                user_ratings_total: place.userRatingCount !== undefined ? place.userRatingCount : reviews.length,
                reviews: reviews,
                synced_at: new Date().toISOString()
            };
        } catch (err) {
            console.warn(`[GoogleBusinessService] Falha na Places API oficial: ${err.message}`);
            const statusCode = err.response?.status;
            if (statusCode === 404) {
                return {
                    success: false,
                    error: 'O perfil correspondente a este link ou Place ID não foi encontrado no Google Maps. Verifique o link e tente novamente.'
                };
            }
            return {
                success: false,
                error: err.response?.data?.error?.message || 'Falha ao consultar a API do Google Maps. Tente novamente mais tarde.'
            };
        }
    }
}

module.exports = GoogleBusinessService;
