import { Link } from "react-router";
import { Welcome } from "@/features/welcome/welcome";
import { useSession } from "@/lib/auth-client";
import { Button } from "@lonestone/ui/components/primitives/button";

export default function Home() {
  const { data, isPending } = useSession();

  return (
    <div className="min-h-screen">
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Home
          </h1>
          <div className="flex gap-4">
            {isPending ? (
              <p>Loading...</p>
            ) : data ? (
              <div className="flex items-center gap-4">
                <p>Welcome, {data.user.name || data.user.email}</p>
                <Button
                  type="button"
                  onClick={async () => {
                    try {
                      await fetch("/api/auth/signout", { method: "POST" });
                      window.location.reload();
                    } catch (error) {
                      console.error("Error signing out:", error);
                    }
                  }}
                >
                  Sign out
                </Button>
              </div>
            ) : (
              <>
                <Button asChild>
                  <Link to="/login">Sign in</Link>
                </Button>
                <Button variant="secondary" asChild>
                  <Link to="/register">Register</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>
      <main>
        <div className="mx-auto max-w-7xl py-6 sm:px-6 lg:px-8">
          <Welcome />
        </div>
      </main>
    </div>
  );
}
