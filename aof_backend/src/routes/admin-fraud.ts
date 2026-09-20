/**
 * Anti-fraud review queue. GET → read token; POST → ops token. There is no
 * endpoint that bans, throttles or re-scores a player: resolving a case only
 * records the human decision (AuditLog) so downstream policy can be applied
 * deliberately, with an audit trail, by an operator.
 */
import { Router } from "express";
import { db } from "../lib/db";
import { adminByMethod } from "../middleware/adminAuth";
import { resolveAuditActor } from "../middleware/audit";
import { scanFraudSignals, SIGNAL_CONFIG } from "../lib/fraudSignals";
import { AUTHORITY } from "../config";

const r = Router();
r.use(adminByMethod);

const withEvidence = (c: any) => ({ ...c, evidence: safeJson(c.evidence) });
function safeJson(s: string) { try { return JSON.parse(s); } catch { return s; } }

/** GET /admin/fraud/cases?status=open&signal=&wallet=&minSeverity=&limit= */
r.get("/cases", async (req, res) => {
  try {
    const where: any = { status: typeof req.query.status === "string" ? req.query.status : "open" };
    if (typeof req.query.signal === "string") where.signal = req.query.signal;
    if (typeof req.query.wallet === "string") where.wallet = req.query.wallet;
    const minSeverity = Number(req.query.minSeverity);
    if (Number.isFinite(minSeverity) && minSeverity > 0) where.severity = { gte: Math.floor(minSeverity) };
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 1000);
    const [rows, counts] = await Promise.all([
      db.fraudCase.findMany({ where, orderBy: [{ severity: "desc" }, { lastSeen: "desc" }], take: limit }),
      db.fraudCase.groupBy({ by: ["status", "signal"], _count: { _all: true } }),
    ]);
    res.json({
      cases: rows.map(withEvidence),
      summary: counts.map((c) => ({ status: c.status, signal: c.signal, count: c._count._all })),
      config: SIGNAL_CONFIG,
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/** GET /admin/fraud/wallet/:wallet — every case (any status) for one wallet. */
r.get("/wallet/:wallet", async (req, res) => {
  try {
    const rows = await db.fraudCase.findMany({ where: { wallet: req.params.wallet }, orderBy: { lastSeen: "desc" } });
    res.json({ wallet: req.params.wallet, cases: rows.map(withEvidence) });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/** POST /admin/fraud/scan { windowHours? } — run detectors now (also runs on a timer). */
r.post("/scan", async (req, res) => {
  try {
    const windowHours = Number(req.body?.windowHours);
    const result = await scanFraudSignals({
      windowHours: Number.isFinite(windowHours) && windowHours > 0 ? Math.min(windowHours, 24 * 30) : undefined,
      authorityPayers: [AUTHORITY.publicKey.toBase58()],
    });
    const actor = resolveAuditActor(req);
    await db.auditLog.create({ data: { user: actor.user, action: "fraud_scan", result: "success", metadata: JSON.stringify({ windowHours: result.windowHours, findings: result.findings.length, opened: result.opened, refreshed: result.refreshed }) } });
    res.json({ windowHours: result.windowHours, findings: result.findings.length, opened: result.opened, refreshed: result.refreshed });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * POST /admin/fraud/cases/:id/resolve { status: "confirmed"|"dismissed", note }
 * Human decision only. Idempotent: resolving an already-resolved case is 409.
 */
r.post("/cases/:id/resolve", async (req, res) => {
  try {
    const status = req.body?.status;
    const note = typeof req.body?.note === "string" ? req.body.note.slice(0, 2000) : "";
    if (status !== "confirmed" && status !== "dismissed") return res.status(400).json({ error: "status must be confirmed|dismissed" });
    if (!note.trim()) return res.status(400).json({ error: "note is required: every resolution must be justified" });
    const actor = resolveAuditActor(req);
    const now = new Date();
    // CAS on openKey: two reviewers cannot both resolve the same case.
    const updated = await db.fraudCase.updateMany({
      where: { id: req.params.id, status: "open" },
      data: { status, openKey: null, resolvedBy: actor.user, resolvedAt: now, resolution: note },
    });
    if (updated.count !== 1) return res.status(409).json({ error: "case not open" });
    const c = await db.fraudCase.findUnique({ where: { id: req.params.id } });
    await db.auditLog.create({
      data: {
        user: actor.user, action: "fraud_case_resolve", result: "success",
        metadata: JSON.stringify({ caseId: req.params.id, wallet: c?.wallet, signal: c?.signal, severity: c?.severity, status, note }),
        ip: req.ip, userAgent: req.headers["user-agent"] as string | undefined,
      },
    });
    res.json({ case: c ? withEvidence(c) : null });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default r;
