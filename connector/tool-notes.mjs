// Add interpretation beside, never inside or instead of, original MCP data.
const PREFIX = '装仔取数口径：';
export function annotateToolResponse(request, response) {
  if (request?.method !== 'tools/call' || response?.error || response?.result?.isError) return response;
  const result = response?.result;
  if (!Array.isArray(result?.content) || result.content.some(c => c.type === 'text' && c.text?.startsWith(PREFIX))) return response;
  let data = result.structuredContent;
  if (!data || typeof data !== 'object') {
    for (const block of result.content) {
      if (block.type !== 'text') continue;
      try { data = JSON.parse(block.text); break; } catch { /* prose and media remain unchanged */ }
    }
  }
  if (!data || typeof data !== 'object') return response;
  const name = request.params?.name;
  const notes = [];
  if (name === 'list_pending_acceptances') {
    if (data.summary?.hasAcceptancePlan === false) notes.push('该工地未启用节点验收计划。pendingCount=0 不能判为“无漏验”，acceptedCount 只能表述已有提交报告数，不能说验收或内部审核全部完成。该结果只适用于本工地。');
    else notes.push('accepted 仅表示已有提交的报告，不代表内部终审通过或业主同意；两类审核状态需以报告实际字段为准。');
  }
  if (name === 'get_project_load_summary' && data.totals) notes.push('completedCount 是非冲突完工桶，不含 statusConflictCount；不能把 completedCount 称为全部人工完工标记数。statusConflictCount 是人工完工但计划节点未全完成的独立桶，不计入 loadProjectCount。loadProjectCount 含未开工、正常施工和停工，是当前快照。');
  if (name === 'list_acceptance_reports') notes.push('这是已提交报告清单，不覆盖尚未提交报告的验收节点。即使本次报告已取全，也不能据此判断无漏验、无明显漏验或全公司验收完整；只分析这些报告的状态与跟进事项。');
  if (['list_projects','list_issue_records','list_acceptance_reports','list_owner_viewing_records'].includes(name)
      && Array.isArray(data.items) && Number.isFinite(data.total) && data.total > data.items.length) {
    notes.push(`本页只返回 ${data.items.length} 条，筛选总数 total=${data.total}。total 可用于同口径计数，但本页不足以判断全量分布、全公司最早/最久/最多；排序和分析只覆盖已返回记录。`);
  }
  if (!notes.length) return response;
  return {...response, result: {...result, content: [...result.content, {type: 'text', text: PREFIX + notes.join('\n')}]}};
}
