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
    CHILD_WORKFLOW_EXECUTION_STARTED = "EVENT_TYPE_CHILD_WORKFLOW_EXECUTION_STARTED"
}


export enum TaskQueueKind {
    NORMAL = "TASK_QUEUE_KIND_NORMAL",
    STICKY = "TASK_QUEUE_KIND_STICKY"
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

    // Add newly referenced attributes:
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
    header: {
        fields: {
            [key: string]: Payload;
        };
    };
    workflowId: string;
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
    retryState?: string; // optional, depending on Temporal version
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
    // other fields as needed
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
    failure?: unknown; // You can refine this based on Temporal's Failure structure
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

export interface WorkflowExecutionCompletedEventAttributes {
    result: {
        payloads: Payload[];
    };
    workflowTaskCompletedEventId: string;
}

export type Payload = {
    metadata?: Record<string, string>;
    data?: string;
};

export type Activity = {
    type: 'activity';
    activityId: string;
    activityType?: string;
    workflowId: string; // Which workflow this activity belongs to
    scheduleTime?: string;
    startTime?: string;
    endTime?: string;
    status?: string;
    resultPayload?: Payload[];
    relatedEventIds?: string[];
};

export type Workflow = {
    type: 'workflow' | 'childWorkflow';
    workflowId: string;
    runId?: string; // If available
    workflowType?: string;
    startTime?: string;
    endTime?: string;
    status?: string;
    parentWorkflowId?: string;
    parentRunId?: string;
    relatedEventIds?: string[];
};

export type ChronologicalItem = Workflow | Activity;

type HistoryEvent = {
    eventId: string;
    eventTime: string;
    eventType: string;
    version: string;
    taskId: string;
    workflowExecutionStartedEventAttributes?: {
        workflowType: { name: string };
        firstExecutionRunId: string;
        // ... other fields omitted for brevity
        workflowId: string;
    };
    workflowExecutionCompletedEventAttributes?: {
        result?: { payloads?: Payload[] };
        workflowTaskCompletedEventId: string;
    };
    workflowExecutionFailedEventAttributes?: any;
    workflowExecutionTimedOutEventAttributes?: any;
    workflowExecutionCanceledEventAttributes?: any;
    workflowExecutionTerminatedEventAttributes?: any;
    activityTaskScheduledEventAttributes?: {
        activityId: string;
        activityType: { name: string };
        workflowTaskCompletedEventId: string;
    };
    activityTaskStartedEventAttributes?: {
        scheduledEventId: string;
    };
    activityTaskCompletedEventAttributes?: {
        scheduledEventId: string;
        startedEventId: string;
        identity: string;
        result?: { payloads?: Payload[] };
    };
    activityTaskFailedEventAttributes?: {
        scheduledEventId: string;
    };
    activityTaskTimedOutEventAttributes?: {
        scheduledEventId: string;
    };
    activityTaskCanceledEventAttributes?: {
        scheduledEventId: string;
    };
    startChildWorkflowExecutionInitiatedEventAttributes?: {
        workflowId: string;
        workflowType: { name: string };
        // runId not known yet here, only after started
    };
    childWorkflowExecutionStartedEventAttributes?: {
        workflowExecution?: {
            workflowId: string;
            runId: string;
        };
        workflowType?: { name: string };
        initiatedEventId: string;
        parentWorkflowExecution?: {
            workflowId: string;
            runId: string;
        };
    };
};

export interface ParseOptions {
    // Future options if needed
}

export interface HistoryResponse {
    history: {
        events: HistoryEvent[];
    };
}

