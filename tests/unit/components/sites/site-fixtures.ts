/**
 * Fixtures compartilhadas para os testes de `components/sites/*` (#161, v2 em #206).
 *
 * v2 shape (issue #206): `brand_assets` nested + `address` estruturado +
 * `schema_version: 2`. Tests que querem v1 explícito devem importar
 * `tests/fixtures/site-variables/site-variables-v1.ts`.
 */
import type { SiteCar, SiteVariablesV2 } from "@/types/lead-site";

const buildCar = (
  slug: string,
  brand: string,
  model: string,
  year: number,
  km: number,
  price: number,
  description: string,
  thumb: string,
  galleryBase: string,
  datasheet: ReadonlyArray<readonly [string, string]>,
  featured: boolean,
  transmission: SiteCar["transmission"] = "Automático",
  fuel: SiteCar["fuel"] = "Flex",
  color = "Prata",
): SiteCar => {
  const galleryUrls = [
    `${galleryBase}-1.jpg`,
    `${galleryBase}-2.jpg`,
    `${galleryBase}-3.jpg`,
  ];
  return {
    slug,
    brand,
    model,
    year,
    km,
    price,
    transmission,
    fuel,
    color,
    description,
    thumbnail_url: thumb,
    gallery_urls: galleryUrls,
    photos: galleryUrls,
    datasheet: datasheet.map((d) => [d[0], d[1]]),
    featured,
    category: "Sedan",
    plates_visible: false,
  };
};

export const SITE_FIXTURE: SiteVariablesV2 = {
  business_name: "Touring Cars",
  business_slug: "touring-cars",
  slogan: "Qualidade, Segurança, Transparência.",
  phone_display: "(81) 3512-9411",
  whatsapp: "5581981000000",
  email: "contato@touringcars.com.br",
  address: {
    street: "Av. Boa Viagem",
    number: "1000",
    neighborhood: "Boa Viagem",
    city: "Recife",
    state: "PE",
    zip: "51020-000",
    country: "BR",
  },
  hours: "Seg–Sex 09h–18h",
  instagram_url: "https://instagram.com/touringcars",
  facebook_url: "https://facebook.com/touringcars",
  youtube_url: "https://youtube.com/@touringcars",
  brand_assets: {
    logo_url: "https://cdn.example.com/touring/logo.png",
    primary_color: "#0C0C0C",
    text_on_primary: "#FFFFFF",
    hero_image_url: "https://cdn.example.com/touring/hero.jpg",
    about_image_url: "https://cdn.example.com/touring/about.jpg",
    contact_image_url: "https://cdn.example.com/touring/contact.jpg",
    car_placeholders: [],
  },
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
    { car_name: "Honda Civic 2021", image_url: "https://cdn.example.com/sales/1.jpg" },
    { car_name: "VW T-Cross 2020", image_url: "https://cdn.example.com/sales/2.jpg" },
    { car_name: "Hyundai HB20 2019", image_url: "https://cdn.example.com/sales/3.jpg" },
  ],
  about_text:
    "A Touring Cars atua há mais de 10 anos no mercado de seminovos com foco em qualidade e transparência. Nossa equipe é dedicada a oferecer a melhor experiência de compra, com veículos revisados e financiamento facilitado para o cliente final.",
  mission: "Tornar a compra de carros seminovos confiável e simples.",
  vision: "Ser referência em transparência no mercado de seminovos no Nordeste.",
  values: ["Transparência", "Compromisso", "Qualidade", "Atendimento humano"],
  cars: [
    buildCar("toyota-corolla-2022", "Toyota", "Corolla", 2022, 35000, 119900,
      "Sedan top de linha em estado impecável. Multimídia com Apple CarPlay, bancos em couro e revisões em concessionária. Único dono, IPVA 2026 pago.",
      "https://cdn.example.com/cars/corolla-thumb.jpg",
      "https://cdn.example.com/cars/corolla",
      [["Motor", "2.0 16v"]], true, "CVT"),
    buildCar("honda-civic-2021", "Honda", "Civic", 2021, 42000, 109900,
      "Civic Touring com motor turbo, central multimídia e baixa quilometragem. Revisões em dia e laudo cautelar disponível.",
      "https://cdn.example.com/cars/civic-thumb.jpg",
      "https://cdn.example.com/cars/civic",
      [["Motor", "1.5 Turbo"]], false, "Automático", "Flex", "Branco"),
    buildCar("vw-tcross-2020", "Volkswagen", "T-Cross", 2020, 58000, 89900,
      "SUV compacto, economia de combustível, Apple CarPlay e baixa rodagem. Acompanha manuais e chave reserva.",
      "https://cdn.example.com/cars/tcross-thumb.jpg",
      "https://cdn.example.com/cars/tcross",
      [["Motor", "1.0 TSI"]], false, "Automático", "Flex", "Cinza"),
    buildCar("hyundai-hb20-2019", "Hyundai", "HB20", 2019, 71000, 59900,
      "Hatch econômico, ideal para uso urbano. Revisões em dia e bancos higienizados. Acompanha laudo cautelar.",
      "https://cdn.example.com/cars/hb20-thumb.jpg",
      "https://cdn.example.com/cars/hb20",
      [["Motor", "1.0 12v"]], false, "Manual", "Flex", "Vermelho"),
  ],
  schema_version: 2,
  generated_by: "claude-sonnet-4-6",
  generation_version: "v1.0.0",
};
