import { describe, expect, it } from "vitest";
import {
  conversations,
  newestMessages,
  plainText,
  replyHtml,
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
});
