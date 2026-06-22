import { Router, type IRouter, type RequestHandler } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import organizationsRouter from "./organizations";
import projectsRouter from "./projects";
import participantsRouter from "./participants";
import filesRouter from "./files";
import sharesRouter from "./shares";
import activityRouter from "./activity";
import storageRouter from "./storage";
import recordingSessionsRouter from "./recording-sessions";
import studentUploadsRouter from "./student-uploads";
import studentAuthRouter from "./student-auth";
import studentMeRouter from "./student-me";
import helperDevicesRouter from "./helper-devices";
import submissionsRouter from "./submissions";
import renderJobsRouter from "./render-jobs";
import rcloneRouter from "./rclone";
import transfersRouter from "./transfers";
import devRouter from "./dev";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(organizationsRouter);
router.use(projectsRouter);
router.use(participantsRouter);
router.use(filesRouter);
router.use(sharesRouter);
router.use(activityRouter);
router.use(storageRouter);
router.use(recordingSessionsRouter);
router.use(studentUploadsRouter);

// Stage 2.1.1 — managed-student-account auth routes are gated behind an
// env flag so the production pilot can ship the schema + backend
// dormant. Until Stage 3 (student UI, teacher account management,
// permission flows, internal test accounts) is ready, every path under
// /student/auth/* returns a bare 404 — same as a non-existent route.
// Critically this means: no auth response shapes, no rate-limit
// headers, no timing signal. Route existence is unobservable.
//
// Default: OFF. Set STUDENT_ACCOUNTS_ENABLED=true on Fly only when the
// pilot is ready to onboard real (or synthetic) student accounts.
const studentAuthEnabled =
  (process.env["STUDENT_ACCOUNTS_ENABLED"] ?? "").toLowerCase() === "true";

const studentAuthGate: RequestHandler = (_req, res, next) => {
  if (!studentAuthEnabled) {
    res.status(404).send("Not Found");
    return;
  }
  next();
};

// Single broad gate: with STUDENT_ACCOUNTS_ENABLED off, EVERY path under
// /student/* (auth, me, future surfaces) returns a bare 404 — no JSON
// shape, no rate-limit headers, no timing signal. Both /student/auth/*
// AND /student/me/* (including the GET /student/me profile endpoint
// defined inside studentAuthRouter) are covered. Gating only on the
// specific prefixes is NOT enough because Express middleware order
// matters and any future /student/<x> route added to either router
// must inherit the gate automatically.
router.use("/student", studentAuthGate);
router.use(studentAuthRouter);
router.use(studentMeRouter);
router.use(helperDevicesRouter);
router.use(submissionsRouter);
router.use(renderJobsRouter);
router.use(rcloneRouter);
router.use(transfersRouter);

// DEV-only reset endpoints. Mounted ONLY when NODE_ENV !== "production".
// In production these routes simply do not exist — Express returns its
// default 404 for /dev/* with no body shape, no signal.
if (process.env["NODE_ENV"] !== "production") {
  router.use(devRouter);
}

export default router;
