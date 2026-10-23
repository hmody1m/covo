// Sample artifacts for the built-in demo story.
// Fictional company: "Lumen Home", an online lighting & home-goods brand with showrooms.
// All names, numbers and companies are made up.

// Self-hosted fonts (served by Covo with CORS); falls back to system fonts if unavailable.
const FONT = `<link rel="stylesheet" href="/fonts/fonts.css">`;

const BASE_CSS = `
*{box-sizing:border-box}html,body{margin:0}
body{background:#FBFBF8;color:#1c1b19;font:15px/1.45 Inter,ui-sans-serif,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased}
.serif{font-family:"Source Serif 4",Georgia,serif;letter-spacing:-.01em}
.muted{color:#77756f}
`;

const bars = (hs, hl = hs.length - 1) => hs.map((h, i) => `<i${i === hl ? ' class="hl"' : ''} style="height:${h}%"></i>`).join('');

export const SEED_DECK = (variant = 1) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Seed deck</title>${FONT}
<style>${BASE_CSS}
body{background:#ECEBE6}
.deck{display:flex;flex-direction:column;gap:18px;padding:18px;align-items:center}
.slide{width:min(100%,960px);aspect-ratio:16/10;background:#fff;border-radius:10px;box-shadow:0 1px 2px rgba(0,0,0,.06),0 8px 30px rgba(0,0,0,.06);padding:5.5% 6%;display:flex;flex-direction:column;position:relative;overflow:hidden}
.eyebrow{font-size:clamp(8px,1.3vw,12px);color:#8a8781}
h1{font-family:"Source Serif 4",Georgia,serif;font-weight:500;font-size:clamp(18px,4.2vw,44px);margin:.25em 0 0;letter-spacing:-.015em}
h2{font-family:"Source Serif 4",Georgia,serif;font-weight:500;font-size:clamp(16px,3.2vw,32px);margin:.2em 0 .6em;letter-spacing:-.01em}
.bars{margin-top:auto;display:flex;align-items:flex-end;gap:2.2%;height:48%}
.bars i{flex:1;background:#E7E5E0;border-radius:2px}.bars i.hl{background:#D2685A}
.num{font-family:"Source Serif 4",Georgia,serif;font-size:clamp(20px,4vw,40px)}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:4%;margin-top:auto}
.grid div{border-top:1px solid #e5e3de;padding-top:.6em;font-size:clamp(9px,1.4vw,14px)}
.pg{position:absolute;bottom:3.5%;right:4%;font-size:clamp(7px,1vw,11px);color:#a5a29c}
ul{font-size:clamp(10px,1.6vw,16px);line-height:1.6;padding-left:1.1em;margin:0}
@media (max-width:520px){.deck{padding:0;gap:10px}.slide{border-radius:0;box-shadow:none}}
</style></head><body><div class="deck">
<section class="slide"><div class="eyebrow">Seed round · November 2026</div><h1>Lumen Home</h1>
<div class="bars">${bars([14, 19, 25, 31, 29, 42, 55, 70, 100])}</div><div class="pg">1</div></section>
<section class="slide"><div class="eyebrow">The business</div><h2>Design-led lighting, sold online and in three showrooms.</h2>
<div class="grid"><div><div class="num">$8.6M</div>Run-rate revenue, +58% YoY</div><div><div class="num">38%</div>Customers who buy again within a year</div><div><div class="num">61%</div>Gross margin</div></div><div class="pg">2</div></section>
<section class="slide"><div class="eyebrow">October 2026</div><h2>Best month yet: online conversion up to 2.9%.</h2>
<div class="bars" style="height:55%">${bars([48, 52, 55, 60, 63, 71, 78, 92])}</div><div class="pg">3</div></section>
${variant >= 2 ? `
<section class="slide"><div class="eyebrow">Retention</div><h2>Repeat purchase rate by cohort</h2>
<div class="bars" style="height:58%">${bars([22, 26, 29, 33, 36, 41])}</div><div class="pg">7</div></section>` : `
<section class="slide"><div class="eyebrow">Retention</div><h2>Cohorts, repeat rate, AOV and delivery cost per order</h2>
<ul><li>Q1 cohort: 22% repeat · $142 AOV · $18 delivery</li><li>Q2 cohort: 29% repeat · $151 AOV · $17 delivery</li><li>Q3 cohort: 36% repeat · $163 AOV · $15 delivery</li><li>Oct cohort: 41% repeat (60-day) · $171 AOV · $15 delivery</li></ul>
<div class="bars" style="height:30%">${bars([22, 26, 29, 33, 36, 41])}</div><div class="pg">7</div></section>`}
<section class="slide"><div class="eyebrow">Showrooms</div><h2>Showrooms pay back in 14 months. Dubai opens Dec 2.</h2>
<ul><li>Riyadh and Amman broke even in month 6 and month 9</li><li>Dubai: lease signed, 29 of 36 launch items on track</li><li>Online orders rise 22% within 20 km of a showroom</li></ul><div class="pg">9</div></section>
<section class="slide"><div class="eyebrow">The round</div><h2>$4M seed to open 4 showrooms and build our own delivery network.</h2>
<div class="grid"><div><div class="num">45%</div>Showrooms</div><div><div class="num">35%</div>Delivery & inventory</div><div><div class="num">20%</div>Product & brand</div></div><div class="pg">11</div></section>
</div></body></html>`;

export const LUMEN_DAILY = (dateLabel = 'Monday, November 2') => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Lumen Daily</title>${FONT}
<style>${BASE_CSS}
body{padding:14px 12px 28px;max-width:720px;margin:0 auto}
.eyebrow{font-size:11px;color:#8a8781}
h1{font-family:"Source Serif 4",Georgia,serif;font-weight:500;font-size:clamp(22px,5.4vw,30px);line-height:1.12;margin:4px 0 14px;letter-spacing:-.015em}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.tile{background:#F1F0EC;border-radius:12px;padding:10px 12px 12px}
.tile .k{font-size:11.5px;color:#6f6d68}.tile .v{font-size:clamp(19px,4.6vw,24px);font-weight:600;letter-spacing:-.01em;margin:3px 0 2px}
.tile .s{font-size:11px;color:#6f6d68;line-height:1.35}
.where{background:#F1F0EC;border-radius:12px;padding:10px 12px;margin-top:8px}
.where .k{font-size:11.5px;color:#6f6d68;margin-bottom:4px}
.where ol{list-style:none;margin:0;padding:0}.where li{display:flex;gap:10px;padding:9px 0;border-top:1px solid #e3e1db;font-size:14px}.where li:first-child{border-top:0}
.where li b{font-weight:400;color:#8a8781;width:12px}
.down{color:#B4533F}.up{color:#2E7D4F}
</style></head><body>
<div class="eyebrow">${dateLabel} · Updates daily at 6:00 AM</div>
<h1>Solid week. One issue: courier damage on Dubai deliveries.</h1>
<div class="grid">
<div class="tile"><div class="k">Revenue this week</div><div class="v">$186K</div><div class="s"><span class="up">+12%</span> vs last year</div></div>
<div class="tile"><div class="k">Cash</div><div class="v">$940K</div><div class="s">11 months of runway</div></div>
<div class="tile"><div class="k">Online store</div><div class="v">2.9%</div><div class="s">Conversion, <span class="up">+0.4 pts</span>. Ads ROAS 3.8.</div></div>
<div class="tile"><div class="k">Showrooms</div><div class="v">3 open</div><div class="s">Dubai opens Dec 2. Amman traffic <span class="down">−6%</span>.</div></div>
<div class="tile"><div class="k">Returns</div><div class="v">4.1%</div><div class="s">11 damaged in transit, 9 via one courier.</div></div>
<div class="tile"><div class="k">Inventory</div><div class="v">92%</div><div class="s">In stock. Low: Arc floor lamp, Halo pendant, Dune sconce.</div></div>
<div class="tile"><div class="k">Team</div><div class="v">34 people</div><div class="s">2 open roles. Designer interviews today.</div></div>
<div class="tile"><div class="k">Reviews</div><div class="v">4.6 stars</div><div class="s">Top issues: delivery damage (11), lead time (6).</div></div>
</div>
<div class="where"><div class="k">Where to look</div><ol>
<li><b>1</b>Courier damage claims</li><li><b>2</b>Brightway price increase</li><li><b>3</b>Low stock: Arc floor lamp</li></ol></div>
</body></html>`;

export const MEETING_PREP = (first = 'Sara') => `<div class="eyebrow">Atlas Capital · Wednesday at 2</div>

# Atlas meeting prep

**Who's in the room.** Layla (lead), Karim and Dana. Atlas led 4 consumer seed rounds this year, mostly home and wellness brands.

## What they'll ask

### 1. Repeat purchase rate
> "Lighting isn't bought often. Why do customers come back?"

- **38%** of customers buy again within 12 months; October's cohort is at 41% after 60 days.
- Second orders are accessories (bulbs, shades, dimmers): low cost to ship, high margin.
- Showroom visitors repeat 1.7× more often than online-only customers.

### 2. Delivery costs
> "Bulky, fragile items are expensive to ship. How does that scale?"

- Delivery cost per order fell from **$18 to $15** this year.
- Damage rate is 1.3%; most of it comes from one courier we're replacing in December.
- With the round, own delivery in the 3 biggest cities brings it to ~$11.

## Numbers to have ready
| | October 2026 | YoY |
|---|---|---|
| Revenue run-rate | $8.6M | +58% |
| Gross margin | 61% | +3 pts |
| Online conversion | 2.9% | +0.6 pts |
| Cash | $940K | 11 mo runway |

## Watch-outs
- Let them name a valuation range first.
- Slide 7 now shows one chart; the cohort table moved to the appendix.
- September board notes still need your approval before the diligence folder is complete.

— Prepared for ${first}. 3-minute read.`;

export const LAUNCH_PLAN = () => {
  const done = ['Lease signed', 'Floor plan approved', 'Fit-out contractor hired', 'Electrical works', 'Lighting rig installed', 'Flooring', 'Display tables ordered', 'Display tables delivered', 'POS terminals', 'Wi-Fi + network', 'Music license', 'Window graphics designed', 'Launch collection selected', 'Stock transfer booked', 'Store manager hired', 'Sales team hired (4 of 4)', 'Training plan', 'Uniforms', 'Insurance', 'Utilities connected', 'Google Business profile', 'Instagram launch plan', 'Opening-day staffing', 'Local influencer list', 'Opening event venue', 'Catering booked', 'Press kit', 'Gift bags ordered', 'Payment provider set up'];
  const tracking = ['Signage install (moved to Nov 25)', 'Fit-out inspection (Nov 18 or 19)', 'Stock arrival', 'Fire safety sign-off', 'Window graphics install', 'Opening event invites'];
  const needs = ['Trade license renewal fee ($480) — needs Sara'];
  return `<div class="eyebrow">Dubai showroom · Opens Dec 2</div>

# Launch plan

Built from the last launch (Amman). **36 items: 29 done or on track, 6 tracking, 1 needs you.**

## Needs you
${needs.map((t) => `- [ ] ${t}`).join('\n')}

## Tracking
${tracking.map((t) => `- [ ] ${t}`).join('\n')}

## Done or on track
${done.map((t) => `- [x] ${t}`).join('\n')}
`;
};

export const SUPPLIER_TERMS = () => `<div class="eyebrow">Suppliers · Brightway Lighting</div>

# Brightway revised terms: summary

Brightway sent revised terms for the **$620K** annual supply agreement. Three changes matter:

1. **Prices +5%** on pendants and floor lamps from January. About $21K a year. Counter: +3% with a 12-month lock.
2. **Payment terms Net 30 → Net 45.** Good for cash. Accept.
3. **Minimum order up from 200 to 300 units.** Ties up ~$28K in stock. Counter: keep 200 for new SKUs.

Everything else is unchanged. Recommended: accept 2, counter 1 and 3.`;
