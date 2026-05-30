import "dotenv/config";

import { sendMail, verifyMailTransport } from "../src/lib/mail";

function normalizeRecipient(raw: string): string {
  return raw.replace(/\\/g, "").trim();
}

async function main() {
  const to = normalizeRecipient(process.argv[2] ?? "");
  if (!to || !to.includes("@")) {
    console.error("Usage: pnpm mail:test you@example.com");
    process.exit(1);
  }

  const verify = await verifyMailTransport();
  console.log("Transport:", verify);
  if (!verify.ok) {
    process.exit(1);
  }

  const result = await sendMail({
    to,
    subject: "GradApply mail test",
    text: "If you received this, outbound email is working.",
    html: "<p>If you received this, outbound email is working.</p>",
  });

  console.log("Send result:", result);
  if (!result.sent && result.error) {
    console.error(
      "\nTips:\n" +
        "- Confirm RESEND_API_KEY in .env (https://resend.com/api-keys)\n" +
        "- EMAIL_FROM must use a domain verified in Resend (https://resend.com/domains)\n" +
        "- Quote the address: pnpm mail:test 'you@example.com'",
    );
  }
  process.exit(result.sent ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
