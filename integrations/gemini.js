// integrations/gemini.js
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Base function to call Gemini API
async function callGemini(prompt, context = {}) {
  try {
    const response = await axios.post(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + GEMINI_API_KEY,
      {
        contents: [{ parts: [{ text: prompt }] }]
      }
    );

    return response.data.candidates?.[0]?.content?.parts?.[0]?.text;
  } catch (err) {
    console.error('⚠️ Gemini API call failed:', err.message);
    return null;
  }
}

// Helper function to extract JSON from markdown
function extractJsonFromMarkdown(text) {
  // Remove markdown code block syntax
  const jsonMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (jsonMatch) {
    return jsonMatch[1];
  }
  // If no code block, try to find JSON object directly
  const directMatch = text.match(/(\{[\s\S]*\})/);
  if (directMatch) {
    return directMatch[1];
  }
  return null;
}

// Helper function to extract YAML from markdown
function extractYamlFromMarkdown(text) {
  // Remove markdown code block syntax
  const yamlMatch = text.match(/```(?:yaml)?\s*([\s\S]*?)\s*```/);
  if (yamlMatch) {
    return yamlMatch[1];
  }
  // If no code block, try to find YAML content directly
  const directMatch = text.match(/^[\s\S]*?(?=\n\n|$)/);
  if (directMatch) {
    return directMatch[0];
  }
  return null;
}

// Analyze project structure and capabilities
export async function analyzeProject(files, techStack) {
  const prompt = `
You are an AI DevOps expert. Analyze this project and provide detailed insights:

Project files:
${Object.entries(files).map(([name, content]) => `--- ${name} ---\n${content}`).join('\n\n')}

Technology Stack: ${techStack}

Provide a detailed analysis in JSON format:
{
  "framework": "detected framework",
  "canDeployToVercel": boolean,
  "deploymentRequirements": ["list of requirements"],
  "specialConsiderations": "detailed explanation",
  "recommendedConfig": {
    "buildCommand": "recommended build command",
    "outputDirectory": "recommended output directory",
    "environmentVariables": ["list of required env vars"]
  },
  "potentialIssues": ["list of potential deployment issues"],
  "optimizationSuggestions": ["list of optimization suggestions"]
}

Return ONLY the JSON object, no markdown formatting or additional text.
`;

  const response = await callGemini(prompt);
  if (!response) return null;

  try {
    // Try to extract JSON from the response
    const jsonStr = extractJsonFromMarkdown(response);
    if (!jsonStr) {
      console.error('Failed to extract JSON from Gemini response');
      return null;
    }
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('Failed to parse Gemini response:', error);
    return null;
  }
}

// Generate deployment workflow
export async function generateWorkflowFromGemini(deploymentContext) {
  const { framework, platform, useDocker, files } = deploymentContext;
  
  const prompt = `
You are an AI DevOps expert. Generate a GitHub Actions workflow for deploying a ${framework} application.

Project Context:
- Framework: ${framework}
- Deployment Platform: ${platform}
- Using Docker: ${useDocker}

Project files:
${Object.entries(files).map(([name, content]) => `--- ${name} ---\n${content}`).join('\n\n')}

Generate a complete GitHub Actions workflow YAML that:
1. Detects and uses the correct framework (${framework})
2. Sets up the appropriate build environment
3. Installs dependencies
4. Builds the application
5. Deploys to ${platform}
6. Handles environment variables and secrets
7. Includes error handling and notifications

The workflow should be optimized for ${framework} and include:
- Proper caching for faster builds
- Framework-specific build commands
- Correct output directory configuration
- Appropriate environment setup
- Secure secret handling
- Deployment platform configuration

Return ONLY the raw YAML content for .github/workflows/deploy.yml, no markdown formatting or additional text.
`;

  const response = await callGemini(prompt);
  if (!response) return null;

  // Extract YAML from the response
  const yaml = extractYamlFromMarkdown(response);
  if (!yaml) {
    console.error('Failed to extract YAML from Gemini response');
    return null;
  }

  return yaml;
}

// Get deployment troubleshooting guidance
export async function getTroubleshootingGuidance(error, context) {
  const prompt = `
You are an AI DevOps expert. Help troubleshoot this deployment error:

Error: ${error}
Context: ${JSON.stringify(context, null, 2)}

Provide troubleshooting steps in JSON format:
{
  "errorType": "type of error",
  "possibleCauses": ["list of possible causes"],
  "troubleshootingSteps": ["step by step solutions"],
  "preventionTips": ["tips to prevent this in future"]
}

Return ONLY the JSON object, no markdown formatting or additional text.
`;

  const response = await callGemini(prompt);
  if (!response) return null;

  try {
    const jsonStr = extractJsonFromMarkdown(response);
    if (!jsonStr) {
      console.error('Failed to extract JSON from Gemini response');
      return null;
    }
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('Failed to parse Gemini response:', error);
    return null;
  }
}

// Get deployment optimization suggestions
export async function getOptimizationSuggestions(projectFiles, currentConfig) {
  const prompt = `
You are an AI DevOps expert. Analyze this project and suggest optimizations:

Project files:
${Object.entries(projectFiles).map(([name, content]) => `--- ${name} ---\n${content}`).join('\n\n')}

Current configuration:
${JSON.stringify(currentConfig, null, 2)}

Provide optimization suggestions in JSON format:
{
  "performanceOptimizations": ["list of performance improvements"],
  "costOptimizations": ["list of cost-saving suggestions"],
  "securityImprovements": ["list of security enhancements"],
  "bestPractices": ["list of recommended best practices"]
}

Return ONLY the JSON object, no markdown formatting or additional text.
`;

  const response = await callGemini(prompt);
  if (!response) return null;

  try {
    const jsonStr = extractJsonFromMarkdown(response);
    if (!jsonStr) {
      console.error('Failed to extract JSON from Gemini response');
      return null;
    }
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('Failed to parse Gemini response:', error);
    return null;
  }
}
