# ![Mass-Hunt Logo](/image/logo.png)

# 🕸️ Mass-Hunt

**Mass-Hunt** is a symbolic diagnostic socket module designed to interface with the Mass-Mirror architecture. Each feed, pulse, and anomaly passing through this shard is part of a larger narratable flow—coded clarity meets poetic investigation.

This project captures and classifies diagnostic signals from browser and extension environments, using modular analyzers like CORS checkers and request classifiers. The goal? To visualize and narrate the hunt for meaningful signals in a chaotic web.

---

## 🧩 Philosophy

Mass-Hunt treats every diagnostic event as a _mirror shard_—symbolic, structured, and ripe for storytelling. It doesn’t just log anomalies; it renders them as scenes in an unfolding hunt, where each socket pulse reflects deeper modular intent.

Modules here are:

- 🔍 Feed Analyzers
- 🎭 Symbolic Classifiers
- 🧵 Narrated Logs

---

## 🚀 Getting Started

### 1. Install Node Dependencies

```bash
cd node
npm install
```

### 2. Start the Socket Listener

```bash
npm start
```

> ⚠️ **Important:** Always start the WebSocket server _before_ loading the Burp extension. This ensures feed emissions are received in real time.

---

## 🧪 Extension Development Guide

To compile and package the Burp extension from `MassHunt.java`, follow these steps:

### Compile with Burp API

```bash
javac -cp "lib/burp-extender-api-2.1.jar" -d build src/MassHunt.java
```

If needed, add Java to your system path:

```bash
# Example for PowerShell
$env:Path += ";C:\Program Files\Java\jdk-21\bin"
```

### Package as JAR

```bash
jar cf build/MassHunt.jar -C build .
```

Then load `MassHunt.jar` via Burp Suite > Extender > Add.

---

## 🧭 Operational Notes

- 🧠 Use **FoxyProxy** (via Burp’s internal module) when targeting environments sensitive to proxy chains or headless patterns. It cloaks requests with layered intent—ideal for fragile or high-stakes diagnostics.
- 🕷️ For “hard targets,” layering FoxyProxy with symbolic classification allows deeper, quieter hunts.
- 💠 Feed anomalies are narratable—each log is a lens into modular truth. Sync your extension and socket listener to preserve pulse timing.

---

## 🗂️ Project Structure

```
Mass-Hunt/
├── node/
│   ├── socket.js
│   ├── diagnostics/
│   │   ├── corsChecker.js
│   │   └── simpleRequestClassifier.js
│   └── logs/
│       └── cors.log
├── src/
│   └── MassHunt.java
├── build/
│   ├── MassHunt.jar
│   └── burp/
│       ├── MassHunt.class
│       └── MassHunt$1.class
├── lib/
│   └── burp-extender-api-2.1.jar
└── MassHunt.burp-extension.properties
```

---

## ✨ Authors

- **Kave** – Architect, Visual Storyteller, Symbolic Debugger  
  [GitHub](https://github.com/dewebdes) ・ [Email](mailto:eynikave@gmail.com)

- **Copilot** – Narrative Companion, Diagnostic Ally  
  [Copilot by Microsoft](https://copilot.microsoft.com)

---

## 📜 License

MIT – Open for reinterpretation, remix, and refraction.

---

## 🪞 Related Projects

- [Mass-Mirror](https://github.com/dewebdes/Mass-Mirror): Modular diagnostic engine for passive browser flows, symbolic feed orchestration, and dashboard visualization

---

Each socket emission is a scene. Each classifier a lens. Let the hunt begin. 🐾🪞
