export function parseTaskBody(body = "") {
  const task = { taskId: null, priority: null, baseSha: null, files: [], problem: "", acceptance: [], liveTest: false, notes: "" };
  let section = null;
  for (const raw of String(body).split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith("TASK-ID:")) { task.taskId = line.slice(8).trim(); section = null; continue; }
    if (line.startsWith("PRIORITY:")) { task.priority = line.slice(9).trim(); section = null; continue; }
    if (line.startsWith("BASE-SHA:")) { task.baseSha = line.slice(9).trim(); section = null; continue; }
    if (line === "FILES:") { section = "files"; continue; }
    if (line === "PROBLEM:") { section = "problem"; continue; }
    if (line === "ACCEPTANCE:") { section = "acceptance"; continue; }
    if (line === "NOTES:") { section = "notes"; continue; }
    if (line.startsWith("LIVE-TEST:")) { task.liveTest = ["true", "yes", "1"].includes(line.slice(10).trim().toLowerCase()); section = null; continue; }
    if (!line) continue;
    if (section === "files" && line.startsWith("-")) task.files.push(line.slice(1).trim());
    else if (section === "acceptance" && line.startsWith("-")) task.acceptance.push(line.slice(1).trim());
    else if (section === "problem") task.problem += `${task.problem ? "\n" : ""}${raw}`;
    else if (section === "notes") task.notes += `${task.notes ? "\n" : ""}${raw}`;
  }
  validateTask(task);
  return task;
}

export function validateTask(task) {
  if (!/^CWM-\d+$/.test(task.taskId || "")) throw new Error("Invalid TASK-ID");
  if (!["P0", "P1", "P2"].includes(task.priority)) throw new Error("Invalid PRIORITY");
  if (!/^[a-f0-9]{7,40}$/i.test(task.baseSha || "")) throw new Error("Invalid BASE-SHA");
  if (!task.problem.trim()) throw new Error("PROBLEM is required");
  if (!task.acceptance.length) throw new Error("ACCEPTANCE is required");
  if (task.files.some((file) => !file || file.includes("\0") || pathTraversal(file))) throw new Error("Invalid FILES path");
  return task;
}

function pathTraversal(file) {
  return file.startsWith("/") || /^[A-Za-z]:[\\/]/.test(file) || file.split(/[\\/]/).includes("..") || file.includes("&&") || file.includes(";");
}

export function branchForTask(taskId, slug = "") {
  if (!/^CWM-\d+$/.test(taskId || "")) throw new Error("Invalid TASK-ID");
  const suffix = slug.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  return `hermes/${taskId}${suffix ? `-${suffix}` : ""}`;
}
