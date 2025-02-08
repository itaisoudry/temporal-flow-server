export enum EventType {
  WORKFLOW_EXECUTION_STARTED = "EVENT_TYPE_WORKFLOW_EXECUTION_STARTED",
  WORKFLOW_TASK_SCHEDULED = "EVENT_TYPE_WORKFLOW_TASK_SCHEDULED",
  WORKFLOW_TASK_STARTED = "EVENT_TYPE_WORKFLOW_TASK_STARTED",
  WORKFLOW_TASK_COMPLETED = "EVENT_TYPE_WORKFLOW_TASK_COMPLETED",
  ACTIVITY_TASK_SCHEDULED = "EVENT_TYPE_ACTIVITY_TASK_SCHEDULED",
  ACTIVITY_TASK_STARTED = "EVENT_TYPE_ACTIVITY_TASK_STARTED",
  ACTIVITY_TASK_COMPLETED = "EVENT_TYPE_ACTIVITY_TASK_COMPLETED",
  ACTIVITY_TASK_FAILED = "EVENT_TYPE_ACTIVITY_TASK_FAILED",
  ACTIVITY_TASK_TIMED_OUT = "EVENT_TYPE_ACTIVITY_TASK_TIMED_OUT",
  ACTIVITY_TASK_CANCELED = "EVENT_TYPE_ACTIVITY_TASK_CANCELED",
  WORKFLOW_EXECUTION_COMPLETED = "EVENT_TYPE_WORKFLOW_EXECUTION_COMPLETED",
  WORKFLOW_EXECUTION_FAILED = "EVENT_TYPE_WORKFLOW_EXECUTION_FAILED",
  WORKFLOW_EXECUTION_TIMED_OUT = "EVENT_TYPE_WORKFLOW_EXECUTION_TIMED_OUT",
  WORKFLOW_EXECUTION_CANCELED = "EVENT_TYPE_WORKFLOW_EXECUTION_CANCELED",
  WORKFLOW_EXECUTION_TERMINATED = "EVENT_TYPE_WORKFLOW_EXECUTION_TERMINATED",
  START_CHILD_WORKFLOW_EXECUTION_INITIATED = "EVENT_TYPE_START_CHILD_WORKFLOW_EXECUTION_INITIATED",
  CHILD_WORKFLOW_EXECUTION_STARTED = "EVENT_TYPE_CHILD_WORKFLOW_EXECUTION_STARTED",
  CHILD_WORKFLOW_EXECUTION_COMPLETED = "EVENT_TYPE_CHILD_WORKFLOW_EXECUTION_COMPLETED",
}

export enum TaskQueueKind {
  NORMAL = "TASK_QUEUE_KIND_NORMAL",
  STICKY = "TASK_QUEUE_KIND_STICKY",
}

export interface Payload {
  metadata?: Record<string, string>;
  data?: string;
}

export interface WorkflowExecutionStartedEventAttributes {
  workflowType: { name: string };
  taskQueue: { name: string; kind: TaskQueueKind };
  input?: { payloads?: Payload[] };
  workflowTaskTimeout: string;
  originalExecutionRunId: string;
  identity: string;
  firstExecutionRunId: string;
  attempt: number;
  firstWorkflowTaskBackoff: string;
  header: Record<string, any>;
  memo: Record<string, any>;
  searchAttributes: Record<string, any>;
  workflowId: string;
  parentWorkflowExecution?: {
    workflowId: string;
    runId: string;
  };
  rootWorkflowExecution?: {
    workflowId: string;
    runId: string;
  };
}

export interface WorkflowTaskScheduledEventAttributes {
  taskQueue: {
    name: string;
    kind: TaskQueueKind;
    normalName?: string;
  };
  startToCloseTimeout: string;
  attempt: number;
}

export interface WorkflowTaskStartedEventAttributes {
  scheduledEventId: string;
  identity: string;
  requestId: string;
  historySizeBytes: string;
  workerVersion: {
    buildId: string;
  };
}

export interface WorkflowTaskCompletedEventAttributes {
  scheduledEventId: string;
  startedEventId: string;
  identity: string;
  workerVersion: {
    buildId: string;
  };
  sdkMetadata?: {
    coreUsedFlags?: number[];
  };
  meteringMetadata?: Record<string, unknown>;
}

export interface WorkflowExecutionFailedEventAttributes {
  failure?: unknown;
  retryState?: string; // optional
  workflowTaskCompletedEventId: string;
}

export interface WorkflowExecutionTimedOutEventAttributes {
  retryState?: string;
}

export interface WorkflowExecutionCanceledEventAttributes {
  details?: { payloads?: Payload[] };
  workflowTaskCompletedEventId: string;
}

export interface WorkflowExecutionTerminatedEventAttributes {
  reason?: string;
  identity?: string;
  details?: { payloads?: Payload[] };
}

export interface StartChildWorkflowExecutionInitiatedEventAttributes {
  workflowId: string;
  workflowType: { name: string };
  workflowTaskCompletedEventId: string;
  input?: { payloads?: Payload[] };
  namespace: string;
  taskQueue: { name: string; kind: TaskQueueKind };
  workflowRunTimeout: string;
  workflowTaskTimeout: string;
  workflowReusePolicy: string;
  // additional fields as needed
}

export interface ChildWorkflowExecutionStartedEventAttributes {
  workflowExecution: {
    workflowId: string;
    runId: string;
  };
  workflowType: { name: string };
  initiatedEventId: string;
  parentWorkflowExecution?: {
    workflowId: string;
    runId: string;
  };
  namespace: string;
  taskQueue: { name: string; kind: TaskQueueKind };
  workflowRunTimeout: string;
  workflowTaskTimeout: string;
  workflowReusePolicy: string;
  input?: { payloads?: Payload[] };
  header: Record<string, any>;
  memo: Record<string, any>;
}

export interface ChildWorkflowExecutionCompletedEventAttributes {
  result: {
    payloads: Payload[];
  };
  initiatedEventId: string;
  startedEventId: string;
  workflowExecution: {
    workflowId: string;
    runId: string;
  };
  workflowType: { name: string };
}

export interface ActivityTaskScheduledEventAttributes {
  activityId: string;
  activityType: { name: string };
  taskQueue: { name: string; kind: TaskQueueKind; normalName?: string };
  header: Record<string, unknown>;
  input?: { payloads?: Payload[] };
  scheduleToCloseTimeout: string;
  scheduleToStartTimeout: string;
  startToCloseTimeout: string;
  heartbeatTimeout: string;
  workflowTaskCompletedEventId: string;
  retryPolicy: {
    initialInterval: string;
    backoffCoefficient: number;
    maximumInterval: string;
    maximumAttempts: number;
    nonRetryableErrorTypes: string[];
  };
  useWorkflowBuildId: boolean;
}

export interface ActivityTaskStartedEventAttributes {
  scheduledEventId: string;
  identity: string;
  requestId: string;
  attempt: number;
  workerVersion: {
    buildId: string;
  };
  
}

export interface ActivityTaskCompletedEventAttributes {
  result?: {
    payloads?: Payload[];
  };
  scheduledEventId: string;
  startedEventId: string;
  identity: string;
}

export interface ActivityTaskFailedEventAttributes {
  scheduledEventId: string;
  startedEventId: string;
  failure?: { message: string; stackTrace: string, applicationFailureInfo?: {type: string}};
}

export interface ActivityTaskTimedOutEventAttributes {
  scheduledEventId: string;
  startedEventId: string;
  timeoutType: string; // e.g. "START_TO_CLOSE"
}

export interface ActivityTaskCanceledEventAttributes {
  scheduledEventId: string;
  startedEventId: string;
}

export interface WorkflowExecutionCompletedEventAttributes {
  result: {
    payloads: Payload[];
  };
  workflowTaskCompletedEventId: string;
}

export interface Event {
  eventId: string;
  eventTime: string;
  eventType: EventType;
  version: string;
  taskId: string;

  workflowExecutionStartedEventAttributes?: WorkflowExecutionStartedEventAttributes;
  workflowTaskScheduledEventAttributes?: WorkflowTaskScheduledEventAttributes;
  workflowTaskStartedEventAttributes?: WorkflowTaskStartedEventAttributes;
  workflowTaskCompletedEventAttributes?: WorkflowTaskCompletedEventAttributes;
  activityTaskScheduledEventAttributes?: ActivityTaskScheduledEventAttributes;
  activityTaskStartedEventAttributes?: ActivityTaskStartedEventAttributes;
  workflowExecutionCompletedEventAttributes?: WorkflowExecutionCompletedEventAttributes;
  activityTaskCompletedEventAttributes?: ActivityTaskCompletedEventAttributes;
  activityTaskFailedEventAttributes?: ActivityTaskFailedEventAttributes;
  activityTaskTimedOutEventAttributes?: ActivityTaskTimedOutEventAttributes;
  activityTaskCanceledEventAttributes?: ActivityTaskCanceledEventAttributes;
  workflowExecutionFailedEventAttributes?: WorkflowExecutionFailedEventAttributes;
  workflowExecutionTimedOutEventAttributes?: WorkflowExecutionTimedOutEventAttributes;
  workflowExecutionCanceledEventAttributes?: WorkflowExecutionCanceledEventAttributes;
  workflowExecutionTerminatedEventAttributes?: WorkflowExecutionTerminatedEventAttributes;
  startChildWorkflowExecutionInitiatedEventAttributes?: StartChildWorkflowExecutionInitiatedEventAttributes;
  childWorkflowExecutionStartedEventAttributes?: ChildWorkflowExecutionStartedEventAttributes;
  childWorkflowExecutionCompletedEventAttributes?: ChildWorkflowExecutionCompletedEventAttributes;
}

export interface HistoryResponse {
  history: {
    events: Event[];
  };
  nextPageToken?: string;
}

export interface ParseOptions {}

export type TaskQueue = {
  name: string;
  kind: TaskQueueKind;
};

export type RetryPolicy = {
  initialInterval: string;
  backoffCoefficient: number;
  maximumInterval: string;
  maximumAttempts: number;
  nonRetryableErrorTypes: string[];
};

export type Activity = {
  type: "activity";
  activityId: string;
  activityType?: string;
  workflowId: string; // Which workflow this activity belongs to
  scheduleTime?: string;
  startTime?: string;
  endTime?: string;
  status?: string;
  taskQueue?: TaskQueue;
  input?: string;
  result?: string;
  header?: Record<string, any>;
  retryPolicy?: RetryPolicy;
  heartbeatTimeout?: string;
  scheduleToCloseTimeout?: string;
  scheduleToStartTimeout?: string;
  startToCloseTimeout?: string;
  relatedEventIds?: string[];
  workflowTaskCompletedEventId?: string;
  attempts?: number;
  requestId?: string;
  lastStartedTime?: string;
  lastAttemptCompleteTime?: string;
  lastWorkerIdentity?: string;
  lastFailureMessage?: string;
  lastFailureStackTrace?: string;
  lastFailureCause?: string;
  lastFailureServerFailureInfo?: Record<string, any>;
  lastFailureType?: string;
};

export type Workflow = {
  type: "workflow" | "childWorkflow";
  workflowId: string;
  runId?: string; // If available
  workflowType?: string;
  namespace?: string;
  startTime?: string;
  endTime?: string;
  status?: string;
  parentWorkflowId?: string;
  parentRunId?: string;
  input?: string;
  taskQueue?: TaskQueue;
  payload?: Payload[];
  header?: Record<string, any>;
  memo?: Record<string, any>;
  searchAttributes?: Record<string, any>;
  retryPolicy?: RetryPolicy;
  startToCloseTimeout?: string;
  attempts?: number;
  relatedEventIds?: string[];
  workflowTaskCompletedEventId?: string;
  workflowRunTimeout?: string;
  workflowTaskTimeout?: string;
  workflowReusePolicy?: string;
};

export type ChronologicalItem = Workflow | Activity;

export interface PendingChildWorkflow {
  workflowId: string;
  runId: string;
  workflowTypeName: string;
  initiatedId: string;
  parentClosePolicy: string;
}

export interface ActivityType {
  name: string;
}

export interface ApplicationFailureInfo {
  type: string;
}

export interface ServerFailureInfo {}

export interface ActivityFailure {
  message: string;
  cause?: {
    message: string;
    stackTrace: string;
    applicationFailureInfo?: ApplicationFailureInfo;
  };
  serverFailureInfo?: ServerFailureInfo;
}

export interface PendingActivity {
  activityId: string;
  activityType: ActivityType;
  state: string;
  lastStartedTime: string;
  attempt: number;
  scheduledTime: string;
  lastFailure?: ActivityFailure;
  lastWorkerIdentity: string;
  lastAttemptCompleteTime: string;
}

export interface WorkflowExecutionInfo {
  status: string;
  startTime: string;
  closeTime: string;
  parentExecution: {
    workflowId: string;
    runId: string;
  };
  parentNamespaceId: string;
}

export interface WorkflowResponse {
  pendingChildren: PendingChildWorkflow[];
  pendingActivities?: PendingActivity[];
  workflowExecutionInfo: WorkflowExecutionInfo;
}
