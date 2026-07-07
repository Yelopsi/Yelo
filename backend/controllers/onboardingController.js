const db = require('../models');
const { v4: uuidv4 } = require('uuid');

exports.getSettings = async (req, res) => {
    try {
        const psi = await db.Psychologist.findByPk(req.user.id, {
            attributes: ['contractTemplate', 'pixKey', 'cidade', 'cpf', 'cnpj', 'valor_sessao_numero', 'contract_duracao_sessao', 'contract_prazo_cancelamento', 'contract_tolerancia_atraso', 'contract_plataforma', 'contract_modalidade_pagamento', 'contract_frequencia_sessao', 'contract_valor_reajuste']
        });
        
        let contractTemplate = psi.contractTemplate;
        
        // Se não tiver template, fornece o padrão da Yelo
        if (!contractTemplate) {
            contractTemplate = `**CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE PSICOTERAPIA INDIVIDUAL**

**IDENTIFICAÇÃO DAS PARTES CONTRATANTES**
**PRESTADOR DE SERVIÇOS:** [NOME_DO_PROFISSIONAL], psicólogo(a), inscrito(a) no Conselho Regional de Psicologia sob o número [CRP_DO_PROFISSIONAL], doravante denominado(a) "Prestador de Serviços".
**CLIENTE:** A pessoa que assina digitalmente o documento ou seu responsável legal, doravante denominada "Cliente".

As partes acima qualificadas têm, entre si, justo e acordado o presente contrato de prestação de serviços psicológicos, regido pelas cláusulas e condições abaixo estabelecidas.

**CLÁUSULA 1 - OBJETO**
1.1 O presente contrato tem como objeto a prestação de serviços de psicoterapia individual pelo Prestador de Serviços ao Cliente, realizada de forma remota por meio de Tecnologias Digitais da Informação e da Comunicação (TDICs).

**CLÁUSULA 2 - SERVIÇOS PRESTADOS**
2.1 O Prestador de Serviços compromete-se a realizar as sessões de psicoterapia em conformidade com as diretrizes do Conselho Regional de Psicologia e o Código de Ética Profissional do Psicólogo.

**CLÁUSULA 3 - MODALIDADE DO ATENDIMENTO ONLINE E RESPONSABILIDADES**
3.1 As sessões serão realizadas de forma síncrona, através de videochamada via [PLATAFORMA_ATENDIMENTO], conforme acordo prévio entre as partes.
3.2 O Prestador de Serviços se compromete a garantir o sigilo e a segurança da comunicação utilizando rede de Wi-Fi segura, fones de ouvido e realizando a sessão em um cômodo fechado, sem acesso de terceiros.
3.3 O Cliente declara estar ciente de que o atendimento ocorrerá de forma remota e se responsabiliza por garantir as condições adequadas de sua parte, utilizando um ambiente privado, seguro, livre de interrupções e com conexão estável de internet para a realização das sessões.

**CLÁUSULA 4 - DURAÇÃO E FREQUÊNCIA DAS SESSÕES**
4.1 As sessões terão duração de [DURACAO_SESSAO] minutos e serão realizadas com frequência [FREQUENCIA_SESSAO], em dia e horário agendados de comum acordo entre as partes.

**CLÁUSULA 5 - CONFIDENCIALIDADE**
5.1 O Prestador de Serviços compromete-se a manter total sigilo sobre todas as informações compartilhadas pelo Cliente, respeitando o Código de Ética Profissional do Psicólogo.

**CLÁUSULA 6 - RESPONSABILIDADES DO CLIENTE**
6.1 O Cliente compromete-se a comparecer pontualmente às sessões agendadas e a realizar os pagamentos dos honorários nos valores e datas estipuladas neste contrato.

**CLÁUSULA 7 - HONORÁRIOS E FORMA DE PAGAMENTO**
7.1 Os honorários são fixados no valor de R$ [VALOR_SESSAO] por [MODALIDADE_PAGAMENTO]. O pagamento deverá ser realizado no início de cada mês, em parcela única, correspondente ao número total de sessões previstas para o referido mês.
7.2 O valor dos honorários será reajustado anualmente em R$ [VALOR_REAJUSTE] por [MODALIDADE_PAGAMENTO], a contar da data de início da prestação dos serviços.

**CLÁUSULA 8 - ATRASO, CANCELAMENTO E REMARCAÇÃO**
8.1 O cancelamento ou remarcação de sessão deverá ser comunicado com, no mínimo, [PRAZO_CANCELAMENTO] horas de antecedência. Caso o aviso ocorra com prazo inferior, o Cliente ficará sujeito ao pagamento integral da sessão.
8.2 Atrasos do Cliente serão tolerados em até [TOLERANCIA_ATRASO] minutos. Após este período, a sessão será considerada como realizada e cobrada em seu valor integral.

**CLÁUSULA 9 - LIMITAÇÕES DO SERVIÇO E EMERGÊNCIAS**
9.1 O serviço de psicoterapia online não é um serviço de emergência e não oferece aconselhamento jurídico, médico ou financeiro.
9.2 Em situações de urgência, emergência, crise, risco à vida ou ideação suicida, o Cliente deverá buscar imediatamente um serviço presencial de emergência, como o SAMU (192), o CVV (188) ou o hospital mais próximo, não sendo o atendimento online o meio adequado para intervenções desta natureza.

**CLÁUSULA 10 - ABRANGÊNCIA TERRITORIAL**
10.1 Este serviço é regido pela legislação brasileira e pelas resoluções do Conselho Federal de Psicologia. A prestação do serviço destina-se a pessoas em território nacional.
10.2 Para brasileiros residentes no exterior, o Cliente assume a responsabilidade de verificar se o acompanhamento psicológico online com um profissional brasileiro não infringe a legislação local de seu país de residência.

**CLÁUSULA 11 - RESCISÃO DO CONTRATO**
11.1 Este contrato poderá ser rescindido por qualquer uma das partes mediante aviso prévio, sem ônus. O Cliente será responsável pelo pagamento das sessões realizadas até a data da rescisão.

**CLÁUSULA 12 - FORO**
12.1 Fica eleito o foro da Comarca de [CIDADE_PROFISSIONAL] para dirimir quaisquer controvérsias oriundas do presente contrato, com renúncia expressa a qualquer outro.

E por estarem de acordo com todos os termos, as partes firmam o presente contrato para que surta seus efeitos legais a partir do seu recebimento e/ou assinatura digital.

[CIDADE_PROFISSIONAL], [DATA_ATUAL]`;

        }

        res.json({ 
            contractTemplate: contractTemplate,
            pixKey: psi.pixKey || '',
            cidade: psi.cidade || '',
            documento: psi.cpf || psi.cnpj || '',
            valor_sessao_numero: psi.valor_sessao_numero || '',
            contract_duracao_sessao: psi.contract_duracao_sessao || '50',
            contract_prazo_cancelamento: psi.contract_prazo_cancelamento || '24',
            contract_tolerancia_atraso: psi.contract_tolerancia_atraso || '15',
            contract_plataforma: psi.contract_plataforma || 'Google Meet',
            contract_modalidade_pagamento: psi.contract_modalidade_pagamento || 'sessão',
            contract_frequencia_sessao: psi.contract_frequencia_sessao || 'semanal',
            contract_valor_reajuste: psi.contract_valor_reajuste || '10,00'
        });
    } catch (error) {
        console.error('Erro ao buscar configurações de onboarding:', error);
        res.status(500).json({ error: 'Erro ao buscar configurações.' });
    }
};

exports.updateSettings = async (req, res) => {
    try {
        const { contractTemplate, pixKey, cidade, documento, valor_sessao_numero, contract_duracao_sessao, contract_prazo_cancelamento, contract_tolerancia_atraso, contract_plataforma, contract_modalidade_pagamento, contract_frequencia_sessao, contract_valor_reajuste } = req.body;
        
        const updateData = { contractTemplate, pixKey };
        if (cidade !== undefined) updateData.cidade = cidade;
        if (valor_sessao_numero !== undefined) updateData.valor_sessao_numero = valor_sessao_numero ? parseFloat(valor_sessao_numero) : null;
        if (documento !== undefined) {
            const cleanDoc = documento.replace(/\D/g, '');
            if (cleanDoc.length > 11) {
                updateData.cnpj = documento;
            } else {
                updateData.cpf = documento;
            }
        }
        
        if (contract_duracao_sessao !== undefined) updateData.contract_duracao_sessao = contract_duracao_sessao;
        if (contract_prazo_cancelamento !== undefined) updateData.contract_prazo_cancelamento = contract_prazo_cancelamento;
        if (contract_tolerancia_atraso !== undefined) updateData.contract_tolerancia_atraso = contract_tolerancia_atraso;
        if (contract_plataforma !== undefined) updateData.contract_plataforma = contract_plataforma;
        if (contract_modalidade_pagamento !== undefined) updateData.contract_modalidade_pagamento = contract_modalidade_pagamento;
        if (contract_frequencia_sessao !== undefined) updateData.contract_frequencia_sessao = contract_frequencia_sessao;
        if (contract_valor_reajuste !== undefined) updateData.contract_valor_reajuste = contract_valor_reajuste;

        await db.Psychologist.update(updateData, { where: { id: req.user.id } });
        
        res.json({ message: 'Configurações atualizadas com sucesso.' });
    } catch (error) {
        console.error('Erro ao atualizar configurações de onboarding:', error);
        res.status(500).json({ error: 'Erro ao atualizar configurações.' });
    }
};

exports.createLinkForPatient = async (psi, patientName, patientId = null) => {
    let contractText = psi.contractTemplate;
    if (!contractText) {
        contractText = `**CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE PSICOTERAPIA INDIVIDUAL**

**IDENTIFICAÇÃO DAS PARTES CONTRATANTES**
**PRESTADOR DE SERVIÇOS:** [NOME_DO_PROFISSIONAL], psicólogo(a), inscrito(a) no Conselho Regional de Psicologia sob o número [CRP_DO_PROFISSIONAL], doravante denominado(a) "Prestador de Serviços".
**CLIENTE:** A pessoa que assina digitalmente o documento ou seu responsável legal, doravante denominada "Cliente".

As partes acima qualificadas têm, entre si, justo e acordado o presente contrato de prestação de serviços psicológicos, regido pelas cláusulas e condições abaixo estabelecidas.

**CLÁUSULA 1 - OBJETO**
1.1 O presente contrato tem como objeto a prestação de serviços de psicoterapia individual pelo Prestador de Serviços ao Cliente, realizada de forma remota por meio de Tecnologias Digitais da Informação e da Comunicação (TDICs).

**CLÁUSULA 2 - SERVIÇOS PRESTADOS**
2.1 O Prestador de Serviços compromete-se a realizar as sessões de psicoterapia em conformidade com as diretrizes do Conselho Regional de Psicologia e o Código de Ética Profissional do Psicólogo.

**CLÁUSULA 3 - MODALIDADE DO ATENDIMENTO ONLINE E RESPONSABILIDADES**
3.1 As sessões serão realizadas de forma síncrona, através de videochamada via [PLATAFORMA_ATENDIMENTO], conforme acordo prévio entre as partes.
3.2 O Prestador de Serviços se compromete a garantir o sigilo e a segurança da comunicação utilizando rede de Wi-Fi segura, fones de ouvido e realizando a sessão em um cômodo fechado, sem acesso de terceiros.
3.3 O Cliente declara estar ciente de que o atendimento ocorrerá de forma remota e se responsabiliza por garantir as condições adequadas de sua parte, utilizando um ambiente privado, seguro, livre de interrupções e com conexão estável de internet para a realização das sessões.

**CLÁUSULA 4 - DURAÇÃO E FREQUÊNCIA DAS SESSÕES**
4.1 As sessões terão duração de [DURACAO_SESSAO] minutos e serão realizadas com frequência [FREQUENCIA_SESSAO], em dia e horário agendados de comum acordo entre as partes.

**CLÁUSULA 5 - CONFIDENCIALIDADE**
5.1 O Prestador de Serviços compromete-se a manter total sigilo sobre todas as informações compartilhadas pelo Cliente, respeitando o Código de Ética Profissional do Psicólogo.

**CLÁUSULA 6 - RESPONSABILIDADES DO CLIENTE**
6.1 O Cliente compromete-se a comparecer pontualmente às sessões agendadas e a realizar os pagamentos dos honorários nos valores e datas estipuladas neste contrato.

**CLÁUSULA 7 - HONORÁRIOS E FORMA DE PAGAMENTO**
7.1 Os honorários são fixados no valor de R$ [VALOR_SESSAO] por [MODALIDADE_PAGAMENTO]. O pagamento deverá ser realizado no início de cada mês, em parcela única, correspondente ao número total de sessões previstas para o referido mês.
7.2 O valor dos honorários será reajustado anualmente em R$ [VALOR_REAJUSTE] por [MODALIDADE_PAGAMENTO], a contar da data de início da prestação dos serviços.

**CLÁUSULA 8 - ATRASO, CANCELAMENTO E REMARCAÇÃO**
8.1 O cancelamento ou remarcação de sessão deverá ser comunicado com, no mínimo, [PRAZO_CANCELAMENTO] horas de antecedência. Caso o aviso ocorra com prazo inferior, o Cliente ficará sujeito ao pagamento integral da sessão.
8.2 Atrasos do Cliente serão tolerados em até [TOLERANCIA_ATRASO] minutos. Após este período, a sessão será considerada como realizada e cobrada em seu valor integral.

**CLÁUSULA 9 - LIMITAÇÕES DO SERVIÇO E EMERGÊNCIAS**
9.1 O serviço de psicoterapia online não é um serviço de emergência e não oferece aconselhamento jurídico, médico ou financeiro.
9.2 Em situações de urgência, emergência, crise, risco à vida ou ideação suicida, o Cliente deverá buscar imediatamente um serviço presencial de emergência, como o SAMU (192), o CVV (188) ou o hospital mais próximo, não sendo o atendimento online o meio adequado para intervenções desta natureza.

**CLÁUSULA 10 - ABRANGÊNCIA TERRITORIAL**
10.1 Este serviço é regido pela legislação brasileira e pelas resoluções do Conselho Federal de Psicologia. A prestação do serviço destina-se a pessoas em território nacional.
10.2 Para brasileiros residentes no exterior, o Cliente assume a responsabilidade de verificar se o acompanhamento psicológico online com um profissional brasileiro não infringe a legislação local de seu país de residência.

**CLÁUSULA 11 - RESCISÃO DO CONTRATO**
11.1 Este contrato poderá ser rescindido por qualquer uma das partes mediante aviso prévio, sem ônus. O Cliente será responsável pelo pagamento das sessões realizadas até a data da rescisão.

**CLÁUSULA 12 - FORO**
12.1 Fica eleito o foro da Comarca de [CIDADE_PROFISSIONAL] para dirimir quaisquer controvérsias oriundas do presente contrato, com renúncia expressa a qualquer outro.

E por estarem de acordo com todos os termos, as partes firmam o presente contrato para que surta seus efeitos legais a partir do seu recebimento e/ou assinatura digital.

[CIDADE_PROFISSIONAL], [DATA_ATUAL]`;
    }

    const dataAtual = new Date().toLocaleDateString('pt-BR');
    const docProfissional = psi.cpf || psi.cnpj || '';
    const valorSessao = psi.valor_sessao_numero ? psi.valor_sessao_numero.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : 'A combinar';

    contractText = contractText.replace(/\[NOME_DO_PROFISSIONAL\]/gi, psi.nome || '');
    contractText = contractText.replace(/\[CRP_DO_PROFISSIONAL\]/gi, psi.crp || '');
    contractText = contractText.replace(/\[NOME_DO_PACIENTE\]/gi, patientName || '');
    contractText = contractText.replace(/\[CIDADE_PROFISSIONAL\]/gi, psi.cidade || '');
    contractText = contractText.replace(/\[DOCUMENTO_PROFISSIONAL\]/gi, docProfissional);
    contractText = contractText.replace(/\[VALOR_SESSAO\]/gi, valorSessao);
    contractText = contractText.replace(/\[CHAVE_PIX\]/gi, psi.pixKey || 'CHAVE NÃO INFORMADA');
    contractText = contractText.replace(/\[DURACAO_SESSAO\]/gi, psi.contract_duracao_sessao || '50');
    contractText = contractText.replace(/\[TOLERANCIA_ATRASO\]/gi, psi.contract_tolerancia_atraso || '15');
    contractText = contractText.replace(/\[PRAZO_CANCELAMENTO\]/gi, psi.contract_prazo_cancelamento || '24');
    contractText = contractText.replace(/\[PLATAFORMA_ATENDIMENTO\]/gi, psi.contract_plataforma || 'Google Meet');
    contractText = contractText.replace(/\[MODALIDADE_PAGAMENTO\]/gi, psi.contract_modalidade_pagamento || 'sessão');
    contractText = contractText.replace(/\[FREQUENCIA_SESSAO\]/gi, psi.contract_frequencia_sessao || 'semanal');
    contractText = contractText.replace(/\[VALOR_REAJUSTE\]/gi, psi.contract_valor_reajuste || '10,00');
    contractText = contractText.replace(/\[DATA_ATUAL\]/gi, dataAtual);

    const { v4: uuidv4 } = require('uuid');
    const token = uuidv4().replace(/-/g, '').slice(0, 12); 

    await db.PatientOnboardingLink.create({
        token,
        psychologistId: psi.id,
        patientId,
        patientName,
        status: 'pending',
        contractText: contractText,
        pixKey: psi.pixKey || ''
    });

    return {
        link: `${process.env.FRONTEND_URL || 'https://yelo.com.br'}/b/${token}`,
        token
    };
};

exports.generateLink = async (req, res) => {
    try {
        const { patientName } = req.body;
        if (!patientName) return res.status(400).json({ error: 'Nome do paciente é obrigatório.' });

        const psi = await db.Psychologist.findByPk(req.user.id);
        if (!psi) return res.status(404).json({ error: 'Psicólogo não encontrado.' });

        const linkData = await exports.createLinkForPatient(psi, patientName);

        res.json(linkData);
    } catch (error) {
        console.error('Erro ao gerar link de onboarding:', error);
        res.status(500).json({ error: 'Erro ao gerar link.' });
    }
};

exports.getPublicLinkData = async (req, res) => {
    try {
        const { token } = req.params;
        const link = await db.PatientOnboardingLink.findOne({
            where: { token },
            include: [{ model: db.Psychologist, as: 'psychologist', attributes: ['nome', 'fotoUrl', 'crp', 'cpf', 'cnpj'] }]
        });

        if (!link) return res.status(404).json({ error: 'Link inválido ou expirado.' });

        res.json({
            psychologistName: link.psychologist.nome,
            psychologistPhoto: link.psychologist.fotoUrl,
            psychologistCrp: link.psychologist.crp,
            psychologistDoc: link.psychologist.cpf || link.psychologist.cnpj || '',
            patientName: link.patientName,
            status: link.status,
            contractText: link.contractText,
            pixKey: link.pixKey,
            signedAt: link.signedAt,
            ipAddress: link.ipAddress,
            userAgent: link.userAgent,
            patientData: link.patientData
        });
    } catch (error) {
        console.error('Erro ao buscar link público:', error);
        res.status(500).json({ error: 'Erro ao buscar dados do link.' });
    }
};

exports.signContract = async (req, res) => {
    try {
        const { token } = req.params;
        const { cpf, dob, emergencyContact, signatureName, isMinor, guardianName, guardianCpf } = req.body;
        
        const link = await db.PatientOnboardingLink.findOne({ where: { token } });
        if (!link) return res.status(404).json({ error: 'Link não encontrado.' });
        if (link.status === 'signed') return res.status(400).json({ error: 'Contrato já assinado.' });

        const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const userAgent = req.headers['user-agent'];

        await link.update({
            status: 'signed',
            signedAt: new Date(),
            ipAddress,
            userAgent,
            patientData: {
                cpf,
                dob,
                emergencyContact,
                signatureName,
                isMinor,
                guardianName,
                guardianCpf
            }
        });

        if (link.patientId && isMinor) {
            await db.Patient.update({
                responsavel_nome: guardianName || null,
                responsavel_cpf: guardianCpf || null
            }, { where: { id: link.patientId } });
        }

        res.json({ success: true, pixKey: link.pixKey });
    } catch (error) {
        console.error('Erro ao assinar contrato:', error);
        res.status(500).json({ error: 'Erro interno ao registrar assinatura.' });
    }
};
