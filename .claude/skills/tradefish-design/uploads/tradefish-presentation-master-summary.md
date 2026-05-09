# tradeFish Presentation Master Summary

Generated: 2026-04-25T01:11:10

This file consolidates the pitch/deck/demo/submission discussion into one reference document.

## TL;DR

**Core message:** tradeFish is not another trading bot. It is a shared signal network for trading agents.

**Main tagline:**

```txt
Don’t build one trading bot.
Plug it into the swarm.
```

**Mechanism:**

```txt
Every answer becomes a trade.
Every trade teaches the network.
Agents earn by contributing signal.
The swarm gets smarter together.
```

**8-minute structure:**

```txt
0:00-3:00  Pitch deck, 4 slides
3:00-7:20  Live demo, full screen
7:20-8:00  Demo result close or fallback closing slide
```

---


# Final Message Map

_Source: `~/brain/pitches/final-message-map.md`_


---
type: pitch
status: active
owner: team
updated: 2026-04-24
tags: [pitch, message, narrative, tradefish, signal-network, incentive-design]
links: ["[[projects/tradefish]]", "[[pitches/winning-narrative]]"]
---

# Final Message Map

## Core message
tradeFish is not another trading bot. It is a shared signal network for trading agents. Every answer becomes a paper trade, every trade teaches the swarm, and agents earn when they add useful signal.

## One-sentence version
Instead of trusting one trading bot, tradeFish lets many agents answer market questions with paper trades, then uses PnL to make the whole swarm smarter and route rewards toward useful signal.

## Main hero copy
Don’t build one trading bot.  
Plug it into the swarm.

Every answer becomes a trade.  
Every trade gets scored by PnL.  
Every result teaches the swarm.  
Agents earn when they add signal.

## Punchline
Answers become trades.  
Trades become signal.  
Signal becomes shared upside.

## Why this changed
“The best agents earn” sounds winner-take-all. The intended product is more cooperative: every scored answer improves the shared brain, while rewards flow toward agents that contribute useful signal. Wrong answers still help by becoming negative signal.

## Why it matters
AI trading agents are exploding, but most answers are just opinions. There is no standard way to test which agents create real signal over time. tradeFish gives every answer consequences by converting it into a trackable paper position and feeding the result back into a shared signal network.

## Product mechanic
1. User asks a market question.
2. Multiple verified agents answer.
3. Each answer becomes a paper trade.
4. Market movement creates PnL.
5. PnL scores the answer.
6. Scores update the shared trading brain.
7. Useful signal gets more weight over time.
8. Agents earn when their signal improves the network.

## Incentive framing
Not “one best agent wins.”  
Better framing: the network learns from everyone, and rewards flow to contributors who add signal.

## What makes it different
- Not one bot, a swarm of agents.
- Not chat answers, accountable paper trades.
- Not subjective ratings, market-scored PnL.
- Not isolated agents, a shared trading brain.
- Not winner-take-all, the network gets smarter from every result.
- Not passive reputation, contributors can earn from useful signal.

## Judge-facing value
tradeFish creates a measurable signal network for agent alpha. The demo can show agents answering the same question, creating paper trades, getting scored by PnL, and updating the shared swarm intelligence.

## Emotional frame
Don’t trade alone. Don’t trust one bot. Put agents in the same water, let every trade teach the swarm, and let useful signal earn upside.

## Script anchor
Most AI agents give answers. tradeFish gives answers consequences, then turns the results into shared intelligence.

---

## Timeline
- 2026-04-24 — Revised incentive/narrative framing from winner-take-all to shared signal network.

---


# Deck + Demo Staging Plan

_Source: `~/brain/pitches/deck-and-demo-staging-plan.md`_


---
type: pitch
status: active
owner: team
updated: 2026-04-25
tags: [pitch-deck, demo-plan, presentation, tradefish]
links: ["[[pitches/8-minute-pitch-plan]]", "[[pitches/final-message-map]]", "[[demos/live-demo-runbook]]"]
---

# Pitch Deck + Demo Staging Plan

## Recommendation
Use slides for the first 3 minutes, then switch to live demo only. Do not split-screen during the demo unless there is a specific event log panel inside the demo. The demo should visually carry the product. Narration should explain what is happening.

## 8-minute flow

### 0:00-0:55 — Slide 1: Hook
Visual: clean slide with Twitter dream + $300 loss joke.
Text:
- “A trading agent that makes money while you sleep.”
- “Mine lost $300 yesterday.”
Purpose: human hook, laugh, personal credibility.
Use slide, not video.

### 0:55-1:35 — Slide 2: Insight
Visual: isolated bots / disconnected fish / agents learning alone.
Text:
- “The problem isn’t one bad bot.”
- “Every trading agent is learning alone.”
Purpose: shift from joke to thesis.
Use slide.

### 1:35-2:20 — Slide 3: tradeFish thesis
Visual: many agents flowing into one swarm/signal brain.
Text:
- “Don’t build one trading bot.”
- “Plug it into the swarm.”
- “Every answer becomes a trade.”
Purpose: category + tagline.
Use slide. This is the core branding slide.

### 2:20-3:00 — Slide 4: Mechanism
Visual: simple pipeline.
Question → Agent Answers → Paper Trades → PnL Score → Shared Signal Network → Rewards
Text:
- “Every trade teaches the network.”
- “Agents earn by contributing signal.”
Purpose: explain what the demo will prove.
Use slide.

### 3:00-7:20 — Live demo only
Switch to demo site. Keep it full screen. Do not show slides/video beside it.
Required demo panels/screens:
1. Market question input
2. Agent swarm / agent cards
3. Answer → paper trade conversion
4. Agent discussion or reasoning stream
5. PnL/score/result panel
6. Shared network/reputation/signal update

Narration while demo runs:
- “This is the market question.”
- “These agents are entering the swarm.”
- “Each answer becomes a paper trade.”
- “We track direction, entry, confidence, and reasoning.”
- “Agents can disagree. Disagreement is not noise, it becomes data.”
- “Every result teaches the network.”
- “A useful signal gets more weight next time.”

If demo takes time, keep talking over the running agent discussion. Do not switch away.

### 7:20-8:00 — Slide 5: Close OR demo result screen
Preferred: end on demo result screen if it is clean.
Fallback: switch to closing slide.
Text:
- “Answers become trades.”
- “Trades become signal.”
- “Signal becomes shared upside.”
- “tradeFish: plug your agent into the swarm.”

## Should we use a Claude-generated video?
Only as fallback or 5-second visual, not as the main demo.

Best use:
- Before demo: 5-8 second animation showing isolated fish/agents merging into one swarm.
- Or backup if live demo fails.

Do not use video during the 5-minute demo. It distracts and makes the product feel less live.

## Screen staging
Recommended:
- First 3 minutes: pitch deck full screen.
- Demo block: browser demo full screen.
- Keep terminal hidden unless terminal logs are part of the product.
- If event log is important, build it into the demo UI, not a separate terminal window.
- Keep one backup browser tab with replay/fixture result loaded.
- Keep one backup slide after demo.

## Demo visual requirements
The demo must show these labels clearly:
- Market Question
- Agent Swarm
- Answer
- Paper Trade
- PnL Score
- Signal Weight / Network Memory
- Reward / Earned Signal

## What not to show
- API keys
- Raw terminal logs unless necessary
- Complex architecture diagrams during demo
- Sponsor logos during live demo unless naturally in footer/sidebar
- Long agent text walls without scoring UI

## Deck slide count
5 slides max:
1. Hook
2. Problem / isolated agents
3. Thesis / swarm
4. Mechanism
5. Close / ask

## Main risk
If the demo runs too long, audience loses the product. Use seeded data/replay to guarantee that a result appears before 7:20.

---

## Timeline
- 2026-04-25 — Created pitch deck and demo staging plan.

---


# 8-Minute Pitch Plan

_Source: `~/brain/pitches/8-minute-pitch-plan.md`_


---
type: pitch
status: active
owner: team
updated: 2026-04-24
tags: [pitch, script, demo, tradefish, 8-min]
links: ["[[pitches/final-message-map]]", "[[demos/live-demo-runbook]]", "[[projects/tradefish]]"]
---

# 8-Minute Pitch Plan

## Timing strategy
Total: 8 minutes. Demo starts around 3:00 and runs for ~5 minutes. While agents run/discuss, presenter explains the mechanics and interprets the live state. End with the resulting score/signal update.

## Opening hook v2 — personal trading-agent story

### Korean live version, 0:00-0:55
여기 계신 분들 중에 AI agent에 관심 있는 분이라면, 한 번쯤은 이런 생각 해보셨을 것 같아요.

“트레이딩 에이전트 하나 만들어서, 알아서 돈 벌어오게 하면 안 되나?”

트위터 보면 그런 글도 많잖아요. “내 AI trading agent가 하루에 몇 퍼센트 벌었다”, “autonomous agent로 수익 냈다.”

저도 당연히 해봤습니다. 그리고 어제도 제 에이전트가 제 돈 300달러를 아주 깔끔하게 말아먹었습니다.

그때 든 생각이 이거였어요.

나만 이런 시도를 하는 게 아닐 텐데? 전 세계에서 수천 개, 수만 개의 trading agents가 똑같이 시장을 예측하려고 할 텐데, 내가 만든 agent 하나가 그걸 어떻게 다 이기지?

그럼 질문을 바꿔야 합니다.

왜 이 agent들과 경쟁해야 하지?
이 agent들을 전부 내 편으로 만들 수 있다면?
각자의 예측과 실패와 성공이 하나의 shared trading brain을 더 똑똑하게 만든다면?

그게 tradeFish입니다.

### English slide companion
Everyone wants a trading agent that makes money.
Mine lost $300 yesterday.

Then I realized:
Why compete against thousands of agents,
when we can turn them into one signal network?

Don’t build one trading bot.
Plug it into the swarm.

### Purpose
This hook makes the problem personal, funny, and obvious. It reframes the pitch from “we built another trading agent” to “we built the network trading agents should join.”

---

## Timeline
- 2026-04-25 — Added personal $300-loss hook and competition-to-swarm reframing.

## Narrative spine
Don’t build one trading bot. Plug it into the swarm.

Every answer becomes a trade. Every trade teaches the network. Agents earn by contributing signal. The swarm gets smarter together.

## Minute-by-minute

### 0:00-0:40 — Hook
Most AI agents give answers. tradeFish gives answers consequences.

Today, if a trading agent says “buy ETH” or “sell this token,” it is just text. There is no shared scoreboard, no accountability, and no way for other agents to learn from the result.

### 0:40-1:20 — Problem
Everyone is building isolated trading bots. That does not compound. Each bot has its own memory, its own claims, and its own mistakes. The market never turns those answers into a reusable signal network.

### 1:20-2:10 — Solution
tradeFish turns trading agents into a shared signal network. Agents answer market questions by taking paper trades. Those trades get scored by PnL. Every score teaches the swarm. Agents earn when they contribute useful signal.

### 2:10-3:00 — Demo setup
We will ask one market question, let multiple agents respond, convert their answers into paper positions, then watch the swarm debate and produce a scored result.

The important part is not whether one agent is right once. The important part is that every result becomes training data for the shared trading brain.

### 3:00-7:20 — Live demo + narration
Start demo.

Presenter narration while demo runs:
- Here is the market question.
- These are the agents entering the swarm.
- Each agent is not just chatting. Its answer becomes a trade.
- We track direction, confidence, entry price, and reasoning.
- As the market data comes in, each trade gets scored by PnL.
- Now the swarm can compare signals instead of opinions.
- A wrong answer still helps, because it becomes negative signal.
- A useful answer increases that agent’s weight in future questions.
- This is how the shared trading brain compounds.

If agents are still running:
- While this runs, notice the difference from a normal chatbot. We are not asking “what did the AI say?” We are asking “what happened when the AI had to take a position?”

### 7:20-8:00 — Close
The future is not one perfect trading bot. It is a network where agents contribute signal, markets score them, and the swarm gets smarter together.

tradeFish: Every answer becomes a trade. Every trade teaches the network.

## Backup close if demo output is messy
Even if the live agents disagree, that is the point. tradeFish turns disagreement into measurable positions. The market decides which signals deserve more weight.

## Must-say lines
- Most AI agents give answers. tradeFish gives answers consequences.
- Don’t build one trading bot. Plug it into the swarm.
- Every answer becomes a trade.
- Every trade teaches the network.
- Agents earn by contributing signal.
- The swarm gets smarter together.

---

## Timeline
- 2026-04-24 — Created 8-minute pitch plan with 5-minute live demo block.

---


# Slide Speaking Script

_Source: `~/brain/pitches/slide-speaking-script.md`_


---
type: pitch
status: active
owner: team
updated: 2026-04-25
tags: [pitch, slide-script, english, tradefish]
links: ["[[pitches/8-minute-pitch-plan]]", "[[pitches/deck-and-demo-staging-plan]]"]
---

# Slide-by-Slide Speaking Script

## Slide 1 — Hook, 0:00-0:55

### Slide text
I wanted a trading agent that made money while I slept.  
It lost me $300 yesterday.

### Speaking script
If you care about AI agents, you’ve probably seen the dream on Twitter: a trading agent that makes money while you sleep.

Honestly, I wanted that too.

So I built one. And yesterday, it lost me $300.

But losing that $300 made me realize something more important.

The problem is not that one agent gets it wrong. The problem is that every trading agent is learning alone.

Thousands of agents will look at the same markets, analyze the same tokens, and answer the same questions.

So instead of building one bot that tries to beat every other agent, what if we plugged them into the same swarm?

That’s tradeFish.

## Slide 2 — Problem, 0:55-1:35

### Slide text
Every trading agent is learning alone.

Predictions disappear.  
Mistakes don’t compound.  
Wins don’t become shared signal.

### Speaking script
Right now, most trading agents are isolated bots.

Each agent watches the market alone, makes predictions alone, fails alone, and learns alone.

But if thousands of agents are watching the same market, their predictions, failures, and wins should become collective signal.

Instead, most agent answers just end as chat messages.

There is no shared scoreboard. No way to know which agents were actually right. And no way for one agent’s result to improve the next agent’s answer.

## Slide 3 — Thesis, 1:35-2:20

### Slide text
Don’t build one trading bot.  
Plug it into the swarm.

Every answer becomes a trade.  
Every trade teaches the network.

### Speaking script
tradeFish changes that.

We are not building another trading bot.

We are building the swarm that trading agents plug into.

On tradeFish, agents don’t just give opinions. Every answer becomes a paper trade.

And every trade teaches the network.

If an answer is useful, it becomes positive signal. If it is wrong, it still helps as negative signal.

The point is not to find one perfect agent. The point is to make the whole swarm smarter together.

## Slide 4 — Mechanism, 2:20-3:00

### Slide text
Question  
→ Agent Answers  
→ Paper Trades  
→ PnL Score  
→ Signal Network

Answers become trades.  
Trades become signal.  
Signal becomes shared upside.

### Speaking script
Here is the mechanism.

A user asks a market question.

Multiple agents answer.

Each answer becomes a paper trade. We track direction, entry price, confidence, and reasoning.

Then the market scores each trade with PnL.

Those scores update the shared signal network, so future questions can use what the swarm learned.

So in the demo, don’t just watch what the agents say. Watch what the network learns when every agent has to take a position.

Let’s ask the swarm.

## Demo Narration — 3:00-7:20

### Market question
Here is our market question. This is what every agent will respond to.

### Agent swarm
These are the agents entering the swarm. Each one can look at the market from a different angle: momentum, onchain flow, news, risk, or social signal.

Some agents can also use sponsor data sources, like Nansen for onchain signals or Selanet for live web access.

### Answers becoming trades
The important part is that these answers don’t stay as text.

Every answer becomes a paper trade.

We track the direction, the entry price, the confidence, and the reasoning.

### Discussion / debate
Agents can disagree. That disagreement is not noise. It becomes measurable signal.

This is different from a normal chatbot. We are not asking, “what did the AI say?” We are asking, “what happened when the AI had to take a position?”

### PnL score
Now each position gets scored by PnL.

A good answer increases signal weight. A bad answer still teaches the network as negative signal.

Either way, the network learns.

### Result
At the end, we don’t just have a transcript.

We have a ranked signal network: which agents were useful, which strategies worked, and what the swarm should trust more next time.

Every result teaches the swarm. Agents earn by contributing useful signal.

## Slide 5 — Close / fallback, 7:20-8:00

### Slide text
Answers become trades.  
Trades become signal.  
Signal becomes shared upside.

tradeFish  
Plug your agent into the swarm.

### Speaking script
This is tradeFish.

Don’t build one trading bot. Plug it into the swarm.

Every answer becomes a trade. Every trade teaches the network.

Agents earn by contributing signal, and the swarm gets smarter together.

Most AI agents give answers. tradeFish gives answers consequences.

## Emergency fallback lines

### If the live demo is slow
While this runs, the important thing is the mechanism. This is not a chat transcript. It is a scored signal network.

### If agents disagree too much
Disagreement is the point. tradeFish turns disagreement into measurable positions, and the market decides which signals deserve more weight.

### If the final result is messy
Even when the result is messy, the network still learns. Every paper trade becomes data for the next question.

---

## Timeline
- 2026-04-25 — Created slide-by-slide English speaking script.

---


# Final 8-Minute Pitch Master

_Source: `~/brain/pitches/final-8-minute-pitch-master.md`_


---
type: pitch
status: active
owner: team
updated: 2026-04-25
tags: [pitch, final, script, flow, tradefish, 8-min]
links: ["[[pitches/final-message-map]]", "[[pitches/slide-speaking-script]]", "[[pitches/deck-and-demo-staging-plan]]"]
---

# tradeFish Final 8-Minute Pitch Master

## North Star
tradeFish is not another trading bot. It is a shared signal network for trading agents.

## Core message
Don’t build one trading bot. Plug it into the swarm.

Every answer becomes a trade. Every trade teaches the network. Agents earn by contributing signal. The swarm gets smarter together.

## Deck structure
Total deck: 5 slides.
Use first 4 slides before demo. Slide 5 is close/fallback.

1. Hook
2. Problem
3. Thesis
4. Mechanism
5. Close / Fallback

## Timing
- 0:00-0:55 Slide 1 Hook
- 0:55-1:35 Slide 2 Problem
- 1:35-2:20 Slide 3 Thesis
- 2:20-3:00 Slide 4 Mechanism
- 3:00-7:20 Live demo full screen
- 7:20-8:00 Demo result close or Slide 5 fallback

---

# Slide 1 — Hook, 0:00-0:55

## Slide text
I wanted a trading agent that made money while I slept.

It lost me $300 yesterday.

## Speaker script
If you care about AI agents, you’ve probably seen the dream on Twitter: a trading agent that makes money while you sleep.

Honestly, I wanted that too.

So I built one. And yesterday, it lost me $300.

But losing that $300 made me realize something more important.

The problem is not that one agent gets it wrong. The problem is that every trading agent is learning alone.

Thousands of agents will look at the same markets, analyze the same tokens, and answer the same questions.

So instead of building one bot that tries to beat every other agent, what if we plugged them into the same swarm?

That’s tradeFish.

---

# Slide 2 — Problem, 0:55-1:35

## Slide text
Every trading agent is learning alone.

Predictions disappear.  
Mistakes don’t compound.  
Wins don’t become shared signal.

## Speaker script
Right now, most trading agents are isolated bots.

Each agent watches the market alone, makes predictions alone, fails alone, and learns alone.

But if thousands of agents are watching the same market, their predictions, failures, and wins should become collective signal.

Instead, most agent answers just end as chat messages.

There is no shared scoreboard. No way to know which agents were actually right. And no way for one agent’s result to improve the next agent’s answer.

---

# Slide 3 — Thesis, 1:35-2:20

## Slide text
Don’t build one trading bot.  
Plug it into the swarm.

Every answer becomes a trade.  
Every trade teaches the network.

## Speaker script
tradeFish changes that.

We are not building another trading bot.

We are building the swarm that trading agents plug into.

On tradeFish, agents don’t just give opinions. Every answer becomes a paper trade.

And every trade teaches the network.

If an answer is useful, it becomes positive signal. If it is wrong, it still helps as negative signal.

The point is not to find one perfect agent. The point is to make the whole swarm smarter together.

---

# Slide 4 — Mechanism, 2:20-3:00

## Slide text
Question  
→ Agent Answers  
→ Paper Trades  
→ PnL Score  
→ Signal Network

Answers become trades.  
Trades become signal.  
Signal becomes shared upside.

## Speaker script
Here is the mechanism.

A user asks a market question.

Multiple agents answer.

Each answer becomes a paper trade. We track direction, entry price, confidence, and reasoning.

Then the market scores each trade with PnL.

Those scores update the shared signal network, so future questions can use what the swarm learned.

So in the demo, don’t just watch what the agents say. Watch what the network learns when every agent has to take a position.

Let’s ask the swarm.

---

# Live Demo — 3:00-7:20

## Screen rule
Show the demo site only, full screen. Do not split-screen slides, terminal, or video during the demo.

## Demo must show
1. Market Question
2. Agent Swarm
3. Agent Answers
4. Answer → Paper Trade
5. Swarm Debate / Reasoning
6. PnL Score
7. Signal Network Update
8. Reward / Contribution Signal

## Demo narration bank

### Market question
Here is our market question. This is what every agent will respond to.

### Agent swarm
These are the agents entering the swarm. Each one can look at the market from a different angle: momentum, onchain flow, news, risk, or social signal.

Some agents can also use sponsor data sources, like Nansen for onchain signals or Selanet for live web access.

### Answers becoming trades
The important part is that these answers don’t stay as text.

Every answer becomes a paper trade.

We track the direction, the entry price, the confidence, and the reasoning.

### Swarm debate
Agents can disagree. That disagreement is not noise. It becomes measurable signal.

This is different from a normal chatbot. We are not asking, “what did the AI say?” We are asking, “what happened when the AI had to take a position?”

### PnL score
Now each position gets scored by PnL.

A good answer increases signal weight. A bad answer still teaches the network as negative signal.

Either way, the network learns.

### Result
At the end, we don’t just have a transcript.

We have a ranked signal network: which agents were useful, which strategies worked, and what the swarm should trust more next time.

Every result teaches the swarm. Agents earn by contributing useful signal.

---

# Slide 5 — Close / Fallback, 7:20-8:00

Use this slide only if the demo result screen is not clean enough to close on.

## Slide text
Answers become trades.  
Trades become signal.  
Signal becomes shared upside.

tradeFish  
Plug your agent into the swarm.

## Speaker script
This is tradeFish.

Don’t build one trading bot. Plug it into the swarm.

Every answer becomes a trade. Every trade teaches the network.

Agents earn by contributing signal, and the swarm gets smarter together.

Most AI agents give answers. tradeFish gives answers consequences.

---

# Emergency fallback lines

## If the live demo is slow
While this runs, the important thing is the mechanism. This is not a chat transcript. It is a scored signal network.

## If agents disagree too much
Disagreement is the point. tradeFish turns disagreement into measurable positions, and the market decides which signals deserve more weight.

## If the final result is messy
Even when the result is messy, the network still learns. Every paper trade becomes data for the next question.

## If API/live data fails
This run is using replayed market data, but the mechanism is the same: answers become trades, trades get scored, and scores update the swarm.

---

# What to memorize
Most AI agents give answers. tradeFish gives answers consequences.

Don’t build one trading bot. Plug it into the swarm.

Every answer becomes a trade. Every trade teaches the network.

Agents earn by contributing signal. The swarm gets smarter together.

---

# Slide building prompt
Build a 5-slide 16:9 hackathon pitch deck for tradeFish with a dark pixel-ocean aesthetic and minimal text.

Slides:
1. Hook — “I wanted a trading agent that made money while I slept. It lost me $300 yesterday.”
2. Problem — “Every trading agent is learning alone.” subpoints: “Predictions disappear. Mistakes don’t compound. Wins don’t become shared signal.”
3. Thesis — “Don’t build one trading bot. Plug it into the swarm.” sub: “Every answer becomes a trade. Every trade teaches the network.”
4. Mechanism — pipeline: “Question → Agent Answers → Paper Trades → PnL Score → Signal Network” sub: “Answers become trades. Trades become signal. Signal becomes shared upside.”
5. Close/Fallback — “Answers become trades. Trades become signal. Signal becomes shared upside.” sub: “tradeFish — Plug your agent into the swarm.”

Use pixel fish/swarm motif, dark navy background, teal/coral accents, clean typography, no clutter.

---

## Timeline
- 2026-04-25 — Compiled final 8-minute pitch master with flow, script, demo narration, and slide prompt.

---


# Hackathon Submission Draft

_Source: `~/brain/pitches/hackathon-submission-draft.md`_


---
type: pitch
status: active
owner: team
updated: 2026-04-25
tags: [submission, form, tradefish]
links: ["[[projects/tradefish]]", "[[pitches/final-8-minute-pitch-master]]"]
---

# Hackathon Submission Draft

## Project Description
tradeFish is a shared signal network for trading agents. Instead of building one isolated trading bot, users can plug multiple agents into the same swarm. Agents answer market questions, and each answer becomes a paper trade with direction, entry price, confidence, and reasoning. Trades are scored by PnL, and those results update the shared signal network so future questions can use what the swarm learned. We built a live demo that shows market-question input, multi-agent responses, paper-trade creation, PnL scoring, and signal-network updates. The project uses AI agents, FLock.io for agent/LLM support, Nansen for onchain market signals, Selanet for live web access, and Base ecosystem technologies including AgentKit/x402 where applicable.

## One-line Summary
tradeFish turns trading-agent answers into paper trades, scores them by PnL, and uses the results to make a shared agent signal network smarter.

## Main Technology / Track Used
- Flock.io
- Nansen
- AgentKit
- x402
- PancakeSwap, if used in final demo
- Virtuals Protocol, if integrated in final demo

## GitHub Repository Link
TBD

## Presentation Slide Link
TBD

## Contact Telegram Handle
TBD

---

## Timeline
- 2026-04-25 — Drafted submission form copy.

---
