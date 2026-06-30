import { AuthForm } from "../_auth/AuthForm";

export default function LoginPage() {
  return (
    <div className="auth-layer auth-layer--page">
      <AuthForm mode="login" />
    </div>
  );
}
