import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-1 flex-col items-center justify-center gap-6 p-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">AI API Usage Dashboard</h1>
        <p className="text-sm text-muted-foreground">Sign in to monitor OpenAI, Gemini, and Anthropic usage.</p>
      </div>
      <LoginForm />
    </main>
  );
}
