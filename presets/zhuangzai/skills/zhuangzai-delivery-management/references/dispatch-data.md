# 派工数据与口径

每次以当前会话的实时工具说明和返回为准。跨工具关联优先使用 `applicationNo`、`projectId`、`workerId`；同一申请可以有多个工人或历史记录。申请 ID（applicationId）、申请编号（applicationNo）和派工记录 ID（recordId）不是同一字段，分别传给工具声明的参数。工具无可靠关联字段时，不凭姓名或地址相似强行匹配。

| 管理问题 | 工具与字段 | 使用方式 |
|---|---|---|
| 工地申请了多少人、还缺多少 | `list_dispatch_applications`：`applicationNo`、工地、`tags`、`requestedPeopleCount`、`dispatchedPeopleCount`、`entryDate`、`appliedAt`、`status` | 需求数≥1时，缺口=max(需求-已派,0)；已派人数包含待接单。申请状态 `dispatched` 是至少派出一人，不是一定配齐；已拒绝/撤销申请不纳入当前缺口。数据空或需求数为0不判配齐。 |
| 派了谁、是否接单与进离场 | `list_dispatch_records`：`applicationNo`、`workerId`、`acceptStatus`、`plan`、`actual`、`arrivalToday` | 一条记录对应一人一次派工；申请状态和人员状态不同。`pending/confirmed/started/finished/rejected/cancelled` 分别为待接单/已接单/已进场/已完工/已拒单/已取消；不要把取消记录当作有效人员。 |
| 按日期查看 | 两个工具的 `startDate/endDate` | 申请工具按申请提交日期筛选，工人记录工具按计划进场日期筛选；不是“计划开工日期筛选”或“期间在场”的通用筛选。要按计划开工找申请需取到可覆盖的申请范围后再筛 `entryDate`，无法保证覆盖时明确说明。 |
| 接单和取消时间 | 派工记录 `includeStatusTimes=true`、`confirmedAt`、`cancelledAt`（以实时定义为准） | 时间来自日志，样本精确到分钟；仅对小范围按需开启。时间缺失不代表一定没发生，也不能据此断言取消前未接单；待接单当前状态不证明其历史状态。接单响应时长还需可靠的派工时间，不能用申请时间冒充。 |
| 预估及施工面积 | `estimatedAreaSqm`、`settledAreaSqm`（以实时返回为准） | 前者是派工申请预估面积，记录中来自申请快照；后者为单条派工工人记录的施工/结算面积。单位㎡。没有可见值时不当作0。不要混同房屋面积。 |
| 实际进离场、今日到场 | `actual.startDate/endDate/days`、`arrivalToday` | 实际日期由人工维护；`actual.days` 是有现场识别记录的自然日去重数，不是日期差或工时。`arrivalToday` 缺失不等于未到场；它仅表示查询当天。 |
| 工人时间安排冲突 | `workerId`、`projectId`、计划进离场、接单状态 | 比较不同工地的计划区间，排除拒单、取消；稳定 ID 和区间完整时才列潜在重叠。筛选仅按计划进场日期时，期初之前进场仍未离场的记录可能遗漏。 |

已见工具每页最多 50 条，按实际 schema 请求；分页时检查返回数量、total、重复与缺页。申请 `dispatchedWorkers` 仅前 20 人，截断标识出现时不能用明细条数代替总人数。部门筛选的归属口径按当前工具描述及实际数据核对；当各工具范围不一致时不直接比较总量。

已派工不等于配齐：例如需求 3 人、已派 1 人的 `dispatched` 申请仍有 2 人缺口；仍须按人数比较，不能只按申请状态筛出待派工申请。

不同工地、不同工种的面积可能是不同施工内容或重复测量，不以面积除以人数推算人效，也不把预估面积默认理解为贴砖/刷墙工程量。客户需要面积分档时先约定使用的面积字段、缺失如何处理、每条记录的统计单位。

日志事件与可派工人名册的范围和限制见 [派工方法](dispatch.md)；工具不可用见 [回退表](tool-fallbacks.md)。
