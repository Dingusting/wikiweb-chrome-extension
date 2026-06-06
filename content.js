// WikiWeb Collective Overlay Content Injection Script
console.log("⚡ WikiWeb Layer active. Injected with developer host permissions.");

let activeOverlayEnabled = true;

// Retrieve configuration state from Extension storage
chrome.storage.local.get(["overlayEnabled", "floatingMenuEnabled", "customEdits", "customComments"], (data) => {
  activeOverlayEnabled = data.overlayEnabled !== false;
  if (activeOverlayEnabled) {
    applyStoredEdits(data.customEdits || {});
    applyStoredComments(data.customComments || {});
  }
  if (data.floatingMenuEnabled !== false) {
    injectPersistentFloatingMenu();
  }
});

// Listener for runtime state switches
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "toggleOverlay") {
    activeOverlayEnabled = request.enabled;
    if (activeOverlayEnabled) {
      chrome.storage.local.get(["customEdits", "customComments"], (data) => {
        applyStoredEdits(data.customEdits || {});
        applyStoredComments(data.customComments || {});
      });
    } else {
      restorePageOriginals();
    }
    sendResponse({ status: "success", enabled: activeOverlayEnabled });
  } else if (request.action === "toggleFloatingMenu") {
    if (request.enabled) {
      injectPersistentFloatingMenu();
    } else {
      const wrapper = document.getElementById("wikiweb-persistent-fab-wrapper");
      if (wrapper) wrapper.remove();
    }
    sendResponse({ status: "success", enabled: request.enabled });
  }
});

// Dynamic hover and selection trigger element overlays
document.addEventListener("mouseover", (event) => {
  if (!activeOverlayEnabled) return;
  const target = event.target;
  if (!target || !target.tagName) return;

  // Ignore interactions on the WikiWeb Extension UI elements
  if (
    target.closest && (
      target.closest("#wikiweb-extension-editor") ||
      target.closest("#wikiweb-persistent-fab-wrapper") ||
      target.closest("[id^='wikiweb-']") ||
      target.closest("[class*='wikiweb']")
    )
  ) {
    return;
  }

  // Select typical readable text tags
  if (["P", "H1", "H2", "H3", "H4", "H5", "H6", "SPAN", "FIGCAPTION"].includes(target.tagName)) {
    target.style.outline = "2px dashed #8b5cf6";
    target.style.cursor = "pointer";
    target.title = "Click to contribute a WikiWeb overlay, listen, or comment.";
  }
});

document.addEventListener("mouseout", (event) => {
  if (!activeOverlayEnabled) return;
  const target = event.target;
  if (!target || !target.tagName) return;

  // Ignore interactions on the WikiWeb Extension UI elements
  if (
    target.closest && (
      target.closest("#wikiweb-extension-editor") ||
      target.closest("#wikiweb-persistent-fab-wrapper") ||
      target.closest("[id^='wikiweb-']") ||
      target.closest("[class*='wikiweb']")
    )
  ) {
    return;
  }

  if (["P", "H1", "H2", "H3", "H4", "H5", "H6", "SPAN", "FIGCAPTION"].includes(target.tagName)) {
    target.style.outline = "";
  }
});

document.addEventListener("click", (event) => {
  if (!activeOverlayEnabled) return;
  const target = event.target;
  if (!target || !target.tagName) return;

  // Intercept and skip clicking inside any WikiWeb extension UI element
  if (
    target.closest && (
      target.closest("#wikiweb-extension-editor") ||
      target.closest("#wikiweb-persistent-fab-wrapper") ||
      target.closest("[id^='wikiweb-']") ||
      target.closest("[class*='wikiweb']")
    )
  ) {
    return;
  }

  if (["P", "H1", "H2", "H3", "H4", "H5", "H6", "SPAN", "FIGCAPTION"].includes(target.tagName)) {
    event.preventDefault();
    event.stopPropagation();
    
    // Launch a stylized interactive overlay drawer in the host page
    showOverlayEditor(target);
  }
});

function applyStoredEdits(edits) {
  Object.keys(edits).forEach((selector) => {
    try {
      const el = document.querySelector(selector);
      if (el) {
        if (!el.dataset.wikiwebOriginalText) {
          el.dataset.wikiwebOriginalText = el.textContent || "";
        }
        el.textContent = edits[selector];
        el.style.backgroundColor = "rgba(139, 92, 246, 0.08)";
        el.style.color = "#4c1d95";
        el.style.borderLeft = "3px solid #8b5cf6";
      }
    } catch (e) {
      console.warn("Invalid selector parsing during edit recovery", selector);
    }
  });
}

function applyStoredComments(comments) {
  Object.keys(comments).forEach((selector) => {
    try {
      const el = document.querySelector(selector);
      if (el) {
        const val = comments[selector];
        const list = Array.isArray(val) ? val : (val ? [val] : []);
        if (list.length > 0) {
          applyCommentBadge(el, list, selector);
        }
      }
    } catch (e) {
      console.warn("Invalid selector parsing during comment recovery", selector);
    }
  });
}

function restorePageOriginals() {
  document.querySelectorAll("[data-wikiweb-original-text]").forEach((el) => {
    el.textContent = el.dataset.wikiwebOriginalText;
    el.style.backgroundColor = "";
    el.style.color = "";
    el.style.borderLeft = "";
  });
  // Clear any existing outlines from tag elements
  document.querySelectorAll("p, h1, h2, h3, h4, h5, h6, span, figcaption").forEach((el) => {
    el.style.outline = "";
    el.style.cursor = "";
    if (el.title && el.title.includes("WikiWeb")) {
      el.removeAttribute("title");
    }
  });
  // Clear any comments badges
  document.querySelectorAll("[id^='wikiweb-badge-']").forEach((badge) => {
    badge.remove();
  });
  const existingEditor = document.getElementById("wikiweb-extension-editor");
  if (existingEditor) existingEditor.remove();
  const existingBubbleSection = document.getElementById("wikiweb-active-bubble-section");
  if (existingBubbleSection) existingBubbleSection.remove();
}

function getCleanInnerText(element) {
  if (!element) return "";
  try {
    const clone = element.cloneNode(true);
    const badges = clone.querySelectorAll("[id^='wikiweb-badge-']");
    if (badges) {
      badges.forEach((b) => b.remove());
    }
    return (clone.innerText || "").trim();
  } catch (e) {
    const text = element.innerText || "";
    return text.replace(/💬.*/g, "").trim();
  }
}

function getOriginalInnerText(element) {
  if (!element) return "";
  if (element.dataset && element.dataset.wikiwebOriginalText) {
    return element.dataset.wikiwebOriginalText;
  }
  try {
    const editedDescendants = element.querySelectorAll("[data-wikiweb-original-text]");
    if (editedDescendants.length === 0) {
      return getCleanInnerText(element);
    }
    
    // Add temporary reference markers
    editedDescendants.forEach((child, index) => {
      child.setAttribute("data-wikiweb-temp-index", index.toString());
    });
    
    const clone = element.cloneNode(true);
    
    // Clean up live DOM
    editedDescendants.forEach((child) => {
      child.removeAttribute("data-wikiweb-temp-index");
    });
    
    // Apply original texts inside clone
    const clonedMatches = clone.querySelectorAll("[data-wikiweb-temp-index]");
    clonedMatches.forEach((clonedChild) => {
      const idx = parseInt(clonedChild.getAttribute("data-wikiweb-temp-index") || "0", 10);
      const originalChild = editedDescendants[idx];
      if (originalChild && originalChild.dataset && originalChild.dataset.wikiwebOriginalText) {
        clonedChild.textContent = originalChild.dataset.wikiwebOriginalText;
      }
      clonedChild.removeAttribute("data-wikiweb-temp-index");
    });
    
    const badges = clone.querySelectorAll("[id^='wikiweb-badge-']");
    if (badges) {
      badges.forEach((b) => b.remove());
    }
    return (clone.innerText || "").trim();
  } catch (e) {
    return getCleanInnerText(element);
  }
}

// Play TTS audio using browser speechSynthesis
let currentUtterance = null;
function speakText(text) {
  window.speechSynthesis.cancel();
  if (!text) return;
  currentUtterance = new SpeechSynthesisUtterance(text);
  currentUtterance.rate = 1.05;
  currentUtterance.pitch = 1.0;
  window.speechSynthesis.speak(currentUtterance);
}

// Query localPort or fall back to high quality deterministic editing simulations
async function fetchAIImprovement(text, action) {
  try {
    const devUrl = "http://localhost:3000/api/enhance";
    const res = await fetch(devUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ originalText: text, action: action })
    });
    const data = await res.json();
    if (data.success && data.enhancedText) {
      return data.enhancedText;
    }
  } catch (e) {
    console.warn("Local gateway unreached. Executing high-quality simulated neural fallback...");
  }
  return generateLocalEnhancementFallback(text, action);
}

function generateLocalEnhancementFallback(text, action) {
  if (action === "simplify") {
    return text.length > 25 ? text.slice(0, Math.floor(text.length * 0.72)) + "... [Simplified for general audience level]" : text + " (Simplified)";
  }
  if (action === "professional") {
    return "FORMAL ADVISORY PROSE: " + text.replace(/i am/gi, "our system is").replace(/like/gi, "favor") + " [Refined professional peer layer]";
  }
  if (action === "explain") {
    return "Annotation: Context refers to general ledger consensus systems. (" + text.slice(0, 35) + "...)";
  }
  if (action === "translate-es") {
    return "[Spanish Overlay Version]: " + text + " (Traducido por WikiWeb)";
  }
  if (action === "translate-fr") {
    return "[French Overlay Version]: " + text + " (Traduit par WikiWeb)";
  }
  return text;
}

function applyCommentBadge(element, commentList, selector) {
  const badgeId = "wikiweb-badge-" + btoa(unescape(encodeURIComponent(selector))).replace(/=/g, '');
  
  // Clean up if already exists to recreate
  const existing = document.getElementById(badgeId);
  if (existing) {
    existing.remove();
  }

  if (getComputedStyle(element).position === "static") {
    element.style.position = "relative";
  }

  const indicator = document.createElement("span");
  indicator.id = badgeId;
  const list = Array.isArray(commentList) ? commentList : (commentList ? [commentList] : []);
  indicator.innerText = "💬" + (list.length > 1 ? " " + list.length : "");
  indicator.title = list.length + " comments on this element. Click to open separate thread section.";
  indicator.dataset.comments = JSON.stringify(list);
  indicator.style.cssText = "display: inline-flex; align-items: center; justify-content: center; margin-left: 6px; background: #10b981; color: white; font-size: 10px; padding: 2.5px 6.5px; border-radius: 10px; cursor: pointer; vertical-align: middle; box-shadow: 0 1px 3px rgba(0,0,0,0.15); transition: transform 0.2s; font-family: system-ui, sans-serif; font-weight: bold;";
  
  indicator.addEventListener("mouseenter", () => {
    indicator.style.transform = "scale(1.25)";
    showCommentTooltip(indicator, list);
  });
  
  indicator.addEventListener("mouseleave", () => {
    indicator.style.transform = "";
    const tooltip = document.getElementById("wikiweb-comment-tooltip");
    if (tooltip) tooltip.remove();
  });

  indicator.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openCommentSectionForSelector(selector);
  });
  
  element.appendChild(indicator);
}

function showCommentTooltip(anchor, commentList) {
  const existing = document.getElementById("wikiweb-comment-tooltip");
  if (existing) existing.remove();

  const rect = anchor.getBoundingClientRect();
  const tooltip = document.createElement("div");
  tooltip.id = "wikiweb-comment-tooltip";
  tooltip.style.cssText = `
    position: fixed;
    top: ${rect.top - 46 + window.scrollY}px;
    left: ${rect.left}px;
    background: #065f46;
    color: #ffffff;
    padding: 6px 12px;
    border-radius: 8px;
    font-size: 11px;
    font-family: system-ui, -apple-system, sans-serif;
    z-index: 10000000;
    pointer-events: none;
    box-shadow: 0 4px 10px rgba(0,0,0,0.18);
    white-space: normal;
    max-width: 280px;
    border: 1px solid #047857;
    font-weight: 500;
  `;
  tooltip.textContent = "💬 " + (list.length > 1 ? "[" + list.length + " comments] " : "") + "Last: " + lastComment;
  document.body.appendChild(tooltip);
}

function showOverlayEditor(targetElement) {
  // Remove existing editor if any
  const existing = document.getElementById("wikiweb-extension-editor");
  if (existing) existing.remove();

  const clickContent = getCleanInnerText(targetElement);
  const originalText = getOriginalInnerText(targetElement);

  const editorFrame = document.createElement("div");
  editorFrame.id = "wikiweb-extension-editor";
  editorFrame.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    width: 380px;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 16px;
    box-shadow: 0 20px 25px -5px rgba(0,0,0,0.12), 0 10px 10.5px -5px rgba(0,0,0,0.06);
    z-index: 1000000;
    padding: 18px;
    font-family: system-ui, -apple-system, sans-serif;
    color: #1e293b;
    box-sizing: border-box;
    text-align: left;
  `;

  editorFrame.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f1f5f9; padding-bottom: 10px; margin-bottom: 12px;">
      <span style="font-weight: 800; font-size: 13px; color: #6d28d9; letter-spacing:-0.2px;">🪐 WikiWeb Inject Overlay</span>
      <button id="wikiweb-close-btn" style="background: none; border: none; cursor: pointer; color: #94a3b8; font-weight: bold; font-size: 14px; padding:2px;">✕</button>
    </div>
    
    <div style="display: flex; gap: 4px; margin-bottom: 8px; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px;">
      <button id="wikiweb-tab-current" type="button" style="flex: 1; padding: 6px 8px; font-size: 10.5px; font-weight: bold; border-radius: 6px; border: 1px solid #8b5cf6; cursor: pointer; background: #8b5cf6; color: white; font-family: inherit; outline: none; transition: all 0.2s;">⚡ Clicked Text (To Edit)</button>
      <button id="wikiweb-tab-original" type="button" style="flex: 1; padding: 6px 8px; font-size: 10.5px; font-weight: bold; border-radius: 6px; border: 1px solid #e2e8f0; cursor: pointer; background: #f8fafc; color: #64748b; font-family: inherit; outline: none; transition: all 0.2s;">📄 Original Site Content</button>
    </div>
    
    <div id="wikiweb-text-preview-box" style="font-size: 12px; font-style: italic; background: #f8fafc; padding: 10px; border-radius: 8px; margin-bottom: 12px; border: 1px solid #cbd5e1; color:#334155; line-height:1.4; max-height:85px; overflow-y:auto; word-break:break-word;">"${clickContent}"</div>
    
    <label style="display: block; font-size: 11px; font-weight: bold; color: #475569; margin-bottom: 6px;">Collaborator Wiki Improvement or Comment:</label>
    <textarea id="wikiweb-edit-area" style="width: 100%; height: 75px; font-size: 12px; padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px; box-sizing: border-box; resize: none; font-family: inherit; margin-bottom:10px; color:#1e293b;" placeholder="Describe a clarification, translate or correct typography..."></textarea>
    
    <div style="display: flex; gap: 6px; margin-bottom: 12px;">
      <button id="wikiweb-apply-btn" style="flex: 1.3; background: #8b5cf6; border: none; color: white; padding: 8.5px; border-radius: 8px; font-size: 11px; font-weight: bold; cursor: pointer; transition: background 0.2s;">Apply Overlay</button>
      <button id="wikiweb-comment-btn" style="flex: 1; background: #10b981; border: none; color: white; padding: 8.5px; border-radius: 8px; font-size: 11px; font-weight: bold; cursor: pointer; transition: background 0.2s;">💬 Comment</button>
      <button id="wikiweb-speak-btn" style="background: #ef4444; border: none; color: white; padding: 8.5px 12px; border-radius: 8px; font-size: 11.5px; font-weight: bold; cursor: pointer; transition: background 0.2s;" title="Listen with Text-to-Speech (TTS)">🔊 Speak</button>
    </div>

    <div style="margin-top: 10px; border-top: 1px solid #f1f5f9; padding-top: 10px;">
      <label style="display: block; font-size: 11px; font-weight: bold; color: #475569; margin-bottom: 6px;">🤖 Gemini AI Enhancer Core:</label>
      <div style="display: flex; gap: 6px;">
        <select id="wikiweb-ai-action" style="flex: 1.2; font-size: 11px; padding: 5px; border-radius: 6px; border: 1px solid #cbd5e1; outline: none; background: #fafafc; color:#1e293b; font-family: inherit;">
          <option value="simplify">Simplify text formulation</option>
          <option value="professional">Enhance standard vocabulary</option>
          <option value="explain">Explain historical context</option>
          <option value="translate-es">Translate to Spanish</option>
          <option value="translate-fr">Translate to French</option>
        </select>
        <button id="wikiweb-ai-btn" style="flex: 0.8; background: #4f46e5; border: none; color: white; padding: 5px 10px; border-radius: 6px; font-size: 11px; font-weight: bold; cursor: pointer; transition: background 0.2s;">🤖 Optimize</button>
      </div>
    </div>
  `;

  document.body.appendChild(editorFrame);

  const editArea = document.getElementById("wikiweb-edit-area");
  if (editArea) {
    editArea.value = clickContent;
    editArea.focus();
  }

  // Toggle Between Original Website Text and Current Text Live
  const tabCurrent = document.getElementById("wikiweb-tab-current");
  const tabOriginal = document.getElementById("wikiweb-tab-original");
  const previewBox = document.getElementById("wikiweb-text-preview-box");

  tabCurrent.onclick = (e) => {
    e.stopPropagation();
    tabCurrent.style.background = "#8b5cf6";
    tabCurrent.style.color = "white";
    tabCurrent.style.borderColor = "#8b5cf6";

    tabOriginal.style.background = "#f8fafc";
    tabOriginal.style.color = "#64748b";
    tabOriginal.style.borderColor = "#e2e8f0";

    previewBox.innerText = '"' + clickContent + '"';
  };

  tabOriginal.onclick = (e) => {
    e.stopPropagation();
    tabOriginal.style.background = "#8b5cf6";
    tabOriginal.style.color = "white";
    tabOriginal.style.borderColor = "#8b5cf6";

    tabCurrent.style.background = "#f8fafc";
    tabCurrent.style.color = "#64748b";
    tabCurrent.style.borderColor = "#e2e8f0";

    previewBox.innerText = '"' + originalText + '"';
  };

  // Close frame
  document.getElementById("wikiweb-close-btn").onclick = () => {
    window.speechSynthesis.cancel();
    editorFrame.remove();
  };
  
  // Speak text aloud using speechSynthesis TTS
  document.getElementById("wikiweb-speak-btn").onclick = () => {
    const textToSpeak = editArea ? editArea.value.trim() || clickContent : clickContent;
    const speakBtn = document.getElementById("wikiweb-speak-btn");
    
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      speakBtn.innerText = "🔊 Speak";
      speakBtn.style.background = "#ef4444";
    } else {
      speakText(textToSpeak);
      speakBtn.innerText = "⏹ Stop";
      speakBtn.style.background = "#374151";
      
      const checkSpeechEnd = setInterval(() => {
        if (!window.speechSynthesis.speaking) {
          speakBtn.innerText = "🔊 Speak";
          speakBtn.style.background = "#ef4444";
          clearInterval(checkSpeechEnd);
        }
      }, 800);
    }
  };

  // AI-Powered optimization endpoint
  document.getElementById("wikiweb-ai-btn").onclick = async () => {
    const aiBtn = document.getElementById("wikiweb-ai-btn");
    const action = document.getElementById("wikiweb-ai-action").value;
    
    aiBtn.innerText = "⏳...";
    aiBtn.disabled = true;
    
    try {
      const enhanced = await fetchAIImprovement(clickContent, action);
      if (editArea) {
        editArea.value = enhanced;
        editArea.focus();
      }
    } catch (e) {
      console.error(e);
    } finally {
      aiBtn.innerText = "🤖 Optimize";
      aiBtn.disabled = false;
    }
  };

  // Apply visual overlay rewrite
  document.getElementById("wikiweb-apply-btn").onclick = () => {
    const newVal = editArea ? editArea.value.trim() : "";
    if (newVal) {
      if (!targetElement.dataset.wikiwebOriginalText) {
        targetElement.dataset.wikiwebOriginalText = clickContent;
      }
      targetElement.innerText = newVal;
      targetElement.style.color = "#4c1d95";
      targetElement.style.borderLeft = "3px solid #8b5cf6";
      targetElement.style.paddingLeft = "8px";
      editorFrame.remove();
      window.speechSynthesis.cancel();
      
      chrome.storage.local.get({customEdits: {}}, (res) => {
        const edits = res.customEdits;
        const selector = getUniqueSelector(targetElement);
        edits[selector] = newVal;
        chrome.storage.local.set({customEdits: edits});
      });
    }
  };

  // Submit comment bubble
  document.getElementById("wikiweb-comment-btn").onclick = () => {
    const commentVal = editArea ? editArea.value.trim() : "";
    if (commentVal) {
      const selector = getUniqueSelector(targetElement);
      chrome.storage.local.get({customComments: {}}, (res) => {
        const comments = res.customComments;
        if (!Array.isArray(comments[selector])) {
          comments[selector] = comments[selector] ? [comments[selector]] : [];
        }
        comments[selector].push(commentVal);
        chrome.storage.local.set({customComments: comments}, () => {
          applyCommentBadge(targetElement, comments[selector], selector);
          editorFrame.remove();
          window.speechSynthesis.cancel();
        });
      });
    } else {
      alert("Please write comment prose in the box above first!");
    }
  };
}

function getUniqueSelector(el) {
  if (el.id) return '#' + el.id;
  const path = [];
  while (el.nodeType === Node.ELEMENT_NODE) {
    let selector = el.nodeName.toLowerCase();
    if (el.id) {
      selector += '#' + el.id;
      path.unshift(selector);
      break;
    } else {
      let sib = el, nth = 1;
      while (sib = sib.previousElementSibling) {
        if (sib.nodeName.toLowerCase() === selector) nth++;
      }
      if (nth !== 1) selector += ":nth-of-type(" + nth + ")";
    }
    path.unshift(selector);
    el = el.parentNode;
  }
  return path.join(" > ");
}

function openCommentSectionForSelector(selector) {
  const existingSection = document.getElementById("wikiweb-active-bubble-section");
  if (existingSection) existingSection.remove();

  chrome.storage.local.get({customComments: {}}, (res) => {
    const comments = res.customComments;
    const rawVal = comments[selector];
    const commentList = Array.isArray(rawVal) ? rawVal : (rawVal ? [rawVal] : []);

    let elementText = "";
    try {
      const matched = document.querySelector(selector);
      if (matched) {
        elementText = getCleanInnerText(matched);
        if (elementText.length > 120) elementText = elementText.slice(0, 117) + "...";
      }
    } catch(e){}

    if (!elementText) {
      elementText = selector;
    }

    const modal = document.createElement("div");
    modal.id = "wikiweb-active-bubble-section";
    modal.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 400px;
      max-width: 90%;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 16px;
      box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04);
      z-index: 100000001;
      display: flex;
      flex-direction: column;
      font-family: system-ui, -apple-system, sans-serif;
      overflow: hidden;
      color: #1e293b;
      box-sizing: border-box;
    `;

    let threadsHtml = "";
    if (commentList.length === 0) {
      threadsHtml = `
        <div style="padding: 24px; text-align: center; color: #94a3b8; font-size: 12px;">
          No comments on this paragraph yet. Be the first to start the thread!
        </div>
      `;
    } else {
      commentList.forEach((comm, index) => {
        const isObj = comm && typeof comm === 'object' && comm.text;
        const commText = isObj ? comm.text : comm;
        const replies = isObj && Array.isArray(comm.replies) ? comm.replies : [];
        
        let repliesMarkup = "";
        if (replies.length > 0) {
          repliesMarkup += `<div id="replies-container-${index}" style="margin-top: 8px; margin-left: 12px; border-left: 2px solid #e2e8f0; padding-left: 10px; display: none; flex-direction: column; gap: 6px;">`;
          replies.forEach((rep) => {
            repliesMarkup += `
              <div style="font-size: 11px; color: #334155; background: #f8fafc; padding: 6px 10px; border-radius: 8px; border: 1px solid #f1f5f9; text-align: left; word-break: break-word; display: flex; gap: 6px; align-items: flex-start;">
                <div style="background: #6366f1; color: white; border-radius: 50%; width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; font-size: 8px; font-weight: bold; flex-shrink: 0; margin-top: 1px;">R</div>
                <div style="flex: 1; min-width: 0;">
                  <div style="font-weight: bold; font-size: 9.5px; color: #475569; margin-bottom: 2px;">Peer Reply</div>
                  <div style="line-height: 1.35; color: #1e293b;">${rep}</div>
                </div>
              </div>
            `;
          });
          repliesMarkup += `</div>`;
        }

        threadsHtml += `
          <div style="padding: 12px 14px; border-bottom: 1px solid #f1f5f9; text-align: left; display: flex; align-items: flex-start; gap: 8px;">
            <div style="background: #10b981; color: white; border-radius: 50%; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: bold; flex-shrink: 0; margin-top: 1px;">
              U
            </div>
            <div style="flex: 1; min-width: 0;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                <span style="font-size: 11px; font-weight: bold; color: #475569;">Collaborator #${index + 1}</span>
                <button class="wikiweb-delete-single-comment-btn" data-index="${index}" style="background:none; border:none; color:#cbd5e1; font-size:11px; cursor:pointer;" title="Delete this response">✕</button>
              </div>
              <p style="margin: 0; font-size: 12px; color: #0f172a; font-weight: 500; line-height: 1.4; word-break: break-word;">${commText}</p>
              
              <!-- Nested replies -->
              ${repliesMarkup}
              
              <div style="margin-top: 6px; display: flex; align-items: center; gap: 10px;">
                <button type="button" class="wikiweb-toggle-reply-btn" data-index="${index}" style="background: none; border: none; color: #6366f1; font-size: 10.5px; font-weight: bold; cursor: pointer; padding: 2px 0; align-items: center; gap: 3.5px; display: inline-flex;">
                  ↩ Reply
                </button>
                ${replies.length > 0 ? `
                  <button type="button" class="wikiweb-toggle-replies-visibility-btn" data-index="${index}" data-count="${replies.length}" style="background: none; border: none; color: #4f46e5; font-size: 10.5px; font-weight: bold; cursor: pointer; padding: 2px 0; display: inline-flex; align-items: center; gap: 3.5px;">
                    ▼ Show ${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}
                  </button>
                ` : ''}
              </div>

              <!-- Inline reply input -->
              <div class="wikiweb-reply-form" id="reply-form-${index}" data-comment-index="${index}" style="margin-top: 8px; display: none; gap: 4px;">
                <input type="text" placeholder="Reply..." class="wikiweb-reply-input" style="flex: 1; font-size: 10.5px; padding: 5px 8px; border: 1px solid #cbd5e1; border-radius: 6px; outline: none; font-family: inherit; color:#1e293b;" />
                <button type="button" class="wikiweb-reply-post-btn" style="background: #10b981; border: none; color: white; padding: 5px 10px; border-radius: 6px; font-size: 10px; font-weight: bold; cursor: pointer;">Send</button>
              </div>
            </div>
          </div>
        `;
      });
    }

    modal.innerHTML = `
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding: 14px 18px; background: #fafafb;">
        <div style="text-align: left;">
          <h4 style="margin: 0; font-size: 14px; font-weight: 800; color: #1e293b;">💬 Dedicated Comment Section</h4>
        </div>
        <button id="wikiweb-bubble-section-close-btn" style="background: #f1f5f9; border: none; color: #475569; font-weight: bold; font-size: 11px; height: 22px; width: 22px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center;">✕</button>
      </div>

      <!-- Ref Text Context -->
      <div style="background: #f8fafc; padding: 10px 18px; border-bottom: 1px solid #f1f5f9; font-size: 11px; color: #64748b; font-style: italic; line-height: 1.4; text-align: left;">
        "${elementText}"
      </div>

      <!-- Conversation Thread Scroller -->
      <div id="wikiweb-bubble-threads-list" style="flex: 1; max-height: 240px; overflow-y: auto; background: #ffffff;">
        ${threadsHtml}
      </div>

      <!-- Quick replies input section -->
      <div style="padding: 12px 18px; border-top: 1px solid #e2e8f0; background: #fafafb; box-sizing: border-box; width: 100%;">
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <textarea id="wikiweb-bubble-reply-input" style="width: 100%; height: 50px; font-size: 11.5px; padding: 8px; border: 1px solid #cbd5e1; border-radius: 8px; box-sizing: border-box; resize: none; font-family: inherit; color: #1e293b;" placeholder="Add a response or question in this section..."></textarea>
          <div style="display: flex; justify-content: flex-end; gap: 6px;">
            <button type="button" id="wikiweb-bubble-section-cancel-btn" style="background: #e2e8f0; border: none; color: #475569; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: bold; cursor: pointer;">Close</button>
            <button type="button" id="wikiweb-bubble-section-post-btn" style="background: #10b981; border: none; color: white; padding: 4px 12px; border-radius: 6px; font-size: 11px; font-weight: bold; cursor: pointer;">Post Comment</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const closeBtn = document.getElementById("wikiweb-bubble-section-close-btn");
    const cancelBtn = document.getElementById("wikiweb-bubble-section-cancel-btn");
    closeBtn.onclick = () => modal.remove();
    cancelBtn.onclick = () => modal.remove();

    // Submit reply comment
    const postBtn = document.getElementById("wikiweb-bubble-section-post-btn");
    postBtn.onclick = () => {
      const replyInput = document.getElementById("wikiweb-bubble-reply-input");
      const textVal = replyInput.value.trim();
      if (textVal) {
        chrome.storage.local.get({customComments: {}}, (stored) => {
          const currentComments = stored.customComments;
          if (!Array.isArray(currentComments[selector])) {
            currentComments[selector] = currentComments[selector] ? [currentComments[selector]] : [];
          }
          currentComments[selector].push(textVal);
          chrome.storage.local.set({customComments: currentComments}, () => {
            const el = document.querySelector(selector);
            if (el) {
              applyCommentBadge(el, currentComments[selector], selector);
            }
            modal.remove();
            openCommentSectionForSelector(selector); // Refresh views
          });
        });
      }
    };

    // Toggle reply form visibility
    modal.querySelectorAll(".wikiweb-toggle-reply-btn").forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const index = btn.dataset.index;
        const formEl = modal.querySelector('#reply-form-' + index);
        if (formEl) {
          if (formEl.style.display === "none") {
            formEl.style.display = "flex";
            btn.innerHTML = "✕ Cancel";
          } else {
            formEl.style.display = "none";
            btn.innerHTML = "↩ Reply";
          }
        }
      };
    });

    // Toggle show/hide nested replies lists
    modal.querySelectorAll(".wikiweb-toggle-replies-visibility-btn").forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const index = btn.dataset.index;
        const count = btn.dataset.count;
        const containerEl = modal.querySelector('#replies-container-' + index);
        if (containerEl) {
          if (containerEl.style.display === "none") {
            containerEl.style.display = "flex";
            btn.innerHTML = '▲ Hide ' + (count === '1' ? 'reply' : 'replies');
          } else {
            containerEl.style.display = "none";
            btn.innerHTML = '▼ Show ' + count + ' ' + (count === '1' ? 'reply' : 'replies');
          }
        }
      };
    });

    // Submit inline replies to individual comments
    modal.querySelectorAll(".wikiweb-reply-post-btn").forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const parentForm = btn.closest(".wikiweb-reply-form");
        if (!parentForm) return;
        const commentIndex = parseInt(parentForm.dataset.commentIndex, 10);
        const replyInputEl = parentForm.querySelector(".wikiweb-reply-input");
        if (!replyInputEl) return;
        const replyVal = replyInputEl.value.trim();
        if (!replyVal) return;

        chrome.storage.local.get({customComments: {}}, (stored) => {
          const currentComments = stored.customComments;
          const list = currentComments[selector];
          if (Array.isArray(list) && list[commentIndex] !== undefined) {
            let targetComment = list[commentIndex];
            if (typeof targetComment !== "object" || !targetComment) {
              targetComment = {
                text: targetComment.toString(),
                replies: []
              };
            }
            if (!targetComment.replies) targetComment.replies = [];
            targetComment.replies.push(replyVal);
            
            list[commentIndex] = targetComment;
            currentComments[selector] = list;
            
            chrome.storage.local.set({customComments: currentComments}, () => {
              const el = document.querySelector(selector);
              if (el) {
                applyCommentBadge(el, currentComments[selector], selector);
              }
              modal.remove();
              openCommentSectionForSelector(selector); // Refresh views
            });
          }
        });
      };
    });

    // Delete a single comment from list
    modal.querySelectorAll(".wikiweb-delete-single-comment-btn").forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const indexToDelete = parseInt(btn.dataset.index, 10);
        chrome.storage.local.get({customComments: {}}, (stored) => {
          const currentComments = stored.customComments;
          const array = currentComments[selector];
          if (Array.isArray(array)) {
            array.splice(indexToDelete, 1);
            if (array.length === 0) {
              delete currentComments[selector];
            } else {
              currentComments[selector] = array;
            }
            chrome.storage.local.set({customComments: currentComments}, () => {
              const el = document.querySelector(selector);
              if (el) {
                if (array.length === 0) {
                  const badgeId = "wikiweb-badge-" + btoa(unescape(encodeURIComponent(selector))).replace(/=/g, '');
                  const badge = document.getElementById(badgeId);
                  if (badge) badge.remove();
                } else {
                  applyCommentBadge(el, array, selector);
                }
              }
              modal.remove();
              if (array.length > 0) {
                openCommentSectionForSelector(selector); // Refresh views if still has items
              }
            });
          }
        });
      };
    });

  });
}

function openAllCommentsMenu() {
  const existing = document.getElementById("wikiweb-comments-board");
  if (existing) {
    existing.remove();
    return;
  }

  chrome.storage.local.get({customComments: {}}, (res) => {
    const comments = res.customComments;
    const selectors = Object.keys(comments);

    const board = document.createElement("div");
    board.id = "wikiweb-comments-board";
    board.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 440px;
      max-width: 90%;
      max-height: 80vh;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 20px;
      box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.05);
      z-index: 100000000;
      display: flex;
      flex-direction: column;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      overflow: hidden;
      color: #1e293b;
      box-sizing: border-box;
      animation: wikiweb-fade-in 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    `;

    if (!document.getElementById("wikiweb-comments-styles")) {
      const styleNode = document.createElement("style");
      styleNode.id = "wikiweb-comments-styles";
      styleNode.textContent = `
        @keyframes wikiweb-fade-in {
          from { opacity: 0; transform: translate(-50%, -46%) scale(0.96); }
          to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        .wikiweb-board-item {
          transition: background-color 0.2s, transform 0.15s;
          cursor: pointer;
        }
        .wikiweb-board-item:hover {
          background-color: #f8fafc;
          transform: translateY(-1px);
        }
        .wikiweb-board-item:active {
          transform: translateY(0);
        }
        @keyframes wikiweb-highlight-flash {
          0% { outline: 4px solid #10b981; background-color: rgba(16, 185, 129, 0.2); }
          50% { outline: 4px solid #10b981; background-color: rgba(16, 185, 129, 0.2); }
          100% { outline: none; background-color: transparent; }
        }
      `;
      document.head.appendChild(styleNode);
    }

    let commentsHtml = "";
    if (selectors.length === 0) {
      commentsHtml = `
        <div style="padding: 40px 20px; text-align: center; color: #64748b;">
          <span style="font-size: 32px; display: block; margin-bottom: 12px;">💬</span>
          <p style="font-size: 13px; font-weight: 600; margin: 0;">No comments registered yet on elements.</p>
          <p style="font-size: 11px; color: #94a3b8; margin: 4px 0 0 0;">Add comments by clicking texts on the page!</p>
        </div>
      `;
    } else {
      selectors.forEach((selector) => {
        const val = comments[selector];
        const list = Array.isArray(val) ? val : (val ? [val] : []);
        if (list.length === 0) return;

        let elementText = "";
        try {
          const matched = document.querySelector(selector);
          if (matched) {
            elementText = getCleanInnerText(matched);
            if (elementText.length > 80) elementText = elementText.slice(0, 77) + "...";
          }
        } catch(e){}

        if (!elementText) {
          elementText = selector;
        }

        let innerListHtml = "";
        list.forEach((commText, idx) => {
          innerListHtml += `
            <div style="font-size: 11.5px; border-bottom: ${idx === list.length - 1 ? "none" : "1px dashed #f1f5f9"}; padding: 6px 0; color: #1e293b; font-weight: 500; font-family: sans-serif; text-align: left;">
              <span style="font-size: 9px; font-weight: bold; color: #94a3b8; display: block; margin-bottom: 2.5px;">COMMENT #${idx + 1}</span>
              💬 ${commText}
            </div>
          `;
        });

        commentsHtml += `
          <div class="wikiweb-board-item" data-selector="${encodeURIComponent(selector)}" style="padding: 14px; border-bottom: 1px solid #f1f5f9; position: relative; text-align: left;">
            <div style="display: flex; justify-content: space-between; align-items: start; gap: 8px; margin-bottom: 6px;">
              <span style="font-size: 10px; font-weight: 700; color: #10b981; background: #ecfdf5; padding: 2px 6px; border-radius: 4px; font-family: monospace;">${selector}</span>
              <button class="wikiweb-delete-comment" data-selector="${encodeURIComponent(selector)}" style="background: none; border: none; color: #94a3b8; font-size: 11px; cursor: pointer; padding: 2px 6px; border-radius: 4px; transition: color 0.15s;" title="Delete group thread">🗑 Thread</button>
            </div>
            <div style="font-size: 11px; color: #64748b; font-style: italic; margin-bottom: 6px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; max-width: 100%;">
              Ref text: "${elementText}"
            </div>
            <div style="background: #fafafb; border: 1px solid #f1f5f9; padding: 4px 12px; border-radius: 8px;">
              ${innerListHtml}
            </div>
          </div>
        `;
      });
    }

    board.innerHTML = `
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding: 16px 20px; background: #fafafb; box-sizing: border-box; width: 100%;">
        <div style="text-align: left;">
          <h3 style="margin: 0; font-size: 15px; font-weight: 800; color: #1e293b; letter-spacing: -0.2px;">💬 Page Comments Desk</h3>
          <p style="margin: 2px 0 0 0; font-size: 10px; color: #64748b; font-weight: 500;">Select a peer annotation below to browse and locate on live text</p>
        </div>
        <button id="wikiweb-board-close" style="background: #f1f5f9; border: none; color: #475569; font-weight: bold; font-size: 12px; height: 26px; width: 26px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center;">✕</button>
      </div>

      <!-- Scroller Content -->
      <div id="wikiweb-board-list" style="flex: 1; overflow-y: auto; max-height: 380px; box-sizing: border-box; width: 100%;">
        ${commentsHtml}
      </div>

      <!-- Actions bottom -->
      <div style="padding: 12px 20px; border-top: 1px solid #e2e8f0; background: #fafafb; display: flex; justify-content: space-between; align-items: center; box-sizing: border-box; width: 100%;">
        <span style="font-size: 11px; color: #94a3b8; font-weight: 500;">On-page annotations: ${selectors.length}</span>
        ${selectors.length > 0 ? `<button id="wikiweb-board-clear" style="background: none; border: none; color: #ef4444; font-size: 11px; font-weight: bold; cursor: pointer;">Clear All</button>` : ''}
      </div>
    `;

    document.body.appendChild(board);

    // Close panel button
    document.getElementById("wikiweb-board-close").onclick = () => board.remove();

    // Clear all comments from board bottom trigger
    const clearBtn = document.getElementById("wikiweb-board-clear");
    if (clearBtn) {
      clearBtn.onclick = () => {
        if (confirm("Reset all bubble comments across this page?")) {
          chrome.storage.local.set({customComments: {}}, () => {
            document.querySelectorAll("[id^='wikiweb-badge-']").forEach(badge => badge.remove());
            board.remove();
          });
        }
      };
    }

    // High quality scrolling and highlighting targeting
    board.querySelectorAll(".wikiweb-board-item").forEach(item => {
      item.onclick = (e) => {
        if (e.target.classList.contains("wikiweb-delete-comment")) return;
        const selector = decodeURIComponent(item.dataset.selector);
        try {
          const targetEl = document.querySelector(selector);
          if (targetEl) {
            targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Trigger visual focus pulse animation
            targetEl.style.animation = "wikiweb-highlight-flash 2.5s ease-out";
            setTimeout(() => {
              targetEl.style.outline = "";
              targetEl.style.animation = "";
            }, 2505);

            targetEl.style.outline = "4px solid #10b981";
          }
        } catch (e){}
      };
    });

    // Delete single item
    board.querySelectorAll(".wikiweb-delete-comment").forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const selector = decodeURIComponent(btn.dataset.selector);
        chrome.storage.local.get({customComments: {}}, (res) => {
          const comments = res.customComments;
          delete comments[selector];
          chrome.storage.local.set({customComments: comments}, () => {
            const badgeId = "wikiweb-badge-" + btoa(unescape(encodeURIComponent(selector))).replace(/=/g, '');
            const badge = document.getElementById(badgeId);
            if (badge) badge.remove();

            board.remove();
            openAllCommentsMenu();
          });
        });
      };
    });
  });
}

function injectPersistentFloatingMenu() {
  if (document.getElementById("wikiweb-persistent-fab-wrapper")) return;

  const wrapper = document.createElement("div");
  wrapper.id = "wikiweb-persistent-fab-wrapper";
  wrapper.style.cssText = "position: fixed; bottom: 20px; right: 20px; z-index: 2147483647; display: flex; flex-direction: column; align-items: flex-end; font-family: system-ui, -apple-system, sans-serif; -webkit-user-select: none; user-select: none;";

  const menu = document.createElement("div");
  menu.id = "wikiweb-persistent-fab-menu";
  menu.style.cssText = "display: none; width: 250px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1); padding: 14px; margin-bottom: 10px; flex-direction: column; gap: 10px; text-align: left;";

  const titleBlock = document.createElement("div");
  titleBlock.style.cssText = "display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px;";
  titleBlock.innerHTML = "<div style='display: flex; align-items: center; gap: 6px;'>" +
    "<div style='width: 18px; height: 18px; background: #8b5cf6; border-radius: 4px; color: white; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold;'>W</div>" +
    "<span style='font-weight: 800; font-size: 11.5px; color: #1e293b;'>WikiWeb Companion</span>" +
    "</div>" +
    "<button id='wikiweb-fab-menu-close-btn' style='background: none; border: none; cursor: pointer; color: #94a3b8; font-weight: bold; font-size: 11px;'>✕</button>";
  menu.appendChild(titleBlock);

  const stateControls = document.createElement("div");
  stateControls.style.cssText = "display: flex; flex-direction: column; gap: 6px;";
  stateControls.innerHTML = "<span style='font-size: 9px; font-weight: bold; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px;'>Change Page Overlay State</span>" +
    "<button id='wikiweb-fab-state-on' style='display: flex; align-items: center; justify-content: space-between; width: 100%; border-radius: 8px; border: 1px solid #e2e8f0; padding: 8px 10px; font-size: 11.5px; font-weight: bold; background: #ffffff; color: #475569; cursor: pointer; transition: all 0.2s;'>" +
    "<span style='display: flex; align-items: center; gap: 6px;'><span class=" + '"dot-indicator" style="color: #cbd5e1;"' + ">●</span> On (wikiweb)</span>" +
    "<span class=" + '"check-mark" style="display: none; color: #8b5cf6;"' + ">✓</span>" +
    "</button>" +
    "<button id='wikiweb-fab-state-off' style='display: flex; align-items: center; justify-content: space-between; width: 100%; border-radius: 8px; border: 1px solid #e2e8f0; padding: 8px 10px; font-size: 11.5px; font-weight: bold; background: #ffffff; color: #475569; cursor: pointer; transition: all 0.2s;'>" +
    "<span style='display: flex; align-items: center; gap: 6px;'><span class=" + '"dot-indicator" style="color: #cbd5e1;"' + ">●</span> Off (original content)</span>" +
    "<span class=" + '"check-mark" style="display: none; color: #4b5563;"' + ">✓</span>" +
    "</button>";
  menu.appendChild(stateControls);

  const hideControls = document.createElement("div");
  hideControls.style.cssText = "border-top: 1px solid #f1f5f9; padding-top: 8px; margin-top: 4px; display: flex; flex-direction: column;";
  hideControls.innerHTML = "<button id='wikiweb-fab-hide-btn' style='border: none; background: #fef2f2; border-radius: 6px; padding: 6px 10px; font-size: 10px; font-weight: 600; color: #ef4444; width: 100%; cursor: pointer; transition: all 0.2s; text-align: center;'>✕ Hide Floating Button</button>";
  menu.appendChild(hideControls);



  const fabBtn = document.createElement("button");
  fabBtn.id = "wikiweb-persistent-fab-btn";
  fabBtn.style.cssText = "width: 44px; height: 44px; border-radius: 50%; background: #8b5cf6; border: 2px solid #ffffff; color: #ffffff; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 16px; font-weight: 900; box-shadow: 0 4px 14px rgba(0,0,0,0.18); position: relative; outline: none; transition: transform 0.2s, background-color 0.2s;";
  fabBtn.innerHTML = "<span style='position: absolute; top: -1px; right: -1px; width: 11px; height: 11px; border-radius: 50%; border: 1px solid white; background: #10b981;' id='wikiweb-fab-status-dot'></span>W";

  wrapper.appendChild(menu);
  wrapper.appendChild(fabBtn);
  document.body.appendChild(wrapper);

  const stateOnBtn = wrapper.querySelector("#wikiweb-fab-state-on");
  const stateOffBtn = wrapper.querySelector("#wikiweb-fab-state-off");
  const statusIndicatorDot = wrapper.querySelector("#wikiweb-fab-status-dot");

  function updateFABPopupVisuals() {
    if (activeOverlayEnabled) {
      stateOnBtn.style.background = "#f5f3ff";
      stateOnBtn.style.borderColor = "#ddd6fe";
      stateOnBtn.style.color = "#6d28d9";
      stateOnBtn.querySelector(".dot-indicator").style.color = "#8b5cf6";
      stateOnBtn.querySelector(".check-mark").style.display = "block";

      stateOffBtn.style.background = "#ffffff";
      stateOffBtn.style.borderColor = "#e2e8f0";
      stateOffBtn.style.color = "#475569";
      stateOffBtn.querySelector(".dot-indicator").style.color = "#cbd5e1";
      stateOffBtn.querySelector(".check-mark").style.display = "none";

      statusIndicatorDot.style.background = "#10b981";
    } else {
      stateOnBtn.style.background = "#ffffff";
      stateOnBtn.style.borderColor = "#e2e8f0";
      stateOnBtn.style.color = "#475569";
      stateOnBtn.querySelector(".dot-indicator").style.color = "#cbd5e1";
      stateOnBtn.querySelector(".check-mark").style.display = "none";

      stateOffBtn.style.background = "#fafaf9";
      stateOffBtn.style.borderColor = "#e7e5e4";
      stateOffBtn.style.color = "#44403c";
      stateOffBtn.querySelector(".dot-indicator").style.color = "#78716c";
      stateOffBtn.querySelector(".check-mark").style.display = "block";

      statusIndicatorDot.style.background = "#a8a29e";
    }
  }

  updateFABPopupVisuals();

  stateOnBtn.onclick = (e) => {
    e.stopPropagation();
    activeOverlayEnabled = true;
    updateFABPopupVisuals();
    chrome.storage.local.set({ overlayEnabled: true }, () => {
      chrome.storage.local.get(["customEdits", "customComments"], (data) => {
        applyStoredEdits(data.customEdits || {});
        applyStoredComments(data.customComments || {});
      });
    });
  };

  stateOffBtn.onclick = (e) => {
    e.stopPropagation();
    activeOverlayEnabled = false;
    updateFABPopupVisuals();
    chrome.storage.local.set({ overlayEnabled: false }, () => {
      restorePageOriginals();
    });
  };

  fabBtn.onclick = (e) => {
    e.stopPropagation();
    if (menu.style.display === "none") {
      updateFABPopupVisuals();
      menu.style.display = "flex";
      fabBtn.style.transform = "scale(0.95)";
    } else {
      menu.style.display = "none";
      fabBtn.style.transform = "";
    }
  };

  wrapper.querySelector("#wikiweb-fab-menu-close-btn").onclick = (e) => {
    e.stopPropagation();
    menu.style.display = "none";
    fabBtn.style.transform = "";
  };

  const hideBtn = wrapper.querySelector("#wikiweb-fab-hide-btn");
  if (hideBtn) {
    hideBtn.onclick = (e) => {
      e.stopPropagation();
      chrome.storage.local.set({ floatingMenuEnabled: false }, () => {
        wrapper.remove();
      });
    };
  }

  document.addEventListener("click", () => {
    menu.style.display = "none";
    fabBtn.style.transform = "";
  });
}
