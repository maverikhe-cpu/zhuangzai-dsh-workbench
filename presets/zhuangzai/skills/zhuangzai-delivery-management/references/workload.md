# 人员与工地负荷

当前工地数反映管理负荷的一部分，不等于工时、产值或绩效。先按 [公司口径](company-policy.md) 复用/确认规则，正常施工、未开工、停工分别呈现；当前快照不能反推历史某月负荷。

## 汇总优先

使用 `get_project_load_summary` 取得 totals 和完整 byManager/byDepartment/byStage；projects 只是分页明细，不从第一页重算全公司排名。公司只按人工完工时省略 finalStages；采用“人工完工 OR 指定阶段”时传已确认精确名单，不能传空数组。读取 completionRule；已按名单汇总后不能再扣一次阶段完工数。

companyStages 提供阶段选项；未约定时可先取一次默认概览供确认。已有约定直接使用，不重复问。工具缺失或无法表达规则时，按 [回退表](tool-fallbacks.md) 用同范围完整列表计算可支持的指标。

## 分母与范围

- loadProjectCount=未开工+正常施工+停工，后者含计划停工；若用户只问正常施工，不能把全部负荷改称施工中。
- statusConflictCount=人工完工但计划节点未全完成，单列不进负荷；不受 finalStages 变化影响。completedCount 不含这组冲突，不能当全部完工标记数。
- conflictOnly=true 切换 projects/projectsTotal 为冲突明细，总量与分组仍是原负荷。读 statusConflictReason；仅有列表状态而无节点字段时不能重建相同冲突桶。
- departmentId 默认直属，含下级同时传 includeDescendants=true；list_projects 的 departmentId 本身含下级。回退时须保持范围，不能把子树当直属。只看全权限时无需额外传根部门。
- 数据源未关联施工阶段/小区的工地可能不可见；对账需同源同范围。部门、人员独立分组不能推出部门×人员交叉表。

## 角色与建议

只看负责人排名不用先查全公司人员。需要岗位、零负荷人员时用 `get_department_tree` 和 `list_department_members` 取同范围在职底册，managerId 关联、按 ID 去重；managerRole 为返回字段，不是筛选参数。memberCount 不能当可见人员分母。

无负责人单列；byManager 没有零工地人员，不能据此找出全部空闲人员。只查部分工地时称“此范围内为零”。归属部门与人员所属部门区分，不把一个经理字段扩展成多人分摊。

单工地“谁是监理/谁参与”用 `get_project_team_members`：roleName 是公司自定义岗位，身份旗是另一体系；不猜映射。该工具不能按人反查全部参与工地，也不返回联系方式，不为反查成员而默认逐工地遍历全公司。

输出负责人、负荷数量、阶段/停工分布及重点事项；数量多不直接判超负荷，并列不硬排。问题风险需真实状态明细，issueCount 不能代替未闭环数。
