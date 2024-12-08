export interface HistoryResponse {
    history: {
        events: Event[];
    };
}

export enum EventType {
    WORKFLOW_EXECUTION_STARTED = "EVENT_TYPE_WORKFLOW_EXECUTION_STARTED",
    WORKFLOW_TASK_SCHEDULED = "EVENT_TYPE_WORKFLOW_TASK_SCHEDULED",
    WORKFLOW_TASK_STARTED = "EVENT_TYPE_WORKFLOW_TASK_STARTED",
    WORKFLOW_TASK_COMPLETED = "EVENT_TYPE_WORKFLOW_TASK_COMPLETED",
    ACTIVITY_TASK_SCHEDULED = "EVENT_TYPE_ACTIVITY_TASK_SCHEDULED",
    ACTIVITY_TASK_STARTED = "EVENT_TYPE_ACTIVITY_TASK_STARTED",
    WORKFLOW_EXECUTION_COMPLETED = "EVENT_TYPE_WORKFLOW_EXECUTION_COMPLETED"
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
}

export interface WorkflowExecutionStartedEventAttributes {
    workflowType: {
        name: string;
    };
    taskQueue: {
        name: string;
        kind: TaskQueueKind;
    };
    input: {
        payloads: Payload[];
    };
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

export interface ActivityTaskScheduledEventAttributes {
    activityId: string;
    activityType: {
        name: string;
    };
    taskQueue: {
        name: string;
        kind: TaskQueueKind;
        normalName?: string;
    };
    header: Record<string, unknown>;
    input: {
        payloads: Payload[];
    };
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

export interface Payload {
    metadata: {
        [key: string]: string;
    };
    data?: string;
}
