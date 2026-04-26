import bcrypt from "bcryptjs";
import fs from "fs/promises";
import path from "path";
import {
  DeliveryMessageSender,
  FragranceFamily,
  Gender,
  OrderStatus,
  Role,
} from "@prisma/client";
import { prisma } from "../model/prisma";

const uploadRoot = path.resolve(__dirname, "..", "uploads");
const seedImageCache = new Map<string, Promise<string>>();

function sanitizeFileName(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "image"
  );
}

function extensionFromContentType(contentType: string): string | null {
  switch (contentType.split(";")[0].trim().toLowerCase()) {
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "image/gif":
      return ".gif";
    case "image/avif":
      return ".avif";
    case "image/svg+xml":
      return ".svg";
    default:
      return null;
  }
}

async function materializeSeedImage(
  source: string,
  folder: string,
  fileBaseName: string,
): Promise<string> {
  if (source.startsWith("/uploads/")) {
    return source;
  }

  const cacheKey = `${folder}:${source}`;
  const cachedPath = seedImageCache.get(cacheKey);
  if (cachedPath) {
    return cachedPath;
  }

  const promise = (async () => {
    const destinationDirectory = path.join(uploadRoot, folder);
    await fs.mkdir(destinationDirectory, { recursive: true });

    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(
        `Failed to download seed image from ${source}: ${response.status} ${response.statusText}`,
      );
    }

    const sourceUrl = new URL(source);
    const extension =
      path.extname(sourceUrl.pathname) ||
      extensionFromContentType(response.headers.get("content-type") ?? "") ||
      ".jpg";

    const fileName = `${sanitizeFileName(fileBaseName)}${extension}`;
    const filePath = path.join(destinationDirectory, fileName);
    const imageBuffer = Buffer.from(await response.arrayBuffer());

    await fs.writeFile(filePath, imageBuffer);

    return `/uploads/${folder}/${fileName}`;
  })();

  seedImageCache.set(cacheKey, promise);
  return promise;
}

//run using npx prisma db seed
// admin@scentra.dev / Admin@12345
// sara@scentra.dev / Customer@12345
// omar@scentra.dev / Customer@12345
// delivery@scentra.dev / Delivery@12345

type ProductSeed = {
  key: string;
  brand_id: string;
  name: string;
  description: string;
  story: string;
  image_url: string;
  gender: Gender;
  fragrance_family: FragranceFamily;
  top_notes: string;
  middle_notes: string;
  base_notes: string;
  is_featured: boolean;
  is_new_arrival: boolean;
  sizes: Array<{ size: string; price: number; stock: number }>;
};

async function ensureDatabaseReachable(): Promise<void> {
  try {
    await prisma.$queryRaw`SELECT 1`;
  }
  catch (error: any) {
    if (error?.code === "ECONNREFUSED") {
      throw new Error(
        "Database is unreachable (ECONNREFUSED). Start PostgreSQL or update DATABASE_URL in scentra-backend/.env.",
      );
    }

    throw error;
  }
}

async function clearDatabase(): Promise<void> {
  await prisma.deliveryMessage.deleteMany();
  await prisma.review.deleteMany();
  await prisma.wishlistItem.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.paymentMethod.deleteMany();
  await prisma.address.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.wishlist.deleteMany();
  await prisma.productSize.deleteMany();
  await prisma.banner.deleteMany();
  await prisma.product.deleteMany();
  await prisma.brand.deleteMany();
  await prisma.user.deleteMany();
}

async function main(): Promise<void> {
  await ensureDatabaseReachable();
  await clearDatabase();

  const adminPassword = await bcrypt.hash("Admin@12345", 10);
  const customerPassword = await bcrypt.hash("Customer@12345", 10);
  const deliveryPassword = await bcrypt.hash("Delivery@12345", 10);

  const admin = await prisma.user.create({
    data: {
      full_name: "Admin One",
      email: "admin@scentra.dev",
      password_hash: adminPassword,
      role: Role.admin,
      is_email_verified: true,
      points: 500,
      phone: "+201000000001",
    },
  });

  const customer = await prisma.user.create({
    data: {
      full_name: "Sara Ahmed",
      email: "sara@scentra.dev",
      password_hash: customerPassword,
      role: Role.customer,
      is_email_verified: true,
      points: 120,
      phone: "+201000000002",
    },
  });

  const customerTwo = await prisma.user.create({
    data: {
      full_name: "Omar Hassan",
      email: "omar@scentra.dev",
      password_hash: customerPassword,
      role: Role.customer,
      is_email_verified: true,
      points: 40,
      phone: "+201000000003",
    },
  });

  const deliveryPerson = await prisma.user.create({
    data: {
      full_name: "Delivery Rider",
      email: "delivery@scentra.dev",
      password_hash: deliveryPassword,
      role: Role.delivery_person,
      is_email_verified: true,
      points: 0,
      phone: "+201000000004",
    },
  });

  await prisma.cart.createMany({
    data: [
      { user_id: admin.id },
      { user_id: customer.id },
      { user_id: customerTwo.id },
      { user_id: deliveryPerson.id },
    ],
  });

  await prisma.wishlist.createMany({
    data: [
      { user_id: admin.id },
      { user_id: customer.id },
      { user_id: customerTwo.id },
      { user_id: deliveryPerson.id },
    ],
  });

  const maison = await prisma.brand.create({
    data: {
      name: "Maison Lumiere",
      logo_url: await materializeSeedImage(
        "https://images.unsplash.com/photo-1612817288484-6f916006741a",
        "brands",
        "maison-lumiere",
      ),
    },
  });

  const noir = await prisma.brand.create({
    data: {
      name: "Noir Atelier",
      logo_url: await materializeSeedImage(
        "https://images.unsplash.com/photo-1523293182086-7651a899d37f",
        "brands",
        "noir-atelier",
      ),
    },
  });

  const aqua = await prisma.brand.create({
    data: {
      name: "Aqua Botanica",
      logo_url: await materializeSeedImage(
        "https://images.unsplash.com/photo-1541643600914-78b084683601",
        "brands",
        "aqua-botanica",
      ),
    },
  });

  const productSeeds: ProductSeed[] = [
    {
      key: "velvetRose",
      brand_id: maison.id,
      name: "Velvet Rose",
      description: "Soft rose and powdery musk with warm amber depth.",
      story: "A romantic evening scent with a modern floral trail.",
      image_url: "https://images.unsplash.com/photo-1592945403244-b3fbafd7f539",
      gender: Gender.female,
      fragrance_family: FragranceFamily.floral,
      top_notes: "Lychee, Pink Pepper",
      middle_notes: "Rose, Peony",
      base_notes: "Musk, Amber",
      is_featured: true,
      is_new_arrival: true,
      sizes: [
        { size: "50ml", price: 120, stock: 50 },
        { size: "100ml", price: 195, stock: 30 },
      ],
    },
    {
      key: "amberOud",
      brand_id: noir.id,
      name: "Amber Oud Reserve",
      description: "Dark oud wrapped in amber and saffron.",
      story: "Rich signature scent for evening wear.",
      image_url: "https://images.unsplash.com/photo-1588405748880-12d1d2a59f75",
      gender: Gender.unisex,
      fragrance_family: FragranceFamily.oriental,
      top_notes: "Saffron, Bergamot",
      middle_notes: "Oud, Rose",
      base_notes: "Amber, Vanilla",
      is_featured: true,
      is_new_arrival: false,
      sizes: [
        { size: "50ml", price: 210, stock: 25 },
        { size: "100ml", price: 320, stock: 15 },
      ],
    },
    {
      key: "citrusDrift",
      brand_id: aqua.id,
      name: "Citrus Drift",
      description: "Sparkling citrus over marine woods.",
      story: "A bright daytime scent with clean projection.",
      image_url: "https://images.unsplash.com/photo-1615634260167-c8cdede054de",
      gender: Gender.male,
      fragrance_family: FragranceFamily.citrus,
      top_notes: "Grapefruit, Lemon",
      middle_notes: "Neroli, Ginger",
      base_notes: "Cedar, White Musk",
      is_featured: false,
      is_new_arrival: true,
      sizes: [
        { size: "50ml", price: 95, stock: 60 },
        { size: "100ml", price: 150, stock: 40 },
      ],
    },
    {
      key: "oceanVetiver",
      brand_id: aqua.id,
      name: "Ocean Vetiver",
      description: "Salty sea breeze with green vetiver.",
      story: "Fresh and mineral for warm climates.",
      image_url: "https://images.unsplash.com/photo-1563170351-be82bc888aa4",
      gender: Gender.male,
      fragrance_family: FragranceFamily.aquatic,
      top_notes: "Sea Salt, Lime",
      middle_notes: "Lavender, Cypress",
      base_notes: "Vetiver, Moss",
      is_featured: false,
      is_new_arrival: false,
      sizes: [
        { size: "50ml", price: 110, stock: 45 },
        { size: "100ml", price: 175, stock: 20 },
      ],
    },
    {
      key: "cedarNoir",
      brand_id: noir.id,
      name: "Cedar Noir",
      description: "Smoky cedar and spices with leather facets.",
      story: "A confident woody profile for night events.",
      image_url: "https://images.unsplash.com/photo-1616394584738-fc6e612e71b9",
      gender: Gender.unisex,
      fragrance_family: FragranceFamily.woody,
      top_notes: "Cardamom, Black Pepper",
      middle_notes: "Cedarwood, Leather",
      base_notes: "Patchouli, Tonka",
      is_featured: true,
      is_new_arrival: false,
      sizes: [
        { size: "50ml", price: 145, stock: 35 },
        { size: "100ml", price: 230, stock: 18 },
      ],
    },
    {
      key: "whiteMuskLinen",
      brand_id: maison.id,
      name: "White Musk Linen",
      description: "Clean musk blended with airy florals.",
      story: "Soft everyday comfort scent.",
      image_url: "https://images.unsplash.com/photo-1541643600914-78b084683601",
      gender: Gender.unisex,
      fragrance_family: FragranceFamily.fresh,
      top_notes: "Aldehydes, Pear",
      middle_notes: "Iris, Lily",
      base_notes: "White Musk, Sandalwood",
      is_featured: false,
      is_new_arrival: true,
      sizes: [
        { size: "50ml", price: 90, stock: 70 },
        { size: "100ml", price: 145, stock: 42 },
      ],
    },
    {
      key: "solarBloom",
      brand_id: maison.id,
      name: "Solar Bloom",
      description: "Golden neroli and jasmine with creamy vanilla woods.",
      story: "A radiant scent inspired by Mediterranean sunsets.",
      image_url: "https://images.unsplash.com/photo-1523293182086-7651a899d37f",
      gender: Gender.female,
      fragrance_family: FragranceFamily.floral,
      top_notes: "Neroli, Mandarin",
      middle_notes: "Jasmine, Orange Blossom",
      base_notes: "Vanilla, Cedar",
      is_featured: true,
      is_new_arrival: true,
      sizes: [
        { size: "50ml", price: 135, stock: 35 },
        { size: "100ml", price: 210, stock: 22 },
      ],
    },
    {
      key: "obsidianCode",
      brand_id: noir.id,
      name: "Obsidian Code",
      description: "Smoked incense layered with black tea and amber.",
      story: "A mysterious urban composition built for evening energy.",
      image_url: "https://images.unsplash.com/photo-1519669011783-4eaa95fa1b7d",
      gender: Gender.unisex,
      fragrance_family: FragranceFamily.oriental,
      top_notes: "Black Tea, Pink Pepper",
      middle_notes: "Incense, Plum",
      base_notes: "Amber, Guaiac Wood",
      is_featured: false,
      is_new_arrival: false,
      sizes: [
        { size: "50ml", price: 170, stock: 28 },
        { size: "100ml", price: 260, stock: 16 },
      ],
    },
    {
      key: "pixelTide",
      brand_id: aqua.id,
      name: "Pixel Tide",
      description: "Marine breeze and mint over mineral driftwood.",
      story: "Fresh kinetic scent for daytime momentum.",
      image_url: "https://images.unsplash.com/photo-1600185365483-26d7a4cc7519",
      gender: Gender.male,
      fragrance_family: FragranceFamily.aquatic,
      top_notes: "Mint, Lemon Zest",
      middle_notes: "Sea Accord, Sage",
      base_notes: "Driftwood, Musk",
      is_featured: true,
      is_new_arrival: true,
      sizes: [
        { size: "50ml", price: 125, stock: 44 },
        { size: "100ml", price: 190, stock: 26 },
      ],
    },
    {
      key: "onyxSaffron",
      brand_id: noir.id,
      name: "Onyx Saffron",
      description: "Saffron and dark resin over amber.",
      story: "An intense oriental profile.",
      image_url: "https://images.unsplash.com/photo-1588405748880-12d1d2a59f75",
      gender: Gender.unisex,
      fragrance_family: FragranceFamily.oriental,
      top_notes: "Saffron, Clove",
      middle_notes: "Resin, Rose",
      base_notes: "Amber, Oud",
      is_featured: true,
      is_new_arrival: false,
      sizes: [
        { size: "50ml", price: 188, stock: 21 },
        { size: "100ml", price: 286, stock: 11 },
      ],
    },
    {
      key: "coldPaper",
      brand_id: noir.id,
      name: "Cold Paper",
      description: "Crisp fresh scent with mint and pear.",
      story: "Minimal and clean.",
      image_url: "https://images.unsplash.com/photo-1541643600914-78b084683601",
      gender: Gender.unisex,
      fragrance_family: FragranceFamily.fresh,
      top_notes: "Mint, Pear",
      middle_notes: "Iris, Tea",
      base_notes: "Musk, Cedar",
      is_featured: false,
      is_new_arrival: true,
      sizes: [
        { size: "50ml", price: 102, stock: 58 },
        { size: "100ml", price: 158, stock: 36 },
      ],
    },
    {
      key: "cinderGrove",
      brand_id: noir.id,
      name: "Cinder Grove",
      description: "Bitter citrus and smoked woods.",
      story: "A bright opening that dries dark.",
      image_url: "https://images.unsplash.com/photo-1615634260167-c8cdede054de",
      gender: Gender.male,
      fragrance_family: FragranceFamily.citrus,
      top_notes: "Grapefruit, Lemon",
      middle_notes: "Juniper, Spice",
      base_notes: "Cedar, Amber",
      is_featured: false,
      is_new_arrival: false,
      sizes: [
        { size: "50ml", price: 112, stock: 49 },
        { size: "100ml", price: 176, stock: 27 },
      ],
    },
    {
      key: "inkTide",
      brand_id: noir.id,
      name: "Ink Tide",
      description: "Marine salt, vetiver, and smoke.",
      story: "Aquatic freshness with a moody edge.",
      image_url: "https://images.unsplash.com/photo-1600185365483-26d7a4cc7519",
      gender: Gender.unisex,
      fragrance_family: FragranceFamily.aquatic,
      top_notes: "Sea Salt, Lime",
      middle_notes: "Lavender, Cypress",
      base_notes: "Vetiver, Moss",
      is_featured: true,
      is_new_arrival: true,
      sizes: [
        { size: "50ml", price: 128, stock: 40 },
        { size: "100ml", price: 196, stock: 24 },
      ],
    },
    {
      key: "mossCurrent",
      brand_id: aqua.id,
      name: "Moss Current",
      description: "Green moss and driftwood.",
      story: "A coastal wood scent.",
      image_url: "https://images.unsplash.com/photo-1616394584738-fc6e612e71b9",
      gender: Gender.unisex,
      fragrance_family: FragranceFamily.woody,
      top_notes: "Bergamot, Pine",
      middle_notes: "Moss, Cedar",
      base_notes: "Amber, Vetiver",
      is_featured: false,
      is_new_arrival: false,
      sizes: [
        { size: "50ml", price: 134, stock: 37 },
        { size: "100ml", price: 206, stock: 21 },
      ],
    },
    {
      key: "crimsonEclipse",
      brand_id: noir.id,
      name: "Crimson Eclipse",
      description: "A dark red scent of saffron, black rose, and smoked amber.",
      story: "Inspired by a red moon hanging over a quiet midnight skyline.",
      image_url: "/uploads/products/crimson-eclipse.png",
      gender: Gender.unisex,
      fragrance_family: FragranceFamily.oriental,
      top_notes: "Saffron, Pink Pepper",
      middle_notes: "Black Rose, Incense",
      base_notes: "Oud, Amber, Vanilla",
      is_featured: true,
      is_new_arrival: true,
      sizes: [
        { size: "50ml", price: 180, stock: 32 },
        { size: "100ml", price: 275, stock: 18 },
      ],
    },
    {
      key: "velvetBlossom",
      brand_id: maison.id,
      name: "Velvet Blossom",
      description: "Powdery rose with smooth musk.",
      story: "A polished floral for daily wear.",
      image_url: "https://images.unsplash.com/photo-1592945403244-b3fbafd7f539",
      gender: Gender.female,
      fragrance_family: FragranceFamily.floral,
      top_notes: "Peony, Raspberry",
      middle_notes: "Rose, Freesia",
      base_notes: "Musk, Benzoin",
      is_featured: true,
      is_new_arrival: true,
      sizes: [
        { size: "50ml", price: 138, stock: 38 },
        { size: "100ml", price: 215, stock: 24 },
      ],
    },
    {
      key: "roseAster",
      brand_id: maison.id,
      name: "Rose Aster",
      description: "Rose petals brightened with citrus.",
      story: "Modern floral elegance.",
      image_url: "https://images.unsplash.com/photo-1523293182086-7651a899d37f",
      gender: Gender.female,
      fragrance_family: FragranceFamily.floral,
      top_notes: "Bergamot, Pink Pepper",
      middle_notes: "Rose, Aster",
      base_notes: "Amber, White Musk",
      is_featured: false,
      is_new_arrival: true,
      sizes: [
        { size: "50ml", price: 132, stock: 34 },
        { size: "100ml", price: 208, stock: 20 },
      ],
    },
    {
      key: "cedarMoss",
      brand_id: maison.id,
      name: "Cedar Moss",
      description: "Soft cedarwood and green moss.",
      story: "A grounded woody scent.",
      image_url: "https://images.unsplash.com/photo-1616394584738-fc6e612e71b9",
      gender: Gender.unisex,
      fragrance_family: FragranceFamily.woody,
      top_notes: "Cardamom, Juniper",
      middle_notes: "Cedarwood, Moss",
      base_notes: "Amber, Vetiver",
      is_featured: false,
      is_new_arrival: false,
      sizes: [
        { size: "50ml", price: 148, stock: 29 },
        { size: "100ml", price: 228, stock: 18 },
      ],
    },
    {
      key: "seafoamCotton",
      brand_id: aqua.id,
      name: "Seafoam Cotton",
      description: "Soft cotton musk with marine air.",
      story: "Bright and airy for everyday wear.",
      image_url: "https://images.unsplash.com/photo-1541643600914-78b084683601",
      gender: Gender.female,
      fragrance_family: FragranceFamily.fresh,
      top_notes: "White Tea, Pear",
      middle_notes: "Cotton Flower, Lily",
      base_notes: "Musk, Cedar",
      is_featured: false,
      is_new_arrival: true,
      sizes: [
        { size: "50ml", price: 98, stock: 63 },
        { size: "100ml", price: 154, stock: 39 },
      ],
    },
    {
      key: "breezeQuartz",
      brand_id: aqua.id,
      name: "Breeze Quartz",
      description: "Clean mineral freshness with herbs.",
      story: "Cool and reflective.",
      image_url: "https://images.unsplash.com/photo-1563170351-be82bc888aa4",
      gender: Gender.unisex,
      fragrance_family: FragranceFamily.fresh,
      top_notes: "Mint, Lemon Zest",
      middle_notes: "Sage, Lavender",
      base_notes: "Musk, Driftwood",
      is_featured: false,
      is_new_arrival: false,
      sizes: [
        { size: "50ml", price: 106, stock: 57 },
        { size: "100ml", price: 162, stock: 33 },
      ],
    },
    {
      key: "lemonCurrent",
      brand_id: aqua.id,
      name: "Lemon Current",
      description: "Sparkling lemon and neroli.",
      story: "A lively citrus wave.",
      image_url: "https://images.unsplash.com/photo-1615634260167-c8cdede054de",
      gender: Gender.male,
      fragrance_family: FragranceFamily.citrus,
      top_notes: "Lemon, Grapefruit",
      middle_notes: "Neroli, Ginger",
      base_notes: "White Musk, Cedar",
      is_featured: true,
      is_new_arrival: true,
      sizes: [
        { size: "50ml", price: 114, stock: 46 },
        { size: "100ml", price: 178, stock: 28 },
      ],
    },
    {
      key: "mandarinReef",
      brand_id: aqua.id,
      name: "Mandarin Reef",
      description: "Mandarin zest with sea spray.",
      story: "Bright aquatic citrus.",
      image_url: "https://images.unsplash.com/photo-1600185365483-26d7a4cc7519",
      gender: Gender.unisex,
      fragrance_family: FragranceFamily.citrus,
      top_notes: "Mandarin, Lime",
      middle_notes: "Sea Accord, Neroli",
      base_notes: "Cedar, Musk",
      is_featured: false,
      is_new_arrival: false,
      sizes: [
        { size: "50ml", price: 116, stock: 44 },
        { size: "100ml", price: 180, stock: 26 },
      ],
    },
    {
      key: "saltPetal",
      brand_id: aqua.id,
      name: "Salt Petal",
      description: "Marine salt and pale petals.",
      story: "A breezy aquatic floral.",
      image_url: "https://images.unsplash.com/photo-1523293182086-7651a899d37f",
      gender: Gender.female,
      fragrance_family: FragranceFamily.aquatic,
      top_notes: "Sea Salt, Pink Pepper",
      middle_notes: "Peony, Jasmine",
      base_notes: "Musk, Driftwood",
      is_featured: false,
      is_new_arrival: true,
      sizes: [
        { size: "50ml", price: 124, stock: 41 },
        { size: "100ml", price: 192, stock: 23 },
      ],
    },
    {
      key: "desertMirage",
      brand_id: maison.id,
      name: "Desert Mirage",
      description: "Spiced resin over warm woods.",
      story: "An amber-rich sunset trail.",
      image_url: "https://images.unsplash.com/photo-1588405748880-12d1d2a59f75",
      gender: Gender.unisex,
      fragrance_family: FragranceFamily.oriental,
      top_notes: "Saffron, Cinnamon",
      middle_notes: "Incense, Labdanum",
      base_notes: "Amber, Vanilla",
      is_featured: false,
      is_new_arrival: true,
      sizes: [
        { size: "50ml", price: 172, stock: 26 },
        { size: "100ml", price: 268, stock: 14 },
      ],
    },
    {
      key: "linenBreeze",
      brand_id: maison.id,
      name: "Linen Breeze",
      description: "Clean linen with pear and airy florals.",
      story: "Light, fresh, and easy.",
      image_url: "https://images.unsplash.com/photo-1541643600914-78b084683601",
      gender: Gender.unisex,
      fragrance_family: FragranceFamily.fresh,
      top_notes: "Pear, Aldehydes",
      middle_notes: "Lily, Iris",
      base_notes: "White Musk, Sandalwood",
      is_featured: false,
      is_new_arrival: true,
      sizes: [
        { size: "50ml", price: 96, stock: 68 },
        { size: "100ml", price: 152, stock: 40 },
      ],
    },
    {
      key: "sunlitCitron",
      brand_id: maison.id,
      name: "Sunlit Citron",
      description: "Brisk citron and neroli over cedar.",
      story: "Bright, airy, and vivid.",
      image_url: "https://images.unsplash.com/photo-1615634260167-c8cdede054de",
      gender: Gender.female,
      fragrance_family: FragranceFamily.citrus,
      top_notes: "Citron, Mandarin",
      middle_notes: "Neroli, Ginger",
      base_notes: "Cedar, Musk",
      is_featured: true,
      is_new_arrival: true,
      sizes: [
        { size: "50ml", price: 118, stock: 52 },
        { size: "100ml", price: 182, stock: 31 },
      ],
    },
    {
      key: "coralMist",
      brand_id: maison.id,
      name: "Coral Mist",
      description: "Marine air with dewy florals and salt.",
      story: "A coastal scent with a floral edge.",
      image_url: "https://images.unsplash.com/photo-1563170351-be82bc888aa4",
      gender: Gender.unisex,
      fragrance_family: FragranceFamily.aquatic,
      top_notes: "Sea Salt, Lemon",
      middle_notes: "Jasmine, Water Lily",
      base_notes: "Driftwood, Musk",
      is_featured: false,
      is_new_arrival: false,
      sizes: [
        { size: "50ml", price: 122, stock: 43 },
        { size: "100ml", price: 188, stock: 22 },
      ],
    },
    {
      key: "midnightCedar",
      brand_id: noir.id,
      name: "Midnight Cedar",
      description: "Dark cedar with smoky resin.",
      story: "A dense woody scent with nightlife energy.",
      image_url: "https://images.unsplash.com/photo-1616394584738-fc6e612e71b9",
      gender: Gender.unisex,
      fragrance_family: FragranceFamily.woody,
      top_notes: "Black Pepper, Nutmeg",
      middle_notes: "Cedar, Smoke",
      base_notes: "Patchouli, Amber",
      is_featured: true,
      is_new_arrival: false,
      sizes: [
        { size: "50ml", price: 156, stock: 27 },
        { size: "100ml", price: 240, stock: 17 },
      ],
    },
    {
      key: "smokeAtlas",
      brand_id: noir.id,
      name: "Smoke Atlas",
      description: "Leather, smoke, and cedar.",
      story: "Built for evening wear.",
      image_url: "https://images.unsplash.com/photo-1519669011783-4eaa95fa1b7d",
      gender: Gender.male,
      fragrance_family: FragranceFamily.woody,
      top_notes: "Cardamom, Black Pepper",
      middle_notes: "Leather, Cedarwood",
      base_notes: "Vetiver, Tonka",
      is_featured: false,
      is_new_arrival: true,
      sizes: [
        { size: "50ml", price: 164, stock: 23 },
        { size: "100ml", price: 252, stock: 12 },
      ],
    },
    {
      key: "blackIris",
      brand_id: noir.id,
      name: "Black Iris",
      description: "Iris, rose, and incense.",
      story: "A noir floral after sunset.",
      image_url: "https://images.unsplash.com/photo-1592945403244-b3fbafd7f539",
      gender: Gender.female,
      fragrance_family: FragranceFamily.floral,
      top_notes: "Bergamot, Black Pepper",
      middle_notes: "Iris, Rose",
      base_notes: "Incense, Amber",
      is_featured: false,
      is_new_arrival: true,
      sizes: [
        { size: "50ml", price: 146, stock: 31 },
        { size: "100ml", price: 226, stock: 19 },
      ],
    },
  ];

  const productSeedData = await Promise.all(
    productSeeds.map(async (seed) => ({
      ...seed,
      image_url: await materializeSeedImage(seed.image_url, "products", seed.key),
    })),
  );

  const productIds: Record<string, string> = {};

  for (const seed of productSeedData) {
    const { key, sizes, ...productData } = seed;
    const product = await prisma.product.create({
      data: {
        ...productData,
        sizes: { create: sizes },
      },
    });
    productIds[key] = product.id;
  }

  const bannerSeeds = [
    {
      image_url: "https://images.unsplash.com/photo-1594035910387-fea47794261f",
      title: "Best Seller: Amber Oud Reserve",
      product_id: productIds.amberOud,
    },
    {
      image_url: "https://images.unsplash.com/photo-1592945403244-b3fbafd7f539",
      title: "New Arrival: Velvet Rose",
      product_id: productIds.velvetRose,
    },
    {
      image_url: "https://images.unsplash.com/photo-1615634260167-c8cdede054de",
      title: "Summer Picks",
      product_id: productIds.citrusDrift,
    },
    {
      image_url: "https://images.unsplash.com/photo-1523293182086-7651a899d37f",
      title: "Immersive Drop: Solar Bloom",
      product_id: productIds.solarBloom,
    },
    {
      image_url: "https://images.unsplash.com/photo-1600185365483-26d7a4cc7519",
      title: "Game Day Fresh: Pixel Tide",
      product_id: productIds.pixelTide,
    },
  ];

  await prisma.banner.createMany({
    data: await Promise.all(
      bannerSeeds.map(async (banner) => ({
        ...banner,
        image_url: await materializeSeedImage(banner.image_url, "banners", banner.title),
      })),
    ),
  });

  const customerMainAddress = await prisma.address.create({
    data: {
      user_id: customer.id,
      label: "Home",
      street: "12 Nile Street",
      city: "Cairo",
      state: "Cairo",
      zip_code: "11511",
      country: "Egypt",
      is_default: true,
      latitude: 30.0444,
      longitude: 31.2357,
    },
  });

  await prisma.address.create({
    data: {
      user_id: customer.id,
      label: "Office",
      street: "88 Business Park",
      city: "Cairo",
      state: "Cairo",
      zip_code: "11835",
      country: "Egypt",
      is_default: false,
      latitude: 30.0611,
      longitude: 31.2501,
    },
  });

  const customerTwoAddress = await prisma.address.create({
    data: {
      user_id: customerTwo.id,
      label: "Home",
      street: "5 Corniche Road",
      city: "Alexandria",
      state: "Alexandria",
      zip_code: "21519",
      country: "Egypt",
      is_default: true,
      latitude: 31.2001,
      longitude: 29.9187,
    },
  });

  await prisma.paymentMethod.createMany({
    data: [
      { user_id: customer.id, type: "card", provider: "visa", last4: "4242" },
      { user_id: customer.id, type: "card", provider: "mastercard", last4: "5454" },
      { user_id: customer.id, type: "digital_wallet", provider: "apple_pay", last4: null },
    ],
  });

  const customerCart = await prisma.cart.findUnique({ where: { user_id: customer.id } });
  const customerWishlist = await prisma.wishlist.findUnique({ where: { user_id: customer.id } });
  const customerTwoWishlist = await prisma.wishlist.findUnique({ where: { user_id: customerTwo.id } });

  if (!customerCart || !customerWishlist || !customerTwoWishlist) {
    throw new Error("Cart or wishlist creation failed during seed.");
  }

  await prisma.cartItem.createMany({
    data: [
      { cart_id: customerCart.id, product_id: productIds.cedarNoir, size: "50ml", quantity: 1 },
      { cart_id: customerCart.id, product_id: productIds.whiteMuskLinen, size: "100ml", quantity: 2 },
    ],
  });

  await prisma.wishlistItem.createMany({
    data: [
      { wishlist_id: customerWishlist.id, product_id: productIds.oceanVetiver },
      { wishlist_id: customerWishlist.id, product_id: productIds.citrusDrift },
      { wishlist_id: customerTwoWishlist.id, product_id: productIds.velvetRose },
    ],
  });

  const deliveredOrder = await prisma.order.create({
    data: {
      user_id: customer.id,
      address_id: customerMainAddress.id,
      status: OrderStatus.delivered,
      total_price: 653.2,
      payment_method: "visa",
      delivery_method: "express",
      order_items: {
        create: [
          { product_id: productIds.amberOud, quantity: 2, price: 210, size: "50ml" },
          { product_id: productIds.velvetRose, quantity: 1, price: 120, size: "50ml" },
        ],
      },
    },
  });

  const inProgressOrder = await prisma.order.create({
    data: {
      user_id: customerTwo.id,
      address_id: customerTwoAddress.id,
      status: OrderStatus.paid,
      total_price: 102.6,
      payment_method: "mastercard",
      delivery_method: "standard",
      delivery_person_id: deliveryPerson.id,
      assigned_at: new Date(),
      delivery_location_updated_at: new Date(),
      delivery_latitude: 31.2058,
      delivery_longitude: 29.9245,
      order_items: {
        create: [{ product_id: productIds.citrusDrift, quantity: 1, price: 95, size: "50ml" }],
      },
    },
  });

  await prisma.deliveryMessage.createMany({
    data: [
      {
        order_id: deliveredOrder.id,
        sender: DeliveryMessageSender.system,
        message: "Order placed successfully.",
      },
      {
        order_id: deliveredOrder.id,
        sender: DeliveryMessageSender.delivery,
        message: "Your rider picked up the package.",
      },
      {
        order_id: deliveredOrder.id,
        sender: DeliveryMessageSender.customer,
        message: "Thanks, I received it.",
      },
      {
        order_id: inProgressOrder.id,
        sender: DeliveryMessageSender.system,
        message: "Order placed successfully.",
      },
      {
        order_id: inProgressOrder.id,
        sender: DeliveryMessageSender.delivery,
        message: "I am on my way, ETA 20 minutes.",
      },
    ],
  });

  await prisma.review.createMany({
    data: [
      {
        user_id: customer.id,
        product_id: productIds.velvetRose,
        rating: 5,
        comment: "Beautiful floral scent with strong performance.",
      },
      {
        user_id: customer.id,
        product_id: productIds.amberOud,
        rating: 4,
        comment: "Very rich and long lasting.",
      },
    ],
  });

  console.log("Seed completed successfully.");
  console.log("Admin login: admin@scentra.dev / Admin@12345");
  console.log("Customer login: sara@scentra.dev / Customer@12345");
  console.log("Customer login: omar@scentra.dev / Customer@12345");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
