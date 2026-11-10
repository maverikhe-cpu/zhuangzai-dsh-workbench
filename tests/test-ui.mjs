import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(here, '../lib/client.js'), 'utf8');
let client;
const hookValues = [];
let hookIndex = 0;
const fakeReact = {
  createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
  useRef: () => ({ current: null }),
  useEffect: () => {},
  useState: (initial) => {
    const index = hookIndex++;
    if (!(index in hookValues)) hookValues[index] = initial;
    return [hookValues[index], (value) => { hookValues[index] = value; }];
  },
};
vm.runInNewContext(source, { window: { __ModuleLoader__: { load: ({ factory }) => { client = factory((name) => {
  assert.equal(name, 'react');
  return fakeReact;
}); } } } });

const slots = new Map();
let session;
let selectedId = 'existing';
let draftResult = 'applied';
let draftCall;
let opened;
const summaries = { existing: { title: '工地分析', projectionValues: { agentPreset: 'zhuangzai' } }, other: { title: '其他会话', projectionValues: { agentPreset: 'other' } } };
const bindings = { existing: { sessionId: 'existing' }, other: { sessionId: 'other' } };
client.apply({
  slots: {
    inject: (_name, callback) => callback(),
    register: (definition, component) => slots.set(definition.name, { definition, component }),
  },
  uiWorkspace: {
    selection: { getSnapshot: () => ({ sessionId: selectedId }) },
    startSession: (_workspace, options) => { session = options; },
    openSession: (id) => { opened = id; },
  },
  sessions: { list: { getSnapshot: () => ({ byId: summaries }) }, binding: (id) => bindings[id] },
  conversation: { input: { requestDraftInitialization: (binding, options) => { draftCall = { binding, options }; return draftResult; } } },
});
assert.equal(slots.get('sidebar.panellist').definition.label, '装仔工作台');
const main = slots.get('main');
assert.equal(main.definition.key, 'zhuangzai-workbench');
const tree = main.component(main.definition.inject());
const walk = (node) => node && typeof node === 'object'
  ? [node, ...(node.children || []).flat(Infinity).flatMap(walk)] : [];
const nodes = walk(tree);
const avatar = nodes.find((node) => node.type === 'img' && node.props.alt === '装仔');
assert.ok(avatar);
const mascot = fs.readFileSync(path.join(here, '../assets/zhuangzai-3d.png')).toString('base64');
assert.equal(avatar.props.src, `data:image/png;base64,${mascot}`);
const cards = nodes.filter((node) => node.type === 'button' && node.props['aria-label']);
assert.equal(cards.length, 8);
const people = cards.find((node) => node.props['aria-label'] === '管人员');
assert.ok(people);
people.props.onClick();
hookIndex = 0;
const selectedNodes = walk(main.component(main.definition.inject()));
const dispatch = selectedNodes.find((node) => node.type === 'button' && node.props.className === 'zz-question' && node.children.some((child) => typeof child === 'string' && child.includes('派工申请')));
assert.ok(dispatch);
assert.ok(selectedNodes.some((node) => node.type === 'button' && node.props.className === 'zz-question' && node.children.some((child) => typeof child === 'string' && child.includes('项目经理'))));
const render = () => { hookIndex = 0; return walk(main.component(main.definition.inject())); };
const choice = (nodes, label) => nodes.find((node) => node.type === 'button' && walk(node).some((child) => child.children?.includes(label)));
dispatch.props.onClick();
let dialog = render();
assert.ok(dialog.some((node) => node.props.role === 'dialog'));
let continueButton = choice(dialog, '继续当前会话');
assert.equal(continueButton.props.disabled, false);
continueButton.props.onClick();
assert.equal(opened, 'existing');
assert.equal(draftCall.binding, bindings.existing);
assert.match(draftCall.options.prompt, /派工申请/);
assert.equal(draftCall.options.whenDraftExists, 'append');
assert.equal(session, undefined);

// A changed selection must never put text into a different session.
dispatch.props.onClick();
dialog = render();
selectedId = 'other';
choice(dialog, '继续当前会话').props.onClick();
assert.ok(render().some((node) => node.props.role === 'alert'));
assert.equal(opened, 'existing');
choice(render(), '新建会话').props.onClick();
assert.equal(session.agentPreset, 'zhuangzai');
assert.match(session.prompt, /派工申请/);
assert.equal(session.whenDraftExists, 'append');

// Other experts cannot be continued as 装仔.
dispatch.props.onClick();
dialog = render();
assert.equal(choice(dialog, '继续当前会话').props.disabled, true);
dialog.find((node) => node.props['aria-label'] === '关闭').props.onClick();
selectedId = 'existing';
draftResult = 'blocked';
dispatch.props.onClick();
choice(render(), '继续当前会话').props.onClick();
assert.ok(render().some((node) => node.props.role === 'alert'));
console.log('工作台会话选择、草稿保护及异常处理检查通过');
