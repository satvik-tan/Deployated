import dotenv from 'dotenv';
import path from 'path';
import { validateVercelCredentials, deployToVercel, getVercelDeploymentStatus } from '../../integrations/vercel.js';

// Load .env file from the project root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export class BaseDeployer {
  constructor(owner, repo, framework) {
    this.owner = owner;
    this.repo = repo;
    this.framework = framework;
  }

  async deploy() {
    throw new Error('Deploy method must be implemented by subclass');
  }

  async validate() {
    throw new Error('Validate method must be implemented by subclass');
  }
}

export class VercelDeployer extends BaseDeployer {
  constructor(owner, repo, framework) {
    super(owner, repo, framework);
    console.log(`🔧 Initializing Vercel deployer for ${owner}/${repo}`);
  }

  async validate() {
    console.log('🔍 Validating Vercel deployment configuration...');
    return await validateVercelCredentials();
  }

  async deploy() {
    console.log('🚀 Starting Vercel deployment process...');
    
    const isValid = await this.validate();
    if (!isValid) {
      console.error('❌ Vercel validation failed. Please check your credentials.');
      return {
        success: false,
        message: 'Vercel validation failed'
      };
    }

    const deployment = await deployToVercel(this.owner, this.repo);
    if (!deployment.success) {
      console.error('❌ Vercel deployment failed');
      return deployment;
    }

    // Poll for deployment status
    console.log('⏳ Waiting for deployment to complete...');
    let status = null;
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      status = await getVercelDeploymentStatus(deployment.deploymentId);
      if (status && status.status === 'READY') {
        console.log('✅ Deployment completed successfully!');
        break;
      }
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds between checks
    }

    return {
      success: true,
      message: 'Vercel deployment completed',
      url: deployment.url,
      status: status?.status || 'UNKNOWN'
    };
  }
}

export class RenderDeployer extends BaseDeployer {
  constructor(owner, repo, framework) {
    super(owner, repo, framework);
    this.renderApiKey = process.env.RENDER_API_KEY;
    this.renderServiceId = process.env.RENDER_SERVICE_ID;
  }

  async validate() {
    if (!this.renderApiKey) {
      throw new Error('RENDER_API_KEY not found in .env file');
    }
    if (!this.renderServiceId) {
      throw new Error('RENDER_SERVICE_ID not found in .env file');
    }
    return true;
  }

  async deploy() {
    await this.validate();
    // Render deployment is handled by the GitHub Actions workflow
    return {
      success: true,
      message: 'Render deployment configured via GitHub Actions'
    };
  }
}

export class DockerDeployer extends BaseDeployer {
  constructor(owner, repo, framework) {
    super(owner, repo, framework);
    this.dockerUsername = process.env.DOCKER_USERNAME;
    this.dockerPassword = process.env.DOCKER_PASSWORD;
  }

  async validate() {
    if (!this.dockerUsername) {
      throw new Error('DOCKER_USERNAME not found in .env file');
    }
    if (!this.dockerPassword) {
      throw new Error('DOCKER_PASSWORD not found in .env file');
    }
    return true;
  }

  async deploy() {
    await this.validate();
    // Docker deployment is handled by the GitHub Actions workflow
    return {
      success: true,
      message: 'Docker deployment configured via GitHub Actions'
    };
  }
}

export function createDeployer(platform, owner, repo, framework) {
  switch (platform.toLowerCase()) {
    case 'vercel':
      return new VercelDeployer(owner, repo, framework);
    case 'render':
      return new RenderDeployer(owner, repo, framework);
    case 'docker':
      return new DockerDeployer(owner, repo, framework);
    default:
      throw new Error(`Unsupported deployment platform: ${platform}`);
  }
} 