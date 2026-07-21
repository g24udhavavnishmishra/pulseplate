const API_BASE = ""; // same-origin; backend serves the frontend too

const form = document.getElementById("profileForm");
const submitBtn = document.getElementById("submitBtn");
const output = document.getElementById("output");
const followupForm = document.getElementById("followupForm");
const followupInput = document.getElementById("followupInput");
const statusReadout = document.getElementById("statusReadout");

let messageHistory = [];
let rawBuffer = "";

// --- tiny markdown renderer (headings, bold, bullet lists, paragraphs) ---
function renderMarkdown(text) {
  const lines = text.split("\n");
  let html = "";
  let inList = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (/^#{1,3}\s+/.test(trimmed)) {
      if (inList) { html += "</ul>"; inList = false; }
      html += `<h3>${escapeHtml(trimmed.replace(/^#{1,3}\s+/, ""))}</h3>`;
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      if (!inList) { html += "<ul>"; inList = true; }
      html += `<li>${inlineFormat(trimmed.replace(/^[-*]\s+/, ""))}</li>`;
      continue;
    }

    if (trimmed === "") {
      if (inList) { html += "</ul>"; inList = false; }
      continue;
    }

    if (inList) { html += "</ul>"; inList = false; }
    html += `<p>${inlineFormat(trimmed)}</p>`;
  }
  if (inList) html += "</ul>";
  return html;
}

function inlineFormat(str) {
  let escaped = escapeHtml(str);
  escaped = escaped.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  return escaped;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function setStatus(text, syncing) {
  statusReadout.textContent = text;
  statusReadout.classList.toggle("syncing", !!syncing);
}

async function streamPlan(payload, isFollowup) {
  submitBtn.disabled = true;
  rawBuffer = "";
  setStatus("SYNCING", true);

  if (!isFollowup) {
    output.innerHTML = "";
  } else {
    output.insertAdjacentHTML("beforeend", `<p><strong>You:</strong> ${escapeHtml(payload.followup)}</p>`);
  }

  const liveEl = document.createElement("div");
  liveEl.className = "cursor-blink";
  output.appendChild(liveEl);

  try {
    const res = await fetch(`${API_BASE}/api/plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        isFollowup
          ? { followup: payload.followup, message_history: messageHistory }
          : payload
      ),
    });

    if (!res.ok || !res.body) {
      throw new Error(`Server responded with ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let partial = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      partial += decoder.decode(value, { stream: true });

      const events = partial.split("\n\n");
      partial = events.pop(); // last chunk may be incomplete

      for (const evt of events) {
        if (!evt.startsWith("data: ")) continue;
        const data = JSON.parse(evt.slice(6));

        if (data.error) {
          liveEl.outerHTML = `<div class="error-box">Something went wrong: ${escapeHtml(data.error)}</div>`;
          setStatus("ERROR", true);
          submitBtn.disabled = false;
          return;
        }
        if (data.done) continue;
        if (data.text) {
          rawBuffer += data.text;
          liveEl.innerHTML = renderMarkdown(rawBuffer) + '<span class="cursor-blink"></span>';
        }
      }
    }

    liveEl.innerHTML = renderMarkdown(rawBuffer);
    messageHistory.push({ role: "user", content: isFollowup ? payload.followup : buildProfileText(payload) });
    messageHistory.push({ role: "assistant", content: rawBuffer });

    followupForm.classList.remove("hidden");
    setStatus("READY", false);
  } catch (err) {
    liveEl.outerHTML = `<div class="error-box">Couldn't reach the server: ${escapeHtml(err.message)}</div>`;
    setStatus("ERROR", true);
  } finally {
    submitBtn.disabled = false;
  }
}

function buildProfileText(payload) {
  return `Age: ${payload.age}; Body stats: ${payload.body_stats}; Activity: ${payload.activity_level}; ` +
         `Diet: ${payload.dietary_preference}; Restrictions: ${payload.restrictions}; Goal: ${payload.goal}; Notes: ${payload.notes}`;
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const payload = {
    age: document.getElementById("age").value.trim(),
    body_stats: document.getElementById("bodyStats").value.trim(),
    activity_level: document.getElementById("activityLevel").value,
    dietary_preference: document.getElementById("dietaryPreference").value,
    restrictions: document.getElementById("restrictions").value.trim(),
    goal: document.getElementById("goal").value,
    notes: document.getElementById("notes").value.trim(),
    message_history: [],
  };
  messageHistory = [];
  streamPlan(payload, false);
});

followupForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = followupInput.value.trim();
  if (!text) return;
  followupInput.value = "";
  streamPlan({ followup: text, message_history: messageHistory }, true);
});
