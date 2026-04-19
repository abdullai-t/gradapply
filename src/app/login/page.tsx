import { getAuthSetupStatus } from "@/auth";

import { LoginForm } from "./login-form";

export default function LoginPage() {
  const setup = getAuthSetupStatus();

  return <LoginForm setup={setup} />;
}
