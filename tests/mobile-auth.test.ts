import { expect, it } from "vitest";
import { betterAuth } from "better-auth";
import { bearer } from "better-auth/plugins";
import { memoryAdapter } from "better-auth/adapters/memory";

it("authenticates a signed native bearer, rejects forged/raw tokens and revokes it on logout", async () => {
  const auth = betterAuth({
    baseURL: "https://mobile-auth.example.test",
    secret: "isolated-auth-test-secret-32-characters-long",
    database: memoryAdapter({
      user: [],
      account: [],
      session: [],
      verification: [],
    }),
    emailAndPassword: { enabled: true },
    plugins: [bearer({ requireSignature: true })],
    rateLimit: { enabled: false },
  });
  const response = await auth.handler(
    new Request("https://mobile-auth.example.test/api/auth/sign-up/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://mobile-auth.example.test",
      },
      body: JSON.stringify({
        name: "Isolated test",
        email: "qa@example.test",
        password: "Isolated-test-only-123!",
      }),
    }),
  );
  expect(response.status).toBe(200);
  const token = response.headers.get("set-auth-token");
  expect(token).toBeTruthy();
  const session = await auth.api.getSession({
    headers: new Headers({ Authorization: "Bearer " + token }),
  });
  expect(session?.user.email).toBe("qa@example.test");
  const raw = decodeURIComponent(token!).split(".")[0];
  expect(
    await auth.api.getSession({
      headers: new Headers({ Authorization: "Bearer " + raw }),
    }),
  ).toBeNull();
  expect(
    await auth.api.getSession({
      headers: new Headers({ Authorization: "Bearer " + token + "forged" }),
    }),
  ).toBeNull();
  const logout = await auth.handler(
    new Request("https://mobile-auth.example.test/api/auth/sign-out", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://mobile-auth.example.test",
        Authorization: "Bearer " + token,
      },
      body: "{}",
    }),
  );
  expect(logout.status).toBe(200);
  expect(
    await auth.api.getSession({
      headers: new Headers({ Authorization: "Bearer " + token }),
    }),
  ).toBeNull();
});
