import fs from 'fs';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

// Load .env file from the project root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Get GitHub token from environment
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

if (!GITHUB_TOKEN) {
  throw new Error('GitHub token not found. Please set GITHUB_TOKEN in your .env file');
}

function saveWorkflowToFile(workflowYAML, filename = 'deploy.yml') {
  if (!workflowYAML) {
    throw new Error('Workflow content is undefined');
  }
  fs.writeFileSync(filename, workflowYAML, 'utf8');
  console.log('✅ Workflow file saved locally.');
}

function encodeFileToBase64(filePath) {
  const content = fs.readFileSync(filePath);
  return content.toString('base64');
}

// Check if repository exists and is accessible
async function validateRepository(owner, repo) {
  const url = `https://api.github.com/repos/${owner}/${repo}`;
  try {
    await axios.get(url, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Deployated-CLI'
      }
    });
    return true;
  } catch (err) {
    if (err.response && err.response.status === 404) {
      throw new Error(`Repository ${owner}/${repo} not found. Please check the repository name and make sure it exists.`);
    } else if (err.response && err.response.status === 401) {
      throw new Error('GitHub token is invalid or has insufficient permissions. Please check your token.');
    } else {
      throw new Error(`Failed to validate repository: ${err.message}`);
    }
  }
}

async function getExistingFileSha(owner, repo, path) {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  try {
    const res = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Deployated-CLI'
      }
    });
    return res.data.sha;
  } catch (err) {
    return null;
  }
}

export async function pushWorkflowToGitHub(owner, repo, workflowYAML) {
  if (!GITHUB_TOKEN) {
    throw new Error('GitHub token not found. Please set GITHUB_TOKEN in your .env file');
  }

  if (!workflowYAML) {
    throw new Error('Workflow content is undefined');
  }

  // Validate repository first
  await validateRepository(owner, repo);

  const REMOTE_PATH = '.github/workflows/deploy.yml';
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${REMOTE_PATH}`;
  
  // Check if this is a local repository
  const isLocalRepo = fs.existsSync('.git');
  
  // Only save locally if this is the current repository
  if (isLocalRepo) {
    saveWorkflowToFile(workflowYAML);
  }
  
  // Encode the workflow content directly to base64
  const content = Buffer.from(workflowYAML).toString('base64');
  const sha = await getExistingFileSha(owner, repo, REMOTE_PATH);

  const data = {
    message: 'Add deployment workflow',
    content,
    branch: 'main',
  };

  if (sha) data.sha = sha;

  try {
    const res = await axios.put(url, data, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Deployated-CLI'
      }
    });

    if ([200, 201].includes(res.status)) {
      console.log('🚀 Workflow pushed to GitHub!');
      // Clean up local file if it was created
      if (isLocalRepo && fs.existsSync('deploy.yml')) {
        fs.unlinkSync('deploy.yml');
      }
    } else {
      console.log('⚠️ Unexpected response:', res.status, res.data);
    }
  } catch (err) {
    if (err.response && err.response.status === 404) {
      throw new Error(`Failed to push workflow: Repository ${owner}/${repo} not found or you don't have access to it.`);
    } else if (err.response && err.response.status === 401) {
      throw new Error('Failed to push workflow: GitHub token is invalid or has insufficient permissions.');
    } else {
      console.error('❌ Error pushing workflow:', err.response?.data || err.message);
      throw err;
    }
  }
}

console.log("github repo")

