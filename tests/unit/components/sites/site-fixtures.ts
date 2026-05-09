/**
 * Fixtures compartilhadas para os testes de `components/sites/*` (#161).
 *
 * Mantém os mocks alinhados aos campos consumidos por cada componente; ao
 * adicionar campo novo em qualquer componente, esta fixture deve ser
 * estendida para evitar `undefined` em runtime nos testes.
 */
import type { SiteVariables } from "@/types/lead-site";

export const SITE_FIXTURE: SiteVariables = {
  business_name: "Touring Cars",
  business_slug: "touring-cars",
  slogan: "Qualidade, Segurança, Transparência.",
  primary_color: "#0C0C0C",
  text_on_primary: "#FFFFFF",
  logo_url: "https://cdn.example.com/touring/logo.png",
  whatsapp: "5581981000000",
  phone_display: "(81) 3512-9411",
  email: "contato@touringcars.com.br",
  instagram_url: "https://instagram.com/touringcars",
  facebook_url: "https://facebook.com/touringcars",
  youtube_url: "https://youtube.com/@touringcars",
  address_line: "Av. Boa Viagem, 1000 — Recife/PE",
  hours: "Seg–Sex 09h–18h",
  hero_image_url: "https://cdn.example.com/touring/hero.jpg",
  home_categories: [
    { label: "Sedan", image_url: "https://cdn.example.com/cat/1.jpg" },
    { label: "SUV", image_url: "https://cdn.example.com/cat/2.jpg" },
    { label: "Hatch", image_url: "https://cdn.example.com/cat/3.jpg" },
  ],
  emphasis: {
    title: "Em destaque",
    car_name: "Toyota Corolla 2022",
    description:
      "Sedã premium com motor 2.0, câmbio CVT e único dono. Revisões em concessionária.",
    image_url: "https://cdn.example.com/touring/emphasis.jpg",
  },
  recent_sales: [
    {
      car_name: "Honda Civic 2021",
      image_url: "https://cdn.example.com/sales/1.jpg",
    },
    {
      car_name: "VW T-Cross 2020",
      image_url: "https://cdn.example.com/sales/2.jpg",
    },
    {
      car_name: "Hyundai HB20 2019",
      image_url: "https://cdn.example.com/sales/3.jpg",
    },
  ],
  about_text:
    "A Touring Cars atua há mais de 10 anos no mercado de seminovos com foco em qualidade e transparência. Nossa equipe é dedicada a oferecer a melhor experiência de compra, com veículos revisados e financiamento facilitado para o cliente final.",
  about_image_url: "https://cdn.example.com/touring/about.jpg",
  mission: "Tornar a compra de carros seminovos confiável e simples.",
  vision: "Ser referência em transparência no mercado de seminovos no Nordeste.",
  values: [
    "Transparência",
    "Compromisso",
    "Qualidade",
    "Atendimento humano",
  ],
  contact_hero_image_url: "https://cdn.example.com/touring/contact.jpg",
  cars: [
    {
      slug: "toyota-corolla-2022",
      brand: "Toyota",
      model: "Corolla",
      year: 2022,
      km: 35000,
      price: 119900,
      transmission: "CVT",
      fuel: "Flex",
      color: "Prata",
      description:
        "Sedan top de linha em estado impecável. Multimídia com Apple CarPlay, bancos em couro e revisões em concessionária. Único dono, IPVA 2026 pago.",
      thumbnail_url: "https://cdn.example.com/cars/corolla-thumb.jpg",
      gallery_urls: [
        "https://cdn.example.com/cars/corolla-1.jpg",
        "https://cdn.example.com/cars/corolla-2.jpg",
        "https://cdn.example.com/cars/corolla-3.jpg",
      ],
      datasheet: [["Motor", "2.0 16v"]],
      featured: true,
    },
    {
      slug: "honda-civic-2021",
      brand: "Honda",
      model: "Civic",
      year: 2021,
      km: 42000,
      price: 109900,
      transmission: "Automático",
      fuel: "Flex",
      color: "Branco",
      description:
        "Civic Touring com motor turbo, central multimídia e baixa quilometragem. Revisões em dia e laudo cautelar disponível.",
      thumbnail_url: "https://cdn.example.com/cars/civic-thumb.jpg",
      gallery_urls: [
        "https://cdn.example.com/cars/civic-1.jpg",
        "https://cdn.example.com/cars/civic-2.jpg",
        "https://cdn.example.com/cars/civic-3.jpg",
      ],
      datasheet: [["Motor", "1.5 Turbo"]],
      featured: false,
    },
    {
      slug: "vw-tcross-2020",
      brand: "Volkswagen",
      model: "T-Cross",
      year: 2020,
      km: 58000,
      price: 89900,
      transmission: "Automático",
      fuel: "Flex",
      color: "Cinza",
      description:
        "SUV compacto, economia de combustível, Apple CarPlay e baixa rodagem. Acompanha manuais e chave reserva.",
      thumbnail_url: "https://cdn.example.com/cars/tcross-thumb.jpg",
      gallery_urls: [
        "https://cdn.example.com/cars/tcross-1.jpg",
        "https://cdn.example.com/cars/tcross-2.jpg",
        "https://cdn.example.com/cars/tcross-3.jpg",
      ],
      datasheet: [["Motor", "1.0 TSI"]],
      featured: false,
    },
    {
      slug: "hyundai-hb20-2019",
      brand: "Hyundai",
      model: "HB20",
      year: 2019,
      km: 71000,
      price: 59900,
      transmission: "Manual",
      fuel: "Flex",
      color: "Vermelho",
      description:
        "Hatch econômico, ideal para uso urbano. Revisões em dia e bancos higienizados. Acompanha laudo cautelar.",
      thumbnail_url: "https://cdn.example.com/cars/hb20-thumb.jpg",
      gallery_urls: [
        "https://cdn.example.com/cars/hb20-1.jpg",
        "https://cdn.example.com/cars/hb20-2.jpg",
        "https://cdn.example.com/cars/hb20-3.jpg",
      ],
      datasheet: [["Motor", "1.0 12v"]],
      featured: false,
    },
  ],
  generated_by: "claude-sonnet-4-6",
  generation_version: "v1.0.0",
};
