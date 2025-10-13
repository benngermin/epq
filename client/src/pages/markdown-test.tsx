import { Card } from "@/components/ui/card";
import { StaticExplanation } from "@/components/static-explanation";

export default function MarkdownTestPage() {
  const testExplanations = [
    {
      title: "Test 1: Bold text with double asterisks",
      content: `**Correct Answer:** telematics

**Explanation:** Telematics refers to the integrated use of telecommunications and informatics to transmit data wirelessly. In insurance, telematics devices collect driving behavior data.

**Source:** Insurance Technology Guide 2024`
    },
    {
      title: "Test 2: Mixed formatting",
      content: `**Correct Answer:** $5,000

**Explanation:** As a claims adjuster, Maria should set the initial reserve at $5,000, which is her current best estimate based on available information. This follows standard claims handling practices where reserves are set at the most likely outcome amount.

**Key Points:**
- Initial reserves should reflect best estimates
- Reserves can be adjusted as new information becomes available
- Documentation is critical for reserve changes

**Source:** Claims Adjusting Best Practices Guide`
    },
    {
      title: "Test 3: Lists and formatting",
      content: `**Correct Answer:** Bad faith

**Explanation:** Bad-faith claims arise when an insurer's conduct deviates from accepted good-faith claims-handling standards. Examples include:

- Unjustified denial of coverage
- Failure to investigate thoroughly
- Unreasonable delays in payment

**Important:** Insurers must act in good faith when handling claims to avoid legal liability.

**Source:** Legal Guidelines for Claims Handling`
    }
  ];

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8">Markdown Rendering Test</h1>
      
      <div className="space-y-6">
        {testExplanations.map((test, index) => (
          <Card key={index} className="p-6">
            <h2 className="text-xl font-semibold mb-4">{test.title}</h2>
            <div className="border rounded-lg">
              <StaticExplanation
                explanation={test.content}
                questionVersionId={1000 + index}
              />
            </div>
          </Card>
        ))}
      </div>
      
      <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
        <h3 className="font-semibold mb-2">Expected Results:</h3>
        <ul className="list-disc list-inside space-y-1 text-sm">
          <li>Text between ** should appear as <strong>bold text</strong></li>
          <li>Section headers like "Correct Answer:", "Explanation:", and "Source:" should be bold</li>
          <li>Lists should be properly formatted with bullet points</li>
          <li>Paragraphs should have proper spacing</li>
        </ul>
      </div>
    </div>
  );
}