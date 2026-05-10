/**
 * Fixtures válidos para `SiteVariables` v2 e `SiteCopySchema` (issues #154, #197).
 *
 * Reusáveis em testes unit + integration. v2 (issue #197) shape nested com
 * `brand_assets` + `address` estruturado + `schema_version: 2`. Tests que
 * querem v1 explícito devem importar `tests/fixtures/site-variables/site-variables-v1.ts`.
 */

import type {
  SiteCar,
  SiteCopy,
  SiteCopyCar,
  SiteVariables,
} from "@/types/lead-site";

const longDescription = (suffix: string) =>
  `Sedã elegante, motor 2.0 turbo, câmbio automático de 8 marchas, ` +
  `revisões em dia, único dono, garantia de fábrica vigente, ` +
  `interior em couro com acabamento premium. ${suffix}`;

const validCar = (slug: string, featured: boolean): SiteCar => {
  const galleryUrls = [
    `https://cdn.example.com/cars/${slug}/1.jpg`,
    `https://cdn.example.com/cars/${slug}/2.jpg`,
    `https://cdn.example.com/cars/${slug}/3.jpg`,
  ];
  return {
    slug,
    brand: "Toyota",
    model: "Corolla",
    year: 2023,
    km: 25_000,
    price: 145_900,
    transmission: "Automático",
    fuel: "Flex",
    color: "Prata",
    description: longDescription(slug),
    thumbnail_url: `https://cdn.example.com/cars/${slug}/thumb.jpg`,
    gallery_urls: galleryUrls,
    photos: galleryUrls,
    datasheet: [
      ["Motor", "2.0 16V"],
      ["Câmbio", "Automático CVT"],
      ["Portas", "4"],
    ],
    featured,
    category: "Sedan",
    plates_visible: false,
  };
};

export const validSiteVariablesFixture: SiteVariables = {
  business_name: "AutoStar Veículos",
  business_slug: "autostar-veiculos",
  slogan: "Carros selecionados com confiança e procedência.",
  phone_display: "(11) 99999-0000",
  whatsapp: "5511999990000",
  email: "contato@autostar.com.br",
  address: {
    street: "Av. Paulista",
    number: "1000",
    neighborhood: "Bela Vista",
    city: "São Paulo",
    state: "SP",
    zip: "01310-100",
    country: "BR",
  },
  hours: "Seg-Sex 09h-18h, Sáb 09h-13h",
  instagram_url: "https://instagram.com/autostar",
  facebook_url: "https://facebook.com/autostar",
  youtube_url: "https://youtube.com/@autostar",
  brand_assets: {
    logo_url: "https://cdn.example.com/autostar/logo.png",
    primary_color: "#0c5fff",
    text_on_primary: "#FFFFFF",
    hero_image_url: "https://cdn.example.com/autostar/hero.jpg",
    about_image_url: "https://cdn.example.com/autostar/about.jpg",
    contact_image_url: "https://cdn.example.com/autostar/contact.jpg",
    car_placeholders: [],
  },
  home_categories: [
    { label: "Sedãs", image_url: "https://cdn.example.com/cat/sedan.jpg" },
    { label: "SUVs", image_url: "https://cdn.example.com/cat/suv.jpg" },
    { label: "Picapes", image_url: "https://cdn.example.com/cat/picape.jpg" },
  ],
  emphasis: {
    title: "Destaque da semana",
    car_name: "Toyota Corolla XEi 2023",
    description:
      "Sedã premium com baixa quilometragem, único dono, revisões em " +
      "concessionária autorizada. Garantia ativa e laudo cautelar aprovado.",
    image_url: "https://cdn.example.com/autostar/emphasis.jpg",
  },
  recent_sales: [
    { car_name: "Honda Civic Touring 2022", image_url: "https://cdn.example.com/recent/1.jpg" },
    { car_name: "Jeep Compass Limited 2023", image_url: "https://cdn.example.com/recent/2.jpg" },
    { car_name: "Volkswagen Nivus Highline 2024", image_url: "https://cdn.example.com/recent/3.jpg" },
  ],
  about_text:
    "A AutoStar Veículos atua há anos no mercado automotivo brasileiro " +
    "oferecendo veículos seminovos selecionados, com procedência verificada " +
    "e laudo cautelar para cada unidade vendida. Nossa equipe é treinada " +
    "para oferecer atendimento consultivo, ajudando o cliente a encontrar " +
    "o carro ideal pra sua necessidade. Trabalhamos com transparência total " +
    "no processo de avaliação, financiamento e troca, mantendo relacionamento " +
    "de longo prazo com cada comprador.",
  mission:
    "Oferecer veículos seminovos com procedência, atendimento honesto e " +
    "preço justo pra cada cliente que entra na loja.",
  vision:
    "Ser referência regional em revenda de seminovos pela transparência, " +
    "confiança e qualidade do atendimento prestado.",
  values: [
    "Transparência em cada negociação realizada",
    "Procedência verificada em todos os veículos",
    "Atendimento consultivo e personalizado sempre",
    "Compromisso com a satisfação do cliente",
  ],
  cars: [
    validCar("toyota-corolla-xei-2023", true),
    validCar("honda-civic-touring-2022", false),
    validCar("jeep-compass-limited-2023", false),
    validCar("volkswagen-nivus-highline-2024", false),
  ],
  schema_version: 2,
  generated_by: "claude-sonnet-4-6",
  generation_version: "v1.0.0",
};

const validCopyCar = (suffix: string, featured: boolean): SiteCopyCar => ({
  description: longDescription(suffix),
  datasheet: [
    ["Motor", "2.0 16V"],
    ["Câmbio", "Automático CVT"],
    ["Portas", "4"],
  ],
  featured,
});

export const validSiteCopyFixture: SiteCopy = {
  slogan: "Carros selecionados com confiança e procedência.",
  home_categories: [{ label: "Sedãs" }, { label: "SUVs" }, { label: "Picapes" }],
  emphasis: {
    title: "Destaque da semana",
    description:
      "Sedã premium com baixa quilometragem, único dono, revisões em " +
      "concessionária autorizada. Garantia ativa e laudo cautelar aprovado.",
  },
  about_text:
    "A AutoStar Veículos atua há anos no mercado automotivo brasileiro " +
    "oferecendo veículos seminovos selecionados, com procedência verificada " +
    "e laudo cautelar para cada unidade vendida. Nossa equipe é treinada " +
    "para oferecer atendimento consultivo, ajudando o cliente a encontrar " +
    "o carro ideal pra sua necessidade. Trabalhamos com transparência total " +
    "no processo de avaliação, financiamento e troca, mantendo relacionamento " +
    "de longo prazo com cada comprador.",
  mission:
    "Oferecer veículos seminovos com procedência, atendimento honesto e " +
    "preço justo pra cada cliente que entra na loja.",
  vision:
    "Ser referência regional em revenda de seminovos pela transparência, " +
    "confiança e qualidade do atendimento prestado.",
  values: [
    "Transparência em cada negociação realizada",
    "Procedência verificada em todos os veículos",
    "Atendimento consultivo e personalizado sempre",
    "Compromisso com a satisfação do cliente",
  ],
  cars: [
    validCopyCar("copy-1", true),
    validCopyCar("copy-2", false),
    validCopyCar("copy-3", false),
    validCopyCar("copy-4", false),
  ],
};
