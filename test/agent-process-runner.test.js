import test from "node:test";
import assert from "node:assert/strict";
import { runProcess } from "../src/agent/process-runner.js";
const node=process.execPath;
test("process runner returns success output",async()=>{const r=await runProcess(node,["-e","process.stdout.write('ok')"],{timeoutMs:5000});assert.equal(r.code,0);assert.equal(r.stdout,"ok");});
test("process runner returns nonzero",async()=>{const r=await runProcess(node,["-e","process.stderr.write('bad');process.exit(3)"],{timeoutMs:5000});assert.equal(r.code,3);assert.equal(r.stderr,"bad");});
test("process runner rejects timeout",async()=>{await assert.rejects(runProcess(node,["-e","setTimeout(()=>{},10000)"],{timeoutMs:50}),{code:"PROCESS_TIMEOUT"});});
test("process runner caps and redacts output",async()=>{const r=await runProcess(node,["-e","process.stdout.write('ghp_abcdefghijklmnopqrstuvwxyz')"],{timeoutMs:5000,outputCap:8});assert.equal(r.truncated,true);assert.match(r.stdout,/REDACTED|\[REDACTED\]/);});
