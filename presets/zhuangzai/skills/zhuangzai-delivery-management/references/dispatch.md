# 派工分析

## 工作台首轮

默认入口按本周计划进场日期查询，第一次 get_dispatch_gap_summary 就传 entryDateStart/entryDateEnd，include=[totals,byProject,byTrade]、groupTopN=5。用户说提交日期才使用 submittedStartDate/submittedEndDate；未指定时间的一般派工查询先选本周计划进场并说明，不先查全历史。合计最多6次业务调用，首轮不拉全部申请、记录或工人池。跨申请累计用人次，不能写成独立工人数；缺口逐申请正值求和，不能用全局需求减已派替代。

先区分用户要看缺口、人员安排、操作过程还是候选工人，再选择对应路径。范围和公司复用当前确认信息；派工人数、面积和日期定义按 [派工口径](dispatch-data.md)。工具缺失或失败统一按 [回退表](tool-fallbacks.md)，不另开连接或反复重建授权。

## 缺口：汇总优先

- 使用 `get_dispatch_gap_summary`，只要总量传 include=["totals"]；排名选对应分组并配 groupTopN。groupTopN 不能用于 totals-only。未请求的段不表示无数据；Top N 分组和不等于全量 totals。
- 提交日期用 submittedStartDate/submittedEndDate，计划进场日期用 entryDateStart/entryDateEnd，两者不同。核对 companyScope、effectiveFilters、queriedAt。大公司不要缺省查全历史；用户确实要全历史时，先判断成本和可完整覆盖的查询方式。
- pageSize 只控制 applications 明细，不降低服务端聚合范围。减少返回段也不保证消除全量取数成本。
- 汇总不可用时，同范围分页取 `list_dispatch_applications`，逐申请 gap=max(需求−已派,0) 后求和；排除 rejected/revoked，空或零需求单列。已派包含待接单，跨申请求和不是去重工人数。
- 完整分页可交给 `scripts/summarize_dispatch.py`，输入为 {"pages":[分页对象,...]}。仅使用本次同公司同范围结果。脚本拒绝缺页、重复 ID、页大小/total 不一致；needs_review>0 时有效行小计不能冒充全量服务端总数。不要为满足脚本而删除异常数据。

## 接单、进场与施工面积

`list_dispatch_records` 一行是一人一次派工。按 applicationNo 关联申请、workerId 关联工人；计划区间重叠且非取消/拒单时，列为潜在撞期。按计划进场日筛选会漏掉期初之前进场的人，不能冒充期间全部在场人员。

待接单不等于未进场；actual.days 是有现场识别记录的自然日数，arrivalToday 只代表今天，缺键不等于未到。预估面积与工人施工/结算面积并列，缺值不补零；不同工种/工人的面积可能重复，未确认业务口径不相加算人效。

## 谁派的、什么时候派的

优先对目标记录调用 `list_dispatch_event_logs(recordId=...)`。applicationId 查询混排该申请下多条记录的事件，返回行没有记录/工人 ID，不能将所有事件归到某个工人。操作人嵌在 description 文案里、没有稳定操作人 ID；申请自身提交/审批/拒绝不在该流水内。operatedAt 可能缺失，跨年解析需核对原文。

仅需接单/取消时间时，可对窄范围记录用 includeStatusTimes=true；每条记录额外查询日志，不对全量默认开启。响应耗时需要真实派工与接单时间，不能拿申请提交时间替代派单时间。

## 找可派人选

有 `list_dispatchable_workers` 时，按明确工种 tags 和计划区间 scheduleMatch 查候选；有工地 ID 可按 homeDistanceKm 参考距离。缺省 tags 只查“员工”子集，不是全公司工人池；需要其他工种逐个明确查询，重叠子工种按稳定工人 ID 去重。

scheduleMatch 是系统档期匹配结果，不代表工人已承诺接单；无可接单记录也可能被系统视为满足。recentSignIns 是历史按工地聚合，不是最近几天出勤。距离是直线距离，不是通勤时长。工人池缺少联系方式、班组和在职状态，不能推测。

## 交付

先回答缺口在哪里、哪些安排需协调，按需附工地/工种/日期/需求/已派/缺口或工人清单。调用失败不填零；部分范围不称全公司排名。取数和端到端成本按 [性能](performance.md) 记录。
