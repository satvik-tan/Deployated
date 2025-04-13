// agent/generator/workflowGen.js

import fs from 'fs';
import path from 'path';
import { generateWorkflowFromGemini } from '../../integrations/gemini.js';

// Helper function to detect framework from package.json
function detectFrameworkFromPackageJson(packageJsonPath) {
  if (!fs.existsSync(packageJsonPath)) {
    return 'node';
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const dependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies
  };

  if (dependencies['next']) return 'nextjs';
  if (dependencies['express']) return 'node';
  if (dependencies['flask']) return 'flask';
  if (dependencies['spring-boot']) return 'springboot';

  return 'node';
}

export async function generateWorkflow(repoPath, techStack, options = {}) {
  try {
    const files = {};

    // Detect framework
    const packageJsonPath = path.join(repoPath, 'package.json');
    const framework = detectFrameworkFromPackageJson(packageJsonPath);

    // Collect relevant files for analysis
    if (fs.existsSync(packageJsonPath)) {
      files['package.json'] = fs.readFileSync(packageJsonPath, 'utf-8');
    }
    
    if (fs.existsSync(path.join(repoPath, 'requirements.txt'))) {
      files['requirements.txt'] = fs.readFileSync(path.join(repoPath, 'requirements.txt'), 'utf-8');
    }
    
    if (fs.existsSync(path.join(repoPath, 'pom.xml'))) {
      files['pom.xml'] = fs.readFileSync(path.join(repoPath, 'pom.xml'), 'utf-8');
    }

    // Add deployment options to the context
    const deploymentContext = {
      framework,
      platform: options.cloud || 'vercel',
      useDocker: options.docker || false,
      files
    };

    // Generate workflow using Gemini
    const workflow = await generateWorkflowFromGemini(deploymentContext);

    if (!workflow) {
      throw new Error('Failed to generate workflow from Gemini');
    }

    // Save workflow file
    const workflowPath = path.join(repoPath, '.github', 'workflows', 'deploy.yml');
    fs.mkdirSync(path.dirname(workflowPath), { recursive: true });
    fs.writeFileSync(workflowPath, workflow);

    console.log(`✅ Workflow generated for ${framework} project`);
    return workflow;
  } catch (error) {
    console.error('Failed to generate workflow:', error);
    throw error;
  }
}
