# 月报模块与取数方向

只读本次所需模块的场景口径，不要求每家公司都有全部数据。成功空结果略过，查询失败按 [回退表](tool-fallbacks.md) 处理。

| 模块 | 优先工具 | 口径与展开 |
|---|---|---|
| 当前工地、人员负荷 | `get_project_load_summary`；必要时 `list_projects`、`get_project_detail` | 当前快照；按 [负荷](workload.md) 处理公司规则与部门范围 |
| 本期问题与整改 | `list_issue_records`，个案 `get_issue_detail` | [问题](issues.md) 区分发生/整改日期、六态、审核和申诉 |
| 整洁度与 AI 风险 | `list_tidiness_records`、`list_detection_records` | 按采集记录，未知单列；无完整检测分母不算违规率，多类型同一记录不当多个人 |
| 到场与线上巡检 | `list_sign_in_records`、`list_patrol_records` | 日期批量取数；[现场可视](visibility.md) 核对巡检 queryScope，次数不等于工时 |
| 当前设备规模与闲置 | `get_device_count_summary`，明细 `list_device_inventory` | 当前权限公司快照；[设备](devices.md) 中在线/离线均区分绑定口径 |
| 本期设备在线表现 | `list_device_online_rate` | period 在线秒数和/应在线秒数和；零分母单列，不平均比例 |
| 设备流转 | `list_device_binding_records`、`list_device_claim_records` | 绑定与领用分别分析，期间事件不代替当前在绑 |
| 派工供需与执行 | `get_dispatch_gap_summary`、`list_dispatch_applications`、`list_dispatch_records` | [派工](dispatch.md)：提交日/计划进场日分开，缺口逐单计算，已派含待接单 |
| 验收进展 | `list_acceptance_reports` | [验收](acceptance.md)：业主与审核两维；节点漏验用明确范围内 list_pending_acceptances |
| 工期变化 | `list_project_stage_progress`、`list_schedule_adjustments`、`list_work_stoppage_filings` | [进度](progress.md)：生效调整、预计停工与实际复工分开 |
| 业主关注 | `list_owner_viewing_records` | [业主](owner.md)：viewCount 求和，不用行数代替次数 |
| 重点现场例证 | `list_progress_updates`、`list_stage_detections`、`list_cameras` | 选少量重点，区分发布/识别/拍摄时间；图片与文字只作对应现场证据 |

分类或期间对比应覆盖同一范围。仅有差评数量上升不证明现场变差，需可比采集量；多日差评只有逐日连续证据才称连续。数据量、时间相关性和原因分别解释，不从数量相等或同时出现推断因果。
