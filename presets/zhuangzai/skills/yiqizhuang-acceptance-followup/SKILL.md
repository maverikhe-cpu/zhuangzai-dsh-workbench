---
name: yiqizhuang-acceptance-followup
description: 查询一起装线上验收、漏验节点、业主确认和审核流，适用于“哪些该验收了”“验收卡在哪里”“哪些检查项不合格”。
---

# 线上验收跟进

以当前授权公司和工地为范围，用 `list_acceptance_reports` 查报告列表；已确定的工地用 `list_pending_acceptances` 看节点是否漏验；具体报告按需查 `get_acceptance_report_detail` 和 `get_acceptance_approval_progress`。用户未指定工地时先用列表或有限候选定位，避免逐个遍历大量工地；统计须取完整分页并说明权限范围。

- 节点清单 `pending` 是已到验收时机但无已提交报告，`unfinished` 尚未到时机；`accepted` 只表示已有提交报告，不等于审核通过或业主同意。`hasAcceptancePlan=false` 表示未启用节点验收。draftCount 仅当前用户个人草稿，不代表公司草稿。
- 验收和审核是两套状态：业主待确认/同意/拒绝与审核待处理/通过/驳回各自展示。查待办应区分等待谁、当前轮次和状态，不把审核通过等同业主验收完成。
- 审核历史的提交、审核、驳回和重提交按轮次区分；终审字段未返回时不把旧轮审核通过当最终通过。审核角色不是确定的人，候选审核人不等于已处理人。
- 不合格检查项筛 `checkResult=unqualified`，逐项列名称、标准、备注和状态。验收明细及审核驳回照片的 photoId 只是引用，不是可直接打开的图片链接。
- 输出工地、节点/报告、当前状态、待办对象（能确认时）和下一步，区分数据为空、无权和调用失败；不改验收或审核结果。
