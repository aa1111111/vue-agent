<script setup>
import { computed, onMounted, provide, ref, watch } from "vue";
import axios from "axios";
import AgentTopbar from "./components/AgentTopbar.vue";
import SystemPromptPanel from "./components/SystemPromptPanel.vue";
import ChatMessages from "./components/ChatMessages.vue";
import ChatInput from "./components/ChatInput.vue";
import { renderLiteMarkdown } from "./utils/liteMarkdown.js";

/**
 * ======== 数据结构说明 ========
 * message: { id: string, role: 'system'|'user'|'assistant', content: string }
 * toolCalls: [{ name: string, args?: object, result?: string }]
 */

/**
 * 这个文件是“页面编排层”（Controller）：
 * - 管理所有状态（messages/systemPrompt/loading 等）
 * - 负责请求后端 /api/chat，并把结果写回消息列表
 * - 负责 localStorage 持久化
 *
 * UI 被拆到 components/ 下：
 * - AgentTopbar：顶部按钮
 * - SystemPromptPanel：系统提示编辑
 * - ChatMessages/MessageItem：消息列表与单条消息展示
 * - ChatInput：输入与发送
 */

const STORAGE_KEY = "vue-agent:v1";

function uid() {
  // 生成前端使用的唯一 id，用于 v-for 的 key、工具调用映射等
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function safeJsonParse(str, fallback) {
  // 解析 localStorage 中的 JSON，失败就返回 fallback（避免页面崩溃）
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

const defaultSystem = "你是一个简洁的中文 AI 助手。";

// 可编辑的系统提示（System Prompt），用于控制“Agent 的行为风格/规则”
const systemPrompt = ref(defaultSystem);

// 对话消息列表：第一条固定为 system（不显示在 UI，但会发给后端/模型）
const messages = ref([
  { id: uid(), role: "system", content: systemPrompt.value },
]);

/** toolCallsByMsgId: { [assistantMessageId]: toolCalls[] } */
// 记录某条 assistant 回复背后调用了哪些工具（用于可解释性 UI）
const toolCallsByMsgId = ref({});

// 输入框内容
const input = ref("");
// 是否在请求中（控制禁用、加载态）
const loading = ref(false);
// 最近一次错误信息（用于错误条）
const lastError = ref("");
// 上一次用户输入（用于“一键重试”）
const lastUserText = ref("");

// 引用 ChatMessages 组件实例，用来调用其暴露的 scrollToBottom()
const messagesView = ref(null);

// 发送按钮是否可用：不在 loading 且输入非空
const canSend = computed(() => {
  return !loading.value && input.value.trim().length > 0;
});

function syncSystemMessage() {
  // 确保 messages[0] 始终是 system
  if (!messages.value.length || messages.value[0].role !== "system") {
    // 不存在 system 时插入一条
    messages.value.unshift({
      id: uid(),
      role: "system",
      content: systemPrompt.value,
    });
  } else {
    // 存在则更新内容（保持 systemPrompt 与 messages[0] 一致）
    messages.value[0].content = systemPrompt.value;
  }
}

async function scrollToBottom() {
  // 让 ChatMessages 自己控制滚动容器；这里仅调用其暴露方法
  await messagesView.value?.scrollToBottom?.();
}

async function send() {
  // 读取用户输入（trim 防止纯空格）
  const text = input.value.trim();
  // 空输入或正在请求时不发送
  if (!text || loading.value) return;

  // 清掉旧错误提示
  lastError.value = "";
  // 每次发送前同步 system 消息（确保后端收到正确 system prompt）
  syncSystemMessage();

  // 追加 user 消息
  messages.value.push({ id: uid(), role: "user", content: text });
  // 保存这一条，供“重试上一条”使用
  lastUserText.value = text;

  // 清空输入框
  input.value = "";
  // 进入请求中
  loading.value = true;
  // 让用户看到刚刚追加的消息
  await scrollToBottom();

  // 先插入一个“占位 assistant”，保证 UI 立刻有响应
  const assistantId = uid();
  // 记录占位消息所在下标，后面会原地替换为真实回复
  const assistantIndex = messages.value.length;
  messages.value.push({
    id: assistantId,
    role: "assistant",
    content: "思考中...",
  });
  await scrollToBottom();

  try {
    // 调后端：把当前完整对话发过去（只传 role/content，避免把前端 id 泄漏给后端）
    const resp = await axios.post("/api/chat", {
      messages: messages.value.map(({ role, content }) => ({ role, content })),
    });

    // 后端约定返回：{ reply: { role:'assistant', content }, toolCalls?: [] }
    const reply = resp.data?.reply;
    const toolCalls = resp.data?.toolCalls;

    const content = reply?.content ?? "";
    // 用真实回复替换“占位 assistant”
    messages.value[assistantIndex] = {
      id: assistantId,
      // 这里强制 assistant，避免后端异常返回导致 UI 分支混乱
      role: reply?.role === "assistant" ? "assistant" : "assistant",
      content: content || "(空回复)",
    };

    // 如果后端返回工具调用记录，就绑定到这条 assistant 的 id 上，供 MessageItem 展示
    if (Array.isArray(toolCalls) && toolCalls.length > 0) {
      toolCallsByMsgId.value[assistantId] = toolCalls;
    } else {
      // 没有工具调用就清理旧数据（避免持久化/复用导致的脏显示）
      delete toolCallsByMsgId.value[assistantId];
    }
  } catch (e) {
    // 统一错误信息提取：优先后端 error 字段，其次 axios message
    const msg = e?.response?.data?.error || e?.message || "未知错误";
    lastError.value = msg;
    // 把占位 assistant 替换为错误提示（仍作为 assistant 展示给用户）
    messages.value[assistantIndex] = {
      id: assistantId,
      role: "assistant",
      content: `出错了：${msg}`,
    };
    // 错误时不展示工具调用
    delete toolCallsByMsgId.value[assistantId];
  } finally {
    // 请求结束：解除 loading，滚动到底部让用户看到最终结果
    loading.value = false;
    await scrollToBottom();
  }
}

async function retryLast() {
  // 只要正在请求就不允许重试
  if (loading.value) return;
  // 没有上一条用户消息也没法重试
  if (!lastUserText.value) return;
  // 回填输入框（让用户看见“将要重试什么”）
  input.value = lastUserText.value;
  // 直接走 send()（会生成新的 user/assistant 消息对）
  await send();
}

function resetChat() {
  // 清空所有 UI 与业务相关状态
  lastError.value = "";
  lastUserText.value = "";
  toolCallsByMsgId.value = {};
  // 重置 messages：只保留 system
  messages.value = [{ id: uid(), role: "system", content: systemPrompt.value }];
}

async function copyText(text) {
  try {
    // 浏览器剪贴板 API：把消息内容复制出去
    await navigator.clipboard.writeText(String(text ?? ""));
  } catch {
    // 忽略：某些环境可能不允许 clipboard
  }
}

// 下发给子组件使用：MessageItem 里会 inject("copyText")
provide("copyText", copyText);

// ======== 持久化 ========

onMounted(() => {
  // 首次加载页面：从 localStorage 恢复会话
  const saved = safeJsonParse(localStorage.getItem(STORAGE_KEY) || "", null);
  if (saved && typeof saved === "object") {
    if (typeof saved.systemPrompt === "string")
      systemPrompt.value = saved.systemPrompt;
    if (Array.isArray(saved.messages) && saved.messages.length) {
      // 基本校验
      messages.value = saved.messages
        .filter((x) => x && typeof x === "object" && typeof x.role === "string")
        .map((x) => ({
          id: typeof x.id === "string" ? x.id : uid(),
          role: x.role,
          content: String(x.content ?? ""),
        }));
    } else {
      messages.value = [
        { id: uid(), role: "system", content: systemPrompt.value },
      ];
    }
    if (saved.toolCallsByMsgId && typeof saved.toolCallsByMsgId === "object") {
      toolCallsByMsgId.value = saved.toolCallsByMsgId;
    }
    if (typeof saved.lastUserText === "string")
      lastUserText.value = saved.lastUserText;
  }

  // 恢复后再兜底保证 system 消息正确
  syncSystemMessage();
  // UI 打开后滚动到最新消息
  scrollToBottom();
});

watch(
  () => [
    systemPrompt.value,
    messages.value,
    toolCallsByMsgId.value,
    lastUserText.value,
  ],
  () => {
    // 任何关键状态变动都写入 localStorage，实现“刷新不丢”
    const payload = {
      systemPrompt: systemPrompt.value,
      messages: messages.value,
      toolCallsByMsgId: toolCallsByMsgId.value,
      lastUserText: lastUserText.value,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  },
  { deep: true }
);
</script>

<template>
  <div class="app">
    <!-- 顶部栏：按钮只发事件，不处理业务 -->
    <AgentTopbar
      :loading="loading"
      :can-retry="!!lastUserText"
      @reset="resetChat"
      @retry="retryLast"
    />

    <!-- 系统提示面板：v-model 绑定 systemPrompt -->
    <SystemPromptPanel
      v-model="systemPrompt"
      :disabled="loading"
      @blur="syncSystemMessage"
    />

    <!-- 消息列表：renderLiteMarkdown 作为渲染函数传入 -->
    <ChatMessages
      ref="messagesView"
      :messages="messages"
      :tool-calls-by-msg-id="toolCallsByMsgId"
      :last-error="lastError"
      :loading="loading"
      :can-retry="!!lastUserText"
      :render="renderLiteMarkdown"
      @retry="retryLast"
    />

    <!-- 输入区：v-model 绑定 input，send 事件触发 send() -->
    <ChatInput v-model="input" :loading="loading" :can-send="canSend" @send="send">
      <template #tip>
        <div class="tip">
          {{
            messages.length > 1 ? "已记录对话（刷新不丢）" : "开始一次对话吧"
          }}
        </div>
      </template>
    </ChatInput>
  </div>
</template>

<style scoped>
.app {
  /* 主题变量：统一页面与子组件观感（子组件会继承这些 CSS 变量） */
  --bg: #f7f8fb;
  --panel: rgba(255, 255, 255, 0.9);
  --panel-solid: #ffffff;
  --text: #0f172a;
  --muted: #64748b;
  --border: rgba(15, 23, 42, 0.12);
  --shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
  --shadow-sm: 0 4px 14px rgba(15, 23, 42, 0.08);
  --radius: 14px;
  --radius-sm: 10px;
  --brand: #2b6fff;
  --brand-2: #6d28d9;
  --danger: #ef4444;
  --code-bg: #0b1220;
  --code-border: #1b2a4a;
  --code-head: #0f1930;
  --code-text: #e6eefc;

  max-width: 980px;
  width: 100%;
  margin: 22px auto;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  color: var(--text);

  background: radial-gradient(
      1200px 500px at 15% -10%,
      rgba(43, 111, 255, 0.12),
      transparent 60%
    ),
    radial-gradient(
      1200px 500px at 85% -10%,
      rgba(109, 40, 217, 0.12),
      transparent 60%
    ),
    var(--bg);
  border: 1px solid var(--border);
  border-radius: calc(var(--radius) + 4px);
  box-shadow: var(--shadow);
  backdrop-filter: blur(10px);
}

.tip {
  font-size: 12px;
  color: var(--muted);
  white-space: nowrap;
}

@media (prefers-color-scheme: dark) {
  .app {
    --bg: #0b1020;
    --panel: rgba(15, 23, 42, 0.72);
    --panel-solid: #0f172a;
    --text: #e5e7eb;
    --muted: #94a3b8;
    --border: rgba(148, 163, 184, 0.22);
    --shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
    --shadow-sm: 0 6px 18px rgba(0, 0, 0, 0.4);
  }
}
</style>
