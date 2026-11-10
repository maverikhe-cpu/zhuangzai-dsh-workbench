# 装仔交付管理工作台 · DeepSeek Harness

![装仔](assets/zhuangzai-3d.png)

Zhuangzai Delivery Workbench — an MIT-licensed DSH plugin for construction delivery management with YiQiZhuang.

面向工程负责人、项目经理和客户成功人员：通过自然语言查询一起装数据，分析工地重点、问题、人员与派工、工期、验收、现场、设备、业主关注和管理报告。包含装仔角色、10 项技能及 OAuth 代理；不包含客户数据或账户凭据。

## 安装与登录

### 社区开源版 0.4.3

```sh
dsh plugin --profile desktop add 'git+https://github.com/maverikhe-cpu/zhuangzai-dsh-workbench.git#v0.4.3'
```

安装后按 DSH 提示启用插件或重启，再打开侧栏的「装仔工作台」。本版本基于已发布的 0.4.2，新增开源许可和社区分发资料，运行功能保持一致。

### 一起装索引版 0.4.2


本版适用于 DeepSeek Harness 桌面版 0.2.2-rc.1，需要 Node.js 22 或更高版本。打开「插件」，在实验性插件中启用「自定义插件索引」，进入「发现」，添加索引 `https://plugins.1qizhuang.win/index.json`，搜索「装仔」并安装。安装完成后如界面提示重启，请重启 DeepSeek Harness。

首次使用需要通过自己的账号授权一起装。macOS 桌面版打开终端，执行：

```sh
node "$HOME/.dsh/profiles/desktop/node_modules/@yiqizhuang/zhuangzai-dsh-workbench/connector/yqz-auth.mjs" login
```

在打开的页面登录一起装、选择公司并同意授权。如果浏览器没有自动打开，复制终端显示的授权链接打开。授权后打开左侧「装仔工作台」或新建会话并选择装仔预设。

本机已验证桌面版授权与查询；其他操作系统和首次授权流程需要分别验证。切换公司需要重新授权。

## 试用问题

- 今天哪些工地值得重点关注？
- 哪些问题需要跟进？按工地汇总。
- 哪些派工申请还缺人？
- 哪些工地实际阶段落后于计划？
- 哪些摄像头在线情况需要关注？
- 帮我整理一份上个月的工地管理汇报。

无需指定技能名。桌面侧栏选择「装仔工作台」，可以从综合关注、管理汇报和八个管理场景进入装仔对话，也可以输入自己的问题。选择问题后，可选择继续上一个打开的装仔会话，或新建会话；问题先进入输入框，修改确认后再发送。有未发送草稿时，新问题会追加在后面。继续会话前请确认公司一致；切换公司或话题时建议新建会话。桌面版已完成本机验证，其他平台与安装流程仍需验证。DSH 标准预设也包含文件与终端能力，用户应按自身环境配置权限策略。

## 节省用量

同一主题的追问可继续原会话，利用已有上下文；装仔会按问题选择技能，优先复用范围和时效仍适用的数据。已精简每次随请求加载的角色说明，保留主要管理口径。数据需要更新、分析范围变化或需要全量统计时仍会重新查询。实际 token 用量受历史长度、工具返回量及模型缓存影响，长会话并不一定更省；话题变化较大时可新建会话。

## 开发与测试

```sh
npm test
```

测试覆盖 OAuth 刷新、并发、失败恢复，以及工作台的场景入口、当前会话续聊、新建会话和草稿处理。OAuth 测试使用模拟响应和临时目录，不访问客户系统。

本仓库是可独立安装的 DSH bundle，入口为 `cordis.patch.yml`，客户端界面为 `lib/client.js`，场景技能位于 `presets/zhuangzai/skills/`。

## 社区市场

已提交 [DSH Market](https://github.com/2BingLing/dsh-market/issues/367) 和 [开放插件市场](https://github.com/polang233/dsh-plugin-index/issues/411) 收录申请，当前等待处理。可先通过上面的 Git 命令安装。详情见 [社区收录进度](COMMUNITY.md)。

## 许可

MIT，详见 [LICENSE](LICENSE)。一起装系统的数据访问需要用户自己的账号授权。
