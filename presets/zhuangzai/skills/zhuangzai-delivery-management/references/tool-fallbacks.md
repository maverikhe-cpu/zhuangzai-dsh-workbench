# 工具可用性与回退

按当前任务读取对应行。以下短名称均在 2026-11-11 本次 Codex 的一起装工具清单中存在；不是 WorkBuddy 市场版本可用性证明。每次以目标宿主实际暴露的 schema 为准，不要求一次调用所有工具。

## 先判断失败类型

- 工具不在清单：若宿主有延迟发现能力，按该业务查找一次；仍没有则直接回退。不要向不存在的工具发请求，也不要反复要求重连。已知新版本可用时提示更新/刷新一次；用户完成后再检查。
- 401/授权失效：暂停此连接的查询，引导原连接重新授权一次；未完成前不改用其他工具绕过。403/无权、not_found：停止该对象，不猜 ID；可以继续已授权的其他对象或用户提供的文件。
- 参数错误：根据当前 schema 改正一次。新字段不受支持时，仅在能保持问题口径的情况下省略/本地筛选，否则换下表路径。
- 临时网络/服务异常：先检查错误是否表明代理已重试、retryable=false 或 retryExhausted=true；出现任一种就不在模型层重试，也不换业务模块探测连接。普通工具未做底层重试时，同参至多重试一次。超时且明确要求收窄时不原样重试；选择一个有界替代路径。替代路径再失败就停止；一个模块累计 3 次失败为硬上限，成功的小查询不能将失败计数清零。相同故障横跨多个工具时停止该连接剩余查询。
- 所有回退保持公司、权限、日期语义与统计分母。缩小范围只能给该范围的结果，不能静默把月报改成近一周、把全公司改成样本。大范围完整统计若预算不足，先交付已完成部分并给出明确续取方案。
- 无有效数据路径：改用用户已提供的同公司导出数据，或给出当前能完成的分析和所需数据；不自行登录其他系统、建代理、读凭据或无限重试。

## 按场景选择替代路径

| 目标 | 优先工具 | 不可用时做什么 |
|---|---|---|
| 工地定位、详情、入口 | `list_projects` → 重点 `get_project_detail` | 已有可靠 projectId 可直接查详情；详情失败时用列表可见字段回答。不拼造链接/经纬度；not_found 不换 ID 猜测。 |
| 项目经理负荷 | `get_project_load_summary` | 同范围 `list_projects` 分页后按已确认完工规则汇总。缺少节点冲突字段时只能给列表可算的负荷，不能声称精确复现汇总的冲突桶。 |
| 组织与团队 | `get_department_tree`、`list_department_members`；单工地 `get_project_team_members` | 人员底册缺失时只分析已查工地的负责人，不判断全部零负荷人员。团队工具缺失时只列已知负责人；不拿负责人列表冒充团队，不遍历全公司反查某成员。 |
| 派工缺口 | `get_dispatch_gap_summary` | 用 `list_dispatch_applications` 同范围完整分页，本地逐申请计算。计划进场日期筛选不能用申请提交日期替代；不能证明覆盖时不给全量缺口。 |
| 接单、进场、面积 | `list_dispatch_records` | 申请工具只可回答需求和已派人数；无法回答具体工人的接单/到场/结算面积时保留该缺项。 |
| 谁派单、何时操作 | `list_dispatch_event_logs` | 仅需接单/取消时间且记录工具支持时，对少量记录用 includeStatusTimes；不能由申请时间推派单时间，也不能从工地负责人猜派单人。 |
| 可派人选、请假与档期 | `list_dispatchable_workers` | 派工记录可显示已知安排冲突，但不覆盖无记录的工人，不输出“全公司可派名单”。 |
| 设备快照 | `get_device_count_summary` | `list_device_inventory` 按所需筛选取 total；需要交叉分布才取完整台账。快照工具不支持部门参数，部门问题直接用可准确限定范围的台账。 |
| 当前设备明细 | `list_device_inventory` | 已知工地可用 `list_cameras` 查看当前绑定设备；样本不代替公司全部资产。绑定历史不替代当前台账。 |
| 历史在线率 | `list_device_online_rate` | 当前在线快照不能替代期间时长在线率；只能交付当前状态或分析用户提供的期间数据。 |
| 领用和绑定流转 | `list_device_claim_records`、`list_device_binding_records` | 一类缺失只回答另一类；已解绑不等于已归还，当前台账不能重建完整历史。 |
| 未闭环/全量问题 | `list_issue_records` | 已知重点工地用 `list_issues`，个案用 `get_issue_detail`。四态列表不补得出六态分母，只给已查四态清单，不给全部未闭环数/全量闭环率。 |
| 验收报告统计 | `list_acceptance_reports` | 已知报告 ID 可用 `get_acceptance_report_detail`/`get_acceptance_approval_progress` 回答个案，不能构造公司总量。 |
| 漏验节点 | `list_pending_acceptances` | 报告列表只能跟进已提交报告；不能从中反推未提交节点或漏验总数。 |
| 验收检查项/审核过程 | `get_acceptance_report_detail`、`get_acceptance_approval_progress` | 使用列表中已有状态说明当前待办；不推断检查项、审核人或历史轮次。 |
| 阶段/节点/历史 | `list_project_stage_progress`、`list_plan_tasks`、`list_stage_history` | 缺批量对比时用列表/详情中的当前阶段与节点逾期线索，少量重点再查节点；没有计划就不计算阶段差，节点为空不等于没有配置。 |
| 停工与调整 | `list_work_stoppage_filings`、`list_schedule_adjustments` | 用已查状态描述停工/进度线索；没有报备或调整记录就不编原因、复工日或调整历史。 |
| 画面与施工动态 | `list_cameras`、`list_progress_updates`；入口 `get_project_detail` | 无图时用已有动态文字和系统入口；不造图。图片地址打开失败可重新取一次地址；仍失败保留入口与文字，不循环刷新。 |
| AI 阶段、整洁度、风险 | `list_stage_detections`、`list_tidiness_records`、`list_detection_records` | 可用人工动态作为另一来源的线索，不能冒充 AI 结果；缺对应明细则不计算该类识别率。 |
| 员工巡检、签到、业主观看 | `list_patrol_records`、`list_sign_in_records`、`list_owner_viewing_records` | 三种行为分别分析，不能相互补零或替代；巡检缺部门范围时只报告已确认范围。 |

## 如何交付部分结果

先给已完成结论，再用一条具体说明收尾。例如：“本月申请已查全，缺口主要集中在泥工；接单明细暂未取到，暂不判断实际进场。可先处理这三笔申请。”保留成功页、失败位置和查询条件供续取，不要求用户先懂工具名称。
