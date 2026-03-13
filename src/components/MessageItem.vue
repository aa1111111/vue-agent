<script setup>
import { inject } from "vue";

/**
 * 单条消息组件（消息气泡 + 工具调用展示 + 复制）
 *
 * 设计点：
 * - message：消息对象（id/role/content）
 * - toolCalls：可选的工具调用记录（只在 assistant 消息上展示）
 * - render：渲染函数（比如 renderLiteMarkdown），解耦“内容渲染策略”
 */
const props = defineProps({
  // 当前消息：父组件保证形状正确
  message: { type: Object, required: true },
  // 该条 assistant 消息关联的工具调用数组；user/system 通常为 null
  toolCalls: { type: Array, default: null },
  // 文本 -> HTML 的渲染函数（用于 v-html）
  render: { type: Function, required: true },
});

/**
 * 复制逻辑通过 provide/inject 下发，避免层层 emit 透传：
 * App.vue provide(copyText) -> 任意后代组件 inject 使用。
 */
const copyText = inject("copyText", async () => {});
</script>

<template>
  <!-- system 消息不展示在聊天区，只用于发给模型 -->
  <div v-if="message.role !== 'system'" class="msg-wrap" :class="message.role">
    <div class="msg-meta">
      <!-- 左侧：角色 -->
      <div class="who">{{ message.role === "user" ? "我" : "AI" }}</div>
      <div class="ops">
        <!-- 复制：直接调用 inject 注入的 copyText() -->
        <button class="mini" @click="copyText(message.content)">复制</button>
      </div>
    </div>

    <!-- 工具调用展示：只有 assistant 且 toolCalls 非空时才出现 -->
    <div v-if="message.role === 'assistant' && toolCalls" class="tools">
      <div class="tools-title">工具调用</div>
      <ul class="tools-list">
        <li v-for="(tc, i) in toolCalls" :key="i">
          <!-- 工具名 -->
          <span class="tool-name">{{ tc.name }}</span>
          <!-- 参数（可选） -->
          <span v-if="tc.args" class="tool-args">{{ JSON.stringify(tc.args) }}</span>
          <span class="tool-arrow">→</span>
          <!-- 工具返回结果（通常是字符串/JSON 字符串） -->
          <span class="tool-result">{{ tc.result }}</span>
        </li>
      </ul>
    </div>

    <!-- 消息内容：使用 v-html 展示渲染后的 HTML（render 内部负责转义，避免 XSS） -->
    <div class="bubble" v-html="render(message.content)"></div>
  </div>
</template>

<style scoped>
.msg-wrap {
  margin-bottom: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.msg-wrap.user {
  align-items: flex-end;
}
.msg-wrap.assistant {
  align-items: flex-start;
}

.msg-meta {
  width: 100%;
  display: flex;
  justify-content: space-between;
  gap: 10px;
  font-size: 12px;
  color: var(--muted);
}
.who {
  font-weight: 600;
}
.ops {
  display: flex;
  gap: 6px;
}

.bubble {
  max-width: 88%;
  border-radius: 16px;
  padding: 12px 14px;
  line-height: 1.55;
  word-break: break-word;
  border: 1px solid var(--border);
  background: var(--panel-solid);
  color: var(--text);
  box-shadow: var(--shadow-sm);
}
.msg-wrap.user .bubble {
  background: linear-gradient(
    135deg,
    rgba(43, 111, 255, 0.14),
    rgba(109, 40, 217, 0.1)
  );
  border-color: rgba(43, 111, 255, 0.25);
}
.msg-wrap.assistant .bubble {
  background: var(--panel-solid);
}

.tools {
  max-width: 88%;
  border: 1px dashed rgba(43, 111, 255, 0.45);
  background: rgba(43, 111, 255, 0.08);
  border-radius: 14px;
  padding: 10px 12px;
  font-size: 12px;
  color: var(--text);
}
.tools-title {
  font-weight: 700;
  margin-bottom: 6px;
}
.tools-list {
  margin: 0;
  padding-left: 18px;
}
.tool-name {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    "Liberation Mono", "Courier New", monospace;
  background: rgba(43, 111, 255, 0.14);
  border: 1px solid rgba(43, 111, 255, 0.25);
  padding: 2px 8px;
  border-radius: 999px;
}
.tool-args {
  color: var(--muted);
  margin-left: 6px;
}
.tool-arrow {
  margin: 0 6px;
  color: var(--muted);
}
.tool-result {
  color: var(--text);
}

button {
  padding: 4px 8px;
  border-radius: 8px;
  font-size: 12px;
  border: 1px solid var(--border);
  background: var(--panel-solid);
  color: var(--text);
  cursor: pointer;
  transition: box-shadow 0.15s ease, border-color 0.15s ease;
}
button:hover:not(:disabled) {
  box-shadow: var(--shadow-sm);
  border-color: rgba(43, 111, 255, 0.35);
}
button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

/* 代码块样式（配合 renderLiteMarkdown 输出）
 * 注意：render() 生成的 HTML 不在当前组件的 scope 样式树内，所以用 :deep(...)
 */
:deep(pre.code) {
  margin: 8px 0 0;
  background: var(--code-bg);
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid var(--code-border);
}
:deep(pre.code .code-head) {
  padding: 6px 10px;
  font-size: 12px;
  color: rgba(185, 199, 230, 0.95);
  background: var(--code-head);
  border-bottom: 1px solid var(--code-border);
}
:deep(pre.code code) {
  display: block;
  padding: 10px;
  color: var(--code-text);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    "Liberation Mono", "Courier New", monospace;
  font-size: 12px;
  white-space: pre;
  overflow-x: auto;
}
:deep(.inline-code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    "Liberation Mono", "Courier New", monospace;
  background: rgba(99, 102, 241, 0.14);
  border: 1px solid rgba(99, 102, 241, 0.25);
  padding: 1px 7px;
  border-radius: 999px;
}
</style>
