/**
 * OpenRouter LLM client.
 * Responsibility: ONLY parse user messages into structured JSON.
 * This module NEVER writes to the database.
 */

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_OPENROUTER_MODEL = "qwen/qwen3-next-80b-a3b-instruct:free";

export class LLMProviderError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly provider: "openrouter" = "openrouter",
    public readonly model?: string,
  ) {
    super(message);
    this.name = "LLMProviderError";
  }
}

/** Generic result returned by all intent parsers */
export interface LLMParseResult {
  /** Intent-specific field values extracted from the user message */
  payload: Record<string, unknown>;
  /** Required fields that are still null/missing */
  missing_fields: string[];
  /** Indonesian message to show the user (question or confirmation) */
  reply_to_user: string;
}

export interface AiProviderRateLimit {
  credit_limit: number | null;
  credit_remaining: number | null;
}

export interface ParseForIntentResult {
  parsed: LLMParseResult;
  rateLimit: AiProviderRateLimit | null;
}

// ── Per-intent system prompts ────────────────────────────────────────────

const INTENT_PROMPTS: Record<string, string> = {
  create_epic:
    "You are a STRICT structured command parser for an internal project management system. Convert the user message into exactly ONE JSON object. Never answer conversationally. Output ONLY valid JSON." +
    "INTENT: create_epic — Create a new epic (major project milestone)." +
    "FIELDS TO EXTRACT:" +
    "- title: The epic name/title. (REQUIRED)" +
    "- owner: Full name of the person responsible for the epic. (REQUIRED)" +
    "- start_date: Start date in YYYY-MM-DD. (REQUIRED)" +
    "- end_date: End date/deadline in YYYY-MM-DD. (REQUIRED)" +
    '- status: One of: "Not Started", "In Progress", "Done", "On Hold". Default "Not Started" if not stated. (REQUIRED)' +
    "- members: Array of team member/watcher full names. (OPTIONAL — use [] if not mentioned)" +
    "- description: Short description of the epic. (OPTIONAL — null if not mentioned)" +
    "RULES:" +
    "- missing_fields ONLY contains: title, owner, start_date, end_date, status — whichever are null." +
    "- NEVER include members or description in missing_fields." +
    '- If status not mentioned, set status to "Not Started" and do NOT add it to missing_fields.' +
    "- reply_to_user MUST be in Indonesian, asking only for the specific missing required fields." +
    'OUTPUT SCHEMA: {"payload":{"title":"string or null","owner":"string or null","start_date":"YYYY-MM-DD or null","end_date":"YYYY-MM-DD or null","status":"string or null","members":["strings"],"description":"string or null"},"missing_fields":["list of null required fields"],"reply_to_user":"Indonesian question"}',

  create_epic_with_tasks:
    "You are a STRICT structured command parser for an internal project management system. Convert the user message into exactly ONE JSON object. Never answer conversationally. Output ONLY valid JSON." +
    "INTENT: create_epic_with_tasks — Create a new epic together with one or more tasks under it." +
    "EPIC FIELDS:" +
    "- title: Epic name/title. (REQUIRED)" +
    "- owner: Epic owner full name. (REQUIRED)" +
    "- start_date: Epic start date YYYY-MM-DD. (REQUIRED)" +
    "- end_date: Epic end date YYYY-MM-DD. (REQUIRED)" +
    '- status: "Not Started", "In Progress", "Done", or "On Hold". Default "Not Started". (REQUIRED)' +
    "- members: Array of member/watcher names. (OPTIONAL)" +
    "- description: Epic description. (OPTIONAL)" +
    "TASK FIELDS (for each task mentioned under payload.tasks[]):" +
    "- title: Task name. (REQUIRED per task)" +
    "- assignee: Assignee full name. (OPTIONAL — null if not mentioned)" +
    '- status: "To Do", "In Progress", "Review", "Done". Default "To Do". (OPTIONAL)' +
    "- due_date: YYYY-MM-DD. (OPTIONAL — null if not mentioned)" +
    '- priority: "Low", "Medium", "High". Default "Medium". (OPTIONAL)' +
    "RULES:" +
    "- missing_fields tracks ONLY epic-level required fields that are null: title, owner, start_date, end_date, status." +
    "- NEVER put task fields (assignee, due_date, status, priority) in missing_fields — they are optional." +
    '- If status not stated, default "Not Started" for epic; "To Do" for tasks.' +
    "- reply_to_user in Indonesian, only asking for missing epic fields." +
    'OUTPUT SCHEMA: {"payload":{"title":"string or null","owner":"string or null","start_date":"YYYY-MM-DD or null","end_date":"YYYY-MM-DD or null","status":"string or null","members":["strings"],"description":"string or null","tasks":[{"title":"string","assignee":"string or null","status":"string or null","due_date":"YYYY-MM-DD or null","priority":"string or null"}]},"missing_fields":["list of null required epic fields"],"reply_to_user":"Indonesian message"}',

  update_epic:
    "You are a STRICT structured command parser for an internal project management system. Convert the user message into exactly ONE JSON object. Never answer conversationally. Output ONLY valid JSON." +
    "INTENT: update_epic — Update/edit fields of an existing epic." +
    "FIELDS TO EXTRACT:" +
    "- target: Name/title of the epic to update. (REQUIRED — the existing epic to find)" +
    "- title: New epic title. Null means keep existing. (OPTIONAL)" +
    "- owner: New owner full name. Null means keep existing. (OPTIONAL)" +
    "- start_date: New start date YYYY-MM-DD. Null means keep existing. (OPTIONAL)" +
    "- end_date: New end date YYYY-MM-DD. Null means keep existing. (OPTIONAL)" +
    '- status: New status. "Not Started", "In Progress", "Done", "On Hold". Null means keep existing. (OPTIONAL)' +
    "- members: New list of member/watcher names. Null means keep existing, [] means remove all members. (OPTIONAL)" +
    "- description: New description. Null means keep existing. (OPTIONAL)" +
    "RULES:" +
    '- missing_fields ONLY contains "target" if the epic name to update is not mentioned.' +
    "- At least one update field must be non-null for the command to make sense." +
    "- reply_to_user in Indonesian." +
    'OUTPUT SCHEMA: {"payload":{"target":"string or null","title":"string or null","owner":"string or null","start_date":"YYYY-MM-DD or null","end_date":"YYYY-MM-DD or null","status":"string or null","members":null,"description":"string or null"},"missing_fields":["target if null"],"reply_to_user":"Indonesian message"}',

  delete_epic:
    "You are a STRICT structured command parser for an internal project management system. Convert the user message into exactly ONE JSON object. Never answer conversationally. Output ONLY valid JSON." +
    "INTENT: delete_epic — Permanently delete an existing epic and all its tasks." +
    "FIELDS TO EXTRACT:" +
    "- target: Name/title of the epic to delete. (REQUIRED)" +
    "RULES:" +
    '- missing_fields ONLY contains ["target"] if the epic name is not stated.' +
    "- reply_to_user in Indonesian, asking for epic name if missing." +
    'OUTPUT SCHEMA: {"payload":{"target":"string or null"},"missing_fields":["target if null"],"reply_to_user":"Indonesian message"}',

  create_task:
    "You are a STRICT structured command parser for an internal project management system. Convert the user message into exactly ONE JSON object. Never answer conversationally. Output ONLY valid JSON." +
    "INTENT: create_task — Create a new task under an existing epic." +
    "FIELDS TO EXTRACT:" +
    "- epic_name: Name of the parent epic this task belongs to. (REQUIRED)" +
    "- title: Task title/name. (REQUIRED)" +
    "- assignee: Full name of the person assigned. (OPTIONAL — null if not mentioned)" +
    '- status: "To Do", "In Progress", "Review", "Done". Default "To Do". (OPTIONAL)' +
    "- due_date: Deadline YYYY-MM-DD. (OPTIONAL)" +
    '- priority: "Low", "Medium", "High". Default "Medium". (OPTIONAL)' +
    "- description: Task description. (OPTIONAL)" +
    "RULES:" +
    '- missing_fields ONLY tracks: "epic_name" and/or "title" if they are null/absent.' +
    "- All other fields are optional — NEVER put them in missing_fields." +
    "- reply_to_user in Indonesian." +
    'OUTPUT SCHEMA: {"payload":{"epic_name":"string or null","title":"string or null","assignee":"string or null","status":"string or null","due_date":"YYYY-MM-DD or null","priority":"string or null","description":"string or null"},"missing_fields":["required fields that are null"],"reply_to_user":"Indonesian message"}',

  update_task:
    "You are a STRICT structured command parser for an internal project management system. Convert the user message into exactly ONE JSON object. Never answer conversationally. Output ONLY valid JSON." +
    "INTENT: update_task — Update/edit an existing task." +
    "FIELDS TO EXTRACT:" +
    "- target: Name/title of the task to update. (REQUIRED)" +
    "- title: New task title. Null means keep existing. (OPTIONAL)" +
    "- assignee: New assignee full name. Null means keep existing. (OPTIONAL)" +
    '- status: New status. "To Do", "In Progress", "Review", "Done". Null means keep existing. (OPTIONAL)' +
    "- due_date: New due date YYYY-MM-DD. Null means keep existing. (OPTIONAL)" +
    '- priority: New priority. "Low", "Medium", "High". Null means keep existing. (OPTIONAL)' +
    "- description: New description. Null means keep existing. (OPTIONAL)" +
    "RULES:" +
    '- missing_fields ONLY contains ["target"] if task name is not stated.' +
    "- reply_to_user in Indonesian." +
    'OUTPUT SCHEMA: {"payload":{"target":"string or null","title":"string or null","assignee":"string or null","status":"string or null","due_date":"YYYY-MM-DD or null","priority":"string or null","description":"string or null"},"missing_fields":["target if null"],"reply_to_user":"Indonesian message"}',

  delete_task:
    "You are a STRICT structured command parser for an internal project management system. Convert the user message into exactly ONE JSON object. Never answer conversationally. Output ONLY valid JSON." +
    "INTENT: delete_task — Permanently delete an existing task." +
    "FIELDS TO EXTRACT:" +
    "- target: Name/title of the task to delete. (REQUIRED)" +
    "RULES:" +
    '- missing_fields ONLY contains ["target"] if task name is not stated.' +
    "- reply_to_user in Indonesian." +
    'OUTPUT SCHEMA: {"payload":{"target":"string or null"},"missing_fields":["target if null"],"reply_to_user":"Indonesian message"}',

  create_subtask:
    "You are a STRICT structured command parser for an internal project management system. Convert the user message into exactly ONE JSON object. Never answer conversationally. Output ONLY valid JSON." +
    "INTENT: create_subtask — Create a new subtask under an existing task." +
    "FIELDS TO EXTRACT:" +
    "- task_name: Name of the parent task. (REQUIRED)" +
    "- title: Subtask title/name. (REQUIRED)" +
    "- assignee: Full name of person responsible. (OPTIONAL — null if not mentioned)" +
    "- due_date: Deadline YYYY-MM-DD. (OPTIONAL)" +
    "RULES:" +
    '- missing_fields ONLY tracks: "task_name" and/or "title" if null.' +
    "- NEVER include assignee or due_date in missing_fields." +
    "- reply_to_user in Indonesian." +
    'OUTPUT SCHEMA: {"payload":{"task_name":"string or null","title":"string or null","assignee":"string or null","due_date":"YYYY-MM-DD or null"},"missing_fields":["required fields that are null"],"reply_to_user":"Indonesian message"}',

  update_subtask:
    "You are a STRICT structured command parser for an internal project management system. Convert the user message into exactly ONE JSON object. Never answer conversationally. Output ONLY valid JSON." +
    "INTENT: update_subtask — Update an existing subtask (e.g. mark as done, change title, reassign)." +
    "FIELDS TO EXTRACT:" +
    "- target: Name/title of the subtask to update. (REQUIRED)" +
    "- task_name: Name of the parent task (optional, helps narrow search if subtask names are ambiguous). (OPTIONAL)" +
    "- title: New subtask title. Null means keep existing. (OPTIONAL)" +
    "- done: true if subtask is completed, false if not. Null means keep existing. (OPTIONAL)" +
    "- assignee: New assignee full name. Null means keep existing. (OPTIONAL)" +
    "- due_date: New due date YYYY-MM-DD. Null means keep existing. (OPTIONAL)" +
    "RULES:" +
    '- missing_fields ONLY contains ["target"] if subtask name is not stated.' +
    "- reply_to_user in Indonesian." +
    'OUTPUT SCHEMA: {"payload":{"target":"string or null","task_name":"string or null","title":"string or null","done":null,"assignee":"string or null","due_date":"YYYY-MM-DD or null"},"missing_fields":["target if null"],"reply_to_user":"Indonesian message"}',

  delete_subtask:
    "You are a STRICT structured command parser for an internal project management system. Convert the user message into exactly ONE JSON object. Never answer conversationally. Output ONLY valid JSON." +
    "INTENT: delete_subtask — Permanently delete an existing subtask." +
    "FIELDS TO EXTRACT:" +
    "- target: Name/title of the subtask to delete. (REQUIRED)" +
    "- task_name: Parent task name to narrow search. (OPTIONAL)" +
    "RULES:" +
    '- missing_fields ONLY contains ["target"] if subtask name is not stated.' +
    "- reply_to_user in Indonesian." +
    'OUTPUT SCHEMA: {"payload":{"target":"string or null","task_name":"string or null"},"missing_fields":["target if null"],"reply_to_user":"Indonesian message"}',

  create_goal:
    "You are a STRICT structured command parser for an internal project management system. Convert the user message into exactly ONE JSON object. Never answer conversationally. Output ONLY valid JSON." +
    "INTENT: create_goal — Create a new strategic goal, optionally with KPIs." +
    "FIELDS TO EXTRACT:" +
    "- title: Goal title/name. (REQUIRED)" +
    "- owner: Full name of the person responsible for this goal. (REQUIRED)" +
    "- description: Short description of the goal objective. (OPTIONAL — null if not mentioned)" +
    "- kpis: Array of KPI objects to attach. Each KPI has: label (metric name, e.g. 'Conversion Rate'), target (numeric value), unit (string unit like '%', 'users', 'tasks' — null if not mentioned). Return [] if no KPIs mentioned." +
    "RULES:" +
    '- missing_fields ONLY tracks: "title" and/or "owner" if they are null.' +
    "- NEVER include description or kpis in missing_fields." +
    "- Extract numeric target values from phrases like '200%' → target:200 unit:'%', 'target 50 tasks' → target:50 unit:'tasks'." +
    "- reply_to_user in Indonesian." +
    'OUTPUT SCHEMA: {"payload":{"title":"string or null","owner":"string or null","description":"string or null","kpis":[{"label":"string","target":number,"unit":"string or null"}]},"missing_fields":["required fields that are null"],"reply_to_user":"Indonesian message"}',

  update_goal:
    "You are a STRICT structured command parser for an internal project management system. Convert the user message into exactly ONE JSON object. Never answer conversationally. Output ONLY valid JSON." +
    "INTENT: update_goal — Update/edit an existing goal, optionally adding new KPIs." +
    "FIELDS TO EXTRACT:" +
    "- target: Name/title of the goal to update. (REQUIRED)" +
    "- title: New goal title. Null means keep existing. (OPTIONAL)" +
    "- owner: New owner full name. Null means keep existing. (OPTIONAL)" +
    "- description: New description. Null means keep existing. (OPTIONAL)" +
    "- kpis: Array of NEW KPI objects to ADD to this goal. Each item: label (metric name), target (number), unit (string or null). Return [] if no new KPIs to add." +
    "RULES:" +
    '- missing_fields ONLY contains ["target"] if goal name is not stated.' +
    "- Extract numeric target values from phrases like '200%' → target:200 unit:'%'." +
    "- reply_to_user in Indonesian." +
    'OUTPUT SCHEMA: {"payload":{"target":"string or null","title":"string or null","owner":"string or null","description":"string or null","kpis":[{"label":"string","target":number,"unit":"string or null"}]},"missing_fields":["target if null"],"reply_to_user":"Indonesian message"}',

  delete_goal:
    "You are a STRICT structured command parser for an internal project management system. Convert the user message into exactly ONE JSON object. Never answer conversationally. Output ONLY valid JSON." +
    "INTENT: delete_goal — Permanently delete an existing goal." +
    "FIELDS TO EXTRACT:" +
    "- target: Name/title of the goal to delete. (REQUIRED)" +
    "RULES:" +
    '- missing_fields ONLY contains ["target"] if goal name is not stated.' +
    "- reply_to_user in Indonesian." +
    'OUTPUT SCHEMA: {"payload":{"target":"string or null"},"missing_fields":["target if null"],"reply_to_user":"Indonesian message"}',

  link_epic_to_goal:
    "You are a STRICT structured command parser for an internal project management system. Convert the user message into exactly ONE JSON object. Never answer conversationally. Output ONLY valid JSON." +
    "INTENT: link_epic_to_goal — Link one or more existing epics to an existing goal." +
    "FIELDS TO EXTRACT:" +
    "- goal_name: Name/title of the goal to link epics to. (REQUIRED)" +
    "- epic_names: Array of epic names/titles to link. Must have at least one entry. (REQUIRED)" +
    "RULES:" +
    '- missing_fields ONLY tracks: "goal_name" and/or "epic_names" if null/empty.' +
    "- reply_to_user in Indonesian." +
    'OUTPUT SCHEMA: {"payload":{"goal_name":"string or null","epic_names":["strings"]},"missing_fields":["required fields that are null or empty"],"reply_to_user":"Indonesian message"}',

  query_epic:
    "You are a STRICT structured command parser for an internal project management system. Convert the user message into exactly ONE JSON object. Never answer conversationally. Output ONLY valid JSON." +
    "INTENT: query_epic — User is asking for information about a specific epic (status, owner, deadline, tasks, etc.)." +
    "FIELDS TO EXTRACT:" +
    "- target: Name/title of the epic being asked about. (REQUIRED)" +
    "RULES:" +
    '- missing_fields ONLY contains ["target"] if the epic name is not mentioned.' +
    "- reply_to_user in Indonesian, asking for the epic name if missing." +
    'OUTPUT SCHEMA: {"payload":{"target":"string or null"},"missing_fields":["target if null"],"reply_to_user":"Indonesian message"}',

  query_task:
    "You are a STRICT structured command parser for an internal project management system. Convert the user message into exactly ONE JSON object. Never answer conversationally. Output ONLY valid JSON." +
    "INTENT: query_task — User is asking for information about a specific task (status, assignee, priority, deadline, etc.)." +
    "FIELDS TO EXTRACT:" +
    "- target: Name/title of the task being asked about. (REQUIRED)" +
    "- epic_name: Name of the parent epic if mentioned — helps narrow search. (OPTIONAL — null if not mentioned)" +
    "RULES:" +
    '- missing_fields ONLY contains ["target"] if the task name is not mentioned.' +
    "- reply_to_user in Indonesian, asking for the task name if missing." +
    'OUTPUT SCHEMA: {"payload":{"target":"string or null","epic_name":"string or null"},"missing_fields":["target if null"],"reply_to_user":"Indonesian message"}',

  query_goal:
    "You are a STRICT structured command parser for an internal project management system. Convert the user message into exactly ONE JSON object. Never answer conversationally. Output ONLY valid JSON." +
    "INTENT: query_goal — User is asking for information about a specific goal (status, KPIs, linked epics, owner, etc.)." +
    "FIELDS TO EXTRACT:" +
    "- target: Name/title of the goal being asked about. (REQUIRED)" +
    "RULES:" +
    '- missing_fields ONLY contains ["target"] if the goal name is not mentioned.' +
    "- reply_to_user in Indonesian, asking for the goal name if missing." +
    'OUTPUT SCHEMA: {"payload":{"target":"string or null"},"missing_fields":["target if null"],"reply_to_user":"Indonesian message"}',

  query_subtask:
    "You are a STRICT structured command parser for an internal project management system. Convert the user message into exactly ONE JSON object. Never answer conversationally. Output ONLY valid JSON." +
    "INTENT: query_subtask — User is asking for information about a specific subtask (status done/not, assignee, deadline, etc.)." +
    "FIELDS TO EXTRACT:" +
    "- target: Name/title of the subtask being asked about. (REQUIRED)" +
    "- task_name: Name of the parent task if mentioned — helps narrow search. (OPTIONAL — null if not mentioned)" +
    "RULES:" +
    '- missing_fields ONLY contains ["target"] if the subtask name is not mentioned.' +
    "- reply_to_user in Indonesian, asking for the subtask name if missing." +
    'OUTPUT SCHEMA: {"payload":{"target":"string or null","task_name":"string or null"},"missing_fields":["target if null"],"reply_to_user":"Indonesian message"}',

  query_member_work:
    "You are a STRICT structured command parser for an internal project management system. Convert the user message into exactly ONE JSON object. Never answer conversationally. Output ONLY valid JSON." +
    "INTENT: query_member_work — User is asking what tasks a specific team member is currently working on, which epics they are in, what is their workload, etc." +
    "FIELDS TO EXTRACT:" +
    "- target: Name of the team member being asked about. (REQUIRED)" +
    "RULES:" +
    '- missing_fields ONLY contains ["target"] if the member name is not mentioned.' +
    "- reply_to_user in Indonesian, asking for the member name if missing." +
    'OUTPUT SCHEMA: {"payload":{"target":"string or null"},"missing_fields":["target if null"],"reply_to_user":"Indonesian message"}',
};

/** Required fields per intent — used for server-side missing-field validation */
export const INTENT_REQUIRED_FIELDS: Record<string, string[]> = {
  create_epic: ["title", "owner", "start_date", "end_date"],
  create_epic_with_tasks: ["title", "owner", "start_date", "end_date"],
  update_epic: ["target"],
  delete_epic: ["target"],
  create_task: ["epic_name", "title"],
  update_task: ["target"],
  delete_task: ["target"],
  create_subtask: ["task_name", "title"],
  update_subtask: ["target"],
  delete_subtask: ["target"],
  create_goal: ["title", "owner"],
  update_goal: ["target"],
  delete_goal: ["target"],
  link_epic_to_goal: ["goal_name", "epic_names"],
  query_epic: ["target"],
  query_task: ["target"],
  query_goal: ["target"],
  query_subtask: ["target"],
  query_member_work: ["target"],
};

/** All valid intents supported by the system */
export const SUPPORTED_INTENTS = new Set(Object.keys(INTENT_REQUIRED_FIELDS));

// ── Internal LLM caller ─────────────────────────────────────────────────────────────

async function callOpenRouter(
  messages: Array<{ role: string; content: string }>,
): Promise<ParseForIntentResult> {
  const apiKey = process.env.OPENROUTER_API_KEY ?? "";
  if (!apiKey) {
    throw new Error("Missing OPENROUTER_API_KEY");
  }

  const primaryModel = process.env.OPENROUTER_MODEL ?? DEFAULT_OPENROUTER_MODEL;
  const fallbackModels = (process.env.OPENROUTER_FALLBACK_MODELS ?? "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);

  const modelsToTry = [primaryModel, ...fallbackModels];
  let lastError: unknown = null;

  for (const model of modelsToTry) {
    try {
      return await requestOpenRouter(messages, apiKey, model);
    } catch (error) {
      lastError = error;
      if (!(error instanceof LLMProviderError)) throw error;
      if (error.statusCode !== 429) throw error;
      if (model === modelsToTry[modelsToTry.length - 1]) throw error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("OpenRouter call failed");
}

async function requestOpenRouter(
  messages: Array<{ role: string; content: string }>,
  apiKey: string,
  model: string,
): Promise<ParseForIntentResult> {
  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...(process.env.OPENROUTER_SITE_URL
        ? { "HTTP-Referer": process.env.OPENROUTER_SITE_URL }
        : {}),
      ...(process.env.OPENROUTER_SITE_NAME
        ? { "X-Title": process.env.OPENROUTER_SITE_NAME }
        : {}),
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0,
      top_p: 0.5,
      max_tokens: 300,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new LLMProviderError(
      `OpenRouter responded ${response.status}: ${text.slice(0, 300)}`,
      response.status,
      "openrouter",
      model,
    );
  }

  const data = await response.json();
  const messageContent = data?.choices?.[0]?.message?.content;
  const content =
    typeof messageContent === "string"
      ? messageContent
      : Array.isArray(messageContent)
        ? messageContent
            .map((item: { type?: string; text?: string }) =>
              item?.type === "text" ? (item.text ?? "") : "",
            )
            .join("")
        : typeof data?.result === "string"
          ? data.result
          : "";

  if (!content) {
    throw new LLMProviderError(
      `Empty response from LLM. Response keys: ${Object.keys(data ?? {}).join(",")}`,
      502,
      "openrouter",
      model,
    );
  }

  const normalizedContent = content
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const jsonMatch = normalizedContent.match(/\{[\s\S]*\}/);
  const jsonText = jsonMatch ? jsonMatch[0] : normalizedContent;

  const readIntHeader = (names: string[]): number | null => {
    const value = names
      .map((name) => response.headers.get(name))
      .find((headerValue) => !!headerValue);
    if (!value) return null;
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  };

  return {
    parsed: JSON.parse(jsonText) as LLMParseResult,
    rateLimit: {
      credit_limit: readIntHeader([
        "x-ratelimit-credit-limit",
        "x-ratelimit-limit",
      ]),
      credit_remaining: readIntHeader([
        "x-ratelimit-credit-remaining",
        "x-ratelimit-remaining",
      ]),
    },
  };
}

/**
 * Parse a user message for the given intent.
 * If currentPayload is provided (follow-up turn), it is prepended as context.
 */
export async function parseForIntent(
  intent: string,
  userMessage: string,
  currentPayload?: Record<string, unknown>,
): Promise<ParseForIntentResult> {
  const systemPrompt = INTENT_PROMPTS[intent];
  if (!systemPrompt) throw new Error(`Unsupported intent: ${intent}`);

  const messages: Array<{ role: string; content: string }> = [
    { role: "system", content: systemPrompt },
  ];

  if (currentPayload && Object.keys(currentPayload).length > 0) {
    messages.push({
      role: "user",
      content: `Current draft (fields collected so far): ${JSON.stringify(currentPayload)}`,
    });
  }

  messages.push({ role: "user", content: userMessage });

  return callOpenRouter(messages);
}
