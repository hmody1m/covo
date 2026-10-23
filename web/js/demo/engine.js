import { SEED_DECK, LUMEN_DAILY, MEETING_PREP, LAUNCH_PLAN, SUPPLIER_TERMS } from './content.js';

// ─────────────────────────────────────────────────────────────────────────────
// Built-in demo: a scripted sample story that shows every part of the UI
// (brief, approvals, artifacts, email drafts, dashboards) without a model.
// The company, people and numbers are fictional.
// Isomorphic: runs on the server (server/agent/demo-host.js) and in the
// standalone browser edition. `host` provides storage + timing:
//   addFeed, updateFeed, upsertTopic, setTopicStatus, saveArtifact, addApproval,
//   upsertTask, setState, sleep, getStep, setStep, setSuggestions, userName,
//   addRoutine, reset, loadIds, saveIds
// ─────────────────────────────────────────────────────────────────────────────

export const DEMO_SUGGESTIONS = {
  await_export: ['Go ahead.'],
  await_slide: ['Slide 7 feels crowded.'],
  await_send: ['Yes. Email the deck to Layla at Atlas.'],
  await_daily: ['Make me a one-page dashboard I can check each morning: are we healthy, and what needs attention?'],
  free: ['Restart demo'],
};

export function createDemo(host) {
  let stopped = false;
  const ids = host.loadIds?.() || {}; // topic + artifact ids created by seed()
  const first = () => (host.userName() || 'Sara').split(' ')[0];

  const pace = (t) => Math.min(2200, 650 + t.length * 16);

  // Post bubbles one by one into a single assistant item (typing dots between).
  async function say(topicId, paragraphs, opts) {
    let item = null, text = '';
    for (let i = 0; i < paragraphs.length; i++) {
      if (stopped) break;
      host.setState('writing');
      if (i > 0 || opts?.delayFirst !== false) await host.sleep(pace(paragraphs[i]));
      text = text ? text + '\n\n' + paragraphs[i] : paragraphs[i];
      if (!item) item = host.addFeed({ kind: 'assistant', text, topicId, source: 'main' });
      else host.updateFeed(item.id, { text });
    }
    return item;
  }

  function at(h, m) { const d = new Date(); d.setHours(h, m, 0, 0); return d.getTime(); }
  function steps(list) { return list.map((text, i) => ({ ts: Date.now() - (list.length - i) * 600_000, kind: 'update', text })); }

  function seed() {
    const T = (title, emoji, status) => host.upsertTopic({ title, emoji, status });
    ids.brief = T('Morning brief', '', 'done').id;
    ids.hiring = T('Hiring', '', 'in_progress').id;
    ids.supplier = T('Supplier contract', '', 'in_progress').id;
    ids.launch = T('Dubai showroom launch', '🏬', 'needs_you').id;
    ids.round = T('Seed round: Atlas Capital', '📈', 'needs_you').id;
    ids.customers = T('Customers', '', 'in_progress').id;

    const deck = host.saveArtifact({ title: 'Seed deck', kind: 'deck', content: SEED_DECK(1), summary: 'Updated with October. 11 slides.', topicId: ids.round, ts: at(6, 12) });
    ids.deck = deck.id;
    host.saveArtifact({ title: 'Dubai launch plan', kind: 'checklist', content: LAUNCH_PLAN(), summary: '36 items: 29 on track, 6 tracking, 1 needs you.', topicId: ids.launch, ts: at(5, 40) });
    host.saveArtifact({ title: 'Brightway terms summary', kind: 'doc', content: SUPPLIER_TERMS(), summary: '+5% prices, Net 45, higher minimum order.', topicId: ids.supplier, ts: at(5, 20) });

    const task = (t) => host.upsertTask({ ...t, demo: true });
    task({ title: 'Designer hire', goal: 'Hire a product designer before the January collection.', topicId: ids.hiring, topicTitle: 'Hiring', status: 'running', progress: { done: 2, total: 3 }, note: 'Two interviews booked for today. Omar accepted the warehouse lead offer.', steps: steps(['Screened 64 portfolios against the brief', 'Booked 2 final interviews for today (11:00, 3:30)', 'Sent the take-home brief to the third finalist']) });
    task({ title: 'Brightway terms', goal: 'Renew the Brightway supply agreement on good terms.', topicId: ids.supplier, topicTitle: 'Supplier contract', status: 'running', note: 'Revised terms summarized. +5% prices, Net 45.', steps: steps(['Compared the new terms with last year\'s agreement', 'Summarized 3 material changes', 'Drafted a counter: +3% with a 12-month lock']) });
    task({ title: 'Dubai launch plan', goal: 'Open the Dubai showroom on Dec 2.', topicId: ids.launch, topicTitle: 'Dubai showroom launch', status: 'needs_you', progress: { done: 29, total: 36 }, note: 'Trade license renewal fee needs your OK ($480).', steps: steps(['Built the plan from the Amman launch: 36 items', 'Filled in the trade license renewal form', 'Requested fit-out inspection dates']) });
    task({ title: 'Diligence folder', goal: 'Complete the diligence folder before the Atlas meeting.', topicId: ids.round, topicTitle: 'Seed round: Atlas Capital', status: 'needs_you', progress: { done: 18, total: 21 }, note: 'September board notes need your approval.', steps: steps(['Indexed 18 files', 'Missing: cohort export, Dubai lease, September board notes']) });
    task({ title: 'Damaged deliveries', goal: 'Replace items damaged in transit and fix the courier problem.', topicId: ids.customers, topicTitle: 'Customers', status: 'running', progress: { done: 11, total: 14 }, note: '11 of 14 replacements drafted. 11 tickets came from one courier.', steps: steps(['Pulled 14 damaged-delivery tickets from the support inbox', 'Matched them to orders and couriers', 'Drafted 11 replacements']) });
    task({ title: 'Deck update with October', goal: 'Update the seed deck with October numbers.', topicId: ids.round, topicTitle: 'Seed round: Atlas Capital', status: 'running', progress: { done: 10, total: 11 }, note: 'Slide 7 needs your eye.', steps: steps(['Updated revenue, cohorts and runway', 'Rebuilt charts on slides 3 and 7']) });
    task({ title: 'Stock watch', goal: 'Flag low stock before it affects sales.', topicId: ids.supplier, topicTitle: 'Supplier contract', status: 'running', note: '3 SKUs low. Reorder drafted for the Arc floor lamp.', steps: steps(['Checked stock levels across 3 warehouses', 'Flagged Arc floor lamp, Halo pendant, Dune sconce']) });

    host.addRoutine({ title: 'Morning brief', prompt: 'Check every active topic and task, update anything stale, then send my morning brief.', time: '07:00', mode: 'main' });

    host.addFeed({ kind: 'assistant', topicId: ids.brief, source: 'main', ts: at(8, 30), text: [
      '- [[Hiring]]: Omar accepted the warehouse lead offer. Two designer interviews are booked for today.',
      '- [[Supplier contract]]: Brightway wants +5% and Net 45. The comparison is ready.',
      '- [[Dubai showroom]]: Opens Dec 2. The trade license renewal needs your OK and $480.',
      '- [[Seed round]]: Atlas meets Wednesday at 2. The deck has October numbers. 1 slide needs your eye.',
      '- [[Customers]]: 14 damaged-delivery tickets since Friday, 11 from one courier. Replacements are drafted.',
    ].join('\n') });
    host.setStep('brief');
    host.setSuggestions([]);
    host.saveIds?.(ids);
  }

  async function launch() {
    host.setStep('launch');
    host.setTopicStatus(ids.launch, 'needs_you');
    await say(ids.launch, [
      'The Dubai showroom opens in 40 days. I turned the Amman launch into a plan: 36 items.',
      '29 are done or on track. 6 I\'m tracking. 1 needs you today.',
      'Trade license: the renewal form is filled in. The fee is $480.',
    ]);
    if (stopped) return;
    await host.sleep(700);
    const ap = host.addApproval({ title: 'Trade license renewal', detail: 'Municipality fee', amount: 480, currency: 'USD', actionLabel: 'Approve', kind: 'payment', expiresAt: Date.now() + 10 * 60_000, scope: 'main', topicId: ids.launch, demo: true });
    host.addFeed({ kind: 'approval', approvalId: ap.id, topicId: ids.launch, source: 'main' });
    host.setStep('await_fee');
    host.setState('waiting');
  }

  async function round() {
    host.setStep('round');
    await host.sleep(1400);
    await say(ids.round, [
      'Atlas meets Wednesday at 2. Here\'s where the round stands.',
      'Deck: updated with October, 11 slides. Slide 7 needs your eye.',
    ]);
    if (stopped) return;
    await host.sleep(800);
    host.addFeed({ kind: 'artifact', artifactId: ids.deck, topicId: ids.round, source: 'main' });
    await say(ids.round, [
      'Diligence folder: 18 of 21 files are ready. Missing the cohort export, the Dubai lease and the September board notes.',
      'I can export the first two now. The board notes need your approval.',
    ]);
    host.setStep('await_export');
    host.setSuggestions(DEMO_SUGGESTIONS.await_export);
    host.setState('idle');
  }

  async function daily() {
    host.setStep('daily');
    const t = host.upsertTopic({ title: 'Lumen Daily', emoji: '', status: 'in_progress' });
    host.setState('thinking');
    await host.sleep(900);
    await say(t.id, ['Working on it. Connecting your store, ads, inventory, support inbox and bank.']);
    host.setState('working');
    await host.sleep(2600);
    await say(t.id, ['Lumen Daily is ready. It updates every morning at 6:00, before your brief.']);
    await host.sleep(600);
    const d = new Date();
    const label = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    const a = host.saveArtifact({ title: 'Lumen Daily', kind: 'dashboard', content: LUMEN_DAILY(label), summary: 'Solid week. One issue: courier damage on Dubai deliveries.', topicId: t.id, refresh: 'Updates daily at 6:00 AM', preview: { headline: 'Solid week. One issue: courier damage on Dubai deliveries.', stats: [['Revenue this week', '$186K'], ['Cash', '$940K'], ['Online store', '2.9%']] } });
    host.addFeed({ kind: 'artifact', artifactId: a.id, topicId: t.id, source: 'main' });
    host.setTopicStatus(t.id, 'done');
    host.addRoutine({ title: 'Update Lumen Daily', prompt: 'Update the Lumen Daily dashboard with the latest numbers.', time: '06:00', mode: 'task' });
    host.setStep('free');
    host.setSuggestions(DEMO_SUGGESTIONS.free);
    host.setState('idle');
  }

  async function onUserText(text) {
    const step = host.getStep();
    host.setSuggestions([]);
    if (/^restart demo$/i.test(text.trim()) || (/restart/i.test(text) && step === 'free')) {
      host.setState('thinking');
      await host.sleep(500);
      host.reset();
      for (const k of Object.keys(ids)) delete ids[k];
      seed();
      host.setState('idle');
      await start();
      return;
    }
    if (step === 'brief' || step === 'launch') { await launch(); return; }
    if (step === 'await_fee') {
      await say(ids.launch, ['The $480 license fee is waiting on your Approve above. Everything else for Dubai is moving.']);
      host.setState('waiting');
      return;
    }
    if (step === 'await_export') {
      host.setState('thinking');
      await host.sleep(900);
      await say(ids.round, ['Done. 20 of 21.']);
      host.upsertTask({ title: 'Diligence folder', progress: { done: 20, total: 21 }, note: 'Cohort export and Dubai lease added. Board notes need your approval.' });
      host.setState('working');
      await host.sleep(1600);
      await say(ids.round, [
        'Prep: I went through the Atlas partners\' recent consumer investments. Expect questions on repeat purchase rate and delivery costs.',
        'I wrote answers for both using your numbers. It\'s a 3-minute read.',
      ]);
      await host.sleep(600);
      const prep = host.saveArtifact({ title: 'Atlas meeting prep', kind: 'doc', content: MEETING_PREP(first()), summary: 'Atlas Capital · Wednesday at 2', topicId: ids.round });
      host.addFeed({ kind: 'artifact', artifactId: prep.id, topicId: ids.round, source: 'main' });
      host.setStep('await_slide');
      host.setSuggestions(DEMO_SUGGESTIONS.await_slide);
      host.setState('idle');
      return;
    }
    if (step === 'await_slide') {
      host.setState('thinking');
      await host.sleep(1200);
      host.saveArtifact({ aid: ids.deck, content: SEED_DECK(2), summary: 'Updated with October. 11 slides + appendix.' });
      await say(ids.round, ['Moved the cohort table to the appendix and kept one chart on slide 7. Better?']);
      host.setStep('await_send');
      host.setSuggestions(DEMO_SUGGESTIONS.await_send);
      host.setState('idle');
      return;
    }
    if (step === 'await_send') {
      host.setState('thinking');
      await host.sleep(1000);
      await say(ids.round, ['Drafted with the diligence folder link. Send it from you?']);
      await host.sleep(500);
      host.addFeed({ kind: 'email', topicId: ids.round, source: 'main', status: 'draft', demo: true, draft: { to: 'Layla, Atlas Capital', cc: '', subject: 'Lumen Home deck + diligence folder', body: `Hi Layla,\n\nSharing our deck for Wednesday along with the diligence folder.\n\n${first()}` } });
      host.setStep('await_email');
      host.setState('idle');
      return;
    }
    if (step === 'await_email') {
      await say(ids.round, ['The email to Layla is ready above. Tap Send when you\'re happy with it.']);
      return;
    }
    if (step === 'await_daily') { await daily(); return; }
    // free chat
    host.setState('thinking');
    await host.sleep(900);
    await say(null, [
      'I\'m in demo mode, so I can only play the sample story.',
      'Connect a model in Settings → Model and I\'ll do this for real: background tasks, approvals, artifacts and your own devices.',
    ]);
    host.setStep('free');
    host.setSuggestions(DEMO_SUGGESTIONS.free);
    host.setState('idle');
  }

  async function start() {
    stopped = false;
    if (host.getStep() === 'brief') { await host.sleep(1600); await launch(); }
  }

  return {
    seed,
    start,
    stop() { stopped = true; },
    async handle(items) {
      stopped = false;
      for (const it of items) if (it.type === 'user') await onUserText(it.text || '');
    },
    async onApproval(ap, decision) {
      stopped = false;
      if (host.getStep() !== 'await_fee') return;
      if (decision === 'approve') {
        host.setState('working');
        await host.sleep(1300);
        await say(ids.launch || ap.topicId, [
          'Paid. Next up is the fit-out inspection. I asked for Nov 18 or 19.',
          'Heads-up: the signage vendor moved install to Nov 25. Still on schedule; I\'m keeping an eye on it.',
        ]);
        host.upsertTask({ title: 'Dubai launch plan', status: 'running', progress: { done: 30, total: 36 }, note: 'License paid. Inspection requested for Nov 18 or 19.' });
        host.setTopicStatus(ids.launch || ap.topicId, 'in_progress');
      } else {
        await say(ids.launch || ap.topicId, ['Okay, holding the license renewal. I\'ll bring it back before the office closes today.']);
      }
      await round();
    },
    async onEmail(item, action) {
      if (host.getStep() !== 'await_email') return;
      if (action === 'dismiss') await say(item.topicId, ['Okay, I kept it in drafts.']);
      host.setTopicStatus(item.topicId, 'in_progress');
      host.upsertTask({ title: 'Deck update with October', status: 'done', progress: { done: 11, total: 11 }, note: action === 'send' ? 'Sent to Layla with the diligence folder link.' : 'Ready. Email kept in drafts.' });
      host.setStep('await_daily');
      host.setSuggestions(DEMO_SUGGESTIONS.await_daily);
      host.setState('idle');
    },
    ids,
  };
}
