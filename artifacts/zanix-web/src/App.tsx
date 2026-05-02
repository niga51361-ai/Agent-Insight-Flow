import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Background3D } from "@/components/background-3d";

import LandingPage from "./pages/landing";
import AuthPage from "./pages/auth";
import OnboardingPage from "./pages/onboarding";
import ChatPage from "./pages/chat";
import IntegrationsPage from "./pages/integrations";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        if (error?.status === 401 || error?.status === 403 || error?.response?.status === 401) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/onboarding" component={OnboardingPage} />
      <Route path="/chat" component={ChatPage} />
      <Route path="/chat/:sessionId" component={ChatPage} />
      <Route path="/integrations" component={IntegrationsPage} />
      <Route><Redirect href="/" /></Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="relative min-h-dvh">
          <Background3D />
          <div className="relative" style={{ zIndex: 1 }}>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
          </div>
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
