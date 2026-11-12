# 0.5.3

- 简单列表与字段查询走最短路径；不为公司名调用派工等跨模块汇总或扫描本地授权文件。
- 仅统计、分组和排名任务优先汇总；设备快照优先计数工具。
- 代理网络重试从 4 次降为 1 次，单次上限 30 秒、累计网络等待预算 45 秒；返回明确的重试耗尽信号，模型不再叠加重试。
- 增加断线恢复、持续失败、总预算到期三项隔离代理回归。

# 0.5.2

- 同步最新综合技能：自然语言触发、按需加载、公司数据隔离与公司独立统计口径。
- 工具缺失、授权失败和接口故障使用明确回退规则，避免重复尝试。
- 同步派工、验收、设备、问题、负荷和月报的分析与性能规则。

# 0.5.1

- 转义 OAuth 回调错误页中的错误代码及描述，避免将回调参数解释为 HTML。
- 增加包含 HTML 标签、引号和特殊字符的回归测试。

# 0.5.0

- 同步装仔综合技能，覆盖原有 10 类交付管理场景；原技能名保留为兼容入口，避免两套规则冲突。
- 派工优先服务端缺口汇总，支持按需返回段、TopN、日期缩窗与重点下钻。
- 项目经理负荷支持公司独立完工规则、finalStages、直属/子部门范围及状态冲突清单；不二次扣减已排除的工地。
- 增加公司设备台账方法，明确绑定设备在线/离线计数及期间时长在线率的区别。
- 同步验收、批量进度、问题、月报等场景的数据口径和大任务性能规则。
- 两份预设共用同一角色文本，按需读取场景资料；保持现有工作台、会话续聊、头像和授权方式。
- 增加派工计算、技能包装及发布索引测试，公开独立索引的构建与部署配置。

# Changelog

## 0.4.3 — 2026-11-10

- Publish the standalone plugin source under the MIT license.
- Add public repository metadata, searchable keywords and installation documentation.
- Include the existing mascot asset and isolated OAuth / workbench interaction regression tests.
- Runtime code, 10 skills and agent presets are unchanged from the public 0.4.2 download.
