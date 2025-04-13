import { promises as fs } from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { parseGitHubUrl } from '../../utils/githubApi.js';
import { getRepoContents, getFileContent } from '../../utils/githubApi.js';
import { analyzeProject } from '../../integrations/gemini.js';

// Load .env file from the project root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export async function detectFrameworkFromGitHub(repoUrl) {
    try {
        const { owner, repo } = parseGitHubUrl(repoUrl);
        
        // Get root contents
        const files = await getRepoContents(owner, repo, '');
        
        // Get contents of key files for analysis
        const contents = {};
        const keyFiles = [
            'package.json',
            'requirements.txt',
            'app.py',
            'manage.py',
            'pom.xml',
            'build.gradle',
            'index.html',
            'next.config.js',
            'vue.config.js',
            'angular.json',
            'composer.json',
            'Gemfile',
            'Cargo.toml',
            'go.mod',
            'Dockerfile',
            'docker-compose.yml',
            '.env.example',
            'vercel.json'
        ];

        for (const file of keyFiles) {
            if (files.includes(file)) {
                contents[file] = await getFileContent(owner, repo, file);
            }
        }

        // Use Gemini to analyze the project
        const analysis = await analyzeProject(contents, 'web');
        
        if (!analysis) {
            // Fallback to basic detection if Gemini analysis fails
            const frameworks = {
                "node": ["package.json"],
                "flask": ["requirements.txt", "app.py"],
                "spring": ["pom.xml", "build.gradle"],
                "django": ["manage.py", "requirements.txt"]
            };
        
            for (const [framework, indicators] of Object.entries(frameworks)) {
                if (indicators.some(file => files.includes(file))) {
                    return {
                        framework,
                        canDeployToVercel: true,
                        deploymentRequirements: [],
                        specialConsiderations: "Basic deployment setup",
                        recommendedConfig: {
                            buildCommand: "npm run build",
                            outputDirectory: "dist",
                            environmentVariables: []
                        },
                        potentialIssues: [],
                        optimizationSuggestions: []
                    };
                }
            }
            
            return {
                framework: "unknown",
                canDeployToVercel: false,
                deploymentRequirements: [],
                specialConsiderations: "Could not determine deployment capabilities",
                recommendedConfig: null,
                potentialIssues: ["Could not analyze project structure"],
                optimizationSuggestions: []
            };
        }

        return analysis;
    } catch (error) {
        console.error('Error detecting framework:', error);
        throw new Error(`Failed to detect framework: ${error.message}`);
    }
}