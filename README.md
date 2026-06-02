# 🌐 WikiWeb Collective Overlay

> Collaborate, annotate, simplify, and read text aloud on any website using real-time consensus editor layers!

**WikiWeb Collective Overlay** is a lightweight, feature-rich Google Chrome extension that overlays onto any webpage you browse. It empowers you to interact with static web pages by injecting customizable overlay tools, annotating, suggesting context-driven edits, viewing collaborative discussions, listening to high-fidelity text-to-speech rendering, and tweaking overlay preferences dynamically.

---

## 🚀 Key Features

* **Visual Page Overlay & Edit Suggestion Mode**: Hover over any readable text block (paragraphs, headings, spans) on any website. Simply click down to customize, edit, or simplify the text content dynamically on-screen!
* **Persistent Floating Shortcut Controller**: Pin a minimal circular toggle controller (`W`) to the bottom-right corner of your viewport. Toggle the collective active state or hide the controller with one click.
* **Compact Sync Workspace Popup**: Toggle the extension status, monitor page-specific edits, check dynamic storage stats, and trigger features directly from the standard extensions menu toolbar.
* **Web Speech Synthesis Integration (TTS)**: Select text on the web page and hear it read aloud with high-fidelity speech controls.

---

## 🛠️ Included Extension Files
The repository contains the following core files ready to run unpackaged:
1. `manifest.json` - Declares permissions, storage configurations, background actions, and content injection rules matching `<all_urls>`.
2. `content.js` - Injector logic responsible for hover highlights, edit triggers, and handling the floating screen widget.
3. `popup.html` - Minimal, beautiful control panel nested directly inside the browser extension toolbar.
4. `wikiweb-unpacked-extension.zip` - A fully compiled, pre-packaged ZIP bundle containing all files for rapid one-click setups.

---

## 💾 Installation Guide

You can install this Extension in **Chrome (or any Chromium-based browser like Brave, Edge, or Opera)** using two easy methods:

### Method A: Extracting the ZIP File (Recommended)
1. **Download** the `wikiweb-unpacked-extension.zip` file from this repository.
2. **Unzip/Extract** the zip file to a folder on your computer (e.g., named `wikiweb-extension`).
3. Open a new tab in Google Chrome and type **`chrome://extensions/`** into the address bar.
4. In the top-right corner of the Extensions dashboard, toggle **Developer mode** to the **ON** position.
5. In the top-left corner, click **Load unpacked**.
6. Select the folder you extracted in **Step 2**. 
7. *Voila!* The extension icon appears and is ready to use!

---

### Method B: Keeping the 4 Extracted Loose Files
If you don't want to use the ZIP file:
1. Clone this repository or download all **4 core files** (`manifest.json`, `content.js`, `popup.html`, and any associated resource file) into a single folder on your local drive.
2. Open **`chrome://extensions/`** in your browser.
3. Turn on **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the folder containing your 4 downloaded files.

---

## 🖱️ How to Use

1. **Activate the Injected Overlay**:
   * Hover your cursor over the text on any webpage. A soft dashed violet border highlight will reveal that the segment is ready for collective edit suggestions.
   * Click on any paragraph or heading to trigger the interaction interface!
2. **Dynamic Inline Actions**:
   * Propose a simplified rewrite.
   * Highlight critical text sentences.
   * Leave consensus comment suggestions.
3. **The Quick-Toggle Assistant**:
   * Click the floating `W` button at the bottom right of any website to change page states instantaneously. 
   * Hide the floating icon completely by opening the menu and clicking `✕ Hide Floating Button`, or toggle its visibility inside the extension's header settings!
