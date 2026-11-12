import {test} from 'node:test';
import assert from 'node:assert/strict';
import {annotateToolResponse} from '../connector/tool-notes.mjs';
const request=name=>({method:'tools/call',params:{name}});
const response=data=>({jsonrpc:'2.0',id:1,result:{content:[{type:'text',text:JSON.stringify(data)}],structuredContent:data}});
test('disabled acceptance plans cannot be interpreted as zero missing acceptance',()=>{
 const raw=response({summary:{hasAcceptancePlan:false,pendingCount:0,acceptedCount:4}});
 const before=JSON.stringify(raw);const annotated=annotateToolResponse(request('list_pending_acceptances'),raw);
 assert.equal(JSON.stringify(raw),before);assert.equal(annotated.result.content[0],raw.result.content[0]);
 assert.equal(annotated.result.structuredContent,raw.result.structuredContent);
 assert.match(annotated.result.content[1].text,/不能判为“无漏验”/);
 assert.deepEqual(annotateToolResponse(request('list_pending_acceptances'),annotated),annotated);
});
test('reports already submitted do not imply review completion',()=>{
 const raw=response({summary:{hasAcceptancePlan:true,acceptedCount:2}});
 assert.match(annotateToolResponse(request('list_pending_acceptances'),raw).result.content[1].text,/不代表内部终审通过或业主同意/);
});
test('partial report pages preserve the total and restrict global ranking',()=>{
 const raw=response({items:[{reportId:'example'}],total:37});
 const a=annotateToolResponse(request('list_acceptance_reports'),raw);
 assert.match(a.result.content[1].text,/本页只返回 1 条/);assert.match(a.result.content[1].text,/total=37/);
 assert.equal(a.result.structuredContent.total,37);
});
test('errors, non-JSON results, unknown tools and full pages remain unchanged',()=>{
 for(const raw of [{error:{message:'failed'}},{result:{isError:true,content:[{type:'text',text:'error'}]}},{result:{content:[{type:'text',text:'prose'}]}},response({items:[{}],total:1})])
  assert.equal(annotateToolResponse(request('list_projects'),raw),raw);
 const raw=response({items:[],total:20});assert.equal(annotateToolResponse(request('unknown'),raw),raw);
});

test('complete reports still cannot establish node acceptance coverage',()=>{
 const raw=response({items:[{reportId:'example'}],total:1});
 const a=annotateToolResponse(request('list_acceptance_reports'),raw);
 assert.match(a.result.content[1].text,/即使本次报告已取全/);
 assert.equal(a.result.content[0].text,raw.result.content[0].text);
});

test('load summary keeps completed and conflicting buckets separate',()=>{
 const raw=response({totals:{completedCount:12,statusConflictCount:3,loadProjectCount:8}});
 const a=annotateToolResponse(request('get_project_load_summary'),raw);
 assert.match(a.result.content[1].text,/不含 statusConflictCount/);
 assert.match(a.result.content[1].text,/不计入 loadProjectCount/);
 assert.equal(a.result.structuredContent,raw.result.structuredContent);
 assert.equal(a.result.content[0],raw.result.content[0]);
});
