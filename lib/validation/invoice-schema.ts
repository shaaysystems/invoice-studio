import { z } from "zod";
import { validateGSTIN, validateIFSC, validatePAN, validatePhone, validatePincode, validateUPI } from "./gstin";
import { validateHexColor } from "./color";

/** Optional string that is either empty or passes a predicate. */
const optionalWith = (predicate: (v: string) => boolean, message: string) =>
  z.string().trim().refine((v) => v === "" || predicate(v), { message });

const hexColor = z
  .string()
  .trim()
  .refine(validateHexColor, { message: "Enter a valid HEX colour, for example #0F766E." });

/** Data URLs (guest mode) or a storage URL. Empty means "no image". */
const imageUrl = z
  .string()
  .trim()
  .max(2_000_000, "That image is too large. Use a smaller file.")
  .refine((v) => v === "" || v.startsWith("data:image/") || /^https?:\/\//i.test(v), {
    message: "Upload an image, or leave the field empty.",
  });

const addressSchema = z.object({
  line1: z.string().trim().max(120, "Keep address line 1 under 120 characters."),
  line2: z.string().trim().max(120, "Keep address line 2 under 120 characters."),
  city: z.string().trim().max(60),
  state: z.string().trim().max(60),
  stateCode: z.string().trim().max(4, "State codes are 1-2 digits, for example 29."),
  pincode: optionalWith(validatePincode, "Enter a valid 6-digit PIN code or leave it empty."),
  country: z.string().trim().max(60),
});

const socialSchema = z.object({
  website: z.string().trim().max(200),
  instagram: z.string().trim().max(200),
  linkedin: z.string().trim().max(200),
  twitter: z.string().trim().max(200),
});

export const businessPartySchema = z.object({
  name: z.string().trim().min(1, "Business name is required.").max(120),
  legalName: z.string().trim().max(160),
  gstin: optionalWith(validateGSTIN, "Enter a valid 15-character GSTIN or leave the field empty."),
  pan: optionalWith(validatePAN, "Enter a valid PAN such as ABCDE1234F, or leave it empty."),
  email: optionalWith((v) => z.string().email().safeParse(v).success, "Enter a valid email address or leave it empty."),
  phone: optionalWith(validatePhone, "Enter a valid phone number or leave it empty."),
  address: addressSchema,
  logoUrl: imageUrl,
  socials: socialSchema,
});

export const clientPartySchema = z.object({
  name: z.string().trim().min(1, "Client name is required.").max(160),
  gstin: optionalWith(validateGSTIN, "Enter a valid 15-character GSTIN or leave the field empty."),
  pan: optionalWith(validatePAN, "Enter a valid PAN such as ABCDE1234F, or leave it empty."),
  email: optionalWith((v) => z.string().email().safeParse(v).success, "Enter a valid email address or leave it empty."),
  phone: optionalWith(validatePhone, "Enter a valid phone number or leave it empty."),
  billingAddress: addressSchema,
  shippingAddress: addressSchema,
  shipToSameAsBillTo: z.boolean(),
  logoUrl: imageUrl,
});

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date.")
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), { message: "Enter a valid date." });

const discountTypeSchema = z.enum(["none", "percent", "amount"]);

export const invoiceItemSchema = z.object({
  id: z.string().min(1),
  description: z.string().trim().min(1, "Every item needs a description.").max(1600, "Keep item descriptions under 1600 characters."),
  hsn: z.string().trim().max(12),
  unit: z.string().trim().max(24),
  // Stored scaled by QTY_SCALE, so 1,000 means one unit.
  quantity: z
    .number({ invalid_type_error: "Quantity must be a number greater than 0." })
    .int("Quantity must be a whole number of thousandths.")
    .positive("Quantity must be a number greater than 0.")
    .max(1_000_000_000, "That quantity looks too large."),
  rateMinor: z
    .number({ invalid_type_error: "Rate must be a number." })
    .int()
    .min(0, "Rate cannot be negative.")
    .max(100_000_000_000, "That rate looks too large."),
  taxRate: z.number().min(0, "GST rate cannot be negative.").max(100, "GST rate cannot exceed 100%."),
  discountType: discountTypeSchema,
  // Percent when discountType is "percent", paise when it is "amount".
  discountValue: z.number().min(0, "A discount cannot be negative.").max(100_000_000_000),
});

export const paymentQrSchema = z.object({
  mode: z.enum(["none", "upload", "upi"]),
  imageUrl,
  label: z.string().trim().max(60),
  includeAmount: z.boolean(),
});

export const paymentSchema = z.object({
  bank: z.object({
    accountName: z.string().trim().max(120),
    bankName: z.string().trim().max(120),
    accountNumber: z.string().trim().max(34),
    ifsc: optionalWith(validateIFSC, "Enter a valid IFSC such as HDFC0001234, or leave it empty."),
    branch: z.string().trim().max(120),
  }),
  upiId: optionalWith(validateUPI, "Enter a valid UPI ID such as name@bank, or leave it empty."),
  paymentLink: optionalWith(
    (v) => v === "" || /^https?:\/\//i.test(v),
    "Payment links must start with https://, or leave it empty.",
  ),
  paymentNote: z.string().trim().max(240),
  qr: paymentQrSchema,
});

export const brandSchema = z.object({
  primary: hexColor,
  accent: hexColor,
  surface: hexColor,
  text: hexColor,
  paletteId: z.string().trim().max(40),
  accentBarEnabled: z.boolean(),
  showLogo: z.boolean(),
});

export const invoiceSchema = z
  .object({
    id: z.string().min(1),
    number: z.string().trim().min(1, "Invoice number is required.").max(40),
    issueDate: isoDate,
    dueDate: z.union([isoDate, z.literal("")]),
    poNumber: z.string().trim().max(60),
    placeOfSupply: z.string().trim().max(60),
    currency: z.literal("INR"),
    taxMode: z.enum(["none", "gst"]),
    gstScope: z.enum(["intra", "inter"]),
    pricesIncludeTax: z.boolean(),
    business: businessPartySchema,
    client: clientPartySchema,
    items: z.array(invoiceItemSchema).min(1, "Add at least one invoice item."),
    globalDiscountType: discountTypeSchema,
    globalDiscountValue: z.number().min(0, "A discount cannot be negative.").max(100_000_000_000),
    shippingMinor: z.number().int().min(0, "Shipping cannot be negative.").max(100_000_000_000),
    advanceMinor: z.number().int().min(0, "An advance cannot be negative.").max(100_000_000_000),
    roundOffEnabled: z.boolean(),
    amountInWordsEnabled: z.boolean(),
    notes: z.string().trim().max(600),
    terms: z.string().trim().max(4000),
    payment: paymentSchema,
    signature: z.object({
      imageUrl,
      name: z.string().trim().max(120),
      designation: z.string().trim().max(120),
    }),
    brand: brandSchema,
    logoOverrideUrl: imageUrl,
    businessProfileId: z.string().trim().max(64),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .superRefine((invoice, ctx) => {
    const { issueDate, dueDate } = invoice;
    if (dueDate && issueDate && dueDate < issueDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dueDate"],
        message: "The due date is before the invoice date. Check the dates before sending.",
      });
    }

    if (invoice.taxMode === "gst" && !invoice.placeOfSupply.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["placeOfSupply"],
        message: "Place of supply is required when GST is enabled.",
      });
    }

    if (invoice.globalDiscountType === "percent" && invoice.globalDiscountValue > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["globalDiscountValue"],
        message: "A percentage discount cannot exceed 100%.",
      });
    }

    invoice.items.forEach((item, index) => {
      if (item.discountType === "percent" && item.discountValue > 100) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["items", index, "discountValue"],
          message: "A percentage discount cannot exceed 100%.",
        });
      }
    });

    // A QR block that cannot produce an image is a silent no-op, so it is
    // reported here rather than quietly disappearing from the invoice.
    const qr = invoice.payment.qr;
    if (qr.mode === "upload" && !qr.imageUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["payment", "qr", "imageUrl"],
        message: "Upload a payment QR image, or switch the QR code off.",
      });
    }
    if (qr.mode === "upi" && !invoice.payment.upiId.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["payment", "upiId"],
        message: "A UPI ID is required to generate a payment QR code.",
      });
    }
  });

export type InvoiceInput = z.infer<typeof invoiceSchema>;

/**
 * The saved business profile reuses the exact party/payment/brand shapes an
 * invoice carries, so a profile can never hold a document the invoice schema
 * would reject.
 */
export const businessProfileSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  party: businessPartySchema,
  payment: paymentSchema,
  signature: z.object({
    imageUrl,
    name: z.string().trim().max(120),
    designation: z.string().trim().max(120),
  }),
  defaultTerms: z.string().trim().max(4000),
  defaultNotes: z.string().trim().max(600),
  defaultTaxRate: z.number().min(0, "Tax rate cannot be negative.").max(100, "Tax rate cannot exceed 100%."),
  numbering: z.object({
    prefix: z
      .string()
      .trim()
      .min(1, "A numbering prefix is required.")
      .max(24, "Keep the prefix under 24 characters.")
      .regex(/^[\w\-/]+$/, "Use letters, numbers, dashes, slashes or underscores only."),
    nextSequence: z
      .number({ invalid_type_error: "The next sequence must be a number." })
      .int("The next sequence must be a whole number.")
      .min(1, "The next sequence starts at 1.")
      .max(9_999_999, "That sequence looks too large."),
    padding: z
      .number({ invalid_type_error: "Padding must be a number." })
      .int("Padding must be a whole number.")
      .min(1, "Use at least one digit.")
      .max(8, "Eight digits is the maximum."),
    resetYearly: z.boolean(),
    financialYear: z.string().trim().max(10),
  }),
  updatedAt: z.string(),
});

export interface FieldIssue {
  path: string;
  label: string;
  message: string;
}

const FIELD_LABELS: Record<string, string> = {
  number: "Invoice number",
  issueDate: "Invoice date",
  dueDate: "Due date",
  placeOfSupply: "Place of supply",
  "business.name": "Business name",
  "business.gstin": "Business GSTIN",
  "business.email": "Business email",
  "business.phone": "Business phone",
  "client.name": "Client name",
  "client.gstin": "Client GSTIN",
  "client.email": "Client email",
  items: "Invoice items",
  "payment.bank.ifsc": "IFSC code",
  "payment.upiId": "UPI ID",
  "payment.qr": "Payment QR code",
  "brand.primary": "Primary colour",
  "brand.accent": "Accent colour",
  "brand.surface": "Surface colour",
  "brand.text": "Text colour",
};

/** Flattens Zod issues into human-readable, field-addressable problems. */
export function collectInvoiceIssues(value: unknown): FieldIssue[] {
  const result = invoiceSchema.safeParse(value);
  if (result.success) return [];
  return result.error.issues
    .filter((issue) => issue.message !== "")
    .map((issue) => {
      const path = issue.path.join(".");
      const labelKey = Object.keys(FIELD_LABELS).find(
        (k) => path === k || path.startsWith(`${k}.`) || path.startsWith(`${k}[`),
      );
      return {
        path,
        label: labelKey ? (FIELD_LABELS[labelKey] as string) : path || "Invoice",
        message: issue.message,
      };
    });
}
