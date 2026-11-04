// Source-qualified projection; editing always uses the untouched native row.
export function persistedAgendaChildren(rows) {
  return rows.filter(child => !child.isNew).map(child => {
    const base=child.baseValues || child;
    return {id:child.id,parent_task_id:child.parentTaskId,title:base.title,owner_id:base.ownerId || null,status:base.status,due_date:base.dueDate || null};
  });
}
export function buildAgenda({
  tasks = [],
  children = [],
  deals = [],
  users = [],
} = {}) {
  const verifiedAlias = (alias) => {
    if (!["Edu", "Mafe"].includes(alias)) return null;
    const matches = users.filter((user) => user.alias === alias);
    return matches.length === 1 ? matches[0].id : null;
  };
  const usersById = new Map(users.map((user) => [user.id, user]));
  const dealsById = new Map(deals.map((deal) => [deal.id, deal]));
  const childrenByParent = new Map();
  for (const child of children) {
    const parentId = child.parent_task_id;
    if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, []);
    childrenByParent
      .get(parentId)
      .push({
        ...child,
        ownerLabel:
          usersById.get(child.owner_id)?.alias ||
          usersById.get(child.owner_id)?.name ||
          child.owner_id ||
          "",
      });
  }
  const parents = tasks.map((task) => ({
    key: `special_task:${task.id}`,
    source: "special_task",
    nativeRow: task,
    id: task.id,
    title: task.title || "",
    description: task.description || "",
    comment: task.comments || "",
    type: "task",
    nativeType: "task",
    status: task.status,
    ownerKey: task.owner_id ? `user:${task.owner_id}` : "unassigned",
    ownerLabel:
      usersById.get(task.owner_id)?.alias ||
      usersById.get(task.owner_id)?.name ||
      task.owner_id ||
      "",
    dealId: task.deal_id || "",
    dealName: dealsById.get(task.deal_id)?.name || "",
    dueDate: task.due_date || "",
    createdAt: task.created_at || "",
    importance: task.importance_score,
    urgency: task.urgency_score,
    children: childrenByParent.get(task.id) || [],
  }));
  const activities = deals.flatMap((deal) =>
    (deal.activities || []).map((activity) => ({
      key: `deal_activity:${activity.id}`,
      source: "deal_activity",
      nativeRow: activity.nativeRow || {id:activity.id, deal_id:deal.id, title:activity.title, type:activity.type, status:activity.status, responsible:activity.responsible ?? null, due_date:activity.dueDate ?? null, comment:activity.comment ?? null, importance_score:activity.importanceScore ?? null, urgency_score:activity.urgencyScore ?? null},
      id: activity.id,
      title: activity.title || "",
      description: "",
      comment: activity.comment || "",
      type: activity.type === "emailType" ? "email" : activity.type,
      nativeType: activity.type,
      status: activity.status,
      ownerKey: verifiedAlias(activity.responsible)
        ? `user:${verifiedAlias(activity.responsible)}`
        : activity.responsible
          ? `alias:${activity.responsible}`
          : "unassigned",
      ownerLabel: activity.responsible || "",
      dealId: deal.id,
      dealName: deal.name || "",
      dueDate: activity.dueDate || "",
      createdAt: activity.createdAt || "",
      importance: activity.importanceScore,
      urgency: activity.urgencyScore,
      children: [],
    })),
  );
  return [
    ...new Map(
      [...parents, ...activities].map((row) => [row.key, row]),
    ).values(),
  ];
}

export function dateGroup(row, today) {
  if (!row.dueDate) return "none";
  if (row.dueDate < today) return "overdue";
  return row.dueDate === today ? "today" : "next";
}

export function priorityScore(row) {
  const values = [row.importance, row.urgency];
  if (
    values.some(
      (value) =>
        value == null ||
        value === "" ||
        !Number.isFinite(Number(value)) ||
        Number(value) < 1 ||
        Number(value) > 5,
    )
  )
    return null;
  return Number(row.importance) + Number(row.urgency);
}

export function priorityBand(row) {
  const score = priorityScore(row);
  return score == null
    ? "unknown"
    : score >= 8
      ? "8+"
      : score >= 6
        ? "6+"
        : score >= 4
          ? "4+"
          : "rest";
}

export function selectAgenda(rows, filters = {}, today) {
  const q = (filters.search || "").trim().toLocaleLowerCase();
  const filtered = rows
    .filter((row) => {
      const text = [
        row.title,
        row.description,
        row.comment,
        row.dealName,
        row.ownerLabel,
        ...row.children.map((child) => child.title),
      ]
        .join(" ")
        .toLocaleLowerCase();
      return (
        (!q || text.includes(q)) &&
        (!filters.owner || row.ownerKey === filters.owner) &&
        (!filters.type || row.type === filters.type) &&
        (!filters.linked ||
          Boolean(row.dealId) === (filters.linked === "yes")) &&
        (!filters.date || dateGroup(row, today) === filters.date)
      );
    })
    .sort(
      (a, b) =>
        (a.dueDate || "9999-12-31").localeCompare(b.dueDate || "9999-12-31") ||
        (priorityScore(b) ?? -1) - (priorityScore(a) ?? -1) ||
        a.key.localeCompare(b.key),
    );
  const pending = filtered.filter(
    (row) => !["done", "cancelled"].includes(row.status),
  );
  const history = filtered.filter((row) =>
    ["done", "cancelled"].includes(row.status),
  );
  const counts = {
    pending: pending.length,
    history: history.length,
    overdue: 0,
    today: 0,
    next: 0,
    none: 0,
  };
  for (const row of pending) counts[dateGroup(row, today)]++;
  return { pending, history, counts };
}
