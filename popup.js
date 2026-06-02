// Chrome Extension Popup Controller
if (typeof chrome === "undefined") {
  window.chrome = {
    storage: {
      local: {
        get: function(keys, callback) {
          const res = {};
          let storageKeys = [];
          if (Array.isArray(keys)) {
            storageKeys = keys;
          } else if (typeof keys === "object" && keys !== null) {
            storageKeys = Object.keys(keys);
          } else if (typeof keys === "string") {
            storageKeys = [keys];
          }
          storageKeys.forEach(function(k) {
            try {
              const val = localStorage.getItem("mock_ext_" + k);
              res[k] = val ? JSON.parse(val) : (typeof keys === 'object' && !Array.isArray(keys) ? keys[k] : undefined);
            } catch(e) {
              res[k] = undefined;
            }
          });
          if (callback) callback(res);
        },
        set: function(obj, callback) {
          Object.entries(obj).forEach(function(entry) {
            var k = entry[0];
            var v = entry[1];
            localStorage.setItem("mock_ext_" + k, JSON.stringify(v));
          });
          if (callback) callback();
        }
      }
    },
    tabs: {
      query: function(opts, callback) {
        if (callback) callback([{ id: 1, active: true }]);
      },
      sendMessage: function(tabId, message, callback) {
        console.log("Mock sendMessage:", message);
        if (callback) callback();
      }
    }
  };
}

document.addEventListener("DOMContentLoaded", function() {
  const layerToggle = document.getElementById("layerToggle");
  const statEdits = document.getElementById("statEdits");
  const statComments = document.getElementById("statComments");
  const syncBtn = document.getElementById("syncBtn");

  // Tab switching
  const tabs = document.querySelectorAll(".tab-btn");
  tabs.forEach(function(tab) {
    tab.addEventListener("click", function() {
      tabs.forEach(function(t) { t.classList.remove("active"); });
      tab.classList.add("active");
      
      const sections = document.querySelectorAll(".section");
      sections.forEach(function(s) { s.classList.remove("active"); });
      
      const target = tab.dataset.tab;
      document.getElementById(target).classList.add("active");
    });
  });

  // Load configuration & stats
  function updateStateDisplays() {
    chrome.storage.local.get(["overlayEnabled", "floatingMenuEnabled", "customEdits", "customComments"], function(res) {
      const data = res || {};
      const isEnabled = data.overlayEnabled !== false;
      if (layerToggle) layerToggle.checked = isEnabled;
      
      const isFloatingEnabled = data.floatingMenuEnabled !== false;
      const floatingToggleObj = document.getElementById("floatingToggle");
      if (floatingToggleObj) floatingToggleObj.checked = isFloatingEnabled;
      
      const editsCount = Object.keys(data.customEdits || {}).length;
      const commentsCount = Object.keys(data.customComments || {}).length;
      
      if (statEdits) statEdits.textContent = editsCount + " edits";
      if (statComments) statComments.textContent = commentsCount + " bubbles";

      // Render tab comments list
      renderCommentsList(data.customComments || {});
    });
  }

  updateStateDisplays();

  // Switch layers trigger to content scripts
  if (layerToggle) {
    layerToggle.addEventListener("change", function(e) {
      const enabled = e.target.checked;
      chrome.storage.local.set({ overlayEnabled: enabled }, function() {
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
          if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {
              action: "toggleOverlay",
              enabled: enabled
            });
          }
        });
      });
    });
  }

  const floatingToggle = document.getElementById("floatingToggle");
  if (floatingToggle) {
    floatingToggle.addEventListener("change", function(e) {
      const enabled = e.target.checked;
      chrome.storage.local.set({ floatingMenuEnabled: enabled }, function() {
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
          if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {
              action: "toggleFloatingMenu",
              enabled: enabled
            });
          }
        });
      });
    });
  }

  // Speak selected text via Web Speech TTS inside Popup
  const speakBtn = document.getElementById("ai-lab-speak-btn");
  if (speakBtn) {
    speakBtn.addEventListener("click", function() {
      const inputVal = document.getElementById("ai-lab-input").value.trim();
      const outputVal = document.getElementById("ai-lab-output").textContent.trim();
      const textToSpeak = inputVal || outputVal;
      
      if (!textToSpeak) {
        alert("Please paste or write some prose inside the input area above first!");
        return;
      }
      
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        speakBtn.innerText = "🔊 Speak prose";
        speakBtn.style.backgroundColor = "#10b981";
      } else {
        const whisper = new SpeechSynthesisUtterance(textToSpeak);
        whisper.rate = 1.05;
        whisper.onend = function() {
          speakBtn.innerText = "🔊 Speak prose";
          speakBtn.style.backgroundColor = "#10b981";
        };
        speakBtn.innerText = "⏹ Stop speech";
        speakBtn.style.backgroundColor = "#ef4444";
        window.speechSynthesis.speak(whisper);
      }
    });
  }

  // Ask AI optimization within Popup panel
  const aiLabEnhanceBtn = document.getElementById("ai-lab-enhance-btn");
  if (aiLabEnhanceBtn) {
    aiLabEnhanceBtn.addEventListener("click", function() {
      const inputVal = document.getElementById("ai-lab-input").value.trim();
      const actionSelector = document.getElementById("ai-lab-action").value;
      
      if (!inputVal) {
        alert("Please enter structural text to enhance!");
        return;
      }

      aiLabEnhanceBtn.innerText = "⏳ Doing...";
      aiLabEnhanceBtn.disabled = true;

      fetch("http://localhost:3000/api/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ originalText: inputVal, action: actionSelector })
      })
      .then(function(res) { return res.json(); })
      .then(function(data) {
        if (data.success && data.enhancedText) {
          showLabResult(data.enhancedText);
        } else {
          showLabResult(getSimulatedResultFallback(inputVal, actionSelector));
        }
      })
      .catch(function() {
        showLabResult(getSimulatedResultFallback(inputVal, actionSelector));
      })
      .finally(function() {
        aiLabEnhanceBtn.innerText = "🤖 Ask AI";
        aiLabEnhanceBtn.disabled = false;
      });
    });
  }

  function showLabResult(val) {
    const outputCard = document.getElementById("ai-lab-result-card");
    const outputPara = document.getElementById("ai-lab-output");
    if (outputCard && outputPara) {
      outputPara.textContent = val;
      outputCard.style.display = "block";
    }
  }

  const aiCopyBtn = document.getElementById("ai-copy-btn");
  if (aiCopyBtn) {
    aiCopyBtn.addEventListener("click", function() {
      const outputPara = document.getElementById("ai-lab-output");
      if (outputPara && outputPara.textContent) {
        navigator.clipboard.writeText(outputPara.textContent);
        aiCopyBtn.textContent = "[Copied!]";
        setTimeout(function() { aiCopyBtn.textContent = "[Copy]"; }, 1500);
      }
    });
  }

  function getSimulatedResultFallback(text, action) {
    if (action === "simplify") {
      return text.length > 25 ? text.slice(0, Math.floor(text.length * 0.72)) + "... [Simplified for general clarity]" : text + " (Simplified)";
    }
    if (action === "professional") {
      return "FORMAL PROSE: " + text.replace(/i am/gi, "our portal is").replace(/like/gi, "advocate") + " [Refined professional peer consensus layer]";
    }
    if (action === "explain") {
      return "Contextual gloss: This webpage section highlights peer contributions within an open consensus wiki frame.";
    }
    if (action === "translate-es") {
      return "[Translated to Spanish]: " + text + " (Traducido por WikiWeb)";
    }
    if (action === "translate-fr") {
      return "[Translated to French]: " + text + " (Traduit par WikiWeb)";
    }
    return text;
  }

  // Render list of comments and clear trigger
  const commentsListContainer = document.getElementById("comments-list-container");
  function renderCommentsList(comments) {
    if (!commentsListContainer) return;
    commentsListContainer.innerHTML = "";
    
    const keys = Object.keys(comments);
    if (keys.length === 0) {
      commentsListContainer.innerHTML = `<div class="empty-state">No comments on active page elements. Overlay comments will float on live pages!</div>`;
      return;
    }
    
    keys.forEach(function(selector) {
      const item = document.createElement("div");
      item.className = "comment-item";
      
      let cleanLabel = selector;
      if (cleanLabel.length > 32) {
        cleanLabel = "..." + cleanLabel.slice(-28);
      }
      
      const val = comments[selector];
      const list = Array.isArray(val) ? val : (val ? [val] : []);
      
      let listHtml = "";
      list.forEach(function(comm, idx) {
        const isObj = comm && typeof comm === 'object' && comm.text;
        const commText = isObj ? comm.text : comm;
        const replies = isObj && Array.isArray(comm.replies) ? comm.replies : [];
        
        let repliesHtml = "";
        if (replies.length > 0) {
          repliesHtml = `<div id="popup-replies-container-${safeFormId}" style="margin-left: 12px; margin-top: 6px; border-left: 2px solid #cbd5e1; padding-left: 8px; display: none; flex-direction: column; gap: 4px;">`;
          replies.forEach(function(rep) {
            repliesHtml += `
              <div style="font-size: 10px; background: #f8fafc; padding: 5px 8px; border-radius: 6px; border: 1px solid #e2e8f0; text-align: left; display: flex; gap: 6px; align-items: flex-start;">
                <div style="background: #6366f1; color: white; border-radius: 50%; width: 14px; height: 14px; display: flex; align-items: center; justify-content: center; font-size: 7px; font-weight: bold; flex-shrink: 0; margin-top: 1px;">R</div>
                <div style="flex: 1; min-width: 0;">
                  <div style="font-weight: bold; font-size: 8.5px; color: #475569; margin-bottom: 1px;">Peer Reply</div>
                  <div style="color: #334155; line-height: 1.3;">${rep}</div>
                </div>
              </div>
            `;
          });
          repliesHtml += `</div>`;
        }

        const safeFormId = selector.replace(/[^a-zA-Z0-9]/g, '-') + "-" + idx;

        listHtml += `<div style="font-size: 11px; margin-top: 6px; padding-bottom: 6px; color: #15803d; border-top: ${idx === 0 ? "none" : "1px dashed #bbf7d0"}; padding-top: ${idx === 0 ? "0px" : "4px"}; text-align: left;">
          <div style="font-weight: 500; color: #1e293b;">💬 ${commText}</div>
          ${repliesHtml}
          
          <div style="margin-top: 4px; display: flex; align-items: center; gap: 8px;">
            <button class="popup-toggle-reply-btn" data-selector="${selector}" data-index="${idx}" style="background: none; border: none; color: #6366f1; font-size: 9.5px; font-weight: bold; cursor: pointer; padding: 2px 0;">↪ Reply</button>
            ${replies.length > 0 ? `
              <button class="popup-toggle-replies-visibility-btn" data-formid="${safeFormId}" data-count="${replies.length}" style="background: none; border: none; color: #4f46e5; font-size: 9.5px; font-weight: bold; cursor: pointer; padding: 2px 0;">
                ▼ Show (${replies.length})
              </button>
            ` : ''}
          </div>

          <!-- Popup Inline Reply Input Form (Hidden by default) -->
          <div class="popup-reply-form" id="popup-reply-form-${safeFormId}" data-selector="${selector}" data-index="${idx}" style="margin-top: 5px; display: none; gap: 4px;">
            <input type="text" placeholder="Reply..." class="popup-reply-input" style="flex: 1; font-size: 10px; padding: 2.5px 6px; border: 1px solid #cbd5e1; border-radius: 4px; outline: none; box-sizing: border-box; color: #1e293b;" />
            <button class="popup-reply-btn" style="background: #10b981; border: none; color: white; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; cursor: pointer;">Send</button>
          </div>
        </div>`;
      });
      
      item.innerHTML = `
        <div class="comment-item-title flex justify-between items-center text-[10px] text-slate-400 font-mono" style="margin-bottom: 4px;">
          <span>Selector: ${cleanLabel}</span>
          <span style="background: #bbf7d0; color: #15803d; font-weight: bold; border-radius: 4px; padding: 1px 4px; font-size: 8px;">${list.length}</span>
        </div>
        ${listHtml}
      `;
      commentsListContainer.appendChild(item);
    });

    // Toggle reply input spaces in Pop-up
    commentsListContainer.querySelectorAll(".popup-toggle-reply-btn").forEach(function(btn) {
      btn.onclick = function(e) {
        e.stopPropagation();
        const sel = btn.dataset.selector;
        const index = btn.dataset.index;
        const escapedSel = sel.replace(/[^a-zA-Z0-9]/g, '-');
        const form = commentsListContainer.querySelector("#popup-reply-form-" + escapedSel + "-" + index);
        if (form) {
          if (form.style.display === "none") {
            form.style.display = "flex";
            btn.textContent = "✕ Cancel";
          } else {
            form.style.display = "none";
            btn.textContent = "↪ Reply";
          }
        }
      };
    });

    // Toggle pop-up replies visibility (Show/Hide replies)
    commentsListContainer.querySelectorAll(".popup-toggle-replies-visibility-btn").forEach(function(btn) {
      btn.onclick = function(e) {
        e.stopPropagation();
        const formId = btn.dataset.formid;
        const count = btn.dataset.count;
        const container = commentsListContainer.querySelector("#popup-replies-container-" + formId);
        if (container) {
          if (container.style.display === "none") {
            container.style.display = "flex";
            btn.textContent = "▲ Hide (" + count + ")";
          } else {
            container.style.display = "none";
            btn.textContent = "▼ Show (" + count + ")";
          }
        }
      };
    });

    // Hook up reply click events inside Pop-up
    commentsListContainer.querySelectorAll(".popup-reply-btn").forEach(function(btn) {
      btn.onclick = function(e) {
        e.stopPropagation();
        const parentForm = btn.closest(".popup-reply-form");
        if (!parentForm) return;
        const sel = parentForm.dataset.selector;
        const commentIndex = parseInt(parentForm.dataset.index, 10);
        const replyInputEl = parentForm.querySelector(".popup-reply-input");
        if (!replyInputEl) return;
        const replyVal = replyInputEl.value.trim();
        if (!replyVal) return;

        chrome.storage.local.get({customComments: {}}, function(stored) {
          const currentComments = stored.customComments;
          const list = currentComments[sel];
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
             currentComments[sel] = list;
             
             chrome.storage.local.set({customComments: currentComments}, function() {
               updateStateDisplays(); // Re-renders the list displaying the new reply!
             });
          }
        });
      };
    });
  }

  const clearCommentsBtn = document.getElementById("clearCommentsBtn");
  if (clearCommentsBtn) {
    clearCommentsBtn.addEventListener("click", function() {
      if (confirm("Reset all stored peer bubble comments across pages?")) {
        chrome.storage.local.set({ customComments: {} }, function() {
          updateStateDisplays();
          // Reload extension overlay script settings
          chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            if (tabs[0]) {
              chrome.tabs.sendMessage(tabs[0].id, {
                action: "toggleOverlay",
                enabled: layerToggle.checked,
                customComments: {}
              });
            }
          });
        });
      }
    });
  }

  // Sync workspace mock trigger
  if (syncBtn) {
    syncBtn.addEventListener("click", function() {
      syncBtn.textContent = "Connecting Port 3000...";
      fetch("http://localhost:3000/api/health")
        .then(function(res) { return res.json(); })
        .then(function() {
          syncBtn.textContent = "Consensus Synced!";
          syncBtn.style.backgroundColor = "#10b981";
          setTimeout(function() {
            syncBtn.textContent = "Pull New Global Default Edits";
            syncBtn.style.backgroundColor = "";
          }, 2000);
        })
        .catch(function() {
          syncBtn.textContent = "Offline simulation active";
          setTimeout(function() {
            syncBtn.textContent = "Pull New Global Default Edits";
          }, 2000);
        });
    });
  }
});