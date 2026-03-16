<script setup>
import { nextTick, ref } from "vue";
import MessageItem from "./MessageItem.vue";

/**
 * 消息列表组件（滚动容器 + 错误条 + 将消息交给 MessageItem 渲染）
 *
 * 父组件（App.vue）负责：
 * - send()/reset/retry 等业务逻辑
 * - 保存 messages/toolCallsByMsgId 等状态
 *
 * 本组件负责：
 * - 展示消息列表
 * - 将 toolCallsByMsgId[message.id] 传给对应 MessageItem
 * - 展示错误条，并把“重试”事件交给父组件
 * - 暴露 scrollToBottom() 给父组件调用（自动滚动）
 */
const props = defineProps({
  // 消息数组：包含 system/user/assistant；MessageItem 内部会隐藏 system
  messages: { type: Array, required: true },
  // 工具调用映射：key = assistant message id, value = toolCalls[]
  toolCallsByMsgId: { type: Object, required: true },
  // 最近一次请求错误信息（空字符串表示无错误）
  lastError: { type: String, default: "" },
  // 是否正在请求中（用于禁用重试按钮等）
  loading: { type: Boolean, default: false },
  // 是否可以重试（通常由父组件根据 lastUserText 决定）
  canRetry: { type: Boolean, default: false },
  // 文本渲染函数（renderLiteMarkdown），传给 MessageItem 用于 v-html
  render: { type: Function, required: true },
});

// retry：错误条重试
defineEmits(["retry"]);

// 消息滚动容器 DOM 引用
const containerEl = ref(null);

async function scrollToBottom() {
  // nextTick 确保 DOM 已完成更新（消息已渲染进列表）再滚动
  await nextTick();
  const el = containerEl.value;
  if (!el) return;
  el.scrollTop = el.scrollHeight;
}

// 同步贴底滚动：不等 nextTick，用于流式高频更新时更稳（会尽力贴底）
function scrollToBottomNow() {
  const el = containerEl.value; // 取到滚动容器 DOM
  if (!el) return; // 没有 DOM 就不处理
  el.scrollTop = el.scrollHeight; // 直接把 scrollTop 拉到最底
}

// 暴露给父组件：App.vue 可以通过 ref 调用 messagesView.scrollToBottom()/scrollToBottomNow()
defineExpose({ scrollToBottom, scrollToBottomNow });

function toolCallsForMessage(m) {
  // 根据 message.id 取出对应工具调用；没有就返回 null
  return props.toolCallsByMsgId?.[m.id] || null;
}
</script>

<template>
  <div class="messages" ref="containerEl">
    <template v-for="m in messages" :key="m.id">
      <MessageItem
        :message="m"
        :tool-calls="toolCallsForMessage(m)"
        :render="render"
      />
    </template>

    <!-- 错误条：由父组件传入 lastError 控制显示 -->
    <div v-if="lastError" class="errorbar">
      <div class="error-text">请求失败：{{ lastError }}</div>
      <button
        class="mini"
        @click="$emit('retry')"
        :disabled="loading || !canRetry"
      >
        重试
      </button>
    </div>
  </div>
</template>

<style scoped>
.messages {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px;
  height: 420px;
  overflow-y: auto;
  background: linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.5),
      rgba(255, 255, 255, 0.15)
    ),
    var(--panel);
  box-shadow: var(--shadow-sm);
}
.messages::-webkit-scrollbar {
  width: 10px;
}
.messages::-webkit-scrollbar-thumb {
  background: rgba(100, 116, 139, 0.35);
  border-radius: 999px;
  border: 3px solid transparent;
  background-clip: content-box;
}
.messages::-webkit-scrollbar-track {
  background: transparent;
}

.errorbar {
  margin-top: 10px;
  border: 1px solid rgba(239, 68, 68, 0.35);
  background: rgba(239, 68, 68, 0.08);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.error-text {
  color: var(--danger);
  font-size: 12px;
}
button.mini {
  padding: 4px 8px;
  border-radius: 8px;
  font-size: 12px;
  border: 1px solid var(--border);
  background: var(--panel-solid);
  color: var(--text);
  cursor: pointer;
  transition: box-shadow 0.15s ease, border-color 0.15s ease;
}
button.mini:hover:not(:disabled) {
  box-shadow: var(--shadow-sm);
  border-color: rgba(43, 111, 255, 0.35);
}
button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
</style>
