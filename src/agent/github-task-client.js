import { AGENT_GH_COMMAND, AGENT_REPO } from "./config.js";
import { runProcess } from "./process-runner.js";

export function createGitHubTaskClient({ cwd, processRunner = runProcess, command = AGENT_GH_COMMAND, repo = AGENT_REPO } = {}) {
  const gh = (args, options = {}) => processRunner(command, args, { cwd, ...options });
  const json = async (args) => {
    const result = await gh(args);
    if (result.code !== 0) throw new Error(result.stderr || "gh command failed");
    return JSON.parse(result.stdout || "null");
  };
  return {
    async doctor() { return { version: await gh(["--version"]), auth: await gh(["auth", "status"]), }; },
    async findReadyTasks() { return json(["issue", "list", "--repo", repo, "--state", "open", "--label", "agent:hermes", "--label", "status:ready", "--json", "number,title,body,labels,url,createdAt"]); },
    async getIssue(number) { return json(["issue", "view", String(number), "--repo", repo, "--json", "number,title,body,labels,url,comments"]); },
    async editLabels(number, remove, add) { return gh(["issue", "edit", String(number), "--repo", repo, ...(remove ? ["--remove-label", remove] : []), ...(add ? ["--add-label", add] : [])]); },
    async comment(number, body) { return gh(["issue", "comment", String(number), "--repo", repo, "--body", body]); },
    async createPullRequest({ branch, title, bodyFile }) { return gh(["pr", "create", "--repo", repo, "--base", "master", "--head", branch, "--title", title, "--body-file", bodyFile]); },
    async findPullRequest(branch) { return json(["pr", "list", "--repo", repo, "--head", branch, "--json", "number,url,state,headRefName"]); },
  };
}
