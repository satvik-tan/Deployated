// utils/githubApi.js
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

// Load .env file from the project root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

if (!GITHUB_TOKEN) {
  throw new Error('GitHub token not found. Please set GITHUB_TOKEN in your .env file');
}

export async function getRepoContents(owner, repo, path = '') {
  try {
    const response = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      {
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'Deployated-CLI'
        }
      }
    );
    return response.data.map(item => item.name);
  } catch (error) {
    if (error.response) {
      if (error.response.status === 404) {
        throw new Error(`Repository ${owner}/${repo} not found or is private`);
      } else if (error.response.status === 401) {
        throw new Error('GitHub token is invalid or has insufficient permissions');
      }
    }
    throw new Error(`Failed to fetch repository contents: ${error.message}`);
  }
}

export function parseGitHubUrl(url) {
  try {
    // Remove .git extension if present
    url = url.replace(/\.git$/, '');
    
    // Handle URLs with or without protocol
    if (!url.startsWith('http')) {
      url = 'https://' + url;
    }
    
    const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) {
      throw new Error('Invalid GitHub URL format');
    }
    
    return { 
      owner: match[1], 
      repo: match[2]
    };
  } catch (error) {
    throw new Error(`Invalid GitHub URL: ${error.message}`);
  }
}