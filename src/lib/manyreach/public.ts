import sanitize from "sanitize-html";
import { encrypt, decrypt, hash } from "@/lib/crypto";
import { AppError } from "@/lib/errors";
import type { ProviderRecord } from "./client";
export const idFields: Record<string, string> = {
  campaigns: "campaignId",
  prospects: "prospectId",
  lists: "listId",
  senders: "senderId",
  sequences: "sequenceId",
  followups: "followupId",
  messages: "messageId",
};
export function opaque(
  clientId: string,
  kind: string,
  id: unknown,
  parent?: string,
) {
  return encrypt(
    JSON.stringify({ c: clientId, k: kind, i: String(id), p: parent }),
  );
}
export function resolve(clientId: string, kind: string, value: string) {
  try {
    const data = JSON.parse(decrypt(value));
    if (
      data.c !== clientId ||
      data.k !== kind ||
      !data.i ||
      data.i === "undefined"
    )
      throw new Error();
    return data as { c: string; k: string; i: string; p?: string };
  } catch {
    throw new AppError(404, "Resource not found.");
  }
}
export function version(record: ProviderRecord) {
  return hash(JSON.stringify(record));
}
export const safeHtml = (value: string) =>
  sanitize(value, {
    allowedTags: [
      "p",
      "br",
      "strong",
      "em",
      "b",
      "i",
      "u",
      "ul",
      "ol",
      "li",
      "blockquote",
      "a",
    ],
    allowedAttributes: { a: ["href", "title"] },
    allowedSchemes: ["https", "http", "mailto"],
    allowProtocolRelative: false,
  });
const fields: Record<string, string[]> = {
  campaigns: [
    "name",
    "description",
    "status",
    "createdAt",
    "fromEmails",
    "fromName",
    "subject",
    "body",
    "dailyLimit",
    "dailyLimitPer",
    "scheduleSending",
    "scheduleTimeZone",
    "trackOpens",
    "trackClicks",
    "delayMinSeconds",
    "sendUnsubscribeListHeader",
    "stopCoworkersOnReply",
    "prospectCount",
    "activeProspectCount",
    "sentCount",
    "replyCount",
    "bounceCount",
    "openCount",
    "clickCount",
    "interestedCount",
    "sendMon",
    "sendTue",
    "sendWed",
    "sendThu",
    "sendFri",
    "sendSat",
    "sendSun",
    "sendMonAfter",
    "sendMonBefore",
    "sendTueAfter",
    "sendTueBefore",
    "sendWedAfter",
    "sendWedBefore",
    "sendThuAfter",
    "sendThuBefore",
    "sendFriAfter",
    "sendFriBefore",
    "sendSatAfter",
    "sendSatBefore",
    "sendSunAfter",
    "sendSunBefore",
  ],
  prospects: [
    "email",
    "firstName",
    "lastName",
    "company",
    "jobPosition",
    "country",
    "industry",
    "sendingStatus",
    "sendingActive",
    "createdAt",
    "city",
    "state",
    "website",
    "phone",
    "domain",
    "companySocial",
    "companySize",
    "location",
    "personalSocial",
    "icebreaker",
    "notes",
    "validatedAt",
    "validationStatus",
    ...Array.from({ length: 20 }, (_, i) => `custom${i + 1}`),
  ],
  lists: ["title", "createdAt"],
  senders: [
    "email",
    "fromName",
    "dailyLimit",
    "warmup",
    "disconnected",
    "createdAt",
    "delayMinMinutes",
    "accountType",
    "replyTo",
    "firstName",
    "lastName",
    "signature",
    "trackingDomain",
    "dailyLimitIncrease",
    "dailyLimitIncreaseToMax",
    "dailyLimitIncreasePercent",
    "warmupDailyLimit",
    "warmupReplyPercent",
    "warmupSkipWeekends",
    "customWarmupTag",
    "warmupDailyLimitIncrease",
    "warmupDailyLimitIncreaseToMax",
    "warmupDailyLimitIncreasePercent",
    "dateDisconnected",
    "dateWarmupDisconnected",
    ...Array.from({ length: 10 }, (_, i) => `senderCustom${i + 1}`),
  ],
  sequences: [
    "name",
    "shortName",
    "conditionReply",
    "conditionExtra",
    "conditionNegate",
    "conditionTimes",
    "conditionAction",
    "conditionOperator",
  ],
  followups: [
    "subject",
    "body",
    "waitMin",
    "waitUnits",
    "useOriginalSubject",
    "sendInSameThread",
    "sentCount",
    "replyCount",
  ],
  messages: ["type", "createdAt", "fromEmail", "toEmail", "subject", "body"],
};
export function publicRecord(
  clientId: string,
  kind: string,
  record: ProviderRecord,
  parent?: string,
) {
  const result: ProviderRecord = {
    id: opaque(clientId, kind, record[idFields[kind]], parent),
    version: version(record),
  };
  for (const key of fields[kind] || []) {
    if (record[key] !== undefined)
      result[key] = ["body", "signature"].includes(key)
        ? safeHtml(String(record[key] || ""))
        : record[key];
  }
  if (
    ["campaigns", "prospects", "senders"].includes(kind) &&
    Array.isArray(record.tags)
  )
    result.tags = record.tags
      .filter((tag: any) => typeof tag?.name === "string")
      .map((tag: any) => tag.name);
  if (kind === "messages")
    result.preview = sanitize(String(record.body || ""), {
      allowedTags: [],
      allowedAttributes: {},
    }).slice(0, 180);
  return result;
}
