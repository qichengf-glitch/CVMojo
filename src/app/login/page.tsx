import { Suspense } from "react";
import LoginForm from "./login-form";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-slate-500">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}
