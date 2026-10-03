"use client";
import { useState } from "react";
import Link from "next/link";
import { BookOpen, Sparkles, ShieldCheck } from "lucide-react";
import { Modal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AiConnectionNotice } from "./ai-workspace";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/browser-api";
import type { AiWorkspaceData } from "@/lib/ai-workspace";
import { ErrorBox } from "@/components/data";

export function AiReplyAssistant({ draft }: { draft: string }) {
  const [open, setOpen] = useState(false),
    [action, setAction] = useState("Draft reply"),
    [tone, setTone] = useState<string | null>(null),
    [language, setLanguage] = useState<string | null>(null),
    [instructions, setInstructions] = useState("");
  const setup = useQuery<AiWorkspaceData>({
    queryKey: ["ai-workspace", "/api/portal/ai-workspace"],
    queryFn: () => api("/api/portal/ai-workspace"),
    enabled: open,
  });
  const preferredTone = {
    professional: "Professional",
    friendly: "Friendly",
    direct: "Direct",
  }[setup.data?.profile.tone || "professional"];
  const preferredLanguage = {
    match: "Match prospect",
    english: "English",
    urdu: "Urdu",
    spanish: "Spanish",
    french: "French",
    german: "German",
    arabic: "Arabic",
  }[setup.data?.profile.language || "match"];
  return (
    <>
      <button
        type="button"
        className="ai-composer-trigger"
        onClick={() => setOpen(true)}
      >
        <Sparkles size={16} />
        <span>AI reply assistant</span>
        <small>Setup</small>
      </button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="AI reply assistant"
        description="Prepare a helpful response, in your voice. AI generation is not connected yet."
        wide
      >
        <div className="ai-assistant-body">
          <AiConnectionNotice compact />
          {setup.error && <ErrorBox error={setup.error} />}
          <div className="ai-action-tabs" aria-label="Reply tools">
            {["Draft reply", "Shorten", "Improve tone", "Translate"].map(
              (item) => (
                <button
                  type="button"
                  key={item}
                  aria-pressed={action === item}
                  onClick={() => setAction(item)}
                >
                  {item}
                </button>
              ),
            )}
          </div>
          <div className="ai-assistant-options">
            <label>
              Tone
              <select
                value={tone ?? preferredTone}
                onChange={(e) => setTone(e.target.value)}
              >
                {["Professional", "Friendly", "Direct"].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label>
              Language
              <select
                value={language ?? preferredLanguage}
                onChange={(e) => setLanguage(e.target.value)}
              >
                {[
                  "Match prospect",
                  "English",
                  "Urdu",
                  "Spanish",
                  "French",
                  "German",
                  "Arabic",
                ].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Instructions <small>Optional · for this draft</small>
            <textarea
              rows={2}
              maxLength={1000}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="For example: answer their question, then suggest a short call."
            />
          </label>
          {draft && (
            <details className="ai-draft-context">
              <summary>Current draft</summary>
              <p>{draft}</p>
            </details>
          )}
          <div className="ai-draft-empty">
            <Sparkles size={26} />
            <h3>Your AI draft will appear here</h3>
            <p>
              {action === "Draft reply"
                ? "Replies will use the conversation and your saved business knowledge."
                : `${action} will work with your draft after AI is connected.`}
            </p>
            <span>No AI response has been generated.</span>
          </div>
          <div className="ai-help-note">
            <ShieldCheck size={17} />
            <p>Review and edit every draft before sending.</p>
          </div>
          <div className="ai-assistant-footer">
            <Button asChild variant="outline">
              <Link href="/app/ai-workspace">
                <BookOpen size={16} />
                Business knowledge
              </Link>
            </Button>
            <Button disabled title="Connect an AI provider to generate drafts">
              <Sparkles size={16} />
              Generate draft
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

export function AiInboxNotice() {
  return (
    <details className="ai-inbox-notice">
      <summary>
        <Sparkles size={15} />
        AI insights <small>Not connected</small>
      </summary>
      <p>
        Intent, priority and a conversation summary will appear here after AI
        setup. Current conversation statuses are managed by your team.
      </p>
      <Link href="/app/ai-workspace">Prepare AI Workspace</Link>
    </details>
  );
}
