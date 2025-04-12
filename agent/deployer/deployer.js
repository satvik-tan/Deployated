import dotenv from 'dotenv';
import path from 'path';

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
    this.vercelToken = process.env.VERCEL_TOKEN;
    this.vercelOrgId = process.env.VERCEL_ORG_ID;
    this.vercelProjectId = process.env.VERCEL_PROJECT_ID;
  }

  async validate() {
    if (!this.vercelToken) {
      throw new Error('VERCEL_TOKEN not found in .env file');
    }
    if (!this.vercelOrgId) {
      throw new Error('VERCEL_ORG_ID not found in .env file');
    }
    if (!this.vercelProjectId) {
      throw new Error('VERCEL_PROJECT_ID not found in .env file');
    }
    return true;
  }

  async deploy() {
    await this.validate();
    // Vercel deployment is handled by the GitHub Actions workflow
    return {
      success: true,
      message: 'Vercel deployment configured via GitHub Actions'
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