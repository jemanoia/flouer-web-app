import { LoginPage } from "@/modules/auth/components/LoginPage";
import { useAuthSession } from "@/modules/auth/hooks/useAuthSession";
import { DashboardPage } from "@/modules/dashboard/components/DashboardPage";

function App() {
  const { session, isCheckingSession, sessionError } = useAuthSession();

  if (isCheckingSession) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-white px-4 text-black">
        <p className="text-sm text-neutral-600">Loading session...</p>
      </main>
    );
  }

  if (!session) {
    return <LoginPage initialErrorMessage={sessionError} />;
  }

  return <DashboardPage session={session} />;
}

export default App;
