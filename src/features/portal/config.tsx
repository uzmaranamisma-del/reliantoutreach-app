"use client";
import { Status } from "@/components/data";
import Link from "next/link";

export const columnsByKind: Record<string, any[]> = {
  campaigns: [
    {
      key: "name",
      label: "Campaign",
      render: (r: any) => (
        <Link className="strong-link" href={`/app/campaigns/${r.id}`}>
          {r.name}
        </Link>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (r: any) => <Status value={r.status} />,
    },
    { key: "sentCount", label: "Sent" },
    { key: "replyCount", label: "Replies" },
    {
      key: "replyRate",
      label: "Reply rate",
      render: (r: any) =>
        r.sentCount
          ? `${((r.replyCount / r.sentCount) * 100).toFixed(1)}%`
          : "—",
    },
    { key: "bounceCount", label: "Bounces" },
    { key: "prospectCount", label: "Prospects" },
  ],
  prospects: [
    { key: "email", label: "Email" },
    { key: "firstName", label: "First name" },
    { key: "lastName", label: "Last name" },
    { key: "company", label: "Company" },
    {
      key: "sendingStatus",
      label: "Status",
      render: (r: any) => <Status value={r.sendingStatus} />,
    },
  ],
  lists: [
    { key: "title", label: "List name" },
    {
      key: "createdAt",
      label: "Created",
      render: (r: any) => new Date(r.createdAt).toLocaleDateString(),
    },
  ],
  senders: [
    { key: "email", label: "Email account" },
    { key: "fromName", label: "Sender name" },
    { key: "dailyLimit", label: "Daily limit" },
    {
      key: "warmup",
      label: "Warmup",
      render: (r: any) => (r.warmup ? "Enabled" : "Disabled"),
    },
    {
      key: "disconnected",
      label: "Connection",
      render: (r: any) => (
        <Status value={r.disconnected ? "Error" : "Connected"} />
      ),
    },
  ],
};

export const resourceFields: Record<
  string,
  { key: string; label: string; type?: string; required?: boolean }[]
> = {
  campaigns: [
    { key: "name", label: "Campaign name", required: true },
    { key: "subject", label: "Subject" },
    { key: "body", label: "Email body (HTML)", type: "textarea" },
    { key: "dailyLimit", label: "Daily limit", type: "number" },
    { key: "fromEmails", label: "Sender emails (comma separated)" },
    { key: "scheduleTimeZone", label: "Sending timezone" },
    {
      key: "delayMinSeconds",
      label: "Minimum sending delay (seconds)",
      type: "number",
    },
  ],
  prospects: [
    { key: "email", label: "Email", type: "email", required: true },
    { key: "firstName", label: "First name" },
    { key: "lastName", label: "Last name" },
    { key: "company", label: "Company" },
  ],
  lists: [{ key: "title", label: "List name", required: true }],
  senders: [
    { key: "email", label: "Email", type: "email", required: true },
    { key: "fromName", label: "From name" },
    {
      key: "dailyLimit",
      label: "Daily sending limit",
      type: "number",
      required: true,
    },
    { key: "customSmtpServer", label: "SMTP hostname", required: true },
    {
      key: "customSmtpPort",
      label: "SMTP port",
      type: "number",
      required: true,
    },
    { key: "customSmtpUsername", label: "SMTP username" },
    {
      key: "customSmtpPass",
      label: "SMTP password",
      type: "password",
      required: true,
    },
    { key: "customImapServer", label: "IMAP hostname", required: true },
    {
      key: "customImapPort",
      label: "IMAP port",
      type: "number",
      required: true,
    },
    { key: "customImapUsername", label: "IMAP username" },
    {
      key: "customImapPass",
      label: "IMAP password",
      type: "password",
      required: true,
    },
  ],
};
