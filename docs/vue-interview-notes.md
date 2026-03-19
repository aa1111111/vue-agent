<!-- markdownlint-disable MD022 MD032 MD005 MD007 MD012 -->
https://www.runoob.com/ai-agent/ai-agent-tutorial.html


> 目标：把“原理 + 实战 + 常见坑 + 可讲案例 + 追问”一次性串起来。  
> 用法：面试前按模块刷题；面试中用“结论 → 原理 → 场景 → 代码/实现 → 风险/边界 → 指标结果”结构输出。  
> 建议：每个模块准备 1 个你亲手做过的案例（带指标/结果），面试官更容易给高评价。

---

## Vue（必须能讲“原理 + 实战”）

### 响应式系统
- **高频问法**
  - “Vue2/3 响应式的区别是什么？为什么 Vue3 选 Proxy？”
  - “ref/reactive 有什么区别？什么时候用哪个？”
  - “为什么解构 reactive 会丢响应式？怎么修？”
- **参考回答（可背）**
  - **Q：Vue2/3 响应式区别？为什么 Vue3 选 Proxy？**
    - **结论**：Vue2 用 `Object.defineProperty` 劫持 getter/setter，Vue3 用 `Proxy` 拦截对象操作；Vue3 覆盖场景更全、实现更一致。
    - **原理**：
      - Vue2：只能拦截“已存在属性”的读写；新增/删除属性、数组下标等需要额外处理（`Vue.set`、数组方法重写）。
      - Vue3：`Proxy` 能拦截 `get/set/has/deleteProperty/ownKeys` 等，新增/删除/遍历都能统一处理。
    - **场景**：复杂表单（动态字段增删）、复杂列表（数组操作）、Map/Set 状态等，Vue3 更省心。
    - **追问收尾**：Vue3 的代价是需要现代浏览器环境，但工程上通常可接受。
  - **Q：ref vs reactive 怎么选？**
    - **结论**：基本类型优先 `ref`；对象要整体代理可用 `reactive`；需要被解构/传参时常用 `ref + 对象` 或 `toRefs(reactive)`。
    - **要点**：
      - `ref` 有 `.value`，模板会自动解包；适合单值状态/可替换整体对象（例如 `loading`、`input`）。
      - `reactive` 适合“一个对象里多字段联动”的场景（例如表单模型）。
    - **坑**：不要直接解构 `reactive`（会失去响应式）；要解构用 `toRefs`。
  - **Q：为什么解构 reactive 会丢响应式？怎么修？**
    - **结论**：解构拿到的是“普通值引用”，脱离了 Proxy；修复用 `toRefs`/`toRef` 或者保持对象不解构。
    - **一句话**：把“响应式对象”拆成“响应式引用”，而不是把它拆成普通变量。
- **Vue2：Object.defineProperty**
  - **局限**：不能直接监听新增/删除属性；数组下标/length 变化不易覆盖
  - **解决**：`Vue.set` / `Vue.delete`；数组方法重写（push/splice 等）
  - **核心链路（能说清即可）**：
    - getter 触发依赖收集：Dep 收集 Watcher
    - setter 触发通知：Dep notify → Watcher update → 组件重新渲染
- **Vue3：Proxy + Reflect**
  - **优势**：覆盖更全（新增/删除/数组/Map/Set 等更自然）
  - **ref vs reactive**
    - `ref`：包装基本类型/对象，`.value` 访问；模板自动 unref
    - `reactive`：只接收对象，返回 Proxy；解构会丢响应式（需 `toRefs`）
  - **常考点**：
    - 为什么 Vue3 更适合做大型状态管理/复杂表单：拦截能力更一致、更全面
    - 依赖追踪粒度更合理：effect 跟踪的是真正访问到的 key
  - **常见坑 & 话术**
    - “我会尽量避免把 reactive 对象直接解构；需要解构就 `toRefs`”
    - “需要可序列化/持久化时，注意 Proxy 不能直接 JSON 化，要取原始数据”

#### 更详细讲解（理解版本）

可以把每个响应式数据想成一个 **“偶像”**，组件/计算属性是“粉丝”：

- 模板里写 `{{ count }}`，这个组件就是 `count` 的粉丝。
- 当你 `count++`，Vue 会通知所有粉丝组件“我要变了，你们重渲染一下”。

不同的是：Vue2 和 Vue3 收集/通知方式不同。

##### Vue2：只盯“已有属性”的 getter/setter

核心是用 `Object.defineProperty` 包一层：

```js
function defineReactive(obj, key) {
  let value = obj[key]
  Object.defineProperty(obj, key, {
    get() {
      // 1. 收集依赖 —— 哪些 watcher / 组件在用这个 key
      track(key)
      return value
    },
    set(newVal) {
      if (newVal === value) return
      value = newVal
      // 2. 通知依赖 —— 这些 watcher 要重新跑一遍
      trigger(key)
    }
  })
}
```

只能在**定义属性的时候**做这件事，所以：

- 初始化时对现有的 key 调一遍 `defineReactive`；
- 后面新增的 key（`obj.b = 3`）就不会自动有 getter/setter。

这就是为什么 Vue2 要：

- 新增属性用 `Vue.set(obj, 'b', 3)`；
- 删除属性用 `Vue.delete(obj, 'b')`；
- 数组要重写 `push/splice` 等方法来触发更新。

##### Vue3：给整个对象套一层 Proxy

Vue3 不是逐个 key define，而是：

```js
const state = new Proxy(obj, {
  get(target, key, receiver) {
    track(target, key)               // 记录依赖
    return Reflect.get(target, key, receiver)
  },
  set(target, key, value, receiver) {
    const res = Reflect.set(target, key, value, receiver)
    trigger(target, key)             // 通知依赖
    return res
  },
  deleteProperty(target, key) {
    const res = Reflect.deleteProperty(target, key)
    trigger(target, key)
    return res
  }
})
```

这样不管你：

- 新增属性：`state.newKey = 1`
- 删除属性：`delete state.oldKey`
- 改数组下标：`state.arr[1] = 123`
- 遍历：`for (const k in state)`，`Object.keys(state)`

都能被 Proxy 拦截并触发 track/trigger，这就是“覆盖场景更全”的根本原因。

##### ref vs reactive：一个“盒子”和一个“外衣”

- `reactive(obj)`：给对象穿一件 Proxy 外衣 → 对象上每个 key 都是“可监听”的。
- `ref(value)`：给任何值（基础类型/对象）放到一个盒子 `{ value }` 里，对这个盒子的 `value` 做监听。

在模板里：

- `{{ count }}` 会自动当成 `count.value` 来用；
- `{{ state.a }}` 直接访问 Proxy 的属性。

因此：

- 基础类型/需要单值传参：更适合 `ref`；
- 表单模型/状态树：更适合 `reactive`。

##### 为什么解构 reactive 会丢响应式？

```js
const state = reactive({ a: 1, b: 2 })

// ❌ 直接解构
const { a } = state
// 现在 a 只是一个 number，不会再触发依赖收集/更新
```

原因：你拿到的是**Proxy 里当前值的拷贝**，之后 Proxy 再怎么变，已经和这个 `a` 无关了。

正确写法：

```js
const state = reactive({ a: 1, b: 2 })
const { a, b } = toRefs(state)  // a/b 是 ref，a.value 和 state.a 联动
```

**一句话记忆**：  
Vue3 是“给整个对象套 Proxy 外衣”；`reactive` 管对象，`ref` 管盒子；  
解构 reactive 要通过 `toRefs` 把每个字段变成独立的 `ref`，否则会丢响应式。

### 渲染与更新机制
- **高频问法**
  - “Vue 的更新为什么是异步的？nextTick 用来解决什么问题？”
  - “key 有什么用？什么时候必须用稳定 key？”
- **参考回答（可背）**
  - **Q：为什么更新是异步的？nextTick 解决什么？**
    - **结论**：Vue 会把同一轮事件循环内的多次状态变更“批处理合并”，减少重复渲染；`nextTick` 用来等 DOM 更新完成再执行依赖 DOM 的逻辑。
    - **场景**：消息列表“滚动到底部”、弹窗打开后测量高度、根据渲染结果定位光标。
    - **结合本项目**：你在流式时如果每个 delta 都立即操作 scrollTop，可能会抖/卡；通常会 `nextTick` 或用 rAF 节流滚动。
  - **Q：key 有什么用？什么时候必须稳定 key？**
    - **结论**：key 用来标识节点身份，帮助 diff 在重排时复用正确 DOM/组件实例。
    - **必须稳定 key 的场景**：
      - 列表会重排/插入/删除（拖拽排序、聊天消息新增）
      - 可编辑表格（输入框焦点/值不能串）
      - 动画列表（transition-group）
    - **坑**：用 index 当 key 只适合“不会重排”的静态列表；聊天消息最好用唯一 id。
- **Virtual DOM 与 diff**
  - **基本思路**：同层比较；通过 key 识别节点身份；最小化 DOM 操作
- **key 何时必须用**
  - 列表重排（拖拽排序）、可编辑表格（输入框不串行）、动画列表（transition-group）
- **批处理与 nextTick**
  - 更新是异步批处理；`nextTick` 等待 DOM 更新完成后再读写 DOM
  - 场景：滚动到底部、获取元素尺寸、依赖最新渲染结果的逻辑
  - **典型回答模板**
    - 结论：更新异步是为了批处理，减少重复渲染
    - 场景：读 DOM 尺寸/滚动到底部需要 DOM 已更新，所以用 nextTick
  - **常见追问**
    - “那 nextTick 是怎么实现的？”→ 本质是把回调放到微任务/任务队列里，等本轮渲染 flush 完

#### 更详细讲解（理解版本）

##### 为什么更新是异步批处理？

设想这段代码：

```js
state.count++
state.count++
state.count++
```

如果每次加 1 就立刻重新渲染一次，那一帧内就渲染 3 次，非常浪费。  
Vue 的做法是：

1. 标记“这个组件需要更新”（push 到一个队列）；  
2. 等当前同步代码都跑完（这一轮事件循环结束），再统一 flush 队列，只更新一遍 DOM。

所以你在代码里改 state 后，DOM 并不是“瞬间同步”的，而是“稍后一起改”。

##### 那 nextTick 在解决什么？

你项目里典型场景：**消息列表滚到底部**。

逻辑是：

```js
messages.value.push(newMsg)  // 改状态
await nextTick()             // 等 DOM 更新
const el = messagesEl.value
el.scrollTop = el.scrollHeight // 再滚动到底
```

如果不等 nextTick，`scrollHeight` 读到的是“旧高度”，会滚不到真正的底部。

总结成一句话：  
**凡是你要“依赖最新 DOM 状态”的操作（滚动、测量、focus），都应该放在 nextTick 之后。**

##### key 的真正用处：帮 diff 认得“谁是谁”

在列表重排场景（比如你这个聊天消息）里，`key` 是用来告诉 Vue：

> “这个节点虽然位置变了，但它还是那个老伙计，不要把 DOM/组件实例搞混。”

典型错误写法：

```vue
<div v-for="(msg, i) in messages" :key="i">
  {{ msg.content }}
</div>
```

插入/删除时，index 会整体变化，之前的第 1 项变成第 2 项，对应的 DOM/组件实例会被“错用”，比如：

- 输入框里的内容“跑到别的行”；
- 动画错乱；
- 组件内部缓存状态对不上。

正确写法（你项目已经这么做了）：

```vue
<template v-for="m in messages" :key="m.id">
  ...
</template>
```

使用稳定的唯一 `id`，无论如何插入/删除/重排，Vue 都能准确知道“这是哪个消息”。

### 组件模型
- **高频问法**
  - “props 为什么不能直接改？怎么设计 emit 让组件更好用？”
  - “插槽和作用域插槽你实际怎么用？举个封装例子”
- **参考回答（可背）**
  - **Q：props 为什么不能直接改？**
    - **结论**：props 是父组件状态的“单向数据流输入”，子组件改 props 会破坏数据源一致性，导致状态不可追踪。
    - **正确做法**：子组件用 emit 把意图抛给父组件，父组件改自己的 state 再下传；或子组件内部用本地 state 做“受控/半受控”。
  - **Q：emit 怎么设计更好用？**
    - **结论**：事件名要语义化、payload 要稳定、最好能兼容 v-model（`update:modelValue`）。
    - **例子**：输入组件 emit `send`（无 payload）或 emit `update:modelValue`（字符串）。
  - **Q：插槽/作用域插槽实战？**
    - **结论**：插槽用于“外部决定渲染”；作用域插槽用于“子组件提供数据，外部决定怎么渲染”。
    - **例子**：Table 把 row/column 作为 slot props 传出去；Dialog 把 footer 做成具名插槽。
- **props/emit**
  - props：默认值、校验、不可变（子组件不直接改 props）
  - emit：事件命名与 payload 结构稳定，便于维护
- **插槽**
  - 默认/具名/作用域插槽；slot props 用于“渲染权交给外部”
  - **实战封装**
    - Table：列配置 + 作用域插槽渲染单元格
    - Dialog：footer 具名插槽，外部决定按钮
- **provide/inject**
  - 场景：跨层传递（如 `copyText`、主题、权限、国际化）
  - 风险：隐式依赖（需要约定 key/类型）；注意可测试性
  - **面试加分话术**
    - “我会把 inject 的 key/类型集中管理（比如 symbols），避免魔法字符串”

#### 更详细讲解（理解版本）

##### 为什么 props 不能直接改？

可以把 props 理解成“**只读快照**”：

- 父组件有一份“真实数据源”：`const state = reactive({ name: '张三' })`
- 子组件只是拿到了某个时刻的视图：`<Child :name="state.name" />`

如果子组件直接：

```js
props.name = '李四' // ❌
```

就会出现 2 份“真相”：

- 父组件里的 `state.name` 还是 `'张三'`
- 子组件内部自己改成了 `'李四'`

此时：

- 父组件不知道 name 被改过，也不会触发联动逻辑；
- 其它依赖 `state.name` 的地方还是看到旧值，状态变得不可预期。

这就是“**单向数据流被破坏**”的问题，所以 Vue 在 dev 环境会直接给你 warning。

正确模式是：

1. 子组件通过 `emit('update:xxx')` 或自定义事件告诉父组件“我想改成 xxx”；  
2. 父组件修改自己的 state，再通过 props 把新值传给子组件。

你项目里的输入框/消息发送按钮，本质上也是这个模式。

##### emit 怎么设计才“好用”？

可以按这几个标准来想：

- **语义清晰**：看到事件名就知道“意图”是什么（`submit` / `confirm` / `search`）。
- **payload 稳定**：尽量是固定结构，避免“有时传字符串，有时传对象”。
- **支持 v-model**：通用输入类组件，优先支持 `modelValue` + `update:modelValue`。

以你项目里的 `ChatInput` 为例：

- 用 `defineModel()` 暴露一个 `v-model`，对外就是普通的 `v-model="input"`；
- 内部有一个 `send` 事件，不带复杂 payload，表示“用户按了 Enter 想发送”。

面试官问到时，可以直接说：

> “输入组件我一般会这样设计：  
>  - `v-model` 控制输入内容；  
>  - `@send` 控制“尝试提交”，是否真正发送由父组件根据 loading 等状态决定。”

##### 插槽 & 作用域插槽：谁负责“长相”，谁负责“数据”

一个简单记忆：

- **插槽（slot）**：子组件负责结构框架，父组件负责里面长什么样。
- **作用域插槽（scoped slot）**：子组件再多做一步——把“行数据/状态”作为 slot prop 传给父组件，让父组件既拿到“数据”，又决定“渲染方式”。

在你现在这个项目里，其实 ChatMessage 列表就可以做成类似“作用域插槽”的表格模式，例如：

```vue
<ChatMessages v-slot="{ message, index }">
  <MessageItem :message="message" :index="index" />
</ChatMessages>
```

虽然你当前没有这么做，但可以在面试时举“表格组件”的例子：

- Table 组件只负责：滚动、固定列、排序、分页；
- 单元格真正怎么渲染（高亮、点击、Tag、多行）交给插槽；
- 通过 slot props 把 `row` / `column` / `value` 传出去。

##### provide/inject：从“层层传 props”，升级到“跨层公共服务”

你项目里有一个很典型的例子：`copyText`。

如果不用 `provide/inject`：

- `App` 里定义 `copyText`
- `App -> ChatMessages -> MessageItem` 一层层 `:on-copy="copyText"` 传下去
- 中间所有组件都要知道“有复制这回事”，很容易变成“**道具效果传递**”

改成 `provide/inject` 之后：

- `App`：`provide('copyText', copyText)`  
- `MessageItem`：`const copyText = inject('copyText')`

中间的 `ChatMessages` 完全不用关心“复制”这个需求，职责清爽很多。  
你可以在面试里直接说：

> “跨层但又不是所有组件都关心的能力（比如复制、主题、权限、i18n），我会通过 provide/inject 暴露成‘服务’，而不是用 props 一层层传。”  

**风险点**顺口提一下就行：

- key 是字符串容易打错，所以可以集中到一个 `keys.ts` 里导出 `Symbol`；
- 测试时要记得在浅层 wrapper 上 `provide` 对应的依赖，不然子组件会拿不到。

### Composition API（Vue3 必考）
- **高频问法**
  - “watch 和 watchEffect 区别？什么时候选哪个？”
  - “composable 怎么抽？如何避免状态串台？”
- **参考回答（可背）**
  - **Q：watch vs watchEffect？**
    - **结论**：`watch` 依赖显式、可拿 old/new、适合精确副作用；`watchEffect` 自动收集依赖、适合快速联动，但要注意依赖漂移与清理。
    - **例子**：监听 route 参数变化用 watch；页面初始化一组联动请求可用 watchEffect。
  - **Q：composable 怎么抽？怎么避免状态串台？**
    - **结论**：把“业务流程”抽成 composable：输入依赖、输出状态+操作；每次调用生成独立状态（除非明确要共享）。
    - **避免串台**：
      - composable 内部不要用模块级可变变量存状态
      - 需要共享就用 store（Pinia）并明确生命周期/重置策略
    - **结合本项目**：流式逻辑可以抽成 `useStreamChat()`，返回 `start/stop/regenerate/isStreaming/error`。
- **computed**
  - 具备缓存；依赖不变不重新计算
- **watch vs watchEffect**
  - `watch`：明确依赖源，可拿到 new/old；适合副作用
  - `watchEffect`：自动收集依赖；适合快速联动；需要注意清理
- **composable 抽象**
  - 参数与返回值设计（把“可复用逻辑”做成函数）
  - 隔离状态：每次调用是否需要独立实例？是否应共享 store？
  - **推荐输出结构**
    - 输入：依赖（id、options、callbacks）
    - 输出：状态 + 操作函数（loading/error/data + reload/cancel）
    - 清理：onUnmounted 里取消订阅/中断请求
- **生命周期清理**
  - `onUnmounted` 清定时器/事件监听/订阅，避免内存泄漏

#### 更详细讲解（理解版本）

##### watch vs watchEffect：是你“告诉它看谁”，还是“它自己决定看谁”

可以这么记：

- `watch`：**显式依赖**。你告诉 Vue：“请你盯着这个 ref/computed/reactive 字段，一变就执行回调。”
- `watchEffect`：**自动依赖收集**。你写一段函数，里面用到哪些响应式数据，Vue 就自动帮你“订阅”它们。

对比下代码：

```js
// watch：我告诉你看谁
watch(
  () => route.query.id,
  (newId, oldId) => {
    fetchDetail(newId)
  }
)

// watchEffect：你自己看你需要谁
watchEffect(() => {
  const id = route.query.id
  fetchDetail(id)
})
```

**优缺点：**

- `watch`：
  - 优点：依赖清晰（面试官一眼看到你在看谁）、有 old/new 值；
  - 适合：精确监听某个字段/数组长度/布尔状态等。
- `watchEffect`：
  - 优点：写起来快，适合“临时把当前一堆依赖串起来”；
  - 风险：内部依赖一多、逻辑变复杂时，不好排查“到底是谁触发了这次执行”。

结合你项目可以举例：

- 想在“systemPrompt 或历史消息变化”时，把对话存到 `localStorage`，可以用 `watch` 明确写依赖；
- 想在“任意影响布局的状态改变”时自动滚动，可先快速用 `watchEffect` 写，然后根据实际情况再拆细。

##### composable 怎么抽，才能既复用又不串台？

一个通用模板：

```ts
function useXXX(deps) {
  // 1. 内部状态（ref/reactive）
  const loading = ref(false)
  const error = ref(null)
  const data = ref(null)

  // 2. 操作方法
  async function run() {
    loading.value = true
    try {
      // ... 依赖 deps 做事
    } finally {
      loading.value = false
    }
  }

  // 3. 生命周期清理（定时器、事件、请求等）
  onUnmounted(() => {
    // cleanup
  })

  // 4. 返回“状态 + 行为”
  return {
    loading,
    error,
    data,
    run
  }
}
```

你的流式聊天完全可以抽成一个 composable，例如伪代码：

```ts
function useStreamChat() {
  const messages = ref([])
  const loading = ref(false)
  const error = ref('')

  const controller = ref<AbortController | null>(null)

  async function send(userText: string) {
    // push user message + 占位 assistant
    // 调用 /api/chat/stream + 兜底 /api/chat
  }

  function stop() {
    controller.value?.abort()
  }

  onUnmounted(stop)

  return { messages, loading, error, send, stop }
}
```

**避免串台的关键点：**

- 不要在模块顶层放可变状态（比如 `let currentMessages = []`），否则多个组件共用一份；
- 每次调用 composable 都在函数内部 `const x = ref()`，这样每个组件拿到的状态是独立的；
- 只有在你“明确要做全局共享”的时候，才把状态放到 pinia 或单例模块。

你可以在面试里说：

> “我一般会把和‘某一块业务流程强相关’的状态和操作封装成 composable，比如这次项目我就可以把‘流式聊天 + 兜底 + 停止/重试’抽成一个 `useAgentChat`，组件只关心 UI 和交互，逻辑都在 composable 里。”

##### 生命周期与清理：为什么一定要在 onUnmounted 里关资源？

一个非常典型的坑：

```js
onMounted(() => {
  const timer = setInterval(poll, 3000)
})
```

如果你不在 `onUnmounted` 里 `clearInterval(timer)`，这个组件卸载后定时器还在跑：

- 多次进入/离开页面，定时器会叠加越来越多；
- 甚至页面上已经没有这个组件了，它还在偷偷发请求。

你项目里用到的 `AbortController` 也是同理：

- 组件销毁时，如果有正在进行的 SSE 请求，要 `abort()` 掉；
- 否则：后台还在推流/占用连接，但用户已经看不到了。

这部分可以配合“稳定性/内存泄漏”的问题一起讲，会显得你对工程细节比较上心。

### 指令与高级能力
- **高频问法**
  - “你写过哪些自定义指令？怎么做权限/节流点击？”
- **参考回答（可背）**
  - **Q：自定义指令一般怎么写？**
    - **结论**：指令适合“直接操作 DOM 的通用能力”，比如聚焦、权限、拖拽、节流点击。
    - **权限指令**：在 `mounted` 判断是否有权限，无权限就移除/隐藏节点；注意与路由/按钮权限策略一致。
    - **节流点击**：在指令里包一层 throttle，防重复提交。
- **自定义指令**
  - 聚焦、权限控制、拖拽、节流点击
- **Teleport / Suspense / KeepAlive**
  - Teleport：弹窗挂载到 body 解决层级与溢出
  - KeepAlive：缓存策略，include/exclude；缓存下的状态重置策略
  - **KeepAlive 追问点**
    - 缓存了组件但数据要刷新：进入激活钩子 `onActivated` 做刷新

### 常见坑
- watch 深度与性能（deep watch 大对象代价高）
- 解构 reactive 丢响应式（需 `toRefs`）
- 列表 key 不稳定导致 DOM/状态错乱
- 频繁创建匿名函数导致不必要更新（props 不稳定）
 - v-html 风险（XSS），需要转义或白名单渲染

---

## 路由（权限体系几乎必问）

### Vue Router
- **高频问法**
  - “Hash/History 区别？上线要注意什么？”
  - “鉴权怎么做？动态路由怎么注入？”
- **参考回答（可背）**
  - **Q：Hash vs History？**
    - **结论**：Hash 部署简单不依赖后端；History URL 更干净但需要服务器把 404 回源到 index.html。
    - **上线注意**：History 模式要配 Nginx/网关 rewrite；否则刷新/直达会 404。
  - **Q：鉴权与动态路由怎么做？**
    - **结论**：登录拿 token/权限点；beforeEach 校验 token；根据权限点动态 addRoute；无权限跳 403 或重定向。
    - **工程细节**：动态路由要避免重复注入；权限变更需要清理并重建路由表。
- **Hash vs History**
  - Hash：部署简单；History：URL 更干净但需要服务器配合 404 回源
- **动态路由/路由守卫**
  - beforeEach 鉴权、角色控制；afterEach 打点/标题
- **缓存与滚动**
  - 滚动恢复、页面缓存策略（keep-alive + route meta）
- **多页签系统**
  - tabs 数据结构、缓存、刷新与关闭策略
  - **落地要点**
    - tabs = 路由快照（path/query/meta）+ keep-alive include 列表
    - 关闭 tab：如果正在 keep-alive，考虑清理对应缓存标记

#### 更详细讲解（理解版本）

##### Hash vs History：为什么线上老是“本地没问题，一上服务器就 404”？

记一个最常见的线上坑：**History 模式没配 rewrite**。

- **Hash 模式**：  
  URL 像 `https://a.com/#/user/list`  
  `#` 之后都是前端的事，后端只会收到 `/`，所以你把 `index.html` 放在根目录就行，不需要额外配置。

- **History 模式**：  
  URL 像 `https://a.com/user/list`  
  用户直接刷新、或者从浏览器收藏夹点进 `/user/list`，**服务端会真的收到这个路径**。

如果服务端（Nginx/网关）没有配置：

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

那么：

- `/` 能访问，因为有 `index.html`；
- 直接进 `/user/list` 会返回 404，因为服务器以为你要一个叫 `/user/list` 的静态资源。

面试时可以这样总结：

> “开发环境下 History 没问题，是因为 dev server 默认帮你做了 404 回源；  
>  上线要记得在 Nginx/网关把所有前端路由都回源到 index.html，否则刷新/直达会 404。”

##### 路由鉴权：一张“过滤链路图”

可以在脑子里画一条链路：

1. 用户访问某个受保护页面（比如 `/admin`）；  
2. `router.beforeEach` 拦截：
   - 没 token：跳登录页，带上 `redirect` 参数；
   - 有 token：检查该路由是否需要某些权限点；
3. 根据当前用户的权限点（后端给的 codes）：
   - 有权限：允许进入；
   - 无权限：跳 403 页面或提示“暂无权限”。

伪代码：

```ts
router.beforeEach((to, from, next) => {
  const token = getToken()
  const needAuth = to.meta.requiresAuth

  if (needAuth && !token) {
    return next({ name: 'login', query: { redirect: to.fullPath } })
  }

  const needCodes = (to.meta.perms || []) as string[]
  if (needCodes.length) {
    const userCodes = getUserPermCodes()
    const ok = needCodes.every(code => userCodes.includes(code))
    if (!ok) {
      return next({ name: '403' })
    }
  }

  next()
})
```

结合你现在这个项目，可以直接说：

- “这个项目暂时没有业务路由，但如果接下去做多页面，我会在 meta 里放 `requiresAuth` 和 `perms`，上面这一套守卫逻辑直接复用。”

##### 动态路由：为什么要“按权限 addRoute”，而不是一次性全注册？

两个原因：

1. **安全体验**：不希望用户一刷新就短暂看到“没权限菜单闪一下再消失”；  
2. **工程管理**：大型系统菜单/路由很多，按权限裁剪能减少前端维护复杂度。

常见做法：

1. 登录后，后端返回：用户信息 + 权限点 + “可见菜单树/路由树”；  
2. 前端把这棵树转成 Vue Router 的 route 列表，遍历调用 `router.addRoute`；  
3. 渲染侧边菜单时，只根据这棵树渲染，用户永远看不到“没权限的路由”。

注意两个实战细节（可以在面试里点出来）：

- **避免重复注入**：  
  刷新页面或重新登录时，要先 reset router 再重新 addRoute，或者用一个标记防止同一路由重复添加。
- **权限变更处理**：  
  用户切换角色/权限更新时，需要清掉老的动态路由和菜单，再整个重新构建，避免“旧权限残留”。

### 权限设计
- **高频问法**
  - “菜单/路由/按钮权限如何统一？后端返回什么？”
  - “401/403 怎么处理？刷新 token 怎么做？”
- **参考回答（可背）**
  - **Q：权限如何统一？后端返回什么？**
    - **结论**：后端返回“权限点 codes + 菜单树/路由信息”；前端用同一套 codes 驱动菜单、路由可见性、按钮显示与指令控制。
  - **Q：401/403 怎么处理？**
    - **401**：token 失效，尝试 refresh token 并重放请求；失败就跳登录并提示。
    - **403**：已登录但无权限，展示无权限页/Toast，并隐藏入口（按钮/菜单）。
- **菜单/路由/按钮统一**
  - 后端返回权限点（如 codes），前端映射（route meta/指令）
- **401/403 处理**
  - token 失效/刷新 token/单点登录被踢提示
  - **推荐策略**
    - 401：尝试 refresh token → 重放请求；失败就跳登录
    - 403：提示无权限，必要时隐藏按钮/路由入口

#### 更详细讲解（理解版本）

##### 菜单/路由/按钮用“一套权限点”打通

后端一般会给你两类东西：

- **权限点 codes**：比如 `['user:view', 'user:edit', 'order:list']`
- **菜单/路由树**：包含每个菜单的 path、name、meta 信息

前端要做的是：  
**所有地方都围绕同一套 codes 来判断权限**——这样“业务策略”就只要维护一份。

例如：

- 菜单是否显示：`menu.perms` 是否被当前用户 codes 覆盖；
- 路由是否可进入：`route.meta.perms` 是否被覆盖（在 beforeEach 里判断）；
- 按钮是否展示：`v-perm="'user:edit'"` 这样的自定义指令去读 codes。

你可以在面试里说：

> “我会和后端约定一套细粒度的权限点 codes，前端所有‘可见性’判断都基于它，这样菜单/路由/按钮只要改一处策略就能统一生效。”

##### 401 vs 403：不要混着用

简单记：

- **401（Unauthorized）**：你**没登录/登录态失效**；  
- **403（Forbidden）**：你登录了，但是**权限不够**。

前端常见处理：

- 401：
  - 如果有 refresh token：静默刷新一次 token，成功后重放原请求；
  - 刷新失败或没有 refresh：清理本地状态，跳登录页，带上 redirect。
- 403：
  - 不要弹一堆“权限不足”弹窗吓用户，可以跳一个统一的 403 页面；
  - 同时要从“入口层面”把按钮/菜单隐藏掉，减少用户“点了才知道没权限”的挫败感。

即便你现在这个 AI Agent 项目没上鉴权逻辑，你也可以把上面这一套当“通用答案”背下来，之后在别的项目里用。


---

## 状态管理（Pinia/Vuex）

- **高频问法**
  - “什么时候用全局 store？什么时候用 composable/局部状态？”
  - “store 如何拆分？如何做持久化与状态隔离？”
- **参考回答（可背）**
  - **Q：何时全局，何时局部？**
    - **结论**：跨页面共享/跨组件协作/需要缓存的才用 store；只在单页面内部使用的优先局部 state 或 composable。
  - **Q：持久化怎么做？安全边界？**
    - **结论**：只持久化必要且不敏感的数据（如 UI 偏好/草稿）；敏感数据避免落盘或加密/短期存储。
    - **工程点**：加版本号，做迁移；不要直接存 Proxy，要序列化 plain object。
- **全局 vs 局部**
  - 只在多页面共享/跨组件协作时上全局；其余尽量局部
- **Pinia**
  - store 拆分、action 异步、getter 边界
- **持久化**
  - localStorage/sessionStorage：注意敏感数据；加版本号与迁移
- **状态污染**
  - 多实例页面/keep-alive 下如何 reset；是否需要 factory store
  - **追问点**
    - “为什么持久化不能直接存 reactive/proxy？”→ 需要存 plain object

#### 更详细讲解（理解版本）

### 1）什么时候“必须上 store”，什么时候“别上 store”？

面试时你可以用一句话划线：

> **store 解决的是“跨组件/跨页面共享 + 生命周期更长 + 需要统一治理”的状态。**

所以适合放 store 的：

- **跨页面共享**：用户信息、权限点、主题、语言、全局配置
- **跨组件协作**：多处入口都能修改同一份数据（购物车、通知中心）
- **需要缓存/恢复**：列表筛选条件、草稿（但要注意敏感信息）
- **需要全局副作用治理**：统一错误处理、请求队列、全局 loading（但别滥用）

不适合放 store 的（面试加分点）：

- **只在一个页面内用**：比如本页面的弹窗开关、临时输入框内容
- **只在一个组件树内有效**：可以用 props/composable/provide-inject
- **很短生命周期、一次性**：一次请求的 loading/error，放组件里更清晰

你可以直接对照你这个项目：

- 当前对话消息 `messages`：只在 `App` 这个页面范围内，**放组件局部 state 是合理的**  
  （除非你后面要做“多会话列表 / 多页面共享”，那再升级到 store）
- `copyText`：是跨层服务能力，用 `provide/inject` 更合适，而不是 store

### 2）store 怎么拆：按“领域”拆，不要按“技术”拆

一个稳定的拆法是按业务域：

- `useAuthStore()`：token、用户信息、权限点、登录/刷新 token
- `useAppStore()`：主题、语言、布局设置
- `useChatStore()`：会话列表、当前会话消息、流式状态

每个 store 只负责自己领域的状态和 action，别变成“全项目大杂烩”。

### 3）持久化：不是“能存就存”，而是“存什么 + 怎么升级 + 怎么清理”

#### 3.1 存什么（安全边界）

推荐持久化：

- UI 偏好：主题、语言、侧边栏折叠
- 草稿：未提交的表单/输入
- 非敏感缓存：最近搜索词、分页大小

谨慎/不建议持久化：

- **access token**（看公司安全策略；若必须存，优先 httpOnly cookie 或短期存储）
- **敏感业务数据**（订单详情、隐私信息）
- **体积很大的数据**（会拖慢序列化/反序列化，影响首屏）

#### 3.2 怎么存（版本号 + 迁移）

最常用也最靠谱的是：**给持久化数据加版本号**。

伪代码（你可以背成话术）：

```js
const KEY = "app:chat"
const VERSION = 2

function save(payload) {
  localStorage.setItem(KEY, JSON.stringify({ v: VERSION, payload }))
}

function load() {
  const raw = localStorage.getItem(KEY)
  if (!raw) return null
  const parsed = JSON.parse(raw)

  // 1) 老版本数据迁移
  if (parsed.v === 1) {
    return migrateV1ToV2(parsed.payload)
  }

  // 2) 版本不识别：直接丢弃，避免脏数据把应用搞崩
  if (parsed.v !== VERSION) return null

  return parsed.payload
}
```

这段思路的价值是：

- 你改了数据结构（字段名/类型变化）也不怕；
- 老数据不会导致页面白屏；
- 你能解释“工程化思维”，面试官很吃这一套。

#### 3.3 怎么清理（重置策略）

常见清理时机：

- 退出登录：清掉用户相关 store/缓存
- 权限变更：清掉菜单/路由/权限缓存
- 关键字段缺失：判定数据损坏，直接 reset

你项目里“清空对话”就是一个很好的例子：  
点击后不仅要清 UI，还要把对应的 `localStorage` 一并清掉，保证刷新后状态一致。

### 4）为什么“持久化不能直接存 reactive/proxy”？

一句话解释（面试好用）：

> “reactive 返回的是 Proxy，它是运行时代理对象，不是纯数据结构；序列化时要先变成 plain object（只包含可 JSON 化的字段）。”

在你项目里你做的就是正确方式：

- 存的时候只取 `{ role, content, id }` 等 plain 字段
- 读出来再恢复成组件要用的结构

### 5）状态隔离/污染：什么时候会“串台”？

高频坑主要两类：

1. **模块级单例变量**导致多个页面共用一份状态（composable 里写了顶层变量）
2. **keep-alive 缓存**导致页面回来时沿用旧状态（该 reset 的没 reset）

面试时可以直接说你的策略：

- “需要隔离的状态放在组件实例里（每次进入新建）”
- “需要共享的状态放 store，但明确 reset 时机（退出登录/切换租户/切换会话）”


---

## JavaScript（高频）

- **高频问法**
  - “事件循环怎么解释？微任务/宏任务有什么例子？”
  - “async/await 和 Promise 的关系？”
- **参考回答（可背）**
  - **Q：事件循环怎么说？**
    - **结论**：同步代码先执行；微任务（Promise.then/queueMicrotask）在本轮宏任务结束后立刻清空；宏任务（setTimeout/IO）进入下一轮。
    - **例子**：`console.log(1); Promise.resolve().then(()=>console.log(2)); setTimeout(()=>console.log(3)); console.log(4)` 输出 1 4 2 3。
  - **Q：async/await 本质？**
    - **结论**：是 Promise 的语法糖；await 会把后续代码拆到微任务里继续执行。
- **事件循环**
  - 宏任务/微任务；Promise/async-await 本质（语法糖 + Promise）
- **原型链/this/闭包**
  - this 绑定规则、闭包导致的常见泄漏点
- **手写题常见**
  - 防抖/节流（带取消/立即执行）
  - 并发控制（同时 N 个请求）
  - 发布订阅（on/off/emit）
 - **工程实践**
  - 取消请求：AbortController（你项目里就用到了）
  - 防重复提交：按钮 disable + 请求幂等 key

#### 更详细讲解（理解版本）

### 1）事件循环：你只要把“一个循环里发生的顺序”说清楚

面试时最稳的说法是 **“一句话结论 + 一段流程 + 一个例子”**：

- **一句话结论**：  
  JS 先跑同步代码；当前这轮宏任务结束后会清空微任务队列；然后进入下一轮宏任务；渲染一般发生在宏任务之间（浏览器决定时机）。

### 2）宏任务/微任务到底是什么？

不要死记很多 API，记最常用的就够了：

- **宏任务（macro task）**：`setTimeout`、`setInterval`、I/O、用户交互事件回调（click）、`requestAnimationFrame` 的回调触发点也可认为在“渲染前后的一类任务调度”  
- **微任务（micro task）**：`Promise.then/catch/finally`、`queueMicrotask`、`MutationObserver`

核心区别：  
**微任务会在“当前宏任务结束后立刻被清空（清到空为止）”。**

### 3）经典输出题：为什么是 1 4 2 3？

```js
console.log(1)
Promise.resolve().then(() => console.log(2))
setTimeout(() => console.log(3))
console.log(4)
```

解释方式（背这段就行）：

1. 同步先执行：打印 1  
2. `Promise.then` 放进 **微任务队列**（先不执行）  
3. `setTimeout` 放进 **宏任务队列**（下一轮）  
4. 继续同步：打印 4  
5. 当前宏任务结束，清空微任务：打印 2  
6. 进入下一轮宏任务（setTimeout）：打印 3

### 4）async/await 的本质：Promise 的语法糖（并且“await 后面”一定是异步续跑）

你可以把：

```js
async function foo() {
  console.log('A')
  await 1
  console.log('B')
}
foo()
console.log('C')
```

理解成：

- `await 1` 会把后面的 `console.log('B')` 拆成“等当前同步代码跑完后再继续”的一段  
- 这段继续执行通常会以 **微任务** 的形式调度（等同于 Promise then）

所以输出是：`A C B`。

一个“更贴近工程”的理解：  
`await` 让你用同步写法表达异步流程，但它不会让代码变成“真的同步阻塞”，它只是把后续逻辑排队了。

### 5）把它和 Vue 的 nextTick 串起来（这会很加分）

你前面讲过：

- Vue 更新是异步批处理
- `nextTick` 用来“等 DOM 更新完再做依赖 DOM 的事”

那么 nextTick 在事件循环里大概是什么地位？  
你可以这样说（够用且不会过度承诺实现细节）：

> “Vue 会把组件更新安排到一个队列里，等本轮同步逻辑跑完后统一 flush。  
> `nextTick` 相当于给你一个回调，让它排在‘本轮更新 flush 完之后’再执行。实现上通常会用微任务（Promise）或任务队列来调度，所以你能在 nextTick 里拿到最新 DOM。”

这句话能把“机制 + 为什么好用”讲清楚。

### 6）结合你项目：为什么流式更新要用 rAF 节流，而不是每个 token 都滚动？

你流式 SSE 会高频收到 `delta`（每几十毫秒甚至更频繁）。如果每次 delta：

- 更新 DOM
- 立刻读写 scrollTop

就会造成：

- 大量布局计算/重排（读写 DOM 混在一起）
- 主线程被占满，滚动/输入卡顿

你现在用 `requestAnimationFrame` 做节流（“一帧最多滚一次”）正是最佳实践：

- 把频繁事件合并到每帧一次
- 避免在同一帧里做多次强制布局

面试官问“为什么这么写”时，你可以回答：

> “因为流式 token 是高频事件，如果每次都滚动会触发大量布局；我用 rAF 把滚动合并到每帧一次，体验更稳定。”

### 7）AbortController：它为什么好用（以及和事件循环的关系）

AbortController 的优点是：  
**它不是“等请求自己回来再忽略”，而是主动通知底层把这条任务取消掉**。

在你项目里：

- 点击“停止生成” → `controller.abort()`  
- `fetch` 的读取会抛 `AbortError`，你在 catch/finally 里做清理  
- UI 保留已生成内容，同时结束 loading

你可以补一句工程话术：

> “取消不仅是 UI 逻辑，更是资源释放：长连接/流式如果不 abort，会占用连接和服务端资源。”


---

## TypeScript（建议项目主力级）

- **高频问法**
  - “泛型在你项目里怎么用？如何约束 API 响应类型？”
  - “类型守卫怎么写？怎么减少 any？”
- **参考回答（可背）**
  - **Q：泛型怎么落地到 API？**
    - **结论**：封装请求函数 `request<T>(...)`，把响应体类型参数化；分页模型 `Page<T>`、错误模型 `ApiError` 统一。
  - **Q：怎么减少 any？**
    - **结论**：先从接口层开始：给后端返回结构建类型；再收敛组件 props/emit；最后清理工具函数里的 any。
- **核心类型能力**
  - 联合/交叉、泛型、映射类型、索引访问类型
- **类型守卫**
  - `in/typeof/instanceof` + 自定义谓词
- **Vue 中落地**
  - props/emit 类型、表单模型、API 请求/响应模型、错误模型
- **any 收敛**
  - 允许点与边界、渐进治理方法
  - **落地建议**
    - API：定义 Request/Response/Error 模型；前端对错误做统一枚举/映射

---

## HTML/CSS（能做复杂页面）

- **高频问法**
  - “移动端适配怎么做？1px 问题怎么处理？”
  - “scoped 的原理是什么？:deep 为什么能穿透？”
- **参考回答（可背）**
  - **Q：scoped 原理？:deep 为什么能穿透？**
    - **结论**：scoped 是给选择器/DOM 注入独特属性选择器（如 `data-v-xxx`）；`:deep` 让某段选择器不再受这个属性限制，从而作用到子组件生成的 DOM。
  - **Q：暗黑模式怎么做？**
    - **结论**：`prefers-color-scheme` + CSS variables；组件只引用变量不写死颜色。
- **布局**
  - Flex/Grid、常见居中、溢出省略、响应式
- **性能**
  - 重排/重绘、合成层、动画最佳实践
- **工程化**
  - scoped 原理与限制、:deep、主题变量、暗黑模式
  - **暗黑模式**
    - prefers-color-scheme + CSS variables；组件尽量只使用变量

---

## 浏览器/网络（挖深度）

- **高频问法**
  - “强缓存/协商缓存怎么区分？ETag 是什么？”
  - “CORS 预检什么时候发生？带 cookie 怎么处理？”
- **参考回答（可背）**
  - **Q：强缓存/协商缓存？**
    - **结论**：强缓存直接用本地（Cache-Control max-age）；协商缓存发请求问服务器（ETag/If-None-Match 或 Last-Modified/If-Modified-Since）。
  - **Q：CORS 预检什么时候发生？**
    - **结论**：跨域 + 非简单请求（自定义 header、PUT/DELETE、JSON 等）会先 OPTIONS 预检；带 cookie 需要 `withCredentials` 且服务端允许 credentials 与明确 origin。
- **HTTP 缓存**
  - 强缓存/协商缓存，ETag/Last-Modified
- **跨域/CORS**
  - 预检请求、允许头、cookie 跨域限制
- **安全**
  - XSS/CSRF 原理与防护（转义、CSP、SameSite、token）
- **性能指标**
  - LCP/CLS/INP 含义；首屏慢排查路径（网络→资源→渲染→脚本）
  - **排查流程（可背）**
    - 网络：TTFB、资源大小、并发
    - 渲染：长任务、布局抖动
    - 脚本：bundle 体积、第三方脚本

#### 更详细讲解（理解版本）

### 1）HTTP 缓存：一句话先把“强/协商”分清

把缓存当成你和服务器的“谈判”：

- **强缓存**：浏览器说“我本地就有，而且还没过期，我不问你了”。  
  → **不会发请求**（Network 面板可能显示 `from memory cache` / `from disk cache`）。

- **协商缓存**：浏览器说“我本地有一份，但我不确定是不是最新，我问你一下”。  
  → **会发请求**，服务器告诉你“没变”（304）或“变了”（200 + 新内容）。

记忆口诀：

- 强缓存看 `Cache-Control`（或旧的 `Expires`）  
- 协商缓存看 `ETag` 或 `Last-Modified`

### 2）强缓存：Cache-Control 你要会读

最常见字段：

- `Cache-Control: max-age=600`：缓存 600 秒（10 分钟）
- `Cache-Control: no-cache`：不是“不缓存”，而是**每次都要走协商**（要问服务器）
- `Cache-Control: no-store`：**不允许缓存**（浏览器不落盘）
- `Cache-Control: public/private`：
  - `public`：中间代理/CDN 也能缓存
  - `private`：只有浏览器能缓存（一般带用户态的内容）

面试官常挖点：

- “no-cache 和 no-store 区别？”  
  - **no-cache**：可以存，但用之前必须验证（走协商）  
  - **no-store**：不让存

### 3）协商缓存：ETag vs Last-Modified

两套“身份证”：

- **Last-Modified**（时间戳）：  
  服务端给你“最后修改时间”，下次浏览器带 `If-Modified-Since` 来问。  
  缺点：粒度可能只有秒级；内容没变但时间变了也会误判。

- **ETag**（内容指纹）：  
  服务端给你一个 hash/版本号，下次浏览器带 `If-None-Match` 来问。  
  通常比 Last-Modified 更准，但计算 ETag 可能有成本（看服务端实现）。

典型流程（用文字背就行）：

1. 第一次请求返回：200 + body + `ETag: "abc"`  
2. 第二次请求带上：`If-None-Match: "abc"`  
3. 服务器比较后：
   - 没变：304（无 body），浏览器用本地缓存
   - 变了：200 + 新 body + 新 ETag

### 4）CORS：什么时候会“预检 OPTIONS”？

只要同时满足：

- **跨域**（协议/域名/端口任意不同）  
并且
- 不是“简单请求”

就会先发一个 **OPTIONS 预检**。

所谓“简单请求”需要同时满足（记大概就够）：

- method 是 `GET/HEAD/POST`
- header 只包含“安全字段”（比如 `Accept`、`Content-Type` 只能是 `text/plain`、`application/x-www-form-urlencoded`、`multipart/form-data`）

你项目里前端请求后端：

- `fetch("/api/chat/stream", { method: "POST", headers: { "Content-Type": "application/json" } })`

如果是同域（Vite 代理到本地服务）就不算跨域；  
如果跨域（比如前端在 `http://localhost:5173`，后端在 `http://localhost:3000`）就会触发预检，因为 `Content-Type: application/json` 不属于简单请求允许的那几个类型。

### 5）“带 cookie 的跨域”为什么总失败？

因为浏览器默认不会把 cookie 带到跨域请求里。要同时满足：

前端：

```js
fetch(url, { credentials: "include" })
// 或 axios: { withCredentials: true }
```

后端响应头必须有：

- `Access-Control-Allow-Credentials: true`
- `Access-Control-Allow-Origin: <具体域名>`（**不能是** `*`）

以及 cookie 本身要满足：

- `SameSite=None; Secure`（现代浏览器跨站 cookie 基本都要求这一套）

一句话总结：  
**跨域 + cookie** 是“三件套”：前端开 credentials、后端允许 credentials、origin 不能是 `*`。

### 6）结合你项目：SSE 流式为什么要特别注意代理/缓存？

SSE 本质是一个“长连接”：

- 服务端一直 `res.write(...)` 往外推
- 浏览器一直读 `ReadableStream`

所以工程上常见坑：

- **代理缓冲**：Nginx 默认可能会 buffer，导致你后端在推，但前端迟迟收不到“实时 token”。  
  解决：关掉 buffering（例如 `proxy_buffering off;`），并确保 `Cache-Control: no-cache`。

- **不要被缓存**：流式响应不应该被缓存。  
  一般会设置：`Cache-Control: no-cache`，并且 `Content-Type: text/event-stream`。

你在面试里可以把它说成：

> “流式输出是长连接，链路上任何一层的缓存/缓冲都会把‘实时’变成‘攒一堆再给’，所以要禁用缓存、禁用代理缓冲，并保持连接不被中断。”


---

## 工程化（中高级必考）

- **高频问法**
  - “Vite 为什么快？HMR 原理大概是什么？”
  - “怎么做代码分割？怎么定位 chunk 过大？”
- **参考回答（可背）**
  - **Q：Vite 为什么快？**
    - **结论**：开发环境利用浏览器原生 ESM，按需编译；依赖预构建；HMR 更新粒度更细，启动更快。
  - **Q：怎么做代码分割？**
    - **结论**：动态 import 触发分割；按路由/大模块拆 chunk；配合分析工具定位大依赖并优化（按需引入、替换库）。
- **Vite vs Webpack**
  - dev server、HMR、bundle 策略差异
- **代码分割**
  - 动态 import、chunk 拆分、公共依赖抽取
- **规范体系**
  - ESLint/Prettier、commitlint、husky、Git flow
- **CI/CD**
  - 环境区分、灰度、回滚
  - **加分点**
    - 提交规范（commitlint）+ 质量门禁（CI）+ 自动发布

#### 更详细讲解（理解版本）

### 1）Vite 为什么快：别背名词，用“链路”讲

你可以用“开发时”和“生产时”分开讲（面试官听起来最顺）：

- **开发环境为什么快**：
  - Vite 利用浏览器原生 ESM：页面真正访问到哪个模块，才按需编译哪个模块（不是一上来打包全量）。
  - 依赖预构建（optimize deps）：把第三方依赖（通常是 CommonJS/大包）提前转换成更适合 dev server 的形式，避免每次启动都慢。
  - HMR 粒度更细：只替换变更模块，能做到“热更新几乎秒级”。

- **生产环境怎么做**：
  - Vite build 底层用 Rollup 做打包：支持 tree-shaking、代码分割、产物优化；
  - 所以“快”主要体现在 dev 体验，build 侧更多是 Rollup 的优化能力。

一句话总结（可背）：

> “Vite dev 是基于 ESM 的按需编译，不做全量打包；依赖预构建加速启动；HMR 只更新变更模块，所以开发体验很快。生产环境还是走 Rollup 打包优化。”

### 2）HMR 原理你要能说到“为什么能保持状态”

面试不需要深入实现细节，但要讲清楚 3 点：

1. dev server 通过 WebSocket 通知浏览器“哪个模块变了”
2. 浏览器侧重新请求这个模块的新版本（带 hash/时间戳避免缓存）
3. Vue 运行时会把变更模块“热替换”进应用，并尽可能保留组件状态（这就是为什么改个样式/模板不会整个页面刷新）

你可以顺口补一句：

> “如果改动触及模块边界不稳定（比如导出结构变化），HMR 可能退化成整页刷新，这时就不是状态保留了。”

### 3）代码分割：你要会讲“为什么要分”和“怎么定位大 chunk”

#### 3.1 为什么要分包

核心是 2 个指标：

- **首屏加载**：首屏需要的 JS 越少越好（下载快、解析快、执行快）
- **缓存命中**：不常变的公共依赖拆出去，用户二次访问能走缓存

#### 3.2 怎么分包（常用策略）

- **路由级**：`const Page = () => import('./pages/xxx.vue')`  
  → 最常见，也最容易见效

- **大模块按需**：编辑器、图表库、富文本这类大依赖尽量懒加载

- **公共依赖抽取**：把 vendor 拆出来，让业务代码变更不影响 vendor 缓存

#### 3.3 怎么定位 chunk 过大

面试话术（可背）：

> “我会先用构建分析工具看 bundle 组成（哪个依赖占体积最大），再决定是按需引入、替换库、还是拆分路由/模块。”

落地到 Vite 常见动作：

- 启用可视化分析（例如 rollup 插件的 visualizer）
- 看 `chunk` 里谁最大（moment、lodash 全量、chart 等）
- 再做：
  - 按需引入（比如 lodash-es / 按需组件）
  - 替换更轻的库
  - 动态 import 拆包

### 4）工程规范：为什么要 ESLint/Prettier/commitlint？

这块面试官不是想听“我会配”，而是想听“我为什么这么配”：

- **ESLint**：减少线上 bug（未定义变量、错误依赖、Promise 未处理等）
- **Prettier**：统一格式，减少无意义 diff（团队协作成本下降）
- **commitlint + husky**：把质量门禁前置（不让坏代码/坏提交进主干）

你可以一句话总结：

> “格式统一靠 Prettier，代码质量靠 ESLint，提交质量靠 commitlint，把门禁放在 CI/提交阶段，减少后期返工。”

### 5）CI/CD：你要能讲出“流水线最小闭环”

一个“最小但完整”的流水线（面试足够用）：

1. **安装依赖**（pnpm/npm ci）
2. **静态检查**：lint + typecheck
3. **构建**：vite build
4. **产物上传**：制品库/CDN
5. **部署**：按环境（dev/staging/prod）区分
6. **灰度/回滚**：保留上一个可用版本，一键回退

结合你项目可以提一句：

- “如果是 AI Chat 这种强交互页面，我会在 CI 里加一条 E2E smoke（打开页面→发送一条→看到回复），保证最基本链路不挂。”


---

## 业务能力（4 年核心）

- **高频问法**
  - “复杂表单怎么做联动/校验/草稿？”
  - “大表格卡顿怎么优化？虚拟滚动怎么做？”
- **参考回答（可背）**
  - **Q：复杂表单怎么做？**
    - **结论**：表单模型类型化；联动用 watch/computed；校验拆同步/异步；草稿用持久化并做版本迁移。
  - **Q：大表格怎么优化？**
    - **结论**：虚拟滚动（只渲染可视区）；列/单元格 memo；减少深层 watch；按需渲染与事件委托。
- **复杂表单**
  - 动态表单、联动校验、异步校验、草稿保存
- **复杂表格**
  - 可编辑表格、行校验、批量操作、虚拟滚动
- **稳定性**
  - 统一请求封装：错误码、toast、重试、取消（AbortController）
  - 防重复提交/幂等
  - **可讲案例模板**
    - 问题：XXX 表格 2w 行渲染卡顿，交互掉帧
    - 方案：虚拟列表 + memo + 拆分渲染
    - 结果：首屏从 X 秒到 Y 秒，滚动帧率提升

#### 更详细讲解（理解版本）

### 1）复杂表单：核心不是“表单组件”，而是“状态流 + 规则流”

面试官问“复杂表单怎么做”，其实在考你能不能把它拆成可控的系统。  
建议你用下面这条主线回答（基本不会错）：

1. **数据模型类型化**（字段、枚举、默认值、后端对齐）
2. **联动策略**（computed/watch + 去抖 + 防循环）
3. **校验体系**（同步/异步分层 + 触发时机）
4. **草稿/回填**（持久化 + 版本迁移 + 恢复提示）
5. **提交与幂等**（禁用按钮 + 幂等 key + 错误兜底）

#### 1.1 表单模型怎么建（避免“到处都是字符串 key”）

你可以这么说：

> “复杂表单我会先定义一个清晰的表单模型（最好 TS 类型），所有字段从这一个模型读写，避免散落在各处的 magic string。”

伪代码（背思路即可）：

```ts
type FormModel = {
  name: string
  type: "A" | "B"
  startAt: string
  endAt: string
  extra?: string
}

const form = reactive<FormModel>({
  name: "",
  type: "A",
  startAt: "",
  endAt: ""
})
```

#### 1.2 联动：watch 的正确打开方式（防抖 + 防循环）

联动最常见的坑：

- A 改了触发 B，B 改了又触发 A，形成循环
- 用户输入很快，联动请求（比如“查重名/查库存”）被打爆

解决套路：

- **把“派生状态”尽量做成 computed**（无副作用，最稳）
- 需要副作用（请求/重置字段）才用 watch
- 请求联动加防抖 + 取消（AbortController 或者“只认最后一次”）

```ts
const canSubmit = computed(() => {
  return !!form.name && form.startAt <= form.endAt
})

watch(
  () => form.type,
  (t) => {
    // type 改了就清理不兼容字段
    if (t === "A") form.extra = undefined
  }
)
```

#### 1.3 校验：把“规则”和“触发时机”分开

面试官喜欢你讲这两层：

- **规则是什么**：必填、范围、跨字段（开始时间 < 结束时间）
- **什么时候触发**：onChange、onBlur、提交时一次性校验

异步校验（比如用户名查重）要强调：

- 防抖
- 只认最后一次结果（旧请求回来要丢弃）

### 2）大表格/大列表卡顿：先定位瓶颈，再对症下药

“表格卡顿”你不要上来就说虚拟滚动，先讲排查路径更像资深：

1. **是渲染慢**（DOM 太多）还是 **交互慢**（事件/计算太重）
2. Chrome Performance 看：
   - 长任务（Long task）
   - Layout/Recalculate Style 次数
   - scripting 时间（JS 执行占比）
3. 再选方案（虚拟滚动、memo、拆分渲染、减少 watcher）

#### 2.1 虚拟滚动：为什么能救命？

一句话：

> “虚拟滚动的核心是：永远只渲染可视区那几十行，滚动时复用 DOM，而不是把 2w 行都放进 DOM。”

面试可以补两个关键点（显得你真做过）：

- 需要预估/测量行高（固定行高最简单，变高需要更复杂的测量缓存）
- 滚动时要做 `startIndex/endIndex` 计算，并加 `paddingTop/paddingBottom` 维持滚动条高度

#### 2.2 减少无效更新：让 props 稳定、计算可缓存

典型优化点：

- 列表项组件 `key` 稳定（你聊天消息就是用 `id`）
- 避免给每行传匿名函数（会导致 props 每次变）
- 重计算放 computed，或者 memo（比如列配置、格式化函数）

你可以这样说：

> “我会先把每行渲染拆成纯展示组件，让它尽量只依赖稳定 props；然后把格式化、过滤、排序等计算挪到 computed，并缓存结果，避免每次滚动都全量计算。”

### 3）稳定性：请求封装、重试、取消、幂等（结合你项目更加分）

你这个项目能直接当案例讲：

- **取消**：流式 SSE 用 `AbortController` 支持“停止生成”
- **重试/兜底**：流式失败回退非流式（保证可用性）
- **防重复提交**：发送按钮在 `loading` 时 disable

面试官追问“你怎么做幂等？”你可以说：

- 前端生成 `requestId`（UUID）放 header 或 body
- 后端按 `requestId + userId` 去重（同一 id 只处理一次）
- UI 上也要做 disable，避免用户连点

一句话模板（可背）：

> “稳定性我会做三层：UI 防重复（disable）、请求层可取消/可重试（AbortController + retry/backoff）、后端幂等去重（requestId）。这样即使网络抖动或用户连点也不会造成重复副作用。”


---

## 加分项（案例 + 指标）

- **性能优化案例**
  - 首屏 X 秒 → Y 秒（手段：资源、渲染、缓存、虚拟列表）
- **组件库/中台沉淀**
  - 通用表单/表格/权限指令/composables
- **微前端/多应用**
  - 隔离、通信、路由、样式隔离
- **测试**
  - 单测（Vitest/Jest）与 E2E（Playwright/Cypress）

---

## 结合本项目你可以讲的点（面试很加分）

- **SSE 流式输出**
  - 前端 `fetch + ReadableStream` 解析 `event: delta/done/error`，边接收边渲染
  - 为什么需要节流滚动（requestAnimationFrame），避免每 token 滚动造成卡顿
- **取消请求（AbortController）**
  - “停止生成”：abort 流式请求；“重新生成”：截断到最后一条 user 再发一次
- **provide/inject**
  - 复制功能 `copyText` 通过 provide/inject 跨层传递，避免事件层层透传
- **组件拆分**
  - Topbar / PromptPanel / Messages / Input 拆分：职责边界更清晰、可测试性更好
- **安全（XSS）**
  - Markdown 渲染先 escape，再做有限格式化；说明为什么不能直接信任 v-html

---

## 面试时的“输出模板”（建议照着说）

- **一句话结论**：我会先给结论/选型结论
- **原理解释**：解释为什么这样做（机制/边界）
- **落地方案**：说清你怎么实现（关键代码/模块）
- **风险与兜底**：异常怎么处理（重试/回退/降级/监控）
- **结果与指标**：用数据说明价值（耗时/错误率/体验）

## 你可以用本项目讲的 2 个小故事（可直接背）

### 故事 1：把 AI 回复做成“流式打字机”
- **问题**：非流式要等整段生成完才显示，首字延迟高，用户感知慢
- **方案**：后端 SSE（event: delta/done/error）→ 前端 ReadableStream 解析并增量 append
- **关键点**：流式高频更新会触发大量渲染/滚动，所以用 rAF 节流滚动
- **结果**：首字响应明显更快，用户体验更接近真实聊天产品

### 故事 2：支持“停止生成 + 重新生成”
- **问题**：模型长输出时用户需要中断；还需要不改输入就重新生成答案
- **方案**：
  - 停止：AbortController.abort() 取消流式请求，保留已生成内容
  - 重新生成：截断到最后一条 user，删除旧 assistant，再按同一上下文重生成
- **兜底**：流式失败回退非流式（保证功能可靠）


