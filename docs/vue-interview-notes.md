<!-- markdownlint-disable MD022 MD032 MD005 MD007 MD012 -->

# Vue 前端 4 年经验面试：知识点清单（更详细版）

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


