<script setup>
/**
 * 顶部栏组件（纯 UI）
 * - 不管理任何业务状态
 * - 通过 props 控制禁用/可重试
 * - 通过 emits 把用户操作“抛给父组件（App.vue）”处理
 */
defineProps({
  // 是否正在请求中：用于禁用按钮，避免重复操作
  loading: { type: Boolean, default: false },
  // 是否存在“上一条用户消息”：没有就不允许重试
  canRetry: { type: Boolean, default: false },
});

// reset/retry 事件由父组件决定具体怎么做（清空对话、重发上一条等）
defineEmits(["reset", "retry", "stop", "regenerate"]);
</script>

<template>
  <div class="topbar">
    <!-- 标题 -->
    <div class="title">AI Agent</div>

    <div class="actions">
      <!-- 停止生成：仅在 loading 时显示（中断流式请求） -->
      <button
        v-if="loading"
        class="danger"
        @click="$emit('stop')"
        :disabled="!loading"
      >
        停止生成
      </button>

      <!-- 重新生成：常见产品逻辑（不新增 user 消息，重生成最后一次回答） -->
      <button
        v-if="!loading"
        class="ghost"
        @click="$emit('regenerate')"
        :disabled="!canRetry"
      >
        重新生成
      </button>

      <!-- 清空：点击触发 reset 事件 -->
      <button class="ghost" @click="$emit('reset')" :disabled="loading">
        清空对话
      </button>
      <!-- 重试：点击触发 retry 事件；无可重试内容或 loading 时禁用 -->
      <button
        class="ghost"
        @click="$emit('retry')"
        :disabled="loading || !canRetry"
      >
        重试上一条
      </button>
    </div>
  </div>
</template>

<style scoped>
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.title {
  font-weight: 700;
  font-size: 18px;
  letter-spacing: 0.2px;
}
.actions {
  display: flex;
  gap: 8px;
}

button {
  padding: 8px 12px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--panel-solid);
  color: var(--text);
  cursor: pointer;
  transition: transform 0.04s ease, background 0.15s ease,
    border-color 0.15s ease, box-shadow 0.15s ease;
}
button:hover:not(:disabled) {
  box-shadow: var(--shadow-sm);
  border-color: rgba(43, 111, 255, 0.35);
}
button:active:not(:disabled) {
  transform: translateY(1px);
}
button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
button.ghost {
  background: var(--panel);
}
button.danger {
  border-color: rgba(239, 68, 68, 0.35);
  background: rgba(239, 68, 68, 0.12);
}
button.danger:hover:not(:disabled) {
  border-color: rgba(239, 68, 68, 0.55);
}
</style>
