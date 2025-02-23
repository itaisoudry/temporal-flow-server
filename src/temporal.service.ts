import {
  Activity,
  ChronologicalItem,
  Event,
  EventType,
  HistoryResponse,
  ParseOptions,
  TaskQueueKind,
  Workflow,
  WorkflowResponse,
} from "./domain/events";
import { SearchResponse } from "./domain/executions";
import { InternalServerError, NotFoundException } from "./excpetions";

export default class TemporalService {
  apiKey: string;
  endpoint: string;
  headers: Record<string, string>;
  constructor() {
    this.apiKey = process.env.TEMPORAL_API_KEY ?? "";
    this.endpoint = process.env.TEMPORAL_ENDPOINT ?? "";

    if (!this.apiKey) {
      throw new Error(
        "Temporal API Key is required - set TEMPORAL_API_KEY envvar"
      );
    }

    if (!this.endpoint) {
      throw new Error(
        "Temporal Endpoint is required - set TEMPORAL_ENDPOINT envvar"
      );
    }

    this.headers = {
      Authorization: `Bearer ${this.apiKey}`,
    };
  }

  async searchWorkflows(query: string, namespace: string) {
    if(!query){
      query = ""
    }
    const url = `https://${
      this.endpoint
    }.web.tmprl.cloud/api/v1/namespaces/${namespace}/workflows?query=${encodeURIComponent(
      query
    )}`;
    const response = await fetch(url, { headers: this.headers });
    if (!response.ok) {
      throw new InternalServerError(
        `Failed to search workflows. Status: ${response.status}`
      );
    }

    const data = (await response.json()) as SearchResponse;
    if (!data.executions) {
      return [];
    }
    for (let execution of data.executions) {
      execution.status = this.convertWorkflowStatusToStatus(execution.status)
        .toLowerCase()
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join("");
    }
    return data;
  }

  async getRootWorkflowData(
    namespace: string,
    rootWorkflowId: string,
    rootWorkflowRunId: string
  ) {
    const historyResponse = await this.getWorkflowHistoryData(
      namespace,
      rootWorkflowId,
      rootWorkflowRunId
    );
    const items = await this.parseTemporalHistory(
      historyResponse,
      namespace,
      rootWorkflowRunId
    );

    // Get additional data for non-completed workflows
    for (const item of items) {
      if (
        (item.type === "workflow" || item.type === "childWorkflow") &&
        item.status !== "COMPLETED"
      ) {
        const workflowData = await this.getWorkflowData(
          namespace,
          item.workflowId
        );

        item.status = this.convertWorkflowStatusToStatus(
          workflowData.workflowExecutionInfo.status
        );
        item.startTime = workflowData.workflowExecutionInfo.startTime;
        item.endTime = workflowData.workflowExecutionInfo.closeTime;
        item.parentWorkflowId =
          workflowData.workflowExecutionInfo?.parentExecution?.workflowId;
        item.parentWorkflowRunId =
          workflowData.workflowExecutionInfo?.parentExecution?.runId;
        if (workflowData.pendingActivities) {
          for (const pendingActivity of workflowData.pendingActivities) {
            const activityItem = items.find(
              (item) =>
                item.type === "activity" &&
                item.activityId === pendingActivity.activityId
            ) as Activity | undefined;

            if (activityItem) {
              activityItem.attempts = pendingActivity.attempt;
              if (activityItem.attempts > 1) {
                activityItem.status = "RETRYING";
              }
              if (activityItem.status == "SCHEDULED") {
                activityItem.status = "PENDING";
              }
              activityItem.lastStartedTime = pendingActivity.lastStartedTime;
              activityItem.lastAttemptCompleteTime =
                pendingActivity.lastAttemptCompleteTime;
              activityItem.lastWorkerIdentity =
                pendingActivity.lastWorkerIdentity;

              if (pendingActivity.lastFailure) {
                activityItem.lastFailure = JSON.stringify(
                  pendingActivity.lastFailure
                );
              }
            }
          }
        }
      }
    }

    return items;
  }

  private async getWorkflowData(
    namespace: string,
    workflowId: string,
    runId: string = ""
  ): Promise<WorkflowResponse> {
    const url = `https://${this.endpoint}.web.tmprl.cloud/api/v1/namespaces/${namespace}/workflows/${workflowId}?execution.runId=${runId}`;
    const response = await fetch(url, { headers: this.headers });

    if (!response.ok) {
      if (response.status === 404) {
        throw new NotFoundException(`workflow ${workflowId} not found`);
      }
      throw new InternalServerError(
        `Failed to fetch workflow data. Status: ${response.status}`
      );
    }

    return await response.json();
  }

  private async getWorkflowHistoryData(
    namespace: string,
    workflowId: string,
    runId: string
  ) {
    const baseUrl = `https://${
      this.endpoint
    }.web.tmprl.cloud/api/v1/namespaces/${namespace}/workflows/${encodeURIComponent(
      workflowId
    )}/history?execution.runId=${runId}&next_page_token=`;
    const allEvents = [];
    let nextPageToken = null;
    do {
      // encode nextPageToken with url encoding
      let url = nextPageToken
        ? baseUrl + encodeURIComponent(nextPageToken)
        : baseUrl;
      const response = await fetch(url, { headers: this.headers });
      if (!response.ok) {
        if (response.status === 404) {
          throw new NotFoundException(`workflow ${workflowId} not found`);
        }
        throw new InternalServerError(
          `Failed to fetch workflow history. Status: ${response.status}`
        );
      }
      const data = (await response.json()) as HistoryResponse;
      allEvents.push(...data.history.events);
      nextPageToken = data.nextPageToken;
    } while (nextPageToken);

    return allEvents;
  }

  private parsePayloads(
    payloads?: { metadata?: Record<string, string>; data?: string }[]
  ): string | undefined {
    if (!payloads || payloads.length === 0) {
      return undefined;
    }

    // If single payload, return decoded string
    if (payloads.length === 1) {
      return payloads[0]?.data
        ? Buffer.from(payloads[0].data, "base64").toString()
        : "null";
    }

    // If multiple payloads, convert to JSON array string
    const decodedPayloads = payloads
      .map((payload) =>
        payload?.data ? Buffer.from(payload.data, "base64").toString() : "null"
      )
      .filter((payload): payload is string => payload !== undefined);

    return decodedPayloads.length > 0
      ? `[${decodedPayloads.join(", ")}]`
      : undefined;
  }

  private parseTemporalHistory(
    events: Event[],
    namespace: string,
    rootWorkflowRunId: string
  ): ChronologicalItem[] {
    const chronologicalList: ChronologicalItem[] = [];
    const childWorkflowsMap: Record<string, Workflow> = {};
    const activityMap: Record<string, Activity> = {};
    const rootWorkflow = this.extractRootWorkflow(
      events,
      namespace,
      rootWorkflowRunId
    );
    chronologicalList.push(rootWorkflow);

    for (const event of events) {
      switch (event.eventType) {
        case EventType.WORKFLOW_EXECUTION_STARTED: {
          if (!rootWorkflow) {
            console.error("Root workflow not found");
            throw new NotFoundException("Root workflow not found");
          }
          break;
        }

        case EventType.WORKFLOW_EXECUTION_COMPLETED:
        case EventType.WORKFLOW_EXECUTION_FAILED:
        case EventType.WORKFLOW_EXECUTION_TIMED_OUT:
        case EventType.WORKFLOW_EXECUTION_CANCELED:
        case EventType.WORKFLOW_EXECUTION_TERMINATED: {
          const wf = chronologicalList[0] as Workflow;
          if (wf) {
            wf.endTime = event.eventTime;
            wf.relatedEventIds = wf.relatedEventIds || [];
            wf.relatedEventIds.push(event.eventId);
            wf.status = this.convertEventTypeToStatus(event.eventType);
          }

          if (event.eventType === EventType.WORKFLOW_EXECUTION_COMPLETED) {
            wf.result = this.parsePayloads(
              event.workflowExecutionCompletedEventAttributes?.result?.payloads
            );
          }
          if (event.eventType === EventType.WORKFLOW_EXECUTION_FAILED) {
            wf.result = JSON.stringify(
              event.workflowExecutionFailedEventAttributes
            );
          }
          if (event.eventType === EventType.WORKFLOW_EXECUTION_TERMINATED) {
            wf.result = JSON.stringify(
              event.workflowExecutionTerminatedEventAttributes
            );
          }
          break;
        }

        case EventType.ACTIVITY_TASK_SCHEDULED: {
          const attrs = event.activityTaskScheduledEventAttributes;
          if (attrs) {
            const act: Activity = {
              type: "activity",
              activityId: attrs.activityId,
              activityType: attrs.activityType.name,
              workflowId: rootWorkflow.workflowId,
              workflowRunId: rootWorkflow.runId,
              scheduleTime: event.eventTime,
              scheduleToCloseTimeout: attrs.scheduleToCloseTimeout,
              scheduleToStartTimeout: attrs.scheduleToStartTimeout,
              startToCloseTimeout: attrs.startToCloseTimeout,
              heartbeatTimeout: attrs.heartbeatTimeout,
              retryPolicy: attrs.retryPolicy,
              input: this.parsePayloads(attrs.input?.payloads),
              status: "SCHEDULED",
              relatedEventIds: [event.eventId],
              workflowTaskCompletedEventId: attrs.workflowTaskCompletedEventId,
              taskId: event.taskId,
              sortEventTime: event.eventTime,
              sortEventId: event.eventId,
              taskQueue: attrs.taskQueue,
            };
            activityMap[event.eventId] = act;
            chronologicalList.push(act);
          }
          break;
        }

        case EventType.ACTIVITY_TASK_STARTED: {
          const attrs = event.activityTaskStartedEventAttributes;
          if (attrs) {
            const item = activityMap[attrs.scheduledEventId];
            if (item.status === "SCHEDULED") {
              item.status = "STARTED";
            }
            item.startTime = event.eventTime;
            item.relatedEventIds = item.relatedEventIds || [];
            item.relatedEventIds.push(event.eventId);

            if (event.activityTaskStartedEventAttributes?.lastFailure) {
              item.lastFailure = JSON.stringify(
                event.activityTaskStartedEventAttributes.lastFailure
              );
            }
          }
          break;
        }

        case EventType.ACTIVITY_TASK_COMPLETED: {
          const attrs = event.activityTaskCompletedEventAttributes;
          if (attrs) {
            const item = activityMap[attrs.scheduledEventId];
            if (item) {
              item.endTime = event.eventTime;
              item.status = "COMPLETED";
              item.relatedEventIds = item.relatedEventIds || [];
              item.relatedEventIds.push(event.eventId);
              item.result = this.parsePayloads(attrs.result?.payloads);
            }
          }

          break;
        }
        case EventType.ACTIVITY_TASK_FAILED: {
          const attrs = event.activityTaskFailedEventAttributes;
          if (attrs) {
            const item = activityMap[attrs.scheduledEventId];
            if (item) {
              item.endTime = event.eventTime;
              item.status = "FAILED";
              item.relatedEventIds = item.relatedEventIds || [];
              item.relatedEventIds.push(event.eventId);
              item.failure = JSON.stringify(attrs.failure);
            }
          }
          break;
        }
        case EventType.ACTIVITY_TASK_TIMED_OUT: {
          const attrs = event.activityTaskTimedOutEventAttributes;
          if (attrs) {
            const item = activityMap[attrs.scheduledEventId];
            if (item) {
              item.endTime = event.eventTime;
              item.status = "TIMED_OUT";
              item.relatedEventIds = item.relatedEventIds || [];
              item.relatedEventIds.push(event.eventId);
            }
          }
          break;
        }
        case EventType.ACTIVITY_TASK_CANCELED: {
          const attrs = event.activityTaskCanceledEventAttributes;
          if (attrs) {
            const item = activityMap[attrs.scheduledEventId];
            if (item) {
              item.endTime = event.eventTime;
              item.status = this.convertEventTypeToStatus(event.eventType);
              item.relatedEventIds = item.relatedEventIds || [];
              item.relatedEventIds.push(event.eventId);
            }
          }
          break;
        }

        case EventType.START_CHILD_WORKFLOW_EXECUTION_INITIATED: {
          const attrs =
            event.startChildWorkflowExecutionInitiatedEventAttributes;
          if (attrs) {
            const childWorkflow: Workflow = {
              type: "childWorkflow",
              workflowId: attrs.workflowId,
              startTime: event.eventTime,
              status: "INITIATED",
              parentWorkflowId: rootWorkflow.workflowId,
              runId: "temp_run_id",
              workflowType: attrs.workflowType?.name,
              relatedEventIds: [event.eventId],
              workflowTaskCompletedEventId: attrs.workflowTaskCompletedEventId,
              namespace: attrs.namespace,
              taskQueue: attrs.taskQueue,
              workflowRunTimeout: attrs.workflowRunTimeout,
              workflowTaskTimeout: attrs.workflowTaskTimeout,
              workflowReusePolicy: attrs.workflowReusePolicy,
              header: attrs.header,
              memo: attrs.memo,
              searchAttributes: attrs.searchAttributes,
              taskId: event.taskId,
            };

            childWorkflowsMap[event.eventId] = childWorkflow;
            chronologicalList.push(childWorkflow);
          }
          break;
        }
        case EventType.CHILD_WORKFLOW_EXECUTION_STARTED: {
          const attrs = event.childWorkflowExecutionStartedEventAttributes;
          if (attrs && attrs.workflowExecution) {
            const childWorkflow = childWorkflowsMap[attrs.initiatedEventId];
            if (childWorkflow) {
              childWorkflow.startTime = event.eventTime;
              childWorkflow.relatedEventIds =
                childWorkflow.relatedEventIds || [];
              childWorkflow.relatedEventIds.push(event.eventId);
              childWorkflow.runId = attrs.workflowExecution.runId;
              childWorkflow.status = "RUNNING";
              childWorkflow.sortEventTime = event.eventTime;
              childWorkflow.sortEventId = event.eventId;
            }
          }
          break;
        }
        case EventType.CHILD_WORKFLOW_EXECUTION_COMPLETED: {
          const attrs = event.childWorkflowExecutionCompletedEventAttributes;
          if (attrs) {
            const childWorkflow = childWorkflowsMap[attrs.initiatedEventId];
            if (childWorkflow) {
              childWorkflow.endTime = event.eventTime;
              childWorkflow.status = "COMPLETED";
              childWorkflow.relatedEventIds =
                childWorkflow.relatedEventIds || [];
              childWorkflow.relatedEventIds.push(event.eventId);
              childWorkflow.result = this.parsePayloads(attrs.result?.payloads);
            }
          }
          break;
        }

        default:
          break;
      }
    }

    return chronologicalList;
  }

  private extractRootWorkflow(
    events: Event[],
    namespace: string,
    runId: string
  ): Workflow {
    for (const event of events) {
      if (event.eventType === EventType.WORKFLOW_EXECUTION_STARTED) {
        const attrs = event.workflowExecutionStartedEventAttributes;
        if (attrs) {
          const wf: Workflow = {
            type: "workflow",
            workflowId: attrs.workflowId,
            runId: runId,
            workflowType: attrs.workflowType.name,
            startTime: event.eventTime,
            status: "RUNNING",
            relatedEventIds: [event.eventId],
            input: this.parsePayloads(attrs.input?.payloads),
            header: attrs.header,
            attempts: attrs.attempt,
            searchAttributes: attrs.searchAttributes,
            memo: attrs.memo,
            taskQueue: attrs.taskQueue,
            namespace: namespace,
            parentWorkflowId: attrs.parentWorkflowExecution?.workflowId,
            parentWorkflowRunId: attrs.parentWorkflowExecution?.runId,
            parentWorkflowNamespace: attrs.parentWorkflowNamespace,
            originalExecutionRunId: attrs.originalExecutionRunId,
            firstExecutionRunId: attrs.firstExecutionRunId,
            workflowTaskTimeout: attrs.workflowTaskTimeout,
            workflowRunTimeout: attrs.workflowRunTimeout,
            taskId: event.taskId,
            sortEventTime: event.eventTime,
            sortEventId: event.eventId,
          };
          return wf;
        }
      }
    }
    throw new NotFoundException("Root workflow not found");
  }

  private convertEventTypeToStatus(status: string) {
    switch (status) {
      case "EVENT_TYPE_WORKFLOW_EXECUTION_STARTED":
      case "EVENT_TYPE_CHILD_WORKFLOW_EXECUTION_STARTED":
      case "EVENT_TYPE_ACTIVITY_TASK_STARTED":
        return "RUNNING";
      case "EVENT_TYPE_WORKFLOW_EXECUTION_COMPLETED":
      case "EVENT_TYPE_CHILD_WORKFLOW_EXECUTION_COMPLETED":
      case "EVENT_TYPE_ACTIVITY_TASK_COMPLETED":
        return "COMPLETED";
      case "EVENT_TYPE_WORKFLOW_EXECUTION_FAILED":
      case "EVENT_TYPE_CHILD_WORKFLOW_EXECUTION_FAILED":
      case "EVENT_TYPE_ACTIVITY_TASK_FAILED":
        return "FAILED";
      case "EVENT_TYPE_WORKFLOW_EXECUTION_TIMED_OUT":
      case "EVENT_TYPE_CHILD_WORKFLOW_EXECUTION_TIMED_OUT":
      case "EVENT_TYPE_ACTIVITY_TASK_TIMED_OUT":
        return "TIMED_OUT";
      case "EVENT_TYPE_WORKFLOW_EXECUTION_CANCELED":
      case "EVENT_TYPE_CHILD_WORKFLOW_EXECUTION_CANCELED":
      case "EVENT_TYPE_ACTIVITY_TASK_CANCELED":
        return "CANCELED";
      case "EVENT_TYPE_WORKFLOW_EXECUTION_TERMINATED":
      case "EVENT_TYPE_CHILD_WORKFLOW_EXECUTION_TERMINATED":
        return "TERMINATED";
      case "EVENT_TYPE_ACTIVITY_TASK_SCHEDULED":
        return "SCHEDULED";
      default:
        return status;
    }
  }

  private convertWorkflowStatusToStatus(status: string) {
    switch (status) {
      case "WORKFLOW_EXECUTION_STATUS_RUNNING":
        return "RUNNING";
      case "WORKFLOW_EXECUTION_STATUS_COMPLETED":
        return "COMPLETED";
      case "WORKFLOW_EXECUTION_STATUS_FAILED":
        return "FAILED";
      case "WORKFLOW_EXECUTION_STATUS_TIMED_OUT":
        return "TIMED_OUT";
      case "WORKFLOW_EXECUTION_STATUS_CANCELED":
        return "CANCELED";
      case "WORKFLOW_EXECUTION_STATUS_TERMINATED":
        return "TERMINATED";
      default:
        return status;
    }
  }
}
