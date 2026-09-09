import { Router, type IRouter } from "express";
import healthRouter from "./health";
import intelligenceRouter from "./intelligence";
import repositoryRouter from "./repository";
import searchRouter from "./search";
import analyticsRouter from "./analytics";
import documentationRouter from "./documentation";
import prIntelligenceRouter from "./pr-intelligence";
import vulnerabilitiesRouter from "./vulnerabilities";

const router: IRouter = Router();

router.use(healthRouter);
router.use(repositoryRouter);
router.use(searchRouter);
router.use(intelligenceRouter);
router.use(analyticsRouter);
router.use(documentationRouter);
router.use(prIntelligenceRouter);
router.use(vulnerabilitiesRouter);

export default router;
