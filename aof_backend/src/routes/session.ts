import { Router } from "express";

const r = Router();

// The session-keys program currently rejects both session_create and
// session_check_and_spend until the reservation is atomically bound to the
// target instruction. Keep these API paths fail-closed instead of sending
// transactions to a different program or reporting a session as usable.
const disabled = (_req: unknown, res: any) => {
  res.status(503).json({
    error: "SESSION_KEYS_DISABLED_UNTIL_ATOMIC_TARGET_BINDING",
  });
};

r.post("/create", disabled);
r.post("/revoke", disabled);
r.post("/create-trader", disabled);

export default r;
