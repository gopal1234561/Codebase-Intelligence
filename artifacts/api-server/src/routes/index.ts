import { Router, type IRouter } from "express";
import healthRouter from "./health";
import intelligenceRouter from "./intelligence";
import repositoryRouter from "./repository";

const router: IRouter = Router();

router.use(healthRouter);
router.use(repositoryRouter);
router.use(intelligenceRouter);

export default router;
