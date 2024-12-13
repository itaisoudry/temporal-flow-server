import express, { Request, Response } from 'express';
import Temporal from "./temporal.service";

const PORT: number = 3001;

const app = express();
interface WorkflowQuery {
    id: string;
    namespace: string;
}

const temporal = new Temporal()

app.use((req,res,next) => {
    res.setHeader('Access-Control-Allow-Origin','*');
    res.setHeader('Access-Control-Allow-Methods','GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers','Content-Type');
    next();
});

app.get('/workflow', async (req: Request<{}, {}, {}, WorkflowQuery>, res: Response) => {
    const { id ,namespace} = req.query;
    const data = await temporal.getRootWorkflowData(namespace, id)
    res.status(200).json(data);
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
