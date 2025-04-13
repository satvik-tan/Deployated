#!/usr/bin/env node

import { Command } from 'commander';
import ora from 'ora';
import dotenv from 'dotenv';
import path from 'path';
import {detectFrameworkFromGitHub} from '../agent/detector/detect.js';
import { generateWorkflow } from '../agent/generator/workflowGen.js';
import { pushWorkflowToGitHub } from '../integrations/github.js';
import { createDeployer } from '../agent/deployer/deployer.js';
import { validateVercelCredentials, deployToVercel, getVercelDeploymentStatus } from '../integrations/vercel.js';
import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { analyzeProject } from '../integrations/gemini.js';
import inquirer from 'inquirer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
  .version('1.0.0');

// Add deploy command
program
  .command('deploy')
  .description('Deploy a project to a platform')
  .argument('<repo>', 'GitHub repository URL (e.g., github.com/username/repo)')
  .option('-d, --docker', 'Generate Docker deployment')
  .option('-c, --cloud <platform>', 'Generate cloud deployment (vercel/render)')
  .option('-p, --push', 'Auto-push to GitHub')
  .option('-y, --yes', 'Skip confirmations')
  .option('--vercel', 'Deploy to Vercel')
  .action(async (repoInput, options) => {
    const spinner = ora();
    
    try {
      // Validate GitHub URL
      if (!isValidGitHubUrl(repoInput)) {
        throw new Error('Invalid GitHub repository URL. Format should be: github.com/username/repo');
      }

      spinner.start('🔍 Analyzing GitHub repository...');
      const analysis = await analyzeProject(repoInput);
      const { owner, repo } = parseGitHubUrl(repoInput);
      
      // Extract framework from analysis
      const framework = analysis?.framework || 'unknown';
      const canDeployToVercel = analysis?.canDeployToVercel || false;
  
      spinner.succeed(`Detected ${framework} project`);

      // Display deployment capabilities
      if (canDeployToVercel) {
        spinner.info(`✅ This project can be deployed to Vercel`);
        if (analysis?.deploymentRequirements?.length > 0) {
          spinner.info(`📋 Deployment requirements: ${analysis.deploymentRequirements.join(', ')}`);
        }
        if (analysis?.specialConsiderations) {
          spinner.info(`ℹ️ ${analysis.specialConsiderations}`);
        }
      } else {
        spinner.warn(`⚠️ This project may not be suitable for Vercel deployment`);
        if (analysis?.specialConsiderations) {
          spinner.info(`ℹ️ ${analysis.specialConsiderations}`);
        }
      }
      
      spinner.start('⚙️ Generating workflow...');
  
      // Generate workflow
      const workflowContent = await generateWorkflow(repo, framework);
      
      if (!workflowContent) {
        throw new Error('Failed to generate workflow content');
      }
      
      spinner.succeed('✅ Workflow generated successfully');
      
      if (options.push) {
        spinner.start('📤 Pushing workflow to GitHub...');
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
      if (options.docker || options.cloud || options.vercel) {
        spinner.start('🚀 Setting up deployment...');
        try {
          const platform = options.vercel ? 'vercel' : (options.docker ? 'docker' : options.cloud);
          
          // Check if deployment is possible
          if (platform === 'vercel' && !canDeployToVercel) {
            spinner.warn('⚠️ This project may not be suitable for Vercel deployment');
            if (!options.yes) {
              const { proceed } = await inquirer.prompt([
                {
                  type: 'confirm',
                  name: 'proceed',
                  message: 'Do you want to proceed anyway?'
                }
              ]);
              if (!proceed) {
                spinner.info('Deployment cancelled');
                return;
              }
              spinner.start('🚀 Proceeding with deployment...');
            }
          }
          
          // Clone the repository to a temporary directory
          const tempDir = path.join(os.tmpdir(), `deployated-${repo}`);
          if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
          }
          fs.mkdirSync(tempDir);
          
          // Clone the repository
          execSync(`git clone https://github.com/${owner}/${repo}.git ${tempDir}`, { stdio: 'inherit' });

          // Change to the repository directory
          process.chdir(tempDir);
          
          const deployer = createDeployer(platform, owner, repo, framework);
          const result = await deployer.deploy();
          
          if (result.success) {
            spinner.succeed(`✅ ${result.message}`);
            if (result.url) {
              console.log(`\n🔗 Deployment URL: ${result.url}`);
            }
            if (result.nextSteps) {
              console.log('\n📋 Next Steps:');
              result.nextSteps.forEach((step, index) => {
                console.log(`${index + 1}. ${step}`);
              });
            }

            // Add environment variable guidance
            console.log('\n🔑 Environment Variables:');
            console.log('To add environment variables to your Vercel deployment:');
            console.log('1. Go to your project settings on Vercel dashboard');
            console.log('2. Navigate to the "Environment Variables" section');
            console.log('3. Add your variables in the format: KEY=value');
            console.log('4. Click "Save" to apply the changes');
            console.log('\n💡 Tip: You can also add environment variables using the Vercel CLI:');
            console.log('   vercel env add KEY');
          } else {
            spinner.fail(`Failed to set up deployment: ${result.message}`);
          }
          
          // Clean up
          process.chdir(process.cwd());
          fs.rmSync(tempDir, { recursive: true, force: true });
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