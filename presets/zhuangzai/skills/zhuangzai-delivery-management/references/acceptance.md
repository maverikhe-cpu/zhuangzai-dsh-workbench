# 线上验收跟进

## 工作台首轮

先查待业主确认或需内部跟进的报告，首批最多20份、输出最多5份；再对其中最多3个不同工地查待验节点。总计最多6次业务调用，不逐个检查所有报告对应工地。hasAcceptancePlan=false 时只表述该工地未启用节点验收计划，即使 pendingCount=0 也不能写“无漏验”或“内部验收动作全部完成”。acceptedCount 只写已提交报告数，不能当作审核或业主通过数；不能推广成公司未启用计划；未取全报告时只在已返回报告中排序，不称全公司等待最久；最多5个reportId，不将同工地多份报告合并后再额外凑5行。没有查全时不输出公司漏验总量。需审核细节时优先替代一个下钻名额，不叠加所有路径。

`list_acceptance_reports` 查报告及统计；`list_pending_acceptances` 查已确定工地的漏验节点；具体报告再读 `get_acceptance_report_detail` 和 `get_acceptance_approval_progress`。先批量定位，避免为全公司每份报告查详情。工具缺失时按 [回退表](tool-fallbacks.md)。

## 三类状态分开

- 节点 pending：已到验收时机但无已提交报告；unfinished：尚未到时机；accepted：已有提交报告，**不等于审核通过或业主同意**。hasAcceptancePlan=false 表示未启用节点验收，draftCount 仅当前用户个人草稿。
- 报告 acceptanceStatus 是业主维度（pending/agree/refuse）；approvalStatus 是内部审核维度。不要把同名 pending 跨字段混用，审核通过也不等于业主验收完成。
- 审核时间线按提交/驳回/重提交轮次读取；旧轮通过不代表新轮终审。审核角色、候选人和实际处理人区分。items=[] 只代表未返回审核记录，不能据此推断公司无审核流程或已终审。

## 日期与等待

现场验收日期、报告提交时间和终审通过时间分别使用 acceptanceStartDate/acceptanceEndDate、submitStartDate/submitEndDate、approvalStartDate/approvalEndDate（以实时 schema 为准）。只按某月提交筛选，描述“这批报告截至查询时的状态”，不代表全公司积压或当月闭环事件。

只有 submittedAt 时计算“提交距今天数”；业主等待时长需要本轮进入待业主确认状态的时间。没有期限、客户约定或明确超期字段时用“提交较久，建议优先跟进”，不判超期。

## 结果

完整列表按报告 ID 核对、按 projectId 和两维状态分组。全公司漏验需要节点覆盖，不能从已有报告反推；成本高时先交付明确范围的节点清单。不合格检查项用 checkResult=unqualified；photoId 是图片引用，不直接拼 URL。

给出工地、节点/报告、当前待办、已确认的处理对象和下一步；批量性能见 [性能](performance.md)。
