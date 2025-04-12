import { promises as fs } from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { parseGitHubUrl } from '../../utils/githubApi.js';
import { getRepoContents } from '../../utils/githubApi.js';

// Load .env file from the project root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export async function detectFrameworkFromGitHub(repoUrl) {
    try {
        const { owner, repo } = parseGitHubUrl(repoUrl);
        // Pass empty string as path to get root contents
        const files = await getRepoContents(owner, repo, '');
        
        const frameworks = {
        
            
            "node": ["package.json"],
            "flask": ["requirements.txt", "app.py"],
            "spring": ["pom.xml", "build.gradle"],
            "django": ["manage.py", "requirements.txt"]
        };
    
        for (const [framework, indicators] of Object.entries(frameworks)) {
            if (indicators.some(file => files.includes(file))) {
                return framework;
            }
        }
        
        return "unknown";
    } catch (error) {
        console.error('Error detecting framework:', error);
        throw new Error(`Failed to detect framework: ${error.message}`);
    }
}