import { z } from "zod";

const game = z.enum(["PUBG_MOBILE", "BGMI", "BOTH"]);
const rarity = z.enum(["COMMON", "RARE", "EPIC", "LEGENDARY", "MYTHIC"]);
const delivery = z.enum(["IN_GAME_GIFT", "REDEEM_CODE", "UC_TOPUP"]);

const trimmed = (min: number, max: number, label: string) =>
  z.string().trim().min(min, `${label} must be at least ${min} characters`).max(max, `${label} must be at most ${max} characters`);

export const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password is too long")
  .regex(/[A-Za-z]/, "Password needs a letter")
  .regex(/[0-9]/, "Password needs a number");

export const playerId = z
  .string()
  .trim()
  .regex(/^[0-9]{5,15}$/, "Player ID must be 5–15 digits (shown on your in-game profile)");

export const registerSchema = z.object({
  name: trimmed(2, 60, "Name"),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password,
  acceptTerms: z.literal(true, { message: "You must accept the terms" }),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

/** Rupees in the form; converted to paise on the server. */
const rupees = (label: string, min = 1, max = 500_000) =>
  z.coerce.number({ message: `${label} must be a number` }).min(min, `${label} must be at least ₹${min}`).max(max, `${label} must be at most ₹${max.toLocaleString("en-IN")}`);

export const mediaInput = z.object({
  url: z.string().trim().max(500).refine((u) => u.startsWith("/") || u.startsWith("https://"), "Invalid media URL"),
  type: z.enum(["IMAGE", "VIDEO", "SPIN"]),
});

export const productSchema = z
  .object({
    title: trimmed(3, 80, "Item name"),
    description: trimmed(20, 2000, "Description"),
    categoryId: z.string().min(1, "Choose a category"),
    game,
    rarity,
    level: z.coerce.number().int().min(1).max(10).optional().nullable(),
    maxLevel: z.coerce.number().int().min(1).max(10).optional().nullable(),
    features: z.array(trimmed(2, 40, "Feature")).max(8, "At most 8 features").default([]),
    deliveryMethod: delivery,
    price: rupees("Price", 10),
    compareAtPrice: rupees("Original price", 10).optional().nullable(),
    stock: z.coerce.number().int().min(1, "Stock must be at least 1").max(999),
    media: z.array(mediaInput).min(1, "Add at least one image").max(26),
    submit: z.boolean().default(true),
    // Sellers must confirm the transfer method is permitted by the game's terms.
    complianceAck: z.literal(true, { message: "Please confirm the delivery method complies with the game's terms" }),
  })
  .refine((d) => !d.compareAtPrice || d.compareAtPrice > d.price, {
    message: "Original price must be higher than the selling price",
    path: ["compareAtPrice"],
  })
  .refine((d) => !d.level || !d.maxLevel || d.level <= d.maxLevel, { message: "Level can't exceed max level", path: ["level"] })
  .refine((d) => d.media.filter((m) => m.type === "IMAGE").length >= 1, { message: "Add at least one image", path: ["media"] })
  .refine((d) => d.media.filter((m) => m.type === "IMAGE").length <= 5, { message: "At most 5 images", path: ["media"] })
  .refine((d) => d.media.filter((m) => m.type === "VIDEO").length <= 1, { message: "At most 1 video", path: ["media"] });

export const sellerOnboardSchema = z.object({
  storeName: trimmed(3, 32, "Store name").regex(/^[A-Za-z0-9 _.-]+$/, "Letters, numbers, spaces, _ . - only"),
  legalName: trimmed(3, 80, "Legal name"),
  panLast4: z.string().trim().regex(/^[A-Z0-9]{4}$/i, "Enter the last 4 characters of your PAN"),
  payoutUpi: z.string().trim().regex(/^[\w.-]{2,64}@[A-Za-z]{2,32}$/, "Enter a valid UPI ID, e.g. name@okbank"),
  bio: z.string().trim().max(300).optional().default(""),
  agree: z.literal(true, { message: "You must accept the seller policy" }),
});

export const checkoutSchema = z.object({
  provider: z.enum(["RAZORPAY", "WALLET"]),
  gamePlayerId: playerId,
  game: z.enum(["PUBG_MOBILE", "BGMI"]),
  productId: z.string().optional(), // "Buy now" a single product, else whole cart
  quantity: z.coerce.number().int().min(1).max(10).optional(),
  couponCode: z.string().trim().max(32).optional().transform((v) => v || undefined),
  gameNickname: z.string().trim().max(32).optional().transform((v) => v || undefined).refine((v) => !v || v.length >= 2, "Nickname must be at least 2 characters"),
});

export const couponPreviewSchema = z.object({
  code: z.string().trim().min(1, "Enter a coupon code").max(32),
  productId: z.string().optional(),
  quantity: z.coerce.number().int().min(1).max(10).optional(),
});

const dateTime = z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date");

export const couponSchema = z
  .object({
    code: z.string().trim().min(3, "At least 3 characters").max(32).regex(/^[A-Za-z0-9_-]+$/, "Letters, numbers, - and _ only"),
    description: z.string().trim().max(120).optional(),
    type: z.enum(["PERCENT", "FLAT"]),
    value: z.coerce.number().positive("Must be positive"), // percent or rupees
    minOrder: z.coerce.number().min(0).default(0), // rupees
    maxDiscount: z.coerce.number().positive().optional().nullable(), // rupees
    usageLimit: z.coerce.number().int().positive().optional().nullable(),
    perUserLimit: z.coerce.number().int().min(1).max(100).default(1),
    endsAt: dateTime.optional().nullable(),
    isActive: z.boolean().default(true),
  })
  .refine((c) => c.type !== "PERCENT" || c.value <= 90, { message: "Max 90%", path: ["value"] });

export const categorySchema = z.object({
  name: z.string().trim().min(2).max(40),
  slug: z.string().trim().min(2).max(40).regex(/^[a-z0-9-]+$/, "lowercase letters, numbers and - only"),
  description: z.string().trim().max(200).optional(),
  isSkin: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(100).default(0),
});

export const campaignSchema = z.object({
  name: z.string().trim().min(2).max(60),
  kicker: z.string().trim().max(40).optional(),
  title: z.string().trim().min(2).max(60),
  nativeTitle: z.string().trim().max(20).optional(),
  subtitle: z.string().trim().max(140).optional(),
  ctaLabel: z.string().trim().min(2).max(24).default("Shop Now"),
  ctaHref: z.string().trim().startsWith("/", "Use an internal path like /bundles").default("/marketplace"),
  heroLeft: z.string().trim().max(300).optional(),
  heroRight: z.string().trim().max(300).optional(),
  endsAt: dateTime.optional().nullable(),
  isActive: z.boolean().default(true),
});

export const razorpayVerifySchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

export const topupSchema = z.object({ amount: rupees("Amount", 100, 50_000) });
export const withdrawalSchema = z.object({
  amount: rupees("Amount", 100, 200_000),
  upiId: z.string().trim().regex(/^[\w.-]{2,64}@[A-Za-z]{2,32}$/, "Enter a valid UPI ID"),
});

export const refundRequestSchema = z.object({
  orderItemId: z.string().min(1),
  reason: trimmed(10, 500, "Reason"),
});

export const reviewSchema = z.object({
  orderItemId: z.string().min(1),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(500).optional(),
});

export const reportSchema = z.object({
  productId: z.string().min(1),
  reason: z.enum(["Scam or fraud", "Account selling", "Asks for password/OTP", "Wrong category", "Offensive content", "Other"]),
  details: z.string().trim().max(500).optional(),
});

export const ticketSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  subject: trimmed(5, 120, "Subject"),
  message: trimmed(20, 3000, "Message"),
  orderRef: z.string().trim().max(40).optional(),
});

export const profileSchema = z.object({
  name: trimmed(2, 60, "Name"),
  phone: z.string().trim().regex(/^(\+91)?[6-9][0-9]{9}$/, "Enter a valid Indian mobile number").or(z.literal("")).optional(),
  gamePlayerId: playerId.or(z.literal("")).optional(),
  preferredGame: game,
});

export const changePasswordSchema = z.object({ currentPassword: z.string().min(1, "Enter your current password"), newPassword: password });

export const bannerSchema = z.object({
  title: trimmed(3, 60, "Title"),
  subtitle: z.string().trim().max(120).optional(),
  badge: z.string().trim().max(20).optional(),
  ctaLabel: trimmed(2, 24, "Button label"),
  ctaHref: z.string().trim().startsWith("/", "Use an internal path like /marketplace"),
  imageUrl: z.string().trim().min(1, "Image is required"),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(100).default(0),
});

export const commissionSchema = z.object({
  commissionPercent: z.coerce.number().min(0, "Min 0%").max(50, "Max 50%"),
  autoCompleteDays: z.coerce.number().int().min(1).max(30),
});

export type ProductInput = z.infer<typeof productSchema>;
