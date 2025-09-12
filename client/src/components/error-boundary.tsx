import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, AlertCircle } from "lucide-react";
import { isIframeError, getFrameContext, logFrameContext } from "@/utils/iframe-utils";

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
  isIframeRelated?: boolean;
  retryCount: number;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ 
    error?: Error; 
    errorInfo?: React.ErrorInfo;
    resetError: () => void;
    isIframeRelated?: boolean;
  }>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  maxRetries?: number;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { 
      hasError: false,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    const isIframeRelated = isIframeError(error);
    return { 
      hasError: true, 
      error,
      isIframeRelated
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Enhanced error logging with iframe context
    console.group('🚨 Error caught by ErrorBoundary');
    console.error('Error:', error);
    console.error('Error Info:', errorInfo);
    console.error('Component Stack:', errorInfo.componentStack);
    
    // Log iframe context if relevant
    if (isIframeError(error)) {
      console.warn('⚠️ This appears to be an iframe-related error');
      logFrameContext('Iframe Error Context');
    }
    
    // Log general frame context
    const frameContext = getFrameContext();
    if (frameContext.isInIframe) {
      console.log('Running in iframe:', frameContext);
    }
    
    console.groupEnd();

    // Store error info in state
    this.setState({ errorInfo });

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Send error to parent if in iframe
    if (frameContext.isInIframe) {
      try {
        window.parent.postMessage({
          type: 'error-boundary-error',
          error: {
            message: error.message,
            stack: error.stack,
            isIframeRelated: isIframeError(error)
          },
          timestamp: Date.now()
        }, '*');
      } catch (e) {
        console.error('Failed to send error to parent frame:', e);
      }
    }
  }

  resetError = () => {
    const maxRetries = this.props.maxRetries ?? 3;
    
    if (this.state.retryCount >= maxRetries) {
      console.warn(`Maximum retry attempts (${maxRetries}) reached`);
      // Perform a full page reload as last resort
      window.location.reload();
    } else {
      this.setState(prevState => ({ 
        hasError: false, 
        error: undefined,
        errorInfo: undefined,
        isIframeRelated: false,
        retryCount: prevState.retryCount + 1
      }));
    }
  };

  handleFullReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return (
          <FallbackComponent 
            error={this.state.error} 
            errorInfo={this.state.errorInfo}
            resetError={this.resetError}
            isIframeRelated={this.state.isIframeRelated}
          />
        );
      }

      const { error, isIframeRelated, retryCount } = this.state;
      const maxRetries = this.props.maxRetries ?? 3;
      const frameContext = getFrameContext();

      return (
        <Card className="max-w-md mx-auto mt-8">
          <CardContent className="pt-6">
            <div className="text-center">
              {isIframeRelated ? (
                <AlertCircle className="mx-auto h-12 w-12 text-warning mb-4" />
              ) : (
                <AlertTriangle className="mx-auto h-12 w-12 text-destructive mb-4" />
              )}
              
              <h3 className="text-lg font-semibold mb-2">
                {isIframeRelated ? "Frame Security Issue" : "Something went wrong"}
              </h3>
              
              <p className="text-muted-foreground mb-4">
                {isIframeRelated 
                  ? "This application encountered a security restriction when running in an iframe. This might be due to browser security policies."
                  : (error?.message || "An unexpected error occurred")}
              </p>

              {/* Show iframe context if relevant */}
              {frameContext.isInIframe && (
                <div className="text-xs text-muted-foreground bg-muted rounded p-2 mb-4">
                  <p>Running in iframe</p>
                  {frameContext.isReplitPreview && <p>Replit Preview Mode</p>}
                  {frameContext.crossOrigin && <p>Cross-origin restrictions apply</p>}
                </div>
              )}

              {/* Show retry count if applicable */}
              {retryCount > 0 && (
                <p className="text-xs text-muted-foreground mb-2">
                  Retry attempt {retryCount} of {maxRetries}
                </p>
              )}

              <div className="flex gap-2 justify-center">
                <Button 
                  onClick={this.resetError}
                  variant={retryCount >= maxRetries - 1 ? "destructive" : "default"}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {retryCount >= maxRetries - 1 ? "Final Retry" : "Try Again"}
                </Button>
                
                {/* Offer full reload option for iframe issues */}
                {(isIframeRelated || retryCount > 0) && (
                  <Button 
                    onClick={this.handleFullReload}
                    variant="outline"
                  >
                    Reload Page
                  </Button>
                )}
              </div>

              {/* Developer mode: show error details */}
              {import.meta.env.DEV && error && (
                <details className="mt-4 text-left">
                  <summary className="cursor-pointer text-xs text-muted-foreground">
                    Error Details (Development Only)
                  </summary>
                  <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto max-h-40">
                    {error.stack || error.message}
                  </pre>
                  {this.state.errorInfo && (
                    <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto max-h-40">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  )}
                </details>
              )}
            </div>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

export function withErrorBoundary<T extends object>(
  Component: React.ComponentType<T>,
  fallback?: React.ComponentType<{ 
    error?: Error; 
    errorInfo?: React.ErrorInfo;
    resetError: () => void;
    isIframeRelated?: boolean;
  }>,
  options?: {
    onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
    maxRetries?: number;
  }
) {
  return function WithErrorBoundaryComponent(props: T) {
    return (
      <ErrorBoundary 
        fallback={fallback}
        onError={options?.onError}
        maxRetries={options?.maxRetries}
      >
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}