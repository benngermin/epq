import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, Server, Database, Activity, MemoryStick, Cpu } from "lucide-react";
import { format } from "date-fns";

interface DebugStatus {
  timestamp: string;
  server: {
    uptime: number;
    memory: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
      external: number;
      arrayBuffers: number;
    };
    nodeVersion: string;
    environment: string;
  };
  system: {
    totalMemory: number;
    freeMemory: number;
    cpus: number;
    loadAverage: number[];
  };
  database: {
    status: string;
    connectionCount: string;
    error: string | null;
  };
  performance: {
    heapUsed: string;
    externalMemory: string;
    cpuUsage: {
      user: number;
      system: number;
    };
  };
}

function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

function formatUptime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

export default function Debug() {
  const { data: status, isLoading, error, refetch } = useQuery<DebugStatus>({
    queryKey: ['/api/debug/status'],
    refetchInterval: 5000, // Auto-refresh every 5 seconds
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6">System Debug Information</h1>
        <div className="grid gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6">System Debug Information</h1>
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <span>Failed to load debug information</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!status) {
    return null;
  }

  const memoryUsagePercent = (status.server.memory.heapUsed / status.server.memory.heapTotal) * 100;
  const systemMemoryUsagePercent = ((status.system.totalMemory - status.system.freeMemory) / status.system.totalMemory) * 100;

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">System Debug Information</h1>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          Refresh
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Server Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              Server Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Environment</span>
              <Badge variant={status.server.environment === 'production' ? 'default' : 'secondary'}>
                {status.server.environment}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Node Version</span>
              <span className="text-sm font-mono">{status.server.nodeVersion}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Uptime</span>
              <span className="text-sm font-mono">{formatUptime(status.server.uptime)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Last Update</span>
              <span className="text-sm">{format(new Date(status.timestamp), 'HH:mm:ss')}</span>
            </div>
          </CardContent>
        </Card>

        {/* Database Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Database Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <div className="flex items-center gap-2">
                {status.database.status === 'connected' ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <Badge variant="outline" className="text-green-600">Connected</Badge>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    <Badge variant="destructive">Disconnected</Badge>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Connections</span>
              <span className="text-sm font-mono">{status.database.connectionCount}</span>
            </div>
            {status.database.error && (
              <div className="mt-2 p-2 bg-destructive/10 rounded text-sm text-destructive">
                {status.database.error}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Memory Usage */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MemoryStick className="h-5 w-5" />
              Memory Usage
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-muted-foreground">Heap Usage</span>
                <span className="text-sm font-mono">{memoryUsagePercent.toFixed(1)}%</span>
              </div>
              <Progress value={memoryUsagePercent} className="h-2" />
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-muted-foreground">
                  {formatBytes(status.server.memory.heapUsed)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatBytes(status.server.memory.heapTotal)}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">RSS</span>
              <span className="text-sm font-mono">{formatBytes(status.server.memory.rss)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">External</span>
              <span className="text-sm font-mono">{formatBytes(status.server.memory.external)}</span>
            </div>
          </CardContent>
        </Card>

        {/* System Resources */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="h-5 w-5" />
              System Resources
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">CPU Cores</span>
              <span className="text-sm font-mono">{status.system.cpus}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Load Average</span>
              <span className="text-sm font-mono">
                {status.system.loadAverage.map(load => load.toFixed(2)).join(', ')}
              </span>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-muted-foreground">System Memory</span>
                <span className="text-sm font-mono">{systemMemoryUsagePercent.toFixed(1)}%</span>
              </div>
              <Progress value={systemMemoryUsagePercent} className="h-2" />
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-muted-foreground">
                  Used: {formatBytes(status.system.totalMemory - status.system.freeMemory)}
                </span>
                <span className="text-xs text-muted-foreground">
                  Total: {formatBytes(status.system.totalMemory)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Performance Metrics */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Performance Metrics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Heap Memory</span>
                  <span className="text-sm font-mono">{status.performance.heapUsed}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">External Memory</span>
                  <span className="text-sm font-mono">{status.performance.externalMemory}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">CPU User Time</span>
                  <span className="text-sm font-mono">{(status.performance.cpuUsage.user / 1000000).toFixed(2)}s</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">CPU System Time</span>
                  <span className="text-sm font-mono">{(status.performance.cpuUsage.system / 1000000).toFixed(2)}s</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}