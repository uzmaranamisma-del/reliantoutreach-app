import { z } from "zod";

export const aiCategories = [
  {
    id: "interested",
    label: "Interested",
    description: "A prospect wants to learn more.",
  },
  {
    id: "pricing",
    label: "Pricing question",
    description: "Questions about cost or packages.",
  },
  {
    id: "meeting",
    label: "Meeting request",
    description: "Ready to arrange a conversation.",
  },
  {
    id: "objection",
    label: "Objection",
    description: "A concern that needs a thoughtful reply.",
  },
  {
    id: "later",
    label: "Maybe later",
    description: "A prospect asks to reconnect later.",
  },
  {
    id: "automatic",
    label: "Out of office",
    description: "Automatic replies and away messages.",
  },
  {
    id: "unsubscribe",
    label: "Unsubscribe",
    description: "Requests to stop receiving outreach.",
  },
] as const;
const category = z.enum([
  "interested",
  "pricing",
  "meeting",
  "objection",
  "later",
  "automatic",
  "unsubscribe",
]);
export const aiProfileInput = z
  .object({
    business: z.string().trim().max(4000).default(""),
    offer: z.string().trim().max(4000).default(""),
    audience: z.string().trim().max(3000).default(""),
    pricing: z.string().trim().max(3000).default(""),
    faq: z.string().trim().max(6000).default(""),
    rules: z.string().trim().max(3000).default(""),
    bookingUrl: z
      .string()
      .trim()
      .max(500)
      .refine((value) => {
        if (!value) return true;
        try {
          const u = new URL(value);
          return u.protocol === "https:" && !u.username && !u.password;
        } catch {
          return false;
        }
      }, "Use an HTTPS booking link.")
      .default(""),
    tone: z
      .enum(["professional", "friendly", "direct"])
      .default("professional"),
    length: z.enum(["short", "balanced", "detailed"]).default("short"),
    language: z
      .enum([
        "match",
        "english",
        "urdu",
        "spanish",
        "french",
        "german",
        "arabic",
      ])
      .default("match"),
    signature: z.string().trim().max(500).default(""),
    priorityCategories: z
      .array(category)
      .max(7)
      .transform((values) => [...new Set(values)])
      .default(["interested", "pricing", "meeting"]),
    alertPreference: z.enum(["all", "priority"]).default("all"),
  })
  .strict();
export type AiProfile = z.infer<typeof aiProfileInput>;
export const defaultAiProfile: AiProfile = aiProfileInput.parse({});
export type AiWorkspaceData = {
  profile: AiProfile;
  revision: number;
  updatedAt: string | null;
  canEdit: boolean;
  status: "not_connected";
};
export function knowledgeProgress(profile: AiProfile) {
  return [
    profile.business,
    profile.offer,
    profile.audience,
    profile.pricing,
    profile.faq,
  ].filter((value) => value.trim()).length;
}
