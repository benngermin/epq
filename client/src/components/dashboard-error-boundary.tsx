import { Component, ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class DashboardErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("Dashboard error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center space-y-4">
                <AlertCircle className="h-12 w-12 text-destructive" />
                <h2 className="text-xl font-semibold">Dashboard Error</h2>
                <p className="text-sm text-muted-foreground">
                  There was an error loading your dashboard. This might be due to network issues or invalid course data.
                </p>
                <div className="flex gap-2 mt-4">
                  <Button
                    onClick={() => window.location.reload()}
                    variant="default"
                  >
                    Refresh Page
                  </Button>
                  <Button
                    onClick={() => {
                      this.setState({ hasError: false, error: null });
                      window.location.href = "/auth";
                    }}
                    variant="outline"
                  >
                    Return to Login
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}