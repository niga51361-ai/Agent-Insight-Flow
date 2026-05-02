import { BaseTool } from "./base-tool";
import { z } from "zod";
import { getIntegration } from "@workspace/db";
import { Octokit } from "@octokit/rest";
import { logger } from "../../lib/logger";

export class GitHubTool extends BaseTool {
  name = "github-tool";
  description = "Manages GitHub repositories, files, and issues. Requires GitHub integration to be connected.";

  schema = z.object({
    action: z.enum(["create-repo", "list-repos", "get-file-content", "create-file", "update-file", "create-issue", "list-issues"]).describe("The GitHub action to perform."),
    repoName: z.string().optional().describe("The name of the repository. Required for most actions."),
    owner: z.string().optional().describe("The owner of the repository. Defaults to the authenticated user."),
    filePath: z.string().optional().describe("The path to the file in the repository. Required for file actions."),
    content: z.string().optional().describe("The content of the file. Required for create-file/update-file."),
    commitMessage: z.string().optional().describe("The commit message. Required for create-file/update-file."),
    issueTitle: z.string().optional().describe("The title of the issue. Required for create-issue."),
    issueBody: z.string().optional().describe("The body of the issue. Optional for create-issue."),
  });

  protected async onCall(input: z.infer<typeof this.schema>): Promise<any> {
    const { action, repoName, owner, filePath, content, commitMessage, issueTitle, issueBody } = input;
    const userId = this.userId;

    if (!userId) {
      return { error: "User ID not found for GitHub tool." };
    }

    const integration = await getIntegration(userId, "github");
    if (!integration || !integration.accessToken) {
      return { error: "GitHub integration not found or not connected." };
    }

    const octokit = new Octokit({
      auth: integration.accessToken,
    });

    try {
      switch (action) {
        case "create-repo":
          if (!repoName) return { error: "repoName is required to create a repository." };
          const createRepoResult = await octokit.repos.createForAuthenticatedUser({
            name: repoName,
            private: false, // Or true, based on desired default
          });
          return { success: true, repo: createRepoResult.data };

        case "list-repos":
          const listReposResult = await octokit.repos.listForAuthenticatedUser();
          return { success: true, repos: listReposResult.data.map(repo => ({ name: repo.name, owner: repo.owner?.login })) };

        case "get-file-content":
          if (!repoName || !owner || !filePath) return { error: "repoName, owner, and filePath are required to get file content." };
          const fileContentResult = await octokit.repos.getContent({
            owner,
            repo: repoName,
            path: filePath,
          });
          // @ts-ignore
          return { success: true, content: Buffer.from(fileContentResult.data.content, 'base64').toString('utf8') };

        case "create-file":
          if (!repoName || !owner || !filePath || !content || !commitMessage) return { error: "repoName, owner, filePath, content, and commitMessage are required to create a file." };
          const createFileResult = await octokit.repos.createOrUpdateFileContents({
            owner,
            repo: repoName,
            path: filePath,
            message: commitMessage,
            content: Buffer.from(content).toString('base64'),
          });
          return { success: true, file: createFileResult.data };

        case "update-file":
          if (!repoName || !owner || !filePath || !content || !commitMessage) return { error: "repoName, owner, filePath, content, and commitMessage are required to update a file." };
          const { data: { sha } } = await octokit.repos.getContent({
            owner,
            repo: repoName,
            path: filePath,
          });
          const updateFileResult = await octokit.repos.createOrUpdateFileContents({
            owner,
            repo: repoName,
            path: filePath,
            message: commitMessage,
            content: Buffer.from(content).toString('base64'),
            sha,
          });
          return { success: true, file: updateFileResult.data };

        case "create-issue":
          if (!repoName || !owner || !issueTitle) return { error: "repoName, owner, and issueTitle are required to create an issue." };
          const createIssueResult = await octokit.issues.create({
            owner,
            repo: repoName,
            title: issueTitle,
            body: issueBody,
          });
          return { success: true, issue: createIssueResult.data };

        case "list-issues":
          if (!repoName || !owner) return { error: "repoName and owner are required to list issues." };
          const listIssuesResult = await octokit.issues.listForRepo({
            owner,
            repo: repoName,
          });
          return { success: true, issues: listIssuesResult.data.map(issue => ({ title: issue.title, state: issue.state, url: issue.html_url })) };

        default:
          return { error: "Invalid GitHub action specified." };
      }
    } catch (e) {
      logger.error(`GitHub tool error for action ${action}:`, e);
      return { error: `GitHub tool failed for action ${action}. Details: ${e.message || e}` };
    }
  }
}
