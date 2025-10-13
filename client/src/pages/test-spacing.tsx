import { HtmlLinkRenderer } from "@/components/html-link-renderer";

export default function TestSpacing() {
  // Sample content that demonstrates the spacing issue
  const testContent1 = `
<div>
<p><strong>Correct Answer:</strong> telematics</p>
<p><strong>Explanation:</strong> Telematics refers to the integrated use of telecommunications and informatics to transmit data wirelessly. In insurance, telematics devices collect driving data like speed, braking patterns, and mileage to help assess risk and process claims more accurately. This technology enables usage-based insurance and improves risk management.</p>
<p><strong>Source:</strong></p>
<ul>
<li><a href="https://example.com">Insurance Technology and Risk Management</a></li>
</ul>
</div>
  `.trim();

  const testContent2 = `
<div>
<p><strong>Benefits of Usage-Based Insurance:</strong></p>
<ul>
<li>More accurate premium pricing based on actual driving behavior</li>
<li>Encourages safer driving habits through feedback and incentives</li>
<li>Potential for significant premium discounts for safe drivers</li>
</ul>
<p><strong>Source:</strong></p>
<ul>
<li><a href="https://example.com/ubi-guide">UBI Implementation Guide</a></li>
<li><a href="https://example.com/telematics">Telematics in Modern Insurance</a></li>
</ul>
</div>
  `.trim();

  const testContent3 = `
<h3>Claims Processing Evolution</h3>
<p><strong>Traditional Method:</strong></p>
<ul>
<li>Manual inspection required</li>
<li>Paperwork-heavy process</li>
<li>Longer processing times</li>
</ul>
<p><strong>Modern AI-Powered Method:</strong></p>
<ul>
<li>Automated damage assessment</li>
<li>Digital documentation</li>
<li>Faster claim resolution</li>
</ul>
<p><strong>References:</strong></p>
<ul>
<li><a href="https://example.com">AI in Insurance Claims</a></li>
<li><a href="https://example.com">Digital Transformation Guide</a></li>
</ul>
  `.trim();

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold mb-8">HTML/Markdown Spacing Test</h1>
        
        <div className="text-sm text-muted-foreground mb-4">
          This page demonstrates the improved spacing between headers and lists in HTML content.
          The spacing has been optimized to reduce excessive white space after "Source:" and similar headers.
        </div>

        <div className="space-y-12">
          <div className="border rounded-lg p-6 bg-card">
            <h2 className="text-xl font-semibold mb-4">Example 1: Question Explanation with Source</h2>
            <div className="prose dark:prose-invert max-w-none">
              <HtmlLinkRenderer content={testContent1} />
            </div>
          </div>

          <div className="border rounded-lg p-6 bg-card">
            <h2 className="text-xl font-semibold mb-4">Example 2: List with Multiple Sources</h2>
            <div className="prose dark:prose-invert max-w-none">
              <HtmlLinkRenderer content={testContent2} />
            </div>
          </div>

          <div className="border rounded-lg p-6 bg-card">
            <h2 className="text-xl font-semibold mb-4">Example 3: Complex Structure</h2>
            <div className="prose dark:prose-invert max-w-none">
              <HtmlLinkRenderer content={testContent3} />
            </div>
          </div>
        </div>

        <div className="mt-8 p-4 bg-muted rounded-lg">
          <h3 className="font-semibold mb-2">What's been fixed:</h3>
          <ul className="list-disc ml-5 space-y-1">
            <li>Lists following headers like "Source:", "References:", etc. now have minimal top margin (0.5 spacing units)</li>
            <li>Paragraphs containing only bold headers have reduced bottom margin</li>
            <li>Normal lists maintain proper spacing when not following headers</li>
            <li>Overall more compact and readable layout</li>
          </ul>
        </div>
      </div>
    </div>
  );
}