"use client";

import { useActionState } from "react";
import { signIn, signUp, type AuthActionState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";

const initialState: AuthActionState = { error: null };

export function LoginForm() {
  return (
    <Tabs defaultValue="signin" className="w-full max-w-sm">
      <TabsList className="w-full">
        <TabsTrigger value="signin">Sign in</TabsTrigger>
        <TabsTrigger value="signup">Create account</TabsTrigger>
      </TabsList>
      <TabsContent value="signin">
        <AuthForm action={signIn} submitLabel="Sign in" />
      </TabsContent>
      <TabsContent value="signup">
        <AuthForm action={signUp} submitLabel="Create account" />
      </TabsContent>
    </Tabs>
  );
}

function AuthForm({
  action,
  submitLabel,
}: {
  action: (state: AuthActionState, formData: FormData) => Promise<AuthActionState>;
  submitLabel: string;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4 pt-4">
      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required minLength={8} />
      </div>
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Please wait…" : submitLabel}
      </Button>
    </form>
  );
}
