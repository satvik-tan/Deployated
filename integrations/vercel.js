import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { getFileContent } from '../utils/githubApi.js';
import readline from 'readline';

// Load .env file
dotenv.config();

async function ensureVercelCLI() {
  try {
    execSync('vercel --version', { stdio: 'ignore' });
  } catch (error) {
    console.log('📦 Installing Vercel CLI...');
    execSync('npm install -g vercel', { stdio: 'inherit' });
  }
}

async function ensureVercelLogin() {
  try {
    // Check if already logged in
    execSync('vercel whoami', { stdio: 'pipe' });
    return true;
  } catch (error) {
    // Not logged in, perform interactive login
    try {
      execSync('vercel login', { stdio: 'inherit' });
      return true;
    } catch (loginError) {
      throw new Error('Failed to log in to Vercel. Please try again.');
    }
  }
}

function detectFramework(projectPath) {
  // Check package.json
  const packageJsonPath = path.join(projectPath, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const dependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    };

    // Check for Next.js
    if (dependencies['next']) {
      return {
        framework: 'nextjs',
        buildCommand: 'next build',
        outputDirectory: '.next'
      };
    }

    // Check for Nuxt.js
    if (dependencies['nuxt']) {
      return {
        framework: 'nuxtjs',
        buildCommand: 'nuxt build',
        outputDirectory: '.nuxt'
      };
    }

    // Check for React
    if (dependencies['react']) {
      return {
        framework: 'react',
        buildCommand: 'npm run build',
        outputDirectory: 'build'
      };
    }

    // Check for Vue
    if (dependencies['vue']) {
      return {
        framework: 'vue',
        buildCommand: 'npm run build',
        outputDirectory: 'dist'
      };
    }

    // Check for Express/Node.js
    if (dependencies['express']) {
      return {
        framework: 'node',
        buildCommand: 'npm run build',
        outputDirectory: 'dist'
      };
    }
  }

  // Check for vercel.json
  const vercelJsonPath = path.join(projectPath, 'vercel.json');
  if (fs.existsSync(vercelJsonPath)) {
    const vercelConfig = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf8'));
    return {
      framework: vercelConfig.framework || 'node',
      buildCommand: vercelConfig.builds?.[0]?.config?.buildCommand || 'npm run build',
      outputDirectory: vercelConfig.builds?.[0]?.config?.outputDirectory || 'dist'
    };
  }

  return {
    framework: 'node',
    buildCommand: 'npm run build',
    outputDirectory: 'dist'
  };
}

async function configureVercelProject(projectPath, framework) {
  const vercelJsonPath = path.join(projectPath, 'vercel.json');
  const vercelConfig = {
    version: 2,
    framework: framework.framework,
    builds: [
      {
        src: 'package.json',
        use: '@vercel/node',
        config: {
          buildCommand: framework.buildCommand,
          outputDirectory: framework.outputDirectory
        }
      }
    ],
    routes: [
      {
        src: '/(.*)',
        dest: '/'
      }
    ]
  };

  fs.writeFileSync(vercelJsonPath, JSON.stringify(vercelConfig, null, 2));
  console.log('✅ Created vercel.json with framework configuration');
}

async function getVercelProjectDetails(projectPath) {
  try {
    // Detect framework and configure project
    const framework = detectFramework(projectPath);
    await configureVercelProject(projectPath, framework);

    // Link the project to Vercel
    console.log('🔗 Linking project to Vercel...');
    execSync('vercel link --yes', { 
      cwd: projectPath,
      stdio: 'inherit'
    });

    // Get project details from .vercel/project.json
    const projectJsonPath = path.join(projectPath, '.vercel', 'project.json');
    if (!fs.existsSync(projectJsonPath)) {
      throw new Error('Project not linked properly. Please run "vercel link" manually.');
    }

    const projectData = JSON.parse(fs.readFileSync(projectJsonPath, 'utf8'));
    
    // Get token from .vercel/auth.json
    const authJsonPath = path.join(process.cwd(), '.vercel', 'auth.json');
    if (!fs.existsSync(authJsonPath)) {
      throw new Error('Not logged in to Vercel. Please run "vercel login" manually.');
    }

    const authData = JSON.parse(fs.readFileSync(authJsonPath, 'utf8'));

    return {
      token: authData.token,
      orgId: projectData.orgId,
      projectId: projectData.projectId,
      framework: framework.framework
    };
  } catch (error) {
    console.error('Failed to get Vercel project details:', error.message);
    throw error;
  }
}

export async function validateVercelCredentials() {
  try {
    await ensureVercelCLI();
    const isLoggedIn = await ensureVercelLogin();
    return isLoggedIn;
  } catch (error) {
    console.error('Vercel validation failed:', error.message);
    return false;
  }
}

// Function to get deployment URL and dashboard link
export async function getVercelDeploymentInfo(owner, repo) {
  try {
    const projectName = repo.toLowerCase();
    return {
      deploymentUrl: `https://${projectName}.vercel.app`,
      dashboardUrl: `https://vercel.com/dashboard/${owner}/${projectName}`
    };
  } catch (error) {
    console.error('Failed to get deployment info:', error.message);
    return null;
  }
}

// Function to display environment variable setup instructions
export function displayEnvSetupInstructions(projectName, owner) {
  console.log('\n🔐 Environment Variables Setup');
  console.log('=============================');
  console.log('\nTo configure environment variables for your deployment:');
  
  console.log('\n1. Visit your Vercel Dashboard:');
  console.log(`   - Go to: https://vercel.com/dashboard/${owner}/${projectName}`);
  console.log('   - Select your project');
  console.log('   - Go to Settings > Environment Variables');
  console.log('   - Add your environment variables');
  
  console.log('\nRequired environment variables:');
  console.log('-----------------------------');
  console.log('- VERCEL_TOKEN: Your Vercel authentication token');
  console.log('- VERCEL_ORG_ID: Your Vercel organization ID');
  console.log('- VERCEL_PROJECT_ID: Your Vercel project ID');
  console.log('\nNote: Add any additional environment variables your application needs');
}

// Function to display deployment instructions
export function displayDeploymentInstructions(projectName, owner) {
  console.log('\n🎉 Deployment Successful!');
  console.log('=======================');
  console.log(`🔗 Your project is deployed at: https://${projectName}.vercel.app`);
  console.log(`📝 Dashboard: https://vercel.com/dashboard/${owner}/${projectName}`);
  
  console.log('\n📋 Next Steps:');
  console.log('1. Visit your Vercel dashboard to configure environment variables');
  console.log('2. Set up your project settings and domains');
  console.log('3. Monitor your deployment status');
  
  console.log('\n🔐 To add environment variables:');
  console.log('1. Go to your project settings in Vercel dashboard');
  console.log('2. Navigate to Environment Variables section');
  console.log('3. Add any variables your application needs');
}

// Function to extract environment variables from .env files
async function extractEnvVariables(owner, repo) {
  const envVars = {};
  
  try {
    // Try to get .env file
    const envContent = await getFileContent(owner, repo, '.env');
    if (envContent) {
      const envConfig = dotenv.parse(envContent);
      Object.assign(envVars, envConfig);
    }
  } catch (error) {
    // Ignore if .env doesn't exist
  }
  
  try {
    // Try to get .env.example file
    const envExampleContent = await getFileContent(owner, repo, '.env.example');
    if (envExampleContent) {
      const envExampleConfig = dotenv.parse(envExampleContent);
      // Only add variables that don't exist in .env
      Object.entries(envExampleConfig).forEach(([key, value]) => {
        if (!(key in envVars)) {
          envVars[key] = value;
        }
      });
    }
  } catch (error) {
    // Ignore if .env.example doesn't exist
  }
  
  return envVars;
}

// Function to prompt user for environment variables
export async function promptForEnvVariables(envVars = []) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const prompt = (question) => new Promise((resolve) => rl.question(question, resolve));
  
  const results = {};
  
  for (const envVar of envVars) {
    const value = await prompt(`Enter value for ${envVar} (press Enter to skip): `);
    if (value.trim()) {
      results[envVar] = value.trim();
    }
  }
  
  rl.close();
  return results;
}

// Function to create .env.vercel file
async function createVercelEnvFile(envVars) {
  const envContent = Object.entries(envVars)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  
  fs.writeFileSync('.env.vercel', envContent);
}

// Function to deploy to Vercel
export async function deployToVercel(owner, repo) {
  try {
    // Ensure Vercel login
    await ensureVercelLogin();
    
    // Extract environment variables
    const envVars = await extractEnvVariables(owner, repo);
    
    // Create .env.vercel file
    await createVercelEnvFile(envVars);
    
    // Link the project to Vercel
    execSync('vercel link --yes', { stdio: 'inherit' });
    
    // Deploy to Vercel
    execSync('vercel deploy --prod', { stdio: 'inherit' });
    
    // Get deployment URL
    const deploymentInfo = execSync('vercel ls --token ${VERCEL_TOKEN}', { encoding: 'utf8' });
    const urlMatch = deploymentInfo.match(/https:\/\/[^\s]+/);
    const deploymentUrl = urlMatch ? urlMatch[0] : null;
    
    if (!deploymentUrl) {
      throw new Error('Failed to get deployment URL');
    }
    
    // Clean up
    if (fs.existsSync('.env.vercel')) {
      fs.unlinkSync('.env.vercel');
    }
    
    return {
      success: true,
      message: `Successfully deployed to Vercel!`,
      url: deploymentUrl,
      nextSteps: [
        'Set up your environment variables in the Vercel dashboard',
        'Configure your domain in the Vercel dashboard',
        'Set up automatic deployments from your GitHub repository'
      ]
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to deploy to Vercel: ${error.message}`,
      error: error
    };
  }
}

// Function to check deployment status
export async function getVercelDeploymentStatus(deploymentUrl) {
  try {
    const deploymentInfo = execSync('vercel ls --token ${VERCEL_TOKEN}', { encoding: 'utf8' });
    const urlMatch = deploymentInfo.match(/https:\/\/[^\s]+/);
    
    if (!urlMatch || urlMatch[0] !== deploymentUrl) {
      return {
        success: false,
        message: 'Deployment not found'
      };
    }
    
    return {
      success: true,
      message: 'Deployment is live',
      url: deploymentUrl
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to get deployment status: ${error.message}`,
      error: error
    };
  }
}
