import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import projectsRouter from "./projects";
import participantsRouter from "./participants";
import filesRouter from "./files";
import sharesRouter from "./shares";
import activityRouter from "./activity";
import storageRouter from "./storage";
import recordingSessionsRouter from "./recording-sessions";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(projectsRouter);
router.use(participantsRouter);
router.use(filesRouter);
router.use(sharesRouter);
router.use(activityRouter);
router.use(storageRouter);
router.use(recordingSessionsRouter);

export default router;
