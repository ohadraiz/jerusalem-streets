const fs = require('fs');
const t = fs.readFileSync('tools/tasks-dashboard.js', 'utf8');

const oldStr = `.tag--s-blocked { color: #6a3d8f; border-color: #c6a9dd; background: #f5edfb; }\n  .card__title {`;

const newStr = `.tag--s-blocked { color: #6a3d8f; border-color: #c6a9dd; background: #f5edfb; }\n\n  /* Agent status badges (from agent-status.json via Guli) */\n  .agent-status { display: inline-flex; align-items: center; gap: 4px; font-size: .75rem; padding: 2px 8px; border-radius: 999px; border: 1px solid; white-space: nowrap; }\n  .agent-status strong { font-weight: 700; }\n  .agent-status__note { opacity: .8; font-weight: 400; }\n  .agent-status--active { color: #1d5b3c; border-color: #a6c9b3; background: #e9f1ea; }\n  .agent-status--waiting { color: #6b5310; border-color: #d9c285; background: #fdf6e3; }\n  .agent-status--blocked { color: #6a3d8f; border-color: #c6a9dd; background: #f5edfb; }\n  .agent-status--done { color: #1d5b3c; border-color: #a6c9b3; background: #e9f1ea; }\n  .agent-status--unknown { color: #5d6b63; border-color: #ded9cd; background: #f4f2ec; }\n\n  .card__title {`;

if (t.includes(oldStr)) {
  const newT = t.replace(oldStr, newStr);
  fs.writeFileSync('tools/tasks-dashboard.js', newT, 'utf8');
  console.log('CSS updated successfully');
} else {
  console.log('OLD STRING NOT FOUND');
  console.log('Looking for:', JSON.stringify(oldStr));
}