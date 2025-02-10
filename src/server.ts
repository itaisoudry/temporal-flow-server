import express, { Request, Response } from "express";
import Temporal from "./temporal.service";
import { NotFoundException } from "./excpetions";

const PORT = 7531; // Uncommon port number

const app = express();
interface WorkflowQuery {
  id: string;
  namespace: string;
}

const temporal = new Temporal();

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  next();
});

app.get(
  "/workflow",
  async (req: Request<{}, {}, {}, WorkflowQuery>, res: Response) => {
    const { id, namespace } = req.query;
    try {
      if (!id || !namespace) {
        res.status(400).json({ error: "Missing required query parameters" });
        return;
      }

      const data = await temporal.getRootWorkflowData(namespace, id);
      res.status(200).json(data);
    } catch (error) {
      console.error(error);
      if (error instanceof NotFoundException) {
        res.status(404).json({
          error: error.message,
        });
      } else {
        res.status(500).json({
          error:
            error instanceof Error
              ? error.message
              : "An unknown error occurred",
        });
      }
    }
  }
);

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
