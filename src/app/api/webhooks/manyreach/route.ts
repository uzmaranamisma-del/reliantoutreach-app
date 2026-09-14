// No invented signature or event schema. Enable only after an official authenticity contract is verified.
export async function POST() {
  return Response.json(
    { error: "Webhook integration is not enabled." },
    { status: 503 },
  );
}
