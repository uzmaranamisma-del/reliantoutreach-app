import { describe, expect, it } from "vitest";
import {
  conversations,
  newestMessages,
  plainText,
  replyHtml,
  chatText,
  messageTime,
} from "../apps/mobile/src/lib/messages";
describe("mobile conversation rendering", () => {
  it("deduplicates the same provider message when its encrypted transport ID changes", () => {
    const first = {
      id: "encrypted-a",
      key: "stable-provider-key",
      fromEmail: "lead@example.test",
      createdAt: "2026-01-01T00:00:00Z",
    };
    expect(
      newestMessages([
        { items: [first] },
        { items: [{ ...first, id: "encrypted-b" }] },
      ]),
    ).toHaveLength(1);
  });
  it("merges overlapping pages without repeats and sorts latest first", () => {
    const first = {
      id: "1",
      fromEmail: "LEAD@example.test",
      createdAt: "2026-01-01T00:00:00Z",
    };
    const second = {
      ...first,
      id: "2",
      fromEmail: "lead@example.test",
      createdAt: "2026-01-02T00:00:00Z",
    };
    const result = newestMessages([
      { items: [first, second] },
      { items: [second] },
    ]);
    expect(result.map((m) => m.id)).toEqual(["2", "1"]);
    expect(conversations(result).map((m) => m.id)).toEqual(["2"]);
  });
  it("removes HTML/script markup and preserves readable paragraphs", () => {
    expect(
      plainText(
        "<script>alert(1)</script><p>Hello &amp; thanks</p><p>Next line</p>",
      ),
    ).toBe("Hello & thanks\nNext line");
  });
  it("escapes a typed reply instead of treating it as HTML", () => {
    expect(replyHtml("Hi\n<img src=x>")).toBe("<p>Hi<br>&lt;img src=x&gt;</p>");
  });
  it("shows only the new reply from the reported wrapped email chain", () => {
    const message = "Happy<br>On Tuesday, October 6, 2026 1:57 AM<br>EDT, lead@example.com<br>wrote:I'm doing good and you?<br>On Mon, Oct 5, 2026 at 11:16 PM Sawyer<br>Holt &lt;sawyer@example.com&gt;<br>wrote:<br>hey how are you";
    expect(chatText(message)).toBe("Happy");
  });
  it("removes Gmail, Yahoo and Outlook history without changing the source", () => {
    for (const marker of ['class="gmail_quote"', 'class="yahoo_quoted"', 'id="divRplyFwdMsg"']) {
      expect(chatText(`<p>Yes, Thursday works.</p><div ${marker}>Old reply</div>`)).toBe("Yes, Thursday works.");
    }
    expect(chatText("New answer\nOn Mon, Oct 5, 2026 at 11:16 PM Alex <alex@example.com> wrote:\nOld answer")).toBe("New answer");
    expect(chatText("Thanks\nFrom: Alex\nSent: Monday\nTo: Sam\nSubject: Re: Hello\nOld answer")).toBe("Thanks");
  });
  it("keeps ordinary quotations, multi-paragraph replies and unmatched text", () => {
    expect(chatText("<p>My answer</p><blockquote>A quotation I chose.</blockquote>")).toBe("My answer\nA quotation I chose.");
    expect(chatText("On Monday we can talk.\n\nPlease email me at me@example.com.")).toBe("On Monday we can talk.\n\nPlease email me at me@example.com.");
    expect(chatText('<div class="gmail_quote">Only available content</div>')).toBe("Only available content");
  });
  it("uses only the local clock time even for older chat bubbles", () => {
    const value = "2020-01-02T15:04:00Z";
    expect(messageTime(value)).toBe(new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    expect(messageTime("invalid")).toBe("");
  });
});
