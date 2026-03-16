<script setup>
import { computed, onMounted, provide, ref, watch } from "vue"; // 引入 Vue 组合式 API
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

// 默认 system 提示：建议模型输出 Markdown（前端会用 renderLiteMarkdown 渲染）
const defaultSystem =
  "你是一个简洁的中文 AI 助手。请优先使用 Markdown 输出（代码块用```，列表用-）。";

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

// ===== 流式控制：用于“停止生成” =====
const activeStreamController = ref(null); // 保存当前 fetch 的 AbortController（若没有流式则为 null）
const stopRequested = ref(false); // 标记是否用户主动停止（避免触发兜底回退）

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

// ===== 流式滚动：保持始终贴底（产品要求“流式时始终在最下面”） =====
let scrollRafId = 0; // requestAnimationFrame 的 id（用于节流）
function scheduleAutoScrollToBottom() {
  if (scrollRafId) return; // 若本帧已安排滚动，就不重复安排
  scrollRafId = requestAnimationFrame(() => {
    scrollRafId = 0; // 清理本帧标记
    // 优先用同步贴底（更适合流式高频更新）；没有则退化为异步贴底
    messagesView.value?.scrollToBottomNow?.() || scrollToBottom();
  });
}

// 停止生成：中断当前流式请求（保留已生成内容）
function stopGeneration() {
  stopRequested.value = true; // 标记为“用户主动停止”
  try {
    activeStreamController.value?.abort(); // 中断 fetch（会触发 AbortError）
  } catch {
    // ignore：abort 失败不影响 UI
  }
}

// 重新生成：截断到最后一条 user 消息，并重新生成它的 assistant 回复
async function regenerateLast() {
  if (loading.value) return; // 正在生成时不允许重新生成

  // 从后往前找到最后一条 user 消息的位置
  let lastUserIndex = -1; // 初始化为 -1，表示未找到
  for (let i = messages.value.length - 1; i >= 0; i--) {
    if (messages.value[i]?.role === "user") {
      lastUserIndex = i;
      break;
    }
  }
  if (lastUserIndex === -1) return; // 没有 user 消息则无法重新生成

  // 清空错误提示
  lastError.value = "";
  // 重新生成不是“停止”，清掉 stop 标记
  stopRequested.value = false;
  // 确保 system 消息同步（systemPrompt 可能被用户改过）
  syncSystemMessage();

  // 把最后一条 user 之后的消息全部删掉（包括旧 assistant）
  const removed = messages.value.splice(lastUserIndex + 1);
  // 同步清理被删 assistant 的 toolCalls（避免残留展示）
  for (const m of removed) {
    if (m?.id) delete toolCallsByMsgId.value[m.id];
  }

  // 进入 loading 状态
  loading.value = true;
  await scrollToBottom();

  // 插入新的占位 assistant
  const assistantId = uid();
  const assistantIndex = messages.value.length;
  messages.value.push({ id: assistantId, role: "assistant", content: "思考中..." });
  await scrollToBottom();

  try {
    // 流式优先
    await runStreamChat(assistantId, assistantIndex);
  } catch (streamError) {
    // 用户主动停止时不兜底
    if (stopRequested.value) return;
    // 回退到非流式
    await runNonStreamChat(assistantId, assistantIndex);
  } finally {
    loading.value = false;
    await scrollToBottom();
  }
}

/**
 * 发送消息入口：实现“流式优先 + 非流式兜底”的专业产品体验
 */
async function send() {
  // 读取用户输入（去掉前后空格）
  const text = input.value.trim();
  // 若输入为空或当前正在请求中，则直接返回（防止误触/重复点击）
  if (!text || loading.value) return;

  // 清空已有错误提示
  lastError.value = "";
  // 每次新发送前，把“停止”标记清掉
  stopRequested.value = false;
  // 每次发送前，确保 systemPrompt 已经同步到 messages[0]
  syncSystemMessage();

  // 把本次用户输入追加到对话列表
  messages.value.push({ id: uid(), role: "user", content: text });
  // 记录本次用户输入，方便“重试上一条”
  lastUserText.value = text;

  // 清空输入框
  input.value = "";
  // 进入 loading 状态
  loading.value = true;
  // 让视图滚到最新位置，用户能看到刚发出的那条 user 消息
  await scrollToBottom();

  // 插入一条“占位”的 assistant 消息，先显示“思考中...”
  const assistantId = uid(); // 为这条 assistant 生成唯一 id
  const assistantIndex = messages.value.length; // 记录该条消息在数组中的下标，后面会覆盖内容
  messages.value.push({
    id: assistantId,
    role: "assistant",
    content: "思考中...",
  });
  await scrollToBottom();

  try {
    // ===== 第一优先级：尝试使用流式接口 /api/chat/stream，实现打字机效果 =====
    await runStreamChat(assistantId, assistantIndex);
  } catch (streamError) {
    // 如果用户主动点击“停止生成”，就不再兜底回退（保留已生成内容）
    if (stopRequested.value) return;
    // 如果流式接口不可用（404/500/网络问题等），记录警告并回退到非流式接口
    console.warn("流式接口失败，回退到非流式 /api/chat：", streamError);
    try {
      // ===== 第二优先级：回退到普通 axios.post("/api/chat")，一次性拿完整回复 + toolCalls =====
      await runNonStreamChat(assistantId, assistantIndex);
    } catch (nonStreamError) {
      // 非流式也失败时，给用户一个统一错误提示
      const msg =
        nonStreamError?.response?.data?.error ||
        nonStreamError?.message ||
        "模型调用失败";
      lastError.value = msg;
      messages.value[assistantIndex] = {
        id: assistantId,
        role: "assistant",
        content: `出错了：${msg}`,
      };
      delete toolCallsByMsgId.value[assistantId];
    }
  } finally {
    // 无论流式/非流式成功与否，最后都解除 loading，并滚动到底部
    loading.value = false;
    await scrollToBottom();
  }
}

/**
 * 流式聊天：调用 /api/chat/stream，按 SSE 增量更新占位 assistant 内容
 */
async function runStreamChat(assistantId, assistantIndex) {
  // 创建 AbortController：用于支持“停止生成”
  const controller = new AbortController();
  // 保存 controller，stopGeneration() 会调用 abort()
  activeStreamController.value = controller;

  // 用 fetch 调后端流式接口（SSE）
  const resp = await fetch("/api/chat/stream", {
    method: "POST", // POST：携带 JSON body
    headers: { "Content-Type": "application/json" }, // JSON 内容类型
    signal: controller.signal, // 绑定 abort 信号
    body: JSON.stringify({
      messages: messages.value.map(({ role, content }) => ({ role, content })), // 只发 role/content
    }),
  });

  // 如果 HTTP 状态不是 2xx，或者 response 没有可读 body，则认为流式不可用
  if (!resp.ok || !resp.body) {
    throw new Error(`HTTP ${resp.status}：流式接口不可用`);
  }

  // 清空占位 assistant 内容，准备接收增量文本
  messages.value[assistantIndex].content = "";
  // 确保这条消息上没有旧的工具调用残留
  delete toolCallsByMsgId.value[assistantId];

  // 获取流式 reader 和 UTF-8 解码器
  const reader = resp.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = ""; // 暂存尚未拆分为完整 SSE 事件的文本

  // 持续从流中读取数据，直到 done 为 true
  try {
    while (true) {
    const { value, done } = await reader.read(); // 读一个 chunk
    if (done) break; // 读完退出循环

    // 把本次 chunk 解码为字符串，并追加到 buffer
    buffer += decoder.decode(value, { stream: true });

    let sepIndex;
    // buffer 中可能包含多个事件（或半个事件），按 "\n\n" 分块解析
    while ((sepIndex = buffer.indexOf("\n\n")) !== -1) {
      const rawEvent = buffer.slice(0, sepIndex); // 当前完整事件块
      buffer = buffer.slice(sepIndex + 2); // 剩下的（可能是不完整的下一事件）

      const lines = rawEvent.split("\n"); // 按行拆分：event: / data:
      let event = "message"; // 默认事件名
      let data = ""; // 用来拼接 data 行

      // 逐行解析出 event 和 data
      for (const line of lines) {
        if (line.startsWith("event:")) {
          event = line.slice(6).trim(); // 取 "event:" 后面的内容
        } else if (line.startsWith("data:")) {
          data += line.slice(5).trim(); // 可能有多行 data，拼在一起
        }
      }

      // 没有 data 就跳过本事件
      if (!data) continue;

      let parsed;
      try {
        // 按 JSON 尝试解析 data
        parsed = JSON.parse(data);
      } catch {
        // 如果解析失败，兜底为 { text: 原始字符串 }
        parsed = { text: data };
      }

      // 根据不同 event 类型做对应处理
      if (event === "delta") {
        // delta：本次增量文本
        const deltaText = parsed?.text ?? "";
        if (deltaText) {
          // 将增量内容追加到当前 assistant 消息上
          messages.value[assistantIndex].content += deltaText;
          // 产品要求：流式时始终贴底滚动（用 rAF 节流，避免卡顿）
          scheduleAutoScrollToBottom();
        }
      } else if (event === "error") {
        // error：后端主动推送的错误信息
        const msg = parsed?.message || "流式输出出错";
        lastError.value = msg;
        // 如果当前还没有任何回复内容，则直接显示错误文案
        messages.value[assistantIndex].content =
          messages.value[assistantIndex].content || `出错了：${msg}`;
      } else if (event === "done") {
        // done：表示模型输出结束，可以结束整个流式解析
        return;
      }
    }
  }
  } catch (e) {
    // 如果是用户主动 abort，会抛 AbortError：这不是“失败”，直接结束即可
    if (e?.name === "AbortError") return;
    // 其它错误继续抛给上层，让 send() 去做兜底回退
    throw e;
  } finally {
    // 清理 controller 引用（避免下次误 abort）
    if (activeStreamController.value === controller) {
      activeStreamController.value = null;
    }
  }

  // 如果整段流式都没有写入任何内容，给一个兜底文本避免气泡空白
  if (!messages.value[assistantIndex].content) {
    messages.value[assistantIndex].content = "(空回复)";
  }
}

/**
 * 非流式聊天：调用 /api/chat，一次性拿到完整回复 + 工具调用列表
 */
async function runNonStreamChat(assistantId, assistantIndex) {
  // 用 axios 调用传统的非流式接口 /api/chat
  const resp = await axios.post("/api/chat", {
    messages: messages.value.map(({ role, content }) => ({ role, content })),
  });

  // 预期返回 { reply: {role, content}, toolCalls?: [] }
  const reply = resp.data?.reply;
  const toolCalls = resp.data?.toolCalls;

  // 用完整回复覆盖占位 assistant 内容
  messages.value[assistantIndex] = {
    id: assistantId,
    role: "assistant",
    content: reply?.content || "(空回复)",
  };

  // 如果后端返回了工具调用记录，则挂到该条消息上，供 UI 展示
  if (Array.isArray(toolCalls) && toolCalls.length > 0) {
    toolCallsByMsgId.value[assistantId] = toolCalls;
  } else {
    delete toolCallsByMsgId.value[assistantId];
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
      @stop="stopGeneration"
      @regenerate="regenerateLast"
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
    <ChatInput
      v-model="input"
      :loading="loading"
      :can-send="canSend"
      @send="send"
    >
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
