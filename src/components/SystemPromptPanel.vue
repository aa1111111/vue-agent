<script setup>
/**
 * 系统提示编辑面板（纯 UI + v-model 协议）
 *
 * - modelValue：父组件传入的 systemPrompt 文本
 * - update:modelValue：输入时回传给父组件（实现 v-model）
 * - blur：失焦时通知父组件“可以把 systemPrompt 同步写回 messages[0]”
 */
defineProps({
  // v-model 绑定值
  modelValue: { type: String, required: true },
  // 父组件控制禁用（比如正在请求时禁止编辑）
  disabled: { type: Boolean, default: false },
});

// v-model 事件 + 失焦事件
defineEmits(["update:modelValue", "blur"]);
</script>

<template>
  <div class="panel">
    <div class="label">系统提示（可选）</div>
    <!-- 用 :value 而不是 v-model：因为 v-model 在子组件里要手动实现（update:modelValue） -->
    <!-- 输入时，把新的值 emit 给父组件，让父组件更新 systemPrompt -->
    <!-- 失焦时通知父组件：把 systemPrompt 写回 messages[0] -->
    <textarea
      class="system"
      :value="modelValue"
      :disabled="disabled"
      placeholder="你希望这个 Agent 以什么身份/规则工作？"
      @input="$emit('update:modelValue', $event.target.value)"
      @blur="$emit('blur')"
    />
    <div class="hint">提示：修改后会自动写入对话的 system 消息（首条）。</div>
  </div>
</template>

<style scoped>
.panel {
  border: 1px solid var(--border);
  background: var(--panel);
  border-radius: var(--radius);
  padding: 12px;
  box-shadow: var(--shadow-sm);
}
.label {
  font-size: 12px;
  color: var(--muted);
  margin-bottom: 6px;
}
.hint {
  font-size: 12px;
  color: var(--muted);
  margin-top: 6px;
}
.system {
  width: calc(100% - 24px);
  min-height: 64px;
  resize: vertical;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  outline: none;
  background: var(--panel-solid);
  color: var(--text);
  line-height: 1.5;
}
.system:focus {
  border-color: rgba(43, 111, 255, 0.45);
  box-shadow: 0 0 0 3px rgba(43, 111, 255, 0.18);
}
</style>
