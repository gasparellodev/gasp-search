/**
 * Gerador de conteúdo PT-BR para a Política de Privacidade (LGPD)
 * (Phase 7 / Frente 05 Premium Pass — issue #P10).
 *
 * Módulo PURO (sem I/O). Recebe dados do site e retorna as 7 seções
 * canonicamente definidas pela LGPD (Lei nº 13.709/2018) em forma de
 * objetos estruturados, prontos para renderização com heading hierarchy,
 * âncoras de skip-nav e aria-labels.
 *
 * Sanitização: `business_name` é interpolado em texto — o caller é
 * responsável por garantir que o valor venha de `SiteVariablesV2.business_name`
 * já validado por Zod (max 80 chars, min 1). Não há renderização de HTML
 * bruto; todo output é texto plano para ser escapado pelo React.
 */

export interface LgpdContentInput {
  business_name: string;
  email: string | null;
  city: string | null;
  state: string | null;
  appUrl: string;
  slug: string;
}

export interface LgpdSection {
  /** ID único para âncora de skip-nav e aria-labelledby. */
  id: string;
  heading: string;
  paragraphs: string[];
}

/**
 * Retorna o e-mail do DPO (Data Protection Officer). Usa o e-mail do
 * negócio quando disponível; caso contrário, gera um e-mail sugestão com
 * base no slug (não é um endereço real — deve ser atualizado pelo titular).
 */
function resolveDpoEmail(email: string | null, slug: string): string {
  if (email && email.trim().length > 0) return email.trim();
  // Fallback: sugestão de e-mail baseada no slug sem o prefixo nanoid (6-8 chars alfanuméricos).
  // Ex: "j7k2p9-touring-cars" → "dpo@touring-cars.com.br"
  // Ex: "abc12345-minha-loja" → "dpo@minha-loja.com.br"
  const cleanSlug = slug.replace(/^[a-z0-9]{6,8}-/, "").replace(/_/g, "-");
  return `dpo@${cleanSlug}.com.br`;
}

/**
 * Formata a localização como "Cidade, UF" quando ambos os campos estão
 * disponíveis, ou omite quando ausentes.
 */
function formatLocation(city: string | null, state: string | null): string | null {
  if (city && state) return `${city}, ${state}`;
  if (city) return city;
  return null;
}

/**
 * Formata a data atual em PT-BR para o rodapé da política.
 * Usa `new Date()` — correto pois esta página revalida por ISR.
 */
export function formatUpdateDate(): string {
  return new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  });
}

/**
 * Constrói as 7 seções canônicas da Política de Privacidade LGPD.
 *
 * Seções definidas conforme Lei nº 13.709/2018 (LGPD) e ANPD:
 *  1. Coleta de Dados
 *  2. Finalidade do Tratamento
 *  3. Compartilhamento de Dados
 *  4. Direitos do Titular
 *  5. Cookies e Tecnologias de Rastreamento
 *  6. Contato e DPO
 *  7. Atualizações desta Política
 */
export function buildLgpdSections(input: LgpdContentInput): LgpdSection[] {
  const { business_name, email, city, state, appUrl, slug } = input;
  const dpoEmail = resolveDpoEmail(email, slug);
  const location = formatLocation(city, state);
  const locationPhrase = location ? `em ${location}` : "no Brasil";

  return [
    {
      id: "coleta-de-dados",
      heading: "1. Coleta de Dados Pessoais",
      paragraphs: [
        `A ${business_name} ("nós") respeita a sua privacidade e está comprometida com a proteção dos seus dados pessoais, em conformidade com a Lei Geral de Proteção de Dados Pessoais (LGPD — Lei nº 13.709/2018).`,
        "Coletamos os dados que você nos fornece voluntariamente ao preencher formulários neste site — como nome, e-mail, telefone, interesse em veículo e mensagem. Também podemos registrar informações técnicas estritamente necessárias para o funcionamento seguro do site, como endereço IP, tipo de navegador e preferências de cookies.",
        "Não coletamos dados sensíveis (origem racial ou étnica, convicção religiosa, opinião política, dado genético ou biométrico) e não realizamos coleta automática de dados além dos cookies descritos na seção específica abaixo.",
      ],
    },
    {
      id: "finalidade-do-tratamento",
      heading: "2. Finalidade do Tratamento",
      paragraphs: [
        "Utilizamos seus dados pessoais exclusivamente para as seguintes finalidades:",
        "• Responder às suas solicitações de contato e apresentar veículos do nosso estoque conforme o seu interesse;\n• Avaliar propostas de compra, venda ou troca de veículos;\n• Manter a segurança e o funcionamento adequado deste site;\n• Cumprir obrigações legais e regulatórias aplicáveis;\n• Com o seu consentimento expresso: mensurar o desempenho de navegação e efetividade de campanhas de marketing digital.",
        "Não utilizamos seus dados para fins incompatíveis com os informados acima nem para decisões automatizadas que produzam efeitos jurídicos significativos.",
      ],
    },
    {
      id: "compartilhamento-de-dados",
      heading: "3. Compartilhamento de Dados",
      paragraphs: [
        `A ${business_name} não vende, aluga ou cede seus dados pessoais a terceiros para fins comerciais.`,
        "Podemos compartilhar seus dados apenas nas seguintes situações: com prestadores de serviço contratados para operar este site (como hospedagem e plataformas de comunicação), que estão vinculados a obrigações de confidencialidade e proteção de dados; e quando exigido por lei, regulamento ou ordem judicial.",
        "Em todos os casos de compartilhamento, adotamos medidas contratuais e técnicas para garantir que seus dados sejam tratados com o mesmo nível de segurança que aplicamos internamente.",
      ],
    },
    {
      id: "direitos-do-titular",
      heading: "4. Direitos do Titular de Dados",
      paragraphs: [
        "Nos termos da LGPD (arts. 17–22), você — enquanto titular dos dados — tem os seguintes direitos, exercíveis a qualquer momento:",
        "• Confirmação da existência de tratamento;\n• Acesso aos dados que mantemos sobre você;\n• Correção de dados incompletos, inexatos ou desatualizados;\n• Anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade com a LGPD;\n• Portabilidade dos dados a outro fornecedor de serviço;\n• Eliminação dos dados tratados com base no seu consentimento;\n• Informação sobre as entidades com as quais compartilhamos seus dados;\n• Revogação do consentimento a qualquer momento.",
        `Para exercer qualquer desses direitos, entre em contato conosco pelo e-mail ${dpoEmail}. Responderemos dentro do prazo legal de 15 dias corridos.`,
      ],
    },
    {
      id: "cookies",
      heading: "5. Cookies e Tecnologias de Rastreamento",
      paragraphs: [
        "Este site utiliza cookies para garantir o funcionamento correto das suas funcionalidades e, com o seu consentimento, para análise de desempenho e efetividade de marketing.",
        "Os cookies são classificados em: (a) Necessários — essenciais para navegação e segurança, sempre ativos; (b) Analíticos — medem o desempenho e a experiência de navegação (opt-in); (c) Marketing — usados para medir efetividade de campanhas (opt-in).",
        `Você pode gerenciar ou revogar as suas preferências de cookies a qualquer momento pelo banner de consentimento exibido na sua primeira visita ou acessando a página ${appUrl}/sites/${slug}/lgpd. A revogação do consentimento não afeta o tratamento realizado anteriormente.`,
      ],
    },
    {
      id: "contato-dpo",
      heading: "6. Contato e Encarregado (DPO)",
      paragraphs: [
        `A ${business_name}, ${locationPhrase}, é a controladora dos dados pessoais tratados neste site.`,
        `Nomeamos um Encarregado pelo Tratamento de Dados Pessoais (DPO) responsável por atender às suas solicitações e esclarecer dúvidas sobre privacidade. Para contato direto com o DPO ou para exercer seus direitos como titular, utilize o e-mail: ${dpoEmail}`,
        "Procuraremos responder a todas as solicitações dentro do prazo estabelecido pela LGPD. Caso não esteja satisfeito com nossa resposta, você também pode apresentar reclamação à Autoridade Nacional de Proteção de Dados (ANPD) pelo portal gov.br/anpd.",
      ],
    },
    {
      id: "atualizacoes",
      heading: "7. Atualizações desta Política",
      paragraphs: [
        "Esta Política de Privacidade pode ser atualizada periodicamente para refletir mudanças em nossas práticas, na legislação aplicável ou em nossos serviços. Quando realizarmos alterações materiais, informaremos por meio de aviso visível neste site.",
        "Recomendamos que você consulte esta página regularmente. A data da última atualização está indicada no rodapé desta política.",
        "O uso continuado do site após a publicação de alterações será considerado aceitação das mudanças realizadas.",
      ],
    },
  ];
}
