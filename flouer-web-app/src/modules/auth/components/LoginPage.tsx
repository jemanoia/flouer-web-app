import { type FormEvent, useState } from "react";
import { LockKeyhole, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/utils/supabase";

type LoginPageProps = {
  initialErrorMessage?: string;
};

export function LoginPage({ initialErrorMessage = "" }: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(initialErrorMessage);
  const [successMessage, setSuccessMessage] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");
    setIsSubmitting(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMessage(error.message);
      setIsSubmitting(false);
      return;
    }

    setSuccessMessage("Login successful.");
    setIsSubmitting(false);
  };

  return (
    <main className="flex min-h-svh items-center justify-center bg-white px-4 text-black">
      <Card className="w-full max-w-md border-black/15 bg-white shadow-none">
        <CardHeader className="space-y-2 pb-4 text-center">
          <CardTitle className="text-3xl font-semibold tracking-tight text-black">
            Cookie Shop POS
          </CardTitle>
          <CardDescription className="text-neutral-600">
            Sign in with your staff account.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-black">
                Email address
              </Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-500" />
                <Input
                  id="email"
                  type="email"
                  placeholder="cashier@cookieshop.com"
                  className="border-black/20 bg-white pl-9 text-black placeholder:text-neutral-500"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-black">
                Password
              </Label>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-500" />
                <Input
                  id="password"
                  type="password"
                  placeholder="********"
                  className="border-black/20 bg-white pl-9 text-black placeholder:text-neutral-500"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>

            <label
              className="flex items-center gap-2 text-sm font-medium text-black"
              htmlFor="remember"
            >
              <Checkbox
                id="remember"
                className="border-black/40 data-[state=checked]:bg-black data-[state=checked]:text-white"
              />
              Keep me signed in
            </label>

            <Button
              type="submit"
              className="h-11 w-full bg-black text-white hover:bg-neutral-800"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Signing in..." : "Sign in"}
            </Button>

            {errorMessage && <p className="text-sm text-black">{errorMessage}</p>}
            {successMessage && <p className="text-sm text-black">{successMessage}</p>}

            <Separator className="bg-black/10" />

            <p className="text-center text-sm text-neutral-600">
              Need access? Contact your manager to assign cashier permissions.
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
