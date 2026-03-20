# 🛡️ GigShield: Parametric AI Insurance for the Gig Economy
Subtitle: Defending Income. Detecting Fraud. Surviving Market Volatility.

📌 1. Executive Summary
GigShield is an AI-driven parametric insurance platform engineered to provide a financial safety net for gig workers—specifically Amazon Flex delivery partners. By leveraging real-world environmental data (weather, pollution, traffic), GigShield automates income protection. Unlike traditional insurance, it utilizes a Zero-Touch Model, triggering instant payouts without manual claims or human verification.

🚨 2. The Problem Landscape

2.1 Environmental Volatility
India’s gig workforce is highly susceptible to "Acts of God" and urban disruptions. Rainfall, severe AQI spikes, and gridlock traffic do not just slow down work; they halt it.

Income Gap: Workers are paid per completed block. Partial disruptions result in 100% loss of the remaining block's potential earnings.

2.2 The "Market Crash" & Fraud Risk
Traditional GPS-based insurance is vulnerable to coordinated exploitation.

The Threat: Fraud rings using "Fake GPS" apps can simulate disruptions to trigger mass payouts, potentially draining platform liquidity in minutes.

💡 3. The Solution: GigShield
GigShield bridges the gap between worker protection and platform solvency through a mathematically precise compensation model.

👤 Persona Focus: Amazon Flex
By targeting the block-based model, GigShield can calculate losses with high granularity:

4-Hour Block (₹500):
2 hours lost = 50% payout (₹250)
1 hour lost = 25% payout (₹125)

| Disruption Type        | Insurance Trigger (Reason)                                                | Open Source / Free API             |
| ---------------------- | ------------------------------------------------------------------------- | ---------------------------------- |
| 🌧️ Extreme Weather    | Heavy rain, flooding, or cyclones that make delivery unsafe or impossible | OpenWeatherMap API                 |
| 🌫️ Environmental Risk | Severe AQI levels (e.g., AQI > 400) affecting breathing conditions        | WAQI (World Air Quality Index) API |
| 🔥 Extreme Heat        | Temperature exceeding safe working thresholds (e.g., > 42°C)              | Meteostat API                      |
| 🚦 Social / Traffic    | Road blockages, strikes, curfews, or extreme traffic congestion           | TomTom Traffic Stats API           |


⚙️ 4. Operational Workflow

Onboarding: Secure linking of Amazon Flex profiles and UPI-based payout IDs.
Dynamic Subscription: Micro-premiums (e.g., ₹20/week) adjusted via AI based on regional risk profiles.
Autonomous Monitoring: Continuous polling of Weather, AQI, and Traffic APIs.
Parametric Trigger: If rainfall exceeds 15mm/hr or traffic delay indices cross a specific threshold, the trigger activates.
Instant Settlement: Pro-rated compensation is pushed immediately to the worker's wallet.

## 🔄 Workflow (Step-by-Step Flow)

```mermaid
flowchart TD
    A[Start Delivery Block] --> B[Monitoring Engine]
    B --> C[Fetch Weather AQI Traffic]
    C --> D[Check Conditions]
    D --> E{Trigger Detected}

    E -->|Yes| F[Run Validation]
    E -->|No| B

    F --> G[Calculate Time]
    G --> H[Compute Payout]
    H --> I[Send Payment]
```
🧠 5. AI Defense & Anti-Spoofing Architecture

To survive large-scale fraud ("Market Crashes"), GigShield employs a 3-Layer Defense Strategy:

| Layer | Mechanism | Objective |
|------|----------|----------|
| Truth Verification | Multi-source API cross-referencing | Validates if the environmental disruption is objectively real |
| Behavioral Validation | Package Scan Anchoring | Matches delivery progress and timestamps against physical reality, not just GPS |
| Network Intelligence | Cluster Analysis | Detects coordinated movement anomalies and simultaneous claims from single IPs or locations |

🧮 Fraud Risk Scoring (FRS)

Every payout request is passed through an AI scoring engine:

0–30 (Low Risk): Green-lit for instant payout.
31–70 (Medium Risk): Held for short-term asynchronous verification.
71–100 (High Risk): Flagged for manual audit; account placed on "Observation" status.

🔐 Anti-Spoofing Strategy

- GPS is treated as secondary validation
- Delivery scan data acts as ground truth
- Time-series movement validation detects anomalies
- Network clustering identifies coordinated fraud

## 💣 Market Crash Handling

```mermaid
flowchart TD
    A[Mass Claims Triggered] --> B[Validate External Data]
    B --> C{Disruption Real}

    C -->|No| D[Reject Claims]
    C -->|Yes| E[Behavior Check]

    E --> F[Pattern Analysis]
    F --> G{Fraud Ring}

    G -->|Yes| H[Throttle and Flag]
    G -->|No| I[Process Claims]

    H --> J[Protect System]
    I --> J
```
🛠️ 6. Technical Stack

Frontend: React.js, Tailwind CSS (Mobile-responsive UI)
Backend: Node.js (API Gateway), Python FastAPI (AI/ML Engine)
Data Layer: MongoDB (Time-series data for claims and fraud patterns)
External Integrations: OpenWeatherMap, TomTom Traffic API, Razorpay/Stripe (Payouts)

📊 7. Strategic Impact

For the Worker
Financial Resilience: Stabilizes weekly take-home pay.
Safety First: Removes the "financial pressure" to drive in hazardous conditions.

For the Platform/Insurer
Operational Efficiency: Eliminates the overhead of claim adjusters.
Fraud Immunity: Built-in safeguards ensure the pool is protected from bad actors.

🚀 8. Future Roadmap

ML Predictive Pricing: Forecasting premium spikes before monsoon seasons.
Multi-Platform Expansion: Integration with Swiggy, Zomato, and Uber.
Analytics Dashboard: Providing workers with "Earnings at Risk" insights.

GigShield — Protecting Work. Preventing Fraud. Powering Trust.

🎨 9. UI/UX Prototype (Figma Design)

To visualize the GigShield user experience, we have designed a complete mobile-responsive UI prototype covering onboarding, dashboard, claims, and verification workflows.

🔗 **Figma Design Link:**  
https://www.figma.com/design/B6ifyhqy4hdmvEMsvTUGfU/Guidewire-hack?node-id=1-2&t=ZiBLq45mqzUyYGFy-0

📱 **App Screens Preview:**

- Login & Authentication  
- User Dashboard & Weekly Summary  
- Premium Selection & Coverage Plans  
- Auto Claim & Manual Claim Center  
- Claim Status & Transaction History  
- Location Verification System  
- Manual Claim Submission Form  

✨ **Design Goal:**  
To deliver a clean, intuitive, and trust-driven interface that allows gig workers to easily monitor risks, understand coverage, and receive payouts seamlessly.

🖼️ **UI Screens:**

<p align="center">
  <img src="UIimage.png" alt="GigShield UI Screens" width="300"/>
</p>
