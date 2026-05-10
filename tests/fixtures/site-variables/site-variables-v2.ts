/**
 * Fixture v2 — shape **nested novo** de `SiteVariables` (pós-issue #197).
 *
 * Usado em `tests/unit/lib/sites/migrate-variables.test.ts` para validar
 * que `readSiteVariables` aceita v2 direto sem invocar fallback v1.
 *
 * Campos derivados do schema canônico em `types/lead-site.ts:SiteVariables`.
 * Inclui `schema_version: 2` (discriminator) + `brand_assets` nested +
 * `address` estruturado + `testimonials` opcional.
 */

import type { SiteVariables } from "@/types/lead-site";

export const fixtureSiteVariablesV2: SiteVariables = {
  // Identidade
  business_name: "Auto Fit Multimarcas",
  business_slug: "auto-fit-multimarcas",
  slogan: "Seu próximo carro está aqui — vistoriado e com garantia.",
  years_in_market: 12,

  // Contato
  phone_display: "(11) 98765-4321",
  whatsapp: "5511987654321",
  email: "contato@autofit.com.br",
  address: {
    street: "Av. Paulista",
    number: "1000",
    neighborhood: "Bela Vista",
    city: "São Paulo",
    state: "SP",
    zip: "01310-100",
    country: "BR",
  },
  hours: "Seg-Sex: 9h-18h | Sáb: 9h-13h",

  // Social
  instagram_url: "https://instagram.com/autofitmultimarcas",
  facebook_url: null,
  youtube_url: null,
  whatsapp_url: "https://wa.me/5511987654321",

  // Visual
  brand_assets: {
    logo_url: "https://example.com/logo-auto-fit.png",
    primary_color: "#0f172a",
    text_on_primary: "#FFFFFF",
    hero_image_url: "/assets/hero/porsche-model5.png",
    about_image_url: "/assets/about/porsche-model.png",
    contact_image_url: "/assets/contact/bmw-m2.png",
    car_placeholders: [],
  },

  // Conteúdo de página
  home_categories: [
    { label: "SUVs Premium", image_url: "/assets/stock/range-rover.png" },
    { label: "Sedans", image_url: "/assets/stock/m2.png" },
    { label: "Hatchs", image_url: "/assets/stock/type-r.png" },
  ],
  emphasis: {
    title: "Destaque da semana",
    car_name: "Range Rover Sport",
    description:
      "SUV premium top de linha, único dono, revisada em concessionária Land Rover. Documentação OK e garantia de 90 dias.",
    image_url: "/assets/stock/range-rover.png",
  },
  recent_sales: [
    { car_name: "BMW M2", image_url: "/assets/stock/m2.png" },
    { car_name: "Mustang GT", image_url: "/assets/stock/mustang.png" },
    { car_name: "Honda Civic Type R", image_url: "/assets/stock/type-r.png" },
  ],

  // Sobre
  about_text:
    "A Auto Fit nasceu em São Paulo há 12 anos com a missão de descomplicar a compra de seminovos premium. " +
    "Cada veículo do nosso estoque passa por inspeção rigorosa de 150 pontos antes de entrar à venda. " +
    "Trabalhamos com financiamento facilitado e aceitamos seu carro como entrada na avaliação justa baseada na FIPE.",
  mission: "Tornar a compra de seminovos premium uma experiência confiável e descomplicada.",
  vision: "Ser referência regional em qualidade, transparência e atendimento personalizado.",
  values: [
    "Honestidade no preço e no estado do veículo",
    "Vistoria técnica antes da venda",
    "Documentação verificada e em dia",
    "Atendimento humano via WhatsApp em até 30 minutos",
  ],

  // Estoque
  cars: [
    {
      slug: "bmw-m2-2023-001",
      brand: "BMW",
      model: "M2 Coupé",
      version: "Competition",
      year: 2023,
      km: 12450,
      price: 489900,
      transmission: "Automático",
      fuel: "Gasolina",
      color: "Cinza",
      doors: 2,
      category: "Esportivo",
      description:
        "BMW M2 Coupé 2023 com 12.450 km originais, único dono, revisões realizadas em concessionária BMW. " +
        "Bancos em couro, sistema de áudio Harman Kardon, rodas 19'' originais.",
      thumbnail_url: "/assets/stock/m2.png",
      gallery_urls: [
        "/assets/stock/m2.png",
        "/assets/stock/m2.png",
        "/assets/stock/m2.png",
      ],
      photos: [
        "/assets/stock/m2.png",
        "/assets/stock/m2.png",
        "/assets/stock/m2.png",
      ],
      datasheet: [
        ["Motor", "3.0 Twin-Turbo"],
        ["Potência", "460 cv"],
      ],
      featured: true,
      plates_visible: false,
    },
    {
      slug: "porsche-911-gt3-2024-002",
      brand: "Porsche",
      model: "911 GT3",
      year: 2024,
      km: 4200,
      price: 1689000,
      transmission: "Automático",
      fuel: "Gasolina",
      color: "Branco",
      doors: 2,
      category: "Esportivo",
      description:
        "Porsche 911 GT3 2024 praticamente zero km, único dono, com pacote Sport Chrono e bancos esportivos. " +
        "Documentação OK, IPVA pago. Veículo de colecionador, oportunidade rara.",
      thumbnail_url: "/assets/stock/gt3.png",
      gallery_urls: [
        "/assets/stock/gt3.png",
        "/assets/stock/gt3.png",
        "/assets/stock/gt3.png",
      ],
      photos: [
        "/assets/stock/gt3.png",
        "/assets/stock/gt3.png",
        "/assets/stock/gt3.png",
      ],
      datasheet: [
        ["Motor", "4.0 Boxer-6"],
        ["Potência", "510 cv"],
      ],
      featured: true,
      plates_visible: false,
    },
    {
      slug: "ford-mustang-gt-2022-003",
      brand: "Ford",
      model: "Mustang GT 5.0",
      year: 2022,
      km: 28900,
      price: 389900,
      transmission: "Automático",
      fuel: "Gasolina",
      color: "Vermelho",
      doors: 2,
      category: "Conversível",
      description:
        "Ford Mustang GT 5.0 2022 conversível, motor V8, completo de fábrica. " +
        "Único dono, sempre garagem, todas as revisões realizadas em concessionária autorizada.",
      thumbnail_url: "/assets/stock/mustang.png",
      gallery_urls: [
        "/assets/stock/mustang.png",
        "/assets/stock/mustang.png",
        "/assets/stock/mustang.png",
      ],
      photos: [
        "/assets/stock/mustang.png",
        "/assets/stock/mustang.png",
        "/assets/stock/mustang.png",
      ],
      datasheet: [
        ["Motor", "5.0 V8"],
        ["Potência", "466 cv"],
      ],
      featured: false,
      plates_visible: false,
    },
    {
      slug: "honda-civic-type-r-2021-004",
      brand: "Honda",
      model: "Civic Type R",
      year: 2021,
      km: 41200,
      price: 269900,
      transmission: "Manual",
      fuel: "Gasolina",
      color: "Branco",
      doors: 5,
      category: "Hatch",
      description:
        "Honda Civic Type R 2021 com 41.200 km originais. Performance hatch turbo, câmbio manual de 6 marchas. " +
        "Sempre revisado, segundo dono, manual e chave reserva. Aceitamos troca.",
      thumbnail_url: "/assets/stock/type-r.png",
      gallery_urls: [
        "/assets/stock/type-r.png",
        "/assets/stock/type-r.png",
        "/assets/stock/type-r.png",
      ],
      photos: [
        "/assets/stock/type-r.png",
        "/assets/stock/type-r.png",
        "/assets/stock/type-r.png",
      ],
      datasheet: [
        ["Motor", "2.0 Turbo"],
        ["Potência", "315 cv"],
      ],
      featured: false,
      plates_visible: false,
    },
  ],

  // Trust
  testimonials: [
    {
      author_name: "João Silva",
      author_avatar_url: null,
      rating: 5,
      text:
        "Comprei meu BMW M2 na Auto Fit. Atendimento impecável e o carro estava em estado ótimo. Vistoria foi minuciosa, recebi o histórico completo do veículo. Recomendo!",
      source: "google",
    },
    {
      author_name: "Maria Costa",
      author_avatar_url: null,
      rating: 5,
      text:
        "Excelente equipe. Trocaram meu Civic antigo na entrada e fecharam um financiamento sem complicação. Documentação estava em dia e em 24h saí com o carro novo.",
      source: "google",
    },
  ],

  // Metadata
  schema_version: 2,
  generated_by: "claude-sonnet-4-6",
  generation_version: "v2.0.0",
};
