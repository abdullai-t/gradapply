import { redirect } from "next/navigation";

/** Password registration is disabled — users sign in with Google or magic link. */
export default function RegisterPage() {
  redirect("/login");
}
