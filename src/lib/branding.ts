import { z } from "zod";
const optionalUrl = z.union([
  z.url().refine((v) => /^https:\/\//i.test(v), "Use an HTTPS URL."),
  z.literal(""),
]);
export const brandingInput = z.object({
  productName: z.string().trim().min(1).max(40),
  supportEmail: z.union([z.email(), z.literal("")]),
  websiteUrl: optionalUrl,
  privacyUrl: optionalUrl,
  termsUrl: optionalUrl,
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});
export const defaultBranding = {
  productName: "ReliantOutreach",
  supportEmail: "",
  websiteUrl: "https://reliantoutreach.com",
  privacyUrl: "",
  termsUrl: "",
  accentColor: "#1d4ed8",
};
export type Branding = z.infer<typeof brandingInput>;
