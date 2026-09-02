import test from "node:test";
import assert from "node:assert/strict";
import { formatDryRun, formatResultComment } from "../src/agent/task-report.js";
const task={taskId:"CWM-1",priority:"P1",baseSha:"0123456",problem:"problem",files:["src/a.js"],acceptance:["pass"],liveTest:false};
test("dry run report is explicit",()=>{const text=formatDryRun({number:12},task,"hermes/CWM-1");assert.match(text,/DRY_RUN/);assert.match(text,/hermes\/CWM-1/);});
test("result report contains evidence fields",()=>{const text=formatResultComment({task,worker:"HERMES-PC-01",branch:"hermes/CWM-1",headSha:"abc1234",tests:["npm test: PASS"],unknown:["CI"]});for(const value of ["CWM-1","hermes/CWM-1","abc1234","npm test: PASS","UNKNOWN:","CI"])assert.match(text,new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));});
