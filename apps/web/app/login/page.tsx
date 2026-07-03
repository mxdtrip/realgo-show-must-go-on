import { AuthForm } from "../_auth/AuthForm";
import { AuthPageHeader } from "../_auth/AuthPageHeader";

export default function LoginPage() {
  return (
    <>
      <AuthPageHeader />
      <div className="auth-layer auth-layer--page">
        <AuthForm mode="login" />
      </div>
    </>
  );
}
