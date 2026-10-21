const fs = require('fs');
const t = fs.readFileSync('tasks.html', 'utf8');
const dataMatch = t.match(/<script type="application\/json" id="tasks-data">([\s\S]*?)<\/script>/);
if (dataMatch) {
  const data = JSON.parse(dataMatch[1]);
  // Find DEV-1
  const task = data.tasks.find(t => t.id === 'DEV-1');
  if (task) {
    console.log('=== DEV-1 Example ===\n');
    console.log('ID:', task.id);
    console.log('Title:', task.title);
    console.log('Team:', task.team);
    console.log('Priority:', task.priority.marker, task.priority.label);
    console.log('Status:', task.status.marker, task.status.label, '|', task.status.note);
    console.log('Owner:', task.owner);
    console.log('Agents:', task.agents ? task.agents.join(', ') : 'none');
    console.log('Source:', task.source);
    console.log('Line in source:', task.line);
    console.log('Context:', task.context);
  }
}