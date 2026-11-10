# 一起装插件索引

当前索引 `https://plugins.1qizhuang.win/index.json`，包注册表 `https://plugins.1qizhuang.win/registry/`。

发布顺序：

1. 修改根目录插件并提升 `package.json` 版本，运行 `npm test`。
2. 执行 `node distribution/dsh-index/build.mjs`。构建只打包根 package.json 的 files 白名单；旧 tarball 和校验值保留，不覆盖已发布版本。
3. 执行 `npx wrangler deploy --dry-run --config distribution/dsh-index/wrangler.jsonc`。
4. 授权发布后执行 `npx wrangler deploy --config distribution/dsh-index/wrangler.jsonc`。
5. 核对线上 index、registry 的 latest 与包 SHA-512，在隔离 DSH profile 安装新版本。

密钥由本机 Wrangler 管理，不写入仓库。本目录的 public 仅包含公开插件包、头像和版本元数据。
