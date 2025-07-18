import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface AssessmentErrorFallbackProps {
  error?: Error;
  resetError: () => void;
  questionIndex?: number;
}

export function AssessmentErrorFallback({ 
  error, 
  resetError,
  questionIndex 
}: AssessmentErrorFallbackProps) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-destructive mb-4" />
          <h3 className="text-lg font-semibold mb-2">Assessment Error</h3>
          <p className="text-muted-foreground mb-4">
            {error?.message || "An error occurred while displaying the question"}
          </p>
          {questionIndex !== undefined && (
            <p className="text-sm text-muted-foreground mb-4">
              Error occurred at question {questionIndex + 1}
            </p>
          )}
          <div className="space-y-2">
            <Button onClick={resetError} className="w-full">
              <RotateCcw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
            <Button 
              variant="outline" 
              onClick={() => window.location.reload()} 
              className="w-full"
            >
              Reload Page
            </Button>
          </div>
          {error?.stack && (
            <details className="mt-4 text-left">
              <summary className="cursor-pointer text-sm text-muted-foreground">
                Error Details
              </summary>
              <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto max-h-40">
                {error.stack}
              </pre>
            </details>
          )}
        </CardContent>
      </Card>
    </div>
  );
}