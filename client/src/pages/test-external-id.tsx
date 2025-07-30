import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

export function TestExternalId() {
  const [externalId, setExternalId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const testExternalId = async () => {
    if (!externalId.trim()) {
      setError('Please enter an external ID');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Test the external ID lookup
      const response = await fetch(`/api/test/external-id/${externalId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to test external ID');
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const testExamples = [
    { id: '8440', label: 'CPCU 555 (AI)', type: 'ai' },
    { id: '7656', label: 'CPCU 555 (Non-AI)', type: 'non-ai' },
    { id: '8433', label: 'CPCU 500 (AI)', type: 'ai' },
    { id: '7654', label: 'CPCU 500 (Non-AI)', type: 'non-ai' },
    { id: '6128', label: 'AIC 300 (AI)', type: 'ai' },
    { id: '8426', label: 'AIC 300 (Non-AI)', type: 'non-ai' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>External ID Mapping Test</CardTitle>
            <CardDescription>
              Test that both AI and non-AI external IDs resolve to the same course content
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Enter external ID (e.g., 8440 or 7656)"
                value={externalId}
                onChange={(e) => setExternalId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && testExternalId()}
              />
              <Button onClick={testExternalId} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  'Test ID'
                )}
              </Button>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-gray-600">Quick test examples:</p>
              <div className="grid grid-cols-2 gap-2">
                {testExamples.map((example) => (
                  <Button
                    key={example.id}
                    variant="outline"
                    size="sm"
                    className={example.type === 'ai' ? 'border-blue-300' : 'border-green-300'}
                    onClick={() => {
                      setExternalId(example.id);
                      setResult(null);
                      setError(null);
                    }}
                  >
                    {example.label} - {example.id}
                  </Button>
                ))}
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {result && (
              <div className="space-y-4">
                <Alert className="border-green-500">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <AlertDescription>
                    External ID <strong>{result.externalId}</strong> successfully resolved!
                  </AlertDescription>
                </Alert>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Course Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div>
                      <span className="font-semibold">Course:</span> {result.course.courseNumber} - {result.course.courseTitle}
                    </div>
                    <div>
                      <span className="font-semibold">Course ID:</span> {result.course.id}
                    </div>
                    <div>
                      <span className="font-semibold">Mapping Source:</span> {result.mappingSource || 'Direct (courses table)'}
                    </div>
                    <div>
                      <span className="font-semibold">Question Sets:</span> {result.questionSets.length}
                    </div>
                    <div>
                      <span className="font-semibold">Total Questions:</span> {result.totalQuestions}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">All External IDs for This Course</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-2">
                      {result.allExternalIds.map((mapping: any) => (
                        <div
                          key={mapping.externalId}
                          className={`p-2 rounded border ${
                            mapping.externalId === result.externalId
                              ? 'bg-blue-50 border-blue-300'
                              : 'bg-gray-50 border-gray-200'
                          }`}
                        >
                          <span className="font-mono">{mapping.externalId}</span>
                          <span className="text-sm text-gray-600 ml-2">({mapping.source})</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Launch URL Test</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 mb-2">
                      This is how users would access the course from Moodle:
                    </p>
                    <div className="bg-gray-100 p-3 rounded font-mono text-sm break-all">
                      {window.location.origin}/?courseId={result.externalId}&assignmentName=Practice_Test
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}