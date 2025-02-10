# Temporal Flow API Server

Try it out: [Temporal Flow Web](https://itaisoudrydry.github.io/temporal-flow-web)

This server provides an API to fetch and parse Temporal workflow data in a more consumable format. It simplifies the process of analyzing workflow executions by providing a clean, chronological view of workflows and their activities.
This will provider the needed data for the UI to display the workflow history.

## Prerequisites

- Node.js (v16 or higher)
- npm
- A Temporal Cloud account with API credentials

## Setup

1. Clone the repository:

   ```bash
   git clone itaisoudry/temporal-flow-server
   cd temporal-flow-server
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory with the following variables:

   ```
   TEMPORAL_API_KEY=<your-temporal-api-key>
   TEMPORAL_ENDPOINT=<your-temporal-endpoint>
   ```

   Note:

   - The `TEMPORAL_API_KEY` can be found in your Temporal Cloud account settings
   - The `TEMPORAL_ENDPOINT` is your Temporal namespace endpoint (e.g., "foo.bar.tmprl.cloud")
   - Do not include "https://" or ".web.tmprl.cloud" in the endpoint

## Running the Server

Start the development server:

```bash
npm run dev
```

The server will start on port 7531

Note: ATM the port is constant, but in the future it will be configurable, so don't change it.

You should see the message:

```
Server is running on port 7531
```

## Running with Docker

### Pulling from latest available image

```bash
docker run -p 7531:7531 \
  -e TEMPORAL_API_KEY=your-api-key \
  -e TEMPORAL_ENDPOINT=your-endpoint \
  ghcr.io/itaisoudry/temporal-flow-server:main
```


### Build the Docker Image

```bash
docker build -t temporal-flow-server .
```

### Run the Container

You can run the container using either environment variables or a .env file.

Using environment variables:

```bash
docker run -p 7531:7531 \
  -e TEMPORAL_API_KEY=your-api-key \
  -e TEMPORAL_ENDPOINT=your-endpoint \
  temporal-flow-server
```

Using a .env file:

```bash
docker run -p 7531:7531 \
  --env-file .env \
  temporal-flow-server
```

## API Endpoints

### Get Workflow History

```
GET /workflow?namespace={namespace}&id={workflowId}
```

Parameters:

- `namespace`: Your Temporal namespace
- `id`: The workflow ID you want to fetch

Example request:

```bash
curl "http://localhost:7531/workflow?namespace=your-namespace&id=your-workflow-id"
```

## Response Format

The API returns a chronological list of workflow and activity events, including:

- Workflow execution details
- Activity task lifecycles
- Child workflow executions
- Input/output payloads (automatically decoded from base64)
- Timing information
- Status updates

## Security Notes

- The server includes CORS headers allowing all origins (`*`)
- Make sure to keep your `.env` file secure and never commit it to version control
- Consider implementing additional security measures for production use

## Troubleshooting

Common issues:

1. **"Temporal API Key is required"**: Ensure your `.env` file contains the correct `TEMPORAL_API_KEY`
2. **"Temporal Endpoint is required"**: Check that `TEMPORAL_ENDPOINT` is properly set in your `.env`
3. **Connection errors**: Verify your API key has the correct permissions and your endpoint is correct
