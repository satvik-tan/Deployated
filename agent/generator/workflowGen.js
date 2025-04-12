// agent/generator/workflowGen.js

import fs from 'fs';
import path from 'path';
import { generateWorkflowFromGemini } from '../../integrations/gemini.js';

const fallbackTemplates = {
  node: 'templates/node-template.yml',
  flask: 'templates/flask-template.yml',
  springboot: 'templates/springboot-template.yml',
};

export async function generateWorkflow(repoPath, techStack) {
  try {
    const files = {};

    // Collect relevant files (like package.json, etc.)
    if (techStack === 'node' && fs.existsSync(path.join(repoPath, 'package.json'))) {
      files['package.json'] = fs.readFileSync(path.join(repoPath, 'package.json'), 'utf-8');
    } else if (techStack === 'flask' && fs.existsSync(path.join(repoPath, 'requirements.txt'))) {
      files['requirements.txt'] = fs.readFileSync(path.join(repoPath, 'requirements.txt'), 'utf-8');
    } else if (techStack === 'springboot' && fs.existsSync(path.join(repoPath, 'pom.xml'))) {
      files['pom.xml'] = fs.readFileSync(path.join(repoPath, 'pom.xml'), 'utf-8');
    }

    // Send prompt to Gemini
    const generatedWorkflow = await generateWorkflowFromGemini(techStack, files);

    const workflowDir = path.join(repoPath, '.github', 'workflows');
    fs.mkdirSync(workflowDir, { recursive: true });

    const finalWorkflow = generatedWorkflow || fs.readFileSync(fallbackTemplates[techStack], 'utf-8');

    fs.writeFileSync(path.join(workflowDir, 'deploy.yml'), finalWorkflow);

    console.log(`✅ Workflow saved for ${techStack}`);
  } catch (err) {
    console.error('❌ Error generating workflow:', err);
  }
}
