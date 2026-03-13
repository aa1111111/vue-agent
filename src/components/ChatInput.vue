<script setup>
/**
 * 输入区组件（纯 UI + 触发发送）
 *
 * 父组件（App.vue）负责真正的 send()：
 * - 组织 messages
 * - 请求后端
 * - 回填 assistant
 *
 * 这个组件只负责：
 * - 展示 textarea + 发送按钮
 * - 处理 Enter / Shift+Enter
 * - 通过 emits 通知父组件发送
 */
// defineModel：更简洁的 v-model 写法（替代 modelValue + update:modelValue）
const model = defineModel({ type: String, required: true });

defineProps({
  // 是否正在请求中（禁用输入）
  loading: { type: Boolean, default: false },
  // 是否允许发送（由父组件根据输入/状态计算）
  canSend: { type: Boolean, default: false },
});

// 只需要保留 send 事件
defineEmits(["send"]);
</script>

<template>
  <div class="input-area">
    <!-- 把输入内容回传给父组件（实现 v-model） -->
    <!-- Enter：直接发送并阻止默认换行 -->
    <!-- Shift+Enter：允许换行（这里 stop 防止被上面的 enter.exact 规则误处理） -->
    <textarea
      v-model="model"
      :disabled="loading"
      placeholder="输入你的问题…（Enter 发送，Shift+Enter 换行）"
      @keydown.enter.exact.prevent="$emit('send')"
      @keydown.enter.shift.exact.stop
    />
    <div class="send-row">
      <button class="primary" @click="$emit('send')" :disabled="!canSend">
        {{ loading ? "思考中…" : "发送" }}
      </button>
      <!-- 右侧提示区交给父组件决定文案 -->
      <slot name="tip" />
    </div>
  </div>
</template>

<style scoped>
.input-area {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
textarea {
  min-height: 90px;
  resize: vertical;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 12px 14px;
  outline: none;
  background: var(--panel-solid);
  color: var(--text);
  line-height: 1.55;
}
textarea:focus {
  border-color: rgba(43, 111, 255, 0.45);
  box-shadow: 0 0 0 3px rgba(43, 111, 255, 0.18);
}
.send-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
button {
  padding: 10px 14px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--panel-solid);
  color: var(--text);
  cursor: pointer;
  transition: transform 0.04s ease, box-shadow 0.15s ease, border-color 0.15s ease;
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
button.primary {
  border-color: rgba(43, 111, 255, 0.25);
  background: linear-gradient(135deg, var(--brand), var(--brand-2));
  color: #fff;
  box-shadow: 0 10px 20px rgba(43, 111, 255, 0.22);
}
</style>