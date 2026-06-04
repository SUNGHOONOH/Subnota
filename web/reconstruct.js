const fs = require('fs');
const path = require('path');

const pagePath = path.join(__dirname, 'app/page.tsx');
let pageContent = fs.readFileSync(pagePath, 'utf8');

const logPath = '/Users/sunghoon/.gemini/antigravity/brain/fb9d02af-c6a3-4dfd-b25a-81cec7c2b90c/.system_generated/logs/transcript.jsonl';
const logLines = fs.readFileSync(logPath, 'utf8').split('\n');

console.log(`Initial page size: ${pageContent.length} chars`);

for (let i = 0; i < logLines.length; i++) {
  const line = logLines[i].trim();
  if (!line) continue;
  let step;
  try {
    step = JSON.parse(line);
  } catch (e) {
    console.error(`Error parsing line ${i+1}:`, e);
    continue;
  }

  const stepIndex = step.step_index;
  // Apply tools from step_index <= 316 (before the broken step 321)
  if (stepIndex > 316) continue;

  if (step.type === 'PLANNER_RESPONSE' && step.tool_calls) {
    for (const tool of step.tool_calls) {
      if (tool.name === 'replace_file_content' && tool.args.TargetFile && tool.args.TargetFile.endsWith('page.tsx')) {
        const { TargetContent, ReplacementContent } = tool.args;
        if (!TargetContent || !ReplacementContent) continue;
        console.log(`Applying replace_file_content at step ${stepIndex}`);
        if (!pageContent.includes(TargetContent)) {
          console.error(`Warning: TargetContent not found in page.tsx at step ${stepIndex}`);
          console.error(`TargetContent starts with: ${TargetContent.substring(0, 100).replace(/\n/g, '\\n')}`);
        } else {
          pageContent = pageContent.replace(TargetContent, ReplacementContent);
        }
      } else if (tool.name === 'multi_replace_file_content' && tool.args.TargetFile && tool.args.TargetFile.endsWith('page.tsx')) {
        const { ReplacementChunks } = tool.args;
        if (!ReplacementChunks) continue;
        console.log(`Applying multi_replace_file_content at step ${stepIndex}`);
        for (const chunk of ReplacementChunks) {
          const { TargetContent, ReplacementContent } = chunk;
          if (!pageContent.includes(TargetContent)) {
            console.error(`Warning: Chunk TargetContent not found in page.tsx at step ${stepIndex}`);
            console.error(`TargetContent starts with: ${TargetContent.substring(0, 100).replace(/\n/g, '\\n')}`);
          } else {
            pageContent = pageContent.replace(TargetContent, ReplacementContent);
          }
        }
      }
    }
  }
}

fs.writeFileSync(pagePath, pageContent, 'utf8');
console.log(`Reconstruction done. Final page size: ${pageContent.length} chars`);
