import { useState, useCallback, useMemo, ChangeEvent } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Redirect } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Loader2,
  RotateCcw,
  FileCheck,
  AlertTriangle
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// TypeScript types
interface CSVPreviewRow {
  uniqueId: string;
  courseName: string;
  questionSetNumber: number;
  questionNumber: number;
  loid: string;
  questionText: string;
  finalStaticExplanation: string;
}

interface PreviewResult {
  row: CSVPreviewRow;
  found: boolean;
  questionVersionId?: number;
  currentExplanation?: string | null;
  isStaticAnswer?: boolean;
  questionType?: string;
  match?: {
    courseName: string;
    questionSetNumber: number;
    questionNumber: number;
    loid: string;
  };
  error?: string;
}

interface PreviewResponse {
  success: boolean;
  preview: boolean;
  statistics: {
    totalRows: number;
    matchedRows: number;
    unmatchedRows: number;
    matchPercentage: number;
  };
  results: PreviewResult[];
  message?: string;
}

interface UploadResponse {
  success: boolean;
  updated: number;
  failed: number;
  errors?: Array<{ row: number; message: string }>;
  message?: string;
}

export default function AdminUploadExplanations() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  
  // State management
  const [file, setFile] = useState<File | null>(null);
  const [csvContent, setCsvContent] = useState<string>("");
  const [previewData, setPreviewData] = useState<PreviewResponse | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Check if user has permission to access this page
  if (!authLoading && (!user || user.email !== 'benn@modia.ai')) {
    return <Redirect to="/" />;
  }
  
  // Preview mutation
  const previewMutation = useMutation({
    mutationFn: async (csvContent: string) => {
      const res = await apiRequest("POST", "/api/admin/preview-explanations", { csvContent });
      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || "Failed to preview CSV");
      }
      return await res.json() as PreviewResponse;
    },
    onSuccess: (data) => {
      setPreviewData(data);
      // Initially select all matched rows
      if (data.results) {
        const matchedIndices = data.results
          .map((result, index) => result.found ? index : null)
          .filter((index): index is number => index !== null);
        setSelectedRows(new Set(matchedIndices));
      }
      toast({
        title: "CSV Preview Generated",
        description: `Found ${data.statistics.matchedRows} matched questions out of ${data.statistics.totalRows} total rows`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Preview Failed",
        description: error.message,
        variant: "destructive",
      });
      setPreviewData(null);
    },
  });
  
  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (selectedResults: PreviewResult[]) => {
      const res = await apiRequest("POST", "/api/admin/upload-explanations", { 
        previewResults: selectedResults 
      });
      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || "Failed to upload explanations");
      }
      return await res.json() as UploadResponse;
    },
    onSuccess: (data) => {
      setUploadResult(data);
      toast({
        title: "Upload Successful",
        description: `Successfully updated ${data.updated} questions`,
        variant: "default",
      });
      // Clear selected rows after successful upload
      setSelectedRows(new Set());
    },
    onError: (error: Error) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // File handling
  const handleFileSelect = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
        toast({
          title: "Invalid File Type",
          description: "Please select a CSV file",
          variant: "destructive",
        });
        return;
      }
      processFile(selectedFile);
    }
  }, []);
  
  const processFile = useCallback((file: File) => {
    setFile(file);
    setUploadResult(null);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setCsvContent(content);
      previewMutation.mutate(content);
    };
    reader.onerror = () => {
      toast({
        title: "File Read Error",
        description: "Failed to read the CSV file",
        variant: "destructive",
      });
    };
    reader.readAsText(file);
  }, [previewMutation]);
  
  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);
  
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);
  
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      if (droppedFile.type !== 'text/csv' && !droppedFile.name.endsWith('.csv')) {
        toast({
          title: "Invalid File Type",
          description: "Please drop a CSV file",
          variant: "destructive",
        });
        return;
      }
      processFile(droppedFile);
    }
  }, [processFile]);
  
  // Selection handlers
  const toggleRowSelection = useCallback((index: number) => {
    setSelectedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  }, []);
  
  const selectAll = useCallback(() => {
    if (previewData?.results) {
      const allIndices = previewData.results
        .map((result, index) => result.found ? index : null)
        .filter((index): index is number => index !== null);
      setSelectedRows(new Set(allIndices));
    }
  }, [previewData]);
  
  const deselectAll = useCallback(() => {
    setSelectedRows(new Set());
  }, []);
  
  // Upload selected rows
  const handleUpload = useCallback(() => {
    if (!previewData?.results) return;
    
    const selectedResults = previewData.results.filter((_, index) => selectedRows.has(index));
    if (selectedResults.length === 0) {
      toast({
        title: "No Rows Selected",
        description: "Please select at least one row to upload",
        variant: "destructive",
      });
      return;
    }
    
    uploadMutation.mutate(selectedResults);
  }, [previewData, selectedRows, uploadMutation]);
  
  // Reset handler
  const handleReset = useCallback(() => {
    setFile(null);
    setCsvContent("");
    setPreviewData(null);
    setSelectedRows(new Set());
    setUploadResult(null);
  }, []);
  
  // Calculate statistics
  const statistics = useMemo(() => {
    if (!previewData?.results) {
      return { total: 0, matched: 0, unmatched: 0, selected: 0 };
    }
    
    const matched = previewData.results.filter(r => r.found).length;
    const selectedMatched = previewData.results.filter((r, i) => r.found && selectedRows.has(i)).length;
    
    return {
      total: previewData.results.length,
      matched,
      unmatched: previewData.results.length - matched,
      selected: selectedMatched,
    };
  }, [previewData, selectedRows]);
  
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-2xl font-bold flex items-center gap-2">
            <FileCheck className="h-6 w-6" />
            Upload Static Explanations
          </CardTitle>
          <CardDescription>
            Upload a CSV file containing static explanations for questions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <button
              onClick={async () => {
                try {
                  const response = await fetch('/api/admin/diagnostic', {
                    credentials: 'include'
                  });
                  const data = await response.json();
                  console.log("DIAGNOSTIC RESULTS:", data);
                  alert(`Diagnostic Results:\n\nCPCU Courses: ${data.cpcu_courses_count}\nQuestions with LOIDs: ${data.questions_with_loids}\nTest Query Results: ${data.test_query_results}\nStorage Function Test: ${data.storage_function_test?.count || 0}\n\nCheck console for full details`);
                } catch (error) {
                  console.error("Diagnostic error:", error);
                  alert("Diagnostic failed - check console");
                }
              }}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Run Diagnostic Test
            </button>
          </div>
          {!previewData && !uploadResult && (
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              data-testid="csv-dropzone"
            >
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg mb-2">Drag and drop your CSV file here</p>
              <p className="text-sm text-muted-foreground mb-4">or</p>
              <label htmlFor="csv-upload" className="cursor-pointer">
                <Button asChild>
                  <span>
                    <FileText className="h-4 w-4 mr-2" />
                    Select CSV File
                  </span>
                </Button>
                <input
                  id="csv-upload"
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                  data-testid="input-csv-file"
                />
              </label>
              {file && (
                <p className="mt-4 text-sm text-muted-foreground">
                  Selected: {file.name} ({(file.size / 1024).toFixed(2)} KB)
                </p>
              )}
            </div>
          )}
          
          {previewMutation.isPending && (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Processing CSV file...</p>
            </div>
          )}
          
          {previewData && !uploadResult && (
            <>
              <div className="grid grid-cols-4 gap-4 mb-6">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">{statistics.total}</div>
                    <p className="text-xs text-muted-foreground">Total Rows</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-green-600">{statistics.matched}</div>
                    <p className="text-xs text-muted-foreground">Matched</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-red-600">{statistics.unmatched}</div>
                    <p className="text-xs text-muted-foreground">Unmatched</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-blue-600">{statistics.selected}</div>
                    <p className="text-xs text-muted-foreground">Selected</p>
                  </CardContent>
                </Card>
              </div>
              
              <div className="flex justify-between items-center mb-4">
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={selectAll}
                    data-testid="button-select-all"
                  >
                    Select All Matched
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={deselectAll}
                    data-testid="button-deselect-all"
                  >
                    Deselect All
                  </Button>
                </div>
                <div className="text-sm text-muted-foreground">
                  {selectedRows.size} rows selected for update
                </div>
              </div>
              
              <ScrollArea className="h-[500px] border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Select</TableHead>
                      <TableHead className="w-12">Status</TableHead>
                      <TableHead>Course</TableHead>
                      <TableHead>Set</TableHead>
                      <TableHead>Q#</TableHead>
                      <TableHead>LOID</TableHead>
                      <TableHead className="max-w-[300px]">Question Text</TableHead>
                      <TableHead>Current Explanation</TableHead>
                      <TableHead>New Explanation</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.results.map((result, index) => (
                      <TableRow 
                        key={index}
                        className={result.found ? '' : 'opacity-50'}
                        data-testid={`row-preview-${index}`}
                      >
                        <TableCell>
                          <Checkbox
                            checked={selectedRows.has(index)}
                            onCheckedChange={() => toggleRowSelection(index)}
                            disabled={!result.found}
                            data-testid={`checkbox-row-${index}`}
                          />
                        </TableCell>
                        <TableCell>
                          {result.found ? (
                            <CheckCircle className="h-5 w-5 text-green-600" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-600" />
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          {result.row.courseName}
                        </TableCell>
                        <TableCell>{result.row.questionSetNumber}</TableCell>
                        <TableCell>{result.row.questionNumber}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {result.row.loid}
                        </TableCell>
                        <TableCell className="max-w-[300px]">
                          <div className="truncate" title={result.row.questionText}>
                            {result.row.questionText}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[250px]">
                          <div className="truncate text-sm text-muted-foreground" 
                               title={result.currentExplanation || 'No current explanation'}>
                            {result.currentExplanation || 
                             <span className="italic">No current explanation</span>}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[250px]">
                          <div className="truncate text-sm" 
                               title={result.row.finalStaticExplanation}>
                            {result.row.finalStaticExplanation}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
              
              <div className="flex justify-between mt-6">
                <Button
                  variant="outline"
                  onClick={handleReset}
                  data-testid="button-reset"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset
                </Button>
                <Button
                  onClick={handleUpload}
                  disabled={selectedRows.size === 0 || uploadMutation.isPending}
                  data-testid="button-upload"
                >
                  {uploadMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload {selectedRows.size} Selected Rows
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
          
          {uploadResult && (
            <div className="space-y-4">
              <Alert variant={uploadResult.success ? "default" : "destructive"}>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {uploadResult.success ? (
                    <div>
                      <p className="font-semibold mb-2">Upload Complete!</p>
                      <p>Successfully updated {uploadResult.updated} questions</p>
                      {uploadResult.failed > 0 && (
                        <p className="mt-1 text-red-600">Failed to update {uploadResult.failed} questions</p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <p className="font-semibold">Upload Failed</p>
                      <p>{uploadResult.message || "An error occurred during upload"}</p>
                    </div>
                  )}
                </AlertDescription>
              </Alert>
              
              {uploadResult.errors && uploadResult.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <p className="font-semibold mb-2">Errors:</p>
                    <ul className="list-disc list-inside">
                      {uploadResult.errors.map((error, index) => (
                        <li key={index} className="text-sm">
                          Row {error.row}: {error.message}
                        </li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
              
              <div className="flex justify-center">
                <Button
                  onClick={handleReset}
                  data-testid="button-start-over"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Start Over
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}