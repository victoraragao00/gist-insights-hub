import { useState, useId } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Check } from "lucide-react";

const signupSchema = z
  .object({
    email: z.string().email("Email inválido"),
    password: z.string().min(6, "Mínimo de 6 caracteres"),
    confirmPassword: z.string().min(6, "Mínimo de 6 caracteres"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

type SignupForm = z.infer<typeof signupSchema>;

const SignupPage = () => {
  const [success, setSuccess] = useState(false);
  const emailId = useId();
  const passwordId = useId();
  const confirmPasswordId = useId();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupForm>({ resolver: zodResolver(signupSchema) });

  const signupMutation = useMutation({
    mutationFn: async (values: SignupForm) => {
      const { error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
      });
      if (error) throw error;
    },
    onSuccess: () => setSuccess(true),
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao criar conta"),
  });

  const onSubmit = (values: SignupForm) => signupMutation.mutate(values);

  if (success) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background px-4">
        <Card className="w-full max-w-sm">
          <CardContent className="p-8 text-center space-y-4">
            <Check className="h-10 w-10 text-primary mx-auto" />
            <h2 className="text-lg font-semibold">Verifique seu email</h2>
            <p className="text-sm text-muted-foreground">
              Enviamos um link de confirmação para seu email. Clique nele para ativar sua conta.
            </p>
            <Link to="/login">
              <Button variant="outline" className="mt-2">Ir para Login</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-lg mb-2">
            H
          </div>
          <CardTitle className="text-xl">Criar Conta</CardTitle>
          <CardDescription>Registre-se no CX Hub</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={emailId}>Email</Label>
              <Input id={emailId} type="email" placeholder="seu@email.com" {...register("email")} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor={passwordId}>Senha</Label>
              <Input id={passwordId} type="password" placeholder="••••••" {...register("password")} />
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor={confirmPasswordId}>Confirmar Senha</Label>
              <Input id={confirmPasswordId} type="password" placeholder="••••••" {...register("confirmPassword")} />
              {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={signupMutation.isPending}>
              {signupMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Criar Conta
            </Button>
          </form>
          <p className="text-sm text-center text-muted-foreground mt-4">
            Já tem conta?{" "}
            <Link to="/login" className="text-primary hover:underline">
              Fazer login
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default SignupPage;
