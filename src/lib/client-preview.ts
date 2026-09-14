export type ClientPreview = {
  id: string;
  name: string;
  company: string;
  package: string;
  permissions: Record<string, boolean>;
  snapshot: { values: Record<string, number>; capturedAt: string } | null;
  activity: { id: string; action: string; createdAt: string }[];
};
