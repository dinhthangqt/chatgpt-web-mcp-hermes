import test from "node:test";
import assert from "node:assert/strict";
import { assertSuccessful, createGitRunner } from "../src/agent/git-runner.js";
function mock(results){const calls=[];return {calls,run:async(command,args)=>{calls.push([command,args]);return results.shift()||{code:0,stdout:"",stderr:""};}};}
test("git runner uses argv without shell and absolute cwd",async()=>{const m=mock([{code:0,stdout:"",stderr:""}]);const git=createGitRunner({cwd:"C:\\Work Space",processRunner:m.run,command:"git"});await git.status();assert.deepEqual(m.calls[0],["git",["status","--porcelain"]]);});
test("git helper rejects failed command",()=>assert.throws(()=>assertSuccessful({code:1,stderr:"failure"},"git test"),/git test failed/));
