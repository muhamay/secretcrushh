const $ = (selector) => document.querySelector(selector);
const messagesEl = $("#messages");
const welcomeEl = $("#welcome");
const inputEl = $("#messageInput");
const sendButton = $("#sendButton");
const historyList = $("#historyList");
const sidebar = $("#sidebar");
const STORAGE_KEY = "xataniel_ai_chats_v1";

let chats = loadChats();
let activeChatId = chats[0]?.id || null;
let busy = false;

function loadChats() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch { return []; }
}
function saveChats() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
}
function currentChat() {
  return chats.find(chat => chat.id === activeChatId);
}
function createChat() {
  const chat = { id: crypto.randomUUID(), title: "Percakapan baru", messages: [] };
  chats.unshift(chat);
  activeChatId = chat.id;
  saveChats();
  render();
  inputEl.focus();
}
function renderHistory() {
  historyList.innerHTML = "";
  chats.forEach(chat => {
    const button = document.createElement("button");
    button.className = "history-item" + (chat.id === activeChatId ? " active" : "");
    button.textContent = chat.title;
    button.title = chat.title;
    button.addEventListener("click", () => {
      activeChatId = chat.id;
      render();
      sidebar.classList.remove("open");
    });
    historyList.append(button);
  });
}
function addMessage(role, text) {
  const row = document.createElement("div");
  row.className = `message ${role}`;
  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = role === "user" ? "K" : "X";
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;
  row.append(avatar, bubble);
  messagesEl.append(row);
  return bubble;
}
function render() {
  renderHistory();
  const chat = currentChat();
  messagesEl.innerHTML = "";
  const hasMessages = Boolean(chat?.messages?.length);
  welcomeEl.hidden = hasMessages;
  if (chat) chat.messages.forEach(item => addMessage(item.role, item.text));
  messagesEl.scrollTop = messagesEl.scrollHeight;
}
function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2600);
}
async function sendMessage(text) {
  const message = text.trim();
  if (!message || busy) return;
  if (!currentChat()) createChat();
  const chat = currentChat();

  busy = true;
  sendButton.disabled = true;
  welcomeEl.hidden = true;
  chat.messages.push({ role: "user", text: message });
  if (chat.messages.length === 1) chat.title = message.slice(0,  thirtyFive());
  saveChats();
  render();
  inputEl.value = "";
  inputEl.style.height = "auto";

  const typingBubble = addMessage("model", "XATANIEL AI sedang berpikir...");
  typingBubble.classList.add("typing");

  try {
    const history = chat.messages.slice(0, -1).slice(-10).map(item => ({
      role: item.role,
      text: item.text
    }));
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, history })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Permintaan gagal.");
    chat.messages.push({ role: "model", text: data.answer });
    typingBubble.textContent = data.answer;
    typingBubble.classList.remove("typing");
    saveChats();
    renderHistory();
  } catch (error) {
    typingBubble.textContent = error.message || "Terjadi kesalahan. Coba lagi.";
    typingBubble.classList.remove("typing");
    toast("Pesan belum berhasil dikirim.");
  } finally {
    busy = false;
    sendButton.disabled = false;
    inputEl.focus();
  }
}
function thirtyFive() { return 35; }

$("#chatForm").addEventListener("submit", event => {
  event.preventDefault();
  sendMessage(inputEl.value);
});
inputEl.addEventListener("input", () => {
  inputEl.style.height = "auto";
  inputEl.style.height = `${Math.min(inputEl.scrollHeight, 150)}px`;
});
inputEl.addEventListener("keydown", event => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    $("#chatForm").requestSubmit();
  }
});
$("#newChat").addEventListener("click", () => {
  createChat();
  sidebar.classList.remove("open");
});
$("#menuButton").addEventListener("click", () => sidebar.classList.toggle("open"));
document.querySelectorAll(".suggestion").forEach(button => {
  button.addEventListener("click", () => sendMessage(button.dataset.prompt || ""));
});

if (!activeChatId) createChat();
else render();

