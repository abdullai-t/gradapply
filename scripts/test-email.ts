import "dotenv/config";

import { sendMail, verifyMailTransport } from "../src/lib/mail";

async function main() {
  const to = process.argv[2]?.trim();
  if (!to) {
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
  });

  console.log("Send result:", result);
  process.exit(result.sent ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
