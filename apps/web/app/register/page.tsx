import { AuthForm } from "../_auth/AuthForm";

export default function RegisterPage() {
  return (
    <div className="auth-layer auth-layer--page">
      <AuthForm mode="register" />
    </div>
  );
}
