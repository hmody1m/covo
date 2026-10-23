// How many things need the user: tasks waiting on them + approvals not already covered by such a task.
export function needsCount(s) {
  const tasks = s.tasks.filter((x) => x.status === 'needs_you');
  const topics = new Set(tasks.map((x) => x.topicId));
  return tasks.length + s.approvals.filter((a) => a.status === 'pending' && !a.taskId && !topics.has(a.topicId)).length;
}
