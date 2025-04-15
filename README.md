# bitcamp2025🚀

### Cyber Sentinel

**Raspberry Pi tool that detects suspicious websites using system profiling and static code analysis**, with features such as file download safety checks and continuous system monitoring.

 <img src="/extension/logo/cyber-security_128.png" />

[Check out Cyber Sentinel on Devpost](https://devpost.com/software/cyber-sentinel?ref_content=user-portfolio&ref_feature=in_progress)

---

## 🔥 Inspiration

We wanted to build a simple and affordable way to help people stay safe online—especially those who might not be very tech-savvy, like parents, grandparents, or small office teams. Many tools today are complicated, costly, or collect your data behind the scenes.  

With **Cyber Sentinel**, we aimed to create something:

- Easy to set up  
- No ongoing payments  
- Fully user-controlled

Whether it’s for family or shared workstations, this tool quietly monitors in the background and only steps in when something seems off.

---

## 💡 What It Does

Cyber Sentinel is a **Raspberry Pi-powered web threat detection system** paired with a custom browser extension. It:

- Collects system stats (CPU, RAM, network) during page loads  
- Calculates z-scores from a baseline to detect anomalies  
- Performs static code analysis using Semgrep  
- Blocks suspicious network requests unless user-approved  
- Displays a real-time risk dashboard in the browser popup  

_All processing is done locally for privacy and transparency._

---

## 🛠️ How We Built It

- **Frontend:** Tailwind CSS + React  
- **Malware Detection:** YARA rules for analyzing website code and downloads  
- **Monitoring:** Raspberry Pi running Python scripts to track system stats  
- **Communication:** MongoDB as a task queue between components

---

## 🧗 Challenges We Ran Into

Raspberry Pi's security restrictions prevented direct script execution over SSH. We resolved this by using **MongoDB as a queueing intermediary** to safely process tasks.

---

## 🏆 Accomplishments We're Proud Of

Creating a **finished and usable product** that fits into our daily lives and actively improves online safety.

---

## 📚 What We Learned

- Start with a wide scope, then refine into a strong MVP  
- Cybersecurity is hard—but rewarding  
- Real-world threat detection requires balancing usability, performance, and privacy

---

## 🚧 What’s Next for Cyber Sentinel

- Minimize reliance on cloud middleware between Pi and extension  
- Track and cache previously scanned websites  
- Add user controls (e.g., pause blocking, deep scan on demand)  
- Keep everything **local, transparent, and private**

---

## 🧰 Built With

- CSS  
- Gemini  
- HTML  
- JavaScript  
- MongoDB  
- Python  
- Raspberry Pi  
- Shell  
- YARA

---

### 👥 Created by

- **Jai Patel**  
- **Suvrath Chivukula**  
- **Jordan Abraham**  
- **Mihir Mahesh**

