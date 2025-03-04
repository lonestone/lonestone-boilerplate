import { useNavigate, Link } from "react-router";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { Input } from "@lonestone/ui/components/primitives/input";
import { Button } from "@lonestone/ui/components/primitives/button";
import { Loader2 } from "lucide-react";

type RegisterFormData = {
  name: string;
  email: string;
  password: string;
};

export default function Register() {
  const navigate = useNavigate();
  const { data: sessionData } = authClient.useSession();
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<RegisterFormData>();

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterFormData) => {
      const response = await authClient.signUp.email({
        name: data.name,
        email: data.email,
        password: data.password,
        callbackURL: "/",
      });
      
      if (response.error) {
        throw new Error(response.error.message || "Registration failed. Please try again.");
      }
      
      return response.data;
    },
    onSuccess: () => {
      navigate("/");
    },
    onError: (error: Error) => {
      setError("root", { 
        message: error.message || "Registration failed. Please try again." 
      });
    }
  });

  // Redirect if already logged in
  if (sessionData) {
    navigate("/");
  }

  const onSubmit = (data: RegisterFormData) => {
    registerMutation.mutate(data);
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Create account</h1>
        <p className="text-sm text-muted-foreground">
          Fill in your information to create an account.
        </p>
      </div>

      <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
        {errors.root && (
          <div className="rounded-xl bg-red-500/10 p-4 border border-red-500/20">
            <div className="text-sm text-destructive">{errors.root.message}</div>
          </div>
        )}
          
        <div className="space-y-3">
          <div className="space-y-1">
            <label htmlFor="name" className="block text-sm font-medium text-muted-foreground">
              Full Name
            </label>
            <Input
              id="name"
              {...register("name", { 
                required: "Name is required" 
              })}
              type="text"
              autoComplete="name"
              placeholder="John Doe"
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>
            
          <div className="space-y-1">
            <label htmlFor="email" className="block text-sm font-medium text-muted-foreground">
              Email address
            </label>
            <Input
              id="email"
              {...register("email", { 
                required: "Email is required",
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: "Invalid email address"
                }
              })}
              type="email"
              autoComplete="email"
              placeholder="your@email.com"
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>
            
          <div className="space-y-1">
            <label htmlFor="password" className="block text-sm font-medium text-muted-foreground">
              Password
            </label>
            <Input
              id="password"
              {...register("password", { 
                required: "Password is required",
                minLength: {
                  value: 6,
                  message: "Password must be at least 6 characters"
                }
              })}
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
            />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>
        </div>

        <Button
          className="w-full"
          type="submit"
          disabled={registerMutation.isPending}
        >
          <span className="relative z-10 flex items-center justify-center">
            {registerMutation.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Creating account...
              </>
            ) : (
              "Create account"
            )}
          </span>
        </Button>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" className="w-full" disabled>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            height="24"
            viewBox="0 0 24 24"
            width="24"
          >
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
            <path d="M1 1h22v22H1z" fill="none" />
          </svg>
          Sign up with Google
        </Button>

        <Button variant="outline" className="w-full" disabled>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 21 21">
            <path fill="#f35325" d="M0 0h10v10H0z" />
            <path fill="#81bc06" d="M11 0h10v10H11z" />
            <path fill="#05a6f0" d="M0 11h10v10H0z" />
            <path fill="#ffba08" d="M11 11h10v10H11z" />
          </svg>
          Sign up with Microsoft
        </Button>
      </div>

      <div className="text-sm text-muted-foreground text-center">
        Already have an account?{" "}
        <Link
          to="/login"
          className="font-medium text-primary hover:text-primary/80 transition-colors"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
} 