#!/usr/bin/env node

import { Command } from 'commander';
import ora from 'ora';
import dotenv from 'dotenv';
import path from 'path';
import {detectFrameworkFromGitHub} from '../agent/detector/detect.js';
import { generateWorkflow } from '../agent/generator/workflowGen.js';
import { pushWorkflowToGitHub } from '../integrations/github.js';
import { createDeployer } from '../agent/deployer/deployer.js';

// Load .env file from the project root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Helper function to validate GitHub URL
function isValidGitHubUrl(url) {
  try {
    // Add https:// if not present
    if (!url.startsWith('http')) {
      url = 'https://' + url;
    }
    
    const githubUrlPattern = /^https:\/\/github\.com\/[\w-]+\/[\w-]+$/;
    return githubUrlPattern.test(url);
  } catch (error) {
    return false;
  }
}

// Helper function to parse GitHub URL
function parseGitHubUrl(url) {
  // Add https:// if not present
  if (!url.startsWith('http')) {
    url = 'https://' + url;
  }
  
  const parts = url.split('/');
  return {
    owner: parts[parts.length - 2],
    repo: parts[parts.length - 1]
  };
}

const program = new Command();

program
  .name('deployated')
  .description('AI-powered deployment workflow generator')
  .version('1.0.0')
  .argument('<path>', 'Path to your project')
  .option('-d, --docker', 'Generate Docker deployment')
  .option('-c, --cloud <platform>', 'Generate cloud deployment (vercel/render)')
  .option('-p, --push', 'Auto-push to GitHub')
  .option('-y, --yes', 'Skip confirmations')
  .action(async (repoInput, options) => {
    const spinner = ora();
    
    try {
      // Check for GitHub token
      if (!process.env.GITHUB_TOKEN) {
        spinner.fail('GitHub token not found. Please set GITHUB_TOKEN in your .env file');
        console.log('\nTo create a GitHub token:');
        console.log('1. Go to GitHub Settings > Developer settings > Personal access tokens');
        console.log('2. Generate a new token with "repo" scope');
        console.log('3. Add it to your .env file as GITHUB_TOKEN=your_token');
        process.exit(1);
      }
      
      // Validate GitHub URL
      if (!isValidGitHubUrl(repoInput)) {
        throw new Error('Invalid GitHub repository URL. Format should be: github.com/username/repo');
      }
  
      spinner.start('🔍 Analyzing GitHub repository...');
      const framework = await detectFrameworkFromGitHub(repoInput);
      const { owner, repo } = parseGitHubUrl(repoInput);
  
      spinner.succeed(`Detected ${framework} project`);
      spinner.start('⚙️ Generating workflow...');
  
      // Generate workflow
      const workflowContent = await generateWorkflow(repo, framework);
      
      if (!workflowContent) {
        throw new Error('Failed to generate workflow content');
      }
      
      spinner.succeed('✅ Workflow generated successfully');
      
      if (options.push) {
        spinner.start('📤 Pushing workflow to repository...');
        try {
          await pushWorkflowToGitHub(owner, repo, workflowContent);
          spinner.succeed('✅ Workflow pushed to GitHub');
        } catch (error) {
          spinner.fail(`Failed to push workflow: ${error.message}`);
          console.log('\nTroubleshooting tips:');
          console.log('1. Make sure the repository exists and you have access to it');
          console.log('2. Check that your GitHub token has the "repo" scope');
          console.log('3. Verify the repository name is correct');
          process.exit(1);
        }
      } else {
        spinner.info('ℹ️ Use --push flag to push the workflow to GitHub');
      }
      
      // Handle deployment if requested
      if (options.docker || options.cloud) {
        spinner.start('🚀 Setting up deployment...');
        try {
          const platform = options.docker ? 'docker' : options.cloud;
          const deployer = createDeployer(platform, owner, repo, framework);
          const result = await deployer.deploy();
          
          if (result.success) {
            spinner.succeed(`✅ ${result.message}`);
            
            // Print next steps based on platform
            console.log('\nNext steps:');
            if (platform === 'vercel') {
              console.log('1. Set up your Vercel project and get the project ID');
              console.log('2. Add VERCEL_TOKEN, VERCEL_ORG_ID, and VERCEL_PROJECT_ID to your GitHub repository secrets');
            } else if (platform === 'render') {
              console.log('1. Create a new service on Render');
              console.log('2. Add RENDER_API_KEY and RENDER_SERVICE_ID to your GitHub repository secrets');
            } else if (platform === 'docker') {
              console.log('1. Create a Docker Hub account if you don\'t have one');
              console.log('2. Add DOCKER_USERNAME and DOCKER_PASSWORD to your GitHub repository secrets');
            }
          } else {
            spinner.fail(`Failed to set up deployment: ${result.message}`);
          }
        } catch (error) {
          spinner.fail(`Failed to set up deployment: ${error.message}`);
          process.exit(1);
        }
      }
      
    } catch (error) {
      spinner.fail(`Failed: ${error.message}`);
      process.exit(1);
    }
  });

program.parse();