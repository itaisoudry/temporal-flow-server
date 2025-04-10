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
    return await response.json();
  }

  async getWorkflowData(namespace: string, workflowId: string, runId: string) {
    const url = `https://${this.endpoint}.web.tmprl.cloud/api/v1/namespaces/${namespace}/workflows/${workflowId}/history?execution.runId=${runId}`;
    const response = await fetch(url, { headers: this.headers });
    if (!response.ok) {
      throw new InternalServerError(
        `Failed to get workflow data. Status: ${response.status}`
      );
    }
    return await response.json();
  }

  async getWorkflowEvents(
    namespace: string,
    workflowId: string,
    runId: string
  ) {
    const url = `https://${this.endpoint}.web.tmprl.cloud/api/v1/namespaces/${namespace}/workflows/${workflowId}/history?execution.runId=${runId}&next_page_token=`;
    const response = await fetch(url, { headers: this.headers });
    if (!response.ok) {
      throw new InternalServerError(
        `Failed to get workflow events. Status: ${
          response.status
        }, ${JSON.stringify(await response.json())}`
      );
    }
    const allEvents = [];
    let nextPageToken = null;
    do {
      const data = await response.json();
      allEvents.push(...data.history.events);
      nextPageToken = data.nextPageToken;
    } while (nextPageToken);
    return allEvents;
  }
}
