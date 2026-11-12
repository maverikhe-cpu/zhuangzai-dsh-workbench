# 设备运营

## 工作台首轮

当前离线关注：get_device_count_summary 取快照，再用 list_device_inventory(bound=true,online=false,page=1,pageSize=20)列候选，最多展示5台。不为此问题查询30天在线率、领用或绑定历史；需要持续离线时长且有最后上下线时间时直接计算。仅有明确历史分析需求才读期间工具，不把缺历史记录当作从未在线。

先分清当前台账、期间在线表现和设备流转。公司级少数计数优先 `get_device_count_summary`；明细或部门交叉分析用 `list_device_inventory`；单工地画面用 `list_cameras`；历史在线率与流转分别使用对应工具。缺失时按 [回退表](tool-fallbacks.md)。

## 当前快照

- 快照工具无筛选参数，覆盖当前权限公司范围。deviceNumber=actionDeviceNumber+unactionDeviceNumber=bindingDeviceNumber+unbindingDeviceNumber。
- onlineNumber/offlineNumber 是**已绑定工地**的在线/离线；unbindingOnlineNumber 是未绑定但在线。三项之和漏掉未绑定离线，不能当设备总量或在线率分母。
- unbindingProjectNumber 实际仍是未绑定的设备数；receivedNumber/bindingNumber 是别名，不重复相加。
- 台账按所需筛选取 total：claimed=false 未领用；claimed=true 已领用；claimed=true 且 bound=false 库外闲置；PC 在线/离线用 bound=true 与 online=true/false 组合。需要交叉分布时取完整台账一次本地分组，不重复请求各格总数。
- 筛选参数 online 与返回字段 isOnline 区分。未知在线/绑定值单列。只有确认无未知状态时，已绑定在线数加离线数才应等于已绑定总数；否则先单列差额并核查，不能强行视为一致或默认为离线。未激活不支持直接 status 过滤时取全后筛；设备状态、领用、绑定、在线是独立维度。
- ownerViewable 为绑定工地的业主直播开关，未绑定时缺键不等于 false；lastOnlineStatusChangedAt 为最近上下线时刻。型号不代表采购批次；在线未领用不证明设备可立即调拨。

## 当前在绑与历史

当前在绑用台账 bound=true，单工地用摄像头列表。绑定历史含多段，不能以“没有 unboundAt”判断在绑。确需从完整历史核对时，只取 isUnbound 严格为 false 的行、按稳定设备 ID 去重；缺值或多条当前段单列冲突。按绑定开始日期查某月会遗漏更早绑定至今的设备。

`list_device_binding_records` 是绑定/解绑；`list_device_claim_records` 只含领用/归还，不能互相替代。按日期批量获取后精确匹配设备 ID 或完整序列号，不逐设备查询。领用流水只有日精度、无独立 ID，不能推断同日先后或擅自删除同日重复事件；所查历史没后续绑定不证明当前库存/位置或已归还。

## 期间在线率与现场画面

`list_device_online_rate` 周期用 type=period，日趋势才用 day。总体在线率=匹配范围的在线秒数和/应在线秒数和；零分母单列，不平均百分比，不将 day 桶相加替代 period。分母是绑定区间与统计桶交集，报备回加可能使 100% 仍有离线秒数。

期间结果按设备绑定段返回，同设备可多行；按设备标识去重计算参与统计设备数，不能代替当前在绑数。在线率和 isOnline 快照不混用。

画面仅在 hasSnapshot=true 且有 coverImageUrl 时展示；没有抓拍时间只称最近一次抓拍，不称直播。异常先给设备/工地和可核对事实，再建议排查网络、电源或绑定；分散工地离线不排除共同故障。
