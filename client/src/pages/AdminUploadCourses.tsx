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
  AlertTriangle,
  BookOpen
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
  courseNumber: string;
  bubbleUniqueId: string;
}

interface PreviewResult {
  row: CSVPreviewRow;
  found: boolean;
  status?: 'new' | 'exists' | 'updated';
  reason?: string;
  courseId?: number;
  currentCourse?: {
    courseNumber: string;
    courseTitle: string;
    externalId: string | null;
    bubbleUniqueId: string | null;
  };
  changes?: string[];
  error?: string;
}

interface PreviewResponse {
  success: boolean;
  preview: boolean;
  statistics: {
    totalRows: number;
    newCourses: number;
    existingCourses: number;
    updatedCourses: number;
  };
  results: PreviewResult[];
  message?: string;
}

interface UploadResponse {
  success: boolean;
  created: number;
  updated: number;
  failed: number;
  errors?: Array<{ row: number; message: string }>;
  message?: string;
}

export default function AdminUploadCourses() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  
  // State management
  const [file, setFile] = useState<File | null>(null);
  const [csvContent, setCsvContent] = useState("");
  const [previewData, setPreviewData] = useState<PreviewResponse | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);
  
  // Preview mutation - Fixed parameter order for apiRequest
  const previewMutation = useMutation<PreviewResponse, Error, string>({
    mutationFn: async (csvData: string) => {
      const response = await apiRequest("POST", "/api/admin/preview-courses", {
        csvData,
      });
      const data = await response.json();
      return data as PreviewResponse;
    },
    onSuccess: (data) => {
      setPreviewData(data);
      // Auto-select all new courses
      if (data.results) {
        const newIndices = data.results
          .map((result, index) => 
            result.status === 'new' ? index : null
          )
          .filter((index): index is number => index !== null);
        setSelectedRows(new Set(newIndices));
      }
      toast({
        title: "Preview Generated",
        description: `Found ${data.statistics.totalRows} courses: ${data.statistics.newCourses} new, ${data.statistics.existingCourses} existing, ${data.statistics.updatedCourses} with updates`,
      });
    },
    onError: (error) => {
      console.error("Preview error:", error);
      toast({
        title: "Preview Failed",
        description: error instanceof Error ? error.message : "Failed to preview CSV",
        variant: "destructive",
      });
    },
  });
  
  // Upload mutation
  const uploadMutation = useMutation<UploadResponse, Error, PreviewResult[]>({
    mutationFn: async (results: PreviewResult[]) => {
      const coursesToUpload = results
        .filter(r => r.status === 'new' || r.status === 'updated')
        .map(r => r.row);
      
      const response = await apiRequest("POST", "/api/admin/upload-courses", {
        courses: coursesToUpload,
      });
      const data = await response.json();
      return data as UploadResponse;
    },
    onSuccess: (data) => {
      setUploadResult(data);
      queryClient.invalidateQueries({ queryKey: ['/api/admin/courses'] });
      toast({
        title: "Upload Successful",
        description: `Created ${data.created} new courses, updated ${data.updated} existing courses`,
      });
    },
    onError: (error) => {
      console.error("Upload error:", error);
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload courses",
        variant: "destructive",
      });
    },
  });
  
  // File processing
  const processFile = useCallback((file: File) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setCsvContent(text);
      setPreviewData(null);
      setSelectedRows(new Set());
      setUploadResult(null);
      previewMutation.mutate(text);
    };
    
    reader.onerror = () => {
      toast({
        title: "File Read Error",
        description: "Failed to read the CSV file",
        variant: "destructive",
      });
    };
    
    reader.readAsText(file);
    setFile(file);
  }, [previewMutation]);
  
  // File input handler
  const handleFileChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
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
  }, [processFile]);
  
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
        .map((result, index) => 
          (result.status === 'new' || result.status === 'updated') ? index : null
        )
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
      return { total: 0, new: 0, existing: 0, updated: 0, selected: 0 };
    }
    
    const newCourses = previewData.results.filter(r => r.status === 'new').length;
    const existing = previewData.results.filter(r => r.status === 'exists').length;
    const updated = previewData.results.filter(r => r.status === 'updated').length;
    const selected = previewData.results.filter((_, i) => selectedRows.has(i)).length;
    
    return {
      total: previewData.results.length,
      new: newCourses,
      existing,
      updated,
      selected,
    };
  }, [previewData, selectedRows]);
  
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!user || user.email !== "benn@modia.ai") {
    return <Redirect to="/dashboard" />;
  }
  
  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-6 w-6" />
            Update Course Bubble IDs from CSV
          </CardTitle>
          <CardDescription>
            Upload a CSV file to update bubble_unique_id for existing courses or create new courses if not found
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* CSV Format Info */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="space-y-2">
              <p className="font-semibold">Required CSV Format:</p>
              <div className="bg-muted p-2 rounded font-mono text-sm">
                course_number,bubble_unique_id
              </div>
              <p className="text-sm mt-2">
                • <strong>course_number:</strong> Course code (e.g., CPCU 500, AIDA 401, AINS 101)<br />
                • <strong>bubble_unique_id:</strong> Bubble unique identifier<br />
              </p>
              <p className="text-sm mt-2 text-blue-600 font-medium">
                ℹ️ For existing courses: Updates only the bubble_unique_id field<br />
                ℹ️ For new courses: Creates the course with the provided bubble_unique_id
              </p>
            </AlertDescription>
          </Alert>
          
          {/* File Upload Area */}
          {!previewData && (
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging 
                  ? 'border-primary bg-primary/5' 
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-lg mb-2">Drop your CSV file here, or click to browse</p>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
                id="csv-upload"
                data-testid="input-csv-upload"
              />
              <label htmlFor="csv-upload">
                <Button asChild variant="outline">
                  <span>Select CSV File</span>
                </Button>
              </label>
            </div>
          )}
          
          {/* File Info */}
          {file && (
            <Alert>
              <FileText className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>
                  <strong>File:</strong> {file.name} ({Math.round(file.size / 1024)} KB)
                </span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleReset}
                  data-testid="button-reset"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset
                </Button>
              </AlertDescription>
            </Alert>
          )}
          
          {/* Loading State */}
          {previewMutation.isPending && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Processing CSV...</span>
            </div>
          )}
          
          {/* Preview Table */}
          {previewData && (
            <div className="space-y-4">
              {/* Statistics */}
              <div className="grid grid-cols-5 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">{statistics.total}</div>
                    <p className="text-xs text-muted-foreground">Total Courses</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-green-600">{statistics.new}</div>
                    <p className="text-xs text-muted-foreground">New Courses</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-blue-600">{statistics.updated}</div>
                    <p className="text-xs text-muted-foreground">Updates</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-gray-600">{statistics.existing}</div>
                    <p className="text-xs text-muted-foreground">Unchanged</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-primary">{statistics.selected}</div>
                    <p className="text-xs text-muted-foreground">Selected</p>
                  </CardContent>
                </Card>
              </div>
              
              {/* Selection Controls */}
              <div className="flex gap-2 items-center">
                <Button 
                  onClick={selectAll} 
                  variant="outline" 
                  size="sm"
                  data-testid="button-select-all"
                >
                  Select All Changes
                </Button>
                <Button 
                  onClick={deselectAll} 
                  variant="outline" 
                  size="sm"
                  data-testid="button-deselect-all"
                >
                  Deselect All
                </Button>
                <span className="text-sm text-muted-foreground ml-auto">
                  {statistics.selected} of {statistics.new + statistics.updated} changes selected
                </span>
              </div>
              
              {/* Preview Table */}
              <ScrollArea className="h-[400px] border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">Select</TableHead>
                      <TableHead className="w-[100px]">Status</TableHead>
                      <TableHead>Course Number</TableHead>
                      <TableHead>New Bubble ID</TableHead>
                      <TableHead>Current Bubble ID</TableHead>
                      <TableHead>Changes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.results && previewData.results.map((result, index) => (
                      <TableRow 
                        key={index}
                        className={result.status === 'exists' ? 'opacity-50' : ''}
                      >
                        <TableCell>
                          <Checkbox
                            checked={selectedRows.has(index)}
                            onCheckedChange={() => toggleRowSelection(index)}
                            disabled={result.status === 'exists'}
                            data-testid={`checkbox-row-${index}`}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {result.status === 'new' ? (
                              <CheckCircle className="h-5 w-5 text-green-600" />
                            ) : result.status === 'updated' ? (
                              <AlertCircle className="h-5 w-5 text-blue-600" />
                            ) : (
                              <XCircle className="h-5 w-5 text-gray-400" />
                            )}
                            <span className="text-xs text-muted-foreground">
                              {result.status === 'new' ? 'New Course' : 
                               result.status === 'updated' ? 'Update' : 'No Change'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {result.row.courseNumber}
                        </TableCell>
                        <TableCell className="font-mono text-xs max-w-[200px]">
                          <div className="truncate" title={result.row.bubbleUniqueId}>
                            {result.row.bubbleUniqueId || '-'}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs max-w-[200px]">
                          <div className="truncate" title={result.currentCourse?.bubbleUniqueId || ''}>
                            {result.currentCourse?.bubbleUniqueId || '-'}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[250px]">
                          {result.changes && result.changes.length > 0 ? (
                            <ul className="text-xs space-y-1">
                              {result.changes.map((change, i) => (
                                <li key={i} className="text-blue-600">{change}</li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {result.status === 'exists' ? 'No changes' : result.status === 'new' ? 'Will be created' : '-'}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
              
              {/* Upload Controls */}
              <div className="flex justify-between items-center">
                <Button
                  onClick={handleReset}
                  variant="outline"
                  data-testid="button-cancel"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Start Over
                </Button>
                
                <Button
                  onClick={handleUpload}
                  disabled={statistics.selected === 0 || uploadMutation.isPending}
                  className="min-w-[150px]"
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
                      Upload {statistics.selected} {statistics.selected === 1 ? 'Course' : 'Courses'}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
          
          {/* Upload Result */}
          {uploadResult && (
            <Alert className={uploadResult.failed > 0 ? 'border-destructive' : 'border-green-600'}>
              <FileCheck className="h-4 w-4" />
              <AlertDescription>
                <p className="font-semibold mb-2">Upload Complete!</p>
                <div className="space-y-1">
                  <p>• Created: {uploadResult.created} new courses</p>
                  <p>• Updated: {uploadResult.updated} existing courses</p>
                  {uploadResult.failed > 0 && (
                    <p className="text-destructive">• Failed: {uploadResult.failed} courses</p>
                  )}
                </div>
                {uploadResult.errors && uploadResult.errors.length > 0 && (
                  <div className="mt-3 space-y-1">
                    <p className="font-semibold">Errors:</p>
                    {uploadResult.errors.map((error, i) => (
                      <p key={i} className="text-sm text-destructive">
                        Row {error.row}: {error.message}
                      </p>
                    ))}
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}