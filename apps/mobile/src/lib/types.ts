export type Context = {
  user: { id: string; name: string; email: string };
  client: { id: string; company: string };
  role: string;
  permissions: Record<string, boolean>;
  activePackageId: string;
};
export type Workspaces = {
  user: Context["user"];
  activeClientId: string | null;
  items: { client: Context["client"] }[];
};
export type Message = {
  id: string;
  key?: string;
  type?: string;
  createdAt: string;
  fromEmail: string;
  toEmail?: string;
  subject?: string;
  body?: string;
  preview?: string;
};
export type MessagePage = {
  items: Message[];
  pagination?: { nextCursor?: string | null };
  updatedAt?: string;
};
export type ConversationState = {
  email: string;
  readAt: string | null;
  starred: boolean;
};
export type Plan = {
  id: string;
  name: string;
  price: string;
  setupPrice: string;
  currency: string;
  serviceType: string;
  billingLabel: string;
  active: boolean;
  requiresLimitReview: boolean;
  monthlyMessages?: number;
  minimumMonths: number;
  commercialTerms?: string;
  limits: { key: string; value: number }[];
};
export type Order = {
  id: string;
  packageName: string;
  currency: string;
  price: string;
  status: string;
  createdAt: string;
  history: { status: string; at: string; note?: string }[];
};
export type PushStatus = {
  configured: boolean;
  device: { replies: boolean; orders: boolean } | null;
  lastScanAt?: string;
  scanError?: string;
  worker?: { at?: string };
};
