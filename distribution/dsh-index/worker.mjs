const PACKAGE = '@yiqizhuang/zhuangzai-dsh-workbench';
const HEADERS = { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*', 'cache-control': 'public, max-age=60' };
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: HEADERS });
export default {
  async fetch(request, env) {
    if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405, headers: { allow: 'GET, HEAD' } });
    const url = new URL(request.url);
    let path;
    try { path = decodeURIComponent(url.pathname); } catch { return json({ error: 'Invalid path' }, 400); }
    const base = url.origin;
    if (path === '/index.json' || path === '/registry/' + PACKAGE || path === '/registry/' + PACKAGE + '/') {
      const meta = await (await env.ASSETS.fetch(new URL('/files/release.json', url))).json();
      if (path === '/index.json') return json({
        format: 1, title: { en: 'YiQiZhuang plugins', zh: '一起装插件' },
        description: { en: 'YiQiZhuang delivery management tools', zh: '一起装交付管理工具' },
        plugins: [{ name: PACKAGE, title: { en: 'Zhuangzai Delivery Workbench', zh: '装仔交付管理工作台' },
          description: { en: 'Analyze construction delivery with YiQiZhuang', zh: '连接一起装，按管理场景查看工地、问题、人员与进度' },
          icon: '/files/zhuangzai-avatar.png', author: '一起装',
          versions: [meta, ...(meta.previous || [])].map(release => ({ version: release.version, publishTimestamp: release.publishTimestamp,
            source: { type: 'npm', registry: base + '/registry/' }, engines: { dsh: '>=0.2.2-rc.1 <0.3.0' } })) }]
      });
      const releases = [meta, ...(meta.previous || [])];
      const versions = Object.fromEntries(releases.map(release => [release.version, { ...release.manifest, dist: { tarball: base + '/files/' + release.filename, shasum: release.shasum, integrity: release.integrity } }]));
      return json({ name: PACKAGE, 'dist-tags': { latest: meta.version }, versions, time: Object.fromEntries(releases.map(release => [release.version, release.publishTime])) });
    }
    if (path === '/') return new Response('一起装 DeepSeek Harness 插件源。索引地址：' + base + '/index.json', { headers: { 'content-type': 'text/plain; charset=utf-8' } });
    if (path.startsWith('/files/')) return env.ASSETS.fetch(request);
    return json({ error: 'Not found' }, 404);
  }
};
