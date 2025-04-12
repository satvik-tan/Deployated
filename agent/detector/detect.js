const fs = require("fs");
const path = require("path");

function detectFramework(repoPath) {
    const files = fs.readdirSync(repoPath);
    const frameworks = {
        "nodejs": ["package.json"],
        "flask": ["requirements.txt", "app.py"],
        "django": ["manage.py"],
        "spring": ["pom.xml", "build.gradle"],
    };

    for (const [framework, indicators] of Object.entries(frameworks)) {
        if (indicators.some(file => files.includes(file))) {
            return framework;
        }
    }

    return "unknown";
}

module.exports = detectFramework;
